# 257 — Jauge de contexte juste après un compactage

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 019 (consommation), 126 / 165 (compaction), 166 (onglet Session, répartition du
  contexte), 232 (OpenCode 2.3.0)
- **Agents** : les deux — règle générique sur `usage_update` et `compaction_update` (ACP) ; Bob
  n'envoie aucun `usage_update` (`docs/acp.md`), il n'a donc pas de jauge et rien ne change pour
  lui (ADR-0011)

## Pourquoi

Exploration OpenCode du 2026-11-19 (`docs/recettes/2026-11-19-exploration-opencode-sol.md`, D2,
reproduit 2 fois) et plainte de l'utilisateur : « je compacte à 57 % et ça reste à 57 % ». Après
`/compact`, la jauge (puce de consommation, Session › Contexte) garde l'ancien total jusqu'au tour
suivant ; seule la répartition bouge (« Messages » chute, « Agent (non détaillé) » absorbe
l'écart). Au tour suivant, « Messages ≈ 0 » s'affiche alors qu'un message vient d'être échangé.

## Séquence réelle (OpenCode 2.3.0, `agents.log` de l'exploration)

Deuxième `/compact`, session `…geVZPiMc`, taille 628 000 :

| Heure (UTC) | Message |
|---|---|
| 19:33:18 | `usage_update 38271/628000`, fin du tour #14 |
| 19:34:31 | `session/prompt #15` (`/compact`), `compaction_update` `in_progress` |
| 19:35:06 | `compaction_update` `completed` (résumé, 6,3 Ko) ; réponse #15 `end_turn` **sans `usage`** ; **aucun `usage_update`** |
| 19:35:20 | tour #16 : `usage_update 11965/628000` |

Premier `/compact` (19:20–19:21) : même forme (`26135` avant, rien après la compaction). La trace
enregistrée `__traces__/opencode-2.3.0/travail-edition-liste-de-taches-compaction.ndjson`
(2026-11-17) montre la même chose : `compaction_update` `completed`, réponse `{ stopReason }` seule.

## Cause

1. `withContext` (`usage.ts`) ne change `context.used` qu'à un `usage_update` ; OpenCode n'en
   envoie aucun après `compaction_update`. `contextBreakdown` affiche donc l'ancien total, et comme
   `contextStart` avance sur la carte de compaction, « Messages » baisse et « Agent » (le reste)
   gonfle d'autant.
2. Au `usage_update` suivant, `used` a nettement baissé (38 271 → 11 965) : la règle de la fiche 166
   (« baisse nette = compaction que l'app n'a pas vue ») pose `contextSince` sur l'élément
   **suivant** le tour, alors que la compaction est déjà repérée par sa carte. Les messages du tour
   qui vient d'avoir lieu sortent du compte : « Messages ≈ 0 ».

## Critères d'acceptation

- [x] Après une compaction finie (`compaction_update` `completed`, ou réponse en texte à la
  commande de compaction), si l'agent n'a pas donné de nouveau `used` depuis son début, le total
  est **estimé** et marqué comme tel (« ≈ ») partout où il s'affiche (puce, détail, Session ›
  Contexte, `/context`), jusqu'au prochain `usage_update`.
- [x] L'estimation ne monte jamais au-dessus de l'ancien total ; « Agent (non détaillé) » garde la
  part qu'il avait au dernier chiffre de l'agent (il ne gonfle pas de la place libérée).
- [x] Au `usage_update` suivant, le chiffre de l'agent remplace l'estimation ; la baisse déjà
  expliquée par une compaction ne déplace plus le début du contexte (plus de « Messages ≈ 0 »).
- [x] Un `usage_update` reçu après le début de la compaction (agent qui le donne) est gardé tel quel :
  pas d'estimation.
- [x] Compaction échouée ou annulée : rien d'estimé.
- [x] Agent sans `usage_update` (Bob) : inchangé, pas de total.
- [x] Testé contre l'agent factice (scénarios `contexte-opencode`, `compaction-opencode`,
  `apres-compaction-opencode`, valeurs de la trace réelle) et en tests unitaires.

