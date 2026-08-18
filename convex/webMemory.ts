import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { normalizeName, requireCurrentAccount } from "./lib/auth";

const CURRENT_NODE_CATEGORIES = [
  "experience",
  "people",
  "place",
  "activity",
  "condition",
] as const;

type CurrentNodeCategory = (typeof CURRENT_NODE_CATEGORIES)[number];

function normalizeStoredCategory(category: string): CurrentNodeCategory | null {
  if (category === "interest") return "activity";
  if (category === "feeling" || category === "pattern") return null;
  return CURRENT_NODE_CATEGORIES.includes(category as CurrentNodeCategory)
    ? (category as CurrentNodeCategory)
    : null;
}

const nodeCategoryValidator = v.union(
  v.literal("experience"),
  v.literal("people"),
  v.literal("place"),
  v.literal("activity"),
  v.literal("condition"),
  v.literal("interest"),
  v.literal("feeling"),
  v.literal("pattern"),
);

const relationValidator = v.union(
  v.literal("lived"),
  v.literal("cares_about"),
  v.literal("shared_with"),
  v.literal("happened_at"),
  v.literal("involved"),
  v.literal("evoked"),
  v.literal("shaped_by"),
  v.literal("supported"),
  v.literal("reflects"),
  v.literal("part_of"),
  v.literal("drawn_to"),
  v.literal("familiar_with"),
  v.literal("curious_about"),
  v.literal("avoids"),
  v.literal("requires"),
  v.literal("reinforces"),
  v.literal("contrasts_with"),
  v.literal("discovered_through"),
);

const sourceValidator = v.object({
  storageId: v.id("_storage"),
  fileName: v.string(),
  mediaType: v.string(),
  byteSize: v.number(),
  context: v.optional(v.string()),
});

const extractedNodeValidator = v.object({
  localKey: v.string(),
  category: nodeCategoryValidator,
  subtype: v.string(),
  label: v.string(),
  description: v.string(),
  certainty: v.union(v.literal("fact"), v.literal("hypothesis")),
  confidence: v.number(),
  salience: v.number(),
  evidence: v.string(),
});

const extractedEdgeValidator = v.object({
  fromKey: v.string(),
  toKey: v.string(),
  relation: relationValidator,
  polarity: v.union(
    v.literal("positive"),
    v.literal("negative"),
    v.literal("mixed"),
    v.literal("neutral"),
  ),
  familiarity: v.union(
    v.literal("familiar"),
    v.literal("new"),
    v.literal("mixed"),
    v.literal("not_applicable"),
  ),
  strength: v.number(),
  certainty: v.union(v.literal("fact"), v.literal("hypothesis")),
});

function cleanText(value: string, maximum: number, field: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (cleaned.length < 1 || cleaned.length > maximum) {
    throw new Error(`${field} must be between 1 and ${maximum} characters.`);
  }
  return cleaned;
}

function boundedUnit(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

async function personReferenceForNode(
  ctx: MutationCtx,
  ownerAccountId: Id<"accounts">,
  label: string,
  existingPeople: Array<Doc<"personReferences">>,
) {
  const displayName = cleanText(label, 100, "Person name");
  const normalizedName = normalizeName(displayName);
  const existing = existingPeople.find(
    (person) => person.normalizedName === normalizedName,
  );
  if (existing) return existing._id;

  const now = Date.now();
  const personReferenceId = await ctx.db.insert("personReferences", {
    ownerAccountId,
    displayName,
    normalizedName,
    source: "memory",
    createdAt: now,
    updatedAt: now,
  });
  existingPeople.push({
    _id: personReferenceId,
    _creationTime: now,
    ownerAccountId,
    displayName,
    normalizedName,
    source: "memory",
    createdAt: now,
    updatedAt: now,
  });
  return personReferenceId;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireCurrentAccount(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const registerUpload = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const account = await requireCurrentAccount(ctx);
    const existing = await ctx.db
      .query("accountPendingUploads")
      .withIndex("by_storage_id", (queryBuilder) =>
        queryBuilder.eq("storageId", args.storageId),
      )
      .unique();
    if (existing && existing.ownerAccountId !== account._id) {
      throw new Error("Upload does not belong to this account.");
    }
    if (!existing) {
      await ctx.db.insert("accountPendingUploads", {
        ownerAccountId: account._id,
        storageId: args.storageId,
        createdAt: Date.now(),
      });
    }
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Uploaded image is unavailable.");
    return url;
  },
});

