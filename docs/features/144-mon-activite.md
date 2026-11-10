# 144 — Mon activité : le tableau de consommation dans la fenêtre principale

- **Statut** : fait (essai à la vraie souris à faire en fin de vague, voir le journal)
- **Dépend de** : 137 (tableau de consommation), 130 (journal `usage.sqlite`, ADR-0025), 134
  (jetons de thème, ADR-0027), 131 (barre latérale en sections), 091 (quota, ADR-0017)
- **Agents** : les deux. La page lit le journal par les canaux génériques `usage:*` ; quota et
  dépense « sur ce Mac » viennent des adaptateurs déjà déclarés dans les profils (`quotaSource`,
  `costSource.spend`). Seul changement dans les profils : leur emplacement de couleur
  (`chartSlot`), qui n'est pas une fonction propre à un agent.
- **Maquette** : planche « tableau de bord » validée par Jérôme le 24/10
  (maquette privée, non publiée), DOM dans
  `e2e/maquettes/screens-tableau-de-bord.mjs`.
- **Revient sur** la décision du 23/10 « Consommation : un onglet des réglages, pas une fenêtre à
  part » (`docs/feuille-de-route-2026-10-23.md`, « Tranchées ») : ADR-0031.

## Pourquoi

Le tableau de la fiche 137 est enfoui dans Réglages › Consommation, dans une fenêtre modale
étroite. Jérôme veut le voir comme une page de l'app, façon GitHub : une grille d'activité sur un
an, la semaine, le mois ou l'année en cours comparés à la précédente, et un jour en un clic. La
page doit rester propre à toutes les largeurs de la fenêtre.

## Critères d'acceptation

- [x] **Barre latérale** : « Rechercher » devient une loupe dans `.sidebar-header`, à gauche du
      bouton qui masque la barre (infobulle « Rechercher ⌘K », raccourci inchangé). Une ligne
      « Mon activité » (icône `chart-column`, ⇧⌘U affiché comme ⌘K) prend sa place sous
      « Nouvelle conversation », en surbrillance tant que la page est ouverte. Le bloc de l'agent
      ne change pas.
- [x] **Menu Fenêtre** › « Mon activité » (⇧⌘U, libre dans `shortcuts.ts` et `menu.ts`) ; le lien
      « Toute la consommation… » de la puce ouvre la page.
- [x] **Page** dans la zone principale, à la place du fil et de la zone de saisie ; titre « Mon
      activité » dans la barre de titre, sans menu de conversation. Ouvrir une conversation (barre
      latérale, recherche, menu, notification, nouvelle conversation) la referme.
- [x] L'onglet Réglages › Consommation disparaît ; la recherche des réglages (consommation, coût,
      jetons, quota) mène à la page.
- [x] **Filtres sur une ligne** : Semaine · Mois · Année, flèches période précédente / suivante
      (suivante grisée sur la période en cours), libellé de la période ; à droite le filtre d'agent
      et « Exporter… ».
- [x] **Grille d'activité** sur 12 mois glissants : semaines en colonnes, lundi en haut, lun. / mer.
      / ven. et mois ; « N échanges ces 12 derniers mois » ; menu « 12 derniers mois » avec les
      années civiles passées ; légende Moins → Plus. Elle compte les échanges et suit le filtre
      d'agent.
- [x] Quatre niveaux tirés de `--accent` (`--heat-1…4`, `themes.ts`, `pnpm themes-css`), jour vide
      `--surface-2` ; `themes.test.ts` : luminosité qui s'éloigne de la carte niveau après niveau,
      écarts visibles, premier niveau ≥ 2:1 sur la carte, pour chaque palette et chaque accent.
- [x] Aujourd'hui cerclé ; jours hors période pâlis ; survol : « 38 échanges · mardi 20 oct. » et
      partage par agent ; clic : la page montre ce jour, pastille « mardi 20 octobre 2026 × » à la
      place des flèches, aucun segment actif ; la croix revient à la semaine.
- [x] **Quatre chiffres** (échanges, jetons traités, temps de travail, coût par unité) avec l'écart
      à la période précédente (flèche, `--muted`, jamais vert ni rouge) ; période en cours comparée
      à date égale ; un jour comparé à la moyenne du même jour de la semaine ; pas d'écart pour
      l'année.
