// CommonJS-targeted preload (compiled to dist/preload.js then renamed to .cjs)
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('stickers', {
  list: (token: string) => ipcRenderer.invoke('stickers:list', token),
  pin:  (id: string, url: string) => ipcRenderer.invoke('overlay:create', id, url),
  clearAll: () => ipcRenderer.invoke('overlay:clearAll'),
});
