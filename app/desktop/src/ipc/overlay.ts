// app/desktop/src/ipc/overlay.ts
import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

const ACTIVE = new Map<string, BrowserWindow>();

export function createOverlay(id: string, imgUrl: string) {
  if (ACTIVE.has(id)) { ACTIVE.get(id)!.show(); return; }

  const cursor = screen.getCursorScreenPoint();
  const disp   = screen.getDisplayNearestPoint(cursor);

  const win = new BrowserWindow({
    width: 320, height: 320,
    x: disp.bounds.x + Math.round(disp.workArea.width  / 3),
    y: disp.bounds.y + Math.round(disp.workArea.height / 3),
    transparent: true, frame: false, resizable: true,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    type: 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'), // ← .cjs
      sandbox: false,
    },
  });

  if (process.platform === 'win32') win.setAlwaysOnTop(true, 'pop-up-menu');

  win.loadURL(`data:text/html,
    <meta http-equiv="Content-Security-Policy" content="img-src * data: blob:;">
    <style>html,body{margin:0;background:transparent;overflow:hidden}
      img{width:100%;height:100%;user-select:none;-webkit-user-drag:none}
    </style>
    <script>window.addEventListener('keydown',e=>e.key==='Escape'&&window.close())</script>
    <img src="${encodeURI(imgUrl)}">
  `);

  win.on('closed', () => ACTIVE.delete(id));
  ACTIVE.set(id, win);
}

export function removeAllOverlays() {
  ACTIVE.forEach(w => w.close());
  ACTIVE.clear();
}
