import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicJSON, privateDir, readJSON, token, identity, sameIdentity, fail, sleep } from './common.mjs';
import { request } from './http.mjs';

export async function control(ref, action = 'status') {
  if (!ref || !Number.isInteger(ref.port) || ref.port < 1 || ref.port > 65535 || !/^[a-f0-9]{64}$/.test(ref.key || '') || !/^[a-f0-9]{64}$/.test(ref.instance || '')) return null;
  // Identity failure is not permission to signal a PID. Control uses a capability.
  if (!sameIdentity(ref, await identity(ref.pid))) return null;
  try {
    const status = await request(`http://127.0.0.1:${ref.port}/status`, { headers: { authorization: `Bearer ${ref.key}` }, timeout: 2000 });
    const body = JSON.parse(status.body);
    if (status.status !== 200 || body.instance !== ref.instance || !sameIdentity(ref, body)) return null;
    if (action === 'status') return body;
    const result = await request(`http://127.0.0.1:${ref.port}/${action}`, { method: 'POST', headers: { authorization: `Bearer ${ref.key}` }, timeout: 2000 });
    return result.status === 200 ? JSON.parse(result.body) : null;
  } catch { return null; }
}
export async function stopWorker(ref) {
  if (!await control(ref)) return false;
  if (!await control(ref, 'stop')) fail('PROCESS_STOP_FAILED', 'Supervisor rejected the stop request.', 'Retry --stop; never kill a saved PID without verifying ownership.');
  for (let i = 0; i < 40; i++) { if (!await control(ref)) return true; await sleep(100); }
  fail('PROCESS_STOP_FAILED', 'Supervisor did not stop within the timeout.', 'Retry --status --verbose.');
}
export async function startWorker(store, spec, { signal } = {}) {
  const dir = join(store.sessions, token());
  await privateDir(dir);
  await atomicJSON(join(dir, 'spec.json'), { ...spec, instance: token(), key: token() });
  const worker = fileURLToPath(new URL('../worker.mjs', import.meta.url));
  const env = { ...process.env }; delete env.NODE_OPTIONS;
  const child = spawn(process.execPath, [worker, dir], { detached: true, stdio: 'ignore', env });
  let spawnError;
  child.on('error', e => { spawnError = e; }); child.unref();
  for (let i = 0; i < 100; i++) {
    const ref = await readJSON(join(dir, 'control.json'), true);
    if (ref && await control(ref)) {
      if (signal?.aborted) { await stopWorker(ref); fail('INTERRUPTED', 'Operation interrupted.'); }
      return ref;
    }
    if (spawnError || child.exitCode !== null || child.signalCode !== null) break;
    await sleep(100);
  }
  // This child is still ours and has not been reaped/reused; no persisted PID kill.
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  fail('PROCESS_START_FAILED', 'Could not start the managed supervisor.', 'Allow local listeners/processes in the agent environment or run from a terminal.');
}
