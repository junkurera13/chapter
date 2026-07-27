# Chapter

Chapter begins by learning from one experience a person will never forget.
It meets them in iMessage, turns that experience into a private graph of
people, places, activities, feelings, and patterns, and lets them explore that
growing picture in the authenticated **You** view.

That private world is then used for something. **Now** writes a single
real chapter to live this weekend in the person's own city, researched
against the live web rather than generated from a list. **Together** does the
same thing for two people who have connected, planning only from what their
two worlds turn out to share.

This is the Base44 Backend Build-Off edition. Base44 owns authentication,
private file storage, account-to-phone linking, conversations, autobiographical
memory sources, graph validation, connection invites, and persistence. Named
people become distinct nodes, and a private connection invite can link two
authenticated accounts without exposing either person's memories.

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
                         |
          +--------------+---------------+
          v                              v
        Now                          Together
  home city + graph            People node -> hashed private invite
          |                    -> verified friend -> reciprocal nodes
          |                                |
          |                    opt in -> same-city pool scan
          |                    -> strict intersection -> unnamed gist
          |                    -> both say yes -> reciprocal nodes
          v                              |
  deep research (Parallel)               v
          |                    shared threads -> gist
          v                              |
   one chapter to live                   v
                              deep research -> chapter -> propose
                                             -> accept -> lived
```

## Models

Chapter calls 2026 models directly through OpenRouter, and Parallel AI for
web research. Every model choice is overridable by environment variable.

| Path | Model | Override |
| --- | --- | --- |
| Onboarding memory extraction (multimodal) | `google/gemini-3.1-flash-lite`, falling back to `moonshotai/kimi-k2.6` | `CHAPTER_MEMORY_MODEL`, `CHAPTER_MEMORY_FALLBACK_MODEL` |
| Eve conversation (web + iMessage) | `deepseek/deepseek-v4-flash` for text, `moonshotai/kimi-k2.6` for image-bearing turns | none |
| Now / Together briefs, chapters, gists | `moonshotai/kimi-k2.6`, falling back to `deepseek/deepseek-v4-flash` | `CHAPTER_NOW_MODEL`, `CHAPTER_NOW_FALLBACK_MODEL` |
| Now / Together web research | Parallel AI `core` processor | `CHAPTER_NOW_PROCESSOR` |

OpenRouter calls are pinned to zero-data-retention providers with
`data_collection: "deny"`.

## How the pieces fit

- `sidequest-data` handles authenticated session ownership, phone-account
  linking, private graph retrieval, connection invites, reciprocal nodes, home
  city, and Now/Together chapter records.
- Eve owns the durable Chapter conversation. The same Eve session continues
  across the web and iMessage. Onboarding extraction does **not** go through
  Eve. It calls OpenRouter directly so the first memory never depends on the
  agent sandbox.
- `sidequest-memory` preserves text and private-image sources before extraction,
  signs short-lived image URLs, then validates and persists the result.
- `sidequest-message` deduplicates inbound messages, stores Eve's opaque session
  cursor, and records reply delivery.
- Photon is used only as the bridge between Apple Messages and the signed
  Next.js webhook. Base44 remains the source of truth.
- The deployed Base44 resource IDs retain their pre-rebrand `sidequest-*`
  slugs as compatibility contracts. They are internal identifiers, not product
  branding.
- Eleven Base44 entities hold accounts, messages, memories, source memories,
  graph nodes, graph edges, connection invites, accepted connections,
  introductions, Now chapters, and Together chapters.
- A connection records how it began. An invite means the two people found each
  other by name; an introduction means Chapter put them together, and neither
  learned anything about the other until both said yes.
- Raw invite tokens are never persisted. Base44 stores only a SHA-256 hash,
  and an accepted token links exact user IDs rather than guessing from names.

### What Together is allowed to say

Together reduces each private graph to a shareable cut of places, activities,
and interests only. Feelings, people, conditions, patterns, and the memories
themselves never leave the server.

A **gist** is narrower still: it reveals only the intersection of the two
worlds, so every sentence is already true on both sides. Composition is the
initiator's job alone; the partner polls the same endpoint but cannot see or
advance a draft, and so cannot spend a research run they don't know exists.

An **introduction** is a gist about someone you have not met, and it carries
less again. No name, no face, no city more specific than your own, and no count
of how well you supposedly match. It does not report whether the other person
has answered, because that is a fact about them and because knowing it would
change the answer you give. Only the second yes does anything at all, and it
creates an ordinary connection with a name attached. Both people must opt in
first, and opting back out withdraws every offer already standing.

## Local development

Requires Node.js 24, a Base44 account, an OpenRouter API key, a Parallel AI key
for Now/Together research, and a `SIDEQUEST_INTERNAL_SECRET` for Eve's internal
channel. Authenticated web memory requests use the signed-in Base44 session;
production-only phone and internal requests still require the deployed
backend's matching compatibility secret.

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

Production builds continue to include Eve for messaging. For local release
verification without Eve or its sandbox runtime, use `npm run build:safe`. The
local dev command uses webpack because the Turbopack compiler is not stable
with Chapter's current landing bundle.

The app defaults to the deployed competition backend. To point it at another
Base44 app:

```bash
NEXT_PUBLIC_BASE44_APP_ID=your_app_id npm run dev
```

Runtime secrets: `OPENROUTER_API_KEY`, `PARALLEL_API_KEY`,
`SIDEQUEST_INTERNAL_SECRET`, `IMESSAGE_WEBHOOK_SECRET`, and the Photon /
iMessage project credentials. Never commit these values.

## Verification

```bash
npm run lint
npm test
npm run build
npx eve info --json
npx eve channels list --json
```

`npm test` currently runs 214 tests across 30 files.

The production pass should additionally verify Google sign-in, phone linking,
the iMessage webhook health route, one real memory turn, private graph
retrieval, a two-account connection acceptance, a Now chapter from home city
through research to accepted, a Together gist and chapter across two accounts,
and mobile overflow.

See [`BUILD_JOURNAL.md`](./BUILD_JOURNAL.md) for the build history and
[`SUBMISSION.md`](./SUBMISSION.md) for the competition draft.
