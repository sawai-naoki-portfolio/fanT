/**
 * The width and height of a JPEG from its frame header (an SOFn marker), without
 * decoding it; `null` when the header cannot be found.
 */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2; // after the start-of-image marker
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] ?? 0;
    // Fill bytes and markers without a length.
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += marker === 0xff ? 1 : 2;
      continue;
    }
    const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    // Start-of-frame markers, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0);
      const width = ((bytes[offset + 7] ?? 0) << 8) | (bytes[offset + 8] ?? 0);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}
