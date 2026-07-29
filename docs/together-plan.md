# Together — shipped state and remaining plan

> **Status, July 29 2026.** Phase 1, the named introduction/message flow from
> Phase 3, and the introduction-to-weekly-pack bridge have shipped. Phases 2
> and the remaining Phase 4 loop are plans. Phase 0 was never needed as written.
> The shipped introduction differs materially from the original Phase 3
> proposal; current behaviour is recorded under that phase. Everything not
> marked shipped is historical context or a proposal, not a description of the
> code.

Together is the tab where Chapter turns shared ground into a relationship or a
chapter for two people. The weekly Now pack and Together now share the
**person axis** of Chapter's bridge principle:

- **Wing 1 — familiar person:** plan and live a chapter *with* someone you're
  already connected to.
- **Wing 2 — new person:** Chapter notices someone you have not met through the
  strict overlap of two private worlds. Either person may send an opening
  message; accepting it creates the connection and private message thread.
- **Weekly bridge:** an accepted introduction-origin connection remains
  `new-person` until a lived weekly experience records the first meeting.

This person axis is not an optional social feature. Chapter uses experiences as
the medium for human connection: to deepen existing relationships and to let
strangers meet without browsing profiles. Friendship may form and love may
emerge, but Chapter does not predict either, score compatibility, or label a
match as romantic.

The shipped Now pack treats experience scale and social composition as
separate axes, allowing a small activity, mini adventure, or proper adventure
to be lived alone, with someone known, or with someone new. See
[`weekly-experience-packs.md`](./weekly-experience-packs.md).

The weekly one-stretch contract lives in `lib/weeklyPackDesign.ts`. In a
first-meeting card it doubles as a safety principle: when the person is the
stretch, *everything else* — activity, neighbourhood, time of day — must be
maximally familiar, so all novelty budget is spent on the human.

The four-quadrant map, for the record:

| | Familiar place/activity | Unfamiliar place/activity |
|---|---|---|
| **Familiar person** | ordinary life | weekly Now or a Together chapter |
| **Unfamiliar person** | a weekly `new-person` experience after message acceptance | never (two stretches) |

## Privacy invariants (both wings)

1. Both participants' graphs may inform planning **server-side only**. Neither
   person ever sees the other's nodes, memories, or evidence.
2. The composed proposal must read as a plan, not a disclosure. Prompts forbid
   attributing a private fact to either person.
3. Before an opening message is accepted, Wing 2 may reveal a server-attached
   first name and a gist made only from the strict shared anchors. It reveals
   no face, one-sided fact, answer state, contact channel, or compatibility
   score.
4. Only the opening-message recipient sees that message. Accepting creates the
   connection, reciprocal people nodes, and private message thread; declining
   closes the offer without reporting the response to the sender.
5. Raw graph IDs and evidence never cross accounts; all cross-account reads happen in
   `sidequest-data` with `asServiceRole`, gated on an accepted
   `SidequestConnection` for planning or the bounded introduction scan for the
   strict intersection.

---

## Phase 0 — schema groundwork (small, do first) — **not built, and not needed**

`personFamiliarity` was never added. Wing 1 spends the person dimension
implicitly — the partner *is* the familiar person — so the flag carried no
information the record didn't already have. The shared types landed with Phase 1
instead of ahead of it. Revisit only if Wing 2 actually needs the split.

Encode the person-stretch split so the data model is ready before the pool is.

- `lib/nowChapterSchema.ts`: the `stretch` object gains
  `personFamiliarity?: "familiar" | "new"` (only meaningful when
  `dimension === "person"`). Existing Now briefs keep working (optional field).
- New shared types in `lib/backendTypes.ts`: `TogetherChapterRecord`,
  `TogetherIntroductionRecord` (shapes below).
- No behaviour change; ship with tests updated.

## Phase 1 — Wing 1: shared chapters with connections — **shipped**

**The shippable slice: propose → both confirm → scheduled.** Works today with
real accepted connections (the Fukuoka crew).

The entity, status machine, `sidequest-data` actions, `app/api/together/route.ts`,
and `lib/togetherGeneration.ts` landed essentially as specified below. Three
things came out differently, and the code is the authority:

- **Gists were not in this plan and are now what Together leads with.** A gist
  is the intersection of two shareable graphs, written as one sentence and
  capped at three threads, cached per thread set for twelve hours
  (`lib/togetherGists.ts`, `app/api/together/gists/route.ts`). It exists because
  a Together tab holding only a *plan something* button says nothing until
  someone spends a research run. A gist says something for free, and it is
  symmetric by construction — it reveals only labels the reader already holds,
  so it cannot disclose the partner.
