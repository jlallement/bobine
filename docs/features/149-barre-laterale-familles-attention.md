# 149 — Barre latérale : familles stables et attention visible

- **Statut** : fait (validation globale clôturée par la fiche 151)
- **Dépend de** : 097 (filles), 119 (« À traiter »), 125, 131 (barre latérale)
- **Agents** : les deux. L'affichage dépend de l'état des conversations, pas de l'agent.

## Pourquoi

La section « À traiter » sépare les filles de leur mère quand leur état change. Les nouvelles
filles peuvent aussi rester invisibles dans une section ou un dossier replié. Après comparaison
des maquettes, la direction est une liste stable, des états par icônes et des filles directement
sous leur mère. Le repère textuel des forks encombre lui aussi les titres.

## Critères d'acceptation

- [x] Proposer trois maquettes interactives comparables, sans changer l'interface de l'app.
- [x] Vérifier contre l'agent factice l'apparition d'une fille à la création, avant sa première
      réponse, puis avec la section Récents ou le dossier replié.
- [x] Distinguer délai de création du worktree, publication dans la liste, visibilité et
      déplacement vers « À traiter ».
- [x] Consigner les résultats, les limites des essais et les choix restant à faire.
- [x] Recueillir les choix de présentation avant de proposer le plan d'implémentation.

## Périmètre retenu après les maquettes

- [x] Supprimer la section « À traiter » : une conversation garde son emplacement quand elle
      attend un accord, finit son tour, devient non lue ou est consultée.
- [x] Afficher les filles directement sous leur mère, sans repli de famille, ligne de compteur
      ni récapitulatif des états des filles sur la mère. Les sections et dossiers gardent leur
      repli propre.
- [x] Signaler l'état propre de chaque conversation (fille ou non) par une icône, une infobulle
      et un libellé accessible ; distinguer notamment finie non lue et finie lue.
- [x] Aligner la carte « Sous-tâches » : colonne fixe pour l'icône d'état, infobulle ; conserver
      les titres, fichiers, branches git, consommation, fusion/nettoyage et actions existantes.
- [x] Révéler une nouvelle fille dès son lancement accepté : état transitoire pendant la
      création du worktree, puis vraie ligne ; section/dossier contenant la famille ouverts,
      ligne amenée à vue, mère toujours active.
- [x] Remplacer le repère textuel de fork dans la liste par une icône et une infobulle indiquant
      l'origine. Les noms des branches git et les commandes git ne changent pas.
- [x] Conserver le suivi d'attention, le compteur du Dock, les notifications groupées, le son et
      le rebond ; leurs libellés ne doivent plus dépendre de l'existence de « À traiter ».
- [x] Valider les scénarios contre l'agent factice, en clair et sombre, et regarder les captures.

Le centre d'attention et le repli des familles sont écartés. « Modifier / Réessayer » continue à
créer une branche : l'utilisateur a demandé un statut sur ce comportement, pas sa correction.
La lecture d'un compte rendu dans la mère ne marquera pas implicitement toute la conversation
fille comme lue dans ce lot ; changer cette règle serait une décision distincte.

## Plan d'implémentation

### Correctif après essai en preview — infobulle unique

L’utilisateur observe deux infobulles au survol. `HistoryItem` combine `Tip` (Radix) et un
attribut HTML `title` contenant les mêmes informations. Plan avant modification :

1. Retirer seulement `title` du bouton d’ouverture ; garder `Tip` avec titre complet, état,
   origine, worktree et dossier. Conserver l’accès au clavier et la description liée par Radix.
   L’attribut `title` est en réalité repris par `title-tooltips.ts` (fiche 126) : deux mécanismes
   de l’app, pas deux bulles Radix. Préserver les retours à la ligne et le repli des chemins longs
   dans la bulle restante, par une classe optionnelle de `Tip` et un style réservé à l’historique.
2. Adapter les tests de barre latérale : consulter l’infobulle réellement ouverte au focus,
   vérifier son lien accessible et l’absence d’attribut natif sur les lignes.
