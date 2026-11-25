# 250 — CI digne de confiance avant la rc (lot rc-B)

- **Statut** : en cours (le code est sur la branche ; reste à vérifier sur GitHub après la poussée)
- **Dépend de** : 105 (dépôt public), 115 (lanceur e2e), 145 (préversion Linux), 157 (coût de
  Bob), 218 (publication), 229 (Windows), audit [2026-11-19](../audits/2026-11-19-audit-avant-rc.md)
- **Agents** : les deux (outillage et publication, rien de propre à un agent)

## Pourquoi

L'audit d'avant la rc (B4, B5, QUA-1 à QUA-5, SEC-5 / REL-2, R13 / REL-4) a trouvé une CI qui ne
donne plus de signal fiable. Le job e2e Linux échoue à chaque poussée, et `continue-on-error` le
masque. L'échec connu de `terminal` cache les autres. 6 des 9 derniers échecs de `main` viennent de
tests unitaires qui attendent une durée fixe. Le `.dmg` part sans somme ni preuve de provenance.
macOS 13 est annoncé sans être déclaré.

## Critères d'acceptation

- [x] `terminal` en quarantaine sous Linux seulement : déclarée dans `e2e/catalog.mjs`, avec sa
      raison et sa fiche. Le lanceur la dit à chaque passage (annotation sur GitHub). La suite
      n'est alors plus « complète », et nommée, elle joue quand même. Testé (`e2e-select.test.ts`).
- [x] Causes des autres échecs Linux relevées sur 14 passages, corrigées quand la cause est
      comprise, sinon instrumentées (voir le journal).
- [ ] Job Linux vert plusieurs fois de suite, puis `continue-on-error` retiré (dernier commit de la
      branche, à garder seulement après ces passages : voir « Reste à vérifier »).
- [x] e2e macOS chaque nuit (`schedule`), gratuit sur un dépôt public.
- [x] Attentes fixes des tests unitaires listés remplacées par des attentes d'évènement,
      `vi.waitFor` ou des horloges simulées, sans assertion affaiblie ni délai de produit touché.
- [x] Règle ESLint : pas de `setTimeout(…, N ≥ 100)` littéral dans un test sans
      `eslint-disable … -- raison`.
- [x] Renderer : crochets « après » dans l'ordre écrit (`sequence.hooks: 'list'`), `cleanup()`
      avant la restauration dans `useTips`, `SessionTab` et `useGitStatus`. 938/938 verts.
- [x] `release.yml` : `SHA256SUMS-macos-arm64.txt` et attestation de provenance
      (`actions/attest-build-provenance` épinglée par SHA). Permissions `id-token` et
      `attestations` sur le seul job `publish`. Vérification documentée dans
      `docs/installation.md`.
- [x] `mac.minimumSystemVersion: '13.0'`, vérifié contre le README par un test et dans
      `release.yml` (Info.plist). Essai natif du `.dmg` sur `macos-14` avant toute publication.
- [ ] 10 passages Windows de `ci.yml` verts d'affilée (audit B5) : seulement après la poussée.

## Plan

1. Quarantaine : `quarantine` (par `process.platform`) dans `CatalogEntry`
   (`scripts/e2e-select.mts`), avec `quarantinedOn()` pur et testé. Appliquée par `e2e/run.mjs`,
   déclarée sur `terminal` dans `e2e/catalog.mjs`.
2. Échecs Linux intermittents, par cause :
   - clics perdus quand le fil défile entre la mesure et l'appui (`filles-tech-lead`, `fil`,
     `commit-redige`) : `ui.click` regarde ce qui est sous le pointeur avant d'appuyer et vise de
     nouveau (`e2e/lib.mjs`) ;
   - molette de `browser-view` : attente fixe de 800 ms remplacée par l'attente d'une page
     immobile ;
   - « openbox s'est arrêté au démarrage » (suites à 0 s) : `scripts/with-wm` garde sa sortie,
     la dit, et le relance deux fois au plus (c'est l'écran de l'essai qui manque, pas l'app) ;
   - fenêtre rapide pas vue ouverte (`quick`, toujours la première tâche) : cause non trouvée
     sans machine Linux, l'essai dit désormais les évènements de la fenêtre (montrée, masquée,
     focus).
3. `e2e.yml` : `schedule` de nuit pour macOS (délai porté à 90 min), noms et commentaires du job
   Linux, puis `continue-on-error` retiré dans un commit à part.
4. Tests unitaires (B5) et règle ESLint ; QUA-1/2 dans `vitest.config.ts`.
5. `release.yml` : somme du `.dmg`, attestation dans `publish`, `LSMinimumSystemVersion` vérifié,
   job `dmg-macos-14`. `electron-builder.yml` : section `mac` seulement (le lot rc-A touche aux
   fusibles). Doc : `docs/installation.md`, et `CHANGELOG.md` / `CHANGELOG.en.md`.

Aucune nouvelle dépendance npm. Une action GitHub en plus :
`actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8` (v4.2.2), suivie par
Dependabot comme les autres.

## Journal

- 2026-11-19 — Relevé des 14 derniers passages du job Linux (`gh run view --log`), suite par
  suite :

  | Suite | Échecs | Cause | Traitement |
  |---|---|---|---|
  | `terminal` (×2 thèmes) | 14/14 | flèche powerline encrée à −0,59 px (fiche 145) | quarantaine Linux |
  | `filles-tech-lead` | 9/14 | clic « Ouvrir » sans effet, la mère reste ouverte (capture) | clic visé de nouveau |
  | `quick` (1ʳᵉ tâche) | 6/14 | fenêtre rapide pas visible en 5 s | évènements dits à l'échec |
  | `perf` | 6/14 | durées de la machine (déjà hors du verdict) | inchangé |
  | `browser-view` | 4/14 | molette sans effet (scrollY 0) après une pause fixe | attente d'une page immobile |
  | `gitlab`, `branch` | 3/14, 2/14 | anciens (avant le 2026-11-17), plus revus depuis | à surveiller |
  | `permissions` | 2/14 | carte jamais vue | non traité (pas de trace exploitable) |
  | `fil`, `commit-redige` | 2/14, 1/14 | clic sur un bouton du fil | clic visé de nouveau |
  | `fresh-start`, `relecture`, `roles-export` | 1/14 chacune, à 0 s | openbox arrêté au démarrage | sortie dite, relancé |

- 2026-11-19 — Tests unitaires : relecture de tous les échecs de `ci.yml` (30 passages). Sur
  `main`, 3 fois `journal.test.ts` --cout-bob (44439977234, 44413453495, 43852489674), qui
  dépassait son attente maison de 6 s. Une fois `agent-host` ask_user (déjà corrigé), une fois
  `conformance-bob` « plafond de coût » (corrigé par la fiche 235). Le dépassement de la grille Bob
  « reprise après redémarrage » ne s'est vu que sur la branche 229-lot-7a, et ne revient plus
  depuis `CONCURRENT_JOURNEYS = 2`. Les grilles gardent un `settleMs` fixe dans `harness.ts`, qui
  n'est pas un fichier de test : à revoir après la rc. Course réelle trouvée dans
  `scenarios-opencode-2-3.test.ts` : l'agent factice enregistrait la session après l'envoi, et les
  600 ms la masquaient.
- 2026-11-19 — Ajout du coordinateur : `commit-redige` sombre, « délai dépassé puis Arrêter »,
  un seul pid relevé sur deux (une fois, sous 3 jobs). Cause : « Arrêter » partait 500 ms après
  « Réessayer », durée devinée. Sous charge, c'était avant que l'agent de la nouvelle rédaction
  ait inscrit son pid. L'app est juste : un arrêt pendant le démarrage annule le lancement
  (`launchToken` d'`AgentHost`), ou tue l'agent avant qu'il écrive son pid. Ce n'est donc pas un
  défaut du produit. L'essai attend maintenant que le second agent soit lancé (son pid inscrit)
  avant d'arrêter, et vérifie ce lancement. Même famille dans `agent-host.test.ts` (« détachée
  par l'agent », « dans le groupe de l'agent ») : les `sleep` étaient comptés sur toute la
  machine. Seuls ceux qui descendent du processus de l'essai sont relevés maintenant, puis suivis
  par leur pid. Trois copies en parallèle : vertes, là où l'ancien comptage en voyait 3. Reste
  global : « agent tué par kill -9 » compte encore les `sleep 31.7` de la machine. Le sien est
  rattaché à init après la mort de l'agent, et ne peut donc pas être retrouvé par ses ancêtres.
  Risque faible : il n'existe que pendant cet essai.
- 2026-11-19 — e2e macOS de nuit : le job Mac de `e2e.yml` n'a encore jamais tourné sur le dépôt
  public (aucun lancement à la main depuis le 2026-11-10). Sa première nuit dira s'il tient sur un
  runner GitHub. Les minutes des runners standard (macOS compris) sont gratuites pour un dépôt
  public.

- 2026-11-19 — Vérifié sur le Mac : `./scripts/verify` vert (523 fichiers, 4914 essais, 3
  sautés). Suites touchées vertes en clair et sombre (`quick`, `browser-view`, `commit-redige`,
  `filles-tech-lead`, `fil`, `terminal` : 12/12). Comme `ui.click` sert à toutes les suites, la
  suite complète a été jouée une fois : verte (19 min, machine partagée). Sous Linux, rien n'a été
  joué en local : Docker n'était pas lancé, et une seule campagne tourne à la fois sur la machine.
  La preuve viendra du job Linux après la poussée.

- 2026-11-22 — Trois tests unitaires instables, corrigés à la cause (branche
  `fix/essais-instables-unitaires`). Ni délai allongé, ni nouvelle tentative de l'essai, ni essai
  sauté :

  | Essai | Cause | Correctif | Preuve |
  |---|---|---|---|
  | `children-review` « Relancer ne garde rien » (Windows, 44894413723) | Deux choses. (1) Le démarrage de l'agent de l'auteur a pris 9,4 s au lieu de 0,5 à 1 s : c'est le ralentissement général des runners Windows déjà relevé (fiche 229), pas l'essai ; l'essai prend 3 à 4 s dans les passages verts. (2) Un vrai défaut : `stopAll` (fin de chaque essai, fermeture de l'app) arrêtait l'agent du relecteur en plein démarrage, `start()` rendait la main comme réussi, puis son premier message relançait l'agent. Ce fantôme faisait son tour et ses commandes git pendant l'essai suivant (5 par passage du fichier, relevés dans le journal). À la fermeture de l'app, c'était un agent lancé après l'arrêt. | `AgentHost.stop({ forGood: true })`, appelé par `stopAll` : `start()` est ensuite refusé. Un `stopAll` suivi d'une nouvelle conversation (essais « dossier disparu » sous Windows) marche comme avant : nouvelle conversation, nouvel hôte. | `manager-send-order.test.ts`, deux essais (arrêt pendant la garde du dossier, arrêt pendant le démarrage) : rouges sans le correctif, verts avec. Fichier `children-review` : 0 relance après arrêt (5 avant), 21 s au lieu de 33 s sur le Mac. Le ralentissement général, lui, n'est pas corrigé ici. |
  | `bob-costs` « veille de la base » (Mac, suite complète) | Sous macOS, `fs.watch` ouvre son flux FSEvents en différé (libuv, sur son fil CoreFoundation). L'écriture faite juste après l'appel n'est jamais signalée, et l'essai attendait jusqu'à ses 15 s. Mesuré pendant `./scripts/verify` : 14 écritures perdues sur 400 faites aussitôt après `watch`, 0 sur 280 une fois la veille vue armée. Seul, rien n'est perdu. | L'essai attend que la veille soit armée (un fichier témoin, hors de la base, est écrit jusqu'à être vu), puis fait une seule écriture du coût. La logique de tri des noms (base, `-wal`, `-journal`, `-shm`, nom inconnu, autre fichier, erreur de la veille) est essayée à part, avec des évènements donnés par l'essai (`watchBobDb` reçoit sa fonction de veille). L'app ne change pas : elle relit le coût à la fin du tour, puis à 1,5 s et 5 s. | 10 passages seuls d'affilée, verts ; et dans les deux `verify`. |
  | `mock-agent/store` (Windows, `rename` en `EPERM`) | Pas retrouvé dans les 40 derniers passages de `ci.yml`, ni dans les échecs de `e2e.yml` : correctif sur l'analyse, sans trace. Sous Windows, remplacer un fichier qu'un autre processus a ouvert à cet instant échoue en `EPERM`, `EACCES` ou `EBUSY` jusqu'à ce qu'il le referme. C'est le cas d'un autre agent factice qui relit le dossier pour `session/list`, ou de l'antivirus. En plus, deux agents factices sur le même dossier écrivaient le même `.tmp`. | `replaceFile` : sous Windows seulement, nouvel essai borné sur ces trois codes (10 essais, 3,27 s d'attente en tout), comme graceful-fs ; ailleurs, l'erreur est rendue telle quelle. Temporaire propre au processus (`<id>.json.<pid>.tmp`), supprimé si le remplacement échoue. | `store.test.ts` : nouvel essai puis réussite, abandon borné, autres systèmes et autres erreurs rendus tout de suite, enregistrement réel sans temporaire laissé. |

  Remarque laissée telle quelle : dans `children-review.test.ts`, plusieurs `waitFor` ont un délai
  de 20 s, au-delà des 15 s de l'essai. C'est le délai de l'essai qui tombe, sans dire quelle
  attente bloquait.

