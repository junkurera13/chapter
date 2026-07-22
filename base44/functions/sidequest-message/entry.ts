import { createClientFromRequest } from "npm:@base44/sdk";

// Base44 entity rows are dynamic at this SDK boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const memorySchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "nodes", "edges"],
  properties: {
    summary: { type: "string" },
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "key",
          "category",
          "subtype",
          "kind",
          "label",
          "description",
          "certainty",
          "confidence",
          "salience",
          "evidence",
        ],
        properties: {
          key: { type: "string" },
          category: {
            type: "string",
            enum: [
              "experience",
              "people",
              "place",
              "activity",
              "interest",
              "feeling",
              "condition",
              "pattern",
            ],
          },
          subtype: { type: "string" },
          kind: {
            type: "string",
            enum: [
              "person",
              "place",
              "activity",
              "setting",
              "emotion",
              "motif",
              "constraint",
              "context",
              "memory",
            ],
          },
          label: { type: "string" },
          description: { type: "string" },
          certainty: { type: "string", enum: ["fact", "hypothesis"] },
          confidence: { type: "number" },
          salience: { type: "number" },
          evidence: { type: "string" },
        },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "from_key",
          "to_key",
          "relation",
          "polarity",
          "familiarity",
          "description",
          "certainty",
          "confidence",
          "evidence",
        ],
        properties: {
          from_key: { type: "string" },
          to_key: { type: "string" },
          relation: {
            type: "string",
            enum: [
              "lived",
              "cares_about",
              "shared_with",
              "happened_at",
              "involved",
              "evoked",
              "shaped_by",
              "supported",
              "reflects",
              "part_of",
              "drawn_to",
              "familiar_with",
              "curious_about",
              "avoids",
              "requires",
              "reinforces",
              "contrasts_with",
              "discovered_through",
            ],
          },
          polarity: {
            type: "string",
            enum: ["positive", "negative", "mixed", "neutral"],
          },
          familiarity: {
            type: "string",
            enum: ["familiar", "new", "mixed", "not_applicable"],
          },
          description: { type: "string" },
          certainty: { type: "string", enum: ["fact", "hypothesis"] },
          confidence: { type: "number" },
          evidence: { type: "string" },
        },
      },
    },
  },
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function boundedNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1)
    : fallback;
}

function replyRecord(row: Row | undefined) {
  if (!row || row.delivery_status === "sent") return null;
  return { reply: row.text, replyId: row.id };
}

async function analyzeMemory(
  base44: Row,
  user: Row,
  phone: string,
  text: string,
) {
  const memories = base44.asServiceRole.entities.ExperienceMemory;
  const nodes = base44.asServiceRole.entities.ExperienceGraphNode;
  const edges = base44.asServiceRole.entities.ExperienceGraphEdge;
  const memory = await memories.create({
    phone,
    source: "onboarding",
    raw_text: text,
    status: "pending",
    created_at: Date.now(),
  });

  try {
    const parsed = (await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: [
        "Extract a small experience graph from one autobiographical memory.",
        "Preserve the person's own meaning. Do not diagnose them or turn weak clues into facts.",
        "Use fact for explicit details and hypothesis only for careful inferences.",
        "Nodes should capture the memory itself plus meaningful people, places, activities, emotions, motifs, and constraints.",
        "Every explicitly named individual person must be a separate people/person node with their own name as the label.",
        "Never collapse named people into a generic group node such as friends, travel companions, family, or colleagues.",
        "Only add a separate group node when the group itself has distinct meaning beyond the named individuals.",
        "For named people, use a stable key in the form person:<lowercase-normalized-name>.",
        "Edges must only reference node keys you return.",
        "Keep the summary under 90 words and useful for composing a future real-world experience.",
        "",
        `memory: ${text}`,
      ].join("\n"),
      response_json_schema: memorySchema,
    })) as Row;

    const createdByKey = new Map<string, Row>();
    for (const rawNode of parsed.nodes ?? []) {
      const key = stringValue(rawNode.key);
      if (!key || createdByKey.has(key)) continue;
      const created = await nodes.create({
        phone,
        memory_id: memory.id,
        owner_user_id: user.id,
        source_type: "memory",
        key,
        category: rawNode.category,
        subtype: stringValue(rawNode.subtype),
        kind: rawNode.kind,
        label: stringValue(rawNode.label),
        description: stringValue(rawNode.description),
        certainty: rawNode.certainty,
        confidence: boundedNumber(rawNode.confidence, 0.7),
        salience: boundedNumber(rawNode.salience, 0.6),
        evidence: stringValue(rawNode.evidence),
        created_at: Date.now(),
      });
      createdByKey.set(key, created);
    }

    for (const rawEdge of parsed.edges ?? []) {
      const from = createdByKey.get(stringValue(rawEdge.from_key));
      const to = createdByKey.get(stringValue(rawEdge.to_key));
      if (!from || !to || from.id === to.id) continue;
      await edges.create({
        phone,
        memory_id: memory.id,
        from_node_id: from.id,
        to_node_id: to.id,
        relation: rawEdge.relation,
        polarity: rawEdge.polarity,
        familiarity: rawEdge.familiarity,
        strength: boundedNumber(rawEdge.confidence, 0.6),
        relationship: rawEdge.relation,
        description: stringValue(rawEdge.description),
        certainty: rawEdge.certainty,
        confidence: boundedNumber(rawEdge.confidence, 0.7),
        evidence: stringValue(rawEdge.evidence),
        created_at: Date.now(),
      });
    }

    const summary = stringValue(parsed.summary);
    await memories.update(memory.id, {
      status: "complete",
      summary,
      processed_at: Date.now(),
    });
    return summary;
  } catch (error) {
    await memories.update(memory.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "memory analysis failed",
      processed_at: Date.now(),
    });
    throw error;
  }
}