3. Remplacer les lectures de `.title` des e2e `branch`, `filles`, `inbox` et `parallel` par une consultation
   réelle de l’infobulle. Dans `history`, contrôler un survol prolongé et le focus au clavier,
   une seule bulle affichée et aucun `title` susceptible d’en afficher une seconde ; captures.
4. Repasser `./scripts/verify`, build puis ces cinq suites en clair et sombre ; regarder les
   captures. Mettre à jour index et changelogs. Aucun changement du dessin des filles ou d’ACP.

### 1. Stabiliser la liste et remplacer la section d'attention

- `sidebar/Sidebar.tsx`, `history-order.ts`, `HistoryItem.tsx` : retirer l'extraction des lignes
  vers « À traiter ». Faire le regroupement des familles avant la répartition d'affichage entre
  Épinglées et Récents/Dossiers, pour qu'une mère épinglée ne perde pas ses filles actives.
  L'appartenance visuelle suit la mère ; les indicateurs enregistrés d'épinglage ne sont pas
  réécrits. Une fille explicitement archivée reste dans les archives. Une mère archivée ou
  supprimée conserve le comportement documenté : filles en conversations ordinaires.
- Garder l'ordre figé sous le pointeur pour la visée des lignes et des menus ; retirer la logique
  d'appartenance figée propre à `InboxSection`. Les états et infobulles se mettent à jour sans
  ancien libellé conservé jusqu'à la sortie du pointeur.
- Les icônes représentent l'état propre de la ligne. Mutualiser leur correspondance avec la
  carte quand c'est pertinent ; garder les raisons détaillées de `AttentionDetails` pour les
  infobulles, y compris sur les conversations qui n'ont pas de mère.
- `shared/inbox.ts`, `notifications/dock-badge.ts`, réglages/i18n : conserver le calcul des
  attentes utilisé par le Dock et les notifications ; nettoyer seulement les fonctions,
  styles et textes devenus inutiles pour l'ancienne section. Aucun effacement global du suivi.

### 2. Assurer la visibilité dès le lancement accepté

- Le diagnostic a reproduit deux causes distinctes : avant la fin de création du worktree,
  aucune conversation n'est encore publiée ; après publication, un repli peut cacher sa ligne.
- `main/conversations/children.ts` et ses abonnements : état de lancement transitoire identifié
  par demande, mère et titre, émis avant la création asynchrone du worktree. Le main reste
  responsable des processus et du disque. Cet état n'est pas une fausse conversation persistée.
- Contrat partagé, IPC typé, preload et `useConversations` : transmettre le lancement aux
  fenêtres, y compris son état initial ; le remplacer par la vraie fille ou le retirer sur
  erreur. Le lancement n'existe qu'après l'accord de l'utilisateur. Gérer plusieurs lancements
  et respecter le plafond pendant leur préparation.
- `ChildDialog.tsx`, `ChildProposals.tsx`, barre latérale : un retour immédiat par icône de
  préparation et infobulle ; révéler section/dossier et ligne à chaque lancement accepté,
  qu'il provienne de l'utilisateur ou d'une proposition de l'agent. Ne pas attendre la première
  réponse, ni basculer la conversation active vers la fille. Aucun libellé d'état ajouté à la
  ligne de la barre latérale.

### 3. Aligner la carte et alléger les forks

- `thread/Subtasks.tsx` et styles : grille avec colonne d'état fixe et action « Ouvrir » alignée,
  états uniquement en icône avec infobulle et libellé accessible. Conserver les informations
  réelles que la maquette simplifie : coûts, branche git, fichiers, fusion et erreurs de fusion.
- `HistoryItem.tsx`, i18n : remplacer le badge visible « branche » par une icône de fork,
  origine lisible en infobulle et au clavier. Préserver l'origine et le fonctionnement des
  conversations existantes ; aucun appel à un mécanisme particulier de Bob.

