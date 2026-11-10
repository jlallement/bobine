# 164 — Coût d'une conversation : toutes ses sessions

- **Statut** : fait
- **Dépend de** : 108 (continuer avec un autre agent), 109 (coût par échange), 157 (plafond de
  coût), ADR-0030 (session perdue : session neuve dans la même conversation)
- **Agents** : les deux (générique : toute conversation qui change de session)

## Pourquoi

Une conversation peut changer de session : session perdue chez l'agent (Bob purge ses tâches au
bout de 30 jours depuis 2.0.1, ADR-0030), « Continuer avec un autre agent » (fiche 108). Le fil
remet alors sa consommation à zéro, et le coût affiché (compteur de la saisie, cartes des filles)
ne compte plus que la nouvelle session : les bobcoins dépensés avant disparaissent du total, et le
plafond de coût (fiche 157) repart de zéro. « Mon activité » (journal, fiche 130) n'est pas touché.

## Critères d'acceptation

- [x] Au changement de session, le coût de la session qui se termine est gardé dans le fil
      (`usage.earlier`, par devise) ; le coût de la nouvelle session repart de zéro comme avant.
- [x] Le compteur de la saisie et le résumé (cartes des filles) montrent le coût de **toute** la
      conversation dans la devise de l'agent actuel ; le détail dit aussi « dont cette session ».
- [x] Un coût dans une autre devise (autre agent) est montré à part dans le détail, jamais
      additionné.
- [x] Le plafond de coût compte toute la conversation dans son unité de coût.
- [x] Le coût par échange (fiche 109) et le journal (fiche 130) sont inchangés (coût cumulé de la
      session, `usage.cost`).
- [x] Testé : réducteur du fil (handover), résumé, plafond, compteur ; suite e2e touchée.

## Plan

- `shared/usage.ts` : `ConversationUsage.earlier?: Record<devise, montant>` ; `conversationCost`
  (total dans la devise actuelle + les autres devises) ; `usageDigest` l'utilise.
- `shared/transcript.ts` (`handover`) : garde `earlier` + le coût de la session qui finit.
- `shared/cost-cap.ts` (`spentIn`) : ajoute `earlier` de la même unité.
- `components/composer/UsageMeter.tsx` : total de la conversation ; lignes « Cette session » et
  « Avant, chez un autre agent » ; i18n fr/en.
- Essais : `usage.test.ts`, `transcript.test.ts`, `cost-cap.test.ts`, `UsageMeter` ; e2e
  `handover` (bascule) si elle montre le compteur.

Aucune dépendance nouvelle.

## Journal

- 05/11 : fiche (vérification de la purge de 30 jours de Bob : seul le total affiché après une
  session neuve est faux ; coûts déjà affichés et « Mon activité » intacts).
- 05/11, fait :
  - `shared/usage.ts` : `earlier` (par devise), `conversationCost` (total dans la devise actuelle,
    « cette session », autres devises), `nextSession` (consommation d'une session neuve) ;
    `usageDigest`, `hasUsage` et `withoutCost` (mode présentation) en tiennent compte.
  - `shared/transcript.ts` : le `handover` garde le coût des sessions précédentes (logique dans
    `nextSession`, pour rester sous la limite de 800 lignes).
  - `shared/cost-cap.ts` : `spentIn` et `capUnitOf` comptent toute la conversation.
  - Compteur de la saisie : total de la conversation ; lignes « Cette session » et « Avant, avec un
    autre agent » au détail (fr/en).
  - Inchangés : `usage.cost` reste le coût cumulé de la session (coût par échange, journal).
  - Essais : `usage.test.ts`, `handover.test.ts`, `cost-cap.test.ts`, `UsageMeter.test.tsx` ;
    tests `src/main/conversations` et `src/main/usage` (243) ; e2e `handover`, `usage`,
    `usage-bob`, `turn-guards`, `filles` vertes. Pas de suite complète (machine peu puissante) :
    à faire avant le prochain push.
  - Limite : une conversation qui a déjà changé de session avant cette version garde son total
    d'alors (le coût d'avant n'était pas conservé dans le fil) ; « Mon activité » l'a toujours.
