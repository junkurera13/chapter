"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createConnectionInvite } from "./base44Connections";
import {
  cacheInviteUrl,
  forgetCachedInviteUrl,
  readCachedInviteUrl,
} from "./inviteLinkCache";
import { publicInviteUrl } from "./publicAppUrl";

/**
 * Deliberately impersonal. The link is handed over by whoever sends it, and a
 * message that greets someone by a name the sender may have written
 * differently would arrive as a stranger's.
 */
const INVITE_MESSAGE =
  "I added a memory with you in it to my world. Let's connect on Chapter.";

export type ConnectionInviteState = {
  nodeId: string;
  status: "creating" | "ready" | "shared" | "error";
  url?: string;
} | null;

/**
 * Turning a person in your world into a person on Chapter.
 *
 * Lives outside any one view because the ask now happens in two places: from a
 * person's orb in You, and from the people rail in Together. Both share the
 * same single-flight rules, the same device-side link memory, and the same
 * quiet fallbacks when the share sheet isn't there.
 */
export function useConnectionInvite(args?: {
  /** Nodes that already belong to a real connection: their link is spent. */
  connectedNodeIds?: readonly string[];
  onInviteCreated?: () => void;
}) {
  const connectedNodeIds = args?.connectedNodeIds;
  const onInviteCreated = args?.onInviteCreated;
  /**
   * The system share sheet is single-flight: asking for a second one while the
   * first is still open rejects the call outright. On desktop the first can sit
   * unsettled for a long time, so a second click is easy to make by accident.
   */
  const sharingRef = useRef(false);
  const [inviteState, setInviteState] = useState<ConnectionInviteState>(null);

  // Once someone accepts, their link is spent. Drop it so a stale one is never
  // handed out again from this device.
  useEffect(() => {
    for (const nodeId of connectedNodeIds ?? []) {
      forgetCachedInviteUrl(nodeId);
    }
  }, [connectedNodeIds]);

  /**
   * Asks the backend for this person's link, showing the one already on this
   * device first. The link is stable, so the remembered one is almost always
   * the answer — and a backend call can take many seconds.
   */
  const prepareInvite = useCallback(
    async (nodeId: string) => {
      const remembered = readCachedInviteUrl(nodeId);
      setInviteState(
        remembered
          ? { nodeId, status: "ready", url: remembered }
          : { nodeId, status: "creating" },
      );

      try {
        const invite = await createConnectionInvite(nodeId);
        const url = publicInviteUrl(invite.token);
        cacheInviteUrl(nodeId, url);
        // Someone who already shared while this was in flight keeps that state.
        setInviteState((current) =>
          current?.nodeId === nodeId && current.status === "shared"
            ? { ...current, url }
            : { nodeId, status: "ready", url },
        );
        onInviteCreated?.();
      } catch (error) {
        console.error("Could not create a Chapter connection invite", error);
        // A remembered link is still worth offering when the backend is unwell.
        if (!remembered) setInviteState({ nodeId, status: "error" });
      }
    },
    [onInviteCreated],
  );

  const shareInvite = useCallback((nodeId: string, url: string) => {
    const markShared = () => {
      setInviteState({ nodeId, status: "shared", url });
    };

    /** Every path that isn't the share sheet: the link still has to reach them. */
    const copyInvite = () => {
      if (navigator.clipboard) {
        void navigator.clipboard
          .writeText(url)
          .then(markShared)
          .catch((error) => {
            console.error("Could not copy the invite", error);
            setInviteState({ nodeId, status: "error", url });
          });
        return;
      }

      window.prompt("Copy this private Chapter invite", url);
      markShared();
    };

    // A sheet is already open. The click that got here is a double-tap on a
    // modal dialog, and the right answer is to do nothing.
    if (sharingRef.current) return;

    if (navigator.share) {
      sharingRef.current = true;
      void navigator
        .share({
          title: "Join me on Chapter",
          text: INVITE_MESSAGE,
          url,
        })
        .then(markShared)
        .catch((error: unknown) => {
          // Dismissing the sheet is an answer, not a failure. So is a race we
          // already lost — a share is open somewhere and will settle on its own.
          const errorName = error instanceof DOMException ? error.name : "";
          if (errorName === "AbortError" || errorName === "InvalidStateError") {
            return;
          }
          console.error("Could not open the share sheet", error);
          copyInvite();
        })
        .finally(() => {
          sharingRef.current = false;
        });
      return;
    }

    copyInvite();
  }, []);

  // Two taps rather than one, on purpose: the share sheet may only open from a
  // gesture, and the first tap's gesture is spent by the time the link lands.
  return { inviteState, prepareInvite, shareInvite };
}
