declare global {
  interface Window {
    api: {
      login(email: string, password: string): Promise<string>;
      list(token: string): Promise<any[]>;
      createOverlay(id: string, url: string): Promise<void>;
      clearOverlays(): Promise<void>;
    };
  }
}

const el = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const email   = el<HTMLInputElement>('#email');
const pass    = el<HTMLInputElement>('#pass');
const tokenEl = el<HTMLInputElement>('#token');
const save    = el<HTMLButtonElement>('#save');
const signin  = el<HTMLButtonElement>('#signin');
const logout  = el<HTMLButtonElement>('#logout');
const grid    = el<HTMLDivElement>('#grid');
const err     = el<HTMLParagraphElement>('#err');
const hint    = el<HTMLParagraphElement>('#hint');
const clearAll= el<HTMLButtonElement>('#clearAll');

let token: string | null = null;

function showError(msg: string) {
  err.textContent = msg;
  err.style.display = 'block';
  setTimeout(()=>err.style.display='none', 5000);
}

function setLoggedIn(t: string) {
  token = t;
  localStorage.setItem('cat', t);
  tokenEl.value = t;
  email.value = pass.value = '';
  logout.style.display = '';
  signin.style.display = '';
  save.style.display = 'none';
  tokenEl.style.display = 'none';
  hint.textContent = 'Logged in.';
}

function setLoggedOut() {
  token = null;
  localStorage.removeItem('cat');
  logout.style.display = 'none';
  save.style.display = '';
  tokenEl.style.display = '';
  hint.textContent = 'Paste your customer access token (cat=...). Or sign in to generate one.';
  grid.innerHTML = '';
}

async function refresh() {
  grid.innerHTML = '';
  if (!token) { setLoggedOut(); return; }

  try {
    const stickers = await window.api.list(token);
    if (!stickers?.length) {
      grid.innerHTML = '<div class="muted">No stickers yet.</div>';
      return;
    }
    // Render cards
    for (const s of stickers) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img loading="lazy" src="${s.featuredImage?.url || s.image?.url || ''}" alt="${s.featuredImage?.altText || s.title || ''}">
        <div class="row">
          <div style="flex:1">${s.title ?? s.id}</div>
          <button data-id="${s.id}" data-url="${s.featuredImage?.url || s.image?.url}">Pin</button>
        </div>
      `;
      grid.appendChild(card);
    }
    // Wire pin buttons
    grid.querySelectorAll('button[data-id]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id  = (btn as HTMLButtonElement).dataset.id!;
        const url = (btn as HTMLButtonElement).dataset.url!;
        if (url) window.api.createOverlay(id, url);
      });
    });
  } catch (e:any) {
    showError(e?.message || 'Failed to load stickers.');
  }
}

// UI events
save.onclick = async () => {
  const raw = tokenEl.value.trim();
  const m = raw.match(/^cat=([^;]+)$/i) || raw.match(/^([A-Za-z0-9_\-]+)$/);
  if (!m) return showError('Please paste a valid cat token.');
  setLoggedIn(m[1]);
  refresh();
};

signin.onclick = async () => {
  try {
    const t = await window.api.login(email.value.trim(), pass.value);
    setLoggedIn(t);
    refresh();
  } catch (e:any) {
    showError(e?.message || 'Login failed');
  }
};

logout.onclick = () => { setLoggedOut(); };

clearAll.onclick = () => window.api.clearOverlays();

// Boot
const saved = localStorage.getItem('cat');
if (saved) { setLoggedIn(saved); }
refresh();