export const persistExtraction = mutation({
  args: {
    clientRequestId: v.string(),
    source: v.union(v.literal("onboarding"), v.literal("reflection")),
    rawText: v.string(),
    title: v.string(),
    summary: v.string(),
    sources: v.array(sourceValidator),
    nodes: v.array(extractedNodeValidator),
    edges: v.array(extractedEdgeValidator),
  },
  handler: async (ctx, args) => {
    const account = await requireCurrentAccount(ctx);
    const clientRequestId = cleanText(
      args.clientRequestId,
      120,
      "Memory request id",
    );
    const existing = await ctx.db
      .query("accountMemories")
      .withIndex(
        "by_owner_account_id_and_client_request_id",
        (queryBuilder) =>
          queryBuilder
            .eq("ownerAccountId", account._id)
            .eq("clientRequestId", clientRequestId),
      )
      .unique();
    if (existing) {
      return {
        memoryId: existing._id,
        title: existing.title,
        summary: existing.summary,
        created: false,
      };
    }

    if (args.nodes.length < 1 || args.nodes.length > 40) {
      throw new Error("A memory graph must contain between 1 and 40 nodes.");
    }
    if (args.edges.length > 120 || args.sources.length > 4) {
      throw new Error("That memory graph is too large.");
    }
    const localKeys = new Set<string>();
    for (const node of args.nodes) {
      const key = cleanText(node.localKey, 100, "Graph node key");
      if (localKeys.has(key)) throw new Error("Graph node keys must be unique.");
      localKeys.add(key);
    }
    for (const edge of args.edges) {
      if (
        edge.fromKey === edge.toKey ||
        !localKeys.has(edge.fromKey) ||
        !localKeys.has(edge.toKey)
      ) {
        throw new Error("A graph edge references an unavailable node.");
      }
    }

    const now = Date.now();
    const memoryId = await ctx.db.insert("accountMemories", {
      ownerAccountId: account._id,
      clientRequestId,
      source: args.source,
      rawText: args.rawText.trim().slice(0, 12_000),
      title: cleanText(args.title, 90, "Memory title"),
      summary: cleanText(args.summary, 700, "Memory summary"),
      createdAt: now,
    });

    for (const [index, source] of args.sources.entries()) {
      const pendingUpload = await ctx.db
        .query("accountPendingUploads")
        .withIndex("by_storage_id", (queryBuilder) =>
          queryBuilder.eq("storageId", source.storageId),
        )
        .unique();
      if (!pendingUpload || pendingUpload.ownerAccountId !== account._id) {
        throw new Error("A memory image is unavailable or belongs to another account.");
      }
      await ctx.db.insert("accountMemorySources", {
        ownerAccountId: account._id,
        memoryId,
        storageId: source.storageId,
        fileName: cleanText(source.fileName, 180, "File name"),
        mediaType: cleanText(source.mediaType, 100, "Media type"),
        byteSize: Math.max(0, Math.floor(source.byteSize)),
        context: source.context?.trim().slice(0, 500) || undefined,
        createdAt: now + index,
      });
      await ctx.db.delete(pendingUpload._id);
    }

    const existingPeople = await ctx.db
      .query("personReferences")
      .withIndex("by_owner_account_id", (queryBuilder) =>
        queryBuilder.eq("ownerAccountId", account._id),
      )
      .take(100);
    const nodeIds = new Map<string, Id<"accountGraphNodes">>();
    for (const [index, node] of args.nodes.entries()) {
      const category = normalizeStoredCategory(node.category);
      if (!category) continue;
      const localKey = cleanText(node.localKey, 100, "Graph node key");
      const personReferenceId =
        category === "people"
          ? await personReferenceForNode(
              ctx,
              account._id,
              node.label,
              existingPeople,
            )
          : undefined;
      const nodeId = await ctx.db.insert("accountGraphNodes", {
        ownerAccountId: account._id,
        memoryId,
        personReferenceId,
        localKey,
        category,
        subtype: cleanText(node.subtype, 100, "Graph node subtype"),
        label: cleanText(node.label, 140, "Graph node label"),
        description: cleanText(
          node.description,
          900,
          "Graph node description",
        ),
        certainty: node.certainty,
        confidence: boundedUnit(node.confidence),
        salience: boundedUnit(node.salience),
        evidence: cleanText(node.evidence, 700, "Graph node evidence"),
        createdAt: now + args.sources.length + index,
      });
      nodeIds.set(localKey, nodeId);
    }

    for (const [index, edge] of args.edges.entries()) {
      const fromNodeId = nodeIds.get(edge.fromKey);
      const toNodeId = nodeIds.get(edge.toKey);
      if (!fromNodeId || !toNodeId) continue;
      await ctx.db.insert("accountGraphEdges", {
        ownerAccountId: account._id,
        memoryId,
        fromNodeId,
        toNodeId,
        relation: edge.relation,
        polarity: edge.polarity,
        familiarity: edge.familiarity,
        strength: boundedUnit(edge.strength),
        certainty: edge.certainty,
        createdAt:
          now + args.sources.length + args.nodes.length + index,
      });
    }

    return {
      memoryId,
      title: args.title,
      summary: args.summary,
      created: true,
    };
  },
});

