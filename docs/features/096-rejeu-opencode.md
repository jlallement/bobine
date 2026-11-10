# 096 — Rejeu d'OpenCode et retouches

- **Statut** : fait
- **Dépend de** : 021 (récapitulatif des modifications), 036 (worktrees), 078 (OpenCode 2), 088 (générique d'abord)
- **Agents** : diffs retrouvés au rejeu : OpenCode (ADR-0011, ADR-0015), parce qu'OpenCode recalcule
  ses diffs à partir du fichier sur le disque et les perd quand le fichier a changé depuis. Branche
  des worktrees et réglages : les deux.

## Pourquoi

Essai réel du 2026-10-20 (OpenCode 2.0.32 + GPT-6.1 Sol, rapport dans
`docs/recettes/2026-10-20-essai-libre-opencode-gpt.md` du dépôt principal) :

1. Après un redémarrage de l'app, Modifications › Conversation ne listait plus que 2 fichiers
   (+13) au lieu de 5 (+176 −11). En direct, l'outil « patch » d'OpenCode joint un diff par fichier
   à son `tool_call_update` terminé ; au rejeu (`session/load`), le même appel n'en a plus, et seul
   `rawOutput.metadata.files[].patch` (diff unifié) dit ce qui a changé.
2. Une conversation dans un worktree part sur une branche `bob/<horodatage>`, quel que soit l'agent.
   L'app s'appelle Bobine (ADR-0013).
3. Réglages › Agents et dossiers › Nouvelle conversation : « Comme la conversation en co… », tronqué
   dans les listes « Agent » et « Dossier ».

### Cause (relevée dans OpenCode 2.0.32)

En direct comme au rejeu, OpenCode ajoute les diffs au `tool_call_update` terminé d'un outil dont
`metadata.files[]` existe (`{ file, patch, additions, deletions, status }`) : il relit le fichier
**sur le disque**, puis lui applique le patch à l'envers pour retrouver l'ancien texte. En direct, le
fichier vient d'être écrit, ça marche. Au rejeu, s'il a changé depuis (autre modification, commande),
le patch inverse ne s'applique plus : pas de diff. Pour un fichier créé (`status: "added"`), le diff
reprend le contenu **actuel** du fichier.

## Critères d'acceptation

- [x] Au rejeu d'une conversation OpenCode, un appel d'édition terminé sans diff pour un de ses
      fichiers retrouve ce diff depuis `rawOutput.metadata.files[].patch` (un extrait par bloc du
      patch) ; Modifications › Conversation liste les mêmes fichiers, avec les mêmes totaux, qu'en
      direct (dans le scénario factice ; voir les limites au journal).
- [x] Le code propre à OpenCode reste dans son module, branché par son profil (ADR-0015) ; repère
      dans « Propre à OpenCode » et dans la matrice de `docs/agents.md` (ADR-0011).
- [x] Testé contre l'agent factice (scénario `patch-opencode` : diffs en direct, absents au rejeu,
      `rawOutput.metadata.files[]` comme OpenCode 2.0.32), test unitaire de l'adaptateur, e2e de
      l'onglet Modifications après redémarrage.
- [x] La sonde d'OpenCode vérifie ce format (`rawOutput.metadata.files[].patch` d'une édition
      rejouée après un changement du fichier).
- [x] Les nouveaux worktrees partent sur `bobine/<horodatage>` ; ceux déjà créés en `bob/…` se
      suppriment toujours (branche mémorisée avec la conversation).
- [x] « Comme la conversation en cours » tient en entier dans les listes « Agent » et « Dossier »,
      en français et en anglais.

## Plan

**1. Diffs retrouvés au rejeu**

- `agent/adapters.ts` : point d'extension générique `DiffSource` (`complete(update, cwd)` : la mise
  à jour, complétée des diffs qui lui manquent).
- `agent/opencode-diffs.ts` (nouveau, propre à OpenCode, sans alias pour la sonde) : pour un
  `tool_call_update` terminé dont `rawOutput.metadata.files[]` porte des patchs, ajoute pour chaque
  fichier **sans diff** (chemin résolu comme OpenCode : `file` relatif au dossier de la session) un
  diff par bloc du patch (contexte et lignes retirées → `oldText`, contexte et lignes ajoutées →
  `newText` ; fichier créé : `oldText: null`). Lecture par `parsePatch` du paquet `diff` (déjà une
  dépendance). Rien d'autre n'est touché : en direct, OpenCode joint ses diffs, l'adaptateur ne fait
  rien.
