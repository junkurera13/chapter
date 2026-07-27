import type {
  ExperienceFamiliarity,
  ExperienceNodeCategory,
  ExperiencePolarity,
  ExperienceRelation,
} from "../../lib/experienceOntology";
import type { ExperienceGraphRecord } from "../../lib/backendTypes";
import { repairExperienceGraph } from "../../lib/graphRepair";
import { resolveOrbSizes } from "./orbSizing";
import { resolveOutwardPositions } from "./radialGrowth";

export type WorldNodeCategory = "self" | ExperienceNodeCategory;

type WorldNodeSeed = {
  key: string;
  anchorPriority?: number;
  category: WorldNodeCategory;
  subtype: string;
  label: string;
  description: string;
  evidence: string;
  certainty: "fact" | "hypothesis";
  confidence: number;
  salience: number;
  sourceType?: "memory" | "connection";
  linkedUserId?: string;
  connectionId?: string;
  inviteStatus?: "pending";
  position?: readonly [number, number, number];
};

export type WorldNode = Omit<WorldNodeSeed, "position"> & {
  position: readonly [number, number, number];
  radius: number;
  major: boolean;
};

export type WorldEdge = {
  from: string;
  to: string;
  relation: ExperienceRelation;
  polarity: ExperiencePolarity;
  familiarity: ExperienceFamiliarity;
  strength: number;
  certainty: "fact" | "hypothesis";
  role?: "root" | "relation";
};

export type WorldGraph = {
  nodes: readonly WorldNode[];
  edges: readonly WorldEdge[];
};

// People place before places, places before activities, so each node can
// chain under the most meaningful connection available in its memory branch.
const ANCHOR_PRIORITY_BY_CATEGORY: Partial<Record<WorldNodeCategory, number>> =
  {
    people: 3,
    place: 2,
    activity: 1,
  };

const SELF_NODE: WorldNodeSeed = {
  key: "self",
  category: "self",
  subtype: "centre",
  label: "you",
  description:
    "The person at the centre of every memory, relationship and possibility Chapter is beginning to understand.",
  evidence: "This world grows from the memories you choose to share.",
  certainty: "fact",
  confidence: 1,
  salience: 1,
  sourceType: "memory",
  position: [0, 0.08, 0.35],
};

function currentBrandCopy(value: string) {
  return value
    .replace(/\bSidequest\b/g, "Chapter")
    .replace(/\bTo Be Alive\b/g, "Chapter")
    .replace(/\bTBA\b/g, "Chapter");
}

function rootEdge(target: string): WorldEdge {
  return {
    from: "self",
    to: target,
    relation: "lived",
    polarity: "neutral",
    familiarity: "not_applicable",
    strength: 1,
    certainty: "fact",
    role: "root",
  };
}

export function buildWorldGraph(rawGraph: ExperienceGraphRecord): WorldGraph {
  const graph = repairExperienceGraph(rawGraph);
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  const graphEdges: WorldEdge[] = graph.edges
    .filter(
      (edge) =>
        graphNodeIds.has(edge.fromNodeId) &&
        graphNodeIds.has(edge.toNodeId) &&
        edge.fromNodeId !== edge.toNodeId,
    )
    .map((edge) => ({
      from: edge.fromNodeId,
      to: edge.toNodeId,
      relation: edge.relation,
      polarity: edge.polarity,
      familiarity: edge.familiarity,
      strength: edge.strength,
      certainty: edge.certainty,
      role: "relation",
    }));

  const memoryNodes = graph.nodes.filter(
    (node) => node.category === "experience" || node.kind === "memory",
  );
  const connectionNodes = graph.nodes.filter(
    (node) => node.sourceType === "connection",
  );
  const rootNodes =
    memoryNodes.length > 0 || connectionNodes.length > 0
      ? [...memoryNodes, ...connectionNodes]
      : [...graph.nodes].sort(
          (first, second) => second.salience - first.salience,
        ).slice(0, 1);
  const worldEdges = [
    ...rootNodes.map((node) => rootEdge(node.id)),
    ...graphEdges,
  ];
  const worldNodeSeeds: WorldNodeSeed[] = [
    SELF_NODE,
    ...graph.nodes.map((node) => ({
      key: node.id,
      anchorPriority: ANCHOR_PRIORITY_BY_CATEGORY[node.category] ?? 0,
      category: node.category,
      subtype: node.subtype,
      label: node.label,
      description: currentBrandCopy(node.description),
      evidence: currentBrandCopy(node.evidence),
      certainty: node.certainty,
      confidence: node.confidence,
      salience: node.salience,
      sourceType: node.sourceType,
      linkedUserId: node.linkedUserId,
      connectionId: node.connectionId,
      inviteStatus: node.inviteStatus,
    })),
  ];
  const sizedWorldNodes = resolveOrbSizes(worldNodeSeeds, worldEdges);

  return {
    nodes: resolveOutwardPositions(sizedWorldNodes, worldEdges),
    edges: worldEdges,
  };
}
