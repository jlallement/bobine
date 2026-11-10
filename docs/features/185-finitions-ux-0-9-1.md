# 185 — Finitions UX de la 0.9.1

- **Statut** : en cours
- **Dépend de** : 136 (gabarit des réglages), 166 (panneau de droite), 168 / 170 / 171 (thème Fjord,
  rayons), 178 (tâches planifiées), 183 (recette 0.9 : D8, D9)
- **Agents** : les deux (interface seulement, rien de propre à un agent)

## Pourquoi

La 0.9.0 est sortie. Avant d'ajouter des fonctionnalités, la 0.9.1 soigne l'interface : alignements,
rythme des espacements, filets, rayons, contraste en clair et en sombre, états, fenêtre étroite et
zoom. L'utilisateur relève des défauts (items « U ») ; chacun est traité comme un symptôme, et corrigé
au niveau du composant ou du jeton partagé, pas d'un écran.

## Critères d'acceptation

- [x] U1 : les encarts des réglages appartiennent à leur ligne (pas de filet collé au-dessus), fond
  dérivé du thème, mises en garde dans la teinte d'avertissement ; vérifié partout où `.settings-note`
  sert, en clair et en sombre.
- [x] Passe d'audit complète : chaque écran en clair et sombre, fr et en, 900 px et zoom 150 %,
  captures et planche contact dans le dossier partagé (`ux-0-9-1/`).
- [x] Liste des défauts classée, envoyée au tech lead ; l'utilisateur choisit ce qui est corrigé.
- [x] Idées pour faire plaisir, astuces de Bobine et emplacement de l'aide (fiche 186) : maquettes.
- [ ] **Règle de l'utilisateur (2026-11-06)** : aucun changement d'interface n'est codé avant qu'il
  ait validé sa maquette (capture annotée, maquette HTML ou avant / après simulé, clair et sombre,
  dans `ux-0-9-1/maquettes/`). U1, codé avant la règle, attend aussi sa validation.
- [ ] Pour chaque correction : captures avant / après (clair, sombre) dans `ux-0-9-1/fixes/`,
  `./scripts/verify`, `pnpm build && pnpm e2e --changed`, une ligne de CHANGELOG fr et en.

## Plan

1. U1 : `.settings-note` dans `styles.css` (composant partagé) ; encart déplacé sous sa ligne dans
   `GeneralSettings.tsx` ; variantes `warn` / `error` posées là où le texte est une mise en garde ou
   une erreur (`CommandLineRow`, `FreshStart`, `TaskForm`).
2. Audit : scripts `ux-0-9-1/scripts/` du dossier partagé (au-dessus de `e2e/lib.mjs`, profil jetable,
   agent factice), plus les captures de la suite e2e complète (`e2e/captures/`).
3. Liste classée ci-dessous ; maquettes par lots (`ux-0-9-1/maquettes/01…05`, `ux-0-9-1/aide/`) ;
   corrections seulement après validation de chaque maquette par l'utilisateur.

## Méthode de l'audit

- `audit.mjs` (dossier partagé, `ux-0-9-1/scripts/`) : dépôt git jetable, trois tâches planifiées
  semées, agent factice ; accueil, fil long, carte d'autorisation, Modifications (Conversation, Git),
  onglets du panneau (Session, Navigateur, Terminal, Tâches), menus, dialogue de suppression,
  recherche, les douze sections des réglages, page des tâches planifiées et son formulaire, erreur,
  aparté. Chaque écran : 1280 × 820, 900 × 760 et zoom 150 %, en clair et en sombre, en fr et en.
- **Zoom 150 %** : le vrai zoom de l'interface (`webContents.setZoomFactor(1.5)`, comme ⌘+), pas
  `zoom: 1.5` en CSS sur la racine. Le zoom CSS (celui de la recette 183) ne déclenche ni les media
  queries ni les seuils de largeur en JS : il écrase le fil à ≈ 120 px avec le panneau ouvert, ce
  qu'aucun utilisateur ne voit. Les mesures de D8 sont refaites avec le vrai zoom.
