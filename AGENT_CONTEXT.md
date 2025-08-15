
# General Agent Context: ICON Desktop (Electron)

**Owner:** Desktop Team  
**Doc purpose:** One-file source of truth for how the Electron desktop app should behave and where to change things. Copy this into `AGENT_CONTEXT.md` at repo root.

---

## Project Overview

ICON Desktop is an Electron-based desktop app that embeds a hosted **Library UI** in a `<webview>` and provides a **native always‑on overlay window** (transparent, click‑through aware) that renders “ICONs” (floating memes/stickers), effects, music, and a persistent macro bar.

**Key pillars**

- ⚙️ **Overlay engine**: physics, click FX, mixes, music, spawn/drag‑drop/import, density‑aware reverse magnet, i‑Magnet (cursor‑stick).  
- 🧭 **Persistent UI macro bar**: always visible in the overlay window; shows controls, explains macros, and exposes core actions (Spawn 50, Add URL, Toggle Music, Mix A/B/C, Hide/Reveal, Nuke, Rain 30, Shuffle, i‑Magnet toggle).  
- 🧱 **Hosted Library**: our account/store in a sandboxed webview. Desktop provides IPC bridges for packs and purchases.  
- 🧩 **Packs**: effects, music, and sticker packs installed locally; safe plugin API (see **Packs & Commerce**).  
- 🔒 **Security**: `contextIsolation`, no `remote`, strict CSP in overlay, minimal IPC surface.  
- 🧪 **Goals-as-contract**: acceptance tests assert the overlay bar, macros, and IPC contracts so CI “pulls” the repo toward these goals.

---

## Edit Flow in VM

Run these before pasting updated file contents:

```bash
# Update webview preload
rm app/desktop/windows/webview-preload.js
nano app/desktop/windows/webview-preload.js

# Update Library shell
rm app/desktop/windows/library.html
nano app/desktop/windows/library.html

# Host-side updates (only if needed)
rm app/desktop/src/preload.ts
nano app/desktop/src/preload.ts

rm app/desktop/src/main.ts
nano app/desktop/src/main.ts
```

---

## Build & Ship Sequence

Use this after making code changes:

```bash
# build
pnpm --dir app/desktop install
pnpm --dir app/desktop run build
pnpm --dir app/desktop run postbuild
```

```bash
# bump version to next patch based on current repo version
cd app/desktop
npm pkg set version=<NEXT_VERSION>
cd ../..
```

```bash
# commit & push
git add .
git commit -m "fix(desktop): <summary of change>; v<NEXT_VERSION>"
git push origin main
```
```bash
# tag & push tag (avoids GitHub Actions asset name collisions)
git tag -a v<NEXT_VERSION> -m "Desktop v<NEXT_VERSION>"
git push origin v<NEXT_VERSION>
```

---

## USER EXPERIENCE GOALS (Non‑negotiables)

**Persistent Overlay Macro Bar (always on screen)**  
- Lives inside the transparent overlay window (bottom‑center by default, draggable).  
- Shows: **Music On/Off**, **Spawn 50**, **Add URL** (with input), **Mix A/B/C**, **Nuke**, **Hide/Reveal**, **Rain 30**, **Shuffle**, and **i (i‑Magnet)** hint.  
- Explains keyboard macros inline:  
  - `Ctrl/⌘ + Alt + M` Nuke  
  - `Ctrl/⌘ + Alt + H` Hide/Reveal  
  - `Ctrl/⌘ + Alt + S` Shuffle  
  - `Ctrl/⌘ + Alt + R` Rain 30  
  - `Ctrl/⌘ + Alt + 1/2/3` Mix A/B/C  
  - `i` toggle **i‑Magnet**; click blank to drop (no push)

**Overlay Engine Behaviors (spec v8)**  
- Spawnable memes (PNG/GIF/WebP URLs) + SVG backups with sizes S/M/L, occasional XL.  
- Drag to fling; **no push‑away on release**. Shift‑drag creates a small group move.  
- Wheel = resize; **Shift+Wheel** = spin. Context menu removes.  
- **Click FX** rotate: `ripple` / `confetti` / `invert pulse` + tone.  
- **i‑Magnet**: while on, icons bias to cursor; clicking blank drops without reverse magnet; throw momentum based on pointer velocity history.  
- **Density‑aware Reverse Magnet** on blank clicks when **i‑Magnet is off** (only fires if memes are near the click); otherwise click passes through.  
- **“Portal” click‑through**: we temporarily ignore mouse events (`~450ms`) so underlying app receives the click reliably.  
- **Scroll wind** gently influences velocity; post‑scroll nudge re‑centers off‑screen icons.  
- **Mixes** stack effects + tempo bumps:  
  - Mix A: Tint + Scan + Vignette + ripple bursts + tempo up + shake  
  - Mix B: Invert pulse + star ring + confetti + tempo mid + shake  
  - Mix C: All‑in (tint+scan+invert pulse) + big confetti + ripple + tempo fast + shake  
