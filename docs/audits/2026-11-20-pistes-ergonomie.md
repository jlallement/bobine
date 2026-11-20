# Pistes d'ergonomie — 2026-11-20

Réflexion de design produit, sans code. Point de vue : un développeur qui utilise tous les jours
Claude Code (desktop et terminal), Codex, Cursor, Warp ou Zed, et qui ouvre Bobine pour piloter
IBM Bob ou OpenCode. Filtre appliqué à chaque piste : **la conversation au centre, le reste à la
demande ; Bobine n'est pas un IDE.**

**Sources.** Recettes du 2026-11-19 (`docs/recettes/2026-11-19-exploration-opencode-sol.md`,
constats D1–D41, R1–R10) et du 2026-11-20 (`docs/recettes/2026-11-20-recette-refonte-travail-delegue.md`,
N1–N20, P1–P6) ; fiches 255 à 271 ; guide `docs/guide/fr/` ; `docs/agents.md` ; environ 25
captures e2e de `e2e/captures/` (clair et sombre) ; lecture ciblée du renderer. L'app n'a pas été
ouverte et aucun e2e n'a été lancé. Les chemins de captures sont relatifs à `e2e/captures/`, sauf
ceux de la forme `2026-11-…/captures/…`, relatifs à `.pilote/sessions/`.

La vue des fichiers est traitée par la fiche 271 : ce document n'y revient que pour signaler un
lien (la palette ⌘K, § 4).

---

## Synthèse

Bobine est riche et déjà soignée. Ses fondamentaux sont là : la recherche dans le contenu (⌘K),
« Où en était-on ? », l'annulation fichier par fichier, la reprise d'un message, `@`, `/`, le
glisser-déposer, les notifications, le Dock, « À traiter », l'aide intégrée et les astuces. Les
frictions qui restent ne tiennent pas à un manque de fonctions. Elles viennent de **trois écarts
de lisibilité** :

1. **Le travail se perd entre deux endroits.** Un travail ou un sous-agent vit dans une carte du
   fil, dans la barre latérale et dans Session › En cours, mais on ne passe pas toujours de l'un à
   l'autre. Le pied de la barre latérale dit « Prêt » pendant qu'un travail tourne.
2. **Les noms ne disent rien.** Conversations et travaux portent le début du premier message, les
   branches une date (`bobine/20261120-1739-8a55`), et les durées s'écrivent de trois façons.
3. **On ne sait pas revenir en arrière ni reprendre après une absence.** La machinerie existe
   (fiche 023, `undoEdits` ; fiche 156, « Où en était-on ? » ; fiche 119, « À traiter »), mais
   elle n'est ni au bon endroit ni au bon moment.

### Top 5

| | Proposition | Coût | Pourquoi d'abord |
|---|---|---|---|
| ★1 | **Défaire ce tour** : un bouton dans le pied de chaque réponse remet les fichiers du tour (CM1) | moyen | L'équivalent du « restore checkpoint » de Cursor et du `/rewind` de Claude Code. La mécanique de la fiche 023 existe déjà ; c'est le filet de sécurité qui rend l'agent moins intimidant. |
| ★2 | **« Depuis votre départ » et statut global des agents**, dans le pied de la barre latérale (CM2) | moyen | Répond à « qu'est-ce qui s'est passé pendant ma réunion ? » sur toutes les conversations à la fois. Le pied ne dira plus « Prêt » pendant qu'un travail tourne. |
| ★3 | **Des cartes d'incident qui disent quoi faire** : une phrase, la cause, les boutons ; le détail brut replié (CM5) | moyen (petit pour le plantage) | Les fiches 210, 259 et 267 ont traité modèle refusé et quota. Le plantage (`41-plantage`) et les erreurs génériques montrent encore la sortie d'erreur brute, sans action dans la carte. |
| ★4 | **Des noms lisibles** : titres courts des conversations et des travaux, branches nommées d'après le travail (CM4 + QW5) | moyen (branches : petit) | On retrouve, on fusionne et on lit `git log` par les noms. Aujourd'hui, la conversation et son travail portent le même début de phrase coupé (`263-carte-en-cours`). |
| ★5 | **La conversation garde sa place en fenêtre étroite** : le panneau se replie seul, et le sélecteur Code/Discussion devient compact (QW4) | petit | À 720 px, le panneau prend un tiers de la fenêtre et la saisie déborde (`270-etroite`). C'est l'esprit « conversation au centre », et D25 reste ouvert depuis deux recettes. |

**Décompte des propositions** : 14 quick wins, 8 chantiers moyens, 7 idées à creuser (29 en tout).

---

## 1. Frictions actuelles, par moment du parcours

Gravité : **G** gêne réelle au quotidien, **m** mineur, **i** à surveiller. « Ouvert » = constat de
recette pas encore traité.

### 1.1 Premier lancement et accueil

| N° | Grav. | Friction | Preuve |
|---|---|---|---|
| F1 | m | **Équipe : 7 tuiles d'icônes sans nom dès le premier écran**, avant toute conversation. Les rôles sont une notion avancée, montrée d'emblée et muette sans survol. Avec des icônes identiques, les tuiles ne se distinguent plus du tout (P6). | `1-accueil-light.png`, `188-1-agent-light.png` ; P6 `2026-11-20-135703/captures/141221-capture-fenetre.png` |
| F2 | m | Pendant l'accueil, le pied de la barre latérale dit « Agent factice · **Action requise** » alors qu'on n'a encore rien choisi : l'état de l'agent parle avant le choix. | `188-1-agent-light.png` |
| F3 | m | Un agent introuvable affiche « Installez Bob Shell (commande bob) », sans lien vers la page d'installation ni commande à copier. | `188-1-agent-light.png` |
| F4 | i | Étape Essai : le modèle est imposé, et son libellé mêle l'identifiant du fournisseur et le nom affiché (D38, ouvert). | recette du 19/11, `201052-capture-fenetre.png` |

