# 236 — Essais e2e : fenêtres sourdes au vrai pointeur, couleurs du mode Plan lues après transition

- **Statut** : en cours
- **Dépend de** : 098 (mode Plan visible), 106 (fenêtres d'essai sans le focus), 115 (e2e en parallèle), 149 (enregistreur d'infobulle), 223 (section Équipe)
- **Agents** : les deux (environnement d'essai et essai de l'app, rien de propre à un agent)

## Pourquoi

Deux échecs e2e intermittents, vus dans les campagnes (fiches 234 et 235) et reproduits ici sous
`taskpolicy -c background`, `pnpm e2e roles-gestion composer` (3 jobs, 4 tâches) :

1. `roles-gestion` (surtout en sombre) : l'infobulle d'une tuile « Équipe » survolée n'apparaît
   jamais (délai dépassé sur « une seule bulle ouverte »). 1 passage sur 5, puis 1 sur 6.
2. `composer` : « mode Plan : bordure et halo… » et « la puce du mode devient une pastille… »
   rouges. 3 passages sur 5, puis 3 sur 6 (clair et sombre).

Aucun utilisateur ne voit de différence : ni l'un ni l'autre n'est un défaut de l'app.

## Causes (prouvées)

### 1. Le vrai pointeur de macOS entre dans la fenêtre d'essai

Enregistreur posé sur la tuile (évènements de pointeur horodatés) au moment de l'échec :

```
pointerover/pointerenter/pointermove @2934 (186,267)   ← survol de l'essai (CDP), centre de la tuile
pointerleave @2952 (754.41796875, 453.41796875)        ← 18 ms plus tard, d'ailleurs
docmove -> TD @6337                                     ← un autre, au même endroit (cellule du fil)
```

Radix avait lancé l'ouverture retardée (400 ms) ; le `pointerleave` l'annule, et l'essai, qui
n'envoie qu'un mouvement, n'en renvoie pas. Les coordonnées fractionnaires ne viennent pas de
l'essai : le vrai curseur de macOS était à (870.41796875, 495.58203125) points d'écran (lu par
`NSEvent.mouseLocation`), soit, fenêtre d'essai en (116, 33) sur un écran de 982 points de haut,
exactement (754.41796875, 453.41796875) dans la page. Le curseur de l'utilisateur, immobile sur la
zone des fenêtres d'essai, y entre quand une fenêtre d'un autre job s'ouvre ou se ferme au-dessus
de lui (les trois jobs empilent leurs fenêtres au même endroit) : macOS envoie alors un
évènement de souris à la fenêtre découverte, et Chromium en tire `pointerleave` sur la tuile. Seul
le sombre tombait (ordre de passage : `roles-gestion` sombre tourne pendant que les autres jobs
ouvrent et ferment leurs fenêtres).

La fiche 149 notait « ni la souris réelle ni une fenêtre d'une autre suite n'atteignent une
fenêtre d'essai » : vrai pour un déplacement de la souris sur une fenêtre inactive, faux pour
une fenêtre qui se découvre sous un curseur immobile.

### 2. Couleurs du mode Plan lues pendant leur transition

La zone de saisie, la puce et la ligne de rappel passent au mode Plan par une transition de
150 ms. L'essai lisait les couleurs 400 ms après le passage (`sleep(400)`), en n'attendant que les
animations du bouton d'envoi. Au moment de l'échec, `document.getAnimations()` montrait les
transitions de `.composer` (bordure, fond, ombre) et de `.mode-chip` encore **en cours, à 0 ms**
(ou 134 ms) : sous charge, la fenêtre ne produit aucune image pendant plus de 400 ms, la
transition n'avance pas, la couleur lue est celle d'avant. 1,5 s plus tard, tout était juste et
les transitions finies. L'app est correcte ; l'essai mesurait trop tôt.

## Critères d'acceptation

- [x] Fenêtres d'essai (`BOBINE_SHOW_INACTIVE=1`) sourdes au vrai pointeur ; l'essai les pilote
      toujours (protocole DevTools, `sendInputEvent`)
- [x] Test unitaire : `showRestored` et `revealWindow` en mode essai ignorent la souris avant de
      montrer la fenêtre
- [x] Mode Plan : couleurs lues une fois les transitions de la zone de saisie finies (attente
      d'une condition, plus de durée fixe)
- [ ] `roles-gestion` et `composer` verts 5 fois de suite sous `taskpolicy -c background`, clair
      et sombre
- [ ] `./scripts/verify` vert, puis `pnpm e2e --changed` vert

## Plan

- `src/main/window-state.ts` : `showForTests` = `setIgnoreMouseEvents(true)` puis
  `showInactive()`, appelé par `showRestored` et `revealWindow` en mode essai (fenêtre principale,
  À propos, Aide, fenêtre rapide). Le réglage tient à travers `hide()`/`showInactive()` (capture
  d'écran, `index.ts`). Types `AboutBrowserWindow`, `HelpBrowserWindow` complétés.
- `src/main/window-state.test.ts`, `about-window.test.ts`, `help-window.test.ts`.
- `e2e/suites/composer.mjs` : `look()` attend qu'aucune animation finie ne tourne dans
  `.composer-dock` ; les `sleep(400)` de `planModeVisible` retirés.
- Aucune nouvelle dépendance. Pas de ligne au CHANGELOG (rien de visible pour l'utilisateur).

## Journal

- 2026-11-17 — Reproduit (avant correctif, `taskpolicy -c background`, 3 jobs) : 3 rouges sur 5
  passages, puis 3 sur 6 avec diagnostics. Sombre seul (2 tâches) : 5 verts sur 5, la charge des
  trois jobs compte. Causes ci-dessus, relevées par diagnostics temporaires (retirés).
