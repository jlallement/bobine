# 139 — Contrat ACP testable : grille de conformité, traces rejouées, scénarios aux limites

- **Statut** : fait (traces enregistrées par les sondes : à faire au prochain passage de `bob-probe` / `opencode-probe`)
- **Dépend de** : 002 (agent factice), 041 (pannes), 048 (sonde de Bob), 078 (sonde d'OpenCode),
  096 (rejeu d'OpenCode), 103 (fil durable), 121 (relance après panne), 122 (états des cartes)
- **Agents** : les trois personas (« façon Bob », « façon OpenCode », « ACP minimal ») ; rien de
  propre à un agent dans l'app : les personas réutilisent les vrais profils `bob` et `opencode`
  (leurs adaptateurs) avec l'agent factice comme commande.

## Pourquoi

Les défauts de la recette d'octobre (fiches 121 à 127) venaient surtout des **écarts entre
agents** : rejeu tardif de Bob, patch d'OpenCode annoncé `pending {}`, sous-agents en arrière-plan,
cartes restées « en cours », réponses doublées après une relance. Chacun a été corrigé après coup,
avec un test isolé. Il manque une grille qui joue **les mêmes parcours** contre **chaque forme
d'agent**, et vérifie à chaque fois les mêmes invariants, pour attraper ces défauts avant la
recette — et pour qu'un troisième agent ACP (fiche 141) ait son filet dès le premier jour.

Étude : `docs/feuille-de-route-2026-10-23.md`, itération 4, lot 139.

## Critères d'acceptation

- [x] Grille de conformité : trois personas d'agent factice × douze parcours, dans `./scripts/verify`
      (moins de 30 s, ou commande dédiée signalée).
  - Personas : « façon Bob » (rejeu tardif, coût par la base, `spawn_subagent`, titres bruts,
    pas d'options), « façon OpenCode » (patch en `pending {}`, `execute`, sous-agents en
    arrière-plan, `usage_update`), « ACP minimal » (ni `loadSession`, ni images, ni plan, ni usage).
  - Parcours : prompt simple ; autorisation acceptée puis refusée ; plan ; cycle complet d'un
    outil ; annulation ; panne puis relance ; reprise après redémarrage ; sous-agent avec un
    message envoyé pendant qu'il travaille ; compaction ; élicitation ; file d'attente ;
    changement d'agent.
  - Invariants à chaque parcours : plus aucune carte « en cours » à la fin, pas de doublon, fil
    durable (fiche 103) identique au fil vivant, état de l'agent cohérent.
- [x] Traces : les sondes `bob-probe` et `opencode-probe` savent enregistrer des traces nettoyées
      (NDJSON, secrets et chemins masqués) dans `__traces__/<agent>-<version>/` ; un test les
      rejoue dans `session-updates` + `reduceTranscript` et compare le fil à un instantané. Sans
      lancer de vrai agent : une ou deux traces **reconstituées** d'après les journaux de recette.
- [x] Scénarios factices aux limites, documentés dans `docs/mock-agent.md` : réseau coupé en plein
      flux, limite de débit 429, diff de plus de 5 000 lignes, fichier binaire, sortie de commande
      de 1 Mo, `available_commands_update` en cours de session, démarrage lent (8 s), emoji, écrit
      de droite à gauche, très longues lignes.
- [x] Coordination avec la fiche 142 (pannes réseau côté app) écrite ci-dessous.
- [x] Défauts révélés : corrigés avec un test s'ils sont petits, sinon ouverts ici avec leur
      reproduction.
- [x] `docs/acp.md` (matrice : ce qui est testé automatiquement), `docs/mock-agent.md`, index.

## Plan

Pas d'interface touchée : pas d'e2e. Aucune dépendance nouvelle.

1. **Agent factice** (`src/mock-agent/`)
   - `--sans-plan` : les mises à jour `plan` ne partent pas (agent sans plan, persona minimal).
   - `--arriere-plan-ms <ms>` : délai de fin des sous-agents en arrière-plan (4 s / 12 s par
     défaut) raccourci pour la grille.
   - `--demarrage-lent <ms>` : `initialize` répond après ce délai (démarrage lent, 8 s dans le
     scénario documenté).
   - Nouveaux scénarios dans `scenarios-limites.mts` (le catalogue de `scenarios.mts` dépasse
     déjà 2 700 lignes) : `reseau-coupe`, `limite-debit`, `diff-geant`, `fichier-binaire`,
     `sortie-1mo`, `commandes-en-cours`, `textes-limites` (emoji, droite à gauche, lignes très
     longues). Catalogue testé par `mock-agent.test.ts`.
2. **Grille** (`src/main/conformance/`)
   - `personas.ts` : les trois personas, chacune = profil (vrai profil `bob` / `opencode` de
     `resolveProfiles`, commande remplacée par l'agent factice ; profil nu pour « minimal »),
     arguments de l'agent factice, scénario de chaque parcours.
   - `journeys.ts` : les douze parcours, joués par `ConversationManager` (vrai gestionnaire,
     vrai stockage dans un dossier jetable, agent factice en sous-processus, délai 0).
   - `invariants.ts` : les quatre invariants (fil vivant, fil relu par un `ConversationStore`
     neuf, état de l'hôte).
   - `conformance-<persona>.test.ts` : un fichier par persona, pour que vitest les joue en
     parallèle.
3. **Traces** (`src/main/agent/`)
   - `acp-trace.ts` : enregistreur NDJSON (`{ dir: 'in'|'out', msg }` par ligne) avec masquage
     (`log-redact`, dossier personnel, dossiers jetables) ; branché sur les deux sondes par
     `--traces` (écrit `__traces__/<agent>-<version>/<sondage>.ndjson`).
   - `trace-replay.ts` : rejoue une trace (sessions ouvertes, tours, rejeu de `session/load`)
     dans `routeUpdate` puis `reduceTranscript` ; `trace-replay.test.ts` compare à un instantané.
   - `__traces__/bob-2.0.6-reconstituee/`, `__traces__/opencode-2.0.32-reconstituee/` : traces
     rebâties d'après `e2e/captures/recette-2026-10/*/journaux/agents.log` (journal résumé : JSON
     coupé, identifiants raccourcis, complétés à la main), marquées « reconstituées ».
4. **Docs** : `docs/acp.md` (matrice : colonne « Grille 139 »), `docs/mock-agent.md`, cette fiche,
   l'index, `docs/architecture.md` (grille et traces).

## Coordination avec la fiche 142 (pannes réseau côté app)

La 139 fournit les scénarios ; la 142 décide ce que l'app en fait (avis, reconnexion
progressive, relance). Contrat des scénarios :

- `reseau-coupe` : texte en streaming, une lecture en cours, puis, sans pause, le tour échoue comme
  un agent dont la requête au modèle est coupée : erreur JSON-RPC `-32603` « Internal error:
  Network error », `data.details` = `fetch failed (ECONNRESET)`. Le processus reste vivant : un
  nouveau message repart. Aujourd'hui l'app affiche la cause (`fetch failed (ECONNRESET)`) dans l'avis d'erreur et interrompt
  l'outil (correction de cette fiche) ; la 142 décide s'il faut proposer de réessayer.
- `limite-debit` : le tour échoue d'entrée en `-32603`, `data` =
  `{ status: 429, details: "Rate limit exceeded", retryAfter: 2 }` ; un tour d'un autre scénario
  passe ensuite (le scénario est joué à chaque tour où il est choisi). Aujourd'hui l'app affiche la
  cause ; `retryAfter` n'est lu nulle part : c'est à la 142 d'en faire quelque chose.
- `--demarrage-lent <ms>` : `initialize` tarde (8 000 ms dans la doc, 1 500 dans nos essais) ;
  l'app attend jusqu'à 60 s (`TIMEOUTS.initializeMs`). La 142 peut s'en servir pour l'attente au
  démarrage.
- Pour les rejouer à travers l'app : `src/main/conformance/limits.test.ts` (harnais
  `conformance/harness.ts`, invariants `conformance/invariants.ts`) ; une note de passation est dans
  le dossier partagé des sessions.

Rien de cela n'est un relevé de Bob ni d'OpenCode : formes plausibles, à confronter au premier
essai réel (la 142 note ce qu'elle observe ; on ajuste les scénarios ici si besoin).

## La grille (résultat du 2026-10-24)

36 cases, toutes vertes après les deux corrections ci-dessous ; trois passages d'affilée verts
(9,5 à 10,3 s). `pnpm vitest run src/main/conformance` la joue seule.

| Parcours | Façon Bob | Façon OpenCode | ACP minimal |
|---|---|---|---|
| prompt simple | ✓ `streaming-texte` | ✓ | ✓ |
| autorisation acceptée, puis refusée | ✓ `titres-bob` (titres bruts) | ✓ `permission` | ✓ `permission` |
| plan | ✓ `liste-taches` (autorisation par mise à jour) | ✓ `plan` | ✓ `plan` avec `--sans-plan` : aucun plan affiché |
| cycle complet d'un outil | ✓ `modifications` (écritures réelles) | ✓ `outil-en-preparation` (`pending {}`) | ✓ `appel-outil` |
| annulation | ✓ `lent` | ✓ `outil-en-preparation-interrompu` | ✓ `lent` |
| panne puis relance | ✓ `plantage`, rejeu tardif à 50 ms | ✓ | ✓ **après la correction 1** ; relance → session neuve, échange reçu (défaut 3, corrigé par la fiche 141) |
| reprise après redémarrage | ✓ rejeu tardif | ✓ `patch-opencode` | ✓ session neuve, fil intact, échange reçu (défaut 3, corrigé par la fiche 141) |
| sous-agent, message pendant | ✓ `sous-agent-bob` (message en file) | ✓ `sous-agent-arriere-plan` (message après le tour, fin vue) | ✓ `sous-agent` (`subagent_update` : pas de carte, défaut 4) |
| compaction | ✓ `/compress` (résumé en texte) | ✓ `/compact` (`compaction_update`) | ✓ |
| élicitation | ✓ `bob-elicitation` | ✓ `question-opencode2` | ✓ |
| file d'attente | ✓ deux messages partis ensemble | ✓ | ✓ |
| changement d'agent | ✓ vers « façon OpenCode » | ✓ vers « ACP minimal » | ✓ vers « façon Bob » |

Invariants à chaque case : plus rien « en cours » (outils, travail des sous-agents, autorisations,
questions, résumés) ; pas de doublon (identifiants, cartes d'un tour, messages répétés, texte
doublé bout à bout comme « pongpong 2 », autant de messages que d'envois) ; fil durable relu par
un `ConversationStore` neuf et `settleTranscript` = fil affiché ; agent au repos, liste et agent
d'accord, file vide, aucun tour ouvert dans la consommation.

Scénarios aux limites à travers l'app (`limits.test.ts`, 8 essais, mêmes invariants) : tous verts
après la correction 2.

Traces rejouées (`trace-replay.test.ts`) : trois traces reconstituées, instantanés écrits ; ce
qu'elles disent est aussi vérifié en clair (refus puis Stop chez Bob, rejeu tardif sans doublon,
`execute` en erreur et travail du sous-agent sous sa carte chez OpenCode).

**La grille attrape-t-elle des régressions ?** Essai par mutation : sans la fermeture des outils en
fin de tour (`closeUnfinishedTools`), deux cases échouent (Bob : autorisation ; OpenCode :
annulation) ; sans le filtre de l'écho des messages (`session-updates.ts`), aucune — aucun agent
cible n'envoie cet écho (vérifié dans les journaux de recette : les `user_message_chunk` vus
pendant un tour sont des rejeux de `session/load`), l'agent factice non plus.

## Défauts trouvés

1. **Corrigé** (`bea493a`) — Agent arrêté en plein tour : le tour restait « ouvert » dans la
   consommation du fil (`usage.pending`), alors que le journal de consommation (fiche 130) le
   comptait. Le coût relu ensuite n'allait à aucun tour, et la reprise depuis les fils (fiche 137)
   l'ignorait. Le réducteur clôt le tour sur `exited` / `error`, comme sur `turn-error`. Test :
   `transcript.test.ts` (« agent arrêté en plein tour »). Trouvé par la case « panne puis relance »
   d'ACP minimal (agent qui ne repart pas, donc tour jamais refermé par le suivant).
2. **Corrigé** (`9b8b988`) — Tour en échec (réseau coupé) : un outil annoncé juste avant l'erreur
   arrivait parfois **après** l'avis d'échec (la réponse et les notifications passent par des files
   distinctes du SDK) et restait « en cours » pour toujours ; relu du disque, il devenait
   « interrompu » (fil durable ≠ fil affiché). L'hôte laisse passer les mises à jour reçues avant
   d'émettre `turn-error`, comme il le fait avant `turn-end`. Tests : `limits.test.ts` (échoue
   5 fois sur 5 sans la correction, sous la charge des essais parallèles) et `agent-host.test.ts`
   (« réseau coupé », course : échoue environ 2 fois sur 5 sans la correction).
