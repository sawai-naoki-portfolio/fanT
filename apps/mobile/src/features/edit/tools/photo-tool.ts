import type { PhotoPoint } from '../panels/panel-props';
import type { PhotoMarker } from '../photo-tap-layer';

/** A tool that places things where the photo is tapped, and shows them on it. */
export interface PhotoTool {
  readonly onTap: (point: PhotoPoint) => void;
  readonly markers: readonly PhotoMarker[];
}
