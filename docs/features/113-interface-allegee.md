# 113 — Interface allégée : coût en un seul endroit, barre latérale réglable

- **Statut** : fait
- **Dépend de** : 019 (consommation), 109 (coût visible), 082 (panneau redimensionnable)
- **Agents** : les deux (rien de propre à un agent : c'est de l'interface)

## Pourquoi

Retours de l'utilisateur du 2026-10-21, après la vague 2 de l'audit :

- Le coût (jetons, bobcoins) est affiché à trop d'endroits : dans la liste des conversations (où
  il prend de la place pour rien) et dans l'en-tête de la conversation (qui n'apporte rien de plus
  que la puce sous la zone de saisie). Un seul endroit suffit : la puce de consommation (fiche 019),
  qui ouvre le détail.
- La barre latérale a une largeur fixe (264 px). Comme dans Claude Desktop, elle doit se régler
  à la souris entre un minimum et un maximum, et être un peu plus large par défaut.

## Choix d'interface (UX senior)

- **Un seul endroit pour le coût** : la puce de consommation sous la zone de saisie (anneau de
  contexte, ou le coût quand l'agent ne donne pas de contexte, comme Bob). Son détail reprend ce
  que la pastille de l'en-tête montrait (fiche 109) : le coût cumulé, la **moyenne par échange**
  (ce que coûtera vraisemblablement le prochain) et **une ligne par échange** (les 20 derniers, le
  plus récent en haut), après le contexte et les jetons, avant la dépense récente sur ce Mac.
  Raison : une seule porte d'entrée, là où l'utilisateur regarde avant d'envoyer ; l'en-tête
  retrouve sa place pour le titre et les panneaux, la liste pour les titres.
- **Barre latérale** : 300 px par défaut (264 avant), réglable de 220 à 440 px par une poignée sur
  son bord droit (même geste que le panneau de droite, fiche 082) ; double-clic sur la poignée :
  retour à 300 px. La largeur est propre à ce poste (stockage local, comme le regroupement de
  l'historique). Raison : les bornes évitent une barre illisible ou envahissante ; le double-clic
  est le même retour à la normale que sur le panneau. Sur une fenêtre étroite (demi-écran), la
  conversation garde au moins 500 px : la barre cède la différence (jamais sous 220 px) et reprend
  sa largeur réglée quand la fenêtre s'élargit. Raison : en dessous, la barre de saisie repliée
  (fiche 092) tronque les noms du modèle et de l'agent ; le réglage de l'utilisateur n'est pas
  perdu pour autant.

## Critères d'acceptation

- [x] Plus de coût dans la liste des conversations ni dans l'en-tête de la conversation.
- [x] Le détail de la puce de consommation donne le coût, la moyenne par échange et une ligne par
      échange — y compris pour un agent qui ne donne que son coût (comme Bob).
- [x] La barre latérale fait 300 px par défaut, se règle à la souris entre 220 et 440 px, revient
      à 300 px au double-clic, et garde sa largeur au prochain lancement.
- [x] Sur une fenêtre de 760 px, la conversation garde 500 px (la suite `composer` de la fiche 092
      passe sans rien tronquer d'autre que le modèle).
- [x] Testé contre l'agent factice (suites `usage`, `usage-bob`, `settings`).

## Plan

- `src/renderer/src/components/composer/UsageMeter.tsx` : moyenne et lignes par échange (reprises
  de `ConversationCost.tsx`, supprimé) ; `HistoryCost.tsx` supprimé ; `App.tsx`, `Sidebar.tsx`.
- `src/shared/usage.ts` : `usageHeadline` et `formatCostShort` retirés (plus d'affichage court).
  Le résumé gardé dans l'index (`UsageDigest`, fiche 109) reste : rien ne le lit aujourd'hui, il
  servira à trier ou chercher ; à retirer si rien ne vient.
- `src/renderer/src/components/sidebar/sidebar-width.ts` : bornes, lecture et écriture locale ;
  poignée dans `Sidebar.tsx` ; `styles.css` (`--sidebar-width`).
- Locales : `usage.costLabel`, `usage.costTitle`, `sidebar.costTurns` retirées ; `sidebar.resize`.
- Essais : unités (`usage`, `UsageMeter`, `Sidebar`, `sidebar-width`), e2e `usage`, `usage-bob`
  (détail dans la puce), `settings` (poignée de la barre).

## Journal

- 2026-10-21 — Fait comme prévu ; `usage`, `usage-bob`, `settings` en clair, en sombre et `--lang en`,
  captures regardées (`14b`, `14c`, `80b`) ; au passage, les apps d'essai ne passent plus au premier
  plan (fiche 106, journal du même jour). Écart : la suite complète a montré qu'à 760 px la barre
  à 300 px tronquait le nom de l'agent dans la barre de saisie (`composer`, fiche 092) ; d'où la
  place minimale de 500 px gardée par la conversation (`fittedSidebarWidth`). La vérification « deux lignes » de cette
  suite passe de 560 à 500 px de fenêtre : la barre cédant jusqu'à 220 px, il faut une fenêtre plus
  étroite pour priver la conversation de place. Le détail par échange ne change pas de forme
  (mêmes classes `cost-turn`, mêmes clés `usage.turns.*`), seuls les identifiants d'essai
  changent (`usage-turn`, `usage-average`). Fiche 109 : journal complété (ses deux affichages
  retirés ici). Non vérifié : essai réel avec Bob et OpenCode (agent factice seulement).
