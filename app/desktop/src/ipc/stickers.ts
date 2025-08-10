// app/desktop/src/ipc/stickers.ts
const API = process.env.ICON_API_URL ?? 'https://icon-web-two.vercel.app/api';

// Returns array of { id, title, url } regardless of backend shape
export async function listMyStickers(token: string) {
  if (!token) return [];
  const r = await fetch(`${API}/me`, { headers: { cookie: `cat=${token}` } });
  if (!r.ok) { console.error('API /me failed', r.status, r.statusText); return []; }
  const json = await r.json();

  // Try a few common shapes → normalize
  let items: any[] =
    Array.isArray(json?.stickers) ? json.stickers :
    Array.isArray(json?.items)    ? json.items    :
    Array.isArray(json)           ? json          : [];

  return items
    .map((it: any) => ({
      id:    it.id ?? it.handle ?? it.sku ?? it.title ?? String(Math.random()),
      title: it.title ?? it.name ?? 'Sticker',
      url:   it.featuredImage?.url ?? it.image?.url ?? it.url ?? it.src
    }))
    .filter(s => !!s.url);
}
