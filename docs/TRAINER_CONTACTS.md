# Trainer Cards

Trainer Cards are optional local contact files for collectors who want to trade
duplicates without an account, cloud sync, public profile, or hosted server.

## What it is

The core Pokedex remains the main product. The simplified collection model keeps
only the states that matter during play:

- a missing Pokemon has no local status and is implicitly still needed;
- `Capturé` means the Pokemon is in your collection;
- `Double` means the Pokemon is captured and can be offered for trade;
- `Relâcher 1` removes the tradeable duplicate while keeping `Capturé`;
- `Relâcher` removes the last local copy from progress.

The `Dresseurs` tab adds a searchable local contact book on top of that model.
Imported cards never mutate collection progress automatically. They only add
`Vu chez` when another trainer has a duplicate for a Pokemon you have not
captured yet.

## Create your Trainer Card

Open the `Dresseurs` tab and fill only the public fields you want to share:

- display name;
- favorite region;
- favorite Pokemon;
- public note;
- up to three optional contact lines, such as Instagram, Facebook, Téléphone,
  Email, Discord or a personal site;
- Pokemon you marked as `Double` and can trade.

You do not need to describe the full collection. If you only want to say "I can
trade Leviator", mark that Pokemon as `Double` and leave the rest simple.

Trainer Cards do not export a wishlist. Every Pokemon you have not captured is
already treated as something you still need. Trainer Cards also do not export
badges; badge progress stays in your local stats and full backups.

## Export and send it

Exporting a Trainer Card does not export the full collection. It only includes
the public fields placed on the card: display name, favorite region, favorite
Pokemon, public note, optional contact links, duplicate trade list, and update
timestamp.

The exported file is meant to be sent manually by any channel you already use.
Pokevault does not upload it and does not create a public profile.

## Import a received card

When someone sends you a Trainer Card file, import it from the `Dresseurs` tab.
Pokevault stores the received card in the current local profile and makes it
searchable by trainer name, region, favorite Pokemon, contact lines such as
Instagram, Facebook or Téléphone, duplicate trade list, and private notes.

Private notes are attached to your local contact copy. They are never included
when you export your own Trainer Card.

Legacy card files that still contain `wants` or `badges` can be accepted for
compatibility, but those fields are ignored and are not written back by new
exports.

## Update a contact

There is no server sync. If a trainer updates their card, they send a new file.
Pokevault detects the stable `trainer_id` and updates the local contact when the
incoming `updated_at` is newer.

Deleting a received contact only removes the local copy from this profile; it
does not affect the exported card file or any other trainer.

## Find a trade

Trade context is intentionally one-sided and conservative:

- your missing Pokemon are inferred from local progress;
- a trainer's `Double` list says what they can offer;
- `Vu chez` appears when a received trainer has a duplicate that you have not
  captured yet.

There is no `Match` state because the app no longer stores a manual wishlist.
Pokevault points to opportunities, but the actual exchange remains a manual
conversation between collectors.

## Privacy and local files

The app stores received cards in `data/trainer-contacts.json` for the default
profile, or `data/profiles/<id>/trainer-contacts.json` for additional profiles.
The file is user state and is not versioned by Git.

Full backups and Trainer Cards are separate. A full backup is for restoring your
workspace. A Trainer Card is a small portable contact file you choose to share.

## Troubleshooting

If an import fails, check that the file is a Trainer Card export rather than a
full backup. The card should contain a stable `trainer_id`, an `updated_at`
timestamp, and the public card fields.

If a contact does not update, the received file may be older than the local
copy. Ask the trainer to export a fresh card and import that file again.

If no `Vu chez` appears, verify that the received trainer marked that Pokemon as
`Double` and that you have not captured it locally.
