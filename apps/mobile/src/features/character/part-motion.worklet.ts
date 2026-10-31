import type { PartMotion } from '@fant/content-schema';

import type { PartPlacement } from './face-geometry.worklet';

/** A repeatable pseudo-random number in [0, 1) for particle `n`. */
function random(n: number): number {
  'worklet';
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The copies of a moving part at `time` seconds (CHR-08): petals falling, hearts
 * rising, sparkles orbiting the head or twinkling around their place. Each copy has
 * its own phase, so they never move in step. `faceWidth` sets how far they travel.
 */
export function moveParts(
  base: PartPlacement,
  motion: PartMotion,
  faceWidth: number,
  time: number,
): PartPlacement[] {
  'worklet';
  const placements: PartPlacement[] = [];
  const spread = motion.spread * faceWidth;
  for (let i = 0; i < motion.count; i++) {
    const r1 = random(i * 3 + 1);
    const r2 = random(i * 3 + 2);
    const r3 = random(i * 3 + 3);
    const cycle = r1 + time * motion.speed;
    const phase = cycle - Math.floor(cycle);
    const size = base.size * (0.6 + 0.4 * r3);
    const spin = r2 < 0.5 ? -1 : 1;
    let x = base.center.x;
    let y = base.center.y;
    let scale: number;
    let rotation = base.rotation;
    if (motion.type === 'fall' || motion.type === 'rise') {
      const sway = Math.sin((phase * 2 + r3) * Math.PI * 2) * 0.08 * faceWidth;
      const travel = phase * 1.2 * faceWidth;
      x += (r2 - 0.5) * spread + sway;
      y += motion.type === 'fall' ? travel : -travel;
      // Fades out by shrinking towards the end of its way.
      scale = phase < 0.8 ? 1 : (1 - phase) / 0.2;
      rotation += spin * phase * (motion.type === 'fall' ? 360 : 30);
    } else if (motion.type === 'orbit') {
      const angle = (i / motion.count + time * motion.speed) * Math.PI * 2;
      x += Math.cos(angle) * spread;
      y += Math.sin(angle) * spread * 0.3;
      // Larger in front of the head, smaller behind it.
      scale = 0.75 + 0.25 * Math.sin(angle);
    } else {
      x += (r2 - 0.5) * spread;
      y += (r3 - 0.5) * spread;
      scale = Math.sin(Math.PI * phase);
      rotation += phase * 90;
    }
    if (scale <= 0.01) continue;
    placements.push({ ...base, center: { x, y }, size: size * scale, rotation });
  }
  return placements;
}
