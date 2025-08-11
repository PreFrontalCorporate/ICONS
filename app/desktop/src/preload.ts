// app/desktop/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Minimal API for scripts that *do* want to call us explicitly
contextBridge.exposeInMainWorld('icon', {
  overlayCreate: (id: string, url: string) =>
    ipcRenderer.invoke('overlay:create', id, url),
  overlaysClear: () =>
    ipcRenderer.invoke('overlay:clearAll'),
});

// Best-effort: capture clicks in the hosted Library UI and react.
function closestAnchor(el: EventTarget | null): HTMLAnchorElement | null {
  let node: any = el;
  while (node && node !== document) {
    if (node instanceof HTMLAnchorElement) return node;
    node = node.parentNode;
  }
  return null;
}

function closestImage(el: EventTarget | null): HTMLImageElement | null {
  let node: any = el;
  while (node && node !== document) {
    if (node instanceof HTMLImageElement) return node;
    node = node.parentNode;
  }
  return null;
}

window.addEventListener(
  'click',
  (ev) => {
    // 1) Respect explicit deep-link anchors: <a href="icon://overlay?src=...">
    const a = closestAnchor(ev.target);
    if (a?.href?.startsWith?.('icon://overlay')) {
      ev.preventDefault();
      const id = a.getAttribute('data-overlay-id') || `overlay-${Date.now()}`;
      ipcRenderer.invoke('overlay:create', id, a.href).catch(() => {});
      return;
    }

    // 2) Fallback UX: clicking an <img> attempts to overlay the clicked image
    const img = closestImage(ev.target);
    if (img?.src) {
      ev.preventDefault();
      const u = new URL('icon://overlay');
      u.searchParams.set('src', img.src);
      const id = `overlay-${Date.now()}`;
      ipcRenderer.invoke('overlay:create', id, u.toString()).catch(() => {});
    }
  },
  // Capture true so we fire even if the app’s JS stops propagation
  { capture: true }
);
