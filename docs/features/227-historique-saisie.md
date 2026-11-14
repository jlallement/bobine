# 227 — Historique de la saisie : rappeler un message envoyé (↑ / ↓)

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 020 (file d'attente), 026 (brouillons), 089 (touches de la saisie), 191 (astuces),
  223 (rôles), 224 (espace Discussion)
- **Agents** : les deux — rien de propre à un agent : l'historique est tenu par Bobine, côté main,
  avec la conversation (ADR-0011).

## Pourquoi

Relancer une demande, la corriger d'un mot, renvoyer « continue » : dans un terminal, ↑ le fait.
Dans Bobine, il fallait retaper ou copier depuis le fil — qui ne garde ni le texte tapé d'une
commande « / » (la consigne développée d'une commande personnelle part à l'agent) ni les messages
partis à un rôle (ils vont dans une fille).

Maquettes validées par l'utilisateur : `maquettes-historique/01-historique.html` (6 planches,
variante A de l'indicateur retenue).

## Comportement

- **Priorité de ↑** : composition IME → menu `@` ou « / » ouvert → message en attente (fiche 020,
  inchangé) → historique.
- **Entrée** : ↑ seulement dans une saisie vide (ni texte, ni jeton de rôle, ni pièce jointe), ou
  sur un message repris non modifié. 10/10 est le dernier envoyé ; ↑ sur 1/10 ne fait rien (pas de
  boucle) ; historique vide : rien. Une conversation neuve n'a pas d'historique : jamais celui
  d'une autre conversation.
- **Lignes d'abord** : dans un message repris de plusieurs lignes, ↑/↓ déplacent le curseur ligne
  par ligne (lignes **affichées** : une ligne repliée compte pour plusieurs). Seulement depuis la
  première ligne, ↑ passe au message précédent ; depuis la dernière, ↓ au suivant. ↓ après 10/10
  rend la saisie vide.
- **Curseur à l'arrivée** : par ↑, en fin de **première** ligne (champ remonté en haut) ; par ↓,
  en fin de texte. Message d'une ligne : fin du texte dans les deux cas.
- **Échap** quitte l'historique et vide la saisie, avant « arrêter la réponse » ; un second Échap
  arrête l'agent comme aujourd'hui.
- **Modification** : une frappe, un collage ou un effacement (texte ou jeton) font du message un
  brouillon ordinaire : la pastille disparaît, ↑/↓ ne changent plus de message, même en ligne 1.
  Déplacer le curseur ou cliquer ne compte pas.
- **Ce qui revient** : le texte tel que tapé (la commande « /revue src/panier », jamais la consigne
  développée d'une commande personnelle) et les jetons `@rôle`, avec leur ligne « Partira à… ».
  Pièces jointes, images et pièces « collé » ne reviennent pas : une ligne atténuée « N pièces
  jointes non reprises ». Les menus `@` et « / » ne s'ouvrent pas d'eux-mêmes. Rôle supprimé
  depuis : « @Libellé » en texte simple, en tête du message.
- **Portée** : par conversation, filles comprises (l'historique d'une fille commence par sa
  consigne) ; conversations de l'espace Discussion aussi ; la saisie rapide (`QuickEntry`) n'en a
  pas. 100 entrées au plus, doublons consécutifs fusionnés. Les commandes de l'app (`/clear`,
  `/context`…) n'y entrent pas : ce ne sont pas des messages.
- **Stockage** : avec la conversation, dans son fil sur le disque (`sentHistory`, à côté de
  `items`), écrit par le main (évènement d'app `sent-recorded`) ; le renderer le dit par l'IPC
  typé (`conversation:recordSent`) et le relit avec le fil. Jamais déduit du fil. Il part
  avec la conversation à la corbeille, en revient avec elle, est effacé avec elle, et avec
  « Recommencer à neuf » (tout le dossier `conversations`).
- **Indicateur** (variante A) : pastille « 9/10 · ↑↓ · Échap vider » posée sur le bord haut de la
  saisie, à droite : elle ne recouvre jamais le texte et ne déplace rien. Annoncée poliment
  (`aria-live`) seulement quand la position change.
- **Rappel** : « ↑ Messages précédents » dans la saisie vide, avec le focus, quand l'historique
  n'est pas vide et qu'aucun message n'attend ; il s'efface pour de bon après 3 utilisations
  (compteur gardé avec les astuces, fiche 191 ; « Tout réafficher » le rend), et suit le réglage
  « Astuces de Bobine ».

## Critères d'acceptation

- [x] ↑ dans une saisie vide reprend le dernier message envoyé de cette conversation, pastille
      « n/N » ; ↑ sur 1/N ne fait rien ; ↓ après N/N rend la saisie vide.
- [x] Priorités : IME, menus, message en attente passent avant l'historique.
- [x] Lignes d'abord, lignes affichées comptées (repli compris) ; curseur à l'arrivée comme dit.
- [x] Échap vide la saisie et quitte l'historique avant d'arrêter la réponse.
- [x] Une modification fait un brouillon : plus de pastille, plus de navigation.
- [x] Jetons de rôle repris (ligne « Partira à… »), pièces jointes signalées, commande tapée
      reprise telle quelle, menus fermés.
- [x] Historique par conversation (fille : sa consigne), 100 au plus, doublons consécutifs
      fusionnés, gardé au redémarrage, supprimé avec la conversation et la corbeille.
- [x] Rappel « ↑ Messages précédents », effacé après 3 utilisations.
- [x] Textes fr/en, rien en dur.
- [x] Testé contre l'agent factice (suite e2e `historique-saisie`, clair et sombre, fr et en).

## Plan

1. **Partagé** — `src/shared/sent-history.ts` : `SentEntry` (texte, rôles `{ name, label }`,
   nombre de pièces jointes), `addSentEntry` (vide ignoré, doublon consécutif fusionné, 100 au
   plus), `parseSentEntry` / `parseSentHistory` (ce qui vient du renderer ou du disque est vérifié).
   `TranscriptState.sentHistory` ; l'évènement `reset` (rejeu de session) le garde comme `usage`.
2. **Main** — canal `conversation:recordSent` (écriture) dans `conversations/sent-history-ipc.ts` :
   l'entrée vérifiée part dans le fil par `manager.post` (évènement d'app `sent-recorded`, réduit
   par `reduceTranscript`, écrit comme le fil, renvoyé au renderer comme tout évènement) ; la
   fille enregistre sa consigne à son lancement (`children.ts`). Corbeille, restauration,
   effacement, réinitialisation : rien à faire, l'historique est dans le fichier du fil (essais).
3. **Astuces** — `TipsState.hintUses` (`history` : nombre d'utilisations, 3 au plus), compté par
   `tips:record('history', 'used')`, remis à zéro par « Tout réafficher » ; `Tips.hint` /
   `hintUsed`.
4. **Touches** — `composer-keys.ts` : état `history` (nombre, position, première / dernière ligne
   affichée, entrée possible), actions `history-move` et `history-exit`. `visual-lines.ts` :
   ligne affichée du curseur par un miroir du `textarea` (mesure injectable, essais sans mise en
   page) et fin de la première ligne affichée.
5. **Interface** — `useSentHistory.ts` (liste lue du fil, ajout optimiste, parcours,
   modification → brouillon), `useComposerHistory.ts` (rappel, envoi, rappel discret),
   `SentHistory.tsx` (pastille, annonce, rappel, pièces jointes non reprises) ; `Composer.tsx`
   branche le tout (la gestion des touches sort dans `composer-key-down.ts`, le bas de la saisie
   dans `ComposerBelow`, pour rester sous les seuils de taille et de complexité) ; `useRoleCompose` : jetons remplacés au rappel, envoi aux rôles
   signalé (`onSent`). CSS dans `styles.css` (jetons du thème, clair et sombre).
6. **Essais** — unitaires : touches (priorités, lignes, bornes, Échap), lignes affichées (repli
   simulé), historique partagé (doublons, plafond, validation), manager (par conversation, fille,
   corbeille, effacement), astuces (compteur). e2e `historique-saisie` (clair, sombre ; fr, en).
7. **Clore** — fiche, index, CHANGELOG fr/en.

Aucune nouvelle dépendance.

## Journal

- 2026-11-14 : fiche et plan.
- 2026-11-14 : fait, en trois commits (stockage côté main, saisie, e2e et clôture).
  - Écarts au plan : pas de canal de lecture (`conversation:sentHistory`) ni de méthodes du
    gestionnaire : `manager.ts` est à son plafond de lignes ; l'historique passe par un évènement
    d'app (`sent-recorded`) comme le plafond de coût, et le renderer le lit dans le fil qu'il a
    déjà (`transcript.sentHistory`). Pas de canal `tips:hintUsed` : `src/shared/ipc.ts` est à
    800 lignes ; `tips:record` accepte un rappel avec l'action `used`. `transcript.ts` aussi à
    son plafond : ce que le fil garde au rejeu et l'ajout d'une entrée sont dans
    `transcript-kept.ts`.
  - Ajout optimiste : ↑ juste après un envoi trouvait encore l'ancienne liste (l'évènement du
    main arrive un peu après) — vu par l'e2e ; la liste locale prend le message tout de suite.
  - Écarts aux maquettes : un rôle supprimé revient en « @Libellé » (pas « @nom ») ; la ligne
    « N pièces jointes non reprises » reste après une modification, jusqu'à ce que la saisie
    soit vide (la maquette ne dit rien) ; le rappel suit aussi le réglage « Astuces de Bobine ».
    La pastille peut chevaucher la languette d'une astuce (fiche 191) si les deux paraissent en
    même temps (aparté pendant une réponse, contexte presque plein) : cas rare, laissé tel quel.
  - Essais e2e : `ui.arrow` (flèche avec son code de touche, geste natif du curseur) ajouté à
    `e2e/lib.mjs`, sans toucher `press`.
- 2026-11-14 : `./scripts/verify` vert ; e2e `historique-saisie composer queue roles-travail`
  (clair et sombre) vertes en français et en anglais (`--lang en`) ; captures
  `e2e/captures/historique-{1-rappel,2-jeton-role,3-plusieurs-lignes,4-modification}-{light,dark}.png`
  (et `en-…`) comparées aux planches 1 à 5 des maquettes.