### 4. Vérifier le comportement et clore

- Adapter les tests de caractérisation déjà ajoutés : les cas de fille cachée par un repli
  doivent maintenant attendre une ligne visible. Tester aussi un worktree volontairement lent,
  un échec de création, plusieurs lancements, une mère épinglée, une fille archivée, un état qui
  change sous le pointeur, et un lancement par proposition de l'agent.
- Tester les états et infobulles, la distinction lue/non lue, l'alignement de la carte, le fork
  en icône et la conservation du compteur du Dock/notifications. Adapter `inbox` sans perdre ses
  tests de notifications groupées et de badge.
- `./scripts/verify`, puis `pnpm build && pnpm e2e --changed` (clair et sombre), captures
  regardées. Suites concernées au minimum : visibilité/filles, notifications, ancien `inbox`,
  historique, branches, navigateur, fusion des filles ; le catalogue détermine le périmètre final.
  L'échec de performance déjà observé doit être signalé s'il persiste, sans assouplir son seuil.
- Mettre à jour cette fiche et son index, les fiches 119/125/131 et 023 si nécessaire,
  `docs/architecture.md`, les changelogs français et anglais. Pas de nouvelle dépendance prévue.
  Écrire un nouvel ADR uniquement si l'implémentation nécessite une décision structurante
  supplémentaire ; ne pas modifier un ADR accepté.

L'implémentation de ce plan est autorisée le 2026-10-26. Le dessin existant des liens mère-filles
(flèches légèrement arrondies) doit être conservé à l'identique : ni le tracé ni son style ne
font partie des changements.

## Journal

- 2026-10-26 — Vérification complète verte : `VITEST_MAX_WORKERS=2 ./scripts/verify`,
  278 fichiers et 2 076 tests réussis, lint et typage inclus. Le passage standard avait rencontré
  des échecs de durée/synchronisation (catalogue e2e, sous-agent en arrière-plan, écriture et
  recherche dans l’historique). Aucun seuil ni scénario n’a été assoupli : seule la concurrence
  a été réduite pour la reprise complète. Build réussi.
- 2026-10-26 — Implémentation autorisée : section « À traiter » retirée ; état propre par icône
  sur chaque ligne, mêmes icônes dans une colonne fixe de la carte, fork en icône. Le composant
  `ChildLink` et les styles de ses flèches arrondies restent identiques.
- Préparation des filles : état transitoire révisé côté main, plafond réservé avant le worktree,
  remplacement avant publication de la vraie liste ; suppression de la préparation sur erreur.
  Les lectures initiales tardives sont ignorées. Une identité de ligne retenue par le réducteur
  évite qu'un remplacement décale la cible sous le pointeur. Aucun changement du protocole ACP,
  aucune dépendance nouvelle, aucune migration des conversations.
- Essais du périmètre : filles (y compris propositions de l’agent et visée sous le pointeur),
  préparation lente et révélation des replis, attention sur place/Dock, notifications, forks,
  historique, navigateur et cycle des worktrees passés en clair et sombre. Captures relues :
  états et cartes dans les deux thèmes, dossier révélé, historique, fork et résultat de fusion.
  Tracé `ChildLink` et styles `.child-link` comparés à `HEAD` : strictement identiques.
- 2026-10-26 — Étude demandée. Les variantes restent des propositions ; la suppression de
  « À traiter » n'est pas encore décidée. Le code crée le worktree avant de publier la fille,
  puis publie sans attendre sa première réponse. Les replis ne sont pas automatiquement ouverts.
