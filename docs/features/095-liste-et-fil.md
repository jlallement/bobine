# 095 — Liste des conversations et fil : ordre figé, branches, chronomètre, remarques du plan

- **Statut** : fait
- **Dépend de** : 023 (branches de conversation), 026 (liste des conversations), 040 (plan annoté),
  069 (indicateur d'activité)
- **Agents** : les deux — liste et fil sont génériques, rien ne dépend de l'agent.

## Pourquoi

L'essai réel du 2026-10-20 avec OpenCode + GPT-6.1 Sol
(`docs/recettes/2026-10-20-essai-libre-opencode-gpt.md`) a relevé quatre défauts dans la liste
des conversations et dans le fil :

1. La liste, triée par activité, se réordonne sous la souris : le clic a ouvert la mauvaise
   conversation et un message est parti au mauvais endroit.
2. Une branche (« Repart de ce message dans une nouvelle conversation ») porte le même titre
   tronqué que son original ; rien ne l'en distingue dans la liste.
3. Le chronomètre du tour affiche « 1 min 07 » au bout de 6 s, au 2e tour (une fois sur six).
4. Dans la carte « Plan proposé », les remarques passent par-dessus la fin du plan : le titre
   « 4. Vérifier » disparaît sous la citation.

## Critères d'acceptation

- [x] Tant que le pointeur est sur la liste, ou qu'un menu de la liste est ouvert, l'ordre des
      conversations ne bouge pas ; il est rétabli à la sortie. Une conversation nouvelle pendant
      ce temps s'ajoute en fin de liste, sans rien décaler. Épingler, archiver : immédiat.
- [x] Une branche s'affiche juste sous son original, légèrement indentée, avec une flèche ↳
      (`corner-down-right`) — pas l'icône git des worktrees. Plusieurs branches d'un même original
      se suivent ; la branche d'une branche suit sa mère.
- [x] Si l'original n'est pas dans la même section (épinglé, archivé, autre dossier, supprimé), la
      branche s'affiche à sa place habituelle, sans retrait, avec la flèche.
- [x] La flèche dit « Branche de « titre » » aux lecteurs d'écran ; le titre garde « · branche ».
- [x] Le chronomètre repart quand le message de l'utilisateur du nouveau tour arrive après le
      statut « occupé » (test unitaire du cas).
- [x] Les remarques du plan ne masquent plus la fin du plan, quelle que soit sa longueur.
- [x] Testé contre l'agent factice : e2e `branch` (branches sous l'original) et `plan` (plan long
      annoté), en clair et en sombre ; ordre figé : tests de composant, et essai à la souris CDP
      contre l'app buildée (voir Journal).

## Maquettes

Tranchées par la session principale (fiche 092, hors git) :
`e2e/captures/m092-final-liste-{dark,light}.png` et la colonne de droite de
`m092-final-planche-modeles-liste-dark.png` — la branche sous son original, retrait léger, ↳.

## Plan

**Ordre figé et branches** — logique pure à part, testée seule, la barre latérale l'applique :

- `src/renderer/src/components/sidebar/history-order.ts` (nouveau) :
  - `heldOrder(items, order)` : remet les conversations dans l'ordre figé `order` ; celles qui n'y
    sont pas (nouvelles) vont à la fin, dans leur ordre d'arrivée.
  - `nestBranches(items)` : chaque section en lignes `{ conversation, nested, branch }` — une
    branche suit son original (en profondeur, un seul niveau de retrait), une branche orpheline
    reste à sa place avec la flèche.
  - `useHeldOrder(ids, held)` : capture l'ordre affiché quand `held` passe à vrai, l'oublie quand
    il repasse à faux.
  - `usePointerInside(ref)` : pointeur sur la liste, d'après `pointerover` / `pointerout` natifs
    sur le document (voir Journal : pas `onPointerEnter` de React).
  - `useHolds()` : compteur des menus ouverts et des titres en cours de modification ; chaque
    raison est rendue au démontage, même si le menu ne s'est pas refermé.
