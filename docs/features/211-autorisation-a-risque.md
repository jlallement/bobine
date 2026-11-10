# 211 — Cartes d'autorisation à risque : écriture hors du dossier, sudo, portée de « Toujours »

- **Statut** : fait
- **Dépend de** : 042 (« Toujours autoriser » retenu), 203 (cartes d'autorisation lisibles)
- **Agents** : les deux (générique ACP : `kind`, `rawInput`, `locations`, diffs, titre). Motivé par
  Bob 2.0.9, qui n'envoie pour une commande que `rawInput.command`.

## Pourquoi

Essai d'une heure avec Bob 2.0.9 (2026-11-08) : `echo … > ~/.testcontainers.properties` et
`sudo ln -sf … /var/run/docker.sock` sont arrivés sur des cartes identiques aux autres. L'alerte
« hors du dossier de la conversation » (fiche 203) ne regarde que `cwd` et `locations`, que Bob
n'envoie pas (trace réelle `__traces__/bob-2.0.9/commande-hors-dossier-et-sudo-refusees.ndjson`).
Et « Toujours autoriser », dont la portée est décidée par l'agent, était offert partout sans le dire.

## Critères d'acceptation

- [x] Risques calculés dans le main (`src/main/agent/permission-risk.ts`, appelé par
      `AgentHost.onPermissionRequest`), typés `PermissionRisk[]` (`outside-folder` avec le chemin,
      `home-dotfile`, `system-path`, `privilege` pour `sudo` / `su` / `doas` / `pkexec`), portés par
      l'évènement `permission-request` et gardés en `ToolPermission.risks` (optionnel : les
      conversations d'avant se chargent).
- [x] Chemins : emplacements, champs chemin de `rawInput`, chemins des diffs ; pour une commande,
      seulement ses cibles d'écriture lues prudemment (`>`, `>>`, `&>`, `2>`, `tee`, destination de
      `cp` / `mv` / `ln` / `install` / `rsync`, opérandes de `rm` / `mkdir` / `touch` / `chmod`…,
      `dd of=`, `sed -i`, redirection d'un heredoc) ; `~`, `$HOME`, `..`, `cd`, `realpath` de
      l'ancêtre existant. Une lecture ne signale jamais rien ; `$(`, backtick, `eval`, `bash -c` :
      aucune écriture signalée plutôt qu'une fausse, mais `sudo` / `su` / `doas` / `pkexec` en tête
      d'un segment restent dits (`sudo bash -c "…"`, `sudo $(…)`).
- [x] Une ligne par chemin, avec sa raison la plus précise : dossier système, puis fichier caché du
      dossier personnel, puis hors du dossier ; la ligne des droits d'administrateur à part.
- [x] Carte : bandeau ambré `data-testid="permission-risks"` (`role="note"`, avant les boutons),
      une ligne par risque ; chemin passé par `visibleText`.
- [x] Carte à risque : « Toujours autoriser » masqué (l'option reste dans le protocole) ; jamais
      retenue par l'app non plus, ni accordée d'office par une règle retenue.
- [x] Carte ordinaire où l'agent offre « Toujours » pour un outil que l'app ne retient pas : note
      « C'est l'agent qui décide ce que couvre « toujours ». » (fr + en).
- [x] Trace réelle de Bob 2.0.9 rejouée (`trace-replay.test.ts`) : risques sur les deux cartes.
- [x] Testé contre l'agent factice (scénarios `commande-ecriture-hors-dossier`, `commande-sudo`,
      `commande-lecture-hors-dossier`, `ecriture-hors-dossier`) : `agent-host.test.ts`, e2e
      `autorisation-commande` clair et sombre.

## Plan

1. Type partagé `PermissionRisk` et `ToolPermission` dans `src/shared/permissions.ts` ;
   `risks?` sur l'évènement (`shared/agent.ts`) et le réducteur (`shared/transcript.ts`).
2. Main : `shell-words.ts` (mots, opérateurs, redirections, heredoc ; `null` au moindre doute),
   `command-writes.ts` (cibles d'écriture, `cd`, droits), `permission-risk.ts` (chemins, résolution,
   classement) ; appel dans `AgentHost.onPermissionRequest`, `PendingRequests` garde les risques ;
   rejeu de trace (`trace-replay.ts`) au même endroit.
3. Renderer : `thread/PermissionRisks.tsx` (bandeau, note), `PermissionView` (bouton masqué),
   CSS `.pc-risks`, clés i18n `toolCall.permission.risk.*`, `agentAlwaysNote`.
4. Agent factice : quatre scénarios dans `scenarios-commandes.mts` ; `docs/mock-agent.md`.
5. Tests : table `permission-risk.test.ts`, `trace-replay.test.ts`, `agent-host.test.ts`,
   `AuthorizationCard.test.tsx`, e2e `autorisation-commande`.
6. Docs : `docs/acp.md` (forme réelle d'un `execute` de Bob 2.0.9), `docs/architecture.md`,
   `CHANGELOG.md` / `CHANGELOG.en.md`.

Aucune nouvelle dépendance ; pas d'ADR (le drapeau n'est pas structurant ; la règle 042 « jamais de
commande retenue » est inchangée, plutôt renforcée).

## Journal

- **2026-11-09** — Fait.
  - Trace réelle copiée dans `src/main/agent/__traces__/bob-2.0.9/commande-hors-dossier-et-sudo-refusees.ndjson`
    (relevé du jour, 0,09 bobcoin) : chemins du scratchpad remplacés par `<dossier>` (dossier de la
    session) et `<maison>/dehors` (dossier voisin), lignes `note` du client de relevé ôtées (le
    format des traces ne les connaît pas) ; aucun secret. Test de rejeu : sans le correctif, la
    carte n'a pas de `risks` (et `commandFolderOf` dit `outside: false`).
  - Écarts au diagnostic : pas de variante `osascript … with administrator privileges` (hors de la
    maquette) ; `/tmp` et `/var/folders` sont « hors du dossier », jamais « système ».
  - Défense en plus : une règle « toujours autoriser » retenue par l'app (fiche 042) n'accorde plus
    d'office une demande qui porte un risque, et « Toujours » choisi sur une carte à risque n'est
    jamais retenu.
  - `transcript.ts` était au plafond ESLint (800 lignes) : `ToolPermission` déplacé dans
    `shared/permissions.ts` (réexporté par `transcript.ts`).
  - Reste à faire (lot 2 du diagnostic) : signaler aussi après coup une commande que l'agent a
    lancée sans demander (Bob a écrit `cat > ~/.testcontainers.properties << 'EOF'` sans carte) ;
    règles par préfixe de commande pour l'outil terminal de l'app (ADR à écrire).
- **2026-11-09, relecture du tech lead** :
  - Une ligne par chemin (la capture `F211-b-sudo` montrait `/var/run/docker.sock` deux fois) :
    `permission-risk.ts` ne garde pour un chemin que la raison la plus précise (système > fichier
    caché du dossier personnel > hors du dossier). L'exemple de la maquette
    `~/.testcontainers.properties` se lit donc « Modifie un fichier de configuration personnel ».
  - Les droits d'administrateur survivent au doute : `shell-words.ts` ne rend plus `null` ; un
    morceau illisible (`$(…)`, backtick, `$'…'`, `<(…)`, guillemet non fermé) devient un mot
    inconnu, la lecture continue et signale le doute. `commandWrites` ne rend alors aucune
    écriture, mais garde `sudo` / `su` / `doas` / `pkexec` en tête de chaque segment (`sudo bash -c
    "…"`, `sudo $(which rm) …`, `echo $(date) && sudo tee …`). Pas dans `echo $(sudo id)` (la
    substitution n'est pas lue) ni après un guillemet non fermé.
