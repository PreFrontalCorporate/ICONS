import { contextBridge, ipcRenderer } from 'electron';
import type { IconFile } from './main/ipc';

const api = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<string>,
  },
  store: {
    get: <K extends 'theme' | 'libraries'>(key: K) =>
      ipcRenderer.invoke('store:get', key) as Promise<any>,
    set: <K extends 'theme' | 'libraries'>(key: K, value: any) =>
      ipcRenderer.invoke('store:set', key, value) as Promise<boolean>,
  },
  library: {
    addFolder: () => ipcRenderer.invoke('library:addFolder') as Promise<{ folder: string | null; icons: IconFile[] }>,
    removeFolder: (folder: string) => ipcRenderer.invoke('library:removeFolder', folder) as Promise<boolean>,
    scanAll: () => ipcRenderer.invoke('library:scanAll') as Promise<{ icons: IconFile[]; libraries: string[] }>,
  },
  icon: {
    open: (absPath: string) => ipcRenderer.invoke('icon:open', absPath),
    reveal: (absPath: string) => ipcRenderer.invoke('icon:reveal', absPath),
  },
  export: {
    zip: (paths: string[]) => ipcRenderer.invoke('export:zip', paths) as Promise<string | null>,
  },
  onMenu: (channel: 'menu:add-folder' | 'menu:export' | 'menu:about', cb: () => void) => {
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, cb);
  },
};

contextBridge.exposeInMainWorld('api', api);

declare global {
  interface Window {
    api: typeof api;
  }
}
