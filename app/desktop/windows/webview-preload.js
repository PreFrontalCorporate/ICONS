// app/desktop/windows/webview-preload.js
// Runs INSIDE the <webview> (remote Library). Provide the bridge the Library expects
// and also a robust click-fallback that extracts an image URL.

const { contextBridge, ipcRenderer } = require('electron');

const sendToHost = (ch, payload) => {
  try {
    ipcRenderer.sendToHost(ch, payload);
  } catch (e) {
    console.error('sendToHost failed', e);
  }
};

const forwardSticker = (payload) => {
  // normalize: accept {url} or {src}
  const url = payload?.url || payload?.src;
  if (url) {
    sendToHost('icon:webview-sticker', { src: url });
  }
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
    if (el.tagName === 'IMG' && el.src) return el.src;
    const s = el.querySelector?.('source[srcset]');
    if (s?.srcset) {
      const first = s.srcset.split(',')[0]?.trim().split(' ')[0];
      if (first) return first;
    }
    if (el.tagName === 'A' && el.href && /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(el.href)) {
      return el.href;
    }
    const bg = el instanceof Element ? getComputedStyle(el).backgroundImage || '' : '';
    const m = bg.match(/url\(["']?(.*?)["']?\)/i);
    if (m?.[1]) return m[1];
    const d = (el instanceof Element && el.dataset) || {};
    if (d.stickerSrc) return d.stickerSrc;
    if (d.src) return d.src;
    if (d.image) return d.image;
    if (d.img) return d.img;
  }
  return null;
};

let lastClick = 0;
const clickHandler = (ev) => {
  // We only care about left-clicks
  if (ev.button !== 0) return;

  const url = extractUrl(ev.target);
  if (!url) return;

  const now = Date.now();
  if (now - lastClick < 300) { // throttle clicks
    ev.preventDefault();
    ev.stopImmediatePropagation();
    return;
  }
  lastClick = now;

  forwardSticker({ src: url });

  // Prevent default browser action and stop other handlers
  ev.preventDefault();
  ev.stopImmediatePropagation();
};

// Use a more specific listener to avoid capturing clicks on UI elements
// and ensure we only attach it once.
const attachClickListener = () => {
  window.removeEventListener('click', clickHandler, true);
  window.addEventListener('click', clickHandler, true);
};

// Attach the listener once the DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachClickListener);
} else {
  attachClickListener();
}


// (Optional) sanity ping so the host can know preload is alive
sendToHost('icon:webview-ready', null);