- 2026-11-23 — Recette avant la 1.0.0-rc.4 (branche `fix/chasse-correctifs`) : fil retenu par une
  carte de travaux, nouveauté en bas invisible.
  - Constat : pointeur immobile sur une carte `data-scroll-hold` (`/scenario filles`, deux
    « Lancer »), la mère finit par demander « Autoriser cette modification ? » sous le bord ; le fil
    reste en place (voulu), mais la flèche « Aller en bas » n'apparaît pas : `measureBottom` ne
    relevait rien tant que `held`.
  - Correctif (`useThreadScroll`) : pendant le maintien, `measureBottom` relève l'écart au bas
    pour la flèche (`atBottom`), sans toucher au suivi (`stickToBottom`, rattrapé à la sortie de la
    carte) ni défiler. La flèche est posée sur le fil, hors de la colonne : la carte ne bouge pas, et
    son compte « 1 nouveau » (fiche 185) dit ce qui est arrivé. Pendant un appui (`pressing`),
    rien ne change : le relevé attend le relâché.
  - Décision : une carte qui attend une décision (autorisation) **ne libère pas** le maintien.
    Libérer ferait défiler le fil, donc glisser sous le pointeur la ligne qu'il vise, exactement ce
    que le maintien empêche (fiches 124, 250) ; un clic parti à ce moment tomberait ailleurs. La
    demande est signalée sans rien déplacer : la flèche et son compte, la main ✋ de la barre
    latérale (déjà là) ; le fil la montre dès que le pointeur quitte la carte.
  - Preuves : `useThreadScroll.test.ts`, « retenu par une carte, du nouveau arrive en bas hors de
    vue » : rouge sans le correctif (`expected true to be false`), vert avec. Sonde réelle (build,
    agent factice, sombre) : carte immobile (haut 173 → 173 px), flèche « ↓ 1 nouveau » montrée,
    autorisation hors de la vue.
- 2026-11-23 — Seconde chasse rc.4 : pendant un appui sur une ligne de travail (`pressing` de
  `useThreadScroll`), ce qui arrivait en bas ne montrait pas la flèche « Aller en bas » avant le
  relâché. `measureBottom` traite l'appui comme le maintien : il mesure `atBottom` (la flèche),
  sans toucher au suivi ni défiler. Preuve : `useThreadScroll.test.ts` (« près du bas sans y
  être… » : flèche pendant l'appui, partie au relâché), rouge sans le correctif.
- 2026-11-24 — Release 1.1.0-rc.1 (run 45289731873, job « .deb (Linux x64) », 1ʳᵉ tentative) :
  tests unitaires tous verts, mais Vitest a attrapé « write EPIPE » non géré
  (`src/main/simulator/run.ts:67`, pendant `file-tree.test.ts` « hors dépôt : `null` »).
  `gitIgnored` passe la liste à `git check-ignore --stdin` par `runCommand` ; hors dépôt, git sort
  aussitôt (128) sans lire son entrée, et l'écriture dans le tube fermé levait une erreur sur
  `child.stdin` sans écouteur : exception non gérée du main (l'app aussi, pas seulement l'essai),
  selon la course entre la sortie de git et l'écriture. **Défaut de l'app** : `runCommand` écoute
  désormais `error` sur l'entrée de l'enfant (sans objet, le code de sortie est rendu par le
  rappel) et n'écrit que dans un flux encore `writable`. Preuve : `src/main/simulator/run.test.ts`
  (vrai enfant Node qui sort sans lire 8 Mio d'entrée : code rendu, aucune `uncaughtException`),
  rouge 3/3 sans le correctif, vert 3/3 avec. Les autres écritures vers un enfant
  (`mcp-probe.ts`) avaient déjà leur écouteur.

- 2026-11-24 — `settings` sous Linux (CI `main`, run 45412768605) : « délai dépassé :
  !…app-menu-content », le menu ☰ ne se refermait pas après Alt. **Pas les lots de vitesse** : même
  échec avant eux (run 45373764336, `482405f4`), intermittent (vert sur `b83c6f64`). **Défaut de
  l'app** (`AppMenu.tsx`), rejoué sur Mac avec `BOBINE_PLATFORM=linux` : quand Alt rouvre le menu
  juste après Échap, Radix rend le focus au bouton ☰ *après coup* (minuterie du `FocusScope`) ; ce
  focus, hors du menu non modal rouvert, le refermait aussitôt (relevé 2 fois sur 3 sans animation).
  Capture de la CI conforme : menu affiché, focus et infobulle sur ☰, aucune entrée active — le menu
  refermé encore à l'écran (sortie de `Presence`), puis l'Alt suivant le rouvrait d'après un état
  périmé. Corrigé à la cause : état demandé tenu dans une référence (`wanted`) à jour dès l'appel —
  Alt bascule d'après lui, le modèle lu après une fermeture n'ouvre plus rien, et le focus rendu par
  une fermeture est ignoré si le menu a été rouvert entre-temps. Essais unitaires `AppMenu.test.tsx`
  (Alt aussitôt après Échap ; Alt deux fois avant la lecture du modèle), rouges sans le correctif.
  `settings` (`BOBINE_PLATFORM=linux`, 4 × 2 passages) : fermetures, sous-menus, Aurore nuit verts ;
  seules restent les vérifications de la barre d'Electron, propres au Mac. À relancer : `settings`
  sur GitHub Linux.

## Reste à vérifier sur GitHub (après la poussée)

1. `e2e.yml` lancé à la main sur la branche, `systeme: linux`, trois fois. Chaque passage doit
   être vert, avec l'annotation « e2e terminal en quarantaine (linux) ». Si oui, garder le dernier
   commit (`continue-on-error` retiré) ; sinon le retirer et noter ici ce qui échoue encore.
2. Le lendemain de la fusion : le passage de nuit macOS (`schedule`) et sa durée ; avant, sur la
   branche `ci/nuit-macos-ecran`, l'étape « Écran 1920 × 1080 » verte (journal du 2026-11-23).
3. `ci.yml` sous Windows : 10 passages verts d'affilée (audit B5).
4. Au premier tag (rc.1) : `SHA256SUMS-macos-arm64.txt` et les attestations dans la Release.
   Vérifier ensuite `gh attestation verify Bobine-<version>-arm64.dmg --repo jlallement/bobine`
   et le job `dmg-macos-14` (label `macos-14` encore servi par GitHub).

- 2026-11-19 — Publication de 1.0.0-rc.1 : le job `dmg-macos-14` de `release.yml` n'a pas pu
  démarrer (« The configuration 'macos-14-arm64-us-default' is not supported » : GitHub a retiré
  le runner macOS 14). Il bloquait `publish`, donc rien n'a été publié. Job retiré ; le `.dmg` reste
  essayé sur macOS 15 (job `dmg`). Le minimum déclaré (macOS 13, `LSMinimumSystemVersion`) n'est
  donc essayé sur aucun système plus ancien que 15 : écart connu, à couvrir par un essayeur.
- 2026-11-19 — Décision de Jérôme : minimum relevé à **macOS 15 Sequoia** (`minimumSystemVersion:
  '15.0'`), le plus ancien macOS que GitHub permet d'essayer ; README fr/en, `installation.md`,
  notes de version, contrôle d'Info.plist de `release.yml` et `scripts/signing.test.ts` alignés ;
  ligne dans les deux changelogs (rc.1). R13 : la promesse est désormais celle qui est essayée.

- 2026-11-22 — Suites instables, corrigées à la cause (branche `fix/essais-instables-e2e`) :
  - `filles-fusion` (Mac, sombre, « délai dépassé » en attendant `work-open`) : reproduit 1 fois
    sur 8 sous charge (avec `filles`, `filles-tech-lead`, `travaux-groupe`), avec un relevé des
    évènements du pointeur. L'appui tombait sur le nom de la ligne (`work-row-name`, scrollTop
    1885), le relâché 5 ms plus tard sur la ligne elle-même (`work-row`, scrollTop 1864,5) : le fil
    avait bougé de 20,5 px entre les deux, le `click` est allé à la ligne, pas à son bouton, et
    rien ne s'est déplié. Cause : la mère, réveillée par ses filles finies, termine son tour
    pendant le premier dépliage ; le bas du fil rétrécit, le fil collé en bas remonte. L'essai
    attend désormais la réponse de la mère réveillée puis `ready()` avant de toucher aux lignes.
    Reste côté produit (non corrigé, à juger) : un clic humain sur une ligne au moment exact où un
    tour finit peut aussi se perdre ; `data-scroll-hold` empêche le fil de suivre le bas, pas le
    recalage du navigateur quand le contenu rétrécit.
  - `branch` (Linux, clair et sombre, « Réessayer » : README pas réécrit) : la branche s'affiche
    avant que son message parte (`manager.branch` n'attend pas le tour) et son agent, à peine
    démarré, est « Prêt » pendant la préparation du message (`AgentHost.prompt`) : `ready()`
    passait avant le tour. L'essai attend le message rejoué dans la branche (il n'apparaît
    qu'avec l'agent « répond… », comme pour `ui.send`), puis `ready()`.
  - `permissions` (Linux, clair, carte jamais vue) : l'agent factice retirait sa demande 3 pas
    (120 ms) après l'avoir faite ; la carte pouvait naître et disparaître entre deux lectures de
    l'essai (toutes les 100 ms, plus sous charge). Nouveau scénario `annulation-par-agent-sur-signal`
    (`agentCancels.whenFile`) : l'agent retire sa demande quand l'essai pose un fichier signal dans
    le dossier de la session, après avoir vu la carte armée et l'avoir capturée (la capture
    `c2-demande-avant-retrait` la montre enfin). `annulation-par-agent` (3 pas, comme Bob) reste ;
    essai unitaire du retrait au signal dans `agent-host.test.ts`.
  - Preuve sur le Mac : 5 passages d'affilée de `filles-fusion` (avec ses trois voisines) et de
    `branch permissions`, clair et sombre, codes de sortie 0 ; captures regardées. Rien n'a été
    joué sous Linux (pas de machine Linux ici) : l'issue #16 se fermera sur des passages verts du
    job Linux après la poussée. Vu en passant, non traité : `filles` (« mère supprimée : la
    confirmation nomme ses 3 filles… »), rouge 1 fois sur 4 sous la même charge.

