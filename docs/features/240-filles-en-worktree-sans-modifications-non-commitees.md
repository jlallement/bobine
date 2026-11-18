# 240 — Filles en worktree : le travail non commité de la mère n'y est pas

- **Statut** : en cours — maquettes validées, code fait ; essais e2e à passer
- **Dépend de** : 223 (rôles), 110 (cycle des worktrees), 097 (conversations filles), 099 (outils
  de l'app)
- **Agents** : les deux (comportement de Bobine, indépendant de l'agent)
- **Trouvé par** : recette « POC complet » du 2026-11-17, étapes 3 et 4
  ([rapport](../recettes/2026-11-17-poc-complet-opencode.md), défaut D1)

## Pourquoi

Toute conversation fille qui part en worktree (`@rôle` qui n'est pas en lecture seule, `/split`,
carte « Tâches proposées », que l'agent ouvre par l'outil `start_child`, « Lancer en parallèle ») part **du
dernier commit** du dossier. Le travail en cours de la mère, non commité, n'y est pas. Bobine le
sait (avis « N modifications non commitées du dossier d'origine ne sont pas ici. » en tête du fil
de la fille, fiche 110 ; la description du paramètre `prompt` de `start_child` le dit à l'agent,
`src/main/mcp/children-tools.ts:202`), mais :

- l'utilisateur n'en est averti **ni avant le lancement** (la ligne « Partira à 2 rôles, une
  conversation fille chacun, en parallèle » et la carte « Tâches proposées » ne disent rien) **ni
  dans la mère**, où il lit les comptes rendus ;
- l'agent qui propose ou lance les filles ne committe pas d'abord, et l'outil ne lui renvoie aucun
  avertissement.

Deux effets observés, de même cause :

1. **Un avis vide** (étape 3) : « @Expert UX/UI @Architecte back-end donnez votre avis sur le plan
   et sur `maquettes/b.html` ». Les deux filles ne trouvent que `README.md` et rendent un compte
   rendu vide.
2. **Du travail refait en double** (étape 4) : les filles « API et tests » et « Page web », lancées
   depuis la carte « Tâches proposées », partent sans les fichiers écrits par la mère à l'étape 1
   (`server/`, `public/`, `test/`, sources SwiftUI) et réécrivent tout dans `api/` et `web/`. Après
   la fusion, `server/` et `api/`, `public/` et `web/` coexistent, et le `npm start` racine lance
   l'ancien serveur. Rien ne l'a signalé : le rapport l'avait d'abord compté côté agent.

Gravité : **sérieux** (étape 3 : finie seulement avec une intervention qu'un utilisateur ordinaire
ne trouverait pas ; étape 4 : un projet incohérent après fusion, sans alerte). Vu 4 fois sur 4
(deux filles à l'étape 3, deux à l'étape 4).

## Ce qui a été observé (2026-11-17, Bobine 1.0.0-beta.7, OpenCode 2.3.0, openai/gpt-6-luna)

### Étape 3 : filles de rôle

- Dossier `taches` : un commit initial (`9970242`, `README.md`), 17 fichiers non commités écrits
  par la mère.
- `main.log` :

  ```text
  2026-11-17T20:00:51.593Z INFO  Agent lancé (opencode, 42c012da) : opencode acp dans ~/…/taches/.worktrees/20261117-2100-d022 (pid 35016)
  2026-11-17T20:00:51.710Z INFO  Agent lancé (opencode, f6294b77) : opencode acp dans ~/…/taches/.worktrees/20261117-2100-38f3 (pid 35037)
  ```

- `agents.log` (extrait) :

  ```text
  2026-11-17T20:00:51.798Z [42c012da · opencode] → session/new #1 1 serveur(s) MCP (314 o)
  2026-11-17T20:00:52.286Z [42c012da · opencode] → session/prompt #3 s …S6AA4rvz, 2 bloc(s) text (2.9 Ko)
  2026-11-17T20:00:55.616Z [42c012da · opencode] ← tool_call …b04095bc « glob » search pending entrée
  ```

- Compte rendu de la fille Expert UX/UI : « j'ai vérifié le contenu du répertoire, sans rien
  modifier. Je n'y trouve ni le plan ni `maquettes/b.html` ; il ne contient que `README.md:1-3`. »
- Fil de la fille : « Parti de main · 9970242 · « chore: initial commit » · 17 modifications non
  commitées du dossier d'origine ne sont pas ici. »
- Captures : `docs/recettes/2026-11-17-poc-complet-opencode/3-defaut-fille-sans-modifications.jpg`,
  `3-defaut-comptes-rendus-vides.jpg`.
- Le plan n'était que dans le fil de la mère : la fille ne le reçoit pas non plus (sa consigne se
  limite au message tapé et à la consigne du rôle).

### Étape 4 : filles des Tâches proposées

- La mère appelle trois fois `start_child` (`agents.log`, 20:07:52Z) : carte « 3 tâches proposées »,
  « Lancer » pour (a) et (b), « Faire ici » pour (c).
- `main.log` :

  ```text
  2026-11-17T20:09:51.076Z INFO  Agent lancé (opencode, 41e10822) : opencode acp dans ~/…/taches/.worktrees/20261117-2109-9700 (pid 37605)
  2026-11-17T20:09:55.463Z INFO  Agent lancé (opencode, 0388a442) : opencode acp dans ~/…/taches/.worktrees/20261117-2109-4d35 (pid 37706)
  ```

- Les deux fils enregistrent `"dirty":17` (17 modifications non commitées laissées de côté).
- Historique du projet (`git log`, `git diff --name-only 9970242 <commit>`) : le premier commit de
  chaque fille a pour parent le commit initial `9970242` ;
  `1773f29 feat(api): add task management endpoints` ajoute `api/` (4 fichiers),
  `0cd1279 feat(web): add task manager interface` ajoute `web/` (4 fichiers). Le travail de la mère
  (`server/`, `public/`, `test/`, `ios/`, `maquettes/`) n'est commité qu'à l'étape 5
  (`ecb1f1a`, « Committer d'abord » de la carte de fusion).
- Après la fusion, `main` contient `api/`, `server/`, `public/` et `web/` ; `package.json` racine :
  `"start": "node server/index.js"` (l'ancien serveur).
- Pas de capture (rien à l'écran ne le montrait) ; l'historique git du projet du passage est la
  trace.

## Décision (2026-11-18, utilisateur)

On **garde** le modèle « worktree depuis le commit », sans copier le non commité dans le worktree
(fragile : fichiers ignorés, fichiers lourds, conflits au retour). Claude Code fait de même
(worktree depuis le commit, consigne « committez d'abord »). À la place :

1. **Avant de lancer une fille** en worktree, si le dossier a des modifications non commitées,
   Bobine le dit et propose, comme la carte de fusion : « Committer d'abord », « Mettre de côté »
   ou « Partir quand même ». Vaut pour tous les chemins : `@rôle`, `/split`, Tâches proposées,
   Lancer en parallèle.
2. **Un avis** (`@rôle` qui ne modifie rien) ne prend pas de worktree : il lit le dossier de la
   mère en lecture seule, non commité compris, comme les rôles en lecture seule.
3. **Côté agent**, l'outil de lancement de filles (`start_child`, description MCP) dit de
   committer d'abord ; l'outil renvoie l'avertissement à l'agent quand le dossier a du non commité.

L'implémentation écrit l'ADR de cette décision (worktree depuis le commit maintenu ; avis sans
worktree).

## Critères d'acceptation

- [x] ADR écrit : worktree depuis le commit, pas de copie du non commité ; avis en lecture seule
      dans le dossier de la mère — [ADR-0055](../adr/0055-filles-en-worktree-depuis-le-commit.md).
- [x] Lancement d'une fille en worktree avec un dossier modifié, par chacun des chemins (`@rôle`,
      `/split`, Tâches proposées, Lancer en parallèle) : Bobine affiche le nombre de
      modifications et propose « Committer d'abord », « Partir quand même » (« Mettre de côté »
      retiré, voir les écarts). Rien ne part avant le choix (le main refuse aussi) ; « Committer
      d'abord » ouvre le même formulaire que la carte de fusion. `/split` passe par la carte
      « Tâches proposées ».
- [x] Une fille partie quand même avec du non commité laissé de côté : sa carte de lancement (rôle)
      et chacun de ses comptes rendus le rappellent dans la mère, et l'agent de la mère le lit.
- [x] Un `@rôle` d'avis part sans worktree, dans le dossier de la mère en lecture seule, et voit
      les fichiers non commités (rôle en lecture seule, ou « Demander un avis en lecture seule »).
- [x] La description MCP de `start_child` dit de committer d'abord ; appelé avec un dossier
      modifié, l'outil renvoie l'avertissement à l'agent (nombre, fichiers, commit, ce qui
      manquera à la fille) quand la fille part quand même ou que la carte reste ouverte.
- [ ] Essai e2e contre l'agent factice **par chemin** (`e2e/suites/filles-non-commite.mjs`) :
      (a) rôle — avertissement avant l'envoi, Entrée retenue, « Partir quand même » (la fille ne
      voit pas `plan.md`, rappel dans la mère), avis en lecture seule (les filles le voient) ;
      (b) Tâches proposées — « Lancer » retenu, « Committer d'abord », puis la fille voit
      `plan.md`.
- [x] Doc : fiche 110 (cycle des worktrees) et `docs/architecture.md`.

## Maquettes (validées le 2026-11-18)

`e2e/maquettes/screens-filles-worktree.mjs`, sur la vraie fenêtre (`pnpm build && node
e2e/maquettes/run.mjs light f240`, puis `dark`) ; captures hors du dépôt. Cinq écrans :
avertissement sous « Partira à… » de la saisie `@rôle` ; « Committer d'abord » (formulaire de la
carte de fusion, « Committer puis lancer ») ; avis (« Partira à 2 rôles, pour un avis… · dans ce
dossier · lecture seule · ils voient les N modifications non commitées », « Plutôt les faire
travailler… ») ; carte « Tâches proposées » (un bloc pour la carte, « Lancer » retenu) ; rappel
dans la mère.

