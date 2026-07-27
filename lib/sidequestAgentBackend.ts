import { BASE44_APP_ID } from "./base44Client";
import type { MemoryExtraction } from "./memoryExtractionSchema";

export type MemoryImagePayload = {
  fileUri: string;
  fileName: string;
  mediaType: string;
  byteSize: number;
  context: string;
};

export type PreparedMemory = {
  alreadyComplete: boolean;
  memoryId: string;
  title?: string;
  summary?: string;
  prompt?: string;
  attachments?: Array<{
    url: string;
    fileName: string;
    mediaType: string;
  }>;
};

export type CompletedMemory = {
  memoryId: string;
  title: string;
  summary: string;
  created: boolean;
};

export type EveSessionCursor = {
  sessionId?: string;
  continuationToken?: string;
  streamIndex: number;
};

export type PreparedMessage = {
  status: "ready";
  duplicate?: boolean;
  user: {
    id: string;
    authUserId?: string;
    phone?: string;
    name?: string;
    onboardingStep: "needs_memory_invite" | "awaiting_memory" | "memory_ready";
    notes?: string;
  };
  session: EveSessionCursor;
};

export type CompletedMessage = {
  status: "complete";
  reply: string | null;
  replyId?: string;
  duplicate?: boolean;
};

type Base44FunctionPayload<T> = {
  value?: T;
  error?: string;
  code?: string;
};

const BASE44_MAX_ATTEMPTS = 3;
const BASE44_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export class SidequestBackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "BASE44_FUNCTION_FAILED",
  ) {
    super(message);
    this.name = "SidequestBackendError";
  }
}

function retryDelay(attempt: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, attempt * 400);
  });
}

async function invokeBase44<T>(
  functionName: string,
  data: Record<string, unknown>,
  accessToken?: string,
) {
  const internalSecret = process.env.SIDEQUEST_INTERNAL_SECRET;
  if (!internalSecret) {
    throw new SidequestBackendError(
      "SIDEQUEST_INTERNAL_SECRET is not configured.",
      500,
      "SERVER_CONFIGURATION_ERROR",
    );
  }

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
        body: JSON.stringify({ ...data, internalSecret }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      const payload = (await response.json().catch(() => ({}))) as
        Base44FunctionPayload<T>;
      if (response.ok && payload.value !== undefined) {
        return payload.value;
      }

      const error = new SidequestBackendError(
        payload.error || `Base44 ${functionName} failed.`,
        response.status,
        payload.code,
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
      if (error instanceof SidequestBackendError) throw error;
      if (attempt === BASE44_MAX_ATTEMPTS) throw error;
      console.warn("[base44:function] transient request failure", {
        functionName,
        attempt,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }

    await retryDelay(attempt);
  }

  throw new SidequestBackendError(
    `Base44 ${functionName} failed.`,
    502,
  );
}

export function prepareMemory(
  args: {
    authUserId?: string;
    phone?: string;
    clientRequestId: string;
    source: "onboarding" | "reflection";
    text: string;
    images: MemoryImagePayload[];
  },
  accessToken?: string,
) {
  return invokeBase44<PreparedMemory>(
    "sidequest-memory",
    { action: "prepare", ...args },
    accessToken,
  );
}

export function completeMemory(
  args: {
    authUserId?: string;
    phone?: string;
    memoryId: string;
    extraction: MemoryExtraction;
  },
  accessToken?: string,
) {
  return invokeBase44<CompletedMemory>(
    "sidequest-memory",
    { action: "complete", ...args },
    accessToken,
  );
}

export function failMemory(
  args: {
    authUserId?: string;
    phone?: string;
    memoryId: string;
    error: string;
  },
  accessToken?: string,
) {
  return invokeBase44<{ failed: true }>(
    "sidequest-memory",
    { action: "fail", ...args },
    accessToken,
  );
}

export function beginMessage(
  args: {
    authUserId?: string;
    phone?: string;
    text: string;
    messageId: string;
    threadId?: string;
    channel?: "imessage" | "web";
  },
  accessToken?: string,
) {
  return invokeBase44<PreparedMessage | CompletedMessage>(
    "sidequest-message",
    { action: "begin", ...args },
    accessToken,
  );
}

export function completeMessage(
  args: {
    authUserId?: string;
    phone?: string;
    messageId: string;
    threadId?: string;
    channel?: "imessage" | "web";
    reply: string;
    session: EveSessionCursor;
  },
  accessToken?: string,
) {
  return invokeBase44<CompletedMessage>(
    "sidequest-message",
    { action: "complete", ...args },
    accessToken,
  );
}

export function markMessageDelivered(args: {
  replyId: string;
  providerMessageId?: string;
}) {
  return invokeBase44<{ delivered: boolean }>("sidequest-message", {
    action: "markDelivered",
    ...args,
  });
}
