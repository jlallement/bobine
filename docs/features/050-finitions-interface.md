# 050 — Finitions de l'interface : fil, défilement, barre latérale

- **Statut** : fait
- **Dépend de** : 014, 049

## Pourquoi

Retours de l'utilisateur (2026-10-14, captures à l'appui) : les boutons au survol de la dernière
réponse (copier, heure) se mêlent à l'indicateur « Écrit… » ; le dégradé sous la barre de titre est
trop marqué, il en faudrait un aussi au-dessus de la zone de saisie, avec une flèche pour revenir
en bas du fil ; en haut de la barre latérale, les éléments sont mal alignés (« Nouvelle
conversation » décalé, icône plus grosse, bouton de la barre latérale plus bas que les feux de la
fenêtre).

## Critères d'acceptation

- [x] Les boutons au survol de la dernière réponse ne touchent plus l'indicateur d'activité
      (vérifié par la géométrie dans l'e2e).
- [x] Dégradé du haut plus subtil : le fil se fond dans le fond de la fenêtre au lieu d'une ombre.
- [x] Même fondu en bas, juste au-dessus de la zone de saisie, quand il reste du fil en dessous.
- [x] Flèche « Aller en bas » au-dessus de la zone de saisie quand on a remonté le fil ; un clic
      redescend (en douceur) et le fil recolle au bas.
- [x] Barre latérale : icônes de « Nouvelle conversation » et « Rechercher » de même largeur,
      libellés alignés ; bouton de la barre latérale centré sur la hauteur des feux de la fenêtre
      (réglé par le calcul, confirmé à l'écran par l'utilisateur).
- [x] e2e et captures claires et sombres regardées.

## Plan

1. `styles.css` : marge de l'indicateur d'activité ; fondus (`--bg`) haut et bas pilotés par le
   défilement (`scroll-timeline`, fiche 049) ; colonne d'icônes de la barre latérale.
2. `App.tsx` : zone de saisie dans un conteneur (`composer-dock`) qui porte le fondu du bas et la
   flèche ; état « en bas du fil » tenu par le défilement.
3. `main/index.ts` : position des feux de la fenêtre (`trafficLightPosition`) alignée sur la barre.
4. e2e : géométrie, fondus, flèche ; captures.

Aucune nouvelle dépendance.

## Journal

- 2026-10-14 — Fiche créée d'après les captures de l'utilisateur.
- 2026-10-14 — **Fait.**
  - Indicateur d'activité : marge du haut 6 px au lieu de −10 px ; les boutons au survol de la
    dernière réponse (24 px sous elle) ne le touchent plus (6 px d'écart mesurés dans l'e2e).
  - Fondus : le fil se fond dans `--bg` (plus d'ombre) sur 28 px, sous la barre de titre dès que
    le fil défile, et au-dessus de la zone de saisie tant qu'il en reste dessous ; même ligne de
    temps de défilement que la fiche 049.
  - Flèche « Aller en bas » (`scroll-to-bottom`) au-dessus de la zone de saisie dès qu'on n'est
    plus en bas du fil (seuil de 60 px, celui du recollage automatique) ; défilement doux, le fil
    recolle ensuite. Conteneur `thread-dock` autour de la zone de saisie.
  - Barre latérale : colonne d'icônes de 20 px (rond de « Nouvelle conversation » ramené de 22 à
    20 px, « + » de 13 px) : libellés alignés (48 px et 48 px dans l'e2e).
  - Feux de la fenêtre : `trafficLightPosition: { x: 18, y: 19 }`. Sur la capture de
    l'utilisateur, leur centre était ≈ 9 px au-dessus de celui du bouton de la barre latérale
    (barre de 52 px) ; décalés d'autant. **Pas vérifié à l'écran** : les captures e2e ne montrent
    que le contenu web, et la capture native de la fenêtre a été refusée (pas d'autorisation
    « Enregistrement de l'écran » pour ce processus) — à confirmer à l'œil.
  - Écueil : `composer-dock` existait déjà dans `Composer` (zone de saisie élargie et fondu en
    double au premier essai) ; renommé `thread-dock`.
  - e2e `git` complétée (géométrie, fondus haut et bas, flèche, alignement) ; passe complète
    verte (320 s). Capture 39 (fil remonté : fondus et flèche) regardée en clair et en sombre.
- 2026-10-14 — Alignement des feux de la fenêtre confirmé à l'écran par l'utilisateur, app
  relancée.
- 2026-10-16 — **Correctif, signalé par l'utilisateur** : la flèche « Aller en bas » restait
  affichée sur une conversation plus courte que la page. Cause : son état n'était relevé qu'au
  défilement ; après avoir remonté un long fil puis ouvert une nouvelle conversation (le fil est
  retiré puis remis, sans défilement), il restait « remonté », et le recollage automatique en bas
  restait coupé. Désormais (`App.tsx`, `measureBottom`) : relevé aussi à chaque changement du fil
  et quand le fil ou la fenêtre changent de taille (`ResizeObserver`, qui garde aussi en bas un fil
  qui grandit sans nouveau message : image chargée, détail déplié) ; une autre conversation
  s'ouvre en bas de son fil. e2e `git` : fil remonté, nouvelle conversation courte, pas de flèche
  (vérification qui échouait avant le correctif) ; `git`, `long-thread`, `base`, `history` et
  `branch` vertes en clair et en sombre, temps du long fil inchangés.
- 2026-10-17 — **Correctif, trouvé par un essai avec Bob** (planche contact, fiche 075) : après
  un tour qui affiche une image dans une carte d'outil, le fil restait environ 370 px au-dessus du
  bas, flèche « Aller en bas » affichée, fin de la réponse cachée. Cause : en chargeant l'image,
  Chromium décale le défilement (il garde la place de ce qu'on lit, *scroll anchoring*) ; ce
  décalage arrive comme un évènement de défilement, que le correctif du 16 prenait pour un geste
  de l'utilisateur, et le suivi s'arrêtait. Désormais seul un défilement **vers le haut** décroche
  du bas (`App.tsx`, `onScroll`) ; revenir en bas raccroche. Reproduit avec l'agent factice
  (`planche-contact` après `demo` : 366 px avant, 0 après) ; e2e `browser` vérifie que le fil
  reste en bas après la planche ; `git`, `long-thread`, `pinned-plan`, `history`, `base` vertes.
- 2026-10-20 — Invite de la zone de saisie (demande de l'utilisateur, qui n'aimait pas « Écrire à
  l'agent… ») : « Que voulez-vous faire ? » sur l'accueil (conversation vide, prop `fresh` du
  `Composer`, aussi pour la conversation d'à côté), « Répondre à {{agent}}… » dans une conversation
  (libellé du profil, comme la fenêtre rapide ; « Répondre à l'agent… » sans libellé), « Ajouter
  une suite (envoyée à la fin de la réponse)… » pendant une réponse ; anglais : « What do you want
  to do? », « Reply to … », « Add a follow-up… ». e2e `queue` (les trois invites, aussi en
  anglais) et `language` mis à jour.
