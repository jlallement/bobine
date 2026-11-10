# ADR-0003 — Panneaux visuels exposés via un serveur MCP hébergé par l'app

- **Statut** : accepté
- **Date** : 2026-10-11

## Contexte

On veut que l'agent pilote un navigateur et un simulateur, **avec retour graphique en direct dans
l'app** (comme le panneau Browser de Claude Desktop). Des serveurs MCP externes (Playwright MCP…)
piloteraient un navigateur invisible pour l'utilisateur.

## Décision

L'app possède l'affichage (`WebContentsView` pour le navigateur, helper natif pour le simulateur)
et expose les commandes à l'agent via **son propre serveur MCP**, hébergé dans le main process et
passé à l'agent dans `session/new`.

## Alternatives écartées

- **Playwright MCP + `--cdp-endpoint` sur Electron** — rapide à prototyper, mais l'agent verrait
  aussi les fenêtres de l'UI de l'app. Acceptable pour un prototype, pas pour le produit.
- **MCP externes sans retour visuel** — ne répond pas au besoin.

## Conséquences

- Le périmètre de l'agent est limité à la vue qu'on lui expose (sécurité).
- L'utilisateur peut reprendre la main dans la même vue.
- Il faudra choisir le transport MCP (HTTP localhost vs stdio relayé) — point ouvert.
