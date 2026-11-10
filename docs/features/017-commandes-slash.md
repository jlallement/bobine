# 017 — Commandes « / »

- **Statut** : fait (Claude Code réel à essayer)
- **Dépend de** : 003

## Pourquoi

Les agents annoncent leurs commandes (`/review`, `/compact`, `/init`…). Dans Claude Code, taper `/`
ouvre une liste filtrable ; l'app les ignore aujourd'hui.

## Critères d'acceptation

- [x] `available_commands_update` mémorisé par conversation.
- [x] `/` en début de message ouvre une liste filtrable (nom + description), navigation clavier, Tab / Entrée.
- [x] Indication du paramètre attendu (`input.hint`).
- [x] Testé : agent factice qui annonce des commandes ; e2e ; Codex et OpenCode réels.
- [x] Bob réel.
- [ ] Claude Code réel (après connexion).

## Notes

L'agent factice a déjà `/scenario` : il devra l'annoncer comme commande.

## Ce que les agents annoncent (relevé le 2026-10-11)

- Claude Code : 46 commandes (dont les skills), certaines avec `input.hint`.
- Codex : 48 commandes (`/plan`, `/status`, `/mcp [reconnect]`, skills `$…`).
- OpenCode : 3 commandes (`/init`, `/review`, `/customize-opencode`).
- Bob 2.0.6 : ses skills et les prompts MCP (`serveur:commande`), annoncés après l'ouverture de
  session ; il analyse lui-même les messages `/nom arguments`.

## Plan

- `AgentHost` : `available_commands_update` → `commands` dans l'instantané (pas un élément du fil),
  accepté avant que l'identifiant de session soit connu (même paquet que la réponse à `session/new`).
- `src/shared/commands.ts` : `commandQuery`, `filterCommands` (préfixe, nom, description).
- `CommandMenu` contre la zone de saisie : au-dessus, ou en dessous quand il y a plus de place
  (accueil, zone de saisie centrée), hauteur plafonnée à la place disponible (`useMenuPlacement`,
  partagé avec le menu `@`) ; `Composer` : ↑↓, Tab (compléter), Entrée (compléter si un argument
  est attendu, sinon envoyer), Échap ; rappel de l'argument attendu.
- Agent factice : annonce `/scenario <nom>`, `/aide`, `/demo` après `new` / `load` / `resume`.

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-11 — Implémenté (175 tests, `pnpm e2e` clair / sombre : liste, filtre, Tab, argument,
  envoi direct, aucune correspondance, Échap).
  - **Essai réel Codex** : 48 commandes, « /sta » → `/status` envoyé, Codex répond avec la
    configuration et la consommation de la session.
  - **Essai réel OpenCode** : 3 commandes, « /rev » → `/review`.
  - Défaut de test corrigé : « sc » trouve aussi `/aide` par sa description (« scénarios »), ce qui
    est voulu.
- 2026-10-11 — **Bob réel** : 6 commandes (ses skills : `build-mcp-server`, `configure-hooks`,
  `configure-mcp`, `create-mode`, `create-skill`, `office-insights`), affichées dans le menu « / ».
- 2026-10-13 — **Skills vérifiés (demande de l'utilisateur)** : rien à faire côté app, tout passe par
  `available_commands_update`. Essai réel dans `~/bob-essai/skills-test` (un skill par emplacement) :
  - Bob 2.0.6 annonce `.bob/skills`, `.bob/plugins/*/skills`, `.agents/skills`, `.claude/skills`
    (+ ses skills intégrés) ; `/bonjour-claude` exécuté, après une autorisation « Using skill … ».
  - OpenCode 1.19 annonce `.agents/skills`, `.claude/skills`, `.opencode/skill(s)` et ses commandes
    `.opencode/command/*.md` ; `/bonjour-agents` (outil `skill`) et `/salut` exécutés, sans
    autorisation.
  - Emplacements communs aux deux : `.agents/skills` et `.claude/skills`. Bob IDE n'est pas installé
    sur ce Mac : non vérifié (Bob Shell lit les mêmes dossiers `.bob`).
- 2026-10-13 — **Skills globales** (demande de l'utilisateur) : chargées par les agents eux-mêmes.
  - Bob 2.0.6 : `~/.bob/skills` et `~/.agents/skills` annoncés (essai réel, skills d'essai créées puis
    supprimées) ; `~/.claude/skills` et `~/.bob/plugins/*/skills` d'après son code.
  - OpenCode 1.19 (`HOME` jetable) : `~/.agents/skills`, `~/.claude/skills`,
    `~/.config/opencode/skill(s)` et ses commandes globales ; il suit `XDG_CONFIG_HOME`.
  - Seul changement : l'app reprend `XDG_CONFIG_HOME` et `XDG_DATA_HOME` du shell de connexion
    (`shell-env.ts`, comme le PATH), quand elle ne les a pas déjà. Lancée depuis le Dock, elle les
    ignorait : OpenCode aurait cherché sa configuration globale, skills comprises, ailleurs qu'en
    terminal.
