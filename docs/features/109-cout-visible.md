# 109 — Coût visible et pilotable

- **Statut** : fait
- **Dépend de** : 019 (consommation), 053 (coût des sous-agents), 099 (outils de Bobine visibles),
  103 (fil de Bobine, ADR-0021)
- **Agents** : les deux. Jetons et coût viennent de ce que chaque agent remonte : champs ACP
  standard (`usage_update`, `usage` de la réponse à `session/prompt`) lus pour tous, et la source de
  coût hors protocole déclarée dans le profil (`costSource`, ADR-0015 : la base de Bob). Rien de
  nouveau n'est supposé de Bob.

## Pourquoi

Savoir ce qu'un tour coûte avant de cliquer : combien a coûté chaque conversation (bobcoins pour Bob,
dollars ou jetons pour OpenCode), sans l'ouvrir, et ce que chaque échange y a ajouté. Et réduire ce
que les outils de Bobine chargent dans le contexte à chaque tour : en voir le poids, couper les
familles inutiles (point 7 de la feuille de route de l'audit du 2026-10-21, § 6.3 et 9).

## Relevé (2026-10-21)

### Ce que chaque agent remonte

| Agent | Par ACP | Hors ACP | Dans le fil de Bobine aujourd'hui |
|---|---|---|---|
| **Bob 2.0.6** | **Rien** : ni `usage_update`, ni `usage` du tour (relevé réel de la fiche 019, sondes `pnpm bob-probe`) | Coût cumulé de la tâche en bobcoins dans `~/.bob/db/bob.db` (`tasks.costs` : `{"cost":…,"contextTokens":…}`), sous-agents compris (`parent_id`). Lu par `bobDbCosts` (`costSource` du profil) à l'ouverture, à la fin de chaque tour et 1,5 s après | `usage.cost` (évènement `usage-report`) ; pas de jetons |
| **OpenCode 2.0.32** | `usage_update` (`used`, `size`, `cost.amount` en `USD`, 0 pour les modèles gratuits) pendant le tour, puis `usage` de la réponse (entrée, sortie, cache, réflexion) — contrôlé par `pnpm opencode-probe` (« consommation (usage_update avec coût en USD) ») | — | `usage.context`, `usage.cost`, `usage.tokens` (cumul + `turns`), `usage.lastTurn` |
| **Agent factice** | Comme OpenCode, 0,0125 par tour, devise `--devise` ; `--sans-usage` : rien | `--bob-db` : sous-agents seulement | idem |

Aucun des deux agents ne met de consommation dans un `_meta` : rien à lire de plus dans un
adaptateur. Les champs ACP standard sont lus par le réducteur du fil (`src/shared/transcript.ts`,
`src/shared/usage.ts`), le coût hors protocole par l'adaptateur du profil (`costSource`).

Ce que Bobine garde déjà (fiche 019) : `TranscriptState.usage`, écrit avec le fil (`<id>.json`,
`ConversationStore`) et conservé au rejeu. Il manque : le détail **par tour** (seuls le cumul et le
dernier tour sont gardés), et un résumé dans l'**index** (`index.json`) pour la liste des
conversations sans relire chaque fil.

### Poids des outils de Bobine

Mesuré sur les définitions MCP envoyées par `tools/list` (`JSON.stringify` de chaque définition :
nom, description, schéma), jetons estimés à 4 caractères par jeton :

| Famille (`src/main/mcp/` et modules) | Outils | Caractères | ≈ jetons | Proposée |
|---|---|---|---|---|
| Questions (`ask-user`) | 1 | 1 071 | 270 | toujours |
| Terminal (`terminal`) | 4 | 1 364 | 340 | toujours |
| Navigateur (`browser`) | 19 | 7 332 | 1 830 | toujours |
| Lancer l'app (`preview`) | 4 | 1 655 | 410 | toujours |
| Simulateur iOS (`ios-simulator`) | 12 | 4 420 | 1 100 | projet Xcode |
| Émulateur Android (`android-emulator`) | 13 | 4 444 | 1 110 | projet Android |
| Conversations filles (`children`) | 4 (mère 3, fille 1) | 3 104 | 780 | dépôt git |
| **Total** | **57** | **23 390** | **≈ 5 850** | |

Une conversation type (dossier git sans projet mobile) reçoit questions, terminal, navigateur,
lancer l'app et filles : ≈ 3 500 jetons à chaque tour. L'audit estimait 8 à 15 000 jetons : c'était
une estimation grossière ; l'agent ajoute sa propre mise en forme autour des définitions, que Bobine
ne voit pas. L'estimation affichée le dit (« ≈ », « estimé »).

## Choix d'interface (UX senior)

- **Liste des conversations** : à droite du titre, en petit et en gris, chiffres alignés, le coût
  cumulé s'il est positif (« 0,03 $ », ou une petite pièce et « 0,063 » pour une devise qui n'est
  pas un code ISO comme les bobcoins), sinon les jetons traités (« 12 k »). Infobulle : coût exact
  avec son unité, jetons entrée / sortie, nombre d'échanges. L'état de l'agent (en cours, réponse à
  lire) reste à sa place, après le chiffre : l'état est passager, le coût permanent, et un chiffre
  qui disparaîtrait à chaque tour se lirait mal. Rien quand l'agent n'a rien rapporté. Raison : un chiffre court
  permet de comparer les conversations d'un coup d'œil sans encombrer la ligne ; l'unité complète,
  trop longue pour 260 px, va dans l'infobulle.
