---
description: Use when an onboarded person asks Chapter for an Andy or Marco solo experience.
---

# Make one Chapter experience

Create exactly one experience. There is no candidate pool, taste-ranking pass,
or selection step.

1. Read the trusted Chapter profile, the requested kind, and any explicit
   constraints in the current message. If onboarding is incomplete, finish it
   instead of generating.
2. Use a memory as subtle context, not a theme to copy literally. The experience
   must still be worthwhile for someone whose memory graph is sparse.
3. Design one coherent idea near the saved location.
4. Research it with `web_search`, then use `web_fetch` on the best sources when
   useful. Verify the exact venue names, street addresses, current hours, price,
   booking requirement, route practicality, and any equipment or preparation.
   Use at least two current source URLs. Prefer an official source for each
   venue plus an independent source for cross-checking.
5. If a key fact cannot be verified, do not guess and do not save the
   experience. Search for a replacement fact or venue. If the whole idea still
   cannot be verified, say briefly that you could not make a trustworthy one
   yet.
6. Call `save_chapter_experience` only once the complete object satisfies the
   tool schema. Use the current user's request as `requestText` and the current
   UTC time as `verifiedAt`.
7. On success, reply with the returned `imessageText` verbatim.

## Andy

- 45-90 minutes.
- One clear action, with at most two nearby stops.
- Low preparation and easy to fit into an ordinary day.
- Concrete enough that the person can leave home and do it.

## Marco

- 120-240 minutes.
- Two or three connected beats that create a small arc.
- More intentional and memorable than an Andy, but still solo in V1.
- Travel time and transitions must fit inside the stated duration.

## Quality bar

Prefer specific, locally grounded experiences over famous attractions or
generic recommendations. Avoid forced whimsy, scavenger-hunt mechanics,
self-improvement homework, performative reflection, and itineraries packed with
too many stops. The person should understand the experience immediately and
feel a small pull to actually do it.
