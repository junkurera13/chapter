<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- base44-agent-start -->

This competition build uses Base44 as its backend. Before changing Base44
entities, functions, agents, authentication, or SDK calls, read
`.agents/skills/base44-sdk/SKILL.md` completely and follow its routing to the
relevant reference.

The Photon iMessage connection is part of the current product. Do not remove or
replace `app/api/imessage/`, `app/api/signup/`, `lib/photonSignup.ts`,
`lib/sidequestBot.ts`, or `lib/sidequestMessaging.ts` as legacy code without
first tracing the complete account-to-message flow.

Do not deploy Base44 resources unless the user explicitly asks for a deployment.

<!-- base44-agent-end -->

# Chapter product rules

## Experiences are the medium for human connection

Chapter is not a recommendation engine with social features attached. It uses
real-world experiences to help someone enter life, deepen existing
relationships, and meet people they do not know. Strangers may become friends;
love may emerge, but Chapter must never predict compatibility or label a match
as romantic without explicit product infrastructure for that mode.

Treat experience scale (`small`, `mini`, `proper`) and social composition
(`self`, `known-person`, `new-person`, `small-group`) as separate axes. Design
the experience before choosing a venue; research exists to make the design
true, current, and actionable.

The weekly three-card Saturday pack is the shipped production **Now**
experience. Read `docs/weekly-experience-packs.md` and
`.agents/skills/craft-chapter-experiences/SKILL.md` before changing Now,
Together experience generation, research briefs, pack formats, or experience
quality evaluation. Keep the document's remaining open decisions distinct from
the production contract.

## Privacy is enforced in code, not in prompts

Together may only ever plan from the shareable cut of a graph — places,
activities, interests. People, feelings, conditions, patterns, and raw memories
must not leave the server, and `planningGraphFrom` in `lib/togetherGeneration.ts`
is where that cut is made. A gist is narrower still: it reveals only the
intersection of two worlds, so every sentence is already true on both sides.
Widening either boundary is a product decision, never a refactor.

Composition of a Together chapter belongs to the initiator alone. A partner
polling `/api/together` must not be able to see or advance a draft.

The introduction scan may return only the strict shared anchors and an opaque
candidate ID to the trusted Next.js route. The model writes against those
anchors and a person token; Base44 attaches each reader's first name
server-side. An opening message is the consent boundary: only the recipient
sees it, and only their acceptance may create a connection, reciprocal people
nodes, and a human-message thread. A decline closes the offer without reporting
the reason or response to the sender.

## Model calls

All model calls go through OpenRouter with `data_collection: "deny"`.
Application generation model ids are overridable by environment variable; the
two Eve conversation ids currently live in `agent/agent.ts`. Do not hardcode a
new model id. Memory extraction deliberately does **not** run through Eve; it
is a direct call in `lib/memoryExtractor.ts` so the first memory never depends
on the agent sandbox. Now and Together research runs cost real money through
Parallel AI: don't add a code path that can start one without a person asking
for it.

## Docs

`README.md`, `SUBMISSION.md`, and `BUILD_JOURNAL.md` describe the product as
shipped. Files in `docs/` may be production contracts, parked designs, or
remaining plans; their status headers are authoritative. Read the header before
treating one as a description of the code.
