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
      coût » (« gratuit » pour un coût nul) ; « Demander à <agent> d'appliquer cette réponse » (rôle de
      conseil), « Répondre à <Rôle> », « Ouvrir sa conversation ».
- [x] Ligne de transmission : « Pas encore transmise à <agent> — elle le sera avec votre prochain
      message », puis « Transmise à <agent> · heure » (mécanisme actuel, `childContext`).
- [x] « Demander à <agent> d'appliquer cette réponse » envoie à l'agent principal un message préparé, visible
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
    en présentation) ; actions : « Demander à <agent> d'appliquer cette réponse » (rôle de conseil, réponse
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

### Revue UX (2026-11-20), tout accepté

1. Pied : une seule rangée d'actions alignée à gauche (« Demander… », « Voir les modifications »,
   « Relancer », « Répondre à… »), « Ouvrir sa conversation » au bout (`margin-left: auto`) ;
   « Arrêter » dans la même rangée en cours (`WorkFoot.tsx`).
2. Transmission sur plusieurs échanges : « Dernière réponse pas encore transmise à … », « ✓
   Transmise · heure » sous chaque réponse déjà transmise ; bouton « Demander à <agent>
   d'appliquer cette réponse ».
3. Un pied par réponse : heure · durée de cet échange · coût de cet échange (`exchangeUsage` : le
   cumul de la conversation à cette réponse moins celui de la réponse d'avant ; même unité
   seulement).
4. « Lire la suite » / « Replier » : chevron de 13 px, `--muted`, 12,5 px, sans nombre de lignes.
5. Repli : 16em (dix lignes à 1,6), dernier bloc sans marge basse, bouton remonté dans le fondu ;
   transmise : 3,2em (deux lignes), fondu de 1,4em.
6. Échanges : filet pointillé avant chaque suite, puce du rôle (18) dans la bulle de suite, heure
   de chaque réponse dans son pied.
7. Bulle et cartes dans un même groupe (`role-request-group`, écart de 10 px).
8. « Ouvrir sa conversation » en `--muted`.
9. Carte étroite : `container-type: inline-size`, `@container (max-width: 520px)` ; capture
   `263-carte-repondu-900`.
10. Captures `263-carte-arrete`, `263-carte-erreur` (scénario `avis-long` : « Vérifie la base »
    échoue).
11. En cours : icône devant l'activité, faits au passé d'après le genre ACP de l'outil (« A lu
    src/style.css », « Lit … », « Lance … »), « Travaille… » avant toute activité, moins de vide.
12. Message préparé : « Applique la proposition « titre » de <rôle> (travail <id> : sa réponse
    t'est transmise avec ce message). » ; le titre cité tel quel s'il porte déjà ses guillemets.
13. Ligne sous la saisie : « dans sa propre conversation », « un travail chacun, en parallèle ».
14. L'anneau de l'avatar pulse en cours (déjà `role-ring`, sans animation si réduites).

### Revue QA (2026-11-20), tout corrigé ; chaque défaut a un essai qui échoue sans son correctif

1. « Relancer » après un démarrage raté (aucun message dans la conversation du travail) repasse par
   `launch` : consigne du rôle, lecture seule (celle du lancement), `IN_PLACE_LINE`
   (`ChildConversations.relaunch`). Essai contre l'agent factice (`roles-children.test.ts`).
2. `childContext` nomme le rôle et l'id de chaque travail (lancement et réponse) ; message
   préparé avec le rôle et l'id du travail, plus « ci-dessus ».
3. Fil côte à côte (`BesidePane`, sans la liste des conversations) : état `unknown`, ni
   « conversation supprimée » ni lecture seule supposée ; sans conversation connue, pas de
   « lecture seule » par défaut.
4. Fini sans réponse posée : `pending` (la mère répond, « Sa réponse s'affichera à la fin de la
   réponse de … ») ou `silent` (« sans réponse », « Relancer ») ; un échec d'envoi d'une suite est
   dit dans le fil de la mère (`workCard.notice.replyFailed`).
5. « Appliquer » et « Relancer » désactivés jusqu'à l'acquittement ; « Appliquer » masqué quand
   un message attend dans la file de la mère (`motherQueued`, `threadSubtasks(…, snapshot)`).
6. `askedByBubble` : la mère cherchée d'abord, aucune exception si elle a disparu ; les abonnés
   du gestionnaire isolés (`notifyAll`, `notify-safely.ts`) : un abonné qui lève ne prive plus les
   suivants (essai dans `manager.test.ts`).
7. Plan de fusion filtré sur les mêmes ids que la liste (`planWithout(plan, carded)`).
8. « Transmise » : pas si le tour du message suivant a fini en erreur sans réponse (`relayOf`).
9. « Répondre » à un rôle désactivé ou supprimé : le jeton vient du badge du travail
   (`invokeRole(nom, { replyTo, role })`, `withReplyRole`) ; la suite va au travail, jamais à
   l'agent principal.
10. Essais ajoutés : export Markdown, deux réponses et leur transmission, Markdown hostile.
- `reply()` refuse une mère archivée, un travail lancé sans bulle ; texte borné
  (`MAX_PASTED_TEXT_CHARS`).
- Fil abîmé : bulle sans `works`, `requestId` répété (la première seule), ancre seulement avec un
  lancement (unique par travail).
- « Ouvrir sa conversation » reste pour un travail archivé.
- `dispatchReply` : historique de la saisie seulement après un envoi réussi.
- Pilote : `.msg-user` des suites exclus (lecture, envoi), cartes-réponses lues (`shot.works` :
  rôle, état, début de la réponse), `attendre` attend un travail en cours ; essais
  (`pilote.test.mjs`, `cible.test.mjs`).
- Suite envoyée pendant que le travail répondait : une réponse dont le tour a commencé avant la
  suite (`ChildReport.askedAt`) se range avant elle (`placeReport`).
- Coût d'un échange : `exchangeUsage` (essai à deux échanges, 0,25 − 0,10).
- Essai de `TurnSummary.test.tsx` daté du 19 novembre (fiche 261) : il échouait passé ce jour ;
  la date est maintenant celle du jour.

### Limites (revues)

- Un compte rendu retenu pendant une réponse de la mère est en mémoire : perdu si l'app se ferme
  avant la fin de cette réponse. La carte dit alors « sans réponse » et propose « Relancer ».
- Après un tour de la mère en erreur, `childNews` ne renvoie pas les nouvelles déjà parties avec
  ce message (comportement d'avant) ; la carte, elle, ne les dit plus « transmises ».

### Vérification après les revues (2026-11-20)

- `./scripts/verify` vert ; `pnpm build && pnpm e2e roles-travail repere filles-non-commite
  filles-fusion` : 8 tâches vertes (clair et sombre), une seule campagne ; captures regardées,
  dont les nouvelles `263-carte-repondu-900`, `263-carte-arrete`, `263-carte-erreur`.
- Vu une fois pendant `verify` : `agent-host-opencode-2-3.test.ts` (`ENOTEMPTY` au nettoyage d'un
  dossier temporaire) ; vert seul et au `verify` suivant. Sans lien avec ce lot.

