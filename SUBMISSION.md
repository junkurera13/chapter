# Base44 Build-Off submission draft

## Submission

- Full name: **[confirm before submitting]**
- Email: **[confirm before submitting]**
- Project title: **Chapter**
- One-line pitch: **An iMessage agent that learns what makes an experience unforgettable and builds a private world around you.**
- Surface type: **Web app**
- Live URL: https://usechapter.vercel.app
- Public GitHub repo: https://github.com/junkurera13/sidequest-base44-buildoff
- Access instructions: **Open `/app`, sign in with Google, connect an iMessage-capable phone number, text Chapter, and share one unforgettable experience. Return to You to see the private graph. Open any named person to create a private invite; after they accept with their own Google account, both people receive reciprocal nodes and appear in Together.**
- Demo video URL: **[optional, not recorded yet]**
- Agentic IDE used: **Codex**
- Base44 App ID: **6a606ec9966ada5a7874da07**

### Project write-up

Chapter starts with lived experience instead of preference checkboxes. A
person shares one experience they will never forget in iMessage. Chapter
extracts a careful graph of the people, places, activities, feelings, and
patterns that made it meaningful, then reveals that private graph in the
authenticated **You** view. Explicitly named people remain individual nodes,
not a single generic group.

Base44 owns authenticated accounts, phone-account linking, conversation state,
source memories, graph extraction, connection invitations, accepted
connections, and persistence. Seven Base44 entities model that world.
`sidequest-message` provides idempotent iMessage processing and structured
memory extraction through `Core.InvokeLLM`; `sidequest-data` provides
authenticated ownership, graph retrieval, hashed invite handling, and
reciprocal nodes. Direct entity access is restricted by access rules.

Photon is deliberately narrow: it connects Apple Messages to the signed
Next.js webhook, while Base44 remains the source of truth. The product currently
demonstrates Google sign-in, phone linking, an iMessage memory conversation,
graph growth, a private interactive world, and identity-backed connections in
**Together**. The new **Now** experience is the next product layer and is
intentionally not represented by a placeholder.

## Backend features used

- [x] Authentication & user management
- [x] Database / entities
- [x] Backend functions (Deno)
- [x] AI / LLM structured extraction
- [ ] Real-time subscriptions
- [ ] File & media storage

## BaaS feedback

### What worked well or felt great to use?

The CLI made the first successful vertical slice unusually fast: declare
entities, add Deno functions, call `Core.InvokeLLM`, and deploy without
assembling separate database, model, and serverless-function providers.
`createClientFromRequest` plus `asServiceRole` kept privileged work inside
Base44, while structured output fit the experience-graph extraction well.

### Where did you get stuck, confused, or blocked?

The external browser SDK's anonymous analytics initialization initially made a
healthy public integration look broken by logging an authentication error. The
distinction between deployed resources and production log visibility was also
unclear while testing an external Next.js frontend.

### What was missing, or what would you add?

An explicit `analytics: false` client option, a functions-only SDK entry point,
and a first-party external Next.js example covering authenticated functions,
CORS, server components, and route handlers would make this workflow easier to
trust. Typed entity generation for function code and stronger CLI remote-state
inspection would also help.

- Likelihood to keep using Base44's backend: **7 / 10**
- Contact permission for follow-up: **confirm before submitting**
- Marketing feature consent: **confirm before submitting**