3. **Corrigé par la fiche 141** (ADR-0030 : session neuve dans la même conversation, échange d'avant joint au prochain message ; persona minimale déclarée comme agent personnalisé) — Agent sans `loadSession` ni `session/resume` : après une panne ou un
   redémarrage, la conversation passe en **lecture seule** (« Continuer dans une nouvelle
   conversation », fiche 015). C'est le comportement voulu, mais pour un « Agent ACP personnalisé »
   minimal, chaque redémarrage de l'app fige toutes ses conversations. Piste : rouvrir une session
   neuve dans la même conversation avec l'échange d'avant en contexte, comme la bascule d'agent
   (fiche 108). Reproduction : `pnpm vitest run src/main/conformance/conformance-minimal.test.ts`
   (cases « panne » et « reprise », qui attendent `read-only`), ou dans l'app : profil factice avec
   `--sans-historique`, `/scenario plantage`, puis « Relancer ».
4. **Ouvert** (pour la 140) — `subagent_update` (ACP, instable) est ignoré : le travail d'un
   sous-agent annoncé ainsi n'apparaît nulle part (ni carte, ni travail rangé). Seuls les formats
   de Bob et d'OpenCode sont reconnus (`shared/subagent.ts`). Reproduction : case « sous-agent »
   d'ACP minimal (le fil n'a que le texte du parent).

