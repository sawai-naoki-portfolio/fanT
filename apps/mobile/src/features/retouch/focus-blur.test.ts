import { describe, expect, it } from 'vitest';

import { focusBlurSigma, focusGradient, NO_FOCUS_BLUR } from './focus-blur';

const SIZE = { width: 400, height: 300 };

describe('focus blur', () => {
  it('is off by default', () => {
    expect(NO_FOCUS_BLUR.amount).toBe(0);
    expect(focusBlurSigma(NO_FOCUS_BLUR, SIZE)).toBe(0);
  });

  it('keeps a circle sharp, fading out over as much again', () => {
    const gradient = focusGradient(
      { ...NO_FOCUS_BLUR, shape: 'radial', x: 0.5, y: 0.5, size: 0.1 },
      SIZE,
    );
    expect(gradient).toEqual({
      kind: 'radial',
      center: { x: 200, y: 150 },
      radius: 60,
      sharpTo: 0.5,
    });
  });

  it('runs a horizontal band from above to below the focus point', () => {
    const gradient = focusGradient({ ...NO_FOCUS_BLUR, x: 0.5, y: 0.5, size: 0.1, angle: 0 }, SIZE);
    expect(gradient.kind).toBe('linear');
    if (gradient.kind !== 'linear') return;
    expect(gradient.from.x).toBeCloseTo(200);
    expect(gradient.from.y).toBeCloseTo(90);
    expect(gradient.to.y).toBeCloseTo(210);
  });

  it('turns the band with its angle', () => {
    const gradient = focusGradient(
      { ...NO_FOCUS_BLUR, x: 0.5, y: 0.5, size: 0.1, angle: 90 },
      SIZE,
    );
    if (gradient.kind !== 'linear') throw new Error('expected a band');
    expect(gradient.from.y).toBeCloseTo(150);
    expect(Math.abs(gradient.to.x - gradient.from.x)).toBeCloseTo(120);
  });

  it('blurs more on larger photos, so it looks the same at any size', () => {
    const focus = { ...NO_FOCUS_BLUR, amount: 1 };
    expect(focusBlurSigma(focus, { width: 4000, height: 3000 })).toBe(
      focusBlurSigma(focus, SIZE) * 10,
    );
  });
});
