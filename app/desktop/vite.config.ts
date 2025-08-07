import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'src/renderer',
  base: './',                      // ✱ make paths relative in the bundle
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@components': resolve(__dirname, '../../components'),
      '@stickers'  : resolve(__dirname, '../../packages/stickers')
    }
  }
});
