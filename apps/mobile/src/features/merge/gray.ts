/** A small greyscale copy of a photo (luma 0–1), for finding how photos line up. */
export interface Gray {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;
}

/** Luma of RGBA8 pixels, e.g. from `samplePixels`. */
export function toGray(sample: {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
}): Gray {
  const { width, height, pixels } = sample;
  const data = new Float32Array(width * height);
  for (let index = 0; index < data.length; index++) {
    data[index] =
      (0.2126 * (pixels[index * 4] ?? 0) +
        0.7152 * (pixels[index * 4 + 1] ?? 0) +
        0.0722 * (pixels[index * 4 + 2] ?? 0)) /
      255;
  }
  return { width, height, data };
}

/** Half the size, each pixel the average of four. */
export function halve(gray: Gray): Gray {
  const width = Math.max(1, Math.floor(gray.width / 2));
  const height = Math.max(1, Math.floor(gray.height / 2));
  const data = new Float32Array(width * height);
  const at = (x: number, y: number) =>
    gray.data[Math.min(y, gray.height - 1) * gray.width + Math.min(x, gray.width - 1)] ?? 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] =
        (at(x * 2, y * 2) +
          at(x * 2 + 1, y * 2) +
          at(x * 2, y * 2 + 1) +
          at(x * 2 + 1, y * 2 + 1)) /
        4;
    }
  }
  return { width, height, data };
}
