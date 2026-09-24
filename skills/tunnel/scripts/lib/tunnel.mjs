import { join } from 'node:path';
import { projectPath, storage, privateDir, hash, token, fail, sleep } from './common.mjs';
import { withLock, readState, saveState } from './state.mjs';
import { control, startWorker, stopWorker } from './processes.mjs';
import { ensureRuntime } from './runtime.mjs';
import { detectProject, prepareStart, findServer } from './project.mjs';
import { probeLocal, verifyPublic } from './http.mjs';

const notice = 'Anyone with this URL can reach the entire local service while the tunnel is active.';
function result(state, extra = {}) {
  return { version: 1, ok: true, projectPath: state.projectPath, framework: state.framework, localUrl: state.localUrl, publicUrl: state.publicUrl, verification: state.verification, ...extra };
}
export async function run(options, dependencies = {}) {
  const deps = { ensureRuntime, verifyPublic, startWorker, ...dependencies };
  const store = dependencies.store || storage();
  const project = await projectPath(options.project);
  const signal = dependencies.signal;
  const check = () => { if (signal?.aborted) fail('INTERRUPTED', 'Operation interrupted.'); };
  if (options.mode === 'status') {
    const state = await readState(store, project);
    if (!state) return { version: 1, ok: true, status: 'inactive', projectPath: project };
    const live = await control(state.tunnel);
    const local = state.localPort ? await probeLocal(state.localPort) : null;
    return result(state, { publicUrl: live?.publicUrl || null, status: live?.publicUrl ? local ? 'running-unverified' : 'application-unavailable' : 'inactive', applicationRunning: !!local, lastVerification: state.verification, verification: null, ...(options.verbose ? { diagnostics: { provider: 'cloudflare', runtimeVersion: state.runtimeVersion, tunnelPid: live?.pid || null, appManagedByTunnel: !!state.app, stateDirectory: store.state } } : {}) });
  }
  await privateDir(store.root);
  return withLock(join(store.state, hash(project) + '.lock'), async () => {
    let state = await readState(store, project);
    const live = await control(state?.tunnel);
    if (options.mode === 'stop') {
      const stopped = await stopWorker(state?.tunnel);
      if (state) await saveState(store, project, { ...state, tunnel: null, publicUrl: null, verification: null });
      const local = state?.localPort ? await probeLocal(state.localPort) : null;
      return { version: 1, ok: true, status: 'stopped', stopped, projectPath: project, applicationRunning: !!local, message: local ? 'Tunnel stopped. The application is still running.' : 'No active tunnel remains.' };
    }
    if (live) {
      if (options.port && options.port !== state.localPort) fail('TUNNEL_TARGET_CONFLICT', 'A tunnel already exists for a different port.', 'Stop this project tunnel first, then start the requested port.');
      if (!live.publicUrl) fail('TUNNEL_NOT_READY', 'The existing supervisor has no public URL.', 'Inspect --status or stop it before retrying.');
      const verification = await deps.verifyPublic(live.publicUrl, state.proofKey, { signal, dnsServer: options.dnsServer });
      state = { ...state, publicUrl: live.publicUrl, verification };
      await saveState(store, project, state);
      return result(state, { status: 'active', reused: true, notice, ...(options.webhook ? { webhookUrl: state.publicUrl + options.webhook, webhookVerified: false } : {}) });
    }
    let app = null, tunnel = null;
    try {
      check();
      let info = { path: project, framework: 'http' }, local;
      if (options.port) {
        const probe = await probeLocal(options.port);
        if (!probe) fail('APP_NOT_READY', 'No HTTP service responds on the selected loopback port.', 'Start it manually and retry.');
        local = { ...probe, port: options.port };
      } else {
        info = await detectProject(project);
        local = await findServer(info.path);
      }
      const command = !local ? await prepareStart(info) : null;
      const runtime = await deps.ensureRuntime(store, { signal });
      check();
      if (!local) {
        app = await deps.startWorker(store, { kind: 'app', ...command }, { signal });
        const deadline = Date.now() + 60000;
        while (Date.now() < deadline) {
          check();
          const status = await control(app);
          if (!status) fail('APP_START_FAILED', 'Development command exited before the app was ready.', 'Run the command manually to see application output.', { command: `${info.manager} run dev` });
          local = await findServer(info.path, { rootPid: status.childPid });
          if (local) break;
          await sleep(500);
        }
        if (!local) fail('APP_NOT_READY', 'Application did not become ready within 60 seconds.', 'Start it manually and use --port.');
      }
      check();
      const proofKey = token();
      tunnel = await deps.startWorker(store, { kind: 'tunnel', cwd: info.path, runtime: runtime.path, localUrl: local.url, proofKey }, { signal });
      // Journal capabilities before waiting. A killed CLI cannot orphan an untracked
      // committed worker; uncommitted workers expire after five minutes.
      state = { version: 1, projectPath: project, framework: info.framework, localPort: local.port, localUrl: local.url, app: app || state?.app || null, tunnel, proofKey, runtimeVersion: runtime.version, createdAt: new Date().toISOString(), publicUrl: null, verification: null };
      await saveState(store, project, state);
      let ready;
      const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        check(); ready = await control(tunnel);
        if (!ready) fail('TUNNEL_START_FAILED', 'Tunnel provider exited before returning a URL.', 'Check Internet access and outbound Cloudflare connectivity.');
        if (ready.publicUrl) break;
        await sleep(300);
      }
      if (!ready?.publicUrl) fail('TUNNEL_START_FAILED', 'Provider did not return a public URL within 45 seconds.', 'Check outbound network access and retry.');
      const verification = await deps.verifyPublic(ready.publicUrl, proofKey, { signal, dnsServer: options.dnsServer });
      check(); state = { ...state, publicUrl: ready.publicUrl, verification };
      await saveState(store, project, state);
      if (app && !await control(app, 'commit')) fail('APP_START_FAILED', 'Application supervisor exited before completion.');
      if (!await control(tunnel, 'commit')) fail('TUNNEL_START_FAILED', 'Tunnel supervisor exited before completion.');
      return result(state, { status: 'active', reused: false, notice, ...(options.webhook ? { webhookUrl: state.publicUrl + options.webhook, webhookVerified: false } : {}) });
    } catch (e) {
      // Preserve capabilities on cleanup failure, so a later --stop can recover.
      let cleanupFailed = false;
      for (const ref of [tunnel, app]) if (ref) { try { await stopWorker(ref); } catch { cleanupFailed = true; } }
      if (state && !cleanupFailed) await saveState(store, project, { ...state, tunnel: null, app: app ? null : state.app, publicUrl: null, verification: null });
      if (cleanupFailed) e.action = 'Cleanup was incomplete. Run --status --verbose and --stop before retrying.';
      throw e;
    }
  });
}
