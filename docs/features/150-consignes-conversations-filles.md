# 150 — Consignes des conversations filles consultables

- **Statut** : fait (limite de relance implicite de Bob documentée ci-dessous)
- **Dépend de** : 097 (filles), 149 (états sur place)
- **Agents** : les deux ; journal de l’app, indépendant du format des appels d’outils ACP.

## Pourquoi

L’utilisateur veut pouvoir relire le texte exact que la mère adresse à une fille : la consigne
initiale, puis les demandes de correction. Les libellés d’outils raccourcis ne suffisent pas.
Le contenu doit rester replié par défaut dans le fil de la mère.

Il souhaite aussi vérifier qu’une remarque naturelle sur un fichier suffit à faire reprendre
la fille, sans devoir demander explicitement l’envoi d’un message ou nommer la sous-tâche.

## Critères d’acceptation

- [x] Essai réel Bob et OpenCode : comparer une remarque naturelle après une transmission
      explicite et comme premier retour dans une conversation neuve ; consigner le choix réel
      de l’agent, y compris s’il ne reprend pas la fille. La transmission spontanée n’est pas
      une garantie du protocole ACP.
- [x] La ligne de lancement permet de déplier sa consigne initiale complète.
- [x] Chaque message accepté par `message_child` est conservé dans le fil de la mère avec le
      nom de la fille et le texte exact ; il peut être déplié indépendamment.
- [x] Les consignes sont repliées par défaut, accessibles au clavier et relisibles après
      redémarrage. Les sauts de ligne et le texte complet sont conservés, sans limite de 60 caractères.
- [x] Aucun changement de routage, de session, de file d’attente ou de réveil. Les flèches
      arrondies de la barre latérale restent identiques.
- [x] Couverture agent factice, vérification du projet et e2e concernés en clair et sombre ;
      captures relues et limites de validation consignées.

## Plan

1. **Journal typé** : ajouter `ChildInstruction` et l’évènement/élément `child-instruction`
   (`shared/children.ts`, `agent.ts`, `transcript.ts`). `ChildConversations.messageChild` pose
   une seule entrée dans le fil de la mère pour la consigne acceptée, y compris si elle est mise
   en file. Le titre reste neutre (« Consigne pour… »), sans inventer un état de livraison.
   L’entrée ne devient pas une nouvelle nouvelle de fille dans `childNews` : aucun contexte ni
   prompt supplémentaire envoyé au modèle. Le stockage du fil et l’IPC génériques restent les mêmes.
   Pour respecter la limite de 800 lignes de `transcript.ts`, déplacer le corps inchangé de
   `withSubagentWork` dans `subagent.ts`, avec réexport de compatibilité depuis le réducteur.
2. **Interface** : mutualiser un détail natif replié dans `thread/Subtasks.tsx`. La ligne de
   lancement devient dépliable et montre son `prompt` déjà enregistré ; les reprises ont une
   ligne « Consigne pour… » dans `Transcript.tsx`. Texte fidèle, retours à la ligne conservés,
   clavier natif et styles sobres. Aucune modification de la carte d’états ni de `ChildLink`.
3. **Export et traductions** : conserver également les reprises dans l’export Markdown ; clés
   françaises/anglaises, aucune nouvelle dépendance ni migration du format des conversations.
4. **Vérification** : tests du réducteur et de l’export, tests main message au repos/en file
   (une seule entrée, texte identique au message reçu), tests React repli/dépli/exactitude et
   scénario e2e `filles` (échange `message_child` existant). `VITEST_MAX_WORKERS=2 ./scripts/verify`,
   build puis suites choisies par `pnpm e2e --changed`, deux thèmes ; captures regardées.
   Utiliser `ui.enter()` pour l’activation clavier native : elle émet aussi le texte `\r`,
   contrairement à `press('Enter')`, sans remplacer le test clavier par un clic.
   Stabiliser l’essai À propos si le clic qui ferme sa propre fenêtre attend indéfiniment son
   accusé CDP : attendre son effet dans la fenêtre principale, avec les mêmes vérifications.
5. **Documentation** : fiche et index, architecture (nouvel élément du fil), fiche 097 et
   changelogs français/anglais. Les échecs préexistants identifiés par la fiche 149 restent
   signalés ; aucun seuil de test assoupli.

## Journal

