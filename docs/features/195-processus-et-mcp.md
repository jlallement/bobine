# 195 — Pannes visibles (2/2) : processus et serveur MCP

- **Statut** : fait (relecture du tech lead à venir)
- **Dépend de** : 187 (lot C : R16, R22 et petits points git), 138 (registre des processus), 041
  (robustesse du cœur), 029 (serveur MCP de l'app), 002 (agent factice)
- **Agents** : les deux (et l'agent factice) : rien de propre à un agent. Les nouvelles pannes
  simulées ne supposent rien de Bob : ce sont des pannes de processus et de connexion.

## Pourquoi

Quitter Bobine doit arrêter tout ce qu'elle a lancé, même un agent qui ignore SIGTERM, une
compilation ou un flux vidéo. Un outil de l'app ne doit pas tourner pour rien quand l'agent a
raccroché, et un serveur d'outils qui ne démarre pas doit se voir. Enfin, chaque panne d'agent de
la barre V1 (fiche 187, point 10) doit avoir son scénario factice.

## Critères d'acceptation

- [x] En quittant, les groupes arrêtés par SIGTERM qui vivent encore reçoivent SIGKILL avant la
      sortie du main (attente bornée à 1,5 s, seulement s'il en reste) — e2e `pannes-visibles` :
      agent tenace (ignore SIGTERM et la fin de sa connexion), aucun processus citant le profil
      après la fermeture (liste `ps`).
- [x] Compilations (`xcodebuild`, gradle) et flux (simulateur, Android) lancés dans leur groupe,
      notés au registre (`agents.pids`), arrêtés en quittant ; repris au lancement suivant après un
      plantage.
- [x] Serveur MCP : un appel dont le client coupe est interrompu (`AbortSignal`) ; budget par
      défaut de 10 min par appel (au-delà, erreur rendue à l'agent) ; une exception hors `try` rend
      une erreur 500 au lieu d'une requête sans réponse ; serveur qui ne démarre pas : avis dans la
      conversation au lancement, avec « Afficher le journal ».
- [x] `git` absent (ou outils de ligne de commande d'Apple absents) : message clair, commande en
      code avec « Copier », au lieu de `spawn git ENOENT`. `GIT_TERMINAL_PROMPT=0` sur chaque
      commande git de l'app.
- [x] Connexion coupée alors que le processus de l'agent vit : l'agent est arrêté et la cause dite,
      au lieu d'un « SIGTERM » trompeur.
- [x] Agent factice : `--panne` (`plantage-initialize`, `bloque-session-new`,
      `bloque-session-load`), `MOCK_AGENT_TENACE=1`, scénarios `plantage-signal`,
      `plantage-segfault`, `flot-stderr`, `connexion-coupee`. Chacun a un essai (unitaire de l'hôte
      d'agent, ou e2e).

## Plan

1. `process-group.ts` : les groupes arrêtés attendent leur SIGKILL dans une liste ;
   `settleStoppedGroups(ms)` attend qu'ils soient vides et envoie SIGKILL aux restants.
   `will-quit` attend (`preventDefault`, puis `app.quit()`), une seule fois ; `QuitFlow` ignore un
   second `before-quit` après l'arrêt.
2. `jobs/command-job.ts` : `detached`, `trackChild`, liste des travaux, `stopAllJobs()` dans
   l'arrêt. Flux du simulateur et d'Android : `detached` + `trackChild`.
3. `mcp/tool-server.ts` : `try` autour de `handle` (500), `AbortController` à la fermeture de la
   réponse, budget (`AppTool.budgetMs`, 10 min par défaut) ; `index.ts` : avis au démarrage.
4. `git/git-queue.ts` : `GIT_TERMINAL_PROMPT=0` dans `gitEnv`, message clair pour git absent.
5. `agent-host.ts` : fin de connexion, processus vivant → arrêt, cause dite (`StopWatch`).
6. Agent factice : option `--panne` (env `MOCK_AGENT_PANNE`), étapes `signal`, `stderr-flood`,
   `close-stdout`, fichier `scenarios-pannes.mts`. `docs/mock-agent.md`.
7. Essais : unitaires (groupes, travaux, serveur MCP, git, hôte) ; e2e `pannes-visibles`.

## Ce qui a été fait

- **Quitter** : `terminateGroup` note le groupe ; `settleStoppedGroups` (attente bornée puis
  SIGKILL) branché sur `will-quit` par `settleProcessesOnQuit` (`app-failures.ts`). Sans groupe
  vivant, aucune attente. `QuitFlow` ne refait rien au second `before-quit`.
- **Travaux et flux** : `startCommandJob` lance dans un groupe noté au registre, `stopAllJobs()` à
  l'arrêt ; `axe stream-video`, `adb screenrecord` (onglet et film) dans leur groupe, au registre.
- **Serveur MCP** : `callWithin` (budget, signal à l'outil quand le client raccroche ou que le
  budget est dépassé ; texte en anglais pour l'agent, ADR-0014) ; `AppTool.call(args, { signal })`
  et `budgetMs` facultatifs ; 500 sur exception ; `listening`, et avis `appTools.serverDown` au
  lancement avec le lien « Afficher le journal ». Le signal arrête les attentes de
  compilation (`ios_build`, `android_build` : `waitAtMost` et l'attente bornée, la compilation
  continue) ; les autres outils l'ignorent encore : ils finissent leur travail (borné par le
  budget), puis la réponse est abandonnée et `agents.log` le dit (« réponse abandonnée »). Les
  attentes du navigateur (chargement, CDP) et d'adb restent à brancher.
- **git** : `GIT_TERMINAL_PROMPT=0` ; `explainMissingGit` (`spawn … ENOENT`, `xcrun: error:
  invalid active developer path`) → `git.missing`, avec la commande entre accents graves, rendue en
  code avec « Copier » (`CommandText`) dans Modifications, la barre du worktree et le commit.
- **Connexion coupée** : `killIfConnectionLost` (1 s de grâce, le temps qu'un vrai plantage soit
  vu comme tel), dans `StopWatch` qui porte aussi le délai de grâce après « Stop » (sorti de
  l'hôte d'agent, qui tient ainsi son plafond de 1 050 lignes).
- **Agent factice** : `--panne`, `MOCK_AGENT_TENACE`, étapes `signal`, `stderr-flood`,
  `close-stdout` ; scénarios dans `scenarios-pannes.mts`.

## Écarts au plan

- Le registre de la fiche 187 citait le SIGKILL « dans `will-quit` » : fait, mais seulement s'il
  reste un groupe vivant (aucune attente sinon).
- Terminaux (node-pty) : non suivis par le registre (point « bas » du rapport) ; SIGHUP les arrête.
- Émulateur Android lancé par l'app : laissé hors du registre (il doit survivre à Bobine).

## Essais réels (2026-11-07, OpenCode 2.2.5, `--profil-temporaire --agents-neufs`, Big Pickle)

- `kill -9` de `opencode acp` en plein tour : « L'agent s'est arrêté. Sortie : SIGKILL. »,
  « Relancer » le redémarre, la conversation continue.
- Quitter Bobine en plein tour : aucun processus du groupe d'OpenCode ni citant le profil après la
  sortie. Restent, attendus : le gestionnaire de Crashpad (sort de lui-même en quelques secondes)
  et l'aide qui efface le profil temporaire (fiche 148).
- Réseau coupé **côté processus** (mandataire `HTTPS_PROXY` sur un port fermé, aucun réglage du Mac
  touché) : OpenCode se tait 80 à 120 s (« Réfléchit… »), puis lève une erreur réseau : bandeau
  « Connexion perdue » de la fiche 142. Avec un seuil de silence à 60 s (essai), le bandeau de
  silence de la fiche 194 apparaît avant.
- Captures : `nuit-0-11/pannes/essai-reel/`.

## Journal

- 2026-11-07 : fiche créée (lot C de la fiche 187, avec la fiche 194). Fait, essais unitaires et
  e2e `pannes-visibles` (clair, sombre) verts ; essais réels ci-dessus.
- 2026-11-07 : relecture indépendante, repris : signal branché sur les attentes de compilation,
  message du journal exact ; nettoyage du profil temporaire une seule fois (`will-quit` revient
  après l'attente des processus) ; seuls de vrais groupes sont attendus en quittant, jamais de
  SIGKILL au pid seul. Essais pour chacun.
- 2026-11-07 : défaut D3 de la recette réelle (vrai Bob tué par `kill -9` en plein tour : sa
  commande `sleep 30` restait orpheline dans son groupe). `stopGroup` ne faisait rien quand le chef
  était déjà sorti. Désormais, à la sortie inattendue d'un agent, ce qui reste de son groupe reçoit
  SIGTERM puis SIGKILL (`terminateLeftovers`, au groupe seulement, jamais au pid seul). Scénario
  factice `plantage-avec-enfant` ; essai unitaire de l'hôte d'agent (qui échoue sans le correctif)
  et étape de l'e2e `pannes-visibles`.
- 2026-11-07 : M3 de la recette (Bob met les commandes longues en arrière-plan). Expérience avec
  l'agent factice (`arriere-plan`, `arriere-plan-detache`) : une commande mise en arrière-plan
  **dans le groupe** de l'agent vit après le tour et est arrêtée avec lui (veille, arrêt, plantage,
  fermeture de Bobine) ; une commande **détachée** par l'agent (nouvelle session) survit, et n'est
  ni montrée ni arrêtée. Décision : pas d'arrêt à l'aveugle hors de notre groupe (ce peut être un
  serveur voulu), pas de signalement (aucun moyen simple et fiable de la rattacher à l'agent sous
  macOS) ; comportement écrit dans `docs/acp.md` (Compatibilité Bob) et le CHANGELOG ne promet plus
  « tout ». Le groupe du processus d'arrière-plan du vrai Bob reste à relever en recette.
