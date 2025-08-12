// webview-preload.js – runs inside the <webview> guest
const { ipcRenderer } = require('electron');

// If the hosted site calls window.parent.postMessage({type:'icon:webview-sticker', payload})
window.addEventListener('click', () => {}, { passive: true }); // ensure script runs
window.addEventListener('message', (ev) => {
  const d = ev.data || {};
  if (d && (d.type === 'icon:webview-sticker' || d.channel === 'icon:webview-sticker')) {
    ipcRenderer.sendToHost('icon:webview-sticker', d.payload || d);
  }
});

// Also provide a tiny global the site can call directly if it wants
Object.defineProperty(window, 'electronHost', {
  value: {
    send: (payload) => ipcRenderer.sendToHost('icon:webview-sticker', payload),
  }
});
