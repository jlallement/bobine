# 020 — Écrire pendant que l'agent travaille

- **Statut** : fait
- **Dépend de** : 003

## Pourquoi

Dans Claude Code, on peut taper le message suivant pendant que l'agent répond : il part à la fin du
tour, ou interrompt pour réorienter.

## Critères d'acceptation

- [x] Zone de saisie active pendant une réponse ; message mis en file, visible, modifiable, annulable.
- [x] Envoi automatique à la fin du tour ; « Envoyer maintenant » = annuler le tour puis envoyer.
- [x] Testé : agent factice lent ; e2e.

## Notes

ACP n'a qu'un prompt à la fois par session : la file est côté client.

## Plan

- File dans `AgentHost` (main), pas dans le renderer : elle survit au changement de conversation et
  part même si la conversation n'est pas affichée. Instantané : `queued` (texte + noms des pièces
  jointes, sans leur contenu).
- `send` (prêt → prompt, occupé → file), `unqueue` (rend le message), `sendNow` (annule le tour, la
  file part ensuite, ce message en premier). IPC `agent:unqueue`, `agent:sendNow`.
- Fin de tour normale : la file part **en un seul message** (textes séparés par une ligne vide, pièces
  jointes cumulées dans la limite de 10, le reste au tour suivant), comme Claude Code. Après Stop ou
  erreur : la file attend que l'utilisateur la renvoie.
- UI : `QueuedMessages` au-dessus de la saisie (Envoyer maintenant, Modifier, Retirer) ; ↑ dans une
  zone vide reprend le dernier message ; Échap arrête la réponse ; bouton Stop + bouton Envoyer quand
  on a écrit quelque chose pendant la réponse.

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-11 — Implémenté comme prévu. Tests hôte : envoi groupé en fin de tour, file conservée après
  Stop, « Envoyer maintenant » qui interrompt, `unqueue`. e2e `queueSuite` (clair / sombre) :
  captures `21-file-attente`, `22-file-apres-arret`.
  - Limite : « Relancer » après un plantage de l'agent recrée l'hôte, la file est alors perdue.
    **Levée par la fiche 043** : la file passe au nouvel hôte et repart à la demande.
