# 193 — Longs fils : ouverture par la fin, une écriture du fil à la fois

- **Statut** : fait (relecture du tech lead à venir)
- **Dépend de** : 187 (lot E, risques R6 et R19), 192 (lot D), 047 (long fil), 086 (recherche
  dans le fil), 173 (sommaire)
- **Agents** : les deux (et l'agent factice) : rien de propre à un agent

## Pourquoi

Un fil de 5 000 éléments s'ouvrait en 2,2 s, dont une tâche de 2 s d'un seul tenant, avec 380 000
nœuds dans la page et 1,6 Go pour l'app (R6). Et pendant une réponse, un long fil pouvait s'écrire
plusieurs fois en même temps sur le disque : une écriture plus lente que la seconde chevauchait la
suivante (R19).

## Critères d'acceptation

- [x] Un long fil s'ouvre par la fin : seuls les 120 derniers éléments sont rendus, les précédents
      page par page quand on remonte, sans déplacer ce qu'on lit (e2e : position conservée à ±1 px,
      mesuré 0 px).
- [x] La recherche dans le fil voit tout le fil (tout est rendu quand elle s'ouvre).
- [x] Le sommaire amène à un message pas encore rendu ; « Aller en bas » reste juste.
- [x] Export, copie, modifications et totaux : inchangés (ils lisent le fil, pas la page).
- [x] Une seule écriture asynchrone d'un fil à la fois ; les demandes pendant ce temps n'en font
      qu'une, avec le fil le plus récent (test unitaire avec une écriture lente).
- [x] Suite e2e `perf` : budgets à large marge, plus le nombre de nœuds (déterministe).
- [x] Essai réel avec OpenCode (gros diff, 5 tours) : voir le journal. Un vrai fil de
      milliers d'éléments n'a pas été joué avec un vrai modèle (coût, durée) : agent factice seulement.

## Plan

1. `thread/useEntryWindow.ts` : premier élément rendu (par identifiant, stable quand le fil
   grandit), repère invisible en haut observé (`IntersectionObserver`, 2 000 px d'avance), une
   page de 120 de plus par rappel ; tout rendu si `complete` ; jusqu'à un élément si `reveal`.
2. `Transcript.tsx` : la fenêtre sur les entrées ; `complete` (recherche ouverte), `reveal`
   (sommaire) ; `useThreadScroll.ts` : `reveal.go` lâche le suivi du bas et ne vaut que pour la
   conversation où on l'a demandé.
3. `ConversationOutline.tsx` : message rendu, défilement comme avant ; sinon `onGo`. Message lu
   au-dessus du premier rendu : celui d'avant lui.
4. `history-writer.ts` : écriture en attente par fil, relancée à la fin de celle en cours.
5. Suite `perf` : ouverture par la fin, ancrage, remontée jusqu'au début, sommaire, « Aller en
   bas », recherche.

Aucune nouvelle dépendance : pas de bibliothèque de liste fenêtrée (pas d'ADR).

## Écarts au plan de la fiche 187

- **`content-visibility` : non fait.** Mesuré à l'ouverture du long fil, avant ce lot : script
  2 352 ms, style 134 ms, mise en page 101 ms. `content-visibility` n'agit que sur le style, la
  mise en page et le dessin (≈ 10 %), et ses effets de bord (contenu rogné par l'isolement du
  dessin, menus et infobulles qui débordent) ne valaient pas ce gain. C'est le rendu React
  (Markdown de chaque réponse, cartes) qu'il fallait éviter : d'où l'ouverture par la fin.
- **Pas de liste fenêtrée qui retire ce qui sort de l'écran.** La fenêtre ne fait que grandir vers
  le haut : simple, sans hauteur estimée ni saut au défilement. Un fil remonté jusqu'au début est
  entièrement rendu, comme avant (mais page par page, sans longue tâche de plus de 90 ms).
- **IPC paginé : non fait.** Mesuré : un fil de 50 Mo (1 250 diffs de 20 Kio) arrive du main en
  20 ms (copie structurée des chaînes), 8 à 13 ms pour le fil de 5 000 éléments. La pagination
  aurait demandé de réduire les évènements de l'agent sur un fil partiel : beaucoup de risque pour
  rien de mesurable.
- **Index retardé : non fait.** Mesuré : l'index de 2 000 conversations (709 Kio) s'écrit en 6 à
  15 ms, quelques fois par tour, pas à chaque morceau. Le retarder obligeait chaque lecteur de
  `index.json` sur le disque (sauvegarde, réinitialisation) à forcer l'écriture d'abord.

## Mesures (suite `perf`, Mac arm64, machine partagée : ordres de grandeur)

| Fil de 5 000 éléments | Avant (`7b0f830`) | Après (192 + 193) |
|---|---|---|
| Ouverture jusqu'à la dernière réponse | 2 213 ms | 378 à 410 ms |
| Tâche la plus longue à l'ouverture | 2 066 ms | 169 à 197 ms |
| Script / style / mise en page à l'ouverture | 2 352 / 134 / 101 ms | 186 / 5 / 4 ms |
| Nœuds du document | 380 328 | 3 569 |
| Tas JS du renderer | 307 Mo | 125 Mo |
| Remonter jusqu'au début (tout rendre) | — | 2,6 à 3,2 s, tâches ≤ 90 ms |
| Streaming d'un bloc de 200 lignes sans langage | 19 tâches > 50 ms, max 194 ms | 1 à 3, max 82 à 144 ms |

Fil de 50 Mo (diffs de 20 Kio) : ouverture 249 ms, tâche la plus longue 108 ms.

Limites connues : ouvrir la recherche dans un fil de 5 000 éléments, ou aller par le sommaire à
son tout premier message, rend tout le fil d'un coup (≈ 2 s, comme l'ouverture d'avant). Ce sont
des gestes explicites ; à reprendre si l'essai réel le montre gênant.

## Journal

- 2026-11-07 — Mesures d'abord (suite `perf` de la fiche 192, avec métriques de script, style et
  mise en page) : le coût était le script. Ouverture par la fin, puis vérifications fonctionnelles
  dans `perf`. Trouvé en écrivant l'essai du sommaire : le suivi du bas (`ResizeObserver`)
  ramenait en bas juste après avoir rendu le message visé ; `reveal.go` lâche ce suivi. Le message
  visé ne vaut que pour sa conversation (sinon la suivante s'ouvrait sur le même numéro).
- 2026-11-07 — **Essai réel, OpenCode 2.2.5** (modèle gratuit `opencode/big-pickle`, profil jetable,
  5 tours bornés, script `withApp`) : « remplace ancienne par nouvelle » (`replaceAll`) sur un
  fichier de 5 000 lignes → carte terminée, diff non rendu tant que replié, une seule tâche longue
  de 51 ms pendant le tour ; déplié : 10 000 lignes (diff simplifié, ancien puis nouveau), tâche la
  plus longue 224 ms. Puis 4 réponses avec un bloc de code JavaScript sans langage : une tâche
  longue de 60 ms en tout. Le modèle gratuit par défaut (« Iceman Free ») répondait « Model is
  unavailable » ce soir-là : choisi `big-pickle` par `OPENCODE_CONFIG_CONTENT`.
- 2026-11-07 — Relecture du tech lead (point 4) : tout en haut (`scrollTop` à 0, Origine),
  Chromium n'ancre pas le défilement ; `useEntryWindow` mesure avant d'ajouter une page et décale
  lui-même si rien n'a bougé. e2e : position conservée à 0 px, à 1 500 px comme à 0. Tests
  unitaires de `useEntryWindow` (fil vide puis arrivée, recherche, élément dans un groupe d'outils,
  identifiants non contigus, fil raccourci, conversation suivante).
