import type { NextApiRequest, NextApiResponse } from 'next';
import { shopify } from '@/lib/shopify';

const query = /* GraphQL */ `
  query me($token: String!) {
    customer(customerAccessToken: $token) {
      firstName
      orders(first: 50) {
        edges {
          node {
            lineItems(first: 10) {
              edges {
                node {
                  product {
                    id
                    title
                    featuredImage { url altText }
                    tags
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies['shop_token'];
  if (!token) return res.status(401).end();

  try {
    const data = await shopify(query, { token });
    const products = data.customer.orders.edges
      .flatMap((e: any) => e.node.lineItems.edges)
      .map((e: any) => e.node.product)
      .filter((p: any) => p.tags.includes('sticker'));

    res.status(200).json(products);
  } catch (e) {
    res.status(401).json({ error: 'Token expired' });
  }
}