- `walk.mjs` : parcours « utilisateur exigeant » : premier lancement, Mon activité vide, recherches
  sans résultat, réglages vides, contrôles (sélecteurs, cases, champs nombre), focus au clavier (Tab),
  survols, barres de défilement, menus de la saisie et de l'historique, états en cours ; vidéo des
  mouvements (screencast DevTools, assemblée en MP4 par AVFoundation) dans `ux-0-9-1/videos/`.
- Les maquettes : HTML avec les **jetons réels** de l'app (`themes.generated.css` découpé par thème
  dans `maquettes/tokens.css`) et ses icônes Lucide ; « avant » = découpe d'une capture réelle ;
  rendues en PNG par Electron (`scripts/shot.cjs`).
- Les états profonds (carte de PR avec `gh` simulé, dialogue de relecture et remarques sur le diff,
  carte de préparation du worktree, vue des filles, aparté) : captures de la suite e2e complète
  (clair, sombre ; fr), et celles de la recette 0.9 (`qa-0-9/`) pour 900 px et le zoom.

## Défauts relevés (du plus visible au moins visible)

Captures : dossier partagé `ux-0-9-1/` (`audit/` : `fr-` / `en-`, `-light` / `-dark`, `-900`,
`-zoom150` ; `profonds/` : états tirés de la suite e2e ; planche : `planche-contact.html`, et
`planches/*.png`).

