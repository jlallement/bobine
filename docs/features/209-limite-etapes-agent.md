# 209 — Limite d'étapes de l'agent : continuer, rouvrir la session, ou repartir avec le résumé

- **Statut** : fait
- **Dépend de** : 103 (fil gardé à la réouverture), 157 (cartes de fin de tour, `CostCapCard`),
  D10 (renvoi d'un message refusé, `turn-auth.ts`), ADR-0030 (session neuve du même agent)
- **Agents** : tous. Rien de propre à un agent : tout part de la raison d'arrêt ACP
  `max_turn_requests` et de ce que l'app observe (aucune mise à jour pendant le tour). Bob 2.0.9
  en est la cause connue (sa limite compte sur toute la session), mais aucun test ne porte sur
  l'identité de l'agent (ADR-0011).

## Pourquoi

Essai d'une heure du 2026-11-08 (Bob 2.0.9) : un tour de 464 s s'arrête en `max_turn_requests`,
au milieu d'une phrase. Bobine n'affichait qu'une ligne grise, « Arrêt : nombre maximal d'étapes
atteint. ». Le message suivant, « Continue… », a été refusé en 34 ms, sans aucune mise à jour ni
coût : la limite de Bob (`session.maxTurns`, 100 par défaut) compte les requêtes au modèle **sur
toute la session**, et ne repart à zéro que si son processus est relancé puis la session rechargée
(supposé alors, vérifié en réel ensuite : voir le journal). L'utilisateur était coincé sans le savoir,
et un message en file partait tout seul pour se faire refuser de la même façon.

## Critères d'acceptation

- [x] **Cas A** — tour fini en `max_turn_requests` après du travail : une carte remplace la ligne
  grise, « L'agent s'est arrêté avant la fin » / « Il a atteint son nombre maximal d'étapes pour
  ce tour. », bouton **Continuer**, qui envoie à l'agent le message fixe de l'app (non traduit,
  ADR-0014 : le même que « Continuer » du plafond de coût, `CONTINUE_PROMPT`).
- [x] **Cas B** — `max_turn_requests` sans aucune activité de l'agent pendant le tour (aucun
  `session/update`) : « L'agent refuse de continuer ici » / « Il a refusé ton message sans rien
  faire : sa limite vaut pour toute la session. », boutons **Rouvrir la session et continuer**
  (agent relancé, `session/load`, même message renvoyé une fois ; proposé seulement si l'agent
  annonce `loadSession`) et **Nouvelle session avec le résumé** (ADR-0030, raison `turn-limit`,
  le même message renvoyé à la session neuve avec l'échange d'avant).
- [x] Refusé de nouveau juste après une réouverture : seule « Nouvelle session avec le résumé »
  reste (pas de boucle).
- [x] Après `max_turn_requests`, la file d'attente attend l'utilisateur (comme après un arrêt).
- [x] Une fois répondu, la carte dit ce qui a été choisi ; un message envoyé après elle (ou une
  nouvelle carte) lui retire ses boutons. Résumé de tour (`TurnSummary`) : toujours une fin
  anormale, sans résumé.
- [x] Textes en français et en anglais ; export, pilote (`etat`) lisent la carte.
- [x] Testé contre l'agent factice : scénarios `limite-etapes-session` (comme Bob 2.0.9) et
  `limite-etapes-tenace` (limite jamais remise à zéro) ; tests unitaires (réducteur, hôte : file,
  réouverture, repli) ; suite e2e `limite-etapes` (clair et sombre).
- [x] **Trace réelle** de Bob (faite le 2026-11-09, voir le journal) : `session.maxTurns: 2` posé un moment dans
  les réglages de Bob par l'utilisateur, puis un tour qui l'atteint, « Continuer » (refus attendu
  en quelques ms, sans mise à jour), « Rouvrir la session et continuer » (remise à zéro attendue
  après relance + `session/load`). Journal en mode Trace ; `agents.log` à joindre à la fiche.

## Plan

Maquette validée par l'utilisateur (carte calquée sur `CostCapCard`).