- 2026-10-26 — Diagnostic contre l'agent factice :
  - Test main : une fille non brouillon est publiée avant sa consigne et sa première réponse.
  - Tests renderer : fille visible dès réception de la liste, même sous le pointeur ; Récents
    replié la cache ; dossier replié la cache puis elle apparaît à plat dans « À traiter » si
    elle attend un accord.
  - Nouvelle suite `filles-visibilite`, clair et sombre : une fille en cours apparaît sous sa
    mère si la section est ouverte ; deux créations supplémentaires restent invisibles dans
    Récents puis dans le dossier repliés. Déplier révèle immédiatement les filles déjà créées.
    Le scénario `attend-stop` évite de confondre apparition et fin de réponse.
  - Sur les petits dépôts jetables de cet essai : 430 à 624 ms entre le clic de lancement et la
    fermeture du dialogue avec fille publiée. Ce n'est ni une garantie de délai, ni une mesure
    sur un gros dépôt réel ; aucune ligne provisoire n'existe pendant la création du worktree.
  - Suites existantes `filles` et `inbox` vertes en clair et sombre. Captures du diagnostic
    regardées : section ouverte, Récents replié, dossier replié, puis dossier ouvert.
  - Les essais de caractérisation décrivent les limites actuelles ; leur réussite ne signifie
    pas que l'invisibilité a été corrigée.
- 2026-10-26 — Trois propositions dans la maquette interactive du chat :
  - **États sur place** : les filles restent sous leur mère ; raison sur la ligne et résumé sur
    la mère et le dossier replié. Variante la plus proche de l'interface actuelle.
  - **Centre d'attention** : liste stable, accès global aux demandes par un panneau de raccourcis
    vers les conversations ; la navigation conserve leur place dans la famille.
  - **Familles compactes** : filles repliables sous la mère, nombre et alerte visibles avant le
    dépliage. Le lancement révèle la nouvelle fille immédiatement dans les trois propositions.
  - Le lancement simulé montre « Création du worktree… » avant « En cours ». Cette ligne
    provisoire est une proposition, pas le comportement livré.
  - Interactions des trois propositions vérifiées sans navigateur (DOM simulé) : repli,
    lancement, navigation, accord, lecture et transition de création. L'aperçu navigateur local
    a été refusé par la politique des URL `file:` ; pas de validation visuelle des maquettes
    dans un navigateur. Les captures Electron concernent le produit actuel.

## Direction après relecture des maquettes

- 2026-10-26 — L'utilisateur apprécie les états sur place et les familles compactes ; il rejette
  le centre d'attention, qui ne doit pas être implémenté. La maquette du chat regroupe les deux
  pistes appréciées et retire le centre d'attention.
- Proposition précisée : filles dépliées par défaut ; passage en compact par le chevron,
  manuellement, famille par famille. Le nombre de filles et les attentes restent visibles sur
  la mère. Une fin de tâche ne change pas le repli. Lancer une fille ou naviguer explicitement
  vers elle révèle sa famille et son dossier. Le choix de repli doit être retenu.
- Le nouveau comportement reste une proposition de maquette, sans changement du produit.
- 2026-10-26 — Nouvelle précision utilisateur : les états dans la barre latérale se limitent
  aux icônes, à droite des titres, avec leur libellé en infobulle et pour les lecteurs d'écran.
  Icône et texte restent ensemble dans la carte « Sous-tâches ». Les attentes agrégées sur la
  mère ou le dossier replié suivent la même règle, sans seconde ligne de libellés d'état. Le
  nombre de filles et le chevron restent des repères de structure. Maquette ajustée uniquement.
- 2026-10-26 — Après relecture, les icônes récapitulatives des filles sont retirées de la mère :
  elles surchargent la liste et répètent les états individuels. La mère garde son titre et le
  contrôle de repli ; les états restent sur les filles et dans la carte « Sous-tâches ». Ce
  choix remplace le résumé d'alertes sur la mère proposé plus haut, même quand la famille est
  repliée. Maquette seulement, sans changement de l'application.
- 2026-10-26 — Le repli des familles est finalement rejeté par l'utilisateur. La maquette retire
  son chevron, sa ligne « N conversations filles » et son réglage : les filles suivent toujours
  leur mère, chacune avec son icône d'état. Ce choix remplace la proposition de familles
  compactes. Le repli du dossier reste indépendant. Aucun changement du produit à ce stade.
