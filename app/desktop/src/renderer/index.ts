declare global {
  interface Window {
    icon: {
      overlay: { pinSticker(id: string, url: string): Promise<void>; clearAll(): Promise<void> };
      stickers: { getMine(token: string): Promise<Array<{ id: string; title?: string; featuredImage: { url: string } }>> };
    };
    iconAuth: { saveToken(t: string): void; readToken(): string | null; clear(): void };
  }
}

const els = {
  grid: document.getElementById('grid') as HTMLDivElement,
  token: document.getElementById('token') as HTMLInputElement,
  save: document.getElementById('save') as HTMLButtonElement,
  logout: document.getElementById('logout') as HTMLButtonElement,
  clearAll: document.getElementById('clearAll') as HTMLButtonElement,
};

const TOKEN_KEY = 'cat';

async function refresh() {
  const token = window.iconAuth.readToken() || localStorage.getItem(TOKEN_KEY) || '';
  els.token.value = token || '';
  els.logout.style.display = token ? '' : 'none';

  const stickers = token ? await window.icon.stickers.getMine(token) : [];
  renderGrid(stickers);
}

function renderGrid(stickers: Array<{ id: string; title?: string; featuredImage: { url: string } }>) {
  els.grid.innerHTML = '';
  if (!stickers.length) {
    els.grid.innerHTML = `<div class="muted">No stickers yet. Make sure your token is valid.</div>`;
    return;
  }

  for (const s of stickers) {
    const card = document.createElement('button');
    card.className = 'card';
    card.title = s.title || s.id;
    card.innerHTML = `<img alt="${(s.title || s.id).replace(/"/g, '')}" src="${s.featuredImage.url}">`;
    card.addEventListener('click', () => window.icon.overlay.pinSticker(s.id, s.featuredImage.url));
    els.grid.appendChild(card);
  }
}

els.save.addEventListener('click', async () => {
  const token = els.token.value.trim();
  if (!token) return;
  window.iconAuth.saveToken(token);
  localStorage.setItem(TOKEN_KEY, token);
  await refresh();
});

els.logout.addEventListener('click', async () => {
  window.iconAuth.clear();
  localStorage.removeItem(TOKEN_KEY);
  els.token.value = '';
  await refresh();
});

els.clearAll.addEventListener('click', () => window.icon.overlay.clearAll());

// first paint
refresh().catch(console.error);
