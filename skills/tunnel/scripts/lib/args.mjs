import { fail } from './common.mjs';
import { isIP } from 'node:net';

export const HELP = `Tunnel — temporary public HTTPS for a local HTTP application
Usage: node <skill>/scripts/tunnel.mjs [options]
  --project PATH    Project directory (default: current working directory)
  --port PORT       Existing local HTTP service, 1–65535; do not start an app
  --webhook PATH    Generate a webhook URL; does not test webhook delivery
  --dns-server IP   Explicit DNS fallback for public verification only
  --status          Read live status; no runtime downloads or app startup
  --stop            Stop this project's tunnel; leave the application running
  --verbose         Add bounded diagnostics to stderr (also works with --status)
  --help            Print this help without side effects
Output: versioned JSON on stdout; diagnostics on stderr.
Exit codes: 0 success, 2 input, 3 project, 4 runtime, 5 process/state,
            6 tunnel/verification, 1 unexpected failure, 130 interrupted.
Examples:
  node <skill>/scripts/tunnel.mjs --project /path/to/app
  node <skill>/scripts/tunnel.mjs --port 3000 --webhook /api/webhooks/demo
  node <skill>/scripts/tunnel.mjs --status --verbose
`;
export function parseArgs(argv) {
  const out = { project: process.cwd(), mode: 'start', verbose: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (seen.has(flag)) fail('INVALID_ARGUMENT', `Repeated option: ${flag}`, 'Use each option once.');
    seen.add(flag);
    if (flag === '--help') out.help = true;
    else if (flag === '--verbose') out.verbose = true;
    else if (flag === '--status' || flag === '--stop') {
      if (out.mode !== 'start') fail('INVALID_ARGUMENT', '--status and --stop cannot be combined.');
      out.mode = flag.slice(2);
    } else if (['--project', '--port', '--webhook', '--dns-server'].includes(flag)) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) fail('INVALID_ARGUMENT', `${flag} requires a value.`, 'Run --help.');
      out[flag === '--dns-server' ? 'dnsServer' : flag.slice(2)] = value;
    } else fail('INVALID_ARGUMENT', `Unknown option: ${flag}`, 'Run --help.');
  }
  if (out.port !== undefined) {
    if (!/^\d+$/.test(out.port) || +out.port < 1 || +out.port > 65535) fail('INVALID_ARGUMENT', '--port must be an integer between 1 and 65535.');
    out.port = +out.port;
  }
  if (out.dnsServer && !isIP(out.dnsServer)) fail('INVALID_ARGUMENT', '--dns-server must be an IPv4 or IPv6 address.');
  if (out.mode !== 'start' && (out.port || out.webhook || out.dnsServer)) fail('INVALID_ARGUMENT', '--port, --webhook and --dns-server cannot be combined with --status or --stop.');
  if (out.webhook !== undefined) out.webhook = normalizeWebhook(out.webhook);
  return out;
}
export function normalizeWebhook(value) {
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//') || /[\\\s\x00-\x1f\x7f?#]/.test(value)) fail('INVALID_ARGUMENT', 'Webhook must be a path without a host, query, fragment or whitespace.');
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { fail('INVALID_ARGUMENT', 'Invalid percent encoding in webhook path.'); }
  if (/[\\\x00-\x1f\x7f]/.test(decoded) || decoded.split('/').some(x => x === '.' || x === '..') || decoded.startsWith('//')) fail('INVALID_ARGUMENT', 'Ambiguous webhook path.');
  return value.startsWith('/') ? value : `/${value}`;
}
export function exitCode(code = '') {
  if (code === 'INTERRUPTED') return 130;
  if (/ARGUMENT/.test(code)) return 2;
  if (/^TUNNEL|VERIFICATION/.test(code)) return 6;
  if (/PROJECT|TARGET|APP_|MANAGER|DEPENDENC/.test(code)) return 3;
  if (/RUNTIME|PLATFORM|CHECKSUM/.test(code)) return 4;
  if (/STATE|STORAGE|LOCK|PROCESS/.test(code)) return 5;
  return 1;
}
