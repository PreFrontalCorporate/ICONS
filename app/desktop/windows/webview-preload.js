// app/desktop/windows/webview-preload.js
// Runs INSIDE the <webview> (remote Library). Provide the bridge the Library expects
// and also a robust click-fallback that extracts an image URL.

const { contextBridge, ipcRenderer } = require('electron');

const sendToHost = (ch, payload) => {
  try { ipcRenderer.sendToHost(ch, payload); } catch {}
};

const forwardSticker = (payload) => {
  // normalize: accept {url} or {src}
  const url = payload?.url || payload?.src;
  if (url) sendToHost('icon:webview-sticker', { src: url });
};

// 1) Expose the bridges the Library may call
const bridge = {
  addSticker: (payload) => forwardSticker(payload || {}),
  clearOverlays: () => sendToHost('icon:webview-clear'),
};
contextBridge.exposeInMainWorld('icon', bridge);
contextBridge.exposeInMainWorld('desktop', bridge);

// 2) Click fallback: capture any click, walk up DOM to find an image-like URL
const extractUrl = (start) => {
  let el = start;
  for (let i = 0; el && i < 8; i++, el = el.parentElement) {
    // <img>
    if (el.tagName === 'IMG' && el.src) return el.src;

    // <source srcset>
    const s = el.querySelector?.('source[srcset]');
    if (s?.srcset) {
      const first = s.srcset.split(',')[0]?.trim().split(' ')[0];
      if (first) return first;
    }

    // <a href="...png|jpg|webp">
    if (el.tagName === 'A' && el.href && /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(el.href)) {
      return el.href;
    }

    // background-image: url("...")
    const bg = (el instanceof Element) ? getComputedStyle(el).backgroundImage || '' : '';
    const m = bg.match(/url\(["']?(.*?)["']?\)/i);
    if (m?.[1]) return m[1];

    // data attributes some UIs use
    const d = (el instanceof Element && el.dataset) || {};
    if (d.stickerSrc) return d.stickerSrc;
    if (d.src) return d.src;
    if (d.image) return d.image;
    if (d.img) return d.img;
  }
  return null;
};

const clickHandler = (ev) => {
  const url = extractUrl(ev.target);
  if (!url) return;
  ev.preventDefault();
  ev.stopPropagation();
  sendToHost('icon:webview-sticker', { src: url });
};

// Capture early so we beat the site’s handlers
window.addEventListener('click', clickHandler, true);
window.addEventListener('pointerdown', clickHandler, true);

// (Optional) sanity ping so the host can know preload is alive (not required for functionality)
sendToHost('icon:webview-ready', null);
