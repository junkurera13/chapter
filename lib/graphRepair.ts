import type { ExperienceRelation } from "./experienceOntology";
import type {
  ExperienceGraphEdgeRecord,
  ExperienceGraphNodeRecord,
  ExperienceGraphRecord,
} from "./backendTypes";

/**
 * Deterministic graph lint. Extraction sometimes encodes a relationship as
 * text instead of structure — "Sharing Tiramisu Cake with Halmoni" as one
 * label, unconnected to the Halmoni people node. This pass repairs stored
 * graphs at read time: it links nodes that mention a person by name to that
 * person's node, and trims trailing companion clauses out of labels so the
 * relationship lives in the graph rather than the words.
 */

const REPAIRABLE_CATEGORIES = new Set([
  "activity",
  "interest",
  "feeling",
  "condition",
  "pattern",
  "place",
]);

const COMPANION_CLAUSE = /\s+(?:together\s+with|with|alongside)\s+(.+)$/i;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionsPerson(text: string, personLabel: string) {
  const name = personLabel.trim();
  if (name.length < 3) return false;
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(name)}([^\\p{L}\\p{N}]|$)`,
    "iu",
  ).test(text);
}

/**
 * Removes a trailing companion clause ("… with Halmoni", "… with Halmoni and
 * Samuel") when at least one named person node appears in it. Possessives and
 * mid-label mentions ("Halmoni's Gift Money") are kept — there the person is
 * the subject, not a companion.
 */
function trimmedCompanionLabel(
  label: string,
  people: readonly ExperienceGraphNodeRecord[],
) {
  const match = label.match(COMPANION_CLAUSE);
  if (!match) return label;

  const clause = match[1];
  const clauseNamesPerson = people.some((person) =>
    mentionsPerson(clause, person.label),
  );
  if (!clauseNamesPerson) return label;

  const trimmed = label.slice(0, match.index).trim();
  return trimmed.length >= 3 ? trimmed : label;
}

function repairRelation(
  node: ExperienceGraphNodeRecord,
  person: ExperienceGraphNodeRecord,
): Pick<ExperienceGraphEdgeRecord, "fromNodeId" | "toNodeId" | "relation"> {
  switch (node.category) {
    case "activity":
      return {
        fromNodeId: node.id,
        toNodeId: person.id,
        relation: "shared_with" satisfies ExperienceRelation,
      };
    case "place":
      return {
        fromNodeId: person.id,
        toNodeId: node.id,
        relation: "familiar_with",
      };
    case "feeling":
      return { fromNodeId: person.id, toNodeId: node.id, relation: "evoked" };
    default:
      return { fromNodeId: node.id, toNodeId: person.id, relation: "involved" };
  }
}

export function repairExperienceGraph(
  graph: ExperienceGraphRecord,
): ExperienceGraphRecord {
  const people = graph.nodes.filter(
    (node) => node.category === "people" && node.label.trim().length >= 3,
  );
  if (people.length === 0) return graph;

  const connectedPairs = new Set<string>();
  for (const edge of graph.edges) {
    connectedPairs.add(`${edge.fromNodeId}|${edge.toNodeId}`);
    connectedPairs.add(`${edge.toNodeId}|${edge.fromNodeId}`);
  }

  const repairedEdges: ExperienceGraphEdgeRecord[] = [];
  const nodes = graph.nodes.map((node) => {
    if (!REPAIRABLE_CATEGORIES.has(node.category)) return node;

    const mentioned = people.filter(
      (person) =>
        person.id !== node.id && mentionsPerson(node.label, person.label),
    );
    if (mentioned.length === 0) return node;

    for (const person of mentioned) {
      const pair = `${node.id}|${person.id}`;
      if (connectedPairs.has(pair)) continue;
      connectedPairs.add(pair);
      connectedPairs.add(`${person.id}|${node.id}`);
      repairedEdges.push({
        ...repairRelation(node, person),
        id: `repair:${node.id}:${person.id}`,
        memoryId: node.memoryId ?? "",
        polarity: "neutral",
        familiarity: "not_applicable",
        strength: 0.6,
        certainty: "hypothesis",
        createdAt: node.createdAt,
      });
    }

    const label = trimmedCompanionLabel(node.label, mentioned);
    return label === node.label ? node : { ...node, label };
  });

  return repairedEdges.length === 0 && nodes.every((node, i) => node === graph.nodes[i])
    ? graph
    : { ...graph, nodes, edges: [...graph.edges, ...repairedEdges] };
}
