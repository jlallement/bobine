# 013 — Modes et options de session (approbation, modèle…)

- **Statut** : fait
- **Dépend de** : 004, 006

## Pourquoi

Les agents exposent des **modes** et des **options de configuration** de session via ACP. Codex, par
exemple, propose `read-only`, `workspace-write`, `agent` (« Auto review », par défaut) et
`agent-full-access`, ainsi que le choix du modèle et un mode « Plan ». En mode par défaut, Codex
s'auto-approuve (relecture automatique « Guardian Review ») : l'utilisateur ne voit jamais de demande de
permission. Il doit pouvoir choisir ce niveau d'autonomie, et le modèle, depuis l'app.

## Critères d'acceptation

- [x] Les modes (`modes` de `session/new`) et les options (`configOptions`, type `select`) de l'agent
      s'affichent dans la barre d'outils ; changement via `session/set_mode` / `session/set_config_option`.
- [x] Les notifications `current_mode_update` / `config_option_update` mettent l'UI à jour.
- [x] Le dernier choix de mode par profil est mémorisé et réappliqué à la session suivante.
- [x] L'agent factice expose des modes et options pour les tests.
- [x] Remplace le mode imposé par profil (`defaultModeId`, Codex en `workspace-write` depuis la
      fiche 006) par le choix de l'utilisateur, ce mode restant la valeur par défaut de Codex.

## Plan

**Modèle commun** : un « contrôle de session » (`SessionControl`) = une option de configuration ACP
(`select` ou `boolean`, groupes d'options aplatis) ou, à défaut, les modes ACP (contrôle `mode`).
Les modes sont masqués quand une option de catégorie `mode` existe (Codex expose les deux).
Les contrôles voyagent dans l'`AgentSnapshot` ; tout changement réémet un statut.

**Main** :
- `src/main/agent/session-controls.ts` — fonctions pures : construire les contrôles à partir de
  `modes` / `configOptions`, valider une valeur.
- `AgentHost` — suit `modes` / `configOptions` (réponse de `session/new`, de `set_config_option`,
  notifications `current_mode_update` / `config_option_update`) ; `setControl(id, value)` ;
  à l'ouverture, applique les valeurs initiales (préférences de l'utilisateur, sinon défauts du profil),
  avec un avis si une valeur n'est pas applicable.
- `profiles.ts` — `defaultModeId` devient `defaultControls` (Codex : `{ mode: 'workspace-write' }`).
- `settings.ts` / `AgentManager` — préférences mémorisées par profil et par contrôle.
- IPC `agent:setControl`.

**Agent factice** : options `model` (select groupé) et `verbose` (booléen), `session/set_config_option` ;
le scénario `echo` affiche mode et modèle courants (vérifier que l'agent a bien appliqué le choix).

**Renderer** : un sélecteur par contrôle dans la barre d'outils (case à cocher pour un booléen),
désactivés pendant une réponse.

## Journal

- 2026-10-11 — En attendant cette fiche, Codex est ouvert en `workspace-write` (fiche 006).
- 2026-10-11 — Fiche créée lors de la clôture de la 006, après l'essai réel de Codex.
- 2026-10-11 — Implémenté. 116 tests (construction et validation des contrôles, `AgentHost` contre
  l'agent factice : modes, options select / booléennes, réglages initiaux, refus des valeurs invalides,
  agent sans options ; préférences par profil ; IPC ; preload).
  - Essai dans l'app (données isolées) : agent factice — mode, modèle et booléen changés depuis la barre,
    l'agent confirme ce qu'il a appliqué ; réglages repris après relancement.
  - **Essai réel Codex depuis l'UI** : 5 réglages affichés (Mode, Collaboration mode, Model, Reasoning
    effort, Fast mode), « Workspace access » appliqué par défaut ; passage en Read-only depuis la barre
    → demande d'autorisation pour créer `hello.txt` **dans** le dossier → autorisée → fichier créé.
    (C'est le critère reporté de la fiche 006.)
  - `defaultModeId` (fiche 006) remplacé par `defaultControls` ; Codex : `{ mode: 'workspace-write' }`.
  - **Compatibilité Bob** (demande de l'utilisateur) : la doc de Bob ne donne pas ses identifiants de mode ;
    l'app gère donc les deux mécanismes ACP sans rien supposer, et l'agent factice simule un agent à modes
    seuls (`--sans-options`). Matrice complète dans `docs/acp.md`.
