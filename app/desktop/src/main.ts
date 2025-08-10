import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createOverlay, removeAllOverlays } from './ipc/overlay';
import { getMyStickers } from './ipc/stickers';

function distPath() {
  // inside asar: app.getAppPath() points to ".../resources/app.asar"
  return join(app.getAppPath(), 'dist');
}

async function createMainWindow() {
  const dist = distPath();
  const preload = join(dist, 'preload.cjs');
  const indexHtml = join(dist, 'renderer', 'index.html');

  const win = new BrowserWindow({
    width: 1000,
    height: 680,
    show: false,
    webPreferences: { preload, sandbox: false },
  });

  await win.loadURL(pathToFileURL(indexHtml).toString());
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(createMainWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

/** IPC */
ipcMain.handle('overlay:create', (_e, id: string, url: string) => createOverlay(id, url));
ipcMain.handle('overlay:clearAll', removeAllOverlays);
ipcMain.handle('stickers:list',  (_e, token: string) => getMyStickers(token));
