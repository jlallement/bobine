# ADR-0001 — Electron + TypeScript + React

- **Statut** : accepté
- **Date** : 2026-10-11

## Contexte

On veut une application de bureau très proche de Claude Desktop (lui-même basé sur Electron),
avec un navigateur intégré pilotable par l'agent et un écosystème UI riche (Markdown en streaming,
diffs, coloration syntaxique).

## Décision

Electron, TypeScript en mode strict, React pour le renderer, pnpm comme gestionnaire de paquets.

## Alternatives écartées

- **Tauri 2** — binaire plus léger, SDK ACP Rust disponible, mais webview système variable selon
  l'OS et pas d'équivalent aussi direct à `WebContentsView` + `webContents.debugger` (CDP) pour le
  navigateur intégré.
- **Flutter desktop** — pas de SDK ACP officiel, et le navigateur intégré pilotable est plus difficile.

## Conséquences

- SDK ACP TypeScript officiel utilisable directement dans le main process.
- Empreinte mémoire plus élevée qu'une app native : acceptable.
- Exigence de sécurité Electron stricte (voir règles dans `AGENTS.md`).
