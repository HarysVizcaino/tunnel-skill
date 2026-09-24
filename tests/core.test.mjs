import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { mkdtemp, mkdir, writeFile, readFile, rm, chmod, realpath, cp } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs, normalizeWebhook } from '../skills/tunnel/scripts/lib/args.mjs';
import { hash, storage, atomicJSON, identity, token, sleep } from '../skills/tunnel/scripts/lib/common.mjs';
import { withLock, saveState, readState } from '../skills/tunnel/scripts/lib/state.mjs';
import { ensureRuntime } from '../skills/tunnel/scripts/lib/runtime.mjs';
import { detectProject, findServer } from '../skills/tunnel/scripts/lib/project.mjs';
import { request, verifyPublic, probeLocal } from '../skills/tunnel/scripts/lib/http.mjs';
import { createBridge } from '../skills/tunnel/scripts/lib/bridge.mjs';
import { startWorker, control, stopWorker } from '../skills/tunnel/scripts/lib/processes.mjs';
import { run } from '../skills/tunnel/scripts/lib/tunnel.mjs';

async function workspace(t) {
  const path = await realpath(await mkdtemp(join(tmpdir(), 'tunnel test ')));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
async function appServer(t, status = 200) {
  const seen = [];
  const server = http.createServer((req, res) => { seen.push(req.headers); res.writeHead(status, { 'content-type': 'text/plain', location: 'https://example.org' }); res.end('fixture origin'); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => { server.closeAllConnections(); server.close(r); }));
  return { port: server.address().port, seen };
}

test('arguments reject ambiguity, injection-like port and conflicting modes', () => {
  for (const args of [['--port', '3000;touch x'], ['--port', '0'], ['--port', '65536'], ['--status', '--stop'], ['--status', '--port', '3000'], ['--wat'], ['--port'], ['--port', '3', '--port', '4']]) assert.throws(() => parseArgs(args));
  assert.equal(parseArgs(['--port', '3000']).port, 3000);
});
test('webhook routes preserve encoding without changing origin', () => {
  assert.equal(normalizeWebhook('api/a%20b'), '/api/a%20b');
  for (const path of ['https://evil.test', '//evil.test', '/x?token=secret', '/x#part', '/a/../b', '/%2e%2e/x', '/x%00', '/x\\y', '/%2Fexample.test']) assert.throws(() => normalizeWebhook(path));
});
test('project metadata selects framework and rejects conflicting managers', async t => {
  const dir = await workspace(t);
  await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' }, devDependencies: { vite: '*' }, packageManager: 'pnpm@10.0.0' }));
  assert.equal((await detectProject(dir)).manager, 'pnpm');
  await writeFile(join(dir, 'package-lock.json'), '{}');
  await assert.rejects(detectProject(dir), { code: 'MANAGER_AMBIGUOUS' });
});
test('monorepo returns candidates rather than choosing first app', async t => {
  const dir = await workspace(t);
  for (const name of ['web', 'admin']) { await mkdir(join(dir, 'apps', name), { recursive: true }); await writeFile(join(dir, 'apps', name, 'package.json'), JSON.stringify({ dependencies: { next: '*' } })); }
  await assert.rejects(detectProject(dir), { code: 'AMBIGUOUS_TARGET' });
});

test('selected workspace app inherits its parent package manager', async t => {
  const dir = await workspace(t), app = join(dir, 'apps', 'web');
  await mkdir(app, { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.0.0' }));
  await writeFile(join(app, 'package.json'), JSON.stringify({ devDependencies: { vite: '*' }, scripts: { dev: 'vite' } }));
  assert.equal((await detectProject(app)).manager, 'pnpm');
});

test('bridge preserves WebSocket upgrade headers and bidirectional bytes', async t => {
  const origin = http.createServer();
  const clients = new Set();
  origin.on('connection', c => { clients.add(c); c.on('close', () => clients.delete(c)); });
  origin.on('upgrade', (req, socket, head) => {
    assert.equal(req.headers.upgrade, 'websocket');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\nhello');
    socket.on('data', data => socket.write(data));
  });
  await new Promise(r => origin.listen(0, '127.0.0.1', r));
  t.after(() => { for (const c of clients) c.destroy(); origin.close(); });
  const bridge = await createBridge(`http://127.0.0.1:${origin.address().port}`, token());
  t.after(() => bridge.close());
  const address = new URL(bridge.url);
  const received = await new Promise((resolve, reject) => {
    const client = net.connect({ port: +address.port, host: '127.0.0.1' });
    client.setTimeout(3000, () => { client.destroy(); reject(new Error('Upgrade timed out')); });
    client.on('error', reject);
    client.on('connect', () => client.write('GET /socket HTTP/1.1\r\nHost: test\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n'));
    let response = '';
    client.on('data', data => { response += data.toString(); if (response.includes('hello')) { client.destroy(); resolve(response); } });
  });
  assert.match(received, /101 Switching Protocols/);
});

test('concurrent start operations do not create duplicate tunnels', async t => {
  const dir = await workspace(t), store = storage(join(dir, 'home')), app = await appServer(t);
  const provider = resolve('tests/fixtures/provider.mjs'); await chmod(provider, 0o700);
  const deps = { store, ensureRuntime: async () => ({ path: provider, version: 'fixture' }), verifyPublic: async (_, key) => {
    const state = await readState(store, dir), live = await control(state.tunnel);
    return verifyPublic(live.bridgeUrl, key, { timeout: 2000 });
  } };
  const results = await Promise.allSettled([run({ project: dir, port: app.port, mode: 'start' }, deps), run({ project: dir, port: app.port, mode: 'start' }, deps)]);
  try {
    assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(results.find(x => x.status === 'rejected').reason.code, 'LOCK_BUSY');
  } finally { await run({ project: dir, mode: 'stop' }, deps); }
});
test('lock excludes concurrent mutations and preserves live owner', async t => {
  const dir = await workspace(t);
  await withLock(join(dir, 'operation.lock'), async () => {
    await assert.rejects(withLock(join(dir, 'operation.lock'), () => assert.fail()), { code: 'LOCK_BUSY' });
  });
  assert.equal(await withLock(join(dir, 'operation.lock'), () => 42), 42);
});
test('corrupt state fails closed', async t => {
  const dir = await workspace(t), store = storage(join(dir, 'home'));
  await saveState(store, dir, { framework: 'vite' });
  await writeFile(join(store.state, hash(dir) + '.json'), '{broken');
  await assert.rejects(readState(store, dir), { code: 'STATE_CORRUPT' });
});
test('runtime checks pinned bytes, reuses verified archive and repairs binary', async t => {
  const dir = await workspace(t), store = storage(join(dir, 'home'));
  const bytes = Buffer.from('#!/bin/sh\nexit 0\n'); let count = 0;
  const manifest = { version: 'test', artifacts: { 'linux-x64': { name: 'fixture', archive: false, url: 'https://github.com/example', sha256: hash(bytes) } } };
  const options = { platform: 'linux', arch: 'x64', manifest, downloader: async () => { count++; return bytes; } };
  const runtime = await ensureRuntime(store, options);
  await writeFile(runtime.path, 'tampered');
  await ensureRuntime(store, options);
  assert.equal(count, 1); assert.equal(hash(await readFile(runtime.path)), hash(bytes));
});
test('runtime rejects checksum mismatch before installing executable', async t => {
  const dir = await workspace(t), store = storage(join(dir, 'home'));
  const manifest = { version: 'test', artifacts: { 'linux-x64': { name: 'fixture', archive: false, url: 'https://github.com/example', sha256: hash('good') } } };
  await assert.rejects(ensureRuntime(store, { platform: 'linux', arch: 'x64', manifest, downloader: async () => Buffer.from('bad') }), { code: 'CHECKSUM_MISMATCH' });
});
for (const status of [200, 302, 401, 404, 500]) test(`bridge authenticates application response ${status}`, async t => {
  const app = await appServer(t, status), key = token();
  const bridge = await createBridge(`http://127.0.0.1:${app.port}`, key, () => 'https://fixture.trycloudflare.com');
  t.after(() => bridge.close());
  const verified = await verifyPublic(bridge.url, key, { timeout: 1000 });
  assert.equal(verified.httpStatus, status);
  assert.equal(app.seen[0]['x-tunnel-challenge'], undefined);
  assert.equal(app.seen[0].host, `127.0.0.1:${app.port}`);
});
test('a reachable provider error or forged proof is not success', async () => {
  await assert.rejects(verifyPublic('https://example.test', token(), { timeout: 10, probe: async () => ({ status: 200, headers: { 'x-tunnel-proof': 'bad' }, body: 'provider error' }) }), { code: 'PUBLIC_VERIFICATION_FAILED' });
});
test('bridge strips spoofed proof headers and rewrites only matching Origin', async t => {
  const app = await appServer(t), key = token();
  const bridge = await createBridge(`http://127.0.0.1:${app.port}`, key, () => 'https://fixture.trycloudflare.com'); t.after(() => bridge.close());
  await request(bridge.url, { headers: { origin: 'https://fixture.trycloudflare.com', 'x-tunnel-proof': 'spoof' } });
  assert.equal(app.seen[0].origin, `http://127.0.0.1:${app.port}`); assert.equal(app.seen[0]['x-tunnel-proof'], undefined);
  await request(bridge.url, { headers: { origin: 'https://unrelated.test' } }); assert.equal(app.seen[1].origin, 'https://unrelated.test');
});
test('supervisor rejects forged identity and stops only its own child', async t => {
  const dir = await workspace(t), store = storage(join(dir, 'home'));
  const worker = await startWorker(store, { kind: 'app', cwd: dir, command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] });
  t.after(() => stopWorker(worker));
  assert.ok(await control(worker));
  assert.equal(await control({ ...worker, started: 'invalid' }, 'stop'), null);
  assert.equal(await control({ ...worker, key: token() }, 'stop'), null);
  assert.ok(await control(worker));
  assert.equal(await stopWorker(worker), true); assert.equal(await stopWorker(worker), false);
});

test('full port flow: create, authenticate, reuse, status, conflict, webhook, stop', async t => {
  const dir = await workspace(t), store = storage(join(dir, 'home'));
  const app = await appServer(t), provider = resolve('tests/fixtures/provider.mjs'); await chmod(provider, 0o700);
  const deps = { store, ensureRuntime: async () => ({ path: provider, version: 'fixture' }), verifyPublic: async (_, key) => {
    const state = await readState(store, dir), live = await control(state.tunnel);
    return verifyPublic(live.bridgeUrl, key, { timeout: 2000 });
  } };
  t.after(async () => { const state = await readState(store, dir); if (state?.tunnel) await stopWorker(state.tunnel); });
  const first = await run({ project: dir, port: app.port, mode: 'start', webhook: '/api/webhook' }, deps);
  assert.equal(first.status, 'active'); assert.equal(first.reused, false); assert.equal(first.webhookVerified, false);
  const before = (await readState(store, dir)).tunnel;
  const second = await run({ project: dir, port: app.port, mode: 'start' }, deps);
  assert.equal(second.reused, true); assert.equal((await readState(store, dir)).tunnel.pid, before.pid);
  await assert.rejects(run({ project: dir, port: app.port === 65535 ? 65534 : app.port + 1, mode: 'start' }, deps), { code: 'TUNNEL_TARGET_CONFLICT' });
  assert.equal((await run({ project: dir, mode: 'status' }, deps)).status, 'running-unverified');
  assert.equal((await run({ project: dir, mode: 'stop' }, deps)).applicationRunning, true);
  assert.equal((await request(`http://127.0.0.1:${app.port}`)).status, 200);
  assert.equal((await run({ project: dir, mode: 'stop' }, deps)).stopped, false);
});

test('failed verification rolls back new tunnel and preserves external app', async t => {
  const dir = await workspace(t), store = storage(join(dir, 'home')), app = await appServer(t);
  const provider = resolve('tests/fixtures/provider.mjs'); await chmod(provider, 0o700);
  await assert.rejects(run({ project: dir, port: app.port, mode: 'start' }, { store, ensureRuntime: async () => ({ path: provider, version: 'fixture' }), verifyPublic: async () => { throw new Error('fixture failed'); } }));
  assert.equal((await readState(store, dir)).tunnel, null);
  assert.equal((await request(`http://127.0.0.1:${app.port}`)).status, 200);
});

test('abandoned locks require deliberate recovery instead of racing to steal a lock', async t => {
  const dir = await workspace(t), lock = join(dir, 'lock');
  await mkdir(lock); await atomicJSON(join(lock, 'owner.json'), { pid: process.pid, started: 'old-start-time' });
  await assert.rejects(withLock(lock, () => assert.fail()), { code: 'LOCK_STALE' });
});

test('automatic startup discovers effective port and keeps the app after tunnel stop', async t => {
  const dir = await workspace(t), store = storage(join(dir, 'home'));
  await mkdir(join(dir, 'node_modules', 'vite'), { recursive: true });
  await writeFile(join(dir, 'server.mjs'), await readFile(resolve('tests/fixtures/server.mjs')));
  await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'node server.mjs' }, dependencies: { vite: '*' } }));
  const provider = resolve('tests/fixtures/provider.mjs'); await chmod(provider, 0o700);
  const deps = { store, ensureRuntime: async () => ({ path: provider, version: 'fixture' }), verifyPublic: async (_, key) => {
    const state = await readState(store, dir), live = await control(state.tunnel);
    return verifyPublic(live.bridgeUrl, key, { timeout: 2000 });
  } };
  t.after(async () => { const state = await readState(store, dir); await stopWorker(state?.tunnel); await stopWorker(state?.app); });
  const first = await run({ project: dir, mode: 'start' }, deps);
  assert.equal(first.framework, 'vite'); assert.equal(first.status, 'active');
  const state = await readState(store, dir);
  assert.ok(state.app); assert.ok(state.localPort);
  await run({ project: dir, mode: 'stop' }, deps);
  assert.ok(await control(state.app));
  assert.match((await request(state.localUrl)).body, /tunnel-fixture/);
});

