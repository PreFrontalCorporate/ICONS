import { useMemo } from "react";

declare global {
  interface Window {
    icon?: {
      pinSticker: (src: string, opts?: { name?: string; w?: number; h?: number; rotation?: number }) => void;
      clearOverlays: () => void;
    }
  }
}

export default function Library() {
  const stickers = useMemo(() => [
    {
      name: "Pepe the Frog Rare Version Meme",
      src: "https://cdn.shopify.com/s/files/1/0652/0605/9087/files/Pepe_the_Frog_Rare_Version_Meme.webp?v=1753859458",
    },
    {
      name: "Rare Pepe",
      src: "https://cdn.shopify.com/s/files/1/0652/0605/9087/files/Rare_Pepe.webp?v=1753859512",
    },
    {
      name: "I Took a DNA Test Turns Out I'm 100% That Bitch",
      src: "https://cdn.shopify.com/s/files/1/0652/0605/9087/files/I_Took_a_DNA_Test_Turns_Out_I_m_100_That_Bitch.webp?v=1753859149",
    },
  ], []);

  const pin = (s: { name: string; src: string }) => {
    window.icon?.pinSticker(s.src, { name: s.name });
  };

  const clear = () => window.icon?.clearOverlays();

  return (
    <main className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-semibold mb-6">🎟️ My sticker library</h1>

      <div className="flex items-center justify-between mb-6">
        <p className="text-muted-foreground">Click any sticker to pin it as an overlay.</p>
        <button
          onClick={clear}
          className="inline-flex items-center rounded-md h-9 px-3 bg-zinc-800 text-white hover:bg-zinc-700"
        >
          Remove overlays
        </button>
      </div>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stickers.map((s) => (
          <li key={s.src}
              className="border rounded-lg p-4 flex flex-col items-center hover:bg-accent cursor-pointer"
              onClick={() => pin(s)}>
            <img className="h-32 object-contain mb-4" src={s.src} alt={s.name} />
            <span>{s.name}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
