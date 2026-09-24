# Troubleshooting

Run `node <skill>/scripts/tunnel.mjs --project <project> --status --verbose` first. It does not download or create anything. The result intentionally omits capability tokens and raw application output.

| Error | Recovery |
|---|---|
| `AMBIGUOUS_TARGET` | Select one listed project or port. |
| `PROJECT_UNKNOWN` / `APP_COMMAND_UNKNOWN` | Start the application manually and use `--port`. |
| `MANAGER_AMBIGUOUS` | Resolve conflicting lockfiles/packageManager or start manually. |
| `DEPENDENCIES_MISSING` / `APP_LIFECYCLE_SCRIPTS` | Let the user run installation/startup; do not silently run preparation scripts. |
| `APP_NOT_READY` / `APP_START_FAILED` | Run the reported command manually to inspect application output. |
| `PROCESS_INSPECTION_FAILED` / `PROCESS_START_FAILED` | The environment needs ps, lsof and loopback listeners. Use the host's supported permission flow or a local terminal. |
| `LOCK_BUSY` | Wait for the other operation to finish; retry. |
| `LOCK_STALE` | Verify the recorded owner no longer exists and no operation is running. Remove only the reported lock directory, then retry. Never remove a lock merely because it is old. |
| `STATE_CORRUPT` | Preserve the file and inspect session control metadata. Do not kill a saved PID or discard potentially live session records. |
| `CHECKSUM_MISMATCH` | Do not execute the artifact. Review official release metadata before changing the manifest. |
| `RUNTIME_DOWNLOAD_FAILED` | Check network access to GitHub release assets. |
| `TUNNEL_TARGET_CONFLICT` | Stop the current project tunnel before requesting a different port. |
| `TUNNEL_START_FAILED` | Check outbound Cloudflare connectivity. Existing Cloudflare config is not modified. |
| `PUBLIC_VERIFICATION_FAILED` | The public response was not authenticated as coming through the local bridge. Startup is rolled back; inspect local readiness and network access before retrying. |

Do not set Vite `allowedHosts: true`. The bridge sends the local Host to the selected application and rewrites Origin only when it exactly matches the assigned public URL. Applications with absolute localhost links, custom CSRF policies or OAuth callback configuration may need their own documented configuration; Tunnel does not edit it.

There are no saved raw app/provider logs by default, to avoid persisting secrets. Diagnostics report known phases and exit status. Do not dump environment variables or session specification files into a chat or issue.

For public `*.trycloudflare.com` verification only, an `ENOTFOUND` or `EAI_AGAIN`
from system lookup triggers bounded A/AAAA queries to Node's configured DNS
servers. A successful fallback is reported in `verification.dnsResolution` as
`configured-dns-fallback`. No DNS server settings, hosts files, local targets,
TLS certificate checks or origin-proof checks are changed. Browser/system DNS
can remain affected even when this verification succeeds. If both lookup paths
fail, startup still rolls back. See [Node's DNS implementation differences](https://nodejs.org/api/dns.html#implementation-considerations).

An explicit `--dns-server IP` selects a resolver for that fallback in the current
start/reuse command only. It is never selected silently or persisted. Successful
verification reports `dnsResolution: "explicit-dns-server"` and `dnsServer`.
This can diagnose a failing local resolver without changing the machine's DNS;
it does not repair resolution in other applications.
