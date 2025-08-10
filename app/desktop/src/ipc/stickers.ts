// app/desktop/src/ipc/stickers.ts
import fetch from 'node-fetch';

const API = 'https://icon-web-two.vercel.app/api';

// 1) Login via web API -> returns the Shopify Customer Access Token (CAT)
export async function login(email: string, password: string): Promise<string> {
  const r = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!r.ok) {
    const msg = await r.text().catch(() => '');
    throw new Error(`Login failed (${r.status}) ${msg}`);
  }

  const setCookie = r.headers.get('set-cookie') || '';
  // Extract cat=... from Set-Cookie
  const m = setCookie.match(/(?:^|;)\s*cat=([^;]+)/i);
  if (!m) throw new Error('Server did not return a "cat" cookie.');
  return m[1];
}

// 2) Fetch current user’s stickers using the CAT
export async function getMyStickers(token: string) {
  const r = await fetch(`${API}/me`, {
    headers: { cookie: `cat=${token}` },
  });
  if (!r.ok) return [];
  return r.json(); // [{ id, title, featuredImage:{url,altText} }, ...]
}
