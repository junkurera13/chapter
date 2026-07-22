export const ORB_BIRTH_STORAGE_KEY =
  "sidequest:you-world:seen-node-keys:v1";
export const ORB_BIRTH_DELAY_MS = 160;
export const ORB_BIRTH_STAGGER_MS = 70;
export const ORB_BIRTH_DURATION_MS = 680;
export const ORB_BIRTH_START_SCALE = 0.92;
export const ORB_BIRTH_INWARD_DISTANCE = 0.22;
export const ORB_BIRTH_EDGE_START = 0.18;
export const ORB_BIRTH_EDGE_END = 0.82;
export const ORB_BIRTH_LABEL_START = 0.42;
export const ORB_BIRTH_LABEL_END = 0.88;

type BirthNode = {
  key: string;
};

type BirthEdge = {
  from: string;
  to: string;
};

type StoredSeenNodeKeys = {
  version: 1;
  keys: string[];
};

export function loadSeenNodeKeys(
  storage: Pick<Storage, "getItem"> | null,
  allowedKeys: ReadonlySet<string>,
) {
  const seenKeys = new Set<string>();
  if (!storage) return seenKeys;

  try {
    const rawValue = storage.getItem(ORB_BIRTH_STORAGE_KEY);
    if (!rawValue) return seenKeys;

    const parsed = JSON.parse(rawValue) as Partial<StoredSeenNodeKeys>;
    if (parsed.version !== 1 || !Array.isArray(parsed.keys)) return seenKeys;

    for (const key of parsed.keys) {
      if (typeof key === "string" && allowedKeys.has(key)) seenKeys.add(key);
    }
  } catch {
    // Storage can be unavailable or contain stale data. Treating the current
    // identities as unseen is the safe, recoverable fallback.
  }

  return seenKeys;
}

export function saveSeenNodeKeys(
  storage: Pick<Storage, "setItem"> | null,
  keys: ReadonlySet<string>,
) {
  if (!storage) return false;

  const value: StoredSeenNodeKeys = {
    version: 1,
    keys: [...keys],
  };

  try {
    storage.setItem(ORB_BIRTH_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function orderUnseenNodeKeys(
  nodes: readonly BirthNode[],
  edges: readonly BirthEdge[],
  seenKeys: ReadonlySet<string>,
  centreKey = "self",
) {
  const allowedKeys = new Set(nodes.map((node) => node.key));
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.key, []);

  for (const edge of edges) {
    if (!allowedKeys.has(edge.from) || !allowedKeys.has(edge.to)) continue;
    adjacency.get(edge.from)?.push(edge.to);
    adjacency.get(edge.to)?.push(edge.from);
  }

  const depthByKey = new Map<string, number>();
  if (allowedKeys.has(centreKey)) {
    depthByKey.set(centreKey, 0);
    const queue = [centreKey];
    for (let index = 0; index < queue.length; index += 1) {
      const key = queue[index];
      const depth = depthByKey.get(key) ?? 0;
      for (const neighbour of adjacency.get(key) ?? []) {
        if (depthByKey.has(neighbour)) continue;
        depthByKey.set(neighbour, depth + 1);
        queue.push(neighbour);
      }
    }
  }

  return nodes
    .map((node, sourceIndex) => ({
      key: node.key,
      sourceIndex,
      depth: depthByKey.get(node.key) ?? Number.POSITIVE_INFINITY,
    }))
    .filter(({ key }) => key !== centreKey && !seenKeys.has(key))
    .sort(
      (first, second) =>
        first.depth - second.depth || first.sourceIndex - second.sourceIndex,
    )
    .map(({ key }) => key);
}

export function unitProgress(
  elapsedMs: number,
  delayMs: number,
  durationMs: number,
) {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(delayMs)) return 0;
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return elapsedMs >= delayMs ? 1 : 0;
  }
  return Math.min(1, Math.max(0, (elapsedMs - delayMs) / durationMs));
}

function cubicBezierCoordinate(
  time: number,
  firstControl: number,
  secondControl: number,
) {
  const inverse = 1 - time;
  return (
    3 * inverse * inverse * time * firstControl +
    3 * inverse * time * time * secondControl +
    time * time * time
  );
}

function cubicBezierDerivative(
  time: number,
  firstControl: number,
  secondControl: number,
) {
  const inverse = 1 - time;
  return (
    3 * inverse * inverse * firstControl +
    6 * inverse * time * (secondControl - firstControl) +
    3 * time * time * (1 - secondControl)
  );
}

export function strongEaseOut(progress: number) {
  const input = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;
  if (input === 0 || input === 1) return input;

  let parameter = input;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const error = cubicBezierCoordinate(parameter, 0.23, 0.32) - input;
    const derivative = cubicBezierDerivative(parameter, 0.23, 0.32);
    if (Math.abs(error) < 0.000001 || Math.abs(derivative) < 0.000001) break;
    parameter = Math.min(1, Math.max(0, parameter - error / derivative));
  }

  return cubicBezierCoordinate(parameter, 1, 1);
}

export function rangeProgress(progress: number, start: number, end: number) {
  if (
    !Number.isFinite(progress) ||
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  ) {
    return 0;
  }
  if (end <= start) return progress >= end ? 1 : 0;
  return Math.min(1, Math.max(0, (progress - start) / (end - start)));
}
