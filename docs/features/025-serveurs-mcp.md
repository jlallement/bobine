# 025 — Serveurs MCP des agents (connecteurs)

- **Statut** : fait
- **Dépend de** : 027 (réglages)

## Pourquoi

Brancher ses propres serveurs MCP (recherche web, GitHub, base de données…) à Bob et à OpenCode
depuis les réglages, et les activer / désactiver sans éditer de fichier à la main, comme les
connecteurs de Claude Desktop.

## Critères d'acceptation

- [x] Réglages → « Serveurs MCP » : un onglet par agent (Bob, OpenCode) avec les serveurs déclarés
      dans ses fichiers, globaux et du dossier courant.
- [x] Ajouter (commande locale ou adresse web, variables / en-têtes, portée « tous les dossiers » ou
      « ce dossier »), modifier, supprimer, activer / désactiver, copier vers l'autre agent.
- [x] Écrit dans le format de chaque agent, sans perdre ses autres réglages ni les commentaires ; un
      fichier illisible n'est jamais réécrit.
- [x] Ce qui est configuré dans l'app vaut aussi dans `bob` / `opencode` en terminal, et inversement.
- [x] Essais : unitaires (formats), e2e (dossier personnel jetable), Bob et OpenCode réels.

## Notes

Relevé le 2026-10-13 (Bob 2.0.6, OpenCode 1.19, avec un serveur MCP d'essai) :

| | Bob | OpenCode |
|---|---|---|
| Fichier global | `~/.bob/settings/mcp.json` | `~/.config/opencode/opencode.json(c)` (`XDG_CONFIG_HOME`) |
| Fichier du projet | `<dossier>/.bob/mcp.json` | `opencode.json(c)`, du dossier jusqu'à la racine git |
| Format | `mcpServers.<nom>` : `command`, `args`, `env` ou `url`, `headers` ; `disabled` | `mcp.<nom>` : `type: local`, `command: [...]`, `environment` ou `type: remote`, `url`, `headers` ; `enabled` |
| Outil en ligne de commande | `bob mcp add/remove/list/enable/disable --scope` | `opencode mcp add/list` |
| En ACP : serveurs de ses fichiers | ✅ (désactivés ignorés) | ✅ (désactivés ignorés) |
| En ACP : serveurs passés par le client (`session/new`) | ✅ stdio et HTTP | ✅ stdio et HTTP |

Choix : les **fichiers des agents** restent la référence, l'app les modifie (pas de liste propre à
l'app, qui serait invisible dans `bob chat`, ferait doublon et devrait garder les secrets). Bob
demande l'autorisation à chaque appel d'outil MCP (« Toujours autoriser » vaut pour la tâche).

## Plan

1. `shared/mcp.ts` : forme commune d'un serveur, vérification de la saisie, lignes de commande.
2. `main/agent-config/mcp-files.ts` : formats Bob et OpenCode, lecture, ajout / remplacement /
   renommage / suppression / activation avec `jsonc-parser` (nouvelle dépendance, Microsoft, MIT).
3. `main/agent-config/mcp-settings.ts` : un format par profil (`AgentProfile.mcpConfig`) ; IPC
   `mcp:list`, `mcp:save`, `mcp:remove`, `mcp:setEnabled` (dossier = conversation affichée).
4. UI : section « Serveurs MCP » des réglages (`McpSettings.tsx`).
5. Essais : `BOB_DESKTOP_CONFIG_HOME` (dossier personnel des fichiers des agents) pointe toujours
   vers un dossier jetable dans les essais de bout en bout.

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-13 — Recherche (docs de Bob dans son paquet, doc d'OpenCode, essais ACP réels des quatre
  combinaisons, 0,085 bobcoin) puis réalisé selon le plan.
  - Les champs que l'app ne gère pas (`alwaysAllow`, `timeout`, `oauth`…) sont gardés ; changer la
    portée d'un serveur l'ajoute dans l'autre fichier puis le retire de l'ancien ; renommer refuse
    d'écraser un serveur existant ; suppression en deux clics. Les chemins sont affichés avec `~`.
  - Essais : unitaires (`mcp-files`, `mcp`), e2e `pnpm e2e mcp` (lecture, désactivation, ajout,
    copie vers OpenCode en gardant les commentaires, changement de portée, suppression).
  - Réel, de bout en bout avec le code de l'app (portée « ce dossier » dans `~/bob-essai/mcp-025`,
    fichiers globaux non touchés) : serveur écrit par l'app → appelé par Bob et par OpenCode ;
    désactivé par l'app → plus proposé (« Aucun outil »). 0,063 bobcoin.
  - App packagée : `jsonc-parser` bien embarqué, `pnpm e2e:packaged` vert.
  - Limites : les secrets (variables, en-têtes) restent en clair dans les fichiers des agents,
    comme à la main ; l'OAuth des serveurs distants se fait avec l'agent (`opencode mcp auth`) ; un
    changement vaut pour les nouvelles conversations (relancer une conversation ouverte).
- 2026-10-23 (écart, fiche 126) : la suppression en deux clics sur la corbeille est remplacée par
  une confirmation dans la ligne (« Supprimer · Garder »), même règle pour toutes les suppressions
  et révocations des Réglages.
- 2026-10-23 (écart, fiche 126) : retirer la dernière entrée retire aussi son conteneur vide, et
  supprime le fichier s'il ne contient plus rien d'autre.
