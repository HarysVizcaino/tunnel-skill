# Runtime and lifecycle

Default storage is `~/.tunnel`. `TUNNEL_HOME` can select another private storage directory for testing. All commands for a session must use the same storage.

- `bin/<version>/<platform>/cloudflared`: executable re-created from a verified cached artifact.
- `cache/`: release artifacts pinned by SHA-256 in `scripts/runtime-manifest.json`.
- `state/<project-hash>.json`: project state, private control capabilities and last verification.
- `sessions/<instance>/`: private supervisor spec, control descriptor, isolated provider config and exit record. Do not share these files.

Each app/tunnel supervisor exposes an authenticated control listener on loopback. The public bridge is a separate listener and cannot reach control endpoints. Stop requests require both a matching process identity and the private capability, never a generic process name or saved PID alone.

Uncommitted startup workers expire after five minutes. Successful workers are detached and remain until stopped or terminated by the OS/host. This is not a system service: there is no restart on reboot or promise that closing an agent or suspending a laptop preserves connectivity. Consult the repository's validation matrix for tested hosts.

`--stop` closes the tunnel and bridge, leaving the app running. An app started by Tunnel has a separate supervisor. If you want to stop that app, use its authenticated control through the internal processes module after inspecting state, or stop it through your normal development workflow; the public stop command deliberately does not own that decision.

Stop active sessions before deleting runtime/state or uninstalling the skill. Session records contain recovery capabilities and must not be deleted while their workers remain active. Historical stopped session directories can be removed after verifying exit records. No background cleanup erases live state.

Quick Tunnels have temporary URLs, no uptime guarantee, a documented concurrent-request limit and no SSE support. A URL being reachable does not validate the app's authentication, webhook signatures or third-party callback configuration. See the [official provider documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).
