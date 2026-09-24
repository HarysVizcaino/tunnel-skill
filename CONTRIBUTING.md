# Contributing

Use Node 22+ and install ps/lsof/tar for your platform. Run `npm run validate`
and `npm run pack:skill` before proposing changes. Keep production code inside
`skills/tunnel/scripts` so the installed skill is self-contained.

Test behavior rather than implementation wording. Add fixtures for process
ownership, incorrect target selection, failure recovery and network response
verification. Tests must clean only resources they create and must not use
the user's default Tunnel state. Public integration tests are opt-in and must
expose non-sensitive fixtures only.

When updating cloudflared, obtain digests from the official release asset
metadata, verify the actual downloaded artifacts, update all four manifest
entries and rerun integration tests. Never replace a checksum simply to make
a failing test pass. Record version and source in CHANGELOG.

Changes to command semantics require updating the PRD, CLI contract and skill.
Record framework, OS, architecture, agent and model versions with validation.
Do not mark unexecuted matrix cells as passed.

Real framework fixtures are pinned in `tests/frameworks`. Install with
`npm ci --prefix tests/frameworks --ignore-scripts --no-audit --no-fund`, then run
`node scripts/framework-smoke.mjs tests/frameworks`. That test uses real pages
and assets through the bridge with a simulated public provider.
