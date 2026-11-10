# Bobine — feuille de route après la campagne d'octobre (23 octobre 2026)

**Ce qui l'a déclenchée** : les irritants de Jérôme après usage réel, à savoir le navigateur inutilisable, « Patch » affiché longtemps, une barre latérale et des réglages fouillis, rien pour les skills, aucun tableau de consommation, une apparence peu réglable.

**Comment elle a été construite** : neuf études en lecture seule, une par domaine. Chacune a lu le code, les fiches, les recettes et les captures e2e, et l'a comparé à Claude Desktop, Codex, Cursor, Zed, VS Code et à l'interface terminal d'OpenCode. Les domaines : navigateur, activité de l'agent, barre latérale, réglages, skills, consommation, apparence, qualité, autres manques. Les causes citées ont été relues dans le code.

**L'objectif fixé par Jérôme** : un logiciel joli, fonctionnel, sans bugs ni défauts, un code maintenable, et le moins possible de dépendance à Bob ou à OpenCode.

**Règles de conduite**

- **Corriger avant d'ajouter.** Pas de nouvelle fonctionnalité (`feat`) tant qu'un défaut majeur est ouvert. Chaque défaut de recette donne d'abord un scénario factice qui le reproduit, puis la correction.
- **Une itération sur trois est consacrée à la qualité** (itérations 4 et 7).
- **Générique d'abord.** Tout ce qui est prévu ici passe par ACP, CDP ou Electron, sauf ce qui est explicitement rangé dans un profil ou un adaptateur.
- **Une info à un seul endroit.** Cette règle a tranché plusieurs propositions : pas de compteurs dans la barre, un seul chronomètre, la version de l'app seulement dans « À propos ».
- **Numéros.** Les sections 1 et 2 gardent les numéros provisoires de l'étude. Les vrais numéros de fiche sont ceux du plan d'exécution ci-dessous (§ 0) : en cas de doute, c'est lui qui fait foi.

**Maquettes** (23/10) : tout ce qui change l'interface est maquetté sur l'app buildée, en clair
et en sombre, dans la planche « Maquettes de Bobine »,
privée, validée par Jérôme le 23/10 après relecture (journal ci-dessous). Le script qui la produit
est dans `e2e/maquettes/` ; ses captures vont dans `e2e/captures/maq-*`.

---

## 0. Plan d'exécution (arrêté le 23 octobre 2026, après la relecture des maquettes)

D25, D26 et D27 sont déjà faits (fiche 127, v0.5.0). Les fiches commencent donc à 128. Chaque lot
est une fiche, une branche en worktree et une fusion dans `main`. Modèle (choix de Jérôme) :
Opus 5.5 par défaut, Sonnet 5.5 seulement pour les lots vraiment simples (vague 1 : la 128). L'essai à la vraie souris et la suite e2e complète sont faits par la
session qui coordonne, au moment des fusions, jamais en parallèle.

| Vague | Fiche | Lot | Reprend (étude) | ADR | Taille |
|---|---|---|---|---|---|
| 1 | **128** | Activité lisible pendant un tour, « Sans serif » / « Serif », C14 | 127, 128 (sauf D25-D27) | — | S |
| 1 | **129** | Navigateur : défilement, zoom, la page suit le panneau, `browser_resize` de l'agent | 129, 130 | 0026 | M |
| 1 | **130** | Journal de consommation (collecte, SQLite) | 131 | 0025 | S–M |
| 1 | **131** | Barre latérale : sections, dossiers, filles reliées à leur mère | 133, 134 | — | M |
| 2 | **132** | Annoter la page au clic, façon Figma | 132 | — | S–M |
| 2 | **133** | Réglages : corrections, journal en tête du Diagnostic | 135, 156 | — | S |
| 2 | **134** | Jetons de thème, terminal qui suit le thème, contrastes | 136, 142 | 0027 | M |
| 2 | **135** | Onglet « Échanges ACP » | 157 | — | M |
| 3 | **136** | Réglages en trois groupes, page Apparence, pages d'agent | 143, 144 | — | L |
| 3 | **137** | Tableau de consommation | 145 | — | M |
| ensuite | 138–141 | Qualité A : processus et git, contrat ACP testable, indépendance, profil « Agent ACP personnalisé » | 138–141 | 0028 | M–L |
| ensuite | 142 | Pannes réseau et reconnexion progressive | 152 | — | S–M |
| ensuite | 143–145 | Qualité B : découpage, budgets, CI des sondes | 147–149 | — | M |
| plus tard | 146–148 | Instantané git par tour, préparation des worktrees, accessibilité | 150, 151, 155 | 0029 | M |

Écartés ou en réserve à la relecture : skills (146 de l'étude, en réserve), répondre au clavier
(137), palette ⌘K élargie (153), mentions `@` (154), tailles d'écran du navigateur (menu Mobile,
Tablette…), sélection d'élément façon DevTools.

Une vague se termine par la suite e2e complète, les fiches à jour, les CHANGELOG et un tag.

**Déroulé réel (24/10).** La vague 1 (128 à 131) est fusionnée dans la branche `integration/vagues`
(worktree `.claude/worktrees/essai-vague-1`), où `verify` passe ; `main` n'est pas touché. Sur
décision de Jérôme, **l'essai à la vraie souris et la suite e2e complète sont reportés à la fin
des vagues**, en une seule fois, parce qu'ils coûtent beaucoup de temps et de jetons. Chaque vague
part de `integration/vagues` et y est fusionnée ; `main` ne reçoit le tout qu'après ces essais et
l'accord de Jérôme.

