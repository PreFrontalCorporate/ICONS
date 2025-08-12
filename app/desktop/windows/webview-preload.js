// windows/webview-preload.js
// Runs inside the <webview> guest page. Delegates sticker/library clicks up to the host window.

const { ipcRenderer } = require('electron');

const log = (...a) => { try { console.debug('[icon:webview]', ...a); } catch {} };
log('preload installed (click delegation active)');

const abs = (u) => {
  try { return new URL(u, location.href).href; } catch { return u; }
};

// Heuristic: when you click anywhere in a card or image, send the image URL to host.
function findCandidateImage(target) {
  if (!target) return null;
  // If you clicked directly on an image
  if (target.tagName === 'IMG') return target;
  // Or SVG <image> elements
  if (target.tagName === 'IMAGE') return target;
  // Otherwise, look upwards for a clickable card-like element and grab its image
  const card = target.closest('li, article, .card, .item, .sticker, [role="listitem"]');
  if (card) {
    const img = card.querySelector('img, image');
    if (img) return img;
  }
  // Fallback: nearest image up the tree or inside the same link
  const withinLink = target.closest('a');
  if (withinLink) {
    const img = withinLink.querySelector('img, image');
    if (img) return img;
  }
  return target.closest('img, image');
}

document.addEventListener('click', (ev) => {
  try {
    const img = findCandidateImage(ev.target);
    if (!img) return;
    const src = abs(img.currentSrc || img.src || img.getAttribute('href') || '');
    if (!src) return;

    // Don't break the page’s own navigation unless we actually captured an image
    ev.preventDefault();
    ev.stopPropagation();

    ipcRenderer.sendToHost('icon:webview-sticker', { url: src });
    log('sent icon:webview-sticker', src);
  } catch (e) {
    log('delegation error', e);
  }
}, true);

// Safety: also listen for explicit window.postMessage the site might emit
window.addEventListener('message', (ev) => {
  try {
    const data = ev?.data || {};
    if (data && (data.url || data.src) && data.type === 'icon:webview-sticker') {
      const url = abs(data.url || data.src);
      ipcRenderer.sendToHost('icon:webview-sticker', { url });
      log('postMessage -> icon:webview-sticker', url);
    }
  } catch {}
});
