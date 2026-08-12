# Chapter

Chapter is a private iMessage agent that turns lived memories into solo
experiences worth doing. The current V1 proves the experience engine before
adding human matching.

[`VISION.md`](./VISION.md) is the product source of truth.

## Current slice

- A private Photon/iMessage channel runs through Eve.
- Only handles in `CHAPTER_TEST_IMESSAGE_HANDLE` are accepted.
- Onboarding asks for one memory, then city and optional neighborhood.
- Convex stores the Chapter profile, raw memories, experiences, and feedback.
- “Give me an Andy” and “Give me a Marco” trigger three concurrent Parallel
  research lanes, followed by one OpenRouter-composed experience.
- Every saved experience has a typed contract and at least two verification
  sources.
- Save, Pass, Done, and natural feedback update the latest experience.

The existing web shell comes from an earlier product iteration. It remains in
place while the Now and You surfaces are rebuilt using the visual direction
from the Chapter competition project. Together, Amelia, automatic delivery,
Google Calendar, and image cards are later milestones.

## Architecture

```text
iMessage → Eve → Chapter skill → Parallel evidence → OpenRouter composition
             ↘ Convex profile, memories, experiences, feedback
```

Eve is deliberately thin. The portable experience object and formatter live in
`lib/chapter/`; Convex is durable product truth.

## Local development

Use Node 24:

```bash
npm install
npm run dev
npm run agent:dev
```

The web app uses Clerk with Convex token validation. The iMessage agent uses
Photon project credentials, a private sender allowlist, and a shared
`CHAPTER_AGENT_SECRET` configured in both the app runtime and the linked Convex
deployment. Composition uses `OPENROUTER_API_KEY`; research uses
`PARALLEL_API_KEY`. See [`docs/agent-brain.md`](./docs/agent-brain.md).

## Verification

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run agent:build
```

Never commit real `.env` files or secrets.
