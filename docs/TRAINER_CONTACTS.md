# Trainer Cards

Trainer Cards are optional local contact files for collectors who want to trade
or compare wishlists without creating an account.

The Pokédex UI uses three small Pokemon-oriented actions:

- `Cherche`: this Pokemon is wanted and goes into the local focus list.
- `J'ai`: this Pokemon is owned.
- `Double`: this Pokemon is owned and can be offered for trade.

`Double` is the only action that adds a Pokemon to the exported trade list.
Imported cards never mutate collection progress automatically. They only add
context such as `Vu chez` when another trainer has a Pokemon in `for_trade`,
or `Match` when that Pokemon is also in the local `Cherche` list.

The app stores received cards in `data/trainer-contacts.json` for the default
profile, or `data/profiles/<id>/trainer-contacts.json` for additional profiles.
The file is user state and is not versioned by Git.

The `Dresseurs` tab also acts as a searchable local contact book. Received
cards can be searched by trainer name, region, favorite Pokemon, contact lines,
wishlist, trade list and private notes. Private notes stay local to the contact
book and are never included in exported Trainer Cards.

Exporting a Trainer Card does not export the full collection. It only includes
the fields the user placed on their card: display name, favorite region,
favorite Pokemon, public note, optional contact link, wishlist and trade list.

There is no server sync. If a trainer updates their card, they send a new file;
Pokevault detects the stable `trainer_id` and updates the local contact when the
incoming `updated_at` is newer.

Deleting a received contact only removes the local copy from this profile; it
does not affect the exported card file or any other trainer.
