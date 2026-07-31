# Weekly experience packs — production contract and remaining direction

> **Status: deployed and activated, July 29 2026.** The weekly pack is the
> production Now experience. Base44 owns preparation and release state, Vercel
> runs the guarded daily worker, and the app shell no longer contains a route
> back to the previous on-demand Now experience.
>
> **Social follow-up: deployed, July 29 2026.** A social card begins with one
> specific person from an accepted connection. Introduction-origin pairs remain
> `new-person` until a lived meeting is recorded. Their real first name is
> attached server-side after generation, while models receive only the strict
> shared anchors. Generic people and placeholder places are rejected at both
> composition and Base44 persistence boundaries.
>
> **World-first revision: implemented locally, July 29 2026; deployment
> pending.** Weekly packs now contain two world-led cards and one anchored card.
> A person's first completed memory also starts one immediate world-led
> experience instead of leaving them waiting for Saturday.

## Why Chapter exists

Chapter is not a recommendation engine with social features attached.
Experiences are the medium through which Chapter helps people enter life and
connect with other people.

The product should help someone:

- experience their own world differently;
- deepen a relationship with someone they know;
- meet someone new without browsing a profile;
- become friends through something shared;
- find love as an unpromised outcome of a real encounter.

Chapter does not match profiles. It creates the right experience for two worlds
to meet.

## Why Now changed

The previous Now asked for standing availability and travel preferences, kept
those choices in a traditional settings sheet, and generated a chapter on
demand. Even though the UI was sparse, the underlying interaction felt like
configuring a recurring job: tell the machine when and how far, then ask it to
run.

The shipped rebuild replaces that configuration with a shared weekly ritual. A
person does not schedule generation. Saturday means a new pack is there.

The ritual is retention, not first-use activation. A new person receives one
fully researched first experience as soon as their first memory has finished
processing. That experience is generated from their location, current timing,
Chapter's editorial taste, and verified local reality. The new memory is the
request to begin, not a profile the experience must imitate.

The first experience is one immediate invitation, not an early three-card pack.
It has no sealed-choice ceremony and does not replace the Saturday ritual.

## The weekly ritual

1. Chapter prepares a personalized pack several days before Saturday.
2. The pack contains three complete, independently researched experiences.
3. All three cards remain face-down and locked until the person's local
   Saturday.
4. The person flips the cards to discover both format and experience.
5. They may reveal all three and keep only one.
6. Unchosen cards disappear with the weekly pack.
7. The chosen experience remains available for a limited period, can be
   scheduled later, and may be dismissed, lived, or allowed to expire.
8. A future reflection loop may grow the private world after the experience;
   the current shipped transition records only that it was lived.

The interaction may borrow the anticipation of opening a card pack or a game
night market, but not casino mechanics. No currencies, rarity theatre, XP,
manipulative streaks, or filler rewards.

## Pre-generation and release

Generate around Wednesday or Thursday. Use Friday to retry failed research,
replace collisions, and finish card composition. Persist the completed pack as
locked with an explicit local release boundary. Opening Now on Saturday should
read stored results, not wait on models or research.

Store an IANA timezone rather than guessing Saturday from server time. The
production release boundary is 9:00 a.m. local time. A future notification may
announce the pack after release, but it is not required to create it.

Generate only for an eligible account:

- a usable private memory graph exists;
- enough grounded evidence exists for one honest anchored lane;
- a home location exists at the precision required by research;
- a timezone exists;
- the week's pack does not already exist.

The immediate first experience is the catch-up rule for someone who becomes
eligible after the normal generation cutoff. Their first full pack is still
prepared through the weekly worker.

## Generation pipeline

### 1. Compose the pack before researching

Read the current local context, graph snapshot, and recent outcomes once.
Design three distinct lanes together so diversity is intentional rather than
discovered by accident.

Every card declares an internal basis:

- `world`: starts from what is alive, timely, and worth doing around the
  person's city; uses no graph anchors;
- `graph`: transforms one strong private thread and uses only real graph
  anchors; or
- `social`: begins with one real person and only the permitted shared anchors.

A normal pack contains exactly two `world` cards and one anchored card. A real
social candidate makes their company mode eligible; it does not guarantee a
social card. The weighted company draw may still choose a solo week. When it
chooses the candidate, the anchored lane is `social`; otherwise it is `graph`.
These basis labels are internal and never appear as a settings surface.

