// app/desktop/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

/** API used by the main library window */
contextBridge.exposeInMainWorld('iconOverlay', {
  pinSticker : (id: string, url: string) => ipcRenderer.invoke('overlay:create', id, url),
  clearAll   : () => ipcRenderer.invoke('overlay:clearAll'),
});

/** Tiny helper used by overlay windows to toggle click‑through */
contextBridge.exposeInMainWorld('electronAPI', {
  toggle: () => {
    // call back into the owning BrowserWindow to flip ignoreMouseEvents
    const w: any = (global as any).window; // just to satisfy TS when compiled to CJS
    if (w && typeof (w as any)._toggle === 'function') {
      (w as any)._toggle();
    } else {
      // fallback: send to main if you later wire an IPC route
    }
  },
});
