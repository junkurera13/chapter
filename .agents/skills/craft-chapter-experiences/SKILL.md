---
name: craft-chapter-experiences
description: Design, research, critique, and evaluate exceptional real-world Chapter experiences from private memory graphs or privacy-safe graph intersections. Use when creating weekly Now packs, choosing experience formats, designing personal or social chapters, writing research briefs, reviewing research findings, auditing three-card diversity, or diagnosing why an experience feels generic, invasive, impractical, repetitive, or emotionally false.
---

# Craft Chapter Experiences

Design an experience before looking for a venue. Treat research as the work that
makes a designed experience true, current, and actionable.

## Read the right references

Always read:

- [principles.md](references/principles.md) for Chapter's product thesis and
  experience-design laws.
- [quality-rubric.md](references/quality-rubric.md) before accepting an
  experience or pack.

Also read:

- [formats.md](references/formats.md) when choosing formats or assembling a
  weekly pack.
- [social-connection.md](references/social-connection.md) whenever an
  experience involves a known person, a stranger, or a group.
- [failure-cases.md](references/failure-cases.md) when critiquing or revising
  output.
- [evaluation-cases.md](references/evaluation-cases.md) when testing prompts,
  models, schemas, or pack logic.

## Protect the input boundary

Use only grounded graph evidence. Distinguish facts from hypotheses and prefer
high-salience, high-confidence evidence. Never invent biography, relationships,
preferences, feelings, constraints, or local context.

For a personal Now experience, reason over the person's private graph only on
the server.

For Together, use only the shareable cut made by `planningGraphFrom` in
`lib/togetherGeneration.ts`: places, activities, and interests. For an
introduction, use only the strict intersection of two shareable cuts. Never
widen either boundary.

## Design a three-card pack

1. Read the usable graph evidence and recent outcomes. Identify several living
   threads; do not lock onto the most obvious noun.
2. Assign three format contracts before researching. Treat experience scale and
   social composition as separate axes.
3. Create the pack as one composition. Give each card a different primary
   thread, scale, experience mechanism, and meaningful stretch.
4. Design the experience itself: the human action, setting, constraint, rhythm,
   and reason the moment may become memorable.
5. Spend exactly one novelty dimension per card. Keep the other dimensions
   familiar enough that the stretch can be lived rather than merely admired.
6. Write three separate research briefs. Make each brief prove the facts and
   logistics its designed experience needs; do not reduce every brief to
   finding a venue.
7. Run independent research for diversity. Reject closed, generic, unsafe,
   overexposed, or weakly evidenced findings.
8. Compose each card without claiming why the person will like it. Let verified
   graph anchors show the familiar side and let the invitation state the
   experience plainly.
9. Audit each card and then the pack. Regenerate a weak or colliding card rather
   than rationalizing it.

## Preserve these distinct axes

Represent the design internally with at least:

- `scale`: `small | mini | proper`
- `company`: `self | known-person | new-person | small-group`
- `structure`: `single-action | destination | journey | sequence`
- `effort`: `spontaneous | lightly-planned | deliberately-planned`
- `geography`: `neighbourhood | city | beyond-city`
- `energy`: a plain description grounded in evidence
- `timeCharacter`: flexible, after-dark, seasonal, weather-dependent, or
  similarly concrete

The visible format may combine these dimensions. Do not expose the taxonomy as
a settings panel.

## Produce a design record before research

For each candidate, record:

- exact graph anchors and evidence strength;
- the familiar thread in one plain sentence;
- the single stretch and its dimension;
- the format contract;
- the experience promise: what the person will actually do;
- why the mechanism may create a memory or a human connection;
- practical and safety requirements the research must prove;
- the research objective;
- how this card differs from the other two.

Do not proceed when the design cannot explain its value without naming a venue.

## Reject rather than decorate

Reject any candidate that:

- could have been generated without this person's graph;
- repeats a memory instead of transforming it;
- requires two or more unfamiliar dimensions;
- mistakes an unusual venue for an experience;
- invents emotional meaning or claims compatibility;
- cannot be acted on within its validity window;
- relies on another person's private information;
- becomes unsafe or awkward when the connection does not work out;
- makes the pack feel like three versions of the same recommendation.

Use the rubric's hard gates. A polished sentence cannot rescue a failed
experience.

## Keep romance honest

Design conditions in which people may connect. Never predict friendship,
compatibility, attraction, or love. Treat romance as a possible human outcome,
not a product claim or matching label. Require explicit product infrastructure
before designing an explicitly dating-oriented flow.

## Separate present code from product direction

`README.md`, `SUBMISSION.md`, and `BUILD_JOURNAL.md` describe what is shipped.
The weekly pack is planned in `docs/weekly-experience-packs.md`. Do not describe
that plan as implemented until the code and shipped-state docs say so.
