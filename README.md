# Tunnel

Give a local application a temporary public HTTPS URL through an Agent Skill.

**Release candidate:** the implementation and local tests are available. Cross-platform/agent validation and real public connectivity are tracked in [validation](docs/validation/release-candidate.md); this is not a verified stable release yet.

## Install

From GitHub:

```sh
npx skills@1.7.0 add HarysVizcaino/tunnel-skill --skill tunnel --agent codex --copy
```

Or from a local checkout:

```sh
npx skills@1.7.0 add /absolute/path/to/tunnel-skills --skill tunnel --agent codex --copy
```

Add `-g` for user-wide installation; select `--agent claude-code` for Claude Code. Source repository: [HarysVizcaino/tunnel-skill](https://github.com/HarysVizcaino/tunnel-skill).

Requirements: Node.js 22+, macOS/Linux ARM64 or x64, `ps`, `lsof`, `tar`, Internet access and permission to run local background servers. Framework dependencies must already be installed. The first start downloads a pinned official `cloudflared`; no Cloudflare account, sudo or PATH modification is needed.

## Use

In Codex, invoke `$tunnel`; in Claude Code use `/tunnel`. You can also ask to share the current local app publicly. To use the executable directly:

```sh
node /absolute/skill/scripts/tunnel.mjs --project /path/to/app
node /absolute/skill/scripts/tunnel.mjs --project /path/to/app --port 3000
node /absolute/skill/scripts/tunnel.mjs --project /path/to/app --webhook /api/webhooks/example
node /absolute/skill/scripts/tunnel.mjs --project /path/to/app --status --verbose
node /absolute/skill/scripts/tunnel.mjs --project /path/to/app --stop
```

Next.js and Vite can be discovered and started through their `dev` script. An existing server is reused only when discovery associates it with the selected project. For other frameworks, start the app yourself and use `--port`. Multiple apps require a project/port selection. Lifecycle hooks and missing dependencies are reported rather than installed or executed implicitly.

The CLI returns JSON; the skill presents the URL and destination. Repeating start reuses a healthy tunnel. Stop closes the tunnel while leaving the app running. Changing an active destination requires stopping it first.

## Public access and limitations

Anyone with the URL can reach the **entire selected HTTP service**, including routes beyond a webhook path. A generated webhook URL does not verify signatures or configure a third-party service.

The URL is temporary. Quick Tunnels have no uptime guarantee, do not support SSE and have provider limits. See [Cloudflare's documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/). Tunnel verifies the response originated through its local bridge; this does not prove the app is functionally correct.

The bridge preserves WebSocket upgrades and adapts Host/Origin. Actual HMR, authentication and absolute URL behavior depend on the application and need framework validation. There is no automatic boot service or guarantee that agent closure, suspension or reboot preserves a session.

## Storage and recovery

Runtime artifacts, state and private control capabilities live under `~/.tunnel`, outside the app. `TUNNEL_HOME` selects an alternate directory. Do not share state/session files: they contain control tokens. Stop active tunnels before removing their state or uninstalling the skill. Applications intentionally left running are stopped separately through the normal development workflow.

Use [troubleshooting](skills/tunnel/references/troubleshooting.md), [lifecycle details](skills/tunnel/references/runtime.md) and the [CLI contract](docs/cli-contract.md) for recovery and cleanup.

## Develop

```sh
npm run validate
npm run pack:skill
```

There are no production npm dependencies. Tests use temporary state, local fixtures and a simulated provider. `node scripts/real-smoke.mjs` is an explicit opt-in network test: it creates and closes a real public tunnel to an in-memory fixture. See [contributing](CONTRIBUTING.md) and [tasks](TASKS.md).
