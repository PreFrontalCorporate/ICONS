import { Shopify } from '@shopify/shopify-api';
import { decode } from '@shopify/multipass';

export async function verifyPurchase(token: string) {
  const shopify = new Shopify({
    apiKey: process.env.SHOPIFY_ADMIN_KEY!,
    apiSecretKey: process.env.SHOPIFY_ADMIN_SECRET!,
    scopes: ['read_customers', 'read_orders'],
    shop: process.env.SHOPIFY_SHOP!,
    apiVersion: '2024-07'
  });

  const { id } = decode(token, process.env.SHOPIFY_MULTIPASS_SECRET!) as {
    id: string;
  };

  const orders = await shopify.rest.Order.all({
    customer_id: id,
    status: 'any',
    fields: 'line_items'
  });

  const allowed = new Set<string>();
  orders.forEach((o: any) => o.line_items.forEach((li: any) => allowed.add(li.sku.toLowerCase())));
  return Array.from(allowed);
}
