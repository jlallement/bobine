# 292 — « Consommé » : un seul total juste

- **Statut** : fait (1.2)
- **Dépend de** : 130, 245, 266, 285
- **Agents** : les deux — rien de propre à un agent : le total additionne ce que chaque agent
  communique de ses tours (`usage` de la réponse à `session/prompt`, coût cumulé), comme le
  journal de consommation.

## Pourquoi

Sur la carte du Tour de table, la ligne « Consommé » ne se recoupe avec rien : elle ne compte pas
les mêmes jetons que le reste de l'app, et son détail au survol oublie la synthèse. Le texte d'aide
sous « gratuit » parle encore de facturation. Décision de l'utilisateur (2026-11-26) : **« Un seul
total juste »**, sans coûts détaillés ni coûts ajoutés ailleurs dans l'app.

## Trace réelle

Journal de l'évaluation « Bricole » (`bricole-evaluation/journal.md`, OpenCode 2.3.0 réel) :

- Séance 4, 01:50 (1.2.0-beta.2) : « Consommé en tout : 813k jetons · coût inconnu » pour une
  question d'une phrase à 2 participants, alors que Mon activité ne bouge que de ≈ 0,1 M « jetons
  traités » (+9 M « relus en cache ») : **la ligne compte les jetons relus en cache**, que l'app
  met à part partout ailleurs depuis la fiche 245 (« Jetons traités » = entrée + sortie).
- Séance 5, 08:49 (1.2.0-beta.2, modèles gratuits) : « Consommé : 81k jetons · gratuit » ; détail
  au survol « Beam Free : 23,1k jetons · gratuit / Hy4 flash Free : 27,6k jetons · gratuit » :
  **le détail ne liste que les participants** (50,7k), les ≈ 30k de la synthèse (dont 27,5k relus en
  cache) n'y sont pas, « le total 81k ne se recoupe pas ».
- Séance 5, 08:50 : après « Demander à OpenCode de l'appliquer », le total reste 81k : le tour
  d'« Appliquer » n'y entre pas ; il est compté dans la conversation.
- Séance 5, 08:47 : sous « gratuit », l'aide du compteur de la conversation reste « Montant annoncé
  par OpenCode d'après ses tarifs : ce qui est facturé peut différer (abonnement, remises). »

Lecture du code (branche `1.2`, 1f43ea58) : le total de la carte (`roundtableTotal`) additionne
bien participants, synthèse et décision, mais en **`total`** des agents (entrée + sortie + cache +
réflexion chez OpenCode ; + réflexion chez l'agent factice) ; Mon activité et le compteur de la
conversation additionnent **entrée + sortie** (`processedTokens`). L'écart vient de là, pas d'un
oubli de la synthèse dans le total ; l'oubli est dans le détail au survol.

## Règle retenue

**« Consommé » = les jetons traités (entrée + sortie) et le coût de la synthèse et de la
décision, plus tout ce qu'ont consommé les conversations des participants : leur avis, leur
réplique, et ce que vous leur demandez ensuite si vous ouvrez leur conversation. « Demander à … de
l'appliquer » et vos messages dans la conversation du tour de table restent hors du total (comptés
avec la conversation : compteur de la saisie, Mon activité).**

Décision du tech lead (2026-11-26, T7 du testeur) : un participant compte avec toute sa
conversation, assumé. Ne compter que ses tours du tour de table demanderait un relevé par place dans
le main (coût tardif de Bob compris) : une demi-journée et un nouveau mécanisme pour un chiffre
secondaire, refusé pour garder les coûts simples. Essai qui tient la règle :
`roundtables-consomme.test.ts` (« un message dans la conversation d'un participant entre dans le
total »).

