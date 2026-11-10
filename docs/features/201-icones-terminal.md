# 201 — Icônes des invites dans le terminal

- **Statut** : fait (captures avant / après à valider par l'utilisateur)
- **Dépend de** : 034 (terminal), 027 et 136 (police du terminal)
- **Agents** : les deux (rien de propre à un agent : le terminal est celui de l'utilisateur)

## Pourquoi

Signalé sur la 0.11.0 : dans le terminal de Bobine, les icônes des invites powerlevel10k,
starship, oh-my-posh… (glyphes « Nerd Font » de la zone privée d'Unicode, U+E000–U+F8FF et
U+F0000 et au-delà) sont des carrés vides. La liste de polices « Automatique » ne cite des Nerd
Fonts que si l'utilisateur en a installé une ; son Terminal ou iTerm les affiche parce qu'il y a
réglé une police, ce que Bobine ne peut pas lire. Bobine doit « juste marcher ».

## Critères d'acceptation

- [x] Les icônes Nerd Font s'affichent **entières** sans police installée (pomme, horloge, bouts
      arrondis et flèches powerline, branche git, dossiers, icône « md » au-delà du plan de base),
      y compris sur un fond coloré de segment d'invite.
- [x] Les lettres restent dans la police choisie (Réglages › Apparence), sinon SF Mono / Menlo :
      la police livrée ne sert qu'aux caractères absents des polices précédentes.
- [x] Une Nerd Font installée par l'utilisateur garde la priorité.
- [x] Invite alignée : une icône avance d'une cellule exactement ; police chargée avant la
      première mesure de xterm.js.
- [x] Hors ligne, dans l'app packagée (archive asar, CSP `default-src 'self'`).
- [x] Licences livrées à côté du fichier et citées dans `THIRD-PARTY-NOTICES.md`.
- [x] Testé : unitaires (pile de polices, chargement) ; e2e `terminal` (clair et sombre) avec une
      vérification mesurée (avance = cellule, encre dans la cellule et l'espace suivant, pas de
      recalage par `letter-spacing`) qui échoue sur la première version ; `e2e:packaged`.

## Police livrée

| | |
|---|---|
| Police | « MesloLGS Nerd Font » Regular (`MesloLGSNerdFont-Regular.ttf`), variante sans « Mono » |
| Projet | [ryanoasis/nerd-fonts](https://github.com/ryanoasis/nerd-fonts), version **v3.5.1** (publiée le 2026-08-21) |
| Source | `https://github.com/ryanoasis/nerd-fonts/releases/download/v3.5.1/Meslo.tar.xz` |
| SHA-256 de l'archive | `6b6624632dc6873dfb7681c3f818e7c01ab601ab707690b6440933bbe57e2b11` (identique au condensé publié par GitHub) |
| SHA-256 du `.ttf` | `f3148b1e05c1dcf86785020d1d144524b9458deaab17505b88ecfe1694543214` |
| Licences | Meslo LG : Apache 2.0, André Berg (`MesloLG-LICENSE.txt`, SHA-256 `e3c320c9…ad07b9`) ; patch Nerd Fonts : MIT, Ryan L McIntyre (`NerdFonts-LICENSE.txt`, tiré de `NerdFontsSymbolsOnly.tar.xz` de la même version, SHA-256 `84a7a98c…d847`) ; jeux d'icônes : licences propres (MIT, Apache 2.0, CC BY 4.0, OFL 1.1…), tableau dans `MesloLGSNerdFont-README.txt` (README de l'archive) |
| Taille | 2,97 Mo (le `.ttf` tel quel), copié par Vite dans `out/renderer/assets/` puis dans `app.asar` |

Téléchargée dans un dossier vide, traitée comme donnée : `file` la reconnaît comme « TrueType Font
data, 18 tables » ; l'archive ne contient que des `.ttf`, `LICENSE.txt` et `README.md`. Seuls le
Regular sans « Mono », les licences et le README entrent au dépôt (dans
`src/renderer/src/assets/fonts/`). Pas de conversion en woff2 : aucun outil installé, et le `.ttf`
gardé octet pour octet se vérifie contre la version publiée. Aucune nouvelle dépendance npm.

## Pourquoi cette police (mesures)

Mesures dans le terminal de l'app (police 12,5 px, cellule de SF Mono 7,53 px = 0,602 em, rangée
18 px), par `measureText` avec la pile de polices du terminal (avance ; encre gauche..droite) :

| Icône | Symbols Nerd Font Mono (1re version) | MesloLGS Nerd Font Mono | **MesloLGS Nerd Font** |
|---|---|---|---|
| pomme U+F179 | 12,50 ; 1,00..11,50 | 7,53 ; 0..7,53 | **7,53 ; 0..8,48** |
| horloge U+F017 | 12,50 ; 0..12,50 | 7,53 ; 0..7,52 | **7,53 ; 0..11,54** |
| branche U+E0A0 | 12,50 ; 3,71..8,79 | 7,53 ; 0,56..6,97 | **7,53 ; 0,89..6,64** |
| dossier U+F07C | 12,50 ; −0,09..12,60 | 7,53 ; −0,05..7,59 | **7,53 ; −0,09..13,10** |
| bout arrondi U+E0B6 | 12,50 ; 5,80..13,25 | 7,53 ; 0,01..7,98 | **7,53 ; 0,01..7,98** |

