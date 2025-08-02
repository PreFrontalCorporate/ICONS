import type { NextRequest } from 'next/server';
import { decode } from '@shopify/multipass';          // npm i @shopify/multipass
import { Shopify } from '@shopify/shopify-api';

const shopify = new Shopify({
  apiKey:  process.env.SHOPIFY_ADMIN_KEY!,
  apiSecretKey: process.env.SHOPIFY_ADMIN_SECRET!,
  scopes: ['read_customers', 'read_orders'],
  shop:   process.env.SHOPIFY_SHOP!,
  apiVersion: '2024-07'
});

export async function POST(req: NextRequest) {
  const { token } = (await req.json()) as { token: string };
  if (!token) return new Response('Missing token', { status: 400 });

  // 1️⃣ Decode Multipass → customer.id
  let customerId: string;
  try {
    const customer = decode(
      token,
      process.env.SHOPIFY_MULTIPASS_SECRET!
    ) as { id: string };
    customerId = customer.id;
  } catch {
    return new Response('Invalid token', { status: 401 });
  }

  // 2️⃣ Fetch customer’s paid stickers (any product in “Stickers” collection)
  const orders = await shopify.rest.Order.all({
    customer_id: customerId,
    status: 'any',
    fields: 'line_items'
  });

  const allowedIds = new Set<string>();
  orders.forEach((o: any) =>
    o.line_items.forEach((li: any) => allowedIds.add(li.sku.toLowerCase()))
  );

  // 3️⃣ Return list + current manifest hash for tamper check
  const manifest = await import('@/packages/stickers/index.json');
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(manifest.default))
  );
  const manifestHash = Buffer.from(hash).toString('hex');

  return Response.json({ allowedIds: Array.from(allowedIds), manifestHash });
}
