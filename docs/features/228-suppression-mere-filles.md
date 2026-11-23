# 228 — Supprimer ou archiver une mère : ses filles suivent

- **Statut** : fait
- **Dépend de** : 097 (filles), 171, 177 (relecteurs), 196 (corbeille)
- **Agents** : les deux — gestion des conversations côté main, rien de propre à un agent

## Pourquoi

Supprimer une mère laissait ses filles reliées (`startedFrom.id`) à une conversation qui n'existe
plus. Le résumé masquait le lien, mais l'enregistrement le gardait : un compte rendu, un réveil ou
une notice posés par un chemin qui avait lu la mère *avant* sa suppression (`post(motherId…)`)
passaient par `manager.get()`, qui lève « conversation inconnue » — dans un `catch` ou une promesse
non attendue, donc perdu sans rien dire. Et l'utilisateur ne choisissait rien : ses filles
restaient, sans que la confirmation les nomme.

## Comportement (validé par Jérôme, 2026-11-15)

1. Supprimer une mère qui a des filles ouvre une confirmation qui les nomme, avec une case
   « Supprimer aussi ses N filles », cochée par défaut. Les filles au travail sont arrêtées
   proprement (`session/cancel`) avant d'être supprimées ; les petites-filles suivent, récursivement.
2. Case décochée : les filles deviennent des conversations ordinaires — lien `startedFrom` coupé,
   affichage normal, note « Conversation mère supprimée » dans leur fil. Leurs comptes rendus
   suivants restent dans leur propre fil (il n'y a plus de mère où les poser).
3. Plus d'envoi perdu en silence : un évènement vers une conversation qui n'existe plus est écarté
   et consigné dans le journal, jamais d'exception non rattrapée (compte rendu, réveil, fusion,
   relecture, garde-fou de lecture seule, tout `post`).
4. Archiver une mère archive ses filles ; la sortir des archives ressort celles archivées avec elle.
5. Une fille déjà orpheline (laissée par une version précédente) s'affiche comme une conversation
   ordinaire : son lien mort est **réparé** au chargement (voir Décisions).

## Critères d'acceptation

