import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { registerIpc } from './main/ipc';
import { buildMenu } from './main/menu';

let win: BrowserWindow | null = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Icon Desktop',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const url = new URL('./renderer/index.html', `file://${__dirname}/`).toString();
  win.loadURL(url);
  win.once('ready-to-show', () => win?.show());

  registerIpc(win);
  buildMenu(win);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
