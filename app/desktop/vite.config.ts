import { defineConfig } from 'vite';
import electronRenderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  root: 'renderer',          // folder that holds index.html & renderer.ts
  base: './',
  build: {
    outDir: '../dist/renderer',
    emptyOutDir: true
  },
  plugins: [electronRenderer()]
});
