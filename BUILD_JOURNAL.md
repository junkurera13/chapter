# Chapter Build Journal

This is the human-readable history of Chapter: what changed on each workday,
the decisions behind it, and exactly where the project was left. Entries before
the August 2026 canonical rename retain the product's former Sidequest name so
the historical record stays truthful.

Add a new entry at the end of every meaningful work session. Keep the newest
entry first. Git remains the technical history; this file is the product story.

---

## July 22, 2026 — People become real only by consent

### What changed

- Added Clerk authentication to the web app and connected it to Convex with a
  dedicated `convex` JWT audience. The public landing page and invitation links
  stay public; the owned `/app` surface now checks identity beside the route and
  every Convex operation authorizes from the verified token.
- Established the difference between a **person reference** and a **person
  identity**:
  - a name such as Dad, Minho, or Sara can live privately in one person’s graph;
  - it is never matched to an account from a name, phone number, or guess;
  - only accepting a high-entropy, single-person invitation binds the reference
    to the other person’s authenticated account.
- Built connection invitations with expiry, revocation, acceptance, decline,
  self-invite protection, and idempotent acceptance.
- Made acceptance create the relationship on both sides. Together reads only
  these accepted connection records, while unaccepted people remain private and
  appear only inside the invitation composer.
- Added the minimum shared-experience memory foundation behind the same
  connection membership check. It stores no itinerary and exposes no path back
  to the retired generation system.
- Replaced the placeholder profile dot with the authenticated person’s Clerk
  control and added quiet Sidequest sign-in, sign-up, connection-composer, and
  invitation-acceptance surfaces.
- Added Convex authorization tests covering private people, mutual connection
  creation, self-invite rejection, and shared-memory isolation. The full suite
  now passes 49 tests.

### Where we left off

The identity and consent model is live on the Convex development deployment and
the local web product. The 3D You world is still a redacted authored projection;
its next data step is to read these account-owned person references and later
the rest of the live memory graph. The Clerk application still needs its human-
run production-instance promotion before these authenticated surfaces can be
deployed safely to `sdqst.fun`.

The human connection invitation is complete as infrastructure, but the magical
Sidequest experience invitation remains deliberately nonexistent. The iMessage
doorway stays receive-only until that separate product object is designed.

---

## July 22, 2026 — The invitation doorway is deliberately closed

### What changed

- Stopped the main-app phone test before any real iMessage entered the agent.
- Quarantined the production iMessage route at the signed Photon boundary. It
  verifies supported direct-message webhooks and returns successfully, but it
  cannot start an Eve session, store the content, or send a response.
- Deleted the premature experience composer, `submit_sidequest` contract,
  research and logistics tools, generation skill, weather helper, and the full
  generation evaluation suite.
- Removed the unused Parallel and Google configuration surface from the local
  agent setup. The AI Gateway check remains only as an infrastructure check.
- Replaced the experience-director prompt with an explicit no-generation
  product boundary and added regression coverage for the missing generator and
  receive-only iMessage channel.
- Deployed the receive-only boundary to the main `sdqst.fun` production project.
  A correctly signed synthetic direct-message webhook returned `200 ok` without
  entering Eve or sending an iMessage.
- Removed the retired public phone-number setting and unused Parallel keys from
  the main Vercel project. The separate Photon credentials remain for the future
  invitation doorway.

### Why

The new invitation has not been designed. An unfinished composer is still a
fallback, and a prompt is not a strong enough wall. The main product should be
incapable of producing an old itinerary or a premature replacement until the
new object, reveal, and output contract are designed together.

### Where we left off

Photon remains the main app's signed iMessage transport, but the product behind
it is intentionally silent. The next block is to design the invitation system
from first principles before reconnecting any inbound message to an AI session.

---

## July 22, 2026 — iMessage returns without the old product

### What changed

- Corrected an over-aggressive part of the cleanup: iMessage is still the first
  doorway in the new vision, so its transport capability belongs in Sidequest.
  The old product behavior does not.
