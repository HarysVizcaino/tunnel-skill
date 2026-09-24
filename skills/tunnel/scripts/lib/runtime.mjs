import { readFile, writeFile, chmod, rename, rm, mkdtemp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, privateDir, exists, fail, exec, cleanEnvironment } from './common.mjs';
import { withLock } from './state.mjs';

const manifestPath = fileURLToPath(new URL('../runtime-manifest.json', import.meta.url));
export async function download(url, { signal } = {}) {
  let target = url;
  for (let redirects = 0; redirects < 6; redirects++) {
    const parsed = new URL(target);
    if (parsed.protocol !== 'https:' || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(parsed.hostname)) fail('RUNTIME_DOWNLOAD_FAILED', 'Runtime redirect is not an approved official asset host.');
    const response = await fetch(target, { redirect: 'manual', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) { await response.body?.cancel(); target = new URL(response.headers.get('location'), target).href; continue; }
    if (!response.ok) { await response.body?.cancel(); fail('RUNTIME_DOWNLOAD_FAILED', `Runtime download returned HTTP ${response.status}.`, 'Check Internet access and retry.'); }
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 100 * 1024 * 1024) fail('RUNTIME_DOWNLOAD_FAILED', 'Runtime artifact exceeds the size limit.');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  fail('RUNTIME_DOWNLOAD_FAILED', 'Too many runtime redirects.');
}
export async function ensureRuntime(store, { platform = process.platform, arch = process.arch, downloader = download, manifest, signal } = {}) {
  manifest ??= JSON.parse(await readFile(manifestPath, 'utf8'));
  const artifact = manifest.artifacts[`${platform}-${arch}`];
  if (!artifact) fail('UNSUPPORTED_PLATFORM', `Unsupported platform: ${platform}/${arch}.`, 'Use macOS or Linux on ARM64/x64.');
  const root = join(store.bin, manifest.version, `${platform}-${arch}`);
  await privateDir(store.root); await privateDir(store.bin); await privateDir(store.cache);
  return withLock(join(store.bin, 'runtime.lock'), async () => {
    const archive = join(store.cache, artifact.name + '-' + manifest.version);
    let bytes = await exists(archive) ? await readFile(archive) : null;
    if (!bytes || hash(bytes) !== artifact.sha256) {
      try { bytes = await downloader(artifact.url, { signal }); }
      catch (e) { if (signal?.aborted) fail('INTERRUPTED', 'Runtime download interrupted.'); if (e.code === 'RUNTIME_DOWNLOAD_FAILED') throw e; fail('RUNTIME_DOWNLOAD_FAILED', 'Could not download the official runtime.', 'Check Internet access or retry outside a restricted sandbox.'); }
      if (signal?.aborted) fail('INTERRUPTED', 'Runtime download interrupted.');
      if (hash(bytes) !== artifact.sha256) fail('CHECKSUM_MISMATCH', 'Runtime checksum does not match the pinned manifest.', 'Do not execute it. Review the official release before updating the manifest.');
      const tmp = archive + '.download';
      await writeFile(tmp, bytes, { mode: 0o600 }); await rename(tmp, archive);
    }
    // Re-extract from the verified artifact. Never trust a mutable cached executable.
    await privateDir(dirname(root));
    const tmp = await mkdtemp(join(dirname(root), '.install-'));
    try {
      if (artifact.archive) {
        const { stdout } = await exec('tar', ['-tzf', archive], { env: cleanEnvironment(), timeout: 10000 });
        if (!stdout.split('\n').includes('cloudflared')) fail('RUNTIME_DOWNLOAD_FAILED', 'Official archive does not contain cloudflared.');
        await exec('tar', ['-xzf', archive, '-C', tmp, 'cloudflared'], { env: cleanEnvironment(), timeout: 10000 });
      } else await writeFile(join(tmp, 'cloudflared'), bytes, { mode: 0o700 });
      await chmod(join(tmp, 'cloudflared'), 0o700);
      await privateDir(root);
      await rename(join(tmp, 'cloudflared'), join(root, 'cloudflared'));
    } finally { await rm(tmp, { recursive: true, force: true }); }
    return { path: join(root, 'cloudflared'), version: manifest.version };
  });
}
