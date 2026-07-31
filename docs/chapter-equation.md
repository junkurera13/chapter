# The Chapter Equation

**Status: product contract.** This is the source of truth for what may be
proposed as a chapter, on every surface: Now, Together, and the weekly pack.
It defines which shapes are *legal*. It does not decide which legal shape is
*good*; that is the ranking layer, described at the end.

---

## The equation

```
Chapter = Familiar Frame + one Primary Unfamiliar Twist
          + optional Supporting Unfamiliar Context
```

Something that makes the experience easy to enter, one meaningful leap, and
at most one detail that makes that same leap concrete.

The familiar element provides confidence. The unfamiliar element creates
discovery. The optional third adds texture, not difficulty.

---

## The four dimensions

A chapter varies four dimensions:

| Dimension | The question it answers |
| --- | --- |
| `activity` | what the person does |
| `place` | where it happens |
| `people` | who it happens with |
| `interest` | the theme behind it |

The graph contains more categories than these. Feelings are outcomes,
conditions constrain fit, patterns supply evidence, and an `experience` is the
whole chapter rather than one coordinate within it. These four are the parts
Chapter may deliberately keep familiar or move into the unknown.

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

The runtime schemas for Now, Together, and weekly packs use these dimensions.
Old weekly design artifacts may still be read during migration, but new
generation cannot draw `time` as a twist.

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
the runtime first removes impossible modes, then draws from the remaining
ones using `CHAPTER_COMPANY_WEIGHTS`.

That order matters. If there is no server-confirmed person or group, those
modes have **zero odds**. A low probability is not safe enough: a random draw
must never cause the model to invent somebody.

---

## The rules

1. One dimension carries the **familiar frame** when a graph anchor exists.
   A world-led card may instead be familiar through ordinary access, legibility,
   and low friction.
2. Exactly one dimension is the **primary new twist**.
3. A third dimension may be new as **supporting context**, but only when it
   makes the same twist specific. It may not add another skill, booking,
   journey, safety issue, or social demand.
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

It counts the **main leap**, not every unfamiliar fact. A chapter may cite one
to four graph nodes, and an earned supporting context may also be new. But the
person should still experience one clear challenge, not two unrelated ones.
The deterministic audit checks that generated cards match the shape drawn
before writing.

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
| `new-person` | 3 | 6 | 9 |
| `small-group` | 3 | 6 | 9 |

There are 39 company-labelled shapes. If `new-person` and `small-group` are
treated as the same structural role, there are 30 role templates. The product
does not use them evenly: two-layer and solo shapes are deliberately more
likely, and unavailable social shapes are removed before the draw.

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

1. **Build the eligible company set.** No real person means no social shape.
2. **Draw company by weight.**
3. **Draw the empty shape.** Choose only categories: anchor, primary twist,
   and occasionally supporting context.
4. **Supply truthful material.** Graph data supplies familiar anchors. The
   model may design an action, but it may not manufacture exact external facts.
5. **Research the nouns.** A venue, event, date, address, route, timetable, or
   provider may reach the person only when live research proves it.
6. **Fail closed.** If research cannot prove a required fact, discard the
   chapter. Never fill the gap with a plausible-sounding substitute.
7. **Run the coherence test.**

For example:

- The draw chooses familiar `interest` + primary `activity` twist.
- The graph supplies `film`.
- Design proposes `learn outdoor projection`; it does **not** name a site.
- Research must find and prove a real current workshop, including its exact
  name, address, operating evidence, and sources.
- If it succeeds, the card may name that verified workshop. If it cannot find
  one, there is no card.

The equation chooses categories. The graph and research supply nouns.

## Graduation: why this compounds

A chapter ending at `lived` is evidence that the twist may become familiar.
It becomes a future anchor only after the lived experience is written back to
the graph; a status change alone does not silently rewrite familiarity.

**Today's twist is tomorrow's legal anchor.**

This is the engine, and it is the reason Chapter needs a memory graph rather
than a preference profile. Each lived chapter widens the familiar surface,
which widens what can be anchored on, which puts new twists in reach that
would have been too far a month ago. A person's world expands by one safe
step at a time, and the system gets more to work with every time they say yes.

Once lived writeback exists, it can also supply the anti-repetition rule: a
twist may not name something the graph already marks familiar. The ontology
already has the vocabulary for this through `EXPERIENCE_FAMILIARITIES` and the
`familiar_with` relation, but the writeback itself remains separate work.

---

## What this document does not decide

The equation is a **grammar**. It says which chapters are legal. It is silent
on which legal shape to propose on a given Saturday, and a
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
