# 178 — Tâches planifiées locales

- **Statut** : fait
- **Dépend de** : 036 (worktrees), 097 (conversations filles : conversation hors de l'active), 024
  (notifications), 157 (plafond de coût), 144 (page de l'app dans la zone principale, ADR-0031)
- **Agents** : les deux (et tout agent ACP) — rien de propre à un agent : une exécution est une
  conversation ordinaire, ouverte et envoyée comme les autres.

## Pourquoi

Claude Desktop (tâches planifiées), Codex (« Automations ») et Cursor savent relancer une consigne
à heure fixe : revue des dépendances le lundi, résumé des PR chaque matin, nettoyage toutes les
quatre heures. Dans Bobine, il faut aujourd'hui y penser et retaper la consigne. L'utilisateur
enregistre une **consigne + un dossier + un agent + une fréquence** ; à l'heure dite, Bobine ouvre
une nouvelle conversation (au besoin dans un worktree neuf) et envoie la consigne ; il est prévenu
à la fin et retrouve l'exécution dans la barre latérale, marquée comme planifiée.

Bob se paie en bobcoins (quota de 50) : une tâche qui part seule ne doit jamais coûter plus que
prévu, ni partir en rafale au réveil du Mac.

## Critères d'acceptation

- [x] Une page « Tâches planifiées » (ligne de la barre latérale sous « Mon activité ») liste les
      tâches et permet de **créer, modifier, mettre en pause / reprendre, lancer maintenant,
      supprimer**.
- [x] Fréquences : **une fois** (date et heure), **chaque jour**, **jours de semaine** (lun.–ven.)
      à une heure, **toutes les N heures** (1 à 24) ; heure locale du Mac.
- [x] À l'heure dite, une conversation est créée dans le dossier (ou dans un **nouveau worktree**
      de ce dossier, case à cocher) avec l'agent choisi, la consigne est envoyée ; la conversation
      porte la marque « planifiée » (icône et infobulle dans la barre latérale) et le nom de la
      tâche ; elle ne devient pas la conversation active.
- [x] **Coût** : chaque exécution montre son coût réel (consommation de la conversation) ; la tâche
      montre une estimation (moyenne des dernières exécutions qui ont un coût). Un **plafond par
      tâche** (montant dans la devise de l'agent, ou jetons quand l'agent ne donne pas de coût) est
      posé comme plafond propre de la conversation : le gardien de la fiche 157 interrompt le tour et
      pose sa carte, sans rien relancer.
- [x] **Pas de chevauchement** : une exécution ne part jamais si la précédente de la même tâche
      tourne encore (tour en cours, autorisation en attente) ; l'échéance est notée « sautée ».
- [x] **Pas de rafale au réveil** : les échéances manquées (Mac en veille, Bobine fermée) ne sont
      pas rejouées une à une ; au plus **une** exécution de rattrapage, réglable par tâche
      (« Rattraper une exécution manquée », activé par défaut), sinon l'échéance est notée
      « manquée ». La prochaine échéance repart de maintenant.
- [x] **Permissions** : une exécution planifiée n'accorde rien de plus qu'une conversation
      ordinaire (mêmes réglages d'autorisation, aucun mode imposé) ; une demande d'autorisation
      attend l'utilisateur et le notifie (notifications de la fiche 024).
- [x] Notification à la fin (celles de la fiche 024 : conversation hors de vue qui a fini) et à
      l'échec du lancement (dossier introuvable, agent inconnu, worktree impossible).
- [x] **App fermée** : les tâches ne tournent que lorsque Bobine est ouverte (dit sur la page) ; le
      réglage « Empêcher la mise en veille » garde le Mac éveillé pendant une exécution, comme pour
      toute conversation qui travaille.
- [x] Tâches enregistrées dans le main : fichier versionné `scheduled-tasks.json` à côté de
      `settings.json` (écriture atomique, fichier abîmé mis de côté), historique des 20 dernières
      exécutions par tâche.
- [x] Testé : règles d'horaire pures (`shared/schedule.ts`), planificateur avec horloge simulée
      (minuteries de Vitest), stockage ; essai e2e contre l'agent factice (création d'une tâche,
      « Lancer maintenant », conversation marquée dans la barre latérale), clair et sombre.

## Plan

### Décisions

- **Où vit le planificateur** : `src/main/scheduler/`, dans le main (seul à lancer des agents). Il
  passe par le `ConversationManager` comme les conversations filles : rien de nouveau côté ACP.
  ADR-0039 (proposé) : une exécution planifiée est une conversation ordinaire, lancée par le main, jamais
  quand l'app est fermée (pas d'agent de lancement `launchd`).
