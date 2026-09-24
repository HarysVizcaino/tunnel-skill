import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
    const p = join(dir, e.name);
    files.push(...(e.isDirectory() ? await walk(p) : [p]));
  }
  return files;
}
const files = await walk('.');
for (const file of files.filter(x => x.endsWith('.mjs'))) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
const skill = await readFile('skills/tunnel/SKILL.md', 'utf8');
assert.match(skill, /^---\nname: tunnel\ndescription: .+\nmetadata:\n  version: "[^"]+"\n---/);
assert.ok(skill.split('\n').length < 500);
assert.ok(!/\bTODO\b|\[INSERT|TBD/.test(skill));
for (const [, target] of skill.matchAll(/\]\((references\/[^)]+)\)/g)) await readFile(join('skills/tunnel', target));
const manifest = JSON.parse(await readFile('skills/tunnel/scripts/runtime-manifest.json', 'utf8'));
for (const notice of ['LICENSE', 'NOTICE']) assert.equal(await readFile(notice, 'utf8'), await readFile(join('skills/tunnel', notice), 'utf8'));
assert.equal(Object.keys(manifest.artifacts).length, 4);
for (const a of Object.values(manifest.artifacts)) { assert.match(a.sha256, /^[a-f0-9]{64}$/); assert.ok(a.url.startsWith(`https://github.com/cloudflare/cloudflared/releases/download/${manifest.version}/`)); }
console.log(`Checked syntax of ${files.filter(x => x.endsWith('.mjs')).length} scripts, skill metadata/references and four pinned artifacts.`);
