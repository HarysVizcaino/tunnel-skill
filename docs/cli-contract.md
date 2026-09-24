# CLI contract v1

Requires Node >=22. Run `node /absolute/skill/scripts/tunnel.mjs --project /absolute/project`.

| Option | Contract |
|---|---|
| `--project PATH` | Existing directory; default current directory; canonicalized for state |
| `--port N` | Integer 1–65535, loopback HTTP only; never auto-start |
| `--webhook PATH` | Path only; combined with start or port; encoded characters preserved |
| `--dns-server IP` | Optional explicit fallback DNS server for public verification; IPv4/IPv6 literal; start/reuse only; not persisted |
| `--status` | Read state/live supervisor/local readiness; no public success claim |
| `--stop` | Stop only the authenticated tunnel supervisor; leave app running |
| `--verbose` | Bounded structured diagnostics on stderr |
| `--help` | Usage without side effects |

Duplicate/unknown options are errors. Status and stop are mutually exclusive and cannot take port/webhook. Webhook paths reject absolute URLs, leading `//`, backslashes, whitespace, controls, query, fragment and dot segments, including encoded ambiguity.

Successful operations return `{version:1,ok:true,...}`. Start returns `status:active`, `projectPath`, `framework`, `localUrl`, `publicUrl`, `verification`, `reused`, `notice`, and optionally `webhookUrl` with `webhookVerified:false`. A status result returns `inactive`, `running-unverified` or `application-unavailable`; current verification is null and `lastVerification` is historical. Stop returns `stopped` and `applicationRunning`.

Errors return `{version:1,ok:false,error:{code,message,action,...details}}`. No control token, signing key, raw environment or arbitrary exception is returned. Error-specific details may include candidate directories, ports, attempted development command, HTTP status, network error code or abandoned lock path.

Public provider verification first uses system lookup. On `ENOTFOUND` or
`EAI_AGAIN` for a generated `*.trycloudflare.com` hostname, it can query the
configured DNS servers directly. If used, verification includes
`dnsResolution: "configured-dns-fallback"`. This is authenticated HTTPS/origin
verification through that resolution path; it does not prove the system
resolver or another client can resolve the URL. Local probes retain normal
resolution. An explicit `--dns-server IP` selects that DNS server for fallback
queries in this invocation; successful verification reports
`dnsResolution: "explicit-dns-server"` and `dnsServer`. No global configuration
change is made, and the override is not persisted for subsequent invocations.

| Exit | Category |
|---|---|
| 0 | Successful operation |
| 1 | Unexpected internal failure |
| 2 | Invalid arguments |
| 3 | Project/target/application/package manager |
| 4 | Runtime/platform/checksum |
| 5 | Process/state/lock/storage |
| 6 | Tunnel/public verification |
| 130 | Interrupted startup after cleanup |

No interactive terminal prompts. Host permission prompts remain outside this executable. `TUNNEL_HOME` changes private state/runtime storage for every operation; it does not select a project. Keep the same value to manage existing sessions.
