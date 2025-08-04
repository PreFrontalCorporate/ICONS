// app/desktop/vite.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import electron from 'vite-plugin-electron';

export default defineConfig({
  root: resolve(__dirname, 'renderer'),      // index.html lives here
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    sourcemap: true,
  },
  plugins: [
    electron({
      main: {
        // entry for the Electron main process *after* it has been compiled by tsc
        entry: resolve(__dirname, 'dist/main.js'),
      },
      renderer: {
        preload: resolve(__dirname, 'src/preload.ts'), // optional – remove if no preload
      },
    }),
  ],
});

