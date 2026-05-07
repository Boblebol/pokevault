# V1.1 Pokédex-First Backlog

This backlog captures the current simplified direction after the cleanup of the
old dual fiche views and removed card-catalog workflow.

## Product Goal

Make Pokevault feel like a focused Pokédex notebook:

- capture what you own;
- mark duplicates for real exchanges;
- release one duplicate or the last local copy;
- keep badges unlocking gradually;
- keep binders and printouts aligned with the same local progress;
- show useful game Pokédex context inside one Pokemon modal.

## Status Model

Active states are intentionally limited:

- `not_met`: no local capture yet;
- `seen`: derived context such as `Vu chez` from imported Trainer Cards;
- `caught`: captured locally;
- duplicate ownership: stored by the capture workflow and exported on Trainer
  Cards as `for_trade`.

Every uncaptured Pokemon is implicitly wanted. There is no separate search list,
mission list or focus queue.

## Pokemon Modal

The app uses a single modal instead of separate right-side and full-screen
fiches. Any entry point should open that same surface:

- list tile details action;
- keyboard shortcut `i`;
- legacy `#/pokemon/:slug` links;
- future binder or stats links.

The modal contains:

- identity and artwork;
- status and ownership actions;
- related forms;
- personal note;
- defensive type matchups;
- appearances in game Pokédex definitions from `data/game-pokedexes.json`.

## Trainer Cards

Trainer Cards stay as a manual exchange file. They share only duplicate Pokemon
through `for_trade`. Legacy `wants` and `badges` fields are tolerated during
import but ignored.

`Vu chez` is derived only when a contact has a duplicate and the local profile
does not already have that Pokemon captured.

## Binders And Print

Binders remain a core workflow:

- default 3×3 · 10-sheet layout;
- configurable rows, columns and sheet count;
- Grand classeur 3x3 / large 3x3 ring binder mode uses one ring binder with
  3×3 front/back sheets, internal region sections, starts each region on a
  sheet front (recto), keeps families compact per region, keeps regional forms
  in their form region, and calculates capacity with 10 spare sheets;
- compact evolution-family ordering;
- `alignment_empty` gaps are not printed;
- intentional `family_reserved` placeholders still print as temporary small
  binder cards.

## Reference Data

`data/game-pokedexes.json` is the new reference layer for game Pokédex
definitions and appearances. It is versioned, served statically, and should grow
through small reviewed additions rather than ad hoc UI fields.

## Migration Rules

The cleanup is allowed to be breaking for removed surfaces, but old data should
not corrupt the active app:

- old explicit search-list files are ignored and omitted from new backups;
- removed badge ids are cleaned or ignored;
- removed physical Pokemon card catalog data is ignored and omitted from new
  backups;
- current exports include progress, binders, profiles, badges and Trainer
  contacts only.

## Next Tickets

1. Expand the game Pokédex reference file beyond the initial compact dataset.
2. Add modal links from stats and binder contexts where useful.
3. Keep docs and tests enforcing the simplified model.
