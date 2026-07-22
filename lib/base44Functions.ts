import { BASE44_APP_ID } from "./base44Client";
import type {
  QuestRecord,
  QuestSource,
  UserProfile,
} from "./backendTypes";

type GenerateQuestArgs = {
  request: string;
  country?: string;
  memorySummary?: string;
  localContext?: string;
  phone?: string;
  initialRequest?: string;
  followupAnswer?: string;
  source?: QuestSource;
};

async function invoke<T>(functionName: string, data: Record<string, unknown>) {
  const response = await fetch(
    `https://base44.app/api/apps/${BASE44_APP_ID}/functions/${functionName}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-App-Id": BASE44_APP_ID,
      },
      body: JSON.stringify(data),
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as T | { error?: string };
  if (!response.ok) {
    throw new Error(
      "error" in (payload as { error?: string })
        ? (payload as { error?: string }).error || "Base44 request failed"
        : "Base44 request failed",
    );
  }

  return payload as T;
}

async function invokeData<T>(data: Record<string, unknown>): Promise<T> {
  const response = await invoke<{ value: T }>("sidequest-data", data);
  return response.value;
}

export async function generateQuest(args: GenerateQuestArgs) {
  return invoke<{ id: string; url: string; title: string }>(
    "generate-quest",
    args,
  );
}

export function getQuestByShortId(args: { shortId: string }) {
  return invokeData<QuestRecord | null>({
    action: "getQuestByShortId",
    ...args,
  });
}

export function listRecentQuests(args: { limit?: number }) {
  return invokeData<QuestRecord[]>({ action: "listRecentQuests", ...args });
}

export function listQuestsByPhone(args: { phone: string; limit?: number }) {
  return invokeData<QuestRecord[]>({ action: "listQuestsByPhone", ...args });
}

export function getUserByPhone(args: { phone: string }) {
  return invokeData<UserProfile | null>({ action: "getUserByPhone", ...args });
}

export function upsertUserByPhone(args: {
  phone: string;
  country?: string;
  currentCity?: string;
  latitude?: number;
  longitude?: number;
  assignedPhone?: string;
  signedUpAt?: number;
}) {
  return invokeData<unknown>({ action: "upsertUserByPhone", ...args });
}
