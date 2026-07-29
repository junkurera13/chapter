export type RealtimeInboxEventKind = "human_message";

type RealtimeInboxEventEntity = {
  create(data: {
    recipient_auth_user_id: string;
    kind: RealtimeInboxEventKind;
    created_at: number;
  }): Promise<unknown>;
};

/**
 * The realtime channel carries no message content. It only tells one
 * authenticated recipient to re-read their already-authorized inbox.
 *
 * Realtime is an enhancement, so a transport or rolling-deploy failure must
 * never make the durable HumanMessage write fail.
 */
export async function publishRealtimeInboxEvent(
  entity: RealtimeInboxEventEntity,
  args: {
    recipientAuthUserId: string;
    kind: RealtimeInboxEventKind;
    createdAt: number;
  },
) {
  const recipientAuthUserId = args.recipientAuthUserId.trim();
  if (!recipientAuthUserId) return false;

  try {
    await entity.create({
      recipient_auth_user_id: recipientAuthUserId,
      kind: args.kind,
      created_at: args.createdAt,
    });
    return true;
  } catch (error) {
    console.warn("[realtime-inbox] refresh signal unavailable", error);
    return false;
  }
}
