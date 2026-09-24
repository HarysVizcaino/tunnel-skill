import http from 'node:http';
const server = http.createServer((req, res) => {
  if (req.url === '/redirect') { res.writeHead(302, { location: 'https://example.org' }).end(); return; }
  const status = /^\/status\/(\d+)$/.exec(req.url)?.[1];
  res.writeHead(status ? +status : 200, { 'content-type': 'text/plain' });
  res.end('tunnel-fixture:' + process.cwd());
});
setTimeout(() => server.listen(+(process.env.PORT || 0), '127.0.0.1', () => console.log(server.address().port)), +(process.env.START_DELAY || 0));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