- 2026-10-26 — Les libellés d'état dans la carte « Sous-tâches » sont aussi retirés à la demande
  de l'utilisateur : leurs différentes longueurs désalignaient les lignes. La maquette réserve
  une colonne fixe aux icônes, juste avant « Ouvrir » ; chaque icône porte une infobulle et un
  libellé accessible, et permet d'ouvrir la fille. Ce choix remplace « icône + texte dans la
  carte ». Titres, détails des fichiers et boutons restent visibles. Maquette seulement.
- Vérification complète après formatage : lint et typage passent ; 2 069 tests réussissent sur
  2 070. Seul échec au second passage : seuil de performance de la recherche dans
  `manager.test.ts:846` (intervalle maximal de 142 ms pour un seuil de 100 ms), dans un test non
  modifié. Le premier passage avait aussi deux échecs de synchronisation (terminal et scénario
  de sous-agent), absents du second. `./scripts/verify` n'est donc pas vert ; aucun contrôle n'a
  été désactivé. Les nouveaux tests et les suites e2e ciblées ont réussi.

## Validation globale et limites

- `VITEST_MAX_WORKERS=2 ./scripts/verify` : **vert**, 278 fichiers, 2 076 tests. Aucun seuil
  modifié, aucun test désactivé. `pnpm build` : **vert**.
- `pnpm e2e --changed --jobs 2` : **120 exécutions réussies sur 129**, 9 échecs en 21 min 36 s.
  Les deux thèmes sont couverts. Le parcours « À propos » sombre a atteint sa garde de 5 min.
- Reprise isolée de `questions`, `usage-board`, `android`, `terminal` (`--jobs 1`, deux thèmes) :
  questionnaire, Android et terminal verts ; seul `usage-board` reste en échec, dans les deux
  thèmes, sur l’apparition de la confirmation de remise à zéro.
- Reprise isolée de `about --dark --jobs 1` : **verte en 8 s**, y compris ouverture des
  Nouveautés et fermeture par Échap. Aucun de ces scénarios n’a été modifié pour la reprise.
- Comparaison sur une exportation temporaire de **`HEAD` (`79765bb`) avant ce lot**, mêmes
  dépendances et agent factice, en conservant seulement la modification préexistante de l’import
  de `delay.ts` dans `simctl.ts` : les trois mêmes contrôles échouent aussi avant ce lot :
  - `simulator` : version d’AXe attendue dans la barre alors que le direct affiche déjà ses fps ;
  - `filles-fusion` : état intermédiaire `resolving` non observé ; la fusion et le nettoyage
    atteignent néanmoins leur résultat final. Le diagnostic du lot voit les mêmes états en
    attente, puis fusionnés ; le parcours de référence échoue au même endroit ;
  - `usage-board` : confirmation `confirm-row` absente après le clic de remise à zéro.
- À ce stade, ces anomalies n’étaient pas corrigées dans la fiche 149 : la validation globale
  restait ouverte. Elles ont ensuite été traitées dans la fiche 151 ; clôture ci-dessous.
- Journaux conservés dans `e2e/captures/149-e2e.log`, `149-reprises.log`,
  `149-about-reprise.log`, `149-baseline-e2e.log` et `149-baseline-usage.log` (captures ignorées par
  git). L’export temporaire de référence est ensuite supprimé ; le dépôt de travail et la
  modification préexistante de `simctl.ts` sont préservés.

## Essai court avec les agents réels — 2026-10-26

Essai manuel demandé explicitement par l’utilisateur, hors catalogue et hors CI : dépôt et données
Bobine jetables, deux filles chargées respectivement d’écrire `alpha.txt` (`ALPHA\n`) et
`beta.txt` (`BETA\n`), sans commit ni fusion.

