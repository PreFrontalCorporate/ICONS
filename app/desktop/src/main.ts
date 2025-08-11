// app/desktop/src/main.ts
import { app, BrowserWindow, dialog } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = join(app.getAppPath(), 'dist');
const indexHtml = join(dist, 'renderer', 'index.html');
const preload   = join(dist, 'preload.cjs');   // ← was .js, packaged file is .cjs

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 720,
    show: false,
    webPreferences: {
      preload,
      sandbox: false,        // needed for contextBridge
    },
  });

  const url = pathToFileURL(indexHtml).toString();
  win.loadURL(url);

  // show the window reliably even if ready-to-show never fires
  const maybeShow = () => {
    if (!win.isDestroyed() && !win.isVisible()) win.show();
  };

  win.once('ready-to-show', maybeShow);
  win.webContents.once('did-finish-load', maybeShow);
  setTimeout(maybeShow, 1500); // fallback, belt & suspenders

  // diagnostics if something goes sideways
  win.webContents.on('did-fail-load', (_e, code, desc, failingUrl) => {
    console.error('did-fail-load', code, desc, failingUrl);
    dialog.showErrorBox('Icon Desktop', `Failed to load UI (${code}) ${desc}`);
    maybeShow();
  });

  if (process.env.ICON_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(createMainWindow);
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
