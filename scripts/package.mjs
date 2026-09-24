import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('dist', { recursive: true });
const output = `dist/tunnel-skill-${version}.tgz`;
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile()) result.push(path);
    else throw new Error('Release package cannot contain symlinks or special files');
  }
  return result;
}
// Minimal deterministic USTAR: sorted regular files, fixed metadata and gzip
// timestamp. No platform-specific tar flags or local extended attributes.
const blocks = [];
for (const name of [...await files('skills/tunnel'), 'LICENSE', 'NOTICE'].sort()) {
  if (Buffer.byteLength(name) > 100) throw new Error('Archive path exceeds the supported USTAR name field');
  const data = await readFile(name), header = Buffer.alloc(512);
  const put = (value, start, size) => header.write(value, start, size, 'ascii');
  const octal = (value, width) => value.toString(8).padStart(width - 1, '0') + '\0';
  put(name, 0, 100); put(octal(0o644, 8), 100, 8);
  put(octal(0, 8), 108, 8); put(octal(0, 8), 116, 8);
  put(octal(data.length, 12), 124, 12); put(octal(0, 12), 136, 12);
  put('        ', 148, 8); put('0', 156, 1); put('ustar\0', 257, 6); put('00', 263, 2);
  const sum = header.reduce((a, b) => a + b, 0);
  put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  blocks.push(header, data, Buffer.alloc((512 - data.length % 512) % 512));
}
blocks.push(Buffer.alloc(1024));
await writeFile(output, gzipSync(Buffer.concat(blocks), { level: 9 }));
console.log(JSON.stringify({ file: output, sha256: createHash('sha256').update(await readFile(output)).digest('hex') }));