Maquettes : `maquettes/01-panneau` (F1, F2, F3, F5), `02-reglages` (U1, F4, F6),
`03-petits-defauts` (F7–F10, à valider d'un bloc), `04-plaisir` (F11 avec P6) ; `.html` et `.png`.

| # | Écran | Ce qui ne va pas | Ce que ce doit être | Capture |
|---|---|---|---|---|
| U1 | Réglages › Général (et toute carte de réglages avec encart) | Encart collé sous le filet de la ligne, l'air de déborder sur la ligne du dessus ; fond gris-brun sur la carte bleu-gris en Fjord nuit | **Corrigé** (voir Journal) | `fixes/u1-avant/`, `fixes/u1-apres/` |
| F1 | Panneau de droite, rangée d'onglets (partout : Modifications, PR, page des tâches planifiées) | Les onglets inactifs rétrécissent jusqu'à un libellé tronqué : « S… », « M », « Sess… » ; l'onglet actif voit son ✕ rogné par le bord (« Tâches ✕ ») | Un onglet inactif montre son libellé entier, ou son icône seule (avec infobulle) quand la place manque : jamais un bout de mot. L'onglet actif n'est jamais rogné | `audit/fr-a06-modifications-git-dark.png`, `profonds/176-pr-echec-dark.png`, `audit/fr-c01-planifiees-dark.png` |
| F2 | Modifications › vue Git d'un worktree (nom de branche long) | Le sélecteur « Conversation 2 · Git 0 » passe sur deux lignes : les compteurs tombent sous les libellés | Segments sur une ligne (`nowrap`) ; c'est le nom de branche qui cède la place (points de suspension) | `profonds/176-pr-echec-dark.png` |
| F3 | Page Tâches planifiées (reste de la recette) | Le panneau de droite de la dernière conversation reste ouvert : « Tâches : l'agent n'a pas encore de liste de tâches dans cette conversation », Session, Modifications… sans rapport avec la page | Pas de panneau de conversation sur une page qui n'est pas une conversation (tâches planifiées, et à vérifier : Mon activité) ; il revient tel quel en rouvrant une conversation | `audit/fr-c01-planifiees-dark.png` |
| F4 | Réglages › Apparence, fenêtre ≤ 900 px ou zoom 150 % | La rangée des thèmes déborde de la carte et du dialogue : « Nuit noire » coupé, « Fjord nuit » hors d'atteinte (mesuré : bouton à 936 px pour une fenêtre de 900) | Les vignettes passent sur deux rangées dans la carte (le contrôle de la ligne peut rétrécir), à toutes les largeurs | `audit/fr-b-reglages-appearance-900-dark.png`, `audit/en-b-reglages-appearance-zoom150-dark.png` |
| F5 | Modifications, vue Git (D9 de la recette) | Fenêtre passée à 900 px (panneau replié par l'app, fiche 173) puis élargie : le panneau revient sur la vue « Conversation », le choix « Git » est perdu (mesuré : `aria-pressed` vrai → faux) | Le choix de vue est gardé par conversation, comme l'onglet du panneau | `audit/fr-a06-modifications-git-dark.png` puis `audit/fr-a06-modifications-git-apres-900-dark.png` |
| F6 | Réglages, colonne de navigation | Le survol a le même fond que la section active : quand la souris reste sur un autre item (après un clic, un changement de zoom), deux sections paraissent choisies | Survol plus léger que la sélection ; la section active se lit seule (fond plus marqué et texte `--text`) | `audit/en-b-reglages-about-zoom150-dark.png`, `audit/en-b-reglages-agents-zoom150-dark.png` |
| F7 | Panneau › menu « Autres outils », puis Navigateur | L'infobulle « Autres outils » reste affichée après le clic et recouvre le champ d'adresse | Une infobulle se ferme au clic et ne revient qu'au prochain survol | `audit/fr-a08-panneau-browser-dark.png` |
| F8 | Tâches planifiées, carte d'une tâche | La ligne d'informations ne se coupe pas pareil d'une carte à l'autre : le dossier part seul à la ligne quand « Prochaine : … » occupe la droite | Fréquence · agent · dossier sur une ligne qui se coupe d'un bloc (séparateurs « · »), « Prochaine » à sa place fixe | `audit/fr-c01-planifiees-dark.png` |
| F9 | Mon activité, premier lancement | Vide, la page a l'air cassée : « 0 échange », carte de chaleur vide, « Coût : non communiqué » en gros comme une valeur | « — » dans les cartes chiffrées ; un état vide qui dit ce qui viendra et propose de commencer | `walk/fr-w02-activite-vide-dark.png` |
| F10 | Réglages, recherche sans résultat | Une ligne grise en haut à gauche | État vide centré, avec une porte de sortie (l'aide, fiche 186) | `walk/fr-w04-reglages-sans-resultat-dark.png` |
| F11 | Accueil, nouvelle conversation (mouvement) | Pendant ≈ 0,5 s la saisie montre « Agent ⌄ » seul, puis modèle, mode et la ligne des suggestions apparaissent : tout se décale | Place des puces réservée, remplie en fondu (P6) | `videos/fr-mouvements-dark.mp4` (0–0,5 s), `maquettes/f11-t0.png`, `f11-t05.png` |

**Vérifié, pas un défaut**

- **D8** (bouton d'envoi hors de la saisie à 150 % avec le panneau ouvert) : **ne se reproduit pas
  avec le vrai zoom**. À 150 % (853 px CSS) le panneau se replie de lui-même (fiche 173) et la saisie
  se resserre (l'appareil photo se cache) ; mesuré : bouton jusqu'à 818 px, saisie jusqu'à 829 px.
  Le D8 de la recette venait du zoom CSS simulé (`audit/fr-a07-d8-zoom150-panneau-dark.png`).
- **Coût par jour d'une tâche planifiée** : affiché quand elle tourne plusieurs fois par jour
  (« ≈ 0,12 $US par exécution · ≈ 0,72 $US par jour » toutes les 4 h) ; pour une tâche quotidienne, le
  coût par exécution *est* le coût par jour, il n'est pas répété ; sans exécution : « Coût inconnu
  tant qu'elle n'a pas tourné ». Conforme à la fiche 178.
- Cartes d'autorisation, aparté, dialogue « Faire relire », remarques sur le diff, carte de PR,
  préparation du worktree, vue des filles, dialogue de suppression, accueil, fil long : rien de
  plus que F1 / F2 en clair comme en sombre, fr comme en, à 900 px et à 150 %.
- Focus au clavier : même anneau partout (2 px d'accent à 60 %), visible au clavier seulement
  (`:focus-visible`), ordre de tabulation logique dans la saisie. Sélecteurs : rendu natif de macOS
  (menus déroulants du système), ce qui est le bon choix sur Mac. Menus : même habillage partout,
  apparition en fondu (`menu-in`).
- Les textes de l'agent factice restent en français dans les essais en anglais (« Étape 26 : je
  continue. ») : donnée des essais, pas de l'app.

## Validé par l'utilisateur (2026-11-06) et ce qui part en 0.10

- **0.9.1, codé** : U1 et F1 à F11 ; P1 à P10. Lots 1 (A + B : panneau, réglages, tâches
  planifiées, Mon activité, états vides) et 2 (C + D : mouvements, Copié, raccourcis, bilan du tour,
  « ↓ N nouveaux », saisie qui arrive entière).
- **0.10, maquettes seulement** : astuces de Bobine (maquette 5), fenêtre d'aide (maquette `aide/`),
  avec la fiche 186. À noter pour son plan : ⌘? (⇧⌘/ sur un clavier américain) jouxte ⌘/, déjà
  « Raccourcis clavier ».
- **À valider** : maquette 6 (constats de la session du guide, G1 à G5).
- **Hors de ce lot (coordination)** : la carte de PR (`PrCard`) et la barre du cycle du worktree
  restent à la session 176 (D15–D20) ; P2 n'y pose donc pas d'animation.

## Idées pour faire plaisir

Maquette : `ux-0-9-1/maquettes/04-plaisir.html` (les animations y jouent, bouton « Rejouer ») et
`.png` (images-clés). Toutes sobres, une fois, jamais en boucle hors d'un travail en cours ; toutes
coupées sous `prefers-reduced-motion`. Coût : S ≤ ½ jour, M 1–2 jours.

| # | Quoi | Où | Pourquoi | Coût |
|---|---|---|---|---|
| P1 | Le panneau glisse (180 ms) au lieu d'apparaître | Panneau de droite | Dit d'où il vient ; la conversation se resserre sans saut | S |
| P2 | Les cartes arrivent : montée de 6 px + fondu, 160 ms | Autorisation, PR, relecture, préparation du worktree, aparté, propositions de filles | Attire l'œil sur ce qui attend une action, sans brusquer | S |
| P3 | « Copié ✓ » unifié : l'icône devient ✓, infobulle « Copié » 1,2 s | Tous les boutons Copier | Un seul geste au lieu de plusieurs (ou aucun) | S |
| P4 | Ligne de bilan en fin de tour : « Terminé en 42 s · 2 fichiers +6 −1 · ≈ 0,12 $US » | Sous la dernière réponse | On revient d'ailleurs et on sait ce qui s'est passé | M |
| P5 | Dépliage animé (hauteur, chevron), 140 ms | Groupes d'outils, réflexion, sous-tâches | Le texte du dessous ne saute plus | S |
| P6 | La saisie arrive entière (corrige F11) | Accueil, nouvelle conversation | Plus de décalage au chargement | S |
| P7 | Bouton d'envoi qui répond : gris → accent, léger enfoncement | Saisie | On sent que c'est parti | S |
| P8 | « ↓ 3 nouveaux » sur le bouton de retour en bas | Fil | On sait ce qu'on a manqué en relisant plus haut | M |
| P9 | Raccourci dans chaque infobulle (« Panneau de droite ⌥⌘B ») | Boutons à raccourci | Comme les apps Mac soignées : on apprend les raccourcis en passant | S |
| P10 | Un composant d'état vide commun (icône, titre, phrase, action) | Mon activité, recherches, MCP, commandes, tâches planifiées, panneau Tâches | Chaque vide a l'air fini, partout pareil | M |

Écartés exprès : sons à chaque tour, confettis, compteurs qui défilent, rebonds.

## Astuces de Bobine (maquette seule)

Maquette : `ux-0-9-1/maquettes/05-astuces`. Une **languette** posée sur le bord haut de la saisie
(fond d'accent très léger, ✕, « Ne plus montrer », « En savoir plus » vers l'aide) ; pour une astuce
qui porte sur un objet, le **pied de sa carte** (ex. vue Git avant « Fusionner »). Déclencheurs :
taper pendant un tour (→ `/btw`, ⇧⌘A), trois fois le même message (→ tâche planifiée), contexte au-delà
de 85 % (→ repartir d'un résumé), gros diff non relu avant fusion (→ « Faire relire »). Règles : une à
la fois, au plus une par jour, jamais pendant une carte d'autorisation ; ✕ = aujourd'hui, « Ne plus
montrer » = toujours ; mise en pratique = jamais plus ; réglage « Astuces de Bobine » (Général, activé
par défaut, « Tout réafficher »).

## Aide intégrée (fiche 186) : où la présenter

Maquette et comparaison : `ux-0-9-1/aide/aide-options`. Recommandation : **une fenêtre d'aide à part,
habillée comme les Réglages (sommaire à gauche, recherche en tête), non modale, posée à droite de la
fenêtre principale** s'il y a la place. ⌘? l'ouvre, curseur dans la recherche ; un lien « ? » l'ouvre à
la section (qui clignote une fois). Le panneau de droite est écarté : il se replie sous ≈ 900 px
(fiche 173), et l'aide n'est pas un outil de la conversation. Liens « ? » : petit cercle `--muted` à
droite du titre expliqué, accent au survol, infobulle « Aide : … » ; dans un dialogue, « ? Comment ça
marche » en bas à gauche.

## Journal

- 2026-11-06 — U1 corrigé. L'encart `.settings-note` posé dans une carte avait une marge haute nulle
  sous une ligne qui garde son filet : il paraissait déborder sur la ligne du dessus. Son fond
  (`--warn` à 12 % sur transparent) virait au gris-brun sur le bleu-gris de Fjord nuit. Désormais :
  la ligne suivie d'un encart perd son filet et son retrait bas ; l'encart (10 px au-dessus, 14 px
  au-dessous, 16 px de côté, aligné sur le texte de la ligne) porte le filet vers la ligne suivante ;
  fond `--surface-2` du thème, rayon `--radius-sm`. Variante `.warn` (`--warn-soft`) pour les mises en
  garde : raccourci de la fenêtre rapide refusé, commande `bobine` périmée ou hors du PATH, tâche
  planifiée sans plafond. Erreurs de `CommandLineRow` et `FreshStart` passées en `.error`. Écart
  trouvé en passant : l'avertissement « raccourci refusé » était rendu sous « Éditeur », pas sous
  « Fenêtre rapide » ; déplacé. Captures : `ux-0-9-1/fixes/u1-avant/`, `ux-0-9-1/fixes/u1-apres/`
  (les lignes « langue de macOS » et « Commande bobine » n'existent que dans l'app packagée : même
  balisage posé par le script).
- 2026-11-06 — Passe d'audit : 318 captures (`audit/`, fr / en, clair / sombre, 1280, 900, zoom
  150 %), suite e2e complète verte en fr (157 tâches, 10 min) dont 781 captures copiées dans
  `e2e-fr/`, états profonds dans `profonds/`. Liste classée ci-dessus (F1–F8), envoyée au tech lead ;
  rien d'autre que U1 n'est corrigé avant le choix de l'utilisateur. D8 refermé (artefact du zoom
  CSS simulé).
- 2026-11-06 — Demandes de l'utilisateur relayées par le tech lead : parcours « utilisateur exigeant »
  (`walk.mjs`, 59 captures, vidéo des mouvements), idées pour faire plaisir, astuces de Bobine, avis
  sur l'emplacement de l'aide (fiche 186). Nouvelle règle : maquette validée avant tout code
  d'interface. Maquettes 01 à 05 et `aide/` produites ; F9, F10, F11 ajoutés à la liste.
- 2026-11-06 — Lots 1 et 2 codés après validation. Écarts aux maquettes, et pourquoi :
  - **F3** : seulement la page Tâches planifiées. Mon activité garde son panneau : la fiche 144 l'a
    voulu à côté de la page, et son essai e2e le vérifie à 800 px.
  - **F9** : journal vide (premier lancement, remise à zéro) : l'état vide remplace les filtres, la
    grille et les chiffres (rien à filtrer ni exporter). Période vide dans un journal non vide :
    les chiffres restent, coût et jetons en « — » au lieu de « non communiqué ».
  - **P5** : seule l'ouverture s'anime (hauteur) ; la fermeture est immédiate. Animer
    `content-visibility` vidait le texte pendant 140 ms (recherche ⌘F, copie, lecteurs d'écran ;
    mesuré : `innerText` vide à l'ouverture).
  - **P3** : la bulle « Copié » est dessinée en CSS sur le bouton, pas une infobulle ouverte
    d'office : celle-ci, couche Radix du dessus, prenait la touche Échap au dialogue des réglages
    pendant 1,2 s (essai `diagnostic`). Le nom du bouton passe à l'infobulle de l'app (il utilisait
    `title`). « Copier le chemin » du menu du dossier reste sans retour (le menu se ferme).
  - **P4** : sous la seconde, « Terminé » seul (« en 0 s » ne disait rien). Ligne posée sous la
    rangée des actions qui apparaît au survol (elle la chevauchait).
  - **P8** : compte les réponses de l'agent arrivées, pas chaque élément du fil (un fil d'outils
    donnait « 330 nouveaux ») ; au-delà de 99, « 99+ nouveaux ».
  - **P6 / F11** : mesuré sur trois conversations neuves : le bouton des réglages de session
    passait de 474 à 401 puis 474 px ; il reste à 474 px. La largeur des puces de mode et de modèle est retenue par agent (et pour le
    dernier agent affiché, son nom n'étant pas connu au premier instant) ; une pastille neutre
    réserve leur place. Au tout premier lancement d'un agent, rien n'est réservé.
  - **P9** : prop `command` de `Tip`, raccourci lu dans `SHORTCUTS` (il ne peut pas mentir) ; posé
    sur nouvelle conversation, recherche, barre latérale, réglages, panneau, Modifications,
    agrandir, arrêter.
  - **F7** : l'infobulle ne s'ouvre plus sur un focus rendu juste après un clic (menu qui se
    ferme) ; au clavier et au survol, rien ne change.
- Essais e2e retouchés (le comportement voulu a changé, aucune vérification retirée) :
  `sidebar-tooltip.mjs` (une touche avant `.focus()` : vrai focus clavier), `panel.mjs` (panneau
  immobile avant de le redimensionner), `composer.mjs` (couleurs lues après la transition),
  `usage-board.mjs` (après remise à zéro : l'état vide), `fun.mjs` (sommaire : un `mouseover`
  simulé n'ouvrait pas la liste, qui s'ouvre au `:hover` réel ; le clic tombait à côté, déjà sur
  `main`, et la vérification ne passait que par la place des messages : la ligne de bilan l'a
  révélé ; l'app, elle, défile bien au clic).
- Avant / après : `ux-0-9-1/fixes/avant-apres.html` (U1, lot A, lot 2 ; clair et sombre),
  mesures dans `fixes/*/mesures.jsonl`, vidéos `lotA-apres/p1-panneau-dark.mp4` et
  `lot2-apres/mouvements-dark.mp4`.
- Fichiers nouveaux : `motion.css` (tous les mouvements, et leur coupure sous « réduire les
  animations »), `common/EmptyState.tsx`, `panel/compact-tabs.ts`, `composer/chip-slots.tsx`,
  `thread/TurnSummary.tsx`, `thread/ScrollDownButton.tsx`, `useNewSinceScroll.ts`.
- 2026-11-06 — Relecture du tech lead, tout corrigé :
  1. « Copié » sur un bloc de code : la règle de positionnement épargne `.code-copy` (absolu), le
     bouton reste visible le temps de la bulle, posée à sa gauche (le bloc rogne ce qui dépasse).
  2. Bilan du tour sans montant en mode présentation (`usePresentation`).
  3. Pas de bilan sous un tour arrêté, refusé, coupé (`max_tokens`, `max_turn_requests`) ou en
     erreur ; essai unitaire, et suite e2e `finitions` (Stop sur `attend-stop`).
  4. `CopyButton` revient à `title` (infobulle de l'app, `installTitleTooltips`) : plus de
     fournisseur ni de racine Radix par bouton.
  5. Puces réservées : mesure dans un effet à dépendances (prêt, valeurs des puces), largeurs lues
     une fois (`useMemo`).
  6. Mon activité : canal `usage:hasAny` (premier tour du journal) au lieu des statistiques de tout
     le journal ; rien n'est affiché tant que la réponse n'est pas là (pas d'éclair au lancement).
  7. Blocs dépliés : `overflow-clip-margin: 6px`, les anneaux de focus ne sont plus rognés.
  8. Compte des réponses : seulement fil remonté, mémorisé.
  9. `lastTurnFacts` mémorisé.
  10. Pastille « N nouveaux » centrée, annoncée (`aria-live`) ; capture et essai e2e.
  11. Onglets compacts : le compte et le ✕ (au survol) restent ; la rangée elle-même est observée.
  12. Le panneau ne glisse qu'à une vraie ouverture (`usePanel` compte les ouvertures), pas en
      sortant de l'agrandi ni en revenant de la page des tâches.
  13. Puces réservées : seulement avant le premier état de l'agent ou pendant son démarrage, par
      profil (jamais la largeur d'un autre agent).
  14. « Copier » : chaque clic réarme le délai ; presse-papiers refusé : « Copie impossible ».
  15. ⌘J sans effet sur la page des tâches planifiées.
  16. Vue choisie oubliée à la suppression de la conversation (`changes-view-memory.ts`).
  17. Bilan sous la rangée d'actions du survol (vérifié par l'essai `finitions`) ; « ≈ » dans la
      traduction.
  18. Commentaires remis à leur place ; titres des états vides en `h2` / `h3` selon la page.
- 2026-11-06 — Reliquats de la relecture : compte des réponses par morceaux (`agent-count.ts` :
  seul ce qui s'est ajouté au fil est parcouru) ; ⌘⇧J sans effet sur la page des tâches
  planifiées ; panneau ouvert agrandi : pas de glissé (la classe restait sans fin d'animation) ;
  suite `finitions` sans pauses (attentes sur condition), stable trois fois de suite en clair et en
  sombre.
- 2026-11-06 — Recette de la 0.9.1 (fiche 183) : D25 et D26 à 900 px, panneau ouvert (branche
  `claude/ux-0-9-1-d25-d26`).
  - **D25** : F1 n'avait qu'un cran (inactifs en icône) ; la rangée débordait encore, défilait, et
    coupait l'actif (son ✕) et la première icône. Second cran `tight` : l'actif passe aussi en icône
    (compte et ✕ gardés), les inactifs perdent la place de leur ✕ (le clic du milieu les ferme),
    marges réduites. La rangée ne déborde plus : mesuré, 205 px de contenu dans 133 px avant,
    129 dans 129 après.
  - **D26** : l'agent ne se tronque plus (fiche 092 le rétrécissait jusqu'à 64 px, « Moc… », puis à
    son chevron seul) : son nom entier, ou son icône (robot, comme dans l'onglet Session) et son
    chevron ; le nom reste lu par les lecteurs d'écran et dans l'infobulle. Le modèle cède toujours
    en premier, jusqu'à 110 puis 56 px (ellipse).
  - Essai e2e à 900 px dans la suite `finitions` (fr et en) : noms entiers ou icônes, aucun onglet
    coupé, ✕ de l'actif visible, puce de l'agent jamais un bout ni un chevron seul. Captures avant /
    après : `ux-0-9-1/fixes/d25-d26.html` (fr, en, clair, sombre).
- 2026-11-06 — Relecture de c051fff : D26 accepté, D25 refusé (ne tenait qu'à la largeur
  mesurée). Maquette 7 (`ux-0-9-1/maquettes/07-onglets-en-trop`) : troisième cran, les inactifs
  qui ne tiennent pas passent dans le menu « + » ; **en attente de validation**. Fait sans
  changement visible : `ResizeObserver` sur l'en-tête seul et application au rendu suivant (plus de
  boucle) ; ✕ des inactifs transparent plutôt que caché (reste dans l'ordre de tabulation, paraît au
  focus clavier, et par-dessus l'onglet au cran serré) ; scénario `douze-fichiers` de l'agent
  factice. Suite e2e `onglets-etroits` (280 px, tous les outils, « Modifications 12 », fr puis en
  dans le même essai, puce de l'agent forcée en icône) écrite : elle reproduit D25 (onglets coupés
  en fr et en) ; elle sera ajoutée au catalogue avec le troisième cran.
- 2026-11-06 — Maquette 7 validée (« Oui ») et codée. Crans dans l'ordre : inactifs en icône,
  actif en icône, puis rangement des inactifs les plus à droite dans le menu « + »
  (`PanelMoreMenu.tsx` : « Onglets ouverts », icône, nom, compte, ✕ ; ⌫ ou Suppr ferme la ligne),
  puis l'actif reprend son nom s'il tient. Au cran serré, Agrandir et Fermer passent à 26 px (comme
  sur la maquette). Mesuré à 280 px, six outils, « Modifications 12 » : avant, 286 px de contenu
  dans 149, la rangée défile de 36 px ; après, 142 dans 142, trois onglets visibles, quatre rangés.
  Écart : le ✕ d'une ligne rangée se ferme au clavier par ⌫ / Suppr (pas par → puis ↩ : les lignes
  d'un menu Radix ne donnent pas le focus à un bouton intérieur). Suite e2e `onglets-etroits`
  ajoutée au catalogue. Captures : `ux-0-9-1/fixes/m7-avant/`, `m7-apres/`.
- 2026-11-06 — Relecture de 90d5db8 (bloquant) : depuis 68c8790, le ✕ invisible d'un inactif
  prenait encore le clic ; au cran serré, posé par-dessus l'onglet, un clic sur l'icône pouvait
  fermer l'onglet au lieu de l'ouvrir. `pointer-events: none` sauf sur l'actif, au survol hors cran
  serré et au focus clavier ; au cran serré, seulement au focus clavier. Reproduit par l'essai sur la
  version d'avant (clic au milieu de l'onglet entier, là où le ✕ est posé : la session se fermait),
  vert après. Menu « + » : le ✕ d'une ligne n'est plus un bouton dans un élément de menu (cible de
  souris `aria-hidden`), `aria-keyshortcuts="Backspace Delete"` sur la ligne, et après ⌫ / Suppr le
  focus passe à la ligne suivante (le menu se ferme s'il est vide). Essais : onglet cliqué actif et
  nombre d'onglets inchangé (900 px au cran serré, et 280 px), « 12 » lu avec une largeur non
  nulle, « + », Agrandir et Fermer dans la vérification des éléments coupés, ⌫ sur une ligne rangée.
- 2026-11-06 — Relecture de 9c15a88 : le ✕ d'une ligne du menu « + » ouvrait l'onglet au lieu de
  le fermer (le `pointerdown` arrêté empêchait Radix de noter l'appui ; au relâché, il sélectionnait
  la ligne). Essai écrit d'abord : il échouait en fr et en en (7 → 7 onglets, la ligne devenue
  active). Corrigé : la ligne note au `pointerdown` si le ✕ est touché, et sa sélection est alors
  annulée (`preventDefault`, menu ouvert), l'onglet fermé, le focus passé à la ligne suivante.
  ⌫ / Suppr inchangés. Le `requestAnimationFrame` du focus est annulé au démontage.
- 2026-11-06 — Relecture de 2cfde87 : l'appui noté sur le ✕ pouvait rester (appui, glissé
  ailleurs, relâché) et faire fermer l'onglet au ↩ suivant sur la même ligne. Remis à zéro quand le
  pointeur quitte la ligne, à son annulation, à toute touche sur la ligne et à l'ouverture ou la
  fermeture du menu (pas au relâché : Radix sélectionne la ligne dans ce même évènement). Essai :
  appui sur le ✕, glissé hors de la ligne, relâché : rien ne se ferme ; puis ↩ sur la ligne l'ouvre.
  Il échouait sur 2cfde87 (↩ fermait l'onglet), vert après, en fr et en en.
- 2026-11-07 — Recette 0.11 avec Bob (M4, « pieds de tour perdus à la réouverture ») : non
  reproduit, comportement voulu. Le bilan « Terminé en … · ≈ x Bobcoins » n'est que sous le
  dernier tour fini et part au message suivant (P4) ; jamais sous un tour arrêté. Dans la capture
  de la recette, le dernier tour était « Réponse interrompue ». Essai ajouté (e2e `usage-bob`) :
  Bob simulé (coût par sa base, rejeu tardif `MOCK_AGENT_REPLAY=late`), deux tours, l'app
  relancée et la conversation rouverte : bilan du dernier tour, durée de chaque tour et total
  identiques à avant.
