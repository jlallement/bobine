# 137 — Tableau de consommation (Réglages › Consommation)

- **Statut** : fait (essai à la vraie souris à faire à la fin des vagues, voir le journal)
- **Dépend de** : 019 (consommation), 091 (quota de Bob, ADR-0017), 109 (coût par tour), 130
  (journal `usage.sqlite`, ADR-0025), 134 (jetons de thème, ADR-0027), 136 (réglages en trois
  groupes)
- **Agents** : les deux. La page ne lit que le journal (champs ACP standard et `costSource` du
  profil, ADR-0015) ; le quota et la dépense « sur ce Mac » passent par les canaux génériques
  (`quotaSource`, `costSource.spend`) : une carte par agent dont le profil sait les lire, rien de
  propre à Bob dans l'interface.
- **Feuille de route** : vague 3 de `docs/feuille-de-route-2026-10-23.md` (§ 0), lot 145 de
  l'étude ; maquette `consommation` de la planche, validée le 23/10 (« vraiment pas mal ») avec
  « une option pour remettre à zéro ».

## Pourquoi

Le journal de la fiche 130 collecte une ligne par tour depuis le 23/10, sans rien montrer. La puce
de consommation parle d'**une** conversation ; il manque la vue de **toutes** : combien d'échanges,
de jetons, de temps et de coût par jour, par agent, par modèle et par projet, et quelles
conversations ont le plus consommé. Jérôme veut aussi pouvoir tout remettre à zéro.

## Critères d'acceptation

- [x] Onglet « Consommation » en tête du 3e groupe des réglages (icône `chart-column`) ; lien
      « Toute la consommation… » dans le détail de la puce de consommation.
- [x] Filtres : période (Aujourd'hui, 7 j, 30 j, Ce mois, Tout) et agent ; « Exporter… » à droite.
- [x] Quatre chiffres clés : échanges (et conversations), jetons traités (entrée, sortie), temps de
      travail (moyenne par échange), coût **par unité** ; dollars et bobcoins jamais additionnés ;
      « non communiqué » quand l'agent ne donne rien ; aucun prix estimé (fiche 019).
- [x] Graphique par jour, en SVG fait maison : barres empilées par agent ou par modèle, métrique
      Échanges, Jetons ou Coût (une seule unité) ; une couleur par série dans un ordre fixe, jamais
      selon le rang, vérifiée pour le daltonisme et rangée dans `src/shared/themes.ts` ; légende,
      grille discrète, infobulle au survol d'un jour, jours à l'heure locale.
- [x] Tableaux : par modèle (modèle, agent, échanges, jetons entrée et sortie, coût, coût par
      échange) ; par projet (worktrees regroupés sur leur dépôt) ; les conversations qui ont le
      plus consommé (un clic ouvre la conversation).
- [x] « {agent} sur ce Mac » : quota du mois (ADR-0017) et dépense sur ce Mac (`costSource.spend`)
      quittent la puce pour cette page, par des canaux génériques.
- [x] Reprise de l'existant une seule fois, depuis les fils, sans doublon (identifiant
      `<conversation>:<début du tour>`), sans les comptes rendus des filles ni ce qu'une branche a
      repris de son origine.
- [x] Export CSV par « Enregistrer sous » : une ligne par tour, ou une ligne par jour.
- [x] « Remettre à zéro… » : carte « Historique » en bas, bouton rouge, confirmation dans l'app ;
      l'aide dit d'exporter avant, et que le quota de Bob n'est pas concerné. Le journal est vidé
      sans casser la collecte : les tours suivants sont comptés.
- [x] IPC : `usage:stats`, `usage:export`, `usage:reset`, `usage:spends` vérifient émetteur et
      arguments.
