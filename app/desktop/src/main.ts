import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dist = join(app.getAppPath(), 'dist');
const preload = join(dist, 'preload.js');          // compiled by tsc
const indexHtml = join(dist, 'renderer', 'index.html');

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 700,
    height: 420,
    show: false,
    webPreferences: {
      preload,
      sandbox: false,           // needed for contextBridge
    },
  });

  // On Windows the “\” must be converted to “/” for file:// URLs
  win.loadURL(pathToFileURL(indexHtml).toString());
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
