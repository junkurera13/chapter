# Weekly experience packs — product direction

> **Status: agreed product direction; offline evaluation lab and local product
> slice built, not deployed, July 28 2026.** The current Now implementation
> remains the shipped source of truth. The weekly Base44 entity and function
> changes are local only. Do not describe weekly packs, pre-generation,
> persistence, release, or card selection as live until those resources are
> explicitly deployed and the shipped-state docs say so.

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

## Why Now must change

The shipped Now asks for standing availability and travel preferences, keeps
those choices in a traditional settings sheet, and generates a chapter on
demand. Even though the UI is sparse, the underlying interaction feels like
configuring a recurring job: tell the machine when and how far, then ask it to
run.

The rebuild should replace configuration with a shared weekly ritual. A person
does not schedule generation. Saturday means a new pack is there.

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
8. A reflection after living it grows the private world and informs later
   packs.

The interaction may borrow the anticipation of opening a card pack or a game
night market, but not casino mechanics. No currencies, rarity theatre, XP,
manipulative streaks, or filler rewards.

## Pre-generation and release

Generate around Wednesday or Thursday. Use Friday to retry failed research,
replace collisions, and finish card composition. Persist the completed pack as
locked with an explicit local release boundary. Opening Now on Saturday should
read stored results, not wait on models or research.

Store an IANA timezone rather than guessing Saturday from server time. Decide
the exact local release hour before implementation. A notification may announce
the pack after release, but it must not be required to create it.

Generate only for an eligible account:

- a usable private memory graph exists;
- enough grounded evidence exists to create three honest lanes;
- a home location exists at the precision required by research;
- a timezone exists;
- the week's pack does not already exist.

Define a catch-up rule for someone who becomes eligible after the normal
generation cutoff. Do not silently give them an empty Saturday.

## Generation pipeline

### 1. Compose the pack before researching

Read the graph snapshot and recent outcomes once. Design three distinct lanes
together so diversity is intentional rather than discovered by accident.

Each lane records:

- exact grounded anchors;
- one familiar thread;
- one stretch;
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
or will feel. Let graph anchors carry the familiar side. Store the finished
cards, evidence, images, release time, expiry, and graph snapshot/version needed
for auditability.

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

The current introduction system supplies the privacy foundation:

- match within the same city;
- compute the strict intersection inside Base44;
- reveal only a sentence already true in both worlds;
- reveal no name, face, one-sided fact, answer, or compatibility score;
- create a connection only after both people say yes;
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

- **Recognition:** grounded in a real living thread.
- **Transformation:** grows from that thread without repeating it.
- **One stretch:** spends one novelty dimension only.
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

The first implementation slice is deliberately disconnected from production
data, Base44, Now routes, and the Saturday UI.

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

## Local implementation state

The local product slice adds:

- `WeeklyExperiencePack`, an admin-only Base44 entity with a private finished
  card payload, release boundary, expiry, reveal history, one chosen card,
  optional scheduled date, and lived/dismissed history;
- `getMyWeeklyPack`, which removes the entire card payload before `release_at`
  rather than relying on a visual cover in the browser;
- guarded reveal, choose, schedule, dismiss, and lived transitions;
- an internal, idempotent `storeWeeklyPack` boundary for a future pre-generation
  worker;
- `app/api/weekly-pack/route.ts` and `lib/weeklyPackClient.ts`;
- `WeeklyPackView`, covering waiting, sealed choice, card reveal, confirmation,
  chosen experience, scheduling, dismissal, and lived states;
- a development-only `/weekly-pack-preview` route. `state=locked` and
  `state=chosen` open those states directly; the default opens the choice.

The legacy Now screen remains at its normal route until the new Base44 resources
and generation worker are ready to deploy. In a signed-in local app,
`/app?view=now&pack=preview`, `pack=locked`, and `pack=chosen` mount the new
interaction in the real app shell.

The implemented state model is:

- Stored pack: `preparing | ready | chosen | lived | dismissed | failed`
- Public pack: `locked | available | chosen | lived | dismissed | expired |
  failed`
- Pack card: hidden until release, then revealed, chosen, or unchosen
- Chosen experience: available, optionally scheduled, lived, dismissed, or
  expired

This is implemented locally but not deployed. Read the Base44 SDK skill before
changing it, and do not deploy resources without explicit authorization.

## Decisions already made

- Saturday is the shared release ritual.
- Packs contain three cards.
- The person may reveal all three but keep only one.
- Cards are fully researched before release.
- Use three separate research runs initially.
- Generate several days early and keep the pack locked until Saturday.
- Design the pack as a whole before research.
- Keep experience scale separate from social composition.
- Treat human connection as a core purpose, not an optional feature.
- Do not label stranger matches as friendship or romance.
- Romance is a possible outcome, never a product promise.
- Card backs are visually identical. Format is part of the reveal.

## Open decisions

1. Exact local Saturday release time and notification time.
2. Exact chosen-experience validity window; three weeks is the starting
   hypothesis.
3. Whether expiry varies by scale.
4. How a social card participates in weekly choice while mutual consent is
   still pending.
5. The catch-up experience for users who become eligible after the generation
   cutoff.
6. How past declines, expirations, and lived reflections alter later pack
   composition.
