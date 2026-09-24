import http from 'node:http';
import https from 'node:https';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { token, sleep, fail } from './common.mjs';
import { createPublicLookup } from './dns.mjs';

export function request(url, { method = 'GET', headers = {}, body, timeout = 5000, limit = 65536, dnsFallback = false, dnsServer } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const client = u.protocol === 'https:' ? https : http;
    let usedFallback = false;
    const lookup = dnsFallback ? createPublicLookup({ dnsServer, onFallback: () => { usedFallback = true; } }) : undefined;
    const req = client.request(u, { method, headers, agent: false, lookup }, res => {
      const chunks = []; let size = 0; let settled = false;
      const finish = () => {
        if (settled) return; settled = true;
        clearTimeout(timer);
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), ...(usedFallback ? { dnsResolution: dnsServer ? 'explicit-dns-server' : 'configured-dns-fallback', ...(dnsServer ? { dnsServer } : {}) } : {}) });
      };
      res.on('data', b => { const part = b.subarray(0, Math.max(0, limit - size)); chunks.push(part); size += part.length; if (size >= limit) { finish(); res.destroy(); } });
      res.on('end', finish); res.on('error', e => { if (!settled) { clearTimeout(timer); reject(e); } });
    });
    const timer = setTimeout(() => req.destroy(new Error('Request timed out')), timeout);
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.end(body);
  });
}
export function proof(key, nonce, status) { return createHmac('sha256', key).update(`${nonce}:${status}`).digest('hex'); }
export function validProof(key, nonce, response) {
  const actual = response.headers['x-tunnel-proof'];
  const expected = proof(key, nonce, response.status);
  return typeof actual === 'string' && actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
export async function probeLocal(port) {
  for (const host of ['127.0.0.1', '[::1]']) {
    const url = `http://${host}:${port}`;
    try { const r = await request(url, { timeout: 1500, limit: 2048 }); return { url, status: r.status }; } catch { /* try the other loopback family */ }
  }
  return null;
}
export async function verifyPublic(url, key, { timeout = 45000, probe = request, signal, dnsServer } = {}) {
  const deadline = Date.now() + timeout;
  let httpStatus = null, networkCode = null;
  while (Date.now() < deadline) {
    if (signal?.aborted) fail('INTERRUPTED', 'Operation interrupted.');
    const nonce = token();
    try {
      const r = await probe(url + '/', { headers: { 'x-tunnel-challenge': nonce, 'cache-control': 'no-cache' }, timeout: Math.min(5000, deadline - Date.now()), limit: 2048, dnsFallback: true, dnsServer });
      httpStatus = r.status;
      if (validProof(key, nonce, r)) return { status: r.status >= 400 ? 'application-error' : r.status >= 300 ? 'application-redirect' : 'verified', httpStatus: r.status, checkedAt: new Date().toISOString(), ...(r.dnsResolution ? { dnsResolution: r.dnsResolution } : {}), ...(r.dnsServer ? { dnsServer: r.dnsServer } : {}) };
    } catch (error) { networkCode = error.code || 'TRANSPORT_TIMEOUT'; }
    await sleep(Math.min(1000, Math.max(0, deadline - Date.now())));
  }
  fail('PUBLIC_VERIFICATION_FAILED', 'Public response could not be authenticated as coming from the selected application.', 'Check --status --verbose and retry; no successful public URL has been reported.', { httpStatus, networkCode });
}