- **The UI is one card per person, not a chapter rail above a people list.** A
  person with both a gist and a chapter in motion gets one card, ordered by
  what's waiting on the reader (`TogetherView.tsx`, `TogetherGistCard.tsx`,
  `TogetherFriendsCard.tsx`).
- **Composition is initiator-only, enforced server-side.** The partner polls the
  same endpoint but cannot see or advance a draft, so they cannot spend a
  research run they don't know exists. Poll cadence is 8s while a run is in
  flight, idle otherwise.

Exit criteria below are met except the full two-account live pass, which still
needs real hardware and a second Google account.

### Entity: `base44/entities/together-chapter.jsonc`

`TogetherChapter` — modeled on `NowChapter`, plus pairing:

- `pair_key` (sorted user-ID pair, same convention as `SidequestConnection`)
- `connection_id`, `initiator_user_id`, `partner_user_id`
- `status`: `researching | draft | proposed | accepted | declined | lived | failed`
- `brief_json`, `content_json`, `evidence_json`, `venue_name` (same
  serialization pattern as NowChapter)
- `proposed_for` (ISO date the initiator suggests), `scheduled_for` (the date
  the partner confirmed)
- `decline_reason`, `declined_by_user_id`
- `initiator_lived`, `partner_lived` (booleans — "lived" is per person)
- `created_at`, `updated_at`; RLS admin-only like every other entity.

### Status machine

```
initiator taps "Plan together"        → researching
research completes, composed          → draft      (only initiator sees it)
initiator reviews venue + picks date  → proposed   (partner now sees it)
partner accepts                       → accepted
partner declines / initiator retracts → declined
both mark lived                       → lived
research/composition failure          → failed
```

The `draft` step matters: the initiator sees the venue before the partner is
ever pinged, mirroring how invites work (deliberate, reviewed, personal).

### Backend: `sidequest-data` actions

- `createTogetherChapter { partnerUserId, researchRunId, briefJson }` —
  verifies an accepted connection exists for the pair; one active
  together-chapter per pair at a time (same 409 discipline as Now).
- `getMyTogether` — returns connections (existing) + all my together-chapters
  with role annotation (`initiator | partner`), partner first names resolved
  server-side.
- `updateTogetherChapter { chapterId, … }` — role-gated transitions: only the
  initiator can move draft→proposed or retract; only the partner can
  accept/decline; each participant sets only their own `*_lived` flag.

### Next.js: `app/api/together/route.ts`

Mirrors `app/api/now/route.ts` exactly: GET polls state and advances an
in-flight Parallel research run into `draft`; POST handles
`start | send | accept | decline | lived`. Reuse `startParallelResearch` /
`fetchParallelResearchResult` and the same error taxonomy
(`TOGETHER_*` codes).

### Generation: `lib/togetherGeneration.ts`

Extends the Now pipeline to two graphs:

- `generateTogetherBrief({ initiatorGraph, partnerGraph, homeCity, … })` —
  same two-stage shape as `generateNowBrief`. Prompt rules:
  - The person dimension is *spent*: the partner IS the familiar person.
    Stretch exactly one of place/activity/time, chosen so it reads as a
    stretch **for both** graphs.
  - Anchors may come from either graph; the brief must never attribute an
    anchor to a person ("planned from both your worlds, revealing neither").
  - `knownLine` speaks to what's shared; `unknownLine` names the one stretch.
- `composeTogetherChapter` — same as `composeNowChapter` plus the
  no-disclosure rule and the partner's first name in the invitation copy.
- **City rule v1:** plan in the initiator's `homeCity`. If the partner has a
  different (or no) home city, the draft card labels the city explicitly and
  the partner decides with eyes open. Meet-in-the-middle is out of scope.

### UI: `TogetherView.tsx` becomes chapters-first

- Top rail: together-chapter cards by state — *needs your answer* (partner
  view of `proposed`), *waiting on them*, *upcoming* (accepted, with date),
  *lived*. Card layout borrows NowView's proposal card (knownLine/unknownLine,
  venue, evidence links).
- People list demoted below the rail; each connected person gets a
  **"Plan something together"** action (also reachable from the person modal
  in You, where invites already live).
- Empty state changes from "invite someone" to "plan something with {name}"
  once a connection exists.
- Poll `/api/together` on the same cadence NowView polls `/api/now`; keep the
  15s client cache convention from `lib/base44Connections.ts`.

### Phase 1 exit criteria

Two real accounts: A initiates → draft → sends with a Saturday → B sees the
card, accepts → both see *upcoming* → both mark lived. Verified live against
Base44, plus vitest, ESLint, Deno typecheck, `npm run build:safe`, and a 390px
browser pass — the standing verification bar from BUILD_JOURNAL.