- **En-tête de la conversation** : une pastille à droite (coût, sinon « 12 k jetons ») qui ouvre le
  détail : cumul (entrée, sortie, cache, réflexion, coût), **moyenne par échange** (ce que coûtera
  vraisemblablement le prochain), puis **une ligne par échange**, le plus récent en haut (heure,
  entrée → sortie, coût du tour), les 20 derniers. Raison : la ligne par tour est un détail qu'on
  consulte, pas une information de survol ; une liste dans un panneau se lit mieux qu'une infobulle.
  La jauge de contexte près de la zone de saisie (fiche 019) ne change pas : elle parle du contexte,
  la pastille de l'en-tête parle du coût.
- **Réglages › Serveurs MCP › Bobine** : sur chaque carte de famille, « ≈ 1 830 jetons » à côté du
  nombre d'outils, et un interrupteur à droite (hors du bouton qui déplie la carte). En tête, le
  total : jetons estimés des familles activées, sur le total possible. Sous l'interrupteur changé, un
  avis : « S'applique aux prochaines sessions : les conversations ouvertes gardent leurs outils
  jusqu'au redémarrage de leur agent. » La famille « Questions » reste toujours activée (c'est par
  elle que l'agent pose ses questions, et elle pèse peu) : interrupteur grisé, avec la raison.
- **Menu ⚙ de la conversation** : la ligne « bobine · intégré » dit « 28 outils · ≈ 3 500 jetons ».
  Si les réglages ont changé depuis l'ouverture de la session, elle le dit (« Au prochain démarrage :
  21 outils ») et propose « Redémarrer l'agent » pour l'appliquer tout de suite.
- **Par conversation ou par dossier** : pas de surcharge dans cette fiche (voir Écarts du journal). Les
  familles mobiles et les filles ne sont déjà proposées que dans les dossiers où elles servent.

## Critères d'acceptation

- [x] Chaque tour garde ses jetons (entrée, sortie, total) et son coût (différence du coût cumulé
      annoncé entre l'envoi et la fin du tour, y compris un coût lu après la fin du tour comme celui
      de Bob) dans le fil enregistré par Bobine ; les 100 derniers tours au plus.
