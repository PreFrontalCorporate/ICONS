// app/desktop/src/main.ts
import { app, BrowserWindow, Menu, globalShortcut, ipcMain, session } from 'electron';
import path from 'node:path';
import * as overlay from './ipc/overlay';

let mainWin: BrowserWindow;

function forceThirdPartyCookies() {
  const filter = { urls: ['https://*.vercel.app/*', 'https://*.icon.cool/*', 'https://icon-web-two.vercel.app/*'] };

  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const headers = details.responseHeaders ?? {};
    // find the canonical Set-Cookie key regardless of case
    const key = Object.keys(headers).find(k => k.toLowerCase() === 'set-cookie');

    if (key && Array.isArray(headers[key])) {
      // rewrite each Set-Cookie value
      const rewritten = headers[key]!.map(v => {
        let s = v;

        // strip any existing SameSite=Lax/Strict so we can append None cleanly
        s = s.replace(/;\s*SameSite=(Lax|Strict)/i, '');

        // ensure SameSite=None and Secure
        if (!/;\s*SameSite=/i.test(s)) s += '; SameSite=None';
        if (!/;\s*Secure/i.test(s))    s += '; Secure';

        // be explicit
        if (!/;\s*Path=/i.test(s))     s += '; Path=/';
        return s;
      });

      headers[key] = rewritten;
      headers['Set-Cookie'] = rewritten; // normalize case for safety
    }

    callback({ responseHeaders: headers });
  });
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { role: 'fileMenu', submenu: [
        { label:'Clear all stickers', accelerator:'Ctrl+Shift+X', click: overlay.removeAllOverlays },
        { type:'separator' }, { role:'quit' }
      ]}
  ]);
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1024, height: 720, minWidth: 800, minHeight: 600,
    webPreferences: {
      // persistent partition so cookies survive app restarts
      partition: 'persist:icon',
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
    },
  });

  mainWin.setMenu(buildMenu());
  // Local wrapper that embeds your hosted UI in an iframe:
  mainWin.loadFile(path.join(__dirname, '../windows/library.html'));
}

app.whenReady().then(() => {
  forceThirdPartyCookies();
  createMainWindow();
  globalShortcut.register('CommandOrControl+Shift+X', overlay.removeAllOverlays);
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());

/* IPC for overlays */
ipcMain.handle('overlay:create', (_e,id,url) => overlay.createOverlay(id,url));
ipcMain.handle('overlay:clearAll', overlay.removeAllOverlays);