À garder : les quatre étapes courtes, « Passer l'accueil », la suggestion tirée du projet
(« Lance les tests (pnpm test) ») et les liens « Premiers pas · Autorisations · Aide ⌘? »
(`188-6-premiere-conversation-light.png`).

### 1.2 Démarrer une conversation et choisir un dossier

| N° | Grav. | Friction | Preuve |
|---|---|---|---|
| F5 | m | **Le dossier n'est qu'une petite ligne grise sous la saisie.** C'est pourtant le choix le plus lourd de conséquences, et on le rate facilement quand on enchaîne les projets. La branche n'apparaît qu'une fois la conversation créée. | `1-accueil-light.png`, `5-historique-light.png` |
| F6 | m | **Mode et modèle se règlent à trois endroits** : la puce de la saisie, le menu ⚙ « Réglages · <agent> » (qui mêle aussi serveurs MCP et règles) et l'onglet Session. Les noms de mode viennent de l'agent (« Code », « Question », « Build », « Plan ») sans dire ce qu'ils permettent. L'en-tête « Session Mode » est en anglais (D28, ouvert). | `3-reglages-light.png`, `5-historique-light.png` |
| F7 | m | Juste après « Modèle refusé », « Nouvelle conversation » repart sur le même modèle, sans rappel (N17, ouvert). | `2026-11-20-082558/captures/082716-capture-fenetre.png` |

### 1.3 Suivre le travail de l'agent

| N° | Grav. | Friction | Preuve |
|---|---|---|---|
| F8 | **G** | **Le pied de la barre latérale dit « Prêt » pendant qu'un travail délégué tourne.** Le statut de l'agent ne compte que le tour de la conversation affichée. Il n'existe aucun endroit qui dise « 3 choses tournent en ce moment, 1 vous attend ». | `263-carte-en-cours-light.png` (carte « 0:00 », pied « Prêt ») ; `session-2-en-cours-light.png` (« Travaille encore… ») |
| F9 | **G** | **On ne retrouve pas la carte d'un sous-agent ou d'une commande depuis Session › En cours.** Seuls les travaux sont cliquables, et ils ouvrent leur conversation, pas leur carte dans le fil. Les sous-agents, commandes et serveurs sont du texte inerte. | `SessionRunning.tsx:62-75` (`session-entry-label` en `<span>` sans `childId`) ; `session-2-en-cours-light.png` |
| F10 | m | **Trois formats de durée** : « 0:00 » sur la carte d'un travail, « < 1 s » dans Session › En cours (même instant, même travail), « 4 s étape 1 s » dans l'indicateur, « 1 min 46 s » dans le pied. Il y a trois formateurs distincts. | `263-carte-en-cours-light.png`, `267-indicateur-etape-dark.png` ; `WorkCard.tsx:170-180` (`elapsedText`), `time.ts:47` (`turnDuration`) ; fiche 267, Suites, point 16 |
| F11 | m | **Le repère du bas est périmé et sa flèche est fixe** : « ↑ 2 travaux ont répondu » alors que tout est plus bas. Le fil ne descend pas après un envoi qui suit une fusion (P2, N12, ouverts). | `2026-11-20-135703/captures/140609-capture-fenetre.png` |
| F12 | **G** | **Fenêtre étroite : la conversation est écrasée.** À 720 px, le panneau garde un tiers de la largeur. Le bouton Envoyer sort de la saisie, le modèle devient « F… » et « Discussion ⌘2 » touche le bord (D25, ouvert). | `270-etroite-dark.png` ; recette 20/11, `narrow-720-light.png` |
| F13 | m | Les onglets du panneau ne sont plus que des icônes dès qu'il y en a plusieurs (jauge, « 3/3 », « 3 »). | `156-ou-en-etait-on-light.png`, `session-2-en-cours-light.png` |

### 1.4 Comprendre ce qu'il a fait (modifications, coût, contexte)

