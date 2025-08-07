import { BrowserWindow, app } from 'electron';
import { fileURLToPath }     from 'node:url';
import { join, dirname }     from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

async function createWin() {
  const win = new BrowserWindow({
    width:  800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, 'preload.js')  // ✱ compiled preload
    }
  });

  await win.loadFile(join(__dirname, 'renderer/index.html'));
}

app.whenReady().then(createWin);
