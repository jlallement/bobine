# 192 — Gros contenus : diffs d'agent bornés, détail rendu au dépliage, coloration sans redevinette

- **Statut** : fait (relecture du tech lead à venir)
- **Dépend de** : 187 (lot D, risques R3 et R6 partie S), 021 (modifications), 047 (long fil),
  139 (contenus aux limites)
- **Agents** : les deux (et l'agent factice) : rien de propre à un agent

## Pourquoi

Un gros diff venu de l'agent (un `package-lock.json` réécrit) figeait l'interface : 2,8 s pour
ouvrir une conversation qui contient un diff de 5 000 lignes, plus d'une minute pour 20 000 lignes
(R3, score 16). Chaque diff du fil était calculé à l'ouverture, même replié. Et une réponse avec un
bloc de code sans langage refaisait, à chaque morceau, la détection du langage (≈ 140 ms pour 200
lignes) : le streaming saccadait (R6, partie S).

## Critères d'acceptation

- [x] Le calcul d'un diff est borné : lignes communes du début et de la fin écartées, puis au plus
      `MAX_EDIT_LENGTH` (1 000) modifications et 150 ms ; au-delà, le milieu est montré retiré puis
      ajouté en bloc. Le diff reste exact (rien de perdu), testé sur 300 tirages contre jsdiff.
- [x] Le détail d'une carte d'outil (diff, sortie) n'est rendu qu'au premier dépliage, et reste
      rendu ensuite.
- [x] Une conversation ouverte ne reprend pas les cartes dépliées de la précédente (`key`).
- [x] Pas de détection du langage pour le bloc de code encore ouvert d'une réponse en cours ; le
      langage deviné d'un bloc est gardé (cache) ; rendu final identique (test d'équivalence).
- [x] Cache des totaux +/− : les moins récents sortent, plus de remise à zéro à 300 entrées
      (test : 400 modifications, 3 passages, 400 calculs).
- [x] Plafond d'affichage (maquette validée sous réserve par l'expert UX, 8 corrections faites) :
      diff 400 lignes, ou 200 retirées + 200 ajoutées pour un diff simplifié, rangée « ⋯ N lignes …
      de plus · Afficher tout » au style des plages repliées, note « Fichier trop modifié… » ;
      sortie : 500 dernières lignes ou 200 Kio, ouverte en bas, bandeau « N premières lignes
      masquées (taille au total) · Afficher tout · Copier tout » ou « Début masqué ».
- [x] « Afficher tout » par paquets de 2 000 lignes, un par image (« Affichage… x / y ») ; focus
      sur la première ligne nouvelle, total annoncé (`aria-live`) ; au-delà de 50 000 lignes ou
      5 Mio, « Ouvrir dans l'éditeur » (sortie : fichier 0600 au nom tiré au hasard dans
      `<données de l'app>/tool-outputs/`, vidé au démarrage et à la fermeture).
