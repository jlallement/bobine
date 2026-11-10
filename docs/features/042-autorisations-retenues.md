# 042 — « Toujours autoriser » retenu d'une conversation à l'autre

- **Statut** : fait
- **Dépend de** : 006, 027

## Pourquoi

Bob demande une autorisation à chaque mise à jour de sa liste de tâches (« Updating todo list ») et
à chaque appel d'un outil MCP ; son « Always allow » ne vaut que pour la tâche en cours. Chaque
nouvelle conversation redemande. Claude Desktop ne demande rien pour sa liste de tâches.

## Critères d'acceptation

- [x] « Toujours autoriser » sur un outil qui ne touche ni aux fichiers ni aux commandes : retenu
      par l'app, pour cet agent ; les conversations suivantes l'accordent d'office.
- [x] Jamais pour une modification, une suppression, un déplacement, une commande, ni un titre qui
      contient un chemin (l'autorisation porterait sur un fichier précis).
- [x] La carte d'autorisation le dit ; Réglages → Agents et dossiers → « Outils toujours
      autorisés » : liste et révocation.
- [x] Testé : agent factice (scénario `liste-taches`, unitaires, e2e) ; Bob réel.

## Plan

- `shared/permissions.ts` : `rememberableTool` (règle commune au main et à la carte).
- `AgentHost` : option `rememberedTools` (consultée à chaque demande ; « allow_always » choisi →
  retenu) ; `PendingRequests.permissionChoice`.
- `ConversationManager` : `rememberedTools` dans `settings.json` par profil, `forgetTool`, vue des
  réglages ; IPC `settings:forgetTool`.
- UI : note sur la carte, liste dans les réglages.

## Journal

- 2026-10-13 — Fait. Accordé d'office avec l'option « toujours » de l'agent (Bob la garde alors
  aussi pour la tâche). Vérifié avec Bob 2.0.6 par le gestionnaire de conversations : première
  conversation, une seule demande (« Updating todo list », « Always allow ») ; seconde
  conversation, aucune demande et la liste de tâches arrive (0,17 bobcoin). e2e `pnpm e2e
  permissions` (note sur la carte, accordé d'office, liste dans les réglages, révocation).
