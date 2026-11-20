# 270 — Dégradé du haut : rien sous le fondu, racine immobile

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 049 (fondus du fil), 173 / 193 (sommaire, long fil), 261 (repère « Voir »)
- **Agents** : les deux (mise en page seule)

## Pourquoi

Défaut remonté par l'utilisateur : de temps en temps l'écran est calé trop haut et le haut du texte
passe sous le dégradé de la barre de titre (`.main-header::after`). Même décalage sur Mon activité
et les autres pages (capture : barre de titre rognée). Pistes : fiche 265 (premier message à moitié
sous le fondu), constat D26 de la recette du 2026-11-19 (la racine `#root` défile de 10 px après un
`scrollIntoView`, sans retour possible).

## Causes

1. **Défilement vers un élément sans tenir compte du fondu.** Le sommaire (`ConversationOutline`,
   `scrollIntoView({ block: 'start' })`), le message à rendre puis à montrer d'un long fil
   (`Transcript`, `reveal`, fiche 193), un focus, ou tout `scrollIntoView` posaient le haut du
   message au bord haut de `.main > .scroll`, soit exactement sous les 28 px du fondu (mesuré : haut
   à 52 px, bas du fondu à 80 px).
2. **`overflow: hidden` n'empêche pas de défiler.** `html`, `body` et `#root` étaient en `hidden` :
   pour le navigateur, ce sont encore des zones qui défilent (par script, focus, sélection). Dès
   qu'un contenu les dépassait, un `scrollIntoView` ou un focus décalait toute la fenêtre, barre de
   titre rognée, sans geste pour revenir (D26, capture de Mon activité).
3. **Même défaut dans la fenêtre des Réglages** (fenêtre basse, ≤ 520 px) : `.settings-dialog` en
   `hidden`, sa liste de rubriques plus haute qu'elle ; Tab jusqu'à « Données » faisait défiler la
   fenêtre des Réglages, en-tête « Données » rogné de 91 px.

Chemins relevés : sommaire (message rendu ou pas encore), `scrollIntoView` d'un message ou d'une
carte (outils, repère « Voir » en `center`), focus au clavier, recherche dans le fil (centrée, déjà
hors du fondu), côte à côte ; Tab dans Mon activité, Tâches planifiées, Réglages et ses rubriques,
panneau de droite, accueil.

## Correction

- `html, body, #root { overflow: clip }` : plus des zones qui défilent ; chaque page défile dans
  sa propre zone. Aucune fenêtre ne se servait de la racine pour défiler (aide, fenêtre rapide,
  À propos ont leur zone).
- `.main > .scroll` : `scroll-padding-top` et `scroll-padding-bottom` = hauteur du fondu + 8 px
  (`--thread-fade`, 28 px, aussi la hauteur des deux fondus). Tout défilement vers un élément
  (`scrollIntoView`, focus, sommaire, message à rendre, carte montrée) l'amène sous le fondu du
  haut et au-dessus de celui du bas ; le défilement à la main n'est pas touché, le fondu garde son
  rôle. Rien à changer dans les composants.
- `.settings-dialog` et `.search-dialog` en `overflow: clip` ; la liste des rubriques des Réglages
  défile dans sa colonne (`overflow-y: auto`).

## Critères d'acceptation

- [x] Un message visé (sommaire, message à rendre, `scrollIntoView`, fenêtre étroite avec panneau,
  côte à côte) commence sous le bas du fondu.
- [x] La racine et les en-têtes ne bougent jamais : ouverture, Tab dans toute la page, défilement,
  Semaine / Mois / Année, grille défilée, fenêtre étroite, contenu qui dépasse de la fenêtre.
- [x] Réglages en fenêtre basse : la liste des rubriques défile, l'en-tête reste.
- [x] Essai e2e `degrade-haut` (clair et sombre), rouge avant le correctif (24 échecs), vert après.

## Journal

- 2026-11-20 : reproduit par l'e2e `degrade-haut` sur le build de `main` : sommaire, message à
  rendre, `scrollIntoView`, fenêtre étroite, côte à côte (haut à 52 px sous un fondu finissant à
  80 px) ; contenu qui dépasse de 12 px amené à l'écran par le focus → `#root` à 12, toute l'app
  décalée (fil, Mon activité, Tâches planifiées) ; Réglages à 760 × 520, Tab → fenêtre des Réglages
  défilée de 27 à 124 px. Sans contenu qui dépasse, la racine ne bougeait pas dans les états
  essayés : le décalage naturel de Mon activité n'a pas été retrouvé tel quel, d'où l'essai qui
  simule le débordement (n'importe lequel suffit, avant le correctif).
- Essai : `e2e/suites/degrade-haut.mjs` (64 messages, `--inspect` pour la recherche dans le fil),
  captures `270-avant-*` (build de `main`) et `270-apres-*` : `sommaire`, `etroite`,
  `mon-activite`, `mon-activite-debord`, `mon-activite-etroite`, `reglages-bas`, clair et sombre.
- `./scripts/verify` vert ; `pnpm e2e degrade-haut sommaire long-thread repere finitions settings
  usage-board scheduled panel history pinned-plan parallel debordements onglets-etroits` : 28
  tâches vertes, une campagne.

- 2026-11-20, après fusion, suite complète de `main` : deux suites rouges, clair et sombre.
  - **`aide`** : l'image de « Premiers pas », 960 px sous l'écran, ne se chargeait plus.
    `loading="lazy"` : Chromium n'applique sa marge de chargement différé qu'à la fenêtre et aux
    zones qui défilent, pas à un ancêtre en `overflow: clip` ; elle ne se chargeait qu'une fois
    atteinte (sonde : `complete` faux à 1 782 px, vrai après `scrollIntoView`). Corrigé : images du
    guide chargées tout de suite (une par page, embarquées) — `HelpMarkdown.tsx`. Aucun autre
    `loading="lazy"`, aucun `IntersectionObserver` sans racine explicite, aucun
    `content-visibility` dans l'app.
  - **`repere`** (rouge 2 fois sur 3 sous charge, vert seul) : course dans `useThreadScroll`,
    trouvée en journalisant les écritures de `scrollTop` : l'essai remonte le fil (`scrollTop = 0`),
    le contenu glisse sous le pointeur posé sur une carte `data-scroll-hold`, le `pointerover`
    qui suit relâche la carte (`release`) avant l'événement `scroll` de l'image suivante, alors que
    le suivi du bas est encore actif : le fil repart en bas (6 ms après). Même chose pour un
    élément qui arrive ou un redimensionnement dans cet intervalle. Un vrai défaut, pas de l'essai
    (molette sur une carte de propositions). Corrigé : `noteScrolledUp` décroche du bas d'après la
    position réelle avant tout rattrapage (`release`, éléments, redimensionnement). Essai de
    composant ajouté, rouge sans le correctif. Pas établi que le lot l'ait fait apparaître : la
    course ne dépend pas du CSS ; elle se montrait sous la charge de la campagne.

## Limites connues

- À 640 px, la barre latérale (`.sidebar-body`, `overflow-x: hidden`) peut glisser de 7 px de côté
  quand le sélecteur Code / Discussion reçoit le focus : relevé par la sonde, hors de ce lot (pas
  d'en-tête rogné).
- La recherche dans le fil centre le résultat elle-même (`scrollBy`) : hors du fondu tant que la
  ligne trouvée tient dans la moitié du fil.
