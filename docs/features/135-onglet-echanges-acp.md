# 135 — Onglet « Échanges ACP » dans le panneau

- **Statut** : fait (essai à la vraie souris à faire à la fin des vagues)
- **Dépend de** : 029 (panneau), 080 (journal réglable, relevé ACP), 082 (onglets, menu « + »), 114 (émetteur IPC vérifié)
- **Agents** : les deux (c'est le protocole lui-même : rien de propre à Bob ni à OpenCode)

## Pourquoi

Jérôme veut voir les échanges ACP bruts entre Bobine et l'agent, en direct, sans passer le journal
au niveau Détaillé ni ouvrir `agents.log` : pour comprendre ce qu'un agent envoie vraiment (un
outil qui reste « en préparation », une permission, une erreur), comparer deux agents, ou montrer
le protocole. Lot 157 de l'étude (`docs/feuille-de-route-2026-10-23.md`), maquette `acp-echanges`
de la planche, validée le 23/10.

## Critères d'acceptation

- [x] Un outil « Échanges ACP » (icône `arrow-left-right`) s'ouvre par le « + » du panneau, comme
      le terminal ; il ne s'ouvre jamais tout seul.
- [x] La liste montre les messages JSON-RPC de la conversation, dans les deux sens, en direct ;
      chaque ligne, en chasse fixe : heure à la milliseconde, sens (→ vers l'agent, accent ; ← de
      l'agent, atténué), méthode ou type de mise à jour de `session/update`, détail court
      (identifiant de requête, outil, statut ; pour une réponse, sa durée depuis la requête), taille.
- [x] Un clic déplie le JSON brut, indenté et coloré ; les morceaux de texte
      (`agent_message_chunk`, `agent_thought_chunk`, `user_message_chunk`) consécutifs d'un même
      message sont regroupés (« ×31 », pastille « regroupés ») et le groupe se déplie.
- [x] Barre : filtre (méthode, outil, texte), « Regrouper les morceaux » (activé par défaut),
      Pause, Copier (la sélection, sinon tout ce qui est affiché, en NDJSON), « Ouvrir agents.log ».
- [x] Pied : « Clés et jetons masqués · 2 000 derniers messages de cette conversation, en mémoire
      seulement ».
- [x] Branché sur le relevé existant (`acp-log.ts`) ; une copie en mémoire par conversation,
      bornée à 2 000 messages ; secrets masqués par `log-redact` avant de quitter le main ; reçue
      par le renderer par IPC (lecture initiale, puis évènements groupés), émetteur vérifié.
- [x] Marche quel que soit le niveau du journal (Normal compris) ; rien de plus sur le disque.
- [x] Testé : unitaire (tampon borné, fausse clé masquée, découpage des lignes, résumé des lignes,
      regroupement, filtre, NDJSON) ; e2e avec l'agent factice (scénario `demo`, suite `acp`) :
      ouvrir l'onglet, retrouver `session/prompt`, un `tool_call`, `session/request_permission` et
      sa réponse, déplier une ligne, morceaux regroupés ; clair et sombre.

## Plan

Pas de nouvelle dépendance, pas d'ADR : un outil de plus dans le panneau (fiche 082), branché sur
le relevé de la fiche 080. `agent-host.ts` et `manager.ts` sont au plafond ESLint : ils ne bougent
pas, tout passe par `agent-process.ts`, qui connaît déjà la conversation (`scope`).

**Main**

1. `shared/acp-exchanges.ts` — types partagés : `AcpExchange` (`seq`, `at`, `direction`, `text`
   masqué, `bytes`, `truncated`), `AcpExchangesBatch`, `AcpExchangesSnapshot` ; `ACP_EXCHANGES_MAX`.
2. `main/agent/acp-log.ts` — le relevé découpe les lignes dès qu'un récepteur `lines` est branché,
   même en Normal ; l'analyse pour `agents.log` reste réservée à Détaillé et Trace. La recherche du
   saut de ligne ne reprend que la partie nouvelle (une longue ligne arrivée en morceaux ne coûte
   plus un balayage par morceau).
3. `main/agent/acp-exchanges.ts` — `AcpExchanges`, pur (pas d'Electron) : un tampon circulaire par
   conversation (2 000 messages ; au plus 256 Ko gardés par message, 8 Mo par conversation, 8
   conversations, la moins récente oubliée d'abord, jamais une qui est regardée). Gardé léger : le
   texte de la ligne tel quel, sans l'analyser ; le masquage (`redact`) se fait à la lecture, quand
   le texte quitte le main. Abonnements comptés par conversation (`watch` / `unwatch`) ; seuls les
   messages des conversations regardées partent au renderer, par lots (100 ms). Une instance
   partagée, `acpExchanges`, comme `agentLog`.
4. `main/agent/agent-process.ts` — branche `lines` du relevé sur `acpExchanges` quand le lancement
   a une conversation (pas pour un diagnostic d'agent).
5. IPC — `acp:watch` (instantané masqué, puis abonnement), `acp:unwatch`, évènement
   `acp:messages` ; handlers dans `main/agent/acp-exchanges.ts` (`acpExchangeHandlers`), étalés
   dans `createHandlers` : l'émetteur est vérifié comme pour tous les canaux (fiche 114).
   `main/index.ts` relaie les lots par `broadcast`. Preload : `window.api.acp`.

**Renderer**

6. `shared/panel.ts`, `PanelIcons.tsx` — onglet `acp` (« Échanges ACP », `ArrowLeftRight`), entre
   « Tâches » et « Modifications ». Jamais « utilisé » par le fil : seulement ouvert par « + ».
7. `renderer/acp-view.ts` — pur : lecture d'un message (méthode, identifiant, type de mise à
   jour), lignes affichées (paires requête/réponse et durée, `tool_call_update` « 38,8 s après »
   son `tool_call`), regroupement des morceaux, filtre, NDJSON, jetons du JSON coloré, heure et
   taille.
8. `renderer/useAcpExchanges.ts` — abonnement à la conversation affichée, fusion de l'instantané
   et des évènements par `seq`, borne à 2 000, pause (les messages reçus attendent la reprise).
9. `components/panel/AcpTab.tsx` — barre, liste, JSON déplié, pied ; branché dans `SidePanel`.
   « Ouvrir agents.log » passe par `log:open` ; grisé (avec la raison) si `agents.log` est vide.
10. `styles.css` — règles `.acp-*` avec les jetons existants (`--accent`, `--muted`, `--ok`,
    `--warn`, `--plan`, `--surface-2`), aucun jeton créé (la fiche 134 les réorganise).
11. i18n : clés `acpTab.*` et `panel.tab.acp` dans `fr.json` et `en.json`.

**Essais et docs**

12. Unitaires : `acp-exchanges.test.ts`, `acp-log.test.ts` (découpage en Normal), `acp-view.test.ts`.
13. e2e : nouvelle suite `acp` (catalogue), suite `panel` mise à jour (le menu « + » propose un
    outil de plus).
14. `docs/architecture.md`, index, CHANGELOG (deux langues).

## À vérifier à la vraie souris

Fait à la fin des vagues par la session qui coordonne (pas ici) :

1. « + » › « Échanges ACP » : l'onglet s'ouvre, les messages déjà échangés sont là.
2. Pendant un tour d'un vrai agent (OpenCode), la liste défile seule tant qu'on est en bas ;
   remonter la liste arrête le défilement, revenir en bas le reprend.
3. Clic sur une ligne : le JSON se déplie, se replie au second clic ; plusieurs lignes dépliées
   sont copiées ensemble (« Copier la sélection »), collées dans un éditeur : une ligne JSON par
   message.
4. Pause : la liste se fige pendant le tour ; reprise : les messages arrivés entre-temps
   apparaissent.
5. Filtre : `tool_call`, un nom d'outil, un mot du texte de l'agent.
6. « Regrouper les morceaux » décoché : chaque morceau est une ligne ; recoché : « ×N ».
7. Panneau étroit (280 px) et agrandi : colonnes lisibles, JSON qui défile de côté.
8. Niveau du journal Normal : l'onglet marche ; « Ouvrir agents.log » grisé si le fichier est vide.
9. Clair, sombre, Sépia, Nuit noire : couleurs du JSON lisibles.

## Journal

- 2026-10-24 : fiche créée, plan écrit (vague 2, worktree `fiche-135-echanges-acp`).
- 2026-10-24 : fait, selon le plan. `./scripts/verify` passe ; e2e `acp`, `panel` et
  `diagnostic` vertes en clair et en sombre, captures `acp-1-json` à `acp-4-liste` regardées (journal
  au niveau Normal dans les essais : l'onglet marche sans `agents.log`).
  - **Écarts au plan** : `SidePanel` dépassait la complexité (42) avec un onglet de plus ; les
    outils de l'app (navigateur, appareils, terminal, échanges) sont rendus par un `ToolTab` à
    part, sans changement de comportement. `index.ts` est au plafond (850) : le relais des lots
    passe par `send` donné à `createHandlers` (une ligne), branché dans `acpExchangeHandlers`.
    La pause est tenue par `useAcpExchanges` (reprise sans effet de bord dans un `useEffect`).
  - **Écarts à la maquette** : le détail de `session/prompt` donne les types de blocs du protocole
    (« text, resource_link ») plutôt que « texte, 1 fichier » ; la réponse à une permission donne
    l'`optionId` choisi par l'app (« allow » avec l'agent factice), comme l'agent le nomme.
    Ajouts : un groupe déplié montre ses morceaux un par ligne (↳ dans la colonne du sens, sans
    retrait, avec leur texte), chacun dépliable en JSON ; en pause, « N en attente » ; « Ouvrir
    agents.log » grisé, avec la raison en infobulle, quand le fichier est vide (niveau Normal) ;
    la sélection copiée est l'ensemble des lignes dépliées. Panneau étroit (≤ 520 px) :
    « Regrouper les morceaux » en icône seule (libellé en infobulle) ; ≤ 420 px : le JSON part du
    bord, le détail est coupé plus tôt pour garder la méthode ; le pied passe à la ligne au lieu
    d'être coupé. Couleurs du JSON par jetons existants (`--plan` clés, `--ok` chaînes, `--warn`
    littéraux, fond `--surface-2`) au lieu des teintes propres à la planche : à revoir avec la
    fiche 134 si elle crée des jetons de code.
  - **Bornes** : 2 000 messages par conversation ; au plus 256 Ko gardés par message (« ligne
    tronquée », taille réelle affichée), 8 Mo par conversation, 8 conversations (la moins
    récemment active oubliée d'abord, jamais une dont l'onglet est ouvert). Copie gardée pour
    toutes les conversations dont l'agent tourne (l'onglet ouvert après coup montre ce qui s'est
    passé), légère : texte brut, analysé et masqué seulement quand il part au renderer.
  - **Reste** : essai à la vraie souris (liste ci-dessus), fait par la session qui coordonne.