- `src/renderer/src/components/sidebar/Sidebar.tsx` : pointeur sur la liste, menu ouvert (« … »
  d'une ligne, « Regrouper ») ou titre en cours de modification → ordre figé ; les sections
  (épinglées, récentes, par dossier, archivées) sont calculées après l'ordre figé, donc épingler ou
  archiver reste immédiat.
  `HistoryItem` : flèche `CornerDownRight` et classe `nested`.
- `src/renderer/src/styles.css`, section « Historique » : retrait de `.history-item.nested`.
- `fr.json` / `en.json` : `sidebar.branchOf`.
- Le lien branche → original (`ConversationSummary.branchedFrom`) existe déjà : rien à toucher au
  main ni à `App.tsx`.

**Chronomètre** — `thread/WorkingIndicator.tsx` : le début du tour est recalculé quand l'id du
dernier message de l'utilisateur change (`useMemo` sur `conversationId` et cet id), au lieu d'une
seule fois au montage. Test : `WorkingIndicator.test.tsx` (horloge simulée : tour 1, 67 s, tour 2
monté avant son message, puis le message arrive → le chrono repart de zéro).

**Remarques du plan** — reproduire d'abord dans l'app (plan plus long que la carte), puis corriger
la section « Plan annoté » de `styles.css` (voir Journal : `PlanDocument.tsx` n'a pas bougé).

**Tests** : `history-order.test.ts`, `Sidebar.test.tsx` (ordre figé sous le pointeur et menu
ouvert), `WorkingIndicator.test.tsx` ; e2e `branch` (branches sous l'original) et `plan` (plan
long) complétés.

Pas de nouvelle dépendance.

## Journal

- 2026-10-20 — Fiche créée (session 4 de la répartition de l'essai du 2026-10-20).
- 2026-10-20 — Fait, sur la branche `claude/fiche-095-liste-et-fil-3911ce`.
  - **Chronomètre** : comme prévu. Le test échoue sans le correctif (« 1 min 13 » au lieu de
    « 6 s »). Il reste, au pire, un éclair de l'ancienne durée entre le statut « occupé » et
    l'arrivée du message (quelques millisecondes).
  - **Remarques du plan** : reproduit dans l'app buildée avec un plan plus long que la carte. Ce
    n'était pas un chevauchement à proprement parler : le corps du plan était plafonné à 560 px et
    défilait en interne, sans barre visible (barres de macOS), et les remarques commençaient pile à
    la coupure. La fin du plan (« 4. Vérifier ») restait cachée dessous. Choix : le plan annoté se
    lit **en entier dans le fil**, comme une réponse (plus de défilement dans la carte, qui gênait
    aussi la sélection d'un passage à commenter), et les remarques ont leur bande, séparée du texte
    par un filet. Seule la CSS change (`.plan-document-body`, `.plan-notes`). e2e `plan` : un plan
    allongé dans la page, rien de caché dans la carte, la fin au-dessus des remarques (capture
    `98b-plan-long-annote`).
  - **Ordre figé** — écart au plan : le pointeur est suivi par `pointerover` / `pointerout` natifs
    sur le document, pas par `onPointerEnter` / `onPointerLeave` de React. Ceux-ci suivent l'arbre
    React, portails compris : après un choix dans le menu « … » d'une ligne (affiché à côté de la
    liste, dans un portail), la sortie n'était jamais signalée et la liste restait figée — une
    conversation créée ensuite arrivait en bas. Vérifié dans l'app buildée avec la variante React
    (échec) puis la version retenue (succès), par un essai à la souris CDP (`mouseMoved`, script
    jetable hors dépôt : une conversation lente finit son tour sous le pointeur, ordre inchangé ;
    pointeur sorti, ordre rétabli ; choix dans le menu puis nouvelle conversation, en tête). Fige
    aussi pendant qu'on renomme un titre dans la liste. Les tests de composant couvrent les quatre
    cas (pointeur, sortie de fenêtre, menu ouvert, menu refermé hors de la liste) ; pas d'essai e2e
    du survol : `e2e/lib.mjs` (hors de mes fichiers) n'a pas de déplacement de souris sans clic.
  - **Branches** : comme prévu, rendu conforme à la maquette (captures
    `a4-branches-sous-original`). La flèche lit le titre actuel de l'original s'il est dans la
    liste (il a pu être renommé), sinon celui retenu à la création. Une branche d'une
    conversation en worktree garde aussi l'icône git, à côté de la flèche (les deux disent des
    choses différentes).
  - **Hors périmètre** : aucun fichier hors de ceux attribués. Ni main, ni `App.tsx` :
    `ConversationSummary.branchedFrom` existait déjà.
  - **Vérification** : `./scripts/verify` — lint, typecheck et tests verts ; l'étape
    « Documentation » échoue seulement parce que cette fiche n'est pas dans l'index
    `docs/features/README.md`, que cette session ne devait pas toucher. e2e en clair et en sombre :
    `plan branch history parallel base failures export diagnostic git notifications restart
    pinned-plan permissions quick settings touches resume` (toutes les suites qui touchent la
    liste), vertes.
  - **À reporter à la fusion** :
    - index `docs/features/README.md` :
      `| [095](095-liste-et-fil.md) | Liste des conversations figée sous le pointeur, branches sous leur original, chronomètre du tour, remarques du plan | fait | P1 |`
    - `CHANGELOG.md` (« Prochaine version ») :
      - Nouveau : « Une branche s'affiche juste sous sa conversation d'origine, en retrait, avec
        une flèche. »
      - Corrections : « La liste des conversations ne bouge plus sous la souris : elle se
        réordonne quand le pointeur la quitte. » ; « Le chronomètre du tour ne reprend plus la
        durée du tour précédent. » ; « Le plan annoté se lit en entier : ses remarques ne cachent
        plus sa fin. »
    - `CHANGELOG.en.md` (« Next version ») :
      - New: “A branch now shows right under its original conversation, indented, with an arrow.”
      - Fixes: “The conversation list no longer moves under the mouse: it reorders once the
        pointer leaves it.”; “The turn timer no longer picks up the previous turn’s duration.”;
        “The annotated plan now shows in full: its notes no longer hide its end.”