- `agent/profiles.ts` : `diffSource` sur le profil OpenCode (et sur l'agent factice, qui imite déjà
  OpenCode pour les sous-agents).
- `agent/agent-host.ts` : `onSessionUpdate` passe chaque mise à jour par `profile.diffSource` avant
  de la trier (le travail des sous-agents compris).
- `agent/capabilities.ts` + `fr.json` / `en.json` (`capabilities.replayDiffs.*`) : repère
  `replay-diffs` dans « Propre à <agent> » ; ligne dans `docs/agents.md`.
- Agent factice : étape `opencode-patch` (`scenario.mts`) qui écrit les fichiers, envoie la carte
  « patch » avec ses diffs en direct, et garde pour le rejeu la forme sans diff d'OpenCode
  (`send` reçoit la forme rejouée) ; scénario `patch-opencode` (`scenarios.mts`) ; ligne dans
  `docs/mock-agent.md`.
- Tests : `opencode-diffs.test.ts` (extraits, fichier créé, chemin, diff déjà là), hôte d'agent
  (mise à jour complétée), agent factice (rejeu sans diff), capacités.
- e2e : nouvelle suite `replay-changes` (`e2e/suites/replay-changes.mjs`, inscrite dans `run.mjs`) :
  scénario joué, onglet Modifications, redémarrage de l'app, conversation rouverte, mêmes fichiers et
  mêmes totaux.
- Sonde : `scripts/opencode-probe.mts` édite un fichier, le change sur le disque, recharge la
  session dans un autre processus : l'édition rejouée a-t-elle `rawOutput.metadata.files[].patch`,
  et l'adaptateur en retrouve-t-il le diff ? (`contractChecks` dans `opencode-probe.ts`).
- `docs/acp.md` (section OpenCode : diffs au rejeu, outil `patch`), `docs/agents.md`.

**2. Branche des worktrees** : `changes/worktrees.ts`, `bobine/<horodatage>` ; tests
(`worktrees.test.ts`, `manager.test.ts`) et e2e `parallel` mis à jour. La suppression utilise la
branche mémorisée avec la conversation : les anciennes `bob/…` restent prises en charge sans code.

**3. Réglages** : listes « Agent » et « Dossier » de « Nouvelle conversation » plus larges
(`settings-input-wide`, section des réglages de `styles.css`), le libellé gardé tel quel ; capture
de la suite `settings`.

Pas de nouvelle dépendance.

## Journal

- 2026-10-20 : fiche créée (session 5 de la recette OpenCode + GPT). Cause relevée dans le binaire
  d'OpenCode 2.0.32 (fonction qui complète les `tool_call_update` : patch inversé sur le fichier
  actuel).
