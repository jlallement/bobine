# 131 — Barre latérale : sections, dossiers, filles reliées à leur mère

- **Statut** : fait (reste l'essai à la vraie souris, par la session de coordination)
- **Dépend de** : 125 (grille, « À traiter » sobre), 119 (« À traiter »), 113 (largeur réglable),
  097 (filles), 095 (liste figée sous le pointeur), 077 (épinglées), 050, 023 (branches)
- **Agents** : les deux. Rien ne dépend de l'agent : sections, dossiers et filles se lisent dans
  `ConversationSummary` (ADR-0011).
- **Reprend** : lots 133 (« sections lisibles ») et 134 (« dossier = projet ») de l'étude du
  23 octobre (`docs/feuille-de-route-2026-10-23.md`, itération 3). Le journal de la relecture des
  maquettes (§ 0) fait foi.

## Pourquoi

> Évolution du 2026-10-26 — fiche 149 : trois sections restent (Épinglées, Récents/Dossiers,
> Archivées). Les filles restent directement sous leur mère, sans repli de famille, même quand
> elle est épinglée. Leur lancement révèle section et dossier ; une préparation est visible
> pendant la création du worktree. Le dessin des liens mère-filles est inchangé.

Après usage réel, la barre latérale est jugée fouillis : les en-têtes de section sont plus discrets
que les dossiers, « Archivées » est dessiné comme un dossier au milieu de la liste, survol et
sélection ont la même couleur, il y a des chiffres partout, et chaque fille en worktree fait son
propre dossier (« 20261023-1747-ef93 »), loin de sa mère. La colonne d'icône, souvent vide, mange
30 px de titre, et une fille n'est pas plus à droite que sa mère.

## Maquette validée

Planche « Maquettes de Bobine », section « Barre latérale »
(maquette privée, non publiée), validée par Jérôme le 23/10 après relecture
ligne à ligne. HTML et CSS exacts : `e2e/maquettes/parts.mjs` (`sidebar`) et
`e2e/maquettes/styles.mjs` (`.mq-sb`, `.mq-sec`, `.mq-folder`, `.mq-tree`…) ; captures
`e2e/captures/maq-barre-*` (`pnpm build && node e2e/maquettes/run.mjs light barre`).

## Critères d'acceptation

- [x] **Zone fixe** : « Nouvelle conversation » et « Rechercher ⌘K » ne défilent pas avec la liste ;
      un filet apparaît sous elles seulement quand la liste a défilé.
- [x] **Quatre sections, dans cet ordre** : À TRAITER (jamais repliable), ÉPINGLÉES, RÉCENTS ou
      DOSSIERS selon le mode, ARCHIVÉES (toujours en dernier, repliée par défaut).
- [x] **En-têtes de section** : petites capitales, 11 px, graisse 600, espacement 0,05 em, `--muted`,
      20 px au-dessus (8 px pour la première). Chaque section (sauf À traiter) se replie au clic,
      chevron à droite (visible replié ou au survol) ; repli gardé sur ce poste ; une section vide
      n'est pas affichée.
- [x] **Un seul compteur** : « À TRAITER · N ». Plus de compteur sur les dossiers ni sur les archives.
- [x] **En-tête de dossier** : pas d'icône ; nom en 13 px, 600, `--text`, 12 px au-dessus (2 px sous
      l'en-tête de section) ; chevron ▾ / ▸ toujours visible juste après le nom ; pas de fond au
      survol ; repli gardé ; un dossier replié n'affiche que son nom (en `--muted`).
- [x] **Titres au bord** : plus de colonne d'icône vide. Les titres des conversations partent du
      bord, sur la verticale du nom de dossier et des en-têtes de section.
- [x] **Filles** : seules elles gardent la colonne (20 px + 10 px), avec un lien SVG : trait fin qui
      part un peu sous le titre de la mère, coude arrondi, petite flèche vers chaque fille ; sous la
      dernière, le trait s'arrête au coude. Un seul niveau de décalage.
- [x] **Branches** (« Repartir de ce message ») : plus rangées sous leur origine ; conversations à part
      entière, repère « branche » gardé ; origine dans l'infobulle et dans l'en-tête de la
      conversation (« ↳ branche de « … », qui y ramène).
- [x] **Dossier = projet** : `ConversationSummary.project` (racine du dépôt pour un worktree,
      `workspace` sinon) ; le mode Dossiers regroupe par projet ; une fille va dans le dossier de sa
      mère. Aucun dossier ne porte le nom d'un worktree.
- [x] **États à droite** : roue (en cours), coche verte (fille finie ; le mot reste dans l'infobulle et
      pour les lecteurs d'écran), sinon le jour en texte pour une conversation d'avant aujourd'hui
      (« hier », « lun. », « 12 oct. »). L'icône git des worktrees quitte la ligne (branche dans
      l'infobulle).
- [x] **À traiter** : l'icône de la raison passe devant la seconde ligne ; le titre reste au bord ;
      temps écoulé à droite.
- [x] **Alignement à droite** : icône de filtre de Récents / Dossiers, chevron d'Archivées, états des
      lignes, temps écoulé et ⌘K sur une même verticale.
- [x] **Survol et sélection** : deux couleurs distinctes (survol : `--surface-3` à 40 % sur
      `--sidebar` ; sélection : `--surface-3`).
- [x] **Rien ne se perd** : menu « … » au survol (Renommer, Épingler, Ouvrir à côté, Lancer en
      parallèle…, Exporter en Markdown / JSON, Archiver, Supprimer), redimensionnement, ⌘K, choix
      Récents / Dossiers (menu du filtre), infobulles, ligne « À traiter » qui disparaît une fois lue,
      liste figée sous le pointeur (fiche 095).
- [x] Textes : « Par dossier » devient « Dossiers » ; clés en français et en anglais.
- [x] Testé : composants (`Sidebar.test.tsx` : sections, repli gardé, conversation qui se met à
      attendre visible dans À traiter même section d'origine repliée, dossiers par projet, filles en
      worktree sous leur mère et dans son dossier, lien SVG, branches à plat, titres au bord, états
      à droite) ; unitaires (`helpers.test.ts` : `project` ; `history-order.test.ts`) ; e2e contre
      l'agent factice, clair et sombre : `inbox` (grille mesurée), `history`, `touches`, `branch`,
      `filles` (deux filles en worktree dans le dossier de leur mère), `filles-fusion`,
      `worktree-cycle`, `parallel`, `notifications`, `base`, `restart` (repli des sections et des
      dossiers gardé après ⌘Q).
- [ ] Essai à la vraie souris : fait par la session de coordination (voir « À vérifier à la souris »).

### Acceptations de la fiche 125 qui changent

- « Chaque ligne a un emplacement d'icône de 20 px, vide ou non » : **remplacé**. Plus de colonne
  vide ; seules les filles sous leur mère l'ont. « Nouvelle conversation » et « Rechercher » gardent
  leur pastille, leurs libellés ne sont plus sur la verticale des titres de la liste.
- « Une branche sous sa ligne d'origine garde la grille (↳ dans l'emplacement) » : **remplacé**. Les
  branches ne sont plus rangées sous leur origine ; la flèche ↳ disparaît de la liste.
- « En-têtes "À traiter · N" et "Récents" de même style (11,5 px, 500) » : **remplacé** par le style
  des sections (11 px, 600, petites capitales). Ils restent identiques entre eux.
- « Icône de raison dans l'emplacement » : elle passe devant la seconde ligne.

## Plan

**Main** (`src/main/conversations/helpers.ts`, `src/shared/agent.ts`)
- `ConversationSummary.project?: string` (racine du projet) ; `summaryOf` le pose :
  `record.worktree?.root ?? record.workspace`. Facultatif pour les données d'essai (`workspace` à
  défaut).

