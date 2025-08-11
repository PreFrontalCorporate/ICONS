// app/desktop/src/ipc/overlay.ts
import { BrowserWindow, screen, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

type OverlayInfo = {
  id: string;
  win: BrowserWindow;
};

const overlays = new Map<string, OverlayInfo>();

function overlayHtmlWith(src: string, initialScale = 1): string {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <style>
      html, body { margin:0; padding:0; background:transparent; overflow:hidden; }
      body { user-select:none; }
      #wrap {
        position: fixed; inset: 0;
        display: grid; place-items: center;
        pointer-events: none; /* default click-through */
      }
      img {
        max-width: 100vw; max-height: 100vh;
        transform-origin: center center;
        transform: scale(${initialScale});
        pointer-events: auto; /* allow edit mode to capture */
      }
      #hint {
        position: fixed; left: 8px; bottom: 8px; color: #0ff; font: 12px system-ui;
        background: rgba(0,0,0,.4); padding: 6px 8px; border-radius: 6px;
      }
      #hint.hidden { display:none; }
    </style>
  </head>
  <body>
    <div id="wrap"><img id="sticker" src="${src}" draggable="false"/></div>
    <div id="hint" class="hidden">
      <div><b>EDIT MODE</b></div>
      <div>Drag to move • Ctrl+Wheel to scale • Alt to exit edit</div>
    </div>
    <script>
      const { ipcRenderer } = require('electron');
      const sticker = document.getElementById('sticker');
      const hint = document.getElementById('hint');
      let scale = ${initialScale};
      let editing = false;
      let lastPos = null;

      function setEditMode(on) {
        editing = on;
        ipcRenderer.invoke('overlay:set-click-through', !on);
        hint.classList.toggle('hidden', !on);
        document.body.style.cursor = on ? 'move' : 'default';
      }

      window.addEventListener('keydown', (e) => { if (e.key === 'Alt') setEditMode(true); }, true);
      window.addEventListener('keyup',   (e) => { if (e.key === 'Alt') setEditMode(false); }, true);

      // Drag to move when editing
      window.addEventListener('mousedown', (e) => {
        if (!editing) return;
        lastPos = { x: e.screenX, y: e.screenY };
      }, true);
      window.addEventListener('mouseup', () => { lastPos = null; }, true);
      window.addEventListener('mousemove', (e) => {
        if (!editing || !lastPos) return;
        const dx = e.screenX - lastPos.x;
        const dy = e.screenY - lastPos.y;
        lastPos = { x: e.screenX, y: e.screenY };
        ipcRenderer.invoke('overlay:nudge', dx, dy);
      }, true);

      // Ctrl + Wheel to scale
      window.addEventListener('wheel', (e) => {
        if (!editing || !e.ctrlKey) return;
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.95 : 1.05;
        scale = Math.min(6, Math.max(0.2, scale * factor));
        sticker.style.transform = 'scale(' + scale + ')';
      }, { passive: false });
    </script>
  </body>
</html>`;
  return 'data:text/html;base64,' + Buffer.from(html, 'utf8').toString('base64');
}

function newOverlayWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: Math.round(width * 0.3),
    height: Math.round(height * 0.3),
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    movable: true,
    focusable: false, // click-through default
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: true, // used for require('electron') in overlay HTML
    },
  });

  // Default: ignore mouse events (click-through). Toggle via IPC.
  win.setIgnoreMouseEvents(true, { forward: true }); // forwards mouse move events
  win.setAlwaysOnTop(true, 'screen-saver');
  return win;
}

export async function createOverlay(id: string, stickerUrl: string) {
  const existing = overlays.get(id)?.win;
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }
  const win = newOverlayWindow();
  overlays.set(id, { id, win });

  // Strongly typed IPC handlers to avoid implicit-any errors
  ipcMain.handleOnce('overlay:set-click-through', (_e: IpcMainInvokeEvent, on: boolean) => {
    try { win.setIgnoreMouseEvents(on, { forward: true }); } catch {}
  });
  ipcMain.handle('overlay:nudge', (_e: IpcMainInvokeEvent, dx: number, dy: number) => {
    try {
      const [x, y] = win.getPosition();
      win.setPosition(x + Math.round(dx), y + Math.round(dy));
    } catch {}
  });

  await win.loadURL(overlayHtmlWith(stickerUrl, 1));
}

export function removeAllOverlays() {
  for (const { win } of overlays.values()) {
    try { win.close(); } catch {}
  }
  overlays.clear();
}
