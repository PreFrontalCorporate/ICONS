import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', { ipcRenderer });

contextBridge.exposeInMainWorld('iconOverlay', {
  pinSticker: (id: string, url: string) => ipcRenderer.invoke('overlay:create', id, url),
  clearAll  : ()                       => ipcRenderer.invoke('overlay:clearAll'),
  loadStickers: (email:string)=>ipcRenderer.invoke('stickers:get',email),
  realtimeOn  : (email:string)=>ipcRenderer.invoke('stickers:watch',email),
});

