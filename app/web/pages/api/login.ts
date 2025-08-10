// app/web/pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import { shopifyFetch } from '@/lib/shopify'; // already in your repo. :contentReference[oaicite:1]{index=1}

// 30 days
const maxAge = 60 * 60 * 24 * 30;

/**
 * POST /api/login  { email, password }
 * Creates a Shopify customer token and stores it as http‑only cookie "cat".
 * Because this route is called from an <iframe> in the desktop app, the cookie
 * must be set as SameSite=None; Secure to be allowed in a third‑party context.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

  const q = /* GraphQL */ `
    mutation ($email: String!, $password: String!) {
      customerAccessTokenCreate(input: { email: $email, password: $password }) {
        customerAccessToken { accessToken, expiresAt }
        customerUserErrors { message }
      }
    }
  `;

  const { customerAccessTokenCreate } = await shopifyFetch<{
    customerAccessTokenCreate: {
      customerAccessToken?: { accessToken: string; expiresAt: string } | null;
      customerUserErrors?: { message: string }[];
    };
  }>(q, { email, password });

  const tok = customerAccessTokenCreate?.customerAccessToken?.accessToken;
  if (!tok) {
    const msg = customerAccessTokenCreate?.customerUserErrors?.[0]?.message ?? 'Invalid credentials';
    return res.status(401).json({ error: msg });
  }

  // IMPORTANT: works in Electron’s <iframe> only with SameSite=None; Secure
  res.setHeader('Set-Cookie',
    serialize('cat', tok, {
      httpOnly: true,
      sameSite: 'none',     // was "lax" before, which gets dropped in an iframe. :contentReference[oaicite:2]{index=2}
      secure: true,         // required when SameSite=None
      path: '/',
      maxAge,
    })
  );

  res.status(200).end();
}
