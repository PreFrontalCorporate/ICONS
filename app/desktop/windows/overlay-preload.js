// Runs in the overlay window (no nodeIntegration).
// Expose a tiny bridge for overlay.html to call.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (ch, ...args) => ipcRenderer.invoke(ch, ...args),
    send:   (ch, ...args) => ipcRenderer.send(ch, ...args),
  },
});