**Règle de l'avis (validée)** : un envoi `@rôle` part en avis (sans worktree, dans le dossier de
la mère, lecture seule imposée ou demandée selon l'agent, surveillée comme un rôle en lecture
seule) si tous les rôles cités sont en lecture seule, ou si l'utilisateur choisit « Demander un
avis en lecture seule » dans l'avertissement. Pas de devinette sur le texte. Côté agent,
`start_child` garde sa règle : un rôle en lecture seule part dans le dossier de la mère, les
autres en worktree, avec l'avertissement.

## Ce qui a été fait

- **Main** : `main/conversations/launch-folder.ts` (`git status --porcelain=v1 -uall` du dossier
  de la mère, commit de départ ; « Committer d'abord » à la racine du dépôt par
  `WorktreeCycle.commitIn`), branché par `ChildOptions.folder`. `ChildConversations.start`
  (`launchRole`) : une fille qui partirait en worktree d'un dossier modifié est refusée sans
  `uncommitted` ; `anyway` la laisse partir ; `readOnly` (rôle seulement) la fait partir en
  lecture seule dans le dossier de la mère. `leftBehind` (lu de `dirtyAtStart` et `base` du
  worktree de la fille) sur `child-started` et chaque `child-report`, et dans ce qui part à
  l'agent de la mère. Canaux `conversation:childFolderDirty`, `conversation:commitForChildren`
  (refusé en profil en lecture seule) ; `uncommitted` sur `roles:startChildren`,
  `conversation:startChild` et la décision de la carte (élicitation).
