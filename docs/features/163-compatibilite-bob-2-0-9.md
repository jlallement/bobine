# 163 — Compatibilité Bob 2.0.9

- **Statut** : fait
- **Dépend de** : 011 (élicitation), 013 (modes), 022 (licence, clé), 048 (sonde), 088 (confiance),
  139 (grille de conformité)
- **Agents** : Bob (la licence et le mode de départ passent par ce que Bob annonce ou documente ;
  rien n'est imposé aux autres profils, ADR-0011)

## Pourquoi

Bob Shell est passé de 2.0.6 à 2.0.9 (paquet npm `@ibm/bob`, mise à jour automatique). La sonde
(`pnpm bob-probe`) relève deux écarts : la licence ne bloque plus `session/new` et un dossier
jamais approuvé n'est plus refusé. Bobine doit suivre sans rien supposer, et peut profiter du mode
de départ que Bob accepte désormais à l'ouverture de la session (`_meta["bob/mode"]`, 2.0.6).

## Ce que Bob 2.0.9 fait (relevé le 05/11, 0 bobcoin)

- **Licence** : si le client annonce l'élicitation `form` (Bobine le fait, fiche 011), `session/new`
  passe et la licence est demandée **au premier message**, par un formulaire (`mode: form`, une
  case `accept` « I accept the IBM license agreement », message avec les chemins des trois fichiers
  de licence). Formulaire refusé : `session/prompt` échoue en `-32600` « A license agreement is
  required… ». Sans élicitation, `session/new` échoue comme avant (sonde).
- **Confiance** : en ACP, un dossier **jamais décidé** est traité comme approuvé (sonde et
  essai) ; un dossier marqué « Don't trust »
  (`DONT_TRUST` dans `~/.bob/trustedFolders.json`) est refusé avec le message d'avant (`-32600`
  « Workspace … is not trusted »). `--trust` écrit toujours `TRUST_FOLDER` (mémorisé). Le « mode
  sans échec » (règles, skills, MCP du dossier ignorés) ne concerne que le mode interactif.
- **Ordre** : mode demandé, confiance, connexion, puis licence (sans élicitation).
- **Mode de départ** : `_meta: { "bob/mode": "plan" }` dans `session/new` ouvre la session dans ce
  mode ; un mode inconnu est refusé (`invalidParams`).

## Critères d'acceptation

- [x] Licence au premier message : le formulaire de Bob s'affiche comme toute élicitation (case à
      cocher, message lisible) ; l'accepter laisse le tour continuer.
