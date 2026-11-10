# 077 — Liste de tâches épinglée au-dessus de la zone de saisie

- **Statut** : fait
- **Dépend de** : 035
- **Agents** : générique — le `plan` ACP (Bob l'envoie à chaque mise à jour de sa liste de tâches,
  fiche 041 ; l'agent factice aussi). OpenCode n'en envoie pas, ni en 1.19 ni en 2 (voir
  « OpenCode ») : rien à épingler avec lui pour l'instant. Rien de propre à un agent dans l'UI.

## Pourquoi

Aujourd'hui, la liste de tâches de l'agent (le `plan` ACP) est une carte « Plan » du fil : placée
là où le premier plan du tour est arrivé, elle remonte avec le fil et disparaît dès que l'agent
écrit ou travaille un peu. Il reste l'onglet « Tâches » du panneau et le compteur « 2 / 5 » de
l'en-tête, qu'il faut aller ouvrir. Claude Code Desktop épingle la liste juste au-dessus de la zone
de saisie pendant que l'agent travaille : on voit toujours où il en est, sans rien ouvrir.

## Maquettes

DOM injecté dans l'app buildée (aucun code produit), agent factice `demo` arrêté sur sa
permission, plan à 1 / 3. Captures dans `e2e/captures/` (clair et sombre) :

| Capture | Ce qu'elle montre |
|---|---|
| `maquette-0-actuel` | Aujourd'hui : carte « Plan » dans le fil, compteur « 1 / 3 » dans l'en-tête |
| `maquette-carte` | Carte séparée au-dessus de la saisie, dépliée ; faites cochées et grisées |
| `maquette-carte-barree` | Même chose, tâches faites barrées (comme aujourd'hui) |
| `maquette-tiroir` | Tiroir accroché au haut de la zone de saisie, un peu plus étroit, fond `--surface-2` |
| `maquette-repliee` | Repliée : une ligne, tâche en cours et « 1 / 3 » |
| `maquette-fin-reduite` | Fin du tour : réduite à « 3 tâches faites · 3 / 3 », carte du fil revenue |
| `maquette-fin-masquee` | Fin du tour : plus rien d'épinglé, carte du fil à sa place (état actuel) |

Communs à toutes les variantes : à faire = cercle pointillé (`CircleDashed`), en cours = cercle qui
tourne en couleur d'accent (`LoaderCircle`), texte un peu plus appuyé ; faites = coche verte
(`CircleCheck`). Repliable d'un clic sur l'en-tête (« Tâches 1 / 3 »). Dans l'esprit de Claude
Code Desktop ; ses détails exacts n'ont pas été relevés.

## OpenCode (relevé le 2026-10-16)

OpenCode 1.19.0 n'envoie **jamais** de `plan` par ACP : lecture de son code (les `sessionUpdate`
qu'il émet : textes, réflexion, `tool_call`, `tool_call_update`, commandes, réglages, consommation),
puis essai réel (`opencode acp`, modèle gratuit `opencode/big-pickle`, données dans des dossiers
`XDG_*` jetables, consigne : deux appels à `todowrite`). Sa liste de tâches arrive comme un appel
d'outil ordinaire, sans autorisation demandée :

- `tool_call` : `title: "todowrite"`, `kind: "other"`, `status: "pending"`, `rawInput: {}` ;
- `tool_call_update` `in_progress` : `rawInput.todos` = liste complète
  `[{ content, status, priority }]` ;
- `tool_call_update` `completed` : `title: "N todos"` (N = tâches pas encore faites), la même liste
  en JSON dans `content` et `rawOutput.output`, et en objet dans `rawOutput.metadata.todos`.

Statuts d'OpenCode : `pending`, `in_progress`, `completed`, `cancelled` (ce dernier absent d'ACP) ;
priorités `high` / `medium` / `low` (comme ACP).

Un adaptateur côté main pourrait en faire un `plan` du fil (comme pour les sous-agents, fiches 010
et 053), mais il ne servirait qu'à OpenCode 1 : **abandonné**, voir ci-dessous.

**OpenCode 2** (relevé le 2026-10-16, lecture du code de la version 2.0.31, pas d'essai réel) :
sortie en parallèle de la 1.19 (journal des versions V2 du 2.0.26 du 8 octobre au 2.0.30 du
15 octobre), installée par `opencode upgrade --major` ou son installeur, qui remplace le binaire
de la 1 (même commande `opencode`). Depuis la 1.19, OpenCode ne se met plus à jour tout seul :
c'est pourquoi la machine de développement est restée en 1.19.0. Son ACP est réécrit
(`packages/cli/src/acp`) et n'envoie toujours pas de `plan` ; ses outils n'ont plus de
`todowrite` (lecture, écriture, modification, patch, recherche, shell, web, compétences,
sous-agent, question, ressources MCP…). Le reste de ce qu'il change pour Bobine (sous-agents,
questions, configuration) relève d'une fiche de compatibilité à part.

Suivi : une sonde `pnpm opencode-probe` (sur le modèle de `pnpm bob-probe`, modèle gratuit) dira le
jour où OpenCode envoie un `plan` ; elle relève de la fiche de compatibilité OpenCode 2. Rien à
faire côté app ce jour-là : la liste épinglée est générique.

## Choix validés (2026-10-17)

Soumis avec leurs options et une recommandation ; l'utilisateur a pris les quatre recommandations.

1. **Forme** : carte séparée juste au-dessus de la zone de saisie, dépliée (`maquette-carte`).
   Écartés : tiroir accroché à la zone de saisie, ligne repliée par défaut.
2. **Tâches faites** : coche verte, texte grisé, **non barré** — partout (liste épinglée, carte du
   fil, onglet « Tâches »). Écarté : barré (comme avant).
3. **Fin du tour** : la liste épinglée disparaît ; la carte du fil garde la trace, y compris des
   tâches restées à faire (arrêt, erreur). Écartés : réduite à « 3 / 3 », dépliée jusqu'au message
   suivant.
4. **Doublons** : pendant le tour, la carte « Plan » du fil et le compteur « 1 / 3 » de l'en-tête
   sont masqués ; tous deux reviennent à la fin du tour.

Défauts, sans question : liste longue limitée à environ sept lignes, avec défilement interne qui
garde la tâche en cours visible ; état replié retenu d'une conversation à l'autre (stockage du
navigateur, comme le panneau) ; même liste dans la conversation ouverte à côté (`BesidePane`) ;
flèche « Aller en bas » au-dessus de la liste.

## Critères d'acceptation

- [x] Pendant un tour où l'agent a envoyé un `plan`, la liste est épinglée juste au-dessus de la
      zone de saisie et ne défile pas avec le fil ; elle suit chaque mise à jour du plan.
- [x] À faire : cercle pointillé ; en cours : cercle qui tourne (accent, arrêté si l'animation est
      réduite), texte appuyé ; faites : coche verte, texte grisé non barré.
- [x] Un clic sur l'en-tête (« Tâches 1 / 3 ») la replie sur une ligne (tâche en cours et
      « 1 / 3 ») ; l'état replié est retenu.
