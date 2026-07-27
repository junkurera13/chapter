# The curated places brain

## Product contract

Chapter's Now pipeline finds venues by deep research over the open web. That
finds what is *written down*. The best places often aren't: they live in a
TikTok with 400 views, or in one person's head.

The brain is Chapter's own list of those places — entered by hand, vouched for
by a human. It is **strictly additive**:

- When the brain has nothing relevant, Now behaves exactly as it does today.
  This is the normal case, and stays the normal case for a long time.
- When the brain has something relevant, it becomes a *preferred candidate* for
  the research stage — not a replacement for it.
- A curated entry is never proposed to a person without passing the same
  verification and evidence requirements as a researched one.

The list is meant to stay small and vouched-for. It is not a directory, and
growing it toward tens of thousands of rows is an anti-goal: at that size it is
a worse Google Maps, and the per-entry value that makes it worth having is gone.

## The entry schema

Base44 collection: `CuratedPlace`.

The fields exist to answer one question at selection time: *is this the right
place for this specific person's thread, right now?* A place recorded only as
name + pin cannot answer that, so most of the schema is about the moment rather
than the venue.

### Required — the seven fields you actually type

| Field | Type | Why it exists |
| --- | --- | --- |
| `name` | string | The venue, exactly as it's known locally. |
| `area` | string | `"Mangwon-dong, Seoul"` — same shape as `venue_area` in the research finding, so compose needs no translation. |
| `whatItIs` | string | One plain line. "Tiny standing-only sake bar, eight seats." |
| `whyItsGood` | string | The vouch, in concrete facts, not vibes. Feeds `why_uncommon`. This is the sentence that has to justify beating whatever research would have found. |
| `theMoment` | string | What this place is *for*. "A catch-up with someone you haven't seen in two years and need to actually hear." This is the field the selector matches against the graph thread — it does more work than every other field combined. |
| `vouchLevel` | enum | `been-myself` \| `trusted-person` \| `found-online`. Gates whether the entry may be proposed at all (see Trust). |
| `lastVerifiedAt` | timestamp | When someone last confirmed it exists and is still like this. Drives decay. |

### Optional — fill in when known

| Field | Type | Why it exists |
| --- | --- | --- |
| `avoidWhen` | string | The negative signal, and the most underrated field here. "Packed Fri/Sat", "bad for more than four people", "dead in winter". Prevents the right place at the wrong moment. |
| `bestTime` | string | Day/time reality including hours. Feeds `best_time`. |
| `stretchDimensions` | array of `place` \| `activity` \| `person` \| `time` | Which kinds of stretch this place can serve, matching `NOW_STRETCH_DIMENSIONS`. A place that is only interesting as an *activity* stretch shouldn't be offered for a *time* stretch. |
| `tags` | string[] | Loose keywords (cuisine, vibe, activity). Only needed for coarse filtering once the list outgrows one prompt. |
| `address` | string | Feeds `address`. |
| `latitude` / `longitude` | number | Reuse the existing Photon lookup in `lib/placeSearch.ts` when entering a row, so radius filtering works later without a backfill. |
| `priceNote` | string | Feeds `price_note`. |
| `source` | string | Where it came from — the TikTok URL, the person's name, "went in March". Needed to re-verify, and to audit the list later. |
| `sourceNote` | string | What the source actually claimed, verbatim-ish. Protects against your own memory drifting. |

### System-managed

| Field | Why |
| --- | --- |
| `status` | `active` \| `needs-recheck` \| `closed`. Only `active` is selectable. |
| `timesProposed` / `timesAccepted` / `timesDeclined` | Which entries actually work. The first real signal about whether curation beats research at all. |
| `addedBy`, `createdAt` | Provenance. |

Seven required fields is deliberate — it should take under a minute to add a
place, or the list never grows.

## The injection point

