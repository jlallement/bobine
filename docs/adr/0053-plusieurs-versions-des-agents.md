# ADR-0053 — Plusieurs versions de Bob et d'OpenCode à la fois

- **Statut** : proposé (à trancher par Jérôme ; rien n'est codé au-delà de la fiche 232)
- **Date** : 2026-11-16

## Contexte

Les utilisateurs ont souvent quelques versions de retard, ou d'avance, sur celles qu'on a essayées.
Quand le contrat ACP change d'une version à l'autre, l'affichage peut casser chez eux sans qu'on le
voie. OpenCode 2.3.0 en est l'exemple (fiche 232) : ses sous-agents tournent toujours en
arrière-plan, son travail n'est plus relayé après le tour, et le parent répond hors tour. Le rythme
est rapide pour OpenCode (2.0.31 le 16/10, 2.3.0 le 13/11) et plus lent pour Bob (2.0.6, 2.0.9,
2.1.0).

**Ce qui existe déjà :**

- `testedVersions` du profil (une entrée vaut pour ses sous-versions) et `minVersion`, un plancher
  bloquant réservé à une incompatibilité documentée, vide aujourd'hui (`agent-version.ts`,
  `version-check.ts`, fiche 198). Une version hors liste donne un avis, une fois par conversation
  et par majeure.mineure, et une ligne dans le Diagnostic. Un protocole ACP inconnu est refusé et
  expliqué.
- Les sondes `pnpm bob-probe` (0 bobcoin) et `pnpm opencode-probe` (modèle gratuit) vérifient le
  contrat de l'app et comparent les réponses à **une seule** référence (`*.expected.json`).
  `--traces` enregistre des traces par version (`__traces__/<agent>-<version>/`), rejouées par
  `trace-replay.test.ts`. En CI, `opencode-probe --offline` tourne chaque semaine sur la dernière
  version publiée.
- Générique d'abord (ADR-0011) : les formats propres à un agent sont lus dans son profil et ses
  adaptateurs, qui gardent les formes relevées de chaque version (`opencode-subagents.ts` : 1.19,
  2.0.31, 2.3.0). L'agent factice et la grille de conformité (fiche 139) rejouent ces formes.

**Ses trous :**

1. **La référence d'une sonde est écrasée** à chaque `--accept`. On perd ce que faisait la version
   d'avant : la 2.3.0 remplacerait la 2.0.32 et plus rien ne dirait ce qu'était un sous-agent
   « au premier plan ».
2. **`testedVersions` ne fait que grandir.** Il ne dit pas ce qu'on garde vert : `1.19` y reste
   alors que rien ne la rejoue plus.
3. **Les traces sont inégales.** Certaines versions en ont (2.2.5, 2.0.32 reconstituée), d'autres
   non. Un comportement n'est protégé que s'il a un scénario factice ou une trace.
4. **La veille est incomplète.** Rien ne compare automatiquement les versions publiées (npm
   `@ibm/bob`, releases d'`anomalyco/opencode`) à `testedVersions`. La sonde hebdomadaire
   d'OpenCode n'appelle aucun modèle : la 2.3.0 y serait passée verte, car ce qui a changé ne se
   voit qu'avec un modèle.

## Décision

Proposée en cinq points, sobres :

1. **Fenêtre de prise en charge.** Pour chaque agent : la **dernière mineure publiée et les deux
   précédentes**, chacune vérifiée sur son dernier correctif (OpenCode aujourd'hui : 2.1, 2.2, 2.3 ;
   Bob : 2.0, 2.1). C'est une fenêtre par versions, pas par durée : elle suit le rythme de
   chaque agent. Hors de la fenêtre, l'avis actuel suffit (« version non essayée »), sans mode
   dégradé ni refus. Un refus (`minVersion`) reste réservé à une casse documentée, avec sa trace.
   `testedVersions` devient la liste de cette fenêtre (les entrées plus anciennes en sortent) ; ce
   qui a été essayé avant reste dans les fiches.
2. **Le comportement d'abord, la version en dernier recours.** Une variation du contrat est
   reconnue **à ce que l'agent envoie**, dans son adaptateur (`*-contract.ts`, `*-subagents.ts`,
   `_meta` lus à un seul endroit). Par exemple : un sous-agent en arrière-plan se reconnaît à
   `metadata.status: "running"`, quelle que soit la version. Chaque adaptateur garde **toutes** les
   formes relevées dans la fenêtre, chacune avec sa version en commentaire. Un aiguillage par
   plage de versions (`since` / `until` dans le profil) n'est permis que si deux versions envoient
   la même chose pour des sens différents. Il cite alors la trace qui le prouve.
