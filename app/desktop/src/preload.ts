import { contextBridge, ipcRenderer } from 'electron';

// Expose a tiny, safe surface to the Library UI
contextBridge.exposeInMainWorld('iconOverlay', {
  pinSticker: (id: string, url: string) => ipcRenderer.invoke('overlay:create', id, url),
  clearAll  : () => ipcRenderer.invoke('overlay:clearAll'),
});
