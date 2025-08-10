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
    transparent: true,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    type: 'toolbar',
    webPreferences: {
      // preload is only needed if you plan to add window-level actions;
      // the overlay is a tiny HTML page we render from a data URL.
      preload: path.join(__dirname, '../preload.cjs'),
      sandbox: false,
    },
  });

  if (process.platform === 'win32') {
    // Keeps it above most fullscreen apps on Windows
    win.setAlwaysOnTop(true, 'pop-up-menu');
  }

  // Minimal inlined UI. ESC closes; Alt (Win) / ⌘ (Mac) toggles drag region.
  win.loadURL(`data:text/html,
    <!doctype html>
    <style>
      html,body{margin:0;background:transparent;overflow:hidden}
      img{width:100%;height:100%;object-fit:contain;user-select:none;-webkit-user-drag:none}
      #x{position:absolute;top:6px;right:6px;width:18px;height:18px;border-radius:9px;background:#ff4668;cursor:pointer}
    </style>
    <div id="x"></div><img id="s">
    <script>
      const u = new URL(location.href); s.src = ${JSON.stringify(imgUrl)};
      window.addEventListener('keydown', e => {
        if (e.key === 'Escape') window.close();
        if ((e.metaKey && e.key === 'Meta') || (e.altKey && e.key === 'Alt'))
          document.body.style['-webkit-app-region'] = 'drag';
      });
      window.addEventListener('keyup', () => document.body.style['-webkit-app-region']='');
      x.onclick = () => window.close();
    </script>
  `);

  win.on('closed', () => ACTIVE.delete(id));
  ACTIVE.set(id, win);
}

export function removeAllOverlays() {
  ACTIVE.forEach(w => w.close());
  ACTIVE.clear();
}
