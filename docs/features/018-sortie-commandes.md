# 018 — Sortie des commandes (terminal)

- **Statut** : fait
- **Dépend de** : 006

## Pourquoi

On voit `ls -la` mais pas son résultat. Codex envoie la sortie en contenu `terminal` ; d'autres
agents demandent au client d'exécuter les commandes (`terminal/create`).

## Critères d'acceptation

- [x] Sortie des commandes affichée sous l'appel d'outil, comme un terminal : couleurs ANSI, code de
      sortie (rouge si échec), sortie longue tronquée au début (200 000 caractères gardés).
- [x] Bob et OpenCode (sortie en contenu texte d'un outil `execute`) : même affichage.
- [x] Extension d'affichage de terminal (`_meta.terminal_output_delta`, `terminal_exit`, contenu
      `terminal`), annoncée par `clientCapabilities._meta` : sortie reçue en direct, par morceaux.
- [ ] Capacité client `terminal` (`terminal/create`…) : **non annoncée** — aucun des agents essayés ne
      s'en sert (Bob, OpenCode et Codex exécutent eux-mêmes). À reconsidérer si Bob l'utilise un jour.
- [x] Testé : agent factice (scénarios `commande`, `commande-echec`) ; e2e ; Bob réel.

## Notes

Annoncer `terminal: true` change le comportement de certains agents : à vérifier agent par agent.

## Plan

- `src/shared/terminal-output.ts` — lecture de l'extension de terminal (seul endroit qui lit ces
  `_meta`), état d'un terminal (ajout, remplacement, fin, troncature), découpage ANSI.
- `transcript.ts` — `terminals` dans l'état du fil, `terminalId` sur l'appel d'outil.
- `TerminalView` — sortie colorée + code de sortie ; utilisée aussi pour le texte des outils `execute`.

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-11 — Relevés réels : **Bob** exécute lui-même et envoie la sortie en contenu texte (déjà
  affichée, maintenant comme un terminal) ; **OpenCode** pareil ; Codex utilise l'extension `_meta`
  (même sans la capacité `terminal`) — Codex n'est plus proposé par l'app, l'extension reste générique.
  Implémenté ; 201 tests ; `pnpm e2e` (sortie par morceaux, couleurs, code 0 / 2). **Bob réel** :
  `ls -la` autorisé puis sortie affichée en terminal (0,042 bobcoin).
