// app/web/pages/library.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Product = { id: string; title: string; featuredImage: { url: string; altText: string } };

export default function LibraryPage() {
  const [user, setUser]     = useState<'anon'|'loading'|'ready'>('anon');
  const [data, setData]     = useState<Product[]>([]);
  const [error, setError]   = useState('');

  // fetch stickers once logged in
  useEffect(() => {
    if (user !== 'ready') return;
    fetch('/api/me')
      .then(r => r.json())
      .then(setData)
      .catch(() => setError('Session expired – please log in'));
  }, [user]);

  async function login(form: FormData) {
    setUser('loading');
    const body = Object.fromEntries(form);
    const r = await fetch('/api/login', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type':'application/json' } });
    setUser(r.ok ? 'ready' : 'anon');
    if (!r.ok) setError('Wrong email or password');
  }

  if (user === 'anon')
    return (
      <form onSubmit={e => { e.preventDefault(); login(new FormData(e.currentTarget)); }} className="max-w-sm mx-auto mt-24 space-y-4">
        <h1 className="text-2xl font-semibold">Log in</h1>
        <input name="email" type="email" required placeholder="Email" className="border px-3 py-2 w-full" />
        <input name="password" type="password" required placeholder="Password" className="border px-3 py-2 w-full" />
        {error && <p className="text-red-600">{error}</p>}
        <Button type="submit">Enter</Button>
      </form>
    );

  if (user === 'loading') return <p className="text-center mt-24">Checking…</p>;

  return (
    <main className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-semibold mb-6">🎟️ My sticker library</h1>
      {data.length === 0 && <p>You have no stickers yet 🤔</p>}
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map(p => (
          <li key={p.id} className="border rounded-lg p-4 flex flex-col items-center">
            <img src={p.featuredImage.url} alt={p.featuredImage.altText ?? p.title} className="h-32 object-contain mb-4" />
            <span>{p.title}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
