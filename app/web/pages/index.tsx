// app/web/pages/index.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex flex-col gap‑6 max‑w‑xl mx‑auto px-4 py‑24 text-center">
      <h1 className="text-3xl font-bold">🖼️ Icon Suite Dev</h1>
      <p className="opacity-90">
        This is the dev build. Use the buttons below to explore.
      </p>

      <div className="flex flex-col sm:flex-row flex-wrap gap‑4 justify-center">
        <Link href="/canvas">
          <Button>Open sticker canvas</Button>
        </Link>

        {/* opens GitHub releases in a new tab */}
        <Link href="/download" target="_blank">
          <Button variant="outline">Desktop build ↗︎</Button>
        </Link>

        <Link href="/library">
          <Button variant="outline">My library</Button>
        </Link>

        {/* temporary link to the Shopify storefront */}
        <a href="https://cbb.homes" target="_blank" rel="noreferrer">
          <Button variant="ghost">Store ↗︎</Button>
        </a>
      </div>
    </main>
  );
}

