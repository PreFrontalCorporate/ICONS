declare global {
  interface Window {
    desktop: { version: () => Promise<string> };
  }
}

const appEl = document.getElementById('app')!;
appEl.innerHTML = `
  <h1 style="margin:0 0 8px 0;">Icon Desktop</h1>
  <div>Renderer loaded ✅</div>
  <div id="ver" style="opacity:.8; margin-top:8px;">Version: …</div>
`;

window.desktop.version()
  .then(v => {
    const ver = document.getElementById('ver');
    if (ver) ver.textContent = `Version: ${v}`;
  })
  .catch(err => {
    const pre = document.createElement('pre');
    pre.textContent = String(err);
    appEl.appendChild(pre);
  });
