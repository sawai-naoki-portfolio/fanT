import { describe, expect, it } from 'vitest';

import { toBase64, toBase64Url } from './base64';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('base64', () => {
  // RFC 4648 §10 test vectors.
  it.each([
    ['', ''],
    ['f', 'Zg=='],
    ['fo', 'Zm8='],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg=='],
    ['fooba', 'Zm9vYmE='],
    ['foobar', 'Zm9vYmFy'],
  ])('encodes %p as %p', (text, encoded) => {
    expect(toBase64(bytes(text))).toBe(encoded);
  });

  it('uses the URL-safe alphabet without padding', () => {
    expect(toBase64(new Uint8Array([0xfb, 0xff]))).toBe('+/8=');
    expect(toBase64Url(new Uint8Array([0xfb, 0xff]))).toBe('-_8');
    expect(toBase64Url(new Uint8Array(32))).toHaveLength(43);
  });
});
