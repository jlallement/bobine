# 248 — Pilote : toujours la fenêtre de Bobine, cartes souvenir et « Tâches proposées »

- **Statut** : fait
- **Dépend de** : 206 (pilote), 182 (mémoire), 124 (« Tâches proposées »)
- **Agents** : les deux (outillage de recette, rien de propre à un agent)

## Pourquoi

La recette du 2026-11-17 (`docs/recettes/2026-11-17-poc-complet-opencode.md`, § « Outillage de
la recette ») a dû abandonner le pilote pour computer use : dès que le navigateur intégré avait une
page, le pilote lisait et pilotait cette page au lieu de Bobine. `attendre` manquait aussi des cartes
et en prenait une déjà traitée pour une carte en attente. La prochaine recette est une recette
complète avec Bob : le pilote doit être sûr.

## Défauts, causes, corrections

| # | Défaut observé | Cause | Correction |
|---|---|---|---|
| 1 | Navigateur intégré ouvert : `etat` rend « agent ? », `envoyer` échoue, `attendre` sort aussitôt en `tour-fini`, `capture` photographie la maquette | `mainPage` (`cdp.mjs`) prenait la **première** cible DevTools de type page qui n'était ni `#quick`/`#help`/`#about` ni `about:blank`. Les onglets du navigateur intégré (vues natives) sont des cibles de type page, et Chromium liste la plus récente en tête : une maquette `file://…/b.html` ou `http://localhost:3000` passait le filtre | La fenêtre principale est reconnue par son URL (`file://…/renderer/index.html` sans `#vue`, `isMainUrl`), **puis confirmée dans la page** par `MAIN_MARKER` : l'IPC du preload (`window.api`, absent des pages du navigateur intégré même si elles ouvrent le fichier du renderer), pas de `#vue`, la racine `#root`. Aucune cible confirmée, ou plusieurs : erreur qui liste les pages vues, jamais un choix au hasard |
| 2 | Une page reste une cible même onglet fermé | Côté pilote : rien ne l'écartait (point 1). Une cible fermée pendant une connexion laissait chaque commande attendre 30 s avant d'échouer | La liste est relue à chaque connexion (aucune mémoire de cible) et une cible fermée qui traîne dans la liste ne se confirme pas. Connexion fermée (`onclose`) : les commandes en cours et suivantes échouent aussitôt (« page fermée ») ; `attendre` se reconnecte et relit la liste |
| 3 | `attendre` (et `etat`) ne voient pas la carte « Retenir ce souvenir ? » | La lecture ne cherchait que `.permission-card` ; la carte de mémoire (fiche 182) est `[data-testid=memory-card]` | Lue comme carte `souvenir` (titre, auteur, description et texte, avertissement, boutons) ; décidée, elle devient la ligne `memory-decided`, qui n'est pas une carte. `repondre` la vise aussi |
| 4 | Une carte « Tâches proposées » déjà traitée est prise pour une carte en attente — et, trouvé en écrivant l'essai réel, une carte **en attente** n'est pas vue | Les boutons d'une carte étaient lus dans son pied (`.pc-actions`), à défaut dans toute la carte. Celui de « Tâches proposées » n'existe que tant qu'une ligne attend, et ne porte que l'aide clavier (aucun bouton) : en attente, aucun bouton → pas une carte ; traitée, plus de pied → les « Lancer » des lignes décidées → une carte. Exactement à l'envers | La carte n'attend que si `data-pending` > 0, et ses boutons sont ceux des lignes en attente (`[data-outcome=pending] .proposal-actions`). Même règle pour `repondre` et `capture --zone carte` (sélecteur `CARD` commun) |
| 5 | `envoyer` échoue dans une conversation fille (« pas de zone de saisie à l'écran ») | **Même cause que 1**, pas la fille : le journal de la recette montre `etat` à « agent ? » à 20:02:14, avant la note de 20:02:32 sur `envoyer` ; la maquette B était ouverte depuis l'étape 2. Rien de propre aux filles dans `sendMessage` | Corrigé par 1 ; vérifié en vrai (e2e) : `envoyer` dans une fille lancée depuis « Tâches proposées » |
| 6 | État ambigu rendu « agent ? : ? » | Nom d'agent vide affiché tel quel | Première ligne d'`etat` qui dit pourquoi : page qui n'est pas la fenêtre principale (« État illisible : … (URL) »), accueil du premier lancement, réglages ouverts, ou nom absent de la barre latérale. Une lecture hors de la fenêtre principale fait sortir `attendre` en `erreur`, jamais en `tour-fini` |

## Critères d'acceptation

- [x] La cible CDP est toujours la fenêtre principale (URL + marqueur), jamais une page du
      navigateur intégré (`file://`, `localhost`, ni même le fichier du renderer sans preload), ni la
      fenêtre rapide ; une cible fermée est oubliée.
- [x] `attendre` rend `carte` pour « Retenir ce souvenir ? » et pour « Tâches proposées » en
      attente ; une carte « Tâches proposées » toute traitée n'est pas en attente.
- [x] `envoyer` fonctionne dans une conversation fille ; cause de l'échec trouvée (point 5).
- [x] État ambigu dit clairement, jamais « agent ? ».
- [x] Essais unitaires avec de fausses cibles DevTools (`scripts/pilote/cible.test.mjs`) : la
      fenêtre de Bobine plus une page du navigateur ouverte, puis fermée ; chacun échoue sans le
      correctif (11 sur 11, voir Journal).
- [x] Essai réel : `pnpm pilote lancer` (profil temporaire, agent factice) avec le navigateur
      intégré ouvert sur une maquette (`http://127.0.0.1`) : `etat`, `envoyer`, `attendre`, `capture` visent
      la fenêtre ; onglet fermé ; carte souvenir ; « Tâches proposées » traitée ; `envoyer` dans une
      fille (suite e2e `pilote`).

## Plan

- `scripts/pilote/cdp.mjs` : `isMainUrl`, `mainCandidates`, `MAIN_MARKER`, `connect` qui confirme
  chaque candidate dans la page ; `onclose` qui fait échouer les commandes en cours.
- `scripts/pilote/instance.mjs` : attente de la fenêtre par `connect` (plus de `mainPage`).
- `scripts/pilote/lecture.mjs` : `main` et `url` dans la lecture ; carte `souvenir` ;
  « Tâches proposées » selon `data-pending`, boutons des lignes en attente.
- `scripts/pilote/actions.mjs`, `pilote.mjs` : sélecteur `CARD` commun (`repondre`, `capture
  --zone carte`).
- `scripts/pilote/etat.mjs` (`agentLine`), `raison.mjs` (lecture hors fenêtre → `erreur`).
- Essais : `scripts/pilote/cible.test.mjs` ; suite e2e `pilote` étendue (`targetChecks`).
- Aucune dépendance nouvelle.

## Journal

- 2026-11-18 : défauts relus dans le journal du pilote de la recette
  (`~/Development/bobine-recette/poc-1.0.0-beta.7-opencode/pilote/journal.jsonl`, hors dépôt) :
  « agent ? » dès 20:02:14, avant l'échec d'`envoyer` dans la fille (20:02:32) → point 5 ramené
  au point 1.
- Essais sans le correctif : les sources du pilote de `main` copiées à côté du nouvel essai
  (commande dans `docs/pilote.md` § Essais) → tous en échec (« agent ? » lu dans la maquette,
  commande qui attend 30 s une page fermée, carte souvenir absente, carte traitée prise pour une
  carte en attente…).
- Écart au plan : l'essai réel a montré que le pilote ne voyait pas non plus une carte « Tâches
  proposées » **en attente** (point 4, deuxième moitié) ; la fixture jsdom a été refaite d'après le
  DOM réel (pied avec la seule aide clavier), l'essai unitaire correspondant ajouté (11 essais,
  tous en échec sans le correctif). La suite e2e `pilote` travaille désormais dans un dépôt git
  (sinon l'agent n'a pas `start_child`).
- Écart : la page du navigateur intégré reste-t-elle listée après la fermeture de son onglet ?
  La suite e2e l'écrit dans son libellé (« cible encore listée : … ») sans en faire une condition :
  le pilote l'ignore dans les deux cas.
- Hors périmètre : `e2e/lib.mjs` a son propre `mainPage` (premier `page` hors `#quick`) ; il ne
  sert qu'au démarrage d'une app d'essai, avant toute page du navigateur intégré.
