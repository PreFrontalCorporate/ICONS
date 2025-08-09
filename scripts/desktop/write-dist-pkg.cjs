#!/usr/bin/env node
// Ensures Electron runs main as ESM and the preload as CJS.
// - Renames dist/preload.js -> dist/preload.cjs (if needed)
// - Writes dist/package.json with { "type": "module" }

const fs   = require('node:fs');
const path = require('node:path');

const dist = path.resolve(__dirname, '../../app/desktop/dist');

if (!fs.existsSync(dist)) {
  console.error('❌  dist folder not found:', dist);
  process.exit(1);
}

const from = path.join(dist, 'preload.js');
const to   = path.join(dist, 'preload.cjs');

try {
  if (fs.existsSync(from)) {
    fs.renameSync(from, to);
    console.log('✓ renamed preload.js → preload.cjs');
  } else if (fs.existsSync(to)) {
    console.log('ℹ︎ preload.cjs already present');
  } else {
    console.warn('⚠︎ no preload file found (did build:preload run?)');
  }

  const pkgPath = path.join(dist, 'package.json');
  fs.writeFileSync(pkgPath, JSON.stringify({ type: 'module' }, null, 2));
  console.log('→ wrote dist/package.json with {"type":"module"}');
} catch (err) {
  console.error(err);
  process.exit(1);
}
