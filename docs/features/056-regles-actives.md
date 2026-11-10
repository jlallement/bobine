# 056 — Règles actives de la conversation

- **Statut** : fait
- **Dépend de** : 052, 054
- **Agents** : les deux ; emplacements des fichiers propres à chacun, déclarés dans le profil
  (ADR-0011)

## Pourquoi

L'agent suit des consignes écrites dans des fichiers (`AGENTS.md`, `.bob/rules/`…), différents selon
l'agent, le dossier et le mode. Rien ne dit aujourd'hui lesquels s'appliquent à la conversation :
on ne sait pas pourquoi l'agent se comporte ainsi, ni où corriger une consigne.

## Critères d'acceptation

- [x] « Réglages de la session » (curseurs de la zone de saisie) a une section « Règles actives » :
      chaque fichier que l'agent charge pour cette conversation, avec sa portée (projet, mode,
      personnel) ; sinon « Aucun fichier de règles ».
- [x] Un clic ouvre la règle en aperçu dans le panneau de droite (lecture seule, fiche 052), même
      hors du dossier (`~/.bob/rules/…`) ; seuls les fichiers de la liste peuvent être lus ainsi.
- [x] Bob 2.0.6 (essai réel du 2026-10-14, voir `docs/acp.md`) : `AGENTS.md` du dossier, `.bob/rules/**` et
      `.bob/rules-<mode actif>/**` du dossier et de `~/.bob`, et les mêmes dans `.bob/plugins/*/`.
- [x] OpenCode (essai réel 1.19) : tous les `AGENTS.md` du dossier jusqu'à la racine du dépôt
      (jusqu'à `/` hors dépôt), sinon les `CLAUDE.md` ; `~/.config/opencode/AGENTS.md`, sinon
      `~/.claude/CLAUDE.md` ; fichiers et URL de la clé `instructions`.
- [x] Emplacements déclarés dans le profil (`rules`), listés sous « Propre à … » et dans
      `docs/agents.md`.
- [x] Testé : règles des deux formats (unitaire, dossiers jetables), e2e avec l'agent factice
      (format Bob), aperçu d'une règle personnelle.

## Relevé (2026-10-14)

- **Bob 2.0.6** : règles listées = règles appliquées (essai réel, mots de code) ; dossier = celui
  de la session, sans remonter. Non vérifié en réel : chargement seulement si le dossier est
  approuvé, fichiers système ignorés (`.DS_Store`, `Thumbs.db`, `.gitkeep`, `.gitignore`,
  `.bobignore`), profondeur 5 au plus.
- **OpenCode 1.19** (essai réel, mots de code, modèle gratuit) : dans un dépôt `repo/sub`, il
  charge `repo/AGENTS.md` et `repo/sub/AGENTS.md`, pas l'`AGENTS.md` au-dessus du dépôt, pas
  `sub/CLAUDE.md` (un `AGENTS.md` existe) ; la clé `instructions` d'`opencode.json`. Hors dépôt,
  il remonte au-delà du dossier (`AGENTS.md` du parent chargé).

## Plan

1. `shared/rules.ts` : `RuleFileView` (chemin, libellé, portée, mode, fichier ou URL).
2. `main/agent-config/rules.ts` : `activeRules('bob' | 'opencode', { workspace, home, mode, env })`.
3. Profils : `rules: 'bob'` (Bob, agent factice), `'opencode'` ; `capabilities.ts` (repère
   `rules-files`), `docs/agents.md`.
4. `ConversationManager.rules(id)` (mode actif de la conversation) et `readRule(id, path)` ;
   IPC `conversation:rules`, `conversation:readRule`.
5. `SessionSettingsMenu` : section « Règles actives », lue à l'ouverture du menu ; clic → aperçu.
6. Tests : unitaires des deux formats, manager, e2e (captures clair / sombre).

## Journal

- 2026-10-14 — Fiche créée ; relevés Bob (code) et OpenCode (essai réel, 0 bobcoin). Placement
  choisi par l'utilisateur : section de « Réglages de la session ».
- 2026-10-14 — Fait. `rules.ts` (+ tests sur les arbres des essais réels), profils `rules`,
  `rules` / `readDocument` du gestionnaire (+ test : mode actif, règle personnelle lisible, autre
  fichier refusé), section « Règles actives » (chemin, portée et mode sur deux lignes), aperçu
  dans le panneau ; e2e `rules`, captures `i0`, `i1` (clair, sombre). Écart au plan : pas de canal
  `conversation:readRule` ; `files:readMarkdown` (ouverture et rafraîchissement de l'aperçu) lit
  aussi les règles actives, et rien d'autre hors du dossier. Le gestionnaire reçoit le dossier
  personnel des agents (`agentHome`) : les essais n'utilisent jamais le vrai.
  **Essai réel Bob 2.0.6** (`~/bob-essai/regles-056`, mode agent) : l'app liste `AGENTS.md`,
  `.bob/rules-agent/agent.md`, `.bob/rules/style.md` ; Bob applique exactement ces trois (mots de
  code ALPHA, BRAVO, CHARLIE), pas `rules-plan` (DELTA). Coût : 0,031 bobcoin.
- 2026-10-19 — **Menu qui sautait, ligne choisie par erreur** (essai e2e `rules` instable, relevé
  pendant la fiche 082 : environ un échec sur deux sur une machine chargée, `tests.md` ouvert au
  lieu de `style.md`). Suivi image par image : le menu « Réglages de la session » s'ouvrait à
  l'appui, au-dessus de la zone de saisie, avant ses règles ; une fois lues, il grandissait d'abord
  vers le bas, par-dessus le bouton, puis sautait sous la zone de saisie (accueil : pas la place
  au-dessus). Si le relâché du clic tombait dans cet instant, Radix choisissait la ligne sous le
  pointeur (un vrai clic peut aussi tomber dedans). Correctif (`SessionSettingsMenu`) : le menu
  s'affiche une fois les règles et les serveurs MCP lus, au plus 300 ms après l'appui ; il apparaît
  à sa taille et à sa place. Vérifié : test de composant (`SessionSettingsMenu.test.tsx`), e2e
  `rules` (nouveau contrôle : le menu ne change jamais de côté — il le faisait à chaque ouverture),
  10 passages sur 10 sous charge processeur (clair et sombre), et au vrai clic.
