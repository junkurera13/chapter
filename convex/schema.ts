import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  chapterExperienceValidator,
  experienceKindValidator,
  feedbackVerdictValidator,
} from "./chapterValidators";

// These tables are intentionally channel infrastructure, not the new human
// profile or experience graph. They let the iMessage edge accept each Photon
// delivery once and preserve a stable external conversation identity while the
// account-owned memory model is designed separately.
export default defineSchema({
  waitlistEntries: defineTable({
    email: v.string(),
    normalizedEmail: v.string(),
    status: v.union(v.literal("waiting"), v.literal("invited")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_normalized_email", ["normalizedEmail"]),

  accounts: defineTable({
    tokenIdentifier: v.string(),
    displayName: v.string(),
    normalizedName: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_token_identifier", ["tokenIdentifier"]),

  personReferences: defineTable({
    ownerAccountId: v.id("accounts"),
    displayName: v.string(),
    normalizedName: v.string(),
    relationship: v.optional(v.string()),
    source: v.union(v.literal("memory"), v.literal("manual")),
    identityAccountId: v.optional(v.id("accounts")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_account_id", ["ownerAccountId"])
    .index("by_owner_account_id_and_identity_account_id", [
      "ownerAccountId",
      "identityAccountId",
    ]),

  connectionInvites: defineTable({
    inviterAccountId: v.id("accounts"),
    personReferenceId: v.id("personReferences"),
    tokenHash: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("revoked"),
      v.literal("expired"),
    ),
    createdAt: v.number(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    acceptedByAccountId: v.optional(v.id("accounts")),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_person_reference_id_and_status", [
      "personReferenceId",
      "status",
    ])
    .index("by_inviter_account_id_and_status", [
      "inviterAccountId",
      "status",
    ]),

  // A row only exists after both people have accepted the relationship. A
  // person mentioned in a memory never appears here automatically.
  connections: defineTable({
    accountAId: v.id("accounts"),
    accountBId: v.id("accounts"),
    pairKey: v.string(),
    createdFromInviteId: v.id("connectionInvites"),
    acceptedAt: v.number(),
  })
    .index("by_pair_key", ["pairKey"])
    .index("by_account_a_id", ["accountAId"])
    .index("by_account_b_id", ["accountBId"]),

  // This is deliberately a memory-shaped foundation, not an itinerary or
  // generated invitation. Shared experiences can only belong to a connection
  // whose membership has already been accepted.
  sharedExperiences: defineTable({
    connectionId: v.id("connections"),
    createdByAccountId: v.id("accounts"),
    title: v.string(),
    occurredAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_connection_id_and_created_at", [
    "connectionId",
    "createdAt",
  ]),

  // Chapter's iMessage identity is intentionally separate from web accounts
  // in V1. Linking the two later will be an explicit, consented operation.
  chapterProfiles: defineTable({
    externalPrincipalId: v.string(),
    onboardingStage: v.union(
      v.literal("needs_memory"),
      v.literal("needs_location"),
      v.literal("complete"),
    ),
    homeCity: v.optional(v.string()),
    homeArea: v.optional(v.string()),
    homeCountry: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_external_principal_id", ["externalPrincipalId"]),

  chapterMemories: defineTable({
    profileId: v.id("chapterProfiles"),
    externalPrincipalId: v.string(),
    rawText: v.string(),
    source: v.literal("imessage"),
    idempotencyKey: v.string(),
    createdAt: v.number(),
  })
    .index("by_external_principal_id_and_created_at", [
      "externalPrincipalId",
      "createdAt",
    ])
    .index("by_idempotency_key", ["idempotencyKey"]),

  chapterExperiences: defineTable({
    profileId: v.id("chapterProfiles"),
    externalPrincipalId: v.string(),
    kind: experienceKindValidator,
    requestText: v.string(),
    experience: chapterExperienceValidator,
    status: v.union(
      v.literal("sent"),
      v.literal("saved"),
      v.literal("passed"),
      v.literal("done"),
    ),
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_external_principal_id_and_created_at", [
      "externalPrincipalId",
      "createdAt",
    ])
    .index("by_idempotency_key", ["idempotencyKey"]),

  chapterFeedback: defineTable({
    profileId: v.id("chapterProfiles"),
    externalPrincipalId: v.string(),
    experienceId: v.optional(v.id("chapterExperiences")),
    verdict: feedbackVerdictValidator,
    text: v.optional(v.string()),
    idempotencyKey: v.string(),
    createdAt: v.number(),
  })
    .index("by_external_principal_id_and_created_at", [
      "externalPrincipalId",
      "createdAt",
    ])
    .index("by_idempotency_key", ["idempotencyKey"]),

  messagingThreads: defineTable({
    provider: v.literal("spectrum"),
    platform: v.literal("imessage"),
    externalSpaceId: v.string(),
    externalParticipantId: v.string(),
    lineId: v.string(),
    createdAt: v.number(),
    lastInboundAt: v.number(),
  }).index("by_provider_and_external_space_id", [
    "provider",
    "externalSpaceId",
  ]),

  messagingDeliveries: defineTable({
    provider: v.literal("spectrum"),
    webhookId: v.string(),
    externalMessageId: v.string(),
    threadId: v.id("messagingThreads"),
    status: v.union(
      v.literal("claimed"),
      v.literal("enqueued"),
      v.literal("retryable"),
    ),
    claimToken: v.string(),
    leaseExpiresAt: v.number(),
    attempts: v.number(),
    receivedAt: v.number(),
    expiresAt: v.number(),
    enqueuedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("by_webhook_id_and_external_message_id", [
      "webhookId",
      "externalMessageId",
    ])
    .index("by_expires_at", ["expiresAt"]),
});
