import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import {
  cleanDisplayName,
  normalizeName,
  requireCurrentAccount,
} from "./lib/auth";
import {
  loadTogetherUnlock,
  requireTogetherUnlocked,
} from "./lib/togetherUnlock";

const INVITE_LIFETIME_MS = 14 * 24 * 60 * 60 * 1_000;
const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,96}$/;

function isValidToken(token: string) {
  return INVITE_TOKEN_PATTERN.test(token);
}

function validateToken(token: string) {
  if (!isValidToken(token)) {
    throw new Error("Invalid invitation");
  }
}

async function hashToken(token: string) {
  validateToken(token);
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function canonicalPair(first: Id<"accounts">, second: Id<"accounts">) {
  return String(first) < String(second)
    ? { accountAId: first, accountBId: second }
    : { accountAId: second, accountBId: first };
}

function pairKey(first: Id<"accounts">, second: Id<"accounts">) {
  const pair = canonicalPair(first, second);
  return `${pair.accountAId}:${pair.accountBId}`;
}

export const togetherReady = query({
  args: {},
  handler: async (ctx) => {
    const account = await requireCurrentAccount(ctx);
    return await loadTogetherUnlock(ctx, account._id);
  },
});

export const createInvite = mutation({
  args: {
    personReferenceId: v.id("personReferences"),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await requireCurrentAccount(ctx);
    await requireTogetherUnlocked(ctx, account._id);
    const person = await ctx.db.get(args.personReferenceId);
    if (person === null || person.ownerAccountId !== account._id) {
      throw new Error("Person not found");
    }
    if (person.identityAccountId !== undefined) {
      throw new Error("You are already connected to this person");
    }

    const existingPending = await ctx.db
      .query("connectionInvites")
      .withIndex("by_person_reference_id_and_status", (queryBuilder) =>
        queryBuilder
          .eq("personReferenceId", person._id)
          .eq("status", "pending"),
      )
      .first();
    if (existingPending !== null) {
      if (existingPending.expiresAt > Date.now()) {
        throw new Error("An invitation is already waiting for this person");
      }
      await ctx.db.patch(existingPending._id, { status: "expired" });
    }

    const tokenHash = await hashToken(args.token);
    const duplicate = await ctx.db
      .query("connectionInvites")
      .withIndex("by_token_hash", (queryBuilder) =>
        queryBuilder.eq("tokenHash", tokenHash),
      )
      .unique();
    if (duplicate !== null) {
      throw new Error("Invitation token already exists");
    }

    const now = Date.now();
    const expiresAt = now + INVITE_LIFETIME_MS;
    const inviteId = await ctx.db.insert("connectionInvites", {
      inviterAccountId: account._id,
      personReferenceId: person._id,
      tokenHash,
      status: "pending",
      createdAt: now,
      expiresAt,
    });

    return { inviteId, expiresAt };
  },
});

export const previewInvite = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!isValidToken(args.token)) return null;
    const tokenHash = await hashToken(args.token);
    const invite = await ctx.db
      .query("connectionInvites")
      .withIndex("by_token_hash", (queryBuilder) =>
        queryBuilder.eq("tokenHash", tokenHash),
      )
      .unique();
    if (invite === null) return null;

    const inviter = await ctx.db.get(invite.inviterAccountId);
    if (inviter === null) return null;

    const status =
      invite.status === "pending" && invite.expiresAt <= Date.now()
        ? "expired"
        : invite.status;

    return {
      inviterName: inviter.displayName,
      inviterImageUrl: inviter.imageUrl,
      status,
      expiresAt: invite.expiresAt,
    };
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const acceptingAccount = await requireCurrentAccount(ctx);
    const tokenHash = await hashToken(args.token);
    const invite = await ctx.db
      .query("connectionInvites")
      .withIndex("by_token_hash", (queryBuilder) =>
        queryBuilder.eq("tokenHash", tokenHash),
      )
      .unique();
    if (invite === null) throw new Error("Invitation not found");

    if (
      invite.status === "accepted" &&
      invite.acceptedByAccountId === acceptingAccount._id
    ) {
      const existing = await ctx.db
        .query("connections")
        .withIndex("by_pair_key", (queryBuilder) =>
          queryBuilder.eq(
            "pairKey",
            pairKey(invite.inviterAccountId, acceptingAccount._id),
          ),
        )
        .unique();
      if (existing !== null) return existing._id;
    }

    if (invite.status !== "pending") {
      throw new Error("This invitation is no longer available");
    }
    if (invite.expiresAt <= Date.now()) {
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new Error("This invitation has expired");
    }
    if (invite.inviterAccountId === acceptingAccount._id) {
      throw new Error("You cannot accept your own invitation");
    }

    const inviterReference = await ctx.db.get(invite.personReferenceId);
    if (
      inviterReference === null ||
      inviterReference.ownerAccountId !== invite.inviterAccountId
    ) {
      throw new Error("The person attached to this invitation no longer exists");
    }
    if (
      inviterReference.identityAccountId !== undefined &&
      inviterReference.identityAccountId !== acceptingAccount._id
    ) {
      await ctx.db.patch(invite._id, { status: "revoked" });
      throw new Error("This person is already connected");
    }

    const key = pairKey(invite.inviterAccountId, acceptingAccount._id);
    let connection = await ctx.db
      .query("connections")
      .withIndex("by_pair_key", (queryBuilder) =>
        queryBuilder.eq("pairKey", key),
      )
      .unique();
    const now = Date.now();

    if (connection === null) {
      const pair = canonicalPair(
        invite.inviterAccountId,
        acceptingAccount._id,
      );
      const connectionId = await ctx.db.insert("connections", {
        ...pair,
        pairKey: key,
        createdFromInviteId: invite._id,
        acceptedAt: now,
      });
      connection = await ctx.db.get(connectionId);
    }
    if (connection === null) {
      throw new Error("Could not create connection");
    }

    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: now,
      acceptedByAccountId: acceptingAccount._id,
    });

    await ctx.db.patch(inviterReference._id, {
      identityAccountId: acceptingAccount._id,
      displayName: acceptingAccount.displayName,
      normalizedName: acceptingAccount.normalizedName,
      updatedAt: now,
    });

    const inviter = await ctx.db.get(invite.inviterAccountId);
    const reverseReference = await ctx.db
      .query("personReferences")
      .withIndex(
        "by_owner_account_id_and_identity_account_id",
        (queryBuilder) =>
          queryBuilder
            .eq("ownerAccountId", acceptingAccount._id)
            .eq("identityAccountId", invite.inviterAccountId),
      )
      .unique();
    if (inviter !== null && reverseReference === null) {
      const displayName = cleanDisplayName(inviter.displayName);
      await ctx.db.insert("personReferences", {
        ownerAccountId: acceptingAccount._id,
        displayName,
        normalizedName: normalizeName(displayName),
        source: "manual",
        identityAccountId: inviter._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    return connection._id;
  },
});

