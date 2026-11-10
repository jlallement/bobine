# 175 — Préparation des worktrees

- **Statut** : fait
- **Dépend de** : 036 (worktrees), 097 (conversations filles), 110 (cycle des worktrees), 138
  (processus et git), 149 (visibilité des filles) — décision : ADR-0037
- **Agents** : les deux. Tout se passe dans le main process, avant et autour de l'agent (copie de
  fichiers, commande du projet) ; aucun code propre à un agent (ADR-0011).

## Pourquoi

Une fille (fiche 097) ou une conversation « dans un worktree » (fiche 036) part d'un `git worktree
add` nu : pas de `node_modules`, pas de `.env`, rien de ce que git ignore. Son agent ne peut ni
lancer les tests ni démarrer l'app sans tout réinstaller lui-même — souvent mal, ou en devinant les
secrets. Conductor (scripts `setup` / `archive`), Claude Code et Codex (`.worktreeinclude`, scripts
de préparation des environnements locaux) préparent le worktree avant que l'agent y travaille :
Bobine doit le faire aussi.

## Critères d'acceptation

- [x] **Fichiers copiés** : un fichier `.worktreeinclude` à la racine du dépôt (syntaxe
      `.gitignore`, même format que celui de Claude Code) liste les fichiers à copier du dossier
      d'origine vers le nouveau worktree. Seuls ceux que git **ignore** sont copiés (un fichier
      suivi est déjà dans le worktree) ; jamais `.git`, jamais `.worktrees/`, jamais un lien
      symbolique, jamais un chemin hors du dépôt (dossiers parents résolus) ; un fichier déjà
      présent dans le worktree n'est pas écrasé. Plafonds : 5 000 fichiers, 500 Mo — au-delà,
      le reste n'est pas copié et la carte le dit.
- [x] **Commande de préparation** : `.bobine/worktree.json` (`{ "setup": "…", "archive": "…" }`)
      à la racine du dépôt déclare une commande lancée dans le nouveau worktree après la copie
      (ex. `pnpm install`), par le shell, avec `BOBINE_WORKTREE_SOURCE`, `BOBINE_WORKTREE_PATH`,
      `BOBINE_WORKTREE_BRANCH` dans l'environnement ; 15 min au plus.
- [x] **Autorisation** : la commande vient d'un fichier du dépôt, l'app ne la lance pas sans
      accord. La première fois (et chaque fois que les commandes du fichier changent), la carte
      la montre avec « Autoriser et lancer » ; l'accord est gardé par dépôt et par contenu
      (empreinte des commandes) dans `approvals.json`, retirable dans Réglages › Confidentialité ›
      Autorisé sans demander. Une
      fille lancée par un agent n'attend pas cet accord (personne pour le donner) : elle part sans
      la préparation, et la carte l'attend dans son fil. Dans une conversation lancée par
      l'utilisateur, un message envoyé pendant l'attente d'accord est retenu, et la carte le dit
      (« Votre message attend… ») ; « Autoriser et lancer » (action principale, pleine) l'envoie
      à la fin de la commande, « Continuer sans préparer » (texte seul) l'envoie tout de suite,
      la commande non lancée et l'agent prévenu par la même ligne de contexte.
- [x] **Visible** : sous le départ du worktree (fiche 110), une carte « Préparation » dit les
      fichiers copiés (dépliables en liste : 50 chemins au plus, puis « et N autres » ; ignorés
      et non copiés au plafond à part), la commande, son état (en cours, réussie, échouée avec son code, à
      autoriser), sa durée, et la fin de sa sortie (dépliable). Mise à jour en direct, gardée
      dans le fil (un seul élément, remplacé).
- [x] **Sans bloquer** : le premier message de la conversation attend la fin de la préparation
      (réussie ou non) pour que l'agent trouve ses dépendances ; un échec n'empêche rien, et
      l'agent en est prévenu par une ligne de contexte (commande, code de sortie).
- [x] **Nettoyage** : la commande `archive`, si autorisée, est lancée dans le worktree avant sa
      suppression par l'app (2 min au plus) ; un échec ne bloque pas la suppression.
- [x] **Aucun secret journalisé** : `main.log` dit la commande lancée (texte du fichier du
      dépôt), le code de sortie et la durée, jamais la sortie ni le contenu des fichiers copiés.
- [x] Testé contre l'agent factice : suite e2e `worktree-setup` (dépôt avec `.worktreeinclude`
      et `.bobine/worktree.json`, conversation dans un worktree, autorisation, carte réussie,
      fichier ignoré présent dans le worktree, message envoyé après la préparation), clair et
      sombre ; tests unitaires de la copie (liens, chemins hors dépôt, fichiers suivis, plafonds)
      et du lancement (réussite, échec, délai, accord).

## Plan

### Décisions (ADR-0037)

- **Où le régler** : dans le **dépôt**, pas dans Réglages. La préparation dépend du projet
  (gestionnaire de paquets, fichiers secrets), se partage avec l'équipe et suit les branches :
  c'est le choix de Conductor (`conductor.json`), de Claude Code et de Codex. `.worktreeinclude`
  reprend le format de Claude Code tel quel (un dépôt déjà préparé pour lui l'est pour Bobine) ;
  les commandes vont dans `.bobine/worktree.json`, à côté de `.bobine/commands/` (fiche 045).
- **Accord dans l'app** : un fichier du dépôt qui lance une commande sans qu'on le sache, c'est
  ce qu'un dépôt cloné malveillant chercherait. Copier des fichiers ignorés du même dépôt ne
  sort rien du dépôt : pas d'accord. Lancer une commande : accord par dépôt et par empreinte.
- **Lu dans le dossier d'origine** (la copie de travail d'où part le worktree), pas dans le
  worktree : un `.worktreeinclude` ou un `worktree.json` pas encore commité compte. La commande
  `archive` est relue au même endroit au moment de la suppression.

### Fichiers

- `src/shared/worktree-setup.ts` (nouveau) : types `WorktreeSetup` (copie, commande, état,
  sortie), `parseWorktreeConfig`, `configFingerprint`, `setupContext` (ligne pour l'agent),
  `tailOutput` (fin de sortie, sans séquences ANSI).
- `src/main/changes/worktree-include.ts` (nouveau) : `copyIncluded(run, root, target)` — `git
  ls-files -z --others --ignored --exclude-from=.worktreeinclude`, puis `git check-ignore -z
  --stdin` (vraiment ignorés), garde-fous chemins / liens / plafonds, copie sans écraser.
- `src/main/changes/worktree-setup.ts` (nouveau) : `WorktreePreparation` — lit la config,
  copie, lance la commande (`spawn` par le shell, groupe de processus, `trackChild`, arrêt au
  délai par `stopGroup`), émet l'état (débit limité), garde la promesse par conversation
  (`awaiting` / `takeContext`), `approve`, `beforeRemove` (la commande `archive`).
- `src/main/changes/worktree-setup-wiring.ts` (nouveau) : branchement hors du gestionnaire
  (évènement `worktree-start`, `promptGate` chaîné, `post`).
- `src/main/changes/worktrees.ts` : option `beforeRemove` (la commande `archive`).
- `src/main/approvals.ts` : `worktreeSetups` (dépôt → empreinte et commandes montrées).
- IPC `conversation:approveWorktreeSetup`, `settings:forgetWorktreeSetup` ; preload.
- Renderer : `thread/WorktreeSetup.tsx` (carte), `Transcript.tsx`, réducteur `shared/transcript.ts`
  (élément `worktree-setup` remplacé, `reduceWorktreeSetup`), export Markdown ; Réglages ›
  Confidentialité : dépôts autorisés, révocables.
- i18n fr/en, `docs/architecture.md`, ADR-0037, CHANGELOG fr/en, suite e2e `worktree-setup`.

Pas de nouvelle dépendance (correspondance des motifs laissée à git).

## Journal

- 2026-11-06 — Fiche créée, plan écrit.
- 2026-11-06 — Fait. Copie (`worktree-include.ts`), préparation (`worktree-setup.ts`),
  branchement (`worktree-setup-wiring.ts`), carte du fil, accords révocables dans Réglages ›
  Confidentialité, ADR-0037. Tests : unitaires (copie : liens, hors dépôt, `.worktrees/`, suivis,
  non écrasés, plafonds ; préparation : accord, échec, délai, `archive`, vrai shell ; réducteur ;
  carte ; accords), scénario du gestionnaire contre l'agent factice (fichier copié, message
  retenu puis envoyé avec la ligne de contexte de l'échec), suite e2e `worktree-setup` (clair et
  sombre ; captures `175-preparation-a-autoriser`, `175-preparation-reussie`).
  **Écarts au plan** :
  - Accords dans `approvals.json` (`ApprovalStore`, à côté des commandes « toujours ») et non dans
    `settings.json` ; révocation dans Réglages › Confidentialité, pas › Conversations.
  - Rien dans `ConversationManager` (au plafond de lignes d'ESLint) : la préparation suit
    l'évènement `worktree-start`, retient les messages par `promptGate` (chaîné après celui du
    plafond de coût) et les renvoie à la fin ; la carte est écrite par `post`.
  - Accord rattaché au dépôt principal (parent du dossier git commun), pas à la racine du dossier
    d'origine : une fille d'une fille (worktree parti d'un worktree) relève du même accord —
    trouvé par la suite e2e.
  - Journal : `main.log` (commande, code, durée), pas `agents.log` (muet au niveau Normal).
  **Limites** : la commande `archive` n'est pas lancée quand l'app supprime à la fermeture un
  worktree jamais commencé (suppression synchrone) ; si le renvoi d'un message retenu échoue, un
  avis d'erreur va dans le fil de la fille, mais la mère ne reçoit pas de compte rendu d'erreur ;
  un accord donné après coup ne prévient pas l'agent que les dépendances sont arrivées.
- 2026-11-06 — Relecture du tech lead, trois reprises : (1) message retenu tant que la commande
  attend l'accord dans une conversation lancée par l'utilisateur (avant : il partait tout de suite
  avec la ligne « awaits approval »), « Continuer sans préparer » (état `skipped`, canal
  `conversation:skipWorktreeSetup`) qui le libère avec la ligne de contexte ; une fille n'attend
  pas (personne pour l'accord). (2) « Autoriser et lancer » en `btn primary` (fiche 170) ;
  « Continuer sans préparer » en texte seul, règle des refus. (3) Fichiers copiés dépliables :
  `IncludedCopy.count` et 50 chemins gardés dans le fil (`LISTED_INCLUDED_FILES`), « et N
  autres », ignorés et plafond sur une ligne à part. Tests : `worktree-setup-wiring.test.ts`,
  carte, liste bornée ; e2e : message retenu puis envoyé après l'accord, « Continuer sans
  préparer » sur une commande modifiée (capture `175-preparation-sans`).
- 2026-11-06 — Fusion de `main` (fiche 180) : `index.ts`, `ipc.ts`, `transcript.ts` repassés
  sous leurs plafonds par extraction : canaux de la préparation dans
  `main/changes/worktree-setup-ipc.ts`, réducteur de la fusion des filles dans
  `shared/children-merge.ts` (`reduceChildrenMerge`, comme `reduceCostCap`), commandes IPC des
  notifications dans `SystemNotifier.controls()`. Aucun seuil relevé.
- 2026-11-06 — Recette 0.9 (fiche 183), défauts de la fiche corrigés selon les décisions du tech
  lead :
  - **D1 (bloquant)** : la carte montre toutes les commandes que l'accord couvre, chacune avec son
    moment (« À la création » : `setup`, « À la suppression » : `archive`) ; le texte d'accord dit
    qu'il couvre les deux.
  - **D2** : l'accord est lié à l'empreinte affichée. La carte « à autoriser » porte `signature`
    (empreinte des commandes montrées), que le renderer renvoie avec « Autoriser »
    (`conversation:approveWorktreeSetup(id, signature)`). Le main relit le fichier : s'il a changé,
    rien ne tourne, rien n'est retenu, la carte montre les nouvelles commandes (`changed`) et
    redemande l'accord ; les messages retenus attendent toujours.
  - **D6** : `archive` seule a la même carte à autoriser (« Autoriser » / « Ne pas autoriser »),
    rien ne tourne à la création et le message ne l'attend pas ; autorisée, elle tourne à la
    suppression.
  - **D4** : un message envoyé pendant la commande est retenu sur la carte (« Votre message attend
    la fin de la préparation. »), avec « Arrêter » (commande arrêtée, état « échec » `stopped`, le
    message part avec la ligne de contexte « stopped by the user ») et « Continuer sans attendre »
    (le message part avec « still running », la commande continue ; affiché quand un message
    attend). Nouveau canal `conversation:stopWorktreeSetup` ; `skipWorktreeSetup` sert aussi à
    « Continuer sans attendre ». Les messages retenus sont gardés par le branchement, leur nombre
    par la préparation (`hold`), pour que chaque mise à jour de la carte le garde.
  - **D3** (avec la fiche 178) : une tâche planifiée (`summary.scheduled`) n'attend jamais
    l'accord : la commande non autorisée n'est pas lancée (état « non lancée », `unattended`), la
    ligne de contexte le dit à l'agent, et l'exécution note `setupNotApproved`, affiché
    « préparation non autorisée » dans son historique. Planificateur : seulement l'évènement
    `worktree-setup` lu dans `onEvent`.
  - Au passage : une commande arrêtée pendant la copie n'est plus lancée (signal déjà levé).
  ADR-0037 complété (encore « proposé ») : points 2 et 4. Tests : `worktree-setup.test.ts`
  (empreinte, fichier changé, `archive` seule, arrêt, continuer sans attendre, sans
  surveillance), `worktree-setup-wiring.test.ts` réécrit sur la vraie préparation (shell réduit),
  carte, planificateur (échéance passée dans `scheduled-tasks.json`) ; e2e `worktree-setup` :
  D1, D2, D4 (« Arrêter », « Continuer sans attendre »), D6 (archive lancée à la suppression), D3
  (tâche planifiée à échéance passée), captures `175-preparation-fichier-change`,
  `175-preparation-message-en-cours`, `175-preparation-sans-attendre`,
  `175-preparation-archive-seule`, `175-tache-planifiee-sans-preparation`.
