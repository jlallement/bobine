# 265 — Relecture par le rôle Code reviewer, remarques visibles

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 260 (lot 4, écran G des maquettes `docs/maquettes/260-travail-delegue.html`),
  263 (bulle `role-request`, carte-réponse `WorkCard`, ADR-0060), 264 (carte de groupe, ADR-0061,
  `SubtasksInfo.onReview`), 177 (relecture avant fusion : `ChildReviews`, `report_findings`,
  empreinte, notes de diff), 223 (rôle intégré `code-reviewer`)
- **Agents** : les deux — tout est générique (rôle, conversation fille, outil `report_findings` du
  serveur `bobine`, git) ; rien de propre à un agent (ADR-0011). Rien de nouveau côté ACP
  (`docs/acp.md` inchangé) : le relecteur reçoit un premier message et appelle un outil de l'app.

## Pourquoi

Recette du 19/11 (constat R10, D33, D39 du rapport `docs/recettes/2026-11-19-exploration-opencode-sol.md`) :
deux chemins de relecture sans dire lequel prendre — le rôle Code reviewer (`@code-reviewer`) et
« Faire relire… » (fiche 177) ; le compte rendu du relecteur n'affichait qu'une phrase, pas les
défauts trouvés ; sa consigne interne en anglais s'affichait en clair comme un message de
l'utilisateur ; le même agent et le même modèle que l'auteur étaient proposés. Règle 7 de la fiche
260 : « Faire relire » lance le rôle Code reviewer, avec la même carte-réponse et ses remarques
visibles.

## Critères d'acceptation

- [x] « Faire relire » (Modifications, vue « Filles », carte d'un travail qui écrit, astuce de la
      barre du worktree) lance le rôle Code reviewer sur la portée : la branche du travail contre
      sa base, ou les modifications non commitées.
- [x] Dans le fil où la relecture est demandée : une bulle « @Code reviewer Relis … » et une
      carte-réponse (`WorkCard`) ; états de la 263 (en cours, a répondu, transmise, arrêté, erreur)
      et « rien à signaler ».
- [x] La carte montre la liste des remarques : gravité (pastille), `fichier:ligne` cliquable vers
      le diff, une phrase ; puis l'avis d'ensemble ; « Demander à <agent> de corriger » (message
      préparé qui nomme le relecteur ; le contexte joint porte ses remarques), « Voir sur le diff »,
      « Répondre à Code reviewer », « Ouvrir sa conversation ».
- [x] Gardés : `report_findings`, notes de diff, avertissement « dossier changé », agent et
      modèle (un autre modèle proposé d'office si possible, D39), points à surveiller.
- [x] Relecture d'un travail : dans sa carte (carte seule) ou juste sous sa ligne (carte de
      groupe), pas comme une carte flottante.
- [x] Conversation du relecteur : la consigne de relecture repliée avec celle du rôle (« Consigne
      du rôle »), jamais en clair.
- [x] Anciennes conversations : les éléments `review` enregistrés s'affichent comme avant
      (`ReviewCard`) ; aucune migration.
- [x] Pas de ligne « Relecture : X » en plus dans une carte de groupe ni dans « Sous-tâches ».
- [x] Vocabulaire : « relecture », « remarques », « Code reviewer », « travail » (fr, en).
- [x] Testé contre l'agent factice (main, composants, e2e `relecture`, `travaux-groupe`,
      `filles`, `changes`).

## Plan

**Modèle** (ADR-0062, proposé)

1. `RoleRequest.review?: { of }` : la bulle d'une relecture nomme la conversation relue.
2. `Review.authorId` : la conversation relue ; `reviewFindings(items, conversationId)` n'en tire
   des remarques de diff que pour elle.
3. `workCards` : la carte `review` d'un relecteur qui a sa carte va dans `WorkCardData.review`
   (cachée à sa place) ; `workLayout().reviews` : relectures rangées sous leur travail.
4. `childContext` : remarques jointes à la réponse du relecteur (20 au plus).

**Main**

5. `ChildReviews.start` : rôle `code-reviewer` (projet, sinon Bobine ; lecture seule), bulle et
   lancement dans le fil de la mère, premier message par `roleFirstMessage` (consigne de relecture
   dans le bloc du rôle), carte `review` dans les deux fils ; échec : carte et réponse en erreur ;
   `relaunch` ; empreinte reprise au départ de chaque tour suivant.
6. `ChildConversations` : réponse et « Répondre » pour un relecteur qui a sa carte ; « Relancer »
   d'un relecteur qui n'a pas démarré repart avec sa consigne. `ReadOnlyWatch` : pas les
   relecteurs.
7. Agent factice : consigne reconnue aussi dans le bloc du rôle ; remarques sur `src/ordre.js`.

**Renderer**

