# Traduction de l'interface

Comment Bobine se traduit : ce qui se traduit, le style de l'anglais, le glossaire, et comment
ajouter une langue. Décisions : ADR-0014 ; mise en place : fiche 074.

> **Statut** : validé par l'utilisateur le 2026-10-16, avec les six décisions de « Points
> tranchés », en fin de glossaire.

## Ce qui se traduit, ce qui ne se traduit pas

Se traduisent **tous les textes de l'interface** : boutons, menus, réglages, avis du fil,
dialogues, notifications, demandes d'autorisation, diagnostic, export Markdown. Ils vivent dans
`src/shared/i18n/locales/<langue>.json`. `fr.json` est la référence ; les clés et leurs variables
sont vérifiées par le typage et par `locales.test.ts`. Depuis i18next 27 (fiche 221), `t()` exige
les variables d'un texte qui en a : une table de clés traduites sans valeurs se type
`ParseKeysWithoutVariables`, pas `ParseKeys` (une clé à variables y est alors refusée).

Ne se traduit **jamais** :
- ce qui vient de l'agent (réponses, questions, formulaires, erreurs ACP) ou lui est envoyé
  (descriptions et résultats d'outils, contexte joint au message) ;
- le journal (`main/log.ts`) et les erreurs de programmation (« Paramètre invalide… ») ;
- les noms de produits et d'outils, le code, les chemins, les commandes, les variables
  d'environnement (voir « Ne pas traduire »).

## Typographie du français (fiche 126)

`fr.json` s'écrit avec des espaces ordinaires et « de » / « que » devant les variables. À
l'affichage, `src/shared/i18n/typography.ts` (post-traitement d'i18next, en français seulement)
met une espace insécable avant `: ; ? ! % »` et après `«`, et élide « de » et « que » devant un nom
qui commence par une voyelle majuscule (« Fichier d’OpenCode », « qu’IBM Bob ») ; pas devant un
nom de fichier (« Modification de index.html »). Les essais qui comparent un texte français écrit
en dur l'écrivent avec `\u00a0` ; les e2e passent par `L()`, qui fait la même chose.

## Guide de style (anglais)

**Public** : des développeurs sur macOS. **Ton** : celui de Claude Desktop et des outils de
développement d'aujourd'hui — direct, bref, sans « please » ni formule de politesse, sans
exclamation. On parle à l'utilisateur à la deuxième personne (« you ») ou à l'impératif.