## Plan

**Estimation** (dans le réducteur du fil, `transcript.ts`, qui a les éléments et la consommation) :
au dernier chiffre réel, `used` couvre les messages alors dans le contexte et le reste (prompt
système, outils, mémoire…) ; ce reste ne change pas avec un résumé. Donc :
`reste = max(0, used − messages estimés au moment du chiffre)`, puis
`estimé = min(used, reste + messages estimés depuis la compaction)` (résumé compris).

1. `src/shared/usage.ts` : `context` gagne `estimated?: true` (total estimé par l'app) et
   `nextItem?: number` (prochain identifiant du fil à la lecture, pour savoir si un chiffre est
   antérieur à une compaction). `withContext(usage, update, nextItemId, dropExplained)` : un vrai
   chiffre efface `estimated` ; pas de `contextSince` quand la baisse est expliquée ;
   `contextRatio` inchangé.
2. `src/shared/context-estimate.ts` (nouveau, `transcript.ts` est près de sa borne de taille) :
   `estimateAfterCompaction(state, markerId)` et `dropExplained(state)` (estimation en cours, ou
   repère de compaction posé depuis le dernier chiffre).
3. `src/shared/transcript.ts` : `usage_update` → `dropExplained` ; `compaction_update` qui passe à
   `completed` → estimation ; fin d'un tour de compaction répondu en texte (`compactionReply`) →
   estimation.
4. `src/shared/context-breakdown.ts` : `total.estimated` ; `Agent` cohérent (mêmes règles).
5. Interface, sans nouveau composant : « ≈ » devant le pourcentage de la puce, le total du détail
   et de Session › Contexte, et une phrase sous le total (« Estimé après le résumé : {{agent}}
   donnera le chiffre exact au prochain échange »). Clés i18n fr et en. `/context` (app-commands)
   aussi.
6. Agent factice : champs de scénario `withoutUsage` (ni `usage_update` ni `usage` en fin de tour,
   comme OpenCode après `/compact`) et `compactWith` (scénario joué par `/compact` dans une
   session lancée avec ce scénario) ; scénarios rejouant la trace ; `docs/mock-agent.md`.
7. Tests : `context-breakdown.test.ts` (estimation, répartition, baisse expliquée, chiffre reçu
   pendant la compaction, échec, réponse en texte), test d'hôte contre l'agent factice
   (`agent-host-compaction.test.ts`), tests des composants si utile.
8. Docs : `docs/acp.md` (OpenCode 2.3.0, compaction sans `usage_update`), fiche 166 (renvoi),
   CHANGELOG fr/en, index des fiches.

Aucune nouvelle dépendance.

## Ce qui a été fait (écarts au plan)

- `usage.ts` : `ContextFill` (`estimated`, `nextItem`, et en plus du plan `compactedSince` : une
  compaction a fini depuis ce chiffre sans qu'il y ait lieu d'estimer) ; `withContext(…,
  dropExplained)`.
- `context-estimate.ts` (`transcript.ts` est à sa borne de 800 lignes : le réducteur n'y appelle que
  `withUsageUpdate` et `withCompactionDone`) : `estimatedAfterCompaction`, `withCompactionEstimate`,
  `compactionMarker` (début de la compaction : la commande `/compact` du tour, sinon la carte) et
  `dropExplained` (estimation, `compactedSince`, ou carte de compaction en cours ou terminée
  depuis le chiffre — un agent qui chiffre pendant la compaction ne fait plus perdre le résumé).
- **Écart** : `contextStart` ne repart plus que d'une compaction **terminée** (ou d'une passation).
  Avant, la commande `/compact` et une carte encore en cours suffisaient : pendant les 35 s du
  résumé, « Messages » chutait déjà et « Agent » gonflait d'autant, avec l'ancien total ; une
  compaction échouée ou annulée faisait de même sans rien libérer. La réponse en texte d'un agent
  (Bob) devient une carte terminée en fin de tour (`compactionReply`), qui sert de repère.
