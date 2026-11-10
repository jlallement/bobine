# Décisions d'architecture (ADR)

Une page par décision structurante. Modèle : [`_modele.md`](_modele.md).
Statuts : `proposé` → `accepté` → éventuellement `remplacé par ADR-NNNN`.

| N° | Décision | Statut |
|---|---|---|
| [0001](0001-electron-typescript-react.md) | Electron + TypeScript + React | accepté |
| [0002](0002-acp-couche-agent.md) | ACP comme unique interface avec les agents | accepté |
| [0003](0003-mcp-heberge-main-process.md) | Panneaux visuels exposés via un serveur MCP hébergé par l'app | accepté |
| [0004](0004-agent-factice-pour-tests.md) | Agent ACP factice pour les tests | accepté |
| [0005](0005-radix-lucide-ui.md) | Radix UI et Lucide pour l'interface | accepté |
| [0006](0006-cdp-direct-navigateur.md) | Navigateur intégré piloté par le protocole DevTools, sans Playwright | accepté |
| [0007](0007-terminal-node-pty-xterm.md) | Terminal intégré : node-pty et xterm.js | accepté |
| [0008](0008-packaging-electron-builder.md) | Packaging macOS avec electron-builder, signature ad hoc par défaut | accepté (dossier de données : ADR-0013 ; Linux : ADR-0032 ; DMG : ADR-0034) |
| [0009](0009-axe-simulateur.md) | AXe pour piloter le simulateur iOS, livré avec l'app | accepté (archive : ADR-0010) |
| [0010](0010-archive-axe-versionnee.md) | Archive d'AXe versionnée dans le dépôt | accepté |
| [0011](0011-fonctions-propres-a-un-agent.md) | Fonctions propres à un agent : déclarées, visibles, documentées | accepté |
| [0012](0012-nom-bobine.md) | Nom affiché « Bobine », identifiants internes inchangés | remplacé par ADR-0013 |
| [0013](0013-bobine-partout.md) | « Bobine » partout, dépôt et identifiants compris | accepté |
| [0014](0014-langues-interface.md) | Langues de l'interface : i18next, ressources JSON, textes enregistrés en codes | accepté |
| [0015](0015-adaptateurs-dans-le-profil.md) | Ce qu'un agent fait hors d'ACP : des adaptateurs portés par son profil | accepté |
| [0016](0016-reglages-hors-gestionnaire-composition-par-abonnements.md) | Réglages hors du gestionnaire de conversations, démarrage du main par abonnements | accepté |
| [0017](0017-quota-bob-par-status.md) | Quota de bobcoins lu par la commande `/status` de Bob Shell, tâche vide supprimée | accepté |
| [0018](0018-telechargements-enregistrer-sous.md) | Téléchargements du navigateur intégré : « Enregistrer sous » à chaque fois | accepté |
| [0019](0019-conversations-filles.md) | Conversations filles : lien mère-fille, compte rendu, outils de l'app pour l'agent (un niveau, worktree, accord) | accepté — plafond remplacé par ADR-0020 |
| [0020](0020-plafond-filles-reglable.md) | Plafond des conversations filles : un réglage, 5 par défaut | accepté |
| [0021](0021-fil-de-bobine-fait-foi.md) | Le fil enregistré par Bobine fait foi ; le rejeu de l'agent ne sert qu'à compléter (session continuée ailleurs) | accepté |
| [0022](0022-fusion-dans-le-worktree.md) | Fusion d'un worktree dans le worktree, puis la base avance en fast-forward | proposé |
| [0023](0023-pas-de-mise-a-jour-automatique.md) | Pas de mise à jour automatique pour l'instant (pas toujours les droits d'installer sur un poste géré) ; options étudiées gardées | accepté |
| [0024](0024-continuer-avec-un-autre-agent.md) | Continuer une conversation avec un autre agent : même conversation, nouvelle session, échange en texte avec le prochain message | accepté |
| [0025](0025-journal-consommation-sqlite.md) | Journal de consommation en SQLite (`node:sqlite`, `usage.sqlite`), une ligne par tour, séparé du fil : ce qui fait foi pour quoi | accepté |
| [0026](0026-vue-native-taille-par-cdp.md) | Navigateur intégré : vue native gardée ; taille imposée par l'agent (réduite pour tenir, annulée en fin de tour) et annotation par le CDP — complète ADR-0006 | accepté |
| [0027](0027-jetons-de-theme-en-typescript.md) | Jetons de thème en TypeScript (`shared/themes.ts`, CSS généré), contraste AA vérifié par un test ; pas de thème importable ni d'accent libre | accepté |
| [0028](0028-independance-aux-agents.md) | Indépendance aux agents : marque générique posée par le main (sous-agents, compaction), règles / MCP / fournisseurs en sources du profil, formes des agents non ciblés retirées, noms d'agents interdits hors de leurs modules — complète ADR-0015 | proposé |
| [0030](0030-session-neuve-du-meme-agent.md) | Agent qui ne sait pas reprendre (ou qui a perdu sa session) : session neuve dans la même conversation, repère dans le fil, échange en texte au prochain message — précise ADR-0024 | proposé |
| [0031](0031-pages-de-l-app-dans-la-zone-principale.md) | Une page de l'app dans la zone principale, à la place du fil : « Mon activité » (consommation), refermée à l'ouverture d'une conversation ; remplace « Consommation : un onglet des réglages » (23/10) | accepté |
| [0032](0032-bobine-multiplateforme.md) | Bobine multiplateforme : macOS, puis Linux en préversion (Ubuntu 24.04 GNOME, AppImage et `.deb`, x64 et arm64, même version que le Mac) ; capacités de la plateforme dans un seul module du main ; clés d'API comme VS Code — complète ADR-0008 | accepté |
| [0033](0033-annoter-la-page-vivante.md) | Annoter la page vivante : script de l'app dans un monde isolé de la page (clic arrêté, binding CDP, épingles dans une racine fermée), page figée seulement le temps d'écrire — remplace le point « annotation sur une image figée » de l'ADR-0026 | accepté |
| [0034](0034-dmg-outils-macos.md) | DMG simple avec les outils de macOS, app et signature conservées dans electron-builder — complète ADR-0008 | accepté |
| [0035](0035-plafond-de-cout-dans-le-fil.md) | Plafond de coût par conversation : plafond propre et carte « Plafond atteint » dans le fil (évènements de l'app), décision dans le main par un gardien abonné au gestionnaire ; unité = devise du coût, sinon jetons | proposé |
| [0036](0036-mere-tech-lead-fusion-par-l-utilisateur.md) | La mère pilote ses filles en tech lead : agent et modèle proposés et validés, compte rendu borné sans diff (début du récapitulatif), `recommend_merge`, fusion par l'utilisateur seulement — précise ADR-0019 | proposé |
| [0037](0037-preparation-des-worktrees.md) | Préparation des worktrees : `.worktreeinclude` (format de Claude Code) et `.bobine/worktree.json` dans le dépôt ; copie des fichiers ignorés sans demander, commandes lancées après accord par dépôt et empreinte (l'accord ne couvre que les commandes montrées ; une tâche planifiée ne l'attend pas) ; hors du gestionnaire (`worktree-start`, `promptGate`, `post`) | proposé |
| [0038](0038-sdk-acp-derriere-un-seul-module.md) | Le SDK ACP derrière un seul module (`src/shared/acp-sdk.mts`, règle ESLint) : une montée ou un retour de version tient dans `package.json`, le lockfile et ce module | accepté |
| [0039](0039-taches-planifiees-dans-le-main.md) | Tâches planifiées : une exécution est une conversation ordinaire lancée par le main (`createDetached`), seulement app ouverte ; jamais deux à la fois, au plus un rattrapage, plafond de la tâche posé comme plafond propre (ADR-0035) | proposé |
| [0040](0040-memoire-commune-tenue-par-bobine.md) | Mémoire commune tenue par Bobine (`userData/memory/`, clé = dépôt principal), en clair au format de Claude Code, écrite seulement par les outils `remember` / `forget` (secrets refusés, rien d'écrit sans l'accord de l'utilisateur sur une carte « Retenir ? », tour non bloqué, écritures atomiques en file par projet), index en prompt système si l'agent l'annonce, sinon au premier message | proposé |
| [0041](0041-adaptateur-de-forge.md) | Adaptateur de forge dans le main : forge choisie d'après l'URL du dépôt distant (GitHub par `gh`, GitLab par `glab`, outil connecté à l'hôte), mot « PR » / « MR » dit au renderer par une clé ; suivi des contrôles = capacité (GitHub seul pour l'instant), forge inconnue sans bouton | proposé |
| [0042](0042-format-du-profil-versionne.md) | Format du profil : une marque `profile.json` ; format plus récent : lecture seule ; champs inconnus gardés à la réécriture ; la version ne monte que pour un changement illisible par les versions d'avant | proposé |
| [0043](0043-reponses-automatiques-aux-demandes-d-autorisation.md) | Bobine répond à une demande d'autorisation à la place de l'utilisateur seulement si le genre est coché pour la conversation (ou « Tout approuver », jamais enregistré), si l'agent propose `allow_always`, sans risque repéré, et en le traçant ; jamais `--auto-approve`, aucune règle de l'agent réimplémentée | proposé |
| [0044](0044-bobine-ecrit-les-regles-d-approbation-de-bob.md) | Bobine écrit les règles d'approbation de Bob (`~/.bob/settings/settings.json`, section `approval`, format documenté par IBM) sur une action explicite seulement : commandes autorisées ou refusées partout, groupes, hors du dossier ; écriture atomique, reste du fichier gardé, jamais `forbiddenApprovalGroups` ; propre à Bob (ADR-0011) | accepté |
