// app/desktop/src/ipc/overlay.ts
import { BrowserWindow, screen } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';

const ACTIVE = new Map<string, BrowserWindow>();

function pickPreload(fromDir: string) {
  const cjs = path.join(fromDir, '../preload.cjs');
  const js  = path.join(fromDir, '../preload.js');
  try { if (fs.existsSync(cjs)) return cjs; } catch {}
  return js;
}

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
      preload : pickPreload(__dirname),      // <— now resolves preload.cjs in prod
      sandbox : false
    }
  });

  // Keep overlays above most full‑screen apps on Windows
  if (process.platform === 'win32') win.setAlwaysOnTop(true, 'pop-up-menu');

  // ESC closes this overlay; Ctrl+Shift+X clears all overlays
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.key?.toLowerCase() === 'escape') win.close();
    if ((input.control || input.meta) && input.shift && input.key?.toLowerCase() === 'x') {
      ACTIVE.forEach(w => w.close()); ACTIVE.clear();
    }
  });

  win.loadURL(`data:text/html,
    <style>
      html,body{margin:0;background:transparent;overflow:hidden}
      img{width:100%;height:100%;user-select:none;-webkit-user-drag:none}
    </style>
    <img src="${encodeURI(imgUrl)}" />
  `);

  win.on('closed', () => ACTIVE.delete(id));
  ACTIVE.set(id, win);
}

export function removeAllOverlays() {
  ACTIVE.forEach(w => w.close());
  ACTIVE.clear();
}
