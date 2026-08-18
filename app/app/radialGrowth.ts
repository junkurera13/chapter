export type GrowthPosition = readonly [number, number, number];

export type GrowthNode = {
  key: string;
  radius: number;
  /**
   * Placement order within a pass: higher values place first, so dependents
   * (an activity naming a person) can anchor to them instead of the moment.
   */
  anchorPriority?: number;
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

/**
 * Children may drift at most this far (radians) from their branch direction,
 * so a memory's nodes read as one outward chain instead of a scattered ring.
 */
const SECTOR_ANGLE_OFFSETS = [0, 0.34, -0.34, 0.68, -0.68] as const;
const RADIUS_STEP = 0.62;

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
 * Places one new orb along its branch direction. Branch roots (nodes whose
 * `branchIndex` is provided) claim successive golden-angle directions around
 * the centre, so each memory owns a sector and later memories wrap around the
 * circle. Every other node grows outward from its outermost connection inside
 * a narrow cone: crowding pushes candidates further out rather than sideways,
 * so a memory's nodes chain away from the centre instead of orbiting it.
 */
export function placeOrbOutward(
  node: GrowthNode,
  connectedKeys: readonly string[],
  existingNodes: readonly PositionedGrowthNode<GrowthNode>[],
  centreKey = "self",
  branchIndex?: number,
): GrowthPosition {
  const existingByKey = new Map(
    existingNodes.map((existingNode) => [existingNode.key, existingNode]),
  );
  const centre = existingByKey.get(centreKey)?.position ?? [0, 0, 0];
  const isBranchRoot = branchIndex !== undefined;
  const connections = connectedKeys
    .map((key) => existingByKey.get(key))
    .filter(
      (connectedNode): connectedNode is PositionedGrowthNode<GrowthNode> =>
        Boolean(connectedNode),
    )
    // A branch root belongs to its own sector: relation edges to other
    // branches must not drag it away from its assigned direction.
    .filter((connectedNode) => !isBranchRoot || connectedNode.key === centreKey);
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
      : (branchIndex ?? existingNodes.length) * GOLDEN_ANGLE +
        (seed - 0.5) * 0.24;
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

  for (let radiusStep = 0; radiusStep < 5; radiusStep += 1) {
    for (
      let offsetIndex = 0;
      offsetIndex < SECTOR_ANGLE_OFFSETS.length;
      offsetIndex += 1
    ) {
      const candidateIndex =
        radiusStep * SECTOR_ANGLE_OFFSETS.length + offsetIndex;
      const angleOffset = SECTOR_ANGLE_OFFSETS[offsetIndex];
      const angle = baseAngle + angleOffset + (seed - 0.5) * 0.12;
      const radius = minimumRadius + radiusStep * RADIUS_STEP;
      const depthVariation =
        (seededUnit(`${node.key}:${candidateIndex}`) - 0.5) * 0.72;
      const candidate: GrowthPosition = [
        centre[0] + Math.cos(angle) * radius,
        centre[1] + Math.sin(angle) * radius,
        clamp(anchorPosition[2] + depthVariation, -1.25, 1.25),
      ];

      let score = Math.abs(angleOffset) * 1.5 + radiusStep * 0.4;

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

  // Nodes wired straight to the centre are branch roots. Their order of
  // appearance decides their sector, so later memories walk around the circle.
  const rootKeys = new Set<string>();
  for (const edge of edges) {
    if (edge.from === centreKey && edge.to !== centreKey) rootKeys.add(edge.to);
    if (edge.to === centreKey && edge.from !== centreKey) {
      rootKeys.add(edge.from);
    }
  }
  const branchIndexByKey = new Map<string, number>();
  for (const node of nodes) {
    if (node.key !== centreKey && rootKeys.has(node.key)) {
      branchIndexByKey.set(node.key, branchIndexByKey.size);
    }
  }

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

    // Branch roots first, then by anchor priority (people before the
    // activities that mention them), so a node placed later in
    // the same pass can chain under its most meaningful connection.
    const pendingOrdered = [...pending.entries()].sort(
      ([, nodeA], [, nodeB]) =>
        (branchIndexByKey.has(nodeB.key) ? 100 : nodeB.anchorPriority ?? 0) -
        (branchIndexByKey.has(nodeA.key) ? 100 : nodeA.anchorPriority ?? 0),
    );

    for (const [key, node] of pendingOrdered) {
      if (!pending.has(key)) continue;
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
        branchIndexByKey.get(key),
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
      branchIndexByKey.get(next.key),
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
