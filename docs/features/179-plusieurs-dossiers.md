# 179 — Plusieurs dossiers par conversation

- **Statut** : fait
- **Dépend de** : 166 (onglet Session), 181 (SDK ACP 2), 004 (dossier de travail)
- **Agents** : générique, selon la capacité annoncée `sessionCapabilities.additionalDirectories`
  — OpenCode (2.0.31+) l'annonce, Bob 2.0.9 non (rien n'est supposé de Bob : sans la capacité,
  rien n'est envoyé)

## Pourquoi

Une tâche touche souvent plusieurs dépôts (une app et sa bibliothèque, un client et son serveur).
Aujourd'hui une conversation n'a qu'un dossier : l'agent ne voit pas l'autre, ou il faut ouvrir
le dossier parent. ACP prévoit des dossiers en plus du dossier de travail (`additionalDirectories`,
RFD finie le 2026-05-27) : l'utilisateur en ajoute à la conversation, l'app les donne à l'agent à
l'ouverture de la session.

## Décisions

- **Où** : onglet Session (fiche 166), section Environnement, ligne « Autres dossiers » sous
  « Dossier » : un dossier par ligne (nom, chemin complet en infobulle, clic : l'afficher dans le
  Finder), une croix pour le retirer, « Ajouter un dossier… » (dialogue natif du main).
- **Quand c'est envoyé** : à `session/new`, `session/load` et `session/resume`, liste complète,
  chemins absolus, **seulement si l'agent annonce la capacité** ; dossier disparu entre-temps :
  pas envoyé (journal). Le protocole ne prévoit aucun changement en cours de session : un ajout ou
  un retrait **rouvre la session** (agent relancé, fil gardé, comme « Relancer »), seulement
  quand l'agent est prêt ; pendant une réponse, la ligne est désactivée (« après la réponse »).
  Conversation sans agent vivant : enregistré, envoyé au prochain démarrage.
