# 004 — Reveal newly learned orbs outward

- **Status**: IMPLEMENTED — MANUAL FEEL CHECK PENDING
- **Commit**: e758995
- **Severity**: HIGH
- **Category**: Missed opportunity, physicality, and accessibility
- **Estimated scope**: 4 files, roughly 240 lines including tests

## Problem

Chapter already computes safe outward positions for nodes whose authored
position is absent, but the rendered world has no concept of a node being newly
learned. Every mesh and every connector exists at full size and opacity on the
first frame. The person therefore sees a finished database rather than a living
understanding taking shape.

`app/app/radialGrowth.ts:143-146` already establishes the correct structural
behavior:

```ts
/**
 * Keeps authored positions intact and supplies outward positions for newly
 * generated nodes. Missing nodes are resolved after one of their connections
 * exists; a disconnected node begins a new branch from the centre.
 */
```

`app/app/graphData.ts:343-348` already applies that placement foundation:

```ts
const sizedWorldNodes = resolveOrbSizes(worldNodeSeeds, worldEdges);

export const worldNodes: readonly WorldNode[] = resolveOutwardPositions(
  sizedWorldNodes,
  worldEdges,
);
```

But `app/app/YouView.tsx:342-374` creates every node in its completed state:

```ts
for (const node of worldNodes) {
  // ...
  const material = new THREE.MeshPhysicalMaterial({
    // ...
    transparent: true,
    opacity: baseOpacity,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...(savedPositions.get(node.key) ?? node.position));
  // ...
}
```

`app/app/YouView.tsx:397-411` also creates every relationship fully drawn:

```ts
for (const edge of worldEdges) {
  // ...
  const connection = createConnection(
    from.position.clone(),
    to.position.clone(),
    edge,
  );
  world.add(connection.line);
  edgeLines.push({
    edge,
    ...connection,
    baseOpacity: connectionOpacity(edge),
  });
}
```

The current You page uses a static, presentation-safe graph. This plan must not
pretend that a live account subscription exists. It should implement a durable
new-node reveal keyed by real node identities: a fresh generated world reveals
once, and a future build or data source that adds an unseen node key reveals
only that node on the next mount.

## Target

Make a newly learned node feel born at the edge of the person's world:

- Persist completed node identities in local storage under
  `chapter:you-world:seen-node-keys:v1`, versioned as `{ version: 1, keys:
  string[] }`. Invalid or unavailable storage safely behaves like an unseen
  world.
- `self` is always present immediately and is never treated as a newly learned
  memory.
- On the first reveal, all non-self nodes are new. Order them by breadth-first
  graph depth from `self`, preserving source order inside the same depth. This
  makes roots appear before the facts and patterns that grow from them.
- On later mounts, only node keys missing from the stored set are new. Already
  seen nodes and their existing relationships render fully on frame one.
- Begin the first new node after `160ms`. Stagger subsequent new nodes by
  `70ms`, within the established `30–80ms` decorative stagger range. The
  stagger never blocks the existing world or navigation.
- A new node starts at `scale 0.92`, opacity `0`, and `0.22` world units inward
  from its final radial position. It resolves outward toward the exact computed
  or saved rest position. Never start at `scale(0)`.
- Drive reveal progress in the existing rAF loop with elapsed time and the
  strong ease-out curve `cubic-bezier(0.23, 1, 0.32, 1)`. Add a pure cubic
  Bezier evaluator so the JS-driven Three animation uses that exact curve.
- Each node reveal lasts `680ms`. Position, scale, mesh opacity, halo opacity,
  and label opacity share the same progress so the object reads as one event.
- A connector involving a new node remains hidden until that node reaches
  `18%` progress, then draws from zero to its complete geometry as node progress
  moves from `18%` to `82%`. Use `BufferGeometry.setDrawRange`; do not rebuild
  the geometry per frame. Multiply its existing selection-aware opacity by the
  same connector progress.
- If both endpoints are new, the later/less-revealed endpoint controls the
  connector. Existing-to-existing connectors remain complete.
- The node label begins at `42%` reveal progress and reaches full intended
  opacity by `88%`, so text follows the object rather than arriving first.
