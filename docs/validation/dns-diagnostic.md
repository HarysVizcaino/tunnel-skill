# DNS diagnostic — 2026-09-24

Environment: macOS ARM64, Node 25.8.0, cloudflared 2026.9.1.
Queries and public requests ran with host network permissions. A sandbox-only
`scutil --dns` returned no configuration; the host query showed a reachable
resolver at `192.168.100.1`. The sandbox result is not evidence of missing DNS.
No system DNS settings or caches were changed.

## Resolver comparison

Control queries resolved `github.com` through the router and
`api.trycloudflare.com` through the router, Cloudflare and Google.
The fixture then generated
`washington-polyphonic-vertex-courier.trycloudflare.com`.

| Time (America/Santo_Domingo) | Probe | Result |
|---|---|---|
| 09:57:24 | Router `192.168.100.1`, A query | `NXDOMAIN`, no answer |
| 09:57:24 | Cloudflare `1.1.1.1`, A query | `NOERROR`, `104.16.230.132`, `104.16.231.132` |
| 09:57:24 | Google `8.8.8.8`, A query | Same two IPv4 addresses |
| 09:57:24 | curl using system resolution | Exit 6: could not resolve host |
| 09:57:36 | HTTPS GET using curl `--resolve` with `104.16.230.132` | HTTP 200, `tunnel-public-fixture-ok` |
| 09:57:36 | HTTPS POST `/fixture-webhook` using the same override | HTTP 200, `tunnel-webhook-fixture-ok` |
| 09:58:26 | Router, A and AAAA queries | `NOERROR`, two IPv4 and two IPv6 addresses |

The curl override applied only to those requests and kept the hostname and
TLS certificate verification intact. It demonstrates public routing and
fixture webhook delivery, but does not count as successful verification with
the system resolver. The standard 45-second smoke verification failed with
`ENOTFOUND` and rolled back the tunnel. The later router query happened after
that attempt ended; DNS resolution alone does not prove an active tunnel.

The discrepancy was transient. These observations do not identify whether
the router, an upstream cache, filtering, or provider publication timing
caused it. They do not support calling this a permanent block or changing
system DNS automatically.

## Extended verification and system resolver comparison

A second fixture generated `est-demands-thinkpad-classic.trycloudflare.com`
at 10:00:03.721 local time. Verification with the normal system resolver was
allowed 180 seconds and still failed with `ENOTFOUND`; the tunnel was rolled
back and the fixture cleaned up. Increasing the wait alone did not fix this run.

At 10:05:12, after that tunnel had closed:

| Probe for the second hostname | Result |
|---|---|
| `dig` through the router | `NOERROR`, the two Cloudflare IPv4 addresses |
| `dig @1.1.1.1` | Same two IPv4 addresses |
| Node `dns.lookup` | `ENOTFOUND` |
| Node `dns.resolve4` | Same two IPv4 addresses |

This distinguishes the system lookup path used by the HTTP client from direct
DNS queries. A retained negative cache entry or system resolver/filter behavior
is plausible, but the exact cause remains unconfirmed. No cache flush, DNS
configuration change or alternate resolver fallback was performed. The next
controlled comparison should repeat on another network or after a separately
authorized system DNS cache reset. The production readiness gate remains open.

## Reproduce

Start a fresh harmless fixture from the repository root:

```sh
node scripts/real-smoke.mjs --verify-timeout-ms=180000 --hold
```

This diagnostic option extends verification only in the smoke script. The
installed skill still uses 45 seconds. `--hold` keeps a successfully verified
tunnel open another 45 seconds; it does not preserve a failed attempt.
The script uses system resolution and checks the authenticated origin proof.
It sends a fixture webhook, checks reuse, and cleans up on completion.

While the printed URL is being verified, copy its hostname into another terminal:

```sh
tunnel_host='REPLACE_WITH_CURRENT_HOSTNAME.trycloudflare.com'
dig +time=3 +tries=1 "$tunnel_host" A
dig @1.1.1.1 +time=3 +tries=1 "$tunnel_host" A
dig @8.8.8.8 +time=3 +tries=1 "$tunnel_host" A
curl -sS --max-time 10 -i "https://$tunnel_host/"
```

Always use a newly generated hostname while its tunnel is active. If public
resolvers succeed but the system resolver fails, compare again after waiting.
If DNS resolves but HTTPS fails, investigate tunnel connectivity separately.
An optional `curl --resolve` using an IP actually returned by the public
resolver can isolate HTTP routing, but must not be treated as normal DNS
verification or installed as a silent fallback.

## Follow-up: user-requested live demo

At 14:23:18 UTC the updated CLI verified the sibling `tunnel-demo` project with
an explicit `--dns-server 1.1.1.1` option. It returned `ok: true`, `status: active`,
authenticated HTTP 200 and `dnsResolution: explicit-dns-server` for
`https://absence-range-constraints-pearl.trycloudflare.com`. Both system-only
and configured-DNS attempts had failed. The override is per invocation and
does not change macOS DNS. The demo remains active at the user's request.
The external web tool could not access the URL; browser/other-device access
remains to be confirmed. The original diagnostic observations above describe
the earlier implementation and are preserved as historical evidence.