- 2026-11-22 — Deux tests unitaires instables sous `./scripts/verify`, corrigés à la cause
  (branche `fix/essais-instables-2`). Ni délai allongé, ni nouvelle tentative, ni essai sauté, ni
  pause fixe :

  | Essai | Cause | Correctif | Preuve |
  |---|---|---|---|
  | `ChangesTab` « sa ligne, si le diff la contient : amenée à l'écran et mise en avant » (0 appel à `scrollIntoView` alors que `tr.diff-focus` est là) | Ordre réel dans `DiffView` : la classe `diff-focus` est posée au rendu (commit), l'appel `scrollIntoView({ block: 'center' })` vient de l'effet passif qui suit. Hors `act` (le diff arrive d'une promesse, `waitFor` relâche l'environnement d'`act`), React joue cet effet dans une tâche plus tard : sous charge, le `waitFor` voyait la classe entre les deux. L'app est juste : l'effet suit chaque rendu où `focus.seq` ou le diff change, et rien ne pose la classe sans un nouveau `seq` (`lineFocus`), donc la ligne est toujours amenée à l'écran. | L'essai attend l'appel lui-même (`waitFor` sur `scroll`) et vérifie qu'il vise bien la ligne mise en avant (`mock.contexts`). `Element.prototype.scrollIntoView` (absent de jsdom) est rendu tel quel en fin d'essai (`onTestFinished`). | 10 passages seuls d'affilée, verts ; 3 passages pendant `pnpm test`, verts ; et les deux `verify`. |
  | `agent-host-opencode-2-3` (ENOTEMPTY dans `afterEach`, une fois sur « deux rapports… », une fois sur « question d'un sous-agent… » ; relevés dans deux journaux de `verify`) | Ce n'était pas une attente de l'essai : `rmSync` du dossier de l'agent factice échouait en ENOTEMPTY. `host.stop()` envoie SIGTERM au groupe sans attendre la sortie. Juste avant, l'agent factice réécrit sa session (`afterTurnPlayed` → `persist`, temporaire puis `rename`) après le dernier morceau de sa réponse hors tour, celui que l'essai attend. Un appel système déjà en cours se termine après le signal et crée un fichier pendant `rmSync`. Rejoué hors de l'app (écrivain en boucle dans son groupe, SIGTERM puis `rmSync` aussitôt) : 6 échecs ENOTEMPTY sur 1 000 ; 0 sur 1 000 en attendant la sortie du processus, 0 sur 1 000 en attendant que le groupe soit vide. Même défaut latent dans `agent-host-background` et `agent-host-compaction` (même nettoyage). | `afterEach` attend que les agents arrêtés soient sortis (`settleStoppedTrees`, ce que l'app fait en quittant) avant de supprimer les dossiers, dans les trois fichiers. Il exige 0 groupe tué de force : un agent encore là après le délai serait une vraie anomalie, dite en rouge. L'app ne change pas. | 10 passages seuls du fichier d'affilée, verts ; 3 passages pendant `pnpm test`, verts ; et les deux `verify`. Le défaut d'origine ne s'est pas reproduit dans l'essai lui-même (10 boucles pendant `pnpm test`, 24 copies en parallèle avec ou sans 15 processus `yes`) : il demande un appel disque bloqué au moment du signal. La preuve de la cause est le rejeu ci-dessus. |

  Limite connue : sous Windows sans objets de tâche (essais), `stopGroup` arrête par le handle et
  ne note rien à attendre ; `settleStoppedTrees` y rend la main aussitôt. Aucun ENOTEMPTY relevé
  sous Windows pour ces fichiers.

- 2026-11-22 — Clic perdu à la fin d'un tour, et `filles` instable : deux défauts de l'app,
  corrigés à la cause (branche `fix/clic-perdu-et-filles`). Ni délai allongé, ni nouvelle
  tentative, ni essai sauté, ni pause fixe :

  | Essai | Cause | Correctif | Preuve |
  |---|---|---|---|
  | `filles-fusion` (clic sur une ligne de travail perdu, relevé plus haut) | Défaut de l'app, pas de l'essai. Relevé sous charge : au moment de l'appui, `scrollHeight` du fil vaut la hauteur de la colonne plus environ 29 px de marge du bas (marge du dernier élément, qui déborde de la colonne) ; la mère finit son tour, la colonne grandit de 7,5 px mais la marge disparaît : le fil perd environ 21 px, le navigateur borne le défilement (1885 → 1864,5) et le contenu remonte sous le pointeur. `data-scroll-hold` empêche le suivi du bas, pas ce bornage. | `useThreadScroll` : pendant un appui du bouton principal dans le fil (`pointerdown` → `pointerup`/`pointercancel`, ou perte du focus de la fenêtre), la colonne garde en `min-height` la hauteur de défilement du moment (comptée depuis le haut de la colonne dans le contenu qui défile : `offsetTop` part d'un autre parent, 52 px d'écart relevés). Libérée à la tâche suivante, après le `click`. Rien ne change au repos ; à l'appui, la hauteur réservée est exactement celle du moment (relevé : `scrollHeight` 2494 avant et après l'appui). Le fil ne reprend sa vraie hauteur qu'au relâché. Non couvert : un fil qui s'agrandit parce que la zone du bas (saisie) rétrécit pendant l'appui ; pas observé ici. | `useThreadScroll.test.ts` (bornage du navigateur reproduit dans l'essai) : rouge sans le correctif (2 essais), vert avec. L'attente « Mes travaux ont fini » ajoutée à `filles-fusion` pour contourner le défaut est retirée. |
  | `filles` (« mère supprimée : la confirmation nomme ses 3 filles… » et « case décochée », ensemble) | Défaut de l'app. La troisième fille (`attend-stop`) est lancée dans un worktree : pendant sa préparation (worktree, agent, consigne pas encore partie, fiche 223) son statut est `starting`. La barre latérale la montre déjà « en cours » (`childState` : `busy` ou `starting`), et c'est ce qu'attend l'essai ; la confirmation, elle, ne signalait que `busy` (`familyOf`). Relevé dans 6 passages sur 6 sous charge : au moment où l'essai voit « en cours », le statut est `starting` ; la confirmation lit la descendance environ 320 ms plus tard. Quand la préparation dure plus longtemps (charge), la fille au travail n'est pas signalée, et les deux contrôles tombent. Un utilisateur aurait vu « en cours » dans la barre latérale et rien dans la confirmation. | `familyOf` suit `childState` : une fille qui démarre est « en cours, sera arrêtée » comme dans la barre latérale ; celle qui attend un accord ou a fini ne l'est pas (inchangé). | `family-delete.test.ts`, « confirmation : qui est en cours » : rouge sans le correctif (`['a']` au lieu de `['a', 'b']`), vert avec. |

  Preuve sur le Mac : `filles-fusion filles travaux-groupe --jobs 3`, clair et sombre, 5 passages
  d'affilée, codes de sortie 0 (30 tâches vertes) ; avant cela, 9 passages de diagnostic de
  `filles filles-fusion filles-tech-lead travaux-groupe --jobs 3`, tous verts (le défaut de
  `filles` ne s'est pas montré en rouge pendant ces passages : la cause est établie par le relevé
  du statut, pas par un échec rejoué). Captures regardées (`filles-4a-confirmation`,
  `264-groupe-fusionne`). Rien n'a été joué sous Linux ni sous Windows.

- 2026-11-23 — Job Linux rouge après la fusion de `fix/clic-perdu-et-filles` (45048839307 :
  `travaux-groupe` clair, `autorisation-commande` clair, `subagents` clair et sombre ; `perf` reste
  indicative), et nuit macOS rouge. Branche `fix/ci-linux`. Relevé des 11 derniers passages Linux
  de `main` : `travaux-groupe` 3 fois (deux formes), `quick` et `filles` 1 fois (déjà traitées),
  le reste vert. Reproduit en local sous Linux (`pnpm e2e:linux`, conteneur à 1 processeur,
  `--jobs 3`), avec un nouveau relevé de `ui.click` : où sont tombés l'appui, le relâché et le
  clic quand ce n'est pas sur la cible (`⚠ clic manqué : …`, dit sans échouer).

  | Échec | Cause | Correctif | Preuve |
  |---|---|---|---|
  | `autorisation-commande` (« Autoriser une fois » sans effet), `travaux-groupe` (« Ouvrir sa conversation » sans effet, `title-origin` jamais vu) | Défaut de l'app, apporté par le correctif du 2026-11-22 (`useThreadScroll`). Relevé : « appui sur `button.btn.primary` « Autoriser une fois », relâché sur `div[permission-agent-always-note]` ». À l'appui, la colonne reçoit sa hauteur gardée (`min-height`), qui reprend dedans la marge du bas : elle change de taille, le `ResizeObserver` la voit, et le fil, à moins de 60 px du bas sans y être (l'essai venait d'amener la carte à l'écran), était ramené tout en bas entre l'appui et le relâché. Même chose si un élément arrivait pendant l'appui (réponse de l'agent). Sur le Mac, appui et relâché tombent dans la même image ; sous Linux chargé, une image passe entre les deux. Relevé sur `autorisation-commande` ; pour `travaux-groupe`, d'après la capture de la CI (fil arrêté quelques dizaines de px au-dessus du bas, la ligne « Pas encore transmise » à demi cachée), sans relevé du clic. | `useThreadScroll` : pendant un appui dans le fil (`pressing`), le suivi du bas attend : ni le redimensionnement, ni un élément qui arrive, ni la sortie d'une carte `data-scroll-hold` ne déplacent le fil ; `measureBottom` ne relève rien. Au relâché (après le `click`), le fil rattrape le bas s'il le suivait. Un envoi (`followSent`) l'emporte sur l'appui. | `useThreadScroll.test.ts`, « près du bas sans y être… » : rouge sans le correctif (`expected 1000 to be 770`), vert avec. Sous Linux chargé : `autorisation-commande` rouge dans 3 passages sur 6 avant (clair ou sombre), vert dans les 3 passages après (6 tâches sur 6). |
  | `subagents` (clair et sombre, « OpenCode : consigne complète… » puis « Voir son travail » jamais là) | L'essai cliquait sur la ligne du sous-agent dès qu'il était fini ; la réponse de l'agent arrive juste après et le fil, en bas, remonte la ligne de sa hauteur. En plus, l'essai attendait `subagent-answer`, présent dans la page même replié : rien ne vérifiait que le clic avait déplié la ligne. Reproduit sous Linux chargé (capture identique à celle de la CI). | L'essai attend la fin du tour (`ready()`), comme pour OpenCode 2 juste après, puis vérifie `open` après le clic. Le correctif de l'app ci-dessus couvre aussi la réponse qui arrive pendant l'appui. | Rouge sous Linux chargé avant le correctif de l'essai (capture `echec-subagents-01-OpenCode…`, comme en CI), plus jamais cette forme sur les 8 passages suivants (16 tâches). |
  | `travaux-groupe`, conflit (44739785795, 44894413689 : `subtasks-merge-result` jamais `conflict`) | Capture : « 1 travail fusionné », seule « Notes de version » fusionnée, « Page d'aide » relue après. L'essai attendait le bouton actif : il l'est dès qu'une branche est prête, avant que l'autre commit ait été relu. | L'essai attend « Fusionner les 2 prêts dans main » (les deux branches commitées vues prêtes), pas seulement un bouton actif. | Pas reproduit en local (la partie conflit est passée dans les 9 passages sous charge) : correctif d'après la capture. |
  | `filles-tech-lead` (45137631294, relancé sur `main` pour la statistique : « pastille Recommandée, le recommandé proposé ») | Même famille que le conflit : au retour à la mère, la carte montre le dernier plan lu (`readPlan`, `exact: false`, avant les commits : « 3 modifications non commitées ») le temps de relire les branches. L'essai lisait le libellé une seule fois, dès que le bouton existait. | L'essai attend le libellé du plan relu (« Fusionner le recommandé dans main »), puis vérifie comme avant. | Capture de la CI ; pas reproduit en local. |
  | Molette (`ui.wheel`) | Pas une cause relevée en CI, mais une course réelle : essai hors de l'app (Electron, CDP), `Input.dispatchMouseEvent` rend la main avant que la page ait reçu l'évènement `wheel` (0 reçu lu juste après, même sans charge). Une carte d'autorisation désarmée par cette molette pouvait se montrer encore armée à l'essai. | `ui.wheel` attend que la page ait reçu la molette (compteur posé en capture sur `window`). | Essai hors de l'app ci-dessus. |

  Vus sous Linux à 1 processeur seulement (trois apps pour un cœur), jamais en CI, non traités :
  `subagents` « durée et coût pendant qu'il travaille » (le coût est lu avant la première seconde,
  « < 1 s ») et un démarrage de l'app au-delà de 15 s (`ready()`). Sur GitHub, les trois suites
  seules sont vertes (45137639736, `main`) ; la suite complète relancée sur `main` (45137631294)
  retombe sur les mêmes échecs (`title-origin`, conflit, `subagents`) plus `filles-tech-lead`.

  Preuve sur le Mac : `./scripts/verify` vert (579 fichiers, 5656 essais, 3 sautés) ; suite e2e
  complète, clair et sombre (`useThreadScroll` et `ui.click` servent partout), verte en 22 min
  (236 tâches, code de sortie 0) ; captures regardées par sondage (`g2-sous-agent-opencode`,
  `264-travail-ecrit`). Sous Linux : seulement le conteneur local ; la preuve reste à faire sur le
  job de GitHub après la poussée (trois passages verts d'affilée, issue #16).

  Nuit macOS (45016538870, et de même 44896745072, 44728439297 : 44 à 45 tâches rouges chaque
  nuit, l'étape anglaise jamais jouée) : ce n'est pas d'abord la lenteur. L'écran du runner
  `macos-15` fait 1024 × 768 : la fenêtre de l'app (1280 × 820 par défaut) y est ramenée à
  1024 × 688 (« fenêtre 1024 » dans le journal de `panel`, « relance : fenêtre à sa place
  {…1024…} » dans `startup`). Les suites qui supposent la taille habituelle tombent : `startup`,
  `panel` (panneau à 280 px au lieu de 320), `session`, `dossiers`, `debordements` (panneau
  absent), `composer` (« accueil à 760 px »), `plan`, `sommaire`, `degrade-haut`, `fun`
  (barres du sommaire absentes), `aurore`, `rules`, `browser-view`, `travaux-groupe`… S'y
  ajoutent des mesures liées à la machine (`perf` : gros diff 5000 en 2693 ms ; `simulator`,
  `android` : 4 à 5 images/s). Rien n'est changé ici : il faut agrandir l'écran du runner avant
  les essais (à essayer sur GitHub, aucun outil vérifié), ou ne garder de nuit que ce qui tient
  dans 1024 × 768 ; décision à prendre.

- 2026-11-23 — Décision de Jérôme : agrandir l'écran du runner macOS avant les essais (branche
  `ci/nuit-macos-ecran`). Nouvelle étape « Écran 1920 × 1080 » du job macOS de `e2e.yml`, juste
  avant les essais : `scripts/ci/macos-screen.sh`.
  - Outil : `displayplacer` (« XRandR pour macOS »), formule `homebrew/core` 1.4.0, licence MIT,
    bouteille vérifiée par Homebrew (SHA-256). Installé sans mise à jour de Homebrew ; une autre
    version que 1.4.0 arrête le job (on la relit avant de changer `DISPLAYPLACER_VERSION`). Rien
    n'est téléchargé hors de Homebrew. Écarté : `vmware-resolutionSet` (Intel sous VMware
    seulement, absent des runners Apple Silicon), outils d'écran virtuel (BetterDisplay…), pas de
    source établie pour la CI.
  - Choix du mode : `1920x1080` de l'écran principal (sans mise à l'échelle de préférence), à
    défaut le plus grand mode offert. Testé sans écran (`scripts/ci/macos-screen.test.ts`).
  - Vérification qui ne dépend pas de displayplacer : la zone utile de l'écran principal
    (`NSScreen.visibleFrame`, c'est le `screen.workArea` d'Electron), lue par `osascript`, doit
    contenir la fenêtre par défaut (1280 × 820). Sinon le job s'arrête là, rouge, avec
    `system_profiler SPDisplaysDataType` avant et après et la liste des modes offerts. Essayé sur
    le Mac (vert à 1512 × 890, rouge en exigeant 3000 de large).
  - Rien ne change sous Linux et Windows, ni dans les suites. L'étape anglaise ne joue toujours
    que si l'étape française est verte (comportement inchangé).
  - Non prouvé : on ne sait pas encore quels modes l'écran virtuel du runner `macos-15` (Apple
    Silicon) offre. Une discussion de `actions/runner-images` (#5730, 2022) ne montrait qu'un mode,
    et CircleCI documente un seul mode sur ses machines virtuelles M1. Si le runner n'offre que
    1024 × 768, l'étape le dira en rouge et la décision revient (garder de nuit ce qui tient dans
    1024 × 768, ou un autre runner). À prouver sur GitHub : `startup panel session composer`
    seules, puis la suite complète.

