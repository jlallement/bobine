# 119 — « À traiter » : les conversations qui vous attendent, en tête de liste

- **Statut** : fait (essai réel du Dock et des bannières à faire sur l'app installée, voir le journal)
- **Dépend de** : 024 (notifications, suivi de l'attention), 068 (son), 095 (ordre figé), 097
  (conversations filles), 101 (rebond du Dock)
- **Agents** : les deux. C'est l'état des conversations qui compte, pas l'agent.

## Pourquoi

> Évolution du 2026-10-26 — fiche 149 : la section « À traiter » est retirée pour garder les
> familles ensemble. Les états sont des icônes sur place avec infobulle. Le suivi d'attention,
> le compteur du Dock et les notifications groupées de cette fiche sont conservés.

Avec plusieurs conversations et leurs filles en parallèle, ce qui attend l'utilisateur (une
autorisation, une question, une réponse ou un compte rendu à lire, une erreur) est éparpillé dans
la liste : il faut lire les icônes une à une. Le Dock rebondit, mais son badge compte sans dire
quoi, et des filles lancées ensemble font une rafale de bannières.

## Maquette validée

1. **Section « À traiter · N »** en tête de la barre latérale, après « Rechercher », avant les
   épinglées : libellé accent 12 px, badge rond accent avec le nombre. Une ligne par conversation
   qui attend, sur deux lignes : titre avec l'icône d'état (main : autorisation ou question ; coche
   verte et point accent : réponse ou compte rendu à lire ; alerte : erreur), puis en 12 px
   `--muted` la raison et le temps écoulé (« Autorisation : écrire src/main/app-windows.ts ·
   2 min », « Question : OAuth ou mot de passe ? · 14 min », « Compte rendu à lire · fille de
   « Lots d'octobre » », « Réponse à lire · 5 min », « Erreur de l'agent · 1 min »).
   Ordre : ce qui bloque l'agent (autorisations, questions…), puis les erreurs, puis ce qui est à
   lire ; dans chaque groupe, le plus ancien d'abord. Une conversation n'apparaît qu'une fois ; les
   filles y sont à plat. Section absente quand il n'y a rien. Clic et menu « … » comme une ligne
   normale ; ordre figé sous le pointeur (fiche 095). La conversation active y reste tant qu'elle
   attend.
2. **Badge du Dock** : le nombre de conversations « À traiter », calculé par le main avec la même
   fonction que la barre latérale ; effacé à zéro. Réglages › Général : « Compteur sur l'icône du
   Dock » (activé par défaut), cherchable.
3. **Notifications groupées** : plusieurs conversations qui finissent ou attendent dans la même
   fenêtre de 3 s font une seule bannière (« 3 conversations filles ont fini », « 2 conversations
   attendent votre accord », titres en corps) ; une seule : la bannière d'aujourd'hui. Son et
   rebond une fois par groupe.

## Critères d'acceptation

- [x] Section « À traiter · N » : lignes sur deux lignes, raison et temps écoulé, ordre (bloquant,
      erreurs, à lire ; plus ancien d'abord), une seule apparition par conversation, filles à plat
      avec leur mère dans la raison, absente quand rien n'attend.
- [x] Clic, menu « … », ordre figé sous le pointeur ou menu ouvert ; conversation active gardée
      tant qu'elle attend.
- [x] Badge du Dock = nombre de la section, posé par le main, effacé à zéro ; réglage « Compteur sur
      l'icône du Dock » (grisé et coupé avec les notifications, comme le rebond) ; rien ne casse
      sans `app.dock`.
- [x] Une seule règle : `src/shared/inbox.ts` sert au main (badge) et à la barre latérale.
- [x] Bannières groupées par fenêtre de 3 s ; une seule conversation : bannière inchangée ; son et
      rebond une fois par groupe.
- [x] Testé : unitaires (`inbox.ts`, regroupement à horloge factice, badge avec un Dock factice) ;
      e2e `inbox` (autorisation, question, deux filles finies non lues, bannière groupée, badge lu
      depuis le main, section qui disparaît une fois tout traité), clair, sombre, `--lang en`.

## Plan

**Ce que sait le main.** `AttentionTracker` (`main/notifications/attention.ts`) ne rend que le type
d'attente par conversation. Il garde en plus, par conversation, la raison et son détail :
autorisation (titre de l'outil), question (texte de la question), connexion, dossier à approuver,
« Enregistrer sous », boîte de page, réponse à lire, erreur, et depuis quand. Nouveau type partagé
`AttentionDetails` (`shared/attention.ts`), envoyé à côté de `AttentionState` (qui ne change pas :
`childState`, `activeChildren` et la carte « Sous-tâches » continuent de le lire).

**Règle unique** — `shared/inbox.ts` (pur, testé) :
- `inboxEntries(conversations, attention, details)` : les conversations listées (pas les brouillons)
  qui attendent, triées (bloquant, erreur, à lire ; plus ancien d'abord), avec leur mère ;
- `inboxReason(entry)` et `inboxAgo(ms)` : les libellés (clés i18n `inbox.*`) ;
- `heldInbox(current, held)` : la section figée sous le pointeur (fiche 095) : mêmes lignes, même
  ordre, une ligne qui n'attend plus reste jusqu'à la sortie du pointeur, une nouvelle attend sa
  place habituelle.

**Interface** — `components/sidebar/InboxSection.tsx` (en-tête, horloge de 30 s, lignes) ;
`Sidebar.tsx` retire les conversations de la section des autres et passe ses lignes à
`HistoryItem` (deuxième ligne, icône d'état) ; `styles.css`.

**IPC** — `attention:details` (invoke) et évènement `attention:detailsChanged` ; preload, renderer
(`useConversations`), `App.tsx`.

**Badge** — `main/notifications/dock-badge.ts` : `createDockBadge({ dock, enabled })`, posé
seulement quand il change, rien sans Dock ; appelé par `index.ts` à chaque changement de l'attention,
de la liste ou des réglages. `SystemNotifier.setBadge` et le badge du suivi disparaissent.
Réglage `dockBadge` (`shared/preferences.ts`, `main/settings*.ts`, Réglages › Général, index de
recherche, i18n).

**Regroupement** — `main/notifications/grouping.ts` : `NoticeGroups` (horloge injectée) ; deux
groupes, « attendent » et « ont fini » (réponse finie ou erreur) ; `open(kind)` dit si une fenêtre
de 3 s s'ouvre (son et rebond seulement alors), `push(notice)` met la bannière en attente, montrée à
la fin de la fenêtre : telle quelle si elle est seule, sinon une bannière groupée
(`groupedNotice`). Une conversation vue entre-temps sort du groupe. `SystemNotifier` : une bannière
peut porter plusieurs conversations (clic : la première ; retirée quand toutes ont été vues).
`BOBINE_NOTICE_GROUP_MS` élargit la fenêtre dans les essais.

**Essais** — `e2e/suites/inbox.mjs` (nouvelle suite, catalogue) ; suites `notifications`,
`filles`, `browser` adaptées (une conversation qui attend est dans la section). Dans les essais, la
fenêtre montrée sans le focus (`BOBINE_SHOW_INACTIVE`) compte comme au premier plan pour le suivi de
l'attention (comme sa page, fiche 106) : sinon chaque réponse finie irait dans « À traiter » dans
toutes les suites ; la suite `notifications` impose son propre focus.

Pas de nouvelle dépendance.

## Journal

- 2026-10-22 — Fiche créée d'après la maquette validée ; plan écrit.
- 2026-10-22 — Codé selon le plan (branche `claude/fiche-119-boite-reception-3ddbc2`, non poussée).
  - `shared/inbox.ts` : `inboxEntries`, `inboxCount`, `inboxReason`, `inboxAgo`, `inboxLine`,
    `heldInbox` ; `shared/attention.ts` : `AttentionReason`, `AttentionDetails`, `reasonKind`.
  - `AttentionTracker` garde la raison, le détail et le début de chaque attente (`details()`),
    émet état et détails ensemble ; le badge n'y est plus. Le détail d'une question est celui de la
    première question d'un questionnaire (`questionsOf`) : le message d'un `AskUserQuestion` ne dit
    que « Questions ».
  - `notifications/grouping.ts` (`NoticeGroups`, `groupedNotice`), `notifications/dock-badge.ts`
    (`createDockBadge`), branchés par `system-alerts.ts` ; `SystemNotifier` : une bannière pour
    plusieurs conversations (clic : la première ; retirée quand toutes ont été vues).
  - Barre latérale : `InboxSection.tsx` (en-tête, horloge de 30 s, `useHeldInbox`) ;
    `HistoryItem` rend la ligne sur deux lignes (icône d'état, point accent pour ce qui est à lire,
    raison) ; `data-mother` sur chaque ligne de fille. Réglage `dockBadge` (Réglages › Général,
    après le rebond, grisé et coupé avec les notifications ; recherche « compteur », « badge »…).
  - Tests : unitaires `inbox.test.ts`, `grouping.test.ts` (horloge factice), `dock-badge.test.ts`
    (Dock factice), `attention.test.ts` (détails, questionnaire, bannière groupée),
    `Sidebar.test.tsx` (section, ordre, clic, active gardée, figée sous le pointeur). e2e : nouvelle
    suite `inbox` (catalogue) ; `notifications`, `filles`, `browser` adaptées. Clair, sombre et
    `--lang en` verts ; captures `inbox-1-a-traiter`, `inbox-2-reglage-compteur`,
    `inbox-3-traite` regardées.
  - **Écarts au plan et à la maquette** :
    - Fille dans « À traiter » : sa mère remplace le temps écoulé (« Compte rendu à lire · fille de
      « … » »), comme sur la maquette ; le temps n'y est pas, faute de place.
    - Une ligne qui n'attend plus pendant que le pointeur est sur la liste reste dans la section
      (avec son ancienne raison) jusqu'à la sortie du pointeur ; une conversation qui se met à
      attendre garde sa place habituelle jusque-là. C'est l'ordre figé de la fiche 095 appliqué à
      l'appartenance aussi : sinon une ligne qui part décale toutes les autres sous le pointeur.
    - Le compteur du Dock reste coupé par la cloche des notifications, comme le rebond (fiche 101) :
      la case « Compteur sur l'icône du Dock » est grisée quand elles sont coupées.
    - Les brouillons ne comptent plus dans le badge (ils ne sont pas dans la liste) : une seule
      règle pour la liste et le Dock.
    - Une bannière seule part à la fin de sa fenêtre de 3 s, pas tout de suite : c'est ce qui
      garantit une seule bannière par groupe. Le son et le rebond, eux, partent tout de suite.
    - « N conversations attendent votre accord » quand ce sont toutes des autorisations ; sinon
      « … attendent votre réponse » (une question n'est pas un accord). « N conversations filles
      ont fini » quand ce sont toutes des filles ; sinon « N conversations ont fini », une erreur
      marquée « (erreur) » après son titre.
    - Essai e2e : les deux filles sont lancées par l'utilisateur (« Lancer en parallèle… »,
      `/scenario streaming-texte`), pas par le scénario `filles` : celui-ci réveille la mère, dont
      la réponse se mêlerait au groupe des filles. Fenêtre de groupe élargie à 12 s dans cette
      suite (`BOBINE_NOTICE_GROUP_MS`), réduite à 300 ms dans `notifications`.
    - Dans les essais, la fenêtre montrée sans le focus (`BOBINE_SHOW_INACTIVE`) compte comme au
      premier plan pour le suivi de l'attention : sans cela, toutes les suites voyaient chacune de
      leurs conversations passer dans « À traiter ».
  - À regarder à l'essai réel (app installée) : le compteur sur l'icône du Dock ; deux filles
    lancées ensemble, Bobine en arrière-plan → une seule bannière (si macOS les accepte, sinon un
    seul rebond et un seul son) ; le temps écoulé qui avance dans la section.
- 2026-10-23 — Écart, fiche 125 (maquette validée après la recette) : plus de pastille ni de coche
  verte ; titre en gras = non lu, icône par raison (accent : bloque, gris : à lire, rouge : erreur),
  temps écoulé à droite du titre, seconde ligne = la raison seule (la mère d'une fille passe dans
  l'infobulle), en-tête « À traiter · N » en texte, du style de « Récents ».
