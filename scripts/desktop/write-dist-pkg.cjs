#!/usr/bin/env node
// Writes app/desktop/dist/package.json with { "type": "commonjs" }
// so Electron treats dist/preload.js as CJS when it requires it.
const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '../../app/desktop/dist/package.json');
const from = path.join(dist, 'preload.js');
const to   = path.join(dist, 'preload.cjs');
if (fs.existsSync(from)) fs.renameSync(from, to);

// IMPORTANT: either don't write dist/package.json at all, or:
fs.writeFileSync(path.join(dist, 'package.json'), JSON.stringify({
  // keep it module so dist/main.js stays ESM:
  type: 'module'
}, null, 2));
console.log('→ ensured preload.cjs and type:module in dist/');
