export type OrbSizingNode = {
  key: string;
  category: string;
  salience?: number;
};

export type OrbSizingEdge = {
  from: string;
  to: string;
  strength: number;
};

export type SizedOrbNode<T extends OrbSizingNode> = T & {
  radius: number;
  major: boolean;
};

export const SELF_ORB_RADIUS = 0.9;
export const MIN_ORB_RADIUS = 0.22;
export const MAX_ORB_RADIUS = 0.54;
export const MAJOR_ORB_IMPORTANCE = 0.8;

const DEFAULT_SALIENCE = 0.5;
const RELATIONSHIP_REINFORCEMENT = 0.28;
const IMPORTANCE_CURVE = 3.2;

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

function roundRadius(value: number) {
  return Math.round(value * 1000) / 1000;
}

/**
 * Resolves a stable visual hierarchy from human importance and graph context.
 *
 * Salience is deliberately dominant. Strong and repeated relationships add a
 * small amount of reinforcement, but category and epistemic confidence never
 * affect size. This keeps colour, scale, and opacity as separate visual signals.
 */
export function resolveOrbSizes<T extends OrbSizingNode>(
  nodes: readonly T[],
  edges: readonly OrbSizingEdge[],
): readonly SizedOrbNode<T>[] {
  const edgesByNode = new Map<string, OrbSizingEdge[]>();

  for (const edge of edges) {
    edgesByNode.set(edge.from, [...(edgesByNode.get(edge.from) ?? []), edge]);
    edgesByNode.set(edge.to, [...(edgesByNode.get(edge.to) ?? []), edge]);
  }

  return nodes.map((node) => {
    if (node.category === "self") {
      return { ...node, radius: SELF_ORB_RADIUS, major: true };
    }

    const connectedEdges = edgesByNode.get(node.key) ?? [];
    const strongestRelationship = connectedEdges.reduce(
      (strongest, edge) => Math.max(strongest, clampUnit(edge.strength)),
      0,
    );
    const relationshipBreadth = clampUnit(
      connectedEdges.reduce(
        (total, edge) => total + clampUnit(edge.strength),
        0,
      ) / 4,
    );
    const salience = clampUnit(node.salience ?? DEFAULT_SALIENCE);
    const relationshipEvidence =
      strongestRelationship * 0.65 + relationshipBreadth * 0.35;
    const evidencedImportance =
      salience +
      (1 - salience) * relationshipEvidence * RELATIONSHIP_REINFORCEMENT;
    const compressedImportance = evidencedImportance ** IMPORTANCE_CURVE;
    const radius = roundRadius(
      MIN_ORB_RADIUS +
        (MAX_ORB_RADIUS - MIN_ORB_RADIUS) * compressedImportance,
    );

    return {
      ...node,
      radius,
      major: salience >= 0.82 || evidencedImportance >= MAJOR_ORB_IMPORTANCE,
    };
  });
}
