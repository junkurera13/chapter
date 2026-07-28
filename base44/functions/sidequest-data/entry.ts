import { createClientFromRequest } from "npm:@base44/sdk";

import {
  mapWithLimit,
  OPEN_WORLDS_AT_ONCE,
} from "../../shared/concurrency.ts";
import { collapseMemoryGraphRows } from "../../shared/memory-map.ts";
import {
  bothSaidYes,
  INTRODUCTION_GRAPH_READS,
  INTRODUCTION_MIN_ANCHORS,
  INTRODUCTION_SCAN_LIMIT,
  INTRODUCTION_TTL_MS,
  introductionPairKey,
  introductionRecordFor,
  isLiveIntroduction,
  MAX_LIVE_INTRODUCTIONS,
  normalizeCity,
  normalizeMatchLabel,
  responseOf,
  sharedAnchorsBetween,
  sideFor,
  takesPartInIntroductions,
} from "../../shared/introductions.ts";
import {
  TOGETHER_OPEN_STATUSES,
  togetherChapterRecord,
  visibleTo,
} from "../../shared/together-chapter.ts";
import {
  weeklyCompanyForConnection,
  weeklyCompanionFamiliarity,
  weeklyCardsHaveConcretePeopleAndPlaces,
} from "../../shared/weekly-companion.ts";

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
    introductionsMuted: Boolean(user.introductions_muted),
    homeCity: stringValue(user.home_city) || undefined,
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
    // Backfilled for accounts whose home city predates the introduction pool.
    if (existing.home_city && !existing.home_city_key) {
      identityPatch.home_city_key = normalizeCity(existing.home_city);
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

/**
 * Invite codes read aloud and typed by hand, so the alphabet drops the
 * characters people confuse: I, L, O, and U never appear.
 */
const INVITE_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const INVITE_CODE_LENGTH = 10;

/**
 * Ten characters from a 32-letter alphabet is about 1.1 quadrillion codes.
 * Unlike a password, this one is single-use, expires, and grants nothing but a
 * connection to one person — so it is stored as written rather than hashed,
 * which is what lets the same link be handed out twice.
 */
function inviteCode() {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (byte) => INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length],
  ).join("");
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