- 2026-10-26 — Demande utilisateur et plan rédigé avant l’implémentation.
- Retours explicites testés avec les vrais Bob 2.0.6 et OpenCode 2.1.4/Big Pickle sur les
  conversations des essais 149. Puis essai naturel ci-dessus, sur ces mêmes filles. Les deux
  mères ont spontanément utilisé `message_child`, reformulé les remarques et repris la bonne
  fille. Aucun changement de consigne système effectué pour obtenir ce résultat.
- Le premier script de retour explicite Bob avait deux attentes trop strictes (`oneNewWake` et
  `allReady`) : la fille prévient sa mère par `message_parent`, ce qui évite volontairement le
  réveil automatique en doublon ; la sœur non concernée reste en veille. Reprise, message reçu,
  fichier corrigé, même session/worktree et nouveau compte rendu sont bien observés. Résultat brut
  conservé tel quel (`149-feedback-bob-result.json`), puis attentes corrigées dans le script manuel
  pour les essais suivants ; aucun changement du mécanisme de réveil de l’app.
- Contrôles : mêmes conversations, même session ACP, même worktree, message marqué de la mère,
  activité reprise, trois lignes exactes, sœur et dossier principal inchangés, nouveau compte
  rendu, mère informée et restant active. Les résultats ponctuels ne garantissent pas le choix
  du modèle pour toute formulation ambiguë. Preuves hors git :
  `e2e/captures/149-natural-feedback-{bob,opencode}-result.json` et captures correspondantes.
- Contre-épreuve **Bob dans une conversation neuve**, sans retour explicite préalable : une
  seule fille crée `alpha.txt` (`ALPHA\n`), puis premier retour utilisateur « Ah, je vois que dans
  alpha.txt il manque la ligne RETOUR_UTILISATEUR. ». Bob ne transmet rien : il explique que la
  branche n’est pas fusionnée et demande si deux lignes sont souhaitées. Ni reprise ni correction.
  Ce résultat invalide une promesse de délégation spontanée fiable ; les premiers essais étaient
  influencés par le contexte précédent. Coût initial + retour : **0,19991 bobcoin**. Preuve hors git :
  `e2e/captures/150-fresh-natural-bob-result.json`. Aucun changement de consigne système pour
  forcer le choix du modèle.
- Même contre-épreuve **OpenCode 2.1.4 / Big Pickle**, conversation neuve : la première remarque
  naturelle suffit. La mère reformule et transmet la correction, la même fille reprend sa session
  et son worktree ; fichier à deux lignes exactes, nouveau compte rendu, bilan, dossier principal
  inchangé. **14 contrôles verts**, retour en **25,4 s**, modèle gratuit. La consigne journalisée
  correspond exactement au texte reçu par la fille ; repliée par défaut, elle est dépliable dans
  le fil de la mère. Preuve hors git : `e2e/captures/150-fresh-natural-opencode-result.json` et
  capture `150-fresh-natural-opencode-instruction-light.png`.
- Tests ciblés : **4 fichiers / 79 tests verts**, typage et build verts. Consignes longues,
  multilignes et HTML littéral, repli indépendant ; journal unique au repos ou en file,
  réducteur et export Markdown/JSON. Comparaison à `HEAD` : fonction `ChildLink` et toutes les
  règles CSS `.child-link` strictement identiques.
- Premier `verify` : lint signale un import inutilisé dans le script manuel ignoré et
  `transcript.ts` à 803 lignes comptées. Import retiré, fonction `withSubagentWork` déplacée
  sans modification de son corps ni de son export public ; aucun plafond relevé.
- `VITEST_MAX_WORKERS=2 ./scripts/verify` relancé avec l’accès aux ports locaux des tests ACP/MCP :
  **vert**, lint, typage, **278 fichiers / 2 079 tests**, sans assouplissement. Build vert.
  Le premier passage isolé avait été interrompu : le bac à sable empêchait les tests de serveurs
  locaux. Journal conservé hors git : `e2e/captures/150-verify.log`.
