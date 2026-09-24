#!/usr/bin/env node
if (process.argv.includes('--fail')) process.exit(7);
console.error('Quick Tunnel: https://fixture-session.trycloudflare.com');
setInterval(() => {}, 1000);
process.on('SIGTERM', () => process.exit(0));
