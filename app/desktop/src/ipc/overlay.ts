// app/desktop/src/ipc/overlay.ts
import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

const ACTIVE = new Map<string, BrowserWindow>();

/** Create (or reveal) a frameless always‑on‑top overlay for one sticker */
export function createOverlay(id: string, imgUrl: string) {
  // reveal if already created
  const existing = ACTIVE.get(id);
  if (existing) { existing.show(); existing.focus(); return; }

  // place on monitor where the cursor lives
  const cursor = screen.getCursorScreenPoint();
  const disp   = screen.getDisplayNearestPoint(cursor);

  const win = new BrowserWindow({
    width: 320,
    height: 320,
    x: disp.bounds.x + Math.round(disp.workArea.width  / 3),
    y: disp.bounds.y + Math.round(disp.workArea.height / 3),

    transparent : true,
    frame       : false,
    resizable   : true,
    alwaysOnTop : true,
    skipTaskbar : true,
    hasShadow   : false,
    type        : 'toolbar',

    webPreferences: {
      // IMPORTANT: preload is emitted as CJS at runtime
      preload: path.join(__dirname, '../preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    }
  });

  // Sit above most fullscreen windows on Windows
  if (process.platform === 'win32') {
    win.setAlwaysOnTop(true, 'pop-up-menu');
  }

  // Minimal HTML UI:
  //  - ESC closes
  //  - Hold ALT to drag the overlay (uses -webkit-app-region)
  const html = `
<!doctype html>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src * data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
  html,body{margin:0;background:transparent;overflow:hidden}
  body { -webkit-app-region: no-drag; }
  body.drag { -webkit-app-region: drag; }
  img{width:100%;height:100%;user-select:none;-webkit-user-drag:none; pointer-events:none}
</style>
<script>
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.close();
    if (e.altKey) document.body.classList.add('drag');
  });
  window.addEventListener('keyup',  (e) => {
    if (!e.altKey) document.body.classList.remove('drag');
  });
</script>
<img src="${encodeURI(imgUrl)}" alt="">
`.trim();

  // Data URL keeps it self‑contained
  win.loadURL('data:text/html;base64,' + Buffer.from(html, 'utf8').toString('base64'));

  win.on('closed', () => ACTIVE.delete(id));
  ACTIVE.set(id, win);
}

export function removeAllOverlays() {
  for (const w of ACTIVE.values()) try { w.close(); } catch {}
  ACTIVE.clear();
}
