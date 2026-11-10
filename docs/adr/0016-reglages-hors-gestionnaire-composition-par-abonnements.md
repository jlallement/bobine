# ADR-0016 — Réglages hors du gestionnaire de conversations, démarrage du main par abonnements

- **Statut** : accepté
- **Date** : 2026-10-20

## Contexte

`ConversationManager` (`main/conversations/manager.ts`) tient à la fois les conversations et les
réglages de l'app : préférences, défauts d'une nouvelle conversation, commandes personnelles,
clés d'API, outils toujours autorisés, dossiers récents, annonces des agents. Une quinzaine de ses
83 méthodes ne servent qu'aux réglages, et l'interface `ConversationController` de `main/ipc.ts`
en expose neuf.

Comme les réglages vivent dans le gestionnaire, tout ce qui en a besoin au démarrage
(`start()` de `main/index.ts`) doit atteindre le gestionnaire, créé après : navigateur (cookies),
autorisations retenues, veille. Le gestionnaire envoie aussi ses évènements par des fonctions
uniques passées à sa construction (`emit`, `emitList`, `onSettingsChanged`) ; le suivi de
l'attention, qui a lui-même besoin du gestionnaire, ne peut être créé qu'après. `start()`
contourne ces cycles par trois références posées après coup : `manager.current`,
`tracker.current` et `menu.refresh`. L'audit qualité du 2026-10-20 et la fiche 089 proposent de
découper ces fichiers ; l'utilisateur a retenu les options 1 B et 3 B de la fiche.

## Décision

1. **Les réglages sortent du gestionnaire** dans un `SettingsStore` (main process) : il tient les
   réglages, les fait écrire par le même `HistoryWriter` que l'historique (un seul écrivain), et
   prévient ses abonnés quand ils changent. Le gestionnaire le reçoit en dépendance et ne garde
   que ce qui assemble conversation active et réglages (`settingsView`). Les canaux IPC de
   réglage passent par un `SettingsController` à part.
2. **Le démarrage du main n'a plus de références posées après coup.** `start()` crée d'abord
   `SettingsStore`, puis ce qui le lit ; chaque effet d'un changement de réglage (thème, langue et
   menu, raccourci de la fenêtre rapide, cookies, veille, attention) s'abonne lui-même. Le
   gestionnaire de conversations accepte des abonnés à ses évènements et à sa liste ; le menu
   macOS est un objet créé avant ses abonnés.

## Alternatives écartées

- **Garder les réglages dans le gestionnaire et seulement découper `start()` en fonctions** (3 A) :
  plus court, mais les cycles et les références tardives restent.
- **Un registre de conversations partagé par plusieurs services, sans façade** (1 C) : diff bien
  plus gros, tests du gestionnaire à réécrire, et le registre que tout le monde touche deviendrait
  le prochain objet-dieu.
- **Un conteneur d'injection (awilix, tsyringe…)** (3 C) : nouvelle dépendance structurante pour
  une seule racine de composition.

## Conséquences

- Un nouveau réglage s'ajoute dans `SettingsStore` et son contrôleur, plus dans le gestionnaire.
  Un nouvel effet d'un réglage s'abonne au lieu de s'ajouter à un `onSettingsChanged` central.
- L'ordre de création dans `start()` compte : un abonné posé après un évènement le manque. Ce qui
  est émis pendant la construction du gestionnaire doit être vérifié avant de passer aux
  abonnements (fiche 089, cible 3).
- Les réglages restent écrits par le `HistoryWriter` : l'ordre et la sûreté des écritures de la
  fiche 041 ne changent pas.
- `index.ts` n'a pas de tests unitaires (il importe Electron) : ce changement se vérifie par la
  suite e2e complète, l'app packagée et un essai réel.