- Rebuilt that doorway instead of restoring the deleted worker:
  - upgraded from the retired Spectrum package to the current, exactly pinned
    scoped Spectrum core and iMessage packages;
  - mounted Eve inside the existing Next.js app so one Vercel project can host
    the web product, agent, and webhook;
  - added a signed `POST /eve/v1/spectrum/webhook` channel with raw-body
    verification, a five-minute replay window, direct-message routing, and calm
    failure copy;
  - gave each iMessage conversation a durable Eve continuation token;
  - replies now leave through Spectrum from Eve lifecycle events.
- Added two narrow Convex transport tables and functions for stable external
  threads, transactional webhook/message deduplication, retry leases, and
  delivery status. These tables do not define the future account, memory, or
  experience graph model.
- Synced the additive function surface to the personal Convex development
  deployment for code generation and type checking. Production was untouched,
  and no existing remote records were deleted.
- Extended the agent doctrine with the actual one-message onboarding rhythm:
  receive one messy lived memory, reflect something specific, then ask when the
  person has time without exposing the machinery underneath.

### Why this is better

There is no always-on Railway or Docker worker to babysit, no legacy onboarding
state machine, and no second agent stack. Photon does one job—connect
iMessage—while Eve owns the conversation and Convex owns the small amount of
durability required at the boundary.

### Where we left off

The local foundation is built and verified. Before a real message can traverse
it, the Photon webhook must be registered against the deployed route and its
one-time signing secret must be added to both Vercel and Convex. The first live
test should be a direct text conversation; groups and attachment understanding
remain later blocks.

---

## July 22, 2026 — The old product leaves the building

### What was removed

- Deleted the complete pre-renovation product surface:
  - pixel-art phone signup and its API route;
  - public `/q/[id]` mission pages;
  - the admin quest list, mission printer, and phone-profile inspector;
  - the Spectrum iMessage and terminal workers;
  - Photon signup, IP location guessing, the Claude/OpenRouter router,
    conversation state machine, quest parsing, feedback parsing, and timezone
    helpers;
  - Railway and Docker worker deployment files;
  - old pixel components, fonts, global utilities, favicon, wordmarks, starter
    assets, and now-unused packages.
- Removed the landing page's fallback into the retired phone product. Its one
  action now opens the new web app directly.
- Removed the old phone-keyed Convex functions and schema from the local code.
  Convex remains installed as an empty foundation until authentication and
  account ownership are designed deliberately.
- No Convex deployment or data deletion was performed. Existing remote data is
  untouched and must go through an explicit migration before any future schema
  narrowing is deployed.

### What remains

- The current landing page and its original Fukuoka image.
- The blank **Now** and **Together** canvases, the finished bottom navigation,
  and the interactive **You** world.
- The shared experience ontology, graph validation, display rules, and all
  relevant tests for the You world.
- The Eve experience-composition agent, research and verification tools,
  portable Sidequest contract, and evaluation suite.
- `VISION.md`, this journal, and the implemented You-world motion plans.

### Where we left off

The repository is now a foundation for the new Sidequest rather than two
products occupying the same codebase. The next product block should begin from
the simple, magical invitation idea for **Now**, grounded in real logistics and
designed as an app experience—not a landing page or an itinerary.

---

## July 21, 2026 — The renovation begins

_The conversation began late at night and the implementation landed after
midnight, so this session is recorded under July 21._

### What changed in the vision

- We abandoned the old version of Sidequest as the product direction. Existing
  code is not sacred and can be replaced when it conflicts with the new vision.
- Sidequest is no longer conceived as a marketplace. It is an agent that helps
  create beautiful, movie-like human experiences that feel strangely meant for
  the person receiving them.
- A great Sidequest has two pillars:
  - **People:** time alone, with friends, family, or strangers who may become
    meaningful.
  - **Experiences:** a hidden balance between something familiar and something
    undiscovered.
- The balance of the known and unknown is an internal creative thesis. The
  product must never explain it to the user. The magician does not reveal the
  trick.
