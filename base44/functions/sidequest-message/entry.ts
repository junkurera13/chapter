import { createClientFromRequest } from "npm:@base44/sdk";

// Base44 entity rows are dynamic at this SDK boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function stringValue(value: unknown, maximum = 10_000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function replyRecord(row: Row | undefined) {
  if (!row || row.delivery_status === "sent") return null;
  return {
    status: "complete",
    reply: stringValue(row.text),
    replyId: row.id,
  };
}

async function resolveUser(base44: Row, input: Row) {
  const users = base44.asServiceRole.entities.SidequestUser;
  const requestedAuthUserId = stringValue(input.authUserId, 160);
  let phone = stringValue(input.phone, 30);
  let authUserId = "";

  if (requestedAuthUserId) {
    const viewer = await base44.auth.me().catch(() => null);
    if (!viewer) {
      return { error: "authentication required", status: 401 };
    }
    if (viewer.id !== requestedAuthUserId) {
      return { error: "viewer mismatch", status: 403 };
    }
    const rows = await users.filter(
      { auth_user_id: viewer.id },
      undefined,
      1,
    );
    const user = rows[0];
    if (!user) {
      return {
        error: "sidequest profile missing; open the app first",
        status: 404,
      };
    }
    authUserId = viewer.id;
    phone = stringValue(user.phone, 30) || phone;
    return { user, phone, authUserId };
  }

  if (!phone) {
    return { error: "phone or authUserId required", status: 400 };
  }
  const rows = await users.filter({ phone }, undefined, 1);
  const user =
    rows[0] ||
    (await users.create({
      phone,
      first_seen_at: Date.now(),
      onboarding_step: "needs_memory_invite",
    }));
  authUserId = stringValue(user.auth_user_id, 160);
  return { user, phone, authUserId };
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
      const replyId = stringValue(input.replyId, 160);
      if (!replyId) {
        return Response.json({ error: "replyId required" }, { status: 400 });
      }
      await messages.update(replyId, {
        delivery_status: "sent",
        provider_message_id: stringValue(input.providerMessageId, 160) || undefined,
      });
      return Response.json({ value: { delivered: true } });
    }

    const identity = await resolveUser(base44, input);
    if ("error" in identity) {
      return Response.json(
        { error: identity.error },
        { status: identity.status },
      );
    }
    const { user, phone, authUserId } = identity;
    const requestedChannel = stringValue(input.channel, 20) || "imessage";
    const channel = requestedChannel === "web" ? "web" : "imessage";
    const messageId = stringValue(input.messageId, 200);
    const threadId = stringValue(input.threadId, 200);

    if (input.action === "complete") {
      const reply = stringValue(input.reply, 20_000);
      if (!messageId || !reply) {
        return Response.json(
          { error: "messageId and reply required" },
          { status: 400 },
        );
      }
      const existingReplies = await messages.filter(
        { reply_to_external_id: messageId, role: "agent" },
        "-created_at",
        1,
      );
      const existingReply = replyRecord(existingReplies[0]);
      if (existingReply) {
        return Response.json({
          value: { ...existingReply, duplicate: true },
        });
      }
      if (existingReplies[0]?.delivery_status === "sent") {
        return Response.json({
          value: { status: "complete", reply: null, duplicate: true },
        });
      }

      const session =
        input.session && typeof input.session === "object" ? input.session : {};
      await base44.asServiceRole.entities.SidequestUser.update(user.id, {
        eve_session_id: stringValue(session.sessionId, 200) || undefined,
        eve_continuation_token:
          stringValue(session.continuationToken, 500) || undefined,
        eve_stream_index: numberValue(session.streamIndex),
      });
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
      return Response.json({
        value: {
          status: "complete",
          reply,
          replyId: replyRow.id,
        },
      });
    }

    if (input.action !== "begin") {
      return Response.json({ error: "unknown message action" }, { status: 400 });
    }

    const text = stringValue(input.text, 20_000);
    if (!text || !messageId) {
      return Response.json(
        { error: "text and messageId required" },
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
        return Response.json({
          value: { ...existingReply, duplicate: true },
        });
      }
      if (existingReplies[0]?.delivery_status === "sent") {
        return Response.json({
          value: { status: "complete", reply: null, duplicate: true },
        });
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

    const users = base44.asServiceRole.entities.SidequestUser;
    const onboardingStep =
      user.onboarding_step || "needs_memory_invite";
    let contextStep = onboardingStep;
    if (onboardingStep === "needs_memory_invite") {
      await users.update(user.id, { onboarding_step: "awaiting_memory" });
    } else if (
      onboardingStep === "awaiting_memory" &&
      /^(skip|later|not now)\b/i.test(text)
    ) {
      await users.update(user.id, { onboarding_step: "memory_ready" });
      contextStep = "memory_ready";
    }

    return Response.json({
      value: {
        status: "ready",
        duplicate: Boolean(existingIncoming[0]),
        user: {
          id: user.id,
          authUserId: authUserId || undefined,
          phone: phone || undefined,
          name: stringValue(user.name, 200) || undefined,
          onboardingStep: contextStep,
          notes: stringValue(user.notes, 20_000) || undefined,
        },
        session: {
          sessionId: stringValue(user.eve_session_id, 200) || undefined,
          continuationToken:
            stringValue(user.eve_continuation_token, 500) || undefined,
          streamIndex: numberValue(user.eve_stream_index),
        },
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "sidequest message failed";
    console.error("sidequest-message failed", error);
    return Response.json({ error: message }, { status: 500 });
  }
});
