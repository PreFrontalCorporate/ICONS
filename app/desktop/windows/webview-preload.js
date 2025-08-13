// Runs inside the <webview> page context
const send = (payload) => {
  try { window.parent && window.electron?.ipcRenderer?.sendToHost?.('icon:webview-sticker', payload); }
  catch { /* in webview preload, sendToHost is exposed directly on 'ipcRenderer' */ }
  try { require('electron').ipcRenderer.sendToHost('icon:webview-sticker', payload); } catch {}
};

const extractUrl = (start) => {
  let el = start;
  for (let i = 0; el && i < 8; i++, el = el.parentElement) {
    const img = el.matches?.('img') ? el : el.querySelector?.('img');
    if (img && img.src) return img.src;

    const source = el.querySelector?.('source[srcset]');
    if (source?.srcset) {
      const first = source.srcset.split(',')[0]?.trim().split(' ')[0];
      if (first) return first;
    }

    if (el instanceof HTMLAnchorElement && el.href && /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(el.href)) {
      return el.href;
    }

    const bg = getComputedStyle(el).backgroundImage || '';
    const m = bg.match(/url\(["']?(.*?)["']?\)/i);
    if (m?.[1]) return m[1];

    const d = el.dataset || {};
    if (d.stickerSrc) return d.stickerSrc;
    if (d.src) return d.src;
    if (d.image) return d.image;
    if (d.img) return d.img;
  }
  return null;
};

const handler = (ev) => {
  const url = extractUrl(ev.target);
  if (!url) return;
  ev.preventDefault(); ev.stopPropagation();
  send({ src: url });
};

window.addEventListener('click', handler, true);
window.addEventListener('pointerdown', handler, true);
window.addEventListener('auxclick', handler, true);
