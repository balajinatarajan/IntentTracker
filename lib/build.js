const esbuild = require('esbuild');

// IIFE build for <script> tag — exposes window.IntentTracker
esbuild.buildSync({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'iife',
  globalName: 'IntentTracker',
  outfile: 'dist/intent-tracker.js',
  minify: false,
  target: 'es2020',
});

// ESM build for import
esbuild.buildSync({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/intent-tracker.esm.js',
  minify: false,
  target: 'es2020',
});

console.log('Built dist/intent-tracker.js (IIFE) and dist/intent-tracker.esm.js (ESM)');
