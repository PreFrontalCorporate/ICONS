// app/desktop/src/main.ts
import { app, BrowserWindow, globalShortcut, ipcMain, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Hosted Login/Library — first-party cookies
const LIBRARY_URL = process.env.ICON_LIBRARY_URL || 'https://icon-web-two.vercel.app/';

const distDir    = path.join(app.getAppPath(), 'dist');
const preloadCJS = path.join(distDir, 'preload.cjs');
const indexHtml  = path.join(distDir, 'renderer', 'index.html');

function log(...args: unknown[]) {
  try {
    const p = path.join(app.getPath('userData'), 'icon-desktop.log');
    const line = `[${new Date().toISOString()}] ` + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n';
    fs.appendFileSync(p, line);
  } catch {}
}

// Chromium logging to file (must be set before 'ready')
const chromiumLog = path.join(process.env.TEMP || app.getPath('temp'), 'icon-desktop-chromium.log');
app.commandLine.appendSwitch('enable-logging');
app.commandLine.appendSwitch('log-file', chromiumLog);
app.commandLine.appendSwitch('v', '1');

// Deep links: allow icon:// links launched from the Library
app.setAsDefaultProtocolClient?.('icon'); // handled via setWindowOpenHandler below

async function loadOverlay() {
  const url = pathToFileURL(path.join(distDir, 'ipc', 'overlay.js')).href;
  return import(url);
}

function handleOverlayLink(u: string) {
  try {
    const url = new URL(u);
    if (url.protocol !== 'icon:') return false;
    if (url.hostname !== 'overlay') return false; // icon://overlay?src=...
    const src = url.searchParams.get('src');
    if (!src) return true; // consume without action
    const id = url.searchParams.get('id') || `overlay-${Date.now()}`;
    ipcMain.emit('overlay:create-link', null, id, src);
    return true;
  } catch {
    return false;
  }
}

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 1024,
    height: 720,
    show: false,
    webPreferences: {
      preload: preloadCJS,
      contextIsolation: true,
      sandbox: false,
      // Persist cookies/storage so login survives restarts (Electron session docs).
      partition: 'persist:icon'
    },
  });

  // Open external links in OS browser; intercept icon://overlay to create overlays
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (handleOverlayLink(url)) return { action: 'deny' };
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  // Also intercept in-page navigations (target=_self etc.)
  win.webContents.on('will-navigate', (e, url) => {
    if (handleOverlayLink(url)) e.preventDefault();
  });

  // Load hosted app first; fallback to local if it fails
  win.loadURL(LIBRARY_URL).catch(err => {
    log('loadURL hosted failed', err?.message || String(err));
    const fileUrl = pathToFileURL(indexHtml).toString();
    win.loadURL(fileUrl).catch(e => log('loadURL local failed', e?.message || String(e)));
  });

  win.webContents.on('did-fail-load', (_e, code, desc, urlTried) => {
    log('did-fail-load', code, desc, urlTried);
    const fallback = pathToFileURL(indexHtml).toString();
    win.loadURL(fallback).catch(() => {});
  });

  win.once('ready-to-show', () => win.show());
}

app.whenReady()
  .then(() => {
    createMainWindow();

    // Overlay IPC — also listen to synthetic event from handleOverlayLink()
    ipcMain.handle('overlay:create', async (_e, id: string, url: string) => {
      const m = await loadOverlay();
      return m.createOverlay(id, url);
    });
    ipcMain.handle('overlay:clearAll', async () => {
      const m = await loadOverlay();
      return m.removeAllOverlays();
    });
    ipcMain.on('overlay:create-link', async (_e, id: string, url: string) => {
      const m = await loadOverlay();
      return m.createOverlay(id, url);
    });

    // Global shortcut: clear overlays quickly
    globalShortcut.register('CommandOrControl+Shift+X', async () => {
      try {
        const m = await loadOverlay();
        m.removeAllOverlays?.();
      } catch (e) {
        log('removeAllOverlays error', e instanceof Error ? e.message : String(e));
      }
    });
  })
  .catch(e => log('app.whenReady error', e));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
