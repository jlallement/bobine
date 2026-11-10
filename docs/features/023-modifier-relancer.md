# 023 — Modifier un message et repartir d'un point

- **Statut** : fait
- **Dépend de** : 015

## Pourquoi

Corriger un message déjà envoyé et relancer, ou repartir d'un point antérieur, comme « Edit » /
« Rewind » dans Claude Code.

## Critères d'acceptation

- [x] « Modifier » sur un message de l'utilisateur (survol) : le texte devient modifiable sur place ;
      envoyer ouvre une **branche** qui repart de ce point, la conversation d'origine reste intacte.
- [x] « Réessayer » sur le dernier message : même chose avec le même texte.
- [x] La branche montre l'échange repris jusqu'au point de départ, puis le nouveau message ; un
      bandeau « Branche de « … » » ramène à l'original.
- [x] L'agent reçoit cet échange en contexte (il ne le refait pas) : fonctionne avec **tout agent**
      (Bob n'a pas `session/fork`, et `session/fork` d'ACP copie la session entière).
- [x] Fichiers modifiés par l'agent depuis ce point : option « Remettre les fichiers dans leur état
      d'alors », grâce aux diffs du fil ; un fichier modifié depuis par quelqu'un d'autre n'est pas
      touché (signalé) ; les commandes lancées depuis ne sont pas annulées (signalé).
- [x] Testé : agent factice (unitaires, e2e) ; Bob et OpenCode réels (contexte compris, fichiers
      remis en place).

## Notes

- Fiche 149 (2026-10-26) : le repère textuel « branche » dans la barre latérale devient une icône
  de fork, avec origine en infobulle. Modifier / Réessayer crée toujours une nouvelle conversation
  et une nouvelle session ; aucune nouvelle capacité ACP n'est supposée.

- ACP 1.8 n'a aucune méthode pour couper une session à un message ; `session/fork` (instable)
  copie la session entière, sans point de départ. Bob 2.0.6 n'annonce pas `fork` ; OpenCode 1.18
  oui. Ni l'un ni l'autre n'annonce de commande d'annulation (`/undo`, `/rewind`) par ACP.
- Côté utilisateur, c'est le « Rewind » de Claude Code ; techniquement une branche.

## Plan

1. `shared/branch.ts` : point de départ (message de l'utilisateur), échange repris (éléments
   antérieurs, assainis), contexte envoyé à l'agent (texte borné : messages, outils résumés, pièces
   jointes nommées), modifications de fichiers depuis ce point (diffs des outils terminés : état
   avant, état laissé par l'agent).
2. `main/conversations/restore-files.ts` : pour chaque fichier, contenu actuel comparé à l'état
   laissé par l'agent → à remettre / déjà dans l'état d'alors / modifié depuis (pas touché) ;
   fichier créé par l'agent → supprimé ; chemins limités au dossier de la conversation.
3. `AgentHost.prompt(text, attachments, { context })` : le contexte part avant le message, l'UI ne
   montre que le message.
4. `ConversationManager.branch(id, itemId, text, { restoreFiles })` et `branchPreview` ; enregistrement
   `branchedFrom` ; élément de fil `branch` (bandeau) ; IPC `conversation:branch`,
   `conversation:branchPreview`.
5. UI : bouton crayon et « Réessayer » au survol des messages, édition sur place, dialogue de
   confirmation quand des fichiers ont changé depuis (case cochée par défaut, liste, conflits).
6. Essais : unitaires (branch, restore-files, manager, hôte), e2e (suite `branch`), Bob et
   OpenCode réels.

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-13 — Fait.
  - **Ce que voit l'utilisateur** : au survol d'un de ses messages, un crayon (« Modifier ») ; sur
    le dernier, aussi « Réessayer ». Le texte devient modifiable sur place ; « Envoyer » ouvre une
    branche « <titre> · branche » : l'échange repris, un bandeau « Nouvelle branche de … — Voir
    l'original », puis le nouveau message et la réponse. L'originale reste intacte. Si l'agent a
    modifié des fichiers depuis ce point (ou lancé des commandes), un dialogue propose de les
    remettre dans leur état d'alors (case cochée par défaut) et signale ce qui ne sera pas touché.
  - **Comment** : `ConversationManager.branch` crée la conversation (dans l'historique tout de
    suite), y copie l'échange antérieur (assaini) et un élément `branch`, puis envoie le message
    avec un **contexte caché** (`AgentHost.prompt(…, { context })`) : l'échange en texte borné à
    60 000 caractères (messages, outils résumés, pièces jointes nommées), consignes en anglais.
    Les pièces jointes du message modifié repartent avec lui. Une branche d'une conversation en
    worktree partage le worktree, qui n'est alors jamais supprimé avec l'une des deux.
  - **Fichiers** (`restore-files.ts`, `undoEdits`) : les modifications des outils terminés depuis
    ce point sont défaites de la dernière à la première, à partir du contenu actuel. Écart au plan,
    trouvé avec OpenCode réel : ses diffs sont **par extrait** (`oldText` / `newText` = texte
    remplacé), ceux de Bob sont le fichier entier. Une modification se défait si le fichier entier
    est son texte d'arrivée, ou si ce texte y apparaît une seule fois ; sinon le fichier n'est pas
    touché (« modifié depuis »). Fichier créé par l'agent → supprimé. Rien hors du dossier.
  - **Agent factice** : le scénario est lu dans le dernier bloc de texte du prompt.
  - **Essais** : unitaires (`branch`, `restore-files`, gestionnaire, hôte), e2e `pnpm e2e branch`
    (modifier, dialogue, fichiers remis, contexte, original intact, « Réessayer »).
  - **Réels** (même parcours par le gestionnaire de conversations : « Je m'appelle Léa », modifier
    `notes.txt`, repartir du second message avec remise en état) : **Bob 2.0.6** — fichier remis à
    « Version 1 », réponse « Votre prénom est Léa, et notes.txt contient simplement Version 1 »
    (≈ 0,21 bobcoin pour deux passages) ; **OpenCode 1.18** — d'abord « modifié depuis » (diff par
    extrait), puis, corrigé, fichier remis et « Ton prénom est Léa, et notes.txt contient
    « Version 1 » ».
  - **Limites** : l'agent ne garde du début que ce texte (pas les résultats complets des outils) ;
    les commandes lancées depuis ce point ne s'annulent pas ; `session/fork` d'OpenCode n'est pas
    utilisé (il copie toute la session, sans point de départ).
- 2026-10-23 — Écart, fiche 125 : le contexte de la branche part après le nouveau message (« my
  new message is above ») ; le titre de la branche ne peut plus être remplacé par celui de l'agent
  (`titleSource: 'app'`), la carte cite le titre de l'original sans ce que l'app joint au message ;
  dans la liste, repère « branche » non tronqué et titre complet en infobulle.
