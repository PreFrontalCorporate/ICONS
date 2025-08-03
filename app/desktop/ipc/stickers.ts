import fetch from 'node-fetch';
const API = 'https://icon-web-two.vercel.app/api';

export async function getMyStickers(token: string) {
  const r = await fetch(`${API}/me`, {
    headers: { cookie: `cat=${token}` }
  });
  if (!r.ok) return [];
  return r.json();           // [{id,title,featuredImage:{url,altText}}...]
}
