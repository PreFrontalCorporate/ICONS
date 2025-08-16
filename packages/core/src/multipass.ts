import crypto from 'crypto';

/**
 * Verify a Shopify Multipass JWT created by Shopify Plus.
 * Returns the decoded JSON payload if valid, otherwise throws.
 *
 * Spec: https://shopify.dev/docs/api/multipass
 */
export function verifyMultipass(token: string, secret: string) {
  const data = Buffer.from(token, 'base64');

  const iv         = data.subarray(0, 16);
  const cipherText = data.subarray(16, data.length - 32);
  const sig        = data.subarray(data.length - 32);

  // Key derivation steps from Shopify spec
  const encryptionKey = crypto.createHash('sha256').update(secret).digest();
  const signingKey    = crypto.createHash('sha256').update(encryptionKey).digest();

  const expectedSig = crypto
    .createHmac('sha256', signingKey)
    .update(Buffer.concat([iv, cipherText]))
    .digest();

  if (!crypto.timingSafeEqual(sig, expectedSig))
    throw new Error('Multipass: signature mismatch');

  const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
  const json = Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');

  return JSON.parse(json) as Record<string, unknown>;
}
