// app/web/pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import { shopifyFetch } from '@/lib/shopify';

/**
 * POST /api/login  { email, password }
 * — Creates a Shopify customer‑token and stores it in an http‑only cookie “cat”.
 *   Cookie lasts 365 days. We set SameSite=None so it also works when the page
 *   runs inside Electron (iframe / cross-site).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body as { email: string; password: string };

  // 1) create token via Shopify Storefront API
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

  // 2) set year‑long cookie
  const maxAge = 60 * 60 * 24 * 365;
  res.setHeader(
    'Set-Cookie',
    serialize('cat', customerAccessTokenCreate.customerAccessToken.accessToken, {
      httpOnly : true,
      sameSite : 'none',         // ← was 'lax'
      secure   : true,           // required by browsers for SameSite=None
      path     : '/',
      maxAge,
    }),
  );

  res.status(200).end();
}