**Ordre et regroupement** (`history-order.ts`)
- `nestBranches` devient `nestChildren` : seules les filles (`startedFrom`) suivent leur mère ;
  `HistoryRow` gagne `first` / `last` (dessin du lien). Les branches restent à leur place.
- `byProject(items)` : groupes par `project ?? workspace`, une fille dans le groupe de sa mère
  quand celle-ci est dans la section (même si la mère est dans un sous-dossier du dépôt).

**Barre** (`Sidebar.tsx`, nouveau `SidebarSection.tsx`, `HistoryItem.tsx`, `InboxSection.tsx`)
- `.sidebar-body` en deux zones : `.sidebar-fixed` (Nouvelle conversation, Rechercher), filet si la
  liste `.sidebar-scroll` a défilé (`scrollTop > 0`).
- `SidebarSection` : en-tête (bouton de repli `aria-expanded`, outils, chevron) et contenu ; repli
  gardé dans `localStorage` (`bob:sections-repliees` ; Archivées garde `bob:archives-ouvertes`).
  À traiter : en-tête sans repli, « À traiter · N ».
- Dossiers : `FolderGroup` sans icône ni compteur, chevron après le nom, repli gardé
  (`bob:dossiers-replies`, mêmes chemins qu'avant pour un dossier hors worktree).
- `HistoryItem` : `.row-slot` seulement pour une fille sous sa mère, avec `ChildLink` (SVG de la
  maquette) ; plus de `RowIcon` (↳, git) ; branche du worktree et état d'une fille dans l'infobulle ;
  `RowMeta` : état de fille (roue grise, coche verte…), roue, pastille d'action, sinon jour
  (`rowDay`) ; dans À traiter, `InboxStateIcon` devant la raison.
- `GroupingMenu` et `NotificationsBlocked` sortent dans `SidebarMenus.tsx` (taille du fichier).
- En-tête de la conversation (`App.tsx`) : « ↳ branche de « … » pour une branche, comme « ↳ depuis »
  pour une fille, qui ramène à l'origine quand elle est dans la liste.

**Styles** (`styles.css`, règles de la barre latérale seulement) : `.sidebar-fixed`,
`.sidebar-scroll`, `.sidebar-section` (petites capitales), `.section-toggle`, `.section-chevron`,
`.folder-head` (refait), `.child-link`, survol distinct, `.inbox-line .inbox-state`, `.row-day`.

**Textes** (`fr.json`, `en.json`) : `sidebar.byFolder` « Dossiers » ; options du filtre « Récents » /
« Dossiers » ; `sidebar.toggleSection`, `sidebar.today` …, `conversationTitle.branchFrom`.

**Essais** : `Sidebar.test.tsx`, `history-order.test.ts`, `helpers.test.ts` ; e2e `inbox` (grille
refaite : titres au bord, filles à +30 px, marge droite commune), `history` (Dossiers, repli),
`touches` (Archivées sans compteur), `branch` (branches à plat), `filles` (dossier de la mère),
`parallel` (plus d'icône git), `restart` (repli gardé après ⌘Q).

Pas de nouvelle dépendance.

## À vérifier à la souris (session de coordination)

- Survol d'une ligne : fond plus clair que la sélection ; « … » apparaît par-dessus l'état, son menu
  complet s'ouvre (fille comprise) et la liste ne bouge pas pendant qu'il est ouvert.
- Repli : clic sur un en-tête de section (Épinglées, Récents / Dossiers, Archivées) et sur un nom de
  dossier ; chevron au survol des en-têtes ; repli retrouvé après ⌘Q.
- Défilement : la zone du haut reste en place, le filet apparaît dès que la liste défile.
- Redimensionnement de la barre (poignée, double-clic) : titres coupés proprement, chevron du dossier
  toujours collé au nom, lien des filles intact.
- Filtre de Récents : menu Récents / Dossiers / Reprendre une session… ; icône alignée sur les états.

## Journal

- 2026-10-23 — Fiche créée d'après la planche validée et le journal de la relecture ; plan écrit.
- 2026-10-23 — **Fait** (branche `claude/fiche-131-barre-laterale-45ffc0`, non poussée).
  - Main : `ConversationSummary.project` posé par `summaryOf` (`worktree.root` ou `workspace`).
  - `history-order.ts` : `nestChildren` (filles seulement, un niveau, `first` / `last` pour le
    lien) remplace `nestBranches` ; `byProject` (une fille dans le groupe de sa mère).
  - `SidebarSection.tsx` (nouveau) : `SidebarSection`, `FolderGroup`, `useFoldedSet`,
    `readLocal` / `writeLocal` ; `SidebarMenus.tsx` (nouveau) : `GroupingMenu` et
    `NotificationsBlocked` sortis de `Sidebar.tsx` (372 lignes au lieu de 520).
  - `HistoryItem.tsx` : `.row-slot` seulement pour une fille sous sa mère, avec `ChildLink` (SVG de
    la maquette) ; `RowIcon` (↳, git) supprimé ; branche du worktree et état d'une fille dans
    l'infobulle, `data-branch` sur la ligne ; jour à droite (`rowDay`, `time.ts`).
  - `InboxSection.tsx` : en-tête dans une section non repliable ; icône de raison (12 px) devant la
    seconde ligne, coche verte pour un compte rendu ou une réponse à lire.
  - En-tête de la conversation : `BranchOrigin` (« ↳ branche de « … », ramène à l'origine).
  - Repli gardé : `bob:sections-repliees` (Épinglées, Récents / Dossiers), `bob:dossiers-replies`
    (chemins des projets), `bob:archives-ouvertes` (inchangé, Archivées repliée par défaut).
  - **Écarts à la maquette et au plan** :
    - Le chevron d'une section vient **avant** ses outils (maquette : après). Sinon le filtre de
      Récents glisserait de 15 px vers la gauche au moment où le pointeur va le chercher (le
      chevron n'apparaît qu'au survol). Archivées, sans outil, a bien son chevron sur la marge
      droite.
    - « Sinon une heure en texte » : seule une conversation d'avant aujourd'hui affiche son jour
      (« hier », « lun. », « 12 oct. ») ; celles du jour n'affichent rien, comme sur la maquette
      (seule « Plan de migration », d'hier, y a « hier »). Le temps écoulé reste dans À traiter.
    - La coche d'« À traiter » pour ce qui est fini et à lire devient verte (maquette), au lieu du
      gris de la fiche 125.
    - L'icône git des conversations en worktree quitte la ligne (la colonne de gauche est réservée
      au lien des filles) ; la branche est dans l'infobulle.
    - Options du filtre : « Récents » et « Dossiers » (avant : « Les plus récentes d'abord », « Par
      dossier de travail »), les mots de l'en-tête de section.
    - Une fille dont la mère est dans un sous-dossier du dépôt va quand même dans le dossier de sa
      mère (`byProject` suit le lien plutôt que le seul chemin).
  - **Vérifié** : `./scripts/verify` vert. `pnpm build && pnpm e2e --changed` : 110 tâches (toute la
    suite : `styles.css`, `Sidebar.tsx`, `App.tsx` et `shared/agent.ts` sont partagés), 107 vertes ;
    `handover` (clair et sombre, délai du menu « Continuer avec ») et `branch` clair en échec sous
    la charge (d'autres sessions jouaient leurs e2e), verts rejoués seuls (`--jobs 1`), `branch`
    aussi vert juste avant. Captures regardées et comparées à la maquette, en clair et en sombre :
    `inbox-1-a-traiter`, `inbox-3-traite`, `filles-5-dossiers` (nouvelle), `91-historique`,
    `a4-branches-a-plat` (renommée), `d2-archivees`.
  - **Pas fait** : l'essai à la vraie souris (laissé à la session de coordination, voir « À
    vérifier à la souris »).