- [x] Pas de « Réduire » (suggestion de l'expert) : refermer la carte et la rouvrir garde ce qui
      a été affiché.
- [x] Nombres au format de la langue : en-tête du diff, pastille du haut, bilan « Terminé »,
      onglets Modifications et Session, sous-tâches, plages repliées.
- [x] Suite e2e `perf` (budgets à large marge) ; mesures avant / après ci-dessous.

## Plan

1. `shared/diff.ts` : `lineRuns` (préfixe et suffixe communs, `diffArrays` borné, repli exact),
   `diffStats` pour les totaux, `simplified` dans le résultat.
2. `shared/changes.ts` : cache des totaux par ancien puis nouveau texte, sortie des moins récents ;
   fichiers créés comptés sans cache.
3. `common/LazyDetails.tsx` dans `ToolCall.tsx` ; `key` du fil par conversation (`App.tsx`,
   `BesidePane.tsx`).
4. `thread/code-language.ts` : deux greffons autour de `rehype-highlight` ; `streaming` passé par
   `Transcript` à la dernière réponse.
5. Banc : `e2e/perf-fixtures.mjs` (profils lourds), scénario factice `code-sans-langage`, suite
   `perf`.

Aucune nouvelle dépendance (`diffArrays` vient de `diff`, déjà là).

## Mesures (suite `perf`, Mac arm64, machine partagée : ordres de grandeur)

| Mesure | Avant (`7b0f830`) | Après |
|---|---|---|
| Ouvrir une conversation, diff de 5 000 lignes replié | 2 799 ms, tâche longue 2 749 ms | 92 ms, aucune tâche longue |
| Ouvrir une conversation, diff de 20 000 lignes replié | **figée > 60 s** (délai dépassé) | 132 ms, tâche longue 56 ms |
| Déplier le diff de 20 000 lignes | — | 965 ms, tâche la plus longue 728 ms (rendu de 40 000 lignes) |
| Fil de 5 000 éléments : nœuds DOM | 380 328 | 101 578 |
| Fil de 5 000 éléments : ouverture | 2 213 ms (tâche 2 066 ms) | 2 062 ms (tâche 1 797 ms) — lot E (fiche 193) |
| Streaming d'un bloc de 200 lignes sans langage sur ce fil | 19 tâches longues, max 194 ms | 3 tâches longues, max 164 ms |

Le reste du coût d'ouverture du long fil relève du lot E (fiche 193).

Après le plafond d'affichage (même suite, même machine) :

| Mesure | Avant le plafond | Après |
|---|---|---|
| Déplier le diff de 20 000 lignes | 868 ms, tâche 645 ms | 40 ms, aucune tâche longue |
| « Afficher tout » 19 800 lignes retirées | — | 1,2 s, plus long arrêt de la boucle 167 ms |
| « Afficher tout » sortie de 40 000 lignes | — | 0,45 s, plus long arrêt 52 ms |

Captures réelles avant / après (`7b0f830` contre cette branche, clair et sombre) :
`nuit-0-11/perf/avant-192-*.png` et `apres-192-*.png` des notes partagées (script
`captures-192.mjs` à côté).

Limite connue : une remarque de relecture posée sur une ligne masquée par le plafond n'apparaît
qu'après « Afficher tout ».

## Journal

- 2026-11-07 — Banc d'abord (`e2e/perf-fixtures.mjs`, suite `perf`) : mesures avant ci-dessus.
  Calcul borné, totaux en cache, détail au dépliage, coloration. Trouvé en mesurant : le fil
  n'était pas remonté d'une conversation à l'autre, une carte dépliée (et son diff) restait dépliée
  dans la conversation suivante au même rang : `key` par conversation.
- « Plafond de `rawOutput` dans le fil » (fiche 187) : `rawOutput` n'est pas gardé dans le fil, seul
  le texte des sorties (`content`) l'est. Le tronquer à l'enregistrement perdrait du contenu (refusé
  par la consigne) ; le rendu au dépliage enlève déjà son coût à l'ouverture. Un plafond
  d'affichage avec « Afficher tout » est dans la maquette.
- 2026-11-07 — **Essai réel, OpenCode 2.2.5** (modèle gratuit `opencode/big-pickle`, profil jetable,
  5 tours bornés, script `withApp`) : « remplace ancienne par nouvelle » (`replaceAll`) sur un
  fichier de 5 000 lignes → carte terminée, diff non rendu tant que replié, une seule tâche longue
  de 51 ms pendant le tour ; déplié : 10 000 lignes (diff simplifié, ancien puis nouveau), tâche la
  plus longue 224 ms. Puis 4 réponses avec un bloc de code JavaScript sans langage : une tâche
  longue de 60 ms en tout. Le modèle gratuit par défaut (« Iceman Free ») répondait « Model is
  unavailable » ce soir-là : choisi `big-pickle` par `OPENCODE_CONFIG_CONTENT`.
- 2026-11-07 — Maquette « Afficher tout » validée sous réserve par l'expert UX
  (`nuit-0-11/perf/VERDICT-expert-ux.md`) : les 8 corrections faites (plafond par bloc d'un diff
  simplifié, style des plages repliées, texte de la note, rendu par paquets et plafond dur, plafond
  en caractères, sortie ouverte en bas, focus et annonce, nombres localisés), plus « Pas de
  Réduire ». Pas de nouvelle dépendance. **Essai réel OpenCode 2.2.5** (`big-pickle`, 2 tours) :
  diff de 5 000 lignes plafonné (200 + 200, deux rangées, la note), « Afficher tout » → 5 000
  lignes, une seule tâche longue de 51 ms ; `seq 1 20000` : OpenCode ne transmet que ses 2 000
  dernières lignes (« full output saved to … » dans la sortie), Bobine en montre 500, bandeau
  « 1 502 premières lignes masquées (11,9 ko au total) ». OpenCode tournait avec son propre dossier
  personnel (pas `--agents-neufs`) ; profil Bobine jetable.
- 2026-11-07 — Suite e2e complète (`--changed`, toutes les suites, `--jobs 2`) : verte sauf
  `browser` (il lisait la sortie d'une carte repliée : il la déplie maintenant, vert) et `filles`
  (instabilité connue sous charge, verte rejouée seule). Le blocage d'Electron de la nuit venait
  d'une alerte macOS de restauration de fenêtres (réglé sur la machine par la session mère).
- 2026-11-07 — **Relecture du tech lead : à corriger**, fait :
  1. Diff déterministe : `maxEditLength` proportionné à la taille (`maxEditLengthFor`, 200 à
     1 000 modifications, budget lignes × modifications de 6·10⁷), délai de 2 s en dernier recours
     seulement ; un total tranché par le délai (`timedOut`, `exact` faux) n'entre jamais dans le
     cache (tests à horloge simulée : 30 000 lignes / 300 modifications ligne à ligne).
  2. Recherche dans le fil : le début masqué d'une sortie qui contient ce qu'on cherche est montré
     depuis sa ligne (`FindQueryContext`) ; e2e « mot du seul début masqué → trouvé ».
  3. Diff trop gros en lignes **ou en caractères** (5 Mio) : « Ouvrir dans l'éditeur » ouvre le diff
     entier (`diffText`, par `editors:openText`), « Copier tout » toujours offert.
  5. `editors:openText` reçoit la conversation : l'éditeur a son dossier comme projet, jamais
     `tool-outputs/` (test).
  6. Cache des totaux borné aussi en caractères (32 M) (test).
  7. Coupure jamais au milieu d'une paire de substitution ni d'une séquence ANSI (`safeCut`) ;
     couleur ANSI en vigueur reprise au début de chaque paquet (`ansiStyleAt`).
  8. Comptes de lignes et d'octets tenus à jour par morceau (`textCounts`), sans réencoder.
  9. Effet du sommaire par référence au fil ; suite `perf` en clair et sombre, et ses sources au
     catalogue. Tests ajoutés : `useEntryWindow`, `HistoryWriter` (échec puis succès, écriture
     synchrone pendant une en cours, conversation supprimée, `cancelPending`), `display-cap`
     (substitutions, ANSI, `\n\n` final, `\r` seul : il ne coupe pas la ligne).
- 2026-11-07 — Après la relecture : `./scripts/verify` vert deux fois de suite (2 660 tests) ; deux
  passages précédents rouges sous une charge de 50 à 60 (d'autres sessions), sur des essais de
  durée sans lien avec ce lot (`manager.test` « boucle d'évènements libre », `children.test`), verts
  rejoués seuls. Suite e2e complète (`--changed`, 166 suites, clair et sombre, dont `perf`) verte.
- 2026-11-07 — Seconde relecture : avec des lignes longues, le plafond en caractères coupait une
  ligne comptée comme montrée ; après « Afficher tout », la première ligne restait cachée et le
  bouton ne faisait plus rien. La ligne coupée compte parmi les masquées, et « Afficher tout » va
  jusqu'au début du texte (test : lignes longues et courtes, sortie entière, bandeau parti).
  Recherche dans le fil : les lignes masquées d'un diff déplié qui contiennent ce qu'on cherche
  sont montrées (jusqu'à la dernière trouvée) ; e2e « ligne 15 000 d'un diff de 20 000 → 1 / 1 ».
  Limite qui demeure : le détail d'une carte repliée n'est pas cherché (comme avant ce lot).
- 2026-11-07 — Troisième passe : la recherche dans le contenu masqué rendait d'un coup tout
  jusqu'à la correspondance, à chaque frappe, même au-delà du plafond dur. Maintenant : recherche
  après la pause de la frappe (150 ms), dévoilement par paquets (`useReveal.revealTo`) jusqu'à la
  ligne trouvée ; au-delà du plafond dur, rien de plus n'est rendu, la rangée ou le bandeau dit
  « Trouvé dans le contenu masqué » à côté d'« Ouvrir dans l'éditeur ». Tests : diff et sortie de
  60 000 lignes, correspondance tout au fond, lignes rendues bornées.
  La recherche du fil se recalcule aussi quand la page change sans que le fil change (contenu
  masqué montré par paquets, carte dépliée pendant la recherche) : `MutationObserver` sur le fil,
  recalcul une fois la page posée (le surlignage ne touche pas au DOM, pas de boucle).
- 2026-11-07 — Recette réelle (défaut D2) : sur un diff de 20 000 lignes, « n° 15000 » était
  trouvé (« 1 / 1 », surligné) mais le cadre du diff (`.diff-table`, 360 px) ne défilait pas
  jusqu'à lui ; seul le fil défilait. Le résultat courant est maintenant amené au centre de chaque
  cadre qui défile autour de lui (diff, sortie bornée), du plus proche au fil, à chaque ↑↓ ; sur
  la largeur, seulement s'il est hors du cadre. Second défaut trouvé en l'écrivant : à une nouvelle
  recherche, le défilement était consommé par les résultats de la précédente, avant le recalcul ;
  il attend maintenant le recalcul. e2e `perf` : la ligne trouvée est à l'écran (dans le cadre et
  dans le fil) pour la sortie et le diff, puis à chaque ↓ et ↑ (« ancienne ligne 1500 », 11
  résultats) ; elle échoue sans le correctif.
