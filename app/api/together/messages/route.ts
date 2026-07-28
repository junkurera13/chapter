import {
  Base44FunctionError,
  fetchMyHumanConversations,
  sendHumanMessage,
} from "@/lib/base44Functions";
import { isUndeployedBase44Action } from "@/lib/backendCompatibility";
import { withBackendDetail } from "@/lib/backendFailureDetail";

export const runtime = "nodejs";

function accessTokenFrom(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function unauthenticated() {
  return Response.json(
    { error: "Your session expired. Sign in again.", code: "AUTHENTICATION_REQUIRED" },
    { status: 401 },
  );
}

function failed(error: unknown) {
  const status = error instanceof Base44FunctionError ? error.status : undefined;
  return Response.json(
    {
      error: withBackendDetail("Chapter couldn’t read that just now.", error, status),
      code: "TOGETHER_FAILED",
    },
    { status: status === 404 ? 404 : 502 },
  );
}

export async function GET(request: Request) {
  const accessToken = accessTokenFrom(request);
  if (!accessToken) return unauthenticated();
  try {
    return Response.json({
      value: await fetchMyHumanConversations(accessToken),
    });
  } catch (error) {
    // Local UI work commonly runs against the last deployed Base44 function.
    // Until the messaging actions are explicitly deployed, an older function
    // should look like an empty inbox rather than a Next.js error overlay.
    if (isUndeployedBase44Action(error)) {
      return Response.json({ value: { conversations: [] } });
    }
    return failed(error);
  }
}

export async function POST(request: Request) {
  const accessToken = accessTokenFrom(request);
  if (!accessToken) return unauthenticated();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const connectionId = typeof body.connectionId === "string"
      ? body.connectionId
      : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!connectionId || !message || message.length > 1_000) {
      return Response.json(
        { error: "Chapter couldn’t read that.", code: "TOGETHER_BAD_REQUEST" },
        { status: 400 },
      );
    }
    return Response.json({
      value: await sendHumanMessage({ connectionId, message }, accessToken),
    });
  } catch (error) {
    return failed(error);
  }
}
