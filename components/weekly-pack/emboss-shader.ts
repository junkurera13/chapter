// Adapted from Arlan Hamilton's MIT-licensed Realistic Emboss study:
// https://www.arlan.me/vault/emboss

export const EMBOSS_VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aUV;
varying vec2 vUV;

void main() {
  vUV = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const EMBOSS_FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUV;

uniform sampler2D uField;
uniform vec2 uTexel;
uniform vec2 uLight;
uniform float uLightZ;
uniform float uDepth;
uniform float uHighlight;
uniform float uShadow;
uniform vec3 uTint;
uniform float uGrain;

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);

  float a = hash(cell);
  float b = hash(cell + vec2(1.0, 0.0));
  float c = hash(cell + vec2(0.0, 1.0));
  float d = hash(cell + vec2(1.0, 1.0));

  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

void main() {
  vec2 uv = vUV;

  float leftHeight = texture2D(uField, uv - vec2(uTexel.x, 0.0)).g;
  float rightHeight = texture2D(uField, uv + vec2(uTexel.x, 0.0)).g;
  float downHeight = texture2D(uField, uv - vec2(0.0, uTexel.y)).g;
  float upHeight = texture2D(uField, uv + vec2(0.0, uTexel.y)).g;
  float crisp = texture2D(uField, uv).r;

  vec2 slope = vec2(
    rightHeight - leftHeight,
    upHeight - downHeight
  ) * uDepth * 16.0;

  vec3 normal = normalize(vec3(-slope.x, -slope.y, 1.0));
  float bevel = clamp(length(slope), 0.0, 1.0);
  vec3 light = normalize(vec3(uLight, uLightZ));
  float diffuse = dot(normal, light);
  float highlight = pow(max(diffuse, 0.0), 1.2) * bevel;
  float shadow = pow(max(-diffuse, 0.0), 1.0) * bevel;

  float broadGrain = noise(uv * vec2(115.0, 150.0));
  float fineGrain = hash(floor(uv * vec2(860.0, 1080.0)));
  float surface = 0.965
    + (broadGrain - 0.5) * uGrain * 0.12
    + (fineGrain - 0.5) * uGrain * 0.055;

  vec3 color = uTint * surface;
  float pressedFace = smoothstep(0.4, 0.62, crisp);
  color *= mix(1.0, 0.88, pressedFace);
  color += highlight * uHighlight;
  color -= shadow * uShadow;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
