# Build journal

## July 31, 2026 — one weekly crafting path

The competition build now treats the Saturday pack as the only **Now**
experience surface:

- finishing the first memory no longer starts a separate paid experience;
- the first-experience screen, polling state, preview route, client action, and
  onboarding/location triggers were removed;
- the weekly endpoint now returns the account location alongside the pack, so
  the weekly surface no longer reads the legacy single-chapter flow;
- production weekly design and grounded final copy now default to one model,
  `openai/gpt-5.6-terra`, with deterministic repair attempts rather than an
  independent reviewer, Kimi fallback, and Luna composition pass;
- the production design and research contracts now carry the anti-roleplay,
  anti-staged-consumption, provider-level design, exact-place, and
  practical-arrival rules proven during evaluation; and
- the executable audit rejects the restaurant ordering exercise that exposed
  the original quality failure.

Verification passes with 395 tests across 52 files, ESLint, TypeScript,
`npm run build:safe`, and local browser checks of the locked and sealed weekly
states. The removed first-experience preview returns 404. These changes are
local source only; no Base44 or Vercel deployment was performed.

## July 31, 2026 — the crafting loop moves into Now

The standalone Adventure Lab and its isolated budget, feedback, API, and test
code have been removed. The product owner's account now gets a clickable orb
inside the real **Now** surface. A click creates a new stored pack immediately,
uses the production Terra design and three-run research pipeline, then opens the
ordinary sealed-card interaction. A small owner-only orb remains available
after choosing, so another full set can be made without leaving the product.

Both the Next.js route and the Base44 function enforce the account allowlist.
The Base44 function also requires the server-only internal secret before it can
return private generation material. Other accounts keep the normal Saturday
ritual and receive neither the control nor the on-demand action.

These changes are local source only; no Base44 or Vercel deployment was
performed.

## July 22, 2026 — memory-first foundation

The current competition build contains only the foundation of Chapter:

- Base44 Google authentication and private account ownership;
- in-app phone connection and Photon shared-line signup;
- the signed iMessage webhook;
- idempotent conversation storage and delivery tracking;
- one-experience onboarding and structured memory extraction;
- private experience-graph nodes and edges; and
- the interactive **You** world backed by the authenticated graph.

The **Now** experience is intentionally unimplemented. The next product step is
to design that experience from the new vision instead of inheriting any earlier
generation format.

## July 22, 2026 — people become real connections

The people layer now preserves individual identity and introduces the first
careful piece of **Together**:

- the extraction prompt requires one node per explicitly named person and
  forbids collapsing named friends into a generic group;
- the existing Fukuoka graph was migrated surgically from one Travel
  Companions node to Daniel, Samuel, Shinmog, and Aron without regenerating the
  rest of the graph;
- a people-node modal can create a private, single-use connection invite;
- Base44 stores only the SHA-256 token hash and resolves acceptance through the
  exact invite, never a name match;
- accepting creates an accepted connection, links the inviter’s existing node,
  and creates a reciprocal people node for the invitee without copying private
  memory evidence; and
- Together lists accepted people and pending invitations, while shared **Now**
  experiences remain explicitly unimplemented.

Verification passed with 46 tests, ESLint, a Next.js production build, Deno
type-checking, live Base44 graph/invite calls, and a 390px public invitation
browser pass with no console errors or horizontal overflow. A genuine second
Google account is still required to perform the final human acceptance click.

## July 27, 2026 — extraction that holds, and a world that grows

Before anything could be built on the graph, the graph had to be trustworthy:

- memory extraction moved off the Eve path onto a direct OpenRouter call, so
  the first memory a person ever gives never depends on the agent sandbox;
- extraction runs `google/gemini-3.1-flash-lite` first and falls back to
  `moonshotai/kimi-k2.6`, with per-attempt timeouts rather than one long hang;
- `graphRepair` lints stored graphs at read time. Extraction sometimes encodes
  a relationship as text — "Sharing Tiramisu Cake with Halmoni" as a single
  label, unconnected to the Halmoni node — so the repair pass links mentions to
  the person's node and trims the companion clause back out of the label;
- the mind map grows in per-memory sectors instead of scattering, and chains
  layout through people so an activity naming someone anchors to them rather
  than to the moment; and
- an immersive processing screen covers the extraction wait, orb dragging is
  responsive, and long node labels wrap.

## July 27, 2026 — Now: one chapter, actually researched

**Now** is the first thing the private world is spent on, and it is deliberately
one chapter rather than an itinerary:

- the person is asked once for a home city — typed against a proxied place
  search so a signed-out page cannot use the geocoder as an open relay — and it
  then lives quietly in the corner as a card with its place pictured;
- a brief is composed from the graph, sent to Parallel AI for deep research
  against the live web, and only then written into a single stretch of a day
  with evidence links behind it;
- research outlives the request that starts it, so the client polls; and
- a chapter can be accepted, declined, or marked lived.

`now-chapter` joined the schema as an eighth entity.

## July 27, 2026 — Together: chapters planned from two private worlds

Together stopped being a list of accepted people and became the second half of
the product, under a privacy boundary enforced server-side:

- each graph is reduced to a shareable cut — places, activities, interests.
  Feelings, people, conditions, patterns, and the memories themselves never
  leave the server;
- a chapter is planned only from what both worlds hold, researched the same way
  Now is, and moves through researching, draft, proposed, accepted, lived;
- composition belongs to the initiator alone. The partner polls the same
  endpoint but can neither see nor advance a draft, so they cannot spend a
  research run they do not know exists; and