## Écarts au plan

- **Aucune trace enregistrée** : lancer Bob ou OpenCode était exclu. Les sondes savent les écrire
  (`--traces`) ; trois traces sont **reconstituées** d'après `agents.log` de la recette (dossiers
  `*-reconstituee/`, `reconstituted` dans l'en-tête, provenance et ce qui a été complété). Le
  générateur qui les a rebâties n'est pas versionné (script jetable) : les traces et le README de
  `__traces__/` font foi.
- La trace du rejeu tardif suit l'ordre de la fiche 121 (message parti après le rejeu) ; dans la
  recette, le message le croisait (« pongpong 2 »), ce que le réducteur seul ne peut pas éviter :
  c'est l'attente de l'hôte (fiche 121) qui l'évite, testée par `agent-host.test.ts`.
- Le rejeu de trace ne suit pas les sous-agents en arrière-plan (pas de `SubagentTracker`) : la carte
  du sous-agent d'OpenCode y est « completed » là où l'app la garde « en cours ».
- « Réveil après une veille » (liste de l'étude) n'est pas dans la demande : pas fait. La grille
  couvre « reprise après redémarrage », qui passe par le même chemin (fil gardé, fiche 103).
- Temps : la grille seule ≈ 10 s (36 cases, trois fichiers en parallèle) ; l'étape « Tests » de
  `verify` passe de 38,7 s à 49,6 s (+ 11 s, 257 fichiers), `verify` complet 1 min 03 ; au dernier passage, 39 s et 51 s (la durée varie avec la charge de la machine). Pas de
  commande dédiée.
- Stabilité : sur 15 passages complets de `pnpm test` en fin de lot, **un** échec isolé (1 test
  sur 1 853), pas reproduit dans les 14 autres ni identifié (sortie non gardée). Les fichiers de la
  grille, joués seuls, sont verts sur six passages. À surveiller : si l'échec revient, lancer
  `pnpm test 2>&1 | grep -A30 FAIL` et l'ouvrir ici.
- Pas d'e2e : aucune interface touchée.
- Format des traces : `{ from: 'client' | 'agent', t, msg }` (plus clair que `dir: in | out` prévu).
- `docs/acp.md` : pas de nouvelle colonne dans la matrice (elle a déjà quatre colonnes larges) ; la
  colonne « Vérifié par » cite la case de la grille, et une section « Contrat testé
  automatiquement » décrit la grille.
- Persona minimale : « cycle complet d'un outil » joue `appel-outil` ; « sous-agent » joue
  `sous-agent` (`subagent_update`, défaut 4) ; « panne » et « reprise » attendent la lecture seule
  (défaut 3), pas une reprise.

## Journal

- 2026-10-24 : fiche créée, plan écrit avant de coder.
- 2026-10-24 : agent factice (`--sans-plan`, `--arriere-plan-ms`, `--demarrage-lent`, sept
  scénarios aux limites dans `scenarios-limites.mts`) ; grille de conformité (`src/main/conformance/`,
  36 cases) ; traces nettoyées (`acp-trace.ts`, `--traces` des deux sondes, `trace-replay.ts`, trois
  traces reconstituées) ; scénarios aux limites joués à travers l'app ; deux défauts corrigés, deux
  ouverts ; `docs/acp.md` (matrice, section « Contrat testé automatiquement »), `docs/mock-agent.md`
  (options, scénarios, personas), `docs/architecture.md`, CHANGELOG. `./scripts/verify` vert.
- 2026-10-24 (fusion dans `integration/vagues`, avec la 140 et la 142) : un seul jeu de scénarios
  réseau, celui de la 142 (`scenarios.mts`) ; `reseau-coupe` y garde la forme de cette fiche (texte
  et lecture en cours, coupure sans pause), la cause passant sur la sortie d'erreur ; `limite-debit`
  (429 une fois, puis réponse) remplace celui d'ici, `retryAfter` abandonné (lu nulle part). Les
  essais « réseau coupé » et « 429 » suivent la reconnexion : cinq tentatives puis une seule erreur,
  outil interrompu à chaque tentative ratée (évènement `attempt-failed`, voir la fiche 142) ; la
  grille passe ses attentes courtes au gestionnaire (`retryDelaysMs`). Le rejeu des traces passe par
  `ProfileUpdates` (marque des sous-agents de la 140) ; `src/main/conformance/` est exempté de la
  règle ESLint « nom d'agent en dur » comme les tests.
