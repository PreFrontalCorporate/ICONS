// app/desktop/src/ipc/overlay.ts
import { BrowserWindow, screen } from 'electron';
import * as path from 'node:path';

const ACTIVE = new Map<string, BrowserWindow>();
let EDIT_MODE = false;

export function inEditMode() { return EDIT_MODE; }
export function setEditMode(on: boolean) {
  EDIT_MODE = !!on;
  for (const w of ACTIVE.values()) {
    try { w.setIgnoreMouseEvents(!EDIT_MODE, { forward: true }); } catch {}
  }
}
export function toggleEditMode() { setEditMode(!EDIT_MODE); }

/** Create (or reveal) a frameless, always-on-top overlay for one sticker */
export function createOverlay(id: string, imgUrl: string) {
  // Reveal/update if this sticker already exists
  const existing = ACTIVE.get(id);
  if (existing) {
    existing.showInactive(); // don’t steal focus
    existing.webContents.send('set-img', imgUrl);
    return;
  }

  // Place on the display under the cursor
  const cursor = screen.getCursorScreenPoint();
  const disp   = screen.getDisplayNearestPoint(cursor);

  const win = new BrowserWindow({
    width: 320,
    height: 320,
    x: disp.bounds.x + Math.round(disp.workArea.width  / 3),
    y: disp.bounds.y + Math.round(disp.workArea.height / 3),

    frame: false,
    transparent: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: true,
    // keep it above everything, including fullscreen apps
    alwaysOnTop: true,
    type: 'toolbar',

    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.cjs'),
      sandbox: false,
      contextIsolation: true,
    },
  });

  // Make sure it truly floats everywhere
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Click-through by default; Edit Mode re-enables hit-testing
  win.setIgnoreMouseEvents(!EDIT_MODE, { forward: true });

  // Minimal inline HTML with scale + hints.
  const html = `data:text/html;charset=UTF-8,
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src * data: blob:; style-src 'unsafe-inline';">
    <style>
      html,body{margin:0;background:transparent;overflow:hidden;height:100%}
      body{-webkit-app-region:drag}
      img{display:block;width:100%;height:100%;user-select:none;-webkit-user-drag:none;pointer-events:none;-webkit-app-region:no-drag;transform-origin:center center}
      #hint{position:fixed;top:6px;left:8px;font:12px system-ui;background:rgba(0,0,0,.55);color:#fff;padding:4px 6px;border-radius:4px}
    </style>
    <script>
      let scale = 1;
      addEventListener('wheel', e => {
        if (!e.ctrlKey && !e.shiftKey) return;
        e.preventDefault();
        const d = Math.sign(e.deltaY) * -0.05;
        scale = Math.min(4, Math.max(0.2, +(scale + d).toFixed(2)));
        const img = document.getElementById('s');
        img.style.transform = 'scale(' + scale + ')';
      }, {passive:false});
      addEventListener('keydown', e => e.key === 'Escape' && close());
    </script>
    <img id="s" src="${encodeURI(imgUrl)}">
    <div id="hint">Edit: Ctrl+Shift+E · Scale: Ctrl/Shift + Wheel · ESC to close</div>
  `;

  win.loadURL(html);
  win.on('closed', () => ACTIVE.delete(id));
  ACTIVE.set(id, win);
}

export function removeAllOverlays() {
  for (const w of ACTIVE.values()) { try { w.close(); } catch {} }
  ACTIVE.clear();
}
