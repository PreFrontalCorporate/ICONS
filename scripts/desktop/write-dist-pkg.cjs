#!/usr/bin/env node
// Writes app/desktop/dist/package.json with { "type": "commonjs" }
// so Electron treats dist/preload.js as CJS when it requires it.
const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '../../app/desktop/dist/package.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify({ type: 'commonjs' }, null, 2));
console.log('→ wrote', path.relative(process.cwd(), target));
