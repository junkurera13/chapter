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

## Privacy is enforced in code, not in prompts

Together may only ever plan from the shareable cut of a graph — places,
activities, interests. People, feelings, conditions, patterns, and raw memories
must not leave the server, and `planningGraphFrom` in `lib/togetherGeneration.ts`
is where that cut is made. A gist is narrower still: it reveals only the
intersection of two worlds, so every sentence is already true on both sides.
Widening either boundary is a product decision, never a refactor.

Composition of a Together chapter belongs to the initiator alone. A partner
polling `/api/together` must not be able to see or advance a draft.

## Model calls

All model calls go through OpenRouter with `data_collection: "deny"`, and every
model id is overridable by environment variable — don't hardcode a new one.
Memory extraction deliberately does **not** run through Eve; it is a direct call
in `lib/memoryExtractor.ts` so the first memory never depends on the agent
sandbox. Now and Together research runs cost real money through Parallel AI:
don't add a code path that can start one without a person asking for it.

## Docs

`README.md`, `SUBMISSION.md`, and `BUILD_JOURNAL.md` describe the product as
shipped. Files in `docs/` are plans and carry their own status headers — read
the header before treating one as a description of the code.
