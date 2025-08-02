import type { NextApiRequest, NextApiResponse } from 'next';
import { shopify } from '@/lib/shopify';

const mutation = /* GraphQL */ `
  mutation login($email: String!, $password: String!) {
    customerAccessTokenCreate(input: { email: $email, password: $password }) {
      customerAccessToken { accessToken, expiresAt }
      userErrors { message }
    }
  }
`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body;
  const data = await shopify(mutation, { email, password } as any);

  const token = data.customerAccessTokenCreate?.customerAccessToken?.accessToken;
  if (!token) return res.status(401).json({ error: 'Invalid credentials' });

  // http‑only cookie – expires in 30 days
  res.setHeader('Set-Cookie',
    `shop_token=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
  );
  res.status(200).json({ ok: true });
}
