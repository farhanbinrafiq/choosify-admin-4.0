import { rmSync } from 'node:fs';
import esbuild from 'esbuild';

rmSync('api/health.ts', { force: true });
rmSync('api/health.cjs', { force: true });

await esbuild.build({
  entryPoints: ['scripts/api-health.entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'api/health.js',
  sourcemap: true,
  external: ['firebase-admin'],
  logLevel: 'info',
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

console.log('[build:api] Bundled api/health.js for Vercel');
