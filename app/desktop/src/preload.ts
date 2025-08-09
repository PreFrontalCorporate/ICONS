// CommonJS at runtime (compiled via tsconfig.preload.json).
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),
  stickers: {
    list: () => ipcRenderer.invoke('stickers:list'),
    clearAll: () => ipcRenderer.send('stickers:clear-all')
  },
  overlay: {
    setClickThrough: (on: boolean) => ipcRenderer.send('overlay:set-click-through', on)
  }
});
