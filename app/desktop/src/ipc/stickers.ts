// app/desktop/src/ipc/stickers.ts
// Stream user-owned stickers from your web API (backed by Shopify).
// No local assets; returns [{id,title,featuredImage:{url,altText}}...]

const API = process.env.ICON_API_BASE ?? 'https://icon-web-two.vercel.app/api';

export type RemoteSticker = {
  id: string;
  title?: string;
  featuredImage: { url: string; altText?: string };
};

export async function getMyStickers(token: string): Promise<RemoteSticker[]> {
  if (!token) return [];
  const r = await fetch(`${API}/me`, {
    // your API expects cookie "cat=<token>"
    headers: { cookie: `cat=${encodeURIComponent(token)}` }
  });
  if (!r.ok) return [];
  return r.json();
}
