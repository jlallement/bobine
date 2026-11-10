# 142 — Pannes réseau et reconnexion progressive

- **Statut** : fait (essai à la souris avec un vrai agent à faire, voir le journal)
- **Dépend de** : 020 (file des messages), 041 (pannes de l'agent), 121 (relance après une panne),
  126 (finitions)
- **Agents** : les deux. Rien de propre à un agent : les erreurs reconnues sont celles de Node, de
  Bun, du HTTP et des SDK de modèles, que tout agent relaie. Un profil peut ajouter les siennes
  (`transientError`), aucun ne le fait aujourd'hui (le format de Bob n'est pas relevé).

## Pourquoi

Lot 152 de l'étude (« Itération 8 » de `docs/feuille-de-route-2026-10-23.md`). Jérôme passe
souvent par un VPN qui décroche. Aujourd'hui, une panne réseau ou une limite de
débit (429) pendant un tour donne une erreur brute dans le fil, et il faut renvoyer son message à la
main. Relecture du 23/10 : « Il faut juste proposer une reconnexion avec des intervalles qui
augmentent et un nombre de tentatives à définir », sans parler de VPN.

## Critères d'acceptation

- [x] Une fonction pure classe l'erreur d'un tour : réseau, limite de débit, autre. Elle lit le code
      et le message de l'erreur JSON-RPC, son `data` (cause, statut HTTP), et la sortie d'erreur de
      l'agent écrite pendant le tour quand l'erreur est générique. Un budget épuisé (Bob), un quota
      dépassé, une clé refusée ne sont **pas** des pannes passagères.
- [x] Bandeau court dans le fil (maquette `reseau`) : icône `wifi-off`, « Connexion perdue », puis
      « Nouvelle tentative dans 8 s (3 sur 5). Votre message reste en attente. », bouton
      « Réessayer maintenant ». Limite de débit : « Limite de débit atteinte », même décompte. Pas
      de mention du VPN.
- [x] Reconnexion automatique : 5 tentatives, après 2, 4, 8, 16 puis 32 s ; décompte visible ; le
      message est renvoyé tel quel (sans nouvelle bulle). Après la cinquième : « Connexion
      impossible » et le seul bouton « Réessayer ».
- [x] Réseau revenu (`net.isOnline`) ou Mac sorti de veille (`powerMonitor`) : nouvelle tentative
      tout de suite.
- [x] Un message envoyé pendant l'attente rejoint la file (fiche 020) et part après la réussite.
- [x] Échap ou Stop pendant l'attente annule les tentatives (tour arrêté, file en attente comme
      après un Stop).
- [x] Inchangé pour les autres pannes : agent qui plante, erreur de l'agent (fiches 041, 121).
- [x] Rien de propre à Bob ni à OpenCode dans l'interface.
- [x] Testé : classification (formats réels), calendrier (fausse horloge), annulation, réseau
      revenu ; hôte contre l'agent factice ; e2e `network` (panne puis retour : deux tentatives, le
      message part ; cinq échecs : « Connexion impossible », « Réessayer »), clair et sombre.

## Plan

**Où vit la reconnexion** : dans l'hôte d'agent (main), comme la file d'attente (fiche 020) : elle
continue quand la conversation n'est pas affichée. Le tour reste « en cours » (`busy`) pendant
l'attente : Stop et Échap marchent comme d'habitude, et un message envoyé pendant l'attente rejoint
la file sans rien changer ailleurs. Le bandeau vient de l'instantané de l'agent (`snapshot.retry`),
pas du fil : un décompte n'a rien à faire dans l'historique.

1. **Classification** — `src/main/agent/turn-failure.ts` : `classifyTurnFailure(error, stderr?)` →
   `'network' | 'rate-limit' | 'other'`. Codes de Node/undici/Bun (`ECONNRESET`, `ETIMEDOUT`,
   `ENOTFOUND`, `EAI_AGAIN`, `UND_ERR_*`, `ConnectionRefused`…), messages (`fetch failed`, `socket
   hang up`, `Connection error.`, `getaddrinfo`, `tunneling socket`, `Unable to connect`, 502/503/504
   d'un proxy), 429 (code, `status`/`statusCode` dans `data`, « Too Many Requests », « Rate limit »,
   `RESOURCE_EXHAUSTED`). Exclus : budget, quota, facturation (`insufficient_quota`,
   `BudgetExceededError`). Sortie d'erreur du tour lue seulement si l'erreur est générique (code
   interne `-32603` ou absent). Point d'extension du profil : `transientError?(error)` (adaptateur).
