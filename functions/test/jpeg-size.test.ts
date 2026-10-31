import { describe, expect, it } from 'vitest';

import { jpegSize } from '../src/domain/jpeg-size';

/** A minimal JPEG header: SOI, an APP0 segment, then a baseline frame header. */
function jpeg(width: number, height: number, frameMarker = 0xc0): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00,
    0xff,
    frameMarker,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
    0x00,
    0x00,
    0x00,
  ]);
}

describe('jpegSize', () => {
  it('reads the size from a baseline or progressive frame header', () => {
    expect(jpegSize(jpeg(1024, 768))).toEqual({ width: 1024, height: 768 });
    expect(jpegSize(jpeg(576, 1024, 0xc2))).toEqual({ width: 576, height: 1024 });
  });

  it('skips Huffman tables, which share the C-range of markers', () => {
    const withTable = jpeg(10, 20, 0xc4);
    expect(jpegSize(withTable)).toBeNull();
  });

  it('gives up on anything that is not a JPEG header', () => {
    expect(jpegSize(new Uint8Array([0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(jpegSize(new Uint8Array())).toBeNull();
  });
});
