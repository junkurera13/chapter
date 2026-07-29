# Base44 Build-Off submission draft

## Submission

- Full name: **[confirm before submitting]**
- Email: **[confirm before submitting]**
- Project title: **Chapter**
- One-line pitch: **Chapter turns private memories into an evolving graph, then opens three researched real-world experiences every Saturday—alone, with someone you know, or with someone new.**
- Surface type: **Web app with an iMessage companion**
- Live URL: https://usechapter.vercel.app
- Public GitHub repo: https://github.com/junkurera13/chapter
- Access instructions: **Open `/app`, sign in with Google, and share one unforgettable experience in the web composer; connecting an iMessage-capable phone is optional and continues the same Chapter conversation. Return to You to see the private graph. Now and Together stay locked until that first memory lands, so add it before looking for them. Open Now and set your location on the card in the corner: Chapter then prepares three independently researched experiences before Saturday, keeps them sealed until 9:00 a.m. local time, and lets you reveal all three but keep one. Together supports existing and new relationships. A named person in You can receive a private invite; acceptance creates reciprocal people nodes and enables gists and shared chapters. Separately, Chapter scans a bounded account pool and may show a first name beside one sentence made only from the strict overlap of two private worlds. Either person may send an opening message; only the recipient sees it, and accepting creates the connection and private message thread. A single-account test will not produce an introduction candidate.**
- Demo video URL: **[optional, not recorded yet]**
- Social post URL: **[required by the submission portal; add before submitting]**
- Agentic IDE used: **Codex and Claude Code**
- Base44 App ID: **6a606ec9966ada5a7874da07**

### Project write-up

**Why I built this.** Everyone is building AI for X and agents for Y, and we
still don't have the next great consumer company. I think that's because nobody
has packaged AI into something genuinely useful, beautiful, and not faintly
threatening. "1000 songs in your pocket" took a complicated device and made it
instantly obvious and wanted. That care, making beautiful things out of
technology rather than selling the technology, is the standard I build to. I
pointed it at loneliness. People are more isolated than ever, and the products
meant to fix that ask you to scroll. Chapter asks you to go somewhere. One good
meal down an alley you've never walked can become a memory, a new favourite
food, a conversation with whoever is sitting next to you. Unlikely, but you
won't know if you don't go.

**The idea.** Chapter turns your memories into an evolving graph of your life,
then creates experiences combining the familiar and the unfamiliar. That
combination is the whole product, and it is a rule rather than a mood: **the one
stretch**. Every proposal keeps your world familiar along every dimension except
exactly one, and that one (place, activity, time, or person) reaches into the
unknown. Two stretches is a stranger doing a strange thing somewhere strange, and nobody
goes. Zero stretches is Tuesday. The weekly rule lives in
`lib/weeklyPackDesign.ts`, not only in a prompt, so deterministic audits can
reject a hidden second stretch before research starts. A solo **Now** card may
stretch place, activity, or time. A first-meeting card spends its one stretch
on the person; an experience with someone already known may stretch another
dimension.

Chapter starts with lived experience instead of preference checkboxes. A
person shares one experience they will never forget on the web or in iMessage.
Chapter
extracts a careful graph against a fixed ontology
(`lib/experienceOntology.ts`): eight node categories (moment, people, place,
activity, interest, feeling, condition, pattern), eighteen typed relations,
and two axes carried on every node, polarity and familiarity. Familiarity is
what makes the one stretch computable rather than merely intended, since a
proposal can only reach into the unknown along a dimension the graph already
knows is new. Explicitly named people remain individual nodes, not a single
generic group. The private graph is then revealed in the authenticated **You**
view.

That world is then spent. **Now** takes the graph plus a home city and composes
three deliberately different lanes together: a small activity, mini adventure,
and proper adventure. Each lane gets its own Parallel research run. The pack is
audited for collisions, composed into plain invitations, and stored behind a
server-enforced local Saturday release boundary. A person may reveal all three,
keep one, and schedule it within its 21-day life. **Together** works across two
private worlds. It reduces both graphs to what is shareable, keeps only the
threads they genuinely hold in common, and says that intersection out loud as
a *gist*: one sentence, at most three threads, already true on both sides by
construction.

The gist is the whole mechanism, and it does two jobs. With someone you have
connected to, it becomes a chapter for the two of you that either person can
propose, accept, or mark lived. With someone you have not met, the same sentence
is the introduction itself. Chapter does not show a profile, photograph,
one-sided graph fact, answer state, or compatibility score. The writing model
sees only the strict shared anchors and a person token; Base44 attaches the
correct first name afterward. Either person may send an opening message, and
only its recipient sees it. Accepting creates the connection, reciprocal
people nodes, and private message thread; declining closes the offer without
reporting the response.

There is currently no opt-in screen. Eligible accounts take part by default,
and anyone may mute introductions, withdrawing every live offer involving
them. The pool and graph reads are bounded. A message request is the consent
boundary for creating a relationship inside Chapter, and a connection created
that way remains a `new-person` possibility until the pair actually live a
first meeting.

