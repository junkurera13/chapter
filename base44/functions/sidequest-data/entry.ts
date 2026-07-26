import { createClientFromRequest } from "npm:@base44/sdk";

import { collapseMemoryGraphRows } from "../../shared/memory-map.ts";

// Base44 entity rows are dynamic at this SDK boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const RATE_LIMIT_RETRY_DELAYS_MS = [500, 1_000, 2_000] as const;

function isRateLimitError(error: unknown) {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message)
        : "";

  return status === 429 || /rate limit|too many requests/i.test(message);
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function readWithRateLimitRetry<T>(operation: () => Promise<T>) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const delay = RATE_LIMIT_RETRY_DELAYS_MS[attempt];
      if (!isRateLimitError(error) || delay === undefined) throw error;
      await wait(delay);
    }
  }
}

const NODE_CATEGORIES = [
  "experience",
  "people",
  "place",
  "activity",
  "interest",
  "feeling",
  "condition",
  "pattern",
] as const;
const RELATIONS = [
  "lived",
  "cares_about",
  "shared_with",
  "happened_at",
  "involved",
  "evoked",
  "shaped_by",
  "supported",
  "reflects",
  "part_of",
  "drawn_to",
  "familiar_with",
  "curious_about",
  "avoids",
  "requires",
  "reinforces",
  "contrasts_with",
  "discovered_through",
] as const;
const POLARITIES = ["positive", "negative", "mixed", "neutral"] as const;
const FAMILIARITIES = ["familiar", "new", "mixed", "not_applicable"] as const;

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function boundedUnit(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1)
    : fallback;
}

function oneOf<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
) {
  return typeof value === "string" && values.includes(value as T)
    ? (value as T)
    : fallback;
}

function categoryForNode(row: Row) {
  if (NODE_CATEGORIES.includes(row.category)) return row.category;

  const categoryByKind: Record<string, (typeof NODE_CATEGORIES)[number]> = {
    person: "people",
    place: "place",
    activity: "activity",
    setting: "condition",
    emotion: "feeling",
    motif: "pattern",
    constraint: "condition",
    context: "condition",
    memory: "experience",
  };
  return categoryByKind[stringValue(row.kind)] ?? "pattern";
}

function graphNodeRecord(row: Row, inviteStatus?: "pending") {
  return {
    id: row.id,
    memoryId: row.memory_id,
    ownerUserId: row.owner_user_id,
    sourceType: oneOf(
      row.source_type,
      ["memory", "connection"] as const,
      "memory",
    ),
    occurrenceCount:
      typeof row.occurrence_count === "number"
        ? row.occurrence_count
        : undefined,
    linkedUserId: row.linked_user_id,
    connectionId: row.connection_id,
    inviteStatus,
    category: categoryForNode(row),
    subtype: stringValue(row.subtype) || stringValue(row.kind) || "memory",
    kind: stringValue(row.kind),
    label: stringValue(row.label),
    description: stringValue(row.description),
    certainty: oneOf(row.certainty, ["fact", "hypothesis"] as const, "fact"),
    confidence: boundedUnit(row.confidence, 0.7),
    salience: boundedUnit(row.salience, 0.6),
    evidence: stringValue(row.evidence),
    createdAt: row.created_at,
  };
}

function graphEdgeRecord(row: Row) {
  return {
    id: row.id,
    memoryId: row.memory_id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    relation: oneOf(row.relation ?? row.relationship, RELATIONS, "reflects"),
    polarity: oneOf(row.polarity, POLARITIES, "neutral"),
    familiarity: oneOf(row.familiarity, FAMILIARITIES, "not_applicable"),
    strength: boundedUnit(row.strength ?? row.confidence, 0.6),
    certainty: oneOf(row.certainty, ["fact", "hypothesis"] as const, "fact"),
    createdAt: row.created_at,
  };
}

const MERGEABLE_USER_FIELDS = [
  "country",
  "name",
  "home_city",
  "current_city",
  "on_vacation",
  "notes",
  "memory_updated_at",
  "signed_up_at",
  "assigned_phone",
  "latitude",
  "longitude",
  "onboarding_step",
] as const;

function hasValue(value: unknown) {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

async function authenticatedViewer(base44: Row) {
  try {
    return await readWithRateLimitRetry(() => base44.auth.me());
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status?: unknown }).status)
        : undefined;
    if (status === 401 || status === 403) return null;
    throw error;
  }
}

