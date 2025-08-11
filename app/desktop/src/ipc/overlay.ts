// app/desktop/src/ipc/overlay.ts
import { BrowserWindow, screen } from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const overlays = new Map<string, BrowserWindow>();

export async function createOverlay(id: string, urlOrIconLink: string) {
  // Accept either a raw src (http/https/data) or an icon://overlay?src=...
  let src = urlOrIconLink;
  try {
    const u = new URL(urlOrIconLink);
    if (u.protocol === 'icon:' && u.hostname === 'overlay') {
      src = u.searchParams.get('src') || '';
    }
  } catch {}

  if (!src) return;

  // Make a frameless, transparent window sized to image after load
  const display = screen.getPrimaryDisplay();
  const w = Math.round(display.workArea.width * 0.35);

  // Load our tiny HTML that renders the image full-bleed
  const html = `
    <!doctype html><meta charset="utf-8">
    <style>
      html,body{margin:0;background:transparent;overflow:hidden}
      img{display:block;max-width:100vw;max-height:100vh}
    </style>
    <img id="img" src="${src}"/>
    <script>
      const img = document.getElementById('img');
      img.addEventListener('load', () => {
        const { width, height } = img.getBoundingClientRect();
        window.electron?.fit?.(Math.ceil(width), Math.ceil(height));
      });
    </script>
  `;
  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);

  const win = new BrowserWindow({
    width: w,
    height: Math.round(w * 0.75),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    fullscreenable: false,
    resizable: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
    },
  });

  // Helper from the main process to fit to image size
  // (simple: postMessage from overlay page; here we just use a custom URL)
  win.webContents.on('ipc-message', (_e, channel, ...args) => {
    if (channel === 'fit') {
      const [w, h] = args as number[];
      if (Number.isFinite(w) && Number.isFinite(h)) win.setSize(w, h, true);
    }
  });

  overlays.set(id, win);
  win.on('closed', () => overlays.delete(id));
  await win.loadURL(dataUrl);
  win.showInactive();
}

export function removeAllOverlays() {
  for (const w of overlays.values()) {
    try { w.close(); } catch {}
  }
  overlays.clear();
}
