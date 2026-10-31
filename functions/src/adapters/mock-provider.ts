import type { ImageGenerator, ImageUpscaler, Moderator, VideoGenerator } from '../ports';

/**
 * Stand-ins until the image generation provider is chosen (Q-04): the "generated"
 * image is the upload itself and moderation allows everything. Only for the
 * emulator and staging: production refuses to start with them (see `index.ts`).
 */
export const echoGenerator: ImageGenerator = {
  generate: (image) => Promise.resolve(image),
};

export const echoUpscaler: ImageUpscaler = {
  upscale: (image) => Promise.resolve(image),
};

/** There is no stand-in video: the job fails and its credits are refunded. */
export const noVideoGenerator: VideoGenerator = {
  animate: () => Promise.reject(new Error('Videos need AI_PROVIDER=google')),
};

export const allowAllModerator: Moderator = {
  isAllowed: () => Promise.resolve(true),
};
