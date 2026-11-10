# 128 — Activité lisible pendant un tour, « Sans serif » / « Serif », message de commit coupé au mot (C14)

- **Statut** : fait (essai à la vraie souris à faire par la coordination)
- **Dépend de** : 107 (libellés d'outils), 125 (titres d'outils), 122 (états des cartes), 110 / 123
  (message de commit proposé), 070 (police des réponses), 126 (finitions)
- **Agents** : les deux. Le constat vient d'OpenCode (outil « patch » annoncé `pending` avec
  `rawInput: {}`, puis rien pendant que le modèle écrit le patch), mais la règle est générique ACP :
  elle ne lit que `kind`, `status`, `locations`, `rawInput` et l'autorisation en attente, rien de
  propre à un agent (ADR-0011). Bob envoie sa carte complète d'un coup : il n'est pas touché.

## Pourquoi

Relevé du journal de recette (23/10) : OpenCode annonce un outil « patch » en `pending`, puis se tait
38,7 s pendant que le modèle écrit le patch, et tout arrive en 4 ms à la fin. Bobine aggrave l'attente :

- sans cible, `toolLabel` ne produit rien et la carte, le résumé de groupe et l'indicateur affichent
  « patch », un mot qui ne dit rien à l'utilisateur ;
- le chronomètre de l'indicateur compte la durée du **tour** depuis son message, alors qu'il se lit
  comme la durée de l'étape en cours (« 38 s » = le patch, alors que le tour dure 2 min 10).

À côté, trois finitions : le vocabulaire « Sans empattements » / « À empattements » (le terme de
l'écosystème est « sans serif » / « serif »), et le message de commit proposé qui s'arrête sur un
article (C14), ainsi que la contradiction de `architecture.md` sur la vue Git.

La planche de maquettes (section « Ce que fait l'agent pendant un tour ») est validée telle quelle.

## Critères d'acceptation

- [x] Un outil `pending`, sans cible et sans autorisation en attente, est libellé d'après son genre :
      « Prépare une modification… », « …une commande… », « …une lecture… », « …une recherche… »,
      sinon « Prépare un outil… ». Le titre brut passe en infobulle. Pendant toute l'attente, ni la
      carte, ni le résumé de groupe, ni l'indicateur n'affichent « patch ».
- [x] Un outil sans cible interrompu, en échec ou refusé garde le nom de son genre :
      « Modification · interrompu » (C6).
- [x] L'indicateur d'activité compte l'étape en cours : le temps repart de zéro à chaque nouvel
      élément d'activité (outil, texte, réflexion). La durée du tour est en infobulle (« Tour commencé
      il y a 2 min 10 »). Une seule ligne d'état, aucun chronomètre par carte.
- [x] La sortie d'un outil `execute` qui est du JSON valide est affichée indentée, avec de vrais
      retours à la ligne dans les chaînes (D6).
- [x] « Sans empattements » devient « Sans serif », « À empattements » devient « Serif » (réglage de
      la police des réponses, aide comprise) ; « empattements » reste un synonyme caché de la
      recherche dans les réglages.
- [x] Le message de commit proposé reprend le titre coupé à une limite de mot, sans finir sur un mot
      outil (article, préposition…), avec « … » (C14).
- [x] `architecture.md` ne se contredit plus sur la vue Git.
- [x] Testé contre l'agent factice (scénarios `outil-en-preparation`,
      `outil-en-preparation-interrompu`, `shell-en-preparation`).

## Plan

