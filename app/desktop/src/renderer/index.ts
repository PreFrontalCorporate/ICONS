declare global {
  interface Window {
    iconOverlay: {
      pinSticker(id: string, url: string): Promise<void> | void;
      clearAll(): Promise<void> | void;
    };
    stickers: {
      list(token: string): Promise<Array<{ id: string; title: string; featuredImage: { url: string; altText?: string } }>>;
    };
  }
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const tokenInput = $('#token') as HTMLInputElement;
const saveBtn    = $('#save')!;
const logoutBtn  = $('#logout')!;
const clearBtn   = $('#clearAll')!;
const grid       = $('#grid')!;

function setLoggedInState(hasToken: boolean) {
  if (hasToken) {
    tokenInput.style.display = 'none';
    saveBtn.style.display    = 'none';
    logoutBtn.style.display  = '';
  } else {
    tokenInput.style.display = '';
    saveBtn.style.display    = '';
    logoutBtn.style.display  = 'none';
  }
}

async function loadStickers(token: string) {
  grid.innerHTML = 'Loading…';
  try {
    const list = await window.stickers.list(token);
    if (!list?.length) {
      grid.innerHTML = '<span class="muted">No stickers found. Check your token.</span>';
      return;
    }
    grid.innerHTML = '';
    for (const s of list) {
      const card = document.createElement('div');
      card.className = 'card';
      card.title = s.title;
      const img = document.createElement('img');
      img.src = s.featuredImage.url;
      img.alt = s.featuredImage.altText ?? s.title;
      card.appendChild(img);
      card.addEventListener('click', () => window.iconOverlay.pinSticker(s.id, s.featuredImage.url));
      grid.appendChild(card);
    }
  } catch (e) {
    console.error(e);
    grid.innerHTML = '<span class="muted">Failed to load stickers.</span>';
  }
}

saveBtn.addEventListener('click', () => {
  const t = tokenInput.value.trim();
  if (!t) return;
  localStorage.setItem('icon.cat', t);
  setLoggedInState(true);
  loadStickers(t);
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('icon.cat');
  setLoggedInState(false);
  grid.innerHTML = '';
  tokenInput.value = '';
  tokenInput.focus();
});

clearBtn.addEventListener('click', () => window.iconOverlay.clearAll());

// bootstrap
const saved = localStorage.getItem('icon.cat');
setLoggedInState(!!saved);
if (saved) loadStickers(saved);
