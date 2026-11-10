# ADR-0027 — Jetons de thème en TypeScript, pas de thèmes importables ni d'accent libre

- **Statut** : accepté (validé par Jérôme le 23/10/2026, relecture de la feuille de route)
- **Date** : 2026-10-24

## Contexte

Les couleurs vivaient à trois endroits de `styles.css` (clair et sombre, accents et mode Plan,
Sépia et Nuit noire), plus des valeurs en dur : `github-dark` pour les blocs de code, une sortie de
commande toujours sombre, la palette par défaut de xterm, des couleurs de secours dans Mermaid et
le fond des fenêtres dans le main. Personne ne vérifiait les contrastes : `--muted` était à
4,1:1 en clair et 3,7:1 en Sépia, l'accent orange en texte à 3,7:1, le texte blanc sur l'accent à
2,4 à 3,1:1 en sombre, le jaune du terminal à 1,4:1 sur fond clair. La page Apparence de la
fiche 136 va multiplier les combinaisons (thème clair et thème sombre au choix, accents).

## Décision

- **Source unique `src/shared/themes.ts`**, sans dépendance : teintes de base de chaque palette,
  rôles de l'interface tirés des teintes de la même façon partout, jetons de domaine (code,
  coloration syntaxique, 16 couleurs ANSI). Quatre palettes, quatre accents.
- **CSS généré** : `pnpm themes-css` écrit `src/renderer/src/themes.generated.css` ; un test
  échoue si le fichier n'est pas à jour. Ce qui ne lit pas le CSS (xterm, Mermaid, fond des
  fenêtres) lit `themeTokens()`.
- **Contraste garanti par un test** (`themes.test.ts`) sur chaque palette × accent : 4,5:1 pour le
  texte, 3:1 pour les bordures fortes et les éléments d'interface, 4,5:1 pour le texte posé sur
  l'accent. Une valeur qui échoue ne se publie pas.
- **Pas de thème importable ni d'accent libre** (couleur choisie à la pipette, thème VS Code ou
  iTerm importé) : on ne peut pas garantir le contraste d'une couleur qu'on ne connaît pas. Les
  choix restent une liste fermée, chacune vérifiée.

## Alternatives écartées

- **Variables CSS écrites à la main** (l'existant) — rien ne vérifie le contraste, et le terminal
  ou Mermaid doivent relire le CSS calculé (`getComputedStyle`) avec des valeurs de secours.
- **Thèmes importables (VS Code, iTerm) ou accent libre** — demande courante, mais chaque thème
  importé est une combinaison non vérifiée ; il faudrait corriger ses couleurs à la volée, donc ne
  plus afficher celles de l'utilisateur. Écarté à la relecture de la feuille de route (23/10).
- **Bibliothèque de jetons (Style Dictionary, Theo) ou JSON** — une dépendance et une chaîne de
  génération de plus pour quatre palettes ; le TypeScript donne les types et le test sans rien
  ajouter.
- **Calculer les couleurs (OKLCH, `color-mix`) au lieu de les écrire** — moins de valeurs, mais un
  rendu moins maîtrisé (teintes qui virent en Sépia) ; `color-mix` reste pour les fonds légers dérivés
  (`--plan-soft`, survols).

## Conséquences

- Ajouter une palette ou un accent : des teintes dans `themes.ts`, `pnpm themes-css`, et le test
  dit tout de suite ce qui ne passe pas.
- `styles.css` ne définit plus de couleur de thème ; les rares couleurs en dur qui restent sont
  voulues indépendantes du thème (châssis des appareils, surlignage de la recherche, annotation).
- Les couleurs ont un peu bougé pour passer AA : `--muted`, `--border-strong`, l'accent en clair,
  le texte sur l'accent en sombre (foncé au lieu de blanc).
- À surveiller : une couleur dérivée par `color-mix` dans `styles.css` n'est pas vérifiée par le
  test, sauf `--plan-soft`, que le test recalcule.