2. **Calendrier** — `src/main/agent/turn-retry.ts`, classe `TurnRetry` : le message du tour (blocs
   déjà construits), l'état (attente n sur 5, tentative en cours, épuisé), les minuteurs, l'écoute du
   réseau pendant l'attente ; `failed(error)`, `now()`, `cancel()`, `clear()`, `view()`. Délais
   `RETRY_DELAYS_MS = [2, 4, 8, 16, 32] s`.
3. **Hôte** (`agent-host.ts`, au plafond) : la fin de `prompt()` devient `runTurn(blocks)`, que la
   reconnexion rappelle sans nouvelle bulle ; `turnFailed` confie l'erreur à `TurnRetry` ; `cancel`,
   `stop`, sortie de l'agent annulent ; `retryTurn()` public. Place faite en sortant les réglages
   initiaux (`applyInitialControls`, `applyInitialMode`) dans `initial-controls.ts`.
   À l'épuisement, `turn-error` comme avant (avis dans le fil, notification), et le bandeau reste.
4. **Réseau** — `src/main/network-watch.ts` (pur, injecté) : sonde `net.isOnline()` toutes les 2 s
   tant qu'une conversation attend, `powerMonitor` `resume` ; `network-watch-electron.ts` le branche
   sur Electron. Passé par `ConversationManagerOptions.networkWatch` → `hostOptions` → `AgentHost`.
   `index.ts` (au plafond) : 2 lignes ; `manager.ts` (au plafond) : `retryTurn(id)`, place faite en
   sortant l'avis « fil illisible » dans `helpers.ts`.
5. **IPC** — `agent:retryTurn` (`shared/ipc.ts`, preload, `main/ipc.ts`).
6. **Interface** — `TurnRetryBanner.tsx` (fil), à la place de l'indicateur d'activité pendant
   l'attente ; textes `turnRetry.*` (fr, en) ; styles d'après `.mq-net` de la maquette.
7. **Agent factice** — étape `flaky` (échoue les N premières fois dans la session, puis joue la
   suite) ; `fail` gagne `code` et `stderr`. Scénarios `reseau-instable` (deux échecs `fetch failed`
   puis réponse), `reseau-coupe` (échec à chaque fois), `limite-debit` (429 une fois puis réponse).
   Noms distincts de ceux que la fiche 139 ajoute : à rapprocher à la fusion.
