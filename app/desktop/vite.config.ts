import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  build: { outDir: resolve(__dirname, 'dist/renderer'), emptyOutDir: true, sourcemap: false },
  resolve: {
    alias: {
      '@components': resolve(__dirname, '../../components'),
      '@stickers'  : resolve(__dirname, '../../packages/stickers')
    }
  }
});
