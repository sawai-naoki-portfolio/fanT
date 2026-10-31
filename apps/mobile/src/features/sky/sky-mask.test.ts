import { describe, expect, it } from 'vitest';

import { skyMask } from './sky-mask';

type Rgb = readonly [number, number, number];

function image(width: number, height: number, colorAt: (x: number, y: number) => Rgb) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) pixels.set([...colorAt(x, y), 255], (y * width + x) * 4);
  }
  return pixels;
}

const SKY: Rgb = [120, 170, 235];
const GROUND: Rgb = [70, 110, 50];
const LAKE: Rgb = [110, 160, 225];

const alphaAt = (mask: ReturnType<typeof skyMask>, x: number, y: number, width = 20) =>
  mask?.alpha[y * width + x] ?? -1;

describe('skyMask', () => {
  it('finds a blue sky above the horizon and not the ground', () => {
    const mask = skyMask(
      image(20, 20, (_x, y) => (y < 8 ? SKY : GROUND)),
      20,
      20,
    );
    expect(alphaAt(mask, 10, 2)).toBe(255);
    expect(alphaAt(mask, 10, 15)).toBe(0);
    // Softened at the horizon.
    expect(alphaAt(mask, 10, 7)).toBeGreaterThan(0);
    expect(alphaAt(mask, 10, 7)).toBeLessThan(255);
  });

  it('leaves out blue that does not reach the top, such as a lake', () => {
    const mask = skyMask(
      image(20, 20, (_x, y) => (y < 6 ? SKY : y < 12 ? GROUND : LAKE)),
      20,
      20,
    );
    expect(alphaAt(mask, 10, 2)).toBe(255);
    expect(alphaAt(mask, 10, 16)).toBe(0);
  });

  it('stops at a building that reaches the top edge', () => {
    const mask = skyMask(
      image(20, 20, (x, y) => (x >= 12 ? [90, 80, 75] : y < 10 ? SKY : GROUND)),
      20,
      20,
    );
    expect(alphaAt(mask, 4, 2)).toBe(255);
    expect(alphaAt(mask, 16, 2)).toBe(0);
  });

  it('takes white-grey clouds and an orange sunset as sky', () => {
    const cloudy = skyMask(
      image(20, 20, (_x, y) => (y < 8 ? [215, 218, 222] : GROUND)),
      20,
      20,
    );
    expect(alphaAt(cloudy, 10, 2)).toBe(255);
    const sunset = skyMask(
      image(20, 20, (_x, y) => (y < 8 ? [240, 150, 90] : GROUND)),
      20,
      20,
    );
    expect(alphaAt(sunset, 10, 2)).toBe(255);
  });

  it('finds no sky indoors or in a close-up', () => {
    expect(
      skyMask(
        image(20, 20, () => [150, 100, 80]),
        20,
        20,
      ),
    ).toBeNull();
  });

  it('refuses too few pixels', () => {
    expect(() => skyMask(new Uint8Array(4), 20, 20)).toThrow(RangeError);
  });
});
