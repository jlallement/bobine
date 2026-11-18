# 242 — Aucun agent lancé ni quota lu sans être choisi ; profil jetable sans le vrai `~/.bob`

- **Statut** : fait
- **Dépend de** : 091 (quota de Bob, ADR-0017), 205 (quota relu quand l'agent est prêt), 188
  (accueil du premier lancement), 093 (conversation sans dossier), 148 (profil temporaire), 061
  (diagnostic)
- **Agents** : les deux (règles de Bobine sur le lancement des agents ; seul Bob lit un quota
  aujourd'hui, par le point d'extension générique `quotaSource`)
- **Trouvé par** : recette « POC complet » du 2026-11-17, étapes 0 et 8
  ([rapport](../recettes/2026-11-17-poc-complet-opencode.md), défaut D17)
- **Décision** : [ADR-0054](../adr/0054-quota-lu-pour-l-agent-utilise.md)

## Pourquoi

Sur un profil jetable, avant que l'utilisateur ait choisi un agent, Bobine lançait le vrai
`bob acp` et lisait le quota de Bob, ce qui crée puis supprime une session dans le vrai `~/.bob` ;
à la relance, alors qu'OpenCode était l'agent choisi, la lecture du quota de Bob recommençait. Un
profil jetable sert à essayer Bobine sans toucher aux données de l'utilisateur ; et un agent que
l'utilisateur n'a pas choisi ne devrait ni démarrer ni être sollicité.

Gravité dans la recette : gênant (rien n'a bloqué ; seules des sessions vides du dossier réservé de
Bobine ont été supprimées).

## Trace réelle (`profil/logs/main.log` de la recette, Bobine 1.0.0-beta.7)

Lancement par `pnpm pilote lancer --profil …` (donc `--user-data-dir`) avec `BOBINE_ONBOARDING=1` :

```text
19:48:06.653Z Démarrage de Bobine 1.0.0-beta.7 (Electron 45.3.3), journal normal
19:48:06.982Z Agent lancé (bob, 9faf592c) : bob acp dans …/profil/workspace (pid 31088)
19:48:07.753Z Quota de IBM Bob : agent prêt, quota encore inconnu, nouvelle lecture
19:48:12.028Z Quota de IBM Bob : 1 session(s) vide(s) supprimée(s)
19:48:12.028Z Quota de IBM Bob : 40.79 / 50 bobcoins (4275 ms)
19:48:13.341Z Accueil : essai connect de bob → ready
19:48:23.913Z Agent lancé (opencode, 6364210e) : opencode acp dans …/profil/workspace
19:48:23.937Z Agent arrêté (bob, 9faf592c) : SIGTERM après 17.0 s
…
19:52:00.360Z Agent lancé (bob) : bob acp dans …/taches (pid 32456)
19:52:00.369Z Agent lancé (opencode) : opencode acp dans …/taches (pid 32458)
…
21:08:52.561Z Démarrage de Bobine 1.0.0-beta.7 (Electron 45.3.3), journal detailed
21:08:53.279Z Agent lancé (opencode, b90beb10) : opencode acp dans …/taches
21:09:00.515Z Quota de IBM Bob : 1 session(s) vide(s) supprimée(s)
21:09:00.516Z Quota de IBM Bob : 40.79 / 50 bobcoins (4317 ms)
```

Le tout premier lancement du pilote (19:47:40Z, `pilote/bobine.log`) montre la même chose :
`Agent lancé (bob, e6c0ae38)` 0,3 s après le démarrage, puis la lecture du quota.

## Causes (lues dans le code)

1. **L'agent de la conversation de l'accueil démarrait (19:48:06).** Un dossier de données imposé
   (`--user-data-dir`, essais) donne aux conversations sans dossier le dossier neutre du profil
   (`defaultWorkspaceFor`, fiche 093), pour que l'agent factice démarre sans dialogue. Avec
   l'accueil demandé (`BOBINE_ONBOARDING=1`), la conversation de l'accueil avait donc un dossier,
   et `startActive` lançait l'agent par défaut (Bob, premier de la liste) avant tout choix. Sur un
   vrai premier lancement, la conversation n'a pas de dossier et rien ne démarre : l'essai
   s'écartait du vrai parcours. Le profil temporaire (`--profil-temporaire`, défaut du pilote)
   n'est pas touché par cette cause.
2. **Cet agent prêt faisait lire le quota (19:48:07)** : `quotaOnReady` (fiche 205). La lecture
   suit l'agent qui s'est montré prêt ; la cause est (1).
3. **Au lancement, le quota de chaque agent installé était lu (21:09:00)** : `setupQuotas`
   programmait, 3 s après le démarrage, `refresh(undefined, { automatic: true })` sur **tous** les
   agents installés qui savent le lire (ADR-0017 : « au démarrage, si Bob est installé »), quel que
   soit l'agent utilisé. C'est la lecture de la relance, alors qu'OpenCode était l'agent choisi et
   qu'aucun Bob ne tournait ; sur un vrai premier lancement, elle lit aussi le quota de Bob avant
   que l'accueil soit fini.
4. **Rien ne distinguait un profil jetable** : la lecture tourne dans
   `~/Library/Caches/Bobine/agent-status/bob` (hors du profil) et `bob chat` crée une tâche dans le
   vrai `~/.bob` (ADR-0017 : « `bob chat` crée une tâche vide »), puis Bobine la supprime par
   `session/delete` ; `--trust` ajoute aussi ce dossier à `~/.bob/trustedFolders.json`.
5. **19:52:00, non expliqué dans le rapport** : un agent lancé sans conversation (`(bob)` sans
   identifiant court), un par agent installé, dans le dossier de la conversation affichée. Seuls
   deux chemins créent un tel hôte : `checkAgent` (diagnostic) et `replaySession` (un seul agent).
   C'est donc, très probablement, la page Réglages › Diagnostic ouverte par le testeur : elle
   essaie chaque agent à l'ouverture (`DiagnosticsSettings.tsx`), et chez un agent qui sait
   supprimer une session (Bob), l'essai ouvre une session puis la supprime
   (`newSession: 'if-deletable'`) ; OpenCode n'est qu'initialisé (arrêté après 607 ms).

L'essai « connecté ? » de Bob à l'accueil (19:48:13) suit un clic sur « Continuer » de l'étape
Agent (seul déclencheur de `onboarding:check`) avec Bob présélectionné : c'est un choix de
l'utilisateur, pas un lancement d'office. Le journal du pilote ne le montre pas (clic hors
`pilote`), l'ordre des lignes le confirme (essai de Bob, puis OpenCode choisi 10 s plus tard).

## Décision (ADR-0054)

- **(a) Aucun agent avant le choix, aucun quota d'un agent qui ne sert pas.**
  - Un essai qui montre l'accueil se comporte comme un vrai premier lancement : pas de dossier
    imposé à la conversation de l'accueil (sauf `BOBINE_DEFAULT_WORKSPACE`, explicite) ; son agent
    attend le choix du dossier, donc la fin du choix de l'agent.
  - Plus de lecture du quota au lancement pour les agents installés : le quota d'un agent est lu
    quand il sert — une conversation dont l'agent se montre prêt, un essai réussi de l'accueil, un
    essai du diagnostic qui a ouvert une session (fiche 205) — et sur demande (« Actualiser »).
    Un agent pas connecté ne se montre jamais prêt : la pause de 12 h après un échec (D11) n'a plus
    d'objet et disparaît. Les fichiers `<agent>.pause.json` qu'une version précédente a laissés dans
    le dossier de lecture (`~/Library/Caches/Bobine/agent-status/`) **restent sur le disque, sans
    effet** : plus rien ne les lit (essai unitaire « fichier de pause d'une version précédente :
    ignoré »). Bobine ne les supprime pas : ce serait une écriture de plus hors du profil, à chaque
    lancement, pour un fichier de quelques octets dans un cache.
- **(b) Profil jetable : rien d'office dans les données réelles des agents.** Un profil jetable
  (`--profil-temporaire`, `--user-data-dir`, donc `pnpm pilote`) dont les agents voient le vrai
  dossier personnel (ni `--agents-neufs`, ni `BOBINE_CONFIG_HOME` des essais) :
  - ne lit **jamais** le quota : la lecture de Bob passe par `bob chat`, qui crée une tâche dans
    `~/.bob` ; aucune voie documentée ne l'évite (ADR-0017, `docs/acp.md` « Budget du compte ») et
    l'on ne suppose rien d'autre de Bob. Le quota reste donc inconnu, sans rien afficher de plus ;
  - le diagnostic n'ouvre pas de session d'office : l'agent est seulement initialisé (comme
    OpenCode l'est déjà) ; « Essayer une session » reste un geste explicite.
  - Ce que l'utilisateur fait lui-même avec Bob (essai de l'accueil, conversation, sessions à
    reprendre) crée ou lit des sessions dans `~/.bob` : c'est son choix. Pour un essai qui ne doit
    rien toucher : `--agents-neufs` (dossier personnel vide pour les agents, fiche 148).

