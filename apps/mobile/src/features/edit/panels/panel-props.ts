import type { PhotoRecipe } from '../../photo/recipe';

/** What every editor panel gets: the recipe and a way to change it (undoable). */
export interface PanelProps {
  readonly recipe: PhotoRecipe;
  /** `key` groups rapid changes of one control into one undo step. */
  readonly update: (next: Partial<PhotoRecipe>, key?: string) => void;
}

/** A point on the photo, as fractions of its width and height. */
export interface PhotoPoint {
  readonly x: number;
  readonly y: number;
}
