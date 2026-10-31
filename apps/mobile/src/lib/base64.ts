const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 with padding (RFC 4648 §4). */
export function toBase64(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    output += ALPHABET[(triple >> 18) & 63] ?? '';
    output += ALPHABET[(triple >> 12) & 63] ?? '';
    output += b === undefined ? '=' : (ALPHABET[(triple >> 6) & 63] ?? '');
    output += c === undefined ? '=' : (ALPHABET[triple & 63] ?? '');
  }
  return output;
}

/** URL-safe base64 without padding (RFC 4648 §5), e.g. for secrets. */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
