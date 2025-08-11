import { app, BrowserWindow, ipcMain, shell, globalShortcut } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

/* ────────────────────────────────────────────────────────────────────────── */
/* Logging helper                                                             */
/* ────────────────────────────────────────────────────────────────────────── */
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

/* ────────────────────────────────────────────────────────────────────────── */
/* Overlay management                                                         */
/* ────────────────────────────────────────────────────────────────────────── */
const ACTIVE_OVERLAYS = new Map<string, BrowserWindow>();

function overlayDataUrl(imgUrl: string) {
  // Small UI: draggable header (for moving), X close, rotate+scale sliders
  const html = `
<!doctype html>
<meta charset="utf-8">
<style>
  html,body{ margin:0; height:100%; background:transparent; overflow:hidden; }
  body{ user-select:none; }
  #chrome{
    position:absolute; inset:0; pointer-events:none;
  }
  #titlebar{
    position:absolute; left:0; right:0; top:0; height:28px;
    -webkit-app-region: drag;
    background: rgba(0,0,0,0.12);
    border-radius: 8px;
    pointer-events:auto;
  }
  #close{
    position:absolute; right:6px; top:6px;
    width:16px; height:16px; border-radius:10px;
    background:#ff4668; cursor:pointer; -webkit-app-region: no-drag;
    box-shadow: 0 0 0 1px rgba(0,0,0,.2) inset, 0 1px 2px rgba(0,0,0,.25);
  }
  #panel{
    position:absolute; left:8px; bottom:8px;
    display:flex; gap:8px; padding:6px 8px;
    background: rgba(0,0,0,0.25);
    border-radius: 8px;
    font: 12px system-ui;
    color: #fff;
    pointer-events:auto; -webkit-app-region: no-drag;
  }
  #panel label{ display:flex; align-items:center; gap:6px; }
  #panel input[type=range]{ width:120px; }
  #content{
    position:absolute; inset:0; display:grid; place-items:center;
    padding:20px;
  }
  img#sticker{
    max-width:100%; max-height:100%;
    transform-origin:center center;
    image-rendering:auto;
    -webkit-user-drag:none;
  }
</style>
<div id="chrome">
  <div id="titlebar">
    <div id="close" title="Close"></div>
  </div>
  <div id="panel">
    <label>Rotate <input id="rot" type="range" min="-180" max="180" step="1" value="0"></label>
    <label>Scale <input id="sca" type="range" min="10" max="300" step="1" value="100"></label>
  </div>
</div>
<div id="content">
  <img id="sticker" alt="sticker">
</div>
<script>
  const img = document.getElementById('sticker');
  const rot = document.getElementById('rot');
  const sca = document.getElementById('sca');

  img.src = ${JSON.stringify(imgUrl)};

  function apply(){
    const r = parseFloat(rot.value)||0;
    const s = (parseFloat(sca.value)||100)/100;
    img.style.transform = 'rotate(' + r + 'deg) scale(' + s + ')';
  }
  rot.oninput = apply;
  sca.oninput = apply;
  apply();

  // quick shortcuts
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      // ctrl+wheel = scale
      const cur = parseFloat(sca.value)||100;
      sca.value = String(Math.min(300, Math.max(10, cur + (e.deltaY<0? 5 : -5))));
      apply();
      e.preventDefault();
    } else if (e.altKey || e.metaKey) {
      // alt/meta+wheel = rotate
      const cur = parseFloat(rot.value)||0;
      rot.value = String(cur + (e.deltaY<0? 5 : -5));
      apply();
      e.preventDefault();
    }
  }, { passive:false });

  // close
  document.getElementById('close').onclick = () => window.close();
</script>
`;
  return 'data:text/html;base64,' + Buffer.from(html, 'utf8').toString('base64');
}

function createOverlay(id: string, imgUrl: string) {
  // Reveal if we already created it
  const existing = ACTIVE_OVERLAYS.get(id);
  if (existing) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return;
  }

  const win = new BrowserWindow({
    width: 340,
    height: 340,
    minWidth: 160,
    minHeight: 160,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    show: true,
    backgroundColor: '#00000000',
    webPreferences: {
      // NOTE: re-use preload.cjs so overlays inherit any needed bridges later
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Always on top of everything (including most fullscreens)
  if (process.platform === 'win32') {
    // pop-up-menu keeps above most fullscreen windows on Windows
    win.setAlwaysOnTop(true, 'pop-up-menu');
  } else {
    win.setAlwaysOnTop(true, 'screen-saver');
  }
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadURL(overlayDataUrl(imgUrl)).catch(err => log('overlay loadURL error', err?.stack || String(err)));

  win.on('closed', () => {
    ACTIVE_OVERLAYS.delete(id);
  });

  ACTIVE_OVERLAYS.set(id, win);
}

function clearAllOverlays() {
  for (const w of ACTIVE_OVERLAYS.values()) {
    try { w.close(); } catch {}
  }
  ACTIVE_OVERLAYS.clear();
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Main window                                                                */
/* ────────────────────────────────────────────────────────────────────────── */
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
    // NOTE: returns void in Electron typings; no .catch() here
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* App lifecycle + IPC                                                        */
/* ────────────────────────────────────────────────────────────────────────── */
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

  app.whenReady()
    .then(() => {
      // Global shortcut: clear all overlays
      globalShortcut.register('CommandOrControl+Shift+X', clearAllOverlays);
      createMainWindow();
    })
    .catch((e) => log('app.whenReady error', e));

  app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (mainWindow === null) createMainWindow();
  });
}

// simple IPC demo for preload → renderer
ipcMain.handle('app:getVersion', () => app.getVersion());

// overlay control from renderer
ipcMain.handle('overlay:create', (_ev, id: string, url: string) => {
  try { createOverlay(String(id), String(url)); } catch (e) { log('overlay:create failed', e); }
});
ipcMain.handle('overlay:clearAll', () => { try { clearAllOverlays(); } catch (e) { log('overlay:clearAll failed', e); } });
