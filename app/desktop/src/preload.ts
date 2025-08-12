// app/desktop/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

/**
 * Keep your existing "api" surface (used by keyboard shortcuts and the small overlay panel)
 */
contextBridge.exposeInMainWorld('api', {
  overlays: {
    count: () => ipcRenderer.invoke('overlay/count') as Promise<number>,
    clearAll: () => ipcRenderer.invoke('overlay/clearAll') as Promise<number>,
    pinFromUrl: (url: string) => ipcRenderer.invoke('overlay/pin', url) as Promise<number>,
  },
  openExternal: (url: string) => ipcRenderer.invoke('app/openExternal', url) as Promise<void>,
  onToggleOverlayPanel: (fn: () => void) => {
    ipcRenderer.on('overlay:panel/toggle', fn);
    return () => ipcRenderer.removeListener('overlay:panel/toggle', fn);
  },
});

/**
 * NEW: minimal, safe bridge for the Library window to talk to main.
 * Library looks for window.icon.* — this is what unblocks clicks.
 */
contextBridge.exposeInMainWorld('icon', {
  addSticker(payload: { packId: string; stickerId: string; src: string }) {
    ipcRenderer.send('icon:add-sticker', payload);
  },
  clearOverlays() {
    ipcRenderer.send('icon:clear-overlays');
  },
  onOverlayCount(cb: (n: number) => void) {
    const handler = (_: unknown, n: number) => cb(n);
    ipcRenderer.on('icon:overlay-count', handler);
    return () => ipcRenderer.removeListener('icon:overlay-count', handler);
  },
});

/**
 * ——— Inline overlay panel (small, collapsible)
 * We keep it globally (hotkeys etc). The Library window will hide it via CSS.
 */
const bootOverlayPanel = () => {
  if (document.getElementById('icon-overlay-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'icon-overlay-panel';
  panel.style.cssText = `
    position: fixed; inset: auto 16px 16px auto; z-index: 2147483647;
    background: rgba(20,20,20,0.94); color: #fff; border-radius: 12px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.35);
    width: 280px; max-height: 60vh; overflow: hidden; backdrop-filter: blur(6px);
    font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu;
  `;
  panel.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.08)">
      <strong style="font-size:13px; letter-spacing:.3px;">Overlays</strong>
      <span id="icon-overlay-count" style="opacity:.75; font-size:12px; margin-left:auto">0</span>
      <button id="icon-overlay-clear" title="Clear all overlays"
        style="margin-left:8px; border:0; background:#ef4444; color:white; font-size:12px; padding:5px 8px; border-radius:8px; cursor:pointer">
        Clear
      </button>
      <button id="icon-overlay-close" title="Hide"
        style="margin-left:6px; border:0; background:transparent; color:#aaa; font-size:18px; line-height:1; cursor:pointer">
        &times;
      </button>
    </div>
    <div id="icon-overlay-body" style="padding:8px 10px; font-size:12px; line-height:1.4; color:#d9d9d9">
      <div>Manage overlay windows created from this app.</div>
      <div style="opacity:.7; font-size:11px; margin-top:6px">
        Tip: <kbd>Ctrl/⌘+Shift+O</kbd> toggles this panel; <kbd>Ctrl/⌘+Shift+Backspace</kbd> clears them.
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const refreshCount = async () => {
    const api: any = (window as any).api;
    if (!api) return;
    try {
      const n = await api.overlays.count();
      const el = document.getElementById('icon-overlay-count');
      if (el) el.textContent = String(n);
    } catch {}
  };

  document.getElementById('icon-overlay-clear')?.addEventListener('click', async () => {
    const api: any = (window as any).api;
    if (!api) return;
    try {
      await api.overlays.clearAll();
    } finally {
      refreshCount();
    }
  });

  document.getElementById('icon-overlay-close')?.addEventListener('click', () => {
    panel.style.display = 'none';
  });

  (window as any).api?.onToggleOverlayPanel(() => {
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
  });

  refreshCount();
};

document.addEventListener('DOMContentLoaded', () => {
  try { bootOverlayPanel(); } catch {}
});
