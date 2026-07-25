import "server-only";

import { BASE44_APP_ID } from "./base44Client";

export type MessageResult = {
  reply: string | null;
  replyId?: string;
  duplicate?: boolean;
};

async function invokeMessageFunction<T>(
  data: Record<string, unknown>,
  accessToken?: string,
) {
  const internalSecret = process.env.SIDEQUEST_INTERNAL_SECRET;
  if (!internalSecret) {
    throw new Error("SIDEQUEST_INTERNAL_SECRET is not configured");
  }

  const response = await fetch(
    `https://base44.app/api/apps/${BASE44_APP_ID}/functions/sidequest-message`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-App-Id": BASE44_APP_ID,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ ...data, internalSecret }),
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as { value?: T; error?: string };
  if (!response.ok || payload.value === undefined) {
    throw new Error(payload.error || "Base44 message function failed");
  }
  return payload.value;
}

export function processSidequestMessage(args: {
  phone?: string;
  authUserId?: string;
  text: string;
  messageId: string;
  threadId?: string;
  channel?: "imessage" | "web";
  accessToken?: string;
}) {
  const { accessToken, ...body } = args;
  return invokeMessageFunction<MessageResult>(body, accessToken);
}

export function markSidequestMessageDelivered(args: {
  replyId: string;
  providerMessageId?: string;
}) {
  return invokeMessageFunction<{ delivered: boolean }>({
    action: "markDelivered",
    ...args,
  });
}