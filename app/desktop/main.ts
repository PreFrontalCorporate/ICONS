import { app, BrowserWindow, globalShortcut, ipcMain, Menu, dialog, screen } from 'electron';
import path from 'node:path';
import * as overlay from './ipc/overlay';

let mainWin: BrowserWindow;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1024, height: 720, minWidth: 800, minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    }
  });
  mainWin.setMenu(buildMenu());
  mainWin.loadFile(path.join(__dirname, '../windows/library.html'));

  // show onboarding once
  if (app.getVersion().endsWith('.0')) {
    dialog.showMessageBox(mainWin, {
      type: 'info',
      title: 'icon',
      message: 'Tip:  Ctrl + Shift + X removes all stickers.\nESC closes a focused overlay.',
    });
  }
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { role: 'fileMenu', submenu: [
        { label:'Clear all stickers', accelerator:'Ctrl+Shift+X', click: overlay.removeAllOverlays },
        { type:'separator' }, { role:'quit' }
      ]}
  ]);
}

app.whenReady().then(() => {
  createMainWindow();
  globalShortcut.register('CommandOrControl+Shift+X', overlay.removeAllOverlays);
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());

/* ───── IPC ────────────────────────────────────────────── */
ipcMain.handle('overlay:create', (_e,id,url) => overlay.createOverlay(id,url));
ipcMain.handle('overlay:clearAll', overlay.removeAllOverlays);
