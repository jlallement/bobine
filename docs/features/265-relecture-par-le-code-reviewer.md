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

- 2026-11-20 : décisions du tech lead sur les doutes, appliquées.
  - **`@code-reviewer` tapé dans la saisie** passe par le même chemin (`startRoleChildren` →
    `ChildReviews.start` avec `ask`) : bulle du message partagée (le lien de relecture passe de
    la bulle à chaque travail, `RoleRequestWork.review.of`, pour qu'un autre rôle cité dans le
    même message ne soit pas pris pour une relecture), le texte tapé en points à surveiller,
    portée d'office (`review-target.ts`, `auto`) : le non commité, sinon la branche courante
    contre sa base (`origin/HEAD`, sinon `main`, `master`) si ce n'est pas elle, sinon le dernier
    commit (nouvelle portée `commit` : « Relis le dernier commit a3f2c1e (2 fichiers). », consigne
    `git show`). Refusé depuis la conversation d'un travail (un seul niveau). Essais main :
    non commité avec un autre rôle dans le même message, dernier commit, branche courante.
  - **Clic sur `fichier:ligne`** : `onShowDiff(auteur, fichier, ligne)` → `openChanges('git',
    fichier, ligne)` → `ChangesTab.initialFile { path, line }` → `DiffView.focus` : la ligne
    (côté nouveau) amenée au centre et mise en avant (`tr.diff-focus`) ; absente du diff, le
    fichier ouvert seulement. Essai `ChangesTab.test.tsx` (les deux cas).
  - **Points à surveiller gardés** (`Review.focus`, 4 000 caractères au plus) : « Relancer »
    après un redémarrage refait la consigne avec eux et la même portée. Essai main (premier
    message refusé, mémoire perdue, relance : consigne avec les points).
  - **Pilote** : `shot.works[]` d'un Code reviewer : `severities` (par gravité) et `findings`
    (dix au plus) ; `etat` : « Remarques : 4 (1 haute, 1 moyenne, 2 basses) », « aucune » ;
    `--long` : les trois premières. Essai `cible.test.mjs` ; `docs/pilote.md`.
  - `ChangesTab` : props sorties en `ChangesTabProps` (fonction à 300 lignes).

- 2026-11-20 : après ces décisions, `./scripts/verify` vert (5 311 essais) ; `pnpm build && pnpm
  e2e relecture travaux-groupe changes` vertes (6 tâches, clair et sombre ; `relecture` vérifie
  la ligne mise en avant et à l'écran), puis `pnpm e2e roles-travail` verte (deux
  `@code-reviewer` tapés dans la saisie y passent désormais par la relecture), une campagne à la
  fois.

