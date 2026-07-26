import { Base44Error, getAccessToken, removeAccessToken } from "@base44/sdk";

import { getBase44BrowserClient } from "./base44BrowserClient";

export type AuthenticatedViewer = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  assignedPhone?: string;
  messagingConnected: boolean;
};

type MySessionResponse = {
  value: {
    viewer: AuthenticatedViewer;
  };
};

export function hasBase44Session() {
  return Boolean(getAccessToken());
}

export async function loadMyBase44Session() {
  const client = getBase44BrowserClient();
  const response = await client.functions.invoke("sidequest-data", {
    action: "getMySession",
  });

  return (response.data as MySessionResponse).value.viewer;
}

export function isBase44AuthError(error: unknown) {
  const status =
    error instanceof Base44Error
      ? error.status
      : error &&
          typeof error === "object" &&
          "response" in error &&
          error.response &&
          typeof error.response === "object" &&
          "status" in error.response
        ? Number(error.response.status)
        : undefined;

  return status === 401 || status === 403;
}

export function clearBase44Session() {
  removeAccessToken({});
  removeAccessToken({ storageKey: "token" });
}

export function signOutOfChapter() {
  clearBase44Session();
  window.location.replace("/");
}