**Autres écritures hors du profil, vérifiées** (profil jetable) :

| Écriture | Quand | Décision |
|---|---|---|
| `~/Library/Caches/Bobine/agent-status/` et `~/.bob/trustedFolders.json` (lecture du quota) | d'office | supprimée en profil jetable (b) |
| Session créée puis supprimée chez Bob (diagnostic) | à l'ouverture de la page | supprimée en profil jetable (b) |
| Session d'essai de l'accueil (créée puis supprimée) | « Continuer » / « Envoyer le message d'essai » | gardée : choix de l'utilisateur |
| `~/Bobine/<essai>` (dossier d'essai de l'accueil) | « Créer un dossier d'essai » | gardée : choix de l'utilisateur |
| Règles d'approbation, rôles, serveurs MCP dans les fichiers des agents | geste explicite (ADR-0044, ADR-0047, fiche 025) | gardée |
| Installation dans Applications, commande `bobine` | désactivée en profil isolé / geste explicite | inchangé |
| Journaux | dans le profil isolé (`<profil>/logs`) | inchangé |

## Critères d'acceptation

- [x] Accueil sur un dossier de données imposé : aucun agent de conversation lancé, aucun quota lu
  tant que l'accueil n'a pas reçu de dossier (e2e `onboarding`, agent factice avec quota).