- [x] La recherche des réglages trouve « consommation », « coût », « jetons » et « quota ».
- [x] Tests unitaires : agrégats sur un journal fixe, périodes, reprise (sans doublon, filles,
      branches, bascule d'agent), CSV, remise à zéro.
- [x] e2e avec l'agent factice : deux tours, la page les montre ; changement de période et
      d'agent ; remise à zéro puis un tour de nouveau compté ; captures clair, sombre, anglais.

## Plan

### Main

1. **Base** (`usage-db.ts`) : migration 2, table `meta (key TEXT PRIMARY KEY, value TEXT)` pour le
   drapeau de reprise ; `insertMissing(rows)` (`INSERT … ON CONFLICT DO NOTHING`, rend le nombre
   ajouté), `clear()` (`DELETE FROM turns`, `VACUUM` : rien ne reste sur le disque ; `meta`
   gardée, la reprise ne revient pas), `meta(key)` / `setMeta(key, value)`.
2. **Journal** (`journal.ts`) : `forgetWritten()` après une remise à zéro — un coût de Bob annoncé
   après coup ne ressuscite pas la ligne effacée ; les tours **en cours** restent suivis et seront
   écrits à leur fin.
3. **Statistiques** (`usage/stats.ts`, pur, à côté de `report.ts`) : `periodRange(period, now)`
   (minuit local ; 7 j et 30 j comptent aujourd'hui), `usageStats(rows, query, context)` →
   `UsageStats` (type partagé `src/shared/usage-stats.ts`) : totaux (échanges, conversations,
   durée, jetons, coûts par unité, tours sans jetons, tours sans coût), jours de la période (jours
   vides compris) avec une cellule par série (agent et modèle : échanges, jetons, coûts par
   unité), séries avec leur emplacement de couleur, lignes par modèle, par projet, dix
   conversations, agents du journal (pour le filtre, sur toute la durée).
   - **Couleurs** : un agent prend l'emplacement déclaré par son profil (`chartSlot` : Bob 0,
     OpenCode 1, agent factice 2) ; un modèle, son rang dans la liste triée de **tous** les
     modèles du journal (pas de la période) ; au-delà de trois, la série « Autres » (gris).
   - **Jetons traités** = entrée + sortie (comme la maquette : 3,2 M = 2,9 M + 0,3 M).
   - Conversations : classées par échanges, puis jetons ; titre lu dans l'index des conversations
     (« Conversation supprimée » sinon, non cliquable).
4. **Reprise** (`usage/import.ts`) : pour chaque conversation de l'index (archivées comprises),
   le fil lu sur le disque ; un tour par message de l'utilisateur daté (`at`), après le dernier
   élément `branch` (ce qui précède vient de l'origine) ; profil d'avant une bascule lu dans
   l'élément `handover` (`from`) ; jetons et coût du `TurnUsage` du même tour (fin entre ce
   message et le suivant) ; fin du tour = `at` du tour, ou de la dernière réponse ; outils par
   genre. Les `child-report` sont ignorés (la fille a son propre fil). `insertMissing` : un tour
   déjà dans le journal n'est pas compté deux fois. Drapeau `imported` posé dans `meta` après
   coup ; lancé une fois, en tâche de fond, au démarrage.
5. **CSV** (`usage/csv.ts`, pur) : par tour (une ligne par ligne du journal) et par jour (une
   ligne par jour, une colonne de coût par unité) ; en-têtes techniques en anglais (données,
   comme un export de journal, ADR-0014) ; RFC 4180, champs commençant par `= + - @` protégés.
6. **IPC** (`usage/usage-ipc.ts`) : `usage:stats(query)`, `usage:export(query, 'turns' | 'days')`
   (« Enregistrer sous », `dialogs.ts` : `saveCsv`), `usage:reset()`, `usage:spends()` (dépense
   sur ce Mac de chaque agent dont le profil sait la lire) ; les canaux existants
   `usage:quotas`, `usage:refreshQuota` y déménagent ; `usage:agentSpend` (puce) est retiré.
   Arguments vérifiés (`parseUsageQuery`) ; émetteur vérifié par `registerIpcHandlers`.
7. **Branchement** (`usage/setup.ts`, `index.ts`) : `setupUsageJournal` rend aussi le service du
   tableau ; `index.ts` ne prend que les dépendances (≤ 850 lignes).

### Renderer

8. **Onglet** : `'usage'` en tête du 3e groupe (`SETTINGS_GROUPS`), icône `ChartColumn`,
   `settings.section.usage`, entrées de l'`INDEX` (consommation, coût, jetons, quota, remettre à
   zéro, export).
9. **Page** (`components/settings/usage/`) : `UsageSettings.tsx` (filtres, chiffres clés, cartes),
   `UsageChart.tsx` (SVG : grille, barres empilées à coins arrondis et filet de 2 px entre
   segments, axe des jours, infobulle au survol d'un jour ; mise à l'échelle « jolie »),
   `UsageTables.tsx` (par modèle, par projet, conversations), `UsageReset.tsx` (carte
   « Historique », `ConfirmRow`), `usage-view.ts` (formats purs testés : durées, jetons, coûts par
   unité, séries « Autres »).
10. **Puce** (`UsageMeter.tsx`) : la dépense « sur ce Mac » sort ; un lien « Toute la
    consommation… » ouvre l'onglet (`onOpenUsage`, comme `onOpenMcpSettings`).
11. **Conversation** : un clic sur une ligne des conversations ferme les réglages et l'ouvre
    (`onOpenConversation`).
12. **Thème** : `chart` (trois couleurs) et `chartOther` dans `ThemeTokens` (`--chart-1…3`,
    `--chart-other`), clair `#c96442 #4a78c2 #0f9d8a`, sombre `#cf6b48 #5a85cc #14a893` (Sépia et
    Nuit noire reprennent clair et sombre), vérifiés par le validateur de palette (trois couleurs
    toutes paires : daltonisme ΔE ≥ 6,9 avec le filet entre segments et la légende, vision normale
    ≥ 15) ; `themes.test.ts` : 3:1 sur les fonds des cartes. `pnpm themes-css`.