Each lane records:

- basis and any permitted grounded anchors;
- one familiar frame;
- one primary twist and, only when earned, one supporting context;
- a scale contract;
- a social composition;
- the human action and experience mechanism;
- the practical facts research must prove;
- why it is different from the other two.

### 2. Design an experience, not a venue

Define what happens before asking where it happens. The experience may require
a venue, event, route, class, timetable, material, or several verified
waypoints, but none of those is automatically the experience.

A proposal should still make sense as an experience when its venue name is
temporarily removed.

### 3. Run three independent research tasks

Use one Parallel research run per card initially. The small additional cost is
accepted in exchange for diversity and independent evidence. Run them
concurrently. Keep model and processor ids environment-overridable and verify
current provider pricing before implementation.

### 4. Audit after research

Research can collapse different briefs into similar answers. Compare the
finished cards and rerun only a failed or colliding candidate.

Reject:

- duplicate venues or experience mechanisms;
- three versions of a restaurant, class, market, or scenic route;
- closed, weakly evidenced, inaccessible, or impractical findings;
- an unusual place with no designed action;
- any card that fails its format or privacy contract.

### 5. Compose and lock

Write plain invitations without claiming what the person loves, needs, misses,
or will feel. Graph and social cards may let real anchors carry their familiar
side. World cards stand on the researched action and place without invented
personalization. Store the finished cards, evidence, images, release time,
expiry, and graph snapshot/version needed for auditability.

Each finished card also receives one generated environmental image before the
pack is marked ready. The image boundary receives only the research-safe action,
environment type, broad area, route or sequence, and format atmosphere. Exact
venue names and addresses, graph anchors, familiar threads, raw memories,
people, feelings, conditions, and patterns are excluded.

The default image model is `krea/krea-2-large` through OpenRouter's dedicated
Image API with `data_collection: "deny"` and ZDR enforced. A single restrained
visual contract keeps the set coherent: environment first, clean professional
hospitality photography, natural light, crisp material detail, no identifiable
people, no readable text, and no invented documentary claim about a named
venue. Generated bytes are persisted to a non-expiring fal CDN object before
the URL enters `cards_json`. A cited venue photograph remains an outage-only
fallback so image failure cannot destroy a completed pack.

## Format system

Experience scale and social composition are different axes.

### Scale

#### Small activity

Promise: "I could actually do this soon."

- Roughly 30–90 minutes.
- One sharp action or compact ritual.
- Normally nearby, low-cost, and spontaneous.
- No complicated booking or preparation.

#### Mini adventure

Promise: "This changes the shape of an afternoon."

- Roughly 2–4 hours.
- One destination or activity, optionally with one natural supporting beat.
- Moderate travel and light preparation are acceptable.
- Never pad a small activity with unrelated stops.

#### Proper adventure

Promise: "This deserves a day."

- A substantial half-day or full day.
- A coherent journey or short sequence with an arc.
- May travel beyond the city when the journey matters.
- Every dependency, route, booking, and time constraint must be verified.
- Never become a conventional itinerary or exhausting checklist.

The launch baseline is one card at each scale. This creates a commitment ladder:
approachable, meaningful, ambitious.

### Social composition

- `self`
- `known-person`
- `new-person`
- `small-group`

Choose social composition independently of scale. A mini adventure may be
solo, with a friend, or with someone new. Do not expose the internal taxonomy
as another settings panel.

A social experience must be designed around a shared task, rhythm, discovery,
or constraint. Appending "bring a friend" to an ordinary recommendation does
not make it social.

When no eligible social context exists, substitute another composition rather
than producing a dead card.

## Human connection

### Existing friends

Experiences may deepen a known relationship. When both people's graphs inform
planning, use only the shareable cut enforced by `planningGraphFrom` in
`lib/togetherGeneration.ts`: places, activities, and interests.

### Strangers

The current introduction system supplies the privacy and consent foundation:

- scan a bounded pool and open only a bounded number of candidate graphs;
- compute the strict intersection inside Base44;
- send only the shared anchors and a person token to the writing model;
- attach each reader's correct first name server-side;
- reveal no face, one-sided fact, answer state, contact channel, or
  compatibility score;
