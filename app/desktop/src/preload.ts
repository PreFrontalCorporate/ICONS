import { contextBridge, ipcRenderer } from 'electron';

type Rect = import('electron').Rectangle;

contextBridge.exposeInMainWorld('api', {
  overlays: {
    count: () => ipcRenderer.invoke('overlay/count') as Promise<number>,
    clearAll: () => ipcRenderer.invoke('overlay/clearAll') as Promise<number>,
  },
  onToggleOverlayPanel: (fn: () => void) => {
    ipcRenderer.on('overlay:panel/toggle', fn);
    return () => ipcRenderer.removeListener('overlay:panel/toggle', fn);
  },
});

// ——— Inline overlay panel on the Library page ———
const bootOverlayPanel = () => {
  if (document.getElementById('icon-overlay-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'icon-overlay-panel';
  panel.style.cssText = `
    position: fixed; inset: auto 16px 16px auto; z-index: 2147483647;
    background: rgba(20,20,20,0.92); color: #fff; border-radius: 12px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.35);
    width: 340px; max-height: 70vh; overflow: hidden; backdrop-filter: blur(6px);
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu;
  `;
  panel.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.08)">
      <strong style="font-size:14px; letter-spacing:.3px;">Overlays</strong>
      <span id="icon-overlay-count" style="opacity:.7; font-size:12px; margin-left:auto">0</span>
      <button id="icon-overlay-clear" title="Clear all overlays"
        style="margin-left:8px; border:0; background:#ef4444; color:white; font-size:12px; padding:6px 8px; border-radius:8px; cursor:pointer">
        Clear
      </button>
      <button id="icon-overlay-close"
        style="margin-left:6px; border:0; background:transparent; color:#aaa; font-size:18px; line-height:1; cursor:pointer">&times;</button>
    </div>
    <div id="icon-overlay-body" style="padding:10px 12px; font-size:13px; line-height:1.4; color:#d9d9d9">
      <div>Manage overlay windows created from this app.</div>
      <div style="opacity:.7; font-size:12px; margin-top:6px">
        Tip: use <kbd>Ctrl/⌘+Shift+O</kbd> to toggle this panel; <kbd>Ctrl/⌘+Shift+Backspace</kbd> to clear.
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const refreshCount = async () => {
    const n = await (window as any).api.overlays.count();
    const el = document.getElementById('icon-overlay-count');
    if (el) el.textContent = String(n);
  };

  // Wire buttons
  document.getElementById('icon-overlay-clear')?.addEventListener('click', async () => {
    await (window as any).api.overlays.clearAll();
    refreshCount();
  });

  document.getElementById('icon-overlay-close')?.addEventListener('click', () => {
    panel.style.display = 'none';
  });

  // React to menu/shortcut
  (window as any).api.onToggleOverlayPanel(() => {
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
  });

  // Initial count
  refreshCount();
};

document.addEventListener('DOMContentLoaded', () => {
  try { bootOverlayPanel(); } catch { /* ignore */ }
});
