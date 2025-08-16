import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fg from 'fast-glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
import archiver from 'archiver';
import sanitize from 'sanitize-filename';
import crypto from 'crypto';
import { store } from './store';

export type IconFile = {
  id: string;
  name: string;
  ext: string;
  absPath: string;
  fileUrl: string;
  size: number;
  mtime: number;
};

const hash = (s: string) => crypto.createHash('sha1').update(s).digest('hex');

async function indexFolder(folder: string): Promise<IconFile[]> {
  const exts = ['svg', 'png', 'ico'];
  const patterns = exts.map((e) => `**/*.${e}`);
  const files = await fg(patterns, {
    cwd: folder,
    absolute: true,
    onlyFiles: true,
    dot: false,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });

  const stats = await Promise.all(
    files.map(async (abs) => {
      const st = await fs.stat(abs);
      const ext = path.extname(abs).slice(1).toLowerCase();
      return <IconFile>{
        id: hash(abs),
        name: path.basename(abs),
        ext,
        absPath: abs,
        fileUrl: pathToFileURL(abs).href,
        size: st.size,
        mtime: st.mtimeMs,
      };
    })
  );
  return stats;
}

async function pickFolder(): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  return canceled || filePaths.length === 0 ? null : filePaths[0];
}

export function registerIpc(win: BrowserWindow) {
  ipcMain.handle('app:getVersion', () => process.env.npm_package_version ?? 'dev');

  ipcMain.handle('store:get', (_e, key: 'theme' | 'libraries') => store.get(key));
  ipcMain.handle('store:set', (_e, key: 'theme' | 'libraries', value: any) => {
    store.set(key, value as any);
    return true;
  });

  // Choose a folder, persist it, return updated library
  ipcMain.handle('library:addFolder', async () => {
    const folder = await pickFolder();
    if (!folder) return { folder: null, icons: [] as IconFile[] };

    const libs = new Set(store.get('libraries'));
    libs.add(folder);
    store.set('libraries', [...libs]);
    const icons = await indexFolder(folder);
    return { folder, icons };
  });

  // Remove a folder from persistence (no destructive FS ops)
  ipcMain.handle('library:removeFolder', async (_e, folder: string) => {
    store.set('libraries', store.get('libraries').filter((f) => f !== folder));
    return true;
  });

  // Scan all persisted libraries and return a combined list
  ipcMain.handle('library:scanAll', async () => {
    const libs = store.get('libraries');
    const results = await Promise.all(libs.map((f) => indexFolder(f)));
    const flat = results.flat();

    // de-dup by absPath
    const byPath = new Map(flat.map((i) => [i.absPath, i]));
    return { icons: [...byPath.values()], libraries: libs };
  });

  ipcMain.handle('icon:open', (_e, absPath: string) => shell.openPath(absPath));
  ipcMain.handle('icon:reveal', (_e, absPath: string) => shell.showItemInFolder(absPath));

  ipcMain.handle('export:zip', async (_e, absPaths: string[]) => {
    if (!absPaths?.length) return null;

    const defaultName = sanitize(
      absPaths.length === 1 ? path.parse(absPaths[0]).name : `icons-${Date.now()}`
    );

    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: `${defaultName}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    });
    if (canceled || !filePath) return null;

    await new Promise<void>((resolve, reject) => {
      const output = require('fs').createWriteStream(filePath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      for (const p of absPaths) {
        archive.file(p, { name: path.basename(p) });
      }
      archive.finalize();
    });

    return filePath;
  });

  // Menu events forwarded to renderer are set in menu.ts
}
