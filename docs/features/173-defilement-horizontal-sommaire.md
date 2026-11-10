# 173 — Fil sans défilement horizontal, sommaire borné

- **Statut** : fait
- **Dépend de** : 027 (sommaire), 047 (long fil), 139 (scénarios aux limites)
- **Agents** : les deux — pur affichage du fil, rien de propre à un agent

## Pourquoi

Signalé en usage réel, avec un vrai agent : (1) une barre de défilement horizontale est
apparue dans une conversation et n'a plus disparu, sans qu'on sache quel contenu l'a provoquée ;
(2) sur une longue conversation, la colonne de traits du sommaire descend jusqu'en bas de la
fenêtre (un trait de 2 px tous les 9 px, sans limite).

## Critères d'acceptation

- [x] Reproduit avec l'agent factice : scénario `debordements` (mot, lien, chemin sans espace dans
  le texte, un titre, une liste, une citation ; ligne de code ; tableau large ; code dans une liste ;
  Mermaid large ; diff à lignes longues ; sortie de terminal large ; image de 2 400 px ; titres
  d'outils longs ; sous-agent façon OpenCode), plus un message de l'utilisateur sans espace.
- [x] Le fil ne défile jamais de côté : `scrollWidth <= clientWidth` du fil et de ses ancêtres, aucun
  élément du fil ne sort de la colonne hors d'un cadre qui défile, `scrollLeft` reste à 0 — à
  1440 px et dans une conversation de 500 px, clair et sombre (suite e2e `debordements`).
- [x] Code, diff, tableau, terminal défilent dans leur propre cadre ; le texte coupe les mots trop
  longs.
- [x] La colonne de traits du sommaire a une hauteur maximale (30 % du fil, 240 px au plus) ; au-delà,
  l'écart se resserre puis un trait représente plusieurs messages, le trait courant reste juste.
- [x] La liste au survol garde tous les messages et s'ouvre sur le message lu.
- [x] Essai e2e à 80 messages (suite `sommaire`) : hauteur respectée (aussi en fenêtre basse), trait
  courant en haut, au milieu et en bas, captures clair et sombre.

## Plan

1. Scénario `debordements` (`src/mock-agent/scenarios-debordements.mts`, `terminalSteps` exporté de
   `scenarios-limites.mts`), test unitaire, ligne dans `docs/mock-agent.md`.
2. Suite e2e `debordements` qui mesure et nomme les éléments qui dépassent ; reproduire, puis corriger
   dans `styles.css` (`.thread`, `.column`).
3. `outline-layout.ts` (fonction pure, testée) et `ConversationOutline.tsx` ; suite e2e `sommaire`.
4. Comparer en captures les deux options du sommaire ; fiche, index, CHANGELOG.

Aucune dépendance nouvelle. Changements de `styles.css` limités à deux règles (aucun rayon).

## Cause du défilement horizontal

Mesuré avec la suite `debordements` avant correction (fil de 740 px, il défilait jusqu'à 3 052 px) :
dépassaient **uniquement des textes sans endroit où couper** —

- le message de l'utilisateur (`.msg-user`, `white-space: pre-wrap` sans coupure de mot) ;
- les liens nus et liens Markdown (`a[web-link]`) d'une réponse ;
- un titre (`h2`), un paragraphe, un élément de liste contenant un mot très long.

Tout le reste était déjà cadré : blocs de code, diff, tableau (`.table-wrap`), sortie de terminal,
image, Mermaid, cartes d'outils (titres tronqués) et sous-agent. Aucun élément temporaire (infobulle,
menu, animation) n'a été trouvé en cause.

Pourquoi la barre « reste » : `.scroll` a `overflow-y: auto`, ce qui rend aussi `overflow-x` automatique.
Le contenu fautif (le lien long) fait partie de la conversation : tant qu'il est rendu, la largeur
défilable reste celle de la plus longue ligne, et la barre ne s'en va plus — même en défilant loin du
message. Un `scrollLeft` décalé (glisser au pavé, `scrollIntoView`) restait aussi décalé.

## Correction

- `.thread { overflow-wrap: break-word }` : hérité par tout le fil. `break-word` plutôt qu'`anywhere`
  pour ne pas réduire la largeur minimale des cellules ; le code (`pre`) ne passe jamais à la ligne.
  Dans un tableau, Chromium coupe tout de même une cellule au mot interminable (≈ 800 px dans le
  scénario) et le tableau défile dans son cadre.
- `.column { overflow-x: clip }` : filet de sécurité. Ce qui déborderait encore est coupé au bord de
  la colonne (marge de 24 px comprise) au lieu d'élargir le fil. `clip` et non `hidden` : aucun
  défilement caché possible, et `position: sticky` des enfants intact. L'essai mesure les dépassements
  sans tenir compte de ce filet, pour qu'il ne masque pas une régression.