| N° | Grav. | Friction | Preuve |
|---|---|---|---|
| F14 | **G** | **Trois comptes de fichiers qui ne coïncident pas.** « 3 modifications » (groupe d'outils) contre « 2 fichiers » (pied) ; Session : « Conversation 3 fichiers » contre « Dossier 2 fichiers non commités » ; le pied annonce 5 fichiers quand le commit en a 9, car les fichiers créés par une commande ne sont pas comptés (P5). On ne sait plus lequel croire. | `72-annuler-modification-light.png`, `156-ou-en-etait-on-light.png` ; P5 `2026-11-20-135703/captures/135955-capture-fenetre.png` |
| F15 | m | **Le vocabulaire du contexte reste technique** : « Agent (non détaillé) », « Libre », « ≈ : estimé ». Après `/compact`, « Outils de Bobine » rétrécit alors que les définitions d'outils ne changent pas (N14, ouvert). | `264-groupe-finis-dark.png` ; recette 20/11 `092104-capture-fenetre.png` |
| F16 | m | Le guide contredit l'app sur le coût : « en dollars pour OpenCode (0 avec un modèle gratuit) », alors que la fiche 266 affiche « gratuit » ou « coût inconnu », et jamais 0. | `docs/guide/fr/conversations.md`, section « Suivre ce que coûte une conversation » |
| F17 | m | « Mon activité » : la 1re étiquette de mois est encore réduite à « . » (D24, donné corrigé par la 267, repris en P1). | `2026-11-20-135703/captures/141437-note-fenetre.png` |

### 1.5 Déléguer (rôles, travaux)

| N° | Grav. | Friction | Preuve |
|---|---|---|---|
| F18 | **G** | **Le travail porte le titre de la conversation qui l'a lancé**, c'est-à-dire le début du message coupé : « À quoi ça pourrait ressembl… » deux fois dans la barre latérale, une troisième dans En cours (D40, ouvert). | `263-carte-en-cours-light.png` |
| F19 | m | **Branches datées** sur les cartes et dans `git log` : `bobine/20261120-1739-8a55`. Elles sont illisibles et impossibles à distinguer entre deux travaux. | `264-groupe-finis-dark.png`, `inbox-1-etats-sur-place-light.png` ; `src/main/changes/worktrees.ts:23` |
| F20 | m | **Des couleurs d'alerte pour des états neutres** : « Pas encore recommandé » en orange, et « Pas encore transmise à <agent> — elle le sera avec votre prochain message » répété sous chaque carte (N13 : même texte pour un travail arrêté). | `264-groupe-finis-dark.png`, `inbox-1-etats-sur-place-light.png` |
| F21 | m | La suite d'un travail part avec le modèle du travail ; quand ce modèle est épuisé, la carte n'offre que « Relancer » (N8, ouvert). | `2026-11-20-082814/captures/085629-capture-fenetre.png` |
| F22 | m | Avec IBM Bob en mode Agent, l'accord d'un travail se donne dans **sa** conversation : il faut l'ouvrir, puis revenir. | `docs/guide/fr/conversations-filles.md`, fin de « Suivre les travaux » |

### 1.6 Relire et fusionner

| N° | Grav. | Friction | Preuve |
|---|---|---|---|
| F23 | m | Travaux finis mais non commités : la fusion est grisée, et il faut ouvrir chaque travail pour committer (N19). | `2026-11-20-085815/captures/091220-capture-fenetre.png` |
| F24 | m | `Merge branch 'main' into bobine/…` se retrouve sur `main` après l'avance rapide : le message se lit à l'envers (D21, ouvert, ADR-0022). | recette 20/11, `git log` |
| F25 | m | Un relecteur qui ne rend pas de rapport donne une carte **sans ligne « Relu : … »** (P3), et le Code reviewer répète son bilan (N11). | `2026-11-20-135703/captures/141058-capture-fenetre.png`, `140638-capture-fenetre.png` |

### 1.7 Retrouver une conversation

| N° | Grav. | Friction | Preuve |
|---|---|---|---|
| F26 | **G** | **Les titres sont le début du premier message** (« /scenario echo Écris le carnet », « Lance un sous-agent explore qui liste le… »). La barre latérale se lit mal, et ⌘K retrouve par le contenu mais pas par le sens (D40). | `264-groupe-finis-dark.png`, `90-recherche-contenu-light.png` |
| F27 | m | « Où en était-on ? » n'apparaît qu'après **un jour** d'absence. Après deux heures de réunion, rien ne résume les conversations qui ont avancé, sauf « À traiter » pour celles qui attendent. | `docs/guide/fr/conversations.md` (« laissée depuis plus d'un jour ») ; `156-ou-en-etait-on-light.png` |
| F28 | i | ⌘K n'a pas de filtre (dossier, agent, période) et ne propose aucune action : c'est une recherche, pas une palette. | `SearchDialog.tsx` ; `90-recherche-contenu-light.png` |

### 1.8 Réglages

| N° | Grav. | Friction | Preuve |
|---|---|---|---|
| F29 | m | **Réglages › Général, section « Mac »** : « Éditeur » et « Message de commit rédigé par l'agent » n'ont rien de propre au Mac. Ils sont rangés par plateforme plutôt que par usage. | `81-general-light.png` |
| F30 | m | Rôles : un identifiant déjà pris n'est signalé qu'au clic sur « Suivant » (P4). | `2026-11-20-135703/captures/141128-…` → `141136-capture-fenetre.png` |
| F31 | i | 15 onglets en trois groupes : la recherche les rend praticables, mais le menu ⚙ de la saisie est souvent le vrai point d'entrée, et il ne mène pas aux Réglages de l'agent. | `81-general-light.png`, `3-reglages-light.png` |

### 1.9 Erreurs et blocages

| N° | Grav. | Friction | Preuve |
|---|---|---|---|
| F32 | **G** | **Plantage de l'agent : la sortie d'erreur brute** (« Sortie : code 3 », lignes de stderr) dans une carte rose sans action. « Relancer » n'est qu'en bas, sous la saisie ; rien ne mène au Diagnostic ni au Journal. | `41-plantage-light.png` |
| F33 | m | Pendant un tour, les puces Mode et Modèle sont grisées sans explication, et l'infobulle annonce un raccourci (⇧⇥) qui ne marche pas à ce moment (D22, ouvert). | recette 19/11, `203119-capture-fenetre.png` |
| F34 | m | Le panneau Tâches dit « pas encore de liste » à un utilisateur d'OpenCode 2.3, qui n'en tient **jamais** (D7, ouvert). | recette 19/11, `201506-capture-panneau.png` |
| F35 | i | Bob en `-32603 Server Error` : en attente de la trace réelle (mémoire du projet), rien à proposer avant. | — |

---

## 2. Manques utiles par rapport aux références

Pour chaque besoin : ce qu'offrent les références, ce que Bobine a déjà, l'écart réel, et un
verdict.

