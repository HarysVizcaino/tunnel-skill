import { lookup as systemLookup, Resolver } from 'node:dns';
import { isIP } from 'node:net';

// Only public provider verification uses this fallback. Keep successful OS
// lookups, local targets, and other domains on their normal resolution path.
export function createPublicLookup({ lookup = systemLookup, dnsServer, makeResolver = () => new Resolver({ timeout: 1500, tries: 1 }), onFallback = () => {} } = {}) {
  if (dnsServer && !isIP(dnsServer)) throw new Error('DNS server must be an IP address');
  return (hostname, options, callback) => {
    lookup(hostname, options, async (error, address, family) => {
      if (!error || !['ENOTFOUND', 'EAI_AGAIN'].includes(error.code) || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/i.test(hostname)) {
        callback(error, address, family);
        return;
      }
      let addresses;
      try {
        // Inherit configured servers unless a server was explicitly selected.
        // Never change global DNS, hosts entries, or certificate verification.
        const resolver = makeResolver();
        if (dnsServer) resolver.setServers([dnsServer]);
        const requested = typeof options === 'number' ? options : options?.family;
        const families = requested === 4 ? [4] : requested === 6 ? [6] : [4, 6];
        const results = await Promise.allSettled(families.map(version => new Promise((resolve, reject) => {
          resolver[`resolve${version}`](hostname, (err, values) => {
            if (err) reject(err);
            else resolve(values.filter(value => isIP(value) === version).map(value => ({ address: value, family: version })));
          });
        })));
        addresses = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
      } catch { callback(error); return; }
      if (!addresses.length) { callback(error); return; }
      onFallback();
      if (options?.all) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    });
  };
}