test('server discovery selects current project instead of another project listener', async t => {
  const base = await workspace(t), store = storage(join(base, 'home'));
  const paths = [join(base, 'first'), join(base, 'second')];
  const workers = [];
  t.after(async () => { for (const worker of workers) await stopWorker(worker); });
  for (const path of paths) {
    await mkdir(path);
    await writeFile(join(path, 'server.mjs'), await readFile(resolve('tests/fixtures/server.mjs')));
    workers.push(await startWorker(store, { kind: 'app', cwd: path, command: process.execPath, args: ['server.mjs'] }));
  }
  let first, second;
  for (let i = 0; i < 15 && (!first || !second); i++) { first = await findServer(paths[0]); second = await findServer(paths[1]); if (!first || !second) await sleep(100); }
  assert.ok(first); assert.ok(second); assert.notEqual(first.port, second.port);
  assert.equal((await request(first.url)).body, 'tunnel-fixture:' + paths[0]);
  assert.equal((await request(second.url)).body, 'tunnel-fixture:' + paths[1]);
});

test('cancellation rolls back managed resources', async t => {
  const dir = await workspace(t), store = storage(join(dir, 'home')), app = await appServer(t);
  const provider = resolve('tests/fixtures/provider.mjs'); await chmod(provider, 0o700);
  const signal = new AbortController();
  await assert.rejects(run({ project: dir, port: app.port, mode: 'start' }, {
    store, signal: signal.signal, ensureRuntime: async () => ({ path: provider, version: 'fixture' }), verifyPublic: async () => { signal.abort(); return { status: 'verified' }; }
  }), { code: 'INTERRUPTED' });
  assert.equal((await readState(store, dir)).tunnel, null);
  assert.equal((await request(`http://127.0.0.1:${app.port}`)).status, 200);
});