- 2026-11-20 : revues UX et QA, tout appliqué ; chaque défaut QA a son essai qui échoue sans son
  correctif.
  - **Un seul chemin, sans exception** (décision du tech lead) : `ChildConversations.start` envoie
    tout rôle `code-reviewer` à `ChildReviews.start` (`@code-reviewer` de la saisie, `start_child`
    de l'agent avec sa clé de carte et `by: agent` — l'agent l'attend —, « Lancer en
    parallèle… ») ; avis `agentMissing` / `modelMissing` gardés. Essais main.
  - **Lecture seule** : le relecteur passe par le garde-fou commun `ReadOnlyWatch` (empreinte avant
    chaque message, exclusion `shared` quand une autre conversation du dossier écrit, `watchFailed`
    si git échoue, texte neutre « le dossier a changé… ») ; un écart est aussi dit sur sa carte
    (`changed`). Mode installé (`nativeRoleMode`, `stale` / `installed` comme `children.ts`) :
    lecture seule `enforced`. L'empreinte propre à `ChildReviews` est retirée. Essais
    `read-only-watch.test.ts`, `roles-children.test.ts`.
  - **Fusion pendant une relecture** : `ChildrenMerger.start` refuse un travail dont un relecteur
    (`reviewOf`) travaille, et le nettoyage le saute ; « Fusionner dans main » désactivé, son
    infobulle le dit. Essais `children-merge.test.ts`, `WorkReviewMerge.test.tsx`.
  - **Une relecture à la fois** par conversation relue ; **plafond** de 100 remarques par relecture.
  - **Contexte de la mère** : une ligne par remarque (`quoted`), triées par gravité avant la coupe
    à 20, seulement les nouvelles depuis la réponse d'avant (`ChildReport.findingsSeen`).
  - **Carte** : repasse « en cours » (erreur effacée) au départ de chaque tour ; `fallback` avec
    `authorId` ; `failed` gardé, posé chez la mère même si la conversation relue a disparu ;
    `relaunch` met la carte à jour (portée, fichiers), refuse une liste vide, et une suite tapée
    après un départ raté part après le premier message.
  - **Diff d'une remarque d'une branche ou d'un commit** : `Review.since` (base, parent, arbre vide
    pour le premier commit) ; `changes:gitFile` accepte `since` (identifiant de commit seulement) ;
    l'onglet Modifications montre « fichier depuis a3f2c1e » (`ReviewFileDiff`), la plage `line` à
    `endLine` mise en avant (liseré bleu du thème, éclair de 1,5 s, recentré à chaque clic) ; la
    demande n'est servie qu'une fois (pas à chaque remontage) ; un travail supprimé : rien.
  - **Portée** (`review-target.ts`) : premier parent d'un commit de fusion, `--` après les
    révisions, dépôt sans commit (consigne sans `git diff HEAD`), `develop` et `trunk`, branche de
    travail sans changement : rien à relire. La demande à l'agent en anglais (ADR-0014), la bulle
    dans la langue de l'interface. Essais `review-target.test.ts`.
  - **Revue UX** : avis d'ensemble avant la liste ; réponse repliée « Lire la suite » ; méta sur la
    ligne des boutons, « Répondre » fantôme avec « Ouvrir sa conversation » ; libellés traduits des
    outils de l'app dans l'activité (« Rend 2 remarques de relecture ») ; carte d'un travail avec
    sa relecture : « Faire corriger « … » » principal tant qu'une remarque haute ou moyenne n'est
    pas traitée, « Fusionner » secondaire, une seule ligne de transmission, réponse du travail
    repliée ; « Correction demandée · heure » et pastilles effacées ; `fichier:ligne` sur sa ligne
    sous 520 px, coupé aux `/` ; dialogue (deux lignes, « À relire : … », « Autre que celui de la
    conversation (X) », coût sur sa ligne, champ actif neutre ; un modèle gratuit appelle un autre
    modèle gratuit, un modèle payant est signalé) ; « Faire relire » libellé dans Modifications
    quand la place le permet ; « Demander de corriger » des deux côtés, sans double envoi
    (`settleReviewNotes`, `about` porté par l'envoi du panneau, élément `user.about`) ; le factice
    ne recopie plus la réponse de l'outil, son avis dit « Une remarque haute à corriger ».
  - **Bulle « Fais les modifications » en fondu en haut du fil** (point 14) : pas un défaut — c'est
    le premier message à moitié sous le fondu de la barre de titre (`.main-header::after`), quand
    l'essai amène la carte au milieu de l'écran. Rien de changé.

- 2026-11-20 : après les revues, `./scripts/verify` vert (5 335 essais) ; `pnpm build && pnpm e2e
  relecture travaux-groupe changes roles-travail filles-fusion` : 10 tâches vertes, clair et
  sombre, une campagne. Captures regardées : `265-relecture-en-cours`, `-remarques`,
  `-remarques-900`, `-transmise`, `-travail`, `-travail-900`, `177-1`, `177-2`, `177-4`, `177-5`.

### 2026-11-25 — recette (1.2.0-beta.2) : le modèle de la conversation, plus un autre d'office

- **Trace** (journal de recette, 20:28) : conversation sur openai/GPT-6.1 Sol (OpenCode, compte
  ChatGPT) ; « Faire relire… » présélectionnait openai/GPT-5.5, que le compte n'a pas. Cause :
  `otherModel` (D39 ci-dessus) prenait le premier autre modèle du même groupe parmi ceux que la
  session annonce, et OpenCode annonce GPT-5.5 en tête du fournisseur `openai`, ouvert ou non au
  compte. Un modèle refusé comme indisponible n'est pas retenu par l'app (fiche 259) : aucune
  liste ne permettait de l'écarter.
- **Décision** (tech lead, pour la beta.2) : D39 est retirée. Le modèle présélectionné est celui de
  la conversation relue, qui vient de répondre ; un autre modèle choisi reste dit (« un regard
  neuf trouve davantage »), et un modèle payant à la place d'un gratuit aussi. Le guide le disait
  déjà (« ceux de la conversation relue sont proposés »).
- **Essais** : `ReviewDialog.test.tsx` rejoue la trace (Sol présélectionné et envoyé ; rouge avant :
  `openai/gpt-5.5`) ; e2e `relecture` : le dialogue dit « Agent et modèle de la conversation
  relue ».
- **Autres présélections, même agent** : « Lancer en parallèle… » et la carte « Tâches proposées »
  prennent déjà le modèle de la mère, sauf un modèle proposé nommément par l'agent dans sa
  proposition (affiché comme sa proposition, avec sa raison) ; un rôle n'a de modèle que celui que
  l'utilisateur y a écrit. Le tour de table (fichiers d'un autre chantier) propose ses
  participants enregistrés et les « Récents » du profil, où entre tout modèle choisi dans une
  session, même refusé au premier message (`noteModels`, à chaque instantané) : c'est l'origine
  probable de « GPT-5.5 (récents) » à 18:28 ; non changé ici.

## Limites connues

- `@code-reviewer` refusé pendant que l'agent de la conversation répond (comme « Faire relire » :
  le dossier bouge) ; les autres rôles du message partent.
- `start_child` de l'agent avec le rôle `code-reviewer` est une relecture de la conversation de
  l'agent (portée d'office), lancée même pendant son tour : le garde-fou n'accuse pas le relecteur
  quand c'est l'agent qui écrit (exclusion `shared`).
- La gratuité d'un modèle se lit dans son nom ou son identifiant (« free ») : heuristique.
- « Correction demandée » : dit pour toute demande visant le relecteur (`about`), y compris
  « Envoyer à l'agent » des remarques du panneau ; une demande faite à la main dans la saisie
  n'est pas reconnue.
- « Faire relire » (dialogue) garde sa portée : la branche d'un worktree, sinon le non commité
  (rien : refusé) ; la portée d'office (branche courante, dernier commit) est celle de la saisie.
- Le fil du travail relu garde la carte « Relecture » de la 177 (c'est sa conversation à lui).
- Ligne dans une partie plafonnée d'un très gros diff (fiche 192) : pas mise en avant.
- Une relecture rangée sous une ligne de groupe est toujours visible (pas repliée avec la ligne).