Pourquoi « Appliquer » reste dehors : c'est déjà le comportement du code (le relevé de l'étape se
clôt au message suivant, `steps.ts`), il est confirmé en recette (séance 5) ; c'est une règle qui se
dit en une phrase (« ce que le tour a demandé de lui-même ») ; l'y faire entrer obligerait à suivre
un message ordinaire comme une étape du tour, alors que l'utilisateur peut aussi bien l'écrire à la
main.

## Critères d'acceptation

- [x] La carte du tour de table a **une seule** ligne « Consommé » (repliée comme dépliée, avant et
      après la réplique) ; la carte « Réplique » n'en a plus.
- [x] Le total est la somme des jetons traités (entrée + sortie) journalisés dans `usage.sqlite`
      pour les participants (avis, réplique), la synthèse et la décision — égalité exacte vérifiée
      sur les données ; il s'affiche en abrégé (« 29,7k jetons »), comme Mon activité et la puce du
      compteur.
- [x] Le coût suit la règle d'aujourd'hui (par unité, sans conversion ; « gratuit » pour un tour
      tout en modèles gratuits, « coût inconnu » pour 0 d'un modèle payant).
- [x] Plus de détail au survol ni au focus (ni infobulle, ni `aria-description`, ni arrêt de
      tabulation) ; le détail reste dans Mon activité, inchangée.
- [x] Aucun coût ajouté ailleurs (onglet Session, autres cartes).
- [x] Sous « gratuit », l'aide du compteur de la conversation dit seulement ce que l'app sait :
      l'agent annonce un coût nul pour un modèle gratuit (`usage.freeHint`, fr et en).
- [x] Testé contre l'agent factice : `roundtables-consomme.test.ts` (agent factice réel, journal de
      consommation branché sur les évènements : total de la carte = jetons traités journalisés,
      avant et après la réplique et la décision ; « Appliquer » hors total) ; e2e `tour-de-table`
      (carte = jetons traités du journal, abrégés comme dans Mon activité, après la synthèse puis après la décision).
- [x] Rouge constaté sur le code d'avant le correctif (noté ci-dessous).

## Plan

1. Essais d'abord (rouges sur `1.2`) :
   - `src/main/roundtable/roundtables-consomme.test.ts` : tour à 2 participants + synthèse, puis
     réplique, décision et « Appliquer », avec l'agent factice ; un `UsageJournal` (base en mémoire)
     suit les évènements du gestionnaire ; le total de la carte (`roundtableTotal`, comme le pied)
     doit égaler la somme des `input + output` des lignes journalisées du tour.
   - `RoundtableCard.test.tsx` : chiffres réels d'OpenCode (`CHILD_TURN` de la fiche 245, cache
     compris dans `totalTokens`) pour deux participants et la synthèse : « Consommé : N jetons
     » (abrégé), N = somme des entrées + sorties ; pas de détail.
   - e2e `tour-de-table` (nominal) : texte de la carte = `window.api.usage.stats` (entrée + sortie)
     après la synthèse, puis après la décision ; une seule ligne « Consommé ».
2. Correctif :
   - `shared/roundtable.ts` : `roundtableTotal` compte `processedTokens` (entrée + sortie) ; le
     compte « sans chiffre » (`silent`, mort depuis la simplification 5) et le `null` des
     participants au travail disparaissent.
   - `roundtable-view.ts` : `totalText` en entier, « jetons traités ».
   - `RoundtableCard.tsx` : `useRoundtableTotal` sans détail ; `UsedLine` réduit à une ligne simple ;
     libellé unique `roundtable.card.used` (suppression de `usedAll`).
   - `RoundtableTurn.tsx` : plus de ligne sur la carte « Réplique ».
   - `roundtable.css` : styles du détail retirés.
   - `UsageMeter.tsx` : aide `usage.freeHint` pour un coût « gratuit ».
   - i18n `fr.json` / `en.json` (+ `fr.generated.d.ts`), glossaire `docs/traduction.md`.
3. Docs : guides fr/en du tour de table, fiche 285 (renvoi), `CHANGELOG.md` / `CHANGELOG.en.md`,
   index.

