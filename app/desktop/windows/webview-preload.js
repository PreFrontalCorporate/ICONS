// app/desktop/windows/webview-preload.js
// Runs inside the <webview>. We can't touch the page code, so we delegate clicks
// and send a compact payload back to the host BrowserWindow.

const { ipcRenderer } = require('electron');

// Try to build a reasonable stickerId from a URL or label text.
function deriveStickerId({ url, label }) {
  try {
    if (url) {
      const u = new URL(url);
      const base = u.pathname.split('/').pop() || '';
      const stem = base.replace(/\.(webp|png|jpg|jpeg|gif|svg)$/i, '');
      if (stem) return stem.slice(0, 64);
    }
  } catch {}
  if (label) {
    return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'sticker';
  }
  return 'sticker';
}

function findStickerFromTarget(target) {
  // Walk up to a <li> or a card‑like container; then find the img + label.
  const li = target.closest('li, .card, .item, .tile') || target.closest('[role="listitem"]');
  const img = (li && li.querySelector('img')) || target.closest('img');
  if (!img) return null;

  const labelEl =
    (li && (li.querySelector('span, figcaption, .title, .name, h3, h4'))) ||
    img.getAttribute('alt') ||
    null;

  const label = typeof labelEl === 'string' ? labelEl : (labelEl && labelEl.textContent || '').trim();

  const src = img.currentSrc || img.src;
  if (!src) return null;

  const stickerId = deriveStickerId({ url: src, label });
  return { packId: 'url', stickerId, src };
}

function installClickDelegation() {
  document.addEventListener(
    'click',
    (ev) => {
      const payload = findStickerFromTarget(ev.target);
      if (payload) {
        // Send to host BrowserWindow. The host listens via <webview>'s 'ipc-message'.
        ipcRenderer.sendToHost('icon:webview-sticker', payload);
        ev.preventDefault();
        ev.stopPropagation();
      }
    },
    { capture: true }
  );
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    installClickDelegation();
    // Be noisy while we iterate.
    console.debug('[icon:webview] preload installed (click delegation active)');
  } catch (e) {
    console.error('[icon:webview] preload error', e);
  }
});
