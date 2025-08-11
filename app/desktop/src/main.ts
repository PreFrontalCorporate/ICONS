// --- Add near top-level (after other imports)
let mainWindow: BrowserWindow | null = null;

// Keep your existing createMainWindow but store the ref:
function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 1024,
    height: 720,
    show: false,
    webPreferences: {
      preload: preloadCJS,
      contextIsolation: true,
      sandbox: false,
      partition: 'persist:icon',
    },
  });

  mainWindow = win;

  // Intercept new windows; handle icon://overlay links
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (handleOverlayLink(url)) return { action: 'deny' };
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (e, url) => {
    if (handleOverlayLink(url)) e.preventDefault();
  });

  // (Optional) Strictly allow overlay links only when coming from trusted origins:
  win.webContents.on('will-navigate', (e, url) => {
    try {
      const src = new URL(url);
      const isTrusted =
        src.origin === new URL(LIBRARY_URL).origin ||
        src.protocol === 'file:';
      if (!isTrusted && src.protocol === 'icon:') {
        e.preventDefault();
        return;
      }
    } catch {}
  });

  // Load hosted first; fallback to local
  win.loadURL(LIBRARY_URL).catch(err => {
    log('loadURL hosted failed', err?.message || String(err));
    const fileUrl = pathToFileURL(indexHtml).toString(); // adjust if using windows/library.html
    win.loadURL(fileUrl).catch(e => log('loadURL local failed', e?.message || String(e)));
  });

  win.webContents.on('did-fail-load', (_e, code, desc, tried) => {
    log('did-fail-load', code, desc, tried);
    const fallback = pathToFileURL(indexHtml).toString();
    win.loadURL(fallback).catch(() => {});
  });

  win.once('ready-to-show', () => win.show());
}

// --- Deep link handling (OS-level) ---
function handleArgvDeepLink(raw: string | undefined) {
  if (!raw) return;
  // On Windows/Linux argv includes protocol URL; on macOS we use open-url
  if (!handleOverlayLink(raw)) {
    // No-op if not an overlay deep link
  }
}

app.whenReady().then(() => {
  createMainWindow();

  // macOS: icon:// links when app is running
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleArgvDeepLink(url);
  });

  // Windows/Linux: ensure single instance and pick up the URL from second instance
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  app.on('second-instance', (_e, argv) => {
    // Typical format: myapp.exe -- something "icon://overlay?src=..."
    const maybeUrl = argv.find(a => typeof a === 'string' && a.startsWith('icon://'));
    handleArgvDeepLink(maybeUrl);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Existing IPC handlers...
  ipcMain.handle('overlay:create', async (_e, id: string, url: string) => {
    const m = await loadOverlay();
    return m.createOverlay(id, url);
  });
  ipcMain.handle('overlay:clearAll', async () => {
    const m = await loadOverlay();
    return m.removeAllOverlays();
  });
  ipcMain.on('overlay:create-link', async (_e, id: string, url: string) => {
    const m = await loadOverlay();
    return m.createOverlay(id, url);
  });

  // Global shortcut: clear overlays quickly
  globalShortcut.register('CommandOrControl+Shift+X', async () => {
    try {
      const m = await loadOverlay();
      m.removeAllOverlays?.();
    } catch (e) {
      log('removeAllOverlays error', e instanceof Error ? e.message : String(e));
    }
  });
}).catch(e => log('app.whenReady error', e));

// Clean up shortcuts on quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
