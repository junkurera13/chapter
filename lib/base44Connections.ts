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

async function invokeConnectionAction<T>(data: Record<string, unknown>) {
  const response = await getBase44BrowserClient().functions.invoke(
    "sidequest-data",
    data,
  );
  return (response.data as ValueResponse<T>).value;
}

export function loadConnectionInvite(token: string) {
  return invokeSidequestData<ConnectionInvitePreview>({
    action: "getConnectionInvite",
    token,
  });
}

export function createConnectionInvite(nodeId: string) {
  return invokeConnectionAction<CreatedConnectionInvite>({
    action: "createConnectionInvite",
    nodeId,
  });
}

export function acceptConnectionInvite(token: string) {
  return invokeConnectionAction<AcceptedConnectionInvite>({
    action: "acceptConnectionInvite",
    token,
  });
}

export function loadMyConnections() {
  return invokeConnectionAction<MyConnectionsRecord>({
    action: "getMyConnections",
  });
}
