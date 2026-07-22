export const ORB_LAYOUT_STORAGE_KEY =
  "sidequest:you-world:orb-layout:v1";

export type OrbPosition = readonly [number, number, number];

type StoredOrbLayout = {
  version: 1;
  positions: Record<string, OrbPosition>;
};

const MAX_ABSOLUTE_COORDINATE = 32;

function isOrbPosition(value: unknown): value is OrbPosition {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(
      (coordinate) =>
        typeof coordinate === "number" &&
        Number.isFinite(coordinate) &&
        Math.abs(coordinate) <= MAX_ABSOLUTE_COORDINATE,
    )
  );
}

export function loadOrbLayout(
  storage: Pick<Storage, "getItem"> | null,
  allowedKeys: ReadonlySet<string>,
) {
  const positions = new Map<string, OrbPosition>();
  if (!storage) return positions;

  try {
    const rawLayout = storage.getItem(ORB_LAYOUT_STORAGE_KEY);
    if (!rawLayout) return positions;

    const parsed = JSON.parse(rawLayout) as Partial<StoredOrbLayout>;
    if (parsed.version !== 1 || !parsed.positions) return positions;

    for (const [key, position] of Object.entries(parsed.positions)) {
      if (allowedKeys.has(key) && isOrbPosition(position)) {
        positions.set(key, position);
      }
    }
  } catch {
    // Storage can be unavailable or contain stale/corrupt data. In either case,
    // the authored world positions remain the safe fallback.
  }

  return positions;
}

export function saveOrbLayout(
  storage: Pick<Storage, "setItem"> | null,
  positions: ReadonlyMap<string, OrbPosition>,
) {
  if (!storage) return false;

  const storedPositions: Record<string, OrbPosition> = {};
  for (const [key, position] of positions) {
    if (isOrbPosition(position)) storedPositions[key] = position;
  }

  const layout: StoredOrbLayout = {
    version: 1,
    positions: storedPositions,
  };

  try {
    storage.setItem(ORB_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}