export const graph = query({
  args: {},
  handler: async (ctx) => {
    const account = await requireCurrentAccount(ctx);
    const [memories, nodes, edges, pendingInvites, asFirst, asSecond] =
      await Promise.all([
        ctx.db
          .query("accountMemories")
          .withIndex("by_owner_account_id_and_created_at", (queryBuilder) =>
            queryBuilder.eq("ownerAccountId", account._id),
          )
          .order("desc")
          .take(50),
        ctx.db
          .query("accountGraphNodes")
          .withIndex("by_owner_account_id_and_created_at", (queryBuilder) =>
            queryBuilder.eq("ownerAccountId", account._id),
          )
          .order("asc")
          .take(240),
        ctx.db
          .query("accountGraphEdges")
          .withIndex("by_owner_account_id_and_created_at", (queryBuilder) =>
            queryBuilder.eq("ownerAccountId", account._id),
          )
          .order("asc")
          .take(480),
        ctx.db
          .query("connectionInvites")
          .withIndex("by_inviter_account_id_and_status", (queryBuilder) =>
            queryBuilder
              .eq("inviterAccountId", account._id)
              .eq("status", "pending"),
          )
          .take(100),
        ctx.db
          .query("connections")
          .withIndex("by_account_a_id", (queryBuilder) =>
            queryBuilder.eq("accountAId", account._id),
          )
          .take(100),
        ctx.db
          .query("connections")
          .withIndex("by_account_b_id", (queryBuilder) =>
            queryBuilder.eq("accountBId", account._id),
          )
          .take(100),
      ]);

    const personReferences = await ctx.db
      .query("personReferences")
      .withIndex("by_owner_account_id", (queryBuilder) =>
        queryBuilder.eq("ownerAccountId", account._id),
      )
      .take(100);
    const peopleById = new Map(personReferences.map((one) => [one._id, one]));
    const connectionByAccountId = new Map<
      Id<"accounts">,
      Doc<"connections">
    >();
    for (const connection of [...asFirst, ...asSecond]) {
      const otherAccountId =
        connection.accountAId === account._id
          ? connection.accountBId
          : connection.accountAId;
      connectionByAccountId.set(otherAccountId, connection);
    }
    const pendingPersonIds = new Set(
      pendingInvites
        .filter((invite) => invite.expiresAt > Date.now())
        .map((invite) => invite.personReferenceId),
    );

    const keptNodeIds = new Set<Id<"accountGraphNodes">>();
    const graphNodes = [];
    for (const node of nodes) {
      const category = normalizeStoredCategory(node.category);
      if (!category) continue;
      keptNodeIds.add(node._id);
      const person = node.personReferenceId
        ? peopleById.get(node.personReferenceId)
        : undefined;
      const connection = person?.identityAccountId
        ? connectionByAccountId.get(person.identityAccountId)
        : undefined;
      graphNodes.push({
        id: node._id,
        memoryId: node.memoryId,
        sourceType: "memory" as const,
        personReferenceId: node.personReferenceId,
        linkedUserId: person?.identityAccountId,
        connectionId: connection?._id,
        inviteStatus:
          node.personReferenceId && pendingPersonIds.has(node.personReferenceId)
            ? ("pending" as const)
            : undefined,
        category,
        subtype: node.subtype,
        kind: node.subtype,
        label: node.label,
        description: node.description,
        certainty: node.certainty,
        confidence: node.confidence,
        salience: node.salience,
        evidence: node.evidence,
        createdAt: node.createdAt,
      });
    }

    return {
      memoryCount: memories.length,
      memories: memories.map((memory) => ({
        id: memory._id,
        title: memory.title,
        summary: memory.summary,
        createdAt: memory.createdAt,
      })),
      nodes: graphNodes,
      edges: edges.flatMap((edge) => {
        if (
          !keptNodeIds.has(edge.fromNodeId) ||
          !keptNodeIds.has(edge.toNodeId)
        ) {
          return [];
        }
        return [
          {
            id: edge._id,
            memoryId: edge.memoryId,
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
            relation: edge.relation,
            polarity: edge.polarity,
            familiarity: edge.familiarity,
            strength: edge.strength,
            certainty: edge.certainty,
            createdAt: edge.createdAt,
          },
        ];
      }),
    };
  },
});