function viewerRecord(viewer: Row, user: Row) {
  return {
    id: viewer.id,
    email: viewer.email,
    name: user.name || viewer.full_name || undefined,
    phone: user.phone,
    assignedPhone: user.assigned_phone,
    messagingConnected: Boolean(user.phone && user.assigned_phone),
  };
}

function displayName(user: Row | undefined, fallback = "your friend") {
  return stringValue(user?.name) ||
    stringValue(user?.email).split("@")[0] ||
    fallback;
}

async function ensureSidequestUser(users: Row, viewer: Row) {
  const rows = await readWithRateLimitRetry(() =>
    users.filter({ auth_user_id: viewer.id }, undefined, 1)
  );
  const existing = rows[0];
  const identityPatch: Row = {};

  if (viewer.email && viewer.email !== existing?.email) {
    identityPatch.email = viewer.email;
  }
  if (viewer.full_name && !existing?.name) {
    identityPatch.name = viewer.full_name;
  }

  if (existing) {
    if (!existing.onboarding_step) {
      identityPatch.onboarding_step = "needs_memory_invite";
    }

    return Object.keys(identityPatch).length
      ? await users.update(existing.id, identityPatch)
      : existing;
  }

  return await users.create({
    auth_user_id: viewer.id,
    email: viewer.email,
    name: viewer.full_name || undefined,
    first_seen_at: Date.now(),
    onboarding_step: "needs_memory_invite",
  });
}

function bearerToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function pairKey(firstUserId: string, secondUserId: string) {
  return [firstUserId, secondUserId].sort().join(":");
}

