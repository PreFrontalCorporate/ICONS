import { app, BrowserWindow, screen, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { verifyPurchase } from './verify';

let win: BrowserWindow;
app.whenReady().then(() => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width,
    height,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: { preload: `${__dirname}/preload.js` }
  });
  win.setIgnoreMouseEvents(true); // pure overlay
  win.loadFile('index.html');
  autoUpdater.checkForUpdatesAndNotify();
});

ipcMain.handle('verify', (_, token) => verifyPurchase(token));
