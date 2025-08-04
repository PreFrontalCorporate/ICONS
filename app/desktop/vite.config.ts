// app/desktop/vite.config.ts
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

const alias = {
  '@components': resolve(__dirname, '../../components'),
  '@stickers':   resolve(__dirname, '../../packages/stickers'),
};

export default defineConfig({
  root: 'src/renderer',
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  resolve: { alias },
});
