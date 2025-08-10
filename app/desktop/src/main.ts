// app/desktop/src/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as overlay from './ipc/overlay';
import * as stickers from './ipc/stickers';

const dist = join(app.getAppPath(), 'dist');
const preload = join(dist, 'preload.cjs');     // compiled CJS preload
const indexHtml = join(dist, 'renderer', 'index.html');

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    webPreferences: { preload, sandbox: false },
  });
  win.loadURL(pathToFileURL(indexHtml).toString());
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(createMainWindow);
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());

// IPC: overlays
ipcMain.handle('overlay:create', (_e, id: string, url: string) =>
  overlay.createOverlay(id, url));
ipcMain.handle('overlay:clearAll', overlay.removeAllOverlays);

// IPC: stickers
ipcMain.handle('stickers:login', async (_e, { email, password }) =>
  stickers.login(email, password));
ipcMain.handle('stickers:list', async (_e, token: string) =>
  stickers.getMyStickers(token));
