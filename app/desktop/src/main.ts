// app/desktop/src/main.ts
import { app, BrowserWindow, globalShortcut, ipcMain, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const isDev = !app.isPackaged;

const distDir    = path.join(app.getAppPath(), 'dist');
const preloadCJS = path.join(distDir, 'preload.cjs');
const indexHtml  = path.join(distDir, 'renderer', 'index.html');

function log(...args: unknown[]) {
  try {
    const p = path.join(app.getPath('userData'), 'icon-desktop.log');
    const line =
      `[${new Date().toISOString()}] ` +
      args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') +
      '\n';
    fs.appendFileSync(p, line);
  } catch {}
}

// Force Chromium logging so the PowerShell script captures logs.
// These switches must be added before app.whenReady().
const chromiumLog = path.join(process.env.TEMP || app.getPath('temp'), 'icon-desktop-chromium.log');
app.commandLine.appendSwitch('enable-logging');   // Chromium logging on
app.commandLine.appendSwitch('log-file', chromiumLog); // Absolute path on Windows is required
app.commandLine.appendSwitch('v', '1');           // Verbose level

async function loadOverlay() {
  const url = pathToFileURL(path.join(distDir, 'ipc', 'overlay.js')).href;
  return import(url);
}

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 1024,
    height: 720,
    show: false,
    webPreferences: {
      preload: preloadCJS,
      sandbox: false,
      contextIsolation: true,
    },
  });

  const fileUrl = pathToFileURL(indexHtml).toString();
  win.loadURL(fileUrl).catch(err => log('loadURL error', err?.message || String(err)));

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log('did-fail-load', code, desc, url);
    const html = Buffer.from(`<!doctype html><meta charset="utf-8">
      <title>Icon Desktop - Error</title>
      <body style="font:14px system-ui;padding:24px;background:#111;color:#eee;">
        <h1>Icon Desktop</h1>
        <p>Renderer failed to load.</p>
        <pre style="white-space:pre-wrap;background:#222;padding:12px;border-radius:8px;">${desc} (${code})
Tried: ${fileUrl}</pre>
      </body>`);
    win.loadURL('data:text/html;base64,' + html.toString('base64')).catch(() => {});
  });

  // Open external links in the OS browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => win.show());
}

app.whenReady()
  .then(() => {
    createMainWindow();
    // Global hotkey to clear all overlays
    globalShortcut.register('CommandOrControl+Shift+X', async () => {
      try {
        const overlay = await loadOverlay();
        overlay.removeAllOverlays?.();
      } catch (e) {
        log('removeAllOverlays error', e instanceof Error ? e.message : String(e));
      }
    });
  })
  .catch(e => log('app.whenReady error', e));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ───── IPC ────────────────────────────────────────────── */
ipcMain.handle('overlay:create', async (_e, id: string, url: string) => {
  const m = await loadOverlay();
  return m.createOverlay(id, url);
});
ipcMain.handle('overlay:clearAll', async () => {
  const m = await loadOverlay();
  return m.removeAllOverlays();
});
