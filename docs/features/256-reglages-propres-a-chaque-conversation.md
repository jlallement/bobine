# 256 — Réglages propres à chaque conversation

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 013, 097, 108, 163, 177, 180, 223
- **Agents** : les deux — générique (modes **et** options de configuration ACP), rien de supposé
  de Bob ni d'OpenCode
- **ADR** : [ADR-0058](../adr/0058-reglages-propres-a-chaque-conversation.md) (proposé)

## Pourquoi

Recette exploratoire OpenCode du 2026-11-19, constat **D3** (reproduit 3 fois) : le mode et le
modèle passent d'une conversation à l'autre. Après une relance, l'utilisateur passe A en Plan et
en modèle X ; il ouvre B (pas encore rouverte), qui était en Build et en modèle Y : B reçoit
`set_config_option mode=plan` puis `model=X`. Risque de sécurité dans l'autre sens : une
conversation laissée en Plan, rouverte en Build, écrit sans que l'utilisateur l'ait voulu.

Trace réelle (OpenCode 2.3.0, `agents.log` de la recette, 19:45–19:47 UTC) :

- 19:45:09 l'utilisateur passe la mère en `mode=plan` ; 19:45:46 la fille `f07062c9` rouverte
  (`session/load`) reçoit aussitôt `mode=plan`, puis 19:46:00 `ddb49019` de même ;
- 19:46:50 la mère passe en `model=openai/gpt-6-sol` ; 19:46:52 `73c9c47e` rouverte reçoit
  `model=openai/gpt-6-sol` **et** `mode=plan`.
