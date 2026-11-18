# 246 — Message de commit rédigé par l'agent ; vue Git à jour après un commit fait ailleurs

- **Statut** : fait — non poussé, en attente de relecture
- **Dépend de** : 110 (cycle des worktrees, message proposé), 123 (« Committer d'abord »), 180
  (aparté : session jetable), 182 (mémoire commune, ADR-0040), 244 (fichiers cochés, « secret ? »)
  — décision : ADR-0056 (accepté)
- **Agents** : les deux. Session ACP ordinaire (`session/new`, `session/prompt`, `session/delete`),
  rien de propre à un agent (ADR-0011), rien de non documenté sur Bob.
- **Trouvé par** : recette POC du 2026-11-17 (`docs/recettes/2026-11-17-poc-complet-opencode.md`),
  D3 et D4

## Pourquoi

**D3** — Le message de commit proposé est calculé par Bobine à partir du titre de la conversation
(fiche 110) : « feat: nous allons construire un petit gestionnaire de tâches en… », en français,
coupé, alors que l'utilisateur avait retenu « Conventional Commits in English » dans la mémoire du
projet (2 fois sur 2). Décision de l'utilisateur : **le message est rédigé par l'agent**, qui suit
la mémoire du projet.

**D4** — Après « Committer puis fusionner » (carte « Fusion refusée » de la carte Sous-tâches), la
vue Git de la conversation garde « Committer (23) » et « 23 fichiers depuis le dernier commit »
alors que `git status` est vide, jusqu'à « Actualiser ».

## Critères d'acceptation

### D3 — message rédigé par l'agent

- [x] À l'ouverture du formulaire de commit (vue Git d'un worktree ou d'une conversation ordinaire,
      « Committer d'abord » de la carte « Fusion refusée » et de l'avertissement avant une fille),
      Bobine demande le message à l'agent de la conversation, dans une **session jetable** du même
      dossier (ADR-0056) : rien dans le fil, rien dans la session de la conversation.
- [x] Pendant la rédaction : « Rédaction par <agent>… N s » et « Arrêter » (l'utilisateur annule
      la rédaction ; « Annuler » reste le bouton qui ferme le formulaire) ; champ en attente,
      « Committer » désactivé.
- [x] Réponse reçue : le message dans le champ, modifiable ; ligne « Rédigé par <agent> en N s,
      d'après N fichiers et la mémoire du projet », « Rédiger à nouveau ».
- [x] L'agent reçoit seulement les fichiers **cochés**, leur diff **borné** (4 000 caractères par
      fichier, 24 000 en tout), la **mémoire** approuvée (« Vous » et projet, 4 000 caractères),
      le titre et le premier message de la conversation. Un fichier « secret ? » n'envoie que son
      chemin ; une ligne reconnue par la détection de secrets est remplacée par `[redacted]`.
- [x] **Repli** — délai de 45 s dépassé, agent qui ne peut pas démarrer (connexion, licence,
      confiance, commande introuvable), tour fini autrement que `end_turn` (refus, erreur),
      réponse vide ou démesurée, « Arrêter » : message **en anglais, Conventional Commits, déduit
      des fichiers seuls**, sans aucun mot coupé ; une ligne dit pourquoi, avec « Réessayer ».
- [x] Agent occupé dans la conversation : la rédaction se fait quand même (processus à part).
- [x] Cases changées après la réponse : « Les fichiers cochés ont changé » + « Rédiger à
      nouveau », sans relance automatique ; un message retouché n'est jamais remplacé sans clic.
