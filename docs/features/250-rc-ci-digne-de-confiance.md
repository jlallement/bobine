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
