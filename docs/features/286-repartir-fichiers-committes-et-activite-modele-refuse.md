# 286 — « Repartir » et fichiers committés depuis ; Mon activité et modèle refusé

- **Statut** : fait
- **Dépend de** : 023, 130, 259
- **Agents** : les deux — rien de propre à un agent : git est lu par le main dans le dossier de la
  conversation (1), et le modèle d'un tour vient des réglages de la session annoncés par l'agent (2).

## Pourquoi

Deux défauts relevés par l'évaluation réelle de la 1.2 (projet « Bricole », OpenCode réel, journal
`bricole-evaluation/journal.md`) :

1. **« Repartir de ce message »** coche par défaut « Remettre les fichiers dans leur état d'alors »
   même quand ces fichiers ont été committés depuis : un clic distrait remet leur ancien contenu en
   modifications non commitées, ce qui défait de fait le commit, sans le dire.
2. **Mon activité** compte l'échange rejoué après un refus de modèle sous le nom du modèle refusé,
   qui n'a jamais répondu.

## Trace réelle

- Séance 3b, 23:41 (1.2.0-beta.1, entrée « Repartir de ce message ») : la case « Remettre 2 fichiers
  dans leur état d'alors » (level-04.md, level-05.md) est **cochée par défaut**, alors que ces fichiers
  ont été **committés** depuis (c93051d) ; « un clic distrait aurait défait le dernier commit dans le
  dossier de travail (modifications non commitées inverses), sans le dire ». Capture
  `captures/s3b-21-branche-repartir.png`. Repris au bilan (« Bugs gênants nouveaux ») et dans la
  fiche 023 (journal du 2026-11-26).
- Séance 4, 01:47 (1.2.0-beta.2, « Modèle refusé et récents ») : nouvelle conversation sur GPT-5.5,
  « Réponds OK » → carte « Le modèle openai/GPT-5.5 n'a pas répondu » ; « Choisir un autre modèle » →
  GPT-6.1 Sol : le message repart seul, « OK ». Puis **Mon activité › Par modèle** montre
  `openai/GPT-5.5 · 1 échange · 10,2k · 5` ; dans `usage.sqlite`, le tour du 01:47:09 porte
  `model_name openai/GPT-5.5`, `end_turn`, 10 174 / 5 jetons. Captures `s4-06`, `s4-07`, `s4-24`.

## Décision (utilisateur, 2026-11-26)

La case reste **cochée** par défaut quand aucun des fichiers à remettre n'a été committé depuis le
message ; sinon elle est **décochée** par défaut et le dialogue dit combien de fichiers committés
depuis seraient touchés. L'utilisateur peut toujours la cocher. C'est un écart à la fiche 023
(« case cochée par défaut ») ; aucun ADR ne fixe ce défaut.

## Critères d'acceptation

- [x] Aperçu de la branche (`branchPreview`, main) : chaque fichier à remettre dit s'il a été
      committé depuis l'heure du message (`committedSince`).
- [x] Calcul robuste, jamais d'échec du dialogue : dossier hors dépôt (rien de committé), dépôt sans
      commit (rien), fichier supprimé, fichier renommé, worktree d'une tâche fille ; heure du message
      inconnue ou erreur de git : « committé depuis » (défaut le plus prudent).
- [x] Dialogue : case décochée et compte « N fichiers committés depuis » quand il y en a ; cochée
      sinon ; textes par clés i18n (fr, en).
- [x] Mon activité et le fil : le tour rejoué après « Choisir un autre modèle » est compté sous le
      modèle qui a répondu.
- [x] Testé contre l'agent factice : e2e `branch` (tour qui modifie, commit, « Repartir » : case
      décochée, compte ; sans commit : cochée) ; hôte d'agent avec `modele-indisponible` rejoué
      jusqu'au journal de consommation.

## Plan

### 1. Fichiers committés depuis

Cause : `planRestore` (`src/main/conversations/restore-files.ts`) ne regarde pas git, et
`BranchDialog.tsx` coche la case dès qu'un fichier est à remettre.

- `src/main/conversations/committed-since.ts` (nouveau) : `committedSince(run, workspace, paths,
  since?)` rend l'ensemble des chemins committés depuis. `git rev-parse --is-inside-work-tree`
  (hors dépôt : aucun) ; `rev-parse --verify --quiet HEAD` (sans commit : aucun) ; puis un seul
  `git log --since=<seconde du message> --no-renames --name-only --relative -z --format= --
  :(literal)<chemins relatifs au dossier>` : un renommage committé liste l'ancien nom, une
  suppression le chemin. Seconde du message arrondie vers le bas (git date à la seconde : un commit
  dans la même seconde compte). Heure inconnue, code de sortie non nul, exception : tous les chemins.
- `branching.ts` (`previewBranch`) : reçoit une fonction `committedSince` facultative ; marque
  `committedSince: true` sur les fichiers `restore` concernés. `manager.ts` : option
  `committedSince` passée par `index.ts` avec `gitRun` (file git du main).
- `shared/agent.ts` : `BranchPreview.files[].committedSince?: true`.
- `BranchDialog.tsx` : case cochée seulement si aucun fichier à remettre n'est committé depuis ;
  sinon un avis `branchDialog.committedSince` (compte) et la mention par fichier
  `branchDialog.committedFile`.
