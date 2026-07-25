import type {
  AcceptedConnectionInvite,
  ConnectionInvitePreview,
  CreatedConnectionInvite,
  MyConnectionsRecord,
} from "./backendTypes";
import { getBase44BrowserClient } from "./base44BrowserClient";
import { invokeSidequestData } from "./base44Functions";

type ValueResponse<T> = {
  value: T;
};

const CONNECTION_CACHE_TTL_MS = 15_000;

let connectionCache:
  | { value: MyConnectionsRecord; savedAt: number }
  | undefined;
let connectionRequest: Promise<MyConnectionsRecord> | undefined;

async function invokeConnectionAction<T>(data: Record<string, unknown>) {
  const response = await getBase44BrowserClient().functions.invoke(
    "sidequest-data",
    data,
  );
  return (response.data as ValueResponse<T>).value;
}

function invalidateConnectionCache() {
  connectionCache = undefined;
  connectionRequest = undefined;
}

export function loadConnectionInvite(token: string) {
  return invokeSidequestData<ConnectionInvitePreview>({
    action: "getConnectionInvite",
    token,
  });
}

export async function createConnectionInvite(nodeId: string) {
  const invite = await invokeConnectionAction<CreatedConnectionInvite>({
    action: "createConnectionInvite",
    nodeId,
  });
  invalidateConnectionCache();
  return invite;
}

export async function acceptConnectionInvite(token: string) {
  const invite = await invokeConnectionAction<AcceptedConnectionInvite>({
    action: "acceptConnectionInvite",
    token,
  });
  invalidateConnectionCache();
  return invite;
}

export function loadMyConnections() {
  if (
    connectionCache &&
    Date.now() - connectionCache.savedAt < CONNECTION_CACHE_TTL_MS
  ) {
    return Promise.resolve(connectionCache.value);
  }
  if (connectionRequest) return connectionRequest;

  connectionRequest = invokeConnectionAction<MyConnectionsRecord>({
    action: "getMyConnections",
  })
    .then((value) => {
      connectionCache = { value, savedAt: Date.now() };
      return value;
    })
    .finally(() => {
      connectionRequest = undefined;
    });

  return connectionRequest;
}