| Besoin | Références | Déjà dans Bobine | Écart | Verdict |
|---|---|---|---|---|
| **Palette de commandes** | Zed, Cursor, VS Code (⇧⌘P), Warp (⌘P) : tout est atteignable au clavier | ⌘K = recherche de conversations (titre, dossier, agent, contenu) ; tous les menus ont des raccourcis ; recherche dans les Réglages | ⌘K ne connaît aucune action : changer de mode, lancer un rôle, ouvrir un onglet, aller à un réglage | **Utile**, en élargissant ⌘K plutôt qu'en ajoutant une 2e palette (CM3) |
| **Recherche globale** | Claude Desktop, Codex : recherche dans l'historique | **Fait** (fiches 026, 046 ; extrait et surlignage, ⌘F ouvert dessus) | Pas de filtres | Filtres plus tard (IC6) |
| **Reprise rapide** | Claude Code `--continue`/`--resume`, Codex : liste des tâches | Relance sur la dernière conversation (243), ⌥⌘↑/↓, ⇧⌘O pour une session commencée ailleurs, « Où en était-on ? » (156), `bobine <dossier>` (158) | Rien entre « à traiter » et « plus d'un jour » | Couvert par CM2 |
| **Raccourcis** | Claude Code : 1/2/3 pour autoriser, Échap Échap pour remonter | Liste complète (⌘/), 1–9 dans les questions, ⌘↩ dans les dialogues | Pas de touche pour répondre à une carte d'autorisation | IC7, avec la garde anti-clic de `useArmedCard` |
| **Glisser-déposer** | Partout | **Fait** (005, `DropOverlay`) | — | Rien à faire |
| **Mentions `@` de fichiers** | Cursor, Claude Code | **Fait** (005, 057 : `@git-changes`, `@terminal`, rôles) | Ne montre que ce qu'on sait nommer | Fiche 271 |
| **Modèles de demandes** | Commandes `/` personnelles (Claude Code), règles de projet (Cursor) | Commandes `/` personnelles et du projet (045), rôles (223), 4 suggestions d'accueil, dont une tirée du projet | Les suggestions d'accueil ne montrent ni les commandes du projet ni les rôles, ni les demandes récentes | CM8 |
| **Notifications** | Claude Desktop, Warp : notifier à la fin et quand l'agent attend | **Fait** : bannières (024), son (068), Dock (101, 119) | Bannière non actionnable | IC3 (prudence) |
| **Aide contextuelle** | Claude Desktop : peu ; Cursor : docs en ligne | « ? » vers le guide (186), astuces (191) | Pas de glossaire ; les états de la barre latérale ne sont expliqués qu'au survol | QW8, QW12 |
| **Résumé de fin de session** | Codex : résumé par tâche ; Claude Code : récapitulatif final de l'agent | Pied de réponse (heure, durée, fichiers, coût), « Où en était-on ? » | Pas de compte rendu partageable (PR, point d'équipe) | IC2 |
| **« Pendant mon absence »** | Codex : liste de tâches avec leur état ; Warp : vue des agents | « À traiter », compteur du Dock, bannières, « Où en était-on ? » après un jour | Pas de vue d'ensemble au retour | **CM2 ★** |
| **Annuler une modification de l'agent** | Cursor : refuser un fichier ou un bloc ; Claude Code : `/rewind` | **Fait par fichier** (« Remettre », `72-annuler-modification`) et en repartant d'un message (023, dialogue « Remettre les fichiers ») | Rien pour « défaire ce que ce tour a fait » en un clic | **CM1 ★** |
| **Points de restauration** | Cursor : checkpoint par message ; Claude Code : checkpoints | 023 sait restaurer depuis les diffs ACP ; commit avec « Défaire » (246) | Les fichiers écrits par une commande échappent aux diffs (P5) | CM1 maintenant, IC1 pour la version complète |
| **Statut global des agents** | Warp, Codex | Pied « <agent> · Prêt » de l'agent courant ; Session › En cours par conversation | Aucune vue de tout ce qui tourne | **CM2 ★** |

---

## 3. La compréhension : où l'utilisateur se perd encore

### 3.1 Vocabulaire

La fiche 266 a unifié « travail », « réponse », « a répondu / arrêté / en erreur ». Ce qui reste :

| Terme | Où | Problème | Piste |
|---|---|---|---|
| « Agent (non détaillé) », « Libre », « ≈ : estimé » | Session › Contexte | Jargon de mesure | « Agent (prompt, outils internes) », « Place libre » ; un « ? » qui explique (QW12) |
| « Transmise à <agent> » / « Pas encore transmise… » | Carte d'un travail | Juste, mais répété et en couleur ; le lecteur se demande s'il doit agir | Ne l'afficher qu'au changement d'état, en gris (QW, voir F20) |
| « Recommandé » / « Pas encore recommandé » | Carte de groupe | L'orange fait lire une alerte | Gris neutre pour « pas encore » (F20) |
| « Puis nettoyer (archiver, supprimer les branches) » | Carte de groupe | Clair depuis la 258 | Rien |
| Noms de mode (« Code », « Question », « Build ») | Puce Mode | Viennent de l'agent ; aucun ne dit s'il écrit | Une ligne « écrit sans demander / demande avant d'écrire / lecture seule », déduite des capacités du profil (générique, ADR-0011) |
| « Aparté », « Fenêtre rapide », « Espace Code / Discussion » | Menus | Propres à Bobine, bien documentés | Glossaire (QW12) |
| `bobine/20261120-1739-8a55` | Cartes, Session › Branche | Illisible | QW5 |

### 3.2 États

- **Barre latérale.** Les icônes portent seules la raison (⊙ réponse à lire, ? question, ✋ accord,
  ✓, spinner), avec l'infobulle pour seule explication (`inbox-1-etats-sur-place-light.png`). C'est
  bien pour l'habitué, opaque la première semaine (QW8).
- **Statut global.** Le pied « <agent> · Prêt » ne voit que le tour de la conversation affichée
  (F8). C'est le plus gros malentendu restant sur les états, après les corrections de la 255.
- **Fichiers.** Trois chiffres pour « ce qui a changé » (F14). Il faut une règle écrite : le
  *pied* dit ce que *ce tour* a écrit, *Session › Conversation* le cumul de la conversation,
  *Dossier / Git* l'état réel du disque, et chacun le dit dans son libellé.

### 3.3 Messages d'erreur

Les fiches 210, 259 et 267 ont posé le bon modèle (« Le modèle … n'a pas répondu · Son quota
gratuit est épuisé · Choisir un autre modèle »). Il faut l'étendre à toutes les erreurs (CM5) :
**une phrase humaine, la cause si on la sait, deux boutons au plus, le détail brut replié**.
Contre-exemple : `41-plantage-light.png`.

### 3.4 Coût et contexte

Le coût est honnête depuis la 266 (« coût inconnu », « gratuit »). Ce qui reste : le guide (F16)
et la tuile de Mon activité, qui doit rester alignée sur le tableau (N10, corrigé). La jauge de
contexte est juste après `/compact` (257). L'écart restant tient au vocabulaire (F15).

### 3.5 Ce que fait chaque bouton

- **Saisie** : trombone, appareil photo, bouclier + mode, curseurs (menu de session), puis modèle,
  agent, pourcentage. Huit commandes, dont quatre en icônes seules. Les infobulles existent ;
  l'appareil photo (capture d'écran, fiche 062) est le moins devinable.
