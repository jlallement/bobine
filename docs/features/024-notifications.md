# 024 — Notifications macOS

- **Statut** : fait
- **Dépend de** : 003

## Pourquoi

Être prévenu quand l'agent a fini ou attend une décision, sans garder la fenêtre sous les yeux.

## Critères d'acceptation

- [x] Notification système à la fin d'un tour et à chaque demande (autorisation, question, connexion), seulement si la fenêtre n'a pas le focus.
- [x] Clic sur la notification : ouvre la bonne conversation.
- [x] Badge sur l'icône du Dock = nombre de conversations en attente.
- [x] Réglage pour désactiver.
- [x] Pastilles dans la barre latérale (comme Claude Desktop) : demande en cours, réponse à lire, erreur.

## Plan

- `main/notifications/attention.ts` (`AttentionTracker`, logique pure et testée) : alimenté par les
  événements des conversations ; une conversation « attend » si elle a une demande en cours
  (autorisation, élicitation, session bloquée par la connexion ou le dossier à approuver), ou une
  réponse finie / en erreur pas encore vue. « Vue » = fenêtre au premier plan et conversation
  affichée. Notification seulement fenêtre sans focus ; pas pour un tour interrompu par l'utilisateur.
- Texte : « Agent · titre de la conversation », puis la demande, ou la fin de la réponse (160
  caractères, sans Markdown).
- `main/notifications/system-notifier.ts` : `Notification` d'Electron (gardées pour que le clic
  arrive, retirées quand la conversation est vue) et `app.dock.setBadge`.
- Clic : fenêtre ramenée, évènement `app:openConversation` → le renderer affiche la conversation.
- Réglage `notifications` dans `settings.json` (activé par défaut), bouton cloche au pied de la
  barre latérale. Coupé : ni notification ni badge ; les pastilles restent.
- IPC : `settings:setNotifications`, `attention:get`, évènements `attention:changed`,
  `app:openConversation`.

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-12 — Fait. Tests unitaires du suivi (fin de tour, demandes, connexion, erreur, vue,
  réglage, suppression, extrait). Suite e2e `notificationsSuite` : le main est lancé avec
  `--inspect` ; l'essai y déclare la fenêtre sans focus et intercepte `Notification.show` (rien ne
  s'affiche sur l'écran), puis vérifie demande d'autorisation et fin de réponse notifiées, badge,
  pastilles, clic qui ramène la conversation, effacement une fois vue, réglage coupé.
- 2026-10-12 — **Essai réel : aucune bannière.** macOS 27 refuse d'emblée les notifications de toute
  app signée « ad hoc » (`UNErrorDomain` 1, « Notifications are not allowed for this application »),
  sans demander l'autorisation : Electron en développement comme l'app packagée sans certificat.
  Vérifié avec un Electron nu et un identifiant de bundle neuf. Les essais e2e ne pouvaient pas le
  voir (notifications interceptées avant macOS). Le badge du Dock et les pastilles fonctionnent.
  Ajout : le refus (évènement `failed`) est signalé ; la cloche passe en alerte, son menu explique,
  ouvre les réglages de notifications de macOS ou coupe les notifications (`notifications:status`,
  `notifications:openSettings`). Étape ajoutée à la suite e2e.
- Pour avoir de vraies bannières : signer avec un certificat de développeur à soi (`CSC_NAME`,
  ADR-0008), par exemple celui d'une « Personal Team » gratuite d'Xcode — non vérifié, faute de
  certificat personnel. Les certificats déjà présents sur la machine de développement ne sont
  pas ceux du projet et ne doivent pas servir.
- Limites : en dev, les notifications porteraient le nom et l'icône d'« Electron ». Son par défaut
  de macOS ; pas de rebond de l'icône dans le Dock.
