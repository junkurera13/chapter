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
