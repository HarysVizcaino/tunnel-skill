# PRD — Tunnel Skill

**Working name:** `tunnel`  
**Product type:** Agent Skill / developer utility  
**Status:** MVP specification  
**Primary interface:** `/tunnel`

## 1. Product Summary

`Tunnel` is an Agent Skill that gives a local development project a temporary public HTTPS URL with a single command:

```text
/tunnel
```

It is intended for coding agents such as Claude Code, Codex, and other Agent Skills-compatible environments.

The developer should not need to understand tunneling infrastructure, create a Cloudflare account, configure DNS, generate an API token, manually discover the application port, or deploy the application.

> **Give your localhost a public URL with one command.**

Primary use cases:

1. Share a locally running application with another person or device.
2. Give the user a public preview URL for an application a coding agent just built.
3. Receive webhooks from external services while developing locally.
4. Test callbacks and integrations requiring a publicly reachable HTTPS endpoint.

The initial provider will be **Cloudflare Quick Tunnels**, through `cloudflared`. Cloudflare is an implementation detail rather than the user-facing abstraction.

---

## 2. Product Vision

The desired experience is:

```text
/tunnel
```

Result:

```text
✓ Next.js detected
✓ App running on localhost:3000
✓ Public tunnel established

Public URL:
https://random-name.trycloudflare.com
```

The mental model is simply:

```text
local → public
```

---

## 3. Goals

The MVP must:

- Be installable with the Agent Skills CLI.
- Work globally after global installation.
- Detect common Node.js development projects.
- Detect whether the project is already running.
- Start the project when necessary.
- Detect the local application port.
- Automatically provision its tunnel runtime.
- Create a temporary HTTPS tunnel.
- Extract and verify the generated public URL.
- Support generation of complete webhook URLs.
- Require no Cloudflare account, API token, custom domain, or DNS setup.
- Avoid `sudo` and global PATH modifications.
- Hide infrastructure details during normal usage.

Future architecture should allow Windows, Python, Java/Spring Boot, Go and alternative tunnel providers.

---

## 4. Non-Goals for MVP

The MVP will not:

- Replace production deployment.
- Provide permanent URLs.
- Configure Cloudflare DNS or Zero Trust.
- Expose databases or SSH automatically.
- Support TCP/UDP tunneling.
- Implement a custom tunneling protocol.
- Bundle every platform-specific `cloudflared` binary in the repository.
- Support every framework/runtime in v1.

---

## 5. Installation

Target installation:

```bash
npx skills add https://github.com/<owner>/tunnel --skill tunnel -g
```

Example:

```bash
npx skills add https://github.com/harysvizcaino/tunnel --skill tunnel -g
```

Then, from a compatible project:

```text
/tunnel
```

No separate Tunnel-specific account or setup should normally be required.

---

## 6. Proposed Repository Structure

```text
tunnel/
├── README.md
├── LICENSE
├── NOTICE
└── skills/
    └── tunnel/
        ├── SKILL.md
        └── scripts/
            ├── tunnel.sh
            ├── runtime.sh
            ├── detect-project.sh
            ├── detect-port.sh
            ├── start-project.sh
            ├── verify-url.sh
            ├── status.sh
            └── stop.sh
```

The final structure must be validated against the current Agent Skills specification and a known working repository such as the installation pattern used by `latent-spaces/brag`.

`SKILL.md` handles orchestration. Scripts implement deterministic operations so the LLM does not reinvent tunnel setup on each invocation.

---

## 7. Core Commands

### `/tunnel`

Automatic mode:

1. Inspect current project.
2. Detect framework/package manager.
3. Determine whether a development server is already running.
4. Detect its port.
5. If needed, determine and run the appropriate development command.
6. Wait for the local server.
7. Ensure the tunnel runtime is available.
8. Start a Cloudflare Quick Tunnel.
9. Capture the public URL.
10. Verify it.
11. Return it.

Example:

```text
> /tunnel

✓ Next.js detected
✓ App running on localhost:3000
✓ Public tunnel established

Public URL:
https://example-random.trycloudflare.com
```

### `/tunnel --port 3000`

Explicitly expose an existing local port, skipping unnecessary discovery.

### `/tunnel --webhook /api/webhooks/stripe`

Return the complete webhook URL:

```text
✓ Webhook ready

Webhook URL:
https://example-random.trycloudflare.com/api/webhooks/stripe

Forwarding to:
http://localhost:3000/api/webhooks/stripe
```

Paths with or without an initial `/` should normalize correctly.

### `/tunnel --status`

Show the current managed tunnel:

