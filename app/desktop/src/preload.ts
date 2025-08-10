// Compiled as CommonJS -> dist/preload.cjs (see tsconfig.preload.json)
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('iconOverlay', {
  pinSticker: (id: string, url: string) => ipcRenderer.invoke('overlay:create', id, url),
  clearAll:   () => ipcRenderer.invoke('overlay:clearAll'),
});

contextBridge.exposeInMainWorld('stickers', {
  list: (token: string) => ipcRenderer.invoke('stickers:list', token),
});
