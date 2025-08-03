import { BrowserWindow, screen, nativeImage } from 'electron';
import path from 'node:path';

const ACTIVE: Map<string, BrowserWindow> = new Map();

/** Create (or reveal) a frameless always‑on‑top overlay for one sticker */
export function createOverlay(id: string, imgUrl: string) {
  if (ACTIVE.has(id)) {
    ACTIVE.get(id)!.show();
    return;
  }

  /* ---------- multi‑monitor placement ---------- */
  const cursorPt = screen.getCursorScreenPoint();
  const disp     = screen.getDisplayNearestPoint(cursorPt);

  const win = new BrowserWindow({
    width       : 320,
    height      : 320,
    x           : disp.bounds.x + Math.round(disp.workArea.width  / 3),
    y           : disp.bounds.y + Math.round(disp.workArea.height / 3),
    type        : 'toolbar',          // small shadowless window
    transparent : true,
    frame       : false,
    resizable   : true,
    hasShadow   : false,
    movable     : true,
    alwaysOnTop : true,
    webPreferences: {
      preload : path.join(__dirname, '../preload.js'),
      sandbox : false,
    },
  });

  if (process.platform === 'win32')
    win.setAlwaysOnTop(true, 'pop-up-menu');   // on top of (most) fullscreen games

  win.loadURL(`data:text/html,
      <style>
        body,html{margin:0;padding:0;background:transparent;overflow:hidden}
        img{width:100%;height:100%;user-select:none;-webkit-user-drag:none}
      </style>
      <img src="${encodeURI(imgUrl)}" />
  `);

  win.on('closed', () => ACTIVE.delete(id));
  ACTIVE.set(id, win);
}

export function removeAllOverlays() {
  for (const w of ACTIVE.values()) w.close();
  ACTIVE.clear();
}
