// app/desktop/src/main.ts
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu } from 'electron';
import path from 'node:path';
import * as overlay from './ipc/overlay';
import { getMyStickers } from './ipc/stickers';

let mainWin: BrowserWindow;

function buildMenu() {
  return Menu.buildFromTemplate([
    { role: 'fileMenu', submenu: [
      { label: 'Clear all stickers', accelerator: 'Ctrl+Shift+X', click: overlay.removeAllOverlays },
      { type: 'separator' }, { role: 'quit' }
    ]}
  ]);
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      // IMPORTANT: compiled preload is CommonJS
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false
    }
  });

  mainWin.setMenu(buildMenu());
  // Vite output goes to dist/renderer/index.html
  mainWin.loadFile(path.join(__dirname, 'renderer/index.html'));

  if (app.getVersion().endsWith('.0')) {
    dialog.showMessageBox(mainWin, {
      type: 'info',
      title: 'icon',
      message: 'Tip:  Ctrl + Shift + X removes all stickers.\nESC closes a focused overlay.'
    });
  }
}

app.whenReady().then(() => {
  createMainWindow();
  globalShortcut.register('CommandOrControl+Shift+X', overlay.removeAllOverlays);
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());

/* IPC: overlay + remote stickers */
ipcMain.handle('overlay:create', (_e, id: string, url: string) => overlay.createOverlay(id, url));
ipcMain.handle('overlay:clearAll', overlay.removeAllOverlays);
ipcMain.handle('stickers:getMine', async (_e, token: string) => getMyStickers(token));
