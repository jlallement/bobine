# 160 — Conversations filles pilotées comme les sessions de Claude Desktop (la mère en tech lead)

- **Statut** : fait
- **Dépend de** : 097 (conversations filles, ADR-0019), 112 (carte « Tâches proposées »), 117
  (carte « Sous-tâches »), 118 (contexte de session d'une mère), 120 (fusionner toutes les filles),
  150 (consignes consultables), ADR-0020 (plafond), ADR-0028 (indépendance aux agents)
- **Agents** : tous. Tout passe par les outils du serveur MCP de l'app et le réglage générique de
  catégorie `model` ; aucun nom d'agent en dur hors des profils (ADR-0011, ADR-0028).

## Pourquoi

Décision de l'utilisateur du 28/10 : reproduire le fonctionnement des sessions de Claude Desktop.
La conversation mère est un **tech lead** : elle découpe, choisit l'agent et le modèle de chaque
fille, contrôle leur travail **sans saturer son contexte** (une note courte à chaque fin de tour,
jamais le diff), vérifie elle-même par git ou par un sous-agent, renvoie des remarques à la fille
(qui garde son contexte), puis recommande — ou non — la fusion. **C'est l'utilisateur qui
fusionne.**

## Critères d'acceptation

- [x] `start_child` prend `agent`, `model` et `why` facultatifs, des **suggestions** soumises à
      l'utilisateur. L'agent est cherché parmi les profils (identifiant ou nom), le modèle parmi
      les options du réglage `model` de l'agent de la mère ; une valeur inconnue, un agent
      indisponible ou un modèle demandé pour un autre agent donnent une erreur claire avec les
      valeurs possibles, sans carte.
- [x] Capacité de profil `childModelChoice: 'ask'` (OpenCode, agent factice ; absente pour Bob),
      listée dans `specificItems` (`child-model`) et la matrice de `docs/agents.md`. Sans elle :
      `model` refusé (« profile does not allow choosing the model »), aucun champ modèle sur la
      carte ni dans « Lancer en parallèle… ».
- [x] La carte « Tâches proposées » présélectionne l'agent et le modèle suggérés, sélecteurs
      ouverts, et affiche « Suggéré par la mère, à confirmer » avec la raison ; rien ne part sans
      « Lancer » (suggestion confirmée ou changée).
- [x] Compte rendu borné : état, branche, fichiers touchés avec +/− (les premiers seulement), le
      **début** du récapitulatif de la fille ; un plafond en caractères par compte rendu
      (`REPORT_CHARS`), testé avec un titre, des fichiers et une réponse démesurés. Jamais de diff.
- [x] Les descriptions de `start_child`, `message_child`, `recommend_merge`, le réveil et le
      contexte de session (fiche 118) disent que le compte rendu n'est pas une preuve : vérifier par
      ses propres outils (git sur la branche, fichiers à risque, contrôles du projet) ou par un
      sous-agent, renvoyer les corrections par `message_child`, ne jamais fusionner soi-même.
- [x] `recommend_merge` (`child`, `ready`, `note`) pose une recommandation dans le fil de la mère ;
      elle s'affiche dans le fil et sur la ligne de la fille dans « Sous-tâches ». Un tour de la
      fille après la recommandation la rend caduque (« à revoir »).
- [x] Aucun outil de l'agent ne fusionne. « Fusionner » dans « Sous-tâches » : quand la mère a
      donné au moins une recommandation, le bouton ne fusionne que les filles recommandées ; les
      autres restent possibles après une confirmation.
- [x] Testé contre l'agent factice : scénarios `filles-tech-lead` (fille lancée avec un modèle et
      une raison, correction par `message_child`, puis recommandation), `fille-bavarde` (réponse
      et liste de fichiers démesurées, compte rendu borné) et `filles-modele` (modèle interdit par
      le profil, suggéré puis confirmé, suggéré puis changé) ; tests unitaires ; suite e2e
      `filles-tech-lead` écrite.

## Plan

Pas de nouvelle dépendance. Un ADR (0036) : la mère recommande, l'utilisateur fusionne ; le
compte rendu est borné et ne contient jamais de diff ; la mère choisit agent et modèle sous le
contrôle de l'utilisateur. Il complète ADR-0019 (qui prévoyait « la fin de sa dernière réponse »
et des branches que la mère « dit » à l'utilisateur de fusionner) sans le modifier.

### Fichiers

