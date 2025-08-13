// overlay window preload
const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  closeSelf: () => ipcRenderer.invoke('overlay/closeSelf'),
});

// prevent Ctrl+R / F5 from reloading
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault(); e.stopPropagation();
  }
  if (e.key === 'F5') { e.preventDefault(); e.stopPropagation(); }
}, true);