- `transcript.ts`, `compaction-reply.ts` : estimation à la fin d'une compaction ; `usage_update`
  passe `dropExplained`.
- `context-breakdown.ts` : `total.estimated`, « Libre » estimé avec lui.
- Interface (aucun composant, aucune classe CSS) : `UsageMeter`, `SessionContext`, `/context`.
- Agent factice : `withoutUsage`, `compactWith` ; scénarios `contexte-opencode` (réponse d'un seul
  morceau de ≈ 28 000 jetons : le fil faisait l'essentiel du contexte dans la recette ; découpée en
  mots, elle faisait dépasser 15 s au test du catalogue), `compaction-opencode`,
  `apres-compaction-opencode`.

### Limites connues

- L'estimation repose sur ce que Bobine voit du fil (≈ caractères / 4). Si l'agent garde beaucoup
  d'invisible (réflexion conservée, pièces jointes), le « reste » est surévalué et l'estimation
  descend moins que le vrai chiffre ; elle ne dépasse jamais l'ancien total et reste marquée « ≈ ».
  Sur la recette, le reste valait ≈ 10k et l'agent a annoncé 11 965 au tour suivant.
- Un `usage_update` reçu après la commande `/compact` mais avant la fin du résumé est gardé tel
  quel (rien n'est estimé) : on ne sait pas s'il précède le résumé. Non observé (OpenCode n'en
  envoie pas, Bob n'en envoie jamais).
- Agent qui compacte sur `/compact` sans `compaction_update` ni réponse en texte : pas de carte,
  donc plus de repère (avant, la commande seule en servait). Non observé.

## Tests

- `src/shared/context-estimate.test.ts` : séquence réelle d'OpenCode 2.3.0 (estimation, répartition,
  tour suivant), chiffre reçu pendant la compaction, compaction échouée ou annulée, mise à jour
  `completed` répétée, deux compactions de suite, plafond à l'ancien chiffre, chiffre d'avant la
  fiche, réponse en texte (terminée, annulée), Bob sans total.
- `src/shared/context-breakdown.test.ts` : repère = compaction terminée seulement.
- `src/main/agent/agent-host-compaction.test.ts` : hôte + agent factice (`contexte-opencode`,
  `/compact`, `/scenario apres-compaction-opencode`).
- `UsageMeter.test.tsx`, `SessionTab.test.tsx`, `app-commands.test.ts` : « ≈ » et explication
  seulement pour un total estimé.
- E2e à lancer (non lancées ici) : `usage`, `session`, `commands`, `pendant-tour` (jauge,
  Session › Contexte, `/compact`, « Compacter »).

## Journal

- 2026-11-19 : fiche et plan ; cause confirmée dans `agents.log` (séquences ci-dessus) et la trace
  enregistrée du 2026-11-17. Implémentation, tests, docs (`acp.md`, `mock-agent.md`, renvoi dans
  la fiche 166), CHANGELOG fr/en. `./scripts/verify` vert (code de sortie 0). Fait sans lancer d'e2e
  (consigne) : à lancer avant fusion.
- 2026-11-19 : e2e après fusion du lot 1 (fiches 255 à 259). `session` échouait sur « après
  /compact, Messages baisse (14 → 29) ». Pas une régression : l'aide `tokens` de l'essai lisait le
  texte affiché et n'en gardait que les chiffres, « ≈ 1,4k » devenait 14. Avant la fiche, la ligne
  tombait à ≈ 0 après `/compact` (le défaut corrigé ici) et masquait l'erreur ; elle vaut maintenant
  le résumé et la réponse qui suit (≈ 29), bien moins que ≈ 1,4k. L'aide lit `data-tokens` (valeur
  exacte) ; l'assertion est inchangée.
