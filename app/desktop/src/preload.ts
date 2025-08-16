import { contextBridge, ipcRenderer } from 'electron';

// ---------- bridge used by wrapper + webview ----------
contextBridge.exposeInMainWorld('api', {
  overlays: {
    count: () => ipcRenderer.invoke('overlay/count') as Promise<number>,
    clearAll: () => ipcRenderer.invoke('overlay/clearAll') as Promise<number>,
    pinFromUrl: (url: string) => ipcRenderer.invoke('overlay/pin', url) as Promise<number>,
  },
  openExternal: (url: string) => ipcRenderer.invoke('app/openExternal', url) as Promise<void>,
  onToggleOverlayPanel: (fn: () => void) => {
    const ch = 'overlay:panel/toggle';
    const h = () => fn();
    ipcRenderer.on(ch, h);
    return () => ipcRenderer.removeListener(ch, h);
  },
  onOverlayCount: (fn: (n: number) => void) => {
    const ch = 'overlay:count';
    const h = (_e: unknown, n: number) => fn(n);
    ipcRenderer.on(ch, h);
    return () => ipcRenderer.removeListener(ch, h);
  },
});

// Minimal compat for wrapper’s script:
Object.defineProperty(window, 'icon', {
  value: {
    addSticker: (payload: { url?: string; src?: string }) => {
      const url = payload?.url || payload?.src;
      if (url) (window as any).api?.overlays?.pinFromUrl?.(url);
    },
    clearOverlays: () => (window as any).api?.overlays?.clearAll?.(),
    onOverlayCount: (fn: (n:number)=>void) => (window as any).api?.onOverlayCount?.(fn),
  }
});

// ---------- small HUD ----------
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
    <div style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid rgba(255,255,255,.12)">
      <strong style="font-size:13px; letter-spacing:.3px;">Overlays</strong>
      <span id="icon-overlay-count" style="opacity:.75; font-size:12px; margin-left:auto">0</span>
      <button id="icon-overlay-clear" style="margin-left:8px; border:0; background:#ef4444; color:white; font-size:12px; padding:5px 8px; border-radius:8px; cursor:pointer">Clear</button>
      <button id="icon-overlay-close" title="Hide" style="margin-left:6px; border:0; background:transparent; color:#aaa; font-size:18px; line-height:1; cursor:pointer">✕</button>
    </div>
    <div style="padding:8px 10px; font-size:12px; line-height:1.4; color:#d9d9d9">
      Tip: <kbd>Ctrl/⌘+Shift+O</kbd> or <kbd>Ctrl/⌘+Shift+0</kbd> toggles; <kbd>Ctrl/⌘+Shift+Backspace</kbd> clears.
    </div>
  `;
  document.body.appendChild(panel);

  const refresh = async () => {
    const n = await (window as any).api?.overlays?.count?.();
    const el = document.getElementById('icon-overlay-count');
    if (typeof n === 'number' && el) el.textContent = String(n);
  };

  document.getElementById('icon-overlay-clear')?.addEventListener('click', async () => {
    await (window as any).api?.overlays?.clearAll?.(); refresh();
  });
  document.getElementById('icon-overlay-close')?.addEventListener('click', () => { (panel.style as any).display = 'none'; });
  (window as any).api?.onToggleOverlayPanel?.(() => { panel.style.display = panel.style.display === 'none' ? '' : 'none'; });
  (window as any).api?.onOverlayCount?.((_n:number) => refresh());
  refresh();
};

document.addEventListener('DOMContentLoaded', () => { try { bootOverlayPanel(); } catch {} });