- **MCP** : description de `start_child` (« Uncommitted changes of this folder are NOT in its
  worktree: commit your work first ») ; dossier lu pendant que la carte est posée (sans la
  retarder ni prendre la place d'une autre) ; avertissement dans le résultat (fille partie quand
  même, carte encore ouverte, refus faute de choix).
- **Renderer** : `thread/LaunchDirty.tsx` (`LaunchDirtyCard`, `useFolderDirty`, relu au retour du
  focus) dans la saisie `@rôle` (`useRoleCompose` retient l'envoi et met le focus sur le bloc ;
  ligne « Partira à… » en avis), la carte « Tâches proposées » (« Lancer » retenu, « Lancer quand
  même » pour la carte) et « Lancer en parallèle… » ; étiquette sur la carte de lancement d'un
  rôle (`RoleWork.tsx`) et ligne sur chaque compte rendu (`Subtasks.tsx`).
- **Agent factice** : étape `when-file` ; scénarios `voit-le-plan` (la fille dit si elle voit
  `plan.md`) et `tache-plan` (la mère propose une tâche qui le dira).
- **Tests** : `main/conversations/children-uncommitted.test.ts` (vrai dépôt git, agent factice :
  refus sans choix, partir quand même et rappel, avis dans le dossier de la mère, committer
  d'abord, rôle en lecture seule, « Lancer en parallèle… ») — trois échouent sans le refus du main ;
  `children-tools.test.ts` (description, avertissement, choix transmis, refus) ;
  `RoleComposerUncommitted.test.tsx`, `ChildProposals.test.tsx`, `ChildReportLeftBehind.test.tsx`.
  E2e : suite `filles-non-commite`.

## Écarts au plan et aux maquettes

- **« Mettre de côté » retiré** avant un lancement (choix de l'utilisateur, 2026-11-18) : il ne
  donne rien à la fille et ne fait que vider le dossier de la mère. Restent « Committer d'abord »
  et « Partir quand même » (« Lancer quand même » sur la carte de tâches).
- **Rappel sur le compte rendu** sans liste de fichiers : le nombre et le commit de départ
  seulement (lus du worktree de la fille, rien de plus à garder).
- **Étiquette** « Sans N modifications non commitées » (au lieu de « Parti sans… ») : neutre en
  genre devant le nom d'un rôle.
- `worktree-cycle.ts` n'est pas modifié : `mainDirty` exige la base extraite dans le dossier
  principal (fusion) ; la lecture avant lancement vit dans `launch-folder.ts`.

## Rejouer

**Agent factice : oui.** Le défaut est dans Bobine (création du worktree, textes de la saisie, de
la carte de tâches et de la mère, retour des outils), pas dans l'agent : un dépôt git temporaire
avec un commit et un fichier modifié ; (a) un rôle sans lecture seule et un envoi `@rôle`, le
scénario factice n'a qu'à répondre (par exemple `echo`) ; (b) un scénario qui propose des tâches,
puis « Lancer ». Les traces réelles ci-dessus servent de référence.

## Journal

- 2026-11-17 — Ouverte par la recette « POC complet » (fiche 238), étape 3.
- 2026-11-18 — Élargie à toutes les filles en worktree (seconde occurrence à l'étape 4, d'abord
  comptée côté agent dans le rapport) ; décision de l'utilisateur écrite (worktree depuis le
  commit maintenu, avertissement et choix avant lancement, avis en lecture seule sans worktree,
  consigne et avertissement côté outils de l'agent) ; critères revus.
- 2026-11-18 — Maquettes (5 écrans, clair et sombre) et règle de l'avis proposées ; en attente de
  validation avant le code de l'interface.
- 2026-11-18 — Maquettes validées par l'utilisateur ; « Mettre de côté » retiré avant un lancement
  (son choix). ADR-0055, refus du main sans choix, avertissement et choix sur les trois chemins,
  avis en lecture seule, rappel dans la mère, avertissement de `start_child` ; tests unitaires et
  suite e2e `filles-non-commite`.
