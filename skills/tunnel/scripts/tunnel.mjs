#!/usr/bin/env node
import { parseArgs, HELP, exitCode } from './lib/args.mjs';
import { publicError } from './lib/common.mjs';
import { run } from './lib/tunnel.mjs';

const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => controller.abort());
try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) process.stdout.write(HELP);
  else {
    if (+process.versions.node.split('.')[0] < 22) throw new Error('Node 22 or later required.');
    const result = await run(options, { signal: controller.signal });
    if (options.verbose) process.stderr.write(JSON.stringify({ status: result.status, ...result.diagnostics }) + '\n');
    process.stdout.write(JSON.stringify(result) + '\n');
  }
} catch (error) {
  process.stdout.write(JSON.stringify(publicError(error)) + '\n');
  process.exitCode = exitCode(error.code);
}
