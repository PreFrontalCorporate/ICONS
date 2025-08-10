// app/web/pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import { shopifyFetch } from '@/lib/shopify';

// helper: 30 days
const maxAge = 60 * 60 * 24 * 30;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

  const q = /* GraphQL */ `
    mutation ($email: String!, $password: String!) {
      customerAccessTokenCreate(input: { email: $email, password: $password }) {
        customerAccessToken { accessToken, expiresAt }
        userErrors { message }
      }
    }
  `;

  const { customerAccessTokenCreate } = await shopifyFetch<{
    customerAccessTokenCreate: {
      customerAccessToken?: { accessToken: string; expiresAt: string } | null;
      userErrors: { message: string }[];
    };
  }>(q, { email, password });

  const tok = customerAccessTokenCreate?.customerAccessToken?.accessToken;
  if (!tok) {
    // (optional) bubble up Shopify error text
    const msg = customerAccessTokenCreate?.userErrors?.[0]?.message ?? 'Invalid credentials';
    return res.status(401).json({ error: msg });
  }

  // IMPORTANT: third‑party cookie in an iframe needs SameSite=None + Secure
  res.setHeader(
    'Set-Cookie',
    serialize('cat', tok, {
      httpOnly: true,
      sameSite: 'none',   // <- was 'lax'
      secure: true,       // required by Chrome for SameSite=None
      path: '/',
      maxAge,
    }),
  );

  res.status(200).end();
}