### Tests et e2e

13. Unitaires : `stats.test.ts` (journal fixe : totaux, unités séparées, jours locaux, jours vides,
    séries et couleurs fixes, « Autres », projets, conversations ; périodes), `import.test.ts`,
    `csv.test.ts`, `usage-db.test.ts` (migration 2, `insertMissing`, `clear`), `journal.test.ts`
    (`forgetWritten`), `usage-ipc.test.ts` (arguments), `usage-view.test.ts`, tests des réglages
    (13 onglets, index), `themes.test.ts`.
14. e2e `usage-board` (`e2e/suites/usage-board.mjs`) : agent factice, deux tours, l'onglet les
    montre (chiffres, une barre, tableaux), période et agent, export (fichier écrit par un
    « Enregistrer sous » simulé), remise à zéro, un tour de plus compté ; captures clair, sombre
    et `--lang en`. Suites jouées aussi : `usage`, `usage-bob`, `quota`, `settings`.

Pas de nouvelle dépendance.

## Journal

### 2026-10-24 — plan

Fiche créée, plan écrit avant de coder.

### 2026-10-24 — fait

- **Fait** : tout le plan. Main : `usage-db.ts` (migration 2 `meta`, `insertMissing`, `clear` +
  `VACUUM` + `wal_checkpoint`, `series`, `meta`/`setMeta`), `journal.ts` (`forgetWritten`),
  `stats.ts`, `import.ts`, `csv.ts`, `usage-ipc.ts`, `setup.ts` (service `UsageBoard`, reprise
  lancée une fois en tâche de fond), `dialogs.ts` (`saveCsv`), `chartSlot` dans les profils (Bob 0,
  OpenCode 1, agent factice 2). Renderer : `components/settings/usage/`, `usage-board.ts`,
  `usage-board.css`, onglet `usage` et son index de recherche, lien « Toute la consommation… » dans
  la puce. Jetons `CHART` / `--chart-1…3`, `--chart-other` dans `themes.ts` (CSS régénéré).
  `index.ts` reste à 850 lignes (l'historique est passé tel quel à `setupUsageJournal`) ; aucun
  plafond ESLint relevé.
- **Couleurs** : validées avec le validateur de palette (skill dataviz), toutes paires, sur les fonds
  des cartes des quatre palettes : vision normale ≥ 15, daltonisme ΔE 6,9 à 10 (bande « avec
  encodage secondaire » pour la troisième : filet de 2 px entre segments, légende, infobulle,
  tableau). `themes.test.ts` vérifie 3:1 sur `surface`.
- **Tests** : `stats.test.ts` (journal fixe : totaux, unités séparées, jours locaux et vides, tour
  à 23 h 59, changement d'heure, couleurs fixes quel que soit le rang, « Autres », modèles rangés
  sur tout le journal, projets, conversations supprimées, dix au plus), `import.test.ts` (fin et
  jetons du tour, tour au-delà des 100 gardés, branche, compte rendu de fille, bascule d'agent,
  sans doublon avec le journal, une seule fois, même après une remise à zéro, fil illisible),
  `csv.test.ts`, `usage-db.test.ts` (migration d'une base v1, `insertMissing`, remise à zéro qui ne
  laisse rien dans les fichiers), `journal.test.ts` (coût de Bob après une remise à zéro, tour en
  cours compté), `usage-ipc.test.ts` (arguments), `setup.test.ts` (vrai gestionnaire : deux tours,
  filtre d'agent, CSV, dépense des agents installés, remise à zéro puis un tour compté),
  `usage-board.test.ts`, `UsageSettings.test.tsx` (chiffres, graphique, infobulle, regroupement,
  métrique, période, agent, tableaux, quota et dépense, export, remise à zéro, index de recherche),
  `settings-search.test.ts` (13 onglets ; « consommation », « coût », « jetons », « quota »).
- **e2e** : nouvelle suite `usage-board` (deux tours, chiffres, une barre, légende, tableaux,
  infobulle, « Tout », filtre d'agent, export par tour et par jour, remise à zéro, un tour de plus
  compté, clic sur une conversation) ; `settings` (13 onglets), `usage` (lien vers le tableau au
  lieu de l'absence de dépense) et `fun` (dépense de l'agent factice lue dans Réglages ›
  Consommation) adaptées. Jouées en clair et en sombre : `usage-board`, `usage`, `usage-bob`,
  `quota`, `settings`, `fun` ; `usage-board` aussi en `--lang en`. Captures regardées :
  `137-consommation`, `137b-remise-a-zero` (fr et en), `e3-bobcoins` ; fidèles à la maquette.
- **Écarts au plan et à la maquette** :
  - Le quota n'était pas dans la puce (il est sous le nom de l'agent dans la barre latérale, fiche
    091, et y reste : c'est la jauge de tous les jours) ; la page l'ajoute, avec la dépense sur ce
    Mac, qui, elle, quitte la puce. Carte « {agent} sur ce Mac » pour chaque agent **installé**
    dont le profil sait lire quota ou dépense ; sur une machine où Bob est installé, sa carte
    s'ajoute à celle de l'agent factice pendant les essais.
  - En-tête du graphique : un choix « Agents | Modèles » s'ajoute à « Échanges | Jetons | Coût » ;
    avec plusieurs unités, « Coût » devient un bouton par unité (« Coût (bobcoins) », « Coût ($) »),
    sans coût dans la période il disparaît. La pastille de « Par modèle » prend la couleur de la
    série du regroupement affiché.
  - « Conversations les plus longues » devient « Conversations qui ont le plus consommé », rangées
    par échanges puis jetons (seule mesure comparable entre agents) ; l'infobulle donne agent,
    jetons et coût.
  - Carte « Coût » : avec une seule unité, le coût moyen par échange en sous-titre ; avec plusieurs,
    « et 0,02 $US (OpenCode) ».
  - « Exporter… » ouvre un petit menu (une ligne par échange, ou par jour), pour la période et
    l'agent affichés ; l'aide de « Remettre à zéro » dit d'exporter la période « Tout ». Le menu est
    rendu dans la fenêtre des réglages (sans portail) : porté au-dehors, le piège de focus du
    dialogue le refermait aussitôt (vu en e2e).
  - L'aide de la remise à zéro parle du « quota des agents, comme celui d'IBM Bob » : le texte reste
    vrai pour un autre agent à quota.
  - `report.ts` (fiche 130) est gardé pour `localDay` et les tests du journal ; le tableau passe par
    `stats.ts`, plus complet (jours vides, séries, conversations).
  - Jetons traités = entrée + sortie, comme la maquette (le cache et la réflexion restent dans le
    CSV). Les barres font au plus 28 px de large (« Aujourd'hui », « Tout » sur peu de jours).
  - Le graphique de « Tout » reste par jour, quelle que soit la durée (barres de 1 px au-delà de
    quelques mois) ; un regroupement par semaine ou mois sera à voir à l'usage.
- **Compatibilité Bob** : rien de nouveau par ACP ; la page lit le journal (fiche 130) et les
  adaptateurs déjà déclarés dans le profil (`quotaSource`, `costSource.spend`, ADR-0015, ADR-0017).
  `chartSlot` n'est pas une fonction propre à un agent (seulement sa couleur) : rien à ajouter à la
  matrice de `docs/agents.md`. Pas de nouvelle dépendance, pas d'ADR (choix déjà pris par l'étude et
  la maquette : SVG fait maison, SQLite de la fiche 130).
- **À vérifier à la vraie souris** (fin des vagues) :
  1. Puce de consommation → « Toute la consommation… » : le détail se ferme, Réglages ›
     Consommation s'ouvre, onglet en tête du 3e groupe.
  2. Survol du graphique sur 30 jours avec de vraies données Bob et OpenCode : infobulle lisible,
     à gauche du jour dans la moitié droite, bande de survol, rien qui ne déborde de la carte ;
     elle disparaît en quittant le graphique.
  3. Redimensionner la fenêtre : le graphique suit la largeur (texte net, pas étiré), les chiffres
     clés passent sur deux colonnes en fenêtre étroite, les tableaux ne débordent pas.
  4. « Exporter… » : le menu s'ouvre sous le bouton, « Enregistrer sous » propose Documents et
     `bobine-turns-AAAA-MM-JJ.csv` ; ouvrir le CSV dans Numbers (accents, colonnes de coût par
     unité).
  5. « Remettre à zéro… » : la ligne de confirmation, Échap la referme sans fermer les réglages,
     « Remettre à zéro » vide le tableau ; un échange de plus (avec Bob : son coût arrive après la
     réponse) est compté, et l'ancien coût de Bob ne revient pas.
  6. Clic sur une conversation du tableau (y compris archivée) : les réglages se ferment, elle
     s'ouvre.
  7. Premier lancement sur un vrai historique : les anciennes conversations apparaissent une seule
     fois (relancer l'app : mêmes chiffres), branches et filles comptées sans doublon.
  8. Couleurs en Sépia et Nuit noire ; IBM Bob (orange) et OpenCode (bleu) gardent leur couleur
     quand on filtre sur un seul agent ; par modèle, « Autres » au-delà de trois.
  9. Recherche des réglages : « coût », « jetons », « quota », « remettre à zéro ».
