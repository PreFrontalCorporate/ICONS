// scripts/desktop/write-dist-pkg.cjs
// Postbuild fixer for Electron packaging:
// - rename preload.js -> preload.cjs  (CJS for sandbox/preload)
// - rename main.js    -> main.mjs     (explicit ESM)
// - create entry.cjs bootstrap that dynamic-imports main.mjs
// - write a small dist/package.json set to commonjs (mjs still loads as ESM)

const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(process.cwd(), 'dist');

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function safeRename(from, to, label) {
  if (exists(from)) {
    fs.renameSync(from, to);
    console.log(`✓ renamed ${label}`);
  }
}

function write(file, contents, label) {
  fs.writeFileSync(file, contents);
  console.log(`→ wrote ${label}`);
}

if (!exists(dist)) {
  console.error('dist/ not found; did you run build?');
  process.exit(1);
}

// 1) preload.js -> preload.cjs
safeRename(path.join(dist, 'preload.js'), path.join(dist, 'preload.cjs'), 'preload.js → preload.cjs');

// 2) main.js -> main.mjs (ESM)
safeRename(path.join(dist, 'main.js'), path.join(dist, 'main.mjs'), 'main.js → main.mjs');

// 3) entry.cjs bootstrap that loads ESM main.mjs
const entryCjs = `
/* Electron CJS bootstrap -> ESM main */
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  try {
    const url = pathToFileURL(path.join(__dirname, 'main.mjs')).href;
    await import(url);
  } catch (err) {
    console.error('[bootstrap] failed to import main.mjs', err);
    throw err;
  }
})();
`.trimStart();

write(path.join(dist, 'entry.cjs'), entryCjs, 'dist/entry.cjs bootstrap');

// 4) Make dist default to commonjs (mjs stays ESM regardless)
const distPkg = {
  type: 'commonjs'
};
write(path.join(dist, 'package.json'), JSON.stringify(distPkg, null, 2) + '\n', 'dist/package.json with {"type":"commonjs"}');
