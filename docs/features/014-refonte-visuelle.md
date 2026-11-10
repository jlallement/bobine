# 014 — Refonte visuelle dans l'esprit de Claude Desktop

- **Statut** : fait
- **Dépend de** : 003, 004, 006, 013

## Pourquoi

Retour de l'utilisateur : l'app fait « vieillotte » (boutons en texte, `<select>` natifs, barre d'état,
panneau latéral vide) et ne ressemble pas à Claude Desktop, qui est la référence visée depuis le début.

## Principes

- Reprendre l'**ergonomie et le langage visuel** de Claude Desktop actuel : barre latérale, accueil
  centré, grande zone de saisie arrondie, boutons-icônes, puces de sélection, palette chaude, texte de
  l'agent sans bulle, outils en lignes compactes.
- **Aucun élément de marque d'Anthropic** (logo, nom, typographies propriétaires) : l'app garde son nom
  et son identité.
- Pas de dépendance réseau : polices système, icônes embarquées.

## Critères d'acceptation

- [x] **Barre latérale** repliable : nouvelle conversation, conversation courante, dossiers récents
      (comme des « projets »), agent courant en bas.
- [x] **Accueil** : salutation centrée et zone de saisie au centre ; après le premier message, la zone de
      saisie se place en bas.
- [x] **Zone de saisie** : carte arrondie, bouton d'envoi rond (flèche) / Stop (carré), puce « agent »
      et puce « dossier » avec menus déroulants, bouton « réglages » ouvrant les réglages de session.
- [x] **Menus** accessibles au clavier (Radix), avec descriptions, coches et éléments indisponibles grisés.
- [x] **Fil** : message utilisateur en bulle, réponse de l'agent sans bulle ; réflexion repliable
      « Réflexion » ; outils en lignes compactes (icône par type, statut par icône, détails dépliables).
- [x] **Permission** : carte claire (« Autoriser cette action ? »), bouton principal + secondaires.
- [x] Plus de barre d'état ni de panneau latéral vide ; erreurs et statut de l'agent dans le fil / la
      zone de saisie.
- [x] Thème clair et sombre ; captures d'écran de vérification dans les deux.
- [x] Les essais de bout en bout existants (permissions, réglages, changement d'agent) passent toujours.

## Plan

- Dépendances : `lucide-react` (icônes), `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`,
  `@radix-ui/react-tooltip` ([ADR-0005](../adr/0005-radix-lucide-ui.md)).
- `styles.css` réécrit autour de jetons (couleurs, rayons, ombres) clair / sombre.
- Composants : `Sidebar`, `Welcome`, `Composer` (avec `AgentMenu`, `WorkspaceMenu`, `SessionSettings`),
  `Transcript` / `ToolCall` / `PermissionCard` / `Thought` restylés, `Menu` (enveloppe Radix commune).
- Les tests de bout en bout pilotés par CDP sont adaptés aux nouveaux sélecteurs (`data-testid`).

## Journal

- 2026-10-11 — Fiche créée à la demande de l'utilisateur ; la fiche 011 est mise en pause.
- 2026-10-11 — Implémenté. Barre latérale (nouvelle conversation, conversation courante, dossiers
  récents, agent et statut en bas), accueil centré (salutation en serif, saisie au centre), zone de saisie
  arrondie (puce dossier, puce mode, menu réglages avec sous-menus groupés, puce agent, bouton rond
  envoyer / stop), outils en lignes à icônes, carte d'autorisation, plan et réflexion restylés, thème
  clair / sombre à jetons. Plus de barre d'état ni de panneau latéral vide.
  - Nouvelle suite **`pnpm e2e`** (dans le dépôt, `e2e/run.mjs`) : app buildée + agent factice, dossier de
    données jetable, clair puis sombre, captures dans `e2e/captures/`. Couvre accueil, permission
    (autoriser / refuser / Stop), réglages via les menus confirmés par l'agent, menu des agents,
    nouvelle conversation. 2 passes complètes vertes.
  - Défaut de test corrigé en route : `ready()` pouvait passer avant le début du tour.
  - Le contenu `terminal` des outils Codex n'est plus affiché comme « Terminal exec-… » (reste à afficher
    la vraie sortie : à planifier).
- 2026-10-13 — Indicateur d'activité à la fin du fil pendant que l'agent travaille (on ne voyait
  pas qu'il préparait sa réponse) : étincelle animée, « Réfléchit… », « Écrit… », « <outil>… »,
  « Attend votre accord » / « Attend votre réponse », et le temps écoulé (`shared/activity.ts`,
  `WorkingIndicator`). Aussi dans la conversation d'à côté ; animations coupées si macOS demande
  de réduire les animations. e2e `base`.
- 2026-10-13 — **Tableaux comme dans Claude** (demande de l'utilisateur, après comparaison) : plus de
  grille ni de fond d'en-tête ; lignes de séparation horizontales, trait plus marqué sous l'en-tête,
  en-têtes à gauche sauf alignement Markdown, toute la largeur du fil ; un tableau trop large défile
  dans son cadre (`table-wrap`) au lieu de déborder du fil. Scénario factice `tableaux`, e2e `tables`.