- 2026-11-23 — L'écran agrandi marche : sur `macos-15`, mode 1920x1080 appliqué, zone utile
  1920 × 982 (45153110394, `startup panel session composer` : `startup` et `panel` verts). Suite
  complète macOS sur la branche (45154507106, commit efb13c1, 49 min) : 40 échecs, contre 44 à 45
  tâches rouges les nuits d'avant. Cause commune à la plupart : l'image macOS de GitHub active
  **Réduire les animations** et **Réduire la transparence** (`configure-system.sh` de
  `actions/runner-images` : `defaults write com.apple.universalaccess reduceMotion -bool true`,
  `reduceTransparency` de même). L'app les suit, comme il se doit ; les suites supposaient le
  réglage par défaut, et la réduction des animations rendait visibles des courses des essais.

  | Échec | Cause | Correctif | Preuve |
  |---|---|---|---|
  | `composer` « mode Code … transitions de 150 ms » ; `base` « le fil de la bobine s'enroule » ; `repere` (`work-cue` jamais à 1) ; `aurore` (verre dépoli, lueur, « préférences revenues ») | Réglages d'accessibilité du runner (ci-dessus) : l'app retire transitions, animation de la bobine, repère animé, verre dépoli. `ui.media()` revenait au seul mode clair ou sombre, donc au réglage du runner. | `e2e/lib.mjs` : `mediaFeatures` émule `prefers-reduced-motion`, `prefers-reduced-transparency` et `prefers-contrast` à `no-preference`, à côté du mode ; `ui.media({…})` ne change que ce qu'on lui donne et revient à ces valeurs. Les suites qui essaient une réduction la demandent (`aurore`). | En local, les mêmes suites avec `reduce` émulé : `composer` (même message), `base`, `repere` (clair), `aurore` (les 4 contrôles) rouges ; avec `no-preference`, vertes. |
  | `session` « délai dépassé : `[role=tooltip]` » | Essai fragile. Radix rend le focus à la puce du modèle dans un `setTimeout` après la fermeture du menu. Sans animation de sortie, l'essai voyait le menu parti, écartait aussitôt le pointeur, puis le focus revenait : l'infobulle s'ouvrait (focus au clavier, Échap) et ne voyait jamais le pointeur partir. Comportement voulu de l'app. | L'essai attend le focus revenu sur la puce, puis écarte le pointeur. | D'après le code de Radix (`FocusScope`, focus rendu en `setTimeout`) et la capture (puce entourée, infobulle ouverte) ; pas reproduit sur le Mac, même avec `reduce` émulé. Vert en local. |
  | `composer` « erreur dans la page : `getComputedStyle` … » | Essai : après « Exécuter le plan », `ready()` passait avant le tour (agent encore « Prêt », comme pour `branch` le 2026-11-22) ; la zone lue pendant le tour n'avait plus de bouton d'envoi (`send` nul, remplacé par Arrêter). Pas un défaut de l'app ni du code injecté (`underPointer`, `clickTrail`) : l'erreur vient de l'évaluation `planLook` de la suite (ligne 52, `getComputedStyle(send)`). | L'essai attend le message « Exécute le plan… » dans le fil, puis `ready()`. | Ligne 52 de l'évaluation ; vert en local. |
  | `composer` « accueil à 760 px : … envoi dans la fenêtre » | Défaut de l'app, vu sur machine lente : le repli de la barre (`useBarFold`) mesurait au `ResizeObserver` puis remettait l'ancien niveau en attendant le rendu de React ; sur le runner, plusieurs images peintes avec l'envoi hors de la zone. Et l'essai mesurait 300 ms après le changement de largeur, parfois sans aucune image rendue entre-temps. | `useBarFold` laisse le niveau mesuré sur la barre (le CSS replie dans l'image même ; React pose ensuite la même valeur). `ui.viewport` attend deux images rendues à la nouvelle taille. | `useBarFold.dom.test.tsx` : rouge avant (`expected '0' to be '1'`), vert après. Captures `composer-9-accueil-760` regardées. |
  | `rules` « menu ouvert d'emblée à sa place (côtés : ) » | Essai : le relevé des côtés du menu durait 1,5 s à partir d'avant le clic ; sur le runner, le clic (visée comprise) dépassait, rien n'était relevé. | Le relevé dure jusqu'à ce que l'essai l'arrête, une image après avoir vu les trois règles. | Vert en local ; pas reproduit (machine plus rapide). |
  | `commit-redige` « Arrêter : rédaction arrêtée » (raison `timeout`) | Essai : « Arrêter » courait contre le délai raccourci à 4 s (agent qui ne répond jamais) ; sur le runner, le démarrage de l'agent mangeait le délai, qui gagnait (capture : « n'a pas répondu en 4 s »). | « Réessayer » reste essayé avec le délai de 4 s (nouvel agent, de nouveau le repli `timeout`, aucun agent ne survit) ; « Arrêter » passe dans un lancement à part, au délai habituel (45 s), où rien ne court contre lui. | Vert en local. |
  | `providers` (le test du fournisseur ne passe pas par le proxy) | Défaut de l'app : Réglages › Agents › Avancé enregistre chaque champ en quittant ; le second enregistrement partait de l'ancienne vue et effaçait le proxy que le premier venait d'enregistrer, s'il n'avait pas encore répondu. Capture : « Répond · 0 s » (test direct), résumé « sans proxy » seul. | `NetworkSettings` : enregistrements l'un après l'autre, chacun parti des réglages rendus par le précédent. Ligne dans les deux changelogs. | `ProvidersSettings.test.tsx`, « deux champs quittés coup sur coup » : rouge avant, vert après. |
  | `pilote` « souvenir décidé : plus de carte », « Tâches proposées traitée » (carte d'autorisation encore vue, 0 s) | Outil : `pnpm pilote repondre` rendait la main dès le clic ; la carte n'est décidée qu'après un aller-retour au main, et `attendre`, lancé aussitôt, la revoyait comme une carte en attente. Reproduit une fois sur le Mac (passage avec `reduce` émulé, sans lien : le pilote n'émule rien). | `answerCard` : pour une carte d'autorisation ou de souvenir (chaque bouton décide), attend qu'elle soit décidée ; toujours là au bout de 10 s, une erreur le dit. Pas pour une carte de questions (un choix se coche) ni de groupe. | `cible.test.mjs` : carte retirée par l'app → rend la main ; carte restée → erreur. Vert en local. |
  | `subagents` « durée et coût … (< 1 s) » | Essai (déjà vu sous Linux à 1 processeur) : coût relu avant la première seconde, la durée disait encore « < 1 s ». | L'essai attend le coût et une durée en secondes entières, puis vérifie, comme avant, que le sous-agent travaille encore. | Vert en local. |

  Restent, non corrigés (une seule occurrence, ou liés à la machine) :
  - `browser` clair : « Bonjour, ! » (le nom n'a pas été saisi, « 1 échec » parmi les 8 actions).
    Sans le journal des outils, cause inconnue ; vert en local, même avec `reduce` émulé. À
    regarder au prochain passage (proposition : `BOBINE_LOG=trace` pour l'e2e de nuit et
    `agents.log` dans les captures).
  - `travaux-groupe` sombre : clic manqué (appui sur « Ouvrir sa conversation », relâché sur
    `work-actions-group`) : la ligne a bougé entre l'appui et le relâché. Même famille que le
    reste côté produit du 2026-11-22 ; pas traité ici.
  - `filles-tech-lead` sombre : un `Electron Helper --type=utility` (NetworkService, processus de
    Chromium) encore vivant 3 s après la sortie de l'app. Lenteur d'arrêt du runner ; à décider
    (l'attendre comme `chrome_crashpad_handler`, ou garder la règle de 3 s).
  - `perf` (gros diff, long fil, sommaire, streaming), `simulator` (5 images/s, planche contact),
    `android` (flux jamais là) : mesures liées à la machine virtuelle (pas de GPU, CPU partagé).
    Proposition, à trancher : ne pas jouer ces trois suites de nuit sur `macos-15` (ou les
    marquer indicatives), elles restent jouées en local avant chaque tag.

  À prouver sur GitHub après la poussée : suite complète macOS sur la branche.

- 2026-11-23 — Suite complète macOS sur la branche (45168015601) : 8 tâches rouges sur 236 (contre
  40 au passage d'avant), dans `perf`, `simulator`, `android`, `git` clair et `aide` clair.
  - **Décision de Jérôme : `perf`, `simulator` et `android` indicatives sur le runner macOS de
    GitHub seulement.** Même forme que `perf` sous Linux : sans suites demandées, les deux étapes
    d'essais (français, anglais) les écartent (`--skip`), puis l'étape « Suites indicatives sur ce
    runner » les joue (français puis anglais) avec `continue-on-error`. Nouvelle option du lanceur,
    `--indicative` : sur GitHub, chaque contrôle en échec devient une annotation `::warning::`
    titrée par la tâche (« e2e perf light : indicative (darwin), en échec ») ; le code de sortie ne
    change pas, c'est l'étape qui ne bloque pas le job. L'étape `perf` de Linux la prend aussi.
    Nommées dans les suites demandées, elles restent bloquantes ; en local, rien ne change (avant
    chaque envoi et chaque tag). Aucune assertion modifiée. Essais : `e2e-select.test.ts`
    (option, contrôles en échec, annotations échappées, plantage sans contrôle) ; sur le Mac,
    `GITHUB_ACTIONS=true pnpm e2e --indicative git` avec la suite `git` rendue rouge exprès : une
    annotation par contrôle, en parallèle comme une tâche à la fois.

  | Échec | Cause | Correctif | Preuve |
  |---|---|---|---|
  | `git` clair « fondus du fil : haut 1 → 1, bas 0 → 0 » | Essai. Les fondus suivent le défilement par une ligne de temps CSS (`animation-timeline`), que Chromium ne relève qu'au rendu d'une image. L'essai lisait l'opacité 150 ms après chaque `scrollTop` ; sur le runner chargé, aucune image rendue entre-temps : les trois lectures donnaient l'état d'avant (en bas du fil). Pas un défaut de l'app : à l'écran, le fondu suit à l'image suivante. | `ui.frames()` (deux images rendues, comme `ui.viewport`) remplace les trois `sleep(150)`. | Sans attente, en local : exactement le message du runner (« haut 1 → 1, bas 0 → 0 ») ; avec `ui.frames()`, `git` clair et sombre verts. |
  | `aide` clair « ↓ change le résultat ET la page… (`{"page":"reglages","size":46,"visible":0}`) » | Essai. `data-page` change au rendu de React ; le défilement au mot et le surlignage sont des effets qui passent après. L'essai lisait dès `data-page` vu : surlignage encore celui de la page d'avant (46 plages, aucune dans la page affichée). Pas un défaut de l'app (une image plus tard, la page est défilée et surlignée). | L'essai attend le surlignage posé sur la page affichée (toutes les plages dans la page, chacune « worktree »), pour le premier résultat comme pour le suivant, puis vérifie comme avant qu'un mot surligné est à l'écran. | Sonde en local (observateur de `data-page`) : au changement de page, `{"page":"reglages","size":46,"onPage":false}`, l'état exact du runner ; après l'attente, `size 9, visible 4`. `aide` clair et sombre verts. |

  Restent, non traités (verts au passage 45168015601, cause non établie) :
  - `browser` clair « Bonjour, ! » : toujours sans journal des outils ; même proposition
    (`BOBINE_LOG=trace` de nuit, `agents.log` dans les captures).
  - `filles-tech-lead` sombre : `Electron Helper` (NetworkService) vivant 3 s après la sortie.
    Processus de Chromium, pas de Bobine ; l'attendre comme `chrome_crashpad_handler` assouplirait
    la règle « rien ne survit à l'app » : décision à prendre, pas faite ici.
  - `travaux-groupe` sombre (clic manqué) : non revu ici.

- 2026-11-23 — `filles-fusion` encore rouge environ une fois sur cinq sur la branche 1.1 (« ⚠ clic
  manqué : appui sur `div.work-group-row` », puis `work-open` jamais vu, au premier retour à la
  mère). Branche `fix/filles-fusion-toggle`, partie de `main`. Relevé temporaire dans `ui.click`
  (position de la flèche, défilement et bas du fil à la visée et à l'appui) : au premier retour, le
  tour de la mère n'est pas encore fini (indicateur « au travail » en bas du fil). Visée à
  `scrollTop` 1885 (`scrollHeight` 2544) ; le tour finit, l'indicateur part, le fil perd 50 px ;
  à l'appui, `scrollHeight` 2494 et le navigateur a borné le défilement à 1864,5 : la ligne est
  descendue de 20,5 px sous le pointeur immobile, l'appui tombe dans la marge de la ligne, hors de
  la flèche. Mêmes chiffres que le relevé du 2026-11-22 : ce rétrécissement arrive **entre la
  visée et l'appui**, pas seulement entre l'appui et le relâché, que seul couvrait le correctif.

  | Cause | Correctif | Preuve |
  |---|---|---|
  | Défaut de l'app, commun à `main` et à 1.1 (`useThreadScroll` identique ; l'indicateur de la mère est encore là au premier retour dans 6 relevés sur 8 sur `main`, mêmes hauteurs ; le rétrécissement y tombe moins souvent entre visée et appui : 0 échec en 9 passages sur `main`, 2 en 12 sur 1.1 (plus 2 en 6 relevés avant)). Un utilisateur qui vise une ligne de carte pendant que le tour se termine la voit glisser sous son pointeur : `data-scroll-hold` arrête le suivi du bas, pas le bornage du navigateur. | `useThreadScroll` : la hauteur gardée en `min-height` (`keepHeight`) l'est aussi tant que le pointeur est sur une carte `data-scroll-hold` du fil (`held`), plus seulement pendant un appui ; prise à l'arrivée du pointeur, rendue quand ni l'un ni l'autre ne la retient (sortie de la carte, de la fenêtre, envoi d'un message). Un appui sur une carte déjà retenue garde la même hauteur. Limite : tant que le pointeur reste sur la carte, un bas qui a rétréci laisse une place vide sous le fil, rendue à la sortie. | `useThreadScroll.test.ts`, « pointeur sur une carte qui retient le fil… » et « message envoyé depuis une carte… » : rouges sans le correctif, verts avec. E2e : voir ci-dessous. |

  Preuve sur le Mac (chaque passage : `pnpm build && pnpm e2e filles-fusion`, clair et sombre, un
  à la fois sous verrou, codes de sortie relevés). Avant : sur 1.1, 2 rouges en 12 passages, forme
  identique à celle signalée ; sur `main`, 0 en 9. Après : 10 passages verts sur `main` + correctif
  (`fix/filles-fusion-toggle`) et 10 sur 1.1 + le même correctif posé sans commit (puis retiré),
  soit 40 tâches vertes, 120 clics sur une flèche relevés, aucun manqué ; dans l'un d'eux sur `main`
  + correctif, l'indicateur part entre la visée et l'appui, et la flèche reste à sa place
  (`scrollTop` 1884,5 à la visée et à l'appui). Relevé temporaire de `ui.click` retiré. `./scripts/verify` vert. Suites touchées
  (`--changed` : `finitions`, `filles`, `repere`, `degrade-haut`, `long-thread`, `perf`) et voisines
  qui cliquent dans des cartes (`travaux-groupe`, `filles-tech-lead`, `autorisation-commande`,
  `subagents`, `filles-fusion`), clair et sombre : 22 tâches vertes, code de sortie 0 ; captures
  regardées par sondage (`120-fusion-pied`). Suite complète non jouée.

- 2026-11-23 — `travaux-groupe` clair rouge sous Linux sur `main` (45166408045, push de
  `fix/filles-fusion-toggle`) : « ⚠ clic manqué : appui sur `button[work-open]` « Ouvrir sa
  conversation », relâché sur `div[work-actions-group]` « Fusionner dans main Voir les
  modificatio… » », puis `title-origin` jamais vu (travail qui écrit, `writerRun`). Branche
  `fix/clic-travaux-groupe`, partie de `main`.

  | Cause | Correctif | Preuve |
  |---|---|---|
  | Défaut de l'app, pas le fil cette fois : c'est **le pied de la carte** qui bouge. Un travail qui écrit montre sa rangée d'actions dès qu'il a fini (`replied`), puis la lecture de ses branches (`children:mergePlan`, lancée par ce changement d'état) aboutit et ajoute « Fusionner dans main » **en tête** de la rangée : « Ouvrir sa conversation » descend d'une ligne (40 px), « Voir les modifications » glisse à la place de « Fusionner ». Capture de la CI : « Fusionner dans main » déjà là alors que le relevé du clic visait l'ancienne place. Dans l'essai, la lecture en cours voyait le commit que l'essai venait de faire ; pour un utilisateur, c'est le cas ordinaire d'un travail qui a commité : le bouton arrive après les autres, d'autant plus tard que la machine est chargée (lecture git). Pire qu'un clic perdu : un clic visé sur « Voir les modifications » pouvait lancer la fusion. Le Mac ne le montre pas seul (5 passages de `travaux-groupe filles-fusion filles-tech-lead --jobs 3` avec relevé : la lecture finit avant le clic). Rejoué en retardant de 800 ms la lecture des branches (relevé temporaire dans le main et l'essai, retiré) : « Ouvrir sa conversation » montré à y = 598, puis à 861 ms « Fusionner » arrive et la ramène à y = 638 (+40 px, comme en CI). | `useWorkMerge` dit si les branches ont été lues pour l'état où la carte en a besoin (`read`, verrouillé tant qu'elle en a besoin : un autre travail qui change d'état fait relire, et les boutons déjà montrés ne disparaissent pas) ; `WorkFoot` ne montre la rangée d'actions qu'une fois lue (ou illisible : `planRead`). Elle arrive en une fois, à sa place. Non couvert : un commit fait ailleurs pendant que la carte est affichée, vu à la relecture suivante (retour dans la conversation) : le bouton apparaît alors, comme avant. Même question pour le pied de la carte de groupe, non traitée (les essais y attendent le libellé). | `WorkFootPlaced.test.tsx` : « branches pas encore lues… » rouge sans le correctif (`work-changes-open`, `work-reply`, `work-open` montrés avant la lecture, au lieu de rien), vert avec ; « un autre travail change d'état… » rouge si le verrou est retiré, vert avec. Trois essais existants attendent désormais le pied (`findBy…`), assertions inchangées. Avec le retard de 800 ms et le correctif : rien avant la lecture, puis une seule mutation de la carte, « Fusionner » compris ; le pointeur appuie et relâche sur « Ouvrir sa conversation ». |

  Preuve sur le Mac : `./scripts/verify` vert (580 fichiers, 5660 essais, 3 sautés) ; suites
  touchées (`--changed` : `relecture`, `commit-redige`, `travaux-groupe`, `filles-tech-lead`,
  `filles-fusion`) et voisines qui cliquent dans le pied des cartes (`filles`,
  `historique-saisie`, `relecture-commits`, `roles-travail`), clair et sombre : 18 tâches vertes,
  code de sortie 0 ; puis 3 passages de `travaux-groupe filles-fusion filles-tech-lead --jobs 3`
  (18 tâches), codes de sortie 0, aucun « clic manqué » ; captures regardées (`264-travail-ecrit`,
  clair et sombre : pied inchangé).
  Sous Linux : rien de joué (Docker arrêté) ; la preuve reste à faire sur le job de GitHub.

- 2026-11-23 — Job Linux de `main` (45179819037, push du 2026-11-23) : `quick` clair et
  `browser-annotate` clair rouges, nouvelles par rapport aux passages précédents pour la seconde.
  Branche `fix/linux-quick-annotate`, partie de `main`.

  | Échec | Cause | Correctif | Preuve |
  |---|---|---|---|
  | `browser-annotate` clair (« un message : texte et deux images (Mode : code) », puis 6 contrôles du message) | Essai trop pressé, pas un défaut de l'app. « Envoyer à l'agent » compose les deux captures, confie le message à l'envoi de la zone de saisie (`send`, asynchrone : passage par le main), puis retire aussitôt la barre. L'essai attendait la barre partie puis `ready()` : sur l'état d'avant l'envoi, l'agent était encore « prêt », et la réponse a été lue en cours d'écriture. Texte de la fenêtre à l'échec : message envoyé, agent « Répond… », réponse coupée après « Mode : code » (début de l'écho de l'agent factice). | L'essai attend le nouveau message dans le fil (il n'apparaît qu'avec l'agent « répond… », comme pour `ui.send`), puis `ready()`. Assertions inchangées. | Sur le Mac, la course ne se montre pas : relevé temporaire à la disparition de la barre, 4 fois sur 4 le message est déjà là et l'agent au travail. Correctif d'après le code et le texte de la fenêtre de la CI ; pas rejoué sous Linux. |
  | `quick` clair (« Fichier › Fenêtre rapide : ouverte… (évènements : ) ») | **Non établie.** Toujours la toute première tâche du job (1/228 ; de même 44511650585, 44514570353, 44894413689, toutes à `évènements :` vide), `quick` sombre verte juste après. Ce que les relevés disent : la page de la fenêtre affiche déjà son texte (l'essai l'a lu), mais la fenêtre n'a reçu aucun évènement en 5 s, pas même `ready-to-show`. Or l'app ne la montre, à la première ouverture, qu'à `ready-to-show` (`QuickEntry.show`, page encore en chargement). Pourquoi Electron ne l'émet pas (premier lancement à froid, fenêtre `panel` transparente sous X11/openbox, rendu caché qui ne peint pas…) ne peut pas se savoir sans Linux. Si c'est bien un `ready-to-show` jamais émis, c'est un défaut de l'app pour un utilisateur Linux (première ouverture sans effet, la seconde marche) ; corriger sans savoir serait deviner, et toucherait au Mac (la fenêtre montrée trop tôt y perdait le focus). | Relevé seulement, dit à l'échec : en plus des évènements de la fenêtre, ceux du chargement de sa page (`did-start-loading`, `dom-ready`, `did-finish-load`, `did-stop-loading`, `render-process-gone`, `unresponsive`) ; l'état de la fenêtre (visible, page en chargement, révélation encore attendue : 2 écouteurs de `ready-to-show` au lieu de 1) ; ce que la page croit d'elle-même (`visibilityState`, peintures `first-paint` / `first-contentful-paint`, image suivante en moins d'une seconde). | Relevé essayé sur le Mac (forcé à s'afficher, retiré ensuite) : `did-finish-load` et `ready-to-show` +114 ms, `show` +140 ms, page `visible`, `first-contentful-paint` 148 ms, image suivante oui. Le prochain échec Linux dira lequel manque. |

  Preuve sur le Mac : `./scripts/verify` vert (580 fichiers, 5660 essais, 3 sautés) ;
  `quick browser-annotate`, clair et sombre, 3 passages sous verrou (deux de diagnostic, un final),
  codes de sortie 0. Rien de joué sous Linux (Docker non démarré) : `browser-annotate` se prouvera
  sur le job de GitHub ; `quick` reste ouvert jusqu'au prochain relevé.

- 2026-11-23 — `travaux-groupe` clair rouge sur le job macOS (45180281395, écran 1920 × 1080),
  seul échec bloquant sur 230 : « conflit qui reste : dit dans la carte, Réessayer, Abandonner,
  Voir le conflit ; rien d’autre fusionné ». L'essai avait vu « Réessayer » (`waitFor`), puis,
  quelques millisecondes plus tard, ni « Abandonner » ni « Voir le conflit ». Capture : résultat
  « Fusion arrêtée : 1 travail fusionné… » (statut `conflict`, mais sans la phrase du conflit),
  bouton « Fusionner le travail prêt dans main » grisé, ligne « Notes de version » avec les
  chiffres de sa dernière réponse (README.md +7 −1) et non ceux de sa branche. Pas de « clic
  manqué ». Branche `fix/travaux-groupe-conflit`, partie de `main`. Le pied de la carte de
  travail qui écrit (`actionsShown`, `planRead`, fix/clic-travaux-groupe) n'y est pour rien :
  c'est le pied de la carte de groupe (`SubtasksMergeFooter`), qui ne l'utilise pas.

  | Cause | Correctif | Preuve |
  |---|---|---|
  | Défaut de l'app. Le plan montré était celui d'une lecture faite **pendant** la fusion, quand « Notes de version » résolvait son conflit (`running` : rien de lu sur sa branche, d'où les chiffres de sa réponse). Deux défauts se cumulent. (1) Le temps que l'état courant soit lu, la carte montre le « dernier plan lu » (`latest`) : celui de la lecture **arrivée** la dernière, pas de la plus récente ; les lectures tournent en parallèle (git, sans file) et finissent dans le désordre. Relevé sur le Mac (relevé temporaire du magasin et du pied, retiré) : la lecture lancée sur `running:merged,conflict` aboutit après celle de `conflict:merged,conflict`. (2) « Réessayer » se fiait à n'importe quel plan qui disait `conflict` pour ce travail, même lu pendant la fusion (avant qu'il ne résolve) : la fusion finie en conflit, la carte attendait sa lecture et montrait « Réessayer » d'après une lecture d'avant ; puis une lecture plus ancienne, lancée quand le travail résolvait, arrivait et la remplaçait (`running`) : la reprise disparaissait jusqu'à la lecture de l'état courant. Relevé sur le Mac aussi : pendant ~200 ms après l'arrivée du statut `conflict`, pied montré d'après un plan où le travail est `running`. L'essai n'était pas trop pressé : il attendait un état réel de l'écran, que l'app retirait ensuite. | `merge-plan-store` : chaque lecture a son numéro de lancement ; le plan montré en attendant n'est remplacé que par une lecture lancée plus tard (`latest` monotone). `planReadAfter` (`SubtasksMerge`) : un plan lu pendant cette fusion (`running` avec son `runId`) ne dit pas le conflit qui reste ; `conflictLeft` (pied de la carte de groupe et « Sous-tâches ») et la carte d'un travail qui écrit (`WorkMerge`) ne proposent Réessayer, Abandonner et Voir le conflit que d'après un plan lu après l'arrêt. Ils arrivent une fois, et restent : les plans lus ensuite sont plus récents. Essai e2e inchangé. | `merge-plan-store.test.ts` « une lecture plus ancienne qui finit après une plus récente… » ; `SubtasksMerge.test.tsx` « arrêtée sur un conflit, branches lues pendant la fusion… » ; `WorkGroup.test.tsx` « conflit, branches lues pendant la fusion… » : les 3 rouges sans le correctif (plan ancien rendu ; « Réessayer » montré), verts avec. |

  Preuve sur le Mac : `./scripts/verify` vert (5679 essais, 3 sautés) ; suites touchées
  (`--changed` : `filles-tech-lead`, `commit-redige`, `filles-fusion`, `travaux-groupe`), clair et
  sombre, sous le verrou commun : 8 tâches vertes, code de sortie 0, aucun « clic manqué » ;
  captures regardées (`264-groupe-conflit`, clair et sombre : « Fusion arrêtée sur « Page d’aide » :
  il reste des conflits dans carnet.txt », Réessayer, Abandonner, Voir le conflit). Un passage
  instrumenté avant le correctif (relevé retiré) pour l'ordre des lectures. Le rouge de la CI
  n'a pas été reproduit tel quel en local (1 passage) : la cause est établie par la capture de la
  CI et le relevé local de l'ordre des lectures, le correctif par les 3 essais unitaires. Suite
  complète et job GitHub non joués.

- 2026-11-23 — `quick` clair, cause établie (branche `fix/quick-linux`, partie de `main`). Le
  relevé ajouté plus haut l'a dit au passage 45245467579 (toujours la première tâche du job, premier
  essai) : `did-start-loading` +4 ms, `dom-ready`, `did-finish-load` et `did-stop-loading`
  +132 ms ; fenêtre non visible, page plus en chargement, révélation encore attendue (2 écouteurs de
  `ready-to-show`) ; page `visible`, **aucune peinture**, pas d'image suivante en 1 s. La page est
  chargée mais la fenêtre rapide, transparente, créée cachée (`show: false`, `type: 'panel'`), ne
  la peint jamais sous X11/openbox : Electron n'émet pas `ready-to-show` (émis à la première
  peinture de la fenêtre cachée), et `QuickEntry.show` n'attendait que lui. **Défaut de l'app pour
  un utilisateur Linux** : la première ouverture ne faisait rien.

  Choix du correctif, d'après la doc d'Electron (`BrowserWindow`) :
  - `paintWhenInitiallyHidden` vaut déjà `true` par défaut (rendu actif fenêtre cachée) : le relevé
    montre justement une page `visible` qui ne peint pas ; à `false`, la doc dit que
    `ready-to-show` n'est plus émis du tout. Rien à gagner.
  - `backgroundThrottling` ne règle que les minuteries et animations d'une page en arrière-plan,
    pas la première peinture d'une fenêtre jamais affichée. Hors sujet.
  - Délai borné : attente arbitraire à chaque première ouverture, et une valeur à deviner.
  - **Retenu** : sous une plateforme sans la nouvelle capacité `hiddenPaint` (déclarée par
    `main/platform.ts`, vraie sur macOS seulement, Windows non observé prend le chemin sûr), la
    première ouverture se montre au **premier** de `ready-to-show` et `did-finish-load` de sa page,
    l'autre écouteur retiré (`revealWhenLoaded`, `quick-entry.ts`). La page est chargée : ce que
    la règle « la page d'abord » protégeait (fiche 062) tient ; une fenêtre transparente montrée
    avant sa première image ne montre rien de plus que le bureau. Sur macOS, chemin identique
    (`ready-to-show` seul) : la fenêtre montrée trop tôt y perdait le focus.

  Tests : `quick-entry.test.ts`, trois cas (macOS : `did-finish-load` ne montre pas, `ready-to-show`
  oui ; Linux : `ready-to-show` d'abord, montrée une fois ; Linux : `ready-to-show` jamais, montrée
  à `did-finish-load`, plus d'écouteur restant) ; `platform.test.ts` (capacité absente sous Linux et
  Windows). `./scripts/verify` vert. Rien de joué en local (ADR-0069) : `quick` sur GitHub (Linux
  et macOS) à lancer par Jérôme ; le relevé de `e2e/suites/quick.mjs` reste en place jusqu'à cette
  preuve.

- 2026-11-23 — Passage e2e GitHub macOS 45256100087 (Linux vert, suite locale Mac verte) : trois
  échecs, traités à la cause (branche `fix/macos-ci-rc4`).
  - `connexion-expiree` clair (« délai dépassé » sur `touch .mock-agent-logged-in`) : la capture
    montre la commande coupée par le terminal (`touch .mock-agent-log` / `ged-in`), l'invite du
    runner (nom de machine long) remplissant la ligne. Même cause que `auth` (lot
    `fix/regressions-rc4`). Aide commune `TERMINAL_TEXT` dans `e2e/lib.mjs` : le terminal affiché,
    lignes mises bout à bout ; reprise par `auth`, `connexion-expiree`, `mentions`, `terminal`,
    `parcours-outils` (toutes les suites qui cherchent un texte dans `.xterm-rows`). Défaut de
    l'essai, pas de l'app.
  - `pilote` (« Retenir » cliqué, carte souvenir toujours en attente 10 s plus tard, jamais
    décidée ensuite) : `repondre` a cliqué pendant que la réponse de l'agent s'écrivait **sous** la
    carte (état relevé : tour « Écrit… », 3 mots, puis 70). Le fil, collé en bas, remontait la carte
    à chaque morceau : entre le survol et l'appui (60 ms), « Retenir » avait quitté le pointeur, et
    le clic est tombé à côté (aucune erreur sur la carte, aucun appel au main). **Défaut de l'app** :
    les propositions de filles retiennent le fil sous le pointeur (`data-scroll-hold`, fiche 124),
    pas la carte souvenir ; un humain qui vise « Retenir » pendant que l'agent écrit le rate de la
    même façon. Correctif : `data-scroll-hold` sur la carte souvenir en attente (la ligne décidée
    ne retient pas). Preuve : `MemoryProposalCard.test.tsx` (« en attente : le fil ne défile pas
    sous le pointeur… »), rouge sans le correctif. Le pilote n'est pas changé.
  - `travaux-groupe` sombre (« proposés : … trois lignes ») : la capture montre les trois lignes
    et « Tout lancer », mais « Tests de la sauvegarde locale » avant « Tri des articles par
    rayon ». Les trois `start_child` de l'agent factice partent en parallèle (chacun : demande
    d'autorisation, puis `initialize` et `tools/call` en HTTP) et la carte les range dans l'ordre
    d'arrivée au serveur MCP, qui n'est pas garanti (ni pour un vrai agent). Sans rapport avec le
    correctif T6 (ordre des lancements, respecté ici : la suite des vérifications est passée).
    L'essai exigeait un ordre que l'app ne promet pas : il lit désormais chaque ligne par son titre
    (rôle, sans rôle, avis, avatar de rôle compris), triées. Écart produit possible, non traité :
    ranger les propositions simultanées dans l'ordre des `tool_call` ACP de l'agent.
  `./scripts/verify` vert. Rien joué en local (ADR-0069) : à lancer sur GitHub (macOS, et Linux
  pour les suites du terminal) : `connexion-expiree`, `auth`, `mentions`, `terminal`,
  `parcours-outils`, `pilote`, `memoire`, `parcours-reglages`, `travaux-groupe`.
- 2026-11-24 — `browser-view` clair rouge une fois sur le Mac de GitHub (run 45245467579) :
  « molette : la page défile (scrollY 0) », sombre vert, capture : page longue dessinée, en haut.
  - Cause : la vue de l'onglet naît cachée (`setVisible(false)`), charge, puis le panneau la
    montre. L'essai attendait des bornes exactes et `innerWidth`, qui suivent `setBounds` même vue
    cachée, puis envoyait la molette tout de suite : la page était encore `hidden` (pas d'image
    dessinée), et Chromium jette la molette d'une page qui n'est pas à l'écran. Rien ne la
    renvoie ensuite : scrollY 0 pendant les 4 s d'attente. Défaut de l'essai, pas de l'app : un
    utilisateur ne peut pas faire défiler une page avant de la voir.
  - Preuve, essai hors de l'app (Electron 45, `WebContentsView` cachée, chargée, montrée, trois
    crans de molette) : molette aussitôt après `setVisible(true)` : scrollY 0, 8 fois sur 8 ;
    après `visibilityState === 'visible'` seul : 360, deux fois 240 (premier cran perdu) ; après
    `visible` et deux `requestAnimationFrame` : 360, 8 fois sur 8.
  - Correctif : avant la molette, l'essai attend (et vérifie) que la page soit `visible` et ait
    dessiné deux images. Pas de délai fixe ; l'assertion de la molette est inchangée.
    `./scripts/verify` vert ; `browser-view` non rejouée en local, à lancer sur GitHub.

- 2026-11-24 — Passage e2e GitHub macOS 45336692893 (branche `chore/libs-agents`, SDK ACP 2.9.1,
  fiche 278 ; Linux vert) : cinq échecs, chacun vert dans l'autre thème. Aucun ne vient du lot
  (comparaison avec les passages récents de `main` et des autres branches).

  | Échec | Cause | Correctif | Preuve |
  |---|---|---|---|
  | `session` sombre « délai dépassé : … `kind === 'child'` » (fille toujours « Travaille… » 15 s après « Arrêter ») | **Défaut de l'app.** La fille venait d'être lancée (capture `session-2-en-cours` : 0:00, « < 1 s ») ; « Arrêter » est tombé pendant que son agent démarrait. `AgentHost.cancel()` ne fait rien hors du statut `busy` (`starting`, ou message en préparation) : l'arrêt était perdu et le tour (`attend-stop`) allait sans fin. Un humain qui arrête une fille tout juste lancée a le même résultat. | Arrêt retenu pour le message en route : `SendOrder` (`stopPending`, `follow`) pendant la préparation du manager (dossier, démarrage), `AgentHost` pendant celle du message (`stopRequested`) ; `session/cancel` part juste après `session/prompt`, avec `cancel-requested` dans le fil. Gestion des élicitations sortie d'`AgentHost` vers `PendingRequests.fromAgent` (plafond de lignes). | `agent-host.test.ts` et `manager.test.ts` (« fiche 278 »), rouges sans le correctif (tour jamais fini) ; `send-order.test.ts`. |
  | `worktree-setup` clair « délai dépassé : `state === 'done'` », avec « ⚠ clic manqué : appui sur `div[user-message]` » | **Défaut de l'app**, même famille que la carte souvenir (fiche 250, 2026-11-23) : le message part sans attendre (`archive` seule), sa réponse s'écrit sous la carte et le fil, collé en bas, la remonte entre le survol et l'appui. Déjà rouge sur `main` (run 45174929251). | `data-scroll-hold` sur la carte tant qu'elle a des boutons (à autoriser, en cours non dépassée). | `WorktreeSetup.test.tsx` (« boutons à viser… »). |
  | `parcours-reglages` clair « délai dépassé : `!!agent-unreachable` » (étape « proxy retiré ») | **Essai.** `reseau-revenu-2-3` ne montre le bandeau qu'environ 0,8 s (deux reprises de 10 pauses) ; l'essai le relève toutes les 100 ms : sur le runner chargé, la réponse était déjà là (tour fini en 1,0 s au journal). Pas un défaut de l'app. | Nouveau scénario `reseau-revenu-au-signal-2-3` : reprises jusqu'au fichier `.mock-reseau-revenu`, posé par l'essai une fois le bandeau vu, puis retiré. Assertions inchangées. | `agent-host-silence.test.ts` (« réseau revenu au signal ») ; `reseau-revenu-2-3` inchangé. |
  | `parcours-outils` sombre « processus encore vivants 3 s après l'app » (`Electron Helper --type=utility`, service réseau) | **Essai**, déjà vu (`filles-tech-lead`, 2026-11-23) : processus de Chromium né de l'app, qui sort de lui-même après elle, au-delà de 3 s sur le runner chargé. | Quand il ne reste que des processus de Chromium (`--type=`), attente portée à 10 s en tout, comme crashpad ; encore là ensuite, l'essai échoue et les nomme. Les processus de Bobine (agents, essais…) gardent 3 s. **Décision à confirmer par Jérôme** (la question restait ouverte). | Relu ; à prouver sur GitHub. |
  | `browser` clair « branche : le navigateur reprend la page de l'originale () » | **Cause non établie.** Panneau de la branche vide (ni page, ni « Précédent ») plus de 15 s après la branche ; `BrowserManager.inherit` avale toutes ses erreurs (`openTab` → `CdpTab.whenReady` → `loadURL`). Pistes : commande CDP sans réponse à l'attachement, `about:blank` d'attachement qui interrompt l'adresse, erreur d'attachement. Sans rapport avec le lot (rien du navigateur ni d'Electron ne change). | Pas de correctif à l'aveugle : à l'échec, l'essai relève l'état des pages du main (adresse, chargement, débogueur, historique). | À la prochaine occurrence. |

  `./scripts/verify` vert. Rien joué en local (ADR-0069). À relancer sur GitHub (macOS, clair et
  sombre) : `session`, `worktree-setup`, `parcours-reglages`, `parcours-outils`, `browser`, puis
  `filles` et `subagents` (fin de tour et arrêt des filles), `worktree-cycle`.

