export const TOGETHER_UNLOCK_COUNT = 5;

export const TOGETHER_LOCKED_MESSAGE =
  "Together opens after five memories, or five Andys and Marcos.";

export function isTogetherUnlocked(
  memoryCount: number,
  completedExperienceCount: number,
) {
  return (
    memoryCount >= TOGETHER_UNLOCK_COUNT ||
    completedExperienceCount >= TOGETHER_UNLOCK_COUNT
  );
}
