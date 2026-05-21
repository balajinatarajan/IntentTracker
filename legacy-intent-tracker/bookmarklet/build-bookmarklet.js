const esbuild = require('../../lib/node_modules/esbuild');

// Self-executing bookmarklet bundle (no global name — runs immediately)
esbuild.buildSync({
  entryPoints: ['bookmarklet/bookmarklet-bundle.js'],
  bundle: true,
  format: 'iife',
  outfile: 'dist/bookmarklet.js',
  minify: true,
  target: 'es2020',
});

const fs = require('fs');
const size = fs.statSync('dist/bookmarklet.js').size;
console.log(`Built dist/bookmarklet.js (${(size / 1024).toFixed(1)} KB minified)`);
console.log('');
console.log('Bookmarklet loader (drag to bookmarks bar):');
console.log("javascript:void(document.head.appendChild(Object.assign(document.createElement('script'),{src:'http://localhost:8081/legacy-intent-tracker/dist/bookmarklet.js'})))");
