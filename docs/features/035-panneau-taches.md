# 035 — Panneau « Tâches » (plan de l'agent)

- **Statut** : fait
- **Dépend de** : 029

## Pourquoi

Suivre d'un coup d'œil la liste de tâches de l'agent et sa progression, sans remonter le fil.

## Critères d'acceptation

- [x] Dernier plan ACP (`plan`) dans un onglet du panneau latéral : fait / en cours / à faire.
- [x] Indicateur de progression dans l'en-tête de la conversation.
- [x] Testé : agent factice ; e2e.
- [x] Bob envoie bien des `plan` : à chaque mise à jour de sa liste de tâches (Bob réel 2026-10-13,
      fiche 041 ; voir `docs/acp.md`, « Liste de tâches »).

## Plan

Livré avec la fiche 029 (`SidePanel`, `PlanList`).

## Journal

- 2026-10-11 — Fiche créée (inventaire calqué sur Claude Code Desktop, à trier).
- 2026-10-11 — Livré avec le panneau de la fiche 029 : onglet « Tâches » (dernier plan, progression),
  bouton « 2 / 5 » dans l'en-tête quand un plan existe et que le panneau est fermé.
- 2026-10-13 — Vérifié avec Bob 2.0.6 (fiche 041) : il envoie un `plan` à chaque mise à jour de sa
  liste de tâches (statuts `pending` / `in_progress` / `completed`). Chaque mise à jour demande une
  autorisation (« Updating todo list », `kind: other`) : « Toujours autoriser » évite les suivantes
  pour la session.
- 2026-10-17 — Pendant le tour, la liste est épinglée au-dessus de la zone de saisie (fiche 077) :
  le compteur de l'en-tête est alors masqué ; tâches faites grisées, plus barrées.