Today, in [app/api/now/route.ts:207](../app/api/now/route.ts#L207):

```
generateNowBrief(graph, homeCity)      → brief (thread + one stretch + researchObjective)
startParallelResearch(researchObjective) → runId
  … poll …                             → finding (NOW_RESEARCH_OUTPUT_SCHEMA)
composeNowChapter(brief, finding)      → the invitation
```

The brain goes **between stage 1 and stage 2**, because the brief is the first
point where the intent exists as text that can be matched against, and stage 2
is what enforces "real, operating, evidenced".

```
generateNowBrief(...)                  → brief
selectCuratedCandidates(brief)         → 0–3 entries   ← new, fails open to []
startParallelResearch(
  buildResearchInput(brief, candidates)               ← candidates appended here
)                                      → runId
  … unchanged from here down …
```

### Seed the research, don't skip it

The candidates are appended to Parallel's `input` as a preferred-candidates
block: *verify these first; if one genuinely fits the objective, return it;
otherwise search freely and ignore them.*

This is deliberately not the faster design (using a brain hit directly as the
finding, skipping Parallel entirely). Seeding wins because:

- The finding schema demands `still_operating_evidence`, and the UI renders
  citation links. A hand-typed row has neither. Parallel supplies both.
- It solves staleness for free — the curated place gets re-verified as still
  open at the moment it's proposed, which a stored `lastVerifiedAt` cannot do.
- It is one code path. No new failure mode, no divergent quality bar.

Skipping research for high-confidence hits is a latency optimisation to
consider *after* the feedback counters show curated picks landing better than
researched ones. Not before.

### Implementation notes

- `researchObjective` is capped at 2400 chars by `nowBriefSchema`. The candidate
  block must be appended when building Parallel's `input` in the route, **not**
  written into `researchObjective` by the brief model.
- Store the selected candidate ids on the chapter record alongside
  `researchRunId`, so accept/decline can attribute outcomes back to entries.
- Every step fails open. A Base44 timeout, a selector error, a malformed row →
  empty candidate list → today's exact behaviour. The brain must never be able
  to break generation.

## The relevance bar

The real risk with a small list is not that it's too small to help. It's that
the selector reaches for the only twelve things it has and sends someone across
the city to a place that doesn't fit, when honest research would have done
better.

So `selectCuratedCandidates` is its own small structured call whose prompt
states plainly that **returning nothing is the correct and expected answer**,
and that a place must fit the thread and the stretch — not merely the city.
It returns, per candidate, a fit reason and a score; anything below the
threshold is dropped in code rather than trusted to the model's judgment.

Keeping this as a separate stage — rather than dumping all entries into the
brief prompt — exists so there is one tunable place where the bar lives, and so
its behaviour can be tested against a fixed set of briefs.

Coarse pre-filter in code before the model sees anything: `status === "active"`,
city matches `homeCity`, name not in `avoidVenues`, not stale. At the current
size that leaves everything; at a few thousand rows, add `tags` and a radius
filter on the stored coordinates.

## Trust and decay

- `found-online` entries are **never selectable**. They are a review queue for
  a human to promote to `trusted-person` or `been-myself`. This is what a future
  discovery agent writes into — it proposes, it never publishes.
- Entries with `lastVerifiedAt` older than six months are excluded from
  selection and flipped to `needs-recheck`. A confidently wrong curated
  recommendation is worse than a generic one, because it carries Chapter's
  authority.
- `closed` is never deleted. Knowing a place is gone is worth keeping.

## Entry surface

An internal-only page, following the obscured-path pattern already in
`app/api/internal/`. A form of the seven required fields, with the area field
reusing the existing Photon type-ahead from `lib/placeSearch.ts` to capture
coordinates without typing them.

Not a public feature, and not user-submitted. The value of the list is that a
specific person with taste stands behind every row.

## Scope

**v0** — the collection, the internal entry page, `selectCuratedCandidates`,
the candidate block in the research input, fail-open everywhere.

**Later, in order** — outcome counters and the first look at whether curated
beats researched; radius/tag filtering when the prompt gets crowded; the
discovery agent writing `found-online` rows into the review queue; skipping
Parallel for high-confidence hits.
