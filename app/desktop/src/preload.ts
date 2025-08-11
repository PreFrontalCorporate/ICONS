import { contextBridge, ipcRenderer } from "electron";

type PinOpts = { name?: string; w?: number; h?: number; rotation?: number };

contextBridge.exposeInMainWorld("icon", {
  pinSticker: (src: string, opts: PinOpts = {}) => {
    ipcRenderer.send("pin-sticker", { src, ...opts });
  },
  clearOverlays: () => ipcRenderer.send("clear-overlays"),
  closeSelf: () => ipcRenderer.invoke("overlay-close-self"),
  resizeSelf: (size: { width: number; height: number }) =>
    ipcRenderer.invoke("overlay-resize-self", size),
});

/** Optional: auto-wire elements with [data-icon-pin] */
window.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement)?.closest("[data-icon-pin]");
  if (!target) return;
  e.preventDefault();

  const src =
    target.getAttribute("data-src") ??
    (target instanceof HTMLImageElement ? target.src : undefined);

  if (src) {
    const name = target.getAttribute("data-name") ?? "";
    ipcRenderer.send("pin-sticker", { src, name });
  }
});