- **Onglets du panneau** en icônes seules (F13).
- **Tuiles Équipe** (F1).
- **« Inclure l'autre… »** sur la carte de groupe (`264-groupe-finis-dark.png`) : on comprend en
  lisant la phrase au-dessus, pas par le bouton seul. « Fusionner aussi « Tests de la sauvegarde
  locale »… » serait plus clair (QW, voir F20).

---

## 4. Propositions

Chaque proposition dit son bénéfice, son coût, son risque, les fiches ou ADR concernés et son
rapport à l'esprit « conversation au centre ». Aucune n'ajoute d'éditeur, d'explorateur ni de
colonne permanente.

### 4.1 Quick wins (petit coût, gros effet)

**QW1 — Un seul format de durée.** Règle : « 12 s », « 1 min 05 s », « 1 h 02 min » partout. Pas
de « 0:00 », pas de « < 1 s » à côté de « 0:00 » pour le même travail.
- Bénéfice : les chiffres se comparent d'un coup d'œil (F10).
- Coût : petit (`WorkCard.tsx` `elapsedText` → `time.ts` `turnDuration`, tests).
- Risque : quasi nul ; un chronomètre qui change de largeur → chiffres tabulaires.
- Fiches : 267 (Suites, point 16), 128, 156.
- Esprit : neutre.

**QW2 — Chaque ligne de « En cours » mène à sa carte.** Un clic sur un travail, un sous-agent ou
une commande fait défiler le fil jusqu'à sa carte et la met en évidence, avec le même mécanisme
que « Voir » du repère (261, `useReveal`). « Ouvrir sa conversation » reste dans la carte. Dans la
barre latérale, ⌥-clic sur un travail montre sa carte dans la conversation d'origine.
- Bénéfice : on retrouve le sous-agent (point ouvert) ; un seul objet, plusieurs vues (F9).
- Coût : petit (`SessionRunning.tsx`, clé de carte de l'ADR-0061).
- Risque : carte hors de la fenêtre des éléments rendus (fil long, fiche 193) → la rendre d'abord.
- Fiches : 166, 255, 261, 263 ; ADR-0061.
- Esprit : renforce le fil comme lieu de vérité.

**QW3 — Sélecteur Code / Discussion compact.** Sous une largeur de barre latérale donnée, deux
icônes avec leur infobulle (« Code ⌘1 ») ; les raccourcis sortent du bouton.
- Bénéfice : D25 fermé.
- Coût : petit.
- Risque : nul.
- Fiches : 224, 131 ; ADR-0048.
- Esprit : neutre.

**★ QW4 — La conversation garde sa place en fenêtre étroite.** Sous ≈ 1 000 px de contenu, le
panneau de droite se replie seul en icône (comme une barre latérale repliée) et se rouvre en
superposition. La saisie garde sa largeur minimale ; le modèle se replie en icône avant de
déborder.

```
 720 px aujourd'hui                     720 px proposé
┌──────┬──────────┬────────┐            ┌──────┬───────────────────┬─┐
│barre │ fil      │Session │            │barre │ fil               │▸│ ← panneau
│      │ écrasé   │ 1/3    │            │      │                   │ │   replié
│      │[saisie↗] │        │            │      │[saisie entière  ↑]│ │
└──────┴──────────┴────────┘            └──────┴───────────────────┴─┘
```
- Bénéfice : l'esprit même de Bobine ; portables 13 pouces, fenêtre côte à côte avec l'éditeur
  (F12).
- Coût : petit à moyen (règle de largeur, mémoire du choix fait à la main).
- Risque : agacer celui qui a ouvert le panneau exprès → ne replier qu'en dessous du seuil, et
  rendre son état d'avant à l'élargissement.
- Fiches : 082, 113, 173, 270 ; D25.
- Esprit : **c'est la règle « conversation au centre » appliquée à la mise en page.**

**QW5 — Des branches lisibles.** `bobine/<mots-du-titre>-<4 hex>` (ex.
`bobine/theme-sombre-8a55`) au lieu de `bobine/<date>-<heure>-<hasard>`. Le suffixe garde
l'unicité ; la date reste dans le commit.
- Bénéfice : cartes, Session et `git log` lisibles (F19).
- Coût : petit (`worktrees.ts:23` et la fabrique du nom, ASCII seul, 40 caractères au plus).
- Risque : titre pas encore connu à la création → partir de la consigne ou du rôle ; les branches
  existantes ne changent pas.
- Fiches : 096, 036, 110 ; à noter dans l'ADR-0019 suivant (ce n'est pas une décision
  structurante).
- Esprit : neutre.

**QW6 — Un message de fusion qui se lit à l'endroit.** Garder la mécanique de l'ADR-0022, mais
écrire le commit de fusion du worktree avec un message choisi (« Fusionne « Thème sombre »
(bobine/theme-sombre-8a55) dans main »).
- Bénéfice : `git log` de `main` compréhensible (D21, F24).
- Coût : petit (`-m` sur la fusion de `worktree-cycle.ts`).
- Risque : faible ; les outils qui reconnaissent « Merge branch » ne s'en servent pas ici.
- Fiches : 110, 120 ; ADR-0022 (sans le remplacer : seul le texte change).
- Esprit : neutre.

**QW7 — Un repère du bas qui dit vrai.** La flèche suit la position de la carte (↑ / ↓) ; le
repère disparaît quand la carte est vue ; le fil descend après un envoi (P2, N12).
- Coût : petit.
- Risque : nul.
- Fiches : 261, 127.
- Esprit : renforce le fil.

**QW8 — Une légende des états de la barre latérale.** Une ligne « Que veulent dire ces
icônes ? » en pied de la section « À traiter » la première semaine, puis dans le menu Afficher.
Et, sur la ligne survolée, le mot à côté de l'icône (« accord », « question », « à lire »).
- Bénéfice : on lit l'état sans connaître la convention.
- Coût : petit.
- Risque : bruit → masquable, comme les astuces (191).
- Fiches : 119, 125, 149.
- Esprit : neutre.

