# 253 — rc : fiabilité des agents (réglages muets, shell de connexion, recherche `@`, écriture en quittant)

- **Statut** : fait
- **Dépend de** : 142 (réglages initiaux), 043 (shell de connexion), 036 (côte à côte), 197 (écriture en quittant)
- **Agents** : les deux (rien de propre à un agent : délais ACP génériques, environnement de l'app)

## Pourquoi

Lot rc-E de l'audit avant la 1.0.0-rc.1 (`docs/audits/2026-11-19-audit-avant-rc.md`) : quatre
défauts de robustesse qui bloquent ou ralentissent sans rien dire.

- **ROB-1** : `session/set_mode` et `session/set_config_option` n'ont aucun délai. Au démarrage,
  `applyInitialSettings` n'attend que la mort de l'agent : un agent vivant qui ne répond pas laisse
  la conversation « au démarrage » sans fin, sans bandeau ; le sélecteur de mode ou de modèle reste
  pareil.
- **R18** : le shell de connexion est lancé `-ilc` sans repli (tcsh refuse `-ilc`, nushell ne
  développe pas `"$PATH"`) et avec stdin ouvert (un fichier rc qui lit l'entrée attend les 10 s).
- **ROB-2** : `actionsFor(id)` rend un objet neuf à chaque rendu ; le `searchFiles` du volet côte à
  côte change donc à chaque morceau reçu et l'effet à retardement de `useMentions` (120 ms) est
  annulé : la recherche `@` ne part jamais tant qu'une conversation affichée écrit.
- **ROB-4** : avant de quitter, chaque fil lu pendant la session est réécrit en synchrone avec
  `fsync`, même inchangé.

## Critères d'acceptation

- [x] ROB-1 : `set_mode` / `set_config_option` sans réponse en `TIMEOUTS.controlMs` : la demande
      échoue avec un message clair ; au démarrage, la conversation devient prête sans ce réglage et
      l'avis « Réglage … non appliqué » (ou « Mode de départ non appliqué ») le dit ; au sélecteur,
      l'erreur s'affiche. Une réponse tardive met encore l'état à jour.
- [x] ROB-1 : panne factice `--panne bloque-reglages` (`MOCK_AGENT_PANNE`), documentée dans
      `docs/mock-agent.md` ; test unitaire de l'hôte, rouge sans le délai.
- [x] R18 : stdin du shell sur `/dev/null` ; shell non POSIX connu (csh, tcsh, nu…) : directement
      `/bin/zsh -ilc` (macOS) ou `/bin/sh -lc` ; shell POSIX en échec, sans PATH ou avec un PATH non
      développé (`$…`) : même repli ; trop lent : pas de repli (pas 20 s). Windows inchangé.
- [x] R18 : tests unitaires avec des shells factices (rc qui lit stdin, shell qui refuse `-ilc`,
      PATH littéral `$PATH`).
- [x] ROB-2 : `actionsFor(id)` stable pour un même id ; test rouge sans le correctif (recherche
      `@` du volet côte à côte malgré des rendus pendant l'attente) ; même motif cherché ailleurs.
- [x] ROB-4 : un fil inchangé depuis sa lecture ou sa dernière écriture réussie n'est pas réécrit
      en quittant (`flushAll`, `stopAll`) ; test rouge sans le correctif.
- [x] `./scripts/verify` vert ; e2e des suites touchées.

## Plan

1. **ROB-1** — `src/main/agent/agent-host.ts` : `TIMEOUTS.controlMs` (30 s) ; `applyControl`
   passe la requête par `race(failed, controlMs, t('agentHost.timeout.control'), …)` (même helper
   que `initialize`/`session/new`) ; l'état local est mis à jour par la réponse elle-même, même
   tardive (même connexion et session). `initial-controls.ts` inchangé dans sa forme : l'erreur
   de délai arrive dans le `catch` existant (avis `controlFailed` / `modeFailed`), puis la session
   devient prête. Clé i18n `agentHost.timeout.control` (fr, en).
   Agent factice : panne `bloque-reglages` (`set_mode` et `set_config_option` ne répondent
   jamais). Test unitaire dans `agent-host.test.ts` (démarrage avec réglage initial et mode de
   départ, puis `setControl` à la main). Pas d'e2e : aucun écran ni état nouveau, seulement un
   texte d'erreur dans l'avis et le bandeau d'erreur existants (capture faite à la main).
2. **R18** — `src/main/shell-env.ts` : lancement par `spawn` avec `stdio: ['ignore', 'pipe',
   'pipe']`, arrêt `SIGKILL` au délai (un shell interactif ignore `SIGTERM`) ; `loginShellEnv`
   essaie le shell de l'utilisateur sauf non POSIX connu, puis le repli. Valeur de PATH contenant
   `$NOM` non développé : rejetée. `readUserEnv` sous Windows : inchangé (non appelé).
3. **ROB-2** — actions d'une conversation sorties dans `src/renderer/src/conversation-actions.ts`
   (`conversationActions(id, fail)`), mémorisées par id dans `useConversations` (`fail` est
   stable). Test : `useMentions` + `actionsFor` rerendus toutes les 50 ms. Recherche du motif
   (fonctions neuves en dépendances d'effets à minuteur ou d'abonnements `window.api.*.on*`).
4. **ROB-4** — `history-writer.ts` : ensemble faible (`WeakSet`) des fils tels qu'écrits ou lus ;
   un fil identique (même objet, immuable) n'est pas réécrit, sauf s'il est en échec.
   `manager.ts` signale le fil lu du disque (`writer.loaded`). Tests dans `history-writer.test.ts`.
5. Docs : `docs/mock-agent.md`, `docs/acp.md` (délai des réglages), CHANGELOG fr/en, index.

## Journal

- 2026-11-19 : fiche et plan.
- 2026-11-19 : fait.
  - **ROB-1** confirmé (test rouge : `start()` ne rend jamais la main, délai du test dépassé).
    `TIMEOUTS.controlMs` = 30 s dans `applyControl`, donc au démarrage **et** au sélecteur ;
    l'envoi est sorti dans `sendControl` (`initial-controls.ts`) pour tenir la limite de lignes
    d'`agent-host.ts`. Réponse tardive : l'état suit encore (même connexion, même session).
    Panne factice `bloque-reglages`. Pas d'e2e dédiée : pas d'écran nouveau, seulement un texte
    d'erreur dans l'avis du fil et le bandeau d'erreur existants ; un essai e2e attendrait 30 s
    (aucune variable pour raccourcir le délai dans l'app, non ajoutée). Essai réel au pilote
    (agent factice, `MOCK_AGENT_PANNE=bloque-reglages`) : au démarrage avec le mode « Question »
    retenu, prête au bout de 30 s avec l'avis ; au sélecteur, le bandeau d'erreur affichait
    « AgentTimeout: … » : `ipcErrorText` ne retirait que les noms finissant par `Error`, il
    retire désormais tout nom d'erreur (test).
  - **R18** confirmé (tests rouges sur l'ancien code : rc qui lit stdin → délai ; shell qui
    refuse `-ilc` ; `$PATH` littéral ; shell non POSIX lancé). En plus : au délai, `SIGKILL` —
    l'ancien `execFile` envoyait `SIGTERM`, qu'un shell interactif ignore : la lecture attendait
    la fin du shell bien au-delà des 10 s (test « trop lent » rouge sur l'ancien code avec
    `trap '' TERM`). fish : non installé sur la machine, non essayé ; d'après sa documentation il
    accepte `-ilc` et joint `"$PATH"` par `:` ; s'il échouait, le repli s'applique. Windows :
    `readUserEnv` lit toujours le registre, `loginShellEnv` n'y est pas appelé.
  - **ROB-2** confirmé (test de la cause : rendus toutes les 50 ms, la recherche ne part pas ;
    test du correctif rouge sans la mémorisation). Actions sorties dans `beside-actions.ts`. Même
    motif cherché dans les 188 effets du renderer : un cas réel, corrigé — `worktreeStatus` et
    `family` (dialogue de suppression) neufs à chaque rendu : chaque morceau reçu relançait les
    deux lectures IPC et abandonnait la précédente (l'état du worktree pouvait ne jamais
    s'afficher pendant qu'une conversation écrit). Test `useConversations.stable.test.ts`.
    **Non corrigé, hors lot** : la recherche dans le fil (`useThreadFind.ts`, minuteur de 150 ms)
    est relancée par chaque changement du fil (données, pas une fonction) : pendant une réponse,
    nouveau compte et surlignage attendent une pause. À traiter dans une fiche à part.
  - **ROB-4** confirmé (tests rouges sans le correctif). `WeakMap` fil → conversation (un même
    objet peut servir à deux conversations, le fil vide par exemple) ; une écriture prévue
    devenue inutile prévient encore que le fil est à jour (sinon il ne quittait plus la mémoire,
    fiche 046 : l'essai du gestionnaire l'a montré).
  - Hors périmètre initial, demandé en cours de lot : commentaires de `bob-exclusions.ts` et
    `exclusions.ts` ramenés à ce qu'IBM documente (fiche 216), sans changement de comportement.
