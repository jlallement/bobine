# 003 — Client ACP + fil de conversation en streaming

- **Statut** : fait
- **Dépend de** : 001, 002

## Pourquoi

Le cœur de l'app : envoyer un message à un agent ACP et voir sa réponse arriver en direct.

## Critères d'acceptation

- [x] `AgentHost` (main) lance l'agent d'un profil, fait `initialize` puis `session/new`.
- [x] Envoi d'un prompt texte depuis l'UI ; affichage du texte en streaming (Markdown + code coloré).
- [x] Affichage des appels d'outil (nom, statut, sortie repliable).
- [x] Bouton « Stop » (annulation de la requête en cours).
- [x] Gestion propre de la mort du processus agent (message d'erreur, relance possible).
- [x] Testé contre l'agent factice (scénarios streaming-texte, appel-outil, erreur).
- [x] Essai manuel avec un vrai agent via son adaptateur ACP (Codex, à la demande de l'utilisateur ; Claude Code reste à essayer), résultat noté dans le journal.

## Plan

**Main** (`src/main/agent/`, sans import d'`electron` pour rester testable sous Vitest) :
- `profiles.ts` — profil d'agent `{ id, label, command, args, env }`. Pour cette fiche : `mock`
  (Electron en mode Node + `src/mock-agent/main.mts`, dev uniquement) et `claude`
  (`npx -y @agentclientprotocol/claude-agent-acp`). Sélection dans l'UI : fiche 004 ; ici, variable
  `BOB_AGENT_PROFILE` (défaut `mock`).
- `agent-host.ts` — `AgentHost` : lance le processus, `ClientApp.connect()` (connexion longue durée),
  `initialize` + `session/new`, `prompt`, `cancel`, `restart`, `dispose`. Émet des `AgentEvent`.
  Permissions → réponse `cancelled` + avis dans le fil (vraie UI : fiche 006). Élicitation → `decline`.
- Workspace (`cwd` de session) : `BOB_WORKSPACE`, sinon un dossier dédié dans `userData`.

**Partagé** :
- `src/shared/agent.ts` — types `AgentEvent`, `AgentStatus`.
- `src/shared/transcript.ts` — réducteur pur : événements → éléments du fil (message utilisateur,
  message agent, réflexion, appel d'outil fusionné avec ses mises à jour, plan, avis, erreur).
- IPC : `agent:start`, `agent:prompt`, `agent:cancel` (invoke) + canal d'événements `agent:event`
  (main → renderer), exposé par `window.api.agent.onEvent()`.

**Renderer** : hook `useAgent`, composants `Transcript`, `AgentMessage` (Markdown), `ToolCall`,
`Thought`, `Plan`, `Composer` (Entrée = envoyer, Maj+Entrée = retour ligne, bouton Stop).

**Nouvelles dépendances** : `react-markdown`, `remark-gfm`, `rehype-highlight` (+ thème highlight.js).

**Tests** : réducteur (unitaires) ; `AgentHost` contre l'agent factice (streaming, outil, annulation,
erreur, mort du processus, relance).

## Journal

- 2026-10-11 — Fiche créée.
- 2026-10-11 — Implémenté, sauf l'essai manuel avec Claude Code (en attente de l'accord de
  l'utilisateur : il consomme son quota Claude et télécharge l'adaptateur via npx).
  - 62 tests : réducteur du fil, IPC, preload, et `AgentHost` contre l'agent factice (streaming, outil,
    permission, erreur, annulation, crash + relance, agent introuvable, session refusée).
  - Essai de bout en bout dans l'app buildée, piloté via CDP : Markdown (tableau, coloration),
    outil fusionné, plan, réflexion, avis de permission, Stop, crash (`kill -9`) puis « Relancer ».
  - Ajouts : statut d'outil `cancelled` (affiché « annulé ») pour les outils inachevés en fin de tour ;
    les updates des sessions enfants sont ignorées (fiche 010) ; permissions refusées automatiquement
    avec un avis (fiche 006) ; élicitations déclinées (fiche 011).
  - L'adaptateur Claude s'appelle désormais `@agentclientprotocol/claude-agent-acp`.
  - À prévoir (fiche 004) : une app lancée depuis le Finder n'a pas le `PATH` du shell → `npx`
    introuvable. Il faudra résoudre le `PATH` du shell de connexion.
- 2026-10-11 — Essai réel avec **Codex** (profil `codex`, `@agentclientprotocol/codex-acp` 2.2.2,
  codex-cli 0.142.3, connexion existante de `~/.codex`) dans l'app buildée, workspace jetable :
  - démarrage et session OK sans étape d'authentification ;
  - « qui es-tu ? » → réponse en streaming ;
  - « que contient README.md ? » → appel d'outil `read` affiché puis « terminé », contenu restitué
    correctement en bloc de code. Aucune demande de permission pour une lecture.
  - Le message `sandbox_extension_issue_file … Operation not permitted` apparaît aussi, sans effet :
    il vient du binaire Electron de développement non signé.
- 2026-10-23, écart (fiche 127, D26) : un message envoyé fil remonté restait hors de vue (le
  suivi du bas n'était repris que par la flèche ↓) ; tout envoi ramène désormais le fil en bas.
