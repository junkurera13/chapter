/**
 * How one together-chapter is shown to one of the two people in it.
 *
 * A Together chapter is planned from two private worlds and stored once, so
 * this is the seam where a single stored row becomes two different, safe
 * views. It lives in shared/ rather than inside the function so the rules
 * below can be tested rather than trusted.
 */

// Base44 entity rows are dynamic at this SDK boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export type TogetherRole = "initiator" | "partner";

export const TOGETHER_OPEN_STATUSES = [
  "researching",
  "draft",
  "proposed",
  "accepted",
] as const;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parsedJson(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function roleFor(row: Row, viewerUserId: string): TogetherRole | undefined {
  if (row?.initiator_user_id === viewerUserId) return "initiator";
  if (row?.partner_user_id === viewerUserId) return "partner";
  return undefined;
}

/**
 * A draft exists so the initiator can look at the venue before anyone is
 * pinged. The partner is not merely shown nothing — the row never reaches
 * their device.
 */
export function visibleTo(row: Row, viewerUserId: string) {
  const role = roleFor(row, viewerUserId);
  if (!role) return false;
  return !(role === "partner" && row.status === "draft");
}

/**
 * Anchors as one reader may see them.
 *
 * An anchor can come from either world. The reader's own node id survives, so
 * their own memories light up as orbs; the other person's is dropped, so a
 * thread from the other world reads as plain words and can never be rendered
 * as a memory this reader never had.
 */
export function anchorsFor(brief: Row | undefined, role: TogetherRole) {
  if (!brief || !Array.isArray(brief.anchors)) return [];
  return brief.anchors.map((anchor: Row) => {
    const nodeId = role === "initiator"
      ? text(anchor?.initiatorNodeId)
      : text(anchor?.partnerNodeId);
    return {
      label: text(anchor?.label),
      category: text(anchor?.category) || "interest",
      ...(nodeId ? { nodeId } : {}),
    };
  });
}

export function togetherChapterRecord(
  row: Row,
  viewerUserId: string,
  partnerName: string,
) {
  const role = roleFor(row, viewerUserId) ?? "partner";
  const brief = parsedJson(row.brief_json);
  const declinedBy = text(row.declined_by_user_id);

  return {
    id: row.id,
    role,
    status: row.status,
    partnerName,
    connectionId: text(row.connection_id),
    createdAt: Number(row.created_at),
    proposedFor: text(row.proposed_for) || undefined,
    scheduledFor: text(row.scheduled_for) || undefined,
    researchRunId: text(row.research_run_id) || undefined,
    // The research objective is deliberately absent: it is written from both
    // worlds and is the one part of the brief nothing ever disclosure-checked.
    brief: brief
      ? {
        threadTitle: text(brief.threadTitle),
        anchors: anchorsFor(brief, role),
        stretch: brief.stretch,
      }
      : undefined,
    content: parsedJson(row.content_json),
    evidence: parsedJson(row.evidence_json) ?? [],
    declineReason: text(row.decline_reason) || undefined,
    declinedByRole: declinedBy
      ? (declinedBy === row.initiator_user_id ? "initiator" : "partner")
      : undefined,
    youLived: Boolean(
      role === "initiator" ? row.initiator_lived : row.partner_lived,
    ),
    theyLived: Boolean(
      role === "initiator" ? row.partner_lived : row.initiator_lived,
    ),
  };
}
