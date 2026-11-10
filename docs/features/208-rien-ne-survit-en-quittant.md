# 208 — Rien ne survit à l'app en quittant (essai du diagnostic, lecture du quota)

- **Statut** : fait
- **Dépend de** : 061, 091, 138, 195, 205
- **Agents** : les deux (rien de propre à un agent : registre des processus, source de quota du profil)

## Pourquoi

La suite e2e complète a échoué une fois sur `diagnostic dark` : `ENOTEMPTY` en supprimant le
dossier de données jetable d'un essai. Quelqu'un écrivait encore dedans après la sortie de l'app.
Piste de départ : la lecture du quota en tâche de fond (fiche 205). Dans l'app réelle, la même
cause laisserait un agent (`bob acp`) ou un `bob chat` orphelin après avoir quitté.

## Enquête (2026-11-08)

- **Quota : réfuté pour cet échec.** La suite `diagnostic` ne pose pas `MOCK_AGENT_QUOTA` : le
  profil factice n'a pas de `quotaSource`, aucune lecture n'a lieu. Et ses lectures écrivent dans
  `BOBINE_CONFIG_HOME` (`quotaStatusDir`), pas dans les données de l'app — sauf la session vide du
  faux `bob chat` (`--store`). Essai déterministe (faux `bob chat` lent, `MOCK_QUOTA_SLOW_MS`,
  l'app quitte pendant la lecture) : pas de survivant avant correctif — le pseudo-terminal fermé
  envoie SIGHUP —, mais rien n'arrêtait la lecture elle-même (suppression de sessions, pause).
- **Vrai écrivain : l'agent lancé par l'essai du diagnostic.** `checkAgent` démarre un agent
  (`AgentHost`, son propre groupe, `detached`) que rien n'arrête en quittant : `shutdown` arrête
  les conversations, pas les essais. La dernière étape du journal de la suite (`BOBINE_LOG=trace`)
  ouvre Réglages › Diagnostic puis l'essai se termine aussitôt : l'essai de l'agent est en cours.
  Sonde de la fin de `withApp` : à la sortie du main, un `mock-agent/main.mts --store
  <données>/mock-agent-sessions` vivait encore (avec le `chrome_crashpad_handler` d'Electron, base
  dans `<données>/crash-dumps`). L'agent factice crée son magasin au démarrage et s'arrête à la fin
  de sa connexion : s'il démarre au moment où l'app quitte (machine chargée, trois suites en
  parallèle), il écrit pendant le `rmSync` → `ENOTEMPTY`.
- **Reproduit** : agent lent à démarrer (`MOCK_AGENT_SLOW_START_MS=2500`) et tenace
  (`MOCK_AGENT_TENACE=1`), l'app quitte pendant l'essai : l'agent de l'essai survit indéfiniment.

## Critères d'acceptation

- [x] Quitter pendant l'essai d'un agent : l'agent de l'essai est arrêté avec l'app (SIGTERM, puis
      SIGKILL ; `will-quit` attend, fiche 195), même s'il ignore SIGTERM et la fin de sa connexion.
- [x] Filet commun : tout processus du registre (`agents.pids`) encore vivant en quittant est
      arrêté — au groupe seulement, jamais un pid seul ; ceux déjà en cours d'arrêt sont laissés.
- [x] Jamais le groupe d'un autre : chaque entrée est vérifiée par un seul `ps` (même commande,
      même heure de départ, `orphanGroups` comme au démarrage) ; `ps` en échec : rien n'est arrêté ;
      groupes vides ou repris retirés du registre.
- [x] Quitter pendant une lecture du quota : `bob chat` fermé tout de suite, rien écrit ni lancé
      ensuite (ni suppression de sessions, ni pause posée), plus de lecture.
- [x] e2e : `withApp` attend (3 s au plus) que les processus qui citent le dossier de données
      sortent (crashpad), échoue en les nommant s'il en reste ; un `rmSync` raté dit ce qui reste
      et qui l'utilise.
- [x] Testé contre l'agent factice (suites `diagnostic` et `quota`).

## Plan

- `process-registry.ts` : `stopTrackedChildren()` (`terminateLeftovers` par groupe vivant).
- `index.ts` (`shutdown`) : `quotas.stop()` puis `stopTrackedChildren()`, en dernier.
- `quota.ts` / `quota-setup.ts` / `adapters.ts` / `bob-status.ts` : `QuotaReader.stop()`, `signal`
  dans `QuotaContext`, la lecture de `/status` s'arrête dessus.
- Agent factice : `MOCK_AGENT_SLOW_START_MS` (comme `--demarrage-lent`), `MOCK_QUOTA_SLOW_MS`.
- e2e : `processesUsing`, survivants et reste nommés dans `lib.mjs` ; cas « quitter pendant
  l'essai » (`diagnostic`) et « quitter pendant la lecture » (`quota`).

## Journal

- 2026-11-08 — Fait. Essais qui échouent avant le correctif : e2e `diagnostic` (« quitter pendant
  l'essai : aucun agent ne survit à l'app » : l'agent de l'essai vivant), unitaires
  `process-registry.test.ts` et `quota.test.ts` (`stop`). Le cas e2e du quota passe avant comme
  après (SIGHUP du pseudo-terminal) : il garde le comportement. Durcissement de l'e2e en plus, dit
  comme tel : attente du `chrome_crashpad_handler` d'Electron, qui sort un peu après le main et
  utilise `<données>/crash-dumps` — c'est Electron, pas l'app. La suite `quota` supprime aussi ses
  dossiers (données, dossier personnel) qu'elle laissait dans les fichiers temporaires.
- 2026-11-08 — Relecture : une entrée peut rester au registre des heures (descendants vivants à la
  sortie du chef, partis plus tard, sans nouvelle vérification) ; son groupe a pu être repris par
  un autre programme. `stopTrackedChildren` vérifie désormais chaque entrée par `ps` (synchrone,
  `listProcessesSync`, 5 s au plus) avec la règle du démarrage (`orphanGroups`), n'arrête rien si
  `ps` échoue, et retire du registre les groupes vides ou repris. Essai unitaire : identifiant
  repris par un autre programme ou par un processus lancé plus tard → jamais visé.
- 2026-11-08 — Suite complète après fusion : `android` (clair et sombre) échouait sur la nouvelle
  vérification, survivant nommé `chrome_crashpad_handler`. Cause réelle, chez nous : le flux vidéo
  et le film Android arrêtaient le seul `adb` (`child.kill()`), pas son groupe. Le faux `adb` (un
  script `sh`) laissait son `sleep` vivre après l'app ; en quittant, le chef, déjà tué mais pas
  encore récolté (zombie), ne passait plus la vérification par `ps` (« autre commande ») : son
  groupe était laissé. Et le crashpad d'Electron reste tant qu'un processus né de l'app vit encore.
  Correctif : `stopGroup` (tout le groupe, attendu par `will-quit`) dans `android-manager.ts`. Un
  vrai `adb` ne lance pas d'enfant, mais rien ne le garantit. Essai e2e : les attentes du faux `adb`
  portent une marque propre à l'essai (`sleep 30.<marque>`) ; aucune ne doit survivre à l'app —
  échoue avant le correctif. `withApp` ne compte plus le crashpad comme survivant : il est attendu
  10 s au plus avant de supprimer le dossier, puis arrêté s'il reste. Le flux du simulateur iOS
  s'arrête toujours par SIGINT au seul AXe (voulu : AXe finit proprement) — non touché.
