// app/desktop/src/main.ts
import { app, BrowserWindow, globalShortcut, ipcMain, Menu, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PARTITION = 'persist:icon-desktop';
const LIBRARY_URL = 'https://icon-web-two.vercel.app/library?client=desktop';

function distPath(...parts: string[]) {
  return path.join(app.getAppPath(), 'dist', ...parts);
}
function asFileUrl(p: string) {
  return pathToFileURL(p).toString();
}
function overlayModuleUrl() {
  // explicit .js so Node’s ESM resolver finds it inside asar
  return asFileUrl(distPath('ipc', 'overlay.js'));
}
async function withOverlay<T>(fn: (overlay: any) => T | Promise<T>) {
  const mod = await import(overlayModuleUrl());
  return fn(mod);
}

async function createMainWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 880,
    minHeight: 600,
    show: false,
    webPreferences: {
      // use a persistent partition instead of grabbing Session at the top-level
      partition: PARTITION,
      preload: distPath('preload.cjs'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Load hosted app as top‑level (first‑party cookies)
  await win.loadURL(LIBRARY_URL);
  win.once('ready-to-show', () => win.show());

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Clear all stickers',
          accelerator: 'Ctrl+Shift+X',
          click: () => withOverlay(o => o.removeAllOverlays()),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
  ]);
  win.setMenu(menu);

  // Handy global shortcut too
  globalShortcut.register('CommandOrControl+Shift+X', () =>
    withOverlay(o => o.removeAllOverlays()),
  );
}

app.whenReady().then(async () => {
  // IMPORTANT: only touch Session after the app is ready
  const ses = session.fromPartition(PARTITION);

  // Belt & suspenders: if our API ever forgets SameSite=None; Secure, fix it here.
  ses.webRequest.onHeadersReceived(
    { urls: ['https://icon-web-two.vercel.app/*'] },
    (details, cb) => {
      const headers = details.responseHeaders ?? {};
      const setCookie = headers['Set-Cookie'] || headers['set-cookie'];
      if (Array.isArray(setCookie) && setCookie.length) {
        const rewritten = setCookie.map(v =>
          v
            .replace(/;\s*SameSite=(Lax|Strict)/i, '')
            .replace(/;\s*Secure/i, '') + '; SameSite=None; Secure; Path=/'
        );
        headers['Set-Cookie'] = rewritten;
      }
      cb({ responseHeaders: headers });
    }
  );

  await createMainWindow();

  // IPC to overlay module (lazy ESM import)
  ipcMain.handle('overlay:create', (_e, id: string, url: string) =>
    withOverlay(o => o.createOverlay(id, url)),
  );
  ipcMain.handle('overlay:clearAll', () =>
    withOverlay(o => o.removeAllOverlays()),
  );
});

app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch {}
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
