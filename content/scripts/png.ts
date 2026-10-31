import { crc32, deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Encodes opaque-or-not RGBA8 pixels as a PNG (no filtering; LUTs compress well anyway). */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(6, 9); // colour type: RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Decodes a PNG written by `encodePng` (RGBA8, unfiltered), for tests. */
export function decodePng(png: Buffer): { width: number; height: number; rgba: Uint8Array } {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    rgba.set(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), y * stride);
  }
  return { width, height, rgba };
}