- `src/shared/children.ts` : `ChildProposal` gagne `profileId`, `model`, `why` ; type
  `ChildRecommendation` et `childRecommendations(items)` (dernière recommandation par fille,
  caduque après un compte rendu plus récent) ; compte rendu : `replyRecap` (début de la dernière
  réponse, 400 caractères) remplace la fin ; `reportLine` borne chaque compte rendu envoyé à
  l'agent (`REPORT_CHARS`, 8 fichiers cités, titre coupé) ; textes « le compte rendu n'est pas une
  preuve » dans `childContext`, `WAKE_TEXT`, `capabilitiesContext`. Tests.
- `src/shared/agent.ts`, `src/shared/transcript.ts`, `src/shared/export.ts` : évènement et élément
  `child-recommendation`.
- `src/main/conversations/children.ts` : `choices(motherId)` (profils et réglage `model` de la
  mère), `recommend(motherId, child, ready, note)`. Tests.
- `src/main/mcp/children-tools.ts` : `start_child` (`agent`, `model`, `why`, validation par
  `resolveChoice`), `recommend_merge`, descriptions. Tests.
- `src/main/agent/app-tools-bridge.ts` : rien (la proposition passe telle quelle).
- `src/renderer/src/components/thread/ChildProposals.tsx` : présélection et raison.
- `src/renderer/src/components/thread/Subtasks.tsx`, `SubtasksMerge.tsx`, `Transcript.tsx` :
  élément de recommandation, pastille sur la ligne, fusion des seules recommandées et
  confirmation pour les autres. Tests.
- `src/shared/i18n/locales/fr.json`, `en.json`, `styles.css`.
- `src/mock-agent/scenarios-filles.mts` (nouveau, le catalogue est long) : `filles-tech-lead`,
  `fille-bavarde`, `fille-corrigee`.
- `e2e/suites/filles-tech-lead.mjs` (nouveau) et son inscription au catalogue.
- Docs : `docs/acp.md` (rien de Bob : outils de l'app), `docs/architecture.md`, ADR-0036,
  `CHANGELOG.md` / `CHANGELOG.en.md`, index.

### Étapes

1. Partagé : proposition, recommandation, compte rendu borné, textes ; tests.
2. Main : `choices`, `recommend`, outils ; tests.
3. Renderer : carte de proposition, recommandation, fusion ; tests.
4. Agent factice, suite e2e (écrite, pas lancée : le tech lead la lance à la fusion).
5. Docs, `./scripts/verify`, commits.

## Journal

- 2026-10-28 : fiche et plan.
- 2026-10-28 : implémenté selon le plan, ADR-0036 (proposé).
  - `start_child` : `agent` (identifiant ou nom), `model` (valeur ou nom d'option), `why` (coupée
    à 160 caractères). L'aide de `agent` cite les agents disponibles à l'ouverture de la session.
    Un modèle n'est validable que pour l'agent de la mère : pour un autre agent, erreur claire
    (il prend son dernier modèle, comme dans « Lancer en parallèle… »).
  - La décision de la carte fait foi : la présélection n'est qu'un état initial de la ligne ; si
    l'utilisateur revient à l'agent de la mère, la proposition ne s'applique plus.
  - Compte rendu : `RECAP_CHARS` = 400 (début de la dernière réponse, au lieu de la fin : écart
    assumé à l'ADR-0019, dit par l'ADR-0036), `REPORT_CHARS` = 1 200 par compte rendu dans le
    contexte de la mère, 8 fichiers cités. La carte du fil montre aussi le début.
  - `recommend_merge` a son libellé d'appel (`appTools.recommend_merge`). La recommandation
    s'affiche dans le fil (« La mère recommande de fusionner… ») et en pastille sur la ligne de
    « Sous-tâches » (« Recommandée », « Pas encore prête », « À revoir » si la fille a refait un
    tour) ; la pastille de fusion de la fiche 120 l'emporte quand elle existe.
  - Fusion : dès qu'une fille finie a une recommandation, « Fusionner la/les N recommandée(s) »
    et « Inclure les M autres… » (confirmation, puis toutes dans l'ordre de lancement). Sans
    aucune recommandation : comportement de la fiche 120 inchangé.
  - Compatibilité Bob (`docs/acp.md`) : rien de nouveau côté protocole, des outils de plus sur le
    serveur MCP `bobine`, comme l'étape 2 de la fiche 097. Grille de conformité (fiche 139) : non
    concernée (aucune forme ACP nouvelle).
  - Suite e2e `filles-tech-lead` écrite et inscrite au catalogue, **pas lancée** (le tech lead la
    lance à la fusion), pas plus que `filles` et `filles-fusion`, touchées par les mêmes fichiers.
- 2026-10-28 : **correction demandée par l'utilisateur** (relayée par la session mère) : la mère
  ne choisit jamais seule le modèle. Écart au plan : capacité de profil `childModelChoice`
  (`'ask'` ou absente), déclarée par OpenCode et l'agent factice (`MOCK_CHILD_MODEL=none` pour
  jouer Bob), absente de Bob ; `ProfileSummary.childModel` ; `start_child` refuse `model` sans
  elle ; la carte et « Lancer en parallèle… » n'offrent alors aucun champ modèle (« L'agent
  choisit son modèle. »). Agent et modèle suggérés : sélecteurs ouverts d'emblée, « Suggéré par la
  mère, à confirmer ». Filles « lancées sans carte » (fiche 118) : il n'en existe pas, tout
  `start_child` passe par la carte (réglage « Jamais / Quand ça s'y prête / Toujours » ne change
  que le contexte de session) ; la règle vaut donc partout. Scénario `filles-modele` et essais
  pour les trois cas (interdit, confirmé, changé).
