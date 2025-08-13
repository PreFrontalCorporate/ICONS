const { ipcRenderer, contextBridge } = require('electron');
contextBridge.exposeInMainWorld('overlayAPI', {
  closeSelf: () => ipcRenderer.invoke('overlay/closeSelf'),
});
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'r')) { e.preventDefault(); e.stopPropagation(); }
  if (e.key === 'F5') { e.preventDefault(); e.stopPropagation(); }
}, true);
