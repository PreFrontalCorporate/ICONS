const domain  = process.env.SHOPIFY_STORE_DOMAIN!;
const token   = process.env.SHOPIFY_STOREFRONT_TOKEN!;
const endpoint = `https://${domain}/api/2024-04/graphql.json`;

export async function shopify<T = any>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-Shopify-Storefront-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 },        // ISR on Vercel, stale‑while‑revalidate on Cloud Run
  });
  const { data, errors } = await res.json();
  if (errors) throw new Error(errors[0].message);
  return data;
}