## Phase 2 — the memory loop + nudges

The soul of Wing 1: a shared lived chapter grows *both* private worlds.

- **Nudges over iMessage.** After `scheduled_for` passes, Chapter texts each
  participant separately: "How was Saturday with Daniel?" Requires a
  *proactive* send path through the Photon adapter (`lib/sidequestBot.ts` is
  currently reply-driven — verify the adapter supports initiated sends early;
  if not, fall back to an in-app "Tell Chapter about it" prompt on the lived
  card that deep-links into the chat).
  Trigger v1: on `getMyTogether` reads after the date (no cron), one nudge max.
- **Linked moments.** Each person's memory is extracted privately through the
  existing pipeline; the memory source carries `together_chapter_id`. The
  extraction anchor gets an edge to the partner's person node, and the
  cross-account link (same `together_chapter_id` on both moments) is queryable
  without either memory's content ever crossing accounts.
- **You-world render.** The shared moment orb and the partner's person orb are
  visibly bonded (edge or material treatment via `orbMaterial.ts` /
  `categoryAppearance.ts`). This is the screenshot moment; design it properly.

## Phase 3 — Wing 2: the introduction (new person) — **shipped**

The original proposal below was superseded by the named gist and
message-request flow now in the code. Current behaviour:

- The entity is `Introduction`.
- The pool is a bounded scan of eligible accounts rather than
  friends-of-friends or an unbounded directory. One scan examines at most 200
  accounts, opens at most 24 graphs in batches of six, and keeps at most three
  live offers.
- Taking part is currently the default; a person can mute introductions, which
  also withdraws live offers.
- Matching uses the strict intersection of shareable places, activities, and
  interests, with at least two and at most three anchors.
- The candidate scan, graph reads, concurrency, live offers, and expiry are
  bounded in `base44/shared/introductions.ts`.
- The writing model receives only those anchors and a `[[PERSON]]` token.
  Base44 stores both first names and attaches the correct one separately for
  each reader.
- An introduction exposes no face, one-sided fact, answer state, contact
  channel, or compatibility score. Each reader sees a named sentence already
  true in their own world.
- Either person may send one opening message. Only the recipient sees its
  contents. Accepting creates an introduction-origin connection, reciprocal
  people nodes, and a `HumanMessage` thread seeded with that opener. Declining
  closes the offer without reporting the response to the sender.
- Accepted connections can continue through in-app human messages and ordinary
  Together chapters. They do not automatically start paid research.
- For weekly generation, an introduction-origin connection remains
  `new-person` until a chosen social experience is marked lived. Base44 then
  records `met_at` and later packs treat the connection as `known-person`.

The remaining subsections in this phase are the historical proposal. Do not
implement their entity, opt-in, friends-of-friends, or automatic-chapter details
as though they describe the current system.

### Entity: `base44/entities/together-introduction.jsonc`

`TogetherIntroduction`:

- `pair_key`, `user_a_id`, `user_b_id`
- `anchor_label` (the shared thing, e.g. "cycling"), `anchor_kind`
  (`mutual_familiar | teacher_learner`), `city`
- `a_status`, `b_status`: `proposed | accepted | declined | expired`
- `revealed` (bool — flips only when both accepted), `chapter_id` (the
  TogetherChapter created on mutual accept)
- `created_at`, `expires_at` (proposals quietly expire, e.g. 7 days)

### Opt-in and pool

- Explicit per-user setting: `open_to_introductions` on `SidequestUser`
  (default **off**), set from a card in Together. Nobody is matched who
  didn't ask to be.
- **Pool v1: friends-of-friends only** — candidates share an accepted
  connection with you (walk `SidequestConnection` pair keys, two hops,
  service-role, exclude existing connections/blocks). This gives every
  introduction an implicit accountability chain. Open per-city pool is a
  later flag, not v1.
- Same `homeCity` required. Non-negotiable in v1.

### Matching

Deterministic and legible — no model in the loop for v1:

1. Candidate pairs from the pool, both opted in, same city.
2. Score anchor overlap from graph nodes/edges:
   - `teacher_learner`: one side `familiar_with` X, other `curious_about` X
     (or has X with `familiarity: "new"`). Ranked highest — the meeting has a
     natural script.
   - `mutual_familiar`: both `familiar_with` X.
3. Compare on normalized labels via `lib/experienceOntology.ts` categories
   (activities and interests only in v1 — never feelings, people, or
   conditions).
