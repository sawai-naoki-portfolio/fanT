import type { CharacterPart, FaceAnchor } from '@fant/content-schema';
import type { ShapedFace } from '@fant/filters';

import { apply, type Affine, type Point } from '../../engine/affine.worklet';

/** The parts of a detected face this app reads; the face detector's `Face` fits it. */
export interface DetectedFace {
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly landmarks?: {
    readonly LEFT_EYE?: Point;
    readonly RIGHT_EYE?: Point;
    readonly NOSE_BASE?: Point;
    readonly LEFT_CHEEK?: Point;
    readonly RIGHT_CHEEK?: Point;
    readonly MOUTH_LEFT?: Point;
    readonly MOUTH_RIGHT?: Point;
    readonly MOUTH_BOTTOM?: Point;
  };
  /** Outlines of the features (makeup, BTY-07); only the most prominent face has them. */
  readonly contours?: {
    readonly UPPER_LIP_TOP?: readonly Point[];
    readonly UPPER_LIP_BOTTOM?: readonly Point[];
    readonly LOWER_LIP_TOP?: readonly Point[];
    readonly LOWER_LIP_BOTTOM?: readonly Point[];
    readonly LEFT_EYE?: readonly Point[];
    readonly RIGHT_EYE?: readonly Point[];
    readonly LEFT_EYEBROW_TOP?: readonly Point[];
    readonly LEFT_EYEBROW_BOTTOM?: readonly Point[];
    readonly RIGHT_EYEBROW_TOP?: readonly Point[];
    readonly RIGHT_EYEBROW_BOTTOM?: readonly Point[];
  };
  /** Head rotation in degrees (left/right and up/down), for 3D effects (CHR-09). */
  readonly yawAngle?: number;
  readonly pitchAngle?: number;
}

/** A face's feature outlines in output pixels, as closed polygons. */
export interface FaceOutline {
  /** The whole lips. */
  readonly lips: readonly Point[] | null;
  /** The mouth opening between the lips (teeth, BTY-09). */
  readonly mouth: readonly Point[] | null;
  /** Left then right as seen in the image. */
  readonly eyes: readonly [readonly Point[], readonly Point[]] | null;
  readonly brows: readonly [readonly Point[], readonly Point[]] | null;
}

/**
 * A face in output (screen) pixels. "Left" and "right" are as seen in the image,
 * whatever the mirroring, so content can be designed once for both cameras.
 */
export interface FaceGeometry {
  readonly center: Point;
  readonly width: number;
  /** Tilt in degrees, clockwise. */
  readonly roll: number;
  readonly eyes: readonly [Point, Point] | null;
  readonly nose: Point | null;
  readonly cheeks: readonly [Point, Point] | null;
  readonly mouth: Point | null;
  readonly outline: FaceOutline | null;
  /** Head turned left/right and up/down, in degrees as seen in the image. */
  readonly yaw: number;
  readonly pitch: number;
}

/** Faces drawn per frame at most (BTY-05/CHR-05). */
const MAX_FACES = 4;

function sortedPair(a: Point | undefined, b: Point | undefined): readonly [Point, Point] | null {
  'worklet';
  if (a === undefined || b === undefined) return null;
  return a.x <= b.x ? [a, b] : [b, a];
}

/**
 * Points ordered around their centre, so outlines become simple polygons whatever
 * order the detector reports them in.
 */
export function polygonAround(points: readonly Point[]): Point[] {
  'worklet';
  let cx = 0;
  let cy = 0;
  for (const point of points) {
    cx += point.x;
    cy += point.y;
  }
  cx /= Math.max(1, points.length);
  cy /= Math.max(1, points.length);
  return [...points].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
}

function centreX(points: readonly Point[]): number {
  'worklet';
  let sum = 0;
  for (const point of points) sum += point.x;
  return sum / Math.max(1, points.length);
}

/** Two outlines ordered left then right as seen in the image, or `null`. */
function outlinePair(
  a: readonly Point[] | null,
  b: readonly Point[] | null,
): readonly [readonly Point[], readonly Point[]] | null {
  'worklet';
  if (a === null || b === null) return null;
  return centreX(a) <= centreX(b) ? [a, b] : [b, a];
}