- The agent should learn from real memories, not from a conventional preference
  questionnaire or demographic stereotypes.
- iMessage is the initial doorway. A richer owned mobile experience can appear
  later when the experience needs more than conversation.
- The initial test is intentionally narrow: learn from one meaningful memory,
  ask when the person is free, and eventually create their first Sidequest.
- Calendar and Gmail access may later let Sidequest notice genuine openings in
  someone’s life, but those integrations are not part of the first test.
- The complete new product thesis was captured in `VISION.md`.
- The obsolete `ROADMAP.md` was deleted.

### Design direction

- The design rule is: **Airbnb’s emotional warmth and composition, Apple’s
  behavior and motion, and Sidequest’s own identity.**
- The visual tone should be warm, human, editorial, spacious, calm, and quietly
  cinematic.
- The old neon yellow, pink, green, pixel type, and scan-line visual language is
  not the new direction.
- Motion should feel direct and interruptible, with restrained springs, clear
  hierarchy, reduced-motion support, and no animation added merely as decoration.
- Airbnb is a reference, not an identity to clone. Sidequest should use properly
  licensed typography and develop its own accent color, iconography, and visual
  language.

### What was built

- Replaced the old multi-question onboarding with one invitation:

  > tell me about a real day you'd live again — the people, what happened, and
  > why it stayed. messy is good.

- The user’s raw response is saved immediately as an experience memory.
- A background job analyzes that memory while the conversation continues.
- Sidequest gives a short, specific human reflection and immediately asks:

  > when do u have a few hours free? i want to make your first sidequest.

- The person’s free-time answer is preserved in their own words for the future
  first-Sidequest composer.
- Built the first experience-graph system:
  - Nodes can represent people, places, activities, settings, emotions, motifs,
    constraints, context, and the memory itself.
  - Connections explain how those nodes relate.
  - Every node and connection keeps its evidence, confidence, and whether it is
    a fact or a hypothesis.
  - The graph prompt forbids inventions and demographic stereotypes.
  - Failed background analysis is retried and recorded instead of silently
    disappearing.
- Added separate model configuration for fast memory reflections and deeper
  background memory analysis.
- Added migration-safe support for users stranded in the old onboarding states.
- Updated the README to describe the renovated product and the new model
  configuration.

### Final block — the new landing page

- Completely replaced the old yellow-and-pink pixel landing page. The public
  entry point no longer uses the old `SDQST` logo, PixelBlast effect, scanlines,
  pixel typography, chunky shadows, or neon composition.
- Created an original photographic hero inspired by the emotional center of the
  product: three close friends cycling through a quiet seaside town near
  Fukuoka in the late-afternoon sun. The asset is stored locally at
  `app/assets/sidequest-coast.jpg`; the live page has no dependency on stock
  photography or a remote image host.
- Created a new Sidequest wordmark and path-like symbol. It is intentionally its
  own identity rather than a copy of Airbnb’s logo.
- Established the first real visual system:
  - warm ivory, ink, muted stone, and clay red
  - calm modern sans-serif typography paired with an editorial serif
  - full-bleed photography and cardless layouts
  - restrained translucent navigation and soft material depth
  - immediate press feedback, quiet entrances, scroll reveals, and complete
    reduced-motion, reduced-transparency, and increased-contrast fallbacks
- Rewrote the landing-page story around the actual product:
  - begin with one meaningful memory
  - quietly learn what gave the day its texture
  - ask for a genuine opening in the person’s life
  - deliver one experience rather than another feed of recommendations
- The primary actions open a prefilled iMessage directly when the Sidequest
  phone number is configured, with the existing signup route as the fallback.
- Updated the site title and description to match the renovated product.

### First doorway into the web app

- Preserved the founder-simplified landing page as the new source of truth and
  added a restrained secondary **Open app** action beside **Text Sidequest**.
- An initial app shell was created and immediately rejected. It was removed in
  full rather than iterated on.
- Began again from a completely blank white `/app` canvas so the web app could
  be built one explicitly approved element at a time.
