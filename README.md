# Chapter

Chapter begins by learning from one experience a person will never forget.
It meets them in iMessage, turns that experience into a private graph of
people, places, activities, feelings, and patterns, and lets them explore that
growing picture in the authenticated **You** view.

This is the Base44 Backend Build-Off edition. Base44 owns authentication,
private file storage, account-to-phone linking, conversations, autobiographical
memory sources, graph validation, and persistence. Chapter itself is an Eve
agent using `openai/gpt-5.4-mini` through Vercel AI Gateway. Photon is used only
as the bridge to iMessage. Named people become distinct nodes, and a private
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
web / iMessage <-> Next.js <-> Eve <-> Vercel AI Gateway
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
  extraction. The same Eve session continues across the web and iMessage.
- `sidequest-memory` preserves text and private-image sources before extraction,
  signs short-lived image URLs, then validates and persists Eve’s result.
- `sidequest-message` deduplicates inbound messages, stores Eve’s opaque session
  cursor, and records reply delivery.
- Seven Base44 entities hold accounts, messages, source memories, graph nodes,
  graph edges, connection invites, and accepted connections.
- Raw invite tokens are never persisted. Base44 stores only a SHA-256 hash,
  and an accepted token links exact user IDs rather than guessing from names.

## Local development

Requires Node.js 24, a Base44 account, Vercel authentication for AI Gateway,
and a shared `SIDEQUEST_INTERNAL_SECRET`.

```bash
npm install
npm run dev
```

The app defaults to the deployed competition backend. To point it at another
Base44 app:

```bash
NEXT_PUBLIC_BASE44_APP_ID=your_app_id npm run dev
```

The Photon bridge also needs its project credentials and webhook secret. Eve
automatically uses the Vercel AI Gateway on Vercel; local development uses the
linked Vercel project credentials. Never commit those values.

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