- create a connection, reciprocal people nodes, and private message thread only
  when the recipient accepts an opening message; and
- make declines silent.

A first-meeting experience must make the new person the only stretch.
Everything else should be familiar, public, bounded, activity-centred, and easy
to leave. It must remain worthwhile if no friendship forms.

Never rely on isolation, private homes, expensive commitment, physical trust,
intimate contact, or alcohol as the mechanism of connection.

### Friendship and love

Chapter creates conditions for connection and leaves the relationship
undefined. It does not label a match as friendship or romance, predict
compatibility, or promise love.

Love may emerge as a human outcome. An explicitly dating-oriented product mode
would require separate decisions and infrastructure for age, intent,
orientation, consent, blocking, reporting, and moderation.

### Small groups and current scale

Keep small-group design in the experience system now, because human connection
is core. Treat activation as density-dependent. With a single-digit user base,
stranger or group cards are opportunistic rather than guaranteed; friend-based
social experiences can work immediately.

## Quality contract

Every card must pass:

- **Honest basis:** world cards use no graph anchors; graph and social cards use
  only permitted evidence.
- **Recognition and fit:** timely local fit for a world card, or truthful
  recognition of a strong or strictly shared thread for an anchored card.
- **Transformation:** turns a current opportunity or familiar thread into an
  authored experience rather than merely naming a venue.
- **Chapter shape:** keeps one clear primary twist and allows at most one
  subordinate supporting unfamiliar context.
- **Experience mechanism:** contains a designed action, rhythm, journey,
  constraint, or shared task.
- **Story potential:** may create a quiet or vivid moment worth remembering.
- **Actionability:** current, practical, safe, and complete.
- **Restraint:** personal through evidence, never through invented meaning.

The pack must also pass:

- three meaningfully different threads;
- three meaningfully different mechanisms;
- a real commitment ladder;
- no obvious winner beside two filler cards;
- no two cards interchangeable after replacing their venue names.

The project-local skill at
`.agents/skills/craft-chapter-experiences/SKILL.md` is the working design and
evaluation contract.

## Offline evaluation lab

The evaluation lab remains deliberately disconnected from production data,
Base44, Now routes, and the Saturday UI. It predates the production worker and
continues to provide zero-cost prompt/audit modes plus explicitly gated paid
research.

- `lib/weeklyPackDesign.ts` defines the design, review, and research records;
  builds privacy-aware prompts; canonicalizes graph anchors; and applies
  deterministic pre- and post-research gates.
- `scripts/weekly-pack-fixtures.ts` supplies seven synthetic pressure tests:
  sparse graph, food-heavy graph, many weak interests, an existing friend,
  an eligible stranger, no social candidate, and research collision.
- `scripts/weekly-pack-lab.ts` exposes four explicit modes:
  `prompt`, `design`, `audit`, and `research`.
- `scripts/weekly-pack-research.ts` starts exactly one independent Parallel run
  per card. It is reachable only through `research` mode.

`prompt` and `audit` are zero-cost. `design` requires an OpenRouter key and runs
both generation and an independent rubric review. `research` refuses to run
unless the design passes deterministic gates, its saved artifact contains an
accepted review, and the person supplies `--allow-paid-research`.

An editor rejection starts a bounded revision loop. The designer receives the
full failed pack and the exact card- and pack-level critique, returns a complete
revision, passes deterministic gates again, and is reviewed from scratch.
Research remains unreachable until the final revision is accepted.
Structured design attempts retry twice per model and then fall back to the pack
fallback model. Independent review, revision, and final composition use the
same bounded fallback discipline.

Example:

```sh
npm run lab:weekly-pack -- --list-fixtures
npm run lab:weekly-pack -- --mode prompt --fixture sparse
npm run lab:weekly-pack -- --mode design --fixture food-heavy --output ./tmp/food-pack.json
npm run lab:weekly-pack -- --mode research --fixture food-heavy --design-file ./tmp/food-pack.json --allow-paid-research
```

The first live synthetic `sparse` run proved why the lab comes first: it passed
the structural audit, but the independent editor rejected two cards for hidden
second stretches and rejected an unexamined solo overnight premise. A
structurally valid pack is not automatically a good pack.

## Production implementation