- Added the first approved element: a bottom-centred **Now · You · Together**
  navigation pill. It adapts Cast's recessed groove and raised candy control
  into a quieter Sidequest material: an ink-black base and warm pearl lens.
- The lens glides between three fixed labels, responds immediately to presses,
  supports arrow, Home, and End keys, and removes positional motion when the
  person has reduced motion enabled.

### The first view of You

- Built the first visual answer to the question: **how does Sidequest see a
  person?** The You tab now opens into a full-screen, interactive 3D world made
  from the Fukuoka memory rather than a profile, settings page, or preference
  list.
- The stored development memory begins with 11 nodes and 8 learned
  relationships. Its visible projection now normalizes duplicate prose-like
  ideas into 10 life nodes plus **you**, then expresses their meaning through
  typed connections. It treats the dense Sonder references as an atmospheric
  reference, not a target for visual noise.
- Each idea is represented by an original, procedurally textured orb. People,
  places, activities, feelings, and emerging patterns have related but distinct
  materials, so the world feels tactile without needing a visible legend.
- People can click-drag to turn the world, use two-finger trackpad movement to
  cross it, pinch to move closer or farther away, and select any visible idea.
  Selecting one quiets unrelated nodes and opens a human-readable detail card
  with the actual evidence Sidequest learned from.
- Every orb can now be picked up and repositioned directly. Attached
  relationships and labels follow it live, while the empty canvas remains a
  separate navigation surface. A short movement threshold keeps a click for
  opening a memory distinct from a drag for rearranging it.
- Navigation now follows the physical trackpad gesture: two-finger movement pans
  across the canvas, pinching alone changes zoom, and clicking then dragging
  empty space turns the 3D system. On touch, one finger pans while two fingers
  turn or zoom. The small gesture hint changes between desktop and mobile
  instead of showing irrelevant trackpad instructions on a phone.
- Relationship lines were lifted above their earlier near-invisible treatment.
  Roots remain the strongest structure, while factual and inferred secondary
  connections are now clearly discoverable without turning the world into a
  dense technical graph.
- The connector hierarchy was darkened once more after it still felt too
  delicate in the complete composition. Roots, factual relationships, and
  inferred relationships all remain distinct, but none rely on near-white
  contrast to communicate subtlety.
- Added the deterministic placement foundation for a graph that grows outward.
  Newly generated orbs continue beyond their outermost connected orb, search a
  fan of nearby angles for breathing room, and use a small amount of depth so
  sibling branches feel organic rather than arranged on perfect rings. Existing
  hand-composed positions remain intact until a genuinely new orb is born.
- Added the separate visual birth that the placement foundation did not yet
  provide. Unseen node identities now reveal once in branch order: each orb
  resolves a short distance outward, its relationship draws behind it, and its
  label arrives only after the object is legible. Completed identities are
  stored locally, incomplete reveals can safely replay, saved manual positions
  remain untouched, and reduced-motion renders the completed world immediately.
  This is intentionally only an identity-keyed reveal lifecycle for the current
  static graph; it does not claim that a live account graph subscription exists.
- The initial free-floating graph was then reorganized into a personal solar
  system. A presentation-only **you** pearl now sits at the centre, with three
  evidence-backed roots leading to the Fukuoka memory, close friends, and
  cycling. Smaller facts grow from those roots, while the original learned
  relationships cross-connect the branches.
- The solar metaphor stays structural rather than literal: no dark space
  background, orbit rings, stars, or category legend. The result should feel
  like a life growing outward, not a themed knowledge graph.
- The detail panel now reveals each selected orb's direct neighbours as
  miniature material orbs. Choosing one travels through the system in place:
  the panel content, selected node, highlighted orbs, and visible relationships
  all update without closing the panel. Only direct connections appear, so the
  panel remains a wayfinding tool rather than another database view.
- Orb labels are now positioned from each sphere's projected screen centre and
  apparent radius. They remain mathematically centred beneath the orb after
  panning, zooming, dragging, and changing the 3D camera angle.
