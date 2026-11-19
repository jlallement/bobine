# 263 — Bulle @rôle et carte-réponse unique

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 260 (lot 2, écran A des maquettes `docs/maquettes/260-travail-delegue.html`),
  261 (pied de la réponse, repère), 262 (saisie avec un rôle), 258 (états des filles), 255
- **Agents** : les deux — tout est générique (rôles, conversations filles, fil de la mère) ; rien
  de propre à un agent (ADR-0011).

## Pourquoi

Recette du 2026-11-19 (constats D1–D41, écran A de la fiche 260) : une question à un rôle donne
trois cartes (lancement, ligne « Sous-tâches », compte rendu), la question n'est pas dans le fil, la
carte « Sous-tâches » saute vers le bas à chaque lancement, et l'avis se résume à sa première
phrase. Règle 2 de la fiche 260 : une demande à un rôle est une bulle « @Rôle … » dans le fil ;
juste dessous, **une seule carte-réponse**, à cette place pour toujours.

## Critères d'acceptation

- [x] Une demande à un rôle depuis la saisie ajoute dans le fil de la mère une bulle utilisateur
      avec la puce du rôle (avatar, couleur) et le texte demandé ; plusieurs rôles : une bulle,
      plusieurs puces, une carte par rôle dessous. La bulle n'est pas envoyée à l'agent principal
      et n'ouvre pas de tour (pied de la réponse de la fiche 261 inchangé).
- [x] Juste sous la bulle, une carte-réponse par travail, qui ne bouge plus : en-tête (avatar, nom
      du rôle, « lecture seule · dans ce dossier » ou « écrit dans sa branche »), état à droite.
- [x] En cours : outil en cours, deux ou trois derniers faits, temps écoulé, « Arrêter » (ce
      travail seulement), « Ouvrir sa conversation ».
- [x] A répondu : la réponse complète en Markdown (20 000 caractères au plus, mention si elle est
      tronquée), repliée après environ 10 lignes, « Lire la suite » / « Replier » ; pied « durée ·
      coût » (« gratuit » pour un coût nul) ; « Demander à <agent> de l'appliquer » (rôle de
      conseil), « Répondre à <Rôle> », « Ouvrir sa conversation ».
- [x] Ligne de transmission : « Pas encore transmise à <agent> — elle le sera avec votre prochain
      message », puis « Transmise à <agent> · heure » (mécanisme actuel, `childContext`).
- [x] « Demander à <agent> de l'appliquer » envoie à l'agent principal un message préparé, visible
      dans le fil ; la réponse part avec lui comme aujourd'hui.
- [x] « Répondre à <Rôle> » pose la puce du rôle dans la saisie ; le message suivant va à la même
      conversation ; sa bulle et la réponse s'ajoutent dans la même carte.
- [x] Arrêté, en erreur : états clairs, « Relancer » quand la conversation du travail existe.
- [x] Rôle qui écrit : même carte, branche et « N fichiers +a −r » ; « Voir les modifications »
      (vue Git de sa conversation) ; la place de « Faire relire » et « Fusionner » (lot 264).
- [x] Un travail lancé par une bulle n'apparaît plus ni dans « Sous-tâches » ni en compte rendu
      séparé ; les travaux lancés par l'agent, les relectures et la fusion restent comme avant.
- [x] Anciennes conversations : `child-started`, `child-report` et « Sous-tâches » comme avant,
      sans migration.
- [x] Le repère du bas du fil (fiche 261) vise la carte-réponse (`data-work-anchor`).
- [x] Textes « travail », « rôle », « réponse » (fr, en) ; jamais « fille » ni « compte rendu ».
- [x] Testé contre l'agent factice (scénario `avis-long`) : réducteur, composants, main, e2e
      `roles-travail` (captures `263-carte-*`, clair et sombre).

## Plan

**Modèle de données** (ADR-0060, proposé)

