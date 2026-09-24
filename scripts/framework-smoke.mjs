import { realpath, mkdtemp, rm, chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { storage } from '../skills/tunnel/scripts/lib/common.mjs';
import { run } from '../skills/tunnel/scripts/lib/tunnel.mjs';
import { readState } from '../skills/tunnel/scripts/lib/state.mjs';
import { control, stopWorker } from '../skills/tunnel/scripts/lib/processes.mjs';
import { verifyPublic, request } from '../skills/tunnel/scripts/lib/http.mjs';
const base = process.argv[2];
if (!base) throw new Error('Usage: node scripts/framework-smoke.mjs /path/to/framework-fixtures');
const home = await realpath(await mkdtemp(join(tmpdir(), 'tunnel-framework-home-'))), store = storage(home);
const provider = resolve('tests/fixtures/provider.mjs'); await chmod(provider, 0o700);
process.env.NEXT_TELEMETRY_DISABLED = '1';
try {
  for (const name of ['vite-app', 'next-app']) {
    const project = await realpath(join(base, name));
    try {
      const result = await run({ project, mode: 'start' }, { store, ensureRuntime: async () => ({ path: provider, version: 'fixture' }), verifyPublic: async (_, key) => {
        const s = await readState(store, project), live = await control(s.tunnel);
        return verifyPublic(live.bridgeUrl, key, { timeout: 15000 });
      } });
      const s = await readState(store, project), live = await control(s.tunnel);
      const html = await request(live.bridgeUrl, { timeout: 20000 });
      if (html.status !== 200 || !html.body.includes('Tunnel ')) throw new Error('Framework page did not render');
      const asset = name === 'vite-app' ? '/main.js' : /src="([^" ]*\/_next\/static\/[^" ]+)"/.exec(html.body)?.[1];
      if (!asset || (await request(live.bridgeUrl + asset, { timeout: 20000 })).status !== 200) throw new Error('Framework asset failed');
      const repeated = await run({ project, mode: 'start' }, { store, verifyPublic: (_, key) => verifyPublic(live.bridgeUrl, key, { timeout: 15000 }) });
      if (!repeated.reused) throw new Error('Framework session duplicated');
      console.log(JSON.stringify({ framework: result.framework, page: 'passed', asset: 'passed', reuse: 'passed', publicProvider: 'simulated' }));
    } finally {
      const state = await readState(store, project);
      await run({ project, mode: 'stop' }, { store });
      await stopWorker(state?.app);
    }
  }
} finally { await rm(home, { recursive: true, force: true }); }
