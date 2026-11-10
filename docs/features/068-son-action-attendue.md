# 068 — Son quand un agent attend une action

- **Statut** : fait
- **Dépend de** : 024
- **Agents** : les deux (demandes et blocages, génériques)

## Pourquoi

Demande de l'utilisateur (2026-10-15) : quand l'app est en arrière-plan, une demande de l'agent
(autorisation, question, connexion) passe inaperçue, d'autant que les bannières de macOS sont
bloquées pour une app non signée. Un petit son suffit, mais seulement quand la fenêtre n'est pas
au premier plan.

## Critères d'acceptation

- [x] Un son quand une conversation se met à attendre une action (autorisation, question,
      connexion, dossier à approuver), seulement si la fenêtre principale n'a pas le focus ; pas de
      son pour une réponse finie ou une erreur.
- [x] Un son à la fois : des demandes rapprochées (moins de 2 s) n'en font qu'un.
- [x] Indépendant des notifications (qui peuvent être bloquées par macOS ou désactivées) :
      Réglages › Général › « Son quand un agent attend » : désactivé, ou un son du système
      (Glass par défaut), avec un bouton pour l'écouter.
- [x] Testé : unitaire (son seulement pour une demande, sans focus ; espacement) ; e2e
      (notifications : son noté à la demande, pas à la fin de la réponse).

## Plan

1. `shared/preferences.ts` : `attentionSound` (`off` ou un son de `/System/Library/Sounds`).
2. `main/notifications/attention.ts` : `chime` appelé pour une demande, sans focus.
3. `main/notifications/chime.ts` : sons espacés, joués par `afplay` (remplaçable : `BOB_SOUND_LOG`
   pour les essais).
4. IPC `sound:preview` ; Réglages › Général ; index de recherche.

Pas de nouvelle dépendance (`afplay` de macOS).

## Journal

- 2026-10-15 — Fait selon le plan. `AttentionTracker.alert` : sans focus, une demande (`request`)
  appelle `chime` avant le réglage des notifications (le son a le sien) ; `chime.ts` : `afplay` sur
  `/System/Library/Sounds/<son>.aiff`, deux sons espacés d'au moins 2 s. Le focus est celui de la
  fenêtre principale (la fenêtre rapide au premier plan compte comme « en arrière-plan »).
  Réglages › Général : choix parmi quatorze sons du système ou « Aucun », bouton « Écouter »
  (IPC `sound:preview`, son vérifié dans la liste). Tests : unitaires (son pour une demande, pas
  pour une réponse finie ni fenêtre au premier plan, même notifications désactivées ;
  espacement) ; e2e `notifications` (journal `BOB_SOUND_LOG` : « Glass » à la demande, rien de
  plus à la fin). Capture du réglage regardée.
