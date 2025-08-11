import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('icon', {
  // overlays
  overlay: {
    toggle: () => ipcRenderer.invoke('overlay:toggle'),
    setEditMode: (on: boolean) => ipcRenderer.invoke('overlay:setEditMode', on),
    setClickThrough: (on: boolean) => ipcRenderer.invoke('overlay:setClickThrough', on),
    setScale: (s: number) => ipcRenderer.invoke('overlay:setScale', s)
  },
  // logging from renderer if needed
  log: (...args: unknown[]) => ipcRenderer.invoke('log', ...args)
});
