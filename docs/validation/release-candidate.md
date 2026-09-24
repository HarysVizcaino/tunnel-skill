# Release candidate validation

Date: 2026-09-24. Candidate: `1.0.0-rc.1`. **Not approved as a stable release.**

## Evidence collected

| Area | Observed result |
|---|---|
| Core tests | DNS update: 34/34 passed on macOS ARM64 / Node 25.8.0. Earlier 28-test suite passed on Node 22.22.2; the DNS update has not yet been rerun on Node 22 |
| Minimum runtime | Node 22.22.2 final suite passed. Node 25.8.0 passed the earlier 27-test suite before the last process-group regression was added |
| Framework smoke | Vite 8.3.1 and Next.js 16.3.6 / React 19.3.0: automatic startup, page, asset and reuse passed through the local bridge with a simulated provider |
| Origin proof | HTTP 200/302/401/404/500 authenticated; forged/provider proof rejected |
| Process boundaries | Project selection, forged identity, capability rejection, cancellation, duplicate exclusion and app preservation passed |
| WebSocket transport | Local upgrade/stream transport test passed; browser HMR over a public tunnel not established |
| Skill format | Bundled skill-creator quick_validate.py: `Skill is valid!` (PyYAML 6.0.3 in a temporary validation directory) |
| Installer | Skills CLI 1.7.0 copied the package into a temporary project for Codex and Claude Code |
| Installed paths | Installed `--help` and `--status` worked from a directory outside the source checkout |
| Runtime | cloudflared 2026.9.1 darwin-arm64 artifact downloaded from official GitHub release; SHA-256 matched pinned asset digest; provider generated temporary URLs |
| Real public verification | Demo CLI returned `active`, authenticated HTTP 200 on 2026-09-24 at 14:23:18 UTC using explicit `--dns-server 1.1.1.1`. Default system/configured DNS attempts still failed. Earlier fixture GET/POST succeeded using a request-specific IP override. Normal system resolution and an external-client fetch remain unverified. See [DNS diagnostic](dns-diagnostic.md) |
| Lifecycle | Worker survived between separate terminal/tool calls and was then stopped; see decision record |

The release body and GitHub asset digest differed for macOS archives. The
manifest uses the asset API digest; the actual ARM64 download matched it.
Other platform artifacts are pinned from official asset metadata but were not
executed on this machine.

## Reproduce

```sh
npm run validate
npm run pack:skill
npm ci --prefix tests/frameworks --ignore-scripts --no-audit --no-fund
node scripts/framework-smoke.mjs tests/frameworks
```

The framework smoke test uses real installed frameworks and a simulated
provider. For actual public routing, explicitly run
`node scripts/real-smoke.mjs`. It exposes only an in-memory fixture, sends one
fixture webhook after verification, then closes the tunnel. `--hold` allows
45 seconds for a second client to inspect the generated URL. Successful URL
creation alone does not count as this test passing.

For DNS diagnosis, `node scripts/real-smoke.mjs --verify-timeout-ms=180000`
extends only the test's verification window. See the [resolver comparison and
reproduction instructions](dns-diagnostic.md). The installed skill retains its
45-second window; waiting longer did not resolve the observed system lookup failure.

## Outstanding release gates

- Successful public verification, external-client fetch and webhook delivery
  through real Cloudflare, plus public Next.js/Vite integration.
- Linux x64/ARM64 and macOS x64 execution evidence. The CI definition has not
  been run on a hosted repository; do not call those platforms verified.
- Actual Codex/Claude skill behavior evaluations with traces, repetitions and
  baseline comparison. Dataset and scorer exist; no success rate is claimed.
- End-of-turn/client-close lifecycle results for advertised clients.
- Public repository destination, hosted CI, private security reporting,
  installation from the final URL and an independent user walkthrough.

No GitHub repository, tag, public release or announcement was created during
this implementation. A local release archive is an artifact for review, not
evidence that those publication gates passed.

## Initial local result

`node --test --test-concurrency=1 tests/core.test.mjs` with Node 22.22.2: 28 tests, 28 passed, 0 failed, 0 skipped (about 7.7 seconds). No public or cross-agent success is inferred from this result.

The final archive was generated twice without changes and both runs produced SHA-256 `3e686b88b3d41c78f0ce602a2cec2c7066bec4fa6d30964b5e566516ae30c882` (19 packaged files). Local Markdown links and script syntax checks passed.

Docker CLI is installed on this host, but the daemon was unavailable when queried with host permissions; no Linux container validation was performed.

## DNS update and live demo

The skill now tries the configured DNS servers directly on system lookup
`ENOTFOUND`/`EAI_AGAIN` for public provider verification, and supports an explicit
`--dns-server IP` override for that invocation. TLS and authenticated origin
proof remain required. The result discloses which fallback was used.

The sibling `tunnel-demo` project was created and started on loopback port
55300. Standard startup and configured-DNS fallback both failed; startup with
`--dns-server 1.1.1.1` succeeded with HTTP 200 and generated
`https://absence-range-constraints-pearl.trycloudflare.com`. This demo was left
running at the user's request. The external web-fetch tool could not access
its page or health route, so no independent-client success is claimed.

`npm run validate`: 34/34 tests passed on Node 25.8.0; skill format validation
passed. Updated archive SHA-256:
`992f398ed830cb69f00c0311a1c84761e63a43879da473e31136d0dc30b9638a`.
This local update supersedes the initial archive; no release was published.