Vagues 2 (132 à 135) et 3 (136, puis 137) fusionnées de même. Vague 4, lancée le 24/10 en quatre
sessions parallèles (138, 139, 140, 142), fusionnée dans l'ordre 139, 138, 140, 142 :
- la 140 a pris **ADR-0028** (indépendance aux agents) ; l'instantané git par tour (146) prendra
  **ADR-0029** ;
- fusion 139 × 140 : le rejeu des traces passe par `ProfileUpdates`, la grille de conformité est
  exemptée de la règle « nom d'agent en dur » comme les tests ;
- fusion 139 × 142 : un seul jeu de scénarios réseau (celui de la 142, `reseau-coupe` gardant la
  coupure en plein flux de la 139) ; défaut trouvé et corrigé, l'outil d'une tentative ratée restait
  « en cours » (évènement `attempt-failed`) ; `agent-host.ts` repassé sous son plafond
  (`session-blocker.ts`).
La 141 part ensuite de `integration/vagues`, sur le cahier des charges écrit par la 140 et le
défaut 3 ouvert par la 139 (agent minimal en lecture seule après une panne).

### Journal de la relecture des maquettes (23/10)

Ce que Jérôme a dit sur la planche, et ce qui en découle. C'est la référence pour les lots.

| Sujet | Remarque de Jérôme | Décision |
|---|---|---|
| Activité de l'agent | « ok avec ça » | Validé tel quel |
| Navigateur, tailles d'écran | « comme dans Claude Code ça suffit » : défilement, contenu qui suit la largeur de la colonne et l'agrandissement du panneau | Pas de menu de tailles ; `browser_resize` de l'agent gardé, sans couper la page, annulé à la fin de son tour |
| Navigateur, commenter (façon DevTools) | « pas la peine pour le moment » | Écarté |
| Navigateur, annoter | « un outil pour annoter à l'endroit du clic, comme dans Figma » ; puis « ça c'est top » | Épingles et bulles sur la page figée (fiche 132), validé |
| Barre latérale, retrait des filles | « hors de question de créer une double indentation » ; « jamais de double indentation dans les menus » | Règle générale (mémoire) : jamais de second niveau de retrait |
| Barre latérale, dossiers | « on devrait pouvoir expand / collapse un dossier », icônes en début de ligne incohérentes, « une ligne fine et des flèches pour les filles » | Chevron toujours visible ; colonne de gauche réservée à la structure ; états à droite |
| Barre latérale, chevron | « après le texte pour ne pas créer une indentation inutile » | Chevron juste après le nom du dossier |
| Barre latérale, hiérarchie | « la tâche mère devrait toujours être plus à gauche que les sous-tâches » | Plus de colonne d'icône vide : titres au bord, seules les filles décalées |
| Barre latérale, « finie » | « une icône à la place (coche ?) » | Coche verte |
| Barre latérale, trait | « pas beau… part trop près du titre… petites flèches arrondies » | Trait qui part sous le titre de la mère, coude arrondi et petite flèche |
| Barre latérale, icône de dossier | « même pas besoin de l'icône dossier » | Retirée : gras, couleur, chevron et espace distinguent un dossier |
| Barre latérale, menu « … » | « on garde toutes les fonctionnalités ? » | Oui : menu « … », redimensionnement, ⌘K, tri, repli gardé |
| Barre latérale, icône de filtre | mal alignée | Alignée sur les états des lignes |
| Barre latérale, compteur | « Non, on garde » « À traiter · N » | Gardé ; plus de compteur sur dossiers et archives |
| Réglages | « ok, j'aime bien » | Validé (13 onglets, 3 groupes, cartes, page par agent) |
| Apparence | « ok » ; « on a quand même le choix de la police ? » | Validé ; toute police installée pour les réponses, toute police à chasse fixe pour le code |
| Police du code et du terminal | « non » à la fusion | Séparées, chacune avec sa taille |
| Consommation | « vraiment pas mal, j'aime bien » ; « une option pour remettre à zéro » | Validé, plus « Remettre à zéro… » |
| Journal de consommation | « SQLite me semble nettement meilleure solution » | SQLite (`node:sqlite`) |
| Skills | « on peut laisser tomber pour le moment » | En réserve |
| Clavier, palette, mentions | « non on ne fait pas » | Écartés |
| Panne réseau | « oui il faut faire », sans parler de VPN, intervalles croissants et nombre de tentatives | 5 tentatives (2, 4, 8, 16, 32 s), message court |
| Journal et échanges ACP | demandés par Jérôme le 23/10 | Journal en tête du Diagnostic (133) ; onglet « Échanges ACP » (135) |

---

## 1. Vue d'ensemble

| It. | Thème | Contenu | Taille | Version |
|---|---|---|---|---|
| **0** | Finir proprement | « Patch » lisible, D25, D26, D27, C14, « sans serif », doc à jour | S | tag de la version en cours |
| **1** | Navigateur utilisable | défilement, zoom, tailles d'écran ; **collecte de la consommation** (chaque jour sans elle est perdu) | M | |
| **2** | Annoter la page | annoter à l'endroit du clic, façon Figma : épingles numérotées et bulles sur la page figée, envoyées ensemble à l'agent (réduit le 23/10) | S–M | 0.5 |
| **3** | Barre latérale lisible | sections, dossier = projet ; premières retouches des réglages, journal en tête du Diagnostic ; terminal qui suit le thème | M | |
| **4** | *Qualité A* | processus orphelins, git en concurrence, contrat ACP testable, indépendance aux agents, profil « Agent ACP personnalisé », onglet « Échanges ACP » | M | |
| **5** | Réglages et apparence | jetons de thème, réglages en 3 groupes, section Apparence, pages d'agent | L | 0.6 |
| **6** | Consommation et skills | tableau de bord, export ; skills visibles, `/create-skill` | M | |
| **7** | *Qualité B* | découpage des gros fichiers, budgets de performance, tests de composants, CI hebdomadaire des sondes | M | 0.7 |
| **8** | Productivité | annuler un tour (instantané git), préparer les worktrees, pannes réseau, accessibilité | L | 0.8 |

