# 126 — Finitions de la campagne de recette d'octobre

- **Statut** : fait (deux points reportés : F.1, sujet de commit d'un titre déjà coupé)
- **Dépend de** : 039 (commandes de l'app), 041/047 (états des cartes), 034 (terminal), 005
  (mentions `@`), 014 (infobulles Radix), 104 (fournisseurs), 054 (serveurs MCP), 110 (worktrees),
  074 (traduction), 099 (outils de Bobine), 051 (recherche des réglages)
- **Agents** : les deux. Rien de propre à un agent dans l'interface (ADR-0011) : ce qui diffère
  (commande de compaction, jetons non transmis) vient du profil ou de ce que l'agent annonce.

## Pourquoi

La campagne de recette du 2026-10-23 ([synthèse](../recettes/2026-10-23-synthese-campagne.md), PV
[OpenCode](../recettes/2026-10-23-recette-opencode.md) et [Bob](../recettes/2026-10-23-recette-bob.md),
sections « Pas pratique », « Cosmétiques », « Manques ») a relevé dix finitions : rien de bloquant,
mais autant de petites gênes qui font douter de l'app. Un seul lot avant le tag 0.5.0, une
finition par commit.

## Critères d'acceptation

- [x] **1. `/context`, `/cost`, `/compress`** (C13, 2.6 OpenCode et Bob) : chaque encadré porte son
      titre ; `/context` dit ce qu'il ne sait pas quand l'agent ne transmet pas le remplissage de
      son contexte ; la commande de compaction de l'agent (`/compress` de Bob) est dans la liste `/` ;
      la réponse texte à une commande de compaction devient une carte « Conversation résumée ».
- [x] **2. Carte d'outil interrompue** (1.7, 2.1, 2.7 OpenCode) : arrêtée par Échap ou ■, elle est
      « interrompue », pas « échec ».
- [x] **3. Pager** (1.3 OpenCode) : les commandes lancées par l'agent dans le terminal partagé
      tournent sans pager (`GIT_PAGER=cat`, `PAGER=cat`) ; les onglets de l'utilisateur gardent le sien.
- [x] **4. Mention `@`** (1.2 OpenCode) : préfixes du nom et des segments du chemin d'abord ; la
      correspondance lettre à lettre seulement quand rien d'autre ne correspond.
- [x] **5. Infobulles** (C12 ; défaut 1 de l'essai libre du 2026-10-20) : une infobulle disparaît
      quand l'élément survolé disparaît ou défile ; aucune n'avale un clic après un choix dans un
      menu de la barre (vérifié à la vraie souris).
- [x] **6. Confirmation de suppression** (D1, 1.3 OpenCode) : une seule règle pour supprimer un
      fournisseur, un serveur MCP, une commande, une clé d'API, révoquer une autorisation : la
      confirmation s'ouvre dans la ligne, visible là où l'on a cliqué (vérifié à la vraie souris).
- [x] **7. `opencode.json` vide** (D2) : retirer le dernier serveur (ou fournisseur) supprime le
      fichier s'il ne contient plus rien d'autre.
- [x] **8. Barre de worktree** (3.4) : le message de commit proposé ne coupe pas un mot ;
      « Nettoyer » un worktree orphelin demande confirmation.
- [x] **9. Textes** : « d'OpenCode » (C2), un seul « Plein écran », qui dit « Quitter » en plein écran (C3), « son état d'alors » au
      singulier (C7), espaces insécables (C1) ; reporté : ligne de réponse d'une question de l'app
      dans la langue courante (F.1 Bob).
- [x] **10. Outils de Bobine et recherche des réglages** (0.2, 0.3, 0.4 Bob) : interrupteurs des
      familles atteignables au clavier et par l'accessibilité ; « Questions » dit pourquoi il est
      grisé ; la recherche trouve les fonctions « Propre à … » (« quota »).
- [x] Testé contre l'agent factice (unitaires et composants ; e2e touchées, clair et sombre).

## Plan

Une finition par commit, dans l'ordre. Pour chacune : test rouge, correction, ligne au journal.

1. `shared/app-commands.ts` (`contextReport`, `costReport`, commande de compaction dans la liste),
   `renderer/app-commands.ts`, avis titré (`notice.title`, `Transcript.tsx`) ;
   `shared/transcript.ts` : à la fin d'un tour ouvert par la commande de compaction sans
   `compaction_update`, le texte de l'agent devient la carte « Conversation résumée ». Agent
   factice : `/compress` répond en texte, comme Bob.
2. `shared/transcript.ts` : évènement `cancel-requested` émis par `manager.cancel` / `sendNow` ;
   un outil qui échoue ensuite dans ce tour est `cancelled` ; libellé « interrompu ».
3. `main/terminal/terminal-manager.ts` : onglets ouverts par l'agent avec `PAGER=cat`,
   `GIT_PAGER=cat` ; l'agent réutilise ses onglets libres, jamais ceux de l'utilisateur.
4. `main/workspace-files.ts` : `rankPath` (préfixes de segments), flou en repli.
5. Infobulles natives (`title`) remplacées à l'affichage par une infobulle de l'app, fermée au
   défilement, au clic, à la disparition de l'élément (`TitleTooltips`).
6. Composant `ConfirmRow` (phrase + bouton rouge + « Garder » sous la ligne), pour fournisseurs,
   serveurs MCP, commandes, autorisations, worktrees orphelins.
7. `main/agent-config/mcp-files.ts`, `provider-files.ts` : conteneur vide retiré, fichier supprimé
   s'il ne reste rien.
8. `main/conversations/helpers.ts` (`titleFrom` coupe à un mot) ; orphelins avec `ConfirmRow`.
9. `fr.json` (insécables, accords), post-traitement d'élision (« de » / « que » devant voyelle)
   dans `shared/i18n`, `menu.ts`.
10. `.switch` focalisable et cliquable par l'accessibilité, mention « Toujours » ; index de
    recherche des réglages enrichi des fonctions propres à chaque agent.

Pas de nouvelle dépendance.

## Journal

- 2026-10-23 : fiche créée depuis les PV de la campagne. Sujets touchant des fichiers d'autres
  sessions en cours (D21 : `agent-host.ts` ; états des cartes : `command-approval`, adaptateur
  OpenCode ; fusion : `worktree-cycle`) : reportés et dits ici s'ils en dépendent.
- **1. `/context`, `/cost`, `/compress`.** Avis titrés (`notice.title`, « Contexte de la
  conversation », « Coût de la conversation ») ; `/context` ne montre que le remplissage, ou « Bob
  ne transmet pas le remplissage de son contexte… `/compress` le résume » ; `/cost` les jetons
  traités (même total que la puce, « échanges ») et le coût. La commande de compaction déclarée par
  le profil et non annoncée figure dans la liste `/` sous son nom (`withCompactCommand`), et
  `/compact` de l'app n'y est plus pour cet agent (tapé, il marche toujours) : une seule entrée
  pour une seule action. Générique : un tour ouvert par `/compact` ou `/compress` seuls, sans
  `compaction_update`, voit sa réponse devenir la carte « Conversation résumée » (le résumé en
  Markdown, ce qui règle aussi C8). Agent factice : `/compress` répond en texte (scénario
  `compaction-texte`). Non fait : C9 (encadrés non rejoués après ⌘Q) — ce sont des relevés de
  l'instant, gardés dans la fenêtre seulement, comme avant.
- **2. Carte d'outil interrompue.** `manager.cancel` et `sendNow` (« Interrompre et envoyer »)
  émettent `cancel-requested` quand l'agent travaille ; jusqu'à la fin du tour, un outil en cours
  qui passe `failed` (OpenCode : « Tool execution interrupted ») devient `cancelled`. L'état
  `cancelled` se lit « interrompu » (carte, groupe, sous-agents) : il couvre aussi l'agent arrêté
  faute de répondre, l'utilisateur ayant arrêté dans les deux cas. Un échec d'avant l'arrêt reste
  un échec. Pas de changement d'adaptateur ni d'`agent-host.ts`.
- **3. Pager.** Les onglets que l'agent ouvre (`terminal_run` sans `tab_id`) démarrent avec
  `PAGER=cat` et `GIT_PAGER=cat` (ce dernier passe devant `core.pager`) ; l'agent réutilise ses
  onglets libres, plus ceux de l'utilisateur, qui gardent leur pager. Choix : régler
  l'environnement de l'onglet plutôt que préfixer chaque commande (un préfixe ne vaut que pour la
  première commande d'un `cd … && git log`, et s'afficherait dans le terminal). Limites : un
  `.zshrc` qui exporte `GIT_PAGER` l'emporte ; un `tab_id` qui désigne un onglet de l'utilisateur
  garde son pager. e2e `terminal` mis à jour (l'agent ouvre l'onglet 2 à côté de celui de
  l'utilisateur).
- **4. Mention `@`.** `rankPath` : nom qui commence (0), segment du chemin ou mot du nom qui
  commence (1 : `app/…`, `books-list.js`, `src/ma`), nom qui contient (2), chemin qui contient
  (3), lettres dans l'ordre (4) ; `searchWorkspaceFiles` ne garde le rang 4 que si rien d'autre ne
  correspond. `@books` ne propose plus `AppFrameworkInfo.plist` ; `@afi` le trouve encore.
- **5. Infobulles.** Les infobulles qui restaient étaient les natives de macOS (attribut `title`,
  ≈ 130 dans l'interface) : affichées par le système tant que la souris ne bouge pas, elles ne
  voient ni le défilement ni la disparition de l'élément. Plutôt que convertir chaque `title` (et
  toucher des fichiers d'autres chantiers), une couche unique (`title-tooltips.ts`, installée par
  `main.tsx` pour toutes les fenêtres) met le `title` de côté pendant le survol et affiche une
  infobulle de l'app au même style que `Tip` ; fermée au défilement, à la molette, à une touche,
  au clic (le `title` revient alors), quand l'élément quitte la page ou que la fenêtre perd le
  focus ; un `title` changé pendant le survol est suivi ; un bouton à icône garde son nom
  accessible. Les infobulles Radix (`Tip`) se ferment déjà seules (défilement, démontage). Le
  défaut 1 de l'essai libre du 2026-10-20 (infobulle de la puce qui avale le clic) était corrigé
  par `pointer-events: none` et `useReturnFocus` : à revérifier à la vraie souris.
- **6. Confirmation dans la ligne.** Composant `ConfirmRow` (+ `useConfirm`) : le premier clic
  ouvre, sous la ligne et sur toute sa largeur, une bande rouge pâle « Supprimer le fournisseur
  « x » ? · Supprimer · Garder » ; le bouton qui l'a ouverte reste enfoncé (`aria-expanded`), un
  second clic sur lui referme, « Garder » a le focus, Échap referme sans fermer les Réglages.
  Choix UX : la confirmation sous la ligne plutôt qu'un bouton qui change d'aspect sous le pointeur
  (D1 : on ne voyait rien) ou qu'un dialogue (trop lourd pour une ligne) ; le bouton rouge n'étant
  pas sous le pointeur, un double-clic ne supprime rien. Même règle partout dans les Réglages :
  fournisseurs, serveurs MCP, commandes personnelles, clés d'API (agent et fournisseur),
  autorisations retenues (outils, sites, commandes : « Révoquer »), worktrees orphelins (sujet 8).
  Seul « Dossiers récents » garde le retrait en un clic : il n'efface rien. Les trois listes
  d'autorisations sortent d'`AgentsSettings` (`RememberedApprovals.tsx`). e2e `mcp`, `providers`,
  `permissions`, `terminal`, `auth` mis à jour (captures b3, 87).
- **7. Fichier vidé.** `config-prune.ts` : après le retrait d'un serveur MCP ou d'un fournisseur,
  les conteneurs vidés (`mcp`, `mcp.servers`, `mcpServers`, `provider`) partent aussi ; s'il ne
  reste rien (au plus `$schema`) ni commentaire, le fichier est supprimé (pour les fournisseurs,
  mis de côté en `.bak`, comme à chaque écriture). Vaut pour tous les fichiers (projet et
  global, Bob et OpenCode) : un fichier vide n'a pas de sens. Retirer un serveur absent n'écrit
  plus rien (avant : un `{}` créé). Les listes `enabled_providers` / `disabled_providers` ne sont
  pas touchées (une liste vide a un sens pour OpenCode). e2e `mcp` : le scénario du PV (seul
  serveur du projet retiré → plus d'`opencode.json`).
- **8. Message de commit, orphelins.** Le sujet coupé (« … de trois l ») venait du titre de la
  conversation, raccourci à 59 caractères au milieu d'un mot ; `commitSubject` enlève le « … » et
  garde le reste. `titleFrom` coupe désormais à un mot entier (si le dernier espace est dans la
  seconde moitié), ce qui vaut aussi pour la liste des conversations. Non fait (reporté) :
  rattraper dans `commitSubject` le dernier mot coupé d'un titre ancien, déjà enregistré —
  `shared/worktree-cycle.ts` est au chantier de la fusion (fiche 123). « Nettoyer » un worktree
  orphelin passe par `ConfirmRow`, qui dit ce qui sera perdu (« 2 fichiers non commités · 1 commit
  non fusionné ») ; e2e `worktree-cycle` mis à jour (capture 117).
- **9. Textes.** Insécables et élisions faites à l'affichage par un post-traitement d'i18next
  (`shared/i18n/typography.ts`, enregistré par le main, le renderer et les essais ; `L()` des e2e
  fait de même) plutôt qu'en réécrivant `fr.json` : la conversion statique touchait 441 lignes
  d'un fichier que cinq branches modifient en même temps, et chaque nouvelle clé aurait dû y
  penser ; à l'affichage, la règle vaut pour tout texte, valeurs insérées comprises. Élision
  seulement devant une voyelle majuscule (noms d'agents, de fournisseurs), pas devant un nom de
  fichier. Une trentaine d'essais qui comparaient un texte français écrit en dur l'écrivent
  désormais avec `\u00a0` (seuls les textes attendus ont changé). C3 : notre article au rôle `togglefullscreen` faisait ajouter à macOS
  le sien (🌐F) juste à côté — vérifié à la vraie souris : sans lui, macOS n'en ajoute aucun, et la
  préférence `NSFullScreenMenuItemEverywhere` n'y change rien. L'article de l'app n'a donc plus de
  rôle : il bascule la fenêtre (⌃⌘F) et le menu est reconstruit à l'entrée et à la sortie du plein
  écran pour dire « Quitter le plein écran » (`full-screen-menu.ts`). C7 : « Remettre 1 fichier dans son
  état d'alors », « 1 fichier remis dans son état d'alors ». **Reporté — F.1** (« → Run » figé dans
  la langue du moment) : les questions de l'app (terminal, compilation, lancement) sont
  construites traduites par `mcp/command-approval.ts`, chantier de la session des états des
  cartes ; il faudra y passer des `Message` (clé + valeurs, ADR-0014) au lieu de textes.
- **10. Interrupteurs, « Questions », recherche.** La case d'un `.switch` faisait 0 × 0 px : un
  clic d'accessibilité visait un point hors de l'interrupteur (et fermait les Réglages). Elle
  couvre maintenant tout l'interrupteur, invisible, au-dessus du dessin : même clic, même focus
  clavier, cadre d'accessibilité juste — pour tous les interrupteurs de l'app. « Questions »
  (famille imposée) n’a plus d’interrupteur grisé mais « Toujours fournie », avec l'explication en
  infobulle. La recherche des réglages reçoit les fonctions « Propre à … » de chaque agent
  installé (`agentEntries`) : « quota » trouve « Quota de bobcoins », affiché « Agents et
  dossiers › IBM Bob » ; l'ouvrir déplie l'agent et fait ressortir la ligne (`data-setting`).
  e2e `mcp` (Tab vers l'interrupteur, taille de sa zone) et `settings` (« Compaction » de l'agent
  factice, capture 85-recherche-propre-agent).
- **Vérifications (2026-10-23).** `./scripts/verify` vert. `pnpm build && pnpm e2e --changed` : le
  lot touche des fichiers communs, d'où les 55 suites (110 passages, clair et sombre) ; au premier
  passage 9 en échec, toutes expliquées et corrigées — textes comparés après réduction des blancs
  (insécables), et un vrai défaut du sujet 3 : le panneau restait sur l'onglet de l'utilisateur
  quand l'agent ouvrait le sien (`TerminalTab` montre désormais un onglet qui apparaît). Captures
  regardées en clair et en sombre (30-context-cost, b3, b5, 87, 117, 85-recherche-propre-agent).
  **Vraie souris** (app de développement, `withApp` avec dossier gardé, computer-use) : infobulle
  d'un lien de fichier affichée (celle de l'app, pas la native) puis fermée à la molette sans
  bouger la souris ✓ ; clic sur l'onglet « IBM Bob » des Serveurs MCP : aucune infobulle ne reste
  ✓ ; choix d'un mode dans la barre puis clic dans la saisie : le texte arrive (défaut 1 du
  2026-10-20 non reproduit) ✓ ; corbeille d'un serveur MCP : bande de confirmation visible sous la
  ligne, corbeille enfoncée, Échap la referme sans fermer les Réglages, un double-clic ne supprime
  rien, « Supprimer » supprime ✓ ; clic d'accessibilité (AXPress) sur un interrupteur de famille :
  cadre de 38 × 22 px, bascule sans fermer les Réglages ✓ ; menu View/Affichage : un seul
  « Plein écran », « Exit Full Screen » en plein écran ✓. **Non vérifié à la vraie souris** :
  l'apparition de l'infobulle au survol *dans* les Réglages (les déplacements simulés de
  computer-use n'arrivent pas à la page sous le dialogue modal ; les clics oui) — couvert par les
  essais unitaires de `title-tooltips.ts` ; la disparition d'un élément survolé (unitaire aussi).
- **Dernier lancement complet** (après le correctif du menu) : 109 passages sur 110 verts ; `about`
  s'est bloquée en fin de lancement parallèle (comme au passage précédent, sur l'autre thème),
  puis est passée 5 fois de suite seule (`pnpm e2e about`, avec et sans `--jobs 1`). Instabilité à
  surveiller, sans lien trouvé avec ce lot.
- **Reporté** : F.1 (ligne de réponse figée dans la langue du moment, dépend de
  `mcp/command-approval.ts`) ; rattraper le dernier mot coupé d'un titre ancien dans
  `commitSubject` (`shared/worktree-cycle.ts`, fiche 123). Vu en passant, hors lot : avec deux
  onglets, la barre de défilement de la rangée d'onglets du terminal passe sur « + ».
- 2026-10-23 — **Fusion de main (fiches 121 à 125).** États d'une carte : un seul vocabulaire,
  « refusé » (122), « échec », « interrompu » (`cancelled`, ce lot, à la place de « annulé ») ;
  l'issue vue par l'app (refus, échec de la 122) l'emporte sur l'arrêt par l'utilisateur
  (`toolStatus` dans `transcript.ts`) ; la fin de tour garde à la fois les sous-agents en
  arrière-plan (122) et la carte de compaction (ce lot). Essais venus de main qui comparaient du
  français écrit en dur : `\u00a0` ajoutée. Bornes ESLint dépassées après la fusion :
  `conversations/manager.ts` (1055/1050) — ce qu'un évènement apprend au registre (titre proposé,
  arrêt de l'agent) sort vers `helpers.ts` (`proposedTitle`, `warnIfStopped`) ; `index.ts`
  (853/850) — les images du simulateur (`resizeJpeg`, `encodeBgra`) sortent vers
  `simulator/images.ts`. Sans changement de comportement.
