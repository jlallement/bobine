# Bobine — documentation

Application de bureau dans l'esprit de Claude Desktop, pour travailler avec un agent de code
(IBM Bob en priorité) via le protocole **ACP**.

## Vision

- Une interface de conversation riche : streaming, images, fichiers, permissions, diffs, plan.
- Des **panneaux visuels** pilotés par l'agent : navigateur intégré, simulateur iOS, avec retour
  graphique en direct dans l'app.
- **Agnostique de l'agent** : Bob (`bob acp`) est la cible ; OpenCode (modèles gratuits) et
  l'agent factice servent aux essais, et tout agent ACP s'ajoute par un simple profil. Claude Code
  et Codex ne sont plus proposés (ils ont leur propre application) : on s'inspire de leurs
  fonctionnalités, sans cas particulier pour eux.

## Démarrer

Prérequis : macOS, Node.js ≥ 24, pnpm ≥ 12 (`brew install node pnpm` ; versions déclarées dans
`engines` et `packageManager` de `package.json`).

Facultatif, pour le simulateur iOS (fiche 008, ADR-0009) : Xcode. Les touchers, la lecture de
l'écran et la vidéo passent par [AXe](https://github.com/cameroncooke/AXe) : `pnpm fetch-axe`
extrait la version épinglée depuis son archive versionnée dans `vendor/archives/` (ADR-0010 ; SHA-256
et signature vérifiés) dans `vendor/axe/`, utilisée par `pnpm dev` et embarquée dans l'app
packagée. À défaut, l'app prend un `axe` du PATH
(`brew install cameroncooke/axe/axe`) s'il est au moins en version 1.8.0. Sans AXe, l'agent compile,
lance et capture, mais ne touche pas l'écran ; l'onglet « Simulateur » dit pourquoi.
`pnpm simulator-smoke` essaie le tout contre un simulateur créé pour l'occasion (`--keep` le
garde). Dans l'onglet « Simulateur », l'écran est dessiné dans son châssis : un clic est un
toucher, un glisser un balayage (changer de page, faire défiler), la molette un défilement ; le
flux vidéo lit l'image de l'appareil (30 images/s, débit affiché dans la barre) et retombe sur des
captures enchaînées si AXe ne sait pas la fournir.