- Music: WebAudio synthesized loops; **Music On/Off** button + **bumpTempo** in mixes.  
- Drag‑drop image files or paste a URL to **spawn 50** clones with varied sizes.

> The reference HTML/JS you provided is the canonical UX. The Electron overlay implements the same logic, 1:1.

---

## FILE MAP & RESPONSIBILITIES

```
app/desktop/
  src/
    main.ts            # create app + overlay windows, register global shortcuts, tray, IPC
    preload.ts         # secure bridges (contextBridge) for overlay <-> main

  overlay/             # (new) self-contained overlay app, copied to dist by postbuild
    index.html         # overlay UI + engine root (no layout shift, fixed layers)
    overlay.ts         # meme physics, FX, music, UI bar wiring, IPC handlers
    styles.css         # overlay bar styles + FX layers
    packs/             # runtime-installed packs (effects/music) + manifests
    types.d.ts         # minimal plugin API types

  windows/
    library.html       # host shell (updated; embeds webview to Library/Store)
    webview-preload.js # restricted bridge for <webview> (sanitized postMessage only)
```

---

## DESKTOP ARCHITECTURE

### Windows

- **OverlayWindow** (transparent, frameless, always‑on‑top)
  - `transparent: true`, `frame: false`, `focusable: false` (we only focus on demand), `hasShadow: false`
  - `alwaysOnTop: true` (or `'screen-saver'` level), visible across spaces (macOS), resizes with display.
  - Pointer passthrough toggled via `setIgnoreMouseEvents()` to implement the **portal**.
- **ShellWindow** (regular app window) hosts `windows/library.html` which embeds our hosted **Library** in a sandboxed `<webview>`.

### IPC surfaces

**Preload (overlay)** exposes a tiny API:

```ts
// app/desktop/src/preload.ts
contextBridge.exposeInMainWorld('overlay', {
  portalClickThrough(ms: number) : void,
  setPointerPassthrough(pass:boolean, forward?:boolean) : void,
  packs: {
    list(): Promise<PackList>,
    installFromZip(absPath: string): Promise<InstallResult>,
    enable(id: string, on: boolean): Promise<void>,
  },
  telemetry: (event: string, data?: Record<string,any>) => void
});
```

**Main** handles privileged things only (fs, dialogs, pack install, tray, global shortcuts).

### Global shortcuts (registered in `main.ts`)

```
Ctrl/⌘+Alt+M -> overlay.nuke()
Ctrl/⌘+Alt+H -> overlay.toggleHide()
Ctrl/⌘+Alt+S -> overlay.shuffle()
Ctrl/⌘+Alt+R -> overlay.rain(30)
Ctrl/⌘+Alt+1 -> overlay.mix('A')
Ctrl/⌘+Alt+2 -> overlay.mix('B')
Ctrl/⌘+Alt+3 -> overlay.mix('C')
```

### Click-through “portal”

```ts
// main.ts (snippet)
overlayWindow.webContents.send('overlay:portal', 450);
// preload.ts (overlay)
ipcRenderer.on('overlay:portal', (_, ms) => {
  window.electron.setPointerPassthrough(true, { forward: true });
  setTimeout(() => window.electron.setPointerPassthrough(false), ms);
});
```

### Security defaults

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, disable `remote`.  
- CSP: block inline eval; hashes for styles where needed.  
- **Webview**: `allowpopups=false`, `nodeintegration=false`, `preload=windows/webview-preload.js`, permissive origins whitelisted only for `cbb.homes`.

---

## UI MACRO BAR (always present)

- Implemented inside overlay (`index.html` + `styles.css` + `overlay.ts`).  
- **Buttons**: Music On/Off, Spawn 50, Add URL (input), Mix A/B/C, Nuke, Hide/Reveal, Rain 30, Shuffle.  
- **Hint chips**: shows the keyboard combos inline.  
- **Behavior**: bar is fixed bottom‑center, drag handle allows reposition; respects “Hide Overlay” state (truly hides overlay layers).

---

## PACKS & COMMERCE (effects, music, stickers)

We sell/ship modular packs that the overlay can load at runtime. Two forms:
- **Local packs** (bundled or downloaded) in `app/desktop/overlay/packs/…`
- **User‑installed** packs stored under Electron `app.getPath('userData')/packs`

**Manifest (`pack.json`)**

```jsonc
{
  "id": "effects.neon-drip",
  "name": "Neon Drip",
  "version": "1.0.0",
  "type": "effect",            // effect | music | stickers
  "entry": "index.js",         // ESM module
  "cover": "cover.png",
  "license": "sku:effects.neon-drip.v1",
  "compat": ">=1.0.0 <2"
}
```

