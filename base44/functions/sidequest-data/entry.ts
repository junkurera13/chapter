import { createClientFromRequest } from "npm:@base44/sdk";

// Base44 entity rows are dynamic at this SDK boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function questRecord(row: Row) {
  return {
    shortId: row.short_id,
    request: row.request,
    phone: row.phone,
    initialRequest: row.initial_request,
    followupAnswer: row.followup_answer,
    source: row.source,
    title: row.title,
    brief: row.brief,
    stops: (row.stops ?? []).map((stop: Row) => ({
      name: stop.name,
      description: stop.description,
      mapSearch: stop.map_search,
      estimatedCost: stop.estimated_cost,
    })),
    budget: row.budget,
    inviteText: row.invite_text,
    backup: row.backup,
    createdAt: row.created_at,
    outcome: row.outcome,
    outcomeAt: row.outcome_at,
  };
}

function userProfile(row: Row | undefined) {
  if (!row) return null;
  return {
    phone: row.phone,
    firstSeenAt: row.first_seen_at,
    state: row.state,
    pendingRequest: row.pending_request,
    country: row.country,
    name: row.name,
    homeCity: row.home_city,
    currentCity: row.current_city,
    onVacation: row.on_vacation,
    notes: row.notes,
    memoryUpdatedAt: row.memory_updated_at,
    signedUpAt: row.signed_up_at,
    assignedPhone: row.assigned_phone,
    firstSidequestWindowText: row.first_sidequest_window_text,
    latitude: row.latitude,
    longitude: row.longitude,
    onboardingStep: row.onboarding_step,
    mirrorAnswers: (row.mirror_answers ?? []).map((answer: Row) => ({
      question: answer.question,
      answer: answer.answer,
      askedAt: answer.asked_at,
    })),
  };
}

function boundedLimit(value: unknown, fallback = 50) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(Math.max(Math.floor(number), 1), 100);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const data = (await req.json()) as Record<string, unknown>;
    const action = data.action;
    const quests = base44.asServiceRole.entities.Quest;
    const users = base44.asServiceRole.entities.SidequestUser;

    if (action === "getQuestByShortId") {
      const shortId = typeof data.shortId === "string" ? data.shortId : "";
      const rows = await quests.filter({ short_id: shortId }, null, 1);
      return Response.json({ value: rows[0] ? questRecord(rows[0]) : null });
    }

    if (action === "listRecentQuests") {
      const rows = await quests.list("-created_at", boundedLimit(data.limit));
      return Response.json({ value: rows.map(questRecord) });
    }

    if (action === "listQuestsByPhone") {
      const phone = typeof data.phone === "string" ? data.phone : "";
      const rows = await quests.filter(
        { phone },
        "-created_at",
        boundedLimit(data.limit),
      );
      return Response.json({ value: rows.map(questRecord) });
    }

    if (action === "getUserByPhone") {
      const phone = typeof data.phone === "string" ? data.phone : "";
      const rows = await users.filter({ phone }, null, 1);
      return Response.json({ value: userProfile(rows[0]) });
    }

    if (action === "upsertUserByPhone") {
      const phone = typeof data.phone === "string" ? data.phone.trim() : "";
      if (!phone) {
        return Response.json({ error: "phone required" }, { status: 400 });
      }

      const rows = await users.filter({ phone }, null, 1);
      const existing = rows[0];
      const patch: Row = {};

      if (typeof data.country === "string" && data.country !== existing?.country) {
        patch.country = data.country;
      }
      if (typeof data.currentCity === "string" && !existing?.current_city) {
        patch.current_city = data.currentCity;
      }
      if (typeof data.latitude === "number" && existing?.latitude === undefined) {
        patch.latitude = data.latitude;
      }
      if (typeof data.longitude === "number" && existing?.longitude === undefined) {
        patch.longitude = data.longitude;
      }
      if (typeof data.assignedPhone === "string" && !existing?.assigned_phone) {
        patch.assigned_phone = data.assignedPhone;
      }
      if (typeof data.signedUpAt === "number" && !existing?.signed_up_at) {
        patch.signed_up_at = data.signedUpAt;
      }

      let saved: Row;
      if (existing) {
        if (!existing.state) patch.state = "idle";
        saved = Object.keys(patch).length
          ? await users.update(existing.id, patch)
          : existing;
      } else {
        saved = await users.create({
          phone,
          first_seen_at: Date.now(),
          state: "idle",
          onboarding_step: "needs_memory_invite",
          ...patch,
        });
      }

      const profile = userProfile(saved)!;
      return Response.json({
        value: {
          isNew: !existing,
          state: profile.state ?? "idle",
          pendingRequest: profile.pendingRequest,
          country: profile.country,
          onboardingStep: profile.onboardingStep ?? "needs_memory_invite",
          memory: {
            name: profile.name,
            homeCity: profile.homeCity,
            currentCity: profile.currentCity,
            onVacation: profile.onVacation,
            notes: profile.notes,
            country: profile.country,
            latitude: profile.latitude,
            longitude: profile.longitude,
            mirrorAnswers: profile.mirrorAnswers,
          },
        },
      });
    }

    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Base44 data request failed.";
    console.error("sidequest-data failed", error);
    return Response.json({ error: message }, { status: 500 });
  }
});
