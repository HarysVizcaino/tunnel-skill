import http from 'node:http';
import net from 'node:net';
import { proof } from './http.mjs';

const hop = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];
function headersFor(req, target, publicUrl) {
  const headers = { ...req.headers, host: target.host };
  for (const name of hop) delete headers[name];
  delete headers['x-tunnel-challenge']; delete headers['x-tunnel-proof'];
  if (publicUrl && headers.origin === publicUrl) headers.origin = target.origin;
  return headers;
}
export async function createBridge(localUrl, key, getPublicUrl = () => null) {
  const target = new URL(localUrl);
  if (target.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(target.hostname)) throw new Error('Bridge accepts loopback HTTP only.');
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    if (!req.url.startsWith('/') || req.url.startsWith('//')) { res.writeHead(400).end(); return; }
    const nonce = req.headers['x-tunnel-challenge'];
    const upstream = http.request({ hostname: target.hostname.replace(/[\[\]]/g, ''), port: target.port, path: req.url, method: req.method, headers: headersFor(req, target, getPublicUrl()) }, response => {
      const headers = { ...response.headers };
      for (const name of hop) delete headers[name];
      delete headers['x-tunnel-proof'];
      if (typeof nonce === 'string' && /^[a-f0-9]{64}$/.test(nonce)) {
        headers['x-tunnel-proof'] = proof(key, nonce, response.statusCode);
        headers['cache-control'] = 'no-store';
      }
      res.writeHead(response.statusCode, headers); response.pipe(res);
      response.on('error', () => res.destroy());
    });
    upstream.setTimeout(60000, () => upstream.destroy());
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'cache-control': 'no-store' }); res.end('Local application unavailable.'); });
    res.on('close', () => upstream.destroy());
    req.pipe(upstream);
  });
  server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/') || req.url.startsWith('//')) { socket.destroy(); return; }
    const upstream = net.connect({ host: target.hostname.replace(/[\[\]]/g, ''), port: +target.port });
    sockets.add(upstream); upstream.on('close', () => sockets.delete(upstream));
    upstream.on('connect', () => {
      const headers = headersFor(req, target, getPublicUrl());
      headers.connection = 'Upgrade'; headers.upgrade = req.headers.upgrade || 'websocket';
      upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(headers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\r\n')}\r\n\r\n`);
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy()); socket.on('close', () => upstream.destroy());
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => { for (const s of sockets) s.destroy(); server.close(); } };
}
