# Remove Pokedex Multi-Profiles Design

## Goal

Remove the Pokedex multi-profile feature completely. Pokevault returns to a single local collection state stored in the historical files under `data/`.

This is an accepted breaking change. The `/api/profiles` endpoint, profile switching UI, profile registry models, and profile-scoped path resolver are removed.

## User State

The active user state lives only in these gitignored files:

- `data/collection-progress.json`
- `data/binder-config.json`
- `data/binder-placements.json`
- `data/trainer-contacts.json`

Existing legacy files are not deleted automatically:

- `data/profiles.json`
- `data/profiles/<id>/...`

Those files become ignored local leftovers. The app does not read, write, migrate, expose, or document them as active storage.

## Backend Architecture

FastAPI dependencies instantiate JSON repositories directly from `TrackerSettings` paths:

- progress uses `settings.progress_path`
- binder config uses `settings.binder_config_path`
- binder placements uses `settings.binder_placements_path`
- trainer contacts uses `settings.trainer_contacts_path`

`ProfileService` is removed because no runtime component resolves an active profile anymore. `TrackerSettings.profiles_registry_path` is removed for the same reason.

The profile controller is removed from the API controller package and is not mounted by `tracker.app.create_app`. `/api/profiles` returns 404 like any removed route.

## API Models

The following Pydantic models are removed from `tracker.models`:

- `Profile`
- `ProfileRegistry`
- `ProfileCreate`
- `ProfileSwitchBody`
- `ProfileListResponse`
- `ProfileDeleteResponse`

No export/import schema changes are needed because current backups already contain the single active state: progress, binder config, and binder placements.

## Frontend

The Settings page keeps the onboarding preference card and backup actions, but removes the "Pokedex multi-profils" card.

`web/profiles.js` is deleted and no longer loaded by `web/index.html`. `setupProfileSwitcher` and profile-switching translation keys are removed from `web/app.js` and `web/i18n.js`.

The onboarding UI profile summary remains because it is local UI preference state stored in `localStorage` under `pokevault.ui.profile`; it is not the removed server-side multi-profile feature.

## Documentation

Public docs and in-app docs stop advertising profile-scoped state or `/api/profiles`.

Docs describe the single local state files under `data/`, backup export/import, and legacy profile files as ignored leftovers only where a legacy note is useful.

## Testing

Backend tests are updated so dependencies no longer require a `ProfileService` fixture. Profile service and profile API tests are deleted.

App tests add or update coverage confirming `/api/profiles` is not mounted.

Documentation and web tests are adjusted to match the removed Settings card, removed script, removed API endpoint, and single-state copy.

The final verification target is:

- `make check`

