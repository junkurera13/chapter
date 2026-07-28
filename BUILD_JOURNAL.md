# Build journal

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