- **OpenCode 2.1.4, `opencode/big-pickle`** : réussi en **34,2 s**, coût annoncé **0 USD**.
  Deux appels `start_child`, deux propositions acceptées, deux worktrees distincts et les deux
  contenus vérifiés sur disque. Préparation visible observée dans le DOM ; les filles restent
  imbriquées et finies non lues, la mère reste active. Deux comptes rendus, un réveil groupé et
  bilan final de la mère ; aucun des deux fichiers dans le dossier principal.
- L’agent a d’abord essayé une lecture locale par `fetch`, refusée par son outil `execute`, puis
  s’est repris avec une lecture shell. Cet échec d’outil récupéré ne bloque pas le parcours des
  filles ; il reste visible dans le fil.
- **Bob Shell 2.0.6** installé à la demande de l’utilisateur via l’installateur officiel IBM
  (empreinte SHA-256 vérifiée), dans `~/.local`, commande exposée par `~/bin/bob`. Initialisation ACP
  dans Bobine réussie ; dossier d’essai approuvé avec le geste de confiance prévu par l’app.
  Connexion IBM SSO effectuée par l’utilisateur, puis identifiants rechargés par le geste de
  reprise de session de l’app. **Essai propre réussi en 14,9 s** : mêmes onze contrôles que pour
  OpenCode, deux autorisations d’écriture limitées aux fichiers prévus, deux comptes rendus,
  un réveil, mère active sans changement d’identifiant pendant tout le parcours. Écritures et
  contenus vérifiés sur disque ; filles finies non lues sous la mère.
- **Coût Bob** lu en lecture seule dans sa base locale, uniquement par les identifiants de
  session des essais : **0,264528 bobcoin** pour le passage propre (mère, deux tours : 0,137112 ;
  chaque fille : 0,063708). Premier passage : 0,264074 ; total des deux passages : **0,528602**.
  L’isolation `BOBINE_CONFIG_HOME` du script ne pointe pas le suivi de coût vers la base réelle :
  le montant est donc relevé séparément, et ne valide pas l’affichage du coût Bob dans cet essai.
- Le premier passage Bob a attendu 2 min 34 s : le script manuel dédoublonnait les autorisations
  par identifiant seul, alors que deux processus Bob peuvent réutiliser le même identifiant.
  Corrigé dans le script uniquement, avec la paire conversation/autorisation. La mesure de
  navigation du premier passage n’est pas retenue (une fille était ouverte en fin de mesure).
  La reprise propre enregistre uniquement deux clics « Lancer », aucune ouverture par notification
  et la même mère active tout du long. Aucun correctif de produit pour ces essais.
- **Limite du bilan de Bob** : il conseille de fusionner les branches alors que les fichiers sont
  restés non committés, comme demandé. Le parcours testé est lancement/compte rendu/réveil ; cette
  suggestion de l’agent est incorrecte et aucune fusion n’a été exécutée.
- Preuves hors git : `e2e/captures/149-live-opencode-result.json`, captures
  `149-live-opencode-{proposals,result}-light.png`, `149-live-bob-result.json`,
  `149-live-bob-checks.json` et `149-live-bob-result-light.png`. Captures regardées. Script manuel
  ponctuel dans le même dossier, jamais ajouté aux tests automatisés. Entrées de confiance des
  dépôts temporaires retirées après fermeture des essais ; connexion IBM et installation conservées.

## Irritants connexes recueillis

