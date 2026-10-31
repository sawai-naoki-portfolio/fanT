import { drawImage, keepMasked, layered } from '../drawing';
import type { RetouchStep } from '../types';

/** Blur behind the people (EDT-11). */
export const backgroundBlurStep: RetouchStep = {
  applies: ({ mask, backgroundBlur }) => mask !== null && backgroundBlur > 0,
  run: ({ canvas, size, current }, { mask, backgroundBlur }) => {
    if (mask === null) return;
    const sharp = current();
    const sigma = backgroundBlur * Math.min(size.width, size.height) * 0.02;
    layered(
      canvas,
      () => {
        drawImage(canvas, sharp, sigma);
      },
      () => {
        drawImage(canvas, sharp);
      },
      () => {
        keepMasked(canvas, mask);
      },
    );
  },
};
