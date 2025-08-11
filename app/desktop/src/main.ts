// app/desktop/src/main.ts
import { app, BrowserWindow, globalShortcut, ipcMain, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Load the hosted Login/Library first so auth cookies are FIRST-PARTY.
 * Fallback to local HTML if offline.
 */
const LIBRARY_URL = process.env.ICON_LIBRARY_URL || 'https://icon-web-two.vercel.app/';

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
  } catch {}
}

/** Chromium logging to file (works in packaged apps).
 * Must be set before app.whenReady(). Docs: app.commandLine.appendSwitch(...)
 */
const chromiumLog = path.join(process.env.TEMP || app.getPath('temp'), 'icon-desktop-chromium.log');
app.commandLine.appendSwitch('enable-logging');        // chromium logging on
app.commandLine.appendSwitch('log-file', chromiumLog); // write to this file
app.commandLine.appendSwitch('v', '1');                // verbosity

async function loadOverlay() {
  const url = pathToFileURL(path.join(distDir, 'ipc', 'overlay.js')).href;
  return import(url);
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
      // Persist cookies/storage for the web app so login survives restarts.
      // Electron docs: partitions beginning with "persist:" are on-disk.
      partition: 'persist:icon'
    },
  });

  // Load hosted Login/Library (first-party cookie flow)
  win.loadURL(LIBRARY_URL).catch(err => {
    log('loadURL hosted failed', err?.message || String(err));
    // Fallback to local placeholder if offline
    const fileUrl = pathToFileURL(indexHtml).toString();
    win.loadURL(fileUrl).catch(e => log('loadURL local failed', e?.message || String(e)));
  });

  win.webContents.on('did-fail-load', (_e, code, desc, urlTried) => {
    log('did-fail-load', code, desc, urlTried);
    const fallback = pathToFileURL(indexHtml).toString();
    win.loadURL(fallback).catch(() => {});
  });

  // Open external links in the OS browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => win.show());
}

app.whenReady()
  .then(() => {
    createMainWindow();
    // Global hotkey to clear overlays fast
    globalShortcut.register('CommandOrControl+Shift+X', async () => {
      try {
        const overlay = await loadOverlay();
        overlay.removeAllOverlays?.();
      } catch (e) {
        log('removeAllOverlays error', e instanceof Error ? e.message : String(e));
      }
    });
  })
  .catch(e => log('app.whenReady error', e));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ───── IPC for overlays ─────────────────────────────── */
ipcMain.handle('overlay:create', async (_e, id: string, url: string) => {
  const m = await loadOverlay();
  return m.createOverlay(id, url);
});
ipcMain.handle('overlay:clearAll', async () => {
  const m = await loadOverlay();
  return m.removeAllOverlays();
});
