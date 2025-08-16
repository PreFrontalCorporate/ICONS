import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'node:crypto';
import { PubSub } from '@google-cloud/pubsub';

const secret = process.env.SHOPIFY_WEBHOOK_SECRET!;
const topic  = new PubSub().topic('stickers-new');

export const config = { api: { bodyParser: false } };   // raw body

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  const hmac = req.headers['x-shopify-hmac-sha256'] as string;
  const raw  = await new Promise<Buffer>(resolve=>{
    const chunks: Buffer[] = [];
    req.on('data',c=>chunks.push(c));
    req.on('end',()=>resolve(Buffer.concat(chunks)));
  });

  const digest = crypto.createHmac('sha256', secret).update(raw).digest('base64');
  if (digest !== hmac) return res.status(401).end('HMAC mismatch');

  const payload = JSON.parse(raw.toString());
  const ids = payload.line_items.map((l:any)=>l.product_id).filter(Boolean);
  if (ids.length) await topic.publishMessage({ json: { ids } });

  res.status(200).end('ok');
}