```text
Tunnel status: active

Local:
http://localhost:3000

Public:
https://example-random.trycloudflare.com
```

### `/tunnel --stop`

Stop only the tunnel process owned by this skill. It must not kill unrelated `cloudflared` processes or arbitrary applications.

---

## 8. Project Detection

MVP focus: Node.js.

Signals include:

```text
package.json
pnpm-lock.yaml
yarn.lock
package-lock.json
bun.lock
bun.lockb
```

Initial framework support should prioritize:

- Next.js
- Vite
- React development servers
- Node.js
- NestJS where straightforward

Package-manager detection:

```text
pnpm-lock.yaml       → pnpm
yarn.lock            → yarn
bun.lock / bun.lockb → bun
package-lock.json    → npm
```

Fallback: `npm`.

Inspect `package.json#scripts` and prefer suitable development commands such as `dev`, then appropriate alternatives such as `start` or `serve`.

---

## 9. Existing Server & Port Detection

Before starting a duplicate process, Tunnel should determine whether the project is already running.

Example:

```text
pnpm dev
```

followed by:

```text
/tunnel
```

should reuse that server.

Port discovery should combine:

1. Listening processes associated with the project.
2. Framework/startup output when reliable.
3. Local HTTP probing.
4. Framework defaults as fallback.
5. User input only when deterministic detection fails.

Common ports such as 3000, 5173, 8000 and 8080 can be candidates, but detection must not rely only on a hard-coded list.

---

## 10. Tunnel Provider

MVP provider: **Cloudflare Quick Tunnel**.

Underlying operation:

```bash
cloudflared tunnel --url http://localhost:<PORT>
```

Expected URL:

```text
https://<random>.trycloudflare.com
```

Quick Tunnel is selected because the target workflow can work without a Cloudflare account, API token, custom domain, or DNS configuration.

Normal output should say:

```text
✓ Public tunnel established
```

rather than exposing Cloudflare implementation details. Provider/runtime information can be shown in verbose/debug mode and documentation.

---

## 11. Runtime Management

Do not bundle every `cloudflared` executable in the repository.

Instead, the skill manages its own runtime:

```text
~/.tunnel/
├── bin/
│   └── cloudflared
├── state/
│   └── tunnel.json
├── logs/
└── cache/
```

First invocation:

```text
/tunnel
   ↓
runtime missing
   ↓
detect OS + architecture
   ↓
download supported official cloudflared binary
   ↓
verify artifact where feasible
   ↓
make executable
   ↓
store in ~/.tunnel/bin/
   ↓
continue
```

Subsequent calls reuse the cached runtime.

Requirements:

- Download only from official Cloudflare release sources.
- Pin or constrain supported runtime versions.
- Never require `sudo`.
- Never modify the user's global PATH.
- Never overwrite unrelated binaries.
- Keep runtime files outside the user's project.
- Support at least macOS ARM64, macOS x64, Linux x64 and Linux ARM64 for MVP.

Windows follows post-MVP.

---

## 12. URL Extraction & Verification

Tunnel must launch `cloudflared` as a managed process, capture output, identify the generated HTTPS `trycloudflare.com` URL, persist it in state, and keep the process alive.

Before reporting success, verify the public endpoint with retries for initial propagation.

Verification must distinguish:

- Local server failure.
- Tunnel startup failure.
- Propagation delay.
- Application HTTP errors.

A reachable application returning a non-2xx HTTP status can still demonstrate that routing works, so verification should not treat every HTTP error as tunnel failure.

---

## 13. State & Process Lifecycle

Suggested state:

```json
{
  "version": 1,
  "provider": "cloudflare",
  "projectPath": "/path/to/project",
  "framework": "nextjs",
  "localPort": 3000,
  "localUrl": "http://localhost:3000",
  "publicUrl": "https://random.trycloudflare.com",
  "tunnelPid": 12345,
  "appPid": null,
  "appManagedByTunnel": false,
  "createdAt": "2026-09-24T12:00:00Z"
}
```

If the app was already running, Tunnel does not own it.

If Tunnel starts the app, its PID and ownership should be recorded.

`--stop` must target only processes explicitly managed by Tunnel rather than killing processes by generic name or port.

---

## 14. UX Principles

### Hide infrastructure complexity

Avoid noisy output from `cloudflared`. Prefer concise status messages.

### Progressive disclosure

```text
/tunnel
```

provides minimal useful output.

A future:

```text
/tunnel --verbose
```

can show framework detection, provider, runtime version, PIDs, probes and raw errors.

### Never claim success before verification

Flow:

```text
Starting tunnel...
Verifying public URL...
✓ Tunnel ready
```

