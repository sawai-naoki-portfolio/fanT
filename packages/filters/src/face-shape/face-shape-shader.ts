/**
 * `face_shape_v1`: subtle face fine-tuning (BTY-04, BTY-08) on up to `MAX_SHAPED_FACES`
 * faces, applied first so the rest of the chain sees the reshaped face.
 *
 * A backward warp: each output pixel samples the source a little closer to an eye
 * centre (larger eyes) or a little farther from the face's vertical axis on the
 * lower face (a narrower jaw). Both fall off smoothly to zero, so nothing outside
 * the face moves. The face's axes come from its eyes, so tilted faces work too.
 *
 * Uniform names must match `FaceShapeUniforms`; a test checks that they stay in sync.
 */
export const FACE_SHAPE_SHADER_NAME = 'face_shape_v1';

export const FACE_SHAPE_SHADER_SOURCE = /* sksl */ `
uniform shader image;
uniform float eyes;
uniform float slim;
uniform float nose;
uniform float mouth;
uniform float chin;
// Per face: eyes (left x, y, right x, y) and shape (centre x, y, width, 1 if present).
uniform float4 face0Eyes;
uniform float4 face0Shape;
uniform float4 face1Eyes;
uniform float4 face1Shape;
uniform float4 face2Eyes;
uniform float4 face2Shape;
uniform float4 face3Eyes;
uniform float4 face3Shape;

// The strength at 1: kept subtle (BTY-04, BTY-08).
const float MAX_EYE = 0.13;
const float MAX_SLIM = 0.06;
const float MAX_NOSE = 0.12;
const float MAX_MOUTH = 0.12;
const float MAX_CHIN = 0.12;
// Eye region radius as a fraction of the distance between the eyes.
const float EYE_RADIUS = 0.42;

float2 enlargeAround(float2 p, float2 centre, float radius, float strength) {
  float2 d = p - centre;
  float t = dot(d, d) / (radius * radius);
  if (t >= 1.0) return p;
  float falloff = 1.0 - t;
  return centre + d * (1.0 - strength * falloff * falloff);
}

float2 shapeFace(float2 p, float4 faceEyes, float4 shape) {
  if (shape.w < 0.5) return p;
  float2 left = faceEyes.xy;
  float2 right = faceEyes.zw;
  float span = length(right - left);
  if (span < 1.0) return p;
  float2 across = (right - left) / span;
  float2 down = float2(-across.y, across.x);
  float width = shape.z;
  float2 q = p;

  if (slim > 0.0) {
    // The lower face: an ellipse centred below the face centre.
    float2 d = p - (shape.xy + down * width * 0.28);
    float u = dot(d, across) / (width * 0.62);
    float v = dot(d, down) / (width * 0.5);
    float falloff = 1.0 - (u * u + v * v);
    if (falloff > 0.0) q += across * dot(d, across) * slim * MAX_SLIM * falloff * falloff;
  }
  if (eyes > 0.0) {
    float strength = eyes * MAX_EYE;
    q = enlargeAround(q, left, span * EYE_RADIUS, strength);
    q = enlargeAround(q, right, span * EYE_RADIUS, strength);
  }
  // Nose, mouth and chin sit at typical distances below the eyes.
  float2 middle = (left + right) * 0.5;
  if (nose > 0.0) {
    float2 d = p - (middle + down * span * 0.72);
    float u = dot(d, across) / (span * 0.38);
    float v = dot(d, down) / (span * 0.45);
    float falloff = 1.0 - (u * u + v * v);
    if (falloff > 0.0) q += across * dot(d, across) * nose * MAX_NOSE * falloff * falloff;
  }
  if (mouth != 0.0) {
    q = enlargeAround(q, middle + down * span * 1.15, span * 0.6, mouth * MAX_MOUTH);
  }
  if (chin > 0.0) {
    float2 d = p - (middle + down * span * 1.75);
    float u = dot(d, across) / (span * 0.9);
    float v = dot(d, down) / (span * 0.8);
    float falloff = 1.0 - (u * u + v * v);
    if (falloff > 0.0) q += down * span * chin * MAX_CHIN * falloff;
  }
  return q;
}

half4 main(float2 p) {
  float2 q = shapeFace(p, face0Eyes, face0Shape);
  q = shapeFace(q, face1Eyes, face1Shape);
  q = shapeFace(q, face2Eyes, face2Shape);
  q = shapeFace(q, face3Eyes, face3Shape);
  return image.eval(q);
}
`;