**Plugin API (ESM)**

```ts
// index.js
/** @param {OverlayHost} host */
export function register(host) {
  // add a new click effect
  host.fx.register('dripBloom', (ctx) => { /* draw / composite / animate */ });

  // add a new macro (appears in bar & accessible via overlay.mix('neon'))
  host.macros.register({
    id: 'neon',
    label: 'Neon Mix',
    run: (api) => {
      api.fx.enable('tint'); api.fx.enable('scan'); api.fx.enable('dripBloom');
      api.music.bumpTempo(150); api.ui.shake();
    }
  });
}
```

**Host provides** (safe subset): `fx`, `macros`, `music`, `spawn`, `ui`, and a logger. Packs run in the **overlay renderer** (no Node). File access only through host IPC endpoints that validate inputs.

**Store & Library**  
- The hosted Library web app signs purchases and exposes downloadable pack zip(s).  
- Desktop **webview preload** listens for `postMessage` from `*.cbb.homes` to request install; main downloads, verifies, unzips to `userData/packs`, and calls `overlay.reloadPacks()`.

---

## HOW TO MAKE THE REPO “AUTO‑BUILD TOWARD GOALS”

1. **Keep this file authoritative.** CI fails if acceptance tests drift from “User Experience Goals” text.  
2. **Acceptance tests (Playwright)** in `app/desktop/tests/e2e/overlay.spec.ts`:
   - Asserts macro bar renders; buttons exist; keyboard shortcuts trigger actions; portal passthrough works.
3. **Goal tags** in code: add `// GOAL:<token>` comments (e.g., `GOAL:overlay.always_on_bar`).
   - `scripts/check-goals.ts` scans for required tokens and fails CI if missing.  
4. **Linear sync (optional)**: `scripts/linear-sync.ts` reads `goals/goals.json` and creates/updates Linear issues so planning mirrors this doc. (Use GraphQL endpoint + API key; prefer webhooks over polling for updates.)  
5. **Release gating**: `pnpm --dir app/desktop run verify` runs e2e + goal scan before publishing tag.

> Linear GraphQL notes: endpoint `https://api.linear.app/graphql`, authenticate with **API key** (`Authorization: <API_KEY>`) or **OAuth2 Bearer**; use cursor pagination (`first/after`, default page size 50), and follow best practice to use **webhooks** instead of polling. Rate limits: ~1500 req/hour for API keys.


---

## IMPLEMENTATION CHECKLIST (Delegate‑ready)

- [ ] Create `app/desktop/overlay` with `index.html`, `styles.css`, `overlay.ts` (port of reference engine).  
- [ ] Wire `OverlayWindow` in `main.ts` (transparent, always‑on‑top) + tray menu to show/hide.  
- [ ] Preload bridges: `preload.ts` (overlay) + `windows/webview-preload.js` (library).  
- [ ] Macro bar UI + handlers; register global shortcuts.  
- [ ] Packs loader (manifest parse, ESM dynamic import, host API surface).  
- [ ] Install flow from webview (postMessage → main → download/unzip → overlay.reloadPacks).  
- [ ] E2E tests for macros, portal, i‑Magnet, density‑aware reverse magnet.  
- [ ] Accessibility: “Reduce Effects” toggle; never exceed 3 flashes/sec; prefer system “Reduce Motion”.  
- [ ] Postbuild script copies `overlay/` into packaged app.  
- [ ] Ship (see **Build & Ship Sequence**).

---

## APPENDIX A — Library Shell (desktop)

Minimal `windows/library.html` hosts brand header + embeds Library/Store in a `<webview>`; preload restricts the bridge to `postMessage` events for pack install and account status. (Keep layout stable; the overlay is a separate window.)

---

## APPENDIX B — Reference Mix/FX (from web spec)

- `ripple(x,y)` — radial white pulse + fade.  
- `confetti(x,y)` — 8px colored rectangles fly out + fade.  
- `fxTint`, `fxScan`, `fxVignette`, `fxInvert` — layered fixed-position effects with transitions.  
- `mixA/B/C` — macros that toggle layers + add particles and tempo changes.  
- Music engine — WebAudio oscillators (bass/lead/hat), tempo via `bumpTempo(to)`.

---

## APPENDIX C — Accessibility & Performance

- FPS budget > 55 on mid hardware; use `requestAnimationFrame`, clamp velocities, avoid layout thrash.  
- Respect reduced motion; disable pulses/inverts when toggled.  
- Avoid persistent global filters on massive DOM subtrees; prefer fixed-position FX layers (no layout shift).

---

*End of file.*