**QW9 — Des noms dans l'Équipe.** Initiales ou nom court sous l'icône quand la barre latérale est
assez large ; deux rôles de même icône et même couleur prennent une variante de teinte (P6). La
section se replie, et elle est **repliée au premier lancement** (F1).
- Coût : petit.
- Risque : place verticale → deux lignes au plus.
- Fiches : 223, 268, 131.
- Esprit : allège l'accueil.

**QW10 — Identifiant de rôle vérifié pendant la frappe** (P4), avec la même proposition
« Utiliser @code-reviewer-2 ».
- Coût : petit.
- Risque : nul.
- Fiches : 268 ; ADR-0063.

**QW11 — La portée de la relecture toujours dite.** Sans rapport du relecteur : « Relu : portée
non confirmée par le relecteur — consigne : les 5 commits de cette conversation » (P3). Le bilan
de fin de tour n'est plus répété quand il reprend le résumé (N11).
- Coût : petit.
- Risque : nul.
- Fiches : 265, 267 ; ADR-0062.

**QW12 — Un glossaire et des « ? » sur les mots de Bobine.** Une page `docs/guide/fr/glossaire.md`
(travail, rôle, aparté, worktree, contexte, coût inconnu, transmise, recommandé), et un « ? » sur
Session › Contexte et sur la ligne de coût. Corriger au passage la phrase du coût dans
`conversations.md` (F16).
- Coût : petit (doc et liens d'aide, fiche 186).
- Risque : nul.
- Fiches : 186, 266 ; `docs/traduction.md` (glossaire de traduction, à garder aligné).

**QW13 — Tâches : dire quand l'agent n'en tient jamais.** Une capacité du profil (« pas de
liste de tâches ») remplace « pas encore » par « OpenCode ne tient pas de liste de tâches ;
demandez-lui des cases dans sa réponse ».
- Coût : petit.
- Risque : capacité qui change avec une version → la sonde OpenCode (078) la relit.
- Fiches : 035, 140 ; ADR-0011 ; `docs/agents.md` (matrice).
- Esprit : neutre.

**QW14 — Les puces grisées s'expliquent.** Pendant un tour, l'infobulle de Mode et Modèle dit
« Se change à la fin de la réponse » ; l'en-tête du menu est traduit (« Mode de l'agent »), et les
descriptions restent celles de l'agent (ADR-0014) (D22, D28).
- Coût : petit.
- Risque : nul.
- Fiches : 013, 090, 098.

À joindre au même lot de finition, sans proposition à part : **D24** (P1, `UsageChart`
`MonthLabels` à reprendre avec le panneau Navigateur ouvert), **N17** (rappel du refus à la
nouvelle conversation), **F29** (Réglages › Général : « Éditeur » et « Message de commit » sortis
de « Mac »), **F20** (« Pas encore recommandé » et « Pas encore transmise » en gris, un seul
rappel par carte).

### 4.2 Chantiers moyens

**★ CM1 — Défaire ce tour.** Dans le pied de chaque réponse qui a modifié des fichiers, un lien
« Défaire » ouvre le dialogue déjà construit par la fiche 023 pour « Repartir d'ici ». Il liste
les fichiers de ce tour, avertit pour ceux modifiés depuis (par vous ou par un tour suivant) et
rappelle que les commandes ne s'annulent pas. La conversation n'est pas réécrite : une ligne
« Modifications du tour de 15:11 défaites (2 fichiers) » s'ajoute au fil, et l'agent la reçoit
avec le prochain message (comme une remarque de relecture).

```
  C'est fait : deux fichiers modifiés.
  ⧉ 15:11 · 12 s · 2 fichiers +6 −1 · ≈ 0,01 $US · Défaire
                                                  └──────┐
  ┌ Défaire le tour de 15:11 ? ─────────────────────────┐ │
  │ ☑ README.md            remis comme avant 15:11      │◄┘
  │ ☑ src/app.js           créé par l'agent : supprimé  │
  │ ⚠ 1 commande lancée pendant ce tour (npm install)   │
  │   n'est pas annulée.                                │
  │                     [Garder]  [Défaire 2 fichiers]  │
  └─────────────────────────────────────────────────────┘
```
- Bénéfice : le filet de sécurité qu'offrent Cursor et Claude Code ; on ose laisser l'agent
  écrire. Complète « Remettre » fichier par fichier.
- Coût : moyen. La restauration existe (`restore-files.ts`, `undoEdits`) ; il reste à la borner à
  un tour, gérer les conflits, prévenir l'agent, et ajouter les e2e.
- Risque : fausse assurance pour les fichiers écrits par une commande (P5) → le dialogue le dit
  (« Ce tour a lancé des commandes : ce qu'elles ont écrit n'est pas couvert »). Tour d'une autre
  conversation dans le même dossier → refus expliqué. Ne jamais toucher hors du dossier.
- Fiches : 023, 021, 130, 202 ; ADR-0021 (le fil de Bobine fait foi).
- Esprit : **conversation au centre** : l'action vit dans le fil, au pied de ce qu'elle défait.

**★ CM2 — « Depuis votre départ » et statut global des agents.** Le pied de la barre latérale
(aujourd'hui « <agent> · Prêt ») devient le statut **de tout Bobine** : « 2 au travail · 1 vous
attend ». Un clic ouvre un petit volet, qui n'est pas une page : ce qui tourne (conversations,
travaux, sous-agents, tâches planifiées, serveurs de dev), ce qui attend, et ce qui a fini depuis
votre dernier passage. Au retour dans la fenêtre après plus de N minutes d'absence (réglable,
30 min par défaut), un bandeau discret en haut du fil propose la même chose : « Depuis 14:02 :
2 travaux ont répondu, 1 accord demandé · Voir ».

