# Trainer Cards

Trainer Cards are optional local contact files for collectors who want to trade
or compare wishlists without an account, cloud sync, public profile, or hosted
server.

## What it is

The core Pokedex remains the main product. The app uses three small
Pokemon-oriented actions everywhere:

- `Cherche`: this Pokemon is missing and goes into the local focus list.
- `Capturé`: this Pokemon is owned.
- `Double`: this Pokemon is owned twice and can be offered for trade.

The `Dresseurs` tab adds a searchable local contact book on top of that model.
Imported cards never mutate collection progress automatically. They only add
context such as `Vu chez` when another trainer has a Pokemon in `for_trade`, or
`Match` when that Pokemon is also in the local `Cherche` list.

## Create your Trainer Card

Open the `Dresseurs` tab and fill only the public fields you want to share:

- display name;
- favorite region;
- favorite Pokemon;
- public note;
- up to three optional contact lines, such as Instagram, Facebook, Téléphone,
  Email, Discord or a personal site;
- Pokemon you are looking for;
- Pokemon you marked as `Double` and can trade.

You do not need to describe the full collection. If you only want to say "I can
trade Leviator", mark that Pokemon as `Double` and leave the rest simple.

## Export and send it

Exporting a Trainer Card does not export the full collection. It only includes
the fields placed on the card: display name, favorite region, favorite Pokemon,
public note, optional contact links, wishlist, and trade list.

The exported file is meant to be sent manually by any channel you already use.
Pokevault does not upload it and does not create a public profile.

## Import a received card

When someone sends you a Trainer Card file, import it from the `Dresseurs` tab.
Pokevault stores the received card in the current local profile and makes it
searchable by trainer name, region, favorite Pokemon, contact lines such as
Instagram, Facebook or Téléphone, wishlist, trade list, and private notes.

Private notes are attached to your local contact copy. They are never included
when you export your own Trainer Card.

## Update a contact

There is no server sync. If a trainer updates their card, they send a new file.
Pokevault detects the stable `trainer_id` and updates the local contact when the
incoming `updated_at` is newer.

Deleting a received contact only removes the local copy from this profile; it
does not affect the exported card file or any other trainer.

## Find a trade

Trade context is derived from both sides:

- your `Cherche` list says what you want;
- your `Double` list says what you can offer;
- their received card says what they want and what they can offer.

The UI can then show:

- `Vu chez`: a received trainer has this Pokemon available in their trade list;
- `Match`: the Pokemon is both in your `Cherche` list and in a trainer's trade
  list.

This is intentionally conservative. Pokevault points to opportunities, but the
actual exchange remains a manual conversation between collectors.

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

If no `Match` appears, verify that you marked the Pokemon as `Cherche` locally
and that the received trainer marked the same Pokemon as available for trade.
