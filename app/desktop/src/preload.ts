// app/desktop/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('iconOverlay', {
  pinSticker:  (id: string, url: string) => ipcRenderer.invoke('overlay:create', id, url),
  clearAll:    () => ipcRenderer.invoke('overlay:clearAll'),
  setEditMode: (on: boolean)            => ipcRenderer.invoke('overlay:setEditMode', on),
  toggleEdit:  ()                        => ipcRenderer.invoke('overlay:toggleEdit'),
});
