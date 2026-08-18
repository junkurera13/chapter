import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  chapterExperienceValidator,
  experienceKindValidator,
  feedbackVerdictValidator,
} from "./chapterValidators";

const graphNodeCategoryValidator = v.union(
  v.literal("experience"),
  v.literal("people"),
  v.literal("place"),
  v.literal("activity"),
  v.literal("condition"),
  // Retired categories still present on older documents. Reads remap
  // interest → activity and drop feeling/pattern.
  v.literal("interest"),
  v.literal("feeling"),
  v.literal("pattern"),
);

const graphRelationValidator = v.union(
  v.literal("lived"),
  v.literal("cares_about"),
  v.literal("shared_with"),
  v.literal("happened_at"),
  v.literal("involved"),
  v.literal("evoked"),
  v.literal("shaped_by"),
  v.literal("supported"),
  v.literal("reflects"),
  v.literal("part_of"),
  v.literal("drawn_to"),
  v.literal("familiar_with"),
  v.literal("curious_about"),
  v.literal("avoids"),
  v.literal("requires"),
  v.literal("reinforces"),
  v.literal("contrasts_with"),
  v.literal("discovered_through"),
);

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
    homeCity: v.optional(v.string()),
    homeArea: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_token_identifier", ["tokenIdentifier"]),

  accountMemories: defineTable({
    ownerAccountId: v.id("accounts"),
    clientRequestId: v.string(),
    source: v.union(v.literal("onboarding"), v.literal("reflection")),
    rawText: v.string(),
    title: v.string(),
    summary: v.string(),
    createdAt: v.number(),
  })
    .index("by_owner_account_id_and_created_at", [
      "ownerAccountId",
      "createdAt",
    ])
    .index("by_owner_account_id_and_client_request_id", [
      "ownerAccountId",
      "clientRequestId",
    ]),

  accountMemorySources: defineTable({
    ownerAccountId: v.id("accounts"),
    memoryId: v.id("accountMemories"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mediaType: v.string(),
    byteSize: v.number(),
    context: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_memory_id", ["memoryId"]),

  accountPendingUploads: defineTable({
    ownerAccountId: v.id("accounts"),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  })
    .index("by_owner_account_id", ["ownerAccountId"])
    .index("by_storage_id", ["storageId"]),

  accountGraphNodes: defineTable({
    ownerAccountId: v.id("accounts"),
    memoryId: v.id("accountMemories"),
    personReferenceId: v.optional(v.id("personReferences")),
    localKey: v.string(),
    category: graphNodeCategoryValidator,
    subtype: v.string(),
    label: v.string(),
    description: v.string(),
    certainty: v.union(v.literal("fact"), v.literal("hypothesis")),
    confidence: v.number(),
    salience: v.number(),
    evidence: v.string(),
    createdAt: v.number(),
  })
    .index("by_owner_account_id_and_created_at", [
      "ownerAccountId",
      "createdAt",
    ])
    .index("by_memory_id", ["memoryId"]),

  accountGraphEdges: defineTable({
    ownerAccountId: v.id("accounts"),
    memoryId: v.id("accountMemories"),
    fromNodeId: v.id("accountGraphNodes"),
    toNodeId: v.id("accountGraphNodes"),
    relation: graphRelationValidator,
    polarity: v.union(
      v.literal("positive"),
      v.literal("negative"),
      v.literal("mixed"),
      v.literal("neutral"),
    ),
    familiarity: v.union(
      v.literal("familiar"),
      v.literal("new"),
      v.literal("mixed"),
      v.literal("not_applicable"),
    ),
    strength: v.number(),
    certainty: v.union(v.literal("fact"), v.literal("hypothesis")),
    createdAt: v.number(),
  })
    .index("by_owner_account_id_and_created_at", [
      "ownerAccountId",
      "createdAt",
    ])
    .index("by_memory_id", ["memoryId"]),

  accountExperiences: defineTable({
    ownerAccountId: v.id("accounts"),
    kind: experienceKindValidator,
    requestText: v.string(),
    experience: chapterExperienceValidator,
    status: v.union(
      v.literal("sent"),
      v.literal("saved"),
      v.literal("passed"),
      v.literal("done"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner_account_id_and_created_at", [
    "ownerAccountId",
    "createdAt",
  ]),

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