- Orb labels now inherit a continuous amount of their orb's visual weight.
  Larger, more important spheres receive roomier labels while small satellite
  labels remain compact, with a legibility floor preserved when zoomed out.
- Built the first shared category ontology for both the agent and the human
  interface: **Experience, People, Place, Activity, Interest, Feeling,
  Condition, and Pattern**. Nodes now carry one stable category and a flexible
  subtype; relationships carry polarity, familiarity, strength, confidence,
  and evidence instead of relying on arbitrary verbs.
- Normalized the Fukuoka presentation around things rather than conclusions.
  **Cycling** is now one Activity orb, while its familiarity and its role in the
  island ride live in separate typed relationships. The selected-orb panel
  reveals category and subtype immediately, then shows each direct neighbour's
  category and human relationship in a compact, navigable constellation grid.
- The interface corrects the earlier cycling overstatement: it says cycling
  felt familiar, not that the person was proficient. Internal confidence scores
  and the known/unknown thesis remain hidden from the user.
- Added a shared editorial title-case rule for node names. Orb labels, inspector
  titles, and connected-node names capitalize meaningful words while keeping
  articles, conjunctions, and short prepositions quiet; intentional casing such
  as acronyms and product names is preserved.
- Replaced per-node colour choices with one restrained material palette for
  each category. The main 3D orb, selected-node portrait, and connection
  miniature now always agree; procedural texture still gives individual nodes
  subtle variation without weakening the category language.
- Replaced hand-authored orb radii with an evidence-led sizing model. New graph
  nodes carry salience separately from confidence; the renderer uses salience
  as the dominant signal, then gently reinforces strong and repeated
  relationships. Category has no size bias, hypotheses use opacity rather than
  shrinking, and **You** remains the one fixed centre.
- Compressed the non-self size ceiling after the first evidence-led pass left
  major nodes too close to the central pearl. Relative importance is unchanged,
  then reduced the complete non-self size band by a further ten percent so the
  surrounding world feels lighter and **You** has an unmistakable scale
  advantage.
- Rebuilt the internal size curve after the compressed band still made a
  defining Moment and supporting Feelings appear too similar. The continuous
  hierarchy now creates clear visual tiers—defining memory, strong anchors,
  supporting meaning, and contextual detail—without assigning any category a
  hidden size advantage.
- Gave Moment orbs a restrained eight-percent scale lift after the defining
  memory still read at roughly the same size as its supporting Place in the
  rendered scene. Evidence remains the primary sizing signal; the lift only
  clarifies which nodes are lived moments.
- Added a quiet top-left legend with the live orb count and only the categories
  present in the world. User-facing graph language now says `orbs` instead of
  the technical `nodes` used inside the data model.
- Added migration-safe optional salience storage for graph rows created before
  this model. Every new memory analysis must supply a calibrated value, while
  legacy rows receive a neutral visual fallback until they are revisited.
- Because the app does not have authentication yet, the renderer uses a local,
  redacted presentation of the real development graph. No phone number or
  unauthenticated private-memory query was added. The renderer is ready to
  accept account-scoped graph data once sign-in exists.

### The first agent brain

- Added a contained Eve pilot beside the existing app rather than replacing the
  working onboarding, iMessage, Convex, or You-world code before its taste has
  been proven.
- Wrote the first product skill, **Compose An Experience**. It privately turns
  people, emotional need, real memory anchors, a gentle opening, friction, and
  hard constraints into one composed experience. It explicitly rejects generic
  lists, demographic stereotypes, copied memory surfaces, forced three-stop
  itineraries, excessive activation energy, and invented logistics.
- Created a portable one-to-five-moment Sidequest contract. Every moment must
  fit inside the promised time window, routes must connect real moments, and
  uncertainty stays visible instead of being disguised as confidence.
- Added narrow tools with clear roles:
  - Parallel Search discovers unusual and locally specific ingredients.
  - Google Places verifies the identity, location, status, and hours of venues.
  - Google Routes verifies distance and travel time.
  - Open-Meteo checks weather that could change the experience.