1. `src/shared/role-request.ts` (nouveau) : `RoleRequest` = `{ requestId, text, works: [{ childId,
   role }], followUp?, at }` ; élément de fil `role-request` (type dédié, pas un `user` : un `user`
   ouvre un tour, compte pour le rejeu `replayTail`, borne `childNews`, la durée et le pied des
   tours) ; `reduceRoleRequest` (remplacé par `requestId`, comme `review`) ; `workCards(items)` :
   cartes par bulle, éléments cachés (lancements, comptes rendus, bulles de suite), ancre de
   chaque carte.
2. `ChildStart.request?` (la demande qui l'a lancée) ; `ChildReport.reply?` (dernière réponse
   entière, `REPLY_KEEP_CHARS` = 20 000 au plus) et `replyCut?`.
3. `agent.ts` : évènement `role-request` ; `transcript.ts` : l'élément et son cas ; `export.ts`.

**Main**

4. `children.ts` : `ChildRequest.ask` (`requestId`, texte) ; la bulle est posée (ou complétée)
   juste avant le `child-started` de chaque travail parti — jamais pour un rôle refusé ; le compte
   rendu d'un travail lancé par une bulle porte la réponse entière ; `reply(motherId, childId,
   text)` : bulle de suite, puis le message à la même conversation (`deliver`, sans provenance).
5. `roles/invoke.ts` : un `requestId` par envoi ; `roles:reply` (IPC, `roles/ipc.ts`,
   `roles-ipc.ts`, preload, garde de la lecture seule du profil).

**Renderer**

6. `thread/WorkCard.tsx` (nouveau) : bulle `RoleRequestBubble`, carte `WorkCard` (en-tête, en
   cours, réponse repliée, pied, actions, transmission, arrêté / erreur, rôle qui écrit) ;
   `thread/work-card.ts` (pur : état, durée, transmission, coût) ; `roles/useWorkActivity.ts`
   (outil en cours et derniers faits, en direct).
7. `Transcript.tsx` : la bulle et ses cartes à la place de l'élément `role-request` ; les éléments
   couverts par une carte cachés ; « Sous-tâches » sans les travaux d'une bulle (lignes et ancre).
   Le fichier est à son plafond : `withLateCost` sort dans `Subtasks.tsx`.
8. Saisie : `invokeRole(name, { replyTo })`, `useRoleCompose` (suite d'un travail : jeton marqué,
   ligne « Répondra à … dans le même travail »), `useComposerRoles` (`reply`).
9. `work-cue-targets.ts` : un travail d'une bulle vise sa carte (ancre = son `child-started`).
10. `App.tsx` : `onAsk` (envoi à la mère), nom de son agent.
11. i18n `workCard.*` (fr, en), CSS de la carte (`thread-extras.css`).

**Agent factice, essais, docs**

12. Scénario `avis-long` (deux lectures, puis une longue réponse en Markdown).
13. Tests : `role-request.test.ts`, `transcript` (bulle, rejeu, ancienne conversation),
    `work-card.test.ts`, `WorkCard.test.tsx`, `Transcript.test.tsx`, `work-cue-targets.test.ts`,
    `children.test.ts` (bulle, réponse entière, limite, suite), `invoke.test.ts`, saisie (Répondre).
14. e2e `roles-travail` (et suites qui lisaient `role-launch` / `child-report` d'un `@rôle`).
15. `architecture.md`, ADR-0060, changelogs, index.

Pas de nouvelle dépendance.

## Journal

- 2026-11-19 : fiche et plan.
- 2026-11-19 : fait.
  - **Modèle (ADR-0060, proposé)** : élément `role-request` à part, jamais un `user` (un `user`
    ouvre un tour, compte au rejeu `replayTail`, borne `childNews` : la bulle n'est pas envoyée à
    l'agent de la mère et ne doit rien de cela). Posé par le main juste avant le `child-started` de
    chaque travail parti (`ChildRequest.ask`, le même objet passé à chaque rôle du message par
    `startRoleChildren`, complété en place), remplacé à sa place à chaque rôle (`requestId`) : un
    rôle refusé n'y paraît jamais, la bulle précède toujours ses lancements, un message dont aucun
    rôle ne part ne laisse rien. Le lancement porte `request`.
  - **Carte lue du fil** (`workCards`) : pas de nouvel état ; un lancement qui nomme une bulle
    absente (fil abîmé) et les anciennes conversations s'affichent comme avant.
  - **Réponse entière** : `ChildReport.reply` (`keptReply`, 20 000 caractères, `replyCut` et
    `replyChars` au-delà), seulement pour un travail d'une bulle (son lancement le dit, lu dans le
    fil de la mère). L'agent de la mère reçoit toujours l'extrait borné (fiche 160).
  - **Répondre** : canal `roles:reply` (refusé en lecture seule du profil) →
    `ChildConversations.reply` : bulle `followUp`, puis le message à la même conversation, sans
    provenance (« De la conversation mère ») ni réveil ; refusé pour un travail inconnu, d'une
    autre conversation, sans rôle, ou archivé. Saisie : `invokeRole(nom, { replyTo })` remplace les
    jetons par celui du rôle, marqué « suite du travail » ; la ligne dit « Répondra à … dans le
    même travail » ; ajouter un autre rôle en fait un nouveau lancement ; retirer le jeton
    l'oublie ; un envoi refusé remet jeton et texte.
  - **Carte** (`WorkCard.tsx`) : en-tête (avatar à son état, nom, « lecture seule · dans ce
    dossier » / « lecture seule demandée » / « écrit dans sa branche » / « écrit dans ce dossier »,
    état à droite : temps écoulé, « a répondu · 21:15 », « arrêté », « en erreur », « attend votre
    accord », « conversation supprimée ») ; rappel du non commité laissé (fiche 240) ; activité en
    direct (`useWorkActivity` : outil en cours et trois derniers outils finis, ce qui arrive
    pendant que la carte est affichée) ; réponses et suites dans l'ordre ; réponse repliée à 16em
    (≈ 10 lignes, mesurée : le bouton n'est là que si elle dépasse), 5em une fois transmise
    (maquette, état 3) ; pied « durée de l'échange · coût » (« gratuit » si le coût est nul, rien
    en présentation) ; actions : « Demander à <agent> de l'appliquer » (rôle de conseil, réponse
    pas encore transmise), « Voir les modifications » (rôle qui écrit, vue Git de sa conversation),
    « Relancer » (arrêté, en erreur : la même demande au même travail, par `roles:reply`),
    « Répondre à <rôle> », « Arrêter » (en cours : `agent.cancel` de ce travail), « Ouvrir sa
    conversation » ; ligne de transmission.
  - **État** (`work-card.ts`) : la conversation fait foi tant qu'elle travaille ou attend ; sinon la
    réponse de l'échange en cours ; une suite qui vient de partir reste « en cours » 10 s au plus
    avant que sa conversation dise « occupée » ; au repos sans réponse posée (la mère répondait),
    « a répondu ».
  - **Ailleurs** : « Sous-tâches » et son ancre sans les travaux d'une bulle (`withoutCards`) ;
    `withLateCost` sorti dans `Subtasks.tsx` (`Transcript.tsx` à son plafond) ; repère rebranché
    (`work-cue-targets.ts`, ancre = lancement du travail) ; sommaire : une bulle d'ouverture est un
    message ; export : la bulle et la réponse entière ; `App.tsx` (à son plafond) passe
    `threadSubtasks(…)` (`thread-subtasks.ts`).
  - **Agent factice** : scénario `avis-long` (deux lectures, long avis en Markdown ; une suite
    « Et les contrastes ? » : réponse courte ; la mère qui reçoit la réponse : « C'est appliqué »).
  - **Tests** : `role-request.test.ts` (bulle, remplacement, `childNews`, rejeu, cartes, ancienne
    conversation, fil abîmé, travail de l'agent à côté, `keptReply` et sa limite) ;
    `WorkCard.test.tsx` (en cours avec activité, Arrêter, Ouvrir ; a répondu, repli, Lire la
    suite, gratuit ; Appliquer ; transmise ; arrêté et Relancer ; erreur et échec dit ; Répondre
    dans la même carte ; rôle qui écrit ; plusieurs rôles ; Sous-tâches des travaux de l'agent ;
    ancienne conversation ; conversation supprimée) ; `RoleComposer.test.tsx` (suite d'un travail,
    autre rôle ajouté, jeton retiré, envoi refusé) ; `roles-store.test.ts` ;
    `work-cue-targets.test.ts` ; main `roles-children.test.ts` contre l'agent factice (une bulle
    avant les lancements, rôle refusé absent, réponse entière ; pas de réponse entière sans bulle ;
    Répondre ; refus) ; `invoke.test.ts`. e2e : `roles-travail` (bulle, cartes, nouvelle partie
    `cardRun` et captures `263-carte-en-cours`, `-repondu`, `-transmise`, `-repondre`, clair et
    sombre), `repere`, `filles-non-commite`, `historique-saisie`, `roles-export`, vitrine.
  - **Écarts à la maquette** : « Lire la suite » sans le nombre de lignes (la hauteur est mesurée,
    pas les lignes) ; à fenêtre étroite, les boutons du pied passent à la ligne, alignés à droite ;
    « Faire relire » et « Fusionner dans main » attendent la fiche 264 (place prévue).
- 2026-11-19 : `./scripts/verify` vert (5 199 essais) ; `pnpm build && pnpm e2e --changed` (les
  fichiers touchés couvrent toutes les suites) : 220 tâches vertes en 19 min 32 s, clair et sombre ;
  captures `263-carte-*` regardées.

## Limites connues

- **Fusion groupée** (décision du tech lead) : le pied « Fusionner les N dans main » de
  « Sous-tâches » ne compte et ne fusionne que les lignes de la carte (`planWithout` : sans les
  travaux d'une bulle, ni leurs recouvrements). Un rôle qui écrit lancé par une bulle se fusionne
  depuis sa conversation (« Voir les modifications ») en attendant sa carte (fiche 264).
  Modifications › Filles garde toutes les filles.
- **Activité en direct** : seulement ce qui arrive pendant que la carte est affichée (comme
  `useChildActivity`) ; rouvrir la conversation pendant un travail repart de « rien encore ».
- **Bulle de suite** : l'agent de la mère ne la reçoit pas ; il reçoit la réponse suivante, avec
  son extrait, comme toute réponse d'un travail.
- **Bulle pendant une réponse de la mère** : elle s'intercale dans son fil, comme le lancement le
  faisait déjà.
- Le nom de l'agent dit sur la carte est le libellé de son profil (« OpenCode », « Agent
  factice »).
- « Répondre à <rôle> » remplace les autres jetons de la saisie par celui du rôle ; ajouter un autre
  rôle ensuite en fait de nouveaux lancements (accepté, tech lead).
- Vu une fois pendant un `vitest` complet sous charge : `ipc.test.ts` (« Electron failed to install
  correctly ») et `bob-costs.test.ts` (délai) ; verts seuls et dans `verify`. Sans lien avec ce lot.
- L'export Markdown donne la bulle et la réponse entière (ajout hors demande, accepté).
- Écarts à la maquette (« Lire la suite » sans nombre de lignes, boutons du pied à la ligne en
  fenêtre étroite) : acceptés par le tech lead.

### Décision du tech lead (2026-11-19)

- Doute 1 corrigé : pied de fusion de « Sous-tâches » limité aux lignes de la carte
  (`planWithout`, `SubtasksInfo.carded` posé par `withoutCards`). Essai qui échoue sans le
  correctif (`SubtasksMerge.test.tsx` : « Fusionner les 3 » au lieu de 2) et essai de
  `planWithout`. Doutes 2 à 7 acceptés tels quels.
