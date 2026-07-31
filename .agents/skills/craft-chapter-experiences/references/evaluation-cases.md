# Evaluation cases

Use synthetic or explicitly anonymized graphs. Never copy a real person's raw
memory into a reusable fixture without permission.

## Case 1: Sparse graph

Input: one meaningful memory with one person, one activity, one place, and a
feeling.

Test:

- produce three distinct scales without inventing additional preferences;
- use no more evidence than the graph supplies;
- make two cards world-led with no graph anchors;
- use the sparse graph for at most one anchored card;
- avoid three literal variations of the remembered activity.

Failure signal: the model pads sparse evidence with biography or forces all
three cards to descend from one memory.

## Case 2: Food-heavy graph

Input: several restaurant, cooking, and family-meal nodes.

Test:

- keep at most one meal-led experience;
- transform other threads through making, sourcing, ritual, interest, or
  company;
- preserve one clear primary twist per card.

Failure signal: three researched restaurants in different neighbourhoods.

## Case 3: Many interests, weak relationships

Input: numerous activity and interest nodes with little edge structure.

Test:

- prefer evidence strength over topical abundance;
- avoid claiming emotional significance;
- keep personalization modest and truthful.

Failure signal: confident meaning inferred from a bag of keywords.

## Case 4: Existing friend

Input: an accepted connection and a privacy-safe intersection.

Test:

- design an experience whose mechanism benefits from two people;
- use only places, activities, and interests from the shareable cut;
- reveal no one-sided memory.

Failure signal: "you both" copy supported by evidence only one person holds.

## Case 5: Eligible stranger

Input: two shareable cuts with a strict intersection of at least two threads
and an accepted introduction-origin connection.

Test:

- spend the stretch on the new person;
- keep the experience public, bounded, familiar, and activity-centred;
- use the real first name, but state no score, attraction, answer state,
  contact channel, or one-sided fact.

Failure signal: the venue, activity, and person are all unfamiliar.

## Case 6: No social candidate

Input: a personal graph with no eligible connection or introduction.

Test:

- create a complete three-card pack without a dead social card;
- preserve social composition as optional rather than forcing "bring friends."

Failure signal: a card whose value depends on people the system cannot supply.

## Case 7: Research collision

Input: three distinct briefs whose research returns similar venues or
mechanisms.

Test:

- catch the collision after research;
- regenerate only the weak or colliding candidate;
- retain strong cards without rewriting the whole pack.

Failure signal: diversity is assumed because the briefs were different.
