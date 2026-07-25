import { Base44FunctionError, fetchMySession } from "@/lib/base44Functions";
import { type ChatReplyResult } from "@/lib/backendTypes";
import { markSidequestMessageDelivered, processSidequestMessage } from "@/lib/sidequestMessaging";
import { getSidequestBot } from "@/lib/sidequestBot";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatRequestBody = { text?: unknown; messageId?: unknown };

function chatRequestBody(body: unknown): body is ChatRequestBody {
  return body !== null && typeof body === "object";
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) {
    return Response.json({ error: "Sign in before chatting." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!chatRequestBody(body)) {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return Response.json({ error: "Say something first." }, { status: 400 });
  }

  const suppliedMessageId =
    typeof body.messageId === "string" && body.messageId.trim()
      ? body.messageId.trim()
      : crypto.randomUUID();

  let session;
  try {
    session = await fetchMySession(accessToken);
  } catch (cause) {
    if (cause instanceof Base44FunctionError) {
      return Response.json(
        { error: cause.message },
        { status: cause.status === 401 ? 401 : 502 },
      );
    }
    console.error("Sidequest chat session lookup failed:", cause);
    return Response.json(
      { error: "Couldn't open your Sidequest profile. Try again." },
      { status: 502 },
    );
  }

  const viewer = session.viewer;

  let result: ChatReplyResult;
  try {
    result = await processSidequestMessage({
      authUserId: viewer.id,
      phone: viewer.phone,
      text,
      messageId: suppliedMessageId,
      threadId: crypto.randomUUID(),
      channel: "web",
      accessToken,
    });
  } catch (cause) {
    console.error("Sidequest chat send failed:", cause);
    return Response.json(
      { error: "Your message didn't reach Sidequest." },
      { status: 502 },
    );
  }

  if (result.reply && result.replyId) {
    const mirrorEnabled = Boolean(viewer.assignedPhone) && Boolean(viewer.phone);
    if (mirrorEnabled) {
      await mirrorReplyToIMessage({
        targetPhone: viewer.phone as string,
        reply: result.reply,
        replyId: result.replyId,
      });
    } else {
      try {
        await markSidequestMessageDelivered({ replyId: result.replyId });
      } catch (error) {
        console.error("Could not mark the web reply delivered:", error);
      }
    }
  }

  return Response.json({
    reply: result.reply,
    replyId: result.replyId,
    duplicate: result.duplicate,
  });
}

async function mirrorReplyToIMessage(args: {
  targetPhone: string;
  reply: string;
  replyId: string;
}) {
  const { targetPhone, reply, replyId } = args;
  try {
    const bot = getSidequestBot();
    const imessage = bot.getAdapter("imessage");
    const threadId = await imessage.openDM(targetPhone);
    const sent = await imessage.postMessage(threadId, reply);
    try {
      await markSidequestMessageDelivered({ replyId, providerMessageId: sent.id });
    } catch (error) {
      console.error("Could not mark the mirrored reply delivered:", error);
    }
  } catch (error) {
    console.error("iMessage mirror send failed:", error);
  }
}