- 2026-10-28 : `./scripts/verify` : documentation, lint, typecheck et format verts. Les tests,
  lancés pendant que la machine tournait à une charge ≈ 900 (sept sessions en parallèle), ont
  dépassé leurs délais dans des suites sans rapport (signature, `agent-host`, mesures de temps) ;
  les suites touchées (79 fichiers, 720 essais, dont les essais d'intégration des filles) passent
  avec `--testTimeout=90000`. À relancer au calme par le tech lead. Pour tenir `transcript.ts`
  sous 800 lignes, `attachmentOf` est passé dans `shared/attachments.ts` ; les lignes d'export des
  filles dans `childLines` (`shared/export.ts`).
- 2026-10-28 : relecture du tech lead, corrections.
  - Le main vérifie la règle du modèle : `ChildConversations.start` refuse un `model` quand le
    profil de la fille n'a pas `childModelChoice` (`children.error.modelNotAllowed`), quel que soit
    le chemin ; le renderer ne fait plus foi seul.
  - ADR renuméroté **0036** (0034 et 0035 pris sur main et par le lot D).
  - `start_child` (`prompt`) et `message_child` (`message`) refusent une commande « / » en tête
    (`leadingCommand`). L'agent factice lit donc `/scenario` aussi en deuxième ligne, après une
    ligne de texte ; ses consignes de filles commencent par « Consigne de test. ».
  - `message_parent` borné à `PARENT_MESSAGE_CHARS` (2 × `REPORT_CHARS`), avec
    « (cut: N characters in all) ».
  - Carte : « Lancer » désactivé tant que la suggestion (profils, modèle de la mère) n'est pas
    lisible, pour ne jamais la perdre en silence.
- 29/10, intégration (tech lead) : suite e2e `filles` (dont tech lead) verte, clair et sombre. Essai
  réel avec OpenCode 2.1.4 (`opencode/big-pickle`) : la mère a proposé une fille avec un modèle
  suggéré et sa raison, « à confirmer » sur la carte ; aucune fille lancée sans « Lancer ».
- 29/10, essai réel avec Bob 2.0.6 : la mère propose la fille, « Lancer », la fille travaille dans
  son worktree (deux autorisations), commite, son compte rendu revient dans la mère, qui se réveille
  et vérifie. **Écart trouvé** : Bob passait d'abord `model` (Haiku) à `start_child`, refusé, d'où
  une ligne « échec » au-dessus de la carte avant le bon appel. Quand le profil de la mère n'a pas
  `childModelChoice`, `start_child` n'a donc plus d'argument `model` ; Bob le passant quand même
  (consigne qui l'invite à suggérer un modèle), il est ignoré — la fille part sans — et la réponse
  de l'outil l'en avertit, au lieu d'un appel refusé. `ChildConversations.start` le refuse toujours.
- 2026-11-14 (fiche 223, relecture) : le modèle choisi pour une fille (`applyModel`) était aussi
  retenu comme modèle par défaut du profil (`setControl` mémorise) ; posé désormais pour la fille
  seulement (`setControl(…, { remember: false })`).
