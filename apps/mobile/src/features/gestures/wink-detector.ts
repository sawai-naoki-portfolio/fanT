export type Eye = 'left' | 'right';

/** Probability (0–1) that each eye is open, from the user's own point of view. */
export interface EyeOpenness {
  readonly left: number;
  readonly right: number;
}

export interface WinkDetectorOptions {
  /** An eye counts as closed below this probability… */
  readonly closedBelow: number;
  /** …and as open above this one; the gap keeps borderline values from flickering. */
  readonly openAbove: number;
  /** How long one eye must stay closed while the other stays open. */
  readonly holdMs: number;
  /** Minimum time between two winks. */
  readonly cooldownMs: number;
}

const DEFAULT_WINK_OPTIONS: WinkDetectorOptions = {
  closedBelow: 0.3,
  openAbove: 0.6,
  holdMs: 700,
  cooldownMs: 1000,
};

export interface WinkDetector {
  /**
   * Feeds one observation (`null` when no face is visible) and returns the winking
   * eye once a wink completes. A wink fires once; the next one needs both eyes to
   * open again and the cooldown to pass, so blinks and long winks never repeat.
   */
  update(eyes: EyeOpenness | null, now: number): Eye | null;
}

export function createWinkDetector(
  options: WinkDetectorOptions = DEFAULT_WINK_OPTIONS,
): WinkDetector {
  const isOpen = (probability: number) => probability > options.openAbove;
  const isClosed = (probability: number) => probability < options.closedBelow;

  const winkingEye = ({ left, right }: EyeOpenness): Eye | null => {
    if (isClosed(left) && isOpen(right)) return 'left';
    if (isClosed(right) && isOpen(left)) return 'right';
    return null;
  };

  let holding: { readonly eye: Eye; readonly since: number } | null = null;
  let awaitingRelease = false;
  let quietUntil = Number.NEGATIVE_INFINITY;

  return {
    update(eyes, now) {
      if (awaitingRelease) {
        if (eyes !== null && isOpen(eyes.left) && isOpen(eyes.right)) awaitingRelease = false;
        return null;
      }

      const eye = eyes === null || now < quietUntil ? null : winkingEye(eyes);
      if (eye === null) {
        holding = null;
        return null;
      }
      if (holding?.eye !== eye) {
        holding = { eye, since: now };
        return null;
      }
      if (now - holding.since < options.holdMs) return null;

      holding = null;
      awaitingRelease = true;
      quietUntil = now + options.cooldownMs;
      return eye;
    },
  };
}
