type Sticker = { id: string; title: string; url: string };

declare global {
  interface Window {
    icon: {
      stickers: { list(token: string): Promise<Sticker[]> };
      overlay:  { create(id: string, url: string): Promise<void>; clearAll(): Promise<void> };
    }
  }
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const tokenInput = $('#token') as HTMLInputElement;
const saveBtn    = $('#save')  as HTMLButtonElement;
const logoutBtn  = $('#logout') as HTMLButtonElement;
const grid       = $('#grid')  as HTMLDivElement;

const STORAGE_KEY = 'icon.token';

function setLoggedIn(on: boolean) {
  tokenInput.disabled = on;
  saveBtn.style.display = on ? 'none' : 'inline-block';
  logoutBtn.style.display = on ? 'inline-block' : 'none';
}

async function loadGrid(token: string) {
  grid.textContent = 'Loading…';
  const list = await window.icon.stickers.list(token);
  if (!list.length) { grid.textContent = 'No stickers yet.'; return; }

  grid.innerHTML = '';
  for (const s of list) {
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `
      <img src="${encodeURI(s.url)}" alt="">
      <div class="row">
        <div style="flex:1">${s.title ?? ''}</div>
        <button data-id="${s.id}" data-url="${encodeURI(s.url)}">Pin</button>
      </div>
    `;
    card.querySelector('button')!.addEventListener('click', () => {
      window.icon.overlay.create(s.id, s.url);
    });
    grid.appendChild(card);
  }
}

$('#clearAll')!.addEventListener('click', () => window.icon.overlay.clearAll());

saveBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) return;
  localStorage.setItem(STORAGE_KEY, token);
  setLoggedIn(true);
  await loadGrid(token);
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  tokenInput.value = '';
  setLoggedIn(false);
  grid.innerHTML = '';
});

(function init() {
  const token = localStorage.getItem(STORAGE_KEY) || '';
  tokenInput.value = token;
  if (token) { setLoggedIn(true); loadGrid(token); }
})();