- 2026-11-24 — Passage e2e GitHub 45361829816 (branche `test/pyramide`, SDK ACP 2.9.1 fusionné,
  18 suites ; Linux vert, suite complète locale verte) : macOS rouge sur `browser` clair et sombre,
  `parcours-outils` clair (« délai dépassé : `.status-dot.ready` ») et `session` sombre (fille).

  | Échec | Cause | Correctif | Preuve |
  |---|---|---|---|
  | `session` sombre « délai dépassé : … `kind === 'child'` » (fille « Travaille… » 0:16, « Arrêter » sans effet) | **Défaut de l'app**, la suite de `71ee121`. Une fille lancée reste « démarre » (`startingHeld`) depuis sa création jusqu'à son premier tour ; or sa consigne n'entre dans `SendOrder` qu'au `prompt`. Avant cela, `ChildrenService.launch` attend le démarrage de l'agent (`ready`), pose le modèle (la boîte de lancement envoie celui de la mère : un `session/set_config_option`), le rôle ; puis la préparation du worktree peut retenir le message (`promptGate`). « Arrêter » dans cet intervalle : pas `busy`, rien en préparation dans `SendOrder`, l'arrêt était perdu (`71ee121` ne couvrait que la préparation du manager et celle du message). Fenêtre de plusieurs secondes sur le runner, d'autant plus longue que chaque message ACP passe désormais par une tâche de la boucle (SDK 2.9). | `SendOrder.stopPending(id, starting)` : pour une fille qui démarre, l'arrêt est retenu jusqu'au départ de sa consigne (`follow`), puis `session/cancel` suit `session/prompt` comme dans `71ee121` ; oublié si le lancement échoue (`holdStarting(id, false, true)` dans le `catch` de `launch`), sans toucher un message suivant. | `manager.test.ts` « arrêter une fille qui démarre avant que sa consigne parte… », rouge sans le correctif (tour `attend-stop` jamais fini, 15 s), vert avec ; « …lancement échoue… » ; `send-order.test.ts` (deux cas). |
  | `browser` clair (premier message), `browser` sombre (`browser_tabs new` de `debogage-web`), `parcours-outils` clair (étape 3) : agent « Répond… », outil du navigateur en cours, panneau sur un onglet neuf « en chargement » (adresse vide ou « Nouvel onglet ») | **Cause non établie.** Fait : l'appel MCP est arrivé au main (l'onglet existe, l'autorisation a donc été rendue par ACP) ; c'est le premier chargement d'un `WebContentsView` neuf (`CdpTab.whenReady` : `about:blank` puis débogueur, puis l'adresse) qui ne finit pas en 15 s. Même signe que `browser` clair de 45336692893 (branche, onglet neuf vide). Corrélation : 2 passages macOS sur 2 depuis le SDK 2.9.1, 0 sur 4 avant (45256100087, 45245467579, 45274253480, 45351902909), même image `macos-15-arm64` 20261118.0550 ; aucun fichier du navigateur, ni Electron, ne change entre eux. Mécanisme non trouvé : le SDK ne touche pas au navigateur ; son `nextTask` (MessageChannel de Node) mesuré dans le main d'Electron 45 en local : p99 0,09 ms, cinq onglets neufs prêts en 44 à 61 ms. | Pas de correctif à l'aveugle (ni délai, ni assertion touchée). À chaque échec d'une suite qui inspecte le main, la capture `.txt` joint désormais l'état réel des pages (`pid` du rendu, adresse validée, chargement, réponse attendue, plantage, débogueur attaché) : il dira à la prochaine occurrence où s'arrête `whenReady`. Piste à trancher sur GitHub : `browser` macOS plusieurs fois avec le SDK 2.7.0 puis 2.9.1 (branche jetable). Note : `whenReady` n'a pas de borne (`LOAD_TIMEOUT_MS` ne couvre que `loadURL`) ; un onglet bloqué là fige le tour de l'agent sans fin. | À la prochaine occurrence. |

  `./scripts/verify` vert. Rien joué en local (ADR-0069). À relancer sur GitHub (macOS, clair et
  sombre) : `session`, `filles`, `subagents`, `worktree-setup`, `browser`, `parcours-outils`.

