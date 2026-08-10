# Chapter agent

The V1 agent is a narrow product loop, not a general assistant.

## Flow

```text
Photon iMessage webhook
  → Eve durable conversation
  → trusted Chapter profile loaded from Convex
  → onboarding or one researched Andy/Marco
  → typed experience saved to Convex
  → concise iMessage reply
```

Eve's first-party Photon channel owns webhook verification, read receipts,
conversation continuity, cancellation, and outbound replies. The custom bridge
that previously duplicated those concerns has been removed.

## Identity and access

V1 is private. The channel drops every message whose exact normalized sender
handle is not listed in `CHAPTER_TEST_IMESSAGE_HANDLE`. Accepted turns receive a
server-authored Eve principal. Chapter write tools reject sessions without that
trusted iMessage principal.

The Eve runtime calls one Convex HTTP boundary with `CHAPTER_AGENT_SECRET` in
the Authorization header. Convex compares the secret before routing to internal
queries and mutations; Chapter's sensitive functions are not part of the
public Convex client API. The secret must exist in both environments and must
never be exposed through a `NEXT_PUBLIC_` variable.

The iMessage identity remains separate from Clerk web accounts in V1. Linking
them later must be explicit and consented.

## Product state

Convex stores:

- `chapterProfiles` — onboarding stage and home location;
- `chapterMemories` — original iMessage memory text;
- `chapterExperiences` — validated Andy/Marco objects and status;
- `chapterFeedback` — Save, Pass, Done, and qualitative notes.

Every write tool carries an Eve call-based idempotency key so a durable retry
does not duplicate a memory, experience, or feedback record.

The older Spectrum delivery tables remain in the schema to avoid a destructive
migration. Eve's Photon channel does not use them.

## Experience generation

The agent loads `agent/skills/chapter-experience/SKILL.md` only when an onboarded
person requests an Andy or Marco. Parallel runs three discovery lanes
concurrently: local texture, public lived/social signals, and practical
possibilities. OpenRouter composes exactly one idea from that evidence. A final
Parallel query verifies its exact logistics before the typed experience is
saved through `lib/chapter/experience.ts`. The participant action and mechanism
are defined before final venue selection; research must prove the experience
rather than collapse it into a place recommendation.

There is no candidate pool or separate taste-selection call. Parallelism is for
evidence diversity, not competing experience generation. If a key fact cannot
be verified, the agent must not save or send the experience.

## Configuration

App/Vercel runtime:

```text
NEXT_PUBLIC_CONVEX_URL
CONVEX_SITE_URL
CHAPTER_AGENT_SECRET
CHAPTER_TEST_IMESSAGE_HANDLE
PHOTON_PROJECT_ID
PHOTON_PROJECT_SECRET
PHOTON_WEBHOOK_SECRET
OPENROUTER_API_KEY
OPENROUTER_CONVERSATION_MODEL
OPENROUTER_MODEL_CONTEXT_WINDOW_TOKENS
PARALLEL_API_KEY
```

`IMESSAGE_*` and `SPECTRUM_*` remain temporary aliases for existing
environments.

Convex deployment:

```text
CHAPTER_AGENT_SECRET
```

The Photon webhook route is:

```text
POST /eve/v1/photon
```

Eve and the AI SDK are pinned exactly because both move quickly.

## Checks

```bash
npm test
npx tsc --noEmit
npm run agent:build
npm run agent:model:check
npm run agent:research:check
npm run agent:store:check
```

No real-device message should be sent until the app and Convex secrets are
configured in the same environment and the deployment is explicitly approved.