8. `thread/WorkReview.tsx` : remarques, avis, réponse repliée, dossier changé.
9. `WorkCard.tsx` (en-tête « rien à signaler », lieu « dans la branche relue », `WorkReviews`),
   `WorkAnswer.tsx`, `WorkFoot.tsx` (corriger, Voir sur le diff, pas de deuxième « Faire relire »
   pendant une relecture), `WorkGroupRow.tsx` (relectures sous la ligne).
10. `SubtasksInfo.onShowDiff`, `usePanel.openChanges(view, file)`, `ChangesTab.initialFile`,
    `useReviewImport(…, conversationId)`.
11. `ReviewDialog` : un autre modèle (`otherModel`), textes.
12. i18n fr/en, `work-card.css`.

**Essais, docs** : main contre l'agent factice, composants, e2e et captures ; architecture, ADR,
changelogs, index, `docs/mock-agent.md`.

Pas de nouvelle dépendance.

## Décisions

1. **Un seul chemin, le mécanisme de la 177 dessous.** Le rôle Code reviewer est lancé par
   `ChildReviews.start` (pas par `ChildConversations.start`) : il faut le dossier de l'auteur (sa
   branche), le lien `reviewOf`, l'empreinte et `report_findings`. Le rôle est celui du projet s'il
   le remplace ; désactivé, celui de Bobine (« Faire relire » est une fonction de l'app, pas un
   choix d'Équipe) ; toujours en lecture seule.
2. **Où se pose la relecture (tableau « qui affiche quoi, où »)** :
   - conversation affichée relue (Modifications, astuce) : la bulle et la carte du Code reviewer
     en bas du fil, à leur place, comme toute demande à un rôle ;
   - un travail qui a sa carte : **dans sa carte seule**, au bas, sous un filet pointillé (comme
     une suite « Répondre ») ; **dans une carte de groupe, juste sous sa ligne**, repliée ou non
     (une ligne repliée ne cache pas une relecture qu'on vient de lancer). La bulle n'apparaît
     pas en plus en bas du fil ;
   - un travail sans carte (conversation d'avant) : la bulle et sa carte en bas du fil ;
   - le fil du travail relu (sa propre conversation) garde la carte « Relecture » (`ReviewCard`) :
     c'est là que ses remarques deviennent des remarques de diff, et l'on y voit qu'il a été relu.
3. **« Demander à <agent> de corriger »** : toujours l'agent de la conversation (comme
   « Appliquer » de la 263), message qui nomme le relecteur — « Corrige les remarques de Code
   reviewer. » ; pour un travail : « Fais corriger par « Rayons » les remarques de Code reviewer
   sur sa branche. » (sa branche n'est pas le dossier de l'agent ; il a `message_child`). Les
   remarques partent dans le contexte joint, avec la réponse visée (`about`).
4. **Remarques rangées par gravité** (haute, moyenne, basse), puis dans l'ordre du relecteur ;
   une phrase : le titre de la remarque ; son explication est sur la remarque de diff.
5. **La réponse du tour** (texte libre du relecteur) est repliée sous ses remarques (« Sa réponse
   entière ») : ses remarques et son avis la disent déjà. Sans `report_findings` (arrêté, muet),
   la réponse s'affiche comme celle de tout travail.
6. **Autre modèle (D39)** : du même groupe que celui de l'auteur (même fournisseur) d'abord, sinon
   le premier autre, jamais un modèle refusé faute de connexion ; proposé dans le dialogue et
   modifiable (règle de la fiche 160 : jamais en silence). Le choix fait l'emporte.
7. **Gravité** : l'échelle unique du glossaire (« Haute / Moyenne / Basse », fiche 177), pas
   « Important / À voir / Détail » de la maquette.

## Journal

- 2026-11-20 : fiche, plan, fait.
  - **Main** : `ChildReviews.start` → rôle `code-reviewer` (`reviewerRole` : `findRole` de la mère,
    sinon `builtinRoles()`, `readOnly: true`), `createChild(…, { of, role })`, bulle
    `role-request` (`askText` : « Relis la branche … », « Relis les modifications non commitées
    (N fichiers). », « … de « titre » … » pour une autre conversation, « Points à surveiller : … »)
    et `child-started` (`request`) dans le fil de la mère ; premier message par `roleFirstMessage`
    (le rôle avec `reviewBrief` dans son bloc : `splitRoleBrief` le replie) ; carte `review`
    (`authorId`) dans le fil relu et celui de la mère (`post`) ; échec de départ : carte
    « failed » et réponse en erreur chez la mère (`failed`) ; `relaunch` (même premier message,
    sinon refait sans les points à surveiller) ; empreinte : `Watch.baseline` (promesse attendue à
    la fin du tour), reprise à chaque tour après le premier (`turnStarted`) ; `settled` pour les
    essais. `ChildConversations.onEvent` : réponse (entière) d'un relecteur qui a sa carte ;
    `reply` : suite et « Relancer » ; `ReadOnlyWatch` : `watched` exclut les relecteurs.
    `childContext` : `findingsLines` (gravité, `fichier:ligne`, titre, raison bornée à 300,
    20 remarques au plus, « none » si rien).
  - **Renderer** : `WorkReview.tsx` (`ReviewFindings`, `ReviewChanged`) ; `WorkCard.tsx`
    (`WorkReviews`, `reviewShow`, `NoAnswerLine` sorti pour la complexité, `data-review`,
    `data-findings`) ; `WorkAnswer.tsx` (remarques sur la dernière réponse) ; `WorkFoot.tsx`
    (`fixMessage`, `work-fix`, `work-show-diff`, `work-review` masqué pendant une relecture du
    travail) ; `WorkGroupRow.tsx` ; `RoleRequestBubble` `inReview` (`review-ask`) ;
    `ReviewDialog` (`otherModel`, `suggestedOther`) ; `App.tsx` → `threadSubtasks(…, { diff })` :
    sélectionne le travail relu si besoin, puis `openChanges('git', fichier)` ; `SidePanel`
    (`changesOpening`) ; `ChangesTab.initialFile` ; `useReviewImport(…, conversationId)`.
  - **Agent factice** : `pickScenario` reconnaît la consigne dans le bloc du rôle (`includes`) ;
    `relecture` rend deux remarques sur `src/ordre.js` quand la consigne le cite.
  - **Essais** : main `children-review.test.ts` (rôle et lecture seule, bulle et lancement,
    consigne dans le bloc du rôle, réponse chez la mère, remarques dans le contexte, « Répondre »
    et empreinte reprise — l'essai échoue sans `turnStarted` —, sœur sur une branche : bulle et
    carte chez la mère, départ raté et « Relancer », relecture d'avant sans « Répondre ») ;
    partagés `review-card.test.ts` (carte attachée, rangement sous le travail, conversation
    affichée et travail sans carte à leur place, contexte borné, notes de diff par conversation,
    lieu et ordre) ; composants `WorkReview.test.tsx` (en cours, remarques et ordre, clics vers le
    diff, corriger, Répondre et Ouvrir, rien à signaler, transmise, arrêté et erreur, dossier
    changé, relecture d'un travail dans sa carte, pas de deuxième « Faire relire », carte de
    groupe, relecture d'avant), `ReviewDialog.test.tsx` (autre modèle, choix de l'utilisateur,
    profil sans choix), `ChangesTab.test.tsx` (fichier ouvert, import par conversation).
  - **e2e** : `relecture` réécrite (dialogue, en cours retenu par le verrou, remarques, clic vers
    le diff, corriger et transmise, conversation du relecteur ; captures `265-relecture-en-cours`,
    `-remarques`, `-transmise`, et `177-*` refaites) ; `travaux-groupe` (« Faire relire » d'un
    travail qui écrit : la relecture dans sa carte, capture `265-relecture-travail`) ; `filles`
    (« Faire relire » d'une ligne de la vue « Filles » : le dialogue du Code reviewer, sur sa
    branche).

- 2026-11-20 : `./scripts/verify` vert ; `pnpm build && pnpm e2e relecture travaux-groupe filles
  changes` (une campagne) : vertes sauf `travaux-groupe` (la carte du travail, avec sa relecture,
  plus haute que la fenêtre : `reveal` du résultat de fusion, corrigé), puis `travaux-groupe
  relecture` vertes, clair et sombre ; `roles-travail repere filles-fusion filles-non-commite
  filles-tech-lead` vertes (10 tâches). Une fois, sous charge (3 suites en parallèle),
  `travaux-groupe` sombre en délai sur `title-origin` (ouverture de la conversation du travail,
  avant la relecture) ; vert relancé deux fois, seul et en parallèle. Captures `265-relecture-*`
  et `177-*` regardées. Suite complète non lancée (fichier i18n partagé : à la campagne du tech
  lead).

## Limites connues

- `@code-reviewer` tapé dans la saisie reste une demande ordinaire au rôle : même carte, réponse en
  Markdown, mais ni portée, ni `report_findings`, ni notes de diff (il faudrait choisir une portée ;
  « Faire relire » le fait).
- Le fil du travail relu garde la carte « Relecture » de la 177 (c'est sa conversation à lui).
- Un clic sur `fichier:ligne` ouvre le fichier dans la vue Git (déplié) ; la ligne elle-même n'est
  pas mise en avant, la remarque de diff est sous elle.
- Une relecture rangée sous une ligne de groupe est toujours visible (pas repliée avec la ligne).
- Après un redémarrage, les points à surveiller d'un relecteur qui n'a jamais démarré sont perdus
  pour « Relancer » (la consigne est refaite sans eux).
- Le pilote (`shot.works`) lit la carte du relecteur comme toute carte, sans ses remarques.