- 2026-11-24 — Onglet neuf resté « en chargement » sur le runner macOS (`browser`,
  `parcours-outils`), passages 45371706236, 45371718099 (SDK 2.7.0, épreuve A/B : échoue aussi, ce
  n'est donc pas le SDK), 45371749951, 45361829816. Linux et Mac local verts.
  - **Défaut de l'app corrigé : `CdpTab.whenReady` sans borne.** `LOAD_TIMEOUT_MS` ne couvrait que
    `loadURL` ; la mise en route d'un onglet (`about:blank`, puis débogueur) restée en plan figeait
    le tour de l'agent sans fin (`browser_navigate`, `browser_tabs new`, et toute commande CDP).
    Bornée à `READY_TIMEOUT_MS` = 20 s (quelques dizaines de ms d'ordinaire, jusqu'à ≈ 10 s relevé
    sur le runner chargé) : l'outil rend une erreur claire à l'agent (« The page did not finish
    loading… »), le tour continue ; un échec ou un délai dépassé n'est pas définitif, l'appel
    suivant relance la mise en route (`about:blank` interrompt celle restée en plan). Essai
    unitaire `cdp-tab.test.ts`, rouge (4/5 en délai dépassé) avant le correctif, vert après. Ne
    rend pas l'e2e verte : elle attend l'agent 15 s, la borne est au-delà, exprès.
  - **Diagnostic d'échec aveugle (`914050f`) corrigé.** Les captures `.txt` de ces passages disent
    « Pages du main : (aucune) » alors que l'onglet existe : le filtre `getType() !== 'window'`
    écartait aussi les onglets, une page de `WebContentsView` ayant le type `window` (relevé en
    local sur Electron 45.4.1). Les pages des fenêtres sont désormais écartées par leur `id` ;
    s'ajoutent la visibilité de la vue, `backgroundThrottling`, et `ps` (pid, priorité, état,
    %CPU) des rendus des onglets et des fenêtres. Le prochain échec dira où s'arrête la mise en
    route et si le rendu de l'onglet est en arrière-plan.
  - **Cause sur la VM : non établie, aucun réglage appliqué.** Ce qui est sûr : un onglet neuf est
    créé caché (`setVisible(false)`) tant que le panneau ne le montre pas ; Chromium le traite
    alors comme caché (`WasHidden`), son rendu peut passer en priorité d'arrière-plan (macOS :
    CPU et disque bridés), et sur macOS l'occlusion de la fenêtre (`WebContentsOcclusionCheckerMac`,
    que garde un patch d'Electron) peut aussi cacher la page. Sur une VM sans GPU qui fait tourner
    trois suites à la fois, c'est la piste la plus vraisemblable. Mais en local, une vue cachée dans
    une fenêtre cachée charge `about:blank` en 56 ms : être caché ne bloque pas le chargement, au
    plus le ralentit. Écartés faute de preuve : `backgroundThrottling: false` sur les onglets
    (Electron pose `disable_hidden_`, la page ne serait plus jamais « cachée » : minuteries et
    animations à plein régime dans chaque onglet caché, `document.visibilityState` toujours
    `visible`, un changement de comportement pour l'utilisateur sans gain prouvé) ; les options de
    Chromium que posent Puppeteer et Playwright en automatisation
    (`--disable-renderer-backgrounding`, `--disable-backgrounding-occluded-windows`,
    `--disable-background-timer-throttling`), possibles dans le seul lanceur e2e, mais qui
    masqueraient le constat avant que le diagnostic réparé ne parle. Étape suivante : lire les
    captures `.txt` du prochain échec ; si le rendu de l'onglet y est en arrière-plan et la page
    `about:blank` en chargement, épreuve A/B de ces options dans `e2e/lib.mjs` (branche jetable).
- 2026-11-24 — Passages macOS 45375547896, 45375561141, 45375571622 de cette branche : `browser`
  rouge trois fois, sous trois formes. Le diagnostic réparé parle : à chaque échec, l'onglet est
  chargé (`loading: false`), visible, débogueur attaché, son rendu à la même priorité que la
  fenêtre (`pri 20`). **La piste du rendu en arrière-plan est écartée**, pas d'épreuve A/B des
  options d'automatisation. Le symptôme « onglet neuf resté en chargement » ne s'est pas montré.
  | Échec | Cause |
  |---|---|
  | `browser` clair (en) : « Bonjour, ! », 1 action en échec | **Défaut de l'app.** Le clic de l'agent sur le champ n'est pas arrivé ; la saisie qui suit échoue (« No text field has focus »). Déjà vu en local sous charge (fiche 094, 2 sur 7). |
  | `browser` sombre (en) : fichier non enregistré, bandeau « File saved » jamais affiché | **Même défaut.** `telechargement` clique sur « Exporter » aussitôt `browser_navigate` rendu ; le CDP répond « Clic en (60, 60) », la page ne reçoit rien. |
  | `browser` sombre (fr) : agent pas « Prêt » en 15 s | **Lenteur, pas un blocage** : toutes les actions réussies, tour fini en 18,6 s, 3 s après la capture. Cause de la lenteur non établie ; borne d'essai non touchée. |
  Mécanisme, lu dans Chromium (`WidgetInputHandlerManager::DispatchEvent`) puis reproduit en local
  (Electron 45.4.1, script hors dépôt) : tant que le rendu d'une page est suspendu, juste après une
  navigation et jusqu'à sa première peinture, Chromium jette clics, touches et molette en les
  acquittant « non consommés » ; le CDP ne dit rien. Clic par le CDP aussitôt `loadURL` rendu :
  perdu à chaque fois, même sur une page au contenu immédiat ; dans une vue cachée jamais montrée :
  toujours perdu. Sur un Mac rapide, l'aller-retour MCP entre deux outils suffit d'ordinaire ; sur
  la VM sans GPU, non. Pour un utilisateur, même défaut : un clic de l'agent juste après une
  navigation sur une machine chargée, ou dans un onglet que le panneau ne montre pas, est perdu
  sans erreur.
  **Décision de l'utilisateur** : pas d'option globale de Chromium. `allow-pre-commit-input` (essayé
  en `4c7585b`, retiré par `git revert`) règle tout, mais ôte aussi à l'utilisateur la protection de
  Chromium contre un clic qui tombe sur une page pas encore vue. Correctif ciblé sur les entrées de
  l'agent (`paint-gate.ts`, `CdpTab`, `BrowserManager.paintHidden`) : avant le premier appui,
  touche, molette ou saisie de l'agent dans un document, on attend sa première peinture (entrée
  `paint` de la page, lue dans le monde isolé ; une fois par document, refaite à chaque
  `did-navigate`). Un onglet caché est peint le temps de l'attente : montré à sa taille, hors de la
  fenêtre sauf un point (son coin haut-gauche au coin bas-droit de la fenêtre), puis remis par
  `layout`. Relevé : une vue entièrement hors de la fenêtre n'est pas peinte ; réduite à 1 × 1, elle
  est peinte mais garde cette taille une fois cachée et le clic tombe à côté. Borne 5 s
  (`PAINT_TIMEOUT_MS`) : au-delà, l'outil rend « The page has not been rendered yet… Nothing was
  sent » et l'attente n'est pas refaite pour ce document (page sans rien à peindre : Chromium la
  libère seul, relevé ≈ 3 s). Les déplacements du pointeur ne sont jamais retenus (Chromium les
  laisse passer). Écartés : `rAF` × 2 (non essayé : les images de la page peuvent tourner pendant la
  retenue des commits, il ne prouverait pas la peinture) ; `incrementCapturerCount` et
  `capturePage` sur la vue cachée (sans réponse en 30 à 60 s, relevé). Rejoué hors dépôt avec le script de `firstPaintScript` et le placement de
  `paintHidden` : clic aussitôt après `loadURL`, page visible ou cachée, contenu immédiat ou peint
  après 1,5 s : reçu 6 fois sur 6 (attente 23 à 27 ms, 1,5 s pour la page tardive), contre 0 sur 2
  sans. Essais unitaires `paint-gate.test.ts` (logique d'attente) et `cdp-tab.test.ts` (appui
  retenu, erreur sans appui envoyé, déplacement libre, onglet caché peint puis remis), rouges sans
  le branchement dans `CdpTab`. À relancer sur GitHub macOS : `browser parcours-outils`, trois fois.