Base44 owns authenticated accounts, private image storage, phone-account
linking, source memories, Chapter conversation records, private human messages,
graph validation, connection
invitations, accepted connections, introductions between strangers, home city,
weekly experience packs, Now and Together chapters, and persistence. Thirteen
Base44 entities model that world. Chapter's durable
conversation runs as an Eve agent on Vercel, and every model call goes directly
through OpenRouter to 2026 models pinned to zero-data-retention providers:
`google/gemini-3.1-flash-lite` (falling back to `moonshotai/kimi-k2.6`) for
image-aware memory extraction, `deepseek/deepseek-v4-flash` for text
conversation, `anthropic/claude-sonnet-5` with a
`moonshotai/kimi-k2.6` fallback for weekly-pack design and review, and Kimi for
Together composition.
`sidequest-memory` preserves sources before model work and validates the
structured graph before persistence; `sidequest-message` provides idempotent
web and iMessage processing and stores the opaque Eve continuation cursor;
`sidequest-data` provides authenticated ownership, graph retrieval, single-use
invite handling, reciprocal nodes, the introduction pool scan, human messages,
weekly-pack state, and chapter records. Direct entity access is restricted by
access rules. The scan is the one action that weighs an account against
accounts it has never met, so it computes the intersection inside Base44 and
returns only an opaque candidate id plus labels the two already share: a
stranger's graph never leaves the backend.

Privacy is enforced server-side rather than by convention. The eight categories
split cleanly in two. Together reduces each graph to a shareable cut of three,
places, activities, and interests. The other five, moments, people, feelings,
conditions, and patterns, never leave the server. A gist is
narrower still: it reveals only the intersection of the two worlds, so every
sentence it produces is already true on both sides. That property lets Chapter
show a meaningful introduction without exposing one person's private evidence
to the other. Base44 may attach a first name, but the sentence itself remains
identically true read from either side. Composition of a researched Together
chapter belongs to the initiator alone, so a partner cannot see or spend a
research run they don't know exists.

Photon is deliberately narrow: it connects Apple Messages to the signed
Next.js webhook, while Base44 remains the source of truth. The product
demonstrates Google sign-in, phone linking, an iMessage memory conversation,
graph growth, a private interactive world, identity-backed connections, a
three-card researched Saturday pack in **Now**, a shared chapter in
**Together**, and a named introduction that can become a private human
conversation and a concrete first-meeting experience.

**Decisions I would defend.** Anchors come back from the model as labels, never
as ids, and every label is resolved against the real graph before it survives.
A label neither world holds is dropped, because an invitation should never claim
a memory that does not exist. Uncommonness is pushed into retrieval rather than
hoped for from a model: the anti-obvious constraints (no chains, no landmarks,
nothing that headlines a top-ten list; prove it still operates) are carried in
the research schema's own field descriptions. And when extraction encoded a
relationship as text, with "Sharing tiramisu with Halmoni" arriving as a single
label unlinked to the Halmoni node, the fix was a deterministic read-time lint
(`lib/graphRepair.ts`) that moves the relationship into structure, rather than
another round of prompt escalation.

**What I learned.** Reliable extraction was the hard part, harder than the
graph or the rendering. Getting a model to return a well-formed, evidence-linked
graph from a photo and a paragraph, consistently and in production, took the
most iterations, and the answer turned out to be structural rather than verbal:
preserve sources before any model work, validate before persistence, repair at
read time. The rest was cost-performance shopping across gateways and models,
which is why every application generation path exposes model overrides. Eve's
two conversation models remain explicit constants in `agent/agent.ts`.
I don't use Figma; I design straight into the code, hopping between Codex and
Claude Code, and I hold the commit history to the same bar as the interface.

## Backend features used

- [x] Authentication & user management
- [x] Database / entities
- [x] Backend functions (Deno)
- [x] AI / LLM integration around Base44 state (OpenRouter)
- [ ] Real-time subscriptions
- [x] File & media storage

## BaaS feedback

### What worked well or felt great to use?

The CLI made the backend slice unusually fast: declare entities, add Deno
functions, secure private uploads, and deploy without assembling separate
database, authentication, storage, and serverless-function providers.
`createClientFromRequest` plus `asServiceRole` keeps privileged validation and
persistence inside Base44, while the agent loop stays independent. Access rules
did real work once two accounts could see partial views of each other: the
shareable-cut boundary is enforced in one place instead of at every call site.

### Where did you get stuck, confused, or blocked?

The original Base44 LLM integration repeatedly failed on the production
multimodal extraction path and exposed too little provider/runtime detail to
diagnose confidently; extraction was eventually moved to a direct OpenRouter
call so the first memory never depends on the agent sandbox. The external
browser SDK's anonymous analytics initialization also made a healthy public
integration look broken by logging an authentication error. The distinction
between deployed resources and production log visibility was unclear while
testing an external Next.js frontend. Long-running work such as deep research
that outlives a single request needed polling built by hand, since there is no
first-party job or subscription primitive to lean on.

### What was missing, or what would you add?

An explicit `analytics: false` client option, a functions-only SDK entry point,
and a first-party external Next.js example covering authenticated functions,
private file handoff to an external model, CORS, server components, and route
handlers would make this workflow easier to trust. Typed entity generation,
provider/model observability, background jobs for multi-minute work, and
stronger CLI remote-state inspection would also help.

- Likelihood to keep using Base44's backend: **7 / 10**
- Contact permission for follow-up: **confirm before submitting**
- Marketing feature consent: **confirm before submitting**
