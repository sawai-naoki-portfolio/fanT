/** A 3D colour lookup table as an RGBA8 image (see `film_v1`'s `lut` child). */
export interface LutImage {
  /** Entries per channel; the image is `size * size` wide and `size` tall. */
  readonly size: number;
  readonly width: number;
  readonly height: number;
  /** Opaque RGBA8 pixels in row-major order. */
  readonly pixels: Uint8Array;
}

/** Smallest and largest LUT sizes accepted from content (.cube files are usually 17–65). */
export const LUT_SIZE_RANGE = { min: 2, max: 65 } as const;

/**
 * Lays out a LUT given as a function of normalized (r, g, b), blue selecting the
 * slice. With linear filtering, a size-2 identity LUT reproduces any colour exactly.
 */
export function makeLut(
  size: number,
  map: (r: number, g: number, b: number) => readonly [number, number, number],
): LutImage {
  if (!Number.isInteger(size) || size < LUT_SIZE_RANGE.min || size > LUT_SIZE_RANGE.max) {
    throw new RangeError(`Invalid LUT size: ${String(size)}`);
  }
  const width = size * size;
  const pixels = new Uint8Array(width * size * 4);
  const last = size - 1;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const rgb = map(r / last, g / last, b / last);
        const offset = (g * width + b * size + r) * 4;
        for (let channel = 0; channel < 3; channel++) {
          pixels[offset + channel] = Math.round(Math.min(1, Math.max(0, rgb[channel] ?? 0)) * 255);
        }
        pixels[offset + 3] = 255;
      }
    }
  }
  return { size, width, height: size, pixels };
}

/** The LUT bound when a film has none (its `lutIntensity` is then 0 anyway). */
export const IDENTITY_LUT: LutImage = makeLut(2, (r, g, b) => [r, g, b]);

function parseTriple(parts: readonly string[], line: string): readonly [number, number, number] {
  const values = parts.map(Number);
  const [r, g, b] = values;
  if (values.length !== 3 || r === undefined || g === undefined || b === undefined) {
    throw new Error(`Expected three numbers: "${line}"`);
  }
  if (!values.every(Number.isFinite)) throw new Error(`Invalid number in "${line}"`);
  return [r, g, b];
}

/**
 * Parses an Adobe/Resolve `.cube` 3D LUT (STU-03). Rejects 1D LUTs, sizes outside
 * `LUT_SIZE_RANGE`, a wrong number of entries and non-numeric values, so a broken
 * file never becomes a broken film.
 */
export function parseCubeLut(text: string): LutImage {
  let size: number | null = null;
  let domainMin: readonly number[] = [0, 0, 0];
  let domainMax: readonly number[] = [1, 1, 1];
  const entries: (readonly [number, number, number])[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const [keyword = '', ...rest] = line.split(/\s+/);
    if (keyword === 'TITLE') continue;
    if (keyword === 'LUT_1D_SIZE') throw new Error('1D LUTs are not supported');
    if (keyword === 'LUT_3D_SIZE') {
      size = Number(rest[0]);
      if (!Number.isInteger(size) || size < LUT_SIZE_RANGE.min || size > LUT_SIZE_RANGE.max) {
        throw new RangeError(`Invalid LUT size: ${String(rest[0])}`);
      }
      continue;
    }
    if (keyword === 'DOMAIN_MIN' || keyword === 'DOMAIN_MAX') {
      const values = parseTriple(rest, line);
      if (keyword === 'DOMAIN_MIN') domainMin = values;
      else domainMax = values;
      continue;
    }
    entries.push(parseTriple([keyword, ...rest], line));
    // Stops a huge or malformed file early instead of reading it all into memory.
    if (entries.length > (size ?? LUT_SIZE_RANGE.max) ** 3) throw new Error('Too many LUT entries');
  }

  if (size === null) throw new Error('Missing LUT_3D_SIZE');
  if (entries.length !== size ** 3) {
    throw new Error(`Expected ${String(size ** 3)} entries, got ${String(entries.length)}`);
  }
  const lutSize = size;
  const last = lutSize - 1;
  const normalize = (value: number, channel: number) => {
    const min = domainMin[channel] ?? 0;
    const max = domainMax[channel] ?? 1;
    return max > min ? (value - min) / (max - min) : 0;
  };
  return makeLut(lutSize, (r, g, b) => {
    const index =
      Math.round(r * last) + Math.round(g * last) * lutSize + Math.round(b * last) * lutSize ** 2;
    const [er, eg, eb] = entries[index] ?? [0, 0, 0];
    return [normalize(er, 0), normalize(eg, 1), normalize(eb, 2)];
  });
}