export const declineInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const account = await requireCurrentAccount(ctx);
    const tokenHash = await hashToken(args.token);
    const invite = await ctx.db
      .query("connectionInvites")
      .withIndex("by_token_hash", (queryBuilder) =>
        queryBuilder.eq("tokenHash", tokenHash),
      )
      .unique();
    if (invite === null || invite.status !== "pending") {
      throw new Error("This invitation is no longer available");
    }
    if (invite.inviterAccountId === account._id) {
      throw new Error("You cannot decline your own invitation");
    }

    await ctx.db.patch(invite._id, { status: "declined" });
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("connectionInvites") },
  handler: async (ctx, args) => {
    const account = await requireCurrentAccount(ctx);
    const invite = await ctx.db.get(args.inviteId);
    if (invite === null || invite.inviterAccountId !== account._id) {
      throw new Error("Invitation not found");
    }
    if (invite.status !== "pending") return;

    await ctx.db.patch(invite._id, {
      status: "revoked",
      revokedAt: Date.now(),
    });
  },
});

export const listPendingInvites = query({
  args: {},
  handler: async (ctx) => {
    const account = await requireCurrentAccount(ctx);
    const invites = await ctx.db
      .query("connectionInvites")
      .withIndex("by_inviter_account_id_and_status", (queryBuilder) =>
        queryBuilder
          .eq("inviterAccountId", account._id)
          .eq("status", "pending"),
      )
      .order("desc")
      .take(100);
    const now = Date.now();

    const rows = await Promise.all(
      invites.filter((invite) => invite.expiresAt > now).map(async (invite) => {
        const person = await ctx.db.get(invite.personReferenceId);
        return person === null
          ? null
          : {
              _id: invite._id,
              personName: person.displayName,
              expiresAt: invite.expiresAt,
            };
      }),
    );
    return rows.filter((row) => row !== null);
  },
});

async function hydrateConnections(
  ctx: QueryCtx,
  accountId: Id<"accounts">,
  connections: Array<Doc<"connections">>,
) {
  const rows = await Promise.all(
    connections.map(async (connection) => {
      const otherAccountId =
        connection.accountAId === accountId
          ? connection.accountBId
          : connection.accountAId;
      const other = await ctx.db.get(otherAccountId);
      if (other === null) return null;
      return {
        _id: connection._id,
        person: {
          _id: other._id,
          displayName: other.displayName,
          imageUrl: other.imageUrl,
        },
        acceptedAt: connection.acceptedAt,
      };
    }),
  );
  return rows.filter((row) => row !== null);
}

export const listAccepted = query({
  args: {},
  handler: async (ctx) => {
    const account = await requireCurrentAccount(ctx);
    const [asFirst, asSecond] = await Promise.all([
      ctx.db
        .query("connections")
        .withIndex("by_account_a_id", (queryBuilder) =>
          queryBuilder.eq("accountAId", account._id),
        )
        .take(100),
      ctx.db
        .query("connections")
        .withIndex("by_account_b_id", (queryBuilder) =>
          queryBuilder.eq("accountBId", account._id),
        )
        .take(100),
    ]);
    const connections = [...asFirst, ...asSecond].sort(
      (first, second) => second.acceptedAt - first.acceptedAt,
    );
    return await hydrateConnections(ctx, account._id, connections);
  },
});
