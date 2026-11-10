# ADR-0006 — Navigateur intégré piloté par le protocole DevTools, sans Playwright

- **Statut** : accepté
- **Date** : 2026-10-11

## Contexte

L'agent pilote le navigateur intégré (fiches 007, 031) : clics, saisie, captures, console, réseau,
émulation mobile / sombre, onglets. La page est une `WebContentsView` de l'app, affichée dans le
panneau, que l'utilisateur voit et peut reprendre en main (ADR-0003). Question : écrire ce pilotage
ou s'appuyer sur Playwright ?

## Décision

Piloter chaque onglet **directement par le protocole DevTools de Chromium (CDP)**, qu'Electron
expose page par page (`webContents.debugger`) — le protocole sur lequel Playwright est lui-même
construit. Une fine couche (`main/browser/cdp-tab.ts`, ~400 lignes) traduit les outils de l'agent en
commandes CDP. Ce que Chromium sait faire, on le lui demande (entrées, captures, émulation, console,
réseau, évaluation) plutôt que de le réécrire.

## Alternatives écartées

- **Playwright `connectOverCDP`** — il lui faut le point d'accès DevTools du **navigateur entier**,
  donc lancer l'app avec `--remote-debugging-port` : tout programme local pourrait alors piloter
  aussi la fenêtre de l'app (envoyer des messages à l'agent, accepter des autorisations). Exclu par
  ADR-0003. Playwright ne sait pas se brancher sur le débogueur d'une seule page.
- **Playwright avec son propre Chromium (ou Playwright MCP)** — rapide et éprouvé, mais la page vit
  dans une autre fenêtre ou sans affichage : plus de vue en direct dans le panneau ni de reprise en
  main, ce qui est le but de la fiche 007. Reste une option pour des tests sans affichage.
- **Entrées Electron (`sendInputEvent`, `insertText`)** — première version de la fiche 007 : clavier
  et molette ignorés si la page n'a pas le focus, d'où un passage de focus qui gênait la saisie de
  l'utilisateur. Le CDP n'a pas ce défaut (relevé sur Electron 44).

## Conséquences

- Performances : un appel CDP par action, sans processus ni couche intermédiaire ; même moteur que
  Playwright.
- Ce que Playwright apporte et qu'on n'a pas : attente automatique qu'un élément soit cliquable,
  sélecteurs, cadres (iframes) détaillés, traces. Pour un agent qui lit la page puis clique sur une
  référence, l'essentiel est couvert ; à ajouter au besoin, toujours par le CDP.
- La lecture de la page passe par l'arbre d'accessibilité de Chromium
  (`Accessibility.getFullAXTree`, `ax-tree.ts`) : rôles et noms calculés par le navigateur, comme
  un lecteur d'écran ; les références `ref_N` désignent des nœuds DOM de Chromium (clic par
  `DOM.getContentQuads`, saisie par `Runtime.callFunctionOn`).
- Les tests de non-régression d'un projet restent l'affaire de Playwright **dans le projet** :
  l'agent peut les écrire et les lancer, c'est là que Playwright excelle.
