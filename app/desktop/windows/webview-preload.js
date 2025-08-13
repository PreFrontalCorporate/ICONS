// Runs inside the <webview> guest page
const { ipcRenderer } = require('electron');

// Helper to emit to host page
function sendSticker(url) {
  if (!url) return;
  ipcRenderer.sendToHost('icon:webview-sticker', { url });
}

// 1) Generic click catcher: pick the nearest <img> (or background-image)
window.addEventListener('click', (ev) => {
  try {
    const el = ev.target;
    if (!el) return;

    // If the element itself is an IMG, use it; otherwise look inside/above.
    let img = el.closest && el.closest('img');
    if (!img && el.querySelector) img = el.querySelector('img');

    if (img && img.src) {
      ev.preventDefault();
      sendSticker(img.src);
      return;
    }

    // Look for background-image
    const node = /** @type {HTMLElement} */(el.closest && el.closest('[style]'));
    if (node) {
      const bg = getComputedStyle(node).backgroundImage || '';
      const m = bg.match(/url\(["']?(.*?)["']?\)/i);
      if (m && m[1]) {
        ev.preventDefault();
        sendSticker(m[1]);
      }
    }
  } catch {}
}, true);

// 2) Also accept postMessage from the site: {type:'icon:add-sticker', url}
window.addEventListener('message', (e) => {
  try {
    const d = e.data || {};
    if (d && (d.type === 'icon:add-sticker') && d.url) sendSticker(d.url);
  } catch {}
});

// 3) Fallback: hijack console-message with a magic prefix
const origLog = console.log.bind(console);
console.log = (...args) => {
  try {
    const a0 = String(args[0] ?? '');
    if (a0.startsWith('[icon:sticker]')) {
      const url = String(args[1] ?? '').trim();
      if (url) sendSticker(url);
      return;
    }
  } catch {}
  origLog(...args);
};
