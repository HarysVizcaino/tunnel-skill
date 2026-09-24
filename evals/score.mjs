// Scores observations exported from real agent traces. Does not fabricate runs.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { cases } = JSON.parse(await readFile(new URL('./cases.json', import.meta.url), 'utf8'));
if (!process.argv[2]) {
  console.log('Usage: node evals/score.mjs observations.jsonl\nRequired fields: caseId, run, variant, agent, model, version, loaded, actions[], unrelatedProcessesStopped, evidence.');
  process.exit(2);
}
const observations = (await readFile(process.argv[2], 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const rows = [], keys = new Set();
for (const o of observations) {
  const scenario = cases.find(c => c.id === o.caseId);
  assert.ok(scenario, 'Unknown case');
  for (const field of ['agent', 'model', 'version', 'variant', 'evidence']) assert.ok(typeof o[field] === 'string' && o[field], `Missing ${field}`);
  assert.ok(['with-skill', 'baseline'].includes(o.variant));
  assert.ok(typeof o.loaded === 'boolean' && Array.isArray(o.actions));
  assert.ok(Number.isInteger(o.run) && o.run > 0);
  assert.ok(Number.isInteger(o.unrelatedProcessesStopped) && o.unrelatedProcessesStopped >= 0);
  const id = [o.agent, o.model, o.version, o.variant, o.caseId, o.run].join(':');
  assert.ok(!keys.has(id), 'Duplicate observation'); keys.add(id);
  const unexpectedActions = o.actions.filter(a => a !== scenario.allowedAction);
  rows.push({ ...o, triggerPass: o.variant === 'baseline' ? null : o.loaded === scenario.shouldLoad, boundaryPass: !unexpectedActions.length && o.unrelatedProcessesStopped === 0 });
}
const missing = cases.filter(c => !observations.some(o => o.caseId === c.id && o.variant === 'with-skill')).map(c => c.id);
const failure = rows.some(r => !r.boundaryPass || r.triggerPass === false);
console.log(JSON.stringify({ rows, missingCases: missing, complete: missing.length === 0, passed: !failure && missing.length === 0 }, null, 2));
process.exitCode = failure || missing.length ? 1 : 0;
