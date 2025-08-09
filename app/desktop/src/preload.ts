// CJS-compiled preload that exposes overlay + simple UI helpers.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('iconOverlay', {
  pinSticker: (id: string, url: string) => ipcRenderer.invoke('overlay:create', id, url),
  clearAll:   () => ipcRenderer.invoke('overlay:clearAll'),
  toggleClickThrough: () => ipcRenderer.invoke('overlay:toggleClickThrough')
});

contextBridge.exposeInMainWorld('desktop', {
  login: (store: string, password: string) =>
    ipcRenderer.invoke('auth:login', { store, password }),
  openLibrary: () => ipcRenderer.invoke('ui:openLibrary'),
  focusLibrary: () => ipcRenderer.invoke('ui:focusLibrary')
});

declare global {
  interface Window {
    iconOverlay: {
      pinSticker(id: string, url: string): Promise<void>;
      clearAll(): Promise<void>;
      toggleClickThrough(): Promise<void>;
    };
    desktop: {
      login(store: string, password: string): Promise<{ ok: boolean; message?: string }>;
      openLibrary(): Promise<void>;
      focusLibrary(): Promise<void>;
    };
  }
}
