# Process lifecycle decision

Date: 2026-09-24. Implementation: independent app and tunnel supervisors with
private loopback control capabilities, detached process groups and a startup
lease. This does not install launchd/systemd services.

## Observed here

- Host: macOS ARM64, Codex desktop terminal environment.
- The restricted sandbox denied `ps` and loopback listening. Tests requiring
  those capabilities were rerun using the host's explicit approval mechanism.
- `scripts/lifecycle.mjs start` returned with an innocuous worker alive.
  A later tool call to `status` returned `running:true`; `stop` returned
  `stopped:true`. This proves survival across command/tool boundaries here.
- Core tests checked authenticated shutdown, forged process identity,
  rejected capabilities, app preservation and rollback of failed startup.
- Available client binaries: Codex CLI 0.153.4 and Claude Code 2.1.278.
  Binary availability is not an executed agent behavior evaluation.

## Not established

Survival across the end of a conversational turn, closing the desktop app,
closing Claude Code, logging out, laptop sleep, and other operating systems
has not been demonstrated. The software therefore does not promise those
behaviors. To finish TUN-002/TUN-019, repeat the lifecycle probe in those hosts
and record results, stopping every test worker afterward.

## Ownership and recovery

The CLI journals control capabilities before confirming a successful tunnel.
Uncommitted workers exit after five minutes. A committed tunnel runs until
stopped or killed by its host. The CLI checks PID plus process start time, then
authenticates to the control endpoint; it never sends signals to saved PIDs.
Only the supervisor terminates its own child group.

`--stop` leaves the app running. A failed start rolls back new app/tunnel
workers. No automatic stale-lock deletion is attempted because concurrent
reclaimers could otherwise steal a newly acquired lock. The error gives the
exact lock path and a deliberate inspection/recovery procedure.
