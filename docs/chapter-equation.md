# The Chapter Equation

**Status: product contract.** This is the source of truth for what may be
proposed as a chapter, on every surface: Now, Together, and the weekly pack.
It defines which shapes are *legal*. It does not decide which legal shape is
*good*; that is the ranking layer, described at the end.

---

## The equation

```
Chapter = Familiar Anchor + Unfamiliar Twist + optional Unfamiliar Context
```

Something you know, something new, and at most one detail that brings it to
life.

The familiar element provides confidence. The unfamiliar element creates
discovery. The optional third adds texture, not difficulty.

---

## The four dimensions

A chapter is built out of exactly four dimensions, and they are the four
things the memory graph actually stores as nodes:

| Dimension | The question it answers |
| --- | --- |
| `activity` | what the person does |
| `place` | where it happens |
| `people` | who it happens with |
| `interest` | the theme behind it |

These match `EXPERIENCE_NODE_CATEGORIES` in `lib/experienceOntology.ts`. That
is not a coincidence and it is the test for admitting anything new: a
dimension must be a noun the graph can hold a memory of.

### Why time is not a dimension

Nobody stores a memory of "8am". Time is a property of every chapter rather
than a thing a chapter can be built out of, so it is a category error to put
it in the list above. A chapter that seems to stretch on time is really
stretching on something else:

> Your usual cafe at 6am, when the baker pulls the first tray out.

The novelty there is watching bread come out of an oven, which is an
`activity` twist. The hour is how it is made possible, not what makes it new.

Time still matters. It is carried by `timeCharacter`, `NOW_TIME_WINDOWS`, and
`bestTime`. It is simply never the answer to "what is new here".

> **Migration note.** Three shipping files still list `time` as a stretch
> dimension and none of them list `interest`:
> `lib/nowChapterSchema.ts`, `lib/togetherChapterSchema.ts`,
> `lib/weeklyPackDesign.ts`. This document is canonical; those files have not
> been migrated yet, because the swap changes runtime behaviour on three live
> surfaces and needs its own testing. Until then, `lib/chapterEquation.ts` is
> the definition, and the disagreement is known rather than silent.

---

## Company: the mode above the equation

Before any dimension is chosen, a chapter has a **company**, which is who the
person is with. This is not a fifth dimension. It is a setting that decides
what the `people` dimension is allowed to do.

| Company | What `people` does |
| --- | --- |
| `self` | unused. The dimension sits out entirely. |
| `known-person` | it is the **anchor**. A person you know is the familiar thing. |
| `new-person` | it is the **twist**, and must be the primary one. |
| `small-group` | it is the **twist** (a class, a pickup game, a table of strangers). |

This resolves what would otherwise be a contradiction. "Familiar people
cannot be the anchor" is true of solo chapters and false of Together, whose
entire architecture is that the partner is the familiar person and the stretch
therefore goes somewhere else. The rule was never universal. It belongs to
`self`.

Company is chosen weekly. The person may pick it directly. When they do not,
it is drawn against a default weighting held in `CHAPTER_COMPANY_WEIGHTS`, so
the mix can be tuned without editing prose or prompts.

---

## The rules

1. Exactly one dimension is **familiar**, and it is the anchor.
2. Exactly one dimension is **new**, and it is the twist. Never two.
3. A third dimension may be added as **context**. It must also be new, and it
   exists to make the twist specific, not to add a second challenge.
4. No dimension is used twice.
5. Two layers is the default. Three is the exception.
6. Every chapter has one clear main action.
7. Every element describes the same single experience.
8. It fits in one sentence.

Four layers is not on this list. Anchor plus twist plus context is three by
construction, so a four-layer chapter is not something to forbid; it is
something the shape cannot express. `ChapterShape` in `lib/chapterEquation.ts`
enforces that by having nowhere to put a fourth.

### What "exactly one" counts

It counts **dimensions, not memories.** A chapter may cite one to four anchor
nodes from the graph, and they may span categories; that is what draws the
person's own orbs onto the card. The rule binds the familiarity declaration:
of the four dimensions, exactly one is marked `new`. This is what
`auditStretch` in `lib/weeklyPackDesign.ts` already enforces.

### Cold start

A first chapter has no anchor at all. On `basis: "world"` the anchors array is
empty by design, and `familiar` takes its other meaning: locally accessible,
socially ordinary, low-friction, easy to understand. This is legal and is not
an exception to be designed around. A person Chapter has just met gets a
chapter built from the world, not from a biography it does not have.

---

## The shape space

Because company decides what `people` may do, the legal space is per mode.
Twist and context are different jobs, so their order is meaningful and is
counted.

| Company | Two layers | Three layers | Total |
| --- | --- | --- | --- |
| `self` | 6 | 6 | 12 |
| `known-person` | 3 | 6 | 9 |
| `new-person` / `small-group` | 3 | 6 | 9 |

Thirty shapes in total. The product should not use them evenly. Most of them
are legal and lifeless, and legality is a floor.

---

## The coherence test

Run before a chapter is ever shown. It is the last filter and the cheapest.

**One action.** Can it be said with one main verb?

- Good: play basketball at a new court with a pickup group.
- Bad: hike, meet people, and learn about plants somewhere new.

**One experience.** Do all the layers happen as part of the same event?

- Good: take a pottery class with a new group.
- Bad: read at a new cafe while learning photography with strangers.

**Low mental load.** Is it understood immediately? The person must never have
to work out why these elements were combined.

**Earned third layer.** Would removing the third layer make it less specific
or less compelling? If not, remove it. This is the test the third layer most
often fails, and the reason two layers is the default: at three the idea can
start to read as assembled rather than intended.

---

## Generation order

1. **Choose company.** The person's weekly setting, or the weighted default.
2. **Choose the anchor.** Something they already do, visit, or care about.
   On `known-person`, this step is already spent.
3. **Choose the twist.** One unused dimension, reaching into the unknown.
4. **Decide on context.** Only if it sharpens the same idea. Default to no.
5. **Write the action first, then the venue.** Research exists to make a
   designed action true and current, not to substitute a place for a design.
6. **Run the coherence test.** Cut any layer that sounds forced.

The system is never shown to the person. Internally:

> familiar `interest` + new `activity` + new `place`

What they read:

> Love films? Catch an outdoor screening in a neighbourhood you haven't
> explored.

---

## Graduation: why this compounds

A chapter ends at `lived`. At that moment the twist stops being unfamiliar.
The new cafe is now a place you know.

**Today's twist is tomorrow's legal anchor.**

This is the engine, and it is the reason Chapter needs a memory graph rather
than a preference profile. Each lived chapter widens the familiar surface,
which widens what can be anchored on, which puts new twists in reach that
would have been too far a month ago. A person's world expands by one safe
step at a time, and the system gets more to work with every time they say yes.

It also supplies the anti-repetition rule for free: a twist may not name
something the graph already marks familiar. The ontology is already built for
this, via `EXPERIENCE_FAMILIARITIES` and the `familiar_with` relation.

---

## What this document does not decide

The equation is a **grammar**. It says which chapters are legal. It is silent
on which of thirty legal shapes to propose on a given Saturday, and a
structurally perfect chapter can still be a bad one.

Ranking lives elsewhere and stays there: reach and time windows, the
uncommonness demands in the research brief, `avoidVenues`, `declineReason`,
effort, geography, and duration. Anything that reads this file as a complete
account of a good chapter will produce valid, lifeless output.

Legality is the floor. Nothing here is the ceiling.

---

## Final principle

Anchor the person in something familiar, then introduce just enough novelty to
make life feel different.
