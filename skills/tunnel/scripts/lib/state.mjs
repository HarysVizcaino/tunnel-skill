import { join } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { atomicJSON, readJSON, privateDir, hash, identity, sameIdentity, fail } from './common.mjs';

export const statePath = (store, project) => join(store.state, `${hash(project)}.json`);
export async function readState(store, project) {
  const state = await readJSON(statePath(store, project), true);
  if (state && (state.version !== 1 || state.projectPath !== project)) fail('STATE_CORRUPT', 'State schema or project identity is invalid.', 'Preserve state for diagnosis.');
  return state;
}
export const saveState = (store, project, state) => atomicJSON(statePath(store, project), { ...state, version: 1, projectPath: project });
export async function withLock(directory, fn) {
  await privateDir(join(directory, '..'));
  const me = await identity(process.pid);
  if (!me) fail('PROCESS_INSPECTION_FAILED', 'Cannot identify the current process.');
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await mkdir(directory, { mode: 0o700 }); }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const owner = await readJSON(join(directory, 'owner.json'), true);
      // Missing owner may be another process between mkdir and write: never steal.
      if (!owner || sameIdentity(owner, await identity(owner.pid))) fail('LOCK_BUSY', 'Another Tunnel operation is in progress.', 'Retry after it finishes. A lock without owner metadata requires manual inspection.');
      // Do not automatically delete stale locks: two reclaimers can otherwise
      // steal a fresh owner's lock between checking metadata and unlinking it.
      fail('LOCK_STALE', 'A previous operation left an abandoned lock.', 'Confirm no Tunnel operation is running, then remove only this lock directory and retry.', { lockDirectory: directory });
    }
    await atomicJSON(join(directory, 'owner.json'), me);
    try { return await fn(); } finally { await rm(directory, { recursive: true, force: true }); }
  }
  fail('LOCK_BUSY', 'Could not acquire the operation lock.', 'Retry.');
}
