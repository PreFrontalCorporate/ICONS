// app/desktop/src/main.ts
import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';

const here = fileURLToPath(new URL('.', import.meta.url));
let mainWindow: BrowserWindow | null = null;

let appLogPath = '';
function log(...args: any[]) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  try { if (appLogPath) appendFileSync(appLogPath, line); } catch {}
  // keep console logging for --enable-logging
  // eslint-disable-next-line no-console
  console.log(line.trim());
}

function resolveResource(...parts: string[]) {
  // When packaged, resources live under process.resourcesPath/app.asar
  // Otherwise, we’re running from dist next to this file.
  const base = app.isPackaged
    ? join(process.resourcesPath, 'app.asar')  // docs: process.resourcesPath
    : here;
  return join(base, ...parts);
}

async function createWindow() {
  const preload = resolveResource('dist', 'preload.cjs');
  const libraryHtml = resolveResource('windows', 'library.html');
  const fallbackHtml = resolveResource('dist', 'renderer', 'index.html');

  log('appPath', resolveResource());
  log('preload', preload, 'exists?', String(existsSync(preload)));
  log('libraryHtml', libraryHtml, 'exists?', String(existsSync(libraryHtml)));
  log('fallbackHtml', fallbackHtml, 'exists?', String(existsSync(fallbackHtml)));

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    show: true, // show immediately (avoid “background only”)
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    // Recommended by Electron—show gracefully once painted
    // (we already set show:true, but this helps if it was hidden)
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      log('ready-to-show → show()');
    }
  });

  // Hard fallback in case ready-to-show never fires in some edge case
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
      log('force show fallback after timeout');
    }
  }, 1500);

  mainWindow.webContents.on('did-finish-load', () => log('did-finish-load'));
  mainWindow.on('unresponsive', () => log('renderer unresponsive'));

  try {
    if (!existsSync(libraryHtml)) throw new Error('library.html not found');
    await mainWindow.loadFile(libraryHtml); // docs: BrowserWindow.loadFile
    log('loaded library.html');
  } catch (err: any) {
    log('loadFile(libraryHtml) failed:', err?.message ?? String(err));
    if (existsSync(fallbackHtml)) {
      await mainWindow.loadFile(fallbackHtml);
      log('loaded fallback renderer/index.html');
    } else {
      mainWindow.loadURL('about:blank');
      log('loaded about:blank (no html available)');
    }
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

function setupSingleInstance() {
  // Ensure one instance; focus existing window when re-launched
  // (docs: app.requestSingleInstanceLock)
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      log('second-instance → focused existing window');
    }
  });
}

app.whenReady().then(() => {
  // prepare log path now that app is ready
  const userData = app.getPath('userData');
  try { mkdirSync(userData, { recursive: true }); } catch {}
  appLogPath = join(userData, 'icon-desktop.log');
  log('userData', userData);

  setupSingleInstance();
  createWindow();
});

app.on('window-all-closed', () => {
  // Quit on Windows/Linux; keep running on macOS
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
