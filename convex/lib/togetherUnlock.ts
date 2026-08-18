import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  isTogetherUnlocked,
  TOGETHER_LOCKED_MESSAGE,
  TOGETHER_UNLOCK_COUNT,
} from "../../lib/togetherUnlock";

export { TOGETHER_LOCKED_MESSAGE, TOGETHER_UNLOCK_COUNT };

export async function loadTogetherUnlock(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  ownerAccountId: Id<"accounts">,
) {
  const [memories, experiences] = await Promise.all([
    ctx.db
      .query("accountMemories")
      .withIndex("by_owner_account_id_and_created_at", (queryBuilder) =>
        queryBuilder.eq("ownerAccountId", ownerAccountId),
      )
      .take(TOGETHER_UNLOCK_COUNT),
    ctx.db
      .query("accountExperiences")
      .withIndex("by_owner_account_id_and_created_at", (queryBuilder) =>
        queryBuilder.eq("ownerAccountId", ownerAccountId),
      )
      .take(100),
  ]);

  const memoryCount = memories.length;
  const completedExperienceCount = experiences.filter(
    (experience) => experience.status === "done",
  ).length;

  return {
    memoryCount,
    completedExperienceCount,
    unlocked: isTogetherUnlocked(memoryCount, completedExperienceCount),
  };
}

export async function requireTogetherUnlocked(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  ownerAccountId: Id<"accounts">,
) {
  const state = await loadTogetherUnlock(ctx, ownerAccountId);
  if (!state.unlocked) {
    throw new Error(TOGETHER_LOCKED_MESSAGE);
  }
}
