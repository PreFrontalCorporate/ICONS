# Icon Suite – stickers everywhere 🔥

| Client | Command | Notes |
|--------|---------|-------|
| Web PWA | `pnpm dev -F web` | served at `localhost:3000` |
| Chrome / FF | `pnpm dev -F extension` | loads unpacked build/ in browser |
| Electron | `pnpm dev -F desktop` | transparent overlay |

### Purchase flow

1. Customer buys a sticker on **store.cbb.homes** (Shopify).
2. Private‑app Admin API issues Multipass token → callback at `/api/multipass`.
3. Client stores token (`localStorage` or `chrome.storage.sync`).
4. On every launch the client calls `/api/verify`, receives `{ allowedIds, manifestHash }`.
5. ☑️ Only the allowed stickers render; hashes guarantee files weren’t tampered with.

See [`docs/security.md`](docs/security.md) for signature details.
