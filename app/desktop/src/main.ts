import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import * as path from 'node:path';
import { registerOverlayIpc, overlayManager } from './ipc/overlay';

// Create the Library window
async function createWindow() {
  const appPath = app.getAppPath(); // works for dev and packaged
  const preload = path.join(appPath, 'dist', 'preload.cjs');
  const libraryHtml = path.join(appPath, 'windows', 'library.html');

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load our local HTML (which points to /library) and show
  await win.loadFile(libraryHtml);
  win.once('ready-to-show', () => win.show());

  // App menu: Clear overlays + toggle panel
  const menu = Menu.buildFromTemplate([
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Overlay Panel',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => win.webContents.send('overlay:panel/toggle'),
        },
        {
          label: 'Clear All Overlays',
          accelerator: 'CmdOrCtrl+Shift+Backspace',
          click: () => overlayManager.clearAll(),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

app.on('ready', async () => {
  registerOverlayIpc(ipcMain);
  await createWindow();
});

app.on('window-all-closed', () => {
  // Quit on all platforms for now
  app.quit();
});
