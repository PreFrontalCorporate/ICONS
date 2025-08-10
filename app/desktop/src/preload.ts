// NOTE: This compiles to CommonJS and is renamed to preload.cjs in postbuild
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('icon', {
  stickers: {
    list: (token: string) => ipcRenderer.invoke('stickers:list', token),
  },
  overlay: {
    create: (id: string, url: string) => ipcRenderer.invoke('overlay:create', id, url),
    clearAll: () => ipcRenderer.invoke('overlay:clearAll'),
  }
});
