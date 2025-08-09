// app/desktop/src/preload.ts
// Preload must be CJS at runtime; tsc compiles this with "module":"commonjs".
// Expose a minimal, safe API for the renderer.

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('icon', {
  overlay: {
    pinSticker: (id: string, url: string) => ipcRenderer.invoke('overlay:create', id, url),
    clearAll: () => ipcRenderer.invoke('overlay:clearAll')
  },
  stickers: {
    getMine: (token: string) => ipcRenderer.invoke('stickers:getMine', token)
  }
});

// Optional: a tiny helper so the renderer can persist the token via preload
// (renderer also has localStorage directly; keep both handy)
contextBridge.exposeInMainWorld('iconAuth', {
  saveToken: (token: string) => localStorage.setItem('cat', token),
  readToken: () => localStorage.getItem('cat'),
  clear: () => localStorage.removeItem('cat')
});
