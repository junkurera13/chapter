# Chapter

**Status:** Living product vision  
**Last updated:** August 10, 2026

## The idea

> **Connecting people through experiences that feel strangely familiar.**

Chapter turns lived memories into an evolving understanding of a person, then
uses that understanding to make real-world experiences worth doing.

The long-term problem is human connection: young adults who struggle socially
have few natural, low-pressure ways to form close friendships or romantic
relationships, even when they want them. The insight is that people often
connect more naturally through a meaningful shared experience than through
swiping, scrolling, profiles, or socializing for its own sake.

V1 deliberately proves the experience before it adds the people. If Chapter
cannot consistently make a solo experience someone genuinely wants to do,
matching another human into it will not save the product.

## V1 question

> Can Chapter make solo experiences that are good enough to save and actually
> do, and can it learn from the person's reaction?

The V1 loop is:

1. A person texts Chapter on iMessage.
2. Chapter asks for one meaningful memory, then their home city or
   neighborhood.
3. The person texts “give me an Andy” or “give me a Marco.”
4. Chapter researches and sends one specific, currently viable experience.
5. The person saves it, passes, marks it done, or replies naturally with why it
   did or did not work.
6. Chapter preserves that evidence so the next experience can improve.

This is on demand first. Automatic delivery, calendars, image cards, and the
full monthly rhythm arrive only after the quality loop works.

## Experience categories

### Andy

A small solo experience that fits naturally into an ordinary day. Usually
45-90 minutes, with one clear action and very little preparation.

Example: try a new ice cream shop serving Earl Grey soft serve.

### Marco

A more intentional solo experience with enough novelty and structure to feel
memorable. It lasts 2-4 hours and may contain two or three connected beats.

Example: rent a bike, follow one scenic route, then stop for Earl Grey ice
cream.

### Amelia — V2

A day-defining experience whose travel, preparation, energy, or recovery makes
the day revolve around it. Amelia is not part of V1.

## What makes a Chapter experience

Chapter makes one confident proposal, not a recommendation feed or a ranked
list. The experience should be immediately understandable, logistically real,
and specific enough to act on.

It defines what the person actually does before settling on the venue. A place
can enable an experience, but a place alone is not the experience.

Before sending it, Chapter verifies:

- exact venue names and addresses;
- current opening hours;
- realistic price;
- route and travel practicality;
- bookings, equipment, and preparation;
- whether every beat fits the promised duration.

There is no “tasteful selection” stage. Chapter gathers diverse local evidence,
composes one coherent idea, verifies it, and retries only when that idea fails
the contract. It never invents logistics to complete a response.

## The personal memory graph

The graph is a core product feature, not an admin artifact. It is Chapter's
evolving portrait of a person and eventually appears in the **You** surface.

Chapter always preserves the original memory. Structured extraction is a
fallible interpretation layered on top, never a replacement for what the person
actually said.

The graph can contain:

- experiences;
- people;
- places;
- activities;
- interests;
- feelings;
- conditions and boundaries;
- patterns supported by evidence.

Nodes and relationships keep their source evidence, confidence, and salience.
One memory begins the graph; it does not complete a personality profile. Facts,
hypotheses, and unknowns remain distinct. The product should never reduce a
person to labels such as “foodie” or “introvert.”

Chapter uses memories as subtle creative context. It does not simply repeat the
surface of a memory: someone who loved cycling in Fukuoka should not
automatically be sent cycling again. The deeper composition may matter more
than the literal activity.

## Surfaces

### iMessage

iMessage is the primary V1 product. It owns onboarding, natural requests,
experience delivery, and feedback. The person should feel like they are texting
one perceptive contact, not operating a chatbot.

### Now

The owned app shows the current and saved experiences. V1 should contain one
meaningful thing at a time, not a discovery feed.

### You

The owned app shows memories and the evolving graph. The graph's visual language
from the Chapter competition build is a reference worth preserving; its
Base44-specific extraction and backend mechanics are not.

### Together — later

Matching people and designing social experiences together begins only after V1
proves the solo experience engine. Consent, safety, identity, moderation, and
relationship depth need their own product work.

## V1 architecture

- **Photon/iMessage** carries the conversation.
- **Eve** provides a thin, durable conversation runtime.
- **The experience engine** owns a portable typed contract, Parallel-backed
  research, OpenRouter composition, verification rules, and an evaluation
  harness. It must not depend on iMessage or Eve.
- **Convex** is durable product truth for profiles, raw memories, graph data,
  experiences, and feedback.
- **The web app** renders Now and You from Convex.

The same experience-engine contract must eventually power both the live agent
and an offline evaluation harness. A framework can be replaced without losing
Chapter's taste or memory.

## Product principles

1. **Simple.** No configuration flow disguised as personalization.
2. **Magical.** The person experiences the result, not the machinery.
3. **Fast.** Ask only for information that materially changes the experience.
4. **Concise.** One good proposal beats twenty options.
5. **Lightweight.** Add infrastructure only when the product contract demands
   it.
6. **Tasteful.** Specific, restrained, emotionally clear, and free of forced
   whimsy.
7. **Truthful.** Practical facts and uncertainty are never hidden.
8. **Evidence-led.** Feedback and lived memories change the system; stereotypes
   do not.

## Not V1

- human matching or social experiences;
- Amelia;
- automatic 16 Andy plus 8 Marco monthly delivery;
- calendar-aware scheduling;
- a recommendation marketplace or Explore tab;
- onboarding questionnaires, interest checklists, or profile percentages;
- a candidate-generation and ranking pipeline.

These may become valuable later. None should make the first quality loop slower
or more complicated now.
