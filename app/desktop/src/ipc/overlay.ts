// app/desktop/src/ipc/overlay.ts
import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

const ACTIVE = new Map<string, BrowserWindow>();

/** Create (or reveal) a frameless always‑on‑top overlay for one sticker */
export function createOverlay(id: string, imgUrl: string) {
  const existing = ACTIVE.get(id);
  if (existing) { existing.show(); existing.focus(); return; }

  const cursor = screen.getCursorScreenPoint();
  const disp   = screen.getDisplayNearestPoint(cursor);

  const win = new BrowserWindow({
    width: 320,
    height: 320,
    x: disp.bounds.x + Math.round(disp.workArea.width  / 3),
    y: disp.bounds.y + Math.round(disp.workArea.height / 3),
    transparent   : true,
    backgroundColor: '#00000000',
    frame         : false,
    resizable     : true,
    alwaysOnTop   : true,
    skipTaskbar   : true,
    hasShadow     : false,
    type          : 'toolbar',
    show          : false, // show when ready
    webPreferences: {
      // IMPORTANT: preload is CJS at runtime and lives in dist/preload.cjs
      preload         : path.resolve(__dirname, '..', 'preload.cjs'),
      contextIsolation: true,
      sandbox         : false,
      devTools        : process.env.NODE_ENV !== 'production',
    }
  });

  if (process.platform === 'win32') {
    // Sit above most fullscreen windows on Windows
    win.setAlwaysOnTop(true, 'pop-up-menu');
  } else if (process.platform === 'darwin') {
    // Keep visible across spaces/fullscreen on macOS
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  const html = `
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; img-src * data: blob:; style-src 'unsafe-inline'">
    <style>
      html,body{margin:0;background:transparent;overflow:hidden}
      img{width:100%;height:100%;user-select:none;-webkit-user-drag:none}
    </style>
    <script>
      // Allow ESC to close the overlay
      window.addEventListener('keydown', e => e.key === 'Escape' && window.close());
    </script>
    <img src="${encodeURI(imgUrl)}">
  `;

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => ACTIVE.delete(id));
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  ACTIVE.set(id, win);
}

export function removeAllOverlays() {
  for (const w of ACTIVE.values()) try { w.close(); } catch {}
  ACTIVE.clear();
}
