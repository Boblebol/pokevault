# Trainer Contact Book Design

Date: 2026-04-30

## Context

Trainer Cards already provide a local-first way to create a personal card,
export it as a file, import another trainer's card, and update an existing
contact when the incoming card has the same stable `trainer_id` and a newer
`updated_at`.

The next increment turns the optional `Dresseurs` tab into a usable local
contact book without changing the core Pokedex flow.

## Goals

- Keep Trainer Contacts optional and isolated from the default Pokedex views.
- Make received contacts easy to scan and search.
- Show each contact's useful card data without requiring another screen.
- Let the user keep a private local note per contact.
- Let the user delete a received contact intentionally.
- Keep all data local, portable, and profile-scoped.

## Non-Goals

- No account, cloud sync, server-to-server exchange, or automatic updates.
- No changes to Trainer Card import/export file format.
- No compatibility matching with the user's collection in this increment.
- No modal-heavy or wizard-style flow.

## Architecture

The backend already exposes the endpoints needed for this increment:

- `GET /api/trainers` loads the current trainer contact book.
- `PATCH /api/trainers/{trainer_id}/note` saves a private note.
- `DELETE /api/trainers/{trainer_id}` removes a received contact.

No new backend model is required. `private_note` remains stored only in the
local `contacts[id].private_note` field and is never included in exported
Trainer Cards.

Frontend work stays scoped to `web/trainer-contacts.js` and the related styles
in `web/styles.css`. The main Pokedex navigation keeps `Dresseurs` as an
optional tab, and no default Pokedex view depends on this feature.

## User Experience

The `Dresseurs` tab keeps the existing personal card form and import/export
actions. The received contacts section gains:

- a search input above the contact list;
- richer contact cards with display name, public note, favorite region,
  favorite Pokemon, last received date, contact links, `Cherche`, and
  `Echange`;
- a private note textarea per contact with an explicit save button;
- a discrete delete button per contact with browser confirmation;
- an empty state when there are no contacts or no search results.

There is no new route, drawer, or modal. The user can manage contacts directly
inside the optional tab.

## Data Flow

On start, the client loads the contact book from `GET /api/trainers` and keeps a
normalized in-memory copy for rendering.

Search is local-only. It matches against:

- display name;
- favorite region;
- favorite Pokemon slug;
- public note;
- private note;
- contact link labels and values;
- `wants`;
- `for_trade`.

Saving a private note sends `PATCH /api/trainers/{trainer_id}/note`, reloads the
book on success, and shows a short status message.

Deleting a contact asks for confirmation, sends
`DELETE /api/trainers/{trainer_id}`, reloads the book on success, and shows a
short status message.

## Error Handling

If loading, note saving, or deletion fails, the UI shows a readable error inside
the `Dresseurs` tab. The client does not pretend a note was saved or a contact
was removed until the API call succeeds and the book reloads.

Malformed or incomplete contacts are already ignored by the existing
normalization layer and should continue to be skipped rather than breaking the
whole tab.

## Testing

Backend coverage should remain unchanged unless the existing endpoints need
adjustment. Frontend tests should cover:

- local search filtering;
- rendering of `Cherche` and `Echange` lists;
- saving a private note through the PATCH endpoint;
- deleting a contact after confirmation;
- preserving a contact when deletion is cancelled;
- visible error messaging for failed API calls.

Documentation should mention the contact book capabilities in the Trainer Cards
documentation and public docs surfaces if user-facing behavior changes.
