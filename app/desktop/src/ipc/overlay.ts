import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

const ACTIVE = new Map<string, BrowserWindow>();

/** Create (or reveal) a frameless always‑on‑top overlay for one sticker */
export function createOverlay(id: string, imgUrl: string) {
  if (ACTIVE.has(id)) { ACTIVE.get(id)!.show(); return; }

  const cursor = screen.getCursorScreenPoint();
  const disp   = screen.getDisplayNearestPoint(cursor);

  const win = new BrowserWindow({
    width: 320, height: 320,
    x: disp.bounds.x + Math.round(disp.workArea.width  / 3),
    y: disp.bounds.y + Math.round(disp.workArea.height / 3),

    transparent : true, frame: false, resizable: true,
    alwaysOnTop : true, skipTaskbar: true, hasShadow:false,
    type: 'toolbar',
    webPreferences: {
      preload : path.join(__dirname, '../preload.cjs'), // <- CJS preload
      sandbox : false
    }
  });

  if (process.platform === 'win32') {
    win.setAlwaysOnTop(true, 'pop-up-menu'); // keeps it above most fullscreen apps
  }

  win.loadURL(`data:text/html,
    <style>
      html,body{margin:0;background:transparent;overflow:hidden}
      img{width:100%;height:100%;user-select:none;-webkit-user-drag:none}
    </style>
    <img src="${encodeURI(imgUrl)}">
  `);

  win.on('closed', () => ACTIVE.delete(id));
  ACTIVE.set(id, win);
}

export function removeAllOverlays() {
  ACTIVE.forEach(w => w.close());
  ACTIVE.clear();
}
