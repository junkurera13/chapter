<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

<!-- eve-agent-start -->

This project contains an experimental [Eve](https://vercel.com/eve) agent under
`agent/`. Eve is still a fast-moving preview, so before changing agent code,
read the matching guide in `node_modules/eve/docs/` and keep the `eve` version
pinned exactly in `package.json`.

<!-- eve-agent-end -->

## Tests

Keep the suite small. Add tests only for costly boundaries such as security,
persisted state and ownership, or core product contracts. Do not test source
text, trivial formatting, animation constants, or other implementation trivia.

## Cloud Agent environment

`.cursor/environment.json` runs `scripts/cloud-agent-install.sh`, which selects
Node 24 (via `scripts/cloud-node.sh`), runs `npm install`, and runs `npx next
typegen`.

- This project pins Node 24 (`package.json` `engines`). The Cloud Agent runtime
  prepends a Node 22 binary to `PATH`, so shells must `source
  scripts/cloud-node.sh` to put Node 24 first before running `npm`/`node`.
- Run `npx next typegen` before `npx tsc --noEmit`; without the generated
  `next-env.d.ts` and `.next/types`, `tsc` reports spurious errors on image and
  route imports.
- The web app, Convex backend, and Eve agent need secrets to run live (Convex
  deployment URL, Clerk keys, `CHAPTER_AGENT_SECRET`, `OPENROUTER_API_KEY`,
  `PARALLEL_API_KEY`, Photon). Without them you can still `npm test`, `npx tsc
  --noEmit`, `npm run lint`, `npm run build`, and `npm run agent:build`, and run
  a local Convex backend with `CONVEX_AGENT_MODE=anonymous npx convex dev`.