- **Horloge** : un contrôle toutes les 30 s (`setInterval`, injecté) plutôt qu'une minuterie
  jusqu'à l'échéance : une minuterie longue dérive pendant la veille ; au réveil (`powerMonitor`
  `resume`), un contrôle immédiat. Une échéance est « à l'heure » si elle a moins de 10 min de
  retard, sinon « manquée » (rattrapage selon la tâche).
- **Plafond** : la devise d'un agent n'est connue qu'à sa première consommation ; le plafond de la
  tâche (`amount` et/ou `tokens`) est donc posé en plafond propre (`cost-cap-set`) dès que l'unité
  de la conversation est connue (premier `usage-report` / `usage_update`), puis le gardien de la
  fiche 157 fait le reste. Sans plafond de tâche, celui des réglages vaut, comme ailleurs.
- **En cours** : une exécution court de son envoi jusqu'à la fin du tour (`turn-end`,
  `turn-error`, agent arrêté, conversation supprimée).
- **Coût réel** : le résumé de consommation de la conversation (`usage` du résumé) relu à la fin du
  tour ; estimation = moyenne des 5 dernières exécutions qui en ont un, dans la même devise.

### Fichiers

- `src/shared/schedule.ts` (+ test) : types `ScheduledTask`, `Schedule`, `TaskRun`, `nextRunAfter`,
  validation `parseTaskInput`, `estimateCost`, description lisible.
- `src/main/scheduler/task-store.ts` (+ test) : lecture/écriture versionnée, `readJson` /
  `writeFileAtomic` de `storage.ts`.
- `src/main/scheduler/scheduler.ts` (+ test, minuteries simulées) : échéances, rattrapage, pas de
  chevauchement, lancement, suivi de fin, plafond, historique.
- `src/main/scheduler/scheduler-ipc.ts` : canaux `schedule:*` (arguments vérifiés) et mise en place
  (`setupScheduler`) appelée par `index.ts`.
- `src/main/conversations/manager.ts` : `createDetached` (conversation hors de l'active, dans un
  dossier ou un nouveau worktree), dont `createChild` devient un cas ; `record.scheduled`.
- `src/main/conversations/store.ts`, `helpers.ts`, `src/shared/agent.ts` : marque `scheduled` de
  l'enregistrement et du résumé.
- `src/shared/ipc.ts`, `src/preload/api.ts`, `src/main/ipc.ts` : canaux.
- Renderer : `useActivityPage` devient la page de l'app ouverte (`activity` | `scheduled`) ;
  `components/scheduled/ScheduledPage.tsx`, `TaskForm.tsx` ; ligne de la barre latérale ; icône
  sur les conversations planifiées (`HistoryItem.tsx`).
- i18n `fr.json` / `en.json` ; e2e : suite `scheduled-tasks`.
- Pas de nouvelle dépendance.

## Compatibilité Bob

