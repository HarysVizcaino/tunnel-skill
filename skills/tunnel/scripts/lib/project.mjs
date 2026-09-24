import { readFile, readdir, realpath, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { constants } from 'node:fs';
import { exec, exists, cleanEnvironment, fail } from './common.mjs';
import { probeLocal } from './http.mjs';

export async function detectProject(project) {
  const packages = [];
  async function walk(path, depth) {
    if (await exists(join(path, 'package.json'))) {
      try {
        const pkg = JSON.parse(await readFile(join(path, 'package.json'), 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const framework = deps.next ? 'nextjs' : deps.vite ? 'vite' : null;
        if (framework) packages.push({ path, pkg, framework });
      } catch { fail('PROJECT_INVALID', 'Cannot parse package.json.', 'Repair the project manifest.'); }
    }
    if (depth === 0) return;
    for (const item of await readdir(path, { withFileTypes: true })) {
      if (item.isDirectory() && !item.name.startsWith('.') && !['node_modules', 'dist', 'build', 'coverage', 'vendor'].includes(item.name)) await walk(join(path, item.name), depth - 1);
    }
  }
  await walk(project, 2);
  if (packages.length === 0) fail('PROJECT_UNKNOWN', 'No supported Next.js or Vite application was found.', 'Start your app manually and use --port PORT.');
  if (packages.length > 1) fail('AMBIGUOUS_TARGET', 'Multiple applications were found.', 'Select one with --project PATH.', { candidates: packages.map(p => p.path) });
  const found = packages[0];
  const pkg = found.pkg;
  // A dev script is explicit intent. Do not fall back to start/build/serve.
  const script = typeof pkg.scripts?.dev === 'string' ? 'dev' : null;
  let current = found.path, manager;
  while (true) {
    let parentPkg;
    try { parentPkg = JSON.parse(await readFile(join(current, 'package.json'), 'utf8')); } catch {}
    const declared = parentPkg?.packageManager?.split('@')[0];
    const locks = [];
    for (const [name, pm] of [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['package-lock.json', 'npm'], ['bun.lock', 'bun'], ['bun.lockb', 'bun']]) if (await exists(join(current, name))) locks.push(pm);
    const choices = [...new Set(locks)];
    if (declared && !['npm', 'pnpm', 'yarn', 'bun'].includes(declared)) fail('MANAGER_UNSUPPORTED', 'Unsupported package manager.');
    if (choices.length > 1 || (declared && choices.some(x => x !== declared))) fail('MANAGER_AMBIGUOUS', 'Package-manager metadata conflicts with lockfiles.', 'Resolve the conflict or start the app manually and use --port.');
    if (declared || choices.length) { manager = declared || choices[0]; break; }
    if (dirname(current) === current) break;
    current = dirname(current);
  }
  return { path: found.path, framework: found.framework, manager: manager || 'npm', script, lifecycle: !!(pkg.scripts?.predev || pkg.scripts?.postdev) };
}
export async function prepareStart(info) {
  if (!info.script) fail('APP_COMMAND_UNKNOWN', 'No dev script is available.', 'Start the application manually and use --port.');
  if (info.lifecycle) fail('APP_LIFECYCLE_SCRIPTS', 'The dev command has predev/postdev hooks.', 'Run the development command yourself, then use --port; Tunnel does not silently run preparation hooks.');
  let cwd = info.path, installed = false;
  while (true) {
    if (await exists(join(cwd, 'node_modules', info.framework === 'nextjs' ? 'next' : 'vite'))) { installed = true; break; }
    if (dirname(cwd) === cwd) break; cwd = dirname(cwd);
  }
  if (!installed) fail('DEPENDENCIES_MISSING', 'Application dependencies are not installed in node_modules.', 'Install the project dependencies yourself; for Yarn PnP start manually and use --port.');
  const executable = await resolveExecutable(info.manager);
  if (!executable) fail('MANAGER_MISSING', `Package manager ${info.manager} is unavailable.`, 'Install it or start the app manually and use --port.');
  return { command: executable, args: ['run', info.script], cwd: info.path };
}
export async function resolveExecutable(name) {
  for (const dir of (process.env.PATH || '').split(':')) {
    if (!dir) continue;
    try { const p = join(dir, name); await access(p, constants.X_OK); return p; } catch {}
  }
  return null;
}
export async function listeners() {
  try {
    const { stdout } = await exec('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn'], { env: cleanEnvironment(), timeout: 5000, maxBuffer: 2 * 1024 * 1024 });
    const result = []; let pid, command;
    for (const line of stdout.split('\n')) {
      if (line[0] === 'p') pid = +line.slice(1);
      if (line[0] === 'c') command = line.slice(1);
      if (line[0] === 'n') { const port = /:(\d+)$/.exec(line)?.[1]; if (port && pid) result.push({ pid, port: +port, command }); }
    }
    return result;
  } catch (e) {
    if (e.code === 1 && !e.stderr?.trim()) return [];
    fail('PROCESS_INSPECTION_FAILED', 'Could not inspect TCP listeners with lsof.', 'Install lsof and allow process inspection.');
  }
}
export async function cwdOf(pid) {
  try {
    if (process.platform === 'linux') return await realpath(`/proc/${pid}/cwd`);
    const { stdout } = await exec('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { env: cleanEnvironment(), timeout: 3000 });
    const path = stdout.split('\n').find(x => x.startsWith('n'))?.slice(1);
    return path ? await realpath(path) : null;
  } catch { return null; }
}
export async function processCommand(pid) {
  try { return (await exec('ps', ['-p', String(pid), '-o', 'args='], { env: cleanEnvironment(), timeout: 3000 })).stdout.trim(); } catch { return ''; }
}
export async function findServer(project, { rootPid } = {}) {
  const candidates = [];
  let family = null;
  if (rootPid) {
    family = new Set([rootPid]);
    const { stdout } = await exec('ps', ['-axo', 'pid=,ppid='], { env: cleanEnvironment(), timeout: 3000 });
    const pairs = stdout.trim().split('\n').map(x => x.trim().split(/\s+/).map(Number));
    let changed = true;
    while (changed) {
      changed = false;
      for (const [pid, parent] of pairs) if (family.has(parent) && !family.has(pid)) { family.add(pid); changed = true; }
    }
  }
  for (const item of await listeners()) {
    if (family && !family.has(item.pid)) continue;
    if (await cwdOf(item.pid) !== project) continue;
    const command = await processCommand(item.pid);
    if (!command || /worker\.mjs|cloudflared|--inspect|--remote-debugging/.test(command)) continue;
    if (!/node|next|vite|bun/.test(command)) continue;
    const probe = await probeLocal(item.port);
    if (probe && !candidates.some(x => x.port === item.port)) candidates.push({ ...item, ...probe });
  }
  if (candidates.length > 1) fail('AMBIGUOUS_TARGET', 'Multiple project HTTP services were found.', 'Select the desired service with --port PORT.', { ports: candidates.map(x => x.port) });
  return candidates[0] || null;
}