- [x] Coût de la rédaction ajouté au coût de la conversation (comme l'aparté).
- [x] Réglages › Général › « Message de commit rédigé par l'agent » (activé par défaut) ;
      désactivé : le repli, aucun agent lancé.
- [x] Scénarios d'agent factice : réponse normale, réponse lente au-delà du délai, refus ou
      erreur ; pour chacun un test unitaire qui échoue sans le correctif.
- [x] e2e « Committer » avec l'agent factice (rédaction, message reçu, repli).

### D4 — vue Git à jour

- [x] Après un commit, une fusion, un « Défaire » ou un nettoyage faits **hors du panneau** (carte
      « Fusion refusée » du fil, carte Sous-tâches, avertissement avant une fille, barre d'une
      autre conversation du même dépôt), la vue Git de toute conversation du même dépôt se relit
      d'elle-même : plus de « Committer (23) » sur un dossier propre.
- [x] Test unitaire de la vue (évènement reçu → relecture) et du main (évènement émis après
      `commitMain`), qui échouent sans le correctif ; e2e : « Committer puis fusionner », puis la
      vue Git sans « Committer (N) ».
- [x] i18n fr/en ; CHANGELOG fr/en ; ADR-0056 accepté.

## Conception (temps 1)

### D3 — comparaison des voies (détail : ADR-0056)

| Voie | Fil / contexte de l'agent | Agent occupé | Coût par commit | Bob |
|---|---|---|---|---|
| **Session ACP jetable, même dossier** (retenue) | intacts | indifférent (processus à part) | OpenCode : ≈ 5 700 jetons mesurés (petit diff), ≈ 13 000 au plus ; Bob : ≈ 0,02 à 0,035 bobcoin (estimé) | `session/new`, `prompt`, `delete` : annoncés, déjà employés (aparté) |
| Tour caché dans la conversation | pollués (historique, rejeu de `session/load`, compaction) | impossible | tout le contexte de la conversation (dizaines de milliers de jetons) | compte dans la limite d'étapes de la session (fiche 209) |
| Outil MCP de l'app | il faut un tour pour que l'agent l'appelle : idem | impossible | idem | — |
| MCP sampling (`sampling/createMessage`) | intacts | ? | faible | non documenté : écarté |
| `session/fork` | intacts | indifférent | contexte de la conversation | non annoncé par Bob : écarté |

**Mesure réelle** (2026-11-18, OpenCode 2.3.0, `opencode acp` dans un `HOME` jetable, modèle
gratuit `opencode/big-pickle`, dépôt de deux fichiers modifiés, consigne et mémoire
« Conventional Commits, in English » ; trois essais, script hors dépôt) :

| Étape | Temps depuis le lancement |
|---|---|
| `initialize` | 159 à 180 ms |
| `session/new` | 410 à 479 ms |
| fin du tour (`end_turn`) | **3 632 à 4 416 ms** |

Jetons : 4 156 à 4 668 en entrée, 11 à 40 en sortie, ≈ 5 700 au total (dont ≈ 4 000 de consigne
propre à OpenCode), coût annoncé 0 $. Réponses : « feat: add task list markup and initialize app
script » (deux fois, une avec un corps), « feat: add task list markup and script » : la note de
mémoire est suivie. Bob n'a pas été mesuré (pas de dépense de bobcoin pour ce temps 1) : un
échange court y coûte ≈ 0,02 bobcoin (≈ 10 000 jetons de contexte, `docs/acp.md`), d'où
l'estimation, à vérifier en recette.

**Délai de 45 s** : dix fois la mesure d'OpenCode ; Bob démarre plus lentement (processus Node,
connexion), non mesuré ici.

### D4 — cause

La vue Git (`ChangesTab.tsx`) relit `changes:git` à l'ouverture, quand un outil de l'agent se
termine (`finished`), après une action faite **dans le panneau** (sa barre de commit, sa barre de
worktree, « Rétablir ») et sur « Actualiser ». Rien d'autre. Or « Committer puis fusionner » de la
carte Sous-tâches (`SubtasksMerge` → `children:commitMain` puis la fusion), « Committer d'abord »
de l'avertissement avant une fille, ou la barre d'un worktree qui committe et avance `main`,
passent par d'autres composants et d'autres canaux : le main fait le commit, mais **aucun
évènement ne prévient la vue Git**, et aucun outil de l'agent ne se termine. La vue garde la liste
lue avant le commit.

**Correctif proposé** : un évènement du main `changes:gitChanged` `{ conversationIds }`, émis après
toute commande git qui change un dépôt (commit, « Défaire », fusion et sa reprise ou son abandon,
`stash` remis, nettoyage, « Rétablir »), pour **toutes les conversations dont le dossier est dans
ce dépôt** (même racine `git rev-parse --git-common-dir`, worktrees compris). `ChangesTab`
s'abonne et relit (`refresh()` et `cycle.refresh()`) si sa conversation est dans la liste. Rien ne
change à l'écran : pas de maquette.

## Maquettes (temps 1)

`e2e/maquettes/screens-commit-redige.mjs`, sur la vraie fenêtre (vraie vue Git, vrai formulaire,
état de la rédaction injecté) :

```bash
pnpm build && node e2e/maquettes/run.mjs light f246
```

puis `dark`. Captures hors du dépôt (dossier de notes de la session, `246-maquettes/`). Cinq
écrans :

1. **Rédaction en cours** — vue Git d'une conversation ordinaire (OpenCode), 4 fichiers cochés,
   « Arrêter », champ grisé, « Committer » désactivé.
2. **Message reçu** — message d'OpenCode (forme des réponses mesurées), ligne « Rédigé par… »,
   « Rédiger à nouveau ».
3. **Repli, délai dépassé** — « OpenCode n'a pas répondu en 45 s : message déduit des fichiers »,
   `chore: update 4 files in public`, « Réessayer ».
