// Runs inside the <webview> guest (icon-web-two.vercel.app).
// Relay messages from the guest page back to the host <webview> container
// so library.html can receive them with 'ipc-message'.
const { ipcRenderer, contextBridge } = require('electron');

// 1) Accept postMessage from the site (preferred).
//    We expect: window.postMessage({ type: 'icon:add-sticker', payload: { url | src } }, '*')
window.addEventListener('message', (e) => {
  const d = e?.data;
  if (d && (d.type === 'icon:add-sticker' || d.type === 'icon:webview-sticker')) {
    ipcRenderer.sendToHost('icon:webview-sticker', d.payload || d);
  }
});

// 2) (Optional) Expose a helper the site could call directly if it wants.
contextBridge.exposeInMainWorld('iconBridge', {
  addSticker: (payload) => ipcRenderer.sendToHost('icon:webview-sticker', payload),
});