- **Deux infobulles au survol en preview** : doublon confirmé dans `HistoryItem` entre `Tip`
  (Radix) et `title={tip}` repris par `title-tooltips.ts`. Retrait du seul attribut `title`, sans
  changer le texte de la bulle ni l’apparence des lignes. Les tests de composants et les e2e lisent désormais l’infobulle
  réellement ouverte, avec sa liaison accessible ; vérifient l’absence de `title` sur le bouton,
  ses ancêtres et ses descendants. Test de survol prolongé et de focus dans `history`.
  Vérification complète : **278 fichiers / 2 079 tests verts**, lint et typage verts ; build vert.
  Premier e2e : unicité et accès au clavier réussis, six tâches vertes sur dix ; les quatre
  contrôles de contenu `history` / `branch` détectent la normalisation des retours à la ligne
  dans la bulle restante. La capture montre aussi un chemin long coupé. Ajout d’une classe
  optionnelle au contenu de `Tip`, réservée aux lignes (`history-tooltip`) : `white-space:
  pre-line` et `overflow-wrap: anywhere`. Les essais gardent leurs attentes de texte entier et
  vérifient aussi l’absence de débordement horizontal ; aucun remplacement par une lecture
  d’attribut caché pour faire passer le contrôle.
  Après mise en forme : `history` / `branch` verts en clair et sombre (4 tâches, 25 s), puis
  `filles` / `inbox` / `parallel` verts (6 tâches, 2 min 04 s). Les quatre captures
  `149-infobulle-unique-{survol,clavier}-{light,dark}.png` ont été regardées : une seule bulle,
  lignes et chemins longs lisibles. Journaux conservés dans `e2e/captures/`.
  Une reprise de `verify` a eu un worker Markdown non démarré (277 fichiers / 2 075 tests verts,
  erreur de délai du lanceur) ; ce fichier passe seul, ses quatre tests verts. Passage complet
  relancé sans changement de seuil ni de test désactivé.
  **Reprise complète finale verte** : `VITEST_MAX_WORKERS=2 ./scripts/verify`, 278 fichiers /
  2 079 tests, lint et typage. `git diff --check` vert. Le correctif d’unicité et de lisibilité
  est validé ; les trois contrôles globaux préexistants de la fiche restent distincts et non
  rejoués dans ce correctif ciblé. L’utilisateur questionne ensuite l’utilité de la bulle complète :
  proposition de la limiter aux titres tronqués et aux icônes d’état/fork, sans changement de
  ce périmètre appliqué à ce stade.

- **Remarques de la mère sur le travail d’une fille** : essais réels et affichage repliable
  des consignes poursuivis dans la [fiche 150](150-consignes-conversations-filles.md). Dans une
  conversation neuve, OpenCode reprend spontanément la fille sur une remarque naturelle ; Bob
  demande une précision. Les essais après un retour explicite réussissaient avec les deux :
  le contexte précédent influence donc ce choix du modèle.

- **Modifier / réessayer ouvre une autre conversation** : statut demandé seulement, sans
  correction. C'est le comportement générique de la fiche 023, dans
  `ConversationManager.branch` : nouvelle conversation et nouvelle session, échange antérieur
  transmis en contexte. Le contrat Bob documenté dans `docs/acp.md` n'annonce pas `fork` ;
  aucun vrai agent n'a été resondé ici. Le SDK du projet n'expose pas de retour à un message
  précis ; la [proposition ACP de fork](https://agentclientprotocol.com/rfds/session-fork)
  décrit encore le point de départ par identifiant de message comme une extension future.
  Ce contexte explique le contournement technique ; présenter la reprise comme une autre
  conversation dans la barre latérale reste un choix de Bobine.
- **Repère de fork** : préférence utilisateur pour une icône plutôt que le texte « branche ».
  Icône `git-fork` et infobulle d'origine retenues, puis implémentées dans la barre latérale.
  Le fonctionnement des branches reste inchangé.

## Clôture — 2026-10-27

- [Fiche 151](151-validation-livraison-familles.md) : causes des contrôles restants traitées,
  sans seuil relevé ni assertion utile retirée. `verify` entièrement vert : lint, typage,
  **279 fichiers / 2 084 tests** ; build vert ; `pnpm e2e --changed --jobs 2` :
  **129 tâches vertes, zéro échec, 14 min 36 s**. Captures concernées clair/sombre regardées.
- Les flèches arrondies des filles (fonction `ChildLink` et CSS) sont strictement identiques
  à la version de départ. Les six worktrees existants sont conservés. La suggestion de limiter
  davantage les infobulles reste optionnelle et n’est pas ajoutée à ce lot.
