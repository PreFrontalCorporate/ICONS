// app/desktop/src/main.ts (TS/ESM)
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

function log(...args: unknown[]) {
  try {
    const p = path.join(app.getPath('userData'), 'debug.log');
    const line = `[${new Date().toISOString()}] ${args.map(a =>
      typeof a === 'string' ? a : JSON.stringify(a)
    ).join(' ')}\n`;
    fs.appendFileSync(p, line);
  } catch {}
}

async function createMainWindow() {
  const preload   = path.join(__dirname, 'preload.cjs');
  const indexHtml = path.join(__dirname, 'renderer', 'index.html');

  log('paths', { preload, indexHtml, isPackaged: app.isPackaged });

  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    show: false,              // avoid white flash; we’ll show explicitly
    autoHideMenuBar: true,
    backgroundColor: '#121212',
    // IMPORTANT: keep this visible in taskbar
    skipTaskbar: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // If the renderer fails to load (bad path, etc.), log & show a fallback
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log('did-fail-load', code, desc, url);
    win.loadURL(`data:text/html,<h1>Renderer failed to load</h1><p>${desc}</p>`);
    setTimeout(() => { if (!win.isVisible()) win.show(); }, 50);
  });

  win.webContents.once('did-finish-load', () => {
    log('did-finish-load');
    if (!win.isVisible()) win.show();
    win.focus();
  });

  // Belt-and-suspenders: even if no events fire, show anyway
  setTimeout(() => { if (!win.isVisible()) { log('fallback show'); win.show(); } }, 4000);

  try {
    if (app.isPackaged) {
      await win.loadFile(indexHtml);
    } else {
      const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
      await win.loadURL(devUrl);
    }
  } catch (err) {
    log('load error', err);
    if (!win.isVisible()) win.show();
  }
}

app.whenReady().then(createMainWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
