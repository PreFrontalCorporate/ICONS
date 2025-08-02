// app/web/pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import { shopifyFetch } from '@/lib/shopify';

/**
 * POST /api/login  { email, password }
 * — Creates a Shopify customer‑token and stores it in an http‑only cookie “cat”.
 *   The cookie lives for 365 days and is refreshed on each successful login.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body as { email: string; password: string };

  /* ------------------------------------------------- 1. create token */
  const { customerAccessTokenCreate } = await shopifyFetch<{
    customerAccessTokenCreate: {
      customerAccessToken: { accessToken: string; expiresAt: string } | null;
      customerUserErrors:   { message: string }[];
    };
  }>(
    `
      mutation login($email: String!, $password: String!) {
        customerAccessTokenCreate(input: { email:$email, password:$password }) {
          customerAccessToken { accessToken expiresAt }
          customerUserErrors { message }
        }
      }
    `,
    { email, password },
  );

  if (!customerAccessTokenCreate.customerAccessToken) {
    const message = customerAccessTokenCreate.customerUserErrors[0]?.message ?? 'Login failed';
    return res.status(401).json({ message });
  }

  /* --------------------------------------------- 2. set year‑long cookie */
  const maxAge = 60 * 60 * 24 * 365;                     // 1 year

  res.setHeader(
    'Set-Cookie',
    serialize('cat', customerAccessTokenCreate.customerAccessToken.accessToken, {
      httpOnly : true,
      sameSite : 'lax',                                   // keep “none”+secure when on HTTPS
      secure   : process.env.NODE_ENV === 'production',
      path     : '/',
      maxAge,
    }),
  );

  res.status(200).end();
}
