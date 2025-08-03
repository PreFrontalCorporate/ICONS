/*───────────────────────────────────────────────────────────────┐
│ app/desktop/ipc/stickers.ts                                    │
└───────────────────────────────────────────────────────────────*/
// Handles “library” data requests coming from preload / renderer
// and turns Firestore documents into presentable <Product> items.

import { Firestore }            from '@google-cloud/firestore';
import * as overlay             from './overlay';

const db  = new Firestore();

/* ---------- types shared with the renderer ------------------- */
export type Product = {
  id:   string;
  title:string;
  featuredImage:{ url:string; altText:string|null };
};

/* ---------- helpers ------------------------------------------ */
const CDN = 'https://cdn.my‑stickers.com';       // change if needed
function imgUrl(id:string){ return `${CDN}/${encodeURIComponent(id)}.png`; }

function prettify(id:string){
  return id.replace(/[_\-]+/g,' ')              // snake_case → spaces
           .replace(/\b\w/g,c=>c.toUpperCase());// title‑case
}

/* ---------- API exposed through ipcMain ---------------------- */
export async function getMyStickers(email:string):Promise<Product[]>{
  const snap = await db.collection('entitlements').doc(email).get();
  if (!snap.exists) return [];

  const { ids=[] } = snap.data() as { ids:string[] };

  return ids.map<Product>(id=>({
    id,
    title: prettify(id),
    featuredImage:{ url:imgUrl(id), altText:id }
  }));
}

/* start / stop real‑time overlay pushes ----------------------- */
export async function startRealtime(email:string){
  const { watch } = await import('./firestore');   // ← lazy load
  await watch(email);
}
export async function stopRealtime(){
  const { unwatch } = await import('./firestore');
  unwatch();
}