## Sommaire : deux options comparées

Captures (dans `e2e/captures/` après la suite, et copies dans les notes de la session mère) :

- **A — resserrer puis regrouper** (retenue) : jusqu'à la hauteur maximale, un trait par message,
  l'écart passe de 7 à 3 px ; au-delà, autant de traits que la hauteur en tient à 3 px d'écart
  (48 pour 240 px), chacun pour une suite de messages consécutifs. À 80 messages et un fil de 630 px :
  38 traits de deux messages environ.
- **B — fenêtre glissante** autour du message lu, écart de 7 px.

A est retenue : la colonne reste une carte de **toute** la conversation, la position du trait courant
dit où l'on est (début, milieu, fin) comme un ascenseur. Avec B, le trait courant reste au centre et la
colonne a toujours la même allure : elle ne dit plus rien de la position, et les traits défilent sous
le pointeur quand on lit. Écart minimal de 3 px : en dessous, les traits de 2 px se confondent en une
bande grise. Hauteur : 30 % du fil pour laisser l'essentiel de la gouttière vide, 240 px au plus
(~ 48 traits) car au-delà la colonne ne se lit plus d'un coup d'œil.

En plus : la liste au survol défile jusqu'au message lu (sinon elle s'ouvrait toujours sur le premier).

## Journal

- 2026-11-05 — Reproduction : causes ci-dessus. Correction CSS, suite `debordements` (1440 px et
  conversation de 500 px, clair et sombre). Sommaire : `outline-layout.ts` + tests, suite `sommaire`
  à 80 messages. Écart au plan : la largeur étroite est obtenue par une fenêtre de 720 px (la
  conversation à côté de la barre latérale fait alors 500 px). Le sous-agent par `subagent_update`
  n'étant pas affiché par l'app, le scénario utilise l'outil `task` d'OpenCode.
- 2026-11-05 — `./scripts/verify` vert ; `pnpm build && pnpm e2e --changed` (suite complète, `styles.css`
  étant global) : 142/143 vertes, `browser` sombre en échec une fois sous la charge, verte relancée seule.
- Non vérifié : le contenu exact qu'a vu l'utilisateur (inconnu) ; la cause trouvée couvre
  tous les textes du fil, mais un cas hors scénario reste possible — le filet `overflow-x: clip`
  l'empêche alors d'élargir le fil.
- 2026-11-05 — **Écart après fusion** (avec la fiche 166, panneau « Session » ouvert d'office) : sur
  `main`, `debordements` et `sommaire` échouaient. Cause : l'ouverture d'office vérifie la place une
  seule fois ; ensuite, quand la fenêtre rétrécissait, seule la barre latérale cédait (et sans
  compter le panneau) — à 720 px, barre 220 + panneau 380 laissaient 120 px à la conversation ; la
  ligne heure + boutons sous un message de l'utilisateur sortait alors du fil par la gauche. Le
  sommaire, lui, se masquait faute de gouttière (panneau ouvert à 1440 px). Corrections :
  - app : le panneau **cède** comme la barre latérale (`fittedPanelWidth`, jusqu'à 280 px, pour
    garder les 500 px de la fiche 113), se **replie** quand la fenêtre rétrécit au point que même
    280 px ne tiennent plus (pas compté comme une fermeture de l'utilisateur) et **revient** sur le
    même onglet quand elle s'élargit (`useRoomForConversation`, `usePanel.ts`). Ouvert à la main
    dans une fenêtre déjà étroite, il reste (choix de l'utilisateur). Agrandi, il reste aussi. La
    poignée suit la même borne (barre latérale réelle comprise), au lieu de « fenêtre − 720 px » :
    la suite `panel` tire désormais de 80 px et non 120 dans sa fenêtre de 1280 px ;
  - CSS : `.msg-user-actions` passe à la ligne dans une conversation très étroite ;
  - essais : `debordements` vérifie l'ouverture d'office puis 1100 px (le panneau cède), 720 px
    (replié, conversation 500 px), 1440 px (revenu), et une conversation de 220 px panneau rouvert à
    la main (rien ne dépasse) ; ferme ensuite le panneau pour mesurer le fil seul. `sommaire` ferme
    le panneau avant de mesurer. Captures : `173-panneau-replie`, `173-debordements-extreme`.
  `browser-view` : à 150 % de zoom de l'interface (fenêtre de 853 px CSS), le panneau se replie
  désormais ; la suite le rouvre à la main avant de mesurer la page.
  `./scripts/verify` vert ; `pnpm e2e debordements sommaire session composer panel` vert en clair et
  sombre ; `pnpm e2e --changed` (suite complète) : 143/145, les 2 échecs étaient `browser-view`,
  vertes après cette adaptation, relancées seules.
