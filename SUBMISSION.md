# Base44 Build-Off submission draft

## Submission

- Full name: **[confirm before submitting]**
- Email: **[confirm before submitting]**
- Project title: **Chapter**
- One-line pitch: **An iMessage agent that learns what makes an experience unforgettable and builds a private world around you.**
- Surface type: **Web app**
- Live URL: https://usechapter.vercel.app
- Public GitHub repo: https://github.com/junkurera13/chapter
- Access instructions: **Open `/app`, sign in with Google, connect an iMessage-capable phone number, text Chapter, and share one unforgettable experience. Return to You to see the private graph. Set a home city in Now to get one researched chapter to live this weekend. Open any named person to create a private invite; after they accept with their own Google account, both people receive reciprocal nodes and appear in Together, where Chapter names what their two worlds share and can plan a chapter for both of them.**
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

That world is then spent. **Now** takes the graph plus a home city and writes
one real chapter to live this weekend — a single stretch of a day, researched
against the live web through Parallel AI and checked before it is offered,
rather than a generated itinerary. **Together** does the same for two connected
accounts: it finds the threads both private worlds actually hold, says the one
thing they share out loud as a *gist*, and can then plan a chapter for the two
of them that either person can propose, accept, or mark lived.

Base44 owns authenticated accounts, private image storage, phone-account
linking, source memories, conversation records, graph validation, connection
invitations, accepted connections, home city, Now and Together chapters, and
persistence. Ten Base44 entities model that world. Chapter's durable
conversation runs as an Eve agent on Vercel, and every model call goes directly
through OpenRouter to 2026 models pinned to zero-data-retention providers:
`google/gemini-3.1-flash-lite` (falling back to `moonshotai/kimi-k2.6`) for
image-aware memory extraction, `deepseek/deepseek-v4-flash` for text
conversation, and `moonshotai/kimi-k2.6` for Now and Together composition.
`sidequest-memory` preserves sources before model work and validates the
structured graph before persistence; `sidequest-message` provides idempotent
web and iMessage processing and stores the opaque Eve continuation cursor;
`sidequest-data` provides authenticated ownership, graph retrieval, single-use
invite handling, reciprocal nodes, and chapter records. Direct entity access is
restricted by access rules.

Privacy is enforced server-side rather than by convention. Together reduces each
graph to a shareable cut — places, activities, and interests only — and feelings,
people, conditions, patterns, and raw memories never leave the server. A gist is
narrower still: it reveals only the intersection of the two worlds, so every
sentence it produces is already true on both sides. Composition belongs to the
initiator alone, so a partner cannot see or spend a research run they don't know
exists.

Photon is deliberately narrow: it connects Apple Messages to the signed
Next.js webhook, while Base44 remains the source of truth. The product
demonstrates Google sign-in, phone linking, an iMessage memory conversation,
graph growth, a private interactive world, identity-backed connections, a
researched personal chapter in **Now**, and a shared one in **Together**.

## Backend features used

- [x] Authentication & user management
- [x] Database / entities
- [x] Backend functions (Deno)
- [x] AI / LLM structured extraction (Eve + OpenRouter)
- [ ] Real-time subscriptions
- [x] File & media storage

## BaaS feedback

### What worked well or felt great to use?

The CLI made the backend slice unusually fast: declare entities, add Deno
functions, secure private uploads, and deploy without assembling separate
database, authentication, storage, and serverless-function providers.
`createClientFromRequest` plus `asServiceRole` keeps privileged validation and
persistence inside Base44, while the agent loop stays independent. Access rules
did real work once two accounts could see partial views of each other: the
shareable-cut boundary is enforced in one place instead of at every call site.

### Where did you get stuck, confused, or blocked?

The original Base44 LLM integration repeatedly failed on the production
multimodal extraction path and exposed too little provider/runtime detail to
diagnose confidently; extraction was eventually moved to a direct OpenRouter
call so the first memory never depends on the agent sandbox. The external
browser SDK's anonymous analytics initialization also made a healthy public
integration look broken by logging an authentication error. The distinction
between deployed resources and production log visibility was unclear while
testing an external Next.js frontend. Long-running work — deep research that
outlives a single request — needed polling built by hand, since there is no
first-party job or subscription primitive to lean on.

### What was missing, or what would you add?

An explicit `analytics: false` client option, a functions-only SDK entry point,
and a first-party external Next.js example covering authenticated functions,
private file handoff to an external model, CORS, server components, and route
handlers would make this workflow easier to trust. Typed entity generation,
provider/model observability, background jobs for multi-minute work, and
stronger CLI remote-state inspection would also help.

- Likelihood to keep using Base44's backend: **7 / 10**
- Contact permission for follow-up: **confirm before submitting**
- Marketing feature consent: **confirm before submitting**
