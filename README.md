# Chapter

Chapter begins by learning from one experience a person will never forget.
It meets them in iMessage, turns that experience into a private graph of
people, places, activities, feelings, and patterns, and lets them explore that
growing picture in the authenticated **You** view.

This is the Base44 Backend Build-Off edition. Base44 owns authentication,
private file storage, account-to-phone linking, conversations, autobiographical
memory sources, graph validation, and persistence. Chapter itself is an Eve
agent using 2026 models directly through OpenRouter:
`moonshotai/kimi-k2.6` for multimodal memory extraction and
`deepseek/deepseek-v4-flash` for text conversations. Photon is used only as the
bridge to iMessage. Named people become distinct nodes, and a private
connection invite can link two authenticated accounts without exposing either
person’s memories.

The new **Now** experience has not been built yet. There is deliberately no
generated invitation, itinerary, or public experience page in the current
product.

## Live app

- Frontend: https://usechapter.vercel.app
- Base44 app ID: `6a606ec9966ada5a7874da07`

Open `/app` to see the authenticated product and private **You** world.

## Current product flow

```text
Google sign-in -> Base44 account + private uploads
                         |
                         v
web / iMessage <-> Next.js <-> Eve <-> OpenRouter
                         |
                         v
              Base44 conversation + memory graph

People node -> hashed private invite -> verified friend -> reciprocal nodes
                                                     |
                                                     v
                                                  Together
```

- `sidequest-data` handles authenticated session ownership, phone-account
  linking, private graph retrieval, connection invites, and reciprocal nodes.
- Eve owns the durable Chapter conversation and structured multimodal memory
  extraction. It routes image-bearing extraction sessions to Kimi K2.6 and
  text conversation sessions to DeepSeek V4 Flash through OpenRouter. The same
  Eve conversation session continues across the web and iMessage.
- `sidequest-memory` preserves text and private-image sources before extraction,
  signs short-lived image URLs, then validates and persists Eve’s result.
- `sidequest-message` deduplicates inbound messages, stores Eve’s opaque session
  cursor, and records reply delivery.
- The deployed Base44 resource IDs retain their pre-rebrand `sidequest-*`
  slugs as compatibility contracts. They are internal identifiers, not product
  branding.
- Seven Base44 entities hold accounts, messages, source memories, graph nodes,
  graph edges, connection invites, and accepted connections.
- Raw invite tokens are never persisted. Base44 stores only a SHA-256 hash,
  and an accepted token links exact user IDs rather than guessing from names.

## Local development

Requires Node.js 24, a Base44 account, an OpenRouter API key, and a
`SIDEQUEST_INTERNAL_SECRET` for Eve’s internal channel. Authenticated web memory
requests use the signed-in Base44 session; production-only phone and internal
requests still require the deployed backend’s matching compatibility secret.

```bash
npm install
npm run dev
```

Ordinary local development intentionally leaves Eve disabled. Onboarding memory
extraction calls OpenRouter directly and does not require Eve. Local Eve must
only be enabled explicitly while diagnosing or testing its sandbox runtime:

```bash
CHAPTER_ENABLE_LOCAL_EVE=1 npm run dev
```

Production builds continue to include Eve for experience planning and
messaging. For local release verification without Eve or its sandbox runtime,
use `npm run build:safe`. The local dev command uses webpack because the
Turbopack compiler is not stable with Chapter's current landing bundle.

The app defaults to the deployed competition backend. To point it at another
Base44 app:

```bash
NEXT_PUBLIC_BASE44_APP_ID=your_app_id npm run dev
```

The Photon bridge also needs its project credentials and webhook secret. Eve
reads `OPENROUTER_API_KEY` at runtime and calls OpenRouter directly. Never
commit that value.

## Verification

```bash
npm run lint
npm test
npm run build
npx eve info --json
npx eve channels list --json
```

The production pass should additionally verify Google sign-in, phone linking,
the iMessage webhook health route, one real memory turn, private graph
retrieval, a two-account connection acceptance, and mobile overflow.

See [`BUILD_JOURNAL.md`](./BUILD_JOURNAL.md) for the current build state and
[`SUBMISSION.md`](./SUBMISSION.md) for the competition draft.
