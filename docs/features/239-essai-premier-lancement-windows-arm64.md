# 239 — Essai du premier lancement : tests fragiles sur le runner Windows arm64

- **Statut** : fait
- **Dépend de** : 188 (essai « répond ? » du premier lancement)
- **Agents** : les deux — seuls les tests changent, contre l'agent factice ; rien de propre à un agent

## Pourquoi

Pendant la Release de la 1.0.0-beta.7, sur le runner GitHub **Windows arm64** (lent),
`./scripts/verify` a fait échouer 4 tests de `src/main/onboarding/agent-readiness.test.ts`
(bloc « essai « répond ? » du premier lancement (fiche 188) ») :

1. « annulé pendant la réponse… » : `expected +0 to be 1` ;
2. « « connecté ? » annulé juste après l'ouverture… » : `expected [ Array(1) ] to deeply equal [ …(2) ]` ;
3. « arrêt immédiat (fermeture de l'app)… » : `expected +0 to be 1` ;
4. « méthode de connexion que l'agent n'annonce pas… » : `expected [ Array(1) ] to deeply equal []`.

Ils passent sous macOS, Linux et Windows x64. Une Release ne doit pas tomber sur un test fragile,
et un vrai défaut de l'essai (session non supprimée, agent pas arrêté) ne doit pas s'y cacher.

## Critères d'acceptation

- [x] Les 4 échecs reproduits sur Mac, machine chargée, avec les mêmes messages.
- [x] Cause trouvée et corrigée à la cause, sans délai allongé, sans nouvelle tentative, sans test sauté.
- [x] Un test en échec ne déborde plus sur les suivants (vérifié en provoquant une panne).
- [x] Le fichier passe 30 fois de suite sous `taskpolicy -c background`, machine chargée.
- [x] `./scripts/verify` passe.

## Cause

**Un test fragile, pas un défaut de l'app.** Deux défauts du fichier de test, l'un entraînant l'autre :

1. **Attente sur une durée.** Trois tests attendaient l'ouverture de la session d'essai par
   `await vi.waitFor(() => expect(noted.length).toBe(1))`, sans délai donné : celui de vitest,
   **1 s**. Dans ce délai, il faut lancer `node`, charger l'agent factice, `initialize` puis
   `session/new`. Sur un runner lent, c'est plus long : `expected +0 to be 1` (échecs 1 et 3, et
   « essai annulé : le tour est rapporté quand même » du second bloc). Preuve : les tests en échec
   durent tous entre 1 008 et 1 053 ms, le délai par défaut de `vi.waitFor`.
