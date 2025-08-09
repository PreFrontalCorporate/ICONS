// Electron overlay windows: frameless, transparent, always-on-top.
// Adds: ESC to close focused overlay, global click-through toggle.

import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ACTIVE = new Map<string, BrowserWindow>();
let clickThrough = false;

export function createOverlay(id: string, imgUrl: string) {
  // reveal if already created
  if (ACTIVE.has(id)) { ACTIVE.get(id)!.show(); return; }

  // open on the display the cursor is on
  const cursor = screen.getCursorScreenPoint();
  const disp   = screen.getDisplayNearestPoint(cursor);

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
      // no preload needed; the page is our own overlay.html
      sandbox: false
    }
  });

  // honor current click-through mode
  win.setIgnoreMouseEvents(clickThrough, { forward: true });

  // ESC closes just this overlay
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') win.close();
  });

  const overlayHtml = path.join(__dirname, '..', '..', 'windows', 'overlay.html');
  const url = pathToFileURL(overlayHtml).toString() + '?img=' + encodeURIComponent(imgUrl);
  win.loadURL(url);

  win.on('closed', () => ACTIVE.delete(id));
  ACTIVE.set(id, win);
}

export function removeAllOverlays() {
  ACTIVE.forEach(w => w.close());
  ACTIVE.clear();
}

export function setAllClickThrough(enabled: boolean) {
  clickThrough = enabled;
  ACTIVE.forEach(w => w.setIgnoreMouseEvents(enabled, { forward: true }));
}

export function toggleAllClickThrough() {
  setAllClickThrough(!clickThrough);
}
