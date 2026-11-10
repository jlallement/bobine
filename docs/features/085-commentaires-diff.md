# 085 — Commenter les modifications ligne par ligne

- **Statut** : fait
- **Dépend de** : 021, 040, 049
- **Agents** : les deux — un message ordinaire envoyé à l'agent, rien de propre à un agent

## Pourquoi

Pour revoir ce que l'agent a modifié, on lit le diff dans l'onglet « Modifications », puis on
réécrit dans un message ce qui ne va pas, en recopiant le fichier et la ligne. Commenter
directement une ligne du diff, puis envoyer toutes les remarques d'un coup, est plus rapide et plus
précis (feuille de route de l'utilisateur, 2026-10-19 ; principe du plan annoté, fiche 040).

## Existant

- **Onglet « Modifications »** (fiches 021, 049) : vue « Conversation » (fichiers modifiés par
  l'agent, chaque modification successive de 1 à n) et vue « Git » (état du dossier depuis le
  dernier commit) ; par fichier : diff dépliable (`DiffView` : numéros ancien / nouveau, ajouts et
  suppressions, contexte replié), annuler la modification, ouvrir, montrer dans le Finder.
- **Diffs dans le fil** : cartes d'outil d'écriture (`ToolCall`), et « Voir ce qui a changé » du
  plan (fiche 040).
- **Plan annoté** (fiche 040) : sélectionner un passage → remarque ; passages surlignés,
  remarques modifiables, gardées par conversation (`plan-notes.ts`, `localStorage`) ; « Envoyer mes
  remarques » envoie un message qui cite chaque passage (`planFeedback`, en français : ce qui va à
  l'agent n'est pas traduit, ADR-0014). Pendant une réponse, un message part dans la file
  (fiche 020).

## Options à trancher

1. **Où commenter** : l'onglet « Modifications » seulement (vues Conversation et Git), ou aussi les
   diffs des cartes du fil.
2. **Choisir les lignes** : « + » au survol d'un numéro de ligne, Maj-clic pour une plage (comme
   GitHub) ; ou sélectionner du texte dans le diff (comme le plan annoté).
3. **Envoyer** : les remarques s'accumulent, un bouton « Envoyer N remarques » les envoie en un
   message ; ou « Envoyer » les met dans la zone de saisie, où l'on complète avant d'envoyer.
4. **Remarques pas encore envoyées** : gardées par conversation d'un lancement à l'autre (comme le
   plan), ou perdues en fermant l'app.

**Décisions de l'utilisateur (2026-10-20)**, toutes comme proposé : onglet « Modifications »
seulement ; « + » sur la ligne, Maj-clic pour une plage ; « Envoyer » envoie directement ;
remarques gardées par conversation jusqu'à l'envoi.

## Critères d'acceptation

- [x] Onglet « Modifications », vues Conversation et Git : « + » au survol de chaque ligne du diff
      (et au clavier) ; Maj-clic sur une autre ligne du même côté : une plage, surlignée.
- [x] Champ de remarque sous la dernière ligne choisie : « Ajouter » (⌘↩), « Annuler » (Échap) ;
      remarques affichées sous leurs lignes, modifiables et supprimables.
- [x] Barre « N remarques » en haut de l'onglet : « Envoyer à l'agent » (un message qui cite pour
      chaque remarque le fichier, la ligne ou la plage — lignes supprimées nommées — et le code),
      « Effacer les remarques ». Après l'envoi, les remarques sont effacées. Pendant une réponse,
      le message part dans la file (fiche 020).
- [x] Remarques gardées par conversation d'un lancement à l'autre (stockage local, 50
      conversations au plus).
- [x] Textes en français et en anglais (« remarque » → « comment », glossaire) ; le message à
      l'agent est en français, comme celui du plan.
- [x] Testé : unitaires (message, stockage) ; e2e `changes` ; essai à la vraie souris.

## Plan

- `src/shared/diff-notes.ts` (+ test) : `DiffNote`, `sameDiff`, `diffFeedback`.
- `src/renderer/src/diff-notes-store.ts` (+ test) : stockage par conversation, `useDiffNotes`.
- `DiffView.tsx` : `annotations` (colonne « + », plage, champ, remarques sous leurs lignes ;
  remarques dont la ligne n'est plus affichée : en fin de diff).
- `ChangesTab.tsx` : remarques de la conversation, barre d'envoi ; `SidePanel` / `App` : envoi par
  `c.send`.
- `styles.css`, `fr.json`, `en.json`, `docs/README.md` ; e2e `changes.mjs`.

## Journal

- 2026-10-20 — Fiche créée : état des lieux et options.
- 2026-10-20 — Fait comme prévu. e2e `changes` : remarque sur une ligne de `src/app.js`, plage par
  Maj-clic validée par ⌘↩, barre « 2 remarques », stockage, suppression de l'une et modification
  de l'autre, envoi (message avec `src/app.js, lignes 2 à 3` et le texte modifié), remarques
  effacées ; capture `74-remarques-diff`. Essai à la vraie
  souris et au vrai clavier (app d'essai, agent factice) : clic sur le « + », saisie, « Ajouter »,
  clic puis Maj-clic pour une plage, ⌘↩, « Envoyer à l'agent » : message dans le fil, barre
  retirée.
  - Le survol n'a pas pu être vérifié à la vraie souris : l'outil déplace le curseur sans émettre
    d'évènement de mouvement (même constat pour le ✕ des onglets, fiche 082). Il l'est par l'e2e
    (« + » visible sous le pointeur, capture `74`).
  - Relevé à l'essai : le champ s'ouvre sous la première ligne cliquée et repousse les suivantes ;
    pour une plage, il faut Maj-cliquer la dernière ligne à sa nouvelle place.
  - Le message de l'utilisateur affiche les blocs de code tels quels (ses messages ne sont pas
    mis en forme) ; l'agent, lui, les lit comme du Markdown.
