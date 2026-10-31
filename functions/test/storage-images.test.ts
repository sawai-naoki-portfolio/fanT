import { describe, expect, it } from 'vitest';

import { contentTypeOf } from '../src/adapters/storage-images';

describe('contentTypeOf', () => {
  it('tells PNG, MP4 and JPEG results apart', () => {
    expect(contentTypeOf(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe('image/png');
    expect(contentTypeOf(new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]))).toBe(
      'video/mp4',
    );
    expect(contentTypeOf(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBe('image/jpeg');
  });
});
