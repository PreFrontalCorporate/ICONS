// app/desktop/src/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Paths into the packaged app
const distDir    = join(app.getAppPath(), 'dist');
const preloadCJS = join(distDir, 'preload.cjs');
const indexHtml  = join(distDir, 'renderer', 'index.html'); // local “token” UI fallback

// Honour CLI logging flags and also assert in-process logging so packaged builds always log
function configureLogging() {
  // If caller passed --log-file, forward to Chromium as a switch.
  const logFileArg = process.argv.find(a => a.startsWith('--log-file='));
  if (logFileArg) {
    const filePath = logFileArg.split('=')[1];
    if (filePath) app.commandLine.appendSwitch('log-file', filePath);
  }
  // Force Chromium logging when requested
  if (process.argv.includes('--enable-logging')) {
    // value "file" is recognized by Chromium for writing to file (when --log-file is set)
    app.commandLine.appendSwitch('enable-logging', 'file');
  }
}

async function loadOverlay() {
  const overlayUrl = pathToFileURL(join(distDir, 'ipc', 'overlay.js')).href;
  return import(overlayUrl);
}

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 900,
    height: 640,
    show: false,
    // Persist a named session partition so cookies/auth persist across restarts
    webPreferences: {
      preload: preloadCJS,
      sandbox: false,
      partition: 'persist:icon', // persistent Chromium profile for the app
    },
  });

  // Prefer loading the hosted Library directly so its cookie is first‑party.
  // If you want to keep the iframe-based shell, keep windows/library.html instead,
  // but with SameSite=None cookies (fixed above) that will also work.
  const LIBRARY_URL = 'https://icon-web-two.vercel.app/library';

  win.loadURL(LIBRARY_URL).catch(() => {
    // offline fallback: show local token UI
    win.loadURL(pathToFileURL(indexHtml).toString());
  });

  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
  configureLogging();
  createMainWindow();

  // IPC overlay controls (lazy import keeps main bundle lean)
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
