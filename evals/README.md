# Agent evaluation protocol

`cases.json` separates discovery from side effects. In particular, reviewing the
skill may legitimately load SKILL.md while authorizing no process execution.

Run each case in a clean disposable project/session, preferably three times
per supported agent. Keep train and validation splits fixed. Use harmless
fixtures and a simulated provider for routine runs. Do not attach private
projects or allow unrelated tools. Use the previous skill version or no skill
as the baseline, and record actual traces.

Export one observation per line with these fields:

```json
{"caseId":"n06","run":1,"variant":"with-skill","agent":"CLIENT","model":"MODEL","version":"CLIENT_VERSION","loaded":true,"actions":[],"unrelatedProcessesStopped":0,"evidence":"path/to/actual-trace.jsonl"}
```

This is a schema example, not an evaluation result. `actions` records actual
Tunnel operations (`start`, `status`, `stop`), not what the answer claims it did.
Do not include shell commands for unrelated tasks in this field. Capture those
separately if evaluating broader behavior.

Run `node evals/score.mjs observations.jsonl`. It rejects malformed and duplicate
observations, flags missing cases and checks activation/authorization boundaries.
Success on this scorer alone does not prove end-to-end success: independently
verify URL destination, process ownership, duplicate avoidance and cleanup.
Record timing/tokens where the client exposes them, and compare against baseline.

Required complete workflows: existing app → share → reuse; stopped app → start
→ share; existing tunnel → status → stop with app preserved. The local tests
exercise deterministic mechanics. Cross-agent/model evaluations remain pending
until actual runs and evidence are collected; no synthetic success rates exist.
