import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('iconOverlay', {
  pinSticker: (id: string, url: string) => ipcRenderer.invoke('overlay:create', id, url),
  clearAll:   () => ipcRenderer.invoke('overlay:clearAll'),
});
