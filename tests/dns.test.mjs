import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicLookup } from '../skills/tunnel/scripts/lib/dns.mjs';
import { proof, verifyPublic } from '../skills/tunnel/scripts/lib/http.mjs';
import { parseArgs } from '../skills/tunnel/scripts/lib/args.mjs';

const host = 'demo-fixture.trycloudflare.com';
const error = Object.assign(new Error('lookup failed'), { code: 'ENOTFOUND' });
const failed = (_, __, callback) => callback(error);
const query = (lookup, hostname = host, options = { all: true }) => new Promise((resolve, reject) => {
  lookup(hostname, options, (err, address, family) => err ? reject(err) : resolve({ address, family }));
});

test('successful system resolution is preserved without DNS queries', async () => {
  const lookup = createPublicLookup({ lookup: (_, __, cb) => cb(null, '192.0.2.1', 4), makeResolver: () => assert.fail('unnecessary query') });
  assert.deepEqual(await query(lookup, host, { family: 4 }), { address: '192.0.2.1', family: 4 });
});
test('fallback recovers a negative OS lookup and supports IPv4/IPv6 address lists', async () => {
  let used = false;
  const lookup = createPublicLookup({ lookup: failed, onFallback: () => { used = true; }, makeResolver: () => ({
    resolve4: (_, cb) => cb(null, ['192.0.2.2']), resolve6: (_, cb) => cb(null, ['2001:db8::2'])
  }) });
  assert.deepEqual((await query(lookup)).address, [{ address: '192.0.2.2', family: 4 }, { address: '2001:db8::2', family: 6 }]);
  assert.equal(used, true);
  assert.deepEqual(await query(lookup, host, { family: 6 }), { address: '2001:db8::2', family: 6 });
});
test('fallback preserves failure for other domains, permission errors and DNS failures', async () => {
  const noFallback = createPublicLookup({ lookup: failed, makeResolver: () => assert.fail('out-of-scope query') });
  for (const hostname of ['localhost', 'example.org', 'demo.trycloudflare.com.example.org']) {
    await assert.rejects(query(noFallback, hostname), { code: 'ENOTFOUND' });
  }
  const denied = createPublicLookup({ lookup: (_, __, cb) => cb(Object.assign(new Error(), { code: 'EACCES' })), makeResolver: () => assert.fail('permission bypass') });
  await assert.rejects(query(denied), { code: 'EACCES' });
  const unavailable = createPublicLookup({ lookup: failed, makeResolver: () => ({ resolve4: (_, cb) => cb(error), resolve6: (_, cb) => cb(error) }) });
  await assert.rejects(query(unavailable), { code: 'ENOTFOUND' });
});
test('one failed address family does not discard the other family', async () => {
  const lookup = createPublicLookup({ lookup: failed, makeResolver: () => ({ resolve4: (_, cb) => cb(null, ['192.0.2.3']), resolve6: (_, cb) => cb(error) }) });
  assert.deepEqual((await query(lookup)).address, [{ address: '192.0.2.3', family: 4 }]);
});
test('explicit DNS fallback is validated, scoped and disclosed', async () => {
  assert.equal(parseArgs(['--dns-server', '1.1.1.1']).dnsServer, '1.1.1.1');
  for (const args of [['--dns-server', 'example.org'], ['--dns-server', '1.1.1.1', '--status'], ['--dns-server', '1.1.1.1', '--stop']]) {
    assert.throws(() => parseArgs(args), { code: 'INVALID_ARGUMENT' });
  }
  let servers;
  const lookup = createPublicLookup({ lookup: failed, dnsServer: '1.1.1.1', makeResolver: () => ({
    setServers: value => { servers = value; }, resolve4: (_, cb) => cb(null, ['192.0.2.4']), resolve6: (_, cb) => cb(error)
  }) });
  await query(lookup);
  assert.deepEqual(servers, ['1.1.1.1']);
  const key = 'test-key';
  const result = await verifyPublic('https://' + host, key, { dnsServer: '1.1.1.1', timeout: 100, probe: async (_, options) => {
    assert.equal(options.dnsServer, '1.1.1.1');
    return { status: 200, headers: { 'x-tunnel-proof': proof(key, options.headers['x-tunnel-challenge'], 200) }, dnsResolution: 'explicit-dns-server', dnsServer: options.dnsServer };
  } });
  assert.equal(result.dnsResolution, 'explicit-dns-server');
  assert.equal(result.dnsServer, '1.1.1.1');
});
test('verification discloses fallback and still requires authenticated origin proof', async () => {
  const key = 'test-key';
  const probe = async (_, options) => ({ status: 200, headers: { 'x-tunnel-proof': proof(key, options.headers['x-tunnel-challenge'], 200) }, dnsResolution: 'configured-dns-fallback' });
  const result = await verifyPublic('https://' + host, key, { probe, timeout: 100 });
  assert.equal(result.status, 'verified');
  assert.equal(result.dnsResolution, 'configured-dns-fallback');
  await assert.rejects(verifyPublic('https://' + host, key, { timeout: 10, probe: async () => ({ status: 200, headers: {}, dnsResolution: 'configured-dns-fallback' }) }), { code: 'PUBLIC_VERIFICATION_FAILED' });
});