**Traduire le sens, pas les mots.** Une tournure française naturelle doit donner une tournure
anglaise naturelle (« on s'y met ? » → « ready to start? », pas « shall we put ourselves to it? »).
Garder la même information, la même longueur à peu près, le même niveau de détail.

**Casse** :
- **Menus macOS** (barre de menus) : *Title Case*, avec les libellés exacts de macOS
  (« Close Window », « Paste and Match Style », « Show All »).
- **Partout ailleurs** : *sentence case* (« New conversation », « Keyboard shortcuts »,
  « Always allow »), comme Claude Desktop. Les noms propres gardent leur majuscule.

**Ponctuation et typographie** :
- Pas d'espace avant `:` `;` `?` `!` ; pas d'espace avant `%` (« 45% »).
- Guillemets anglais courbes : « … » → “…”. Apostrophe courbe `’`, comme en français.
- Les points de suspension `…` (un seul caractère) restent sur une action qui ouvre une fenêtre ou
  demande une suite (« Settings… », « Resume a session… ») et dans les états en cours
  (« Starting… »).
- Le séparateur de chemin `›` reste (« Settings › Agents »).
- Les titres, libellés et boutons n'ont pas de point final ; les phrases d'aide et les messages en
  ont un, comme en français.

**Variables, balises, pluriels** :
- Garder chaque variable `{{nom}}` telle quelle (même nom, même nombre). On peut les déplacer dans
  la phrase.
- Garder les balises `<strong>`, `<code>`, `<muted>` autour du même mot ou groupe.
- Pluriels : l'anglais n'a que `_one` et `_other` (le français a aussi `_many`) ; `{{count}}` dans
  les deux formes quand le nombre s'affiche.
- Pas de nombre ni de date écrits en dur : `Intl` les met en forme selon la langue.

**Touches** : symboles inchangés (⌘ ⌥ ⇧ ⌃ ↩ ⇥ ↑ ↓). Noms de touches comme sur un clavier Mac en
anglais : Entrée → **Return**, Échap → **Esc**, Espace → **Space**, Maj → **Shift**, Tab → **Tab**,
« 1 à 9 » → « 1–9 ».

**Unités** : « s », « min », « k », « M », « px », « fps » ne changent pas.

**Mots-clés de la recherche des réglages** (`settingsSearch.*`) : ce ne sont pas des phrases mais
des mots qui mènent à un réglage. Mettre les synonymes qu'un anglophone taperait, pas une
traduction mot à mot (`theme` : « appearance light dark sepia black colors mode »).

**Chemins de macOS et d'Xcode** : reprendre le libellé exact de la version anglaise de macOS
(« System Settings › Privacy & Security › … »), à vérifier sur la version visée plutôt que traduit.

## Glossaire

Un terme se traduit toujours de la même façon. Quand un mot français a plusieurs sens, la colonne
« Remarque » dit lequel prendre.

### L'app, les agents

| Français | Anglais | Remarque |
|---|---|---|
| Bobine | Bobine | Nom propre, jamais traduit. |
| projet indépendant, non affilié à IBM | independent project, not affiliated with IBM | Fenêtre À propos (fiche 216). Toujours « non affilié à », jamais « non officiel ». |
| agent | agent | |
| l'agent factice | the mock agent | « Agent factice » (profil) → « Mock agent ». |
| profil (d'agent) | profile | |
| outil, outils de l'app | tool, app tools | |
| outils de Bobine | Bobine's tools | Ceux du serveur MCP `bobine` (fiche 099). |
| intégré (serveur MCP) | built-in | « bobine · intégré » → « bobine · built-in ». |
| accord (de l'utilisateur) | approval | Pastilles des outils de Bobine : « Accord avant de compiler » → « Approval before building ». |
| sous-agent | subagent | Comme Claude Code. |
| mémoire, souvenir | memory, memory (entry) | Fiche 182. « Retenir ? » → « Remember? », « Oublier ? » → « Forget? », « Non retenu » → « Not kept ». |
| retenir, oublier | remember, forget | Noms des outils de l'agent (`remember`, `forget`, `recall`). |
| session (de l'agent) | session | Ce que l'agent garde ; différent de « conversation ». |
| reprendre une session | resume a session | |
| démarrage / démarrer | start / starting | « Démarrage… » → « Starting… ». |
| relancer (l'agent) | restart | « Relancer » du diagnostic → « Run again ». |
| réessayer | try again | |
| arrêté | stopped | Statut ; « Arrêté (planté) » → « Stopped (crashed) ». |
| prêt | ready | |
| répond… | responding… | |
| action requise | action required | |
| lecture seule | read-only | |
| lecture seule demandée (rôle, agent qui écrit sans demander) | read-only requested | Fiche 223 : seulement demandée, jamais garantie. |
| mode plan, plan | plan mode, plan | |
| exécution (mode de départ) | Act | Décision 3 ; paire Plan / Act. |
| remarque (sur un plan) | comment | « Envoyer mes remarques » → « Send my comments ». |
| relecture, faire relire (fiche 177) | review, request review | Le relecteur : « reviewer » (code), « la relecture » dans l’interface. |
| gravité : haute / moyenne / basse | severity: high / medium / low | Une seule échelle, partout (carte « 1 haute », liste, diff, export, message à l’agent). Jamais « grave », « critique » ni « mineure ». |
| exécuter le plan | run the plan | |
| compaction, résumer la conversation | compaction, summarize the conversation | |
| commande « / » | slash command | |
| commande personnelle / du projet | personal command / project command | Comme Claude Code. |
| commande de l'app | app command | |
| rôle ; rôle fourni / personnel / du projet | role; built-in / personal / project role | Fiche 223 (phase 3A). Jamais « agent » ni « mode » pour un rôle. |
| consigne (d'un rôle) | instructions | Le corps du fichier de rôle. |
| équipe (section de la barre latérale) | team | Les rôles actifs. |
| confier (un travail) à un rôle | hand (work) to a role | « Confier à Expert sécu » → « Hand to Security expert ». |
| fichier écarté | file left out | Fichier de rôle refusé, avec sa raison. |
| règles actives | active rules | |
| capacités, ce qu'il annonce | capabilities, what it reports | |
| propre à (un agent) | specific to | |

### La conversation

| Français | Anglais | Remarque |
|---|---|---|
| conversation | conversation | Pas « chat » (décision 1). |
| nouvelle conversation | new conversation | |
| fil (de la conversation) | conversation | « Largeur du fil » → « Conversation width ». |
| zone de saisie | message box | « Aller à la zone de saisie » → « Focus the message box ». |
| message | message | |
| réponse (de l'agent) | response | « Arrêter la réponse » → « Stop the response ». |
| réponse (de l'utilisateur à une question) | answer | « Attend votre réponse » → « Waiting for your answer ». |
| réponse à lire | unread response | Pastille d'attente. |
| en attente (message) | queued | « Partira à la fin de la réponse » → « Will be sent when the response ends ». |
| demande (de l'agent) | request | |
| question, formulaire | question, form | |
| réflexion | thinking | Bloc de réflexion de l'agent. |
| terminé, échec, interrompu (carte d'outil) | done, failed, interrupted | « interrompu » : arrêté par l'utilisateur ou par l'arrêt de l'agent, pas « annulé » (fiche 126). |
| avis (dans le fil) | notice | Terme interne ; rarement visible. |
| aparté | aside | Question à côté, hors du fil (fiche 180) ; « Ajouter au fil » → « Add to conversation ». |
| pièce jointe, joindre | attachment, attach | |
| mention | mention | `@git-changes`, `@terminal` ne changent pas. |
| capture (d'écran) | screenshot | Aussi pour le simulateur et l'émulateur. |
| annoter, appliquer | annotate, apply | |
| repartir de ce message | branch from this message | Décision 4. |
| branche (d'une conversation, de git) | branch | |
| conversation fille, conversation mère | child conversation, parent conversation | Fiche 097 ; pas « sous-agent », réservé à ceux des agents. |
| lancer en parallèle | run in parallel | Geste qui lance une conversation fille. |
| sous-tâches (carte du fil) | subtasks | Carte des filles dans le fil de la mère. |
| compte rendu (d'une fille) | report | |
| proposer des conversations filles ; Quand ça s'y prête, Toujours demander | propose child conversations ; When it fits, Always ask | Fiche 118 (réglage et contexte de session). |
| historique | history | |
| épinglées, archivées, récents | pinned, archived, recent | Titres de sections. |
| sommaire (de la conversation) | outline | |

### Dossiers, fichiers, git

| Français | Anglais | Remarque |
|---|---|---|
| dossier | folder | Comme dans le Finder. |
| dossier de travail | working folder | |
| dossier personnel | home folder | |
| tous les dossiers / ce dossier | all folders / this folder | Portée d'un serveur MCP, d'une règle. |
| projet | project | |
| fichier | file | |
| modifications (onglet) | Changes | Nom d'onglet. |
| modification (d'un fichier) | change | |
| annuler une modification | revert a change | Pas « cancel ». |
| remettre dans son état d'avant | restore to its previous state | |
| dépôt git, commit, worktree | git repository, commit, worktree | « worktree » ne se traduit pas. |
| non commité | uncommitted | |
| à pousser / à récupérer | to push / to pull | |
| aperçu | preview | |

### Autorisations, connexion

| Français | Anglais | Remarque |
|---|---|---|
| autorisation, demande d'autorisation | permission, permission request | |
| autoriser | allow | |
| toujours autoriser | always allow | |
| toujours dans ce projet | always in this project | |
| refuser (une autorisation) | deny | Sites, commandes, outils. |
| refuser (une demande de l'agent) | decline | Formulaire, page à ouvrir. |
| révocable dans… | can be revoked in… | |
| faire confiance à ce dossier | trust this folder | Dossier « approuvé » par Bob → « trusted ». |
| dossier non approuvé | folder not trusted | |
| connexion, se connecter | sign-in, sign in | « Connexion requise » → « Sign-in required ». |
| clé d'API | API key | |
| trousseau macOS | macOS Keychain | |
| licence | license | Orthographe américaine. |

### Panneaux et outils de l'app

| Français | Anglais | Remarque |
|---|---|---|
| panneau (latéral), panneau de droite | side panel | |
| agrandir / réduire le panneau | maximize / restore the panel | Menu : « Maximize Panel ». |
| navigateur intégré, Navigateur (onglet) | built-in browser, Browser | |
| onglet | tab | |
| simulateur iOS | iOS Simulator | Nom d'Apple, avec majuscule. |
| émulateur Android | Android Emulator | |
| terminal | terminal | |
| tâches, liste de tâches | tasks, task list | « Tâches » (onglet) → « Tasks ». |
| serveur de dev | dev server | |
| lancer (une commande, l'app) | run | « Lancer l'app » → « Run the app ». |
| compiler | build | |
| touchers | touches | AXe : « touchers et vidéo » → « touch input and video ». |
| en direct | live | |
| vue côte à côte, ouvrir à côté | side-by-side view, open side by side | |
| fenêtre rapide | Quick Entry | Décision 5. |
| Échanges ACP (onglet), morceaux regroupés | ACP messages, grouped chunks | Fiche 135 ; « morceau » : un `agent_message_chunk`. |

### Réglages, diagnostic, consommation

| Français | Anglais | Remarque |
|---|---|---|
| Réglages | Settings | Comme macOS 13 et plus. |
| Général, Conversation, Terminal | General, Conversation, Terminal | Sections. |
| Agents et dossiers | Agents and folders | Section. |
| Serveurs MCP, serveur MCP | MCP servers, MCP server | |
| Commandes | Commands | Section. |
| Raccourcis clavier | Keyboard shortcuts | |
| Diagnostic | Diagnostics | |
| À propos, Nouveautés | About, What's new | |
| thème : système, clair, sombre, sépia, nuit noire | theme: system, light, dark, sepia, black | « Nuit noire » → « Black ». |
| couleur d'accent | accent color | Orthographe américaine. |
| police (Serif, Sans serif) | font (serif, sans serif) | Fiche 128 : « Sans serif » et « Serif » en français aussi (plus « à empattements »), qui reste un synonyme caché de la recherche. |
| empêcher la mise en veille | prevent sleep | |
| conversations gardées actives | conversations kept active | Fiche 102 ; agents gardés en mémoire. |
| mise en veille (d'une conversation) | put to sleep | Son agent est arrêté pour faire de la place, elle est rechargée quand on y revient (fiche 102). |
| relire le PATH | reload PATH | |
| journal, afficher le journal | log, show log | |
| rapport | report | |
| joignable, tester | reachable, test | Serveurs MCP. |
| consommation | usage | |
| contexte, jetons, coût | context, tokens, cost | |
| dépense | spend | Dépense récente avec un agent. |
| échange (un tour) | exchange | Tableau de consommation : « Échanges », « Par échange » → « Exchanges », « Per exchange ». |
| temps de travail | working time | Fiche 137. |
| non communiqué | not reported | Valeur que l'agent ne donne pas (jetons, coût, modèle). |
| remettre à zéro | reset | « Remettre à zéro… » → « Reset… ». |
| Bobcoins | Bobcoins | Unité de Bob : majuscule à l'affichage (fiche 144) ; `bobcoins` dans les données, le journal et le CSV. |
| Mon activité | My activity | Page de la fenêtre principale (fiche 144) : la consommation de toutes les conversations. |
| badge du Dock | Dock badge | |
| compteur sur l'icône du Dock | count on the Dock icon | Réglage du badge « À traiter » (fiche 119). |
| À traiter (section de la barre latérale) | Waiting on you | Fiche 119 ; « Réponse à lire » → « Unread response », « Compte rendu à lire » → « Unread report ». |
| faire rebondir l'icône du Dock | bounce the Dock icon | Rebond : bounce. |
| notifications | notifications | |

### Actions courantes

| Français | Anglais | Remarque |
|---|---|---|
| Annuler | Cancel | « Annuler » du menu Édition → « Undo » ; d'une modification → « Revert ». |
| Fermer | Close | |
| Enregistrer | Save | |
| Supprimer | Delete | Clé d'API, conversation, serveur. |
| Retirer | Remove | Pièce jointe, message en attente. |
| Modifier | Edit | |
| Renommer | Rename | |
| Copier, Copié | Copy, Copied | |
| Envoyer | Send | |
| Passer, Suivant | Skip, Next | Questions. |
| Ouvrir avec l'app par défaut | Open in default app | |
| Afficher / Montrer dans le Finder | Show in Finder | |
| Effacer | Clear | Données du navigateur. |
| Oublier | Forget | Dossier récent. |
| Plus tard, Ne plus proposer | Later, Don't ask again | Installation. |

### Menus macOS (libellés exacts de macOS)

| Français | Anglais |
|---|---|
| À propos de Bobine / Masquer Bobine / Quitter Bobine | About Bobine / Hide Bobine / Quit Bobine |
| Masquer les autres / Tout afficher / Services | Hide Others / Show All / Services |
| Fichier / Édition / Affichage / Fenêtre / Aide | File / Edit / View / Window / Help |
| Fermer la fenêtre | Close Window |
| Annuler / Rétablir | Undo / Redo |
| Couper / Copier / Coller / Coller et adapter le style | Cut / Copy / Paste / Paste and Match Style |
| Supprimer / Tout sélectionner | Delete / Select All |
| Taille réelle / Zoom avant / Zoom arrière / Plein écran | Actual Size / Zoom In / Zoom Out / Enter Full Screen |
| Recharger / Outils de développement | Reload / Developer Tools |

### Ne pas traduire

Bobine, IBM Bob, Bob Shell, Bob IDE, OpenCode, Claude, Claude Code, Xcode, AXe, Android Studio,
Gradle, `xcodebuild`, `adb`, git, GitHub, MCP, ACP, SSO, PATH, JSON, Markdown, Mermaid,
`AGENTS.md`, `$ARGUMENTS`, worktree, Finder, Dock, macOS, iOS, Android, Electron ; tout ce qui est
entre accents graves (code, chemins, commandes, options) ; les noms de touches en symbole.

### Points tranchés

Décisions de l'utilisateur (2026-10-16), appliquées partout :

1. « conversation » → **conversation** (distinct de la « session » de l'agent), pas « chat ».
2. Casse : **Title Case dans la barre de menus macOS, sentence case ailleurs**.
3. Mode de départ « Exécution » → **Act** (paire Plan / Act).
4. « Repartir de ce message » → **Branch from this message**.
5. « Fenêtre rapide » → **Quick Entry**.
6. Prénom d'exemple dans l'aide du réglage « Votre prénom » → **Alex**.

## Comment on traduit

1. **Glossaire d'abord** : ce document, validé par l'utilisateur.
2. **Traduction** par un agent, fichier par fichier de clés, avec le glossaire, le guide de style
   et le contexte de chaque clé : son nom (`sidebar.status.ready`), le composant qui l'affiche
   (rechercher la clé dans `src/`), les captures e2e de l'écran concerné.
3. **Contrôles automatiques** : `./scripts/verify` (mêmes clés, mêmes variables, pluriels de la
   langue, typage).
4. **Captures dans la langue** : suites e2e en anglais (fiche 074, étape 4), regardées en clair et
   en sombre ; on cherche les textes coupés, trop longs, ou restés en français.
5. **Relecture humaine** par quelqu'un qui écrit couramment la langue, de préférence développeur.

Au quotidien, chaque fiche qui ajoute un texte l'ajoute en français **et** en anglais, en suivant
ce glossaire (AGENTS.md).

## Ajouter une langue

1. `src/shared/i18n/language.ts` : ajouter la langue à `LANGUAGES` et son nom dans sa langue à
   `LANGUAGE_NAMES` ; `format.ts` : sa région de formatage (`LOCALES`).
2. `src/shared/i18n/locales/<langue>.json` : même structure que `fr.json`. `pnpm test` dit quelles
   formes de pluriel la langue demande (`Intl.PluralRules`) : le russe ou le polonais en ont plus
   que deux.
3. `src/shared/i18n/index.ts` : ajouter ses ressources ; Réglages › Général › « Langue » la
   propose.
4. `electron-builder.yml` : ajouter la langue à `electronLanguages` (textes de Chromium, boîtes de
   dialogue et menus de macOS, qui la prennent au lancement : « Relancer » dans les Réglages).
5. `CHANGELOG.<langue>.md`, versions passées comprises, branché dans `SettingsDialog.tsx`
   (`CHANGELOGS`) ; le fond du `.dmg` (`build/background.svg`) reste bilingue français-anglais.
6. Ce document : une colonne de glossaire et ses règles de style (typographie, casse, tutoiement
   ou vouvoiement…).
7. `e2e/lib.mjs` (`LANG`) et `e2e/run.mjs` acceptent la langue : `pnpm e2e --lang <langue>` ;
   captures regardées, puis relecture par quelqu'un dont c'est la langue.

Une langue écrite de droite à gauche (arabe, hébreu) demanderait en plus de retourner la mise en
page : hors de ce qui est prévu aujourd'hui.