- New nodes are not raycast-selectable or draggable until `90%` revealed.
  Existing nodes, camera navigation, the inspector, and bottom navigation
  remain usable throughout.
- Cursor vicinity ignores nodes below `100%` reveal. Birth position is purely
  presentational and must never enter saved manual layout positions.
- Mark a node key seen only after its reveal reaches `100%`. If the person
  leaves mid-reveal, unfinished nodes may reveal again next time.
- Under `prefers-reduced-motion: reduce`, skip radial translation, scale change,
  staggering, and connector drawing. Render the complete graph immediately and
  persist all current keys as seen. The graph remains fully functional.

## Repo conventions to follow

- Keep pure timing, storage, ordering, and easing logic in a focused module,
  following `app/app/orbMotion.ts` and `app/app/orbLayoutPersistence.ts`.
- Extend the one existing `requestAnimationFrame` loop in
  `app/app/YouView.tsx`; do not add another animation loop or dependency.
- Keep authored and manually saved rest positions untouched. Birth offset is a
  separate transient vector, like the existing cursor offset.
- Use the existing `updateConnectedLines` path for node position changes and
  `BufferGeometry.setDrawRange` for progressive connector visibility.
- Vitest pure helper tests live adjacent to the helper module.

## Steps

1. Add `app/app/orbBirth.ts` exporting:
   - `ORB_BIRTH_STORAGE_KEY = "chapter:you-world:seen-node-keys:v1"`;
   - `ORB_BIRTH_DELAY_MS = 160`, `ORB_BIRTH_STAGGER_MS = 70`,
     `ORB_BIRTH_DURATION_MS = 680`, `ORB_BIRTH_START_SCALE = 0.92`,
     `ORB_BIRTH_INWARD_DISTANCE = 0.22`,
     `ORB_BIRTH_EDGE_START = 0.18`, `ORB_BIRTH_EDGE_END = 0.82`,
     `ORB_BIRTH_LABEL_START = 0.42`, and `ORB_BIRTH_LABEL_END = 0.88`;
   - safe `loadSeenNodeKeys(storage, allowedKeys)` and
     `saveSeenNodeKeys(storage, keys)` helpers using the exact versioned shape;
   - `orderUnseenNodeKeys(nodes, edges, seenKeys, centreKey = "self")`, using
     breadth-first depth from the centre and stable source order;
   - `unitProgress(elapsedMs, delayMs, durationMs)` clamped to `[0, 1]`;
   - `strongEaseOut(progress)` evaluating the exact cubic Bezier
     `(0.23, 1, 0.32, 1)` by solving x for the clamped input and returning y;
   - `rangeProgress(progress, start, end)` for label and edge reveal windows.
2. Add `app/app/orbBirth.test.ts`. Verify corrupt/unavailable storage safety,
   allowed-key pruning, saved versioned shape, stable breadth-first ordering,
   exclusion of `self` and seen keys, disconnected-node fallback ordering,
   progress clamps, exact easing endpoints and monotonicity, and range windows.
3. In `app/app/YouView.tsx`, load seen keys after local storage is resolved.
   Resolve unseen keys and deterministic start delays once. Create per-node
   birth progress and inward-offset maps. `self` and seen nodes initialize at
   progress `1`; unseen nodes initialize at `0` and mesh opacity `0`.
4. Compute each transient inward offset from the node's rest position toward
   the local centre in the x/y plane, with a deterministic z component of zero.
   If the node is at the centre, use zero. Do not mutate `restPositions`.
5. Track halo materials and their authored base opacities for the current
   `self`/`experience` halos so a new experience halo fades with its parent
   rather than appearing as a ghost before the sphere.
6. Add `applyOrbBirthMotion(elapsedMs)` inside the existing render loop after
   cursor offsets are applied and before labels/lines are projected. For each
   new node, calculate raw progress from its start delay and `680ms` duration,
   apply `strongEaseOut`, set the final mesh position to
   `restPosition + cursorOffset + inwardOffset * (1 - easedProgress)`, and
   update its connected line geometry. Existing nodes stay at
   `restPosition + cursorOffset`.