Aucune dépendance nouvelle.

## Journal
- 2026-11-26 : essais écrits d'abord, **rouges constatés** sur `1.2` (1f43ea58) :
  - `roundtables-consomme.test.ts` (agent factice réel, journal branché) : `expected 10790 to be
    10430` après deux avis et la synthèse : la carte comptait 360 jetons de trop, les 3 × 120 jetons
    de réflexion de l'agent factice inclus dans son `totalTokens`.
  - `RoundtableCard.test.tsx` (chiffres réels d'OpenCode, fiche 245) : reçu « Consommé : 238,5k
    jetons · gratuit », attendu « Consommé : 51 606 jetons traités · gratuit » (le cache compté).
  - e2e `tour-de-table` (clair et sombre, `pnpm build && pnpm e2e tour-de-table`) : 3 échecs par
    thème — après la synthèse `{"journal":17844,"used":["Consommé : 18,3k jetons · ≈ 0,05 $US"]}` ;
    après la réplique et la décision, deux lignes « Consommé en tout : 30,7k jetons · ≈ 0,10 $US »
    (carte du tour et carte « Réplique ») pour 29 692 journalisés ; « Appliquer » : total inchangé
    (307 → 307 en chiffres lus) mais deux lignes. Captures d'avant gardées dans
    `e2e/captures/292-avant/`.
- Constat honnête : le total de la carte **comprenait déjà** la synthèse et la décision ; ce qui
  était faux, c'était l'unité (`total` des agents, cache et réflexion compris) et le détail au survol
  qui, lui, oubliait la synthèse (séance 5). Le correctif porte sur les deux.
- Correctif : `roundtableTotal` prend une seule liste de résumés et additionne `processedTokens`
  (un résumé sans entrée ni sortie ne compte pas de jetons, comme dans Mon activité) ; `silent` et le
  `null` des participants au travail, morts depuis la simplification 5, retirés ; `totalText` écrit
  le nombre en entier (« 51 606 jetons traités ») ; `UsedLine` réduit à une ligne sans infobulle,
  sans `aria-description` ni arrêt de tabulation ; libellé unique « Consommé : … » (clé `usedAll`
  supprimée, clés `roundtable.card.silent_*` mortes supprimées) ; ligne retirée de la carte
  « Réplique » ; styles du détail retirés ; aide `usage.freeHint` sous « gratuit » (« OpenCode
  annonce un coût nul pour ce modèle gratuit. »), essayée dans `UsageMeter.test.tsx`.
- Écarts au plan : aucun sur le fond. Le libellé dit « jetons traités » (vocabulaire de Mon activité
  et du compteur de la conversation) pour que les deux nombres se recoupent à la lecture.
- 2026-11-26 : `git merge 1.2` (1.2.0-rc.1 ; « Prochaine version » gardée en tête des CHANGELOG).
  Après le correctif : `./scripts/verify` → 0 ; `pnpm build` → 0 ; suites nommées (consigne du tech
  lead : pas de `--changed` complet cette nuit) `pnpm e2e tour-de-table tour-de-table-vie
  parcours-tour-de-table usage-board cout-connexion` → 0 (clair partout, sombre pour
  `tour-de-table`, seule de ces suites à vérifier un rendu sombre). Carte après la décision :
  « Consommé : 29 692 jetons traités · ≈ 0,10 $US », égal au journal (29 692 dans le rouge d'avant
  pour le même parcours). Captures d'après : `e2e/captures/292-apres/`. La suite complète reste à
  jouer sur la branche d'intégration.
- 2026-11-26 (relecture du tech lead) : **écart au plan, format abrégé**. Le nombre entier
  (« 29 692 jetons traités ») ne se recoupait avec rien que l'utilisateur voit : Mon activité, la
  puce du compteur et les cartes des tâches filles écrivent les jetons en abrégé
  (`formatTokens(…, true)`), et le propriétaire veut la forme la moins chargée. La carte dit donc
  « Consommé : 29,7k jetons · ≈ 0,10 $US » (« Used: 29.7k tokens · ≈ $0.10 ») ; la mesure reste
  les jetons traités. La justesse au jeton près reste prouvée sur les données
  (`roundtables-consomme.test.ts`) ; l'e2e compare l'affichage au total du journal abrégé.
  « Appliquer » hors total et ligne retirée de la carte « Réplique » : confirmés. Aide sous
  « gratuit » : « {{agent}} annonce un coût nul : modèle gratuit. » (une conversation peut avoir
  utilisé plusieurs modèles gratuits). `costHintKey` rend la clé, traduite par le `t` du composant.
- 2026-11-26, rapport du testeur (11 cas, agent factice réel et journal branché : `scratchpad/
  testeur-292/`) : pied = journal partout, sauf :
  - **T7, message tapé dans la conversation d'un participant après le tour : compté** (10 430 →
    11 710 jetons). **Décision : règle écrite** (voir « Règle retenue ») ; essai qui l'affirme ajouté.
    Analyse d'alors : Cause : un participant compte par le résumé de
    toute sa conversation (`workUsage` → `child.usage`). **Non corrigé, décision demandée** : les
    comptes rendus du travail gardent bien le cumul au moment de l'avis et de la réplique, mais
    jamais le coût relu après coup (Bob) ; les utiliser perdrait le coût du dernier tour de chaque
    participant chez Bob. Corriger à la cause demande un relevé par place dans le main (jetons à la
    fin de chaque tour du participant, coût tardif suivi comme pour la synthèse dans `steps.ts`,
    nouvel évènement du réducteur, conservation au redémarrage, repli pour les anciens tours) :
    estimé à une demi-journée avec ses essais. Retenu : écrire la règle telle qu'elle est.
  - **T8, coût partiel présenté comme complet** : corrigé. Un résumé qui donne ses jetons sans coût,
    alors que d'autres en donnent un, ajoute « + coût inconnu » (`usage.costPartial`, comme le
    compteur de la conversation) ; `RoundtableTotal.partial`. Limite : un participant qui ne
    communique rien du tout (ni jetons ni coût, `--sans-usage`) ne se distingue pas d'une place qui
    n'a pas tourné ; il ne rend pas le total partiel. Rouge d'abord : `roundtable-view.test.ts`
    (« ≈ 0,025 $US » sans mention).
  - **Très petits coûts** : l'arrondi des sommes du tour (`round6`) faisait d'un tour payant sous
    0,0000005 $ un coût nul, lu « coût inconnu » : corrigé localement (arrondi au milliardième,
    `roundCost`), rouge d'abord dans `roundtable-view.test.ts`. **Reste à faire, hors fiche** : un
    coût payant de 0,00002 $ s'écrit « ≈ 0,00 $US » ; c'est `formatCost` (partagé par tout
    l'affichage des coûts de l'app : compteur, Mon activité, cartes), contraire à la règle M12
    (« jamais ≈ 0,00 ») ; non touché ici.
  - **T10 (hors fiche)** : après un modèle refusé puis un autre choisi, l'étiquette de la synthèse
    gardait le modèle refusé. Corrigé dans un commit à part : `resent` du gestionnaire → évènement
    `step-model` du réducteur, qui suit le modèle tant que l'étape est partie. Rouge d'abord :
    `roundtables-step-model.test.ts` (« Factice rapide » au lieu de « Factice précis »).

## Reste à faire

- Un participant qui ne communique ni jetons ni coût ne rend pas le total partiel (il ne se
  distingue pas d'une place qui n'a pas tourné).
- `formatCost` (partagé par tout l'affichage des coûts) écrit « ≈ 0,00 $US » pour un coût payant
  de 0,00002 $, contre la règle M12 (« jamais ≈ 0,00 ») : hors de cette fiche.