8. **Essais** — unitaires (`turn-failure.test.ts`, `turn-retry.test.ts`, `network-watch.test.ts`,
   hôte contre l'agent factice) ; e2e `network` (clair, sombre) ; suites `failures`, `queue`,
   `restart` rejouées.
9. **Docs** — `docs/acp.md` (compatibilité Bob : format non relevé), `docs/mock-agent.md`,
   `docs/architecture.md`, CHANGELOG fr/en, index des fiches.

Aucune dépendance nouvelle.

## Journal

- 2026-10-24 — Fiche créée (lot 152, vague 4). Constat : aucune erreur réseau reconnue ; `prompt()`
  émet `turn-error` pour toute erreur ; aucune trace de format réseau dans `docs/recettes` (seul
  « Rate limit exceeded » d'OpenCode/Zen, fiche 078, relevé dans son journal et jamais par ACP).
- 2026-10-24 — Fait (plan 1 à 9).
  - **Classification** (`turn-failure.ts`) : formats génériques seulement (Node, undici, Bun, SDK
    OpenAI / Anthropic, proxy, 429, `RESOURCE_EXHAUSTED`) ; un budget ou un quota épuisés
    (`BudgetExceededError` de Bob, `insufficient_quota` d'OpenAI, renvoyé en 429) restent des
    erreurs. Sortie d'erreur lue seulement pour une erreur interne sans cause, et seulement ce qui
    a été écrit pendant le tour (`stderrMark` / `stderrSince` dans `agent-process.ts`). Point
    d'extension `transientError` du profil, vide pour Bob et OpenCode (rien de relevé). Aucun format
    réseau réel dans `docs/recettes` : les cas de test reprennent les messages publiés de ces
    bibliothèques, et « Rate limit exceeded » d'OpenCode/Zen (fiche 078).
  - **Reconnexion** (`turn-retry.ts`) : le message est renvoyé avec ses blocs déjà construits
    (contexte compris), sans nouvelle bulle. Le tour reste `busy` pendant l'attente : Stop, Échap,
    « Interrompre et envoyer » et la file marchent sans rien changer à l'interface. « Réessayer
    maintenant » compte comme la tentative attendue ; « Réessayer » après l'épuisement repart pour
    cinq tentatives. Le retour du réseau (sonde de `net.isOnline()` toutes les 2 s, seulement tant
    qu'une conversation attend) et la sortie de veille réessaient tout de suite, aussi après
    l'épuisement. Journal : « Tour en échec (…) : network, tentative 2 sur 5 dans 4000 ms ».
  - **Choix** (pas dans la maquette) : à l'épuisement, l'avis d'erreur habituel reste dans le fil
    (trace après un redémarrage, notification si la conversation n'est pas affichée), au-dessus du
    bandeau. Un nouveau message écrit après l'épuisement remplace celui qui attendait (le bandeau
    s'en va) ; écrit pendant l'attente, il rejoint la file et part après la réussite.
  - **Place** : `agent-host.ts` 1049 → 1048 lignes (réglages initiaux sortis dans
    `initial-controls.ts`), `manager.ts` 1048 → 1046 (avis « fil illisible » dans `helpers.ts`),
    `index.ts` 848 → 850 (plafond atteint : la prochaine ligne demandera un découpage).
  - **Agent factice** : étape `flaky`, `fail` avec `code` et `stderr` ; scénarios `reseau-instable`,
    `reseau-coupe`, `limite-debit`. La fiche 139 ajoutait ses propres scénarios « réseau coupé » et
    « 429 » : rapprochés à la fusion (voir le journal).
  - **Essais** : `turn-failure.test.ts` (4), `turn-retry.test.ts` (9, fausse horloge),
    `network-watch.test.ts` (3), `agent-host-retry.test.ts` (7, agent factice),
    `TurnRetryBanner.test.tsx` (3), agent factice (3). e2e `network`, `failures`, `queue`,
    `restart` en clair et en sombre : verts, deux fois. Captures `142-reseau-attente` et
    `142-reseau-impossible` regardées : conformes à la maquette (icône, couleurs, textes, bouton) ;
    écart : « 4 s (2 sur 5) » au lieu de « 8 s (3 sur 5) » (moment de la capture).
  - **Limites** : un agent qui avait commencé à écrire avant la panne voit le texte de la
    tentative suivante collé au sien dans le fil (même bulle de réponse) ; séparer les tentatives
    demanderait un évènement du fil (`transcript.ts` est à 4 lignes de son plafond). Un agent qui
    réessaie lui-même sans rien dire par ACP (OpenCode 1.19, fiche 078) n'est pas vu. Le renvoi
    ajoute le message une deuxième fois à l'historique de l'agent s'il l'avait gardé avant la panne.
  - **À vérifier à la souris** (non fait, demandé à la fin des vagues), avec Bob puis OpenCode :
    1. couper le Wi-Fi (ou le VPN) pendant un tour : bandeau « Connexion perdue », décompte qui
       descend, Stop visible ; relever dans `agents.log` (niveau Détaillé) l'erreur de
       `session/prompt` et la sortie d'erreur, et la reporter dans `docs/acp.md` ;
    2. rallumer le Wi-Fi pendant l'attente : nouvelle tentative dans les 2 s, la réponse arrive ;
    3. laisser passer les cinq tentatives (≈ 1 min) : « Connexion impossible », « Réessayer »,
       avis d'erreur au-dessus ; « Réessayer » le Wi-Fi revenu ;
    4. fermer le capot pendant l'attente, rouvrir : tentative immédiate ;
    5. écrire un message pendant l'attente (il rejoint la file), puis Échap (tentatives arrêtées,
       « Arrêté », la file attend) ;
    6. si l'agent ne renvoie aucune erreur quand le réseau tombe (il réessaie de son côté), le
       noter : rien ne s'affiche alors, c'est l'indicateur d'activité qui tourne.
- 2026-10-24 (fusion dans `integration/vagues`, avec la 139 et la 140) : un seul jeu de scénarios
  réseau, celui-ci ; `reseau-coupe` reprend le début de celui de la 139 (texte et lecture en cours,
  coupure sans pause). Défaut trouvé à la fusion : l'outil en cours d'une tentative ratée restait
  « en cours » pendant l'attente, et après un arrêt de l'agent (la correction de la 139 ne passait
  que par l'échec définitif). Nouvel évènement `attempt-failed` : l'hôte l'émet quand une tentative
  est prévue, le fil interrompt les outils de la tentative, sans avis ni fin de tour. Le
  gestionnaire transmet `retryDelaysMs` (attentes raccourcies de la grille de la 139). Place :
  `agent-host.ts` repassé sous son plafond en sortant les refus de session dans
  `session-blocker.ts`.
