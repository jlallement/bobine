# 169 — Dépendances, lot A : Electron 45.2.3, patchs et outillage

- **Statut** : fait (trousseau à la souris dans l'app packagée non vérifié)
- **Dépend de** : 143 (montée précédente : Electron 45, Vite 8, Mermaid 12)
- **Agents** : les deux (aucun code propre à un agent)

## Pourquoi

L'audit des dépendances du 2026-11-05 a classé les montées en lots. Le lot A est le « sans risque » :
Electron 45.0.0 → 45.2.3 apporte les correctifs de sécurité de Chromium et V8 (même Chromium 156,
même Node 24), le reste ne touche que des correctifs et de l'outillage. Les lots B (Mermaid 12.3,
i18next 26.7) et C (SDK ACP 2.x, sondes des agents) auront leur propre fiche.

## Critères d'acceptation

- [x] Electron 45.2.3 : notes des 45.1.x et 45.2.x relues ; rien sur `safeStorage`,
      `WebContentsView`, `utilityProcess` ni le preload sandboxé ne casse.
- [x] Patchs et mineures d'outillage du lot montés, chacun dans son commit ; chaque version laissée
      en arrière est dite, avec sa raison.
- [x] Nouvelles alertes ESLint corrigées sans désactiver de règle ni monter de seuil.
- [x] Icônes lucide passées à leurs nouveaux noms (`CircleExclamationPoint`,
      `TriangleExclamationPoint`, `CodeXml`).
- [x] `./scripts/verify` vert après chaque groupe ; `pnpm build && pnpm e2e --if-needed` (suite
      complète, clair et sombre) vert, captures regardées.
- [x] `pnpm package` puis `pnpm e2e:packaged` depuis le DMG monté en lecture seule (le trousseau
      réel, à la souris, reste à essayer : l'essai automatique utilise `--use-mock-keychain`).
- [x] Testé contre l'agent factice : la suite e2e complète (aucun scénario nouveau, pas de
      changement de comportement attendu).

## Plan

Groupes successifs, `./scripts/verify` vert et un commit (`build(deps): …`) après chacun :

1. **Electron 45.0.0 → 45.2.3** seul.
2. **Patchs** : `electron-builder` 26.18.1 (dist-tag `v26`), `typescript-eslint` 8.72.1, `ignore`
   7.0.14 (exact, fiche 099), `react-i18next` 17.1.13 (exact). `vite` 8.3.6 seulement si elle a
   plus de quelques jours.
3. **ESLint** : `eslint` 10.14 + `globals` 17.14.
4. **Vitest** : `vitest` + `@vitest/coverage-v8` 5.1.0 ensemble (coverage exige vitest exactement
   5.1.0).
