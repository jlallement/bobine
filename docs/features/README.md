# Fonctionnalités et feuille de route

Une fiche par fonctionnalité, à partir de [`_modele.md`](_modele.md). Mettre à jour cet index à
chaque création ou changement de statut.

| N° | Fonctionnalité | Statut | Priorité |
|---|---|---|---|
| [001](001-squelette-electron.md) | Squelette Electron + React + outillage + `verify` | fait | — |
| [002](002-agent-factice.md) | Agent ACP factice à scénarios | fait | — |
| [003](003-client-acp-chat.md) | Client ACP + fil de conversation en streaming | fait | — |
| [004](004-profils-agent.md) | Profils d'agent et dossier de travail dans l'UI | fait | — |
| [005](005-images-fichiers.md) | Images et fichiers dans le message (coller, glisser, `@`) | fait | — |
| [006](006-permissions-diffs.md) | Permissions et diffs | fait | — |
| [007](007-mcp-navigateur.md) | Navigateur intégré piloté par l'agent | fait | — |
| [008](008-simulateur-captures.md) | Simulateur iOS : compiler, lancer, captures, interactions | fait | — |
| [009](009-simulateur-video.md) | Simulateur iOS : flux vidéo fluide | fait | — |
| [010](010-sous-agents.md) | Sous-agents : cartes lisibles (imbrication impossible par ACP) | fait en partie | P3 |
| [011](011-specificites-bob.md) | Spécificités Bob : SSO, confiance du dossier, élicitation | fait | — |
| [012](012-packaging-macos.md) | Packaging macOS (.app + .dmg) | fait | P2 |
| [013](013-modes-options-session.md) | Modes et options de session (approbation, modèle) | fait | — |
| [014](014-refonte-visuelle.md) | Refonte visuelle dans l'esprit de Claude Desktop | fait | — |
| [015](015-historique-conversations.md) | Historique des conversations | fait | — |
| [016](016-questions-mode-plan.md) | Questions à choix et validation du plan | fait | — |
| [017](017-commandes-slash.md) | Commandes « / » de l'agent | fait | — |
| [018](018-sortie-commandes.md) | Sortie des commandes (terminal) | fait | — |
| [019](019-consommation.md) | Consommation : jetons, contexte, coût (bobcoins pour Bob) | fait | — |
| [020](020-file-messages.md) | Écrire pendant que l’agent travaille | fait | — |
| [021](021-recap-modifications.md) | Récapitulatif des modifications (onglet du panneau) | fait | P2 |
| [022](022-authentification-agents.md) | Authentification : SSO ou clé d'API (Bob, OpenCode) | fait | P2 |
| [023](023-modifier-relancer.md) | Modifier un message et repartir d'un point | fait | P1 |
| [024](024-notifications.md) | Notifications macOS (bannières : signature requise) | fait | P2 |
| [025](025-serveurs-mcp.md) | Serveurs MCP des agents (Bob, OpenCode) dans les réglages | fait | P1 |
| [026](026-historique-avance.md) | Historique : recherche, dossiers, brouillons | fait | P2 |
| [027](027-reglages-raccourcis.md) | Réglages et raccourcis clavier | fait | P2 |
| [028](028-questions-mcp.md) | Questions interactives pour Bob (outil `ask_user` via MCP) | fait | — |
| [029](029-socle-outils-app.md) | Socle des outils de l'app : serveur MCP générique, panneau latéral | fait | — |
| [030](030-lancer-app.md) | Lancer l'app du projet (serveurs de dev) dans le navigateur | fait | — |
| [031](031-debogage-web.md) | Débogage web : console, réseau, mobile / sombre, onglets | fait | — |
| [032](032-emulateur-android.md) | Émulateur Android : compiler, lancer, captures, interactions | fait | — |
| [033](033-android-video.md) | Émulateur Android : flux vidéo fluide | fait | — |
| [034](034-panneau-terminal.md) | Panneau terminal partagé avec l'agent | fait | — |
| [035](035-panneau-taches.md) | Panneau « Tâches » (plan de l'agent) | fait | — |
| [036](036-sessions-paralleles.md) | Conversations en parallèle et worktrees git | fait | P2 |
| [037](037-git-pr-ci.md) | Git, pull requests et CI | retiré (fiche 049) ; reste la branche | — |
| [038](038-pilotage-mac.md) | Piloter les applications du Mac (computer use) | à faire | P3 |
| [039](039-commandes-app.md) | Commandes de l'app : `/compact`, `/clear`, `/context`, `/cost`… | fait | — |
| [040](040-plan-annote.md) | Plan annoté : remarques sur le plan, versions, exécution | fait | P2 |
| [041](041-stabilisation.md) | Stabilisation : pannes de l'agent, données, journal, essais | fait | P1 |
| [042](042-autorisations-retenues.md) | « Toujours autoriser » retenu d'une conversation à l'autre | fait | P2 |
| [043](043-suite-audit-octobre.md) | Suite de l'audit d'octobre : hygiène, AXe, historique, tests, limites levées, export | fait | P1 |
| [044](044-simulateur-gestes-chassis.md) | Simulateur iOS : gestes à la souris, châssis, flux fluide | fait | P2 |
| [045](045-commandes-personnelles.md) | Commandes « / » personnelles et du projet | fait | P2 |
| [046](046-recherche-memoire.md) | Recherche dans le contenu sans charger tous les fils en mémoire | fait | P1 |
| [047](047-outils-regroupes.md) | Outils regroupés, titres lisibles, fil long fluide | fait | P1 |
| [048](048-sonde-bob.md) | Sonde du contrat ACP de Bob (`pnpm bob-probe`) | fait | P2 |
| [049](049-barre-titre-sans-git.md) | Barre de titre allégée, branche dans la zone de saisie, vue Git retirée | fait | P1 |
| [050](050-finitions-interface.md) | Finitions : fil, défilement, barre latérale | fait | P2 |
| [051](051-recherche-reglages.md) | Recherche dans les réglages | fait | P2 |
| [052](052-liens-fichiers.md) | Liens vers des fichiers : aperçu `.md`, app par défaut | fait | P1 |
| [053](053-sous-agents-vivants.md) | Sous-agents vivants : durée, coût en direct (Bob), travail rejoué (OpenCode) | fait | P2 |
| [054](054-capacites-agents.md) | Ce que Bob Desktop sait faire avec chaque agent | fait | P1 |
| [055](055-reprendre-sessions.md) | Reprendre les sessions commencées ailleurs (`bob chat`, OpenCode) | fait | P1 |
| [056](056-regles-actives.md) | Règles actives de la conversation | fait | P2 |
| [057](057-mentions-git-terminal.md) | Mentions `@git-changes` et `@terminal` | fait | P2 |
| [058](058-installation.md) | Installation : agents installés, proxy, quarantaine | fait | P1 |
| [059](059-dmg-github.md) | `.dmg` construit par GitHub à chaque version | fait | P2 |
| [060](060-mcp-tester.md) | Statut des serveurs MCP : « Tester » | fait | P1 |
| [061](061-diagnostic.md) | Diagnostic dans l'app | fait | P1 |
| [062](062-fenetre-rapide.md) | Fenêtre rapide (⌥⌘B) et capture d'écran | fait | P2 |
| [063](063-diagrammes-mermaid.md) | Diagrammes Mermaid dans le fil | fait | P2 |
| [064](064-apercu-html.md) | Aperçu des pages HTML dans le navigateur intégré | fait | P2 |
| [065](065-installation-hors-ligne.md) | Installation hors ligne : Electron et AXe déjà sur la machine | fait | P1 |
| [066](066-joindre-page-ecran.md) | Joindre la page ou l'écran au message | fait | P2 |
| [067](067-annoter-capture.md) | Annoter une image avant de l'envoyer | fait | P2 |
| [068](068-son-action-attendue.md) | Son quand un agent attend une action | fait | P2 |
| [069](069-nom-bobine.md) | Nouveau nom : Bobine, et sa nouvelle icône | fait | P2 |
| [070](070-style-des-reponses.md) | Style des réponses : police de l'app, titres et traits sobres | fait | P2 |
| [071](071-audit-15-octobre-lot-1.md) | Audit du 15 octobre, lot 1 : historique repris, autorisations exactes, ouverture protégée | fait | P1 |
| [072](072-navigateur-autorisations-comme-claude.md) | Navigateur et autorisations comme Claude Code : popups, sites et commandes retenus, données du navigateur | fait | P1 |
| [073](073-nouveautes-installation.md) | Nouveautés dans « À propos », .dmg illustré, installation par l'app elle-même | fait | P2 |
| [074](074-interface-en-anglais.md) | L'app en anglais : choix de la langue | fait | P2 |
| [075](075-planche-contact.md) | Planche contact : ce qui se passe pendant un geste, en une image | fait | P2 |
| [076](076-planche-contact-android.md) | Planche contact sur l'émulateur Android | fait | P2 |
| [077](077-taches-epinglees.md) | Liste de tâches épinglée au-dessus de la zone de saisie pendant le tour | fait | P2 |
| [078](078-opencode-2.md) | OpenCode 2 : compatibilité, travail des sous-agents sous leur carte, sonde de suivi (`pnpm opencode-probe`) | fait | P1 |
| [079](079-outils-execute.md) | Outils de l'app appelés par du code (`execute` d'OpenCode 2) | fait | P1 |
| [080](080-journal-reglable.md) | Journal réglable, assez fourni pour déboguer sans sonde | fait | P1 |
| [081](081-cadre-android.md) | Émulateur Android : un vrai cadre d'appareil (téléphone, tablette, paysage), gestes à la souris | fait | P2 |
| [082](082-panneau-agrandi-onglets.md) | Panneau de droite : agrandi à la place de la conversation, onglets nommés pour les outils qui servent | fait | P2 |
| [083](083-rotation-appareils.md) | Tourner le simulateur iOS et l'émulateur Android (essai fait, reporté) | reporté | P3 |
| [084](084-zoom-appareils.md) | Zoom du simulateur iOS et de l'émulateur Android : dézoomer, ajuster, taille réelle, zoomer | fait | P2 |
| [085](085-commentaires-diff.md) | Commenter les modifications ligne par ligne et envoyer les remarques à l'agent | fait | P2 |
| [086](086-recherche-dans-le-fil.md) | Chercher dans la conversation ouverte (⌘F) | fait | P2 |
| [087](087-utilitaires-en-commun.md) | Utilitaires en commun : arguments des outils, attentes, dossiers, messages d'erreur (refactorisation) ; erreurs affichées sans préfixe technique | fait | P2 |
| [088](088-generique-d-abord.md) | Générique d'abord : plus de « si c'est Bob » hors des profils (adaptateurs d'agent) | fait | — |
| [089](089-decoupage-gros-fichiers.md) | Découper les plus gros fichiers : conversations, hôte de l'agent, démarrage, `App`, zone de saisie, réglages | fait | P2 |
| [090](090-puce-modele.md) | Puce du modèle dans la barre de saisie, à droite avant l'agent (réglage ACP de catégorie `model`) | fait | P2 |
| [091](091-quota-bob.md) | Quota de bobcoins de Bob, lu par `/status` de Bob Shell au démarrage, sans session vide laissée | fait | P1 |
| [092](092-zone-de-saisie.md) | Zone de saisie : texte perdu après un menu, dossier et branche sous la saisie, barre qui se replie, menu des modèles avec recherche | fait | P1 |
| [093](093-demarrage.md) | Démarrage : dossier choisi avant tout agent, bouton « Faire confiance », fenêtre retrouvée, menu Fenêtre traduit | fait | P1 |
| [094](094-navigateur-et-images.md) | Navigateur et images : téléchargements par « Enregistrer sous », page reprise dans une branche, « Page jointe », annotation repliée | fait | P1 |
| [095](095-liste-et-fil.md) | Liste des conversations figée sous le pointeur, branches sous leur original, chronomètre du tour, remarques du plan | fait | P1 |
| [096](096-rejeu-opencode.md) | Rejeu d'OpenCode : diffs perdus refaits depuis le patch de l'outil ; branche `bobine/…` des worktrees ; libellé des réglages en entier | fait | P1 |
| [097](097-conversations-filles.md) | Conversations filles : « Lancer en parallèle… », compte rendu à la mère, puis outils pour que l'agent lance et suive ses filles | fait | P2 |
| [098](098-mode-plan-visible.md) | Mode Plan visible : la zone de saisie prend la couleur du mode Plan, pastille et rappel | fait | P2 |
| [099](099-outils-bobine-visibles.md) | Les outils de Bobine visibles : onglet « Bobine » dans Réglages › Serveurs MCP, ligne « bobine · intégré » dans le menu ⚙ | fait | P2 |
| [100](100-trousseau-a-la-demande.md) | Le trousseau seulement quand il sert : plus de mot de passe au lancement sans clé d'API | fait | P1 |
| [101](101-rebond-du-dock.md) | Le Dock rebondit quand une conversation a fini ou attend l'utilisateur (sans certificat) | fait | P1 |
| [102](102-conversations-gardees-actives.md) | Réglage du nombre de conversations gardées actives (agents vivants), mémoire mesurée | fait | P1 |
| [103](103-fil-durable.md) | Bobine garde son propre fil : mise en veille et redémarrage sans perte (ADR) | fait | P1 |
| [104](104-fournisseurs-opencode.md) | Fournisseurs de modèles d'OpenCode depuis les réglages (modèles internes, proxy, certificats) | fait | P1 |
| [105](105-depot-public.md) | Dépôt public : licence, README anglais, CI sur PR, contribution, « Signaler un problème » | fait | P1 |
| [106](106-e2e-deterministes.md) | Essais de bout en bout déterministes | fait | P1 |
| [107](107-cartes-outils-lisibles.md) | Cartes d'outils de l'agent lisibles : « Lecture de src/books.js », « Recherche « TODO » », chemins relatifs au dossier | fait | P1 |
| [110](110-cycle-worktrees.md) | Cycle complet des worktrees : départ explicite, commit, PR, fusion assistée, nettoyage — sans terminal | fait | P1 |
| [111](111-signature-mise-a-jour.md) | Signature Developer ID et notarisation prêtes sans compte Apple (secrets à poser) ; mise à jour automatique écartée (ADR-0023) | fait (signature réelle à brancher avec le compte Apple) | P1 |
| [109](109-cout-visible.md) | Coût visible et pilotable : coût par conversation dans la liste et l'en-tête, poids des outils de Bobine, familles désactivables | fait | P1 |
| [108](108-continuer-autre-agent.md) | Continuer une conversation avec l'autre agent (Bob ↔ OpenCode) : contexte transmis, modèles mis en avant, destination des données affichée | fait | P1 |
| [112](112-cartes-propositions-filles.md) | Carte de propositions de conversations filles : groupée par tour, « Faire ici », agent et modèle au choix | fait | P2 |
| [113](113-interface-allegee.md) | Interface allégée : coût en un seul endroit (puce de consommation), barre latérale réglable en largeur | fait | P2 |
| [114](114-durcissement-apercu-ipc.md) | Durcissement : aperçu HTML cloisonné par dossier, lien vers fichier caché refusé, émetteur IPC vérifié | fait | P1 |
| [115](115-e2e-plus-courts.md) | Essais de bout en bout plus courts : suites en parallèle (`--jobs`), seulement celles touchées (`--changed`), rien à rejouer si déjà vert (`--if-needed`) | fait | P1 |
| [117](117-fil-sous-agents-filles-depart.md) | Fil : carte « Sous-agents » (sous-agents d'un tour ensemble), coût des filles sur leurs cartes, départ du worktree en une carte | fait | P2 |
| [116](116-fenetre-a-propos.md) | Fenêtre « À propos de Bobine » sobre : version et date, Nouveautés, Signaler un problème, infos techniques à copier | fait | P2 |
| [118](118-filles-proposees.md) | Conversations filles proposées par l'agent sans qu'on le lui dise : contexte de session, réglage, commande `/split` | fait | P1 |
| [119](119-boite-de-reception.md) | « À traiter » en tête de la barre latérale, compteur sur l'icône du Dock, bannières groupées | fait | P1 |
| [120](120-fusionner-toutes-les-filles.md) | Fusionner toutes les filles finies depuis la carte « Sous-tâches », l'une après l'autre, conflits résolus par la fille | fait | P1 |
| [121](121-relance-apres-panne-rejeu.md) | Relance après panne : un message attend le rejeu tardif de `session/load`, réconcilié comme au ⌘Q (D21) | fait | P1 |
| [122](122-etats-des-cartes.md) | L'état d'une carte dit vrai : « refusé » et « échec » à part entière, sous-agent en arrière-plan suivi jusqu'à sa vraie fin | fait | P1 |
| [123](123-fusion-explicite-committer.md) | Fusion refusée expliquée (dossier principal non commité : fichiers, « Committer d'abord », « Mettre de côté »), erreurs de git en entier, « Committer » hors worktree | fait | P1 |
| [124](124-capture-indisponible-boutons-stables.md) | Capture d'écran impossible dite (autorisation de macOS), boutons du plan et lignes des propositions qui ne glissent plus sous le pointeur | fait | P1 |
| [125](125-barre-laterale-a-traiter.md) | Barre latérale : une grille, « À traiter » sobre (gras = non lu, icône = raison, temps à droite), titres d'outils et de conversations sans chemins absolus ni préambule de Bobine, branche distinguable | fait | P1 |
| [126](126-finitions-campagne-octobre.md) | Finitions de la campagne de recette d'octobre : `/context` et `/cost` titrés, carte interrompue, pager, mentions `@`, infobulles, confirmation dans la ligne, textes, interrupteurs accessibles | fait | P1 |
| [127](127-sous-agents-figes-fil-et-plan.md) | Sous-agent en arrière-plan fini même si l'on continue la conversation (D25), fil ramené en bas à l'envoi (D26), barre du plan immobile à l'ajout d'une remarque (D27) | fait | P1 |
| [128](128-activite-lisible-serif-c14.md) | Activité lisible pendant un tour (outil en préparation, chronomètre de l'étape, JSON indenté), « Sans serif » / « Serif », message de commit coupé au mot (C14) | fait | P2 |
| [130](130-journal-consommation.md) | Journal de consommation : une ligne par tour dans `usage.sqlite` (agent, modèle, projet, jetons, coût avec son unité), gardée après suppression ou changement d'agent | fait | P1 |
| [131](131-barre-laterale-sections-dossiers.md) | Barre latérale : quatre sections repliables, zone du haut fixe, dossier = projet, titres au bord, filles reliées à leur mère par un trait, branches à plat | fait | P1 |
| [129](129-navigateur-defilement-zoom.md) | Navigateur : la page défile, suit la colonne et le panneau agrandi, zoom propre à la page (⌘+, puce « 110 % »), raccourcis de la page, `browser_resize` réduit pour tenir et annulé à la fin du tour | fait | P1 |
| [134](134-jetons-de-theme-contrastes.md) | Jetons de thème en source unique (`shared/themes.ts`), code, sortie de commande, terminal et Mermaid qui suivent la palette et l'accent, contrastes AA vérifiés par un test | fait | P2 |
| [132](132-annoter-la-page.md) | Annoter la page au clic, façon Figma : page figée, épingles numérotées et bulles, un message à l'agent (image annotée, élément sous chaque clic) | fait | P1 |
| [135](135-onglet-echanges-acp.md) | Onglet « Échanges ACP » du panneau : messages JSON-RPC bruts de la conversation en direct, JSON déplié, morceaux regroupés, filtre, pause, copie NDJSON ; en mémoire, secrets masqués | fait | P2 |
| [133](133-reglages-corrections-journal.md) | Réglages : « Relire le PATH » et la version retirés des doublons, notifications cohérentes, aides courtes, liste non coupée ; le journal (`main.log`, `agents.log`, Finder, niveau) en carte en tête du Diagnostic | fait | P2 |
| [136](136-reglages-groupes-apparence-agents.md) | Réglages en trois groupes (12 onglets), gabarit en cartes, page Apparence (thèmes clair et sombre, six accents et « Comme le Mac », polices installées), une page par agent | fait | P2 |
| [137](137-tableau-consommation.md) | Réglages › Consommation : période et agent, quatre chiffres clés (coût par unité), graphique par jour en SVG (barres empilées par agent ou modèle), par modèle, par projet, conversations, quota et dépense sur ce Mac, export CSV, « Remettre à zéro… », reprise depuis les fils | fait | P2 |
| [138](138-processus-et-git.md) | Processus et git : SIGKILL après 3 s, registre `agents.pids` nettoyé au démarrage, file git par dépôt (relance sur `index.lock`), permissions de la session par défaut | fait | P2 |
| [139](139-contrat-acp-testable.md) | Contrat ACP testable : grille de conformité (trois personas d'agent factice × douze parcours, quatre invariants), traces ACP nettoyées rejouées (trois reconstituées), scénarios factices aux limites ; deux défauts corrigés | fait | P1 |
| [140](140-independance-aux-agents.md) | Indépendance aux agents : sous-agents, règles, serveurs MCP et fournisseurs lus par des adaptateurs du profil, `_meta` de Claude et de Codex retirés, ESLint contre `'bob'` / `'opencode'` hors des modules d'agent, version vérifiée signalée par le Diagnostic | fait | P2 |
| [141](141-agent-acp-personnalise.md) | Agent ACP personnalisé : commande, arguments, variables d'environnement déclarés dans Réglages › Agents, sans code ; session neuve avec l'échange d'avant pour un agent qui ne sait pas reprendre (ADR-0030) | fait | P2 |
| [142](142-pannes-reseau-reconnexion.md) | Pannes réseau et limite de débit (429) reconnues, bandeau court dans le fil, reconnexion automatique (5 tentatives : 2, 4, 8, 16, 32 s), tout de suite au retour du réseau ou au réveil du Mac, puis « Réessayer » | fait | P1 |
| [143](143-montee-dependances-electron-45.md) | Montée des dépendances : Electron 45 (clés d'API par le `safeStorage` asynchrone), electron-vite 6 / Vite 8, Mermaid 12 ; SDK ACP 2 écarté ; OpenCode, AXe et Bob comparés à leur dernière version | fait | P2 |
| [144](144-mon-activite.md) | Mon activité : le tableau de consommation devient une page de la fenêtre principale (grille d'activité sur un an, semaine, mois, année ou jour, écart à la période précédente), responsive | fait | P2 |
| [145](145-preversion-linux.md) | Préversion Linux (sans simulateur iOS) : AppImage et `.deb`, capacités de la plateforme masquant ce qui est propre au Mac, barre de titre et menu Linux, intégration au bureau (polices, terminal, sons, trousseau), e2e sous `xvfb` ; Ubuntu 24.04 GNOME, x64 et arm64, avec une version ultérieure du Mac (après la 0.6.0) | en cours (expérimental dans `main`) | P2 |
| [146](146-annoter-page-vivante.md) | Annoter une page vivante : en mode Annoter, la page défile et zoome ; le clic pose la remarque, épingles dessinées dans la page et accrochées à leur élément, une capture par écran annoté | fait | P1 |
| [147](147-activite-comparable.md) | Mon activité comparable : mesure « Temps », une mesure partielle dit qui elle couvre (jetons, coût dans une unité), chiffres comparables en tête, carte de l'agent selon le filtre | fait | P2 |
| [148](148-recommencer-a-neuf.md) | Recommencer à neuf : profil temporaire (« Essayer Bobine comme neuve », agents comme sur un Mac neuf) et réinitialisation façon désinstalleur (corbeille datée, trousseau, relance ou désinstallation) | fait | P2 |
| [149](149-barre-laterale-familles-attention.md) | Familles stables sans « À traiter », filles visibles dès le lancement, états et forks par icônes, carte alignée, infobulle unique | fait | P2 |
| [150](150-consignes-conversations-filles.md) | Consignes initiales et reprises des filles consultables, repliées dans le fil de la mère | fait | P2 |
| [151](151-validation-livraison-familles.md) | Résoudre les contrôles e2e restants, valider le lot familles / consignes et le pousser | fait | P2 |
| [152](152-version-0-6-macos.md) | Version 0.6.0 macOS : notes consolidées, validation, DMG publié et recette du livrable ; Linux différé | fait | P2 |
| [153](153-dmg-outils-macos.md) | DMG simple construit avec les outils de macOS, sans téléchargement de l’auxiliaire dmg-builder ; app, signature et installation préservées | fait | P2 |
| [154](154-defauts-clic-droit-liens-onglets.md) | Trois défauts : menu du clic droit réduit à l'essentiel (orthographe, copier / coller), liens `localhost` dans le navigateur intégré, onglets du panneau dans l'ordre d'arrivée | fait | P2 |
| [155](155-saisie-colle-brouillons-exclusions.md) | Zone de saisie : long texte collé en pièce jointe (aperçu, remis dans la saisie), brouillon avec ses pièces jointes (redémarrage compris, borné), fichiers d’exclusion de l’agent (`.bobignore`…) respectés par les mentions `@`, `@git-changes` et les pièces jointes | fait | P1 |
| [156](156-fil-duree-images-editeur-reprise.md) | Fil : durée du tour, copier un message envoyé, images en grand glissables vers le Finder, « Ouvrir dans <éditeur> » à la ligne, carte « Où en était-on ? » à la reprise | fait | P2 |
| [157](157-commande-bloquee-contexte-plafond.md) | Pendant le tour : commande sans sortie signalée (« Interrompre »), contexte presque plein avec « Compacter » en un clic, plafond de coût par conversation (carte « Continuer » / « Arrêter ») | fait | P2 |
| [158](158-menu-dossier-commande-bobine.md) | Menu du dossier (Finder, chemin, terminal de Bobine) et commande `bobine <dossier> ["message"]` du terminal, installée depuis les Réglages | fait | P2 |
| [159](159-densite-compacte-mode-presentation.md) | Densité compacte (jetons de thème) et mode présentation (texte agrandi, `~`, coûts masqués, silence) | fait | P2 |
| [160](160-filles-pilotees-tech-lead.md) | Filles pilotées comme les sessions de Claude Desktop : agent et modèle choisis par la mère, compte rendu borné, recommandation de fusion, fusion par l'utilisateur | fait | P2 |
| [161](161-vue-filles-modifications.md) | Vue « Filles » de l'onglet Modifications d'une mère : worktrees de ses filles directes (état, branche, compte rendu, recommandation), Finder, éditeur, conversation | fait | P2 |
| [162](162-version-0-7-macos.md) | Version 0.7.0 macOS : version et notes datées, suite complète, DMG publié et recette du livrable | fait | P2 |
| [163](163-compatibilite-bob-2-0-9.md) | Compatibilité Bob 2.0.9 : licence par formulaire au premier message, dossier « Don't trust » seul refusé, mode de départ par `bob/mode`, sonde et acp.md | fait | P1 |
| [164](164-cout-conversation-toutes-sessions.md) | Coût d'une conversation : toutes ses sessions (session perdue, purge de Bob, autre agent), plafond compris | fait | P2 |
| [165](165-indices-outils-compact-journal-bob.md) | Indices des outils MCP (lecture seule, sans effet hors de l'app), `/compact` pour Bob, journal détaillé de Bob en mode Trace | fait | P3 |
| [166](166-onglet-session.md) | Onglet « Session » du panneau : environnement, contexte estimé par catégorie (sans coût), ligne des modifications, ce qui tourne (durée, arrêt), ouvert d'office | fait | P2 |
| [167](167-invite-coupee-factice-en.md) | Invite de la zone de saisie entière en conversation étroite ; agent factice dans la langue des essais (`--lang en`) | fait | P2 |
| [168](168-theme-fjord.md) | Thème Fjord, clair et sombre : gris bleutés calmes, six accents, contrastes AA testés ; le thème par défaut ne change pas | fait | P3 |
| [169](169-deps-lot-a-electron-45-2.md) | Dépendances, lot A : Electron 45.2.3 (correctifs de sécurité de Chromium), patchs et outillage (ESLint, Vitest, plugin React, lucide) | fait | P2 |
| [170](170-action-principale-et-rayons.md) | Une seule règle pour l'action principale (accent plein, contour, texte seul), Arrêter et Envoyer désactivé neutres, jetons de rayon `--radius-*` et garde-fou | fait | P1 |
| [171](171-comptes-rendus-filles-replies.md) | Comptes rendus de filles repliés sur deux lignes (titre, coût, première phrase), dépliables ; filet de 2 px, fondu seulement si l'extrait est coupé, « rien modifié » | fait | P2 |
| [172](172-deps-lot-b-mermaid-i18next.md) | Dépendances, lot B : Mermaid 12.3, i18next 26.7 (avertissements de la v27 relevés) ; `/goal` d'OpenCode 2.2.5 documentée | fait | P2 |
| [173](173-defilement-horizontal-sommaire.md) | Fil sans défilement horizontal (mots, liens, chemins coupés ; code, diff, tableau, terminal dans leur cadre) et sommaire borné sur une longue conversation (un trait pour plusieurs messages) | fait | P2 |
| [174](174-version-0-8-macos.md) | Version 0.8.0 macOS : version et notes datées, sonde de Bob 2.0.9, trousseau réel dans l'app packagée, suites complètes (fr, en), DMG publié et recette du livrable | fait | P2 |
| [175](175-preparation-worktrees.md) | Préparation des worktrees : fichiers ignorés listés par `.worktreeinclude` copiés, commande `setup` du projet (autorisée une fois par dépôt) visible dans le fil, `archive` à la suppression | fait | P2 |
| [176](176-suivi-pr-ci.md) | Suivi de la PR et de la CI dans la conversation : contrôles, commentaires, conflits ; « Corriger les contrôles en échec » par l'agent ; fusion quand tout est vert (au choix) | fait | P1 |
| [177](177-faire-relire.md) | Faire relire avant de fusionner : une fille relectrice (agent et modèle à confirmer) rend ses remarques par `report_findings`, posées sur les lignes du diff de l'auteur et renvoyables comme les autres | fait | P1 |
| [178](178-taches-planifiees.md) | Tâches planifiées locales : consigne + dossier + agent + fréquence, lancées par Bobine ouverte ; plafond par tâche, pas de chevauchement, un rattrapage au plus | fait | P2 |
| [179](179-plusieurs-dossiers.md) | Plusieurs dossiers par conversation : autres dossiers ajoutés dans l'onglet Session, envoyés à l'agent (`additionalDirectories`) s'il les annonce | fait | P2 |
| [180](180-aparte.md) | Aparté : une question à côté (`/btw`, ⇧⌘A) dans une session neuve et courte du même agent, hors du fil ; lecture seule, coût compté, « Ajouter au fil » | fait | P2 |
| [181](181-sdk-acp-2.md) | SDK ACP 2.4 (entrée `unstable`) derrière un seul module `shared/acp-sdk.mts`, montée en un commit réversible ; suite e2e `filles` tracée sous charge | fait | P2 |
| [182](182-memoire-commune.md) | Mémoire commune aux agents, sur le modèle de Claude Code : souvenirs retenus par un outil de l'app, index donné à chaque conversation, écran pour lire et supprimer, désactivable dans les réglages ; fait (sauf prompt système), ADR-0040 proposé | fait | P3 |
| [183](183-recette-0-9.md) | Recette de la 0.9 par un rôle QA : exploratoire dans l'app construite, interactions des nouveautés, vrai OpenCode borné, régression, montée depuis la 0.8 ; rapport des défauts | fait | P1 |
| [184](184-version-0-9-macos.md) | Version 0.9.0 macOS : recette QA sans rien de bloquant, version et notes datées, sondes sur SDK 2.4, suite complète, DMG publié et recette du livrable | fait | P2 |
| [185](185-finitions-ux-0-9-1.md) | Finitions UX de la 0.9.1 : encarts des réglages (U1), passe d'audit complète (clair / sombre, fr / en, 900 px, zoom 150 %), défauts classés et corrigés par lots | en cours | P2 |
| [186](186-aide-integree.md) | Aide intégrée : guide Markdown fr/en dans le dépôt (lisible sur GitHub) embarqué dans l'app, recherche hors ligne, liens « ? » contextuels, raccourcis générés | fait | P2 |
| [187](187-robustesse-v1.md) | Robustesse pour une V1 distribuable : registre des risques mesuré (pannes, données, compatibilité, performance, sécurité, distribution), matrice de compatibilité, barre de qualité 1.0, lots A à H | en cours | P1 |
| [188](188-premier-lancement.md) | Premier lancement soigné : choisir et connecter un agent, vérifier qu'il répond, choisir un dossier, suggestions de départ ; erreurs claires | fait | P1 |
| [189](189-gitlab-auto-heberge.md) | GitLab auto-hébergé : adaptateur de forge (GitHub par `gh`, GitLab par `glab`), « Ouvrir une MR » sur n'importe quel hôte GitLab, erreurs claires ; essais contre un GitLab CE dans Docker | fait | P1 |
| [190](190-version-0-9-1-macos.md) | Version 0.9.1 macOS : corrections et finitions (réinitialisation, carte de PR, connexion expirée, git, interface), suite complète, DMG publié et recette du livrable | fait | P2 |
| [191](191-astuces.md) | Astuces de Bobine : au plus une par jour, au bon moment (aparté pendant un tour, contexte presque plein, gros changement à faire relire, message répété à planifier), « Ne plus montrer », réglage qui les coupe | fait | P2 |
| [192](192-gros-contenus.md) | Gros contenus : diffs d'agent bornés, détail des outils rendu au dépliage, coloration sans redeviner le langage à chaque morceau, cache des totaux ; plafond d'affichage et « Afficher tout » ; suite e2e `perf` (lot D de la 187) | fait | P1 |
| [193](193-longs-fils.md) | Longs fils : ouverture par la fin (les précédents se rendent en remontant), une écriture du fil à la fois ; sommaire, recherche et « Aller en bas » intacts (lot E de la 187) | fait | P1 |
| [194](194-filets-et-rapports.md) | Pannes visibles (1/2) : bandeau d'un agent silencieux, filets d'erreur par élément du fil, panneau et page de réglages, avis d'erreur interne, rapport local de plantage sans envoi, dialogue après trois plantages de l'interface | fait | P1 |
| [195](195-processus-et-mcp.md) | Pannes visibles (2/2) : aucun processus restant en quittant, compilations et flux suivis, serveur d'outils borné (abandon, budget, avis), git absent dit clairement, nouvelles pannes de l'agent factice | fait | P1 |
| [196](196-profil-versions-corbeille.md) | Profil : version du format (lecture seule si plus récent), champs inconnus gardés, corbeille des conversations, temporaires nettoyés, avis des réglages abîmés (lot G de la fiche 187) | fait (en relecture) | P1 |
| [197](197-profil-reconstruction-disque-plein-sauvegarde.md) | Profil : liste refaite à partir des fils, disque plein dit et rattrapé, sauvegarde complète et restauration réversible (lot G de la fiche 187) | fait (en relecture) | P1 |
| [198](198-suivi-versions-agents.md) | Suivi des versions des agents (lot F de la 187) : avis une fois pour une version plus récente ou plus ancienne que celles essayées, protocole ACP vérifié, sonde OpenCode hebdomadaire en CI, liste « nouvelle version de Bob » | fait | P1 |
| [199](199-version-0-11-macos.md) | Version 0.11.0 macOS : 0.10 et 0.11 réunies (aide, astuces, premier lancement, mémoire, GitLab, gros contenus, pannes visibles, versions des agents, intégrité du profil), recettes réelles avec Bob et OpenCode, DMG publié | fait | P2 |
| [200](200-bob-connexion-expiree-au-message.md) | Bob : connexion expirée au message reconnue (`-32603` « Invalid or expired API key », relevé sur 2.0.9) → carte « Connexion expirée » avec SSO et clé d'API, message renvoyé une fois | fait | P1 |
| [201](201-icones-terminal.md) | Icônes des invites dans le terminal : « MesloLGS Nerd Font » livrée avec l'app, en secours des seuls caractères absents ; icônes entières (une cellule d'avance, débord sur l'espace suivant), chargée avant la première mesure de xterm.js | fait | P2 |
| [202](202-opencode-fichiers-crees.md) | OpenCode : fichiers créés par `write` comptés dans Modifications › Conversation (fin sans diff), diff de la demande d'autorisation gardé pour tout agent ; contrat réel relevé (traces 2.2.5) et agent factice aligné | fait | P1 |
| [203](203-cartes-autorisation-lisibles.md) | Cartes d'autorisation lisibles : chemin du fichier relatif, coupé par le début, nom entier ; « Création de notes.md » (diff `oldText` nul) ; dossier de la commande dit une fois (« Dans projet », sous-dossier relatif, hors du dossier en entier), « Copier » en haut à droite | fait | P1 |
| [204](204-version-0-11-1-macos.md) | Version 0.11.1 macOS : connexion de Bob expirée en conversation, icônes du terminal, « En cours » limité aux commandes, créations d'OpenCode et de Bob dans Modifications et sur les cartes, cartes d'autorisation lisibles | fait | P2 |
| [205](205-quota-relu-et-sso-traduit.md) | Recette 0.11.1 : plafond de Bobcoins relu quand l'agent se montre prêt après un échec de lecture ; méthodes de connexion libellées par le profil (« Se connecter par SSO ») | fait | P1 |
| [206](206-session-longue-utilisateur.md) | Session longue : Claude en utilisateur final de Bobine sur un vrai projet (pilote moins cher, juge Opus, computer use pour les fenêtres macOS), conversation longue avec tâches filles, MCP, commandes, mémoire, panneaux et mobile | en cours (pilote fait) | P2 |
| [207](207-recette-0-11-1-sso-trousseau-modifications.md) | Recette 0.11.1 : attente du SSO avec une sortie (« Connecté dans le navigateur, mais rien ne se passe ici ? » + Réessayer), enregistrement d'une clé d'API jamais silencieux (trousseau macOS attendu, 60 s au plus), Modifications de l'onglet Session en deux lignes (Conversation / Dossier) | fait | P1 |
| [208](208-rien-ne-survit-en-quittant.md) | Rien ne survit à l'app en quittant : essai du diagnostic (ou liste, suppression de sessions, sonde MCP) en cours arrêté avec elle, lecture du quota fermée ; e2e : plus de dossier de données « ENOTEMPTY », survivants nommés | fait | P1 |
| [209](209-limite-etapes-agent.md) | Limite d'étapes de l'agent (`max_turn_requests`) : carte « Continuer » ; refus sans rien faire (limite comptée sur la session, Bob 2.0.9) : « Rouvrir la session et continuer » ou « Nouvelle session avec le résumé » ; la file attend l'utilisateur | fait | P1 |
| [210](210-modele-refuse-et-reessayer.md) | Modèle refusé faute de connexion : la carte nomme le modèle, « Choisir un autre modèle » renvoie le message une fois, modèle marqué « connexion à faire » dans le sélecteur ; l'icône « Réessayer » du message (branche) masquée sous la carte ; pilote : libellé ambigu refusé | fait | P1 |
| [211](211-autorisation-a-risque.md) | Cartes d'autorisation à risque : bandeau ambré quand une commande ou une modification écrit hors du dossier, dans un fichier caché du dossier personnel ou du système, ou demande `sudo` (calculé dans le main, aussi pour Bob qui n'envoie que la commande) ; pas de « Toujours autoriser » sur ces cartes ; note « c'est l'agent qui décide ce que couvre « toujours » » | fait | P1 |
| [212](212-version-0-11-2-macos.md) | Version 0.11.2 macOS : plafond de bobcoins et SSO, pilote en texte, limite d'étapes, modèle refusé, cartes d'autorisation à risque | fait | P2 |
| [213](213-approbations-comme-bob.md) | Approbations au niveau de Bob IDE et Bob Shell : sélecteur « Autorisations » par conversation, « Tout approuver » non enregistré, règles globales de Bob écrites comme Bob IDE, réponses automatiques tracées ; essais sur le vrai Bob d'abord | à faire | P1 |
| [214](214-corrections-cartes-autorisation.md) | Corrections des cartes d'autorisation (étape 1 de 213) : carte fantôme sur `$/cancel_request`, liste de tâches lue, titre traduit, chemin court, agent par défaut | fait | P1 |
| [215](215-regles-d-approbation-de-bob.md) | Règles d’approbation de Bob (`~/.bob/settings/settings.json`, section `approval`) lues et écrites comme Bob IDE : commandes autorisées / refusées partout (liste par défaut recopiée), groupes, hors du dossier ; écriture atomique, sauvegarde, jamais `forbiddenApprovalGroups` ; « Pour tous les projets » sur les cartes de commande (parties d'une commande enchaînée), Réglages › Agents › IBM Bob › Approbations | en cours | P1 |
| [216](216-nettoyage-avant-publication.md) | Nettoyage avant publication : API privée et détails internes de Bob retirés de la doc (comportement observé seulement), sonde sans inspection du paquet de Bob, contexte professionnel neutralisé, chemins et liens privés retirés ; « Projet indépendant, non affilié à IBM » dans À propos | fait | P1 |
| [217](217-licences-dans-l-app.md) | Textes de licence livrés avec l'app (`Resources/licenses`) : avis tiers générés d'après ce que le build embarque (`pnpm third-party-notices`), doubles licences choisies (elkjs EPL-2.0, dompurify Apache-2.0), Electron et Chromium, police ; contrôle de dérive (verify, e2e, packaging) ; `copyright`, `author`, `homepage`, `bugs` | fait | P1 |
| [218](218-publication-preversion.md) | Publier une préversion (1.0.0-beta.1) depuis un dépôt public : titres `X.Y.Z-beta.N — date` dans Nouveautés, Release « préversion », Info.plist numérique, ordre semver de la marque du profil ; `release.yml` en lecture sauf `publish`, tag sur `main` exigé, actions épinglées par SHA, Dependabot, gitleaks en CI | fait | P1 |
| [219](219-readme-public.md) | README public en anglais pour la bêta 1.0.0-beta.1 : bêta, Gatekeeper sans notarisation, prérequis, non-affiliation (IBM, OpenCode, Anthropic) ; installation et CONTRIBUTING alignés ; description et topics du dépôt proposés | fait | P1 |
| [220](220-version-1-0-0-beta-1.md) | Version 1.0.0-beta.1, bêta publique : notes de Release en anglais puis en français, version et notes datées du 10 novembre 2026 ; dépôt public, tag et Release préversion par le tech lead | fait | P1 |
| [221](221-i18next-27.md) | i18next 27 et react-i18next 18 : clés sans variables typées `ParseKeysWithoutVariables` (vérification stricte des variables par défaut), changements de comportement relus, avis de licence régénérés | fait | P2 |
| [222](222-jsdom-31.md) | jsdom 31 (essais seulement) : les échecs de la PR Dependabot venaient de son verrou (`parse5-parser-stream@8.1.0` servi avec `parse5@8.0.1`, sans `flushCharacters`), pas de jsdom ni du pilote ; verrou régénéré, aucun code changé | fait | P2 |
| [223](223-roles.md) | Rôles : agents spécialisés créés une fois et invoqués par `@rôle` ou par l'agent (`start_child` + `role`), visibles au travail ; filles lancées sans insister | en cours (phases 1 et 2 faites) | P2 |

**Périmètre** : les fonctionnalités clés de Claude Desktop / Codex autour de l'agent. Bobine
n'est **pas un IDE** : pas d'éditeur de fichiers, pas d'explorateur de projet. Seule exception
(décision du 2026-10-14, fiche 052) : l'aperçu en lecture seule des `.md` que la conversation cite.

Priorités (modèle : l'expérience Claude Code Desktop, centrée sur Bob) : **P1** = cœur de
l'expérience, dans l'ordre indiqué ; **P2** = confort et finition ; **P3** = plus tard ou limité par
ce que Bob propose par ACP.