Fichiers touchés (plus de 3, d'où ce plan) :

1. **Libellés** — `src/shared/tool-label.ts` : `LabelledTool` gagne `status?` et `permission?` ;
   `toolLabel` rend le libellé du genre pour un outil `pending` sans cible ni autorisation en
   attente (clés `toolCall.label.preparing.*`), et le nom du genre (`toolCall.label.kindName.*`) pour
   un outil sans cible interrompu / en échec / refusé. Le titre brut est le `detail` (infobulle).
   Un `execute` dont le titre est une commande (plusieurs mots) garde son titre : c'est la cible.
   `src/shared/activity.ts` et `ToolCall.tsx` passent `status` et `permission` ; `ToolGroup.tsx`
   passe par `toolText`, donc suit. `attention.ts` n'a ni statut ni accord : inchangé.
2. **Chronomètre** — `activity.ts` : `activityStamp(items, workspace)` = clé de l'étape en cours
   (id du dernier élément d'activité, son statut) ; `WorkingIndicator.tsx` remet son départ à zéro
   quand la clé change ; la durée du tour est dans `title`. Clé i18n `activity.turnStarted`.
3. **JSON d'`execute`** — `src/shared/` (petite fonction `prettyJson`) + `ToolCall.tsx` : une sortie
   texte d'`execute` qui est un objet ou un tableau JSON valide s'affiche indentée, en `<pre>`.
4. **Agent factice** — scénarios `outil-en-preparation` (`pending {}` 3 s, `in_progress` avec
   `locations`, `completed`), `outil-en-preparation-interrompu` (reste en préparation jusqu'à
   Échap), `shell-en-preparation` (`shell` qui n'a que `{cwd}`) dans `scenarios.mts` ; documentés
   dans `docs/mock-agent.md`. Étapes existantes (`update`, `pause`), rien de nouveau dans le moteur.
5. **Vocabulaire** — `fr.json` (`font.sans`, `font.serif`, `font.hint`, synonyme caché), glossaire
   `docs/traduction.md`, commentaires de `preferences.ts`, `e2e/suites/settings.mjs` ; `pnpm i18n`
   (types générés) si le dépôt le demande.
6. **C14** — `commitSubject` (`src/shared/worktree-cycle.ts`) : coupe au mot, retire les mots outils
   finaux, ajoute « … » ; tests mis à jour.
7. **Doc** — `docs/architecture.md` (vue Git), index des fiches, `CHANGELOG.md` et `CHANGELOG.en.md`.
8. **Tests** — unitaires (libellés, clé d'étape, JSON, coupe), catalogue de l'agent factice, nouvelle
   suite e2e `activity` (clair et sombre, captures regardées) + `settings`.

Aucune nouvelle dépendance. Aucun ADR (pas de choix structurant).

## Essai à la souris (à faire par la coordination)

À vérifier à la vraie souris, avec OpenCode (modèle gratuit) puis l'agent factice :

- OpenCode : demander une modification de plusieurs fichiers. Pendant l'écriture du patch, la carte
  dit « Prépare une modification… » (jamais « patch »), l'indicateur aussi, le temps de l'indicateur
  est celui de l'étape ; survoler le temps montre « Tour commencé il y a … ».
- Agent factice : `/scenario outil-en-preparation`, puis `/scenario outil-en-preparation-interrompu`
  et Échap : la carte dit « Modification · interrompu ». `/scenario shell-en-preparation` :
  « Prépare une commande… », puis la commande.
- Réglages › Apparence : la police des réponses propose « Sans serif » / « Serif » ; chercher
  « empattements » dans la recherche des réglages trouve toujours la ligne.
- Vue Modifications, « Committer » : le message proposé pour un titre long ne finit pas sur
  « à une » mais sur un mot plein, suivi de « … ».
- Une sortie de commande `execute` en JSON (par exemple `Promise.allSettled`) s'affiche indentée.

## Journal

- 2026-10-23 — Fiche créée (plan). Lot de la vague 1 de `docs/feuille-de-route-2026-10-23.md`.
- 2026-10-23 — Fait.
  - **Libellés** : `toolLabel` = `targetLabel` (inchangé) puis `untargetedLabel` (nouveau). Clés
    `toolCall.label.preparing.*` et `toolCall.label.kindName.*`. `ToolCall`, `activity.ts` et
    `ToolGroup` passent par `toolLabel` / `toolText` et reçoivent `status` et `permission` de la
    carte sans changement de code ; `attention.ts` (notification d'autorisation) n'en a pas besoin.
  - **Chronomètre** : `currentStepId` (dernier élément texte / réflexion / outil du tour) ; le départ
    de l'étape est gardé par conversation comme celui du tour. Un texte qui s'allonge reste la même
    étape ; le passage `pending` → `in_progress` d'un même outil aussi.
  - **JSON** : `shared/json-output.ts` (`prettyJsonOutput`, sérialiseur maison pour de vrais retours
    à la ligne), appliqué aux sorties texte d'`execute` dans `ToolCall`.
  - **C14** : `commitSubject` coupe à un mot entier, retire les mots outils finaux (articles,
    prépositions, conjonctions, français et anglais) et ajoute « … ».
  - **Agent factice** : trois scénarios avec les étapes existantes (`update`, `pause`), aucun
    nouveau type d'étape ; `outil-en-preparation-interrompu` exclu du test de catalogue (il attend
    Échap) et testé à part. Suite e2e `activity` (clair, sombre, français, anglais).
  - **Écarts au plan** : « refusé » compte comme « interrompu » et « en échec » pour le nom du
    genre (même défaut C6, même remède) ; un `execute` titré d'une commande (plusieurs mots) garde
    son titre en préparation, parce que chez les agents qui titrent leurs cartes de la commande
    (Bob) c'est la cible. `architecture.md` : la contradiction venait du mot « vue Git » pour deux
    choses ; l'onglet « Git » de la fiche 037 est retiré, la bascule « Git » de « Modifications »
    reste, dit.
  - **Vérifié** : `./scripts/verify` vert ; `pnpm e2e --changed` vert (quelques suites — `handover`,
    `about`, `questions`, `simulator` — ont expiré une fois sous la charge de sessions parallèles,
    vertes en les rejouant seules) ; captures `128-*` regardées en clair et en sombre.
  - **Reste** : l'essai à la vraie souris (ci-dessus). Tour reconstitué en revenant sur une
    conversation : le temps de l'étape repart de zéro si l'étape a changé pendant l'absence (on ne
    garde que ce qu'on a vu), alors que celui du tour est gardé.
