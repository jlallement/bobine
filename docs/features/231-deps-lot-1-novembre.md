# 231 — Dépendances, lot 1 de novembre : yaml, i18next, lucide, Vite et outillage

- **Statut** : fait (e2e Linux et Windows non lancés en local : la CI les fera)
- **Dépend de** : 169 (lot A précédent), 221 (i18next 27), 222 (jsdom 31), 217 (avis de licence)
- **Agents** : les deux (aucun code propre à un agent)

## Pourquoi

Les correctifs et mineures disponibles au 2026-11-16, hors Electron et SDK ACP. Le lot 2
(`electron`, `@agentclientprotocol/sdk`, minimatch) partira après la fusion de celui-ci : les deux
touchent `package.json` et `pnpm-lock.yaml`.

## Critères d'acceptation

- [x] Les neuf paquets montés aux versions demandées, ni plus ni moins.
- [x] `pnpm format` (Prettier 3.10) : rien à reformater.
- [x] ESLint 10.15 : aucune nouvelle alerte ; aucune règle désactivée, aucun seuil remonté.
- [x] Icônes lucide : aucune icône utilisée supprimée ; celle renommée passée à son nouveau nom.
- [x] Avis de licence régénérés (`pnpm build && pnpm third-party-notices`), `--check` vert.
- [x] `./scripts/verify` vert (code de sortie 0).
- [x] `pnpm build && pnpm e2e --changed` vert, clair et sombre, captures regardées.
- [x] Testé contre l'agent factice : la suite e2e (aucun scénario nouveau, pas de changement de
      comportement attendu).

## Plan

Un commit `build(deps)` pour les montées, un commit par conséquence (icône renommée, avis de
licence). Les styles de version du `package.json` sont gardés : `yaml` et `i18next` restent exacts,
les autres gardent leur `^`.

Hors lot : `electron`, `@agentclientprotocol/sdk`, minimatch (lot 2). Bloqués volontairement :
`typescript` 7 (typescript-eslint exige `<6.1`), `@types/node` 26 (Electron 45 embarque Node 24).

Aucune nouvelle dépendance directe.

## Versions

| Paquet | Avant | Après | Note |
|---|---|---|---|
| `yaml` | 2.9.0 | **2.9.1** | exact ; seule dépendance de production ; livrée |
| `i18next` | 27.0.1 | **27.1.2** | exact ; livrée (interface et main) |
| `lucide-react` | 1.70.0 | **1.73.0** | livrée (interface) ; voir Icônes |
| `vite` | 8.3.6 | 8.3.8 | tire `rolldown` 1.2.16 → 1.2.19 (livré : runtime du bundle) |
| `@vitejs/plugin-react` | 6.2.1 | 6.3.0 | |
| `jsdom` | 31.0.0 | 31.0.1 | essais seulement |
| `typescript-eslint` | 8.72.1 | 8.72.2 | accepte toujours `typescript <6.1.0` |
| `eslint` | 10.14.0 | 10.15.0 | aucune nouvelle alerte |
| `prettier` | 3.9.10 | 3.10.1 | aucun fichier reformaté |

Plus récents que demandé, laissés : `typescript-eslint` 8.73.0 et `i18next` 27.1.3, tous deux
publiés le 2026-11-16 (le jour même, sous le délai `minimumReleaseAge` de pnpm). À reprendre au
prochain lot.

### Ce que le verrou ajoute en transitif

- **`minimatch` 11.0.8** (+ `@isaacs/nonrecursive-glob-match` 1.1.0, BlueOak-1.0.0) : tirés par
  `@eslint/config-array` 0.23.6, dépendance d'ESLint 10.15. Outillage seulement, rien de livré.
  Ce n'est pas la montée de minimatch du lot 2 : les copies existantes (3.1.5, 5.1.9, 9.0.9,
  10.2.6, d'electron-builder et de typescript-eslint) sont inchangées.
- **`@rolldown/binding-wasm32-wasi` 1.2.19** et ses dépendances (`@napi-rs/wasm-runtime`,
  `@emnapi/*`, `@tybys/wasm-util`) : binaire de repli optionnel de rolldown (`cpu: [wasm32]`),
  inscrit au verrou mais pas installé sur macOS.

## Icônes

Les 155 imports de `lucide-react` du renderer (176 icônes, plus les types `LucideIcon` et
`LucideProps`) comparés à la 1.73.0 :

- aucune icône manquante, aucune marquée `@deprecated` ;
- **`SquareArrowOutUpRight` renommée `SquareArrowUpRightExit`** dans la 1.73 (l'ancien nom n'est plus
  qu'un alias, même dessin) : passée au nouveau nom dans `ChangesList.tsx` et `OpenInEditor.tsx`,
  comme la fiche 169 l'avait fait pour les renommages précédents ;
- **`CircleHelp` et `MessageCircleQuestion` redessinées** : le point d'interrogation a un nouveau
  tracé (`M9 9.5a3 2.5 0 016 0c0 2-2 2-3 3.5`), même taille et même place. Visible dans les captures
  (aide, cartes de question).

Méthode : le dessin (`__iconNode`) de chaque icône importée, sans son en-tête de licence, comparé
entre `lucide-react` 1.70.0 (`npm pack`, hors du dépôt) et 1.73.0.

## Journal

- 2026-11-16 : fiche créée ; lot monté en trois commits.
  - `pnpm format` : aucun changement, donc pas de commit `style:`.
  - ESLint 10.15 / typescript-eslint 8.72.2 : `pnpm lint` vert sans rien toucher.
  - Avis de licence : seules les lignes de version de `i18next`, `lucide-react`, `rolldown`,
    `vite` et `yaml` changent ; `pnpm third-party-notices --check` vert. Le script écrit
    `inventory.json` sans le format de Prettier (tableaux dépliés) : passé par
    `prettier --write` avant le commit, sans quoi `pnpm lint` aurait échoué. Défaut préexistant,
    non corrigé ici (hors lot).
  - `./scripts/verify` : code de sortie 0 (498 fichiers, 4632 essais, 3 sautés).
  - `pnpm build && pnpm e2e --changed` : `package.json` et le verrou sélectionnent toute la suite ;
    208/208 vertes du premier coup, clair et sombre, sans relance (16 min 29 s, 3 suites en
    parallèle, machine partagée avec d'autres sessions). Captures regardées pour les icônes
    touchées : `156-ouvrir-dans-editeur` (`SquareArrowUpRightExit` après `src/app.ts:3`),
    `10-questions` (`MessageCircleQuestion` de la carte, `CircleHelp` de la barre latérale),
    `156-reglage-editeur` : rendu normal, rien de cassé.
  - **Non vérifié ici** : les e2e sous Linux et Windows (CI : `verify` bloquant sur les trois
    systèmes à la poussée ; e2e Linux à chaque poussée sur `main`), et l'app packagée
    (`pnpm package`, `pnpm e2e:packaged`), que ce lot ne demandait pas.
  - **Au prochain lot** : `typescript-eslint` 8.73.0 et `i18next` 27.1.3 (publiées le 2026-11-16).
