export const FOCUS_DISTANCE_PER_RADIUS = 10;
export const MIN_FOCUS_DISTANCE = 2.8;
export const MAX_FOCUS_DISTANCE = 6.2;
export const CAMERA_DAMPING = 8;
export const MAX_FRAME_DELTA = 0.032;

export const LABEL_EMPHASIS_DAMPING = 12;
export const SELECTED_LABEL_HERO_SCALE = 1.18;
export const SELECTED_SELF_LABEL_HERO_SCALE = 1.34;

export const CURSOR_VICINITY_INNER_GAP = 8;
export const CURSOR_VICINITY_PEAK = 24;
export const CURSOR_INFLUENCE_PADDING = 64;
export const CURSOR_MAX_RADIUS_FRACTION = 0.12;
export const CURSOR_MAX_WORLD_OFFSET = 0.045;
export const CURSOR_DAMPING = 10;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function focusDistance(radius: number) {
  const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  return clamp(
    safeRadius * FOCUS_DISTANCE_PER_RADIUS,
    MIN_FOCUS_DISTANCE,
    MAX_FOCUS_DISTANCE,
  );
}

export function frameDamping(
  deltaSeconds: number,
  damping = CAMERA_DAMPING,
) {
  if (
    !Number.isFinite(deltaSeconds) ||
    deltaSeconds <= 0 ||
    !Number.isFinite(damping) ||
    damping <= 0
  ) {
    return 0;
  }

  const frameDelta = Math.min(deltaSeconds, MAX_FRAME_DELTA);
  return 1 - Math.exp(-damping * frameDelta);
}

function smootherstep(progress: number) {
  const clampedProgress = clamp(progress, 0, 1);
  return (
    clampedProgress *
    clampedProgress *
    clampedProgress *
    (clampedProgress * (clampedProgress * 6 - 15) + 10)
  );
}

export function heroLabelScale(
  baseScale: number,
  isSelf: boolean,
  emphasis: number,
) {
  const heroFloor = isSelf
    ? SELECTED_SELF_LABEL_HERO_SCALE
    : SELECTED_LABEL_HERO_SCALE;
  if (!Number.isFinite(baseScale)) return heroFloor;

  const safeEmphasis = Number.isFinite(emphasis)
    ? clamp(emphasis, 0, 1)
    : 0;
  const selectedScale = Math.max(baseScale, heroFloor);
  return baseScale + (selectedScale - baseScale) * safeEmphasis;
}

export function cursorVicinityInfluence(
  distance: number,
  projectedRadius: number,
) {
  if (
    !Number.isFinite(distance) ||
    !Number.isFinite(projectedRadius) ||
    distance < 0 ||
    projectedRadius < 0
  ) {
    return 0;
  }

  const surfaceDistance = distance - projectedRadius;
  if (
    surfaceDistance <= CURSOR_VICINITY_INNER_GAP ||
    surfaceDistance >= CURSOR_INFLUENCE_PADDING
  ) {
    return 0;
  }

  if (surfaceDistance <= CURSOR_VICINITY_PEAK) {
    return smootherstep(
      (surfaceDistance - CURSOR_VICINITY_INNER_GAP) /
        (CURSOR_VICINITY_PEAK - CURSOR_VICINITY_INNER_GAP),
    );
  }

  return 1 - smootherstep(
    (surfaceDistance - CURSOR_VICINITY_PEAK) /
      (CURSOR_INFLUENCE_PADDING - CURSOR_VICINITY_PEAK),
  );
}
