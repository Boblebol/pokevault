# Backlog Repoussé

Ce document liste les idées connues mais volontairement repoussées. Elles ne
font pas partie de la roadmap active et ne doivent pas être lues comme des
engagements de version.

La règle produit reste la même : Pokevault est un tracker local-first centré sur
le Pokédex. Une idée ne revient dans la roadmap active que si elle renforce ce
flux sans ajouter de dépendance cloud obligatoire, de bruit social ou de dette de
maintenance disproportionnée.

## Expérience Sociale

### Récap partageable

Statut : repoussé.

Créer une image ou une page de recap partageable peut être utile plus tard, mais
pas avant que l'application sache produire un bilan réellement intéressant :
progression régionale, badges, recherches, cartes cataloguées. Partager un
pourcentage brut ou une grille vide n'apporte pas assez de valeur.

### Profil public, wishlist publique et leaderboard

Statut : hors roadmap active.

Ces fonctions tirent le produit vers un modèle réseau/social. Elles sont
repoussées tant que le projet assume une promesse locale : pas de compte, pas de
cloud, pas de classement public.

## Engagement

### Streaks et badges quotidiens

Statut : repoussé.

Les sessions Focus et la progression de badges existent déjà. Les streaks et les
badges quotidiens sont repoussés pour éviter une boucle de rétention artificielle
avant d'avoir assez de recul sur l'usage réel.

### Constructeur de session Focus

Statut : repoussé.

Aujourd'hui, une session Focus reste volontairement courte et automatique. Un
constructeur manuel par région, tag, type ou classeur sera réévalué si les
sessions automatiques deviennent trop limitées pour les usages avancés.

## Cartes TCG

### Liens marketplace et suivi de prix

Statut : repoussé.

Le modèle de cartes actuel sert à enrichir une entrée Pokédex avec les cartes
physiques possédées. Les prix, vendeurs, marketplaces et alertes d'achat ajoutent
des dépendances externes et un coût de maintenance élevé. Ils restent hors scope
tant que le produit n'a pas besoin de données marchandes.

## Données Pokédex

### Descriptions Poképedia

Statut : repoussé.

La fiche complète affiche déjà l'identité, les types, les faiblesses, les autres
formes et les cartes possédées. Les descriptions longues demandent une extension
plus fragile du scraper Poképedia. Elles restent repoussées pour ne pas mettre
en risque la stabilité du Pokédex de référence.

Les chaînes d'évolution sont sorties du backlog repoussé uniquement sous forme
d'audit et de metadata contrôlée dans
[`V1_1_POKEDEX_FIRST.md`](V1_1_POKEDEX_FIRST.md). Elles ne doivent pas ajouter
d'appel réseau au runtime.

## Profils

### Renommage de profil

Statut : repoussé.

Le multi-profils permet aujourd'hui de créer, sélectionner et supprimer des
profils. Le renommage est utile mais non bloquant : l'utilisateur peut créer un
nouveau profil avec le bon nom et supprimer l'ancien si besoin.

## Sortie Du Backlog Repoussé

Pour promouvoir une idée dans la roadmap active, il faut :

- une user story précise ;
- des critères d'acceptation testables ;
- une stratégie local-first claire ;
- une estimation d'effort ;
- une décision explicite dans `docs/ROADMAP.md` ou dans un nouveau plan daté.
