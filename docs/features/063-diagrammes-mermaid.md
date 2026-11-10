# 063 — Diagrammes Mermaid dans le fil

- **Statut** : fait
- **Dépend de** : 003, 040, 052
- **Agents** : les deux (rendu du Markdown, côté interface)

## Pourquoi

Les agents décrivent volontiers une architecture, un enchaînement d'appels ou un planning en
Mermaid (` ```mermaid `). Aujourd'hui l'app affiche le code : il faut le copier ailleurs pour voir
le schéma. Claude dessine ces diagrammes ; Bob Desktop doit le faire aussi, dans le fil, le plan et
l'aperçu des `.md`.

## Critères d'acceptation

- [x] Un bloc ` ```mermaid ` (réponse, plan, aperçu d'un `.md`, réponse d'un sous-agent) est
      dessiné : organigramme, séquence, Gantt, classes, états…, aux couleurs du thème de l'app
      (clair, sombre, Sépia, Nuit noire), redessiné quand le thème change.
- [x] Barre au survol : « Code » ↔ « Diagramme », copier le code, agrandir (le diagramme entier dans une fenêtre).
- [x] Diagramme invalide : le code reste affiché, avec l'erreur de Mermaid en une ligne ; pendant
      le streaming, pas de clignotement (dessin quand le texte se pose, le dernier dessin réussi
      reste affiché).
- [x] Sécurité : `securityLevel: 'strict'` (texte échappé, pas de clics ni de liens actifs),
      SVG nettoyé par Mermaid (DOMPurify) ; aucun changement de CSP.
- [x] Mermaid chargé seulement quand un diagramme apparaît (morceau séparé du bundle).
- [x] Testé : unitaire (détection des blocs, repli sur le code en cas d'erreur, bascule), e2e avec
      l'agent factice (scénario `mermaid` : organigramme, séquence, bloc invalide), captures clair
      / sombre.

## Plan

1. Dépendance **`mermaid` 11.17.2** (MIT), version exacte : la branche 12 est trop récente
   (12.0.0 le 2026-09-10, 12.2.0 le 2026-10-13).
2. `renderer/mermaid-render.ts` (chargé par `import()` dynamique) : `initialize` (strict, thème
   `base` dont les couleurs viennent des variables CSS de l'app), `render` en file, identifiants
   uniques.
3. `components/MermaidBlock.tsx` : source, dessin différé (le texte doit se poser), dernier SVG
   réussi gardé, erreur → code + message, barre (Code / Diagramme, copier, agrandir dans une
   fenêtre Radix), redessin au changement de thème (`prefers-color-scheme`, `data-palette`,
   `data-accent`).
4. `components/Markdown.tsx` : `pre` dont le `code` porte `language-mermaid` → `MermaidBlock`.
5. Agent factice : scénario `mermaid`.
6. Styles ; tests ; e2e `mermaid`.

## Journal

- 2026-10-15 — Fait selon le plan.
  - `mermaid` 11.17.2 (MIT, version exacte). Morceaux séparés, chargés au premier diagramme :
    ≈ 6,7 Mo de JavaScript en plus dans l'app (le code principal, `index`, ne grossit pas).
  - `mermaid-render.ts` : thème `base` aux couleurs de l'app (hexadécimal des variables CSS, sinon
    valeurs claires ou sombres), étiquettes des flèches et groupes sur le fond du cadre (noires
    par défaut en sombre), dessins en file, brouillon de Mermaid retiré après une erreur.
  - `MermaidBlock.tsx` : dessin 0,4 s après le dernier changement du texte ; erreur montrée
    seulement si le texte ne bouge plus depuis 1,1 s (pas de clignotement en streaming) ; barre
    au survol (code ↔ diagramme, agrandir : le diagramme entier dans une fenêtre, copier le
    code) ; redessiné quand le thème, la variante ou l'accent changent.
  - `Markdown.tsx` : `mermaidSource` repère le `code` `language-mermaid` (la coloration ne le
    touche pas) — partout où le Markdown est rendu (fil, plan, aperçu des `.md`, sous-agents).
  - Tests : unitaires (bloc dessiné, bascule, erreur en une ligne, avec un dessin simulé :
    Mermaid ne dessine pas sous jsdom) ; e2e `mermaid` (scénario `mermaid` de l'agent factice :
    chargement à la demande vu par les liens `modulepreload`, organigramme et séquence dessinés,
    bloc invalide, bascule, agrandi). Captures regardées : `m0` (clair, sombre), `m1` (clair,
    sombre).
  - **Essai réel** (OpenCode, 0 bobcoin) : deux diagrammes demandés (organigramme avec retour,
    séquence avec `alt`) : dessinés tous les deux, sans erreur.