test('cancelled runtime download releases its lock and never installs bytes', async t => {
  const dir = await workspace(t), store = storage(join(dir, 'home')), controller = new AbortController();
  const manifest = { version: 'test', artifacts: { 'linux-x64': { name: 'fixture', archive: false, url: 'https://github.com/example', sha256: hash('good') } } };
  await assert.rejects(ensureRuntime(store, { platform: 'linux', arch: 'x64', manifest, signal: controller.signal, downloader: async () => { controller.abort(); throw new Error('cancelled'); } }), { code: 'INTERRUPTED' });
  assert.equal(await withLock(join(store.bin, 'runtime.lock'), () => 'released'), 'released');
});

test('copied skill runs from paths with spaces without source-checkout dependencies', async t => {
  const dir = await workspace(t), copied = join(dir, 'installed skill'), project = join(dir, 'other project'), store = storage(join(dir, 'state home'));
  await mkdir(project); await cp(resolve('skills/tunnel'), copied, { recursive: true });
  const installed = await import(pathToFileURL(join(copied, 'scripts/lib/tunnel.mjs')));
  const app = await appServer(t), provider = resolve('tests/fixtures/provider.mjs'); await chmod(provider, 0o700);
  const deps = { store, ensureRuntime: async () => ({ path: provider, version: 'fixture' }), verifyPublic: async (_, key) => {
    const state = await readState(store, project), live = await control(state.tunnel);
    return verifyPublic(live.bridgeUrl, key, { timeout: 2000 });
  } };
  try {
    const result = await installed.run({ project, port: app.port, mode: 'start' }, deps);
    assert.equal(result.status, 'active');
    assert.equal((await installed.run({ project, mode: 'status' }, deps)).status, 'running-unverified');
  } finally { await installed.run({ project, mode: 'stop' }, deps); }
});

test('supervisor cleans descendants when their parent exits unexpectedly', async t => {
  const dir = await workspace(t), store = storage(join(dir, 'home'));
  await writeFile(join(dir, 'descendant.mjs'), `import http from 'node:http'; import {writeFileSync} from 'node:fs'; const s=http.createServer((q,r)=>r.end('alive')); s.listen(0,'127.0.0.1',()=>writeFileSync('port',String(s.address().port))); setTimeout(()=>process.exit(0),5000);`);
  await writeFile(join(dir, 'parent.mjs'), `import {spawn} from 'node:child_process'; spawn(process.execPath,['descendant.mjs'],{stdio:'ignore'}); setTimeout(()=>process.exit(7),900);`);
  const worker = await startWorker(store, { kind: 'app', cwd: dir, command: process.execPath, args: ['parent.mjs'] });
  try {
    let port;
    for (let i = 0; i < 20 && !port; i++) { try { port = +(await readFile(join(dir, 'port'), 'utf8')); } catch {} if (!port) await sleep(30); }
    assert.ok(port); assert.ok(await probeLocal(port));
    await sleep(1200);
    assert.equal(await control(worker), null);
    assert.equal(await probeLocal(port), null);
  } finally { await stopWorker(worker); }
});
