import "server-only";

import { Client, type SessionState } from "eve/client";

import {
  completeMemory,
  type CompletedMemory,
  type EveSessionCursor,
  failMemory,
  prepareMemory,
  type MemoryImagePayload,
} from "./sidequestAgentBackend";
import { extractMemory } from "./memoryExtractor";

const AGENT_USERNAME = "sidequest";

function urlForHost(host: string) {
  const value = host.trim();
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function agentHost(origin?: string) {
  return (
    urlForHost(origin || "") ||
    urlForHost(process.env.SIDEQUEST_AGENT_URL || "") ||
    urlForHost(process.env.VERCEL_URL || "") ||
    urlForHost(process.env.VERCEL_PROJECT_PRODUCTION_URL || "") ||
    "http://127.0.0.1:3000"
  );
}

function agentClient(
  identity: {
    authUserId?: string;
    phone?: string;
    channel: "web" | "imessage" | "memory";
  },
  origin?: string,
) {
  const internalSecret = process.env.SIDEQUEST_INTERNAL_SECRET;
  if (!internalSecret) {
    throw new Error("SIDEQUEST_INTERNAL_SECRET is not configured.");
  }

  return new Client({
    host: agentHost(origin),
    auth: {
      basic: {
        username: AGENT_USERNAME,
        password: internalSecret,
      },
    },
    headers: {
      "x-sidequest-auth-user-id": identity.authUserId || "",
      "x-sidequest-phone": identity.phone || "",
      "x-sidequest-channel": identity.channel,
    },
    preserveCompletedSessions: true,
    redirect: "manual",
  });
}

function sessionState(cursor?: EveSessionCursor): SessionState | undefined {
  if (!cursor?.sessionId || !cursor.continuationToken) return undefined;
  return {
    sessionId: cursor.sessionId,
    continuationToken: cursor.continuationToken,
    streamIndex: Number.isFinite(cursor.streamIndex) ? cursor.streamIndex : 0,
  };
}

export async function runSidequestTurn(args: {
  authUserId?: string;
  phone?: string;
  channel: "web" | "imessage";
  text: string;
  origin?: string;
  session?: EveSessionCursor;
  context: {
    name?: string;
    onboardingStep: string;
    notes?: string;
  };
}) {
  const client = agentClient(args, args.origin);
  const session = client.session(sessionState(args.session));
  const response = await session.send({
    message: args.text,
    clientContext: {
      surface: args.channel,
      name: args.context.name || "",
      onboardingStep: args.context.onboardingStep,
      rememberedContext: args.context.notes || "",
    },
  });
  const result = await response.result();
  if (result.status === "failed" || !result.message?.trim()) {
    throw new Error("Chapter could not produce a reply.");
  }
  return {
    reply: result.message.trim(),
    session: session.state,
  };
}

export async function extractAndPersistMemory(args: {
  authUserId: string;
  phone?: string;
  clientRequestId: string;
  source: "onboarding" | "reflection";
  text: string;
  images: MemoryImagePayload[];
  accessToken: string;
  origin?: string;
  signal?: AbortSignal;
}): Promise<CompletedMemory> {
  const prepared = await prepareMemory(args, args.accessToken);
  if (prepared.alreadyComplete) {
    return {
      memoryId: prepared.memoryId,
      title: prepared.title || "",
      summary: prepared.summary || "",
      created: false,
    };
  }
  if (!prepared.prompt) {
    throw new Error("Base44 did not return a memory extraction prompt.");
  }

  try {
    const extraction = await extractMemory({
      prompt: prepared.prompt,
      attachments: prepared.attachments || [],
      requestId: args.clientRequestId,
      signal: args.signal,
    });
    return await completeMemory(
      {
        authUserId: args.authUserId,
        phone: args.phone,
        memoryId: prepared.memoryId,
        extraction,
      },
      args.accessToken,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Memory extraction failed.";
    await failMemory(
      {
        authUserId: args.authUserId,
        phone: args.phone,
        memoryId: prepared.memoryId,
        error: message,
      },
      args.accessToken,
    ).catch(() => undefined);
    throw error;
  }
}
