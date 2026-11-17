# 235 — Plafond de coût : la relecture de fin de tour n'interrompt plus un tour déjà fini

- **Statut** : fait
- **Dépend de** : 157 (plafond de coût, coût relu hors protocole), 139 (grille de conformité),
  229 (CI Windows)
- **Agents** : les deux (gardien et hôte génériques) ; le défaut ne se voyait qu'avec un coût lu
  hors protocole (`costSource`, Bob aujourd'hui)

## Pourquoi

`verify (Windows)` échouait par intermittence sur la grille de conformité, « Façon Bob » ›
« plafond de coût » (run 44055105143 sur `main` 98d34dd ; semblables sur 1a85128 et 3cf4052) :

```
agent: ["arrêt du tour encore en cours"]
duplicates: ["2 message(s) de l'utilisateur dans le fil, 1 envoyé(s)"]
journey: ["1 carte(s) de plafond"]
```

Mac et Linux verts. Deux causes distinctes, l'une dans l'app, l'autre dans l'essai.

## Cause (prouvée)

Journal du run : premier tour fini à 09:33:04.735 ; la relecture du coût à 1,5 s ne trouve rien
(l'agent factice écrit son coût dans la base 300 ms après sa réponse, bien plus tard sur le runner
Windows chargé) ; le parcours envoie son second message après `settleMs` (1,7 s) ; ce second tour
finit à 09:33:06.871, et **la relecture de fin de tour** trouve le coût : « Plafond de coût
franchi… tour interrompu », dans la même milliseconde que « Tour fini … end_turn ».

1. **Défaut de l'app (tous systèmes).** `AgentHost.runTurn` relisait le coût hors protocole
   (`SessionCost.turnEnded`) juste après `turn-end`, mais avant `afterTurn`, donc l'hôte était
   encore `busy`. Quand cette relecture franchit le plafond, le gardien (`CostCapGuard`) croit un
   tour en cours sans outil : il **interrompt un tour déjà fini**. Conséquences pour
   l'utilisateur : `session/cancel` envoyé à l'agent hors de tout tour, `cancelling` laissé dans
   le fil (persisté), et une carte « Bobine a interrompu la réponse » dont « Continuer » envoie
   « Continue là où tu t'es arrêté. » à un agent qui n'a rien laissé en plan. Atteignable avec
   Bob dès que son coût est déjà dans sa base à la fin du tour (écriture avant la réponse, ou
   écriture en retard du tour précédent). → « arrêt du tour encore en cours ».
2. **Essai qui lisait trop tôt.** Le contrat de l'app (fiche 157) : coût relu à la fin du tour,
   à 1,5 s, puis à 5 s si rien n'a changé. Le parcours envoyait le message « au-delà du plafond »
   après 1,7 s, comme si le coût était toujours connu à 1,5 s. Écriture en retard : l'app ne sait
   pas encore le plafond franchi, le message part (il n'est pas compté comme envoyé par l'essai,
   qui l'attendait retenu) → « 2 message(s)…, 1 envoyé(s) » et « 1 carte(s) ». Ce n'est **pas un
   doublon** dans le fil : deux vrais messages, dont le second n'aurait pas dû partir.

Reproduit sur Mac, à l'identique (les trois écarts du run Windows), en retardant l'écriture du
coût de l'agent factice à 1,8 s (comme le runner chargé) sur `main` 98d34dd. Chaque correctif
seul enlève exactement sa part : hôte seul → reste `duplicates` et `journey` ; parcours seul →
vert à 1,8 s (le second tour n'est plus envoyé avant le coût).

## Correctif

- `agent-host.ts` : la relecture de fin de tour passe dans `afterTurn`, **après** le passage à
  « prêt » et **avant** l'envoi de la file. Un plafond franchi par elle l'est hors d'un tour :
  carte « Plafond atteint », sans interruption (le cas déjà prévu par la fiche 157 : « franchi
  hors d'un tour, coût relu après coup : la carte, sans plus »). Seulement quand l'agent a
  répondu au tour (`stopReason` reçu), comme avant ; pas après un échec d'envoi. Écart au plan :
  `agent-host.ts` est à sa limite de 1 050 lignes (fiche 089), d'où le drapeau tiré de
  `stopReason` plutôt qu'une variable de plus.
- `journeys.ts` (grille de conformité) : avant d'envoyer le message à retenir, le parcours attend
  un état observable — la carte de fin de tour, signe que l'app connaît le coût — dans la limite
  de 8 s de `waitFor`, au-delà de la relecture de 5 s. Aucun délai rallongé, rien de sauté. Écriture
  plus tardive que 5 s : rouge franc « délai dépassé : carte de plafond » (vérifié à 6 s).

## Critères d'acceptation

- [x] Essai qui échoue sans le correctif : `cost-cap.test.ts` › « coût hors protocole déjà écrit
      à la fin du tour… » (coût présent dès la fin du tour : carte non interrompue, pas de
      `cancelling`, pas d'avis d'interruption) — rouge avant (« tour interrompu »), vert après.
- [x] Grille « Façon Bob » › « plafond de coût » verte avec l'écriture retardée à 1,8 s et 4 s.
- [x] 200 passages sous charge sans échec.
- [x] `./scripts/verify` vert.

## Risque restant pour l'utilisateur

Avec Bob, un message envoyé moins de 1,5 s (jusqu'à 5 s si Bob écrit tard) après la fin d'un tour
qui a franchi le plafond part encore : l'app ne peut pas connaître un coût pas encore écrit. Le
plafond est alors constaté au tour suivant (carte à sa fin, ou interruption à la fin d'un outil).
Trou connu de la fiche 157, non élargi ici. Piste : relire le coût juste avant un envoi (lecture
synchrone et bon marché) réduirait la fenêtre à « Bob n'a pas encore écrit ».

## Journal

- 2026-11-17 — Cause trouvée dans le journal du run Windows, reproduite sur Mac (écriture du coût
  retardée), deux correctifs séparés et vérifiés chacun ; essai de non-régression ajouté. Rien de
  propre à Windows dans le correctif ; aucune nouvelle dépendance.
- 2026-11-17 — Sous charge (15 `yes` sur 15 cœurs, vitest en `taskpolicy -c background`) :
  grille « Façon Bob » › « plafond de coût » 200 fois (4 × `--repeats 49`), 200 vertes ; nouvel
  essai de `cost-cap.test.ts` 200 fois, 200 verts. `./scripts/verify` vert.
- 2026-11-17 — `pnpm build && pnpm e2e --changed` : `agent-host.ts` touche toutes les suites
  (208 passages, 18 min) ; 207 vertes, 1 rouge hors sujet : `roles-gestion` sombre, infobulle
  d'une tuile « Équipe » pas rouverte après « pointeur sorti de la ligne » (survol dans la barre
  latérale, sans tour ni coût). Relancée seule 3 fois : 6/6 vertes (clair et sombre). Laissée à
  part, à suivre.
