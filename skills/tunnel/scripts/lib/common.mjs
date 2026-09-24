import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, lstat, chmod, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const exec = promisify(execFile);
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const token = () => randomBytes(32).toString('hex');
export const hash = value => createHash('sha256').update(value).digest('hex');
export class TunnelError extends Error {
  constructor(code, message, action = '', details = {}) {
    super(message); this.code = code; this.action = action; this.details = details;
  }
}
export function fail(code, message, action, details) { throw new TunnelError(code, message, action, details); }
export async function exists(path) { try { await lstat(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
export async function privateDir(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const s = await lstat(path);
  if (!s.isDirectory() || s.isSymbolicLink() || (process.getuid && s.uid !== process.getuid())) fail('UNSAFE_STORAGE', 'Storage must be a directory owned by the current user.');
  await chmod(path, 0o700);
}
export async function atomicJSON(path, value) {
  await privateDir(dirname(path));
  const tmp = `${path}.${token()}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(tmp, path);
}
export async function readJSON(path, optional = false) {
  try {
    const s = await lstat(path);
    if (!s.isFile() || s.isSymbolicLink()) fail('UNSAFE_STORAGE', 'Refusing a non-regular state file.');
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (e) {
    if (optional && e.code === 'ENOENT') return null;
    if (e instanceof SyntaxError) fail('STATE_CORRUPT', 'State contains invalid JSON.', 'Preserve the file for recovery; do not kill processes by PID or port.');
    throw e;
  }
}
export async function projectPath(path) {
  try { const p = await realpath(path); if (!(await lstat(p)).isDirectory()) throw new Error(); return p; }
  catch { fail('PROJECT_NOT_FOUND', 'Project directory does not exist.', 'Pass --project with an existing directory.'); }
}
export function storage(root = process.env.TUNNEL_HOME || join(homedir(), '.tunnel')) {
  root = resolve(root);
  return { root, state: join(root, 'state'), sessions: join(root, 'sessions'), bin: join(root, 'bin'), cache: join(root, 'cache') };
}
export function cleanEnvironment() {
  const env = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SYSTEMROOT']) if (process.env[key]) env[key] = process.env[key];
  env.LANG = 'C'; env.LC_ALL = 'C';
  return env;
}
export async function identity(pid) {
  if (!Number.isInteger(pid) || pid < 1) return null;
  try {
    const { stdout } = await exec('ps', ['-p', String(pid), '-o', 'lstart='], { env: cleanEnvironment(), timeout: 3000 });
    const started = stdout.trim();
    return started ? { pid, started } : null;
  } catch (e) {
    if (e.code === 1 && !e.stderr?.trim()) return null;
    fail('PROCESS_INSPECTION_FAILED', 'Cannot inspect local processes.', 'Allow process inspection in this environment or run from a local terminal.');
  }
}
export function sameIdentity(a, b) { return !!a && !!b && a.pid === b.pid && a.started === b.started; }
export function publicError(e) {
  return { version: 1, ok: false, error: { code: e.code && e instanceof TunnelError ? e.code : 'INTERNAL_ERROR', message: e instanceof TunnelError ? e.message : 'Operation failed unexpectedly.', action: e.action || 'Run --status --verbose; inspect the documented error guidance.', ...(e instanceof TunnelError ? e.details : {}) } };
}