4. **Carte « Fusion refusée »** (IBM Bob) — la même rédaction dans « Committer d'abord ».
5. **Carte « Fusion refusée », repli** — « IBM Bob demande une connexion (ouvrez la conversation
   pour la renouveler) ».

Le repli de l'écran 5 (`chore: update 5 files`) montre la forme sans dossier commun.

## Plan (temps 2, après validation)

1. `src/shared/commit-draft.ts` (nouveau) : `commitDraftPrompt(…)` (anglais), `draftFromReply
   (texte, stopReason)`, `fallbackCommitMessage(fichiers)`, types `CommitDraft`. Tests.
2. `src/main/changes/commit-diff.ts` (nouveau) : diff borné des fichiers cochés, non suivis lus,
   binaires, `looksSecret`, `findSecret`. Tests sur dépôts jetables.
3. `src/main/conversations/commit-draft.ts` (nouveau) : session jetable sur le modèle de l'aparté
   (`asideHostOptions`, fin de session extraite et partagée), délai, annulation, coût, raisons de
   repli. Tests contre l'agent factice.
4. `src/main/changes/commit-draft-ipc.ts` : `commit:draft`, `commit:draftCancel` ; `ipc.ts` du
   shared, preload, `index.ts`.
5. Agent factice : scénarios `message-commit`, `message-commit-lent`, `message-commit-refus`.
6. Renderer : `useCommitDraft` + `CommitForm` (états, lignes, boutons), branché dans
   `FolderCommitBar`, `WorktreeBar`, `CommitChooser` ; `proposeCommitMessage` remplacé.
7. D4 : `changes:gitChanged` émis par `worktree-ipc`, `children-merge-ipc`, la fusion des filles et
   le commit de la vue Git ; abonnement dans `ChangesTab`. Tests.
8. Réglage, `fr.json` / `en.json`, glossaire, CHANGELOG fr/en, `docs/mock-agent.md`,
   `docs/architecture.md`, ADR-0056 accepté.
9. e2e : suite `commit-redige` (rédaction, reçu, repli) et D4 (dans `commit-choisi` ou à part).

Aucune nouvelle dépendance.

## Décisions (validation du 2026-11-18, tech lead par délégation de l'utilisateur)

- **Q1 — Réglage** : oui, « Message de commit rédigé par l'agent », activé par défaut, dans
  Réglages › Général, à côté de l'éditeur ; son aide donne le coût approximatif.
- **Q2 — Délai** : 45 s.
- **Q3 — Contexte** : le premier message, borné à **1 000** caractères et passé par `findSecret`
  comme le diff.
- **Q4 — Type du repli** : `chore`.
- « Arrêter » plutôt qu'« Annuler » : retenu.
- Trois exigences : la session jetable ne peut **jamais** écrire (test : le scénario tente une
  écriture et une commande, tout est refusé, le dépôt est intact) ; son processus est arrêté
  **dans tous les cas**, un test par cas, sans orphelin ; D4 : l'évènement part aussi après un
  commit ou une fusion faits par Bobine, avec un e2e « fusion depuis la carte → vue Git à jour
  sans Actualiser ».

## Ce qui a été fait

- `shared/commit-draft.ts` : demande (`commitDraftPrompt`, bloc `<bobine_commit_message>` ajouté à
  `APP_CONTEXT_OPENINGS`), lecture de la réponse (`draftFromReply`), repli
  (`fallbackCommitMessage`), bornes et délai.
- `main/changes/commit-diff.ts` : diff des cochés (`git diff HEAD`, contenu lu pour un non suivi),
  borné, « secret ? » sans contenu, binaire, lignes à secret masquées (`findSecret`).
- `main/conversations/commit-draft.ts` (`CommitDrafts`) : session jetable sur le modèle de
  l'aparté (`asideHostOptions` + `readOnly`), refus d'office, délai, « Arrêter », coût compté
  (`aside-cost`), session supprimée, processus arrêté dans tous les cas, sortie de l'app comprise.
  `commit-draft-setup.ts` (branchement : dossier du commit, mémoire, réglage,
  `BOBINE_COMMIT_DRAFT_TIMEOUT_MS` pour les e2e), `changes/commit-draft-ipc.ts` (canaux
  `commit:draft`, `commit:draftStop`).
- D4 : `main/changes/git-changed.ts` (`withGitChanged` autour des canaux qui changent un dépôt,
  `GitChangedNotifier` : toutes les conversations du même dépôt), `ChildrenMerger.changed` en fin
  de fusion des filles ; `ChangesTab` écoute `changes:gitChanged`.
