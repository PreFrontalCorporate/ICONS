// app/desktop/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // stickers
  login: (email: string, password: string) =>
    ipcRenderer.invoke('stickers:login', { email, password }),
  list:  (token: string) =>
    ipcRenderer.invoke('stickers:list', token),

  // overlays
  createOverlay: (id: string, url: string) =>
    ipcRenderer.invoke('overlay:create', id, url),
  clearOverlays: () =>
    ipcRenderer.invoke('overlay:clearAll'),

  // storage (renderer controls its own localStorage)
});
