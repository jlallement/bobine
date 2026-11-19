# 157 — Pendant le tour : commande bloquée, contexte presque plein, plafond de coût

- **Statut** : fait
- **Dépend de** : 018 (sortie des commandes), 019 / 109 / 130 (consommation), 039 (commandes de
  l'app), 134 (jetons de thème)
- **Agents** : les deux, et tout agent ACP — chaque point ne s'allume que si l'agent envoie ce dont
  il a besoin (sortie des commandes, remplissage du contexte, coût ou jetons) ; rien de propre à un
  agent hors des adaptateurs existants (`bob-costs.ts`, `terminal-output.ts`).

## Pourquoi

Pendant qu'un agent travaille, trois situations demandent aujourd'hui de surveiller l'écran : une
commande qui ne rend plus rien (bloquée sur une invite, une attente réseau), un contexte qui se
remplit jusqu'à la compaction forcée, et une conversation qui coûte plus que prévu. Bobine ne
double pas les garde-fous de l'agent : elle informe et donne la commande à portée de clic.

## Critères d'acceptation

- [x] **Commande bloquée** : une carte de commande en cours, sans nouvelle sortie depuis le seuil
  (Réglages › Conversations, 3 min par défaut, de 1 à 30), affiche « Aucune sortie depuis N min »
  et « Interrompre » (même effet que ■ : `session/cancel`). Seulement pour une commande dont
  l'agent envoie la sortie (extension de terminal, fiche 018) ; l'avis disparaît dès qu'une sortie
  arrive ou que la commande se termine.
- [x] **Contexte presque plein** : à 80 % (seuil `USAGE_WARN` existant), la puce de consommation
  est orange et un bouton « Compacter » à côté envoie la commande de compaction du profil (comme
  `/compact`, fiche 039) ; rien quand l'agent ne donne pas de remplissage, ni quand son profil n'a
  pas de commande de compaction. Contrastes AA vérifiés (jeton `warn`, fiche 134).
- [x] **Plafond de coût** : Réglages › Conversations › « Plafond par conversation » (désactivé par
  défaut, pour les nouvelles conversations) : un montant dans l'unité de l'agent (bobcoins pour Bob, dollars sinon) et, pour un
  agent sans coût connu, un nombre de jetons — le réglage le dit. Modifiable par conversation dans
  le détail de la puce de consommation (valeur propre, « Par défaut », « Aucun »).
- [x] Au-delà du plafond pendant un tour, Bobine attend la fin de l'outil en cours, interrompt le
  tour (`session/cancel`) et pose une carte « Plafond atteint » : « Continuer (plafond + X) »
  relève le plafond de la conversation et relance l'agent ; « Arrêter » ne fait rien de plus.
  Plafond franchi à la fin d'un tour (jetons, coût relu après coup) : même carte, sans
  interruption. Une carte par tour au plus ; tant que le plafond est atteint, un nouveau message
  est retenu avec une carte (« Continuer » l'envoie, « Arrêter » non).
- [x] Générique : s'appuie sur `ConversationUsage` (coût cumulé, jetons cumulés) ; aucun cas « si
  Bob » hors des adaptateurs.
- [x] Testé contre l'agent factice : `commande-silencieuse`, `cout-qui-monte`, `jetons-sans-cout`
  (avec `--sans-cout`), `contexte-80` ; tests unitaires (décision du plafond, gardien côté main,
  puce, carte, avis de commande bloquée) ; parcours « plafond de coût » dans la grille de
  conformité (fiche 139) ; e2e écrits (suite `turn-guards`).
- [ ] Suite e2e `turn-guards` jouée et captures regardées (clair et sombre) : à la fusion.
- [x] `docs/acp.md` : sortie des commandes et coût en cours de tour à vérifier avec Bob.

## Plan

**Où vit l'état du plafond** (ADR-0035) : dans le **fil** de la conversation (`TranscriptState`),
posé par des évènements de l'app (`cost-cap-set`, `cost-cap-reached`, `cost-cap-answer`) ; la
décision est prise dans le **main** par un gardien abonné au gestionnaire de conversations
(`subscribe`, comme les conversations filles), qui seul parle à l'agent (`cancel`, `prompt`). Le
fil est déjà persisté, rejoué au renderer et réduit des deux côtés : aucun champ de plus dans
l'index, la carte survit au redémarrage.

1. **Partagé**
   - `src/shared/cost-cap.ts` (nouveau) : `CostCap` `{ limit, unit }` (unité = devise, ou
     `tokens`), unité d'une conversation (`usage.cost.currency` sinon `tokens`), dépense dans cette
     unité, plafond effectif (fil › réglages), `capDecision` (`none` / `wait` / `interrupt` /
     `ask`), plafond suivant pour « Continuer ».
   - `src/shared/transcript.ts` : `costCap` dans l'état, élément `cost-cap`, réduction des trois
     évènements ; `reset` garde le plafond.
   - `src/shared/agent.ts` : les trois évènements dans `AgentEvent`.
   - `src/shared/preferences.ts` : `stalledCommandMinutes` (3), `costCapEnabled` (non),
     `costCapAmount` (5), `costCapTokens` (2 000 000).
   - `src/shared/stalled-command.ts` (nouveau) : minutes sans sortie d'après la dernière sortie vue.
2. **Main**
   - `src/main/conversations/cost-cap.ts` (nouveau) : `CostCapGuard` (abonnement, décision à chaque
     évènement utile, annulation, carte posée à la fin du tour, réponses) et ses handlers IPC
     `conversation:setCostCap`, `conversation:answerCostCap` ; branché dans `index.ts` et
     `ipc.ts`. Message de reprise envoyé à l'agent en anglais, non traduit (ADR-0014).
   - `src/main/agent/agent-host.ts` : coût hors protocole (`costSource`) relu aussi à la fin de
     chaque outil, pour que le plafond le voie pendant le tour (Bob : à vérifier).
   - `src/main/settings.ts`, `settings-store.ts` : nouvelles préférences ;
     `BOBINE_STALLED_COMMAND_MS` (essais) l'emporte sur le seuil.
3. **Renderer**
   - `src/renderer/src/turn-controls.ts` (nouveau) : contexte `TurnControls` (tour en cours,
     interrompre, seuil, réponse au plafond) fourni par `App` autour du fil.
   - `ToolCall.tsx` + `StalledNotice` : avis de commande bloquée.
   - `UsageMeter.tsx` + `CompactButton` + `CostCapRow` : bouton « Compacter », plafond de la
     conversation dans le détail.
   - `Transcript.tsx` + `CostCapCard.tsx` : carte « Plafond atteint ».
   - `ConversationSettings.tsx` : seuil de commande bloquée, plafond par défaut.
   - `preload/api.ts`, `shared/ipc.ts` : deux canaux.
   - Traductions `fr.json` / `en.json`, recherche des réglages.
4. **Agent factice** : `scenarios-pendant-tour.mts` (nouveau, comme `scenarios-limites`) ;
   `--sans-cout` (jetons sans coût, `MOCK_AGENT_USAGE=tokens`) ; le coût annoncé par un scénario
   devient le coût cumulé de la session.
5. **Essais** : unitaires (partagé, gardien contre l'agent factice, composants) ; e2e
   `pendant-tour.mjs` (commande silencieuse avec seuil court, compaction en un clic, plafond en
   dollars puis en jetons), clair et sombre.
6. **Docs** : `docs/acp.md` (matrice), `docs/agents.md` si concerné, `docs/architecture.md`,
   ADR-0035, index, CHANGELOG.

Aucune nouvelle dépendance.

## Journal

- 2026-10-28 — Fiche créée (lot D, menée en parallèle des fiches 154 à 159).
- 2026-10-28 — Fait, comme prévu, avec ces écarts et précisions :
  - La puce passait déjà en orange à 80 % (`USAGE_WARN`, fiche 019) : ajouté le bouton
    « Compacter » à côté (orange à 80 %, rouge à 95 %), qui passe par `/compact` (commandes de
    l'app) ; seulement quand l'agent est prêt et que son profil a une commande de compaction.
  - « Continuer » relève le plafond d'un pas (le plafond des réglages), au-delà de la dépense si
    elle l'a déjà dépassé, puis envoie « Continue là où tu t’es arrêté. » (texte pour l'agent, en
    français comme `AGENT_PROMPTS`, non traduit) — seulement si le tour avait été interrompu.
  - Plafond en jetons : les jetons ne sont comptés qu'à la fin du tour (`usage` de
    `session/prompt`) : la carte vient alors après le tour, sans interruption. Même chose pour un
    coût relu hors protocole qui n'arrive qu'après la réponse (Bob 2.0.6 tel que relevé).
  - `AgentHost` relit le coût hors protocole (`costSource`) à la fin de chaque outil, pour que le
    plafond puisse le voir pendant le tour.
  - « Aucun » dans le détail de la consommation retire le plafond de la conversation, « Par
    défaut » lui donne celui des réglages.
  - `transcript.ts` était à sa limite de lignes : `attachmentOf` est passé dans `attachments.ts`
    (sans changement), et la réduction des évènements du plafond vit dans `cost-cap.ts`.
  - Grille de conformité : treizième parcours « plafond de coût » (une carte en bobcoins pour
    Façon Bob, en dollars pour Façon OpenCode, aucune pour l'agent minimal).
  - Seuil de commande bloquée de 1 à 30 min ; `BOBINE_STALLED_COMMAND_MS` (essais) l'emporte.
  - Contrastes : couple `text` sur `warnSoft` ajouté à la grille de `themes.test.ts`.
  - `./scripts/verify` : lint, typecheck et tests verts, sauf des essais sensibles au temps sous
    forte charge de la machine (lots menés en parallèle) : parcours « sous-agent » de Façon
    OpenCode et mesures de latence de la boucle d'évènements (fiches 043, 046). Ils échouent de même
    sur `main` sous la même charge, et passent rejoués seuls ou machine au calme.
- 2026-10-28 — Relecture du tech lead :
  - Le plafond se contournait après « Arrêter » (une seule carte par plafond, puis plus rien) :
    désormais une carte par tour, et tant que le plafond est atteint chaque nouveau message est
    retenu avant l'envoi (`promptGate` du gestionnaire) avec une carte qui le cite ; « Continuer »
    relève le plafond et l'envoie, « Arrêter » ne l'envoie pas.
  - Le réglage vaut pour les nouvelles conversations : figé au premier message (`costCap:
    'settings'`) ; les conversations d'avant n'ont pas de plafond (« Par défaut » le leur donne).
  - ADR renuméroté 0035 (0034 pris sur `main`).
  - Le gardien ne relit le fil qu'après consommation, fin d'outil ou fin de tour (plus à chaque
    morceau de texte) ; il oublie une conversation supprimée ; « Continuer » n'attend plus la fin du
    tour relancé (l'appel IPC rend la main tout de suite).
  - Coût hors protocole relu à la fin d'un outil au plus toutes les 2 s (lecture SQLite synchrone).
  - Heure de la dernière sortie d'une commande : toujours côté renderer, bornée (oubliée à la fin
    de la commande, 200 au plus) ; pas dans `TerminalState`, pour garder le réducteur pur.
  - Le texte du réglage dit qu'un seul montant est compté dans l'unité de l'agent.
  - Reste : la suite e2e `turn-guards` (écrite, pas jouée ici : lancée à la fusion) ; essais avec
    Bob réel (`docs/acp.md` : coût écrit en cours de tâche, sortie des commandes en cours).
- 29/10, intégration (tech lead) : suite e2e `turn-guards` verte (clair et sombre) avec toute la
  suite ; sondes réelles vertes : `pnpm bob-probe` (Bob 2.0.6, coûts lisibles dans sa base) et
  `pnpm opencode-probe` (OpenCode 2.1.4, `usage_update` en USD, `/compact`).
- 2026-11-16 — **Relecture du coût après un tour : une seconde chance.** CI rouge sur `main`
  (9cde4c6, Windows) : « agent factice comme Bob » attendait un coût qui n'est jamais venu. Sur
  les passages verts (Linux, macOS, Windows), le tour suivant part 1,52 à 1,67 s après la fin du
  premier : le coût n'est trouvé que par la relecture de 1,5 s, jamais par celle de la fin du tour.
  L'agent factice l'écrit 300 ms après sa réponse (base créée au premier tour, trois transactions)
  : 1,2 s de marge, dépassée une fois sur une machine Windows chargée, et rien ne relisait
  ensuite avant le tour suivant. Le même trou vaut pour Bob réel, dont l'heure d'écriture n'est
  pas documentée. Désormais : relu à la fin du tour, à 1,5 s, et encore à 5 s si rien n'a changé
  (`session-cost.ts`) ; l'essai attend jusqu'à 6 s, au-delà de la dernière relecture.
- 2026-11-16 — **Essai oublié avec la relecture à 5 s.** `journal.test.ts` (« --cout-bob ») attendait
  encore 3 s : rouge sous Windows sur `main` 3cf4052 (premier tour fini à 10:56:13.914, jamais de
  second tour). Aligné sur la relecture de 5 s (attente de 6 s). Revus : les autres attentes d'un
  coût relu après un tour (e2e `usage`, 8 s puis 15 s ; sous-agents, relus pendant leur travail)
  dépassent déjà 5 s ; l'essai de l'accueil dépend de l'attente propre à l'app (`costWaitMs`,
  3 s, `agent-readiness.ts`), laissée telle quelle.
- 2026-11-16 — **Essai de l'accueil : coût attendu 5 s au lieu de 3** (`costWaitMs`,
  `agent-readiness.ts`), comme la dernière relecture d'une conversation. Le résultat de l'essai
  attendait déjà ce coût : il part dès que le coût est lu (relu toutes les 250 ms), et
  n'attend la limite que si l'agent n'écrit rien. Rendre le résultat tout de suite et le coût
  après n'est pas simple : la session d'essai est supprimée juste après, avec sa ligne de coût.
  Mesuré avec l'agent factice sans coût (`--sans-cout`, source de coût déclarée) : essai rendu en
  3,13 à 3,16 s avec 3 s, 5,17 à 5,18 s avec 5 s (0,10 s sans attente), soit 2 s de plus dans ce
  cas seulement. Essais : coût écrit à 4 s trouvé, plus de relecture ensuite ; aucun coût : rien
  avant 5 s, plus de relecture ensuite. Pas de ligne au CHANGELOG (rien de visible quand Bob écrit
  son coût).
- 2026-11-18 — **Coût écrit après la relecture de 5 s** (CI Windows, `main` 3bdb20a, run
  44413453495) : `journal.test.ts` (« --cout-bob ») rouge, premier tour fini à 22:46:46.970, aucun
  coût relu en 6 s, jamais de second tour. Le coureur était très chargé à ce moment (tours de
  l'agent factice `echo` de 1,6 et 2,1 s au lieu de ~0,1 s dans les mêmes secondes). Même course
  que les deux fois précédentes, un cran plus loin : les relectures à heure fixe devinent quand
  Bob écrit. Cause traitée : après un tour, la source du coût est **guettée** (`CostSource.watch`,
  `watchBobDb` : veille du dossier de la base) jusqu'à ce que le coût change, une minute au plus ;
  les relectures à 1,5 s et 5 s restent pour une source qui ne se guette pas. Aucun délai allongé.
  Essais : `session-cost.test.ts` (écriture à 6 s, lue à la veille ; rouge sans le correctif),
  `bob-costs.test.ts` (la veille voit l'écriture de la base, créée à cette écriture).
- 2026-11-19 — **Coût toujours pas vu malgré la veille** (CI Windows, `main` eb71bdd, run
  44439977234 ; vert sur 7c658f2 juste avant) : même test, premier tour fini en 77 ms, aucun coût
  en 6 s. Relevé dans les journaux des trois échecs (3cf4052 le 2026-11-16, 3bdb20a, eb71bdd) :
  toujours au premier tour (base créée par cette écriture), et l'agent factice **ne s'arrête
  pas** pendant l'attente (aucun « Agent arrêté »), alors qu'une exception de son écriture,
  lancée hors du tour dans un `setTimeout`, l'aurait arrêté. Hypothèse de départ (la veille fait
  lire Bobine pendant l'écriture, ce qui la ferait échouer) **écartée comme cause unique** : deux
  échecs sur trois précèdent la veille (0ef1caf). **Pas reproduit sur le Mac** : 5 000 écritures
  de l'agent factice (bases neuves ou non) contre un lecteur en boucle comme celui de l'app,
  0 échec ; le test répété 12 fois sous 16 fils de charge, toujours vert. Cause retenue,
  **probable, pas prouvée** : la base d'essai était en mode journal (le défaut de SQLite), alors
  que celle de Bob est en **WAL** (fiche 048 : `bob.db-wal`, `bob.db-shm`). En mode journal, une
  lecture qui croise l'écriture bloque l'écrivain (jusqu'à son délai de 5 s, puis
  `database is locked`), et chaque transaction (deux par écriture) crée puis supprime
  `bob.db-journal`, ce que Windows refuse tant qu'un autre processus (lecteur qui vérifie un
  journal « chaud », antivirus) tient le fichier ; un journal qui traîne fait aussi échouer toute
  lecture en lecture seule. Rien de cela n'existe en WAL. Correctif, côté agent factice seulement
  (Bob est déjà en WAL : rien à changer côté produit) : base d'essai en **WAL comme celle de
  Bob**, ligne écrite en **une seule transaction** (`BEGIN IMMEDIATE`, aussi pour les
  sous-agents), et l'écriture tardive du coût **dite sur stderr** (réussie ou non, avec l'heure)
  sans arrêter l'agent. Pour trancher au prochain échec : le test du journal passe en journal
  détaillé et, s'il échoue, dit les fichiers de la base, ses lignes lues directement, la sortie
  de l'agent factice et les relectures ratées de l'app (`readBobTaskCost` & co. disent leur
  erreur au journal détaillé au lieu de la taire). Pistes écartées : relire après accalmie (la
  veille réarmée à chaque évènement repousserait la lecture tant qu'un autre `bob` écrit) ; ne
  pas ouvrir la base tant qu'un `-journal` existe (Bob en WAL n'en a pas, et un journal gardé en
  mode `PERSIST` bloquerait toute lecture). Aucun délai allongé, aucun test assoupli. Essai rouge
  sans le correctif : `bob-costs.test.ts`, « une lecture en cours ne bloque pas l'écriture »
  (lecture ouverte pendant l'écriture du tour suivant : en mode journal, l'écriture attend 5 s
  puis échoue, `database is locked` ; en WAL, immédiate). Pas de ligne au CHANGELOG (rien de
  visible).