Le navigateur passe en premier : c'est le seul point jugé « pas utilisable ». La barre latérale et les réglages viennent ensuite, parce qu'ils se voient tous les jours. Le tableau de consommation arrive plus tard, mais sa collecte commence dès l'itération 1.

---

## 2. Les itérations en détail

### Itération 0 — Finir proprement (S, avant le prochain tag)

**127 — Activité lisible pendant un tour** (S, générique)

*Constat.* OpenCode envoie `tool_call` « patch » en `pending` avec `rawInput: {}`, puis plus rien pendant que le modèle écrit le patch : 38,7 s relevées dans le journal de recette. Tout arrive en 4 ms à la fin. OpenCode ignore `session.tool.input.delta`, que seule son interface terminal utilise. Bobine aggrave l'attente de deux façons :
- sans cible, `toolLabel` ne produit rien (`src/shared/tool-label.ts:221`) et on retombe sur le titre brut « patch » ;
- le chronomètre de `WorkingIndicator` compte la durée du tour depuis le message de l'utilisateur, alors qu'il se lit comme la durée du patch.

Bob n'est pas touché : il envoie sa carte complète d'un coup.

*Ce qu'on fait.*
- Un outil `pending` sans cible ni autorisation en attente prend le libellé de son genre : « Prépare une modification… », « …une commande », « …une lecture », « …une recherche », sinon « Prépare un outil… ». Le titre brut passe en infobulle.
- Le chronomètre mesure l'étape en cours. La durée du tour passe en infobulle. Il reste une seule ligne d'état, sans chronomètre par carte.
- Un outil interrompu sans cible devient « Modification · interrompu » (C6).
- Le JSON brut d'`execute` (D6, `Promise.allSettled`) est affiché indenté, avec de vrais retours à la ligne.

*Agent factice.* Scénario `outil-en-preparation` : `pending {}` pendant 3 s, puis `in_progress` avec `locations`, puis `completed`. Une variante interrompue par Échap, et un `shell` qui n'a que `{cwd}`.

*Acceptation.*
- Pendant toute l'attente, ni la carte, ni le résumé de groupe, ni l'indicateur n'affichent jamais « patch ».
- Le temps repart de zéro à chaque étape.

**128 — Défauts du rejeu et finitions**

- **D25**, défaut majeur : un sous-agent lancé en arrière-plan reste « en cours » pour toujours si un autre message part avant sa fin.
  - Cause : `findTool` (`src/shared/transcript.ts:951`) ne cherche la carte que dans le tour en cours. Les `subagent-run` et `subagent-update` d'un sous-agent lancé au tour précédent sont jetés.
  - Correction : chercher la carte dans tout le fil pour ces deux évènements.
  - Tests : un test du réducteur, et le scénario `sous-agent-arriere-plan` avec un message envoyé avant la fin du sous-agent.
- **D26** (= D4) : à l'envoi, le fil revient en bas, ce qui évite le doublon envoyé à l'agent.
- **D27** : la barre du plan ne remonte plus sous le pointeur.
- **C14** : le message de commit proposé n'est plus coupé au milieu d'un mot.
- **Vocabulaire** : « Sans empattements » devient « Sans serif », et « À empattements » devient « Serif ».
  - Endroits : `fr.json:885-887`, glossaire `docs/traduction.md`, fiches 027 et 070, `preferences.ts`.
  - Pour la recherche dans les réglages, « empattements » reste un synonyme caché.
  - `en.json` est déjà correct.
- **Doc** :
  - fiches 121, 122 et 124 mises à jour après le rejeu ;
  - contradiction de `architecture.md:75` sur la vue Git levée ;
  - fiches ouvertes pour les défauts présumés encore ouverts (D9, D14, D15, D16, D19, D23, D11, D7). Ceux qui ne se reproduisent plus sont refermés.

