import { createClientFromRequest } from "npm:@base44/sdk";

import { ingestExperienceMemory } from "../../shared/memory-pipeline.ts";

// Base44 entity rows are dynamic at this SDK boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function replyRecord(row: Row | undefined) {
  if (!row || row.delivery_status === "sent") return null;
  return { reply: row.text, replyId: row.id };
}

async function composeReply(
  base44: Row,
  user: Row,
  phone: string,
  authUserId: string,
  text: string,
  messageId: string,
) {
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

    const memory = await ingestExperienceMemory(base44, {
      user,
      phone,
      authUserId,
      source: "onboarding",
      clientRequestId: `imessage:${messageId}`,
      text,
      images: [],
    });
    const summary = memory.summary;
    const previousNotes = stringValue(user.notes);
    await users.update(user.id, {
      ...(memory.created
        ? { notes: previousNotes ? `${previousNotes}\n${summary}` : summary }
        : {}),
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

    const requestedChannel = stringValue(input.channel) || "imessage";
    const channel = requestedChannel === "web" ? "web" : "imessage";
    const requestedAuthUserId = stringValue(input.authUserId);
    const text = stringValue(input.text);
    const messageId = stringValue(input.messageId);
    const threadId = stringValue(input.threadId);

    if (!text || !messageId) {
      return Response.json(
        { error: "text and messageId required" },
        { status: 400 },
      );
    }

    const users = base44.asServiceRole.entities.SidequestUser;
    let phone = stringValue(input.phone);
    let authUserId = "";

    if (requestedAuthUserId) {
      const viewer = await base44.auth.me().catch(() => null);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }
      if (viewer.id !== requestedAuthUserId) {
        return Response.json({ error: "viewer mismatch" }, { status: 403 });
      }

      const rows = await users.filter(
        { auth_user_id: viewer.id },
        undefined,
        1,
      );
      const linked = rows[0];
      if (!linked) {
        return Response.json(
          { error: "sidequest profile missing; open the app first" },
          { status: 404 },
        );
      }
      authUserId = viewer.id;
      phone = stringValue(linked.phone) || phone;
    } else {
      if (!phone) {
        return Response.json(
          { error: "phone or authUserId required" },
          { status: 400 },
        );
      }
      const rows = await users.filter({ phone }, undefined, 1);
      const linked =
        rows[0] ||
        (await users.create({
          phone,
          first_seen_at: Date.now(),
          onboarding_step: "needs_memory_invite",
        }));
      authUserId = stringValue(linked.auth_user_id);
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
        phone: phone || undefined,
        auth_user_id: authUserId || undefined,
        external_id: messageId,
        thread_id: threadId || undefined,
        channel,
        role: "user",
        text,
        created_at: Date.now(),
      });
    }

    const userRows = await users.filter(
      requestedAuthUserId
        ? { auth_user_id: authUserId }
        : { phone },
      undefined,
      1,
    );
    const user = userRows[0];
    if (!user) {
      return Response.json({ error: "sidequest profile not found" }, { status: 404 });
    }

    const reply = await composeReply(
      base44,
      user,
      phone,
      authUserId,
      text,
      messageId,
    );
    const replyRow = await messages.create({
      phone: phone || undefined,
      auth_user_id: authUserId || undefined,
      reply_to_external_id: messageId,
      thread_id: threadId || undefined,
      channel,
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
