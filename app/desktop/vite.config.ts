import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // Vite expects index.html in this folder
  root: __dirname,
  base: './',
  build: {
    // IMPORTANT: put renderer output INSIDE app/desktop/dist so it ships with the app
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true
  }
});
