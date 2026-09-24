# Release procedure

1. Run local validation and record the actual platform/agent matrix. Resolve
   every open gate in `validation/release-candidate.md` before calling it 1.0.
2. Review repository contents and runtime manifest. Keep private state,
   evaluation transcripts with secrets and development dependencies out.
3. Set the confirmed repository URL in README. Enable private vulnerability
   reporting and verify SECURITY.md gives a working private route.
4. Run hosted CI, prepare the candidate archive with `npm run pack:skill` and
   record its SHA-256. Packaging fixes ordering, modes, timestamps and ownership
   so an unchanged skill produces identical bytes.
5. Install from the candidate repository/ref in a clean project for each
   advertised client. Have a user outside the implementation follow README.
6. Prepare tag and release notes describing tested behavior and limits. Publish
   only with authorization for that concrete external action. Do not announce
   a stable release while public routing is unverified.

Rollback: retain the previous tested tag and runtime manifest; mark a defective
release as superseded, document its affected versions and restore installation
guidance to the previous tested version. Do not silently mutate old tags or
change checksums in a published version. Stop active tunnels before removing
their installed scripts or private state.

## Demo walkthrough

Use a fresh fixture with no secrets. Ask the agent to share it publicly, show
the verified URL and local target, open it on another device, then request
status and stop. Demonstrate that the local app still works afterward. For a
webhook demo use the controlled receiver in the smoke test. Record a public
demo only after the real integration gate passes; simulated test output must
be labelled as simulated.
