import { drawBackdrop } from '../../backdrop';
import { drawImage, keepMasked, layered } from '../drawing';
import type { RetouchStep } from '../types';

/** A new background behind the people (EDT-16); the film then lights it like the rest. */
export const backdropStep: RetouchStep = {
  applies: ({ mask, backdrop }) => mask !== null && backdrop !== null,
  run: ({ canvas, size, current }, { mask, backdrop }) => {
    if (mask === null || backdrop === null) return;
    const photo = current();
    layered(
      canvas,
      () => {
        drawBackdrop(canvas, backdrop, size.width, size.height);
      },
      () => {
        drawImage(canvas, photo);
      },
      () => {
        keepMasked(canvas, mask);
      },
    );
  },
};