- Renderer : `panel/useCommitDraft.ts` et `CommitForm` (rédaction, reçu, repli et sa raison,
  « Arrêter », « Rédiger à nouveau », « Réessayer », cases changées) ; `conversationId` jusqu'aux
  quatre formulaires (`FolderCommitBar`, `WorktreeBar`, `MainDirtyCard`, `LaunchDirtyCard` via
  `CommitChooser`) ; nom de l'agent tenu par `useConversations` ; `commit-draft.css`.
- Réglage `commitDraftEnabled` (Réglages › Général, recherche des réglages).
- Agent factice : `scenarios-commit.mts` (`message-commit`, `-lent`, `-refus`, `-erreur`,
  `-ecriture`), `MOCK_AGENT_COMMIT`, `MOCK_AGENT_PID_FILE`.
- Tests : `shared/commit-draft.test.ts`, `changes/commit-diff.test.ts`,
  `conversations/commit-draft.test.ts` (normal, lent, refus, erreur, écriture refusée, « Arrêter »,
  sortie de l'app, nouvelle demande, réglage coupé ; chaque fois aucun processus restant),
  `changes/git-changed.test.ts`, `children-merge.test.ts` (évènement en fin de fusion),
  `panel/CommitDraft.test.tsx`, `panel/ChangesTab.test.tsx` (D4) ; tests d'interface existants
  adaptés (la proposition arrive du main, repli sans le titre).
- Puce de branche sous la saisie (`useGitStatus`) : relue aussi sur `changes:gitChanged` (le point
  « non commité » restait après la fusion, vu sur les captures e2e) ; `useGitStatus.test.ts`.
- `CommitForm` : la rédaction compte comme « en cours » dès le premier rendu (sinon « Committer »
  était actif un instant avec le repli : vu par les e2e qui cliquaient aussitôt).
- e2e : `commit-redige` (nouveau) ; `git`, `worktree-cycle`, `commit-choisi`,
  `filles-non-commite`, `filles-fusion`, `gitlab`, `pr-ci` (via `e2e/pr-repo.mjs`) attendent la
  rédaction.

## Écarts au plan

- Le nom de l'agent pendant la rédaction vient d'un petit registre tenu par `useConversations`
  plutôt que d'un contexte React : un fournisseur autour de l'app réindentait tout `App.tsx`.
- `proposeCommitMessage` reste dans `shared/worktree-cycle.ts` (et ses tests) mais ne sert plus
  aux formulaires ; `ChangesTab` et `SidePanel` ne reçoivent plus le titre.
- Cases changées après la réponse : le message rédigé ne suit plus les cases (règle 0.11, D4, de
  la vue Git) ; une ligne le dit, « Rédiger à nouveau » le refait. Le repli, lui, les suit encore.

## Journal

- 2026-11-18 : temps 1, depuis `main` (00d4ec9). Conception (ADR-0056 proposé), cause de D4,
  mesure réelle d'OpenCode, maquettes. Arrêt pour validation.
- 2026-11-18 : validé (Q1 à Q4, trois exigences). Temps 2 : code, tests, i18n, CHANGELOG, ADR
  accepté.
- 2026-11-18 : `./scripts/verify` vert (code de sortie 0, 4864 tests). Un passage intermédiaire a
  échoué sur `src/main/log.test.ts` (délai de 15 s dépassé, charge machine à 32 pendant la campagne
  e2e d'une autre session ; le test passe seul en 0,4 s, puis dans le passage suivant).
- 2026-11-18 : `pnpm build && pnpm e2e --changed` (toute la suite, 218 tâches, les locales sont
  touchées) : 204 vertes, 14 échecs, tous dans les suites de commit. Causes : (1) « Committer »
  actif un instant avant le départ de la rédaction (défaut réel, corrigé dans `CommitForm`) ;
  (2) attente oubliée dans `e2e/pr-repo.mjs` (aide commune de `pr-ci`) et attente obsolète dans
  `git.mjs` ; (3) erreur de `commit-redige` (la carte refuse d'avance la fusion). Après correction,
  les sept suites rejouées (`git`, `worktree-cycle`, `pr-ci`, `pr-ci-sans-ci`, `gitlab`,
  `commit-choisi`, `commit-redige`) : vertes en clair et en sombre. Captures `246-*` regardées
  (rédaction en cours, message reçu, repli, vue Git à jour) ; elles ont montré le point « non
  commité » resté sur la puce de branche, corrigé, `commit-redige` et `git` rejouées : vertes.
  Contre-épreuve : `GitChangedNotifier.notify` neutralisé, `commit-redige` échoue sur l'attente D4
  (clair et sombre) ; code restauré.

