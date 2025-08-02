import type { NextApiRequest, NextApiResponse } from 'next';
import { shopifyFetch } from '@/lib/shopify';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = JSON.parse(req.body ?? '{}');

  const { customerAccessTokenCreate } = await shopifyFetch<{
    customerAccessTokenCreate: {
      customerAccessToken: { accessToken: string; expiresAt: string } | null;
      customerUserErrors: { message: string }[];
    };
  }>(`mutation ($email:String!, $password:String!) {
        customerAccessTokenCreate(input:{email:$email,password:$password}) {
          customerAccessToken { accessToken expiresAt }
          customerUserErrors { message }
        }
      }`, { email, password });

  const tok = customerAccessTokenCreate.customerAccessToken?.accessToken;
  if (!tok) return res.status(401).json({ ok:false });

  /* ---------- cookie ---------- */
  const prod  = process.env.NODE_ENV === 'production';
  const max   = 60 * 60 * 24 * 14;                // 14 days
  res.setHeader('Set-Cookie', serialize('cat', tok, {
    httpOnly : true,
    sameSite : prod ? 'none' : 'lax',
    secure   : prod,
    path     : '/',
    maxAge   : max
  }));

  res.json({ ok:true });
}

