import {
  buildMemoryExtractionPrompt,
  collapseMemoryGraphRows,
  MEMORY_EXTRACTOR_VERSION,
  type MemoryNodeCategory,
  type MemorySourceDescriptor,
  prepareMemoryExtraction,
} from "./memory-map.ts";

// Base44 entity rows are dynamic at this SDK boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export type MemoryImageInput = {
  sourceRef: string;
  contextSourceRef?: string;
  fileUri: string;
  fileName: string;
  mediaType: string;
  byteSize: number;
  context: string;
  position: number;
};

export type ExperienceMemoryInput = {
  user: Row;
  phone: string;
  authUserId: string;
  source: "onboarding" | "reflection";
  clientRequestId: string;
  text: string;
  images: MemoryImageInput[];
};

export type CompletedExperienceMemory = {
  memoryId: string;
  title: string;
  summary: string;
  created: boolean;
};

export type PreparedExperienceMemory =
  | {
      alreadyComplete: true;
      memoryId: string;
      title: string;
      summary: string;
    }
  | {
      alreadyComplete: false;
      memoryId: string;
      prompt: string;
      attachments: Array<{
        url: string;
        fileName: string;
        mediaType: string;
      }>;
    };

export class MemoryPipelineError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    message: string,
    status = 500,
    code = "MEMORY_PROCESSING_FAILED",
  ) {
    super(message);
    this.name = "MemoryPipelineError";
    this.status = status;
    this.code = code;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function categoryForNode(row: Row): MemoryNodeCategory {
  const category = stringValue(row.category);
  if (
    [
      "experience",
      "people",
      "place",
      "activity",
      "interest",
      "feeling",
      "condition",
      "pattern",
    ].includes(category)
  ) {
    return category as MemoryNodeCategory;
  }

  const categoryByKind: Record<string, MemoryNodeCategory> = {
    person: "people",
    place: "place",
    activity: "activity",
    setting: "condition",
    emotion: "feeling",
    motif: "pattern",
    constraint: "condition",
    context: "condition",
    memory: "experience",
  };
  return categoryByKind[stringValue(row.kind)] ?? "pattern";
}

function identityQuery(input: ExperienceMemoryInput) {
  const identities = [
    input.user?.id ? { owner_user_id: input.user.id } : undefined,
    input.authUserId ? { auth_user_id: input.authUserId } : undefined,
    input.phone ? { phone: input.phone } : undefined,
  ].filter(Boolean);

  return identities.length === 1 ? identities[0] : { $or: identities };
}

async function removeFailedAttempt(base44: Row, memoryId: string) {
  const service = base44.asServiceRole.entities;
  await service.ExperienceGraphEdge.deleteMany({ memory_id: memoryId });
  await service.ExperienceGraphNode.deleteMany({ memory_id: memoryId });
  await service.ExperienceMemorySource.deleteMany({ memory_id: memoryId });
}

async function findOrCreateMemory(
  base44: Row,
  input: ExperienceMemoryInput,
) {
  const memories = base44.asServiceRole.entities.ExperienceMemory;
  const rows = await memories.filter(
    {
      owner_user_id: input.user.id,
      client_request_id: input.clientRequestId,
    },
    "-created_at",
    1,
  );
  const existing = rows[0];
  if (existing?.status === "complete") {
    return { memory: existing, alreadyComplete: true };
  }

  if (
    existing?.status === "pending" &&
    Date.now() - Number(existing.processing_started_at ?? existing.created_at) <
      5 * 60 * 1000
  ) {
    throw new MemoryPipelineError(
      "This memory is already being processed.",
      409,
      "MEMORY_IN_PROGRESS",
    );
  }

  const inputKind =
    input.text && input.images.length > 0
      ? "mixed"
      : input.images.length > 0
        ? "image"
        : "text";
  const patch = {
    phone: input.phone || undefined,
    auth_user_id: input.authUserId || undefined,
    owner_user_id: input.user.id,
    client_request_id: input.clientRequestId,
    source: input.source,
    input_kind: inputKind,
    raw_text: input.text,
    image_count: input.images.length,
    source_count:
      (input.text ? 1 : 0) +
      input.images.length +
      input.images.filter((image) => image.context).length,
    extractor_version: MEMORY_EXTRACTOR_VERSION,
    status: "pending",
    processing_stage: "preserving_sources",
    error: "",
    processing_started_at: Date.now(),
  };

  if (existing) {
    await removeFailedAttempt(base44, existing.id);
    return {
      memory: await memories.update(existing.id, patch),
      alreadyComplete: false,
    };
  }

  return {
    memory: await memories.create({
      ...patch,
      created_at: Date.now(),
    }),
    alreadyComplete: false,
  };
}

async function preserveSources(
  base44: Row,
  memory: Row,
  input: ExperienceMemoryInput,
) {
  const sources = base44.asServiceRole.entities.ExperienceMemorySource;
  const createdAt = Date.now();
  const rows: Row[] = [];
  const descriptors: MemorySourceDescriptor[] = [];

  if (input.text) {
    rows.push({
      memory_id: memory.id,
      owner_user_id: input.user.id,
      auth_user_id: input.authUserId || undefined,
      source_ref: "text:main",
      source_type: "text",
      position: 0,
      text: input.text,
      created_at: createdAt,
    });
    descriptors.push({ ref: "text:main", type: "text", text: input.text });
  }

  for (const image of input.images) {
    rows.push({
      memory_id: memory.id,
      owner_user_id: input.user.id,
      auth_user_id: input.authUserId || undefined,
      source_ref: image.sourceRef,
      source_type: "image",
      position: image.position,
      file_uri: image.fileUri,
      file_name: image.fileName,
      media_type: image.mediaType,
      byte_size: image.byteSize,
      created_at: createdAt + image.position + 1,
    });
    descriptors.push({
      ref: image.sourceRef,
      type: "image",
      attachmentIndex: image.position,
    });

    if (image.context && image.contextSourceRef) {
      rows.push({
        memory_id: memory.id,
        owner_user_id: input.user.id,
        auth_user_id: input.authUserId || undefined,
        source_ref: image.contextSourceRef,
        source_type: "image_context",
        position: image.position,
        text: image.context,
        created_at: createdAt + image.position + 1,
      });
      descriptors.push({
        ref: image.contextSourceRef,
        type: "image_context",
        text: image.context,
        attachmentIndex: image.position,
      });
    }
  }

  if (rows.length === 0) {
    throw new MemoryPipelineError("A memory needs text or at least one image.", 400);
  }

  await sources.bulkCreate(rows);
  return descriptors;
}

async function loadPriorContext(
  base44: Row,
  memoryId: string,
  input: ExperienceMemoryInput,
) {
  const service = base44.asServiceRole.entities;
  const memories = await service.ExperienceMemory.filter(
    {
      ...identityQuery(input),
      status: "complete",
    },
    "-created_at",
    5000,
  );
  const completeMemoryIds = new Set(
    memories
      .filter((memory: Row) => memory.id !== memoryId)
      .map((memory: Row) => memory.id),
  );
  const nodes = await service.ExperienceGraphNode.filter(
    {
      $or: [
        { owner_user_id: input.user.id },
        ...(input.phone ? [{ phone: input.phone }] : []),
      ],
    },
    "-created_at",
    5000,
  );
  const completedNodes = nodes.filter(
    (node: Row) =>
      completeMemoryIds.has(node.memory_id) && node.source_type !== "connection",
  );
  const collapsed = collapseMemoryGraphRows(completedNodes, []);
  const existingConcepts = collapsed.nodes
    .map((node) => ({
      key: stringValue(node.canonical_key),
      category: categoryForNode(node),
      label: stringValue(node.label),
      description: stringValue(node.description),
      occurrenceCount: Number(node.occurrence_count ?? 1),
      salience: Number(node.salience ?? 0.5),
    }))
    .filter(
      (concept) =>
        concept.key &&
        concept.category !== "experience" &&
        concept.label &&
        concept.description,
    )
    .sort(
      (first, second) =>
        second.occurrenceCount - first.occurrenceCount ||
        second.salience - first.salience,
    )
    .slice(0, 120)
    .map((concept) => ({
      key: concept.key,
      category: concept.category,
      label: concept.label,
      description: concept.description,
      occurrenceCount: concept.occurrenceCount,
    }));
  const previousMemorySummaries = memories
    .filter((memory: Row) => memory.id !== memoryId)
    .map((memory: Row) => stringValue(memory.summary))
    .filter(Boolean)
    .slice(0, 16);

  return { existingConcepts, previousMemorySummaries };
}

export async function signedImageUrls(
  base44: Row,
  images: readonly MemoryImageInput[],
) {
  const urls: string[] = [];
  for (const image of [...images].sort(
    (first, second) => first.position - second.position,
  )) {
    try {
      const result = await base44.integrations.Core.CreateFileSignedUrl({
        file_uri: image.fileUri,
        expires_in: 3600,
      });
      const signedUrl = stringValue(result?.signed_url);
      if (!signedUrl) throw new Error("Signed URL was empty.");
      urls.push(signedUrl);
    } catch {
      throw new MemoryPipelineError(
        `I couldn’t securely open ${image.fileName}. I’ll upload it again when you retry.`,
        422,
        "IMAGE_REFERENCE_INVALID",
      );
    }
  }
  return urls;
}

async function ownedMemory(
  base44: Row,
  input: ExperienceMemoryInput,
  memoryId: string,
) {
  const memories = base44.asServiceRole.entities.ExperienceMemory;
  const memory = await memories.get(memoryId).catch(() => null);
  if (!memory || memory.owner_user_id !== input.user.id) {
    throw new MemoryPipelineError(
      "That memory could not be found.",
      404,
      "MEMORY_NOT_FOUND",
    );
  }
  return memory;
}

async function sourceDescriptors(base44: Row, memoryId: string) {
  const rows = await base44.asServiceRole.entities.ExperienceMemorySource.filter(
    { memory_id: memoryId },
    "created_at",
    100,
  );
  return rows.flatMap((row: Row): MemorySourceDescriptor[] => {
    const sourceRef = stringValue(row.source_ref);
    const sourceType = stringValue(row.source_type);
    if (!sourceRef) return [];
    if (sourceType === "text") {
      return [{ ref: sourceRef, type: "text", text: stringValue(row.text, 6_000) }];
    }
    if (sourceType === "image") {
      return [
        {
          ref: sourceRef,
          type: "image",
          attachmentIndex: Number(row.position ?? 0),
        },
      ];
    }
    if (sourceType === "image_context") {
      return [
        {
          ref: sourceRef,
          type: "image_context",
          text: stringValue(row.text),
          attachmentIndex: Number(row.position ?? 0),
        },
      ];
    }
    return [];
  });
}

export async function prepareExperienceMemory(
  base44: Row,
  input: ExperienceMemoryInput,
): Promise<PreparedExperienceMemory> {
  const memories = base44.asServiceRole.entities.ExperienceMemory;
  const { memory, alreadyComplete } = await findOrCreateMemory(base44, input);
  if (alreadyComplete) {
    return {
      alreadyComplete: true,
      memoryId: memory.id,
      title: stringValue(memory.title),
      summary: stringValue(memory.summary),
    };
  }

  try {
    const fileUrls = await signedImageUrls(base44, input.images);
    const sources = await preserveSources(base44, memory, input);
    const { existingConcepts, previousMemorySummaries } =
      await loadPriorContext(base44, memory.id, input);

    await memories.update(memory.id, { processing_stage: "extracting" });
    const orderedImages = [...input.images].sort(
      (first, second) => first.position - second.position,
    );
    return {
      alreadyComplete: false,
      memoryId: memory.id,
      prompt: buildMemoryExtractionPrompt({
        text: input.text,
        sources,
        existingConcepts,
        previousMemorySummaries,
      }),
      attachments: fileUrls.map((url, index) => ({
        url,
        fileName: orderedImages[index].fileName,
        mediaType: orderedImages[index].mediaType,
      })),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Memory preparation failed.";
    try {
      await memories.update(memory.id, {
        status: "failed",
        processing_stage: "failed",
        error: message.slice(0, 500),
        processed_at: Date.now(),
      });
    } catch {
      // Preserve the original preparation error.
    }
    throw error;
  }
}

export async function completeExperienceMemory(
  base44: Row,
  input: ExperienceMemoryInput,
  memoryId: string,
  rawExtraction: unknown,
): Promise<CompletedExperienceMemory> {
  const memories = base44.asServiceRole.entities.ExperienceMemory;
  const memory = await ownedMemory(base44, input, memoryId);
  if (memory.status === "complete") {
    return {
      memoryId: memory.id,
      title: stringValue(memory.title),
      summary: stringValue(memory.summary),
      created: false,
    };
  }
  if (memory.status !== "pending") {
    throw new MemoryPipelineError(
      "That memory is not ready to be completed.",
      409,
      "MEMORY_NOT_PENDING",
    );
  }

  try {
    const sources = await sourceDescriptors(base44, memory.id);
    if (sources.length === 0) {
      throw new MemoryPipelineError(
        "The memory sources were not preserved.",
        422,
        "MEMORY_SOURCES_MISSING",
      );
    }
    const { existingConcepts } = await loadPriorContext(
      base44,
      memory.id,
      input,
    );
    const extraction = prepareMemoryExtraction(rawExtraction, {
      memoryId: memory.id,
      sources,
      existingConcepts,
    });

    await memories.update(memory.id, { processing_stage: "persisting_graph" });
    const now = Date.now();
    const createdNodes =
      await base44.asServiceRole.entities.ExperienceGraphNode.bulkCreate(
        extraction.nodes.map((node, index) => ({
          phone: input.phone || undefined,
          auth_user_id: input.authUserId || undefined,
          memory_id: memory.id,
          owner_user_id: input.user.id,
          source_type: "memory",
          key: node.canonicalKey,
          canonical_key: node.canonicalKey,
          category: node.category,
          subtype: node.subtype,
          kind: node.kind,
          label: node.label,
          description: node.description,
          basis: node.basis,
          certainty: node.certainty,
          confidence: node.confidence,
          salience: node.salience,
          evidence: node.evidence,
          source_refs: node.sourceRefs,
          prior_support_keys: node.priorSupportKeys,
          extractor_version: MEMORY_EXTRACTOR_VERSION,
          created_at: now + index,
        })),
      );
    const createdByLocalKey = new Map(
      extraction.nodes.map((node, index) => [
        node.localKey,
        createdNodes[index],
      ]),
    );
    const edgeRows = extraction.edges.flatMap((edge, index) => {
      const from = createdByLocalKey.get(edge.fromLocalKey);
      const to = createdByLocalKey.get(edge.toLocalKey);
      if (!from || !to || from.id === to.id) return [];
      return [
        {
          phone: input.phone || undefined,
          auth_user_id: input.authUserId || undefined,
          owner_user_id: input.user.id,
          memory_id: memory.id,
          from_node_id: from.id,
          to_node_id: to.id,
          relation: edge.relation,
          polarity: edge.polarity,
          familiarity: edge.familiarity,
          strength: edge.confidence,
          relationship: edge.relation,
          description: edge.description,
          basis: edge.basis,
          certainty: edge.certainty,
          confidence: edge.confidence,
          evidence: edge.evidence,
          source_refs: edge.sourceRefs,
          extractor_version: MEMORY_EXTRACTOR_VERSION,
          created_at: now + extraction.nodes.length + index,
        },
      ];
    });
    if (edgeRows.length > 0) {
      await base44.asServiceRole.entities.ExperienceGraphEdge.bulkCreate(
        edgeRows,
      );
    }

    await memories.update(memory.id, {
      title: extraction.title,
      summary: extraction.summary,
      status: "complete",
      processing_stage: "complete",
      processed_at: Date.now(),
    });
    return {
      memoryId: memory.id,
      title: extraction.title,
      summary: extraction.summary,
      created: true,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Memory analysis failed.";
    try {
      await memories.update(memory.id, {
        status: "failed",
        processing_stage: "failed",
        error: message.slice(0, 500),
        processed_at: Date.now(),
      });
    } catch {
      // Preserve the original extraction error.
    }
    throw error;
  }
}

export async function failExperienceMemory(
  base44: Row,
  input: ExperienceMemoryInput,
  memoryId: string,
  errorMessage: string,
) {
  const memories = base44.asServiceRole.entities.ExperienceMemory;
  const memory = await ownedMemory(base44, input, memoryId);
  if (memory.status === "complete") return { failed: false };
  await memories.update(memory.id, {
    status: "failed",
    processing_stage: "failed",
    error: stringValue(errorMessage, 500) || "Memory extraction failed.",
    processed_at: Date.now(),
  });
  return { failed: true };
}
