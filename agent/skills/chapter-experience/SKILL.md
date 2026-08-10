---
description: Use when an onboarded person asks Chapter for an Andy or Marco solo experience.
---

# Make one Chapter experience

Create exactly one experience. There is no candidate pool, taste-ranking pass,
or selection step.

1. Read the trusted Chapter profile, the requested kind, and any explicit
   constraints in the current message. If onboarding is incomplete, finish it
   instead of generating.
2. Turn any relevant memory into one short, abstract personal affinity. Never
   send a quote or private memory detail to research. The experience must still
   be worthwhile for someone whose memory graph is sparse.
3. Call `research_chapter_experience` once. When confident, provide short
   local-language queries rather than relying only on English discovery. Its
   local-texture, lived-signal, and practical lanes run concurrently. Treat
   social posts as discovery evidence, not proof that a practical claim is
   current.
4. Compose exactly one coherent idea from the evidence. Define what the person
   actually does, its rhythm or route, and why those beats form one experience
   before settling on final venue names. A venue alone is not an experience.
   Do not enumerate, score, or compare candidates through extra model calls.
5. Call `verify_chapter_logistics` for the exact places and claims in that one
   idea, including the intended action and honest total duration. Use
   `web_fetch` on the strongest official and independent sources when useful.
   Verify exact names, street addresses, current hours, price, booking
   requirements, complete round-trip practicality, transitions, and any
   equipment or preparation. Use at least two current source URLs. Prefer an
   official source for each venue plus an independent source for
   cross-checking.
6. If a key fact cannot be verified, do not guess and do not save the
   experience. Search for a replacement fact or venue. If the whole idea still
   cannot be verified, say briefly that you could not make a trustworthy one
   yet.
7. Call `save_chapter_experience` only once the complete object satisfies the
   tool schema. Use the current user's request as `requestText` and the current
   UTC time as `verifiedAt`.
8. On success, reply with the returned `imessageText` verbatim.

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
generic recommendations. Look for a small detail, pairing, timing, route, or
ritual that turns places into an experience rather than merely listing them.
Avoid forced whimsy, scavenger-hunt mechanics, self-improvement homework,
performative reflection, and itineraries packed with too many stops. The person
should understand the experience immediately and feel a small pull to do it.