- **Sans la capacité** (Bob, ou agent pas encore démarré) : rien à ajouter, la ligne est absente ;
  si la conversation a déjà des dossiers (passée d'OpenCode à Bob, fiche 108), ils restent listés,
  grisés, avec « Non transmis : <agent> ne prend pas en charge d'autres dossiers ».
- **Mémorisé** dans la conversation (`ConversationRecord.additionalDirectories`), pas dans les
  réglages ; une branche (fiche 023) ou une fille (fiche 097) ne les reprend pas (à décider plus
  tard si le besoin vient).
- Hors du périmètre : mentions `@` et pièces jointes depuis ces dossiers, état git (onglet
  Modifications) de ces dossiers, worktree pour eux.

## Critères d'acceptation

- [x] Ajout et retrait dans l'onglet Session, mémorisés avec la conversation.
- [x] Envoyés à `session/new`, `session/load`, `session/resume` seulement si l'agent annonce
      `sessionCapabilities.additionalDirectories` ; jamais sinon (essai de l'hôte d'agent).
- [x] Changement avec l'agent prêt : session rouverte avec la nouvelle liste, fil gardé.
- [x] Sans la capacité : rien à ajouter ; dossiers déjà là listés comme non transmis.
- [x] Agent factice : `--dossiers-en-plus` annonce la capacité, scénario `dossiers` répond avec ce
      qu'il a reçu ; suite e2e avec captures avant/après, clair et sombre.
- [x] `docs/agents.md` (matrice générique), `docs/acp.md`, CHANGELOG fr + en, i18n fr + en.

## Plan

1. Hôte d'agent (`agent-host.ts`) : `SessionSupport.additionalDirectories`, option
   `additionalDirectories: () => string[]`, ajoutée aux trois requêtes ; capacité dans l'instantané
   (`AgentSnapshot.additionalDirectories`).
2. Gestionnaire : champ du `ConversationRecord`, du `ConversationSummary` ; `setAdditionalDirectories`
   (enregistre, rouvre la session si l'agent est prêt) ; options de l'hôte (`host-options.ts`).
3. IPC `conversation:addFolder` (dialogue) et `conversation:removeFolder` ; preload.
4. Interface : `SessionEnvironment` (ligne « Autres dossiers »), textes fr / en.
5. Agent factice : option, scénario, essais ; suite e2e `dossiers`.
6. Docs.

## Journal

- 2026-11-06 — Fiche ouverte et faite, sur la branche de la fiche 181 (après la montée du SDK).
  - **Fait comme prévu** : `agent/additional-directories.ts` (champ de la requête, dossiers
    disparus ou relatifs écartés), `conversations/additional-directories.ts` (ajout, retrait,
    session rouverte par `restart` si l'agent est prêt, refus pendant une réponse, rien rouvert
    si la liste ne change pas), `ConversationRecord` / `ConversationSummary`, IPC
    `conversation:addFolder` / `conversation:removeFolder`, `panel/SessionFolders.tsx`.
  - **Écarts au plan** : `manager.ts` était à son plafond de lignes (1 050 / 1 050, fiche 089) :
    au lieu d'une méthode de plus, une méthode générique `updateRecord` (reprise par `rename` et
    `setPinned`) et la recherche sortie dans `ContentSearch.searchConversations` ; le plafond ne
    remonte pas. `ipc.ts` (800 lignes) : libellés du dialogue dans le module des dossiers. La
    capacité est aussi listée sur la page de l'agent (« Ce qu'il annonce », repère
    `additional-directories`), d'où la ligne de `docs/agents.md`.
  - **Agent factice** : `--dossiers-en-plus` (`MOCK_AGENT_DIRECTORIES=1`), **pas par défaut** pour
    ne pas changer l'onglet Session des autres suites ; sans l'option, il refuse les dossiers
    (`invalidParams`) : les essais prouvent ainsi que l'app n'en envoie jamais à un agent qui ne
    l'annonce pas (comme Bob 2.0.9, sonde du jour).
  - **Essais** : unitaires (hôte d'agent contre l'agent factice, gestionnaire, composant,
    annonce) ; suite e2e `dossiers` clair et sombre (ajout par le dialogue simulé, l'agent reçoit
    le dossier, retrait, relance avec un agent sans la capacité).
  - **Captures** (`e2e/captures/`) — avant : `session-1-total-{light,dark}.png` (onglet Session
    sans la ligne, agent factice par défaut, identique à la 0.8) ; avec la capacité, aucun
    dossier : `dossiers-1-avant-{light,dark}.png` ; après l'ajout : `dossiers-2-apres-{light,dark}.png` ;
    agent sans la capacité, dossier gardé : `dossiers-3-non-transmis-{light,dark}.png`.
    Regardées : libellé « Autres dossiers » sur deux lignes, aligné sur le premier dossier
    (corrigé après la première capture, qui laissait un trou).
  - **Vidéo** (hors dépôt, à la demande de la relecture) : 15 s, ajout puis retrait d'un dossier
    dans l'onglet Session avec l'agent factice, app construite ; screencast du protocole DevTools
    assemblé en MP4 par AVFoundation (ni Playwright ni ffmpeg sur la machine, rien téléchargé),
    scripts jetables dans le dossier de travail temporaire de la session.
  - **Non fait / à décider plus tard** : pas de mentions `@`, de pièces jointes ni d'état git pour
    ces dossiers ; une branche ou une fille ne reprend pas la liste ; non essayé avec un vrai
    OpenCode (la sonde avec modèle n'a pas été lancée : pas de vrai modèle dans les essais).
- **2026-11-06** — corrections de la recette 0.9 (fiche 183, D13 et D14).
  - **D13 (majeur)** : avec un vrai OpenCode, le dossier ajouté arrivait dans la session
    (`additionalDirectories`), mais le modèle n'en savait rien. Décision de la relecture : l'app le
    dit elle-même, sans rien de propre à un agent. `agent/additional-directories.ts` :
    `SessionDirectories` retient la liste envoyée à l'ouverture de la session ; au message
    suivant, si elle diffère de ce que l'agent a lu dans cette session, une ligne en anglais
    (ADR-0014) part avec les autres contextes de l'app : « Additional working directories for
    this conversation: /a, /b », ou « …: none (removed /a) ». Une fois par changement (premier
    message compris s'il y a des dossiers), jamais à chaque tour. Ce que l'agent a lu est gardé
    dans la fiche de la conversation (`toldDirectories`, avec l'identifiant de session : une
    session neuve se le voit redire), car l'hôte d'agent est recréé à chaque changement. Rien pour
    un agent qui n'annonce pas la capacité (rien n'est envoyé, rien n'est dit).
  - **D14 (mineur)** : dossier ajouté avant le premier message → la conversation est encore un
    brouillon, `restart` ouvrait une session neuve et laissait l'ancienne, vide, chez l'agent.
    `restart` d'un brouillon passe maintenant l'ancien hôte à `dropDraftSession` (le chemin des
    conversations vides quittées : `session/delete` si l'agent l'annonce, suivi jusqu'au départ de
    l'app), sorti dans `helpers.ts` (`trackDraftDrop`) pour garder `manager.ts` sous son plafond.
  - **Agent factice** : le scénario `dossiers` dit aussi la ligne reçue, ou « Pas de ligne sur les
    dossiers dans ce message. ».
  - **Essais** : unitaires (ligne au premier message, pas au suivant, « none (removed …) » après
    retrait par un nouvel hôte ; `directoriesContext` ; session neuve ; agent sans la capacité ;
    fiche lue du disque ; brouillon rouvert : l'ancienne session supprimée) ; suite e2e `dossiers`
    (ligne à l'ajout, pas au message suivant, ligne de retrait).
  - **Vérifié** : `./scripts/verify` vert (2 510 essais) ; `pnpm build && pnpm e2e --changed`
    (suite complète : l'agent factice a changé) 156/157 en clair et sombre, le seul échec
    étant l'instabilité connue de `filles` sombre (fiche 143 ; la trace des survols l'a
    attrapée : « Lancer » passé de y = 477 à y = 240), verte au deuxième passage. Capture
    `dossiers-2-apres-{light,dark}.png` regardée : la ligne reçue s'affiche sous les dossiers.
  - **Non essayé** : avec un vrai OpenCode (la recette rejouera D13 et D14).
