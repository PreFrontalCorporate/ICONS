import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import * as overlay from './ipc/overlay';
import * as stickers from './ipc/stickers';

let win: BrowserWindow | null = null;

function createMainWindow() {
  win = new BrowserWindow({
    width: 940,
    height: 740,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
    }
  });
  win.loadFile('windows/library.html');
}

app.whenReady().then(createMainWindow);
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());

/* IPC wires -------------------------------------------------- */
ipcMain.handle('overlay:create', (_e, id, url) => overlay.createOverlay(id, url));
ipcMain.handle('overlay:clearAll',              overlay.removeAllOverlays);
ipcMain.handle('stickers:get',                  stickers.getMyStickers);
ipcMain.handle('stickers:watch', async (_e,email)=>stickers.startRealtime(email));