2. **Fuite entre tests.** `noted`, `removed` et `spawned` sont des tableaux du module, vidés dans
   `afterEach`. Un test qui échoue avant d'avoir annulé ou arrêté son essai le laisse tourner
   (`attend-stop` attend `session/cancel` jusqu'au délai de réponse) ; sa session est notée
   **après** le `afterEach`, donc dans `noted` du test suivant. D'où les échecs 2 (`removed` a 1
   session, `noted` 2) et 4 (`[]` attendu, une session reçue alors que ce test-là n'a rien lancé
   chez l'agent). Preuve : sur le code d'avant, une panne provoquée dans « arrêt immédiat » avant
   l'ouverture de la session fait échouer un autre test, plus loin, avec
   `expected [ Array(1) ] to deeply equal [ …(2) ]`.

Le journal autour n'en est pas la cause :
- `Accueil : sessions d'essai de mock pas supprimées Error: agent injoignable` vient d'un test
  voulu de `onboarding.test.ts` (l'agent qui lève `agent injoignable`) ;
- `Session … non supprimée … délai dépassé` vient d'autres fichiers (conversations, aparté, quota) ;
- `Accueil : dossier d'essai pas supprimé … ENOTEMPTY` : le dossier jetable d'un essai laissé
  tourner par un test en échec (l'agent factice y écrit encore), noté sans lever comme prévu
  (`removeQuietly`) ; c'est une conséquence de la fuite.

Le code de l'app (`agent-readiness.ts`, `short-lived-agent.ts`) se comporte comme promis dans
chaque cas : annulé, la session est supprimée (`session/delete` après la fin du tour annulé,
bornée) ; arrêté, l'agent est tué aussitôt (`killTree`) et la session reste notée pour la
retentative du lancement suivant ; méthode inconnue, rien n'est envoyé à l'agent.

## Correctif

Seul `src/main/onboarding/agent-readiness.test.ts` change :

- **Un évènement, pas une durée** : `sessionNoted()` se résout quand l'essai note sa session
  (`onSession`) ; borné par le délai du test (15 s), comme tout le reste du test.
- **Rien ne survit au test qui l'a lancé** : `check()` garde chaque essai en cours et son arrêt
  immédiat (`onStop`, le même chemin que l'app à sa fermeture : `killTree`, donc `taskkill` sous
  Windows) ; `afterEach` arrête ceux qui tournent encore et **attend leur fin** avant de vider les
  tableaux.
- `expectStopped()` attend l'évènement `exit` de chaque agent lancé au lieu de sonder 5 s.

## Preuves

- Avant : 8 lancements en parallèle du fichier sous `taskpolicy -c background` (Mac, 15 cœurs) :
  **8 sur 8 en échec**, 2 à 5 tests chacun, avec exactement les messages du runner (18 ×
  `expected +0 to be 1`, 4 × `[ Array(1) ]` / `[ …(2) ]`, 8 × `[ Array(1) ]` / `[]`).
- Après : mêmes conditions, 8 sur 8 verts. Puis **30 lancements sur 30 verts** (33 tests chacun),
  tous sous `taskpolicy -c background`, 6 à la fois, pendant que tournaient en boucle, eux aussi
  en arrière-plan, `vitest run src/main/agent` et `vitest run src/main/conversations`.
- Panne provoquée dans « arrêt immédiat » avant l'ouverture de la session : avant, un second test
  échoue plus loin (fuite) ; après, seul le test en panne échoue.

## Plan

Un seul fichier de test touché ; pas de nouvelle dépendance.

## Journal

- **2026-11-17** — Reproduit sur Mac en chargeant la machine (8 lancements parallèles sous
  `taskpolicy -c background`) : mêmes 4 échecs, plus « essai annulé : le tour est rapporté quand
  même ». Cause : `vi.waitFor` à 1 s par défaut et fuite d'un essai encore en cours vers le test
  suivant. Corrigé dans le test seul (attente d'un évènement, essais arrêtés et attendus dans
  `afterEach`, `expectStopped` sur `exit`). Campagne : 30 sur 30 verts, machine chargée. Pas de ligne de
  CHANGELOG : rien ne change pour l'utilisateur.
- Reste incertain : vérifié sur Mac seulement. Sous Windows arm64, l'arrêt passe par `taskkill`
  (plus lent) : `afterEach` l'attend désormais, borné par son propre délai (10 s). L'échec de la
  beta.6 sur `scripts/pilote/pilote.test.mjs` est un autre fichier, non traité ici.
- 2026-11-19 — **Même fragilité dans les essais de l'hôte d'agent** (CI Windows, `main` 8531b19,
  run 44417738585) : `agent-host.test.ts` « question affichée, autorisation accordée seule… »
  rouge, `expect.poll(() => t.question())` abandonné au bout de 1 s (essai fini en 1 316 ms, agent
  lancé à 23:08:51.441) avant que la question de l'agent factice n'arrive par le serveur MCP de
  l'app. Pas la veille du coût ajoutée juste avant (profil sans `costSource`, veille seulement
  après un tour). Correction : `eventLog` (`src/main/agent/test-events.ts`), qui relit la condition
  à chaque évènement de l'hôte, sans délai ; toutes les attentes sans délai explicite contre
  l'agent factice réel de `agent-host.test.ts` (11) et `agent-host-retry.test.ts` (14) y passent.
  Les autres `vi.waitFor` sans délai de `src/main` attendent des doublures, pas un agent réel :
  laissés tels quels. Vérifié aussi sous charge (12 processus qui occupent les cœurs).