5. **`@vitejs/plugin-react` 6.2.1** : vérifier que ses pairs optionnels n'ajoutent rien.
6. **`lucide-react` 1.69** et renommage des icônes (alias aujourd'hui, retirés plus tard).

Hors lot, à ne pas toucher : SDK ACP, TypeScript, `@types/node`, Mermaid, i18next, `packageManager`,
minimatch.

Aucune nouvelle dépendance.

### Notes d'Electron relues (45.1.0 → 45.2.3)

- 45.1.0 : Chromium 156.0.8078.49, Node 24.22.1 ; filtres de `session.registerPreloadScript`
  (non utilisé) ; `utilityProcess` émet `exit` si l'app quitte pendant son lancement (non utilisé) ;
  chemins asar homogènes entre main et processus enfants, archives asar mal formées (node-pty est
  dans `asarUnpack`, fiche 012 : à vérifier par l'app packagée) ; `Menu.popup()` sur macOS qui ne
  s'affichait parfois pas après un autre (correctif bienvenu : menus contextuels) ; liste noire de
  File System Access ; `protocol.registerSource` (non utilisé) ; extensions (non utilisées).
- 45.2.0 : correctifs de Chromium, Dawn, Skia, V8 rétroportés ; `adjustSelection()`,
  `Menu.setHighlightColors()` (Windows), `window.open` (opacité), DevTools « Save », `net.fetch()`
  plus rapide.
- 45.2.1 : Chromium 156.0.8078.75 et correctifs rétroportés.
- 45.2.2 : Chromium 156.0.8078.80, Node 24.22.2 ; `removeInsertedCSS()` pour `cssOrigin: 'user'`.
- 45.2.3 : correctifs rétroportés (ANGLE, Chromium, Dawn, FFmpeg, PDFium, Skia, V8).

Rien sur `safeStorage`, `WebContentsView` ni le preload sandboxé.

## Versions

| Paquet | Avant | Après | Note |
|---|---|---|---|
| `electron` | 45.0.0 | **45.2.3** | Chromium 156.0.8078.80, Node 24.22.2 ; exclusion d'âge pnpm (voir Journal) |
| `electron-builder` | 26.18.0 | 26.18.1 | exact ; dist-tag `v26` (`latest` pointe encore 26.18.0) |
| `typescript-eslint` | 8.72.0 | 8.72.1 | accepte toujours `typescript <6.1.0` |
| `ignore` | 7.0.13 | 7.0.14 | exact (fiche 099) |
| `react-i18next` | 17.1.4 | 17.1.12 | exact ; 17.1.13 sortie le jour même, laissée (voir Journal) |
| `eslint` / `globals` | 10.13.0 / 17.13.0 | 10.14.0 / 17.14.0 | aucune nouvelle alerte |
| `vitest` / `@vitest/coverage-v8` | 5.0.5 | 5.1.0 | ensemble (coverage exige vitest 5.1.0 exactement) |
| `@vitejs/plugin-react` | 6.1.2 | 6.2.1 | pairs optionnels non installés, aucun paquet ajouté au lockfile |
| `lucide-react` | 1.61.0 | 1.68.0 | 1.69.0 sortie le jour même, laissée ; les nouveaux noms datent de la 1.68 |

Laissés en arrière, avec leur raison :

- **`vite` 8.3.5** (8.3.6 publiée le 2026-11-05, le jour même) : consigne du lot, attendre quelques
  jours.
- **`react-i18next` 17.1.12** (17.1.13 publiée le 2026-11-05 à 14 h UTC, quelques heures avant) et
  **`lucide-react` 1.68.0** (1.69.0 publiée le 2026-11-05) : même règle que pour Vite, et pnpm 12
  aurait demandé une exclusion à son délai minimal de publication (`minimumReleaseAge`). La version
  retenue passe ce délai sans exclusion. À reprendre au prochain lot.
- Hors lot, non touchés : SDK ACP, TypeScript, `@types/node`, Mermaid, i18next, `packageManager`,
  minimatch (lots B et C de l'audit).

## Journal

- 2026-11-05 : fiche créée depuis l'audit du jour (§ 5, lot A).
- 2026-11-05 : lot monté en six commits (`build(deps): …`), `./scripts/verify` vert après chacun
  (300 fichiers, 2289 tests ; `pnpm coverage` passe aussi avec Vitest 5.1.0).
  - **Délai minimal de pnpm** : pnpm 12 refuse une version publiée depuis moins d'un jour
    (`minimumReleaseAge`) ; à l'installation d'Electron 45.2.3 (publiée le 2026-11-04 à 21 h 39 UTC)
    il a ajouté de lui-même `minimumReleaseAgeExclude: electron@45.2.3` à `pnpm-workspace.yaml`.
    Gardé (version exacte, consigne du lot), avec un commentaire : à retirer au prochain lot.
  - **Écarts au plan** : `react-i18next` 17.1.12 au lieu de 17.1.13 et `lucide-react` 1.68.0 au
    lieu de 1.69 (toutes deux publiées le jour même, même règle que Vite 8.3.6, et pas d'exclusion
    de plus) ; les nouveaux noms d'icônes sont déjà dans la 1.68.
  - ESLint 10.14 / globals 17.14 : aucune nouvelle alerte, rien à corriger.
  - `@vitejs/plugin-react` 6.2.1 : pairs optionnels (`oxc-transform-react`,
    `@rolldown/plugin-babel`, `babel-plugin-react-compiler`) non installés ; le lockfile n'ajoute
    aucun paquet.
  - Icônes : 10 fichiers du renderer ; aucune classe `lucide-*` visée par le CSS ni les essais.
  - `pnpm build && pnpm e2e --if-needed` : suite complète verte du premier coup (139 essais, clair
    et sombre, 8 min 15 s, 3 suites en parallèle, machine chargée par trois autres sessions), sans
    relance. Captures regardées (Mermaid, avertissements de worktree et de fusion, formulaire
    d'agent) : rien de changé.
  - `pnpm package` : `.app` et `.dmg` construits ; Electron 45.2.3 dans le framework, node-pty
    dans `app.asar.unpacked`. `pnpm e2e:packaged` depuis le DMG monté en lecture seule (point de
    montage passé par `realpath`) : vert (fenêtre, renderer isolé, agent factice absent, IBM Bob et
    OpenCode trouvés, terminal node-pty, AXe 1.8.0 embarqué). `pnpm package --dry-run` : signature
    ad hoc, runtime renforcé.
  - **Reste** : une passe à la souris dans l'app packagée pour le trousseau (fiche 100), non faite
    depuis la fiche 143 ; au prochain lot, retirer l'exclusion d'Electron et reprendre Vite 8.3.6,
    react-i18next 17.1.13, lucide-react 1.69.
