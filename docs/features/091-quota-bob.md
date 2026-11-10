# 091 — Quota de bobcoins de Bob

- **Statut** : fait
- **Dépend de** : 019 (consommation), 026 (suppression chez l'agent), 088 (adaptateurs)
- **Agents** : Bob — lui seul a un quota (bobcoins) et ne le transmet pas par ACP ; lu par un
  adaptateur de son profil (`quotaSource`, ADR-0015), générique côté interface (ADR-0011, ADR-0017).

## Pourquoi

Bob IDE affiche le quota de bobcoins et la part consommée ; Bobine non, et c'est « un gros frein
d'adoption ». L'utilisateur peut travailler sur plusieurs ordinateurs et son plafond peut changer en cours de
mois : seul le service de Bob a les bons chiffres.

## Ce qu'on sait de Bob (2.0.6, relevé du 2026-10-20)

- Rien par ACP ; rien en local (`key_value_store` de `bob.db` vide).
- `bob chat`, commande `/status` : panneau « Task Overview » avec `Task ID`, `Monthly Budget`
  (« Unlimited » sans plafond), `Monthly Usage`, version et méthode de connexion. Chiffres que Bob
  lit auprès de son service, « Fetching budget... » le temps de la lecture. 0 bobcoin.
- `bob chat` crée une tâche vide à son lancement ; `session/delete` sur `bob acp` (initialize puis
  delete, sans session ouverte) la retire de l'historique.
- Options utiles de `bob chat` : `--trust`, `--disable-mcp`, `--disable-subagents`.

## Critères d'acceptation

- [x] Au démarrage de Bobine, si Bob est installé, le quota est lu en tâche de fond (`bob chat` →
      `/status` dans un pseudo-terminal), sans ralentir l'ouverture de l'app.
- [x] Aucune session vide ne reste chez Bob : toutes les sessions du dossier réservé à cette lecture
      sont supprimées après chaque lecture, réussie ou non.
- [x] Plafond, consommation et part consommée affichés pour Bob (présentation : voir Maquettes).
- [x] Plafond « Unlimited » : consommation seule, sans pourcentage.
- [x] La moindre surprise (écran inattendu, délai dépassé, Bob non connecté, licence) : quota
      inconnu, rien d'affiché, une ligne au journal ; jamais de chiffre faux.
- [x] Lecture du format figée sur une vraie capture de `/status` (test) ; sonde de Bob complétée.
- [x] Fonction déclarée dans le profil de Bob, listée dans Réglages › Agents et `docs/agents.md`.
- [x] Testé contre l'agent factice : un faux écran `/status` (même format), sessions du dossier
      réservé supprimées, quota affiché.

## Maquettes

DOM injecté dans l'app buildée (aucun code produit), agent factice habillé en Bob. Captures dans
`e2e/captures/` (clair et sombre), comparaison dans `maquette-quota-comparaison-*` :

| Capture | Ce qu'elle montre |
|---|---|
| `maquette-quota-0-actuel` | Aujourd'hui : seul le coût de la conversation (« 0,0632 bobcoins ») |
| `maquette-quota-a-puce` | A : puce anneau + « 13 % » dans la barre de saisie, avant le coût |
| `maquette-quota-a-puce-alerte` | A au-delà de 80 % : orange (rouge à 95 %), seuils de la jauge de contexte |
| `maquette-quota-b-barre-laterale` | B : « Prêt · 13 % du quota » et une barre sous le nom de l'agent |
| `maquette-quota-detail` | Détail au clic : quota du mois, barre, reste, source, heure de lecture, « Actualiser » |

**Choix de l'utilisateur (2026-10-20)** : **B**, sous le nom de l'agent, avec le détail au clic.
Écarté : A (puce dans la barre de saisie).

## Plan

- `src/shared/usage.ts` : `AgentQuota` (agent, devise, plafond ou `null` si illimité, consommé,
  heure de lecture).
- `src/main/agent/adapters.ts` : point d'extension `QuotaSource` (`read(contexte)`), contexte fourni
  par l'app (pseudo-terminal, dossier, environnement, délai).
- `src/main/agent/bob-status.ts` : `parseBobStatus` (écran → chiffres), `bobStatusQuota` (lance
  `bob chat --trust --disable-mcp --disable-subagents`, attend l'écran, tape `/status`, attend
  les chiffres, quitte). Écran relu par `@xterm/headless`.
- `src/main/agent/session-list.ts` : `deleteSessionsIn` (initialize, `session/list` du dossier,
  `session/delete` de chacune), sans ouvrir de session.
- `src/main/agent/quota.ts` : `QuotaReader` — dossier réservé `<données de l'app>/agent-status/<agent>`,
  lecture, nettoyage, mémoire du dernier quota, abonnés.
- `src/main/agent/profiles.ts` : `quotaSource` de Bob ; agent factice avec `MOCK_AGENT_QUOTA=1`
  (faux écran `src/mock-agent/status-screen.mts`).
- `src/main/index.ts`, `src/main/ipc.ts`, `src/shared/ipc.ts`, `src/preload/api.ts` : lecture au
  démarrage, `usage:quotas`, `usage:refreshQuota`, évènement `usage:quotasChanged`.
- Interface : selon la maquette choisie ; textes dans `fr.json` / `en.json`.
- `src/main/agent/capabilities.ts`, `docs/agents.md`, `docs/acp.md`, `docs/architecture.md`.
- Pas de nouvelle dépendance (`node-pty` et `@xterm/headless` sont déjà là).

## Journal

- 2026-10-20 — Fiche créée. Essai réel : `/status` lu dans un pseudo-terminal (budget et
  consommation affichés, SSO), tâche vide créée puis supprimée par `session/delete`.
  Choix de l'utilisateur : lecture par `bob chat` en tâche de fond au démarrage, sans laisser de
  session vide. ADR-0017.
- 2026-10-20 — Côté main fait et essayé pour de vrai (Bob 2.0.6, SSO) : `bob-status.ts` (écran
  relu par `@xterm/headless`, anglais forcé par `LC_ALL`), `quota.ts` (dossier réservé
  `<données>/agent-status/bob`, nettoyage), `deleteAgentSessions` (`session-list.ts`), point
  d'extension `QuotaSource`, canaux `usage:quotas`, `usage:refreshQuota`, `usage:quotasChanged`.
  Lecture au démarrage de `pnpm dev` : budget et consommation lus en 4,9 s, 1 session vide supprimée,
  aucune tâche restée dans le dossier réservé. Essais automatiques : jamais le vrai Bob
  (`BOBINE_QUOTA=off` pour l'app packagée, agent factice seul sous `BOBINE_CONFIG_HOME`).
  Découvert en route : la tâche vide de `bob chat` n'apparaît pas dans `session/list` (elle
  n'a pas de `directory`) ; supprimée par son identifiant, ou retrouvée dans `bob.db` par son
  `workspace`. Maquettes de l'affichage capturées.
- 2026-10-20 — Affichage B fait : `AgentQuotaStatus` (nom, « Prêt · 81 % du quota », barre aux seuils
  de la jauge de contexte, `usageLevel` partagé dans `shared/usage.ts` ; tout le bloc ouvre le
  détail, pour ne pas cacher le nom), `useAgentQuotas`, `usage:refreshQuota` rend les quotas après
  relecture. Agent factice : faux `/status` (`status-screen.mts`, `MOCK_AGENT_QUOTA=1`) ; suite e2e
  `quota` (clair et sombre : lu au démarrage, barre orange, détail « 812,5 / 1 000 bobcoins », reste,
  « Actualiser », aucune session vide laissée), captures `quota-1-barre-laterale`, `quota-2-detail`
  regardées. Sonde : étape « bob chat (quota, /status) » (options de `bob chat --help` ; le contrôle des
  libellés du panneau, retiré le 2026-11-10 avec la fiche 216), attentes enregistrées (`--accept`, Bob 2.0.6). Écarts au plan :
  mise en place sortie de `index.ts` dans `quota-setup.ts` (limite de lignes) ; relecture seulement
  au démarrage et sur « Actualiser » (pas après chaque message : un `bob chat` par lecture).

- 2026-11-07 — Recette 0.11, D6 et D11 : dossier réservé unique par machine
  (`~/Library/Caches/Bobine/agent-status/bob`, `quotaStatusDir`) au lieu de `<données>/agent-status/bob`
  (chaque profil, temporaire compris, ajoutait une entrée à `~/.bob/trustedFolders.json`) ; délai
  de lecture 20 s au lieu de 60 ; après un échec, pas de lecture au lancement pendant 12 h
  (`bob.pause.json`), une relecture demandée passe ; aucune avec `--agents-neufs`. Faux `bob chat`
  dans `quota.test.ts`. Le vrai `~/.bob` n'a pas été touché.
