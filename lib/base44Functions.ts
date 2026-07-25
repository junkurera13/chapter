import { BASE44_APP_ID } from "./base44Client";

export class Base44FunctionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "Base44FunctionError";
  }
}

async function invoke<T>(
  functionName: string,
  data: Record<string, unknown>,
  accessToken?: string,
) {
  const response = await fetch(
    `https://base44.app/api/apps/${BASE44_APP_ID}/functions/${functionName}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-App-Id": BASE44_APP_ID,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(data),
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as T | { error?: string };
  if (!response.ok) {
    throw new Base44FunctionError(
      "error" in (payload as { error?: string })
        ? (payload as { error?: string }).error || "Base44 request failed"
        : "Base44 request failed",
      response.status,
    );
  }

  return payload as T;
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
