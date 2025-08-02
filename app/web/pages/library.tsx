// app/web/pages/library.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Product = {
  id: string;
  title: string;
  featuredImage: { url: string; altText: string | null };
};

export default function LibraryPage() {
  const [user,  setUser]  = useState<'anon' | 'loading' | 'ready'>('anon');
  const [data,  setData]  = useState<Product[] | null>(null);
  const [error, setError] = useState('');

  /* ------------------- fetch stickers once session is confirmed ------------------- */
  useEffect(() => {
    if (user !== 'ready') return;

    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(r => setData(Array.isArray(r) ? r : []))   // ← guard against non‑array
      .catch(() => {
        setError('Session expired – please log in');
        setUser('anon');
      });
  }, [user]);

  /* -------------------------------------- POST email / password -------------------------------------- */
  async function login(form: FormData) {
    setUser('loading');
    const res = await fetch('/api/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form)),
    });

    if (res.ok) {
      setUser('ready');
      setError('');
    } else {
      setUser('anon');
      setError('Wrong email or password');
    }
  }

  /* ------------------------------------------- render states ------------------------------------------ */
  if (user === 'anon') {
    return (
      <form
        onSubmit={e => { e.preventDefault(); login(new FormData(e.currentTarget)); }}
        className="max-w-sm mx-auto mt-24 space-y-4"
      >
        <h1 className="text-2xl font-semibold text-center">Log in</h1>

        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="border px-3 py-2 w-full rounded"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          className="border px-3 py-2 w-full rounded"
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <Button type="submit" className="w-full">Enter</Button>
      </form>
    );
  }

  if (user === 'loading') {
    return <p className="text-center mt-24">Checking…</p>;
  }

  /* ------------------------------- logged‑in view ------------------------------- */
  const list = Array.isArray(data) ? data : [];

  return (
    <main className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-semibold mb-6">🎟️ My sticker library</h1>

      {list.length === 0 && <p>You have no stickers yet 🤔</p>}

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(p => (
          <li key={p.id} className="border rounded-lg p-4 flex flex-col items-center">
            <img
              src={p.featuredImage.url}
              alt={p.featuredImage.altText ?? p.title}
              className="h-32 object-contain mb-4"
            />
            <span>{p.title}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