- Ce que la session rouverte annonce : à 19:46:00, `ddb49019` ne reçoit **pas** de `model` alors
  que le dernier choix global était `gpt-6.1-sol` ; or chaque `session/new` du journal reçoit
  `model=gpt-6.1-sol` (le défaut d'OpenCode est autre). OpenCode 2.3 rend donc à `session/load`
  le modèle de la session. Le mode rendu, `build`, était aussi celui de la session.

## Cause

`hostOptions` (`src/main/conversations/host-options.ts`) passait en `initialControls`
`{ ...profile.defaultControls, ...settings.current.controls?.[profile.id] }` : le **dernier choix
fait n'importe où** avec ce profil (`rememberControl`). `AgentHost.applySession` appliquait ces
réglages à **toute** ouverture de session, réouverture comprise ; seul `initialMode` (réglage
« Nouvelle conversation ») était écarté à la réouverture. Le même défaut touchait, sans relance,
une conversation mise en veille (limite d'agents vivants, fiche 043) puis rouverte, et la
relance d'un agent dans le même hôte (« Réessayer » après connexion, D10) qui réappliquait les
réglages lus à la création de l'hôte.

## Décision (qui hérite de quoi)

| Session ouverte | Réglages appliqués |
|---|---|
| **Réouverture** (`session/load` / `resume`, même session) | ceux de la conversation, mémorisés ; à défaut (conversation d'avant cette fiche, session reprise de l'agent), **rien** : ce que la session annonce |
| Nouvelle conversation (brouillon, ⌘N, tâche planifiée) | dernier choix du profil (`controls[profil]`, sinon `defaultControls`), puis mode de départ — inchangé |
| Session neuve **dans** une conversation (session perdue, limite d'étapes, agent sans reprise : ADR-0030) | ceux de la conversation, s'il y en a ; sinon dernier choix du profil |
| Fille (097), fille d'un rôle (223), relecture (177) | nouvelle conversation : dernier choix du profil, puis le modèle confirmé sur la carte / le mode du rôle (inchangé, `remember: false`) ; ensuite les siens |
| Branche (023) | **ceux de la conversation d'origine** (même agent) : une branche la continue, une conversation en Plan donne une branche en Plan |
| Aparté (180) | ceux de la conversation (son modèle), puis mode plan (inchangé) |
| Bascule vers un autre agent (108) | les réglages de l'ancien agent sont oubliés (identifiants propres à chaque agent) ; dernier choix du nouveau profil, mode de départ, puis le modèle choisi dans la bascule |

Le dernier choix global (`settings.controls[profil]`) reste mémorisé à chaque choix de
l'utilisateur, et ne sert plus qu'aux sessions qui n'ont pas de réglages à elles.

Ce qui est mémorisé : **toutes** les valeurs courantes des réglages de la session (mode, modèle,
effort, options), relevées à chaque état stable (`ready`, `busy`) de l'hôte ; donc aussi un
changement fait par l'agent (`current_mode_update`, `config_option_update`). Jamais pendant
l'ouverture (`starting`), où l'agent annonce encore ses valeurs à lui. Une liste remplace la
précédente : un réglage qui disparaît (effort d'un modèle sans variantes) n'est plus réappliqué.

Un réglage mémorisé que la session rouverte ne propose plus (ou plus avec cette valeur) donne
l'avis habituel « Réglage non appliqué » (fiche 013) : jamais silencieux, c'est le cas où la
conversation était en Plan et ne l'est plus.

## Critères d'acceptation

- [x] Une conversation rouverte (relance, mise en veille, « Réessayer ») garde ses propres mode et
      modèle, même si le dernier choix a changé ailleurs entre-temps.
- [x] Sans réglages mémorisés (conversation d'avant), la réouverture n'envoie rien : ce que la
      session annonce.
- [x] Agent qui oublie les réglages à `session/load` : ceux de la conversation sont réappliqués
      (le Plan reste le Plan).
- [x] Les nouvelles conversations reçoivent toujours le dernier choix du profil, puis le mode de
      départ.
- [x] Filles, rôles, relecture, branche, aparté, bascule : décision ci-dessus ; branche et
      bascule testées contre l'agent factice, aparté par ses options ; filles, rôles et relecture
      inchangés (nouvelles conversations, essais existants).
- [x] Fiche de conversation : réglages mal formés retirés à la lecture, pas la conversation.
- [x] Testé contre l'agent factice : deux conversations, réglages différents, relance,
      réouverture (avec un agent qui rend ses réglages et un agent qui les oublie,
      `--reglages-oublies`).

## Plan

1. `src/main/conversations/conversation-controls.ts` (nouveau, fonctions pures) :
   `parseConversationControls`, `noteSessionControls(record, snapshot)` (relevé aux états
   stables), `openingControls(record, profile, remembered, session)` (règles ci-dessus).
2. `store.ts` : champ `controls?: { profileId, values }` de `ConversationRecord`, vérifié à la
   lecture (`withControls`).
3. `agent-host.ts` (changement minimal, d'autres y travaillent) : `initialControls` devient une
   fonction `(session: 'new' | 'reopened') => …`, relue à chaque ouverture ; `applySession` lui
   passe `reopened` quand la session ouverte est celle à rouvrir.
4. `host-options.ts` : `initialControls` = `openingControls(…)`, lu à l'ouverture (plus figé à la
   création de l'hôte).
5. `manager.ts` : relevé dans `onEvent` (statut) ; `switchAgent` oublie les réglages de l'ancien
   agent ; `branch` copie ceux de la conversation d'origine.
6. Agent factice : `--reglages-oublies` / `MOCK_AGENT_FORGET_CONTROLS=1` (mode, modèle et
   options remis aux défauts à `session/load` et `resume`), dans `docs/mock-agent.md`.
7. Tests : unitaires (module, store, `aside`, `AgentHost`), gestionnaire contre l'agent factice
   (deux conversations, relance, réouverture ; agent qui oublie ; veille ; branche ; bascule).
8. Docs : `docs/acp.md` (compatibilité Bob : rien de supposé sur ce que `session/load` rend),
   `docs/architecture.md` si besoin, ADR-0058, CHANGELOG fr/en.

Aucune nouvelle dépendance.

## Journal

- 2026-11-19 — Fiche créée (D3 de la recette OpenCode). Trace relue, cause confirmée dans le
  code ; plan écrit avant de coder.
- 2026-11-19 — Fait.
  - `conversation-controls.ts` (nouveau) : `openingControls`, `noteSessionControls`,
    `parseConversationControls` ; `helpers.ts` : `noteSession` (identifiant de session et réglages
    relevés ensemble, à chaque statut).
  - `agent-host.ts` : trois lignes (type de `initialControls`, `reopened` dans `applySession`).
    `initial-controls.ts` : commentaires seulement.
  - Écarts au plan : `switchAgent` ne supprime pas `record.controls` (le plafond de lignes de
    `manager.ts`, 1050, était atteint) : les réglages de l'ancien agent sont ignorés parce qu'ils
    portent son `profileId`, et remplacés à la première session prête du nouveau (testé). Le
    relevé est passé par `helpers.ts` (`noteSession`) pour la même raison.
  - Tests : `conversation-controls.test.ts` (unitaires : règles d'ouverture, relevé, lecture ;
    `noteSession` ; fiche abîmée ; gestionnaire contre l'agent factice : deux conversations,
    relance, réouverture — agent qui rend ses réglages et agent qui les oublie
    (`--reglages-oublies`) —, conversation d'avant sans réglages, veille sans relance, branche,
    bascule), `agent-host-initial-controls.test.ts` (neuve / rouverte / session perdue, réglages
    relus à chaque ouverture). Les cinq essais de réouverture et de branche échouent avec l'ancien
    `initialControls` (vérifié en le remettant le temps d'un passage).
  - Agent factice : `--reglages-oublies` (`MOCK_AGENT_FORGET_CONTROLS=1` dans l'app).
  - Aucune suite e2e lancée (consigne du tech lead). `pnpm e2e --changed --dry-run` désigne la
    suite complète (218 tâches : `agent-host.ts`, `manager.ts`, l'agent factice sont partagés).
    Ciblées d'abord : `base`, `plan`, `reprise`, `restart`, `resume`, `history`, `branch`,
    `aparte`, `handover`, `filles`, `roles-travail`, `relecture`, `limite-etapes`,
    `connexion-expiree`, `session`.
  - `./scripts/verify` vert (4988 tests). Deux passages précédents rouges sur
    `bob-costs.test.ts` (« veille de la base de Bob », délai de 15 s dépassé, charge machine ≈ 70) :
    sans lien avec la fiche, vert seul et au passage suivant ; signalé au tech lead.
  - Reste : relever ce que Bob rend à `session/load` (mode) à la prochaine recette Bob ; la bascule
    vers un autre agent ne reporte pas le Plan (identifiants différents) : à décider si besoin
    (rapprocher par `isPlanMode`).

