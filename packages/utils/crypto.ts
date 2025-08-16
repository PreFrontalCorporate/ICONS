export async function sha256(textOrBuffer: string | ArrayBuffer) {
  const buf =
    typeof textOrBuffer === 'string'
      ? new TextEncoder().encode(textOrBuffer)
      : textOrBuffer;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