- [x] Un résumé de la consommation (jetons entrée / sortie / total, coût, nombre d'échanges) est
      gardé dans l'index des conversations, mis à jour à chaque changement, et calculé à la lecture
      du fil pour les conversations d'avant cette fiche.
- [x] La liste des conversations montre le coût (ou les jetons) de chacune, avec l'infobulle ; rien
      sans consommation rapportée.
- [x] L'en-tête montre la pastille de coût ; son détail donne le cumul, la moyenne par échange et une
      ligne par échange.
- [x] Réglages › Serveurs MCP › Bobine : poids estimé de chaque famille et total ; interrupteur par
      famille (sauf Questions), réglage global persistant.
- [x] Une famille coupée n'est plus déclarée à l'agent (`tools/list`) à la prochaine session ;
      l'avis le dit ; le menu ⚙ montre le changement à venir et propose de redémarrer l'agent.
- [x] Rien de propre à un agent dans l'interface : les chiffres viennent du fil (champs ACP) et de
      la source de coût du profil.
- [x] Agent factice : `--cout-bob` (`MOCK_AGENT_USAGE=bob`) se comporte comme Bob (rien par ACP, coût
      cumulé de la tâche écrit dans la base de Bob d'essai à chaque tour).
- [x] Tests unitaires (cumul par tour, coût tardif, résumé, persistance dans l'index, catalogue avec
      poids et familles coupées, réglage) ; e2e `usage` et `mcp` (clair, sombre, `--lang en`),
      captures regardées.

## Plan

### Consommation par tour et résumé

1. **`src/shared/usage.ts`** : `TurnUsage` (`at`, `input`, `output`, `total`, `costStart`,
   `costEnd`) et `ConversationUsage.turns` (100 au plus) + `pending` (coût cumulé à l'envoi) ;
   `startTurn`, `endTurn` (remplace l'usage direct d'`addTurn`), `withCost` (coût annoncé : un
   tour terminé et pas encore suivi d'un autre le reçoit aussi, pour le coût lu après coup) ;
   `turnCost`, `averageTurnCost` ; `UsageDigest` + `usageDigest(usage)` ; `formatCostShort` ;
   `estimateTokens(text)`.
2. **`src/shared/transcript.ts`** : `user-message` → `startTurn` ; `turn-end` et `turn-error` →
   `endTurn` ; `usage_update` et `usage-report` → `withCost`.
3. **`store.ts`** : `ConversationRecord.usage?: UsageDigest`. **`manager.ts`** : après chaque
   évènement, et à la lecture d'un fil, résumé recalculé ; s'il change, index réécrit et liste
   renvoyée. `ConversationSummary.usage`.

### Affichage

4. **Barre latérale** (`Sidebar.tsx`) : `HistoryCost` à droite du titre.
5. **En-tête** : `components/thread/ConversationCost.tsx` (pastille + détail Radix Popover), à côté
   du bouton des modifications dans `App.tsx`.

### Outils de Bobine

6. **`src/shared/mcp.ts`** : `AppToolFamily` gagne `tokens`, `enabled`, `required?`.
   **`src/main/mcp/catalog.ts`** : poids estimé des définitions, familles coupées ;
   `switchedOff(modules, off)` (enveloppe `enabled`). `ask-user` jamais coupée.
7. **Réglage** : `Settings.appToolsOff?: string[]` (`settings.ts`, `SettingsStore.appToolsOff` /
   `setAppToolFamily`). **`manager.ts`** : modules filtrés pour l'hôte, le catalogue et le décompte.
8. **IPC** : `mcp:setAppToolFamily(id, enabled)` ; `conversation:appTools` rend
   `{ names, tokens, next? }` (`next` : nombre d'outils de la prochaine session s'il diffère).
9. **`AppToolsTab.tsx`** : poids, interrupteur, total, avis. **Menu ⚙** (`Menus.tsx`) : poids,
   changement à venir, « Redémarrer l'agent ».
10. Agent factice : scénario `outils-mcp` (`tools/list` du serveur de l'app, sans carte), pour vérifier
    en e2e qu'une famille coupée n'est plus déclarée.

### Agent factice, textes, essais, docs

11. `--cout-bob` / `MOCK_AGENT_USAGE=bob` (`main.mts`, `agent.mts`, `profiles.ts`), `docs/mock-agent.md`.
12. Clés `usage.*`, `mcp.bobine.*`, `sessionSettings.mcp.*`, `sidebar.cost*` (fr, en).
13. Unités : `usage.test.ts`, `transcript.test.ts`, `store.test.ts` / `manager.test.ts`,
    `catalog.test.ts`, `settings-store.test.ts`, composants. e2e `usage` (liste, en-tête, lignes par
    tour, coût à la Bob) et `mcp` (poids, interrupteur, `tools/list` sans la famille coupée, menu ⚙).
14. `docs/acp.md` (coût par tour, compatibilité Bob), `docs/agents.md` si la matrice change,
    `docs/architecture.md` (canaux), `CHANGELOG.md` / `CHANGELOG.en.md`, index des fiches.

Aucune nouvelle dépendance.

## Journal

- 2026-10-21 — Fiche créée, relevé fait (tableaux ci-dessus), plan écrit.
- 2026-10-21 — **Fait.** Statut « fait ».
  - **Fil** : chaque tour garde ses jetons et le coût cumulé avant / après (`TurnUsage`, 100 tours au
    plus) ; un coût annoncé hors d'un tour revient au dernier tour fini (Bob écrit son coût après sa
    réponse). Tour en échec compté sans jetons.
  - **Index** : `ConversationRecord.usage` (résumé vérifié à la relecture : un résumé mal formé est
    retiré, pas la conversation) ; recalculé à chaque évènement et à la première lecture du fil d'une
    conversation d'avant cette fiche (la liste se met à jour quand on l'ouvre ou qu'elle est relue).
  - **Interface** : `HistoryCost` (liste), `ConversationCost` (en-tête et détail), interrupteurs et
    poids dans `AppToolsTab`, ligne « Au prochain démarrage » et « Redémarrer l'agent » dans le menu ⚙.
  - **Outils** : `switchedOff` enveloppe les modules dans le gestionnaire (relu à chaque ouverture de
    session) ; `required` pour les questions ; canal `mcp:setAppToolFamily` (famille inconnue ou
    requise refusée).
  - **Agent factice** : `--cout-bob` (`MOCK_AGENT_USAGE=bob`), scénario `outils-mcp`.
  - **Essais** : unités (`usage`, `transcript`, `manager` : index, relecture sans le fil, ancien fil
    rattrapé ; `catalog` : poids, familles coupées, pont, menu ⚙ ; `settings`, `settings-store`,
    `mcp-ipc`, `agent-host` : agent factice comme Bob, coût relu par tour ; composants
    `McpSettings`, `SessionSettingsMenu`). e2e : `usage` (coût par ACP), nouvelle suite `usage-bob`
    (coût comme Bob), `mcp` (poids, interrupteur, avis, `tools/list` sans le navigateur après
    « Redémarrer l'agent »), en clair, en sombre et `--lang en` ; `fun`, `history`, `settings` en
    français ; suite complète avant le commit. Captures regardées (`14b`, `14c`, `b5`, `b6`).
  - **Écarts** :
    - Pas de surcharge **par conversation ni par dossier** : les familles mobiles et les filles ne
      sont déjà proposées que là où elles servent, et une surcharge par conversation ne
      s'appliquerait de toute façon qu'au redémarrage de l'agent ; le réglage global et
      « Redémarrer l'agent » couvrent le besoin. À reprendre si l'usage le demande.
    - La fiche 099 avait tranché « lecture seule » pour l'onglet « Bobine » : cette fiche ajoute les
      interrupteurs, comme l'audit le demandait (pas d'ADR : choix d'interface, pas de structure).
    - Le poids réel dépasse l'estimation : chaque agent met en forme les définitions à sa façon.
      L'audit (8 à 15 000 jetons) surestimait : ≈ 5 850 pour les 57 outils, ≈ 2 860 pour une
      conversation type d'un dossier non git.
    - Pour Bob (aucune jauge de contexte), le coût apparaît deux fois : pastille de l'en-tête et
      puce de la zone de saisie (fiche 019, qui ouvre la dépense récente sur ce Mac). Laissé tel
      quel : chacune ouvre un détail différent ; à fusionner si cela gêne.
    - Vérification ancienne de la suite `usage` corrigée pour l'anglais (« 1% » sans espace).
  - **Non vérifié** : essai réel avec **Bob** (coût par échange relu dans `bob.db`, et outils coupés
    absents de ses outils) et avec OpenCode : seulement l'agent factice ici.
- 2026-10-21 — **Fiche 113** : à la demande de l'utilisateur, le coût dans la liste des conversations
  et la pastille de l'en-tête sont retirés ; le détail par échange (moyenne, une ligne par échange)
  vit dans la puce de consommation sous la zone de saisie (fiche 019). Le résumé gardé dans l'index
  reste, sans lecteur pour l'instant.