- Premier e2e des consignes : texte et état initial corrects, mais Entrée ne déplie pas dans le
  pilote. Son `press` n’émet que `keydown`/`keyup`, sans `keypress` ; une sonde dans une fenêtre
  jetable le démontre sur un `<summary>` natif indépendant du composant. Même élément + séquence
  native Electron (`keyDown`, `char`, `keyUp`) : `keypress`, clic natif, ouverture. L’essai utilise
  finalement `ui.enter()` déjà présente, qui émet `\r` ; aucun ajout à l’API du pilote n’est
  nécessaire. Aucun gestionnaire clavier artificiel ajouté à l’interface.
- Passage global `pnpm e2e --changed --jobs 3` : **129 tâches en 14 min 41 s**, 116 réussies,
  13 tâches en échec (14 contrôles). Les deux échecs des nouvelles consignes viennent de la
  simulation clavier corrigée ci-dessus. Les contrôles préexistants fusion / simulateur / activité
  réapparaissent, ainsi que des échecs ponctuels fenêtre rapide / sous-agents / Android / terminal.
  Une fenêtre « À propos » a été fermée manuellement pendant l’essai ; celui-ci est donc rejoué
  séparément. Reprise `pnpm e2e about --jobs 1` : **verte dans les deux thèmes**, 15 s.
  Journal global hors git : `e2e/captures/150-e2e.log`.
- Reprise sans concurrence `pnpm e2e filles quick subagents android terminal --jobs 1` :
  **verte**, les dix tâches clair/sombre, **5 min 42 s**. Consignes initiales et de reprise :
  texte exact, ouverture/fermeture native au clavier, retour replié après redémarrage avec le
  même texte ; sauvegarde existante de Bobine, aucun nouveau mécanisme ajouté. Les huit captures
  `150-consigne-{initiale,repliee,reprise,reprise-apres-redemarrage}-{light,dark}.png` ont été
  regardées, ainsi que celles des deux essais réels neufs. Journal hors git :
  `e2e/captures/150-retries.log`.
- **Limite de ce passage, levée par la fiche 151** : restaient les cinq tâches / trois contrôles préexistants déjà
  reproduits sur `HEAD` dans la fiche 149 : observation de l’état intermédiaire de fusion (clair
  et sombre), attente du libellé AXe du simulateur (clair et sombre), confirmation de remise à zéro
  d’activité (clair). Aucun code de ces fonctions ni seuil de test modifié pour les masquer.
  La validation propre aux consignes était verte ; le lot global restait alors partiel.
- Le dernier contrôle À propos retrouve le blocage sur le clic « Nouveautés », malgré le passage
  isolé vert précédent : la page détruit sa cible avant de répondre au `mouseReleased` CDP.
  Alignement de l’essai sur son contrôle Échap existant : clic lancé sans attendre l’accusé de la
  page qui disparaît, puis attente explicite des Nouveautés dans la fenêtre principale et mêmes
  assertions (fenêtre fermée, bon panneau). Aucun changement du produit ni délai relevé.
- Contrôle corrigé `pnpm e2e about --jobs 1` : **vert en clair et sombre, 14 s**. Le passage
  bloqué avait été interrompu proprement par le gestionnaire de signal du lanceur (ses apps
  de test fermées) avant cette relance. Journaux bruts conservés hors git :
  `150-about-before-cdp-fix.log` et `150-about-cdp-retry.log` dans `e2e/captures/`.
- Clôture : lint global et build de livraison verts ; lint et formatage de l’essai À propos
  repassés après son ajustement. `git diff --check` vert. Confiances Bob des seuls dossiers
  temporaires des essais retirées ; connexion IBM et installation conservées. Aucun vrai agent
  ajouté au catalogue e2e ou aux tests automatisés, aucune dépendance nouvelle.

## Clôture — 2026-10-27

- [Fiche 151](151-validation-livraison-familles.md) : `verify` entièrement vert (lint, typage,
  **279 fichiers / 2 084 tests**), build vert, **129 tâches e2e vertes, zéro échec** en clair/sombre
  (`pnpm e2e --changed --jobs 2`, 14 min 36 s). Captures des consignes initiales, de reprise et
  après redémarrage regardées. Les anciens contrôles bloquants et synchronisations du pilote
  sont traités ; aucune extension du protocole ACP ni du mécanisme de sauvegarde.
- Les résultats des essais réels restent ceux consignés : OpenCode a relayé la remarque naturelle
  dans une conversation neuve ; Bob a demandé une précision. L’affichage des consignes ne promet
  pas une décision de délégation implicite du modèle.