**Clôture** : suite e2e complète verte (la dernière date d'avant les fiches 121 à 126), puis tag.

### Itération 1 — Navigateur utilisable (M)

*Constat.* Le navigateur est une vraie `WebContentsView` native posée sur le panneau. C'est la bonne base, et on la garde. Les défauts ont trois causes :
1. **Taille d'écran figée et invisible.** `browser_resize` émule une taille sans réduire l'affichage (`cdp-tab.ts:344`) :
   - un écran émulé plus haut que le panneau coupe le bas de la page, qu'on ne peut alors pas atteindre en défilant ;
   - l'émulation survit aux navigations, et rien dans la barre ne la montre ni ne permet de l'annuler.
2. **Pas de zoom de page.** ⌘+ zoome toute l'interface, ce qui décale la vue : les positions envoyées par le renderer sont en pixels CSS, et le main les pose sans tenir compte du facteur de zoom (`browser-manager.ts:568`).
3. **Molette** : elle ne serait prise en compte que par une page qui a le focus (Electron 44, relevé de la fiche 007). Pas encore prouvé : à confirmer par la sonde du lot 129.

Aucun essai e2e ne voyait la vue native, ce qui explique que ces défauts aient échappé aux tests.

**129 — Navigateur : sonde, interaction, zoom**

- **Sonde** : mesurer la molette, le zoom, le paramètre `scale` du CDP et `Overlay.setInspectMode` sur Electron 44.
- **Captures** : les captures e2e composent enfin la vraie page (`capturePage`).
- **Positionnement de la vue** :
  - positions converties selon le zoom de l'interface ;
  - suivi par `ResizeObserver` plutôt qu'à chaque image.
- **Raccourcis** quand la page a le focus : ⌘L, ⌘R, ⌘[ et ⌘].
- **Zoom** : `setZoomMode('isolated')` par onglet. ⌘+, ⌘− et ⌘0 agissent sur la page quand elle a le focus. Une puce « 110 % » s'affiche seulement quand le zoom n'est pas à 100 %.
- **Coordonnées** : celles données à l'agent passent en pixels CSS.

*Acceptation.*
- Défilement à la molette, au trackpad et au clavier.
- Vue exacte avec l'interface zoomée de 80 à 150 %.
- L'agent clique au bon endroit avec la page zoomée à 150 %.

**130 — Navigateur : la page suit le panneau** (réduit après la relecture des maquettes, 23/10 : pas de menu de tailles d'écran, comme dans Claude Code)

- La page suit la largeur de la colonne quand on la redimensionne, et quand on agrandit ou réduit le panneau.
- L'agent garde `browser_resize` pour essayer une page en mobile. La taille qu'il impose ne coupe plus la page (elle est réduite pour tenir), et elle s'annule à la fin de son tour.

*Acceptation.*
- Après un redimensionnement ou un agrandissement du panneau, `innerWidth` vaut la largeur de la zone de page.
- Après un `browser_resize` de l'agent, la page entière se fait défiler ; au tour suivant, elle a repris la largeur du panneau.

**ADR-0026** : on garde la vue native ; tailles d'écran et commentaires passent par le CDP. Il complète l'ADR-0006.

**131 — Journal de consommation (collecte)**

*Constat.*
- Le modèle n'est enregistré nulle part.
- Le détail par tour n'existe que depuis le 21/10, et seulement pour les 100 derniers tours.
- On perd les données quand on supprime une conversation ou qu'on passe à un autre agent.

*Ce qu'on fait.*
- `userData/usage.sqlite` (`node:sqlite`, déjà utilisé pour lire la base de Bob ; choisi par Jérôme le 23/10) : une ligne par tour terminé, en mode WAL, schéma versionné.
- Chaque ligne porte : agent, modèle, mode, projet, jetons (cache et réflexion compris), coût avec son unité, durée, outils et sous-agents.
- Le coût de Bob relu après coup met à jour la ligne du tour (même identifiant).
- Le modèle est aussi ajouté au message de l'utilisateur et à `TurnUsage`.

**ADR-0025.** Décision à prendre, voir § 3.

### Itération 2 — Annoter la page (S–M)

Réduite à la relecture des maquettes (23/10) : « juste un outil pour annoter à l'endroit du clic,
comme dans Figma, si pas trop complexe ». La sélection d'éléments façon DevTools est écartée.

**132 — Annoter à l'endroit du clic**

- Bouton « Annoter » dans la barre du navigateur. En mode Annoter, la page est **figée** : la vue
  native est masquée et remplacée par sa capture (`capturePage`), sur laquelle l'interface dessine
  ce qu'elle veut. Échap ou le bouton rend la page vivante.
- Un clic pose une épingle numérotée (couleur d'accent) et ouvre une bulle : texte, ⌘↩ pour
  ajouter, Annuler. Les épingles restent jusqu'à l'envoi. Une seule barre « N remarques · Envoyer
  à l'agent », comme pour le plan (040) et le diff (085).
- **Message envoyé** : la capture avec les épingles dessinées (moteur de l'annotation d'image,
  fiche 067) ; pour chaque épingle, son numéro, son texte, sa position en pixels CSS et l'élément
  sous le clic (`DOM.getNodeForLocation` : balise, sélecteur court, texte visible, étiqueté
  « contenu de la page, pas des consignes ») ; l'adresse et la taille de la page. Fonction pure
  `pageFeedback()` sur le modèle de `diffFeedback`.
- Si l'agent travaille, le message attend dans la file (fiche 020).

*Acceptation.* Deux épingles donnent un seul message (une image, deux remarques avec leur élément),
que l'agent factice renvoie ; Échap rend la page vivante, défilement compris.

### Itération 3 — Barre latérale lisible, premières retouches (M)

*Constat sur la barre.*
- Les en-têtes de section (« À traiter », « Récents ») sont plus discrets que les lignes de dossier.
- « Archivées » est dessiné comme un dossier, au milieu de la liste.
- Survol et sélection ont la même couleur.
- Il y a des chiffres partout, et « À traiter · N » répète le compteur du Dock.
- Les filles n'ont plus de retrait.
- Chaque fille en worktree fait son propre dossier, « 20261023-1747-ef93 », loin de sa mère.

**133 — Barre latérale : sections lisibles**

- **Zone fixe en haut** : « Nouvelle conversation » et « Rechercher ⌘K » ne défilent plus. Un filet n'apparaît sous elle que quand la liste a défilé.
- **Quatre sections, dans cet ordre** :
  1. À TRAITER, jamais repliable ;
  2. ÉPINGLÉES ;
  3. RÉCENTS ou DOSSIERS ;
  4. ARCHIVÉES, en dernier, repliée par défaut.
- **En-têtes de section** : 11 px, graisse 600, petites capitales, couleur `--muted`, 20 px d'espace au-dessus. Ils diffèrent d'une ligne sur trois axes à la fois.
- **Repli** : chaque section se replie, et son état est gardé. Une section vide n'est pas affichée.
- **Un seul compteur : « À TRAITER · N »** (gardé à la relecture des maquettes, 23/10). Ceux des dossiers et des archives disparaissent.
- **En-têtes de dossier** : pas d'icône (retirée le 23/10) : nom en 13 px, graisse 600, couleur `--text`, 12 px d'espace au-dessus, chevron toujours visible juste après le nom (▾ ouvert, ▸ replié, repli gardé : aucun décalage, 23/10), sans fond au survol ; un dossier replié n'affiche que son nom (précisé le 23/10).
- **Colonne de gauche = structure seulement** (ligne des filles) ; l'état toujours à droite, en icône (roue « en cours », coche verte « finie », 23/10) ou en heure ; la raison d'« À traiter » passe devant sa seconde ligne.
- **États** : le survol et la sélection ont des couleurs distinctes.

**134 — Barre latérale : dossier = projet**

- **Plus de colonne d'icône vide** : les titres partent du bord, comme l'en-tête du dossier (≈ 30 px de titre gagnés). Seules les filles gardent la colonne, avec un **trait fin** qui part un peu sous le titre de la mère et finit en **coude arrondi et petite flèche** vers chaque fille (SVG dans la colonne, 23/10) : la mère est toujours plus à gauche que ses filles, sans second niveau de décalage (précisé le 23/10).
- Les **branches** (« Repartir de ce message ») ne sont plus rangées sous leur origine : conversations à part entière, origine dans leur en-tête et l'infobulle (23/10).
- Le mode « Dossiers » regroupe par racine du dépôt (`ConversationSummary.project`). Une fille en worktree reste ainsi sous sa mère.

**135 — Réglages : corrections sans changer la structure**

- **Doublons retirés** :
  - « Relire le PATH » disparaît d'Agents et reste dans Diagnostic ;
  - le bloc de version disparaît de Réglages › À propos et reste dans la fenêtre « À propos ».
- **Notifications** : les textes des notifications et du compteur du Dock deviennent cohérents. Aujourd'hui, une note dit le compteur actif alors que son interrupteur est grisé.
- **Aides** : une phrase de 90 caractères au plus.
- **Liste tronquée** : corrigée (« Same as the current conversa… »).

**156 — Le journal en tête du Diagnostic** (S, ajouté le 23/10)

*Constat.* Les journaux s'ouvrent déjà (Réglages › Diagnostic, boutons « main.log » et
« agents.log » ; Aide › Afficher le journal), mais c'est difficile à trouver.

*Ce qu'on fait.* Une carte « Journal » juste après le résumé du Diagnostic : chaque fichier avec sa
taille et son contenu, « Ouvrir » (Console) et « Afficher dans le Finder », puis le niveau du
journal. Le chemin du dossier n'est plus répété dans « Bobine ». La recherche dans les réglages
trouve « journal » et « log ».

**136 — Le terminal suit le thème**

- **Couleurs** : xterm change de couleurs avec la palette (Sépia, Nuit noire) et l'accent, sans rouvrir l'onglet. Il n'écoute aujourd'hui que le clair et le sombre (`TerminalTab.tsx:160`).
- **Palette ANSI** : une palette lisible sur fond clair. Aujourd'hui, le jaune ne se lit pas sur blanc.
- **Au lancement** : la fenêtre s'ouvre directement sur le fond du thème choisi, sans flash de couleur.

**137 — Répondre au clavier aux cartes qui attendent** — **écartée** (relecture des maquettes, 23/10 : « non, on ne fait pas »)

- On répond avec les touches 1 à n et Entrée, comme dans Claude Code. Les touches sont prises depuis la zone de saisie seulement quand elle est vide.
- Un raccourci « Aller à ce qui attend ».
- *Pourquoi* : Bob demande une autorisation à chaque mise à jour de sa liste de tâches. C'est le geste le plus fréquent de la journée.

**Clôture** : essai à la vraie souris de la barre latérale. Les captures e2e ne montrent ni les zones qu'on fait glisser ni la page native.

### Itération 4 — *Qualité A* : fiabilité et indépendance (M)

**138 — Processus et git**

- **Arrêt des processus** : `killTree` n'envoie que SIGTERM (`process-utils.ts:7`). On ajoute un SIGKILL au bout de 3 s.
- **Processus orphelins** : un registre `agents.pids`, vidé au démarrage. Aujourd'hui, un plantage du main laisse des `bob acp` vivants, parce qu'ils sont lancés en groupe à part.
- **Git en concurrence** : une file `GitQueue` par racine de dépôt. Les conversations parallèles, l'état git et les fusions ne se marchent plus dessus sur `index.lock`.
- **Sécurité** : un gestionnaire de permissions sur la session Electron par défaut.

**139 — Contrat ACP testable**

- **Grille de tests** : `conformance.test.ts` croise trois profils d'agent factice (« façon Bob », « façon OpenCode », « ACP minimal », c'est-à-dire sans `loadSession`, images, plan ni usage) avec douze parcours :
  - prompt ; autorisation acceptée, puis refusée ;
  - plan ; cycle d'un outil ;
  - annulation ; panne puis relance ; reprise ;
  - sous-agent en arrière-plan avec un message pendant ;
  - compaction ; élicitation ; file d'attente ; changement d'agent.
- **Ce qui est vérifié à chaque fois** : plus aucune carte « en cours » à la fin, pas de doublon, fil durable identique au fil vivant.
- **Traces réelles** : les sondes enregistrent des traces nettoyées (`__traces__/bob-2.0.6/*.ndjson`), rejouées dans le réducteur et comparées à un instantané.
- **Scénarios factices manquants** :
  - réseau coupé en plein flux, limite de débit 429, réveil après une veille ;
  - diff de plus de 5 000 lignes, fichier binaire, sortie de commande de 1 Mo ;
  - `available_commands_update` en cours de session, démarrage lent ;
  - texte avec emoji, écrit de droite à gauche, très longues lignes.

**140 — Indépendance aux agents**

*Constat.* Bobine tiendrait un troisième agent ACP à environ 80 % sans toucher l'interface. Les écarts restants :
- Reconnaissance des sous-agents : faite d'après les formats de Bob et d'OpenCode dans `shared/subagent.ts:45-110`.
- `_meta` de Claude et de Codex lus dans `shared/questions.ts`, ce que AGENTS.md interdit doublement.
- Étiquettes `'bob' | 'opencode'` traduites par des tables dans `agent-config/rules.ts`, `mcp-files.ts` et `provider-files.ts`. L'ADR-0015 avait écarté exactement ce modèle.

*Ce qu'on fait.*
- Un point d'extension `SubagentFormat`.
- Les `_meta` passent par un adaptateur, ou sont retirés.
- Trois sources portées par le profil : `RulesSource`, `McpConfigSource` et `ProvidersSource`.
- Une règle ESLint contre les littéraux `'bob'` et `'opencode'` hors des adaptateurs.
- `testedVersions` dans le profil : le Diagnostic prévient quand la version de l'agent diffère de la version sondée.

**157 — Onglet « Échanges ACP » dans le panneau** (M, ajouté le 23/10)

- Un outil du panneau, ouvert par le « + » : les messages JSON-RPC de la conversation, dans les
  deux sens, en direct (heure, sens, méthode ou type de mise à jour, détail, taille, temps de
  réponse). Un clic déplie le JSON brut ; les morceaux de texte sont regroupés et se déplient ;
  filtre, pause, copie, lien vers `agents.log`.
- Branché sur le relevé existant (`main/agent/acp-log.ts`, fiche 080), par où passe chaque ligne
  lue ou écrite : une copie en mémoire par conversation (les 2 000 derniers messages), secrets
  masqués par `log-redact`, envoyée au renderer par un canal IPC. Quel que soit le niveau du
  journal, rien de plus sur le disque.
- Générique : c'est le protocole, pour tous les agents. Agent factice : e2e qui ouvre l'onglet,
  joue `demo` et retrouve `session/prompt`, `tool_call`, `request_permission` et sa réponse.

**141 — Profil « Agent ACP personnalisé »**

- On déclare une commande, ses arguments et ses variables d'environnement, sans toucher au code. Les capacités sont lues à `initialize` (fiche 054).
- C'est la meilleure assurance contre la dépendance à Bob et à OpenCode.
- Ce profil sert aussi de « persona minimal » dans la grille de tests de 139.

### Itération 5 — Réglages et apparence (L, suite e2e complète)

*Constat sur les réglages.*
- **Onglets déséquilibrés** :
  - « Agents et dossiers » empile 11 sections, soit environ 4 écrans ;
  - « Général » aligne 13 réglages sans aucun titre ;
  - « Terminal » n'en a que 2.
- **Apparence éclatée** : elle est répartie entre trois onglets.
- **Navigateur coupé en deux** : il se règle dans Général, mais ses sites autorisés sont dans Agents.

*Constat sur l'apparence.*
- Les blocs de code sont toujours en `github-dark`, même en Clair et en Sépia.
- La sortie de commande est toujours sombre.
- Sépia et Nuit noire ne changent que les gris.
- « Système » interdit Sépia et Nuit noire.
- `--muted` est sous le contraste AA (environ 4,1:1).

**142 — Jetons de thème (source unique)**

- **Source** : `src/shared/themes.ts` décrit les teintes, les rôles (`--bg`, `--text`, `--muted`, `--accent`, `--on-accent`, couleurs de diff…) et les jetons de domaine (`--code-*`, `--syn-*`, `--ansi-0…15`).
- **Génération** : le fichier génère `themes.generated.css`, et `verify` contrôle qu'il est à jour.
- **Qui suit les jetons** : la coloration syntaxique, la sortie de commande, xterm, Mermaid et le fond au lancement. `github-dark` est retiré.
- **Contrastes** : un test unitaire vérifie tous les couples thème × accent :
  - 4,5:1 pour le texte ;
  - 3:1 pour les éléments d'interface ;
  - 4,5:1 pour le texte sur l'accent.
- **ADR-0027** : jetons en TypeScript, pas de thèmes importables.

**143 — Réglages en trois groupes et section Apparence**

- **Douze onglets en trois groupes**, séparés par un espace dans la colonne de gauche :
  - **L'app** : Général · Apparence · Notifications · Raccourcis ;
  - **Le travail** : Conversations · Agents · Serveurs MCP · Commandes ;
  - **La maintenance** : Confidentialité · Données · Diagnostic · Nouveautés.
  Chaque réglage existant y a sa place (tableau avant → après dans la fiche).
- **Gabarit commun** : un titre de section, puis une carte arrondie qui contient les lignes. Les réglages qui dépendent d'un autre sont en retrait de 16 px sous lui. Un « Avancé » replié en bas de page.
- **Section Apparence** :
  - Mode : Système, Clair ou Sombre, avec un **thème clair** (Clair ou Sépia) et un **thème sombre** (Sombre ou Nuit noire) au choix ;
  - Accent : 6 teintes, plus « Comme le Mac » ;
  - Police des réponses : sans serif ou serif du système, ou toute police installée sur le Mac (ajouté à la relecture, 23/10), avec sa taille ;
  - Largeur du fil ;
  - **police du code** (blocs, diffs, sorties) et **police du terminal**, séparées, chacune prise parmi les polices monospace installées (lues par le main, sans dépendance) et avec sa taille (fusion refusée à la relecture, 23/10) ;
  - un aperçu qui montre réponse, code et terminal.
- **Préférences enregistrées** : les clés restent les mêmes, sauf pour le thème (Sépia et Nuit noire deviennent un thème clair ou sombre au choix). L'ancien choix est repris automatiquement.

**144 — Pages d'agent**

- La liste des agents mène à une page par agent : état et version, connexion (clés d'API), fournisseurs de modèles quand le profil en déclare, ce qu'il annonce, « Propre à X ».
- Les sections de la page viennent du profil, comme `specificItems` : aucun code propre à un agent dans l'interface.

### Itération 6 — Consommation et skills (M)

**145 — Tableau de consommation**

- **Emplacement** : un nouvel onglet **Réglages › Consommation**. Il est aussi accessible par un lien « Toute la consommation… » depuis la puce de la conversation.
  - La puce parle de cette conversation, le tableau de toutes.
  - La dépense de Bob « sur ce Mac » et le quota passent de la puce au tableau.
- **Filtres** : période (Aujourd'hui, 7 j, 30 j, Ce mois, Tout) et agent.
- **Chiffres clés** : échanges, jetons entrée/sortie, temps actif, coût **par unité**. Dollars et bobcoins ne s'additionnent jamais.
- **Graphique par jour** : barres empilées par agent ou par modèle, en SVG fait maison (environ 200 lignes, sans dépendance).
- **Tableaux** : par modèle, par projet (worktrees regroupés), et les 10 conversations qui ont le plus consommé ; un clic ouvre la conversation.
- **Historique** : reprise une seule fois depuis les fils existants, sans doublon.
- **Export** : CSV, par « Enregistrer sous ».
- **Remise à zéro** : « Remettre à zéro… » en bas de la page (bouton rouge, confirmation ; le quota de Bob n'est pas concerné), demandé à la relecture le 23/10.

**146 — Skills** — **en réserve** (relecture des maquettes, 23/10 : « on peut laisser tomber pour le moment ») ; l'étude reste ci-dessous.

*Constat.*
- OpenCode 2 lit les `SKILL.md` (`.opencode/skills`, `.agents/skills`, `.claude/skills`, et ces mêmes dossiers dans `~`). Il n'a pas de create-skill.
- Par ACP, il n'annonce peut-être plus les skills comme commandes « / », alors que la 1.19 le faisait. **Jamais vérifié en 2.x**, et c'est sans doute l'origine de l'impression de Jérôme.
- Bob a son propre `create-skill` intégré.
- `.agents/skills` est lu par Bob et par OpenCode : c'est l'emplacement commun.

*Position.* Bobine **montre** les skills et **aide à en créer** par l'agent. Elle ne devient pas un éditeur de skills propre à chaque agent.

*Ce qu'on fait.*
1. **Sondes**, sans coût :
   - OpenCode : un skill d'essai est-il annoncé en « / » ? `@skill-id` marche-t-il par ACP ?
   - Bob : le même skill est-il annoncé à l'ouverture de session ?
2. **`/create-skill`**, commande de l'app :
   - une consigne qui demande à l'agent un `SKILL.md` conforme au standard, dans `.agents/skills/<nom>/` ;
   - si l'agent annonce sa propre commande du même nom (Bob), la sienne passe en premier.
3. **Skills de la session** : leur liste apparaît dans « Réglages de la session », avec un aperçu.
   - Les emplacements sont déclarés dans le profil, comme pour les règles (fiche 056).
   - Les skills du projet ne comptent que si le dossier est approuvé (Bob).
4. **Si la sonde confirme qu'OpenCode ne les annonce plus** : Bobine les ajoute au menu « / », avec l'origine « Skill ».

### Itération 7 — *Qualité B* : découpage et budgets (M)

**147 — Découpage**

- **Fichiers au plafond à découper** :
  - `agent-host.ts` (1 050 lignes) → cycle de vie de la session, et tours ;
  - `manager.ts` (1 045) → évènements, et registre des agents vivants ;
  - `applyUpdateItems` (complexité 40) → une table de gestionnaires.
- **Composants** : les hooks sortent de `SidePanel`, `ChangesTab`, `SimulatorTab` et `AndroidTab`, et leurs exceptions ESLint disparaissent.
- **Plafonds** : abaissés à 900 puis 800 lignes, en cliquet.

**148 — Budgets et tests**

- **Performance** : 5 000 éléments et 10 000 morceaux passent dans `reduceTranscript` sous un seuil fixé. Aujourd'hui, chaque morceau recopie tout le fil.
- **Mémoire** : celle du main mesurée avec 6 conversations vivantes.
- **Suite e2e** :
  - moins de 5 min avec 3 suites en parallèle ;
  - `base` rejouée 20 fois pour mesurer l'instabilité (un échec par délai dépassé le 23/10).
- **Tests de composants** :
  - `panel/` n'en a aucun sur ses 15 composants : on commence par `WorktreeBar`, `ChangesTab`, `CommitForm` et `MainDirtyCard` ;
  - puis le plus urgent de `composer/` et de `settings/`.

**149 — CI hebdomadaire sur macOS** : `opencode-probe --offline` et la grille de tests de 139.

### Itération 8 — Productivité (L)

| N° | Quoi | Pourquoi | Taille |
|---|---|---|---|
| 150 | **Instantané git par tour**, puis « Annuler ce tour » et « Annuler ce bloc » | La remise en état d'aujourd'hui dépend des diffs des agents, partiels chez OpenCode, et n'annule pas les effets des commandes (`sed`, générateurs). Un instantané sous `refs/bobine/…`, sans toucher l'index ni HEAD, rend Bobine indépendante des diffs. **ADR-0029**, voir § 3 | M |
| 151 | **Préparer les worktrees** : fichiers copiés (`.env`…) et commande `setup` dans `.bob/launch.json`, lancée dans le terminal de l'app | Un worktree neuf n'a ni `node_modules` ni `.env`, et l'agent brûle des bobcoins à les refaire | S–M |
| 152 | **Pannes réseau et 429** : un message court (« Connexion perdue — nouvelle tentative dans 8 s (3 sur 5) »), reconnexion automatique à intervalles croissants (5 tentatives : 2, 4, 8, 16, 32 s), puis « Réessayer » ; le message reste en file (précisé à la relecture, 23/10) | Aucune erreur réseau n'est reconnue aujourd'hui | S–M |
| 153 | ~~**Palette ⌘K** : actions, réglages, agent, modèle, mode, commandes « / » (préfixe `>`). **↑ et ⌃R** pour rappeler les messages envoyés~~ **écartée** (23/10) | Une seule porte d'entrée, sans rien ajouter à l'écran | S–M |
| 154 | ~~**Mentions `@dossier`, `@conversation`, `@url`**~~ **écartée** (23/10) | `@conversation` donne au modèle interne le travail fait avec Bob sans changer d'agent. `@url` passe par le navigateur intégré, qui a les cookies de l'intranet | M |
| 155 | **Accessibilité** : `role="log"`, annonces de fin de tour et de ce qui attend, navigation au clavier dans le fil, focus visible, contrôle axe-core dans les e2e | Seuls 4 composants annoncent quelque chose aux lecteurs d'écran | M |

**Plus tard (P3)**
- Tâches récurrentes, dont le résultat arrive dans « À traiter ». Utile surtout avec un modèle interne, puisqu'il ne coûte pas de bobcoins.
- Proposer à OpenCode de relayer `session.tool.input.delta` par ACP. Bobine afficherait alors le patch pendant qu'il s'écrit, sans code de plus : le réducteur fusionne déjà les `rawInput` partiels.

---

## 3. Décisions

### Tranchées (UX, justifiées dans chaque fiche ; à contester avant l'itération concernée)

| Sujet | Décision | Revient sur |
|---|---|---|
| Barre latérale | ~~Aucun compteur dans la barre~~ : refusé (23/10), « À traiter · N » reste ; plus de compteur sur les dossiers ni les archives | — |
| Barre latérale | ~~Les filles reprennent un retrait de 20 px~~ : refusé (23/10), ↳ sans retrait comme aujourd'hui | — |
| Activité de l'agent | Une seule ligne d'état, avec le chronomètre de l'étape ; pas de chronomètre par carte | — |
| Navigateur | ~~Bac de remarques sous la page~~ : remplacé (23/10) par l'annotation au clic sur la page figée, épingles et bulles dessinées par l'interface | — |
| Apparence | Pas de thèmes importables ni d'accent libre : le contraste garanti compte plus | — |
| Apparence | ~~Une seule police de code, terminal compris~~ : refusé (23/10), polices et tailles du code et du terminal séparées | — |
| Réglages | 12 onglets en 3 groupes ; version de l'app seulement dans la fenêtre « À propos » | Réglages › À propos |
| Consommation | ~~Un onglet des réglages, pas une fenêtre à part~~ : remplacé (24/10) par la page « Mon activité » de la fenêtre principale (fiche 144, ADR-0031) | — |

### Choix structurants à soumettre (avant l'ADR)

1. **Format du journal de consommation** (ADR-0025, itération 1) : **tranché le 23/10, SQLite** (`node:sqlite`), plutôt que JSONL par mois. Raisons : requêtes par période, agent et modèle sans tout relire ; module déjà en usage dans le main.
2. **Instantané git par tour** (ADR-0029, itération 8 ; 0028 pris par la fiche 140) :
   - **Oui, sous `refs/bobine/<conversation>/<tour>`.** Recommandé.
   - Garder la remise en état fondée sur les diffs des agents.
3. **axe-core en dépendance de développement** pour les e2e (itération 8). Recommandé : oui, puisqu'il n'est pas livré dans l'app.
4. ~~**Skills** (itération 6)~~ — sans objet : mis en réserve le 23/10.
   - **Bobine les montre et propose `/create-skill`.** Recommandé.
   - Rien, et une page de documentation.
   - Un éditeur complet. Déconseillé, contraire à la fiche 045.

---

## 4. Écarté, et pourquoi

| Idée | Raison |
|---|---|
| Navigateur dessiné dans un canevas (screencast) | Latence ; saisie IME, sélection et curseurs à refaire |
| Calque injecté dans la page pour commenter | La CSP de la page, qui voit aussi son DOM changer |
| Retrouver le fichier source par les internes de React | Pas générique |
| Débit de jetons, ou diff qui se remplit pendant le patch | Aucun agent cible ne l'envoie par ACP |
| Lire le `patchText` d'OpenCode pour trouver les fichiers | Du code propre à un agent pour 4 ms de gain |
| Éditeur de thèmes, densité, interlignage | Le coût en captures et en contrastes n'est pas justifié |
| Éditeur de fichiers, mentions de symboles | Bobine n'est pas un IDE |
| Plusieurs fenêtres | Coût L ; la vue côte à côte, le panneau agrandi et la fenêtre rapide suffisent |
| Partage par lien | Des données d'entreprise partiraient sur un serveur tiers |
| Catalogue de serveurs MCP | Pousserait vers des serveurs non vérifiés |
| Mise à jour automatique | Écartée (ADR-0023) |
| Visite guidée au premier lancement | Du bruit pour une interface sobre |
| Prix estimés pour les agents qui n'en donnent pas | Règle de la fiche 019 : jamais d'estimation |
