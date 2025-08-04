const win = new BrowserWindow({ width: 900, height: 600 });
const startUrl = path.join(app.getAppPath(), 'dist', 'renderer', 'index.html');
await win.loadFile(startUrl);