- Essais : `committed-since.test.ts` (vrais dépôts git temporaires : hors dépôt, sans commit,
  committé, non committé, supprimé, renommé, worktree, heure inconnue, git en échec),
  `branching.test.ts` (marque), `BranchDialog.test.tsx`, e2e `branch` (dépôt git dans le dossier).

### 2. Modèle d'un tour rejoué

Cause : le journal (`src/main/usage/journal.ts`) et le fil (`usage.pending.model`) prennent le
modèle au `user-message` ; après un refus de modèle (carte, pas de `turn-error`), « Choisir un autre
modèle » renvoie le même tour (`AgentHost.resendBlocked`, évènement `resent`) sans dire le modèle :
le tour garde celui du refus.

- `agent-host.ts` (`resendBlocked`) : `resent` porte les réglages de la session au renvoi
  (`sessionChoices` : modèle, mode), comme `user-message`.
- `shared/agent.ts` : `resent` gagne `model?`, `mode?`.
- `journal.ts` : sur `resent`, le tour ouvert prend ce modèle et ce mode.
- `transcript.ts` : sur `resent`, `usage.pending.model` prend ce modèle (compte par tour du fil). Le
  message de l'utilisateur garde le modèle de son premier envoi (c'est vrai pour lui).
- Essai : `turn-model-unavailable.test.ts`, la séquence réelle (refus, autre modèle, réponse) avec
  l'agent factice `modele-indisponible`, évènements passés au `UsageJournal` et au fil : le tour
  écrit porte `factice-precis`.

Docs : fiche 023 (journal daté), CHANGELOG fr et en, index des fiches. Aucune dépendance, pas
d'ADR.

## Journal

- 2026-11-26 : traces relues dans le journal de l'évaluation, causes établies dans le code, plan
  écrit.
- 2026-11-26 : fait.
  - Défaut 1 : `committed-since.ts` (nouveau), `previewBranch` le reçoit par l'option
    `committedSince` du gestionnaire (branchée dans `index.ts` sur `gitRun`) ; `BranchDialog` décoche
    la case et dit le compte (`branchDialog.committedSince`, `branchDialog.committedFile`).
    Orthographe « commité » (glossaire et textes existants de l'app).
  - Écart : dépôt sans commit reconnu à `rev-parse --verify --quiet HEAD` en code 1 sans message de
    git (`runCommand` rend « Command failed » quand git ne dit rien) ; tout autre échec : doute.
  - Défaut 2 : cause dans l'évènement `resent` (`AgentHost.resendBlocked`), qui ne portait pas le
    modèle du renvoi ; `TurnAuth.resentEvent` le joint (méthode statique : `agent-host.ts` et
    `transcript.ts` sont à leur plafond de lignes ESLint), `UsageJournal` et `resentTurn`
    (`replay-tail.ts`) le prennent. Le message de l'utilisateur garde le modèle de son premier envoi.
  - Essais : `committed-since.test.ts` (11, vrais dépôts), `branching.test.ts` (+2),
    `BranchDialog.test.tsx` (+3), `journal.test.ts` (+1), `turn-model-unavailable.test.ts` (+1,
    rouge avant le correctif avec exactement la ligne fautive de la trace : `factice-rapide`,
    `end_turn`), `agent-host-turn-limit.test.ts` (attentes de `resent` complétées) ; e2e `branch`
    (dossier en dépôt git : case cochée sans commit ; décochée et « 1 de ces fichiers… » après un
    commit ; annuler ne touche rien), rouge sur l'ancien dialogue, vert sur le nouveau, clair et
    sombre.
  - Pas d'ADR (aucun ne fixait « coché par défaut »), aucune dépendance ; rien de changé côté ACP.
- 2026-11-26 : recette réelle (séance 6 de l'évaluation Bricole, vrai OpenCode, build de
  `c876dde6`, dépôt jetable).
  - Confirmé, « Repartir de ce message » : sans commit, la case de `calc.js` est cochée ; après un
    `git commit` de `calc.js` dans le dossier, dialogue rouvert sur le même message : case
    décochée, « calc.js — commité depuis » et le message rouge du compte. « Annuler » : fichier,
    `git status` et log inchangés. Case cochée à la main puis « Repartir de ce message » : `calc.js`
    revient à son contenu d'alors en modification non commitée, aucun commit touché, bandeau « … 1
    fichier remis dans son état d'alors. ».
  - Confirmé, Mon activité : GPT-5.5 refusé (« Le modèle openai/GPT-5.5 n'a pas répondu »), puis
    « Choisir un autre modèle » → Hy4 flash Free : le message repart et reçoit une réponse ; Par
    modèle, Hy4 flash Free passe de 1 à 2, GPT-5.5 reste à 1. Compteur par tour du fil non relu.
  - Remarque : au premier essai, l'agent a modifié un fichier par commande shell ; le dialogue
    n'a alors proposé aucun fichier à remettre, seulement « 3 commandes lancées depuis ce message :
    leurs effets restent. » (comportement de la fiche 023).
  - Détail relevé : panneau Session de la conversation d'origine, juste après le `git commit` fait
    hors de Bobine, « Dossier : 2 fichiers non commités +6 −1 » alors que `git status` n'en montre
    plus qu'un ; à jour après le tour suivant.
