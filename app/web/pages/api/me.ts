import type { NextApiRequest, NextApiResponse } from 'next';
import { shopifyFetch } from '@/lib/shopify';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies.cat;
  if (!token) return res.status(401).end();

  type Edge = { node:{ id:string title:string featuredImage:{ url:string altText:string } } };
  const q = `query ($tok:String!){
    customer(customerAccessToken:$tok){
      id
      orders(first:250){
        edges{
          node{
            lineItems(first:10){
              edges{
                node{ id title
                  variant{ product{ id title featuredImage{url altText} tags } }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const rsp = await shopifyFetch<any>(q, { tok: token }).catch(() => null);
  const products: Edge[] = rsp?.customer?.orders?.edges
    ?.flatMap((o:any) => o.node.lineItems.edges)
    ?.map((e:any) => e.node.variant.product) ?? [];

  return res.json(Array.isArray(products) ? products : []);
}
