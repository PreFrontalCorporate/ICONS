// app/desktop/src/main.ts
import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist     = join(app.getAppPath(), 'dist');
const preload  = join(dist, 'preload.cjs');            // ⟵ change
const indexHtml= join(dist, 'renderer', 'index.html');

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 700,
    height: 420,
    show: false,
    webPreferences: { preload, sandbox: false },
  });
  win.loadURL(pathToFileURL(indexHtml).toString());
  win.once('ready-to-show', () => win.show());
}
app.whenReady().then(createMainWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