The shipped product includes:

- `WeeklyExperiencePack`, an admin-only Base44 entity with a private finished
  card payload, release boundary, expiry, reveal history, one chosen card,
  optional scheduled date, and lived/dismissed history;
- `getMyWeeklyPack`, which removes the entire card payload before `release_at`
  rather than relying on a visual cover in the browser;
- guarded reveal, choose, schedule, dismiss, and lived transitions;
- internal Base44 transitions that claim one owner/week, persist the accepted
  design and three research run IDs, complete only a valid three-card pack,
  and retry a failed preparation at most three times;
- a guarded `/api/cron/weekly-packs` worker that polls existing research before
  claiming new work, designs the three choices as one composition, starts one
  independent Parallel run per card, and writes visible copy only after all
  three results pass the post-research collision audit;
- one environment-led generated image per accepted card, produced before the
  pack becomes ready and stored at a durable fal CDN URL;
- a daily 16:00 UTC Vercel schedule, compatible with the current Hobby plan.
  New work is claimed on Wednesday and Thursday in each person's recorded
  timezone; Friday claims are retries only, and later cycles continue polling
  research before release;
- `app/api/weekly-pack/route.ts` and `lib/weeklyPackClient.ts`;
- `WeeklyPackView`, covering waiting, sealed choice, card reveal, confirmation,
  chosen experience, scheduling, dismissal, and lived states;
- `FirstExperienceView` and the existing single-experience research pipeline,
  covering the immediate world-led experience after a person's first memory;
- a development-only `/weekly-pack-preview` route. `state=locked` and
  `state=chosen` open those states directly; the default opens the choice.

The signed-in Now tab opens an unfinished first experience before the weekly
surface. Once that experience is lived or declined, Now returns to the Saturday
pack. In a signed-in local app, `/app?view=now&pack=preview`, `pack=locked`, and
`pack=chosen` mount the weekly interaction in the real app shell.

The implemented state model is:

- Stored pack: `preparing | ready | chosen | lived | dismissed | failed`
- Public pack: `locked | available | chosen | lived | dismissed | expired |
  failed`
- Pack card: hidden until release, then revealed, chosen, or unchosen
- Chosen experience: available, optionally scheduled, lived, dismissed, or
  expired

The production timing contract is currently 9:00 a.m. local time on Saturday,
with an un-lived chosen experience remaining valid for 21 days. The worker
defaults to at most two new people per daily invocation and can be tuned
with `CHAPTER_WEEKLY_PACKS_PER_RUN`. Parallel receives only the research-safe
cut of each accepted design: no graph, raw memory, familiar thread, or anchor
identifier leaves the server through the research boundary.

The deployed worker supports `self`, `known-person`, and `new-person`.
`new-person` activates only for an accepted introduction-origin connection
whose pair has not yet recorded a lived meeting and that still holds enough
strict shared ground. The worker removes unavailable company modes, then uses
the equation's weights to choose among the eligible modes; solo remains more
likely. A selected real person gets exactly one social card. With no selected
person, all three cards are solo. When an
introduction-origin social card is marked lived, Base44 records the first
meeting and later treats that connection as `known-person`. `small-group`
remains inactive until local density can support it.

## Decisions already made

- Saturday is the shared release ritual.
- Packs contain three cards.
- The person may reveal all three but keep only one.
- Cards are fully researched before release.
- Use three separate research runs initially.
- Generate several days early and keep the pack locked until Saturday.
- Design the pack as a whole before research.
- Use two world-led cards and at most one anchored card.
- Treat the first completed memory as a request for one immediate world-led
  experience; never use that sparse graph as its idea source.
- Keep experience scale separate from social composition.
- Treat human connection as a core purpose, not an optional feature.
- A social experience always shows the actual person from an accepted
  connection; never `someone new`, `bring someone`, or another anonymous
  placeholder.
- Every finished experience names a concrete researched place and arrival
  address.
- Do not label stranger matches as friendship or romance.
- Romance is a possible outcome, never a product promise.
- Card backs are visually identical. Format is part of the reveal.

## Open decisions

1. Notification timing relative to the 9:00 a.m. local release.
2. Whether the 21-day expiry should vary by scale.
3. How past declines, expirations, and lived reflections alter later pack
   composition.
