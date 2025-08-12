// Runs inside the <webview> (guest). Use sendToHost to talk to our host page.
// Docs: webview 'ipc-message' + sendToHost pattern. 
// https://www.electronjs.org/ja/docs/latest/api/webview-tag#event-ipc-message
const { ipcRenderer } = require('electron');

// 1) Click any <img> inside the Library to "pin" it as an overlay window
window.addEventListener('click', (e) => {
  try {
    const path = e.composedPath ? e.composedPath() : (e.path || []);
    const img = path.find && path.find((n) => n && n.tagName && n.tagName.toLowerCase() === 'img');
    if (img && img.src) {
      ipcRenderer.sendToHost('pin-sticker', { url: img.src });
      // don't prevent default; user may still want to select etc.
    }
  } catch {}
}, true);

// 2) If the web app tries to open external links, forward them
document.addEventListener('click', (e) => {
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (a && /^https?:/i.test(a.href)) {
    ipcRenderer.sendToHost('open-external', { url: a.href });
    e.preventDefault();
  }
}, true);
