"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const INVITE_MESSAGE =
  "I added a memory with you in it to my world. Let's connect on Chapter.";
const INVITE_CACHE_PREFIX = "chapter:connection-invite:";

export type ConnectionInviteState = {
  nodeId: string;
  status: "creating" | "ready" | "shared" | "error";
  url?: string;
} | null;

function createInviteToken() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return window
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function cachedInvite(personReferenceId: string) {
  try {
    return window.localStorage.getItem(`${INVITE_CACHE_PREFIX}${personReferenceId}`);
  } catch {
    return null;
  }
}

function rememberInvite(personReferenceId: string, url: string) {
  try {
    window.localStorage.setItem(`${INVITE_CACHE_PREFIX}${personReferenceId}`, url);
  } catch {
    // The link remains shareable for this session when storage is unavailable.
  }
}

function forgetInvite(personReferenceId: string) {
  try {
    window.localStorage.removeItem(`${INVITE_CACHE_PREFIX}${personReferenceId}`);
  } catch {
    // Storage may be unavailable in privacy mode.
  }
}

export function useConnectionInvite(args?: {
  connectedNodeIds?: readonly string[];
  onInviteCreated?: () => void;
}) {
  const createInvite = useMutation(api.connections.createInvite);
  const sharingRef = useRef(false);
  const [inviteState, setInviteState] = useState<ConnectionInviteState>(null);

  useEffect(() => {
    for (const personReferenceId of args?.connectedNodeIds ?? []) {
      forgetInvite(personReferenceId);
    }
  }, [args?.connectedNodeIds]);

  const prepareInvite = useCallback(
    async (personReferenceId: string) => {
      const remembered = cachedInvite(personReferenceId);
      if (remembered) {
        setInviteState({ nodeId: personReferenceId, status: "ready", url: remembered });
        return;
      }

      setInviteState({ nodeId: personReferenceId, status: "creating" });
      try {
        const token = createInviteToken();
        await createInvite({
          personReferenceId: personReferenceId as Id<"personReferences">,
          token,
        });
        const url = `${window.location.origin}/invite/${token}`;
        rememberInvite(personReferenceId, url);
        setInviteState({ nodeId: personReferenceId, status: "ready", url });
        args?.onInviteCreated?.();
      } catch (error) {
        console.error("Could not create a Chapter connection invite", error);
        setInviteState({ nodeId: personReferenceId, status: "error" });
      }
    },
    [args, createInvite],
  );

  const shareInvite = useCallback((personReferenceId: string, url: string) => {
    const markShared = () => {
      setInviteState({ nodeId: personReferenceId, status: "shared", url });
    };
    const copyInvite = () => {
      if (navigator.clipboard) {
        void navigator.clipboard.writeText(url).then(markShared).catch(() => {
          window.prompt("Copy this private Chapter invite", url);
          markShared();
        });
        return;
      }
      window.prompt("Copy this private Chapter invite", url);
      markShared();
    };

    if (sharingRef.current) return;
    if (navigator.share) {
      sharingRef.current = true;
      void navigator.share({ title: "Join me on Chapter", text: INVITE_MESSAGE, url })
        .then(markShared)
        .catch((error: unknown) => {
          const errorName = error instanceof DOMException ? error.name : "";
          if (errorName !== "AbortError" && errorName !== "InvalidStateError") {
            copyInvite();
          }
        })
        .finally(() => {
          sharingRef.current = false;
        });
      return;
    }
    copyInvite();
  }, []);

  return { inviteState, prepareInvite, shareInvite };
}