function validInviteToken(value: unknown) {
  const token = stringValue(value);
  return /^[A-Za-z0-9_-]{40,100}$/.test(token) ? token : "";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const data = (await req.json()) as Record<string, unknown>;
    const action = data.action;
    const users = base44.asServiceRole.entities.SidequestUser;

    if (action === "getMySession") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const saved = await ensureSidequestUser(users, viewer);

      return Response.json({
        value: {
          viewer: viewerRecord(viewer, saved),
        },
      });
    }

    if (action === "getConnectionInvite") {
      const token = validInviteToken(data.token);
      if (!token) {
        return Response.json({ value: { status: "unavailable" } });
      }

      const invites = base44.asServiceRole.entities.ConnectionInvite;
      const inviteRows = await invites.filter(
        { token_hash: await tokenHash(token) },
        undefined,
        1,
      );
      const invite = inviteRows[0];
      if (!invite || invite.status === "revoked") {
        return Response.json({ value: { status: "unavailable" } });
      }

      if (invite.status === "pending" && invite.expires_at <= Date.now()) {
        await invites.update(invite.id, { status: "expired" });
        return Response.json({ value: { status: "expired" } });
      }

      const inviter = await users.get(invite.inviter_user_id);
      return Response.json({
        value: {
          status: invite.status,
          inviterName: displayName(inviter, "A friend"),
          invitedName: stringValue(invite.invited_name),
          expiresAt: invite.expires_at,
        },
      });
    }

    if (action === "createConnectionInvite") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const nodeId = stringValue(data.nodeId);
      if (!nodeId) {
        return Response.json({ error: "people node required" }, { status: 400 });
      }

      const graphNodes = base44.asServiceRole.entities.ExperienceGraphNode;
      let node: Row | undefined;
      try {
        node = await graphNodes.get(nodeId);
      } catch {
        node = undefined;
      }
      const ownsNode =
        node?.owner_user_id === user.id ||
        Boolean(user.phone && node?.phone === user.phone);
      if (!node || !ownsNode || categoryForNode(node) !== "people") {
        return Response.json({ error: "people node not found" }, { status: 404 });
      }
      if (node.linked_user_id || node.connection_id) {
        return Response.json(
          { error: "you are already connected" },
          { status: 409 },
        );
      }

      const invites = base44.asServiceRole.entities.ConnectionInvite;
      const previousInvites = await invites.filter({
        inviter_user_id: user.id,
        inviter_node_id: node.id,
        status: "pending",
      });
      for (const previousInvite of previousInvites) {
        await invites.update(previousInvite.id, { status: "revoked" });
      }

      const token = bearerToken();
      const now = Date.now();
      const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
      const invite = await invites.create({
        inviter_user_id: user.id,
        inviter_node_id: node.id,
        invited_name: stringValue(node.label) || "your friend",
        token_hash: await tokenHash(token),
        status: "pending",
        expires_at: expiresAt,
        created_at: now,
      });

      return Response.json({
        value: {
          inviteId: invite.id,
          token,
          invitedName: invite.invited_name,
          expiresAt,
        },
      });
    }

    if (action === "acceptConnectionInvite") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const token = validInviteToken(data.token);
      if (!token) {
        return Response.json({ error: "invite unavailable" }, { status: 404 });
      }

      const invites = base44.asServiceRole.entities.ConnectionInvite;
      const inviteRows = await invites.filter(
        { token_hash: await tokenHash(token) },
        undefined,
        1,
      );
      const invite = inviteRows[0];
      if (!invite || invite.status === "revoked" || invite.status === "expired") {
        return Response.json({ error: "invite unavailable" }, { status: 410 });
      }
      if (invite.status === "pending" && invite.expires_at <= Date.now()) {
        await invites.update(invite.id, { status: "expired" });
        return Response.json({ error: "invite expired" }, { status: 410 });
      }

      const recipient = await ensureSidequestUser(users, viewer);
      if (invite.status === "accepted") {
        if (invite.accepted_by_user_id !== recipient.id) {
          return Response.json(
            { error: "invite already accepted" },
            { status: 409 },
          );
        }
        return Response.json({
          value: {
            connected: true,
            connectionId: invite.connection_id,
          },
        });
      }

      let inviter: Row;
      let inviterNode: Row;
      try {
        [inviter, inviterNode] = await Promise.all([
          users.get(invite.inviter_user_id),
          base44.asServiceRole.entities.ExperienceGraphNode.get(
            invite.inviter_node_id,
          ),
        ]);
      } catch {
        return Response.json({ error: "invite unavailable" }, { status: 410 });
      }
      if (!inviter || !inviterNode) {
        return Response.json({ error: "invite unavailable" }, { status: 410 });
      }
      if (inviter.id === recipient.id || inviter.auth_user_id === viewer.id) {
        return Response.json(
          { error: "you cannot accept your own invite" },
          { status: 409 },
        );
      }

      const connections = base44.asServiceRole.entities.SidequestConnection;
      const graphNodes = base44.asServiceRole.entities.ExperienceGraphNode;
      const stablePairKey = pairKey(inviter.id, recipient.id);
      const existingConnections = await connections.filter(
        { pair_key: stablePairKey, status: "accepted" },
        undefined,
        1,
      );
      let connection = existingConnections[0];
      if (!connection) {
        connection = await connections.create({
          pair_key: stablePairKey,
          user_a_id: inviter.id,
          user_b_id: recipient.id,
          invite_id: invite.id,
          status: "accepted",
          created_at: Date.now(),
        });
      }

      const reciprocalRows = await graphNodes.filter(
        {
          owner_user_id: recipient.id,
          linked_user_id: inviter.id,
          source_type: "connection",
        },
        undefined,
        1,
      );
      const reciprocalNode = reciprocalRows[0] || await graphNodes.create({
        owner_user_id: recipient.id,
        source_type: "connection",
        linked_user_id: inviter.id,
        connection_id: connection.id,
        key: `connection:${inviter.id}`,
        category: "people",
        subtype: "friend",
        kind: "person",
        label: displayName(inviter),
        description: "A friend you connected with through Chapter.",
        certainty: "fact",
        confidence: 1,
        salience: 0.82,
        evidence: "You connected through a private Chapter invitation.",
        created_at: Date.now(),
      });
      const connectionNodePatch = connection.user_a_id === inviter.id
        ? {
          user_a_node_id: inviterNode.id,
          user_b_node_id: reciprocalNode.id,
        }
        : {
          user_a_node_id: reciprocalNode.id,
          user_b_node_id: inviterNode.id,
        };

      await Promise.all([
        graphNodes.update(inviterNode.id, {
          owner_user_id: inviter.id,
          source_type: inviterNode.source_type || "memory",
          linked_user_id: recipient.id,
          connection_id: connection.id,
        }),
        graphNodes.update(reciprocalNode.id, {
          connection_id: connection.id,
        }),
        connections.update(connection.id, connectionNodePatch),
        invites.update(invite.id, {
          status: "accepted",
          accepted_by_user_id: recipient.id,
          connection_id: connection.id,
          accepted_at: Date.now(),
        }),
      ]);

      return Response.json({
        value: {
          connected: true,
          connectionId: connection.id,
          friendName: displayName(inviter),
        },
      });
    }

    if (action === "getMyConnections") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const connections = base44.asServiceRole.entities.SidequestConnection;
      const invites = base44.asServiceRole.entities.ConnectionInvite;
      const graphNodes = base44.asServiceRole.entities.ExperienceGraphNode;
      const connectionRows = await readWithRateLimitRetry(() =>
        connections.filter(
          {
            status: "accepted",
            $or: [
              { user_a_id: user.id },
              { user_b_id: user.id },
            ],
          },
          "-created_at",
          100,
        )
      );
      const pendingRows = await readWithRateLimitRetry(() =>
        invites.filter(
          { inviter_user_id: user.id, status: "pending" },
          "-created_at",
          100,
        )
      );

      const accepted = [];
      for (const connection of connectionRows) {
        const userIsFirst = connection.user_a_id === user.id;
        const otherUserId = userIsFirst
          ? connection.user_b_id
          : connection.user_a_id;
        const nodeId = userIsFirst
          ? connection.user_a_node_id
          : connection.user_b_node_id;
        let otherUser: Row | undefined;
        let node: Row | undefined;
        try {
          otherUser = await readWithRateLimitRetry(() =>
            users.get(otherUserId)
          );
          node = nodeId
            ? await readWithRateLimitRetry(() => graphNodes.get(nodeId))
            : undefined;
        } catch {
          // A partially repaired connection remains private and is omitted.
        }
        if (!otherUser) continue;

        accepted.push({
          id: connection.id,
          nodeId,
          name: stringValue(node?.label) || displayName(otherUser),
          connectedAt: connection.created_at,
        });
      }

      const now = Date.now();
      const pending = pendingRows
        .filter((invite) => invite.expires_at > now)
        .map((invite) => ({
          id: invite.id,
          nodeId: invite.inviter_node_id,
          name: invite.invited_name,
          createdAt: invite.created_at,
          expiresAt: invite.expires_at,
        }));

      return Response.json({ value: { accepted, pending } });
    }

    if (action === "connectMyPhone") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const phone = typeof data.phone === "string" ? data.phone.trim() : "";
      if (!phone) {
        return Response.json({ error: "phone required" }, { status: 400 });
      }

      const [authRows, phoneRows] = await Promise.all([
        users.filter({ auth_user_id: viewer.id }, undefined, 1),
        users.filter({ phone }, undefined, 1),
      ]);
      const authUser = authRows[0];
      const phoneUser = phoneRows[0];

      if (phoneUser?.auth_user_id && phoneUser.auth_user_id !== viewer.id) {
        return Response.json(
          { error: "That phone is already connected to another account." },
          { status: 409 },
        );
      }

      if (authUser?.phone && authUser.phone !== phone) {
        return Response.json(
          { error: "This account is already connected to a different phone." },
          { status: 409 },
        );
      }

      const inputPatch: Row = { phone };
      if (typeof data.country === "string") inputPatch.country = data.country;
      if (typeof data.currentCity === "string") inputPatch.current_city = data.currentCity;
      if (typeof data.latitude === "number") inputPatch.latitude = data.latitude;
      if (typeof data.longitude === "number") inputPatch.longitude = data.longitude;
      if (typeof data.assignedPhone === "string") {
        inputPatch.assigned_phone = data.assignedPhone;
      }
      if (typeof data.signedUpAt === "number") inputPatch.signed_up_at = data.signedUpAt;

      let saved: Row;
      if (authUser && phoneUser && authUser.id !== phoneUser.id) {
        const merged: Row = { ...inputPatch };
        for (const field of MERGEABLE_USER_FIELDS) {
          if (
            !hasValue(merged[field]) &&
            !hasValue(authUser[field]) &&
            hasValue(phoneUser[field])
          ) {
            merged[field] = phoneUser[field];
          }
        }
        merged.email = viewer.email;
        merged.first_seen_at = Math.min(
          authUser.first_seen_at ?? Date.now(),
          phoneUser.first_seen_at ?? Date.now(),
        );
        saved = await users.update(authUser.id, merged);
        await users.delete(phoneUser.id);
      } else if (authUser || phoneUser) {
        const target = authUser ?? phoneUser;
        saved = await users.update(target.id, {
          ...inputPatch,
          auth_user_id: viewer.id,
          email: viewer.email,
          name: target.name || viewer.full_name || undefined,
          onboarding_step: target.onboarding_step || "needs_memory_invite",
        });
      } else {
        saved = await users.create({
          ...inputPatch,
          auth_user_id: viewer.id,
          email: viewer.email,
          name: viewer.full_name || undefined,
          first_seen_at: Date.now(),
          onboarding_step: "needs_memory_invite",
        });
      }

      return Response.json({ value: { viewer: viewerRecord(viewer, saved) } });
    }

    if (action === "getMyGraph") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const phone = stringValue(user.phone);
      const authUserId = stringValue(user.auth_user_id);

      const memories = base44.asServiceRole.entities.ExperienceMemory;
      const graphNodes = base44.asServiceRole.entities.ExperienceGraphNode;
      const graphEdges = base44.asServiceRole.entities.ExperienceGraphEdge;
      const invites = base44.asServiceRole.entities.ConnectionInvite;
      const memoryRows = await readWithRateLimitRetry(() =>
        memories.filter(
          phone
            ? {
                status: "complete",
                $or: [{ phone }, { auth_user_id: authUserId }],
              }
            : { auth_user_id: authUserId, status: "complete" },
          "created_at",
          5000,
        )
      );
      const nodeRows = await readWithRateLimitRetry(() =>
        graphNodes.filter(
          phone
            ? {
                $or: [{ phone }, { owner_user_id: user.id }],
              }
            : { owner_user_id: user.id },
          "created_at",
          5000,
        )
      );
      const completeMemoryIds = new Set(memoryRows.map((row: Row) => row.id));
      const completedNodes = nodeRows.filter(
        (row: Row) =>
          completeMemoryIds.has(row.memory_id) ||
          (row.source_type === "connection" && row.owner_user_id === user.id),
      );
      const completedNodeIds = new Set(completedNodes.map((row: Row) => row.id));
      const edgeRows = completeMemoryIds.size > 0
        ? await readWithRateLimitRetry(() =>
          graphEdges.filter(
            phone
              ? {
                  $or: [{ phone }, { auth_user_id: authUserId }],
                }
              : { auth_user_id: authUserId },
            "created_at",
            5000,
          )
        )
        : [];
      const completedEdges = edgeRows.filter(
        (row: Row) =>
          completeMemoryIds.has(row.memory_id) &&
          completedNodeIds.has(row.from_node_id) &&
          completedNodeIds.has(row.to_node_id),
      );
      const projected = collapseMemoryGraphRows(completedNodes, completedEdges);
      const now = Date.now();
      const inviteStatusByNode = new Map<string, "pending">();
      const hasPeopleNodes = projected.nodes.some(
        (node: Row) => categoryForNode(node) === "people",
      );
      const pendingInvites = hasPeopleNodes
        ? await readWithRateLimitRetry(() =>
          invites.filter(
            { inviter_user_id: user.id, status: "pending" },
            "-created_at",
            100,
          )
        )
        : [];
      for (const invite of pendingInvites) {
        const projectedNodeId =
          projected.aliases.get(invite.inviter_node_id) ??
          invite.inviter_node_id;
        if (invite.expires_at > now && !inviteStatusByNode.has(projectedNodeId)) {
          inviteStatusByNode.set(projectedNodeId, "pending");
        }
      }

      return Response.json({
        value: {
          memoryCount: memoryRows.length,
          onboardingStep: user.onboarding_step,
          nodes: projected.nodes.map((node) =>
            graphNodeRecord(node, inviteStatusByNode.get(node.id))
          ),
          edges: projected.edges.map(graphEdgeRecord),
        },
      });
    }

    if (action === "getMyConversation") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const messages = base44.asServiceRole.entities.ConversationMessage;
      const sinceCursor =
        typeof data.sinceCursor === "number" && Number.isFinite(data.sinceCursor)
          ? data.sinceCursor
          : 0;
      const limit = Math.min(
        Math.max(typeof data.limit === "number" ? Math.floor(data.limit) : 100, 1),
        200,
      );
      const phone = stringValue(user.phone);
      const authUserId = stringValue(user.auth_user_id);

      const rows = await readWithRateLimitRetry(() =>
        messages.filter(
          {
            ...(phone
              ? { $or: [{ phone }, { auth_user_id: authUserId }] }
              : { auth_user_id: authUserId }),
            created_at: { $gt: sinceCursor },
          },
          "created_at",
          limit,
        )
      );
      const sorted = rows
        .sort((first: Row, second: Row) => first.created_at - second.created_at);

      return Response.json({
        value: {
          messages: sorted.map((row: Row) => ({
            id: row.id,
            role: row.role,
            text: stringValue(row.text),
            channel: row.channel,
            deliveryStatus: row.delivery_status,
            createdAt: Number(row.created_at),
          })),
        },
      });
    }

    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Base44 data request failed.";
    console.error("sidequest-data failed", error);
    if (isRateLimitError(error)) {
      return Response.json(
        { error: "Chapter is busy. Try again in a moment." },
        { status: 429, headers: { "Retry-After": "2" } },
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
});