3. **Une référence et des traces par mineure.** La sonde garde
   `scripts/<agent>-probe.expected/<majeure.mineure>.json` au lieu d'un seul fichier : `--accept`
   ne touche que la mineure sondée, et on compare à la référence de la même mineure (à défaut, à la
   plus proche, en le disant). Chaque mineure de la fenêtre garde ses traces réelles
   (`--traces`), rejouées par `trace-replay.test.ts` à chaque `verify`. Une mineure qui sort de la
   fenêtre perd sa référence et ses traces (supprimées dans le même commit que `testedVersions`).
4. **Un scénario factice par comportement, pas par version.** Les scénarios sont nommés d'après le
   comportement et datés de leur relevé (`sous-agent-arriere-plan-2-3`). La grille de conformité
   joue chaque persona sur la forme la plus récente **et** sur la plus ancienne de la fenêtre,
   quand elles diffèrent. Ainsi les versions anciennes restent vertes sans être installées.
5. **La veille.** Un job CI hebdomadaire et gratuit (sur le modèle d'`opencode-probe.yml`) compare
   `npm view @ibm/bob version` et la dernière release d'`anomalyco/opencode` à `testedVersions`.
   Une nouvelle mineure fait échouer le job, avec un message clair. Le passage avec modèle reste
   manuel (gratuit pour OpenCode, 0 bobcoin pour Bob). La tâche planifiée proposée côté
   utilisateur ferait la même comparaison localement ; une seule des deux suffit.

## Alternatives écartées

- **Adaptateurs par plage de versions partout** : il faudrait connaître la version pour chaque
  forme. Cela casse sur une préversion ou une version de développement, et cela double les
  chemins. Reconnaître le comportement couvre aussi les versions qu'on n'a pas vues, s'il ne
  change pas.
- **Refuser les versions hors fenêtre** ou passer en « mode dégradé » : ce serait punir
  l'utilisateur pour une casse qu'on n'a pas constatée. L'avis suffit, et le générique fait déjà
  le mode dégradé (ce qu'on ne reconnaît pas s'affiche en outil ordinaire).
- **Installer plusieurs versions en CI** : impossible pour Bob (identifiants, bobcoins). Pour
  OpenCode, cela coûterait du temps de CI pour peu de chose, puisque les traces réelles rejouées
  couvrent le même risque sans réseau.
- **Une fenêtre par durée** (par exemple 3 mois) : elle garderait trop de mineures d'OpenCode et
  trop peu de Bob.

## Conséquences

- La sonde change de forme (une référence par mineure). Il faut une fiche pour la migration : la
  2.0.32 actuelle devient `2.0.json`, la 2.3.0 devient `2.3.json`.
- Chaque nouvelle mineure coûte une sonde avec modèle, des traces et, si le comportement change,
  un scénario factice. C'est le même prix qu'aujourd'hui, mais rien ne se perd plus.
- `testedVersions` diminue parfois. Un utilisateur sur une mineure sortie de la fenêtre voit
  l'avis « non essayée » ; c'est voulu.
- Il faudra surveiller les **comportements tributaires d'une course** (fiche 232 : le travail
  relayé ou non selon la fin du tour). Ils sont vérifiés quand on les observe et jamais comparés
  aux références (`TIMING_DEPENDENT`), sans quoi la sonde serait rouge au hasard.
- Ce qui reste invisible : une casse chez un utilisateur sur une version jamais publiée par npm ou
  GitHub (build maison). L'avis du Diagnostic et le journal (`BOBINE_LOG=trace`) restent le seul
  recours, sans télémétrie.
