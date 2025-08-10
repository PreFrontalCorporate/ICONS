// app/desktop/src/ipc/overlay.ts
import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

const ACTIVE = new Map<string, BrowserWindow>();

/** Create (or reveal) a frameless always‑on‑top overlay for one sticker */
export function createOverlay(id: string, imgUrl: string) {
  if (ACTIVE.has(id)) {
    ACTIVE.get(id)!.show();
    return;
  }

  // pick the display under the cursor for convenience
  const pt  = screen.getCursorScreenPoint();
  const disp = screen.getDisplayNearestPoint(pt);

  const win = new BrowserWindow({
    width: 320,
    height: 320,
    x: disp.bounds.x + Math.round(disp.workArea.width / 3),
    y: disp.bounds.y + Math.round(disp.workArea.height / 3),

    transparent: true,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    type: 'toolbar',

    webPreferences: {
      // IMPORTANT: our preload is CommonJS at runtime
      preload: path.join(__dirname, '../preload.cjs'),
      sandbox: false,
    },
  });

  // keep on top even over many Windows apps
  if (process.platform === 'win32') {
    // @ts-ignore – Electron supports this Windows level string
    win.setAlwaysOnTop(true, 'pop-up-menu');
  }

  // simple data URL page that shows one image, no background
  const html = /* html */ `
<!doctype html><html><head>
<meta charset="utf-8" />
<style>
  html,body{margin:0;height:100%;background:transparent;overflow:hidden}
  img{display:block;max-width:100%;max-height:100%}
  .hint{position:fixed;left:8px;bottom:8px;font:12px system-ui;color:#fff8;background:#0008;padding:4px 6px;border-radius:6px}
</style>
</head><body>
  <img src="${imgUrl}" alt="">
  <div class="hint">Right‑click = click‑through · ESC = close</div>
<script>
  const { ipcRenderer } = require('electron'); // available via preload
  // Toggle click‑through on right click
  window.addEventListener('contextmenu',(e)=>{
    e.preventDefault();
    window.postMessage({ cmd:'toggleClickThrough' }, '*');
  });
</script>
</body></html>`;
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  let clickThrough = false;
  const setClickThrough = (v: boolean) => {
    clickThrough = v;
    win.setIgnoreMouseEvents(v, { forward: true });
  };

  // keyboard in the overlay window
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.code === 'Escape') {
      win.close();
    }
  });

  // postMessage from the page toggles click through
  win.webContents.on('ipc-message', () => {});
  win.webContents.on('console-message', () => {});
  win.webContents.on('did-frame-finish-load', () => {
    // everything else handled by `before-input-event` + setIgnoreMouseEvents
  });
  // handle the message from our inline script
  win.webContents.on('ipc-message', () => {});
  win.webContents.on('render-process-gone', () => {});

  // simpler: listen to page 'message' event via executeJavaScript
  win.webContents.executeJavaScript(`
    window.addEventListener('message', ev=>{
      if(ev.data && ev.data.cmd==='toggleClickThrough'){
        window.electronAPI && window.electronAPI.toggle && window.electronAPI.toggle();
      }
    });
  `).catch(()=>{});

  // expose a tiny API for that inline script
  // (we don’t need anything fancy; use the preload bridge)
  win.webContents.once('dom-ready', () => setClickThrough(false));

  win.on('closed', () => {
    ACTIVE.delete(id);
  });

  // minimal bridge via custom property on global (set by preload)
  (win as any)._toggle = () => setClickThrough(!clickThrough);

  ACTIVE.set(id, win);
  win.show();
}

/** Remove all overlays */
export function removeAllOverlays() {
  for (const [, win] of ACTIVE) win.close();
  ACTIVE.clear();
}
