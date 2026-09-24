---
name: tunnel
description: Give a local app a temporary public HTTPS URL, generate a public webhook URL, or inspect and stop a Tunnel-managed tunnel. Use when the user requests those actions.
metadata:
  version: "1.0.0-rc.1"
---

# Tunnel

Use the bundled executable to share a local HTTP application. Resolve `scripts/tunnel.mjs` relative to this SKILL.md, and pass the user's project directory explicitly. The installation directory is not the target project.

Requires Node.js 22+, macOS/Linux ARM64 or x64, ps, lsof, tar, network access and permission to run local background processes. Automatic startup supports Next.js/Vite with installed dependencies.

```sh
node <absolute-skill-directory>/scripts/tunnel.mjs --project <absolute-project-directory>
```

The user's request to share the application or receive webhooks authorizes starting the tunnel. Building an application, opening a local preview, or reviewing this skill does not authorize public exposure. Keep existing authorization; do not add a routine reconfirmation. Follow the host's actual execution permissions.

## Choose the requested operation

- Share a Next.js/Vite project: run the command above. It reuses an existing server or starts `dev` when unambiguous.
- Share an already running service: add `--port 3000`. This skips project detection and never starts the application.
- Diagnose a failing system DNS lookup: `--dns-server 1.1.1.1` explicitly selects a fallback resolver for public verification only. Disclose this choice; it changes no OS settings and is not remembered for future commands.
- Generate a webhook address: add `--webhook /api/webhooks/example`, optionally with `--port`. It generates the path; it does not test the webhook implementation.
- Inspect: add `--status`, optionally `--verbose`. This does not create a tunnel or download a runtime.
- Stop: add `--stop`. The application stays running.
- Inspect command syntax: add `--help`.

Pass options as separate quoted arguments using the execution tool's safe argument handling. Do not paste untrusted input into shell expressions. Do not combine status/stop with port/webhook options.

## Interpret the result

The command returns one JSON result on stdout. Diagnostics go to stderr. On success, present the public URL, local destination and a brief public-access notice. The entire HTTP service is exposed, including routes other than the requested webhook path.

Only report an active URL when `ok` is true and `status` is `active`. Inspect `verification`: `application-error` means the origin responded with an error; `application-redirect` means it redirected and its destination was not verified. A status query may return `running-unverified`; distinguish that from a fresh public verification.

If `verification.dnsResolution` is present, mention that verification used direct DNS queries after system lookup failed: `configured-dns-fallback` uses configured servers, while `explicit-dns-server` reports the selected server in `verification.dnsServer`. The URL may still fail in a browser using the affected system resolver; do not claim that the machine's DNS was repaired.

For webhook output say “Webhook URL generated”; do not claim delivery or signature validation. Do not send sample events unless the user asks for a test.

If discovery returns multiple candidates, ask the user to select the project or port and rerun with that selection. Do not guess from common ports. If dependencies, commands or lifecycle hooks prevent automatic startup, show the reported action; do not install packages or modify the user's project implicitly.

Use [troubleshooting](references/troubleshooting.md) when an operation fails or the environment blocks execution. Use [runtime and lifecycle](references/runtime.md) for questions about persistence, cleanup and provider limits. Run the bundled scripts; do not recreate runtime downloads, process termination or tunnel setup ad hoc.