- [x] Pendant le tour : pas de carte « Plan » de ce tour dans le fil, pas de compteur dans
      l'en-tête. À la fin du tour : plus de liste épinglée, la carte et le compteur reviennent.
- [x] Plan d'un tour précédent : rien d'épinglé.
- [x] Même comportement dans la conversation ouverte à côté.
- [x] Textes en français et en anglais (glossaire : « tâches » → « tasks »).
- [x] Testé : unitaires (plan du tour, tâche en cours, rendu) ; e2e contre l'agent factice
      (scénario `demo`, arrêté sur sa permission avec un plan à 1 / 3), clair et sombre, `--lang en`.

## Plan

1. `PlanList.tsx` : `turnPlan(items)` (dernier `plan` après le dernier message de l'utilisateur),
   `currentEntry(entries)` (en cours, sinon la prochaine à faire, sinon la dernière faite) ; icônes
   `CircleDashed` / `CircleDot` (ou `LoaderCircle` qui tourne quand la liste est « en direct ») /
   `CircleCheck`, `aria-current` sur la tâche en cours.
2. `PinnedPlan.tsx` : la carte (en-tête bouton `aria-expanded`, liste limitée en hauteur, ligne
   repliée), état replié dans `localStorage` (`bobine.pinnedPlan`).
3. `Transcript` : propriété `hiddenPlanId` (carte du fil masquée pendant le tour).
4. `App.tsx` : liste dans le `thread-dock` avant la zone de saisie quand l'agent travaille et que le
   tour a un plan ; compteur de l'en-tête masqué pendant ce temps. `BesidePane.tsx` : idem.
5. `styles.css` : carte, en-tête, ligne repliée, rotation (coupée si `prefers-reduced-motion`),
   tâches faites non barrées.
6. Clés `pinnedPlan.*` dans `fr.json` et `en.json`.
7. Tests : `PlanList.test.ts(x)`, `PinnedPlan.test.tsx`, `Transcript.test.tsx` ; suite e2e
   `pinned-plan` (pendant le tour, replié, fil remonté, fin du tour) ; suite `panel` inchangée.

Aucune nouvelle dépendance (icônes `lucide-react` déjà là).

## Journal

- 2026-10-16 — Fiche créée, maquettes capturées (script jetable hors dépôt), choix soumis.
- 2026-10-16 — OpenCode 1.19.0 vérifié (code puis essai réel, modèle gratuit) : pas de `plan`,
  liste de tâches dans l'outil `todowrite`. Adaptateur et sonde de suivi proposés.
- 2026-10-16 — OpenCode 2 (code de la 2.0.31) : pas de `plan` non plus, plus de `todowrite`.
  Adaptateur abandonné ; sonde renvoyée à une fiche de compatibilité OpenCode 2 (fiche 078, qui
  l'a confirmé par un essai réel et ajouté `pnpm opencode-probe`).
- 2026-10-17 — Choix validés (les quatre recommandations) ; plan écrit.
- 2026-10-17 — Livré, selon le plan :
  - `PlanList.tsx` : `turnPlan`, `pinnedPlanOf`, `currentEntry`, `PlanIcon` ; icônes
    `CircleDashed` / `CircleDot` / `CircleCheck`, `LoaderCircle` qui tourne (classe `spin`) dans la
    liste épinglée seulement — la carte du fil et l'onglet restent immobiles, le tour fini ;
    `aria-current="step"` sur la tâche en cours, qui est aussi un peu plus appuyée partout.
  - `PinnedPlan.tsx` : carte (région « Tâches de l'agent »), en-tête bouton `aria-expanded`,
    progression lue « 1 / 3 tâches faites » par les lecteurs d'écran, corps limité à 188 px qui
    garde la tâche en cours visible, état replié dans `localStorage` (`bobine.pinnedPlan.collapsed`).
  - `Transcript` (`hiddenPlanId`), `App.tsx` (thread-dock, compteur de l'en-tête), `BesidePane.tsx`.
  - Clés `pinnedPlan.title` / `pinnedPlan.label` (fr, en).
  - Tests : `PinnedPlan.test.tsx` (plan du tour, épinglage, tâche montrée repliée, rendu, état
    retenu, carte masquée du fil) ; suite e2e `pinned-plan` (captures `100-taches-epinglees`,
    `101-taches-repliees`, `102-taches-fin-du-tour`), clair, sombre et `--lang en`, avec la
    conversation à côté ; suite `panel` repassée.
  - Écarts : la liste et la zone de saisie avaient la même `key` (id de la conversation) : React
    dupliquait la carte à chaque mise à jour (vu à la première capture e2e) ; clé `tasks-<id>`. La
    suite `panel` comparait deux textes en français en dur (échec en `--lang en`) : passés par `L()`.
- 2026-10-17 — **Essai avec Bob 2.0.6** (liste de trois étapes, puis planche contact) : liste
  épinglée dès la première mise à jour, passée de 0 / 3 à 3 / 3 en direct, tâche en cours qui
  tourne ; disparue à la fin du tour, carte « Plan » revenue dans le fil. Chaque mise à jour a
  demandé l'autorisation « Updating todo list », comme prévu (« Always allow » la retient).
