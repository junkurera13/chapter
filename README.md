# Sidequest — Base44 Build-Off

Sidequest turns a free evening into a specific three-stop plan using real places, the user's constraints, and an AI-generated backup plan.

This repository is the Base44 Backend Build-Off edition of Sidequest. The existing Next.js interface is intentionally preserved; the application backend was rebuilt on Base44.

## Live app

- Frontend: https://sidequest-base44-buildoff.vercel.app
- Base44 app ID: `6a606ec9966ada5a7874da07`

Try the full backend flow at `/admin/generate`, then open the generated `/q/<id>` mission link.

## What runs on Base44

- Six Base44 entities: `Quest`, `SidequestUser`, `ConversationMessage`, `ExperienceMemory`, `ExperienceGraphNode`, and `ExperienceGraphEdge`
- `generate-quest`: researches current places with Base44's `Core.InvokeLLM`, validates a strict three-stop JSON result, and persists the quest
- `sidequest-data`: serves quest and user reads/writes for the existing UI
- `sidequest_composer`: a Base44 agent with user-scoped memory and the quest-generation function as a tool
- Entity access rules keep direct entity operations admin-only; public app traffic goes through the two purpose-built backend functions

The frontend has no database credentials or model API key. It calls the deployed Base44 functions using the app ID, and all privileged entity and AI operations happen inside Base44.

## Architecture

```text
unchanged Next.js UI
        |
        | HTTPS
        v
Base44 backend functions
   |                 |
   v                 v
Base44 entities   Core.InvokeLLM
                  + web context
```

## Local development

Requires Node.js 24 and a Base44 account.

```bash
npm install
npm run dev
```

The app defaults to the deployed competition backend. To point it at another Base44 app:

```bash
NEXT_PUBLIC_BASE44_APP_ID=your_app_id npm run dev
```

Deploy the Base44 resources from this repository with:

```bash
npx base44 login
npx base44 deploy
```

## Verification

```bash
npm run lint
npm test
npm run build
```

The production verification also covers:

- a real AI quest generated and persisted through Base44
- quest retrieval through a public short link
- recent quest retrieval on the admin page
- exact visible-text parity with the original UI on `/`, `/app`, `/signup`, and `/admin/generate`
- no horizontal overflow at a 390 px viewport

See [BUILD_JOURNAL.md](./BUILD_JOURNAL.md) for the build log and backend decisions.