- [x] Formulaire refusé : le tour échoue avec une explication traduite (« IBM Bob demande
      d'accepter sa licence : renvoyez un message et cochez la case ») au lieu de l'erreur brute.
- [x] Le panneau « Licence à accepter » reste pour un agent qui refuse `session/new` (Bob sans
      élicitation, versions antérieures).
- [x] Le panneau « Faire confiance à ce dossier » reste pour un dossier refusé (« Don't trust »).
- [x] Mode de départ : avec le profil Bob, une conversation réglée sur « Plan » ouvre sa session
      directement en Plan (`bob/mode`), sans `session/set_mode` ; mode refusé par l'agent : session
      rouverte sans, puis mode appliqué comme avant. Déclaré dans le profil, Réglages › Agents et
      `docs/agents.md`.
- [x] Sonde : licence observée par le formulaire (clé factice, refusé, 0 bobcoin), dossier refusé
      observé avec un `trustedFolders.json` « Don't trust » ; contrat vert sur Bob 2.0.9, réponses
      enregistrées (`--accept`).
- [x] `docs/acp.md` (section « Compatibilité Bob ») à jour pour 2.0.9.
- [x] Testé contre l'agent factice (scénario `bob-licence-formulaire` ; mode de départ par `_meta`
      avec `--mode-depart bob/mode`, dans les essais de l'hôte d'agent).

## Plan

1. **Agent factice** (`src/mock-agent/`) : scénario `bob-licence-formulaire` (élicitation au premier
   prompt ; acceptée → réponse ; refusée → `-32600` licence) ; option qui lit `_meta["bob/mode"]` à
   `session/new` (refus `invalidParams` d'un mode inconnu). `docs/mock-agent.md`.
2. **Licence au tour** (`agent-host.ts`, `turnFailed`) : erreur du tour reconnue par le motif de
   licence du profil (`profile.license.pattern`, déjà là) → message traduit (clé i18n fr/en) au lieu
   du texte brut. Générique : tout profil qui déclare `license`.
3. **Mode de départ** : champ de profil `initialModeMeta` (`{ key, ids: { plan, execute } }`),
   rempli pour Bob (`bob/mode`, `plan` / `agent`) ; `newSessionRequest` le passe dans `_meta` ;
   `invalidParams` → nouvel essai sans ; `applyInitialMode` inchangé (rien à faire si le mode est
   déjà le bon). `specificItems`, `docs/agents.md`.
4. **Sonde** (`scripts/bob-probe.mts`, `src/main/agent/bob-probe.ts`) : sondage « licence par
   formulaire » (prompt à clé factice, formulaire refusé), « dossier refusé » (HOME jetable avec
   `DONT_TRUST`) ; contrat : licence reconnue par l'un ou l'autre chemin ; `--accept`.
5. **Doc** : `docs/acp.md` (2.0.9 installé, comportements vérifiés, matrice), `bob-contract.ts`
   (commentaires), CHANGELOG fr/en.
6. **Essais** : tests unitaires (hôte d'agent, profil, sonde), grille de conformité façon Bob,
   e2e touchées (`pnpm e2e --changed`).

Aucune dépendance nouvelle.

## Journal

- 05/11 : fiche ; Bob mis à jour en 2.0.9 (`npm install -g @ibm/bob`, `~/bin/bob` → `/usr/local`,
  2.0.6 gardée dans `~/.local`) ; relevés ci-dessus (sonde, essais en HOME jetable ; un
  `session/new` avec le Bob réel dans un dossier neuf, session supprimée, 0 bobcoin).
- 05/11, fait :
  - Agent factice : scénario `bob-licence-formulaire` (formulaire de la 2.0.9, refus → `-32600`) ;
    option `--mode-depart <clé>` (mode lu dans `_meta`, inconnu → `invalidParams`). Message de
    licence déplacé dans `scenario.mts` (pas d'import circulaire).
  - Licence au tour : `turnFailed` reconnaît le motif `license` du profil et émet
    `agentHost.licenseAtPrompt` (fr/en) au lieu de l'erreur brute.
  - Mode de départ : `initialModeMeta` du profil (Bob : `bob/mode`, `plan` / `agent`) ;
    `openWithStartMode` (dans `initial-controls.ts`, pour garder `agent-host.ts` sous sa limite
    ESLint) ; refus → session rouverte sans, mode appliqué ensuite. Repère `start-mode` dans
    Réglages › Agents et `docs/agents.md`.
  - Sonde : sondages « dossier refusé (Don't trust) » (HOME jetable) et « licence au premier
    message » (clé factice, formulaire refusé) ; contrat qui accepte l'ancien et le nouveau chemin
    (testé avec des réponses façon 2.0.6) ; réponses 2.0.9 enregistrées ; `testedVersions` du
    profil : `2.0.6`, `2.0.9`.
  - Doc : `docs/acp.md` (ce qui change en 2.0.9, matrice, sonde), `docs/mock-agent.md`, CHANGELOG.
  - Écart : la persona « façon Bob » de la grille de conformité ne reçoit **pas**
    `--mode-depart`. Ses modes sont ceux du factice (`code`, `ask`, `plan`) : le mode d'exécution de
    Bob (`agent`) y serait toujours refusé, un détour que le vrai Bob ne prend jamais et qui
    décalait la grille (échecs intermittents observés). Les deux chemins sont couverts par
    `agent-host.test.ts`.
  - Reste à faire avec Bob réel (bobcoins) : accepter le formulaire de licence dans Bobine
    (première utilisation sur une machine neuve) et ouvrir une conversation en Plan.
- 05/11, essai réel avec Bob 2.0.9 (app de dev, harnais e2e, journal Trace, 0 bobcoin) :
  - Licence : HOME jetable pour Bob et clé factice ; au premier message, le formulaire de Bob
    s'affiche dans le fil (case « I accept the IBM license agreement », Refuser / Envoyer) ;
    refusé → « Erreur : IBM Bob demande d'accepter sa licence : renvoyez votre message, puis
    acceptez-la dans le formulaire qui s'affiche. », sans l'erreur brute. Pas accepté par l'essai
    (c'est à l'utilisateur). Captures `163-bob-licence-formulaire`, `163-bob-licence-refusee`.
  - Mode de départ : Bob de l'utilisateur, « Nouvelle conversation » réglée sur Plan, sans
    message ; `session/new` part avec `_meta: {"bob/mode": "plan"}`, Bob répond
    `currentModeId: "plan"`, aucun `session/set_mode`, « Plan » affiché. Les deux tâches vides de
    l'essai ont été supprimées chez Bob (`session/delete`).
  - Défaut vu : le message du formulaire perdait ses retours à la ligne (les trois chemins de
    licence s'enchaînaient). Corrigé dans la carte d'élicitation, pour tout agent : classe
    `elicitation-message` (`white-space: pre-line`, long chemin coupé) ; suite e2e `bob` (message
    sur ses quatre lignes, refus expliqué), capture `163-licence-formulaire` ; suites `questions`
    et `inbox` vertes.
