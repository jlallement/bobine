# 026 — Historique : recherche, dossiers, brouillons

- **Statut** : fait
- **Dépend de** : 015

## Pourquoi

L'historique grossit : il faut retrouver une conversation, les ranger par projet et ne pas perdre un
message en cours de saisie.

## Critères d'acceptation

- [x] Recherche dans les titres et le contenu des conversations.
- [x] Regroupement par dossier de travail (projets), épinglage.
- [x] Brouillon conservé par conversation quand on en change.
- [x] Suppression côté agent d'une conversation non vivante (`session/delete` à la demande).
- [x] Fenêtre de confirmation de suppression intégrée (plus de `window.confirm`).

## Plan

- **Recherche dans le contenu** : ⌘K (fiche 027) et une entrée « Rechercher » dans la barre
  latérale. Les titres, dossiers et agents sont filtrés tout de suite dans le renderer ; le contenu
  (messages de l'utilisateur et de l'agent) est cherché par le main (`conversations:search`), qui
  garde le texte de chaque conversation en cache tant qu'elle n'a pas changé. Sans casse ni accents,
  tous les mots ; extrait autour de la première occurrence, mots surlignés.
- **Épingler** une conversation (menu « … » de l'historique) : `pinned` dans l'index, section
  « Épinglées » en tête de la barre latérale.
- **Regrouper par dossier** : choix « Récents / Par dossier » sur la section de l'historique
  (mémorisé dans le navigateur) ; groupes repliables, du plus récemment utilisé au plus ancien.
- **Brouillons** : le texte de la zone de saisie est gardé par conversation (mémoire + stockage
  local du renderer), retrouvé en y revenant, effacé à l'envoi.
- **Suppression** : fenêtre de confirmation intégrée (Radix Dialog) à la place de
  `window.confirm`, avec « Supprimer aussi la session chez l'agent » (coché par défaut). Pour une
  conversation dont l'agent ne tourne plus, l'app le démarre brièvement pour envoyer
  `session/delete` (si l'agent l'annonce, comme Bob), avec un délai maximal ; décoché, rien n'est
  envoyé à l'agent.

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-12 — Fait comme prévu. `shared/conversation-search.ts` (pliage sans casse ni accents qui
  garde les positions, extrait et surlignage, réponses de l'agent sans Markdown),
  `ConversationManager.search` (texte en cache par état du fil), `setPinned`, `delete(id,
  { fromAgent })` (agent arrêté démarré le temps de `session/delete`, 20 s au plus),
  `renderer/drafts.ts`, barre latérale (Rechercher ⌘K, Épinglées, Récents / Par dossier, fenêtre de
  suppression). Tests : recherche, épinglage après redémarrage, suppression d'une conversation
  arrêtée avec et sans l'agent (session de l'agent factice effacée ou gardée) ; suite e2e
  `historySuite`.
- Correction après les captures : les extraits montraient le Markdown brut des réponses
  (`|---|`, `**…**`) → texte simple ; contraste du bouton « Supprimer » en thème sombre.
- **Bob réel** : conversation arrêtée pointant vers une session de Bob (celle de l'essai de la fiche
  021), supprimée avec l'option cochée → Bob démarré, `session/delete` accepté, la tâche disparaît
  de `~/.bob/db/bob.db`, en 1 s environ. Sans message envoyé : 0 bobcoin.
- Limites : la recherche porte sur les messages de l'utilisateur et les réponses de l'agent (pas
  les sorties d'outils) ; le regroupement par dossier et l'état des groupes repliés sont propres à
  ce poste (stockage local).
- Essais e2e : deux instabilités vues pendant les suites complètes, sans lien direct avec la fiche.
  (1) ⌘K de la fiche 027 lisait la conversation affichée avant la fin de l'aller-retour avec le
  main → attente ajoutée. (2) Navigateur (fiche 007) : sous charge, la saisie de l'agent n'arrive
  parfois pas dans le champ (non reproduit en 20 passages isolés). `browser_type` refuse désormais
  de taper quand aucun champ n'a le focus et le dit à l'agent (au lieu de réussir en silence) ; la
  suite affiche la réponse et les outils si l'échec revient.

