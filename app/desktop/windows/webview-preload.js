// windows/webview-preload.js
// Runs inside the <webview> guest page. Delegates sticker/library clicks up to the host page.

let ipcRenderer;
try {
  // Works in modern Electron when preload runs in the renderer sandbox
  ipcRenderer = require('electron/renderer').ipcRenderer;
} catch {
  try {
    // Fallback (older Electron / different flags)
    ipcRenderer = require('electron').ipcRenderer;
  } catch {
    ipcRenderer = null;
  }
}

const log = (...a) => { try { console.debug('[icon:webview]', ...a); } catch {} };
log('preload starting…', { hasIPC: !!ipcRenderer });

const abs = (u) => {
  try { return new URL(u, location.href).href; } catch { return u || ''; }
};

function findCandidateImage(target) {
  if (!target) return null;
  if (target.tagName === 'IMG' || target.tagName === 'IMAGE') return target;

  const card = target.closest('li, article, .card, .item, .sticker, [role="listitem"]');
  if (card) {
    const img = card.querySelector('img, image');
    if (img) return img;
  }
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

    // Only intercept if we can actually talk to the host
    if (ipcRenderer && ipcRenderer.sendToHost) {
      ev.preventDefault();
      ev.stopPropagation();
      ipcRenderer.sendToHost('icon:webview-sticker', { url: src });
      log('sent icon:webview-sticker', src);
    } else {
      log('no ipcRenderer.sendToHost — not intercepting');
    }
  } catch (e) {
    log('delegation error', e);
  }
}, true);

// Optional: support sites that send postMessage explicitly
window.addEventListener('message', (ev) => {
  try {
    const data = ev?.data || {};
    if (data && (data.url || data.src) && data.type === 'icon:webview-sticker' && ipcRenderer?.sendToHost) {
      const url = abs(data.url || data.src);
      ipcRenderer.sendToHost('icon:webview-sticker', { url });
      log('postMessage -> icon:webview-sticker', url);
    }
  } catch {}
});

log('preload installed (click delegation active)');
