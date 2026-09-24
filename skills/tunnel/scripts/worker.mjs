import http from 'node:http';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { readJSON, atomicJSON, identity, cleanEnvironment, privateDir, sleep } from './lib/common.mjs';
import { createBridge } from './lib/bridge.mjs';

// Internal supervisor. Its capability-authenticated control server is separate
// from the public bridge and never forwarded through cloudflared.
const dir = process.argv[2];
const spec = await readJSON(join(dir, 'spec.json'));
let child, bridge, publicUrl = null, stopping = false, committed = false, exited = false;
let phase = 'starting', exitCode = null;
const self = await identity(process.pid);
const lease = setTimeout(() => shutdown(), 300000);
const server = http.createServer(async (req, res) => {
  if (req.headers.authorization !== `Bearer ${spec.key}`) { res.writeHead(403).end(); return; }
  res.setHeader('content-type', 'application/json');
  if (req.method === 'GET' && req.url === '/status') {
    res.end(JSON.stringify({ instance: spec.instance, ...self, phase, childPid: child?.pid, publicUrl, bridgeUrl: bridge?.url, exitCode, committed }));
  } else if (req.method === 'POST' && req.url === '/commit') {
    committed = true; clearTimeout(lease); res.end(JSON.stringify({ ok: true }));
  } else if (req.method === 'POST' && req.url === '/stop') {
    res.end(JSON.stringify({ ok: true })); setImmediate(shutdown);
  } else res.writeHead(404).end();
});
server.requestTimeout = 5000;
server.headersTimeout = 5000;
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
await atomicJSON(join(dir, 'control.json'), { version: 1, ...self, port: server.address().port, instance: spec.instance, key: spec.key, directory: dir });

async function shutdown() {
  if (stopping) return;
  stopping = true; phase = 'stopping'; clearTimeout(lease);
  if (child?.pid) {
    // The detached supervisor is the group leader and is still alive. Its
    // group ID cannot be reused while we signal it, even if npm exited first.
    try { process.kill(-process.pid, 'SIGTERM'); } catch {}
    for (let i = 0; i < 20 && !exited; i++) await sleep(100);
  }
  bridge?.close(); server.close();
  await atomicJSON(join(dir, 'exit.json'), { stoppedAt: new Date().toISOString(), exitCode });
  setTimeout(() => { try { process.kill(-process.pid, 'SIGKILL'); } catch { process.exit(0); } }, 30);
}
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, shutdown);
try {
  let env, command, args;
  if (spec.kind === 'tunnel') {
    bridge = await createBridge(spec.localUrl, spec.proofKey, () => publicUrl);
    const configDir = join(dir, 'provider'); await privateDir(configDir);
    const config = join(configDir, 'config.yaml');
    await writeFile(config, '{}\n', { mode: 0o600 });
    env = cleanEnvironment(); env.XDG_CONFIG_HOME = configDir;
    command = spec.runtime;
    args = ['tunnel', '--config', config, '--no-autoupdate', '--url', bridge.url];
  } else if (spec.kind === 'app') {
    env = { ...process.env, BROWSER: 'none', CI: '1' };
    delete env.NODE_OPTIONS;
    command = spec.command; args = spec.args;
  } else throw new Error('Invalid worker kind');
  child = spawn(command, args, { cwd: spec.cwd, env, detached: false, stdio: ['ignore', 'pipe', 'pipe'] });
  child.on('error', async () => { phase = 'failed'; exited = true; exitCode = -1; await shutdown(); });
  child.on('exit', (code) => { exited = true; exitCode = code; phase = 'exited'; if (!stopping) shutdown(); });
  let lineBuffer = '';
  const consume = chunk => {
    if (spec.kind !== 'tunnel') return; // Do not persist application logs/secrets.
    lineBuffer = (lineBuffer + chunk.toString()).slice(-16384);
    const match = [...lineBuffer.matchAll(/https:\/\/([a-z0-9]+(?:-[a-z0-9]+)*)\.trycloudflare\.com(?=[\s|"']|$)/g)].filter(x => !['api', 'www'].includes(x[1])).at(-1);
    if (match) { publicUrl = match[0]; phase = 'running'; }
  };
  child.stdout.on('data', consume); child.stderr.on('data', consume);
  if (spec.kind === 'app') phase = 'running';
} catch {
  phase = 'failed'; exitCode = -1; await shutdown();
}
