import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'src/renderer',
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    target: 'es2020'
  },
  resolve: {
    alias: {
      '@components': resolve(__dirname, '../../components'),
      '@stickers'  : resolve(__dirname, '../../packages/stickers')
    }
  }
});
