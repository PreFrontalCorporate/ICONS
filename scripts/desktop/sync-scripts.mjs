#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const ROOT = process.cwd();
const APP_PKG = join(ROOT, 'app/desktop/package.json');
const SCRIPTS_DIR = join(ROOT, 'scripts/desktop');

const pkg = JSON.parse(readFileSync(APP_PKG, 'utf8'));
pkg.scripts = pkg.scripts || {};

const helpers = readdirSync(SCRIPTS_DIR).filter(f => extname(f).match(/\.c?mjs$/));
for (const f of helpers) {
  const name = basename(f, extname(f)); // e.g. build-windows
  // expose each helper under "scripts": "helper:<name>"
  pkg.scripts[`helper:${name}`] = `node ../../scripts/desktop/${f}`;
}

writeFileSync(APP_PKG, JSON.stringify(pkg, null, 2));
console.log(`📝  app/desktop/package.json scripts updated (${helpers.length} entries)`);

