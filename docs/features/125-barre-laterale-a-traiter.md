# 125 — Barre latérale : une grille, « À traiter » sobre, titres lisibles

- **Statut** : fait (reste l'essai à la vraie souris, voir le journal)
- **Dépend de** : 119 (« À traiter »), 095 (liste et fil), 107 (cartes d'outils lisibles), 023
  (branches), 108 (continuer avec un autre agent), 118 (contexte de session, `/split`)
- **Agents** : les deux. La grille et la section ne dépendent pas de l'agent ; le nettoyage des
  titres se déduit du protocole et de motifs génériques (chemins, `cd`, liste de tâches), rien ne
  teste l'identifiant d'un profil (ADR-0011).

## Pourquoi

> Évolution du 2026-10-26 — fiche 149 : « À traiter » est retiré ; les raisons passent dans les
> infobulles des icônes d'état. Le repère textuel « branche » devient une icône de fork. La grille
> des titres et le tracé arrondi des liens mère-filles sont conservés.

La campagne de recette d'octobre (PV OpenCode et Bob du 2026-10-23, synthèse) a relevé dans la
barre latérale trois signaux de non-lu (pastille, couleur, coche verte), des titres qui ne
s'alignent pas d'une section à l'autre, un compte en disque plein qui double celui du Dock, et
des titres bruts venus de Bob : « Autorisation : Applying diff to /Users/me/… », `cd
/chemin/absolu && npm test`, « Updating todo list · Autoriser cette action ? ». Pire, le texte que
Bobine joint au premier message (`<bobine_capabilities>`, `<child_conversations_request>`, contexte
d'une branche ou d'une bascule) devient le titre de la tâche chez Bob (D18), est cité par la carte
« Nouvelle branche de … » (D20) et remplace le titre de la conversation après « Continuer avec
Bob » ou une branche (D24). Enfin une branche et son original portent le même titre tronqué :
seule la flèche ↳ les distingue.

## Maquette validée

Canevas : maquette privée, non publiée (planches « Actuel » et « Proposé »,
sombre et clair), validé par Jérôme le 2026-10-23.

1. **Une seule grille pour toute la barre latérale** : chaque ligne a un emplacement d'icône fixe
   de 20 px, vide s'il n'y a rien, pour que tous les titres s'alignent sur la même verticale, dans
   « À traiter » comme dans « Récents » (et « Rechercher », « Nouvelle conversation »).
2. **Un seul signal de non-lu** : le titre en gras (600) et en couleur de texte pleine. La pastille
   violette (`attention-dot`) disparaît des lignes « À traiter ».
3. **L'icône dit pourquoi, sa couleur dit si ça bloque** : accent pour une question et une
   autorisation ; gris (`--muted`) pour « Réponse à lire » et « Compte rendu à lire » ; rouge pour
   une erreur. Plus de coche verte.
4. **Le temps écoulé à droite du titre** (« à l'instant », « 2 min »), aligné sur la marge droite
   commune au filtre de « Récents » et au ⌘K ; la seconde ligne ne garde que la raison.
5. **Les en-têtes des deux sections ont le même style** (celui de « Récents » : 11,5 px, 500,
   `--muted`) et le compte s'écrit « À traiter · 2 » en texte, pas en disque plein (le Dock porte
   déjà le chiffre).

## Critères d'acceptation

- [x] Grille : chaque ligne de la liste (À traiter, épinglées, Récents, par dossier, archivées) a un
      emplacement d'icône de 20 px, vide ou non, au même endroit que les icônes de « Nouvelle
      conversation » et « Rechercher » ; écart de 10 px avant le titre. Une branche ou une fille
      sous sa ligne d'origine garde cette grille (↳ dans l'emplacement, pas de retrait).
- [x] « À traiter » : plus de pastille ; titre en gras et en couleur pleine ; icône de raison
      (question, autorisation et autres demandes : accent ; réponse et compte rendu à lire : gris ;
      erreur : rouge) ; temps écoulé à droite du titre ; seconde ligne = la raison seule ; la mère
      d'une fille dans l'infobulle.
- [x] En-têtes « À traiter · N » et « Récents » de même style ; compte en texte ; le filtre de
      « Récents », le ⌘K et le temps écoulé sur la même marge droite. Le menu « … » d'une ligne
      apparaît au survol par-dessus le temps.
- [x] Titres d'outils (cartes, « À traiter », notifications, indicateur d'activité) : un chemin
      absolu sous le dossier de la conversation devient relatif ; une commande `cd <dossier> && …`
      perd son `cd` quand il mène au dossier de la conversation (relatif sinon) ; un outil de liste
      de tâches (`rawInput.todos`) se lit « Mise à jour de la liste de tâches (N) », la liste en
      infobulle. Générique : motifs de chemins, de commandes et d'entrées, pas de profil.
