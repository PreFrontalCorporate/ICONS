import { app, BrowserWindow, globalShortcut, screen } from 'electron';

let win: BrowserWindow;
const SNAP = 12; // px

function snapToEdge(b: Electron.Rectangle, area: Electron.Rectangle) {
  const n = { ...b };
  if (Math.abs(b.x - area.x) < SNAP) n.x = area.x;                               // left
  if (Math.abs(b.y - area.y) < SNAP) n.y = area.y;                               // top
  if (Math.abs(b.x + b.width - (area.x + area.width)) < SNAP)                    // right
    n.x = area.x + area.width - b.width;
  if (Math.abs(b.y + b.height - (area.y + area.height)) < SNAP)                  // bottom
    n.y = area.y + area.height - b.height;
  return n;
}

function create() {
  win = new BrowserWindow({
    width: 420,
    height: 420,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: { contextIsolation: true }
  });

  win.loadFile('index.html');
  win.setIgnoreMouseEvents(true, { forward: true });  // click-through :contentReference[oaicite:5]{index=5}

  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    const ig = win.isIgnoringMouseEvents();
    win.setIgnoreMouseEvents(!ig, { forward: !ig });
    win.setFocusable(ig);
  });

  win.on('move', () => {
    const bounds = win.getBounds();
    const area = screen.getDisplayMatching(bounds).workArea;
    win.setBounds(snapToEdge(bounds, area));
  });
}

app.whenReady().then(create);
