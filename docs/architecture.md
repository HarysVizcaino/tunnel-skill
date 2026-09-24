# Architecture

`SKILL.md → tunnel.mjs → lib/tunnel.mjs` is the orchestration path. Modules implement argument validation, project discovery, runtime verification, state locking, worker control and HTTP verification. The agent does not generate shell commands for those mechanics.

## Data and control

```text
Internet HTTPS → cloudflared → loopback bridge → selected loopback HTTP app

CLI → private loopback supervisor control (separate listener, capability required)
```

An app supervisor and tunnel supervisor are independent Node workers. A detached supervisor is the leader of its own process group; its child and ordinary descendants share that group. Shutdown signals the group while the supervisor is still alive, so its group ID cannot be reused. This also cleans descendants if their immediate parent exits first. The CLI never signals a PID from persistent state; it checks process start identity, authenticates to the control endpoint, and asks the owner to stop its child. Startup uses a five-minute lease, committed only after verification and journaling.

The bridge handles streaming HTTP and WebSocket upgrades. It sets the local Host and rewrites only an Origin exactly matching the assigned public origin. It strips its own challenge/proof headers before forwarding. On probe responses it adds an HMAC over nonce and HTTP status using a private session key. Responses from the provider cannot satisfy that proof. This proves routing to the configured local port, not application-level correctness or permanent ownership of a port across app restarts.

## Storage

`TUNNEL_HOME` overrides `~/.tunnel` for isolated tests. State is keyed by SHA-256 of canonical project path. Private directories use 0700 and private files 0600. JSON writes are replaced atomically. Directory locks record PID/start time; stale locks fail with explicit recovery guidance rather than automatic race-prone deletion.

Sessions store their control capabilities and small lifecycle records. No raw application or provider logs are retained. Provider output is bounded in memory for URL extraction. Historical session directories are retained for recovery until manually removed after stopping; this is documented rather than silently deleting capabilities.

## Runtime

`runtime-manifest.json` pins official GitHub release asset digests for four platforms. Downloads are bounded and redirects restricted to official release asset hosts. Each invocation validates the cached artifact and reconstructs the executable from it. The runtime lock serializes installation. Cloudflare runs with a minimal environment and isolated configuration, without application secrets or inherited provider credentials.

## Testing seams

Core functions accept dependencies only through JavaScript imports used by tests. The user-facing CLI does not expose an arbitrary runtime executable or a verification bypass. Tests use a fixture executable, local servers and the real proxy/signature logic. Real Cloudflare validation is an opt-in script using an in-memory, non-sensitive application.

## Limits

Process inspection is OS-specific and can be denied by the host. Startup command behavior depends on the project's dev script. Dynamic absolute links, application auth, custom origins, SSE support and third-party callback registration are outside routing verification. User-local state is not a security boundary against another process running as the same OS user.
