#!/usr/bin/env tsx
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'packages', 'stickers');
const index: any[] = [];

for (const dir of readdirSync(root)) {
  const path = join(root, dir, 'manifest.json');
  try {
    const entry = JSON.parse(readFileSync(path, 'utf8'))[0];
    index.push(entry);
  } catch { /* skip */ }
}

writeFileSync(
  join(root, 'index.json'),
  JSON.stringify(index, null, 2),
  'utf8'
);
console.log('✅  packages/stickers/index.json rebuilt');
