import esbuild from 'esbuild';
import { rmSync } from 'node:fs';

rmSync('api/health.ts', { force: true });
rmSync('api/health.js', { force: true });
rmSync('api/health.cjs', { force: true });

await esbuild.build({
  entryPoints: ['scripts/api-health.entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'api/health.cjs',
  sourcemap: true,
  external: ['firebase-admin'],
  logLevel: 'info',
  footer: {
    js: 'module.exports = handler;\nmodule.exports.default = handler;',
  },
});

console.log('[build:api] Bundled api/health.cjs for Vercel');
