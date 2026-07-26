# Build journal

## July 22, 2026 — memory-first foundation

The current competition build contains only the foundation of Chapter:

- Base44 Google authentication and private account ownership;
- in-app phone connection and Photon shared-line signup;
- the signed iMessage webhook;
- idempotent conversation storage and delivery tracking;
- one-experience onboarding and structured memory extraction;
- private experience-graph nodes and edges; and
- the interactive **You** world backed by the authenticated graph.

The **Now** experience is intentionally unimplemented. The next product step is
to design that experience from the new vision instead of inheriting any earlier
generation format.

## July 22, 2026 — people become real connections

The people layer now preserves individual identity and introduces the first
careful piece of **Together**:

- the extraction prompt requires one node per explicitly named person and
  forbids collapsing named friends into a generic group;
- the existing Fukuoka graph was migrated surgically from one Travel
  Companions node to Daniel, Samuel, Shinmog, and Aron without regenerating the
  rest of the graph;
- a people-node modal can create a private, single-use connection invite;
- Base44 stores only the SHA-256 token hash and resolves acceptance through the
  exact invite, never a name match;
- accepting creates an accepted connection, links the inviter’s existing node,
  and creates a reciprocal people node for the invitee without copying private
  memory evidence; and
- Together lists accepted people and pending invitations, while shared **Now**
  experiences remain explicitly unimplemented.

Verification passed with 46 tests, ESLint, a Next.js production build, Deno
type-checking, live Base44 graph/invite calls, and a 390px public invitation
browser pass with no console errors or horizontal overflow. A genuine second
Google account is still required to perform the final human acceptance click.