- 2026-10-20 : fait.
  - **Diffs au rejeu** : `opencode-diffs.ts` (`withPatchDiffs`, `OPENCODE_DIFF_SOURCE`) derrière le
    point d'extension `DiffSource` (`adapters.ts`), déclaré par les profils OpenCode et agent
    factice (`diffSource`), appelé par `AgentHost.onSessionUpdate` avant le tri (sous-agents
    compris, et « Voir son travail », qui passe par l'hôte). Repère `replay-diffs` dans « Propre à
    OpenCode » et dans `docs/agents.md`. Profil Bob inchangé ; rien de supposé sur Bob.
  - **Agent factice** : étape `opencode-patch` (`scenario.mts` ; `send` prend une forme rejouée à
    part), scénario `patch-opencode`.
  - **Tests** : `opencode-diffs.test.ts` (blocs, fichier créé ou supprimé, chemin, diff déjà là, rien
    à faire, entrées mal formées) ; hôte d'agent (direct puis rejeu : mêmes modifications ; sans
    adaptateur, seuls les fichiers créés restent, comme dans l'essai) ; agent factice ;
    capacités ; sonde. e2e : suite `replay-changes`, contrôle de largeur dans `settings`, branche
    dans `parallel`.
  - **Sonde** : sondage « modifications rejouées » (édition, fichier changé sur le disque, session
    rechargée dans un autre processus). Résultat sur OpenCode 2.0.32 + `opencode/big-pickle` : le
    modèle a utilisé `edit` (pas `patch`), diff perdu au rejeu, `rawOutput.metadata.files[].patch`
    gardé, diff refait par l'adaptateur ✓. Le reste des réponses est identique aux attentes du
    2026-10-17 ; la nouvelle observation est ajoutée à `opencode-probe.expected.json` à la main
    (pas de `--accept`, qui aurait réécrit la date des autres).
  - **Worktrees** : `bobine/<horodatage>` (`BRANCH_PREFIX`) ; un test vérifie qu'un worktree `bob/…`
    d'avant se supprime avec sa branche ; `docs/README.md` à jour. La fiche 036 garde `bob/…` :
    c'est l'historique.
  - **Réglages** : listes « Agent » et « Dossier » à 280 px (`settings-input-wide`) ; l'e2e
    `settings` mesure le libellé dans la police de la liste.
- Écarts au plan et limites :
  - Plus large que « aucun diff dans l'appel » : l'adaptateur complète chaque **fichier** sans diff
    (un « patch » sur deux fichiers dont un seul a gardé son diff, comme `.bob/launch.json` créé et
    `public/app.js` modifié dans l'essai). En direct, OpenCode joint ses diffs : rien n'est ajouté.
  - Les diffs refaits sont des extraits (un par bloc du patch, contexte compris) : une modification
    d'une ligne écrite plus tôt dans la même conversation compte deux fois (+1 −1 de plus qu'en
    direct, où les textes complets s'enchaînent). Le diff d'un fichier créé, qu'OpenCode tire du
    fichier **actuel**, est gardé tel quel, même s'il contient des changements plus récents. À
    reprendre si ça gêne : refaire les textes complets en remontant les extraits depuis le fichier
    actuel (comme `undoEdits`), ou préférer le patch au diff d'un fichier créé.
  - Une mise à jour terminée sans `content` n'est pas complétée (l'ajouter remplacerait celui de
    la carte) ; OpenCode en envoie toujours un.
  - `docs/features/README.md` et les CHANGELOG ne sont pas modifiés (règle de la recette) ; voir
    ci-dessous. `./scripts/verify` échoue donc sur « fiche absente de l'index » tant que la ligne
    n'est pas ajoutée à la fusion.
- Vérifié : `./scripts/verify` vert sauf l'index ci-dessus (lint, typecheck, 1014 tests) ;
  `pnpm build && pnpm e2e replay-changes changes settings parallel restart`, clair et sombre, vert
  (captures `130`, `131`, `84-agents`, `84-agents-propre`, `95` à `97` regardées), et `settings`
  `replay-changes` en anglais (`--lang en`) ; `pnpm
  opencode-probe` sur OpenCode 2.0.32 : contrat ✓, seule différence la nouvelle observation.
  Pas d'essai avec un vrai OpenCode dans l'app (redémarrage d'une conversation réelle) : le format
  vient du journal de l'essai et de la sonde.
- À ajouter à la fusion :
  - `docs/features/README.md` : `| [096](096-rejeu-opencode.md) | Rejeu d'OpenCode : diffs perdus
    refaits depuis le patch de l'outil ; branche `bobine/…` des worktrees ; libellé des réglages en
    entier | fait | P1 |`
  - `CHANGELOG.md` (Prochaine version) :
    - « Après un redémarrage, l'onglet Modifications d'une conversation OpenCode liste de nouveau
      tous les fichiers modifiés, même ceux qui ont changé depuis. »
    - « Une conversation dans un worktree travaille sur une branche `bobine/…` (et non plus `bob/…`). »
    - « Réglages › Agents et dossiers : « Comme la conversation en cours » s'affiche en entier. »
  - `CHANGELOG.en.md` (Next version) :
    - "After a restart, the Changes tab of an OpenCode conversation lists every changed file again,
      even files that have changed since."
    - "A conversation in a worktree works on a `bobine/…` branch (no longer `bob/…`)."
    - "Settings › Agents and folders: “Same as current conversation” is no longer cut off."