- [x] `post` vers une conversation inconnue : rien ne lève, une ligne `warn` dans le journal
      (type d'évènement, identifiant court) ; `post` rend `false`.
- [x] Compte rendu d'échec de lancement, notice d'échec d'envoi (`deliver`), réveil, fusion,
      relecture : plus aucune promesse rejetée quand la mère (ou la cible) a disparu.
- [x] Au chargement, un `startedFrom` qui pointe vers une conversation absente de l'index est retiré
      de l'enregistrement (journal : combien) ; l'index est réécrit.
- [x] `conversation:delete` accepte `children: 'delete' | 'keep'` (absent : `keep`, qui ne perd rien).
  - [x] `delete` : descendance supprimée, des plus profondes aux plus proches, chacune arrêtée
        proprement si elle travaille, puis la mère. Lecture seule : rien n'est touché.
  - [x] `keep` : la mère supprimée, chaque fille directe perd son lien et reçoit la note
        `children.notice.motherDeleted` ; les petites-filles restent sous leur mère (qui survit).
- [x] Archiver une mère archive sa descendance (marquée `archivedWith`) ; refusé, sans rien changer,
      si l'une d'elles travaille. Sortir la mère des archives ressort celles marquées `archivedWith`
      à son nom, pas celles archivées avant (une fille fusionnée et nettoyée, fiche 110, reste aux
      archives).
- [x] Confirmation de suppression qui nomme les filles, case cochée par défaut (maquettes validées
      par Jérôme le 2026-11-15).
- [x] Tests unitaires (`family.test.ts`, `ipc.test.ts`) et contre l'agent factice
      (`family-delete.test.ts` : scénarios `echo` et `attend-stop` pour une fille au travail).
- [x] e2e de la confirmation (`filles` : filles nommées, case cochée, puis décochée), en clair et
      sombre.
- [x] « Supprimer aussi chez… » : chaque conversation supprimée l'est chez son propre agent, s'il
      sait le faire ; le libellé nomme ces agents, et dit ceux qui ne le savent pas.

## Décisions

- **Lien mort réparé plutôt qu'ignoré.** Le résumé l'ignorait déjà (`motherOf`), mais l'ignorer
  laisse un lien latent : restaurer la mère depuis la corbeille (fiche 196) rattacherait des filles
  que l'utilisateur voit depuis longtemps comme des conversations ordinaires, et chaque lecteur de
  `record.startedFrom` (coûts par famille, `usage/import.ts`) devrait refaire le contrôle. Réparer
  donne un seul modèle : une fille a une mère vivante, ou pas de lien — comme après une suppression
  « garder les filles » (point 2). La note n'est pas posée pour ces anciennes orphelines : on ne sait
  ni quand ni comment la mère est partie, et ce serait charger chaque fil au démarrage.
  Conséquence assumée : une mère encore dans la corbeille au lancement ne retrouvera pas ses filles
  si on la restaure.
- **`keep` par défaut côté main.** La case est cochée par défaut dans l'interface, mais un appel sans
  avis (ancien renderer, autre chemin) ne doit rien supprimer de plus que demandé.
- **`post` tolérant.** Un évènement de l'app vers une conversation partie n'a plus de destinataire :
  l'écarter avec une ligne de journal vaut mieux qu'une exception que chaque appelant devrait
  rattraper (beaucoup ne le faisaient pas, dans des `catch` ou des promesses non attendues).
- **Archiver refusé si une fille travaille**, comme pour la mère elle-même
  (`conversations.error.busyArchive`) ; le message nomme la fille.
- **Réponses validées (2026-11-15)** : `keep` côté main sans précision, la case cochée dans
  l'interface ; N compte toute la descendance ; archivage refusé si une fille travaille ; worktrees
  des filles gardés sans case de plus (nettoyage : Réglages › Données › Worktrees orphelins).
- **« Supprimer aussi chez… » par agent.** Une fille peut tourner sur un autre agent que sa mère.
  La case apparaît si au moins une des conversations supprimées (la mère, et ses filles si la case
  de la famille est cochée) a un agent qui sait supprimer une session ; le libellé nomme ces agents
  (« chez Agent factice et OpenCode », « ces conversations » au pluriel), et une ligne dit ceux qui ne
  le savent pas (« Bob ne sait pas supprimer une session : celles de ses conversations y restent »).
  Côté main, chaque conversation n'est supprimée chez son agent que s'il l'annonce (`agentDeletes`),
  la mère comprise : la case peut venir de l'agent d'une fille.
- **Worktrees des filles gardés par défaut** à la suppression (option `childWorktrees`, fausse par
  défaut) : une fille peut avoir du travail non fusionné ; la corbeille ne rattrape pas un worktree.

## Plan

**Main (fait d'abord, sans attendre les maquettes).**

- `src/main/conversations/family.ts` (nouveau, pur) : `descendants(records, id)` (des plus profondes
  aux plus proches, résistant aux boucles), `repairOrphans(records)`, `archiveMembers(records, id,
  archived)`.
- `src/main/conversations/family-delete.ts` (nouveau) : `deleteWithChildren(manager, id, options)` —
  arrêt propre (`cancel`, attente bornée de la fin du tour), suppression des descendantes puis de la
  mère ; ou suppression de la mère puis `detachChildren`.
- `manager.ts` (au plafond ESLint de 1050) : `post` tolérant et booléen, `detachChildren`,
  `setArchived` en cascade, réparation au chargement. Pour la place : `notePendingMemory` et les
  brouillons à quitter sortent vers `helpers.ts`.
- `store.ts` : `ConversationRecord.archivedWith?: string`.
- `children.ts` : `launch` relit la mère au moment de poser le compte rendu d'échec ; `deliver` et
  `wake` ne lèvent plus quand la cible a disparu ; comptes rendus retenus d'une mère supprimée
  consignés.
- `children-merge.ts` : `emit` lit le booléen de `post` au lieu d'un `try`.
- `ipc.ts`, `shared/ipc.ts`, `preload/api.ts`, `useConversations.ts` : option `children` (et
  `childWorktrees`) de `conversation:delete` ; canal `conversation:family` (descendance, qui répond)
  pour la confirmation.
- i18n : `children.notice.motherDeleted`, `conversations.error.busyArchiveChild`.

**Interface (après validation des maquettes).** `DeleteDialog` (`ConversationMenu.tsx`) : liste des
filles (titre, état au travail), case « Supprimer aussi ses N filles » cochée par défaut, et ce que
la case décochée fait.

## Maquettes

Maquettes validées par Jérôme le 2026-11-15 (gardées hors du dépôt).

## Journal

- 2026-11-15 — fiche créée. Constat à la lecture du code : le résumé masque déjà le lien mort
  (`motherOf` dans `helpers.ts`), donc la barre latérale range l'orpheline comme une conversation
  ordinaire ; les vraies pertes viennent des chemins qui ont lu la mère avant sa suppression
  (`launch` dans `children.ts`, `deliver`, `wake`) et posent ensuite chez elle.
- 2026-11-15 — main process fait. `post` booléen et tolérant ; `family.ts`, `family-delete.ts`
  (`deleteConversation`, `detachChild`, `familyOf`) ; `setArchived` en cascade avec
  `ConversationRecord.archivedWith` ; réparation des liens morts au chargement (index réécrit) ;
  `children.ts` : `launch` relit la mère au moment de poser le compte rendu d'échec, `startFailure`
  ne lit plus une fille supprimée, une fille dont la mère disparaît pendant sa préparation est
  détachée (note) au lieu de naître orpheline, comptes rendus retenus d'une mère supprimée consignés ;
  `children-merge.ts` lit le booléen de `post`. Test de non-régression vérifié en remettant l'ancien
  code : « Unhandled Rejection » sur le compte rendu d'échec de lancement.
  Écarts au plan : `DeleteOptions` dans `shared/agent.ts` et `FamilyMember` dans
  `shared/children.ts` (plafond de 800 lignes de `shared/ipc.ts`) ; pour tenir le plafond de
  `manager.ts`, `notePendingMemory` et la fermeture des sessions de brouillons
  (`draftSessionsOpen`, `dropAllDraftSessions`) passent dans `helpers.ts`, sans changement de
  comportement. Interface actuelle inchangée : elle n'envoie pas encore `children`, donc supprimer
  une mère garde ses filles (`keep`), avec la note.
  Maquettes de la confirmation rendues (clair, sombre, Aurore, Aurore nuit) : en attente de
  validation, interface non codée.
  Essais : `./scripts/verify` vert ; e2e `history`, `filles`, `filles-visibilite`,
  `filles-tech-lead`, `filles-fusion`, `profil`, `parallel`, `restart`, `inbox`, `relecture`, en
  clair et sombre : 19/19 ; un échec isolé de `filles` dark (pointeur des propositions en rafale,
  trois suites en parallèle) ne s'est pas reproduit en la rejouant seule (2/2).
- 2026-11-15 — interface. Maquettes validées par Jérôme (« Ok je valide les maquettes »).
  `DeleteDialog` sort de `ConversationMenu.tsx` vers `sidebar/DeleteDialog.tsx` ; descendance lue par
  `conversation:family` (titre, état au travail, agent), rangée par `familyRows`
  (`sidebar/delete-family.ts`) ; case « Supprimer aussi ses N conversations filles » cochée,
  « au travail, sera arrêtée » / « au travail », note sous la liste selon la case ; `agentsOf` pour
  « Supprimer aussi chez… ». Styles `.family-list`, `.family-note` dans `styles.css`. Main :
  `FamilyMember` porte `profileLabel` et `agentDeletes`, `deleteConversation` ne demande la
  suppression chez l'agent qu'à ceux qui la savent — un test sur un hôte factice a trouvé que les
  filles lisaient le `fromAgent` déjà retiré à la mère, corrigé. e2e `filles` : la confirmation
  nomme les 2 filles, case cochée, puis décochée pour garder le scénario « mère supprimée, filles
  ordinaires » ; captures `filles-4a-confirmation`, `filles-4b-confirmation-garder`.
- 2026-11-15 — relecture du tech lead. Maquettes retirées du dépôt (public, aucune fiche n'y garde
  les siennes). e2e `filles` : une troisième fille, lancée sur `attend-stop`, est au travail au
  moment de la confirmation (« au travail, sera arrêtée » cochée, « au travail » décochée) ; en
  sombre, la même confirmation en Aurore nuit (`filles-4c-confirmation-aurore-nuit`). Elle est
  ensuite arrêtée et lue, et la suppression part case décochée : les trois filles restent,
  ordinaires. Changelogs raccourcis ; le détail (évènement écarté et noté dans le journal, liens
  morts réparés au lancement, filles ressorties des archives avec leur mère seulement si elles y
  sont entrées avec elle) reste ici.
- 2026-11-23 — Recette avant la 1.0.0-rc.4 (branche `fix/chasse-correctifs`) :
  - Erreurs « Conversation inconnue » (`git:status`, `commands:project`) au journal après la
    suppression d'une mère affichée qui attendait une autorisation. Cause : le main retire la
    conversation (`conversations.delete`) juste après avoir arrêté son agent, et ne publie la
    liste (nouvelle active) qu'après sa mise à la corbeille ; l'arrêt fait passer la mère de
    « répond » à « prête », et `useGitStatus` / `useProjectCommands` relisaient la conversation
    affichée, déjà inconnue du main. Correctif à la cause : `useConversations` garde les
    conversations dont la suppression est en cours (la mère, et sa descendance si elle part avec
    elle ; `descendants` passé dans `@shared/children`, partagé avec le main) et rend `queryId`,
    `null` pour elles jusqu'à la fin de la suppression (réussie ou refusée) ; `App` passe
    `queryId` à ces deux lectures. Preuves : `useConversations.remove.test.ts` ; sonde réelle
    (build, agent factice, `/scenario filles`, mère en attente d'autorisation supprimée avec ses
    filles) : 2 erreurs IPC avant, 0 après. Garde e2e dans `filles` (mère affichée supprimée :
    aucune erreur IPC de ces canaux), verte avant comme après (mère au repos dans ce parcours :
    ne reproduit pas, garde seulement).
  - Focus perdu sur `<body>` après « Mettre à la corbeille » : Radix le rendait au bouton qui avait
    ouvert la boîte, dans la ligne supprimée juste après. `DeleteDialog` : confirmée, le focus va à
    la zone de saisie (`onCloseAutoFocus`) ; annulée, rien ne change. Preuve :
    `DeleteDialog.test.tsx`, rouge sans le correctif, vert avec.
- 2026-11-23 — Seconde chasse avant la 1.0.0-rc.4 (branche `fix/restauration`) :
  - **T1, bloquant (déjà en rc.3)** : une conversation restaurée depuis la corbeille restait
    « Arrêté », le message dans la saisie, rien ne partait. Cause : le renderer garde la vue d'une
    conversation déjà affichée et écarte toute vue ou tout évènement dont le numéro (`seq`) n'est
    pas plus récent (`useConversations`, `reducer`) ; restaurée, la conversation renaissait côté
    main avec `seq` à 0. Son agent démarrait bien (« Agent lancé » au journal), mais ni son état
    « prête » ni la réponse n'atteignaient la fenêtre, qui gardait l'état « arrêtée » de la
    suppression. Ni `AgentHost.stop({ forGood })` ni un hôte gardé n'étaient en cause (la
    restauration crée un hôte neuf). Correctif à la cause : le numéro des évènements est compté
    pour tout le gestionnaire (`eventSeq`), et une conversation restaurée part du dernier émis.
    Preuves : `manager.test.ts` (« restaurée depuis la corbeille… », rouge avant : vue à 1 après
    28 évènements vus) ; e2e `profil` (`restoredResumes` : envoyer, supprimer, restaurer, rouvrir,
    envoyer, réponse), rouge sur l'ancien code, vert avec le correctif, en clair et sombre.
  - **T7** : restaurer une mère ne restaurait pas les filles supprimées avec elle. Elles sont
    marquées dans la corbeille (`deletedWith`, fiche de corbeille `<id>.meta.json`) quand
    `deleteConversation` les emmène, et `restoreFromTrash` les restaure avec la mère
    (`TrashLink.restoreFamily`) ; une fille supprimée seule avant reste à la corbeille, une fille
    qui ne revient pas (fichier abîmé) est consignée sans empêcher la mère. Pas de nouveau texte
    ni bouton : le pendant de l'archivage (`archivedWith`). Preuve : `family-delete.test.ts`
    (fille et petite-fille restaurées, liens intacts, fille supprimée avant laissée, fille
    restaurée qui répond de nouveau). Un travail supprimé pendant son démarrage n'a jamais été une
    conversation : rien à restaurer, sa ligne reste « conversation supprimée ».
  - **T7, comptage** : l'en-tête d'une carte de travaux comptait un travail supprimé et un
    travail fusionné comme « a répondu ». Désormais « N supprimé(s) » et « N fusionné(s) »
    (`workGroup.count.gone`, `workGroup.count.merged`). Preuve : `WorkGroup.test.tsx`, rouge
    avant (« 2 ont répondu »).
  - Essais : `./scripts/verify` vert ; `pnpm build && pnpm e2e --changed --jobs 3` (236 tâches,
    toutes les suites : `manager.ts` et les traductions touchés) : 235/236, l'échec isolé de
    `travaux-groupe` sombre (« proposés : une carte de groupe… », avant tout lancement, que le
    comptage ne touche pas) ne s'est pas reproduit en rejouant la suite seule (clair et sombre,
    2/2). Capture `196-restauree-reprise` (clair, sombre) regardée : « Prêt », la réponse à
    « Après la corbeille ».

