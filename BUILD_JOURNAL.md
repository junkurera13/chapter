# Build journal

## July 22, 2026 — migration day

### Starting point

Sidequest already had a finished interface and product direction. For this backend-focused competition, the goal was deliberately narrow: preserve every visible part of the frontend and rebuild the runtime backend with Base44.

I created a separate Base44 project and a separate local folder so the original Sidequest codebase remained untouched.

### Backend model

The existing data model was mapped into six Base44 entities:

- quests and their three real-world stops
- phone-based Sidequest profiles and onboarding state
- conversation history
- source memories
- experience-graph nodes
- experience-graph edges

Direct access is governed by entity access rules. The frontend only receives the exact shapes it needs from backend functions.

### AI quest generation

The main generation path moved into the `generate-quest` Base44 function. It:

1. accepts the user's free-text constraints;
2. calls Base44 `Core.InvokeLLM` with live web context;
3. requires a strict JSON schema with exactly three stops;
4. validates every field again in the function;
5. writes the result to the `Quest` entity; and
6. returns the existing `/q/<short-id>` URL shape expected by the UI.

This keeps model access, web grounding, validation, and persistence inside the Base44 backend.

### Existing UI integration

Only backend adapters and imports changed. The page markup, component markup, CSS, assets, motion, and routes were copied unchanged. The app's existing quest generator, mission page, admin list, user lookup, and signup upsert now call Base44 instead of Convex.

The browser SDK's default analytics initialization makes an anonymous `auth.me()` request. Because this app intentionally has public generation, the frontend uses Base44's public function HTTP endpoint instead; the deployed functions still use the Base44 SDK for all privileged work. This removed a harmless but noisy 401 without adding authentication UI or changing the product experience.

### Base44 agent

The project also includes `sidequest_composer`, a Base44 agent configured with user-scoped memory and the deployed `generate-quest` function as a tool. Its instructions preserve Sidequest's concise, friend-like voice and require specific, grounded places rather than generic suggestions.

### End-to-end proof

Two live Base44 quests were generated during verification. The latest test returned `/q/c6186ca7`, persisted it, rendered it from the production frontend, and surfaced it in the recent-quests admin view.

The final production pass checked:

- successful local and Vercel production builds;
- exact visible-text parity between original and competition routes;
- successful browser-side generation through Base44;
- successful Base44 quest reads from the mission and admin pages;
- zero production console errors; and
- `scrollWidth === clientWidth === 390` on the mobile mission and admin views.