- Disabled Eve's broad shell, file-write, arbitrary-fetch, provider-search, and
  self-delegation tools for this pilot. The agent cannot deploy, edit the app, or
  spawn a swarm while composing someone's day.
- Pinned Eve to version `0.26.1` because the preview is changing quickly and
  recorded the operating boundary in `docs/agent-brain.md`.
- Created five initial taste evaluations from the product thesis: the
  hardworking father, Gangnam without stereotypes, Fukuoka without copying,
  rain with mobility constraints, and the generic-list trap.
- Left the pilot deliberately disconnected from real accounts and Convex writes.
  The next block is to configure the model, Parallel, and Google credentials,
  taste live outputs together, and revise the skill before integrating it.

### Verification

- All 63 automated tests passed, including the canonical category and relation
  contract, evidence validation, deterministic outward placement,
  parent-to-child radial growth, sibling fanning around a shared orb, and the
  node-label capitalization, evidence-led orb sizing rules, and the portable
  Sidequest time and route contract.
- Eve discovered the skill and tools with zero diagnostics, built a production
  server successfully, and listed all five tasting cases.
- Lint passed with no errors. Four warnings remain in pre-existing generated
  Convex files.
- Convex code generation and TypeScript validation passed.
- The production build passed.
- The renovated landing page returned HTTP 200 with no application error or
  Next.js error overlay in headless Chrome.
- The **Open app** link was verified end-to-end from `/` to `/app`. The app now
  opens directly into the in-progress **You** world for this design phase.
- Desktop and 390px mobile compositions were visually inspected. The mobile
  page has no horizontal overflow (`scrollWidth === clientWidth === 390`).
- The bottom navigation was also verified interactively at desktop and 390px:
  all three states select correctly, keyboard navigation works, the pearl stays
  inside the groove, and reduced-motion produces a `0s` transition.
- The You world was verified in headless Chrome at 1440×900 and 390×844. Drag
  changes the 3D projection, selection reveals the correct memory detail, and
  switching away from and back to You cleanly remounts the WebGL scene.
- Individual-orb dragging was also verified at both viewport sizes: the chosen
  orb moves independently, nearby orbs remain fixed, connected lines redraw in
  place, and whole-world orbit remains available immediately after release.
- The final gesture mapping was verified independently: ordinary two-axis
  trackpad movement translates the system without changing zoom, pinching
  changes zoom, background click-drag changes the 3D projection, and direct orb
  dragging still leaves surrounding nodes fixed.
- Connected-orb navigation was verified on desktop and mobile. The central
  node exposes its three roots; travelling to **The island ride** reveals eight
  typed neighbours with their human relationships and categories. The selected
  graph state follows the panel, and the enlarged mobile sheet fits the complete
  connection grid above the navigation without internal scrolling at 390×844.
- Label alignment was visually inspected before and after a substantial 3D
  rotation; all visible labels remained centred beneath their corresponding
  spheres with no horizontal overflow or application-console errors.
- The mobile detail card stays above the navigation with a 20px gap, and both
  desktop and mobile have no horizontal overflow or application-console errors.
- The evidence-led size hierarchy was visually inspected at 1440×900 and
  390×844. **You** remains singular, meaningful nodes gain weight without
  collisions overwhelming the composition, selection still reveals all eight
  typed neighbours, and connection travel remains intact.
- Reduced-motion mode removes graph damping and inspector transitions while
  keeping orbit, selection, and content fully usable.
- The centred solar composition was visually inspected at 1440×900 and
  390×844. Its presentation root selects and drags independently, the three
  root lines follow live, empty-space orbit still works after release, the
  mobile sheet clears the navigation, and neither viewport reports application
  errors or horizontal overflow.
- The hero, primary action, internal navigation, and SMS destination render at
  both sizes. The only browser-console noise was the development hot-reload
  WebSocket under headless Chrome, not an application error.
- Dependency installation reported 22 advisories, including 6 high-severity
  advisories. No automatic potentially breaking repair was applied.

### Where we left off