```
┌ Bobine ─────────────────────────────┐
│ Depuis 14:02                         │
│  ✋ Configurer l'accès  accord · 14:40│
│  ⊙ Thème sombre        a répondu    │
│  ⊙ Tests sauvegarde    a répondu    │
│ En ce moment                         │
│  ⟳ Organise le carnet  2 min 10 s   │
│  ⟳ web (serveur)        :5173   ■   │
│ Agents : OpenCode prêt · Bob arrêté  │
└──────────────────────────────────────┘
 A  2 au travail · 1 vous attend   ⚙ 🔔
```
- Bénéfice : répond à « que s'est-il passé pendant mon absence » et au statut global. Le pied ne
  ment plus (F8). Prolonge « Où en était-on ? » à toutes les conversations, sans attendre un jour.
- Coût : moyen. Les données existent (« À traiter » 119, En cours 166/255, tâches 178) ; il reste
  le volet, l'heure du dernier passage, et le bandeau.
- Risque : doublon avec « À traiter » → le volet est un résumé qui renvoie aux lignes ; aucun
  nouvel état. Rien n'est envoyé à l'agent (comme 156).
- Fiches : 119, 125, 156, 166, 255, 101.
- Esprit : à la demande, replié dans un pied existant. Ce n'est pas un tableau de bord.

