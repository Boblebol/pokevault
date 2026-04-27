# Focus Engagement Design

## Intent

Make Pokevault more engaging by turning passive collection data into short, useful sessions. The product goal is healthy retention: help the user complete the Pokédex without pulling them into noisy feeds, vanity sharing, or endless badge spam.

## Critical Product Stance

The original ideas mix four different loops: gamification, sharing, personal collections, searches, and completion help. Shipping all of them at once would dilute the app. The order below keeps the app focused:

1. Give the user one clear action now.
2. Explain why that action matters.
3. Let the user save intentional hunts.
4. Reward meaningful progress.
5. Only then make progress shareable.

Social sharing is intentionally delayed until the app can generate a valuable recap. Sharing a blank badge grid or generic percentage would feel cheap.

## Release Sequence

### Focus Session MVP

**User promise:** "I open the app and immediately know what to catch next."

Scope:
- Add a compact Focus panel in Collection and Statistics rails.
- Generate a 6-Pokémon session from missing entries in the current collection scope.
- Keep only one active session at a time in localStorage.
- Show progress as `N / 6`, a short checklist, and a clear end/reset action.
- Auto-complete checklist items when their Pokédex status becomes `caught`.
- Let each checklist item jump the user back to the Collection view with the relevant region and a narrowed search.

Deferred ideas from this release are tracked in
[../../POSTPONED.md](../../POSTPONED.md).

Success criteria:
- A user can start a session in under one click from stats or collection.
- The grid remains the main work surface.
- The session never asks the user to process more than six Pokémon at once.

### Next Best Action

**User promise:** "The app explains the best next target, not just a random missing one."

Scope:
- Extract a recommendation engine shared by Stats and Focus.
- Rank next targets using transparent heuristics:
  - Finish regions close to completion first.
  - Prefer "seen but not caught" over never-seen entries.
  - Prefer targets that advance the nearest badge.
  - Use current filters only when they help, never when they hide all useful targets.
- Add one "Pourquoi ?" line in the Focus panel explaining the recommendation.
- Add deep links for recommended targets.

No machine learning, remote popularity data or opaque scoring is planned for
this local recommendation engine.

Success criteria:
- The user understands why a target is recommended.
- The recommendation remains stable enough to trust during a session.

### Hunt List

**User promise:** "I can keep track of my own searches without losing my place."

Scope:
- Add a local-first "hunt" state per Pokémon:
  - `wanted`
  - `priority` (`normal` or `high`)
  - optional note
  - updated timestamp
- Add a "Mes recherches" filter in the Collection rail.
- Add quick actions in the Pokémon drawer and full view.
- Let Focus sessions prioritize hunt-list items when present.
- Include hunt data in export/import schema v3.

Deferred TCG marketplace and wishlist ideas are tracked in
[../../POSTPONED.md](../../POSTPONED.md).

Success criteria:
- A user can mark a Pokémon as actively searched from its drawer.
- A returning user can resume their hunt list without remembering filters.

### Badge Progression V2

**User promise:** "Badges show progress and guide the next session."

Scope:
- Extend badge definitions with progress metadata:
  - current value
  - target value
  - percent
  - next-step hint
- Surface the nearest badge in the Stats rail and Focus panel.
- Add a small set of meaningful session badges:
  - first completed session
  - region closer
  - hunt-list closer
- Keep unlocks monotonic.

Deferred streak and leaderboard ideas are tracked in
[../../POSTPONED.md](../../POSTPONED.md).

Success criteria:
- Locked badges stop feeling like dead tiles.
- Badge progress suggests what to do next.

## Architecture

The first release is frontend-only. It reuses `window.PokedexCollection` as the collection source of truth and persists session state to localStorage. This keeps the feature low-risk and compatible with the local-first model.

The shipped implementation uses small, focused modules rather than expanding
`web/app.js` further:

- `web/focus-session.js`: session state, planner, and panel rendering.
- `web/recommendations.js`: shared target ranking for Focus and Stats.
- `tracker/models.py` + hunt repository: hunt-list persistence.
- `tracker/services/badge_service.py`: badge progress metadata.

## Data Model

Focus Session localStorage:

```json
{
  "version": 1,
  "startedAt": "2026-04-26T12:00:00.000Z",
  "targetRegion": "johto",
  "targetLabel": "Johto",
  "slugs": ["0152-germignon"],
  "completed": ["0152-germignon"]
}
```

The `completed` list is derived again from current caught status on every render. Stored completion is only a UI convenience.

Persisted hunt shape:

```json
{
  "version": 1,
  "hunts": {
    "0152-germignon": {
      "wanted": true,
      "priority": "high",
      "note": "Chercher version holo",
      "updated_at": "2026-04-26T12:00:00.000Z"
    }
  }
}
```

## UI Design

Focus panels sit in the existing left rails. They must be compact, not a new dashboard:

- Title: `Session focus`
- Idle state: one sentence, one primary start button.
- Active state: progress, short reason, six target rows maximum.
- Completed state: recap and "Nouvelle session" button.

The panel must not use a marketing layout. It should feel like a workbench control: dense, readable, and close to filters.

## Error Handling

- If the Pokédex is not loaded, show a quiet loading state.
- If all scoped Pokémon are caught, show a completion state and do not start an empty session.
- If a stored session references slugs no longer in the current Pokédex scope, prune those slugs on render.
- If localStorage is unavailable, the panel still suggests a session but does not persist it.

## Testing

Focus Session:
- `node --check web/focus-session.js`
- `node --check web/app.js`
- `node --check web/stats-view.js`
- Static HTML id/script checks.
- Full Python regression suite.
- Manual UI verification on Collection and Stats.

Hunt List and Badge Progression:
- Add backend model/service tests before implementation.
- Add export/import tests for any new persisted shape.

## Release Gates

Each release must pass:
- Full test suite.
- JS syntax checks for touched files.
- Manual check on desktop and mobile widths.
- Changelog entry.
- Git tag only after the release branch is merged.

Release tags should follow the project semver line (`v1.x.y`) rather than the
historical planning labels in this document.