- [x] **Graphique empilé** : par heure pour un jour, par jour pour la semaine ou le mois, par mois
      pour l'année ; Agents | Modèles et Échanges | Jetons | Coût.
- [x] **Couleurs** : IBM Bob en bleu, OpenCode en vert d'eau, l'agent factice en orange (`chartSlot`).
- [x] **« Bobcoins »** (majuscule) partout dans l'interface (puce, quota de la barre latérale,
      page) ; `bobcoins` reste tel quel dans les données, le journal et le CSV.
- [x] **Tableaux** (par modèle, par projet, conversations) et « {agent} sur ce Mac » sous le
      graphique, pour la période choisie.
- [x] **« Remettre à zéro… »** dans Réglages › Données (même confirmation, même aide).
- [x] **Responsive** jusqu'à 800 px (largeur minimale), barre latérale ouverte ou fermée, panneau
      latéral ouvert : aucun défilement horizontal de la page ; filtres sur deux lignes ; chiffres
      4 → 2 → 1 colonnes ; grille aux carrés lisibles, qui défile dans sa carte calée à droite ;
      graphique à la largeur ; tableaux 2 → 1 colonne, les larges défilent dans leur carte.
- [x] Tests unitaires (périodes, comparaisons, grille, niveaux, seaux du graphique, thèmes,
      raccourci, menu, barre latérale, recherche des réglages) ; e2e `usage-board` adaptée avec
      l'agent factice (deux tours, page, période, jour, agent, export, remise à zéro dans Données,
      largeurs) ; captures clair, sombre, `--lang en`, largeur réduite.

## Plan

### Main et partagé

1. **Requête** (`src/shared/usage-stats.ts`) : `UsageQuery` = `{ scope: 'day' | 'week' | 'month'
   | 'year' | 'all', date: 'AAAA-MM-JJ', profileId? }` (« all » : export seulement) ;
   `UsageHeatQuery` = `{ range: 'last12' | année, profileId? }`. `UsageStats` gagne `bucket`
   (`hour`, `day`, `month`), `buckets` (à la place de `days`), `range` (premier et dernier jour),
   `current` (la période contient aujourd'hui) et `comparison` (totaux de la période précédente,
   à date égale si `current`, ou moyenne du même jour de la semaine). `UsageHeatmap` : jours, total,
   échanges par agent et par jour, années civiles passées du journal.
