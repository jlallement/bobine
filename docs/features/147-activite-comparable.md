# 147 — Mon activité comparable : ce qui se compare entre agents, et ce qui ne couvre qu'un agent

- **Statut** : fait (essai à la vraie souris avec Bob et OpenCode à faire, voir le journal)
- **Dépend de** : 144 (Mon activité), 137 (tableau de consommation), 130 (journal, ADR-0025)
- **Agents** : les deux (et tout agent ACP). Qui couvre une mesure se lit dans le journal de la
  période (jetons présents, coût dans une unité), jamais d'après le nom de l'agent (ADR-0011) ; rien
  de nouveau dans les profils.
- **Maquette** : planche « Mon activité comparable » validée par Jérôme le 24/10
  (maquette privée, non publiée), DOM dans
  `e2e/maquettes/screens-tableau-de-bord.mjs` (`ACTIVITY_SCREENS`).

## Pourquoi

Retour de Jérôme après un essai réel (24/10) : Bob ne communique jamais de jetons, seulement des
Bobcoins ; OpenCode, des jetons et parfois des dollars, jamais de Bobcoins. Le graphique devient
« multi-dimensions » sans qu'on puisse comparer ; on ne doit jamais additionner dollars, jetons et
Bobcoins (c'est déjà le cas). Ce qui se compare : les échanges, et le temps de travail. Et la carte
« IBM Bob sur ce Mac » s'affiche même quand on filtre sur un autre agent.

## Critères d'acceptation

- [x] Graphique : mesures « Échanges · Temps · Jetons · Coût (unité)… » ; « Temps » empile le temps
      de travail par agent (ou par modèle), axe et infobulle en durées ; titre « Temps de travail
      par heure / jour / mois ».
- [x] Une mesure qui ne couvre qu'une partie des agents de la période le dit sous le graphique :
      « Jetons : OpenCode seulement. IBM Bob ne communique pas ses jetons. », « Coût (Bobcoins) :
      IBM Bob seulement. » ; rien quand tous les agents sont couverts.
- [x] En-tête du graphique sur deux lignes : titre et mesures, puis légende et « Agents | Modèles ».
- [x] Chiffres dans l'ordre Échanges, Temps de travail, Jetons traités, Coût ; « Jetons traités »
      porte le nom des agents couverts quand tous ne le sont pas (« Jetons traités · OpenCode »).
- [x] Carte « {agent} sur ce Mac » : seulement avec « Tous les agents » ou cet agent.
- [x] Jamais de conversion ni d'addition entre unités (inchangé).
- [x] Testé : unitaires (temps dans les seaux, valeur et graduations du temps, couverture d'une
      mesure, chiffres, carte selon le filtre) ; e2e `usage-board` (mesure « Temps », note de
      couverture absente avec un seul agent) ; captures clair et sombre.

## Plan

1. **Main** (`shared/usage-stats.ts`, `main/usage/stats.ts`) : `UsageCell.durationMs` (tours finis),
   ajouté dans `addCell`.
2. **Calculs d'affichage** (`renderer/usage-board.ts`, purs, testés) : `ChartMetric` gagne
   `{ kind: 'time' }` ; `cellValue` (temps en minutes) ; `durationTick` (graduations « 20 min »,
   « 1 h 30 ») ; `metricCoverage(rows, metric)` : agents couverts et non couverts d'après
   `byModel` (jetons : des tours avec jetons ; coût : des tours avec un coût dans l'unité).
3. **Page** (`ActivityPage.tsx`, `UsageChart.tsx`, `ActivityKpis.tsx`, `AgentAccounts.tsx`,
   `usage-board.css`) : mesure « Temps », en-tête sur deux lignes, note de couverture, ordre des
   chiffres et libellé des jetons, carte de l'agent selon le filtre (`profileId`).
4. **Textes** (`fr.json`, `en.json`) : `usage.board.metric.time`, `activity.chart.title.*.time`,
   `usage.board.coverage.*`, `usage.board.kpi.tokensOf`.
5. **Tests** : `stats.test.ts`, `usage-board.test.ts`, `ActivityPage.test.tsx` ; e2e `usage-board`.
6. **Docs** : cette fiche, index, CHANGELOG fr et en.

Pas de nouvelle dépendance, pas d'ADR (ADR-0025 et ADR-0031 tiennent).

## Journal

### 2026-10-24 — plan

Maquette validée ; plan écrit avant de coder.

### 2026-10-24 — fait

- **Fait** : tout le plan. Main : `UsageCell.durationMs` (tours finis), `durationOf` dans
  `stats.ts`. Renderer : `usage-board.ts` (`ChartMetric` « time », `cellValue` en minutes,
  `durationScale` sur des valeurs d'horloge, `durationTick`, `metricCoverage`), `UsageChart.tsx`
  (graduations et infobulle en durées, marge gauche plus large pour elles), `ActivityPage.tsx`
  (mesure « Temps », en-tête sur deux lignes, note de couverture), `ActivityKpis.tsx` (ordre,
  « Jetons traités · OpenCode »), `AgentAccounts.tsx` (filtre), `usage-board.css` ; textes fr et en.
- **Tests** : `stats.test.ts` (temps des seaux, tour en cours sans temps), `usage-board.test.ts`
  (graduations de durée, couverture d'une mesure d'après le journal, agent qui se met à communiquer
  ses jetons), `ActivityPage.test.tsx` (ordre et libellé des chiffres, mesures, temps empilé et
  infobulle, notes « Jetons : OpenCode seulement… » et « Coût (Bobcoins) : IBM Bob seulement. »,
  carte de Bob selon le filtre).
- **e2e** : `usage-board` gagne la mesure « Temps » (titre « Temps de travail par jour »), « Jetons »
  sans note avec un seul agent, ordre des chiffres ; `usage-board`, `usage`, `usage-bob`, `quota`,
  `fun` vertes en clair et en sombre (10 tâches), captures `144-…` regardées. `pnpm e2e --changed`
  demande la suite complète (traductions) : pas lancée sans l'accord de Jérôme.
- **Écarts au plan** : graduations de durée par pas d'horloge (1, 2, 5, 10, 15, 20, 30 min, 1 à
  24 h) et non par `niceScale` (qui donnait « 50 min, 100 min ») ; le coût dans une seule unité
  garde son libellé « Coût » (sans unité), comme avant.
- **À essayer à la vraie souris**, avec Bob et OpenCode sur la même semaine : « Jetons » et chaque
  coût affichent leur note, « Temps » empile les deux agents, filtre OpenCode sans carte de Bob,
  largeur réduite à 800 px (en-tête sur deux lignes qui passe à la ligne proprement).
