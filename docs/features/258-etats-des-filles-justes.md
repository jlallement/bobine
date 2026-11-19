# 258 — États des filles justes

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 097, 119, 120, 160, 161, 223
- **Agents** : les deux — l'arrêt d'un tour est `stopReason: "cancelled"` d'ACP, rien de propre à
  un agent

## Pourquoi

Recette exploratoire du 2026-11-19 avec OpenCode (`docs/recettes/2026-11-19-exploration-opencode-sol.md`) :
les filles disent des choses fausses. Une fille arrêtée par ■ s'affiche « a fini » avec une coche
verte (D4, reproduit 2 fois) ; une fille fusionnée reste « Recommandée » / « À revoir » dans
Modifications › Filles (D11) ; la pastille « compte rendu à lire » ne suit pas de règle claire
(D35) ; l'outil de la mère cite la fille par son identifiant (D18).

## Critères d'acceptation

- [x] D4 : une fille dont le dernier tour a été arrêté (`stopReason: "cancelled"`) est « Arrêtée »
  partout : barre latérale, ligne de « Sous-tâches » (et son compte « N arrêtées »), carte du rôle
  (« a été arrêté »), Modifications › Filles. Plus de coche verte ni de « a fini ».
- [x] D4 : l'état survit au redémarrage de l'app (porté par l'enregistrement de la conversation) et
  disparaît au tour suivant.
- [x] D4 : une conversation ordinaire arrêtée ne prend aucune icône dans la barre latérale (rien ne
  change pour elle).
- [x] D11 : Modifications › Filles montre « Fusionnée » (et l'état de la fusion en cours) comme la
  carte « Sous-tâches », calculé par la même fonction ; la recommandation s'efface alors, comme sur
  la carte.
- [x] D35 : règle écrite et appliquée (voir « Règle du compte rendu à lire »).
- [x] D18 : `recommend_merge`, `message_child` et `child_status` citent la fille par son titre.
- [x] Testé contre l'agent factice (scénario `attend-stop` : fille arrêtée, compte rendu « arrêtée »,
  état gardé au redémarrage, effacé au tour suivant).

## Règle du compte rendu à lire (D35)

Une fille a un **compte rendu à lire** (⊙, « Compte rendu à lire », « Finie, à lire », « a rendu
son compte rendu ») tant que l'**utilisateur** n'a vu ni la fille depuis la fin de son tour, ni le
fil de sa mère après l'arrivée de ce compte rendu. Voir, c'est la conversation affichée dans la
fenêtre qui a le focus, comme pour toute réponse finie (fiche 024).

Conséquences :
- la mère affichée quand le compte rendu y arrive : il est lu tout de suite ;
- la mère ouverte plus tard : tous les comptes rendus déjà posés dans son fil sont lus ;
- un compte rendu retenu pendant que la mère répond (posé à la fin de sa réponse) n'est lu qu'une
  fois posé ;
- que l'**agent** de la mère ait repris le compte rendu ne compte pas : c'est l'utilisateur qui lit.
  S'il n'a rien regardé, la mère réveillée a sa propre pastille « Réponse à lire ».

## Plan

1. **État « arrêtée »** (D4)
   - `ConversationRecord.turnStopped?: true` (store, vérifié à la lecture) et
     `ConversationSummary.turnStopped?: true` : posé par la fin d'un tour `cancelled`, retiré au
     message suivant (`user-message`), à une fin de tour ordinaire ou à une erreur
     (`noteTurnStopped` dans `conversations/helpers.ts`, appelé par `manager.onEvent`).
   - `ChildState` gagne `'stopped'` ; `childState` le rend après « attend » / « au travail » /
     erreur de l'agent, avant « à lire » : c'est le dernier évènement.
   - Textes `children.state.stopped`, `children.card.stopped_*`, `roleWork.state.stopped`
     (fr, en) ; texte de `child_status` pour l'agent.
   - Rendu : `ConversationStateIcon` → `CircleStop` gris (`--muted`), l'icône et la couleur déjà
     utilisées par le compte rendu « a été arrêtée » ; avatar de rôle → pastille d'échec ou
     d'arrêt (rouge), comme le compte rendu d'un rôle arrêté (maquette 03-5) ; carte
     « Sous-tâches » : compte « N arrêtées » à part de « N terminées ».
   - `conversation-state.ts` : une conversation ordinaire arrêtée reste sans icône.
2. **« Fusionnée » dans Modifications › Filles** (D11) : `ChildrenView` prend l'état de fusion par
   `useChildrenMerge` + `rowMergeState` (les fonctions de la carte) ; un composant
   `RowMergeOrVerdict` partagé montre la pastille de fusion, sinon la recommandation, sur les deux
   vues. `App` passe la mère, son fil et les actions de fusion à la vue.
3. **Compte rendu lu** (D35) : `AttentionTracker` suit les évènements `child-report` posés chez
   une mère : mère affichée → la fille est vue ; sinon retenue, et vue quand la mère s'affiche
   (`refresh`). Un nouveau tour de la fille l'oublie.
4. **Titre de la fille dans les outils** (D18) : `AppTool.labelContext` (optionnel) donne au
   libellé le titre de la fille désignée ; `appToolLabel(name, args, context)` ; `children-tools`
   le fournit pour `message_child`, `child_status`, `recommend_merge`. Nouvelles clés
   `appTools.message_child.to`, `appTools.child_status.one`.
5. Tests : `children.test.ts` (états), `attention.test.ts` (règle D35), `children-tools.test.ts`
   et `app-tools.test.ts` (libellés), composants (`Subtasks`, `ChildrenView`, `RoleWork`,
   `conversation-state`), essai contre l'agent factice (`children-stopped.test.ts`).

Aucune nouvelle dépendance.

## Journal

- 2026-11-19 : fiche et plan.
- 2026-11-19 : fait selon le plan.
  - **D4, cause** : `ChildState` n'avait pas d'état « arrêtée » ; rien ne retenait qu'un tour avait
    fini `cancelled` (seul le compte rendu chez la mère le disait). Une fille arrêtée revenait
    `ready` sans attente et `childState` rendait `done` : « Finie », « a fini », coche verte, compte
    « N terminées ». Corrigé par `turnStopped` (enregistrement, résumé) et l'état `stopped`.
    Visuel : `CircleStop` gris (`--muted`), celui du compte rendu « a été arrêtée » ; avatar d'un rôle
    à la pastille d'échec ou d'arrêt, comme son compte rendu ; « N arrêtées » à part sur la carte.
  - **D11, cause** : la vue Filles ne lisait que la recommandation (`childRows`) ; l'état de fusion
    (`useChildrenMerge` : dernière fusion du fil + branches lues par le main) n'était calculé que
    par la carte. La vue appelle maintenant le même hook et la même fonction (`rowMergeState`), et
    les deux vues montrent la même pastille (`MergeOrVerdict`).
  - **D35, cause** : « à lire » ne tombait qu'en ouvrant la fille elle-même ; voir son compte rendu
    chez la mère ne comptait pas. Règle écrite ci-dessus, appliquée dans `AttentionTracker`
    (évènements `child-report` du fil de la mère). Une **erreur** de la fille n'est pas effacée par
    son compte rendu : elle resterait sinon « Finie » (même défaut que D4).
  - **D18, cause** : `appToolLabel` n'a que les arguments ; `recommend_merge` citait `child` tel
    quel (souvent l'identifiant) et `message_child` / `child_status` ne citaient pas la fille.
    `AppTool.labelContext` (optionnel, appelé par le pont, une erreur ne coûte que le supplément).
  - Écarts : aucun changement de fusion pour une fille arrêtée (elle reste proposée à la fusion si
    elle a des commits, comme avant) ; « Nettoyer » n'est pas ajouté à Modifications › Filles
    (seulement la pastille, nettoyée comprise) ; aucun scénario d'agent factice ajouté :
    `attend-stop` suffit (seule l'annulation finit le tour).
  - Tests : `children.test.ts`, `helpers.test.ts`, `store.test.ts`, `attention.test.ts`,
    `app-tools.test.ts`, `children-tools.test.ts`, `app-tools-bridge.test.ts`, composants
    (`Subtasks`, `ChildrenView`, `RoleWork`, `Sidebar`), et `children-stopped.test.ts` contre
    l'agent factice (arrêt, compte rendu « arrêtée », redémarrage, tour suivant).
  - Suites e2e à lancer (pas lancées ici) : `filles`, `filles-tech-lead`, `filles-fusion`,
    `filles-visibilite`, `roles-travail`, `changes`, `inbox`, `notifications`.