2. **Calculs** (`src/main/usage/stats.ts`, purs) : `scopeRange` (semaine du lundi au dimanche,
   mois, 12 mois glissants jusqu'au mois de `date`, jour), `previousRange` (date égale), buckets par
   heure, jour ou mois, `heatmapOf` (12 mois glissants : du lendemain d'il y a un an à aujourd'hui ;
   ou l'année civile), moyenne du même jour de la semaine sur les 12 semaines d'avant (depuis le
   premier jour du journal). `periodRange` et `USAGE_PERIODS` disparaissent.
3. **Service et IPC** (`setup.ts`, `usage-ipc.ts`, `preload`, `ipc.ts`) : `usage:stats` prend la
   nouvelle requête, `usage:heatmap` s'ajoute ; export CSV inchangé (par tour, par jour), sur la
   période affichée ou « tout l'historique ».
4. **Profils** : `chartSlot` Bob 1 (bleu), OpenCode 2 (vert d'eau), agent factice 0 (orange).
5. **Raccourci et menu** (`shortcuts.ts`, `menu.ts`) : commande `activity`, `CmdOrCtrl+Shift+U`,
   menu `window` (nouveau) placé dans Fenêtre avant les entrées de macOS.

### Renderer

6. **Page** (`components/activity/`, déménagée de `components/settings/usage/`) :
   `ActivityPage.tsx` (état de la requête, chargement, mise en page), `ActivityFilters.tsx`
   (segments, flèches, pastille du jour, agent, export), `ActivityHeatmap.tsx` (SVG, menu de
   l'étendue, infobulle HTML, défilement calé à droite), `ActivityKpis.tsx` (chiffres et écarts),
   `UsageChart.tsx` (seaux génériques), `UsageTables.tsx`, `AgentAccounts.tsx`. Calculs d'affichage
   purs dans `usage-board.ts` (niveaux par quartiles, écarts, libellés des seaux et des périodes,
   navigation). CSS : `usage-board.css` (responsive par `@container`, la page n'ayant pas la largeur
   de la fenêtre).
7. **App** : hook `useActivityPage` (ouvert / fermé, refermé à toute ouverture de conversation :
   `select`, `create`, `resumeSession` enveloppés, et changement de conversation active) ; la barre
   de titre montre « Mon activité » ; `main` montre la page à la place du fil et de la saisie.
8. **Barre latérale** : loupe dans l'en-tête, ligne « Mon activité » (`active`).
9. **Réglages** : onglet `usage` retiré (12 onglets) ; `ResetCard` → `settings/UsageReset.tsx`
   dans Données ; l'index de recherche garde consommation, coût, jetons, quota, qui ouvrent la page
   (`section: 'activity'`), et « Remettre à zéro » mène à Données.
10. **Bobcoins** : `unitLabel` dans `shared/usage.ts` (première lettre en majuscule pour une unité
    libre), utilisé par `formatCost` et le quota ; libellés fr et en où « bobcoins » est affiché.
11. **Thème** : `heat` (4 couleurs) dans `ThemeTokens`, calculé depuis l'accent et la carte
    (`--heat-1…4`) ; `pnpm themes-css`.

### Tests, e2e, docs

12. Unitaires : `stats.test.ts`, `usage-board.test.ts`, `themes.test.ts`, `menu.test.ts`,
    `settings-search.test.ts`, `Sidebar.test.tsx`, `ActivityPage.test.tsx` (ex-`UsageSettings`),
    `usage-ipc.test.ts`, `setup.test.ts`.
13. e2e `usage-board` réécrite (page, ⇧⌘U par le menu, jour, export, remise à zéro dans Données,
    largeurs 800 et 1100 px, barre fermée, panneau ouvert) ; suites touchées : `settings`, `usage`,
    `fun`, `quota`, `usage-bob`. Captures clair, sombre, anglais.
14. Docs : cette fiche, index, `architecture.md`, `traduction.md` (« Mon activité », « Bobcoins »),
    ADR-0031, CHANGELOG fr et en, note dans la feuille de route du 23/10.

Pas de nouvelle dépendance.

## Journal

### 2026-10-24 — plan

Fiche créée d'après la maquette validée, plan écrit avant de coder.

### 2026-10-24 — fait

- **Fait** : tout le plan. Main : `shared/usage-periods.ts` (périodes, navigation, comparaison à
  date égale, étendue de la grille), `stats.ts` (`queryRange`, seaux par heure, jour ou mois,
  `comparisonPlan` / `compareRows`, `heatmapOf`, `pastYears`), `usage-db.ts` (`firstStartedAt`),
  `setup.ts` (`heatmap`, export « tout l'historique » nommé `bobine-turns-all-…`,
  `watchedUsageDb`), `usage-ipc.ts` (`usage:heatmap`), évènement `usage:changed`, `chartSlot`
  (factice 0 orange, Bob 1 bleu, OpenCode 2 vert d'eau), commande `activity` (⇧⌘U, libre) dans le
  menu Fenêtre. Renderer : `components/activity/`, `useActivityPage`, barre latérale (loupe, ligne
  « Mon activité »), titre « Mon activité », onglet Consommation retiré (12 onglets),
  `settings/UsageReset.tsx` dans Données, recherche des réglages vers la page (`SearchPlace`),
  `unitLabel` (« Bobcoins » dans `formatCost` et le quota), `heatScale` et `--heat-1…4`.
- **Tests** : `usage-periods.test.ts`, `stats.test.ts` (bornes, seaux, changement d'heure,
  comparaisons, moyenne du même jour de la semaine, grille, années), `usage-db.test.ts`,
  `setup.test.ts` (grille et export par jour sur le vrai gestionnaire, signal regroupé du journal),
  `usage-ipc.test.ts`, `menu.test.ts`, `themes.test.ts` (niveaux de la grille pour chaque palette
  et chaque accent : premier niveau ≥ 2:1, chaque niveau ≥ 1,2 × le précédent, luminosité
  monotone), `usage-board.test.ts`, `ActivityPage.test.tsx`, `UsageReset.test.tsx`,
  `Sidebar.test.tsx`, `SettingsDialog.test.tsx`, `settings-search.test.ts` ; textes « Bobcoins »
  mis à jour dans les tests existants.
- **e2e** : `usage-board` réécrite (barre latérale, loupe, page par la puce, semaine, mois, année,
  semaine précédente, jour choisi dans la grille et retour, agent, trois exports, 1180 et 800 px
  barre ouverte, panneau ouvert, barre fermée — sans défilement horizontal —, conversation qui
  referme la page, ⇧⌘U, remise à zéro dans Données qui fait relire la page, échange suivant
  compté) ; adaptées : `settings` (12 onglets), `git` (alignement avec « Mon activité »), `fun`
  (Bobcoins dans la page), `quota` et `subagents` (Bobcoins). Captures regardées : `144-…` à
  `144f-…` en clair, sombre et `--lang en`.
- **`pnpm build && pnpm e2e --changed`** (124 tâches, toutes les suites : `App.tsx` et
  `styles.css` sont des sources globales) : 8 échecs au premier passage, tous suivis. Textes et
  sélecteurs à adapter : `startup` (menu Fenêtre), `usage` (Bobcoins), `panel` (le premier bouton
  de l'en-tête de la barre est désormais la loupe). `browser` sombre : instable sous charge, vert
  au second passage. `about` sombre : course dans l'essai (le main interrogé pendant que la fenêtre
  À propos se ferme rend `undefined`), boucle rendue tolérante, vert trois fois de suite. Suites
  corrigées rejouées en clair et en sombre : vertes. La suite complète n'a pas été rejouée en
  entier après ces corrections.
- **Écarts au plan et à la maquette** :
  - La semaine en cours se compare elle aussi à date égale (lundi à maintenant contre la même durée
    la semaine d'avant), comme le mois : sinon un lundi matin montrerait « −95 % ». Libellé « vs
    semaine précédente à date égale ».
  - Un jour se compare à la moyenne de son jour de la semaine sur les douze semaines d'avant,
    seulement celles où le journal existait déjà (premier tour de l'agent filtré) ; seul le chiffre
    des échanges montre ce rapport (comme la maquette). Une période d'avant sans échange : pas
    d'écart (pas de « +∞ % »).
  - Niveaux de la grille par rang parmi les valeurs des jours actifs (le plus actif au niveau 4),
    pas par seuils fixes : un jour exceptionnel n'écrase pas les autres.
  - La croix de la pastille revient à la semaine **du jour choisi**.
  - « Exporter… » gagne « Tout l'historique » : sans la période « Tout », c'était le seul moyen
    d'exporter avant une remise à zéro (l'aide le dit).
  - La page se relit seule quand le journal change (fin d'un tour, reprise, remise à zéro) :
    évènement `usage:changed`, regroupé sur 250 ms.
  - Libellés lun. / mer. / ven. hors de la zone qui défile, et infobulle de la grille hors d'elle
    (elle était coupée en haut) ; intervalles de dates écrits par `Intl.formatRange`
    (« 19–25 oct. 2026 », « Oct 19 – 25, 2026 »).
  - Fenêtre de 800 px, barre et panneau ouverts : la zone principale tombait à 120 px (vrai aussi
    pour une conversation, avant cette fiche). Quand la page est ouverte, le panneau cède jusqu'à
    sa largeur minimale (280 px) et la page garde 220 px : une colonne, segments qui passent à la
    ligne, grille qui défile. À généraliser aux conversations si besoin (hors de cette fiche).
  - Le lien de la puce devient « Toute mon activité… ».
- **Compatibilité Bob** : rien de nouveau par ACP ; `chartSlot` n'est qu'une couleur (rien à ajouter
  à la matrice de `docs/agents.md`). Pas de nouvelle dépendance.
- **À vérifier à la vraie souris** (fin de vague) :
  1. ⇧⌘U au clavier (le raccourci du menu, pas le clic depuis le main) ; la loupe et ⌘K.
  2. Survol de la grille : infobulle lisible, à gauche dans la moitié droite, rien de coupé, en
     haut comme en bas de la grille, grille défilée ou non.
  3. Rétrécir la fenêtre à la main jusqu'à 800 px, barre ouverte puis fermée, panneau ouvert puis
     redimensionné à la poignée : jamais de défilement de côté de la page, grille calée à droite,
     chiffres 4 → 2 → 1, tableaux en une colonne.
  4. Clic sur un jour, croix, flèches, menu « 12 derniers mois » et une année passée sur un vrai
     historique (Bob et OpenCode : bleu et vert d'eau ; niveaux en Sépia et Nuit noire).
  5. Ouvrir une conversation depuis une notification macOS pendant que la page est ouverte : elle
     se referme.
