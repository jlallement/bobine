# ADR-0005 — Radix UI et Lucide pour l'interface

- **Statut** : accepté
- **Date** : 2026-10-11

## Contexte

La refonte visuelle (fiche 014) remplace les `<select>` natifs et les boutons texte par des menus
déroulants, popovers, info-bulles et boutons-icônes, dans l'esprit de Claude Desktop. Ces composants
doivent être accessibles (clavier, lecteurs d'écran) sans réinventer leur logique.

## Décision

- **Radix UI primitives** (`react-dropdown-menu`, `react-popover`, `react-tooltip`) pour la logique des
  menus et popovers, stylées par notre CSS (pas de thème imposé).
- **Lucide** (`lucide-react`) pour les icônes : SVG embarqués, licence ISC, aucune requête réseau.

## Alternatives écartées

- **Composants maison** — accessibilité et gestion du focus coûteuses à bien faire.
- **shadcn/ui + Tailwind** — ajoute Tailwind et une chaîne de génération ; notre CSS à jetons suffit.
- **MUI / Chakra** — trop lourds et trop « marqués » visuellement pour l'esprit recherché.

## Conséquences

- Trois dépendances Radix + une d'icônes, toutes compatibles React 19.
- Les menus sont rendus dans un portail : les tests de bout en bout les ciblent par `data-testid`.