- 2026-11-24 — Décision de l'utilisateur : `browser` et `parcours-outils` deviennent indicatives sur le
  runner macOS de GitHub (comme `perf`, `simulator`, `android`), bloquantes en local, sous Linux et
  quand on les nomme. Deux vrais défauts trouvés en route sont corrigés (chargement d'onglet borné à
  20 s ; entrées de l'agent retenues jusqu'à la première peinture, ciblé à l'agent). Restent ouverts,
  à traiter à côté : (1) « branche : le navigateur reprend la page de l'originale » (`BrowserManager.inherit`
  avale ses erreurs ; cause inconnue) ; (2) tour de l'agent > 15 s sur la VM, sans cause établie.

- 2026-11-24 — Recette Bob avant la 1.0.0, jouée avec un vrai IBM Bob 2.1.0 sur `f34c56ef`
  ([rapport](../recettes/2026-11-24-recette-bob-1-0.md)). **Verdict 1.0.0 : oui.** 0 bloquant,
  0 sérieux, aucune régression par rapport à la rc1 ; 1 gênant (la boîte « Supprimer » annonce
  « perdus : 3 commits » pour une branche fille déjà fusionnée, parce que le compte part de la base
  du worktree au lieu de `main`) et 2 cosmétiques. D1 et D2 de la rc1 sont corrigés et vérifiés
  avec Bob : la rédaction du commit est comptée, et « Envoyer » reste inactif sur la carte
  « Site web ». Le travail délégué (2 filles en worktree, puis fusion), la corbeille et la
  restauration (`session/load`, mémoire gardée) marchent. **Point ouvert tranché** : sous
  « Toujours dans cette conversation » (modifications), Bob crée un nouveau fichier sans
  `session/request_permission`, et Bobine le compte quand même dans Modifications. 2,14 Bobcoins
  dépensés, `~/.bob/settings/settings.json` inchangé.
