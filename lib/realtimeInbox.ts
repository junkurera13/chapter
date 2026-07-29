import type { RealtimeEvent } from "@base44/sdk";

import { getBase44BrowserClient } from "./base44BrowserClient";

type RealtimeInboxEventRecord = {
  recipient_auth_user_id: string;
  kind: "human_message";
  created_at: number;
};

/**
 * Listen only for content-free inbox signals. Message text remains behind the
 * authenticated Together endpoint and is fetched there after a signal lands.
 */
export function subscribeToRealtimeInbox(onHumanMessage: () => void) {
  return getBase44BrowserClient().entities.RealtimeInboxEvent.subscribe(
    (event: RealtimeEvent<RealtimeInboxEventRecord>) => {
      if (event.type !== "create" || event.data?.kind !== "human_message") {
        return;
      }
      onHumanMessage();
    },
  );
}
