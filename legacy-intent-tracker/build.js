const esbuild = require('../lib/node_modules/esbuild');

// IIFE build for <script> tag — exposes window.LegacyIntentTracker
esbuild.buildSync({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'iife',
  globalName: 'LegacyIntentTracker',
  outfile: 'dist/legacy-intent-tracker.js',
  minify: false,
  target: 'es2020',
});

// ESM build for import
esbuild.buildSync({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/legacy-intent-tracker.esm.js',
  minify: false,
  target: 'es2020',
});

console.log('Built dist/legacy-intent-tracker.js (IIFE) and dist/legacy-intent-tracker.esm.js (ESM)');