/** Accepts a current short code, or one of the long tokens issued before. */
function validInviteToken(value: unknown) {
  const token = stringValue(value);
  if (new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`).test(token)) {
    return token;
  }
  return /^[A-Za-z0-9_-]{40,100}$/.test(token) ? token : "";
}

/**
 * Finds an invite by its code. New invites match on the stored code; links
 * handed out before the change still match on their hash.
 */
async function inviteByCode(invites: Row, code: string) {
  const byCode = await readWithRateLimitRetry(() =>
    invites.filter({ code }, undefined, 1)
  );
  if (byCode[0]) return byCode[0];

  const byHash = await readWithRateLimitRetry(async () =>
    invites.filter({ token_hash: await tokenHash(code) }, undefined, 1)
  );
  return byHash[0];
}

/** Accepts only parseable JSON payloads within a byte budget. */
function boundedJson(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value : "";
  if (!text || text.length > maxLength) return "";
  try {
    JSON.parse(text);
    return text;
  } catch {
    return "";
  }
}

function parsedJson(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Every completed node and edge a person owns, collapsed into the projected
 * memory graph. Shared by the owner's own graph read and by Together's
 * partner-side planning read, so both see exactly the same source of truth.
 */
async function projectedGraphFor(
  base44: Row,
  user: Row,
  /**
   * Planning reads only ever look at nodes. Asking for edges anyway meant a
   * third five-thousand-row query per world opened, thrown away on arrival —
   * and Together opens one world per person, plus every stranger a scan
   * reaches. Skipping it is most of what that read costs.
   */
  options: { withEdges?: boolean } = {},
) {
  const phone = stringValue(user.phone);
  const authUserId = stringValue(user.auth_user_id);
  const withEdges = options.withEdges !== false;

  const memories = base44.asServiceRole.entities.ExperienceMemory;
  const graphNodes = base44.asServiceRole.entities.ExperienceGraphNode;
  const graphEdges = base44.asServiceRole.entities.ExperienceGraphEdge;

  // Read together rather than one after another. None of the three needs an
  // answer from the others to be asked; only to be understood.
  const [memoryRows, nodeRows, edgeRows] = await Promise.all([
    readWithRateLimitRetry(() =>
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
    ),
    readWithRateLimitRetry(() =>
      graphNodes.filter(
        phone
          ? {
              $or: [{ phone }, { owner_user_id: user.id }],
            }
          : { owner_user_id: user.id },
        "created_at",
        5000,
      )
    ),
    withEdges
      ? readWithRateLimitRetry(() =>
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
      : Promise.resolve([] as Row[]),
  ]);

  const completeMemoryIds = new Set(memoryRows.map((row: Row) => row.id));
  const completedNodes = nodeRows.filter(
    (row: Row) =>
      completeMemoryIds.has(row.memory_id) ||
      (row.source_type === "connection" && row.owner_user_id === user.id),
  );
  const completedNodeIds = new Set(completedNodes.map((row: Row) => row.id));
  const completedEdges = completeMemoryIds.size === 0
    ? []
    : edgeRows.filter(
      (row: Row) =>
        completeMemoryIds.has(row.memory_id) &&
        completedNodeIds.has(row.from_node_id) &&
        completedNodeIds.has(row.to_node_id),
    );

  return {
    memoryRows,
    projected: collapseMemoryGraphRows(completedNodes, completedEdges),
  };
}

/**
 * The only node categories that may be named in an invitation two people
 * both read. Mirrored in lib/togetherChapterSchema.ts; enforced on both sides
 * so neither can widen it alone.
 */
const TOGETHER_SHAREABLE_CATEGORIES = ["place", "activity", "interest"] as const;

/**
 * A partner's world cut down to what a shared plan may be built from: three
 * safe categories, and per node only an id, a label, and a weight. No
 * descriptions, no evidence, no edges, no memories, no people, no feelings.
 */
async function planningGraphFor(base44: Row, user: Row) {
  // Nodes only. A planning graph is a list of labels and weights; it has never
  // named an edge, and reading them was pure cost.
  const { projected } = await projectedGraphFor(base44, user, {
    withEdges: false,
  });
  return { nodes: planningNodesFromProjected(projected.nodes) };
}

function planningNodesFromProjected(projectedNodes: Row[]) {
  return projectedNodes
    .filter((node: Row) =>
      (TOGETHER_SHAREABLE_CATEGORIES as readonly string[]).includes(
        categoryForNode(node),
      )
    )
    .map((node: Row) => ({
      id: node.id,
      label: stringValue(node.label),
      category: categoryForNode(node),
      salience: boundedUnit(node.salience, 0.6),
    }))
    .filter((node: Row) => node.label);
}

const NOW_TIME_WINDOWS = ["morning", "afternoon", "evening", "night"];

/**
 * The parts of a day someone said they were free in, kept in the order a day
 * runs and stripped of anything that is not one of the four. Stored as a plain
 * comma list rather than JSON: it is a set of four known words, and a column
 * you can read at a glance is worth more here than one that parses.
 */
function timeWindowList(value: unknown) {
  const raw = Array.isArray(value)
    ? value.map((entry) => stringValue(entry))
    : stringValue(value).split(",");
  const chosen = raw.map((entry) => entry.trim().toLowerCase());
  return NOW_TIME_WINDOWS.filter((window) => chosen.includes(window));
}

const NOW_REACHES = ["walk", "near", "city", "beyond"];

/** One of the four named reaches, or nothing when it was never asked. */
function reachValue(value: unknown) {
  const reach = stringValue(value).toLowerCase();
  return NOW_REACHES.includes(reach) ? reach : undefined;
}

function nowChapterRecord(row: Row) {
  return {
    id: row.id,
    status: row.status,
    createdAt: Number(row.created_at),
    scheduledFor: stringValue(row.scheduled_for) || undefined,
    timeWindows: timeWindowList(row.time_windows),
    reach: reachValue(row.reach),
    researchRunId: stringValue(row.research_run_id) || undefined,
    brief: parsedJson(row.brief_json),
    content: parsedJson(row.content_json),
    evidence: parsedJson(row.evidence_json) ?? [],
    declineReason: stringValue(row.decline_reason) || undefined,
  };
}

const WEEKLY_CARD_IDS = ["small", "mini", "proper"] as const;

function weeklyCardId(value: unknown) {
  const id = stringValue(value);
  return (WEEKLY_CARD_IDS as readonly string[]).includes(id) ? id : undefined;
}

function weeklyCardIdList(value: unknown) {
  const values = Array.isArray(value)
    ? value.map((entry) => stringValue(entry))
    : stringValue(value).split(",");
  return WEEKLY_CARD_IDS.filter((id) => values.includes(id));
}

function validTimezone(value: unknown) {
  const timezone = stringValue(value).slice(0, 80);
  if (!timezone) return undefined;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return undefined;
  }
}

/**
 * The release is enforced where the private row becomes a browser record.
 * Before release_at there is no cards field to uncover in devtools.
 */
function weeklyPackRecord(row: Row, now = Date.now()) {
  const storedStatus = stringValue(row.status);
  const releaseAt = Number(row.release_at);
  const expiresAt = Number(row.expires_at);
  const released = now >= releaseAt && storedStatus !== "preparing";
  const cards = released ? parsedJson(row.cards_json) : undefined;
  const validReleasedCards =
    !released || weeklyCardsHaveConcretePeopleAndPlaces(cards);
  const status =
    storedStatus === "failed"
      ? "failed"
      : !validReleasedCards
        ? "failed"
        : storedStatus === "lived"
          ? "lived"
          : storedStatus === "dismissed"
            ? "dismissed"
            : now >= expiresAt
              ? "expired"
              : storedStatus === "chosen"
                ? "chosen"
                : storedStatus === "preparing" || now < releaseAt
                  ? "locked"
                  : "available";
  return {
    id: row.id,
    weekKey: stringValue(row.week_key),
    status,
    releaseAt,
    expiresAt,
    ...(released && validReleasedCards ? { cards } : {}),
    revealedCardIds:
      released && validReleasedCards
        ? weeklyCardIdList(row.revealed_card_ids)
        : [],
    chosenCardId:
      released && validReleasedCards
        ? weeklyCardId(row.chosen_card_id)
        : undefined,
    scheduledFor:
      released && validReleasedCards && stringValue(row.scheduled_for)
        ? stringValue(row.scheduled_for)
        : undefined,
    livedAt: Number(row.lived_at) || undefined,
  };
}

function weeklyPackPreparationRecord(row: Row) {
  return {
    id: row.id,
    ownerUserId: stringValue(row.owner_user_id),
    weekKey: stringValue(row.week_key),
    timezone: stringValue(row.timezone),
    releaseAt: Number(row.release_at),
    expiresAt: Number(row.expires_at),
    status: stringValue(row.status),
    design: parsedJson(row.design_json),
    researchRuns: parsedJson(row.research_run_ids_json),
    generationRequestId:
      stringValue(row.generation_request_id) || undefined,
    attemptCount: Number(row.attempt_count) || 0,
  };
}

function firstName(user: Row | undefined, fallback = "your friend") {
  return displayName(user, fallback).split(" ")[0];
}

/**
 * A weekly social card never starts from a generic company label. It starts
 * from one real person who has already crossed the introduction consent gate.
 *
 * Introduction-origin connections remain `new-person` until Chapter has a
 * lived meeting on record. Invite-origin and already-met connections are
 * familiar people. Either way, only the strict intersection of the two
 * shareable graphs may shape their card.
 */
async function weeklySocialCandidateFor(
  base44: Row,
  user: Row,
  mine: Row[],
  connectionRows: Row[],
) {
  if (mine.length === 0 || connectionRows.length === 0) return undefined;
  const users = base44.asServiceRole.entities.SidequestUser;
  const mineByLabel = new Map<string, Row>();
  for (const node of mine) {
    const key = normalizeMatchLabel(stringValue(node.label));
    if (key && !mineByLabel.has(key)) mineByLabel.set(key, node);
  }

  const candidates = await mapWithLimit(
    connectionRows,
    OPEN_WORLDS_AT_ONCE,
    async (connection: Row) => {
      const otherUserId = connection.user_a_id === user.id
        ? stringValue(connection.user_b_id)
        : stringValue(connection.user_a_id);
      if (!otherUserId) return undefined;

      let other: Row | undefined;
      try {
        other = await readWithRateLimitRetry(() => users.get(otherUserId));
      } catch {
        other = undefined;
      }
      if (!other) return undefined;

      const theirs = (await planningGraphFor(base44, other)).nodes;
      const shared = sharedAnchorsBetween(mine, theirs);
      const company = weeklyCompanyForConnection(connection);
      const minimumAnchors = company === "new-person"
        ? INTRODUCTION_MIN_ANCHORS
        : 1;
      if (shared.anchors.length < minimumAnchors) return undefined;

      const sharedAnchors = shared.anchors.flatMap((anchor) => {
        const node = mineByLabel.get(normalizeMatchLabel(anchor.label));
        return node
          ? [{
              nodeId: stringValue(node.id),
              label: stringValue(node.label),
              category: stringValue(node.category),
            }]
          : [];
      });
      if (sharedAnchors.length < minimumAnchors) return undefined;

      const name = firstName(other, "");
      if (!name) return undefined;
      return {
        company,
        companion: {
          connectionId: stringValue(connection.id),
          userId: otherUserId,
          name,
          familiarity: weeklyCompanionFamiliarity(company),
        },
        sharedAnchors,
        sharedWeight: shared.weight,
        connectionCreatedAt: Number(connection.created_at) || 0,
      };
    },
  );

  const ranked = candidates
    .filter(
      (
        candidate,
      ): candidate is NonNullable<(typeof candidates)[number]> =>
        Boolean(candidate),
    )
    .sort((first, second) => {
      if (first.company !== second.company) {
        return first.company === "new-person" ? -1 : 1;
      }
      return (
        second.sharedWeight - first.sharedWeight ||
        second.connectionCreatedAt - first.connectionCreatedAt
      );
    });
  const selected = ranked[0];
  if (!selected) return undefined;
  return {
    company: selected.company,
    companion: selected.companion,
    sharedAnchors: selected.sharedAnchors,
  };
}

/**
 * Actions that read one account on behalf of another are reachable only from
 * Chapter's own server, never from a browser holding a user token.
 */
function trustedInternalCall(data: Row) {
  const expected = stringValue(
    Deno.env.get("SIDEQUEST_INTERNAL_SECRET"),
  );
  return Boolean(expected) && data.internalSecret === expected;
}

/**
 * A caller that cannot prove it is Chapter's own server is refused, but it is
 * refused as a server. Answering 401 here told a signed-in person their
 * session had expired when the only thing wrong was a secret two deployments
 * disagreed about, and sent them to sign in again from a session that was
 * never in question.
 */
function untrustedInternalCall() {
  return Response.json(
    { error: "internal call not permitted" },
    { status: 403 },
  );
}

/** The accepted connection joining the viewer to someone else, or undefined. */
async function acceptedConnectionFor(
  base44: Row,
  userId: string,
  connectionId: string,
) {
  const connections = base44.asServiceRole.entities.SidequestConnection;
  let connection: Row | undefined;
  try {
    connection = connectionId ? await connections.get(connectionId) : undefined;
  } catch {
    connection = undefined;
  }
  if (
    !connection ||
    connection.status !== "accepted" ||
    (connection.user_a_id !== userId && connection.user_b_id !== userId)
  ) {
    return undefined;
  }
  return connection;
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
      const invite = await inviteByCode(invites, token);
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
      const now = Date.now();

      // The same person gets the same link every time. Minting a fresh code on
      // each tap used to revoke the one already sent, quietly killing a link
      // that was sitting in somebody's messages.
      const openInvites = await readWithRateLimitRetry(() =>
        invites.filter(
          {
            inviter_user_id: user.id,
            inviter_node_id: node.id,
            status: "pending",
          },
          "-created_at",
          10,
        )
      );
      const reusable = openInvites.find(
        (row: Row) => stringValue(row.code) && row.expires_at > now,
      );
      if (reusable) {
        return Response.json({
          value: {
            inviteId: reusable.id,
            token: stringValue(reusable.code),
            invitedName: reusable.invited_name,
            expiresAt: reusable.expires_at,
          },
        });
      }

      // Anything left open that can't be handed out again (a pre-code link, or
      // an expired one) is retired so only one invite per person stays live.
      for (const previousInvite of openInvites) {
        await invites.update(previousInvite.id, { status: "revoked" });
      }

      const token = inviteCode();
      const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
      const invite = await invites.create({
        inviter_user_id: user.id,
        inviter_node_id: node.id,
        invited_name: stringValue(node.label) || "your friend",
        code: token,
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
      const invite = await inviteByCode(invites, token);
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
          origin: "invite",
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
      const [connectionRows, pendingRows] = await Promise.all([
        readWithRateLimitRetry(() =>
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
        ),
        readWithRateLimitRetry(() =>
          invites.filter(
            { inviter_user_id: user.id, status: "pending" },
            "-created_at",
            100,
          )
        ),
      ]);

      // A few connections at a time. Read one after another, a list of ten
      // people cost twenty round trips before the first name appeared; read
      // all at once, it is twenty at once against a rate-limited API.
      const resolved = await mapWithLimit(
        connectionRows,
        OPEN_WORLDS_AT_ONCE,
        async (connection: Row) => {
          const userIsFirst = connection.user_a_id === user.id;
          const otherUserId = userIsFirst
            ? connection.user_b_id
            : connection.user_a_id;
          const nodeId = userIsFirst
            ? connection.user_a_node_id
            : connection.user_b_node_id;
          // The node is read alongside the person and allowed to fail on its
          // own: a connection whose label row has gone is still a connection,
          // and the account behind it still has a name.
          const [otherUser, node] = await Promise.all([
            readWithRateLimitRetry(() => users.get(otherUserId)).catch(
              () => undefined,
            ),
            nodeId
              ? readWithRateLimitRetry(() => graphNodes.get(nodeId)).catch(
                () => undefined,
              )
              : Promise.resolve(undefined),
          ]);
          // A partially repaired connection remains private and is omitted.
          if (!otherUser) return undefined;

          return {
            id: connection.id,
            nodeId,
            name: stringValue(node?.label) || displayName(otherUser),
            connectedAt: connection.created_at,
          };
        },
      );
      const accepted = resolved.filter(Boolean);

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

    /**
     * The way out.
     *
     * There is no way in, because there is nothing to consent to: a gist about
     * someone unmet is built from the strict intersection, so every word of it
     * is already true in the reader's own world and none of it is the other
     * person's to disclose. Nothing crosses until both people say yes, and that
     * yes is the consent gate.
     *
     * Muting does not only stop new offers. It withdraws every live one,
     * because an offer standing in someone else's app after you left is a
     * promise you did not make.
     */
    if (action === "setMyIntroductions") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const muted = data.muted === true;
      await users.update(user.id, {
        introductions_muted: muted,
        ...(muted ? { introductions_muted_at: Date.now() } : {}),
      });

      if (muted) {
        const introductions = base44.asServiceRole.entities.Introduction;
        const live = await readWithRateLimitRetry(() =>
          introductions.filter(
            {
              status: "offered",
              $or: [{ user_a_id: user.id }, { user_b_id: user.id }],
            },
            "-created_at",
            100,
          )
        );
        await Promise.all(
          live.map((row: Row) =>
            introductions.update(row.id, { status: "expired" })
          ),
        );
      }

      return Response.json({ value: { introductionsMuted: muted } });
    }

    if (action === "getMyIntroductions") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      if (user.introductions_muted) {
        return Response.json({
          value: { muted: true, homeCity: "", introductions: [] },
        });
      }

      const introductions = base44.asServiceRole.entities.Introduction;
      const rows = await readWithRateLimitRetry(() =>
        introductions.filter(
          {
            status: "offered",
            $or: [{ user_a_id: user.id }, { user_b_id: user.id }],
          },
          "-created_at",
          MAX_LIVE_INTRODUCTIONS * 4,
        )
      );

      const now = Date.now();
      const value = [];
      for (const row of rows) {
        const record = introductionRecordFor(row, user.id, now);
        if (record) value.push(record);
      }

      return Response.json({
        value: {
          muted: false,
          homeCity: stringValue(user.home_city),
          introductions: value.slice(0, MAX_LIVE_INTRODUCTIONS),
        },
      });
    }

    /**
     * The pool scan. Reads other accounts on this account's behalf, so it is
     * gated on the internal secret as well as the caller's own session and is
     * never reachable from a browser.
     *
     * The intersection is computed here rather than upstream on purpose. Only
     * the labels two worlds genuinely share ever leave this function, so a
     * stranger's world is never shipped anywhere, not even to Chapter's own
     * server, and the name behind a candidate is not returned at all.
     */
    if (action === "findIntroductionCandidates") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }
      if (!trustedInternalCall(data)) return untrustedInternalCall();

      const user = await ensureSidequestUser(users, viewer);
      const city = normalizeCity(user.home_city);
      if (!takesPartInIntroductions(user)) {
        return Response.json({ value: { candidates: [] } });
      }

      const introductions = base44.asServiceRole.entities.Introduction;
      const connections = base44.asServiceRole.entities.SidequestConnection;
      const [mineRows, connectionRows] = await Promise.all([
        readWithRateLimitRetry(() =>
          introductions.filter(
            { $or: [{ user_a_id: user.id }, { user_b_id: user.id }] },
            "-created_at",
            200,
          )
        ),
        readWithRateLimitRetry(() =>
          connections.filter(
            { $or: [{ user_a_id: user.id }, { user_b_id: user.id }] },
            "-created_at",
            200,
          )
        ),
      ]);

      const now = Date.now();
      const liveCount = mineRows.filter((row: Row) =>
        isLiveIntroduction(row, now)
      ).length;
      const openings = MAX_LIVE_INTRODUCTIONS - liveCount;
      if (openings <= 0) {
        return Response.json({ value: { candidates: [] } });
      }

      // A pair is offered once, ever. Someone who passed on you is not shown
      // to you again under a different sentence, and neither are you to them.
      const alreadyPaired = new Set<string>();
      for (const row of mineRows) {
        alreadyPaired.add(
          row.user_a_id === user.id ? row.user_b_id : row.user_a_id,
        );
      }
      for (const row of connectionRows) {
        alreadyPaired.add(
          row.user_a_id === user.id ? row.user_b_id : row.user_a_id,
        );
      }

      // Queried on the city rather than scanned and compared, so a pool that
      // grows in other cities costs this one nothing.
      const pool = await readWithRateLimitRetry(() =>
        users.filter(
          { home_city_key: city },
          "-first_seen_at",
          INTRODUCTION_SCAN_LIMIT,
        )
      );
      const mine = (await planningGraphFor(base44, user)).nodes;
      if (mine.length === 0) {
        return Response.json({ value: { candidates: [] } });
      }

      // Narrowing is free. Opening a world is not, so only so many are opened
      // per scan, and the count that was skipped is said out loud rather than
      // quietly presented as though the city held nobody else.
      const reachable = pool.filter((candidate: Row) =>
        candidate.id !== user.id &&
        !alreadyPaired.has(candidate.id) &&
        takesPartInIntroductions(candidate)
      );
      const opened = reachable.slice(0, INTRODUCTION_GRAPH_READS);

      // A stranger's world costs exactly what a friend's does to open, and a
      // scan opens far more of them, so it is held to the same ceiling.
      const scored = [];
      const graphs = await mapWithLimit(
        opened,
        OPEN_WORLDS_AT_ONCE,
        async (candidate: Row) => ({
          candidate,
          nodes: (await planningGraphFor(base44, candidate)).nodes,
        }),
      );
      for (const { candidate, nodes } of graphs) {
        const shared = sharedAnchorsBetween(mine, nodes);
        if (shared.anchors.length < INTRODUCTION_MIN_ANCHORS) continue;
        scored.push({
          userId: candidate.id,
          anchors: shared.anchors,
          weight: shared.weight,
        });
      }

      const candidates = scored
        .sort((first, second) => second.weight - first.weight)
        .slice(0, openings);

      return Response.json({
        value: {
          candidates,
          matchCity: city,
          scanned: opened.length,
          skipped: reachable.length - opened.length,
        },
      });
    }

    /**
     * Records one offer, once. Idempotent on the pair, so two people scanning
     * at the same moment cannot end up looking at two different sentences
     * about the same coincidence.
     */
    if (action === "offerIntroduction") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }
      if (!trustedInternalCall(data)) return untrustedInternalCall();

      const user = await ensureSidequestUser(users, viewer);
      const otherUserId = stringValue(data.otherUserId);
      const line = stringValue(data.line);
      const matchCity = normalizeCity(data.matchCity);
      if (!takesPartInIntroductions(user) || !otherUserId || !line || !matchCity) {
        return Response.json({ error: "introduction unavailable" }, { status: 400 });
      }
      if (otherUserId === user.id) {
        return Response.json({ error: "introduction unavailable" }, { status: 400 });
      }

      let other: Row | undefined;
      try {
        other = await readWithRateLimitRetry(() => users.get(otherUserId));
      } catch {
        other = undefined;
      }
      // Re-checked here rather than trusted from the scan: someone can mute
      // between being found as a candidate and the offer being written down.
      if (!other || !takesPartInIntroductions(other)) {
        return Response.json({ error: "introduction unavailable" }, { status: 409 });
      }

      const introductions = base44.asServiceRole.entities.Introduction;
      const stablePairKey = introductionPairKey(user.id, other.id);
      const existingRows = await introductions.filter(
        { pair_key: stablePairKey },
        "-created_at",
        1,
      );
      const existing = existingRows[0];
      if (existing) {
        return Response.json({
          value: {
            introduction: introductionRecordFor(existing, user.id, Date.now()),
          },
        });
      }

      const [firstId, secondId] = [user.id, other.id].sort();
      const created = await introductions.create({
        pair_key: stablePairKey,
        user_a_id: firstId,
        user_b_id: secondId,
        match_city: matchCity,
        line,
        anchors_json: boundedJson(data.anchorsJson, 4_000),
        shared_weight: typeof data.weight === "number" &&
            Number.isFinite(data.weight)
          ? data.weight
          : 0,
        user_a_response: "pending",
        user_b_response: "pending",
        status: "offered",
        created_at: Date.now(),
        expires_at: Date.now() + INTRODUCTION_TTL_MS,
      });

      return Response.json({
        value: {
          introduction: introductionRecordFor(created, user.id, Date.now()),
        },
      });
    }

    /**
     * One person's answer, and the moment two of them become a connection.
     *
     * A yes on its own reveals nothing to the other side; only the second yes
     * does anything at all. That is what makes this safe to answer honestly:
     * saying yes to a stranger who says no leaves you exactly where you were,
     * and they never learn you said it.
     */
    if (action === "respondToIntroduction") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const answer = data.answer === "yes" || data.answer === "no"
        ? data.answer
        : undefined;
      const introductions = base44.asServiceRole.entities.Introduction;
      let introduction: Row | undefined;
      try {
        introduction = await introductions.get(stringValue(data.introductionId));
      } catch {
        introduction = undefined;
      }
      const side = introduction ? sideFor(introduction, user.id) : undefined;
      if (!introduction || !side || !answer) {
        return Response.json({ error: "introduction not found" }, { status: 404 });
      }
      if (!isLiveIntroduction(introduction, Date.now())) {
        return Response.json({ error: "introduction closed" }, { status: 410 });
      }
      if (responseOf(introduction, side) !== "pending") {
        return Response.json({ error: "already answered" }, { status: 409 });
      }

      const answerPatch: Row = side === "a"
        ? { user_a_response: answer, user_a_responded_at: Date.now() }
        : { user_b_response: answer, user_b_responded_at: Date.now() };

      if (answer === "no") {
        await introductions.update(introduction.id, {
          ...answerPatch,
          status: "declined",
        });
        return Response.json({ value: { connected: false, closed: true } });
      }

      const answered = { ...introduction, ...answerPatch };
      if (!bothSaidYes(answered)) {
        await introductions.update(introduction.id, answerPatch);
        return Response.json({ value: { connected: false, closed: false } });
      }

      const otherUserId = side === "a"
        ? introduction.user_b_id
        : introduction.user_a_id;
      let other: Row | undefined;
      try {
        other = await readWithRateLimitRetry(() => users.get(otherUserId));
      } catch {
        other = undefined;
      }
      if (!other) {
        await introductions.update(introduction.id, {
          ...answerPatch,
          status: "expired",
        });
        return Response.json({ error: "introduction closed" }, { status: 410 });
      }

      const connections = base44.asServiceRole.entities.SidequestConnection;
      const graphNodes = base44.asServiceRole.entities.ExperienceGraphNode;
      const stablePairKey = pairKey(user.id, other.id);
      const existingConnections = await connections.filter(
        { pair_key: stablePairKey, status: "accepted" },
        undefined,
        1,
      );
      let connection = existingConnections[0];
      if (!connection) {
        connection = await connections.create({
          pair_key: stablePairKey,
          user_a_id: user.id,
          user_b_id: other.id,
          introduction_id: introduction.id,
          origin: "introduction",
          status: "accepted",
          created_at: Date.now(),
        });
      }

      // Neither side named the other, so unlike an accepted invite there is no
      // existing node to adopt. Both people get a freshly made one.
      const nodeFor = async (owner: Row, subject: Row) => {
        const rows = await graphNodes.filter(
          {
            owner_user_id: owner.id,
            linked_user_id: subject.id,
            source_type: "connection",
          },
          undefined,
          1,
        );
        return rows[0] || await graphNodes.create({
          owner_user_id: owner.id,
          source_type: "connection",
          linked_user_id: subject.id,
          connection_id: connection.id,
          key: `connection:${subject.id}`,
          category: "people",
          subtype: "friend",
          kind: "person",
          label: displayName(subject),
          description: "Someone Chapter introduced you to.",
          certainty: "fact",
          confidence: 1,
          salience: 0.78,
          evidence: "Chapter noticed what your two worlds already shared.",
          created_at: Date.now(),
        });
      };

      const [myNode, theirNode] = await Promise.all([
        nodeFor(user, other),
        nodeFor(other, user),
      ]);

      await Promise.all([
        connections.update(connection.id, {
          user_a_node_id: connection.user_a_id === user.id
            ? myNode.id
            : theirNode.id,
          user_b_node_id: connection.user_b_id === user.id
            ? myNode.id
            : theirNode.id,
        }),
        introductions.update(introduction.id, {
          ...answerPatch,
          status: "connected",
          connection_id: connection.id,
          connected_at: Date.now(),
        }),
      ]);

      return Response.json({
        value: {
          connected: true,
          closed: true,
          connectionId: connection.id,
          friendName: displayName(other),
        },
      });
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
      const invites = base44.asServiceRole.entities.ConnectionInvite;
      const { memoryRows, projected } = await projectedGraphFor(base44, user);
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

    if (action === "getMyNow") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const chapters = base44.asServiceRole.entities.NowChapter;
      const rows = await readWithRateLimitRetry(() =>
        chapters.filter({ owner_user_id: user.id }, "-created_at", 24)
      );

      return Response.json({
        value: {
          homeCity: stringValue(user.home_city) || stringValue(user.current_city),
          /*
           * The two standing habits every chapter is written from. They travel
           * with the account rather than the chapter that used them, because a
           * chapter is written *from* them: reading them back off one would
           * leave a person's first ever request with nothing to read.
           */
          timeWindows: timeWindowList(user.now_time_windows),
          reach: reachValue(user.now_reach),
          chapter: rows[0] ? nowChapterRecord(rows[0]) : null,
          avoidVenues: rows
            .map((row: Row) => stringValue(row.venue_name))
            .filter(Boolean),
        },
      });
    }

    if (action === "listWeeklyPackCandidates") {
      if (!trustedInternalCall(data)) return untrustedInternalCall();

      const limit = Math.min(
        Math.max(
          typeof data.limit === "number" ? Math.floor(data.limit) : 25,
          1,
        ),
        100,
      );
      const rows = await readWithRateLimitRetry(() =>
        users.list("first_seen_at", Math.max(limit * 4, 100))
      );
      const candidates = rows
        .filter((user: Row) =>
          Boolean(
            user.id &&
              (stringValue(user.home_city) ||
                stringValue(user.current_city)) &&
              validTimezone(user.timezone),
          )
        )
        .slice(0, limit)
        .map((user: Row) => ({
          ownerUserId: user.id,
          homeCity:
            stringValue(user.home_city) || stringValue(user.current_city),
          timezone: validTimezone(user.timezone),
        }));
      return Response.json({ value: { candidates } });
    }

    if (action === "getWeeklyPackGenerationSource") {
      if (!trustedInternalCall(data)) return untrustedInternalCall();

      const ownerUserId = stringValue(data.ownerUserId);
      let user: Row | undefined;
      try {
        user = ownerUserId ? await users.get(ownerUserId) : undefined;
      } catch {
        user = undefined;
      }
      if (!user) {
        return Response.json({ error: "user not found" }, { status: 404 });
      }
      const timezone = validTimezone(user.timezone);
      const homeCity =
        stringValue(user.home_city) || stringValue(user.current_city);
      if (!timezone || !homeCity) {
        return Response.json(
          { error: "weekly pack context incomplete" },
          { status: 409 },
        );
      }

      const connections = base44.asServiceRole.entities.SidequestConnection;
      const [{ memoryRows, projected }, connectionRows] = await Promise.all([
        projectedGraphFor(base44, user),
        readWithRateLimitRetry(() =>
          connections.filter(
            {
              status: "accepted",
              $or: [
                { user_a_id: user.id },
                { user_b_id: user.id },
              ],
            },
            "-created_at",
            24,
          )
        ),
      ]);
      if (memoryRows.length === 0 || projected.nodes.length < 3) {
        return Response.json(
          { error: "weekly pack graph not ready" },
          { status: 409 },
        );
      }
      const socialCandidate = await weeklySocialCandidateFor(
        base44,
        user,
        planningNodesFromProjected(projected.nodes),
        connectionRows,
      );
      return Response.json({
        value: {
          ownerUserId: user.id,
          homeCity,
          timezone,
          availableCompanies: [
            "self",
            ...(socialCandidate ? [socialCandidate.company] : []),
          ],
          ...(socialCandidate ? { socialCandidate } : {}),
          graph: {
            memoryCount: memoryRows.length,
            onboardingStep: user.onboarding_step,
            nodes: projected.nodes.map((node: Row) => graphNodeRecord(node)),
            edges: projected.edges.map(graphEdgeRecord),
          },
        },
      });
    }

    if (action === "claimWeeklyPackPreparation") {
      if (!trustedInternalCall(data)) return untrustedInternalCall();

      const ownerUserId = stringValue(data.ownerUserId);
      const weekKey = stringValue(data.weekKey);
      const timezone = validTimezone(data.timezone);
      const releaseAt = Number(data.releaseAt);
      const expiresAt = Number(data.expiresAt);
      const generationRequestId = stringValue(data.generationRequestId).slice(
        0,
        160,
      );
      const retryOnly = data.retryOnly === true;
      if (
        !ownerUserId ||
        !/^\d{4}-\d{2}-\d{2}$/.test(weekKey) ||
        !timezone ||
        !Number.isFinite(releaseAt) ||
        !Number.isFinite(expiresAt) ||
        expiresAt <= releaseAt ||
        !generationRequestId
      ) {
        return Response.json({ error: "invalid preparation" }, { status: 400 });
      }

      const packs = base44.asServiceRole.entities.WeeklyExperiencePack;
      const existing = await readWithRateLimitRetry(() =>
        packs.filter(
          { owner_user_id: ownerUserId, week_key: weekKey },
          "created_at",
          10,
        )
      );
      if (existing[0]) {
        const previous = existing[0];
        const attempts = Number(previous.attempt_count) || 1;
        if (previous.status === "failed" && attempts < 3) {
          const retried = await packs.update(previous.id, {
            status: "preparing",
            timezone,
            release_at: releaseAt,
            expires_at: expiresAt,
            design_json: "",
            research_json: "",
            research_run_ids_json: "",
            cards_json: "",
            generation_request_id: generationRequestId,
            attempt_count: attempts + 1,
            last_error: "",
            updated_at: Date.now(),
          });
          return Response.json({
            value: {
              claimed: true,
              preparation: weeklyPackPreparationRecord(retried),
            },
          });
        }
        return Response.json({
          value: {
            claimed: false,
            preparation: weeklyPackPreparationRecord(previous),
          },
        });
      }
      if (retryOnly) {
        return Response.json({
          value: { claimed: false, preparation: null },
        });
      }

      const now = Date.now();
      const created = await packs.create({
        owner_user_id: ownerUserId,
        week_key: weekKey,
        timezone,
        status: "preparing",
        release_at: releaseAt,
        expires_at: expiresAt,
        generation_request_id: generationRequestId,
        attempt_count: 1,
        revealed_card_ids: "",
        created_at: now,
        updated_at: now,
      });

      // A second cron invocation can pass the first read before either create
      // lands. Resolve that race immediately and let only the oldest claim
      // proceed to paid work.
      const claimedRows = await readWithRateLimitRetry(() =>
        packs.filter(
          { owner_user_id: ownerUserId, week_key: weekKey },
          "created_at",
          10,
        )
      );
      const winner = claimedRows[0];
      if (!winner) {
        await packs.update(created.id, {
          status: "failed",
          last_error: "preparation claim could not be confirmed",
          updated_at: Date.now(),
        });
        return Response.json(
          { error: "preparation claim could not be confirmed" },
          { status: 502 },
        );
      }
      if (winner.id !== created.id) {
        await packs.update(created.id, {
          status: "failed",
          last_error: "duplicate preparation claim",
          updated_at: Date.now(),
        });
        return Response.json({
          value: {
            claimed: false,
            preparation: weeklyPackPreparationRecord(winner),
          },
        });
      }
      return Response.json({
        value: {
          claimed: true,
          preparation: weeklyPackPreparationRecord(created),
        },
      });
    }

    if (action === "setWeeklyPackResearch") {
      if (!trustedInternalCall(data)) return untrustedInternalCall();

      const packId = stringValue(data.packId);
      const designJson = boundedJson(data.designJson, 48_000);
      const researchRunIdsJson = boundedJson(
        data.researchRunIdsJson,
        8_000,
      );
      const packs = base44.asServiceRole.entities.WeeklyExperiencePack;
      let pack: Row | undefined;
      try {
        pack = packId ? await packs.get(packId) : undefined;
      } catch {
        pack = undefined;
      }
      if (
        !pack ||
        pack.status !== "preparing" ||
        !designJson ||
        !researchRunIdsJson
      ) {
        return Response.json({ error: "invalid preparation" }, { status: 409 });
      }
      const updated = await packs.update(pack.id, {
        design_json: designJson,
        research_run_ids_json: researchRunIdsJson,
        updated_at: Date.now(),
      });
      return Response.json({
        value: { preparation: weeklyPackPreparationRecord(updated) },
      });
    }

    if (action === "listWeeklyPackPreparations") {
      if (!trustedInternalCall(data)) return untrustedInternalCall();

      const limit = Math.min(
        Math.max(
          typeof data.limit === "number" ? Math.floor(data.limit) : 10,
          1,
        ),
        50,
      );
      const packs = base44.asServiceRole.entities.WeeklyExperiencePack;
      const rows = await readWithRateLimitRetry(() =>
        packs.filter({ status: "preparing" }, "created_at", limit)
      );
      return Response.json({
        value: {
          preparations: rows
            .filter((row: Row) =>
              Boolean(row.design_json && row.research_run_ids_json)
            )
            .map(weeklyPackPreparationRecord),
        },
      });
    }

    if (action === "completeWeeklyPackPreparation") {
      if (!trustedInternalCall(data)) return untrustedInternalCall();

      const packId = stringValue(data.packId);
      const cardsJson = boundedJson(data.cardsJson, 36_000);
      const researchJson = boundedJson(data.researchJson, 48_000);
      const cards = parsedJson(cardsJson);
      const cardIds = Array.isArray(cards)
        ? cards.map((card: Row) => weeklyCardId(card?.id))
        : [];
      const packs = base44.asServiceRole.entities.WeeklyExperiencePack;
      let pack: Row | undefined;
      try {
        pack = packId ? await packs.get(packId) : undefined;
      } catch {
        pack = undefined;
      }
      if (
        !pack ||
        pack.status !== "preparing" ||
        !cardsJson ||
        !researchJson ||
        !weeklyCardsHaveConcretePeopleAndPlaces(cards) ||
        cardIds.length !== 3 ||
        WEEKLY_CARD_IDS.some((id) => !cardIds.includes(id))
      ) {
        return Response.json({ error: "invalid completion" }, { status: 409 });
      }
      const updated = await packs.update(pack.id, {
        status: "ready",
        cards_json: cardsJson,
        research_json: researchJson,
        last_error: "",
        updated_at: Date.now(),
      });
      return Response.json({ value: { pack: weeklyPackRecord(updated) } });
    }

    if (action === "failWeeklyPackPreparation") {
      if (!trustedInternalCall(data)) return untrustedInternalCall();

      const packId = stringValue(data.packId);
      const packs = base44.asServiceRole.entities.WeeklyExperiencePack;
      let pack: Row | undefined;
      try {
        pack = packId ? await packs.get(packId) : undefined;
      } catch {
        pack = undefined;
      }
      if (!pack || pack.status !== "preparing") {
        return Response.json({ error: "invalid preparation" }, { status: 409 });
      }
      const updated = await packs.update(pack.id, {
        status: "failed",
        last_error: stringValue(data.error).slice(0, 300),
        updated_at: Date.now(),
      });
      return Response.json({
        value: { preparation: weeklyPackPreparationRecord(updated) },
      });
    }

    if (action === "getMyWeeklyPack") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const timezone = validTimezone(data.timezone);
      if (timezone && timezone !== user.timezone) {
        await users.update(user.id, { timezone });
      }
      const packs = base44.asServiceRole.entities.WeeklyExperiencePack;
      const rows = await readWithRateLimitRetry(() =>
        packs.filter({ owner_user_id: user.id }, "-release_at", 1)
      );
      return Response.json({
        value: {
          pack: rows[0] ? weeklyPackRecord(rows[0]) : null,
          timezone: timezone || validTimezone(user.timezone) || "UTC",
        },
      });
    }

    if (action === "updateWeeklyPack") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const packs = base44.asServiceRole.entities.WeeklyExperiencePack;
      const packId = stringValue(data.packId);
      let pack: Row | undefined;
      try {
        pack = packId ? await packs.get(packId) : undefined;
      } catch {
        pack = undefined;
      }
      if (!pack || pack.owner_user_id !== user.id) {
        return Response.json({ error: "pack not found" }, { status: 404 });
      }

      const now = Date.now();
      if (now < Number(pack.release_at) || pack.status === "preparing") {
        return Response.json({ error: "pack is still sealed" }, { status: 409 });
      }
      if (
        now >= Number(pack.expires_at) &&
        data.transition !== "lived"
      ) {
        return Response.json({ error: "pack has expired" }, { status: 409 });
      }

      const transition = stringValue(data.transition);
      const patch: Row = { updated_at: now };
      if (transition === "reveal") {
        if (pack.status !== "ready") {
          return Response.json({ error: "pack cannot be revealed" }, { status: 409 });
        }
        const cardId = weeklyCardId(data.cardId);
        if (!cardId) {
          return Response.json({ error: "invalid card" }, { status: 400 });
        }
        patch.revealed_card_ids = Array.from(
          new Set([...weeklyCardIdList(pack.revealed_card_ids), cardId]),
        ).join(",");
      } else if (transition === "choose") {
        if (pack.status !== "ready" || pack.chosen_card_id) {
          return Response.json({ error: "a card is already chosen" }, { status: 409 });
        }
        const cardId = weeklyCardId(data.cardId);
        const cards = parsedJson(pack.cards_json);
        if (
          !cardId ||
          !Array.isArray(cards) ||
          !cards.some((card: Row) => card?.id === cardId)
        ) {
          return Response.json({ error: "invalid card" }, { status: 400 });
        }
        patch.status = "chosen";
        patch.chosen_card_id = cardId;
        patch.revealed_card_ids = Array.from(
          new Set([...weeklyCardIdList(pack.revealed_card_ids), cardId]),
        ).join(",");
      } else if (transition === "schedule") {
        if (pack.status !== "chosen" || !pack.chosen_card_id) {
          return Response.json({ error: "choose a card first" }, { status: 409 });
        }
        const scheduledFor = stringValue(data.scheduledFor);
        const latestDay = new Date(Number(pack.expires_at))
          .toISOString()
          .slice(0, 10);
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(scheduledFor) ||
          scheduledFor > latestDay
        ) {
          return Response.json({ error: "invalid date" }, { status: 400 });
        }
        patch.scheduled_for = scheduledFor;
      } else if (transition === "dismiss") {
        if (pack.status !== "ready" && pack.status !== "chosen") {
          return Response.json({ error: "pack cannot be dismissed" }, { status: 409 });
        }
        patch.status = "dismissed";
        patch.dismissed_at = now;
      } else if (transition === "lived") {
        if (pack.status !== "chosen" && pack.status !== "lived") {
          return Response.json({ error: "choose a card first" }, { status: 409 });
        }
        patch.status = "lived";
        patch.lived_at = Number(pack.lived_at) || now;
      } else {
        return Response.json({ error: "invalid transition" }, { status: 400 });
      }

      const updated = await packs.update(pack.id, patch);
      if (transition === "lived") {
        const cards = parsedJson(pack.cards_json);
        const chosen = Array.isArray(cards)
          ? cards.find((card: Row) => card?.id === pack.chosen_card_id)
          : undefined;
        const connectionId = stringValue(chosen?.companion?.connectionId);
        if (connectionId) {
          const connections =
            base44.asServiceRole.entities.SidequestConnection;
          try {
            const connection = await connections.get(connectionId);
            const belongsToViewer =
              connection.user_a_id === user.id ||
              connection.user_b_id === user.id;
            if (
              belongsToViewer &&
              connection.status === "accepted" &&
              connection.origin === "introduction" &&
              !Number(connection.met_at)
            ) {
              await connections.update(connection.id, {
                met_at: Number(pack.lived_at) || now,
                met_via_weekly_pack_id: pack.id,
              });
            }
          } catch (error) {
            console.warn("[weekly-pack] could not close first-meeting stretch", {
              packId: pack.id,
              errorName: error instanceof Error ? error.name : "UnknownError",
            });
          }
        }
      }
      return Response.json({ value: { pack: weeklyPackRecord(updated) } });
    }

    /**
     * Precomputation writes a finished, independently-reviewed pack here.
     * The internal secret is mandatory because this accepts private output for
     * another account and runs without that person's browser token.
     */
    if (action === "storeWeeklyPack") {
      if (!trustedInternalCall(data)) return untrustedInternalCall();

      const ownerUserId = stringValue(data.ownerUserId);
      const weekKey = stringValue(data.weekKey);
      const timezone = validTimezone(data.timezone);
      const releaseAt = Number(data.releaseAt);
      const expiresAt = Number(data.expiresAt);
      const cardsJson = boundedJson(data.cardsJson, 36_000);
      const designJson = boundedJson(data.designJson, 36_000);
      const researchJson = boundedJson(data.researchJson, 48_000);
      const cards = parsedJson(cardsJson);
      const cardIds = Array.isArray(cards)
        ? cards.map((card: Row) => weeklyCardId(card?.id))
        : [];
      if (
        !ownerUserId ||
        !/^\d{4}-\d{2}-\d{2}$/.test(weekKey) ||
        !timezone ||
        !Number.isFinite(releaseAt) ||
        !Number.isFinite(expiresAt) ||
        expiresAt <= releaseAt ||
        !cardsJson ||
        cardIds.length !== 3 ||
        WEEKLY_CARD_IDS.some((id) => !cardIds.includes(id))
      ) {
        return Response.json({ error: "invalid weekly pack" }, { status: 400 });
      }

      const packs = base44.asServiceRole.entities.WeeklyExperiencePack;
      const existing = await readWithRateLimitRetry(() =>
        packs.filter({ owner_user_id: ownerUserId, week_key: weekKey }, "-created_at", 1)
      );
      if (existing[0]) {
        return Response.json({
          value: { pack: weeklyPackRecord(existing[0]) },
        });
      }

      const now = Date.now();
      const created = await packs.create({
        owner_user_id: ownerUserId,
        week_key: weekKey,
        timezone,
        status: "ready",
        release_at: releaseAt,
        expires_at: expiresAt,
        cards_json: cardsJson,
        design_json: designJson || "{}",
        research_json: researchJson || "[]",
        revealed_card_ids: "",
        created_at: now,
        updated_at: now,
      });
      return Response.json({ value: { pack: weeklyPackRecord(created) } });
    }

    /**
     * When someone is usually free, and how far they will usually go.
     *
     * Separate from the city because they are answered at different moments:
     * the city is the one thing the first run insists on, and these two have
     * working defaults and are only ever corrections.
     */
    if (action === "setMyNowPreferences") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const timeWindows = timeWindowList(data.timeWindows);
      const reach = reachValue(data.reach);
      // Both or neither. Writing an undefined reach beside a good set of hours
      // would leave the account half-answered in a way nothing reading it back
      // could tell from never having been asked.
      if (timeWindows.length === 0 || !reach) {
        return Response.json(
          { error: "when you are free and how far you will go are both required" },
          { status: 400 },
        );
      }

      await users.update(user.id, {
        now_time_windows: timeWindows.join(","),
        now_reach: reach,
      });
      return Response.json({ value: { timeWindows, reach } });
    }

    if (action === "setMyHomeCity") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const homeCity = stringValue(data.homeCity).slice(0, 80);
      if (homeCity.length < 2) {
        return Response.json({ error: "home city required" }, { status: 400 });
      }

      // The normalised key is written beside the city so the introduction pool
      // can be queried on an exact match rather than scanned and compared.
      await users.update(user.id, {
        home_city: homeCity,
        home_city_key: normalizeCity(homeCity),
      });
      return Response.json({ value: { homeCity } });
    }

    /**
     * A day set aside, before there is anything to put in it. The research it
     * will be made of costs real money, so nothing is spent here — this only
     * records that the person asked, and for when.
     */
    if (action === "scheduleNowChapter") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const scheduledFor = stringValue(data.scheduledFor);
      const timeWindows = timeWindowList(data.timeWindows);
      const reach = reachValue(data.reach);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(scheduledFor) ||
        timeWindows.length === 0 ||
        !reach
      ) {
        return Response.json({ error: "invalid schedule" }, { status: 400 });
      }

      const chapters = base44.asServiceRole.entities.NowChapter;
      const rows = await readWithRateLimitRetry(() =>
        chapters.filter({ owner_user_id: user.id }, "-created_at", 1)
      );
      const latest = rows[0];
      const now = Date.now();
      const patch = {
        status: "scheduled",
        scheduled_for: scheduledFor,
        time_windows: timeWindows.join(","),
        reach,
        updated_at: now,
      };

      // Changing your mind about the day rewrites the appointment rather than
      // stacking a second one behind it.
      if (latest && latest.status === "scheduled") {
        const moved = await chapters.update(latest.id, patch);
        return Response.json({ value: { chapter: nowChapterRecord(moved) } });
      }
      if (
        latest &&
        ["researching", "proposed", "accepted"].includes(latest.status)
      ) {
        return Response.json(
          { error: "one chapter at a time", code: "NOW_CHAPTER_ACTIVE" },
          { status: 409 },
        );
      }

      const created = await chapters.create({
        owner_user_id: user.id,
        ...patch,
        created_at: now,
      });
      return Response.json({ value: { chapter: nowChapterRecord(created) } });
    }

    if (action === "createNowChapter") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const researchRunId = stringValue(data.researchRunId).slice(0, 120);
      const briefJson = boundedJson(data.briefJson, 12_000);
      if (!researchRunId || !briefJson) {
        return Response.json({ error: "invalid chapter" }, { status: 400 });
      }

      const chapters = base44.asServiceRole.entities.NowChapter;
      const rows = await readWithRateLimitRetry(() =>
        chapters.filter({ owner_user_id: user.id }, "-created_at", 1)
      );
      const latest = rows[0];
      const now = Date.now();

      /*
       * A scheduled day whose lead time has opened becomes the chapter now
       * being written, keeping the day and the windows it was set aside with.
       * It is the same appointment arriving, not a second one.
       */
      if (latest && latest.status === "scheduled") {
        const armed = await chapters.update(latest.id, {
          status: "researching",
          research_run_id: researchRunId,
          brief_json: briefJson,
          updated_at: now,
        });
        return Response.json({ value: { chapter: nowChapterRecord(armed) } });
      }

      if (
        latest &&
        ["researching", "proposed", "accepted"].includes(latest.status)
      ) {
        return Response.json(
          { error: "one chapter at a time", code: "NOW_CHAPTER_ACTIVE" },
          { status: 409 },
        );
      }

      const created = await chapters.create({
        owner_user_id: user.id,
        status: "researching",
        research_run_id: researchRunId,
        brief_json: briefJson,
        created_at: now,
        updated_at: now,
      });

      return Response.json({ value: { chapter: nowChapterRecord(created) } });
    }

    if (action === "updateNowChapter") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const chapters = base44.asServiceRole.entities.NowChapter;
      const chapterId = stringValue(data.chapterId);
      let chapter: Row | undefined;
      try {
        chapter = chapterId ? await chapters.get(chapterId) : undefined;
      } catch {
        chapter = undefined;
      }
      if (!chapter || chapter.owner_user_id !== user.id) {
        return Response.json({ error: "chapter not found" }, { status: 404 });
      }

      const nextStatus = stringValue(data.status);
      const allowed: Record<string, readonly string[]> = {
        // Calling off a day you set aside declines the chapter it would have
        // become. There is no third thing for it to be.
        scheduled: ["declined"],
        researching: ["proposed", "failed"],
        proposed: ["accepted", "declined"],
        accepted: ["lived"],
      };
      if (!(allowed[chapter.status] ?? []).includes(nextStatus)) {
        return Response.json(
          { error: "invalid chapter transition" },
          { status: 409 },
        );
      }

      const patch: Row = { status: nextStatus, updated_at: Date.now() };
      if (nextStatus === "proposed") {
        const contentJson = boundedJson(data.contentJson, 12_000);
        const evidenceJson = boundedJson(data.evidenceJson, 8_000);
        const venueName = stringValue(data.venueName).slice(0, 160);
        if (!contentJson || !venueName) {
          return Response.json({ error: "invalid proposal" }, { status: 400 });
        }
        patch.content_json = contentJson;
        patch.evidence_json = evidenceJson || "[]";
        patch.venue_name = venueName;
      }
      if (nextStatus === "accepted") {
        // A chapter that grew out of a scheduled day already has its date.
        // Saying yes may move it, but is not required to restate it.
        const scheduledFor =
          stringValue(data.scheduledFor) || stringValue(chapter.scheduled_for);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledFor)) {
          return Response.json({ error: "invalid date" }, { status: 400 });
        }
        patch.scheduled_for = scheduledFor;
      }
      if (nextStatus === "declined") {
        patch.decline_reason = stringValue(data.declineReason).slice(0, 300);
      }

      const updated = await chapters.update(chapter.id, patch);
      return Response.json({ value: { chapter: nowChapterRecord(updated) } });
    }

    if (action === "getMyTogether") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const chapters = base44.asServiceRole.entities.TogetherChapter;
      const rows = await readWithRateLimitRetry(() =>
        chapters.filter(
          {
            $or: [
              { initiator_user_id: user.id },
              { partner_user_id: user.id },
            ],
          },
          "-created_at",
          40,
        )
      );

      const visible = rows.filter((row: Row) => visibleTo(row, user.id));
      const partnerUserIdFor = (row: Row) =>
        row.initiator_user_id === user.id
          ? stringValue(row.partner_user_id)
          : stringValue(row.initiator_user_id);

      // Each partner looked up once, a few at a time. Read in sequence, a
      // person with a few chapters open waited on one round trip per chapter
      // before the tab could say anything at all.
      const partnerNames = new Map<string, string>();
      const partnerUserIds = [...new Set(visible.map(partnerUserIdFor))];
      const partnerRows = await mapWithLimit(
        partnerUserIds,
        OPEN_WORLDS_AT_ONCE,
        (partnerUserId: string) =>
          readWithRateLimitRetry(() => users.get(partnerUserId)).catch(
            () => undefined,
          ),
      );
      partnerUserIds.forEach((partnerUserId, index) => {
        partnerNames.set(partnerUserId, firstName(partnerRows[index]));
      });

      const records = visible.map((row: Row) =>
        togetherChapterRecord(row, user.id, partnerNames.get(partnerUserIdFor(row))!)
      );

      return Response.json({
        value: {
          homeCity: stringValue(user.home_city) || stringValue(user.current_city),
          chapters: records,
          avoidVenues: rows
            .map((row: Row) => stringValue(row.venue_name))
            .filter(Boolean),
        },
      });
    }

    if (action === "getPartnerPlanningGraph") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }
      if (!trustedInternalCall(data)) return untrustedInternalCall();

      const user = await ensureSidequestUser(users, viewer);
      const connection = await acceptedConnectionFor(
        base44,
        user.id,
        stringValue(data.connectionId),
      );
      if (!connection) {
        return Response.json({ error: "connection not found" }, { status: 404 });
      }

      const partnerUserId = connection.user_a_id === user.id
        ? connection.user_b_id
        : connection.user_a_id;
      let partner: Row | undefined;
      try {
        partner = await readWithRateLimitRetry(() => users.get(partnerUserId));
      } catch {
        partner = undefined;
      }
      if (!partner) {
        return Response.json({ error: "connection not found" }, { status: 404 });
      }

      return Response.json({
        value: {
          partnerUserId,
          partnerName: firstName(partner),
          graph: await planningGraphFor(base44, partner),
        },
      });
    }

    /**
     * Everything Together needs to work out what your worlds share, in one
     * call.
     *
     * It used to take one call for your connections, one for your graph, one
     * for your session, and then one more per person — each of them proving
     * who you are and finding your row again before it did any work. Opening
     * the tab cost more in round trips than in reading. Nothing here is new;
     * it is the same reads, asked once and asked together.
     *
     * Server-only for the same reason the partner graph is: it opens other
     * people's worlds. Only the shareable ground of each comes back, and the
     * caller must prove it is Chapter's own server.
     */
    if (action === "getTogetherGistSource") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }
      if (!trustedInternalCall(data)) return untrustedInternalCall();

      const user = await ensureSidequestUser(users, viewer);
      const connections = base44.asServiceRole.entities.SidequestConnection;
      const graphNodes = base44.asServiceRole.entities.ExperienceGraphNode;

      const [connectionRows, mine] = await Promise.all([
        readWithRateLimitRetry(() =>
          connections.filter(
            {
              status: "accepted",
              $or: [{ user_a_id: user.id }, { user_b_id: user.id }],
            },
            "-created_at",
            100,
          )
        ),
        planningGraphFor(base44, user),
      ]);

      const asked = typeof data.limit === "number" && Number.isFinite(data.limit)
        ? data.limit
        : 8;
      const limit = Math.min(Math.max(Math.floor(asked), 1), 24);
      const partners = await mapWithLimit(
        connectionRows.slice(0, limit),
        OPEN_WORLDS_AT_ONCE,
        async (connection: Row) => {
          const userIsFirst = connection.user_a_id === user.id;
          const partnerUserId = userIsFirst
            ? connection.user_b_id
            : connection.user_a_id;
          const nodeId = userIsFirst
            ? connection.user_a_node_id
            : connection.user_b_node_id;
          try {
            const [partner, node] = await Promise.all([
              readWithRateLimitRetry(() => users.get(partnerUserId)),
              nodeId
                ? readWithRateLimitRetry(() => graphNodes.get(nodeId)).catch(
                  () => undefined,
                )
                : Promise.resolve(undefined),
            ]);
            if (!partner) return undefined;
            return {
              connectionId: connection.id,
              // The name in the reader's own world wins, exactly as it does
              // on the connections list this replaced.
              partnerName: stringValue(node?.label) || firstName(partner),
              graph: await planningGraphFor(base44, partner),
            };
          } catch {
            // One unreachable world costs its own gist and nothing else.
            return undefined;
          }
        },
      );

      return Response.json({
        value: {
          viewerEmail: stringValue(viewer.email),
          mine,
          partners: partners.filter(Boolean),
        },
      });
    }

    if (action === "createTogetherChapter") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const connection = await acceptedConnectionFor(
        base44,
        user.id,
        stringValue(data.connectionId),
      );
      if (!connection) {
        return Response.json({ error: "connection not found" }, { status: 404 });
      }

      const researchRunId = stringValue(data.researchRunId).slice(0, 120);
      const briefJson = boundedJson(data.briefJson, 12_000);
      if (!researchRunId || !briefJson) {
        return Response.json({ error: "invalid chapter" }, { status: 400 });
      }

      const partnerUserId = connection.user_a_id === user.id
        ? connection.user_b_id
        : connection.user_a_id;
      const key = pairKey(user.id, partnerUserId);
      const chapters = base44.asServiceRole.entities.TogetherChapter;
      const pairRows = await readWithRateLimitRetry(() =>
        chapters.filter({ pair_key: key }, "-created_at", 20)
      );
      const openRow = pairRows.find((row: Row) =>
        (TOGETHER_OPEN_STATUSES as readonly string[]).includes(row.status)
      );
      if (openRow) {
        return Response.json(
          { error: "one chapter at a time", code: "TOGETHER_CHAPTER_ACTIVE" },
          { status: 409 },
        );
      }

      const now = Date.now();
      const created = await chapters.create({
        pair_key: key,
        connection_id: connection.id,
        initiator_user_id: user.id,
        partner_user_id: partnerUserId,
        status: "researching",
        research_run_id: researchRunId,
        brief_json: briefJson,
        initiator_lived: false,
        partner_lived: false,
        created_at: now,
        updated_at: now,
      });

      let partner: Row | undefined;
      try {
        partner = await readWithRateLimitRetry(() => users.get(partnerUserId));
      } catch {
        partner = undefined;
      }

      return Response.json({
        value: {
          chapter: togetherChapterRecord(created, user.id, firstName(partner)),
        },
      });
    }

    if (action === "updateTogetherChapter") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }

      const user = await ensureSidequestUser(users, viewer);
      const chapters = base44.asServiceRole.entities.TogetherChapter;
      const chapterId = stringValue(data.chapterId);
      let chapter: Row | undefined;
      try {
        chapter = chapterId ? await chapters.get(chapterId) : undefined;
      } catch {
        chapter = undefined;
      }
      const role = chapter?.initiator_user_id === user.id
        ? "initiator"
        : chapter?.partner_user_id === user.id
        ? "partner"
        : undefined;
      if (!chapter || !role) {
        return Response.json({ error: "chapter not found" }, { status: 404 });
      }

      const nextStatus = stringValue(data.status);
      const patch: Row = { updated_at: Date.now() };

      // "Lived" is the one transition both sides make, each for themselves.
      // The chapter closes only once both have said so.
      if (nextStatus === "lived") {
        if (chapter.status !== "accepted" && chapter.status !== "lived") {
          return Response.json(
            { error: "invalid chapter transition" },
            { status: 409 },
          );
        }
        const bothLived = role === "initiator"
          ? Boolean(chapter.partner_lived)
          : Boolean(chapter.initiator_lived);
        patch[role === "initiator" ? "initiator_lived" : "partner_lived"] = true;
        patch.status = bothLived ? "lived" : "accepted";
        const updated = await chapters.update(chapter.id, patch);
        return Response.json({
          value: {
            chapter: togetherChapterRecord(
              updated,
              user.id,
              stringValue(data.partnerName) || "your friend",
            ),
          },
        });
      }

      // Everything else is role-gated: the initiator reviews and sends, the
      // partner answers, and neither can act on the other's behalf.
      const allowed: Record<string, Record<string, readonly string[]>> = {
        researching: { initiator: ["draft", "failed"], partner: [] },
        draft: { initiator: ["proposed", "declined"], partner: [] },
        proposed: { initiator: ["declined"], partner: ["accepted", "declined"] },
        accepted: { initiator: [], partner: [] },
      };
      if (!(allowed[chapter.status]?.[role] ?? []).includes(nextStatus)) {
        return Response.json(
          { error: "invalid chapter transition" },
          { status: 409 },
        );
      }
      patch.status = nextStatus;

      if (nextStatus === "draft") {
        const contentJson = boundedJson(data.contentJson, 12_000);
        const evidenceJson = boundedJson(data.evidenceJson, 8_000);
        const venueName = stringValue(data.venueName).slice(0, 160);
        if (!contentJson || !venueName) {
          return Response.json({ error: "invalid proposal" }, { status: 400 });
        }
        patch.content_json = contentJson;
        patch.evidence_json = evidenceJson || "[]";
        patch.venue_name = venueName;
      }
      if (nextStatus === "proposed") {
        const proposedFor = stringValue(data.proposedFor);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(proposedFor)) {
          return Response.json({ error: "invalid date" }, { status: 400 });
        }
        patch.proposed_for = proposedFor;
      }
      if (nextStatus === "accepted") {
        const scheduledFor = stringValue(data.scheduledFor) ||
          stringValue(chapter.proposed_for);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledFor)) {
          return Response.json({ error: "invalid date" }, { status: 400 });
        }
        patch.scheduled_for = scheduledFor;
      }
      if (nextStatus === "declined") {
        patch.decline_reason = stringValue(data.declineReason).slice(0, 300);
        patch.declined_by_user_id = user.id;
      }

      const updated = await chapters.update(chapter.id, patch);
      return Response.json({
        value: {
          chapter: togetherChapterRecord(
            updated,
            user.id,
            stringValue(data.partnerName) || "your friend",
          ),
        },
      });
    }

    if (action === "getTogetherNotifyTarget") {
      const viewer = await authenticatedViewer(base44);
      if (!viewer) {
        return Response.json({ error: "authentication required" }, { status: 401 });
      }
      if (!trustedInternalCall(data)) return untrustedInternalCall();

      const user = await ensureSidequestUser(users, viewer);
      const chapters = base44.asServiceRole.entities.TogetherChapter;
      const chapterId = stringValue(data.chapterId);
      let chapter: Row | undefined;
      try {
        chapter = chapterId ? await chapters.get(chapterId) : undefined;
      } catch {
        chapter = undefined;
      }
      const role = chapter?.initiator_user_id === user.id
        ? "initiator"
        : chapter?.partner_user_id === user.id
        ? "partner"
        : undefined;
      if (!chapter || !role) {
        return Response.json({ error: "chapter not found" }, { status: 404 });
      }

      // You can only ever ask for the address of the person you just acted
      // toward, and only from Chapter's own server.
      const recipientUserId = role === "initiator"
        ? stringValue(chapter.partner_user_id)
        : stringValue(chapter.initiator_user_id);
      let recipient: Row | undefined;
      try {
        recipient = await readWithRateLimitRetry(() => users.get(recipientUserId));
      } catch {
        recipient = undefined;
      }
      if (!recipient) {
        return Response.json({ error: "chapter not found" }, { status: 404 });
      }

      return Response.json({
        value: {
          phone: stringValue(recipient.phone) || undefined,
          assignedPhone: stringValue(recipient.assigned_phone) || undefined,
          recipientName: firstName(recipient),
          senderName: firstName(user),
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
