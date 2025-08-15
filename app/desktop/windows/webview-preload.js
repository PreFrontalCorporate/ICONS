// app/desktop/windows/webview-preload.js
// Runs INSIDE the <webview> (remote Library). It must be robust against the host
// library's own code and prevent duplicate sticker-add events.

const { contextBridge, ipcRenderer } = require('electron');

// Rate-limiting state
let lastSentTime = 0;
const THROTTLE_MS = 300; // Block sends within this window

// --- GOAL:webview.single_ipc_message ---
// This is the single, throttled function responsible for sending the IPC message to the host.
// All event sources (bridge calls, click fallbacks) must go through this.
const sendToHost = (channel, payload) => {
  const now = Date.now();
  if (now - lastSentTime < THROTTLE_MS) {
    // GOAL:webview.dedupe_ipc - Throttled: received a request to send, but it was too soon.
    console.log('Icon: Throttled sticker send request.');
    return;
  }
  lastSentTime = now;

  try {
    ipcRenderer.sendToHost(channel, payload);
  } catch (e) {
    // This can happen if the webview is navigating away.
    console.warn('icon: sendToHost failed, likely safe to ignore:', e.message);
  }
};

const forwardSticker = (payload) => {
  const src = payload?.url || payload?.src;
  if (!src) {
    console.warn('icon: forwardSticker called without a src/url');
    return;
  }
  sendToHost('icon:webview-sticker', { src });
};

// 1) EXPOSE BRIDGE: The library should prefer calling this method directly.
const bridge = {
  addSticker: (payload) => forwardSticker(payload || {}),
  clearOverlays: () => ipcRenderer.sendToHost('icon:webview-clear'), // No throttle on this
  // Test-only function to reset the throttle state
  _reset: () => {
    lastSentTime = 0;
  },
};
contextBridge.exposeInMainWorld('icon', bridge);
contextBridge.exposeInMainWorld('desktop', bridge); // Alias for compatibility

// 2) CLICK FALLBACK: Capture any click and walk the DOM to find an image URL.
// This is a fallback for libraries that don't explicitly use the bridge.
const extractUrlFromTarget = (startNode) => {
  let el = startNode;
  // Walk up a few parents to find a likely candidate
  for (let i = 0; el && i < 4; i++, el = el.parentElement) {
    if (el.tagName === 'IMG' && el.src) return el.src;
    const sourceEl = el.querySelector?.('source[srcset]');
    if (sourceEl?.srcset) {
      const firstSrc = sourceEl.srcset.split(',')[0]?.trim().split(' ')[0];
      if (firstSrc) return firstSrc;
    }
    if (el.tagName === 'A' && el.href && /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(el.href)) {
      return el.href;
    }
    const bgImg = (el instanceof Element) ? getComputedStyle(el).backgroundImage || '' : '';
    const match = bgImg.match(/url\(["']?(.*?)["']?\)/i);
    if (match?.[1]) return match[1];
    const dataset = (el instanceof Element && el.dataset) || {};
    if (dataset.stickerSrc || dataset.src || dataset.image || dataset.img) {
      return dataset.stickerSrc || dataset.src || dataset.image || dataset.img;
    }
  }
  return null;
};

const handleDocumentClick = (event) => {
  // Check throttle first to avoid doing work if we're going to reject anyway.
  if (Date.now() - lastSentTime < THROTTLE_MS) {
    return;
  }
  // Only act on primary (left) button clicks.
  if (event.button !== 0) return;

  const url = extractUrlFromTarget(event.target);
  if (!url) return;

  // The click handler races with the library's own handlers.
  // The `sendToHost` throttle is the final gatekeeper.
  forwardSticker({ src: url });

  // Prevent other listeners on this element from firing. This helps, but the
  // throttle is the more reliable deduplication mechanism.
  event.stopImmediatePropagation();
};

// Listen on the capture phase to be first in line.
window.addEventListener('click', handleDocumentClick, { capture: true });

// Announce that the preload script is ready.
ipcRenderer.sendToHost('icon:webview-ready', null);
