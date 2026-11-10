# 159 — Densité compacte et mode présentation

- **Statut** : fait
- **Dépend de** : 134 (jetons de thème, ADR-0027), 136 (page Apparence), 068 (son), 024
  (notifications), 019 / 091 / 144 (consommation, quota, Mon activité)
- **Agents** : les deux. Rien ne dépend de l'agent.
- **Reprend** : lot F de la feuille de route (« Apparence »).

## Pourquoi

Deux besoins d'apparence que les réglages actuels ne couvrent pas :

1. Voir plus de conversation à l'écran : une **densité compacte** resserre messages, cartes d'outils
   et lignes de la barre latérale.
2. Faire une démo ou partager l'écran sans exposer ce qui n'a rien à y faire : un **mode
   présentation** agrandit le texte du fil, remplace le dossier personnel par `~`, masque les coûts
   et le quota, coupe bannières et sons.

## Critères d'acceptation

- [x] Réglages › Apparence › Fil : « Densité » (Normale / Compacte), enregistrée (`density`) ;
      par défaut Normale ; une valeur inconnue sur le disque est ignorée (test).
- [x] La densité passe par des **jetons** de `shared/themes.ts` (`DENSITY_TOKENS`, variables
      `--density-*`) générés dans `themes.generated.css` (`[data-density='compact']`) : le CSS lit
      les variables, aucune règle compacte éparpillée. Le test de contrastes reste vert.
- [x] Compacte : moins d'espace entre messages, dans les cartes d'outils et entre les lignes de la
      barre latérale ; la barre latérale n'a toujours **aucun second niveau de retrait**.
- [x] Mode présentation : interrupteur dans Affichage › « Mode présentation » (menu de l'app,
      coché quand actif) et dans Réglages › Apparence ; les deux restent synchronisés.
- [x] Actif : texte du fil +3 px ; chemins du dossier personnel en `~` partout où ils s'affichent
      (test unitaire du raccourcissement) ; puce de consommation, quota de la barre latérale, coûts
      des sous-agents / tâches et Mon activité (coûts, quota, compte) masqués ; notifications
      macOS, son, rebond du Dock et compteur coupés (le « Écouter » des Réglages joue encore).
- [x] Une pastille discrète « Présentation » rappelle le mode tant qu'il est actif (clic : le quitter).
- [x] Non retenu d'un lancement à l'autre (état du main en mémoire, jamais dans `settings.json`).
- [x] Textes fr / en, e2e (clair et sombre) écrite, `./scripts/verify` vert.

## Plan

- `shared/themes.ts` : `DENSITIES`, `DENSITY_TOKENS`, `densityVariables()` ; `scripts/themes-css.mts`
  les écrit (normal sur `:root`, compact sur `:root[data-density='compact']`).
- `shared/preferences.ts` (+ `settings.ts`, `settings-store.ts`) : `density`.
- `shared/presentation.ts` : `abbreviateHome()`, `PRESENTATION_FONT_BOOST`.
- main : `presentation.ts` (état + écouteurs), canaux `app:presentation` / `app:setPresentation` /
  évènement `app:presentation`, case du menu Affichage, bannières / son / rebond / compteur coupés.
- renderer : `presentation.ts` (store `useSyncExternalStore`), pastille, ligne des Réglages,
  `appearance.ts` (densité, taille du fil), coûts et chemins masqués.
- CSS : `styles.css` lit les variables de densité.

## Journal

- 2026-10-28 : fiche créée. « Menu Présentation » du lot = le menu **Affichage** (celui de
  `menu.view`, où se trouve le zoom).
- 2026-10-28 : implémenté.
  - **Densité** : `DENSITY_TOKENS` dans `shared/themes.ts` (six espaces verticaux), écrits par
    `pnpm themes-css` (`:root` pour la normale, `:root[data-density='compact']`) ; `styles.css`
    ne lit que `var(--density-*)` (fil, bulle de l'utilisateur, ligne d'outil, détails d'outil,
    ligne de la liste et son lien mère-fille, espace avant une section). Jamais de retrait.
  - **Présentation** : état dans le main (`main/presentation.ts`), canaux `app:presentation`,
    `app:setPresentation` et évènement `app:presentationChanged` ; le menu Affichage est
    reconstruit à chaque changement (case cochée). Bannières, compteur du Dock, son et rebond
    coupés au branchement dans `index.ts` ; le bouton « Écouter » des Réglages joue encore.
    Renderer : `presentation.ts` (store `useSyncExternalStore`, `data-presentation`), pastille
    `PresentationPill`, taille du fil +3 px (`appearance.ts`).
  - **Chemins** : `abbreviateHome` / `abbreviateHomeIn` (`shared/presentation.ts`) appliqués aux
    cartes d'outils (titre, infobulle, emplacements), diffs, liens de fichier, menu du dossier,
    Serveurs MCP et Commandes. Les listes qui abrègent déjà toujours (reprise, Conversations)
    sont inchangées.
  - **Masqué** : puce de consommation (`withoutCost`), quota de la barre latérale, coûts des
    sous-agents et des conversations filles, Mon activité (KPI de coût, colonnes de coût, mesures
    en coût du graphique, comptes des agents).
  - **Pourquoi pas retenu** : on ne veut pas relancer l'app, un autre jour, sans coûts ni
    bannières sans l'avoir demandé ; aucune bonne raison trouvée de le garder.
  - Écart : le « menu Présentation » du lot est le menu **Affichage** (pas de menu de ce nom).
    L'en-tête de conversation n'affiche aucun montant (déjà vrai, voir fiche 113).
  - e2e : nouvelle suite `presentation` (clair et sombre, `pnpm e2e presentation`), non lancée ici.
- 29/10, intégration (tech lead) : e2e `presentation` lancé avec `--inspect`, et Réglages › Apparence
  rouverte explicitement (les Réglages s'ouvrent sur Général). Suite e2e complète verte.
