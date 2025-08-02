import type { NextApiRequest, NextApiResponse } from 'next';
import { shopifyFetch } from '@/lib/shopify';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies.cat;
  if (!token) return res.status(401).end();

  // ✅ TS now parses: semicolons between fields
  type Edge = {
    node: {
      id: string;
      title: string;
      featuredImage: { url: string; altText: string | null };
    };
  };

  const q = /* GraphQL */ `
    query ($tok: String!) {
      customer(customerAccessToken: $tok) {
        orders(first: 50, reverse: true) {
          edges {
            node {
              lineItems(first: 10) {
                edges {
                  node {
                    variant {
                      product {
                        id
                        title
                        featuredImage {
                          url
                          altText
                        }
                      }
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

  // narrow generic
  const { customer } = await shopifyFetch<{
    customer: {
      orders: { edges: { node: { lineItems: { edges: { node: { variant: { product: Edge['node'] } } }[] } } }[] };
    };
  }>(q, { tok: token });

  // flatten to Product[]
  const products =
    customer?.orders.edges.flatMap(o =>
      o.node.lineItems.edges.map(l => l.node.variant.product),
    ) ?? [];

  res.json(products);
}
