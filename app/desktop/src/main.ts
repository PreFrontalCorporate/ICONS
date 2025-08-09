import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const distDir    = join(app.getAppPath(), 'dist');
const preloadCJS = join(distDir, 'preload.cjs');                 // <- packaged name
const indexHtml  = join(distDir, 'renderer', 'index.html');

// Lazy-load overlay helpers from dist/ipc/overlay.js (ESM needs the extension)
async function loadOverlay() {
  const overlayUrl = pathToFileURL(join(distDir, 'ipc', 'overlay.js')).href;
  return import(overlayUrl);
}

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 700,
    height: 420,
    show: false,
    webPreferences: {
      preload: preloadCJS,
      sandbox: false, // needed for contextBridge
    },
  });

  win.loadURL(pathToFileURL(indexHtml).toString());
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
  createMainWindow();

  // IPC: overlay controls (resolved at call time so we don't hard-import modules)
  ipcMain.handle('overlay:create', async (_e, id: string, url: string) => {
    const mod = await loadOverlay();
    return mod.createOverlay(id, url);
  });

  ipcMain.handle('overlay:clearAll', async () => {
    const mod = await loadOverlay();
    return mod.removeAllOverlays();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