**CM3 — ⌘K devient la palette.** Le même champ cherche les conversations (comme aujourd'hui), et
aussi les **actions** (« Nouvelle conversation dans… », « Mode Plan », « Changer de modèle… »,
« Ouvrir le terminal », « Aparté »), les **rôles** (« @Code reviewer… »), les **réglages**
(index de la fiche 051) et l'aide (index de la fiche 186). `>` en tête du texte réserve aux
actions, comme VS Code. Les actions viennent du registre des menus, avec leur raccourci affiché
(on apprend le raccourci en s'en servant).

```
┌ 🔍 plan                                         Échap ┐
│ Actions                                              │
│  ▸ Passer en mode Plan                         ⇧⇥    │
│  ▸ Exécuter le plan                                   │
│ Conversations                                         │
│  💬 Plan de migration Postgres   OpenCode · carnet    │
│ Réglages                                              │
│  ⚙ Conversations › Plan : ouvrir le plan à côté      │
└───────────────────────────────────────────────────────┘
```
- Bénéfice : un seul point d'entrée au clavier, sans rien ajouter à l'écran ; il absorbe aussi
  l'option A de la fiche 271 (« Aller au fichier ») si elle est retenue.
- Coût : moyen (registre d'actions commun aux menus, classement, e2e).
- Risque : palette fourre-tout → trois sections au plus à l'écran, actions limitées à celles d'un
  menu existant.
- Fiches : 027, 051, 186, 271 (lien) ; aucun ADR à remplacer.
- Esprit : **le plus « Claude Code » des ajouts** : on reste dans la conversation, et la palette
  disparaît après usage.

**★ CM4 — Des titres courts pour les conversations et les travaux.** Après la première réponse,
Bobine donne un titre de 3 à 6 mots (« Thème sombre », « Import CSV ») à la conversation, et à un
travail d'après sa consigne. Le texte vient d'une session jetable, comme le message de commit
(246, ADR-0056), ou d'une règle locale quand le réglage est coupé. Renommer reste possible et
prime toujours.
- Bénéfice : barre latérale, ⌘K, carte de groupe et branches (QW5) lisibles (F18, F26, D40).
- Coût : moyen (session jetable déjà écrite pour le commit ; coût affiché comme pour le commit,
  « ≈ 0,03 bobcoin chez IBM Bob », `81-general-light.png`).
- Risque : coût pour Bob → réglage, coupé si le plafond de coût est proche ; titre faux → le
  premier message reste en infobulle, et la recherche le trouve toujours.
- Fiches : 015, 246, 260, 266 ; ADR-0056 (même modèle de session jetable), ADR-0019.
- Esprit : neutre, et rien de plus à l'écran.

**★ CM5 — Des cartes d'incident qui disent quoi faire.** Un seul gabarit pour plantage, réseau,
quota, connexion expirée, limite d'étapes, erreur inconnue : **ce qui s'est passé** (une phrase),
**pourquoi** (si on le sait), **quoi faire** (deux boutons au plus : Relancer, Choisir un autre
modèle, Se connecter, Ouvrir le diagnostic), puis **Détails** replié (sortie brute, code, lien
« Copier pour un rapport »).

```
┌ ⚠ OpenCode s'est arrêté pendant « Compiler le projet » ─────┐
│ Le programme de l'agent a quitté (code 3). Le fil est gardé. │
│            [Relancer OpenCode]  [Ouvrir le diagnostic]       │
│ ▸ Détails (3 lignes de sortie d'erreur)  · Copier            │
└──────────────────────────────────────────────────────────────┘
```
- Bénéfice : plus de rose brut (F32) ; un même geste pour toutes les pannes ; les motifs propres à
  un agent restent dans son profil (comme le quota de la 267).
- Coût : moyen (inventaire des cartes 142, 194, 200, 209, 210, 259, 267 ; petit pour le seul
  plantage).
- Risque : masquer l'information utile au débogage → détail toujours à un clic, et repris tel quel
  dans « Signaler un problème » (105) ; le journal reste la référence (080).
- Fiches : 041, 142, 194, 200, 209, 210, 259, 267, 080.
- Esprit : l'erreur reste dans le fil, à sa place.

**CM6 — « Committer et fusionner » dans la carte de groupe.** Quand des travaux ont fini sans
committer, la carte propose de le faire pour chacun (message rédigé, fiche 246, fichiers cochés,
fiche 244), puis de fusionner (N19).
- Bénéfice : fin du va-et-vient vers chaque travail (F23).
- Coût : moyen.
- Risque : committer ce que l'agent voulait garder hors du commit → liste à cocher, rien par
  défaut sur les fichiers de `.env*` (244).
- Fiches : 120, 123, 244, 246, 264.
- Esprit : l'action reste dans la carte.

**CM7 — Un compte de fichiers juste.** Le pied d'un tour compte aussi ce que git voit de nouveau
dans le dossier pendant ce tour (état avant / après, fichiers ignorés exclus), et le dit :
« 9 fichiers (4 écrits par des commandes) ». Les trois libellés de F14 disent ce qu'ils comptent.
- Bénéfice : un chiffre auquel on se fie (F14, P5) ; prépare CM1 et IC1.
- Coût : moyen (un `git status` borné à la fin du tour, la file git de la fiche 138).
- Risque : autre conversation dans le même dossier en même temps → compter « pendant le tour »
  sans l'attribuer avec certitude, et le dire.
- Fiches : 021, 130, 138, 202, 166.
- Esprit : neutre.

**CM8 — Un accueil qui connaît le projet.** Sous la saisie de l'accueil : vos commandes `/` du
projet (045), deux demandes récentes de ce dossier, et les rôles les plus utilisés, à la place
des quatre suggestions génériques quand ils existent. Le dossier devient une puce visible
(« 📁 carnet · main ▾ ») au lieu de la ligne grise (F5).
- Bénéfice : « modèles de demandes » sans nouvelle notion ; le choix du dossier se voit.
- Coût : petit à moyen.
- Risque : accueil chargé → quatre suggestions au plus, comme aujourd'hui.
- Fiches : 045, 092, 093, 188, 223.
- Esprit : la saisie reste l'unique point d'action.

### 4.3 Idées à creuser

**IC1 — Points de restauration git par tour.** Avant chaque tour, Bobine photographie le dossier
sans toucher à l'index de l'utilisateur : `GIT_INDEX_FILE` temporaire, `git add -A`, puis
`write-tree`, sous la référence `refs/bobine/tours/<id>`. Elle peut ensuite rendre *tout* l'état
d'avant, y compris ce qu'ont écrit les commandes.
- Bénéfice : CM1 complet, comme les checkpoints de Cursor.
- Coût : gros (taille, purge, dossiers sans git, worktrees, gros fichiers).
- Risque : élevé sur la fiabilité (priorité du projet) → un **ADR** et une recette réelle avant
  tout ; d'abord CM1.
- Fiches : 023, 036, 138 ; ADR à écrire.

**IC2 — Compte rendu de conversation.** « Copier un compte rendu » : demande, ce qui est fait,
fichiers, commits, coût, en Markdown prêt pour une PR ou un point d'équipe. Il est construit
localement comme « Où en était-on ? », éventuellement réécrit par une session jetable.
- Coût : petit à moyen.
- Risque : faible.
- Fiches : 156, 176, 246.

**IC3 — Notifications actionnables** (« Autoriser une fois » depuis la bannière).
- Bénéfice réel, mais risque de sécurité : on autorise sans voir la commande, et la fiche 024 dit
  que les boutons des bannières demandent une signature, absente ici (pas de notarisation).
- À écarter tant que ces deux points tiennent ; au plus, ouvrir directement la carte.

**IC4 — Changer de mode ou de modèle pendant le tour**, appliqué au message suivant (D22). Codex et
Claude Code le permettent. Il faut d'abord savoir ce que Bob et OpenCode acceptent par ACP en
cours de tour ; sinon, mettre le choix en file comme un message.
- Fiches : 013, 256 ; ADR-0058.

**IC5 — Raccourcis des cartes d'autorisation** (⌘↩ « Autoriser une fois », ⌘⌫ « Refuser »), seulement
quand la carte a le focus et qu'elle est armée (`useArmedCard`, 400 ms).
- Bénéfice : suivre un tour au clavier, comme Claude Code.
- Risque : autoriser par réflexe → jamais « Toujours » au clavier ; cartes à risque (211)
  exclues.
- Fiches : 006, 072, 211, 214.

**IC6 — Filtres de recherche dans ⌘K** : `dossier:`, `agent:`, `depuis:`, « a modifié <fichier> »
(depuis les diffs gardés).
- Coût : moyen.
- Utile une fois l'historique long. Fiches : 026, 046.

**IC7 — Suite d'un travail avec un autre modèle depuis sa carte** (N8, F21) : « Répondre avec… »
propose le modèle de la conversation d'origine quand celui du travail est refusé.
- Coût : petit à moyen.
- Fiches : 210, 259, 263 ; ADR-0058.

### 4.4 Ce qu'il ne faut pas faire

- **Pas de tableau de bord permanent.** CM2 est un volet dans un pied existant, pas une page.
- **Pas de deuxième palette.** On élargit ⌘K (CM3).
- **Pas d'explorateur en colonne** : voir la fiche 271.
- **Pas de nouvel état** pour les travaux ou les conversations : la 258 et la 266 viennent de les
  stabiliser. Les propositions réutilisent ceux qui existent.

---

## 5. Correspondance avec les points mineurs ouverts

| Point | Proposition |
|---|---|
| P1 (D24, étiquette de mois) | lot de finition (§ 4.1) |
| P2, N12 (fil qui ne descend pas, flèche du repère) | QW7 |
| P3 (portée de relecture muette), N11 | QW11 |
| P4 (identifiant de rôle pris) | QW10 |
| P5 (fichiers créés par commande non comptés) | CM7 (et CM1 pour sa limite) |
| P6 (rôles de même icône) | QW9 |
| D14 (durée de l'étape) | fait par la 267 ; reste le format → QW1 |
| D17 (ordre des travaux) | fait par la 267 |
| D21 (message de fusion) | QW6 |
| D24 | lot de finition |
| D25 (fenêtre étroite, Code ⌘1 / Discussion ⌘2) | ★ QW4, QW3 |
| Format des durées | QW1 |
| Sous-agent introuvable depuis Session › En cours | QW2 |
| Noms de branche datés | QW5 (et ★ CM4) |
| Autres restes vus : D7, D22, D28, D38, D40, N8, N17 | QW13, QW14, F4, ★ CM4, IC7, lot de finition |

## 6. Lien avec la fiche 271

La palette ⌘K (CM3) est le bon hôte pour l'option A de la 271 (« Aller au fichier ») si la 271 la
retient en complément de l'onglet Fichiers : un seul point d'entrée au clavier pour
conversations, actions, réglages et fichiers. CM7 (compte juste des fichiers d'un tour) et la vue
« Récents » de la 271 parlent du même sujet. Ils devraient partager la même source, l'état git
avant / après le tour.
