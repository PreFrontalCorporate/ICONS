declare global {
  interface Window {
    desktop: {
      login(store: string, password: string): Promise<{ ok: boolean; message?: string }>;
      openLibrary(): Promise<void>;
      focusLibrary(): Promise<void>;
    };
    iconOverlay: {
      pinSticker(id: string, url: string): Promise<void>;
      clearAll(): Promise<void>;
      toggleClickThrough(): Promise<void>;
    };
  }
}

import stickerIndex from '@stickers/index.json';
import type { StickerEntry } from '@stickers/types';

// naive template helpers
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: any = {}, ...kids: (Node | string)[]) => {
  const node = document.createElement(tag);
  Object.assign(node, props);
  kids.forEach(k => node.append(k));
  return node as HTMLElementTagNameMap[K];
};

const root = document.getElementById('root')!;

function renderLogin() {
  const error = el('div', { id: 'error' });

  const form = el('form', { id: 'login' },
    el('label', {}, 'Shopify store',
      el('input', { name: 'store', placeholder: 'mystore.myshopify.com', required: true })
    ),
    el('label', {}, 'Password',
      el('input', { name: 'password', type: 'password', placeholder: '••••••••', required: true })
    ),
    el('button', { type: 'submit', textContent: 'Sign in' }),
    error
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';

    const data = new FormData(form as HTMLFormElement);
    const store = String(data.get('store') || '');
    const password = String(data.get('password') || '');

    const res = await window.desktop.login(store, password);
    if (!res.ok) {
      error.textContent = res.message || 'Login failed';
      return;
    }
    renderGrid();
  });

  root.replaceChildren(form);
}

function fileUrlForSticker(s: StickerEntry) {
  // Our packages layout stores files under packages/stickers/<id>/<file>
  // (ids match their containing folder names).
  // electron-builder includes "packages/stickers/**/*", so we can reference with a file:// URL.
  const rel = `../../packages/stickers/${s.id}/${s.file}`;
  return new URL(rel, (import.meta as any).url).toString();
}

function renderGrid() {
  const header = el('div', { className: 'row' },
    el('h3', { textContent: 'Pick a sticker and it will pin as an overlay.' }),
    el('div', { style: 'flex:1' }),
    el('button', { textContent: 'Toggle click‑through', onclick: () => window.iconOverlay.toggleClickThrough() }),
    el('button', { textContent: 'Clear all', onclick: () => window.iconOverlay.clearAll() })
  );

  const grid = el('div', { className: 'grid' });

  (stickerIndex as StickerEntry[]).slice(0, 48).forEach((s) => {
    const img = el('img', { alt: s.name });
    img.src = fileUrlForSticker(s);
    img.title = s.name;
    img.addEventListener('click', () => window.iconOverlay.pinSticker(s.id, img.src));
    grid.append(img);
  });

  root.replaceChildren(el('div', {}, header, grid));
}

// initial screen
renderLogin();
