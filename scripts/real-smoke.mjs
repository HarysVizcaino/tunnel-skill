// Opt-in integration test: exposes only an in-memory fixture, never a user app.
import http from 'node:http';
import { mkdtemp, rm, realpath, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { storage, sleep } from '../skills/tunnel/scripts/lib/common.mjs';
import { run } from '../skills/tunnel/scripts/lib/tunnel.mjs';
import { request, verifyPublic } from '../skills/tunnel/scripts/lib/http.mjs';

// Diagnostic override only: leave the shipped skill's verification timeout unchanged.
const timeoutArgument = process.argv.find(arg => arg.startsWith('--verify-timeout-ms='));
const verificationTimeout = timeoutArgument ? Number(timeoutArgument.split('=')[1]) : 45000;
if (!Number.isInteger(verificationTimeout) || verificationTimeout < 1000 || verificationTimeout > 180000) {
  throw new Error('--verify-timeout-ms must be an integer between 1000 and 180000');
}

const dir = await realpath(await mkdtemp(join(tmpdir(), 'tunnel-real-smoke-')));
const store = storage(join(dir, 'managed'));
const server = http.createServer((req, res) => { res.setHeader('content-type', 'text/plain'); res.end(req.method === 'POST' ? 'tunnel-webhook-fixture-ok' : 'tunnel-public-fixture-ok'); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
if (process.env.TUNNEL_SMOKE_ARTIFACT) {
  await mkdir(store.cache, { recursive: true });
  await copyFile(process.env.TUNNEL_SMOKE_ARTIFACT, join(store.cache, 'cloudflared-darwin-arm64.tgz-2026.9.1'));
}
try {
  const created = await run({ project: dir, mode: 'start', port: server.address().port, webhook: '/fixture-webhook' }, { store, verifyPublic: async (url, key, options) => {
    const started = Date.now();
    console.log(JSON.stringify({ phase: 'verifying-not-yet-ready', url, timeoutMs: verificationTimeout, startedAt: new Date(started).toISOString() }));
    const verification = await verifyPublic(url, key, { ...options, timeout: verificationTimeout });
    console.log(JSON.stringify({ phase: 'verified', elapsedMs: Date.now() - started }));
    return verification;
  } });
  console.log(JSON.stringify({ phase: 'created', ...created }));
  const delivered = await request(created.webhookUrl, { method: 'POST', body: 'fixture', timeout: 10000 });
  if (delivered.body !== 'tunnel-webhook-fixture-ok') throw new Error('Fixture webhook did not arrive');
  console.log(JSON.stringify({ phase: 'webhook', status: delivered.status, received: true }));
  if (process.argv.includes('--hold')) await sleep(45000);
  const reused = await run({ project: dir, mode: 'start', port: server.address().port }, { store });
  if (!reused.reused) throw new Error('Tunnel was duplicated');
  console.log(JSON.stringify({ phase: 'reused', ok: true }));
} finally {
  console.log(JSON.stringify(await run({ project: dir, mode: 'stop' }, { store })));
  await new Promise(r => server.close(r));
  await rm(dir, { recursive: true, force: true });
}
