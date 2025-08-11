import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function log(...args: unknown[]) {
  try {
    const line = `[${new Date().toISOString()}] ${args.map(a => String(a)).join(' ')}\n`;
    const logPath = path.join(app.getPath('userData'), 'icon-desktop.log');
    fs.appendFileSync(logPath, line);
  } catch {
    // ignore file log errors
  }
  // helpful when run via --enable-logging
  // eslint-disable-next-line no-console
  console.log('[main]', ...args);
}

function createMainWindow() {
  const preloadPath = path.join(__dirname, 'preload.cjs');

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    backgroundColor: '#151515',
    autoHideMenuBar: true,
    // show immediately so we never “ghost” in the background
    show: true,
    webPreferences: {
      // ← ensure the same preload is used by the window hosting the web app
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  log('Using preload:', preloadPath);

  const rendererIndex = path.join(__dirname, 'renderer', 'index.html');
  const fileUrl = `file://${rendererIndex.replace(/\\/g, '/')}`;
  log('Loading renderer:', fileUrl);

  mainWindow.loadURL(fileUrl).catch((err) => {
    log('loadURL threw:', err?.stack || String(err));
  });

  // If anything fails to load, show a visible error instead of staying hidden forever.
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    log('did-fail-load', code, desc, url, 'mainFrame?', isMainFrame);
    const html = Buffer.from(`
      <!doctype html>
      <meta charset="utf-8">
      <title>Icon Desktop - Error</title>
      <body style="font: 14px system-ui; padding:24px; background:#111; color:#eee;">
        <h1>Icon Desktop</h1>
        <p>Renderer failed to load.</p>
        <pre style="white-space: pre-wrap; background:#222; padding:12px; border-radius:8px;">
${desc} (${code})
Tried: ${fileUrl}
        </pre>
      </body>
    `);
    mainWindow?.loadURL('data:text/html;base64,' + html.toString('base64'));
  });

  mainWindow.on('ready-to-show', () => {
    log('ready-to-show');
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the user’s browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' }).catch(() => {});
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createMainWindow).catch((e) => log('app.whenReady error', e));

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (mainWindow === null) createMainWindow();
  });
}

// simple IPC demo for preload → renderer
ipcMain.handle('app:getVersion', () => app.getVersion());
