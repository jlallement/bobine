# 234 — Menu « Réglages de la session » : plus de lignes qui glissent sous le pointeur

- **Statut** : fait
- **Dépend de** : 082 (menu affiché à sa taille, repli de 300 ms), 099, 109 (outils de Bobine), 115 (e2e en parallèle)
- **Agents** : les deux (menu de l'app, rien de propre à un agent)

## Pourquoi

La suite e2e `base` échouait par intermittence au pas « Réglages de session via le menu » : après
le clic sur « Modèle », le sous-menu ne s'ouvrait pas (vu le 15/11 en clair, le 17/11 en sombre,
campagne complète 207/208 ; vert relancé seul). Ce n'était pas l'essai : un utilisateur pouvait
lui aussi cliquer « Modèle » et cocher « Réponses détaillées », ou tomber entre deux lignes.

## Cause (prouvée)

Le menu attend ses règles, ses serveurs MCP et les outils de Bobine pour s'afficher à sa taille,
mais au plus 300 ms (fiche 082). Sur une machine chargée, la lecture dépasse ce délai : le menu
s'affiche avec « … » et sans le détail des outils, puis **grandit de 30 à 45 px** quand ils
arrivent. Ouvert au-dessus de la zone de saisie (`side="top"`, bas fixe), il grandit vers le haut :
toutes ses lignes montent. Si cela arrive entre la mesure de la ligne « Modèle » et l'appui :

- pointeur sur « Réponses détaillées » : elle est cochée à la place (réglage changé sans le
  vouloir) ;
- avec en plus l'animation d'ouverture restée sur sa première image pendant la mesure (observé
  sous `taskpolicy -c background` : 470 ms à `scale(.98) translateY(4px)`, ligne mesurée 6 px plus
  bas), pointeur **entre deux lignes** : Chrome envoie `pointerleave` à « Modèle » au changement de
  mise en page, Radix annule l'ouverture au survol et rend le focus au menu ; l'appui ne touche
  rien. Menu ouvert, aucune ligne en surbrillance, pas de sous-menu, rien de coché : la capture du
  17/11 à l'identique.

Preuve, par une expérience jetable (non gardée) dans `base` : règles et outils retenus derrière
une promesse, menu affiché par le repli, ligne mesurée, données libérées avant l'appui. Sans
correctif : 3/3 « Réponses détaillées » cochée (hauteur 338 → 383 px), et avec l'animation figée
2/2 la capture d'échec exacte. Avec le correctif : hauteur 338 → 338, sous-menu ouvert, 2/2.

Hypothèses écartées en chemin, avec mesure : le pas précédent « Stop pendant l'attente » (aucun
démontage de la ligne, déclencheur jamais désactivé), une croissance **après** l'ouverture du
sous-menu (il reste ouvert : sans mouvement de souris, rien ne le referme). Reproduction
naturelle : 0 sur ≈ 60 passages de `base` (seule, sous charge CPU, entourée de `composer`,
`pilote`… comme en campagne, ou ralentie) — d'où l'expérience déterministe.

## Critères d'acceptation

- [x] Un menu « Réglages de la session » affiché ne change plus de taille avant sa fermeture : ce
      qui arrive après le repli de 300 ms est gardé et montré à l'ouverture suivante.
- [x] Essai unitaire qui échoue sans le correctif (`SessionSettingsMenu.test.tsx`).
- [x] L'aide e2e `center()` attend la fin des animations finies de la cible et de ses parents
      avant de mesurer (bornée à 2 s).
- [x] `base` 10 fois de suite sans échec ; `pnpm e2e --changed` vert.

## Plan

- `src/renderer/src/components/common/Menus.tsx` (`SessionSettingsMenu`) : résultats arrivés
  menu affiché mis de côté (`whenStill`), appliqués à la fermeture.
- `SessionSettingsMenu.test.tsx` : repli de 300 ms, règles arrivées ensuite → toujours « … » ;
  refermé puis rouvert → règles là d'emblée.
- `e2e/lib.mjs` (`center`) : attendre les animations d'ouverture.
- Autres suites au même schéma (menu Radix asynchrone puis ligne visée) : `mcp`, `rules` ouvrent
  le même menu mais attendent leur contenu (`waitFor` sur les lignes) avant de viser ; le
  correctif de l'app les couvre aussi. Les autres menus (agent, modèle, mode, dossier) ne
  grandissent pas après affichage.

## Journal

- 2026-11-17 : diagnostic (enregistreur d'événements pointeur, de focus et de géométrie dans
  `base`, jetable), expérience déterministe, correctif, essai unitaire, aide e2e. Écart : la
  reproduction naturelle n'a pas abouti ; la cause est prouvée par l'expérience qui reproduit la
  capture d'échec au pixel près. Vu en passant, hors périmètre : sous `taskpolicy -c background`,
  `composer` échoue sur « mode Plan : bordure et halo… » et « la puce du mode devient une
  pastille « Plan » » (2/2 thèmes, une fois sur une).
- 2026-11-17 (vérifications) : `./scripts/verify` vert ; `pnpm build && pnpm e2e --changed`
  (`e2e/lib.mjs` touché : campagne complète) 207/208, seul échec `roles-gestion` sombre à
  « survol prolongé : une seule infobulle » (infobulle d'une tuile Équipe jamais apparue), vert
  3 fois sur 3 relancé seul : infobulles au survol déjà fragiles avant ce lot (captures d'échec
  `history`, `roles-gestion` du 14/11), à traiter à part ; `pnpm e2e base` 10 fois de suite,
  20/20 tâches vertes, captures `3-reglages` regardées (clair et sombre).
