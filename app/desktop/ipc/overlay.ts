// app/desktop/ipc/overlay.ts
import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

const ACTIVE = new Map<string, BrowserWindow>();
let CLICK_THROUGH = false;

function applyClickThrough(win: BrowserWindow) {
  win.setIgnoreMouseEvents(CLICK_THROUGH, { forward: CLICK_THROUGH });
}

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
    webPreferences: { preload: path.join(__dirname, '../preload.cjs'), sandbox: false } // ⟵ .cjs
  });

  if (process.platform === 'win32')
    win.setAlwaysOnTop(true, 'pop-up-menu');

  applyClickThrough(win);

  // Use the HTML template and pass the image via query string
  win.loadFile(path.join(__dirname, '../windows/overlay.html'), { query: { img: imgUrl } });

  // keyboard helpers
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'Escape') win.close();
    if (input.code === 'KeyT') {          // T = toggle click-through
      CLICK_THROUGH = !CLICK_THROUGH;
      ACTIVE.forEach(applyClickThrough);
    }
  });

  win.on('closed', () => ACTIVE.delete(id));
  ACTIVE.set(id, win);
}

export function removeAllOverlays() {
  ACTIVE.forEach(w => w.close());
  ACTIVE.clear();
}