- [x] Préambule de Bobine : tout ce que Bobine joint à un message (`<child_conversations_request>`,
      échange d'une bascule ou d'une branche, nouvelles des filles, message d'une autre
      conversation) part **après** le texte de l'utilisateur, comme `<bobine_capabilities>` ; un
      titre proposé par l'agent est coupé au premier bloc de Bobine, ignoré s'il ne reste rien ;
      après une branche ou « Continuer avec… », le titre de la conversation n'est plus remplacé par
      celui de l'agent ; la carte « Nouvelle branche de … » et « Reprendre une session… » n'en
      montrent jamais.
- [x] Branche et original distinguables : repère « branche » visible même quand le titre est
      tronqué ; infobulle = titre complet, « Branche de « … », dossier.
- [x] Textes en français et en anglais (`fr.json`, `en.json`).
- [x] Testé : composants (`Sidebar.test.tsx` : emplacement d'icône sur chaque ligne, plus de
      pastille, gras = non lu, temps à droite, repère de branche) ; unitaires (`tool-label`,
      `app-context`, attention, contexte après le message, titre de l'agent) ; e2e `inbox`,
      `history`, `branch`, `handover` contre l'agent factice, dont un agent qui titre avec le
      début du message envoyé, préambule compris (comme Bob) ; clair et sombre, captures
      regardées.
- [ ] Essai à la vraie souris de la barre latérale (alignements, survol, menu « … »).

## Plan

**Grille et « À traiter »** (renderer)
- `Sidebar.tsx` / `HistoryItem` : un `RowSlot` (20 px) en tête de chaque ligne ; contenu : icône
  de raison (À traiter), ↳ (branche ou fille sous sa ligne d'origine), état d'une fille, icône git
  d'un worktree ; vide sinon. À droite (`.row-meta`) : temps écoulé (À traiter), roue (en cours),
  état d'une fille. `unread` (gras) pour les lignes qui attendent ; plus de pastille. Retrait des
  lignes `nested` supprimé (↳ dans l'emplacement).
- `InboxSection.tsx` : en-tête « À traiter · N » (clé `inbox.heading`), style `.sidebar-section` ;
  icônes par raison (`CircleHelp` question, `Hand` autorisation et autres demandes, `Check` à lire,
  `CircleAlert` erreur) ; rend `inboxReason` et `inboxAgo` séparément.
- `shared/inbox.ts` : `inboxLine` disparaît (seconde ligne = `inboxReason`) ; la mère va dans
  l'infobulle (`inbox.childOf`).
- `styles.css` : `.history-open` en grille (gap 10 px, emplacement 20 px) ; `.history-more` posé
  par-dessus la droite au survol (le temps s'efface) ; en-tête « À traiter » = `.sidebar-section`
  ; filtre de « Récents » aligné sur la marge droite ; `.attention-dot`, `.inbox-count` retirés.

**Titres d'outils** (`shared/tool-label.ts`)
- `cleanCommand(command, workspace)` : `cd <dossier> && …` en tête retiré si `<dossier>` est le
  dossier de la conversation, relatif s'il est dessous ; chemins du dossier rendus relatifs.
- `cleanTitle(title, workspace)` : chemins du dossier rendus relatifs dans un titre brut.
- `ToolInput.todos` (lignes de la liste, lues dans `rawInput.todos`, texte à cases ou tableau) ;
  libellé `toolCall.label.todos`.
- `toolText(item, workspace)` : le libellé, sinon le titre nettoyé ; utilisé par `ToolCall`,
  `ToolGroup`, `activity.ts` et le suivi de l'attention (`describe` donne le dossier).

**Préambule** (`shared/app-context.ts`, main)
- `stripAppContext(text)` : coupe au premier bloc de Bobine (balises et phrases d'ouverture
  exportées par `branch.ts`, `handover.ts`, `children.ts`, y compris un début tronqué en fin de
  titre) ; `undefined` s'il ne reste rien.
- `agent-host.ts` : tout le contexte joint **après** le message ; textes de `branch.ts`,
  `handover.ts`, `children.ts` (`originContext`, `CHILDREN_REQUEST`) reformulés (« my message
  above »).
- `manager.ts` : titre de l'agent passé par `stripAppContext` ; nouveau `titleSource: 'app'`
  (branche, bascule) que l'agent ne remplace pas ; `resumedRecord` nettoie le titre de la session.
- `Transcript.tsx` : la carte de branche cite `stripAppContext(fromTitle)`.
- Agent factice : option `--titres-invite` (`MOCK_AGENT_TITLES=prompt`) : titre = début du texte
  envoyé, blocs compris, comme Bob.

**Branche et original** : repère `branche` (`sidebar.branchTag`) après le titre, jamais tronqué ;
le titre affiché sans son suffixe « · branche » ; infobulle complète.

**Essais** : `Sidebar.test.tsx`, `tool-label.test.ts`, `app-context.test.ts`, `attention.test.ts`,
`agent-host.test.ts`, `branch.test.ts`, `handover.test.ts`, `manager`/`helpers` ; e2e `inbox`,
`history`, `branch`, `handover` (agent qui titre avec le préambule).

Pas de nouvelle dépendance.

## Journal

- 2026-10-23 — Fiche créée d'après la maquette validée et les PV de la campagne de recette ; plan
  écrit.
- 2026-10-23 — **Fait** (branche `claude/barre-laterale-a-traiter-298fbf`, non poussée).
  - Grille : `HistoryItem.tsx` (sorti de `Sidebar.tsx`, 520 lignes au lieu de 704) ; emplacement
    `.row-slot` de 20 px, titre, `.row-meta` à droite, seconde ligne `.inbox-line` ; en-têtes de
    dossier et « Archivées » sur la même grille (icône dans l'emplacement, chevron à droite).
  - « À traiter » : `InboxStateIcon` par raison (`CircleHelp`, `Hand`, `Check`, `CircleAlert`,
    `data-reason`), classe `unread` (gras), `inboxLine` retiré, mère dans l'infobulle
    (`sidebar.childTip`), en-tête « À traiter · N » en texte.
  - Titres d'outils : `cleanCommand`, `cleanTitle`, `toolText`, `ToolInput.todos` ; utilisés par
    `ToolCall`, `ToolGroup`, `activity.ts` et `AttentionTracker` (dossier donné par `describe`).
  - Préambule : `shared/app-context.ts` (`APP_CONTEXT_OPENINGS`, `stripAppContext`) ; `withContext`
    joint tout après le message ; `agentTitle` (`helpers.ts`) ; `titleSource: 'app'` posé par la
    branche et la bascule ; carte de branche et `resumedRecord` nettoyés.
  - Agent factice : scénario `titres-bob` (titres relevés dans le journal de Bob 2.0.6 de la
    recette), option `--titres-invite` (`MOCK_AGENT_TITLES=prompt`), `{cwd}` remplacé aussi dans
    les titres et les demandes d'autorisation ; le message de l'utilisateur est le premier bloc.
  - Tests : `Sidebar.test.tsx` (grille, gras, icônes, temps à droite, repère de branche),
    `tool-label.test.ts`, `app-context.test.ts`, `helpers.test.ts`, `attention.test.ts`,
    `manager.test.ts` (agent qui titre comme Bob sur une branche), `agent-host.test.ts`,
    `children.test.ts`, `branch.test.ts`, `handover.test.ts`. e2e : `inbox` (grille mesurée dans la
    page : titres sur une verticale, temps, ⌘K et filtre sur une marge, en-têtes identiques ;
    titres de Bob ; contexte de session coupé du titre), `history`, `branch`, `handover` (agent
    qui titre avec le préambule), `filles`, `notifications` adaptées.
  - **Écarts à la maquette et au plan** :
    - L'accent de l'app est l'orange de Bobine ; la maquette montrait le violet de l'époque.
    - Une branche ou une fille sous sa ligne d'origine n'est plus en retrait : ↳ va dans
      l'emplacement d'icône, pour garder une seule verticale. L'état d'une fille passe à droite.
    - Le menu « … » n'est plus visible en permanence sur la ligne active : il vient au survol (ou
      au clavier), par-dessus le temps écoulé ; le titre lui laisse la place à ce moment-là.
    - En-têtes de dossier (vue « Par dossier ») et « Archivées » mis sur la grille aussi.
    - Les titres d'anciennes conversations déjà remplacés par le préambule ne sont pas réparés
      dans l'index (seulement à l'affichage de la carte de branche et à la reprise d'une
      session) : les renommer.
  - **Vérifié** : `./scripts/verify` vert (1473 tests ; deux tests de minutage de `manager.test.ts`
    ont échoué une fois sous une charge de 33, verts seuls et au passage suivant) ; `pnpm build &&
    pnpm e2e --changed` : 110 tâches (toute la suite, `styles.css` et `agent-host.ts` sont
    partagés), 80 vertes du premier coup, 30 en échec pendant que d'autres sessions jouaient leurs
    propres e2e (« fenêtre de l'app absente au bout d'une minute » pour la plupart), toutes vertes
    rejouées une à une (`--jobs 1`). Captures regardées en clair et en sombre (`inbox-1`, `inbox-4`,
    `a4-branches-sous-original`, `91-historique`) et comparées à la maquette.
  - **Pas fait** : l'essai à la vraie souris. L'accès à l'app de développement (Electron) a été
    refusé dans la boîte d'autorisation. Les alignements sont mesurés par l'e2e `inbox` dans la
    page (Chromium), pas vus à l'écran ; le survol du menu « … » n'est vu que par l'e2e `history`.
    Script prêt : l'app préparée (autorisation, question, branche, worktree), gardée ouverte
    jusqu'à un fichier signal (dossier de notes de la session, `barre-laterale-essai-souris.mjs`).