function toOutline(face: DetectedFace, map: Affine): FaceOutline | null {
  'worklet';
  const contours = face.contours;
  if (contours === undefined) return null;
  const join = (...parts: (readonly Point[] | undefined)[]) => {
    'worklet';
    const points: Point[] = [];
    for (const part of parts) {
      if (part === undefined) return null;
      for (const point of part) points.push(apply(map, point));
    }
    return points.length < 3 ? null : polygonAround(points);
  };
  return {
    lips: join(contours.UPPER_LIP_TOP, contours.LOWER_LIP_BOTTOM),
    mouth: join(contours.UPPER_LIP_BOTTOM, contours.LOWER_LIP_TOP),
    eyes: outlinePair(join(contours.LEFT_EYE), join(contours.RIGHT_EYE)),
    brows: outlinePair(
      join(contours.LEFT_EYEBROW_TOP, contours.LEFT_EYEBROW_BOTTOM),
      join(contours.RIGHT_EYEBROW_TOP, contours.RIGHT_EYEBROW_BOTTOM),
    ),
  };
}

/** Converts a detected face to output pixels with `map` (detector → output coordinates). */
export function toFaceGeometry(face: DetectedFace, map: Affine): FaceGeometry {
  'worklet';
  const { x, y, width, height } = face.bounds;
  const corner1 = apply(map, { x, y });
  const corner2 = apply(map, { x: x + width, y: y + height });
  const mapped = (point: Point | undefined) => {
    'worklet';
    return point === undefined ? undefined : apply(map, point);
  };
  const landmarks = face.landmarks ?? {};
  const eyes = sortedPair(mapped(landmarks.LEFT_EYE), mapped(landmarks.RIGHT_EYE));
  const mouthPoints = [landmarks.MOUTH_LEFT, landmarks.MOUTH_RIGHT, landmarks.MOUTH_BOTTOM]
    .map(mapped)
    .filter((point): point is Point => point !== undefined);
  const mouth =
    mouthPoints.length === 0
      ? null
      : {
          x: mouthPoints.reduce((sum, p) => sum + p.x, 0) / mouthPoints.length,
          y: mouthPoints.reduce((sum, p) => sum + p.y, 0) / mouthPoints.length,
        };
  const roll =
    eyes === null ? 0 : (Math.atan2(eyes[1].y - eyes[0].y, eyes[1].x - eyes[0].x) * 180) / Math.PI;
  // A mirrored map (front camera) turns the head the other way as seen.
  const mirrored = map[0] * map[4] - map[1] * map[3] < 0;
  return {
    center: { x: (corner1.x + corner2.x) / 2, y: (corner1.y + corner2.y) / 2 },
    width: Math.abs(corner2.x - corner1.x),
    roll,
    eyes,
    nose: mapped(landmarks.NOSE_BASE) ?? null,
    cheeks: sortedPair(mapped(landmarks.LEFT_CHEEK), mapped(landmarks.RIGHT_CHEEK)),
    mouth,
    outline: toOutline(face, map),
    yaw: (face.yawAngle ?? 0) * (mirrored ? -1 : 1),
    pitch: face.pitchAngle ?? 0,
  };
}

/**
 * Default anchor positions in face widths from the centre of the head, before it
 * turns or tilts: across, down and towards the camera.
 */
const ANCHOR_OFFSETS: Record<FaceAnchor, readonly [number, number, number]> = {
  headTop: [0, -0.62, 0],
  leftEar: [-0.36, -0.5, 0],
  rightEar: [0.36, -0.5, 0],
  forehead: [0, -0.3, 0.2],
  nose: [0, 0.08, 0.35],
  leftCheek: [-0.27, 0.15, 0.2],
  rightCheek: [0.27, 0.15, 0.2],
  mouth: [0, 0.3, 0.25],
  chin: [0, 0.55, 0.15],
};

/** How much a part is narrowed at most by the head turning away. */
const MIN_FORESHORTEN = 0.3;

