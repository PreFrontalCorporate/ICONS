// app/desktop/src/ipc/overlay.ts
import { BrowserWindow, ipcMain, screen } from 'electron';

type Logger = (...args: any[]) => void;

const overlays = new Set<BrowserWindow>();

export function registerOverlayIpc(log: Logger) {
  ipcMain.handle('overlay/count', () => overlays.size);

  ipcMain.handle('overlay/clearAll', () => {
    for (const w of overlays) { try { w.close(); } catch {} }
    overlays.clear();
    return 0;
  });

  // also listen to a fire-and-forget emitter (used by global shortcut)
  ipcMain.on('overlay:clearAll-request', () => {
    for (const w of overlays) { try { w.close(); } catch {} }
    overlays.clear();
  });

  ipcMain.handle('overlay/pin', async (_e, url: string) => {
    try {
      const win = createOverlayWindow(url, log);
      overlays.add(win);
      win.on('closed', () => overlays.delete(win));
      return overlays.size;
    } catch (err) {
      log('overlay/pin error', String(err));
      return overlays.size;
    }
  });
}

function createOverlayWindow(url: string, log: Logger) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.round(width * 0.45),
    height: Math.round(height * 0.45),
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    show: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true, // reinforced below
    fullscreenable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Make it truly topmost
  try { win.setAlwaysOnTop(true, 'screen-saver'); } catch {}
  try { win.setVisibleOnAllWorkspaces(true); } catch {}

  const html = buildOverlayHtml(url);
  win.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
  log('overlay window created for', url);

  return win;
}

function buildOverlayHtml(url: string) {
  const safe = url.replace(/[&<>"']/g, (m) =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' } as any)[m]
  );
  return `<!doctype html><html><head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'self' data: https:; img-src * data: https:; style-src 'unsafe-inline' 'self'; script-src 'unsafe-inline' 'self'">
<title>overlay</title>
<style>
  html,body{margin:0;height:100%;background:transparent;overflow:hidden}
  /* drag anywhere except on buttons/image */
  .drag{position:absolute; inset:0; -webkit-app-region: drag;}
  #img{
    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(0deg);
    max-width:100%; max-height:100%; -webkit-app-region: no-drag; user-select:none;
  }
  #close{
    position:fixed; right:12px; top:12px; z-index:2; -webkit-app-region: no-drag;
    background:rgba(0,0,0,.6); color:#fff; border:0; border-radius:999px; cursor:pointer;
    width:28px; height:28px; line-height:26px; text-align:center; font:16px/26px ui-sans-serif,system-ui,'Segoe UI';
  }
  #hint{
    position:fixed; left:12px; bottom:12px; opacity:.75; color:#fff; font:12px ui-sans-serif,system-ui,'Segoe UI';
    background:rgba(0,0,0,.45); padding:6px 8px; border-radius:8px; -webkit-app-region: no-drag;
  }
</style>
</head><body>
  <div class="drag"></div>
  <img id="img" src="${safe}" alt="" draggable="false"/>
  <button id="close" aria-label="Close">×</button>
  <div id="hint">Esc: close · R: rotate</div>
  <script>
    const img = document.getElementById('img');
    const closeBtn = document.getElementById('close');
    let deg = 0;
    function apply(){ img.style.transform = 'translate(-50%,-50%) rotate(' + deg + 'deg)'; }
    window.addEventListener('keydown', e=>{
      if (e.key === 'Escape') window.close();
      if (e.key.toLowerCase() === 'r') { deg = (deg + 90) % 360; apply(); }
    });
    img.addEventListener('dblclick', ()=> window.close());
    closeBtn.addEventListener('click', ()=> window.close());
  </script>
</body></html>`;
}
