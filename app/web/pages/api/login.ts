import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import { shopifyFetch } from '@/lib/shopify';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body as { email: string; password: string };

  // 1. create token -----------------------------------------------------------
  const data = await shopifyFetch<{
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
    { email, password }
  );

  const result = data.customerAccessTokenCreate;

  if (!result.customerAccessToken) {
    const message = result.customerUserErrors[0]?.message ?? 'Login failed';
    return res.status(401).json({ message });
  }

  // 2. set http‑only cookie ---------------------------------------------------
  res.setHeader(
    'Set-Cookie',
    serialize('cat', result.customerAccessToken.accessToken, {
      httpOnly : true,
      sameSite : 'lax',          // <-- change to 'none', secure:true when on HTTPS domain
      path     : '/',
      maxAge   : 60 * 60 * 24 * 30, // 30 days
    })
  );

  res.status(200).end();
}
