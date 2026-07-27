import { BASE44_APP_ID } from "./base44Client";

const BASE44_MAX_ATTEMPTS = 3;
const BASE44_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export class Base44FunctionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "Base44FunctionError";
  }
}

function retryDelay(attempt: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, attempt * 400);
  });
}

async function invoke<T>(
  functionName: string,
  data: Record<string, unknown>,
  accessToken?: string,
) {
  const url =
    `https://base44.app/api/apps/${BASE44_APP_ID}/functions/${functionName}`;

  for (let attempt = 1; attempt <= BASE44_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-App-Id": BASE44_APP_ID,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(data),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      const payload = (await response.json().catch(() => ({}))) as
        T | { error?: string };
      if (response.ok) return payload as T;

      const error = new Base44FunctionError(
        "error" in (payload as { error?: string })
          ? (payload as { error?: string }).error || "Base44 request failed"
          : "Base44 request failed",
        response.status,
      );
      if (
        attempt === BASE44_MAX_ATTEMPTS ||
        !BASE44_RETRYABLE_STATUSES.has(response.status)
      ) {
        throw error;
      }
      console.warn("[base44:function] transient response", {
        functionName,
        attempt,
        status: response.status,
      });
    } catch (error) {
      if (error instanceof Base44FunctionError) throw error;
      if (attempt === BASE44_MAX_ATTEMPTS) throw error;
      console.warn("[base44:function] transient request failure", {
        functionName,
        attempt,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }

    await retryDelay(attempt);
  }

  throw new Base44FunctionError("Base44 request failed", 502);
}

export async function invokeSidequestData<T>(
  data: Record<string, unknown>,
  accessToken?: string,
): Promise<T> {
  const response = await invoke<{ value: T }>(
    "sidequest-data",
    data,
    accessToken,
  );
  return response.value;
}

export function connectMyPhone(
  args: {
    phone: string;
    country?: string;
    currentCity?: string;
    latitude?: number;
    longitude?: number;
    assignedPhone?: string;
    signedUpAt?: number;
  },
  accessToken: string,
) {
  return invokeSidequestData<{ viewer: import("./base44Auth").AuthenticatedViewer }>(
    { action: "connectMyPhone", ...args },
    accessToken,
  );
}

export function fetchMyConversation(
  args: { sinceCursor?: number; limit?: number },
  accessToken: string,
) {
  return invokeSidequestData<{
    messages: import("./backendTypes").ConversationMessageRecord[];
  }>({ action: "getMyConversation", ...args }, accessToken);
}

export function fetchMySession(accessToken: string) {
  return invokeSidequestData<{
    viewer: import("./base44Auth").AuthenticatedViewer;
  }>({ action: "getMySession" }, accessToken);
}

export function fetchMyGraph(accessToken: string) {
  return invokeSidequestData<import("./backendTypes").ExperienceGraphRecord>(
    { action: "getMyGraph" },
    accessToken,
  );
}

/** The same list the browser can ask for, read server-side to pair worlds up. */
export function fetchMyConnections(accessToken: string) {
  return invokeSidequestData<import("./backendTypes").MyConnectionsRecord>(
    { action: "getMyConnections" },
    accessToken,
  );
}

type NowChapterValue = {
  chapter: import("./nowChapterSchema").NowChapterRecord;
};

export function fetchMyNow(accessToken: string) {
  return invokeSidequestData<{
    homeCity: string;
    chapter: import("./nowChapterSchema").NowChapterRecord | null;
    avoidVenues: string[];
  }>({ action: "getMyNow" }, accessToken);
}

export function setMyHomeCity(homeCity: string, accessToken: string) {
  return invokeSidequestData<{ homeCity: string }>(
    { action: "setMyHomeCity", homeCity },
    accessToken,
  );
}

type TogetherChapterValue = {
  chapter: import("./togetherChapterSchema").TogetherChapterRecord;
};

export function fetchMyTogether(accessToken: string) {
  return invokeSidequestData<{
    homeCity: string;
    chapters: import("./togetherChapterSchema").TogetherChapterRecord[];
    avoidVenues: string[];
  }>({ action: "getMyTogether" }, accessToken);
}

/**
 * The partner's shareable ground for planning. Server-only: it carries one
 * account's labels on another account's request, so it is gated on the
 * internal secret as well as the caller's own session, and its result must
 * never be forwarded to a browser.
 */
export function fetchPartnerPlanningGraph(
  connectionId: string,
  accessToken: string,
) {
  return invokeSidequestData<{
    partnerUserId: string;
    partnerName: string;
    graph: import("./togetherChapterSchema").TogetherPlanningGraph;
  }>(
    {
      action: "getPartnerPlanningGraph",
      connectionId,
      internalSecret: internalSecret(),
    },
    accessToken,
  );
}

/** Server-only, for the same reason: it returns someone else's phone. */
export function fetchTogetherNotifyTarget(
  chapterId: string,
  accessToken: string,
) {
  return invokeSidequestData<{
    phone?: string;
    assignedPhone?: string;
    recipientName: string;
    senderName: string;
  }>(
    {
      action: "getTogetherNotifyTarget",
      chapterId,
      internalSecret: internalSecret(),
    },
    accessToken,
  );
}

export function createTogetherChapter(
  args: { connectionId: string; researchRunId: string; briefJson: string },
  accessToken: string,
) {
  return invokeSidequestData<TogetherChapterValue>(
    { action: "createTogetherChapter", ...args },
    accessToken,
  );
}

export function updateTogetherChapter(
  args: {
    chapterId: string;
    status: "draft" | "failed" | "proposed" | "accepted" | "declined" | "lived";
    contentJson?: string;
    evidenceJson?: string;
    venueName?: string;
    proposedFor?: string;
    scheduledFor?: string;
    declineReason?: string;
    partnerName?: string;
  },
  accessToken: string,
) {
  return invokeSidequestData<TogetherChapterValue>(
    { action: "updateTogetherChapter", ...args },
    accessToken,
  );
}

function internalSecret() {
  const secret = process.env.SIDEQUEST_INTERNAL_SECRET;
  if (!secret) {
    throw new Base44FunctionError(
      "SIDEQUEST_INTERNAL_SECRET is not configured.",
      500,
    );
  }
  return secret;
}

export function createNowChapter(
  args: { researchRunId: string; briefJson: string },
  accessToken: string,
) {
  return invokeSidequestData<NowChapterValue>(
    { action: "createNowChapter", ...args },
    accessToken,
  );
}

export function updateNowChapter(
  args: {
    chapterId: string;
    status: "proposed" | "failed" | "accepted" | "declined" | "lived";
    contentJson?: string;
    evidenceJson?: string;
    venueName?: string;
    scheduledFor?: string;
    declineReason?: string;
  },
  accessToken: string,
) {
  return invokeSidequestData<NowChapterValue>(
    { action: "updateNowChapter", ...args },
    accessToken,
  );
}