async function composeReply(base44: Row, user: Row, phone: string, text: string) {
  const users = base44.asServiceRole.entities.SidequestUser;
  const step = user.onboarding_step || "needs_memory_invite";

  if (step === "needs_memory_invite") {
    await users.update(user.id, { onboarding_step: "awaiting_memory" });
    return "Hey. Tell me about an experience you’ll never forget. Dump everything you remember—who was there, what you did, where it happened, and why it felt special. Messy and long is perfect.";
  }

  if (step === "awaiting_memory") {
    if (/^(skip|later|not now)\b/i.test(text)) {
      await users.update(user.id, { onboarding_step: "memory_ready" });
      return "Okay.";
    }

    const summary = await analyzeMemory(base44, user, phone, text);
    const previousNotes = stringValue(user.notes);
    await users.update(user.id, {
      notes: previousNotes ? `${previousNotes}\n${summary}` : summary,
      memory_updated_at: Date.now(),
      onboarding_step: "memory_ready",
    });
    return "I’ve got it.";
  }

  return "I’m listening.";
}

Deno.serve(async (req) => {
  try {
    const input = (await req.json()) as Row;
    const expectedSecret = Deno.env.get("SIDEQUEST_INTERNAL_SECRET");
    if (!expectedSecret || input.internalSecret !== expectedSecret) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const messages = base44.asServiceRole.entities.ConversationMessage;

    if (input.action === "markDelivered") {
      const replyId = stringValue(input.replyId);
      if (!replyId) {
        return Response.json({ error: "replyId required" }, { status: 400 });
      }
      await messages.update(replyId, {
        delivery_status: "sent",
        provider_message_id: stringValue(input.providerMessageId) || undefined,
      });
      return Response.json({ value: { delivered: true } });
    }

    const phone = stringValue(input.phone);
    const text = stringValue(input.text);
    const messageId = stringValue(input.messageId);
    const threadId = stringValue(input.threadId);
    if (!phone || !text || !messageId) {
      return Response.json(
        { error: "phone, text, and messageId required" },
        { status: 400 },
      );
    }

    const existingIncoming = await messages.filter(
      { external_id: messageId, role: "user" },
      undefined,
      1,
    );
    if (existingIncoming[0]) {
      const existingReplies = await messages.filter(
        { reply_to_external_id: messageId, role: "agent" },
        "-created_at",
        1,
      );
      const existingReply = replyRecord(existingReplies[0]);
      if (existingReply) {
        return Response.json({ value: { ...existingReply, duplicate: true } });
      }
      if (existingReplies[0]?.delivery_status === "sent") {
        return Response.json({ value: { reply: null, duplicate: true } });
      }
    } else {
      await messages.create({
        phone,
        external_id: messageId,
        thread_id: threadId || undefined,
        channel: "imessage",
        role: "user",
        text,
        created_at: Date.now(),
      });
    }

    const users = base44.asServiceRole.entities.SidequestUser;
    const userRows = await users.filter({ phone }, undefined, 1);
    const user =
      userRows[0] ||
      (await users.create({
        phone,
        first_seen_at: Date.now(),
        onboarding_step: "needs_memory_invite",
      }));

    const reply = await composeReply(base44, user, phone, text);
    const replyRow = await messages.create({
      phone,
      reply_to_external_id: messageId,
      thread_id: threadId || undefined,
      channel: "imessage",
      delivery_status: "pending",
      role: "agent",
      text: reply,
      created_at: Date.now(),
    });

    return Response.json({ value: { reply, replyId: replyRow.id } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "sidequest message failed";
    console.error("sidequest-message failed", error);
    return Response.json({ error: message }, { status: 500 });
  }
});
