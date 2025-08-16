import { Firestore } from '@google-cloud/firestore';
import * as overlay from './overlay';

const db  = new Firestore();
let stop = () => {};           // unsubscribe placeholder

/** watch /entitlements/<email> and fire overlay on new IDs */
export async function watch(email: string) {
  // stop previous listener (if any)
  stop();

  stop = db.collection('entitlements')
           .doc(email)
           .onSnapshot(snap => {
              if (!snap.exists) return;
              const { ids=[] } = snap.data() as { ids:string[] };
              ids.forEach(id=>{
                // url rule: you already store SKU → image somewhere ↓
                const url = `https://cdn.my‑stickers.com/${id}.png`;
                overlay.createOverlay('auto-'+id, url);
              });
           },
           err => console.error('🔥 Firestore watch error', err));
}

export function unwatch() { stop(); }
