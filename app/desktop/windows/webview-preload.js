// app/desktop/windows/webview-preload.js
// Runs inside the <webview>. Forwards sticker clicks back to host.
const { ipcRenderer } = require('electron');

function send(payload) {
  try { ipcRenderer.sendToHost('icon:webview-sticker', payload); }
  catch (e) { /* ignore */ }
}

// Heuristic: find a usable image URL near the click target
function findImageUrl(start) {
  let el = start;
  for (let i = 0; i < 5 && el; i++, el = el.parentElement) {
    // common data attributes
    const ds = el.dataset || {};
    const cand = ds.stickerSrc || ds.src || ds.url || el.getAttribute?.('data-sticker-src') || el.getAttribute?.('data-src') || el.getAttribute?.('data-url');
    if (cand) return cand;

    // image inside
    const img = (el.tagName === 'IMG' ? el : el.querySelector?.('img[src]'));
    if (img?.src) return img.src;

    // anchor with href to a direct image
    if (el.tagName === 'A') {
      const href = el.getAttribute('href');
      if (href && /\.(png|jpe?g|gif|webp|svg)$/i.test(href)) return href;
    }
  }
  return null;
}

window.addEventListener('click', (ev) => {
  const url = findImageUrl(ev.target);
  if (url) {
    ev.preventDefault();
    ev.stopPropagation();
    send({ url, src: url });
  }
}, true);

// Optional: if the app’s guest page posts a message instead
window.addEventListener('message', (ev) => {
  const p = ev?.data;
  if (p && (p.url || p.src)) send({ url: p.url || p.src, src: p.src || p.url });
});

