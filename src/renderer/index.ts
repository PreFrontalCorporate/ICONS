type IconFile = import('../main/ipc').IconFile;

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

const verEl = $('#ver');
const grid = $('#grid');
const libsEl = $('#libs');
const addBtn = $('#add');
const exportBtn = $('#export');
const searchEl = $('#search') as HTMLInputElement;
const ctx = $('#ctx') as HTMLDivElement;

let allIcons: IconFile[] = [];
let filtered: IconFile[] = [];
const selected = new Set<string>();
let libraries: string[] = [];

async function refresh() {
  const res = await window.api.library.scanAll();
  allIcons = res.icons.sort((a, b) => a.name.localeCompare(b.name));
  libraries = res.libraries;
  renderLibs();
  applyFilter();
}

function renderLibs() {
  libsEl.innerHTML = '';
  libraries.forEach((lib) => {
    const div = document.createElement('div');
    div.className = 'lib';
    div.textContent = lib;
    div.title = 'Right-click to remove from Library';
    div.oncontextmenu = async (e) => {
      e.preventDefault();
      if (confirm('Remove this folder from your Library?')) {
        await window.api.library.removeFolder(lib);
        refresh();
      }
    };
    libsEl.appendChild(div);
  });
}

function sizeStr(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function applyFilter() {
  const q = searchEl.value.trim().toLowerCase();
  filtered = q
    ? allIcons.filter((i) => i.name.toLowerCase().includes(q))
    : allIcons.slice();

  $('#count').textContent = `${filtered.length} icon${filtered.length === 1 ? '' : 's'}`;
  renderGrid();
}

function renderGrid() {
  grid.innerHTML = '';
  filtered.forEach((icon) => {
    const card = document.createElement('div');
    card.className = `card ${selected.has(icon.id) ? 'sel' : ''}`;
    card.dataset.id = icon.id;

    card.onclick = (e) => {
      if ((e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey) {
        if (selected.has(icon.id)) selected.delete(icon.id);
        else selected.add(icon.id);
      } else {
        selected.clear();
        selected.add(icon.id);
      }
      renderGrid();
    };

    card.oncontextmenu = (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, icon);
    };

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const img = document.createElement('img');
    img.src = icon.fileUrl;
    img.alt = icon.name;
    thumb.appendChild(img);

    const name = document.createElement('div');
    name.textContent = icon.name;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${icon.ext.toUpperCase()} • ${sizeStr(icon.size)}`;

    card.appendChild(thumb);
    card.appendChild(name);
    card.appendChild(meta);
    grid.appendChild(card);
  });
}

function showContextMenu(x: number, y: number, icon: IconFile) {
  ctx.style.display = 'block';
  ctx.style.left = `${x}px`;
  ctx.style.top = `${y}px`;
  const hide = () => (ctx.style.display = 'none');
  setTimeout(() => document.addEventListener('click', hide, { once: true }));

  ctx.onclick = async (e) => {
    const btn = e.target as HTMLElement;
    if (btn.dataset.action === 'open') await window.api.icon.open(icon.absPath);
    if (btn.dataset.action === 'reveal') await window.api.icon.reveal(icon.absPath);
  };
}

addBtn.onclick = async () => {
  const res = await window.api.library.addFolder();
  if (res.folder) {
    // merge new icons into allIcons
    allIcons = [...allIcons, ...res.icons].filter(
      (v, i, arr) => arr.findIndex((x) => x.absPath === v.absPath) === i
    );
    if (!libraries.includes(res.folder)) libraries.push(res.folder);
    renderLibs();
    applyFilter();
  }
};

exportBtn.onclick = async () => {
  const paths = filtered
    .filter((i) => selected.has(i.id))
    .map((i) => i.absPath);

  if (!paths.length) {
    alert('Select at least one icon to export.');
    return;
  }
  const saved = await window.api.export.zip(paths);
  if (saved) alert(`Saved ZIP:\n${saved}`);
};

searchEl.oninput = () => applyFilter();

window.api.onMenu('menu:add-folder', () => addBtn.click());
window.api.onMenu('menu:export', () => exportBtn.click());
window.api.onMenu('menu:about', () =>
  alert('Icon Desktop\nA tiny icon library manager.')
);

(async function boot() {
  verEl.textContent = `v${await window.api.app.getVersion()}`;
  await refresh();
})();
