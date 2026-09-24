# Tunnel

Give a local application a temporary public HTTPS URL through an Agent Skill.

**Release candidate:** the implementation and local tests are available. Cross-platform/agent validation and real public connectivity are tracked in [validation](docs/validation/release-candidate.md); this is not a verified stable release yet.

## Install

Run the command for your agent from the project where you want to use Tunnel.

### Codex

```sh
npx skills@1.7.0 add HarysVizcaino/tunnel-skill --skill tunnel --agent codex --copy
```

Then invoke `$tunnel` in Codex.

### Claude Code

```sh
npx skills@1.7.0 add HarysVizcaino/tunnel-skill --skill tunnel --agent claude-code --copy
```

Then invoke `/tunnel` in Claude Code.

### Install for all your projects

Add `-g` for user-wide installation:

```sh
# Codex
npx skills@1.7.0 add HarysVizcaino/tunnel-skill --skill tunnel --agent codex --copy -g

# Claude Code
npx skills@1.7.0 add HarysVizcaino/tunnel-skill --skill tunnel --agent claude-code --copy -g
```

### Install from a local checkout

```sh
# Codex
npx skills@1.7.0 add /absolute/path/to/tunnel-skills --skill tunnel --agent codex --copy

# Claude Code
npx skills@1.7.0 add /absolute/path/to/tunnel-skills --skill tunnel --agent claude-code --copy
```

Source repository: [HarysVizcaino/tunnel-skill](https://github.com/HarysVizcaino/tunnel-skill).

### Requirements

Requirements: Node.js 22+, macOS/Linux ARM64 or x64, `ps`, `lsof`, `tar`, Internet access and permission to run local background servers. Framework dependencies must already be installed. The first start downloads a pinned official `cloudflared`; no Cloudflare account, sudo or PATH modification is needed.

## How to use it

### Share your project

1. Open your project directory in **Claude Code** or **Codex**, with Tunnel installed for that project or globally.
2. In the agent's chat, invoke the skill:

   | Agent | Invocation |
   |---|---|
   | Claude Code | `/tunnel` |
   | Codex | `$tunnel` |

3. Ask it to share the current app if needed. Once the tunnel is verified, your agent returns a temporary public HTTPS URL that you can open in a browser or share with someone else.

You can also ask in plain language:

> Share this project with a public URL using Tunnel.

For an app you already started on a specific port:

> Use Tunnel to share my local app on port 3000.

Keep your computer awake and the app and tunnel running while you use the URL.

### Stop sharing

In the same project, tell your agent:

> Stop the public tunnel for this project.

Or run the bundled script from your project directory, replacing the skill path with its installed location:

```sh
node /absolute/skill/scripts/tunnel.mjs --project "$PWD" --stop
```

This closes the tunnel and stops public access. **Your local app stays running.** To stop both, tell your agent:

> Stop the tunnel and the local development server for this project.

To share the project again, invoke `/tunnel` in Claude Code or `$tunnel` in Codex. A new tunnel may have a different URL.

### Use the CLI directly

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
