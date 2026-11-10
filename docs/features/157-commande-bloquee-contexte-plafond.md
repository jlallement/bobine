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