- **Cause de la coupure (1re version)** : « Symbols Nerd Font Mono » avance de 1 em (12,5 px),
  pas d'une cellule de 0,6 em. Le rendu DOM de xterm.js (xterm 6, sans module WebGL) recale alors
  l'icône par un `letter-spacing` de −4,98 px, dans une `<span>` à part ; le dessin qui déborde
  passe sous le fond de la `<span>` suivante (dessinée après), d'où la pomme et l'horloge à
  moitié, les bouts arrondis rognés. Les glyphes powerline, dessinés pour une cellule de 1 em,
  sont en plus décalés.
- **Variante « Mono » patchée** : tout tient dans une cellule, rien n'est coupé, mais les icônes
  sont petites (dossier de 2 à 3 px de haut).
- **Variante sans « Mono » (retenue)** : avance d'une cellule exactement, icônes ≈ 1,5 lettre qui
  débordent sur l'espace suivant — ce que le README de Nerd Fonts recommande pour les terminaux et
  le rendu d'iTerm / Terminal avec une Nerd Font. Avance = cellule : xterm.js ne recale rien,
  l'icône partage sa `<span>` avec l'espace qui suit, son débordement n'est recouvert par aucun
  fond. Les glyphes powerline sont patchés à la hauteur de Meslo et tombent juste.
- **Écartés** : `size-adjust` sur « Symbols Nerd Font Mono » (réduit aussi la hauteur : flèches
  powerline de 7,6 px dans une rangée de 18) ; le rendu WebGL comme VS Code
  (`@xterm/addon-webgl`, `customGlyphs`, `rescaleOverlappingGlyphs`) : nouvelle dépendance, un
  contexte GPU par terminal à gérer (perte de contexte), et la lecture des rangées par le DOM
  (essais, extrait « Ajouter au message ») à refaire ; disproportionné pour ce défaut.

## Plan

1. `src/renderer/src/terminal-symbols.css` : `@font-face` « Bobine Nerd Font » (nom propre à
   Bobine, pour ne pas masquer une copie installée), `url()` relative résolue par Vite.
2. `appearance.ts` : la famille ajoutée à `TERMINAL_FONTS` juste avant `monospace` (après Menlo) ;
   `loadTerminalSymbols()` (une fois, ne rejette jamais, délai de 1,5 s au plus) et
   `terminalSymbolsSettled()`.
3. `TerminalTab.tsx` : la première instance xterm.js attend la police (le focus demandé aussi).
4. Aperçu de Réglages › Apparence : passe déjà par `terminalFontCss`, rien à faire.
5. Essais : `appearance.test.ts` ; étape « icônes » de la suite e2e `terminal` (capture
   `30-terminal-icones`) ; contrôle dans `e2e/packaged.mjs`.

## Journal

- 2026-11-07 — Première version avec « Symbols Nerd Font Mono » : plus de carrés, mais icônes
  coupées (relecture : pomme et horloge à moitié, bouts arrondis rognés). Cause mesurée et
  vérification e2e ajoutée (voir « Pourquoi cette police »).
- 2026-11-07 — Remplacée par « MesloLGS Nerd Font » (sans « Mono »).
  - **Rendu de xterm.js** : rendu DOM (ni WebGL ni canvas) ; chaque rangée est du texte en
    `<span>`, le repli par caractère du navigateur s'applique. xterm.js garde la largeur mesurée
    de chaque caractère : la police est chargée (`document.fonts.load`) avant la première
    instance ; illisible ou lente, le terminal s'ouvre quand même (carrés comme avant).
  - **Ordre de la pile** : police choisie, Nerd Fonts installées courantes, `ui-monospace`,
    SF Mono, Menlo, police livrée, `monospace`.
  - **Vérification e2e** : pour flèche, branche, dossiers, icône « md », pomme et horloge (sur
    fond coloré) : avance = cellule (±0,05 px), encre ≥ −0,5 px à gauche et ≤ 2 cellules à droite,
    `letter-spacing` de la `<span>` égal à celui de la rangée, icône dans la même `<span>` que
    l'espace suivant. Échoue sur main (police absente) et sur la 1re version (avance 12,5,
    `letter-spacing` −4,98 px, icône seule dans sa `<span>`) ; passe avec MesloLGS Nerd Font.
  - **CSP et paquet** : `default-src 'self'` couvre `font-src` ; contrôle dans
    `pnpm e2e:packaged` (« police des icônes du terminal chargée dans l'app packagée »).
  - **Taille** : +2,97 Mo dans l'app (non compressé dans `app.asar`).
  - **Limites connues** : une icône immédiatement suivie d'un caractère (sans espace) le
    chevauche, comme dans iTerm ; suivie directement d'une cellule d'un autre fond, son débord
    passe sous ce fond. Avec une police choisie dont la cellule n'est pas de ≈ 0,6 em, xterm.js
    recale les icônes et elles peuvent être rognées : installer une Nerd Font de cette famille.
  - **Captures** : avant (main) et après, clair et sombre, `30-terminal-icones-{light,dark}.png`.
    Le shell de la suite e2e lit le `~/.zshrc` de la machine (comportement existant), d'où
    l'invite powerlevel10k sur les captures, qui dépendent donc de la machine.