### Public-access notice

Keep a concise warning:

```text
Anyone with this URL may be able to access your local application while the tunnel is active.
```

---

## 15. Error Handling

Errors must be actionable.

### Unknown project

```text
Could not determine how to start this project.

Start it manually and use:
/tunnel --port <PORT>
```

### Port detection failure

```text
I couldn't determine the application's port.

Use:
/tunnel --port 3000
```

### Runtime download failure

```text
Tunnel runtime could not be downloaded.
Check your internet connection and retry.
```

### Application start failure

Show the command attempted and direct the user to the app output.

### Tunnel failure

Show the local target and suggest verbose diagnostics without falsely reporting success.

---

## 16. Security Requirements

Tunnel must:

- Expose only the selected local service.
- Never expose SSH or databases automatically.
- Clearly indicate that the generated URL is publicly reachable.
- Avoid logging environment variables and secrets.
- Avoid passing application secrets to tunnel commands.
- Download runtime artifacts only from trusted official sources.
- Keep downloaded binaries/state out of the project and source control.
- Avoid executing arbitrary project scripts beyond the selected development command without appropriate agent/user awareness.

---

## 17. Provider Abstraction

Although Cloudflare Quick Tunnel is the MVP implementation, internal architecture should avoid hard-coding the entire product around Cloudflare.

Future interface:

```text
/tunnel
/tunnel --provider cloudflare
/tunnel --provider ngrok
/tunnel --provider localhost-run
```

Possible provider contract:

```text
ensureRuntime()
start(localUrl)
getPublicUrl()
status()
stop()
```

The default remains zero-configuration whenever possible.

---

## 18. MVP Scope

### Platforms

- macOS ARM64
- macOS x64
- Linux x64
- Linux ARM64

### Projects

- Next.js
- Vite
- Common Node.js projects

### Features

- Agent Skill installation via `npx skills add`
- `/tunnel`
- `--port`
- `--webhook`
- `--status`
- `--stop`
- Automatic package-manager detection
- Existing-server detection
- Port detection
- Automatic local dev-server startup
- Self-managed `cloudflared` runtime
- Quick Tunnel creation
- Public URL extraction
- Public URL verification
- Safe process/state management

---

## 19. Post-MVP Roadmap

### Phase 2

- Windows.
- Better NestJS support.
- Python: FastAPI, Flask, Django.
- Java/Spring Boot.
- More robust multi-tunnel state.
- `--verbose`.
- Runtime auto-update strategy.

### Phase 3

- ngrok provider.
- localhost.run provider.
- Provider selection/fallback.
- Persistent/custom-domain options.
- Request inspection workflows.
- QR code for opening previews on mobile.
- Clipboard integration where appropriate.
- Webhook presets for common services.

Potential future UX:

```text
/tunnel --webhook stripe
/tunnel --webhook github
/tunnel --webhook meta
```

The skill could identify conventional callback paths or help the developer choose one without embedding vendor credentials.

---

## 20. Success Criteria

The MVP is successful when a developer can:

1. Install the skill globally with one `npx skills add` command.
2. Enter a supported project.
3. Run `/tunnel`.
4. Receive a working public HTTPS URL without creating a Cloudflare account or manually installing/configuring a tunnel provider.

Target happy path:

```text
npx skills add https://github.com/<owner>/tunnel --skill tunnel -g
```

then:

```text
> /tunnel

✓ Next.js detected
✓ App running on localhost:3000
✓ Public tunnel established

https://random.trycloudflare.com
```

---

## 21. Product Positioning

### One-line description

> **Turn any local project into a public URL with one command.**

### Short description

> Tunnel is an Agent Skill that detects your local application, starts it if necessary, finds its port, and creates a temporary public HTTPS URL automatically.

### Developer-facing promise

> **No deployment. No signup. No tunnel configuration. Just `/tunnel`.**

Cloudflare Quick Tunnel is the initial transport mechanism, but the product abstraction remains provider-independent.

---

## 22. Demo Scenario

The strongest demo is intentionally simple:

1. Ask Claude Code/Codex to build a small application.
2. The agent finishes the application.
3. Enter:

```text
/tunnel
```

4. Tunnel detects and starts/reuses the project.
5. A public URL appears.
6. Open that URL on a phone or another computer.

Webhook variation:

```text
/tunnel --webhook /api/webhooks/meta
```

Copy the returned HTTPS endpoint into the external service and receive the webhook directly in the local application.

The demo should communicate the value in seconds:

> **The app is still running on your laptop. `/tunnel` just made it reachable from the internet.**
