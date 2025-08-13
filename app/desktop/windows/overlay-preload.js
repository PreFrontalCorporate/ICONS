// app/desktop/windows/overlay-preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeSelf: () => ipcRenderer.invoke('overlay/closeSelf')
});

