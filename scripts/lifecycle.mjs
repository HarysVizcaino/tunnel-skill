import { readFile, writeFile, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../skills/tunnel/scripts/lib/common.mjs';
import { startWorker, control, stopWorker } from '../skills/tunnel/scripts/lib/processes.mjs';
const [action, record] = process.argv.slice(2);
if (!['start','status','stop'].includes(action) || !record) throw new Error('Usage: node scripts/lifecycle.mjs start|status|stop /tmp/record.json');
if (action === 'start') {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'tunnel-lifecycle-')));
  const ref = await startWorker(storage(join(dir, 'home')), { kind: 'app', cwd: dir, command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] });
  // No commit: it will also self-clean after the startup lease if interrupted.
  await writeFile(record, JSON.stringify({ dir, ref }), { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ started: true, pid: ref.pid }));
} else {
  const { dir, ref } = JSON.parse(await readFile(record, 'utf8'));
  if (action === 'status') console.log(JSON.stringify({ running: !!await control(ref) }));
  else { console.log(JSON.stringify({ stopped: await stopWorker(ref) })); await rm(dir, { recursive: true, force: true }); await rm(record); }
}
