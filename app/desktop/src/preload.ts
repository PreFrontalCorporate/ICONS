import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('api', {
  verify: (token: string) => ipcRenderer.invoke('verify', token)
});
