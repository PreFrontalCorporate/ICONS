declare global {
  interface Window {
    iconOverlay: { pinSticker(id: string, url: string): Promise<void>; clearAll(): Promise<void> };
  }
}

import stickers from '@stickers/index.json';  // built by packages/stickers/build_index.ts
type Entry = typeof stickers[number];

const el = document.getElementById('app')!;

function stickersBase(): string {
  // file://…/dist/renderer/index.html  →  ../../packages/stickers/
  if (location.protocol === 'file:') {
    const base = new URL('../../packages/stickers/', location.href);
    return base.toString();
  }
  // dev server / web fallback
  return '/stickers/';
}

function renderLogin() {
  el.innerHTML = `
    <h1>Sign in to icon</h1>
    <form id="login" class="row">
      <input name="email" type="email" placeholder="you@example.com" required style="flex:1;padding:8px 10px;border:1px solid #ccc;border-radius:8px">
      <button style="padding:8px 14px;border-radius:8px;border:0;background:#111;color:#fff">Continue</button>
    </form>
    <p style="opacity:.7">Temporary: we’ll unlock your local sample library after a dummy login.</p>
  `;
  (document.getElementById('login') as HTMLFormElement).onsubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('icon:user', (new FormData(e.currentTarget as HTMLFormElement).get('email') as string) || 'anon');
    renderLibrary();
  };
}

function renderLibrary() {
  const base = stickersBase();
  const cards = stickers.map((s: Entry) => {
    const thumb = `${base}${encodeURIComponent(s.id)}/${encodeURIComponent(s.thumb)}`;
    return `
      <div class="card" data-id="${s.id}" data-file="${s.file}">
        <img src="${thumb}" alt="${s.name}">
        <div style="margin-top:8px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.name}</div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="row">
      <h1 style="flex:1;margin:0">My library</h1>
      <button id="clear" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#fff">Clear all stickers</button>
    </div>
    <div class="grid">${cards}</div>
    <p style="opacity:.6;margin-top:12px">Tip: press <kbd>T</kbd> with an overlay focused to toggle click‑through.</p>
  `;

  document.getElementById('clear')!.addEventListener('click', () => window.iconOverlay.clearAll());

  el.querySelectorAll<HTMLDivElement>('.card').forEach(card => {
    card.addEventListener('click', () => {
      const id   = card.dataset.id!;
      const file = card.dataset.file!;
      const url  = `${base}${encodeURIComponent(id)}/${encodeURIComponent(file)}`;
      window.iconOverlay.pinSticker(id, url);
    });
  });
}

localStorage.getItem('icon:user') ? renderLibrary() : renderLogin();