4. Run lazily at `getMyTogether` read time when opted in (no cron), cache in
   the introduction records, at most N open proposals per user (start N=1).

### Double-blind flow

```
match found → proposal card to EACH side independently:
  "Someone Chapter knows just got into cycling. A Saturday-morning ride
   on roads you know well — want Chapter to set it up?"
  (no name, no photo, no graph details — only the anchor + the frame)
both accept → revealed=true, first names exchanged,
              TogetherChapter created with stretch = person/new
either declines or expires → the other side's card quietly disappears;
                             status changes are never announced
```

### Chapter generation, person-stretch mode

`generateTogetherBrief` gains `mode: "introduction"`:

- `stretch = { dimension: "person", personFamiliarity: "new" }` — and
  therefore place/activity/time must ALL be familiar (intersection of both
  graphs where possible, initiator-city common ground otherwise).
- Safety defaults hard-coded into the research objective: public venue,
  daytime window, activity-centred (side-by-side beats face-to-face for first
  meetings).
- Invitation copy carries the asymmetry when `teacher_learner`: "she just got
  into it; you know these roads."

### Safety rails (v1, all of them)

- Verified Google accounts only; first names only until both accept.
- Block: `SidequestConnection.status = "blocked"` already exists — blocking
  excludes the pair from matching forever and hides everything.
- Report action on every introduction/chapter card (writes a record, hides
  the pair, flags for manual review).
- Rate limits: one open introduction per user; declines are never surfaced;
  repeated declines of the same anchor cool that anchor down.
- No exact-location sharing beyond the proposed venue; no free-text chat
  between strangers inside Chapter v1 — coordination happens after both
  accept, over the chapter card's fixed date/time only.

### Cold start / demo honesty

Wing 2 is demo-dead without a pool. For the competition build: seed 2–3 real
secondary accounts (friends-of-friends of the main account) with genuine
mini-graphs, and script the cycling teacher/learner introduction end-to-end.
The BUILD_JOURNAL entry should say exactly that — seeded pool, real flow.

## Phase 4 — polish and the loop closed

- Decline recovery in Wing 1 ("Daniel can't do Saturday — want Chapter to
  find another time?") reusing the decline-reason re-brief pattern from Now.
- ~~Connect Wing 2 to a real experience and let a new person become known.~~
  **Shipped through the weekly pack:** an accepted introduction-origin
  connection is eligible for one concrete `new-person` card, and marking that
  chosen experience lived records the first meeting so later packs treat the
  person as known.
- After that first lived meeting, invite each person to preserve their own
  private memory of it so the shared event can deepen both worlds without
  crossing memory contents.
- ~~Intersection reveals ("you both love jazz bars") stay **out** until there's
  an explicit consent toggle.~~ **Superseded — shipped in Phase 1 as gists.**
  The consent problem dissolved once the reveal was restricted to the strict
  intersection: a label the reader already holds in their own world is not the
  partner's to consent to, and the sentence is identically true on both sides.
  A one-sided fact still never leaves the server, so "planned from both worlds,
  revealing neither" holds for everything a gist does not cover.

## Build order and sizing

| Phase | Scope | Size | Status |
|---|---|---|---|
| 0 | Schema groundwork | S | dropped — folded into Phase 1 |
| 1 | Wing 1 shared chapters + gists | L | **shipped July 27** |
| 2 | Memory loop + nudges | M | next |
| 3 | Named gist, opening-message consent, connection, human messaging | L | **shipped July 29**, without opt-in or automatic chapter |
| 4 | First-meeting weekly bridge + remaining memory loop | M | bridge shipped; memory loop planned |

Sequencing result: Phase 1 established accepted connections, gists, and shared
chapter machinery. Phase 3 then shipped as a bounded default-on pool rather
than the proposed opt-in friends-of-friends system. The remaining practical
constraint is density: without another eligible graph and at least two strict
shared anchors, no introduction can appear.

## Open decisions (decide before the phase that needs them)

1. ~~**Phase 1:** may the partner counter-propose a date?~~ **Decided:**
   accept/decline only. A counter-proposal is a decline-with-reason that
   triggers a re-send.
2. **Phase 2:** if Photon can't send proactively, is the in-app nudge
   acceptable for v1?
3. ~~**Phase 3:** minimum graph depth before someone is matchable.~~
   **Decided:** at least two shared, shareable anchors.
4. ~~**Phase 3:** should v1 frame introductions as dating?~~ **Decided:**
   introductions stay activity-framed and relationship-undefined. Romance is a
   possible outcome, never a promise or label. An explicit dating mode would
   require age, intent, orientation, consent, blocking, reporting, and
   moderation decisions first.
