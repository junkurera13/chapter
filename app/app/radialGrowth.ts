export type GrowthPosition = readonly [number, number, number];

export type GrowthNode = {
  key: string;
  radius: number;
  position?: GrowthPosition;
};

export type GrowthEdge = {
  from: string;
  to: string;
};

export type PositionedGrowthNode<T extends GrowthNode> = Omit<T, "position"> & {
  position: GrowthPosition;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function seededUnit(seedText: string) {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return (seed >>> 0) / 4294967296;
}

function distanceFromCentre(
  position: GrowthPosition,
  centre: GrowthPosition,
) {
  return Math.hypot(position[0] - centre[0], position[1] - centre[1]);
}

function distanceBetween(a: GrowthPosition, b: GrowthPosition) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Places one new orb beyond its outermost connection. Candidate positions fan
 * around that outward direction and are scored for breathing room, so siblings
 * grow into an organic branch instead of stacking on a perfect orbit.
 */
export function placeOrbOutward(
  node: GrowthNode,
  connectedKeys: readonly string[],
  existingNodes: readonly PositionedGrowthNode<GrowthNode>[],
  centreKey = "self",
): GrowthPosition {
  const existingByKey = new Map(
    existingNodes.map((existingNode) => [existingNode.key, existingNode]),
  );
  const centre = existingByKey.get(centreKey)?.position ?? [0, 0, 0];
  const connections = connectedKeys
    .map((key) => existingByKey.get(key))
    .filter(
      (connectedNode): connectedNode is PositionedGrowthNode<GrowthNode> =>
        Boolean(connectedNode),
    );
  const anchor =
    connections.reduce<PositionedGrowthNode<GrowthNode> | null>(
      (outermost, connectedNode) =>
        !outermost ||
        distanceFromCentre(connectedNode.position, centre) >
          distanceFromCentre(outermost.position, centre)
          ? connectedNode
          : outermost,
      null,
    ) ?? existingByKey.get(centreKey);

  const anchorPosition = anchor?.position ?? centre;
  const anchorDistance = distanceFromCentre(anchorPosition, centre);
  const seed = seededUnit(node.key);
  const baseAngle =
    anchorDistance > 0.1
      ? Math.atan2(
          anchorPosition[1] - centre[1],
          anchorPosition[0] - centre[0],
        )
      : seed * Math.PI * 2 + existingNodes.length * GOLDEN_ANGLE;
  const connectedOuterRadius = connections.reduce(
    (outerRadius, connectedNode) =>
      Math.max(
        outerRadius,
        distanceFromCentre(connectedNode.position, centre),
      ),
    anchorDistance,
  );
  const minimumRadius = Math.max(
    2.15,
    connectedOuterRadius + (anchor?.radius ?? 0.8) + node.radius + 0.68,
  );

  let bestPosition: GrowthPosition = [
    centre[0] + Math.cos(baseAngle) * minimumRadius,
    centre[1] + Math.sin(baseAngle) * minimumRadius,
    clamp(anchorPosition[2], -1.25, 1.25),
  ];
  let bestScore = Number.POSITIVE_INFINITY;

  for (let candidateIndex = 0; candidateIndex < 25; candidateIndex += 1) {
    const fanStep = candidateIndex === 0 ? 0 : Math.ceil(candidateIndex / 2);
    const fanDirection = candidateIndex % 2 === 1 ? 1 : -1;
    const angleOffset = fanDirection * fanStep * 0.27;
    const angle = baseAngle + angleOffset + (seed - 0.5) * 0.12;
    const radius = minimumRadius + Math.floor(fanStep / 7) * 0.38;
    const depthVariation =
      (seededUnit(`${node.key}:${candidateIndex}`) - 0.5) * 0.72;
    const candidate: GrowthPosition = [
      centre[0] + Math.cos(angle) * radius,
      centre[1] + Math.sin(angle) * radius,
      clamp(anchorPosition[2] + depthVariation, -1.25, 1.25),
    ];

    let score = Math.abs(angleOffset) * 0.7;

    for (const existingNode of existingNodes) {
      const safeDistance = node.radius + existingNode.radius + 0.52;
      const separation = distanceBetween(candidate, existingNode.position);
      if (separation < safeDistance) {
        score += (safeDistance - separation + 1) ** 2 * 120;
      }
    }

    for (const connectedNode of connections) {
      score += distanceBetween(candidate, connectedNode.position) * 0.08;
    }

    if (score < bestScore) {
      bestScore = score;
      bestPosition = candidate;
    }
  }

  return bestPosition;
}

/**
 * Keeps authored positions intact and supplies outward positions for newly
 * generated nodes. Missing nodes are resolved after one of their connections
 * exists; a disconnected node begins a new branch from the centre.
 */
export function resolveOutwardPositions<T extends GrowthNode>(
  nodes: readonly T[],
  edges: readonly GrowthEdge[],
  centreKey = "self",
): readonly PositionedGrowthNode<T>[] {
  const placed = new Map<string, PositionedGrowthNode<T>>();
  const pending = new Map<string, T>();

  for (const node of nodes) {
    if (node.position) {
      placed.set(
        node.key,
        { ...node, position: node.position } as PositionedGrowthNode<T>,
      );
    } else {
      pending.set(node.key, node);
    }
  }

  const centreNode = pending.get(centreKey);
  if (!placed.has(centreKey) && centreNode) {
    placed.set(
      centreKey,
      { ...centreNode, position: [0, 0, 0] } as PositionedGrowthNode<T>,
    );
    pending.delete(centreKey);
  }

  while (pending.size > 0) {
    let placedDuringPass = false;

    for (const [key, node] of pending) {
      const connectedKeys = edges.flatMap((edge) => {
        if (edge.from === key && placed.has(edge.to)) return [edge.to];
        if (edge.to === key && placed.has(edge.from)) return [edge.from];
        return [];
      });
      if (connectedKeys.length === 0) continue;

      const position = placeOrbOutward(
        node,
        connectedKeys,
        [...placed.values()],
        centreKey,
      );
      placed.set(
        key,
        { ...node, position } as PositionedGrowthNode<T>,
      );
      pending.delete(key);
      placedDuringPass = true;
    }

    if (placedDuringPass) continue;

    const next = pending.values().next().value as T | undefined;
    if (!next) break;
    const position = placeOrbOutward(
      next,
      placed.has(centreKey) ? [centreKey] : [],
      [...placed.values()],
      centreKey,
    );
    placed.set(
      next.key,
      { ...next, position } as PositionedGrowthNode<T>,
    );
    pending.delete(next.key);
  }

  return nodes.map((node) => {
    const positionedNode = placed.get(node.key);
    if (!positionedNode) {
      throw new Error(`Could not position world node: ${node.key}`);
    }
    return positionedNode;
  });
}
