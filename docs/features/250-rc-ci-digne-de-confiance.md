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

## Reste à vérifier sur GitHub (après la poussée)

1. `e2e.yml` lancé à la main sur la branche, `systeme: linux`, trois fois. Chaque passage doit
   être vert, avec l'annotation « e2e terminal en quarantaine (linux) ». Si oui, garder le dernier
   commit (`continue-on-error` retiré) ; sinon le retirer et noter ici ce qui échoue encore.
2. Le lendemain de la fusion : le passage de nuit macOS (`schedule`) et sa durée.
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
