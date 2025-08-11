// Overlays – frameless, always-on-top, Alt = edit/drag; default = click-through
import { BrowserWindow, screen } from 'electron';
import * as path from 'node:path';

const ACTIVE = new Map<string, BrowserWindow>();

export function createOverlay(id: string, imgUrl: string) {
  if (ACTIVE.has(id)) { ACTIVE.get(id)!.show(); return; }

  const cursor = screen.getCursorScreenPoint();
  const disp   = screen.getDisplayNearestPoint(cursor);

  const win = new BrowserWindow({
    width: 320, height: 320,
    x: disp.bounds.x + Math.round(disp.workArea.width  / 3),
    y: disp.bounds.y + Math.round(disp.workArea.height / 3),
    transparent: true,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    type: 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),  // ← CJS we actually package
      sandbox: false,
      contextIsolation: true,
    }
  });

  if (process.platform === 'win32') {
    // Sit above most fullscreen windows on Windows
    win.setAlwaysOnTop(true, 'pop-up-menu');
  }

  // Default: click-through so it doesn’t steal clicks from the app underneath
  win.setIgnoreMouseEvents(true, { forward: true });

  // Hold Alt to edit/drag/resize (adds cyan outline so you can see it’s active)
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.key === 'Alt' && input.type === 'keyDown') {
      win.setIgnoreMouseEvents(false);
      win.webContents.executeJavaScript(
        "document.body.style.outline='2px dashed rgba(0,255,255,.6)';", true);
    }
    if (input.key === 'Alt' && input.type === 'keyUp') {
      win.setIgnoreMouseEvents(true, { forward: true });
      win.webContents.executeJavaScript("document.body.style.outline='';", true);
    }
  });

  win.loadURL(`data:text/html,
    <meta http-equiv="Content-Security-Policy" content="img-src * data: blob:;">
    <style>html,body{margin:0;background:transparent;overflow:hidden}
           img{width:100%;height:100%;user-select:none;-webkit-user-drag:none}</style>
    <script>addEventListener('keydown', e => e.key === 'Escape' && close());</script>
    <img src="${encodeURI(imgUrl)}">`
  );

  win.on('closed', () => ACTIVE.delete(id));
  ACTIVE.set(id, win);
}

export function removeAllOverlays() {
  ACTIVE.forEach(w => w.close());
  ACTIVE.clear();
}