- `together-chapter` became the ninth entity, and `experience-memory` the
  tenth.

## July 27, 2026 — gists, and an invitation that sounds like a person

The last layer says the quiet thing out loud, and the invitation flow stopped
sounding like surveillance:

- a **gist** is the one thing two worlds turn out to share, written as a
  sentence. It reveals only the intersection — labels the reader already holds —
  so the same sentence is true, and safe, on both sides. Three threads at most:
  four is a list, and a list is not a gist;
- written lines are cached per thread set for twelve hours, so a warm instance
  opens Together with no model call at all;
- one card per person, whether Chapter has a gist, a chapter in motion, or
  both — never two;
- invite links are stable and cached on the device that made them, so the link
  appears instantly instead of after a backend round trip, and a second tap of
  the share sheet no longer errors;
- the invite message is deliberately impersonal, since a greeting using a name
  the sender wrote differently would arrive as a stranger's;
- an accepted invitation now finishes after signing up rather than asking
  again, lands the new person directly in Together, tells them why they are
  being asked for a memory, and welcomes them with a dialog; and
- every background went to pure white.

Verification: 178 tests across 28 files, ESLint, and a Next.js production
build. Still outstanding — a full two-account pass through a Together chapter
on real hardware, and a recorded demo.

## July 29, 2026 — Now becomes a Saturday ritual

The on-demand settings-and-generate flow was replaced with a weekly object that
is already waiting when the person arrives:

- Chapter composes one small activity, one mini adventure, and one proper
  adventure as a single three-way choice before any research begins;
- each card receives its own Parallel run, then the finished pack is audited
  again so research cannot quietly collapse three briefs into the same venue
  or mechanism;
- the accepted pack is stored privately in Base44 and the browser receives no
  card content before 9:00 a.m. in the person's local timezone on Saturday;
- all three cards may be turned over, but only one can be kept. That experience
  remains schedulable for 21 days;
- the first social cut supports solo experiences and people already known.
  Stranger and small-group formats remain encoded but inactive until consent
  and local density can support them honestly; and
- a guarded Vercel cron runs daily at 16:00 UTC. Wednesday and Thursday create
  new packs, Friday is retries only, and every cycle polls existing work before
  spending on anything new.

The deployment added the twelfth Base44 entity, refreshed `sidequest-data`,
activated the weekly Now surface through a production feature flag, and
registered the Hobby-compatible daily schedule. Verification passed with 282
tests across 38 files, ESLint, TypeScript, local and Vercel production builds,
live Base44 internal authentication, production HTTP checks, and no Vercel
runtime errors. A signed-in human pass through the production Now tab remains
the final account-specific check.

## July 29, 2026 — every experience gets its own place

The revealed cards no longer depend on finding a coincidentally suitable image
on a researched webpage:

- each accepted experience gets one environment-led image during the existing
  pre-Saturday composition job;
- the prompt uses only the research-safe action, setting type, broad area,
  route, and format atmosphere—not private graph evidence or an exact venue
  name and address;
- Krea 2 Large runs through OpenRouter with ZDR and data collection denied;
- finished bytes move to a non-expiring fal CDN object before Base44 stores the
  card, while the old researched photograph remains an outage-only fallback;
  and
- one live 1184 × 896 sample confirmed the intended clean, naturally lit,
  professional hospitality-photography grade at $0.06.

Verification passed with 288 tests across 41 files, ESLint, TypeScript, a
production build, one real OpenRouter generation, and one real fal persistence
upload.

## July 29, 2026 — introductions become conversations

The anonymous two-yes introduction was replaced by a smaller consent boundary
that matches what the interface now shows:

- the bounded Base44 scan still computes only the strict intersection of
  shareable places, activities, and interests;
- the writing model receives those anchors and a `[[PERSON]]` token, while
  Base44 attaches the correct first name separately for each reader;
- either person may send one opening message, only its recipient sees the
  message, and their acceptance creates the connection and reciprocal people
  nodes;
- the accepted opener becomes the first row in a private in-app human message
  thread, backed by the thirteenth entity, `HumanMessage`;
- a decline closes the offer without telling the sender how the recipient
  answered; and
- the pool is bounded to 200 accounts, 24 opened graphs in batches of six,
  three live offers, and a fourteen-day lifetime. It is not currently filtered
  by home city.

An accepted introduction-origin connection remains `new-person` until the pair
actually live a weekly social experience. Base44 records that first meeting on
the connection, after which later packs treat the person as known. Weekly
generation always carries the real companion record; anonymous social copy and
placeholder places are rejected again at the Base44 persistence boundary.

## July 29, 2026 — generator review and bounded retries

The production weekly generator gained a direct review surface and a stricter
failure path:

- a development-only `/experience-generator` harness runs the current graph
  through design, independent editorial review, three research results, and
  final composition without exposing an internal tool in production;
- structured design attempts retry twice per model before falling back, and the
  independent review, revision, and composition stages use the same model
  fallback;
- a Friday worker pass may reclaim a failed pack only within Base44's
  three-attempt ceiling;
- solo cards are deterministically forbidden from spending their stretch on a
  new person; and
- the chosen experience, companion treatment, card proportions, and supporting
  navigation were refined around the final weekly interaction.

Current verification: 330 tests across 48 files, ESLint, TypeScript, and
`npm run build:safe` pass. The current production Vercel deployment is ready,
and the deployed `sidequest-data` function recognizes the new human-message
action. The standalone mock-tuple inference failure in
`lib/weeklyPackImageGeneration.test.ts` was corrected, and
`npx tsc --noEmit` now passes.
