# Grand Classeur 3x3 A Anneaux

## Objectif

Ajouter un type de classeur pour un gros classeur physique a anneaux avec
feuilles 3x3 recto-verso. Le but est de ranger toute la collection dans un seul
classeur, sans generer un classeur separe par region.

## Decisions Validees

- Le nouveau type cree un seul classeur physique.
- Le classeur est organise en sections par region.
- Chaque region commence au recto d'un nouveau feuillet.
- Les familles d'evolution sont compactees dans chaque region.
- Les evolutions inter-regions restent separees: chaque Pokemon reste dans sa
  region d'origine.
- Les formes regionales se rangent dans leur region de forme: Rattata reste en
  Kanto, Rattata d'Alola va en Alola, Miaouss de Galar va en Galar et
  Typhlosion de Hisui va en Hisui.
- Le perimetre par defaut est `base_regional`: formes de base + formes
  regionales, sans Mega, Gigamax ou formes speciales.
- Les sections suivent les regions internes existantes du Pokedex, y compris les
  petites sections comme Meltan et Hisui.
- Le nombre de feuillets est calcule automatiquement pour tout faire rentrer,
  puis l'app ajoute 10 feuillets de marge globale.

## Experience Produit

Le wizard classeur expose une option explicite du type `Grand classeur 3x3`.
Cette option n'est pas le meme comportement que `Par region` actuel:

- `Par region` continue de creer plusieurs classeurs physiques regionaux.
- `Grand classeur 3x3` cree un seul classeur avec sections regionales internes.

Le recap du wizard doit indiquer:

- 3 x 3 cases par page;
- recto-verso;
- nombre de feuillets calcule;
- capacite totale;
- organisation par regions avec debut au recto;
- familles compactes par region;
- marge globale de 10 feuillets.

## Modele De Donnees

Le backend accepte deja des objets libres dans `binder-config.json`. La feature
peut rester compatible avec le schema actuel en ajoutant un nouveau marqueur
dans l'objet classeur, par exemple:

```json
{
  "organization": "regional_family_album",
  "rows": 3,
  "cols": 3,
  "sheet_count": 72,
  "form_rule_id": "wizard-forms-base_regional",
  "layout_options": {
    "region_break": "new_sheet",
    "family_compact": true,
    "auto_capacity": true,
    "margin_sheets": 10
  }
}
```

Le marqueur retenu est `organization: "regional_family_album"`. Il reste
distinct de `by_region`, qui conserve son sens actuel: plusieurs classeurs
physiques regionaux.

## Algorithme De Layout

Le moteur de layout ajoute un chemin dedie pour `regional_family_album`.

1. Selectionner le pool de Pokemon avec la regle `base_regional`.
2. Iterer les regions dans l'ordre existant des definitions du Pokedex.
3. Pour chaque region, filtrer les Pokemon dont la region effective correspond a
   la section courante.
4. Appliquer le layout compact par familles sur ce sous-ensemble uniquement.
5. Ajouter ces slots a la sortie.
6. Avant la region suivante, completer avec des `capacity_empty` jusqu'au prochain
   recto de feuillet.
7. Calculer le nombre minimal de feuillets necessaires, puis ajouter 10 feuillets
   de marge a la fin.

Les `capacity_empty` restent des vides discrets: ils sont visibles comme cases
vides dans le classeur, mais ne sont pas imprimes dans les petites fiches.
Les `family_reserved` restent des reservations intentionnelles et continuent de
s'imprimer comme placeholders.

## Interfaces Touchees

- `web/binder-v2.js`: wizard, preset, generation du payload et calcul
  auto-capacite.
- `web/binder-layout-engine.js`: nouveau mode de tri/layout pour le grand
  classeur.
- `web/binder-collection-view.js`: affichage et navigation doivent fonctionner
  avec un seul classeur tres long.
- `web/print-view.js`: les petites fiches doivent conserver la logique actuelle
  sur `capacity_empty`, `alignment_empty` et `family_reserved`.
- Docs README/public docs/in-app docs: mentionner le nouveau type sans remplacer
  les modes existants.

Le backend ne devrait pas avoir besoin de nouveau endpoint.

## Tests

Ajouter ou adapter des tests sur:

- creation du payload wizard pour le grand classeur 3x3;
- calcul auto du nombre de feuillets avec marge globale de 10;
- debut de chaque region au recto d'un nouveau feuillet;
- familles compactes appliquees dans une region;
- evolution inter-region separee entre deux sections;
- impression: les vides discrets ne s'impriment pas, les reservations famille
  restent imprimables;
- docs: le nouveau type est documente.

## Hors Scope

- Editeur avance de toutes les regles de layout.
- Fusion manuelle de petites regions.
- Duplication visuelle des evolutions inter-regions.
- Gestion de plusieurs gros classeurs.
- Nouveau schema backend strict.