Rien de nouveau côté ACP : une exécution est un `session/new` puis un `session/prompt` ordinaires,
comme une conversation ouverte à la main. Aucun mode, option ou accord imposé au profil de Bob ;
le plafond en bobcoins est celui de la fiche 157 (coût relu par l'adaptateur de Bob). Rien à
ajouter à `docs/acp.md` ni à la matrice de `docs/agents.md` (fonction générique).

## Journal

- 2026-11-06 — fiche créée, plan écrit.
- 2026-11-06 — fait :
  - `shared/schedule.ts` (types, `nextRunAfter`, `dueDecision`, `estimateCost`, validation),
    `main/scheduler/` (`Scheduler`, `TaskStore`, `scheduler-ipc.ts` : canaux `schedule:*`,
    évènement `schedule:changed`, notification d'un lancement impossible, contrôle au réveil).
  - Gestionnaire : `createDetached` (dossier ou nouveau worktree, hors de l'active) dont
    `createChild` devient un cas ; `inNewWorktree` prend une origine (dossier, agent) au lieu
    d'un identifiant de conversation. Le fichier est au plafond de 1050 lignes d'ESLint : pour
    faire la place, les règles actives (`rulesOf`) et le type `DetachedRequest` sont passés dans
    `helpers.ts`, et `historySources` (sauvegarde) dans `backup.ts` pour `index.ts` (850).
  - Page de l'app « Tâches planifiées » (`components/scheduled/`), ligne de la barre latérale,
    repère (horloge) sur les lignes des exécutions ; `useActivityPage` tient la page ouverte
    (`activity` | `scheduled`).
  - Écarts au plan : pas de raccourci clavier pour la page (aucun libre d'évident) ; le coût
    « estimé » est la moyenne des 5 dernières exécutions qui en ont un (rien n'est estimé avant
    la première) ; les exécutions ne sont pas comprises dans la sauvegarde de l'historique
    (`scheduled-tasks.json` n'y est pas copié).
  - Incident pendant la mise au point de l'essai e2e : le formulaire proposait d'abord le premier
    agent de la liste (IBM Bob, installé sur ce Mac) et un essai a lancé un vrai `bob acp` avec
    la consigne `/scenario cout-qui-monte`. Corrigé : l'agent par défaut est celui des nouvelles
    conversations, et la suite s'arrête net si le formulaire ne propose pas l'agent factice.
  - Essais : `schedule.test.ts` (13), `scheduler.test.ts` (10, minuteries simulées),
    `task-store.test.ts` (4), `ScheduledPage.test.tsx` (3), barre latérale (1) ; suite e2e
    `scheduled` (clair et sombre) : échéance à l'heure, autorisation en attente, échéances
    manquées sans rattrapage, formulaire, « Lancer maintenant », plafond franchi.
  - Vérification : `./scripts/verify` — lint, formatage et types verts ; tests 2390/2391, le seul
    rouge est le test de temps « recherche sans charger les fils » du gestionnaire (écart de
    boucle d'évènements < 100 ms) sous une charge machine de ≈ 50, vert 3 fois sur 3 lancé seul.
    `pnpm build && pnpm e2e --changed` (toutes les suites, `App.tsx` étant global) : 146/147,
    `inbox` sombre en délai dépassé au démarrage de l'agent, verte relancée seule (clair et
    sombre).
  - Reste à faire (suite possible) : exécutions app fermée (`launchd`, écarté par l'ADR-0039),
    copie de `scheduled-tasks.json` dans la sauvegarde, filtre « planifiées » dans la barre
    latérale.
- 2026-11-06 — relecture du tech lead :
  - Coût par jour : « ≈ Y par jour » à côté du coût par exécution pour une tâche « toutes les N
    heures » (`runsPerDay` × moyenne) ; pas pour « chaque jour » ni « jours de semaine », où il
    serait égal au coût d'une exécution. Dans le formulaire, toutes les N heures sans plafond :
    avertissement (coût inconnu, jusqu'à ⌈24/N⌉ exécutions par jour, fixer un plafond).
  - Plafond affiché dans l'unité de l'agent dès qu'une exécution passée l'a fait connaître
    (`knownUnit` : « 2,00 $US », « 2 bobcoins », jetons) ; « Plafond des réglages » si le
    plafond de la tâche n'existe pas dans cette unité (c'est alors lui qui s'applique) ; libellé
    générique avant la première exécution seulement.
  - Actions sur une ligne : Lancer maintenant, Mettre en pause, Modifier, puis « … » avec
    « Supprimer… », qui demande confirmation (la tâche et l'historique de ses exécutions ; les
    conversations restent dans la barre latérale).
  - Panneau de droite sur la page : comportement existant de « Mon activité » (ADR-0031 : le
    panneau reste disponible sur une page de l'app), inchangé.
- 2026-11-06 — recette 0.9 (fiche 183, D12) : la suite e2e `scheduled` attendait le plafond au
  format français (`2,00 $`) et échouait en `--lang en`, où l'app écrit bien « Cap: $2.00 ». Le
  texte attendu est maintenant construit avec `L('scheduled.cap')` et le format monétaire de la
  langue des essais (`Intl.NumberFormat`, comme `formatCap`). Rien de changé dans l'app.