Facultatif, pour l'émulateur Android (fiche 032) : le SDK Android d'Android Studio (trouvé dans
`~/Library/Android/sdk`, ou `ANDROID_HOME`). Rien d'autre à installer. Dans l'onglet « Android »,
l'écran est dessiné dans un téléphone ou une tablette (plus petit côté ≥ 600 dp) de la couleur
d'accent, tourné comme l'appareil (fiche 081) : un clic est un toucher, un appui long un toucher
tenu, un glisser un balayage, la molette un défilement ; les boutons de la tranche (marche/arrêt,
volume) se cliquent. Dans les deux onglets, les commandes (Accueil, Retour, Apps récentes,
verrouillage, joindre l'écran) sont dans une barre sous l'appareil, et le débit de la vidéo est
affiché à côté du nom (l'émulateur n'envoie une image que quand l'écran change). En haut des deux
onglets, le zoom (fiche 084) : dézoomer, ajuster au panneau (par défaut, à chaque ouverture),
taille réelle (un point de l'appareil pour un point de l'écran), zoomer, et le niveau. Zoomé,
l'appareil défile et la molette déplace la vue ; on fait défiler l'app en glissant.

```bash
pnpm install       # le binaire Electron se télécharge au premier lancement
pnpm dev           # app en mode développement (rechargement à chaud du renderer)
pnpm build         # bundles de production dans out/
./scripts/verify   # lint + format + typecheck + tests + cohérence de la doc
pnpm e2e           # essais de bout en bout de l'UI (après pnpm build), 3 suites en parallèle
pnpm e2e plan --dark   # une ou plusieurs suites, un thème (pnpm e2e --list)
pnpm e2e --changed     # les suites touchées par les fichiers modifiés depuis main (fiche 115)
pnpm e2e --if-needed   # avant un tag de version : la suite complète, sauf si déjà verte pour ce build
pnpm fetch-axe     # AXe (simulateur iOS) extrait dans vendor/axe, sans réseau (archive du dépôt) ;
                   # pnpm dev et pnpm preview le font d'eux-mêmes
pnpm package       # app installable : dist/mac-arm64/Bobine.app et dist/*.dmg
pnpm e2e:packaged  # essai de l'app construite (après pnpm package --dir)
```

**App installable** (fiche 012, ADR-0008) : `pnpm package` (ou `pnpm package --dir` pour la seule
`.app`), puis glisser `Bobine.app` du `.dmg` dans Applications. Elle partage l'historique et
les réglages de `pnpm dev`, retrouve `bob` et `opencode` par le PATH du shell de connexion,
embarque AXe (`Contents/Resources/axe`, ADR-0009) et n'embarque pas l'agent factice. Elle est signée « ad hoc » : elle s'ouvre sur la machine qui l'a
construite. Pour la distribuer, désigner un certificat « Developer ID Application » et fournir les
identifiants de notarisation :

| Variable | Rôle |
|---|---|
| `CSC_NAME` (ou `CSC_LINK` + `CSC_KEY_PASSWORD`) | Certificat de signature (jamais choisi d'office dans le trousseau) |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | Notarisation par identifiant Apple |
| `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` | … ou par clé d'API App Store Connect |

L'agent et le dossier de travail se choisissent sous la zone de saisie ; les choix sont enregistrés
dans `~/Library/Application Support/bobine/settings.json`. Ces variables d'environnement
restent prioritaires au lancement :

| Variable | Défaut | Rôle |
|---|---|---|
| `BOBINE_AGENT_PROFILE` | réglage enregistré, sinon le premier agent installé (Bob, puis OpenCode) | Agent à lancer : `bob`, `opencode`, ou `mock` (agent factice, en développement seulement : il n'est proposé que sur demande) |
| `BOBINE_MOCK_AGENT` | — | `1` : l'agent factice est proposé dans la liste, sans être imposé (développement) |
| `BOBINE_WORKSPACE` | réglage enregistré, sinon aucun : l'app demande de choisir un dossier avant de démarrer l'agent (fiche 093) | Dossier de travail de l'agent |
| `BOBINE_DEFAULT_WORKSPACE` | aucun ; `…/workspace` du dossier de données pour les essais (`--user-data-dir`) | Dossier pris tant qu'aucun n'est choisi ; vide : aucun (premier lancement réel en essai) |
| `BOBINE_MAX_LIVE` | le réglage « Conversations gardées actives » (6 par défaut) | Agents vivants au plus (limite souple, fiche 043), prioritaire sur le réglage (fiche 102) ; plus bas pour les essais (e2e `filles`, fiche 097) |
| `MOCK_AGENT_SCENARIO` | `demo` | Scénario par défaut de l'agent factice |

Exemple : `BOBINE_AGENT_PROFILE=opencode BOBINE_WORKSPACE=~/mon-projet pnpm dev`.

Derrière un proxy, sans droits administrateur, ou depuis l'app installable : voir
[installation.md](installation.md).

### Au quotidien

- **Réglages** : ⌘, ou la roue dentée en bas à gauche — thème (système, clair, sombre),
  notifications, police et taille du texte de la conversation, police et taille du terminal, agents
  installés (« Relire le PATH » est dans Diagnostic), dossiers récents, liste des raccourcis.
- **Historique** : « Rechercher » (⌘K) trouve une conversation par son titre, son dossier ou son
  contenu (extrait, mots surlignés ; trouvée par son contenu, elle s'ouvre avec ⌘F sur ces mots) ;
  ⌘F cherche dans la conversation ouverte (sans casse ni accents ; Entrée ou ⌘G suivant, ⇧Entrée
  ou ⇧⌘G précédent, Échap ferme ; le détail replié des outils n'est pas cherché, fiche 086) ; le menu « … » d'une conversation l'épingle en tête ; le bouton
  de la section « Récents » regroupe par dossier de travail ; le texte en cours de saisie est gardé
  par conversation ; la suppression propose d'effacer aussi la session chez l'agent ; « Exporter en
  Markdown… » ou « en JSON… » écrit la conversation dans un fichier (montré dans le Finder) ;
  Réglages › Données → « Sauvegarder… » copie tout l'historique et les réglages dans un dossier.
- **Plan annoté** : en mode plan (Maj+Tab), le plan de l'agent s'affiche comme un document dans le
  fil. Sélectionner un passage → « Commenter » ; « Envoyer mes remarques » demande une nouvelle
  version (« Voir ce qui a changé » compare les versions) ; « Exécuter le plan » repasse en mode
  d'exécution et lance le travail. Les remarques en cours sont gardées, même après un redémarrage.
- **En parallèle** : chaque conversation a son agent ; une réponse longue continue pendant qu'on
  travaille ailleurs (indicateur dans la barre latérale). Dans un dépôt git, « Nouvelle
  conversation dans un worktree » (menu du dossier, sous la zone de saisie) la fait travailler sur
  sa propre branche `bobine/…`, dans `<dépôt>/.worktrees/`, sans toucher à la copie de travail ; la
  suppression de la conversation propose de supprimer aussi le worktree. « Ouvrir à côté » (menu
  « … » d'une conversation) partage la fenêtre en deux conversations.
- **Raccourcis** (menu de l'app, actifs même dans le terminal ou une page du navigateur) : ⌘N
  nouvelle conversation, ⌘K rechercher une conversation, ⌘F chercher dans la conversation, ⌘L zone
  de saisie, ⌘. arrêter, ⌘B barre latérale, ⌘J panneau de droite, ⇧⌘J l'agrandir, ⌃` terminal, ⇧⌘D modifications, ⌥⌘↑ / ⌥⌘↓ conversation
  précédente / suivante, ⌘/ tous les raccourcis.

- **Terminal** : bouton `>_` en haut à droite, ou ⌃` (Ctrl + accent grave). Il s'ouvre dans le
  panneau de droite, dans le dossier de la conversation, avec le shell de connexion ; `+` ajoute un onglet.
  L'agent peut y lire et y lancer des commandes (après confirmation). Sélectionner du texte →
  « Ajouter au message » pour le citer.
- **Modifications** : dès que l'agent a modifié un fichier, un raccourci « 2 +6 −1 » apparaît en
  haut à droite. Il ouvre l'onglet « Modifications » : les fichiers touchés dans la conversation
  avec leur diff, ou (vue « Git ») tout ce qui a changé depuis le dernier commit ; chaque fichier
  s'ouvre dans l'éditeur ou se montre dans le Finder. La flèche « Annuler cette modification »
  remet un fichier dans son état d'avant la conversation, s'il n'a pas changé depuis (sinon il
  n'est pas touché, et le fil le dit). Le « + » au survol d'une ligne du diff ajoute une remarque
  (Maj-clic sur une autre ligne : une plage, ⌘↩ pour valider) ; « Envoyer à l'agent » les envoie
  toutes en un message qui cite fichier, lignes et code (fiche 085).
- **Commandes personnelles** : Réglages › Commandes pour créer vos commandes « / » (nom,
  description, argument attendu, consigne) ; `$ARGUMENTS` y est remplacé par ce qui suit le nom.
  Celles d'un projet sont des fichiers Markdown dans `.bobine/commands/` (`revue.md` →
  `/revue`, en-tête `description:` / `hint:` facultatif ; l'ancien `.bob-desktop/commands/` reste
  lu), partagés avec l'équipe via git. Dans le
  menu « / », elles sont marquées « Vous » ou « Projet » ; une commande de l'agent garde son nom.
- **Git, pull request et CI** : la branche du dossier est affichée en haut à droite, avec un point
  quand des modifications ne sont pas commitées. Elle ouvre l'onglet « Git » : committer tout
  (message proposé par l'agent sur demande), pousser, créer la pull request (GitHub, via `gh`) ou
  la merge request (GitLab, via `glab`) avec un titre et une description tirés des commits, puis
  suivre ses vérifications CI, sa revue et ses commentaires. Quand une vérification passe au
  rouge, un message pour l'agent est prêt dans la zone de saisie ; rien n'est envoyé sans vous.
  Les remarques de revue se font dans la PR / MR, l'agent les lit de là. Dossier sans dépôt :
  l'onglet le dit avec son chemin et propose de créer le dépôt (`git init`, branche `main`).
- **Panneau de droite** : bouton à côté de `>_` ; onglets Navigateur, iOS, Android, Terminal, Tâches, Modifications, Git.
  Il s'ouvre aussi tout seul quand l'agent se sert de l'un de ces outils.
- **Conversations en attente** : pastille dans la barre latérale (orange : demande en cours ;
  couleur de l'app : réponse à lire ; rouge : erreur) et badge sur l'icône du Dock.
- **Notifications macOS** : prévues (fin de réponse, demande de l'agent, fenêtre en arrière-plan ;
  clic → la conversation), mais **macOS 27 les refuse pour une app sans signature de développeur**,
  sans même demander l'autorisation : c'est le cas en `pnpm dev` et de l'app construite sans
  certificat. La cloche en bas à gauche passe alors en alerte et l'explique. Pour de vraies
  bannières, il faut signer avec un certificat à soi (voir « App installable » ; par exemple celui
  d'une « Personal Team » gratuite d'Xcode, non essayé). La cloche coupe aussi notifications et badge.

### Dépannage

| Symptôme | Cause probable | Que faire |
|---|---|---|
| « Commande « bob » introuvable » alors que `bob` marche dans le terminal | Lancée depuis le Finder, l'app lit le PATH du shell de connexion au démarrage (10 s au plus : `.zshrc` lent avec nvm, conda…), ou l'agent a été installé après | Réglages › Diagnostic → « Relire le PATH » ; le journal dit si le shell n'a pas répondu |
| Aucune bannière de notification, cloche en alerte | App signée ad hoc : macOS 27 refuse les notifications | Signer avec un certificat (voir « App installable ») ; le badge du Dock et les pastilles marchent quand même |
| Boîte du trousseau « Bobine veut accéder à… » à l'ouverture, interface figée tant qu'on ne répond pas | Clés d'API chiffrées par le trousseau (`safeStorage`) ; chaque app construite ad hoc a une nouvelle signature, macOS redemande | « Toujours autoriser » ; disparaît avec une signature stable (certificat) |
| « Workspace … is not trusted » à l'ouverture | Bob n'a pas approuvé le dossier | Panneau dédié : ouvrir un terminal et approuver dans `bob`, « Réessayer », ou « Faire confiance à ce dossier » (mémorisé par Bob) |
| « A license agreement is required » | Licence IBM pas encore acceptée | « Lire la licence » (terminal de l'app), puis `bob --accept-license` à la main, puis « Réessayer » |
| « Connexion requise » | Pas de session SSO ni de clé d'API | Bouton SSO (navigateur), ou clé d'API dans le panneau ou Réglages › Agents |
| Conversation « en lecture seule » | Agent retiré de l'app, ou session perdue chez l'agent | « Continuer dans une nouvelle conversation » |
| « Une partie de l'historique était illisible » | Fichier JSON abîmé, mis de côté (`.corrupt-<date>`) | Rien à faire ; le fichier mis de côté reste dans `~/Library/Application Support/bobine/conversations` |
| L'agent lance l'app iOS mais ne touche pas l'écran | AXe absent ou trop ancien | Installer AXe ≥ 1.8 (voir « Démarrer ») |
| Autre chose | — | Aide → « Afficher le journal » (`~/Library/Logs/Bobine/main.log`) : démarrage, arrêts d'agent, tours en échec, erreurs IPC et d'interface |

Arborescence du code :

| Dossier | Contenu |
|---|---|
| `src/main/` | Main process Electron : fenêtres, IPC, hôte ACP des agents, serveur MCP des outils de l'app, navigateur intégré, simulateurs, terminaux |
| `src/preload/` | Pont `window.api`, construit par `createApi()` |
| `src/renderer/` | UI React |
| `src/shared/` | Types partagés, dont le **contrat IPC** (`ipc.ts`) |
| `src/mock-agent/` | Agent ACP factice pour les tests (exécuté en TS par Node) |

## Carte de la documentation

| Document | Contenu |
|---|---|
| [architecture.md](architecture.md) | Processus, flux de données, responsabilités |
| [acp.md](acp.md) | Ce qu'on utilise d'ACP, différences entre agents |
| [agents.md](agents.md) | Bob et OpenCode : ce qui est commun, ce qui est propre à chacun (règle de l'ADR-0011) |
| [installation.md](installation.md) | Installer l'app : proxy, sans droits administrateur, quarantaine, premiers pas avec Bob et OpenCode, app installable |
| [mock-agent.md](mock-agent.md) | L'agent factice : scénarios, lancement, usage dans les tests |
| [pilote.md](pilote.md) | Pilote de Bobine : l'écran en texte, attendre sans regarder, journal du testeur (session longue, recettes) |
| [traduction.md](traduction.md) | Traduire l'interface : ce qui se traduit, guide de style, glossaire, ajouter une langue |
| [travailler-avec-les-agents.md](travailler-avec-les-agents.md) | Comment on fait travailler les agents de code sur ce dépôt |
| [../demos/](../demos/README.md) | Démonstrations : prompts prêts à copier et projet d'essai (La Bobinette : site, calculs, apps iOS et Android) |
| [recettes/](recettes/) | Passages complets avec un vrai agent sur l'app packagée : ce qui a été essayé, résultats, coûts (dernier : [Bob 2.0.6, 19 octobre 2026](recettes/2026-10-19-bob-2.0.6.md)) |
| [adr/](adr/) | Décisions d'architecture |
| [features/](features/) | Fiches de fonctionnalités et feuille de route |
| [feuille-de-route-2026-10-28.md](feuille-de-route-2026-10-28.md) | Petits plus triés le 28/10 : lots 154 à 159, écartés, réserve |

## Pour contribuer

Pages d'entrée du dépôt, en anglais : [`README.md`](../README.md) (et [`README.fr.md`](../README.fr.md)),
[`CONTRIBUTING.md`](../CONTRIBUTING.md), [`SECURITY.md`](../SECURITY.md), gabarits d'issue dans
`.github/ISSUE_TEMPLATE/`. Licence Apache-2.0 ([`LICENSE`](../LICENSE)) ; logiciels tiers
embarqués : [`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md), généré par
`pnpm build && pnpm third-party-notices` et livré avec l'app (fiche 217). `./scripts/verify` tourne sur
GitHub à chaque pull request (`.github/workflows/ci.yml`) ; les e2e à la main (`e2e.yml`).

## Pour les agents de code

Les consignes sont dans [`AGENTS.md`](../AGENTS.md) à la racine.
