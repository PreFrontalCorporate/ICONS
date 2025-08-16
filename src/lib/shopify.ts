import { GraphQLClient } from 'graphql-request';

const client = new GraphQLClient(
  process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ENDPOINT!,
  {
    headers: {
      'X-Shopify-Storefront-Access-Token':
        process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN!
    }
  }
);

export async function verifyPurchase(multipass: string) {
  const res = await fetch('https://icon.cbb.homes/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: multipass })
  });
  if (!res.ok) throw new Error('Verification failed');
  return (await res.json()) as { allowedIds: string[]; manifestHash: string };
}