- The renovated onboarding was run end-to-end with the Fukuoka cycling memory
  after explicit permission. The development graph contains 11 nodes and 8
  connections, and the test user reached `first_quest_ready` with a clearly
  marked Saturday test window.
- The test validated the central graph thesis: Sidequest identified close
  friends, cycling, the unfamiliar seaside setting, unplanned discovery,
  movement, significance, and lasting nostalgia. It also exposed evidence
  discipline problems: the reflection invented a group of three, love of
  cycling was overstated as proficiency, and some analytical language felt too
  clinical or grandiose. These should be corrected before the graph is trusted
  to compose an experience by itself.
- The first visual graph now exists in the **You** tab. The app temporarily
  opens there by default so its visual language can be judged; the finished
  product can return to opening on **Now**.
- Its current direction is a personal solar system: **you → major roots →
  memories and details → recurring cross-connections**. The development graph
  still contains 11 learned nodes and 8 learned connections; the twelfth visual
  node and its three root lines exist only to give the interface a truthful
  human centre.
- Raw source graph data can still be seen through the Convex dashboard in these
  tables:
  - `experienceMemories`
  - `experienceGraphNodes`
  - `experienceGraphEdges`
- The owned app navigation is now locked as **Now · You · Together**. The first
  version needs only **Now** and **You**; **Together** appears once safe shared
  experiences and consensual connections actually exist.
- The immediate visual block is **You**: a living, calm representation of
  meaningful memories and emerging understanding, not a corporate flowchart or
  raw database diagram. Its first 3D version is now ready for a founder taste
  pass before richer memories, clustering, or live account data are introduced.
  The **You** view still comes before the first Sidequest composer so the
  product can establish how the agent sees a person.
- The landing page now expresses the new identity, but older internal surfaces
  such as signup, quest files, and admin tools still contain parts of the legacy
  pixel system. They should be renovated only as each new product block reaches
  them; they were not silently redesigned as part of the landing-page request.
- After the **You** prototype feels truthful and beautiful, the next functional
  block is the **first Sidequest composer**. It needs enough immediate
  context—current location, who is joining, available window, and hard
  constraints—to turn the graph into one thoughtful real-world experience.
- The renovation changes are currently local and uncommitted. Nothing from this
  session was intentionally deployed to production.

---

## May 25, 2026 — First onboarding experiments

### What was built

- Added a four-beat onboarding flow with a generated cold quest, name, mirror
  question, and location capture.
- Iterated on the flow so responses felt acknowledged by the language model.
- Removed the cold quest again and settled on an introduction followed by name,
  mirror, and location questions.
- Split reflection and location into separate messages and increased model token
  limits for Kimi’s reasoning behavior.

### Where we left off

- Sidequest had a functioning but conventional question-by-question onboarding.
- This became the primary onboarding until the July renovation rejected it in
  favor of one meaningful memory dump.

---

## May 20, 2026 — A more agentic conversation engine

### What was built

- Replaced the rigid agent state machine with a language-model router and tool
  use.
- Added generated handoffs, outcome acknowledgements, and location questions.
- Added active-quest loading and hardened Anthropic content-block handling.

### Where we left off

- The agent could hold a more flexible conversation and select tools, while the
  product still revolved around the original quest-generation model.

---

## May 19, 2026 — Context and operations

### What was built

- Added quest links, admin observability, a Railway worker, and improved cards,
  signup, and admin surfaces.
- Added silent awareness of time, city, live weather, and travel context.
- Added win/loss feedback and surfaced Photon signup failures.

### Where we left off

- The original product could create and monitor quests with better real-world
  context and operational visibility.

---

## May 18, 2026 — Original MVP

### What was built

- Created the Next.js foundation and first iMessage agent.
- Built the original pixel-art landing page and its neon visual identity.
- Added quest generation, phone-number signup, account creation, and a dedicated
  signup page.

### Where we left off

- Sidequest existed as a working quest-generation MVP with a playful pixel-art
  identity and an early roadmap. Both the identity and roadmap were later
  superseded by the July renovation.