/**
 * Turns a point on the head (across, down, towards the camera; face widths) with the
 * head's yaw and pitch (CHR-09) and drops the depth: what is in front of the face
 * moves the way the head turns.
 */
export function turnWithHead(
  face: FaceGeometry,
  local: readonly [number, number, number],
): [number, number] {
  'worklet';
  const yaw = (face.yaw * Math.PI) / 180;
  const pitch = (face.pitch * Math.PI) / 180;
  const [dx, dy, dz] = local;
  const x = dx * Math.cos(yaw) + dz * Math.sin(yaw);
  const z = -dx * Math.sin(yaw) + dz * Math.cos(yaw);
  return [x, dy * Math.cos(pitch) - z * Math.sin(pitch)];
}

/** Offsets `local` (in face widths, along the face's own axes) from `origin`. */
function offsetAlongFace(
  face: FaceGeometry,
  origin: Point,
  local: readonly [number, number],
): Point {
  'worklet';
  const radians = (face.roll * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const [dx, dy] = local;
  return {
    x: origin.x + face.width * (dx * cos - dy * sin),
    y: origin.y + face.width * (dx * sin + dy * cos),
  };
}

/** Where an anchor is on this face; landmarks win over the default proportions. */
export function anchorPoint(face: FaceGeometry, anchor: FaceAnchor): Point {
  'worklet';
  if (anchor === 'nose' && face.nose !== null) return face.nose;
  if (anchor === 'leftCheek' && face.cheeks !== null) return face.cheeks[0];
  if (anchor === 'rightCheek' && face.cheeks !== null) return face.cheeks[1];
  if (anchor === 'mouth' && face.mouth !== null) return face.mouth;
  return offsetAlongFace(face, face.center, turnWithHead(face, ANCHOR_OFFSETS[anchor]));
}

export interface PartPlacement {
  readonly center: Point;
  /** Edge length of the part's square, in pixels. */
  readonly size: number;
  /** Degrees, clockwise. */
  readonly rotation: number;
  readonly mirrored: boolean;
  /** Narrowing across and down as the head turns and nods (CHR-09). */
  readonly squash: readonly [number, number];
}

/** Where to draw one character part on this face (CHR-01), turned with the head (CHR-09). */
export function placePart(face: FaceGeometry, part: CharacterPart): PartPlacement {
  'worklet';
  const [dx, dy] = part.offset;
  return {
    center: offsetAlongFace(
      face,
      anchorPoint(face, part.anchor),
      turnWithHead(face, [dx, dy, part.depth ?? 0]),
    ),
    size: part.size * face.width,
    rotation: face.roll + part.rotation,
    mirrored: part.mirrored,
    squash: [
      Math.max(MIN_FORESHORTEN, Math.cos((face.yaw * Math.PI) / 180)),
      Math.max(MIN_FORESHORTEN, Math.cos((face.pitch * Math.PI) / 180)),
    ],
  };
}

/** Faces for face fine-tuning (BTY-04): only those whose eyes were found. */
export function toShapedFaces(faces: readonly FaceGeometry[]): ShapedFace[] {
  'worklet';
  const shaped: ShapedFace[] = [];
  for (const face of faces) {
    if (face.eyes === null) continue;
    shaped.push({
      leftEye: [face.eyes[0].x, face.eyes[0].y],
      rightEye: [face.eyes[1].x, face.eyes[1].y],
      center: [face.center.x, face.center.y],
      width: face.width,
    });
  }
  return shaped;
}

/** Whether face fine-tuning changes anything (and so needs faces). */
export function shapesFaces(params: Readonly<Record<string, number>>): boolean {
  'worklet';
  for (const key in params) {
    if (params[key] !== 0) return true;
  }
  return false;
}

/** The largest faces first, at most `MAX_FACES` (people in the background are skipped). */
export function primaryFaces(faces: readonly FaceGeometry[]): FaceGeometry[] {
  'worklet';
  return [...faces].sort((a, b) => b.width - a.width).slice(0, MAX_FACES);
}
