import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as overlay from './ipc/overlay.js';
import { listMyStickers } from './ipc/stickers.js';

// Paths inside the packaged app (asar) and during dev are different.
// We always point at dist/, then pick whichever preload exists.
const distDir = path.join(app.getAppPath(), 'dist');
const preloadCandidates = [
  path.join(distDir, 'preload.cjs'),
  path.join(distDir, 'preload.js'),
];
const preload = preloadCandidates.find(p => {
  try { return fs.existsSync(p); } catch { return false; }
}) ?? preloadCandidates[0];

const indexHtml = path.join(distDir, 'renderer', 'index.html');

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 960,
    height: 640,
    show: true,                              // <— show immediately (no hidden window)
    webPreferences: {
      preload,
      sandbox: false,                        // needed for contextBridge
    },
  });

  // Helpful diagnostics if anything fails to load
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('Renderer failed to load:', code, desc, url);
    win.loadURL(`data:text/plain,Failed to load UI (${code}): ${desc}`);
  });

  win.loadURL(pathToFileURL(indexHtml).toString());
  return win;
}

app.whenReady().then(() => {
  createMainWindow();
  // Global hotkey to clear all stickers
  globalShortcut.register('CommandOrControl+Shift+X', () => overlay.removeAllOverlays());
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

/* ───── IPC ────────────────────────────────────────────── */
ipcMain.handle('stickers:list', async (_e, token: string) => {
  try { return await listMyStickers(token); }
  catch (err) { console.error('stickers:list error', err); return []; }
});
ipcMain.handle('overlay:create', (_e, id: string, url: string) => overlay.createOverlay(id, url));
ipcMain.handle('overlay:clearAll', () => overlay.removeAllOverlays());
