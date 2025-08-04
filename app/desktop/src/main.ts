// app/desktop/src/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'node:path';

export const createWindow = async (): Promise<void> => {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'src', 'preload.js'),
      contextIsolation: true,
    },
  });

  await win.loadFile(path.join(app.getAppPath(), 'dist', 'renderer', 'index.html'));
};

// Windows installer quirks – single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

export {}; // ← marks file as an ES module (fixes “top‑level await” error)
