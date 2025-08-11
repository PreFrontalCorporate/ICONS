// app/desktop/src/main.ts
import { app, BrowserWindow, globalShortcut, ipcMain, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Hosted Login/Library first (first‑party cookies). Fallback to local if offline.
const LIBRARY_URL = process.env.ICON_LIBRARY_URL || 'https://icon-web-two.vercel.app/library';

const distDir    = path.join(app.getAppPath(), 'dist');
const preloadCJS = path.join(distDir, 'preload.cjs');
const indexHtml  = path.join(distDir, 'renderer', 'index.html');

function log(...args: unknown[]) {
  try {
    const p = path.join(app.getPath('userData'), 'icon-desktop.log');
    const line =
      `[${new Date().toISOString()}] ` +
      args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') +
      '\n';
    fs.appendFileSync(p, line);
  } catch { /* ignore */ }
}

// Chromium logging (must be before 'ready')
const chromiumLog = path.join(process.env.TEMP || app.getPath('temp'), 'icon-desktop-chromium.log');
app.commandLine.appendSwitch('enable-logging');
app.commandLine.appendSwitch('log-file', chromiumLog);
app.commandLine.appendSwitch('v', '1');

// Register custom protocol (production installers)
app.setAsDefaultProtocolClient?.('icon');

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
    if (!src) return true;
    const id = url.searchParams.get('id') || `overlay-${Date.now()}`;
    ipcMain.emit('overlay:create-link', {} as unknown as Electron.IpcMainEvent, id, src);
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
      // Persist cookies/storage on disk (Electron sessions)
      partition: 'persist:icon',
    },
  });

  // Intercept new windows; handle icon://overlay links
  win.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    if (handleOverlayLink(url)) return { action: 'deny' };
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  // Also intercept in‑page navigations
  win.webContents.on('will-navigate', (e: Electron.Event, url: string) => {
    if (handleOverlayLink(url)) e.preventDefault();
  });

  // Prevent cross‑origin nav inside the window
  win.webContents.on('will-navigate', (e: Electron.Event, url: string) => {
    try {
      const src = new URL(url);
      if (
        src.origin !== new URL(LIBRARY_URL).origin &&
        src.protocol !== 'icon:'
      ) {
        e.preventDefault();
        shell.openExternal(url).catch(() => {});
      }
    } catch {
      /* ignore bad URLs */
    }
  });

  // Load hosted app first; fallback to local if it fails
  win.loadURL(LIBRARY_URL).catch((err: unknown) => {
    log('loadURL hosted failed', err instanceof Error ? err.message : String(err));
    const fileUrl = pathToFileURL(indexHtml).toString();
    win.loadURL(fileUrl).catch((e: unknown) =>
      log('loadURL local failed', e instanceof Error ? e.message : String(e))
    );
  });

  win.webContents.on('did-fail-load', (_e: Electron.Event, code: number, desc: string, tried: string) => {
    log('did-fail-load', code, desc, tried);
    const fallback = pathToFileURL(indexHtml).toString();
    win.loadURL(fallback).catch(() => {});
  });

  win.once('ready-to-show', () => win.show());
}

app.whenReady()
  .then(() => {
    createMainWindow();

    ipcMain.handle('overlay:create', async (_e: Electron.IpcMainInvokeEvent, id: string, url: string) => {
      const m = await loadOverlay();
      return m.createOverlay(id, url);
    });

    ipcMain.handle('overlay:clearAll', async () => {
      const m = await loadOverlay();
      return m.removeAllOverlays();
    });

    ipcMain.on('overlay:create-link', async (_e: Electron.IpcMainEvent, id: string, url: string) => {
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
  .catch(e => log('app.whenReady error', e instanceof Error ? e.message : String(e)));

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// macOS: deep links when app is running
app.on('open-url', (event: Electron.Event, url: string) => {
  event.preventDefault();
  handleOverlayLink(url);
});

// Single instance + Windows deep link handling
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e: Electron.Event, argv: string[]) => {
    const maybeUrl = argv.find(a => typeof a === 'string' && a.startsWith('icon://'));
    if (maybeUrl) handleOverlayLink(maybeUrl);
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
