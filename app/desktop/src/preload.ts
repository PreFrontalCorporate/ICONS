// app/desktop/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('iconDesktop', {
  createOverlay: (id: string, url: string) => ipcRenderer.invoke('overlay:create', id, url),
  clearOverlays: () => ipcRenderer.invoke('overlay:clearAll')
});

// Optional: no-op ping to verify preload loaded
ipcRenderer.postMessage('preload:ready', { ts: Date.now() });
