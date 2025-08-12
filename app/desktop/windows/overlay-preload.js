// overlay-preload.js (runs in the overlay window)
const { ipcRenderer } = require('electron');

(function () {
  const img = document.getElementById('sticker');
  // Read the image URL passed via loadFile(..., { hash })
  const url = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  if (img && url) img.src = url;

  let scale = 1;
  let rotation = 0;

  function applyTransform() {
    if (!img) return;
    img.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
  }

  // Zoom with mouse wheel
  window.addEventListener('wheel', (e) => {
    const delta = Math.sign(e.deltaY); // -1 up, +1 down
    const step = 0.08;
    scale = Math.max(0.1, delta > 0 ? scale * (1 - step) : scale * (1 + step));
    applyTransform();
  }, { passive: true });

  // Buttons
  document.getElementById('btn-rotate')?.addEventListener('click', () => {
    rotation = (rotation + 90) % 360;
    applyTransform();
  });

  document.getElementById('btn-close')?.addEventListener('click', () => {
    ipcRenderer.invoke('overlay/closeSelf');
  });

  // Hotkeys: Esc/Backspace close; Ctrl/⌘+R rotate; Ctrl/⌘+0 reset; Ctrl/⌘+= zoom in; Ctrl/⌘+- zoom out
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape' || e.key === 'Backspace') {
      e.preventDefault();
      ipcRenderer.invoke('overlay/closeSelf');
      return;
    }
    if (mod && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      rotation = (rotation + 90) % 360;
      applyTransform();
      return;
    }
    if (mod && (e.key === '0' || e.code === 'Digit0')) {
      e.preventDefault();
      scale = 1; rotation = 0;
      applyTransform();
      return;
    }
    if (mod && (e.key === '=' || e.key === '+')) {
      e.preventDefault(); scale *= 1.1; applyTransform(); return;
    }
    if (mod && (e.key === '-')) {
      e.preventDefault(); scale = Math.max(0.1, scale * 0.9); applyTransform(); return;
    }
  });
})();