7. Keep the existing hover/selection/drag target scale, but multiply it by
   `ORB_BIRTH_START_SCALE + (1 - ORB_BIRTH_START_SCALE) * easedProgress`.
   Multiply the current selection-aware mesh opacity target and each halo's
   base opacity by eased progress. Multiply intended label opacity by
   `rangeProgress(easedProgress, 0.42, 0.88)` and disable label pointer events
   until both its final opacity is interactive and raw progress is at least
   `0.9`.
8. Extend `RenderedConnection` with its total draw count. For each edge, resolve
   the lesser endpoint raw progress, map it through
   `rangeProgress(progress, 0.18, 0.82)`, set draw range to `0` when hidden and
   to at least `2` vertices once drawing begins, and multiply the existing
   selection-aware target opacity by edge progress. Do not allocate new
   geometry or vectors per frame.
9. Change `pickNode` to walk raycast hits and return the first node whose raw
   birth progress is at least `0.9`. Skip incomplete nodes in cursor-vicinity
   candidate selection.
10. When a node reaches raw progress `1` for the first time, add its key to the
    seen set and persist the pruned current set. Avoid writing storage on every
    frame. On reduced motion, finish and persist every node immediately.
11. Keep the present static `worldNodes`/`worldEdges` source. Do not add a fake
    node, demo button, timer-driven data mutation, Convex query, phone lookup,
    account assumption, or invented memory. This plan supplies the reveal
    lifecycle for the real current keys without pretending live identity/data
    plumbing has already been completed.
12. Update `BUILD_JOURNAL.md` with the exact distinction: outward placement was
    already present; the new work adds a one-time, identity-keyed visual reveal
    and intentionally does not claim a live account graph subscription.

## Boundaries

- Do NOT invent or add any graph node, edge, memory, evidence, or inference.
- Do NOT wire authentication, phone identity, or a Convex client in this plan.
- Do NOT replay seen nodes on ordinary revisits.
- Do NOT shift existing rest positions to make room or overwrite a person's
  manual layout.
- Do NOT block interaction with the already visible world.
- Do NOT add idle motion, bounce, particles, glow bursts, sound, confetti, or a
  second animation loop.
- Do NOT change camera behavior, orb sizes, category colours, label typography,
  inspector content, navigation, or graph semantics.
- Do NOT add a dependency.
- If the cited structure has drifted since commit `e758995`, STOP and report
  instead of improvising.

## Verification

- **Mechanical**: run `npm test`, `npm run lint`, `npm run build`, and
  `git diff --check`. Expect all tests to pass, zero lint errors (the four
  existing generated Convex warnings may remain), and a successful Next build.
- **First-reveal feel check**: in a fresh browser context at 1440×900, open
  `/app`. `You` is present immediately. The three roots begin first; their
  children follow outward in a calm branch order. No orb starts from zero size,
  no label appears before its sphere, and the full sequence settles in roughly
  `1.5s` without blocking panning or navigation.
- Capture frames around `0ms`, `350ms`, `800ms`, and `1500ms`. Confirm a new
  orb moves only `0.22` world units outward, scales only from `0.92`, and its
  attached lines progressively extend rather than flash on.
- Reload in the same browser context. The complete graph must render on frame
  one with no repeated birth sequence.
- Remove only `chapter:you-world:seen-node-keys:v1`, reload, and confirm the
  reveal plays once again without touching manually saved orb positions.
- In a test context pre-populated with every current key except one, reload and
  confirm only that unseen node and its involving connections reveal; the rest
  of the graph must not replay.
- During a reveal, drag or select a fully visible existing node and confirm it
  works. Attempt to select the translucent incoming node before `90%` and
  confirm it does not open accidentally.
- Emulate `prefers-reduced-motion: reduce` in a fresh context. The complete
  graph should appear immediately at final positions with full connectors and
  remain fully interactive.
- At 390×844, confirm the sequence remains inside the existing safe frame,
  causes no horizontal overflow, and does not collide with bottom navigation.
- Confirm zero browser-console errors and no React commits during the Three.js
  birth frames.
- **Done when**: new identity keys reveal once as outward-growing parts of the
  living graph, seen keys never replay, connections visibly form with their new
  node, saved layout remains pure, and reduced motion removes the spatial event.