1. **Agent factice** (`scenarios-limites.mts`, `agent.mts`, `main.mts`) : option
   `--max-etapes N` (défaut 3, `MOCK_AGENT_MAX_ETAPES`) ; compteur d'étapes **par session**, en
   mémoire du processus (`limite-etapes-session`) ou enregistré avec la session
   (`limite-etapes-tenace`). Chaque étape compte ; à N, le message en cours est coupé et le tour
   finit en `max_turn_requests`. Ensuite : refus immédiat, sans aucune mise à jour (le message
   reste dans l'historique rejoué). Un message qui contient « continue » ne demande que deux
   étapes (fin normale si le compteur est neuf).
2. **Fil** (`shared/turn-limit.ts`, `transcript.ts`) : élément `turn-limit` (`refused`, `reopen`,
   `answer`, `superseded`) posé à la place de l'avis ; évènement `turn-limit-answer` ; `turn-end`
   porte `limit` (vu par le main). Export : une ligne.
3. **Hôte** (`agent/turn-limit.ts`, `agent-host.ts`) : mises à jour comptées pendant le tour ;
   `resumeQueue` faux après `max_turn_requests` ; `reopenAfterTurnLimit()` (arrêt, relance, même
   session, renvoi par le mécanisme de D10) et `renewAfterTurnLimit()` (session neuve, repère
   `handover` raison `turn-limit`, renvoi avec l'échange d'avant).
4. **Main** (`conversations/turn-limit.ts`, `manager.ts`, `ipc.ts`, preload) : canal
   `conversation:answerTurnLimit` qui vérifie la carte puis agit.
5. **Interface** (`TurnLimitCard.tsx`, `Transcript.tsx`, `turn-controls.ts`, `useTurnGuards.ts`,
   `turn-guards.css`, `fr.json`/`en.json`) ; bascule « Nouvelle session » : libellé de la raison.
6. **Docs** : `docs/mock-agent.md`, `docs/acp.md` (Compatibilité Bob), ADR-0030 (raison
   ajoutée), `CHANGELOG.md` / `CHANGELOG.en.md`, `e2e/catalog.mjs`.

Aucune nouvelle dépendance.

## Journal

- 2026-11-09 — Fiche créée d'après le diagnostic de l'essai du 2026-11-08 et la maquette validée.
- 2026-11-09 — Fait (sauf la trace réelle, à la recette) :
  - Agent factice : `limite-etapes.mts` (compte d'étapes, refus avant toute mise à jour, message
    coupé dans la langue de l'agent), `--max-etapes`, scénarios dans `scenarios-limites.mts`.
  - Fil : `shared/turn-limit.ts`, élément `turn-limit`, évènement `turn-limit-answer`, `turn-end`
    porte `limit`. La réponse en texte à la compaction est sortie dans `shared/compaction-reply.ts`
    (taille de `transcript.ts`, fiche 089).
  - Hôte : `agent/turn-limit.ts` (`TurnLimitWatch`). Le « travail » de l'agent = texte, réflexion,
    outil, plan ; `usage_update`, commandes, titre et mode ne comptent pas (un refus pourrait les
    envoyer). `AgentHost.afterTurnLimit('reopen' | 'renew')` réutilise le renvoi de D10
    (`restartWith`, aussi pour `retrySession`) ; refusé pendant une réponse ou une préparation.
  - Main : `conversations/turn-limit.ts`, canal `conversation:answerTurnLimit` (classé « change le
    profil » dans `read-only-guard.ts`).
  - Interface : `TurnLimitCard.tsx` (styles de la carte du plafond), `TurnSummary` (fin anormale),
    repère de session neuve (`renewDetailTurnLimit`), export, pilote (`turnLimit`, alerte
    bloquante `limite`).
  - Essais : `turn-limit.test.ts` (partagé, main), `agent-host-turn-limit.test.ts`,
    `mock-agent.test.ts`, `TurnGuards.test.tsx`, `pilote.test.mjs` ; e2e `limite-etapes` (clair et
    sombre, rejeu tardif comme Bob).
  - **Écarts** : « votre message » au lieu de « ton message » de la maquette (l'app vouvoie
    partout). « Continuer » envoie `CONTINUE_PROMPT` du plafond de coût (« Continue là où tu t'es
    arrêté. »), pour un seul message fixe dans l'app — il est en français, contrairement à
    ADR-0014 ; à unifier en anglais dans une fiche à part si on le souhaite. Pas d'indication
    propre à Bob (`session.maxTurns`) dans le profil : la carte reste générique. Pas de case dans
    la grille de conformité.
  - Vérifié : `./scripts/verify` vert ; `pnpm build && pnpm e2e --changed` (190 tâches, toutes
    les suites puisque `transcript.ts`, `agent-host.ts`… sont communs) : 189 vertes, `finitions`
    clair en échec une fois (opacité au survol, sans lien), verte rejouée seule (clair et sombre).
  - Reste : trace réelle de Bob (faite ensuite, ci-dessous).
- 2026-11-09 — **Vérifié en réel avec IBM Bob 2.0.9** (`session.maxTurns` mis à 2 un moment, puis
  rétabli ; journal Trace, 0,14 bobcoin ; captures et `agents.log` dans
  `.pilote/sessions/recette-209-limite/`) :
  - Message « lis a.txt, b.txt, c.txt » : deux lectures puis `max_turn_requests` en 4,0 s → carte A
    (« Continuer »).
  - « Continuer » : Bob refuse en **6 ms**, aucune mise à jour, `max_turn_requests` → carte B.
  - « Rouvrir la session et continuer » : nouveau processus `bob acp`, `session/load` en 268 ms, le
    message renvoyé une fois ; Bob lit c.txt, `end_turn` en 3,0 s. Pas de bulle utilisateur en
    double. La limite est donc bien comptée sur la session et remise à zéro par relance +
    `session/load`.
  - Trace rejouée : `src/main/agent/__traces__/bob-2.0.9/limite-etapes-session-rouverte.ndjson`
    (reconstituée du journal, voir son README), test dans `trace-replay.test.ts` (cartes A puis B
    vues par `TurnLimitWatch`, fin normale après rechargement ; les deux processus sont dans une
    seule trace, rejouée d'un trait).
  - Scénario factice `limite-etapes-session` comparé à la trace : même suite (arrêt, refus immédiat
    sans mise à jour, remise à zéro par relance + `session/load`), aucun écart de forme ; seule la
    latence diffère. Non modifié.
