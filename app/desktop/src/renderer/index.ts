type Sticker = {
  id: string;
  title: string;
  featuredImage?: { url: string; altText?: string };
};

declare global {
  interface Window {
    stickers: {
      list(token: string): Promise<Sticker[]>;
      pin(id: string, url: string): Promise<void>;
      clearAll(): Promise<void>;
    }
  }
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const tokenInput = $('#token') as HTMLInputElement;
const saveBtn    = $('#save')!;
const logoutBtn  = $('#logout')!;
const grid       = $('#grid')!;
const clearAll   = $('#clearAll')!;

function getToken(): string | null { return localStorage.getItem('icon.cat'); }
function setToken(t: string)       { localStorage.setItem('icon.cat', t); }
function clearToken()              { localStorage.removeItem('icon.cat'); }

function card(sticker: Sticker) {
  const img = sticker.featuredImage?.url ?? '';
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `
    <img src="${img}" alt="${sticker.title||''}" draggable="false">
    <div class="row">
      <div style="flex:1">${sticker.title||sticker.id}</div>
      <button data-id="${sticker.id}" data-url="${img}">Pin</button>
    </div>
  `;
  el.querySelector('button')!.addEventListener('click', () => {
    window.stickers.pin(sticker.id, img);
  });
  return el;
}

async function loadStickers(t: string) {
  grid.textContent = 'Loading…';
  try {
    const items = await window.stickers.list(t);
    grid.textContent = '';
    if (!items?.length) {
      grid.textContent = 'No stickers yet.';
      return;
    }
    items.forEach(s => grid.appendChild(card(s)));
  } catch (err) {
    console.error(err);
    grid.textContent = 'Could not load stickers.';
  }
}

function updateLoginUI() {
  const t = getToken();
  tokenInput.value = t ?? '';
  logoutBtn.style.display = t ? '' : 'none';
}

saveBtn.addEventListener('click', async () => {
  const t = tokenInput.value.trim();
  if (!t) return;
  setToken(t);
  updateLoginUI();
  await loadStickers(t);
});

logoutBtn.addEventListener('click', () => {
  clearToken();
  updateLoginUI();
  grid.textContent = '';
});

clearAll.addEventListener('click', () => window.stickers.clearAll());

// boot
(async () => {
  updateLoginUI();
  const t = getToken();
  if (t) await loadStickers(t);
})();