- [x] Agent installé qui sait lire son quota mais n'est pas utilisé : quota jamais lu au lancement
  (unitaire `quota-setup`, e2e `quota`).
- [x] Agent utilisé (conversation prête) : quota lu, comme avant (e2e `quota`, existant).
- [x] Profil jetable sur le vrai dossier personnel : quota jamais lu, même sur demande ou agent
  prêt ; diagnostic sans session d'office (unitaires).
- [x] Testé contre l'agent factice ; jamais de vrai Bob ni de `~/.bob` touché par les essais.

## Plan

1. `src/main/onboarding/onboarding.ts` : `launchDecision` (décision de l'accueil, partagée par
   `createOnboarding` et `index.ts`).
2. `src/main/conversations/agentless.ts` : `defaultWorkspaceFor(env, testRun, neutral, welcome)` —
   pas de dossier neutre quand l'accueil est dû. `index.ts` : passe la décision.
3. `src/main/agent/quota-setup.ts` : plus de lecture au lancement ; `disposable` (profil jetable
   sur le vrai dossier personnel) coupe toute lecture. `quota.ts` : retrait de `automatic` et de la
   pause (D11).
4. `src/main/fresh-start.ts` : `touchesRealAgents(freshStart, env)` (profil jetable dont les agents
   voient le vrai dossier personnel).
5. Diagnostic : `checkAgent(…, { sessionless })` → `newSession: 'never'` (`agent-host.ts`).
6. Tests unitaires (`quota-setup.test.ts` nouveau, `quota.test.ts`, `agentless`, `agent-check`),
   e2e `onboarding` (aucun agent ni quota avant le dossier) et `quota` (agent pas utilisé).
7. ADR-0054 (remplace la partie « au démarrage » d'ADR-0017 et la pause D11 de la fiche 091),
   `docs/acp.md` (« Budget du compte »), fiche 091/205 (renvoi), CHANGELOG.

## Journal

- 2026-11-18 : trace relue dans `profil/logs/main.log` et `pilote/bobine.log` de la recette ;
  causes 1 à 5 établies dans le code (cause 5 par élimination : seuls `checkAgent` et
  `replaySession` lancent un hôte sans conversation).
- 2026-11-18 : correctif et essais. Unitaires : 5 essais nouveaux qui échouent sans le correctif
  (`quota-setup.test.ts` ×2, `agentless.test.ts`, `fresh-start.test.ts`, `manager.test.ts`
  diagnostic) ; `quota.test.ts` récrit sans la pause. E2e : `onboarding` (`noAgentBeforeChoice`)
  et `quota` (`notUsedSuite`, à la place du cas « pause posée avant le lancement »). Suite complète
  (`pnpm e2e --changed`, 208 passages) : 206 réussis, 2 échecs, tous deux de `quota` (clair et
  sombre), dans le nouveau cas : il attendait un agent prêt (`ui.ready()`) alors que la conversation
  sans dossier n'en démarre volontairement aucun. Essai corrigé (attente de la barre latérale),
  `pnpm e2e quota onboarding` : 4/4. Captures regardées : `242-1-accueil-sans-agent`,
  `quota-3-agent-pas-utilise` (clair, sombre) — barre latérale « Agent factice · Action requise »
  (dossier à choisir, comme un vrai premier lancement), aucun quota.
- Écart au plan : la décision (a) ne passe pas par un « gel » des agents dans le gestionnaire de
  conversations : sur un vrai premier lancement, la conversation de l'accueil n'a pas de dossier et
  rien ne démarre déjà (fiche 093) ; seul l'essai (`--user-data-dir`) s'en écartait.
- Interface : aucun élément nouveau (pas de maquette) ; pendant l'accueil d'un essai, la barre
  latérale montre l'état existant « Action requise » au lieu d'un agent qui démarre.
