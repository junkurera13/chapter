import { fetchMyConversation } from "@/lib/base44Functions";
import type { ConversationMessageRecord } from "@/lib/backendTypes";

export const runtime = "nodejs";
export const maxDuration = 300;

const INITIAL_POLL_DELAY_MS = 1_000;
const POLL_INTERVAL_MS = 5_000;
const MAX_CONNECTION_MS = 4 * 60 * 1000;
const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=UTF-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

function unauthorized(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) {
    return unauthorized("Sign in before chatting.");
  }

  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const sinceCursor =
    sinceParam && Number.isFinite(Number(sinceParam))
      ? Number(sinceParam)
      : 0;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send<T>(event: string, data: T) {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          closed = true;
        }
      }

      let cursor = sinceCursor;
      let busy = false;

      async function poll() {
        if (closed || busy) return;
        busy = true;
        try {
          const result = await fetchMyConversation(
            { sinceCursor: cursor },
            accessToken,
          );
          for (const message of result.messages) {
            send<ConversationMessageRecord>("message", message);
            if (message.createdAt > cursor) cursor = message.createdAt;
          }
        } catch (error) {
          console.error("Sidequest chat stream poll failed:", error);
          send("error", { message: "poll-failed" });
        } finally {
          busy = false;
        }
      }

      const initialPoll = setTimeout(poll, INITIAL_POLL_DELAY_MS);
      const interval = setInterval(poll, POLL_INTERVAL_MS);
      const stop = setTimeout(() => {
        clearTimeout(initialPoll);
        clearInterval(interval);
        send("restart", { cursor });
        try {
          controller.close();
        } catch {
          // already closed
        } finally {
          closed = true;
        }
      }, MAX_CONNECTION_MS);

      function onAbort() {
        if (closed) return;
        clearTimeout(initialPoll);
        clearInterval(interval);
        clearTimeout(stop);
        try {
          controller.close();
        } catch {
          // already closed
        } finally {
          closed = true;
        }
      }

      request.signal.addEventListener("abort", onAbort, { once: true });
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
