/** Ways to merge photos into one: exposures of one scene (EDT-26) or a pan (EDT-27). */
export const MERGE_MODES = {
  hdr: { min: 2, max: 3, kind: 'hdr', previewEdge: 1024, outputEdge: 4000 },
  panorama: { min: 2, max: 6, kind: 'panorama', previewEdge: 480, outputEdge: 2400 },
} as const;
export type MergeMode = keyof typeof MERGE_MODES;

export function isMergeMode(value: string | undefined): value is MergeMode {
  return value === 'hdr' || value === 'panorama';
}

/** Whether `count` selected photos can be merged this way. */
export function canMerge(mode: MergeMode, count: number): boolean {
  return count >= MERGE_MODES[mode].min && count <= MERGE_MODES[mode].max;
}
