# 172 — Dépendances, lot B : Mermaid 12.3, i18next 26.7 ; `/goal` d'OpenCode 2.2.5

- **Statut** : fait (sonde d'OpenCode 2.2.5 avec modèle gratuit non lancée)
- **Dépend de** : 143 (Mermaid 12, look classique et dagre gardés), 169 (lot A, exclusion d'âge
  d'Electron dans `pnpm-workspace.yaml`)
- **Agents** : les deux (aucun code propre à un agent ; `goal` est relevé chez OpenCode)

## Pourquoi

L'audit des dépendances du 2026-11-05 (§ 5) a laissé au lot B deux mineures à surveiller de près :
Mermaid 12.3 (rendu des diagrammes) et i18next 26.7, qui prépare la v27 et n'avertit qu'en mode
`debug`. Au passage, la sonde hors ligne d'OpenCode 2.2.5 relève une nouvelle commande `goal` à
documenter.

## Critères d'acceptation

- [x] `mermaid` 12.3.0 et `i18next` 26.7.x exacts dans `package.json` ; le lockfile ne bouge que
      pour eux.
- [x] Captures Mermaid avant/après comparées, clair et sombre : aucune régression du look classique
      ni de la mise en page dagre (fiche 143).
- [x] Passage i18next avec `debug: true` (non commité) : avertissements de dépréciation relevés ici ;
      « `t()` avant `init()` rend `''` » (26.7.0) confronté au code.
- [x] Aucune version de moins d'un jour (délai de pnpm) sans le dire ; exclusion d'Electron retirée
      si elle n'est plus nécessaire.
- [x] `goal` documentée dans `docs/acp.md` ; affichée dans le menu « / » sans code propre à
      OpenCode ; réponse de référence de la sonde hors ligne acceptée.
- [x] Testé contre l'agent factice : suites e2e `mermaid`, `language`, `commands`, `settings`,
      `base` (clair et sombre) ; test unitaire avec la liste de commandes d'OpenCode 2.2.5.

## Plan

1. Captures `mermaid` (clair, sombre, variantes) avec 12.2.0, mises de côté.
2. `pnpm add -E mermaid@12.3.0 i18next@26.7.x` ; build, suite `mermaid`, comparaison.
3. `debug: true` temporaire dans `src/shared/i18n/index.ts` : tests unitaires (`--silent=false`) et
   suites e2e avec un relevé temporaire de la console (main et renderer) ; corriger ce qui avertit.
4. OpenCode : description de `goal` (ACP brut, `HOME` jetable, sans modèle), traitement du menu
   « / » vérifié dans le code, test unitaire, `docs/acp.md`, `--offline --accept`.
5. Exclusion `electron@45.2.3` : retirer si pnpm l'accepte.

Hors lot, non touchés : SDK ACP, TypeScript, `@types/node`, Electron, pnpm. Aucune nouvelle
dépendance.

## Versions

| Paquet | Avant | Après | Note |
|---|---|---|---|
| `mermaid` | 12.2.0 | **12.3.0** | exact ; publiée le 2026-11-03. Le lockfile remplace `elkjs` 0.9.3 par 0.12.1 et retire `uuid` (dépendances de Mermaid) |
| `i18next` | 26.5.6 | **26.7.1** | exact ; **26.7.2** publiée le 2026-11-05 à 14 h 23 UTC, moins d'un jour avant : laissée (pas d'exclusion) |

`react-i18next` reste en 17.1.12 (pair `i18next >=26.2` satisfait).

## Journal

- 2026-11-05 : fiche créée depuis l'audit du jour (§ 1, § 4, lot B).
- 2026-11-05 : lot fait.
  - **Mermaid 12.3.0** : captures de la suite `mermaid` (`m0-mermaid` clair et sombre, variantes
    `sepia-light` et `black-dark`, `m1-mermaid-agrandi` clair et sombre) prises avant puis après :
    les six PNG sont **identiques à l'octet près** (`cmp`). Le bundle contient bien la 12.3.0.
    Look classique et dagre inchangés.
  - **i18next 26.7.1, passage `debug: true`** :
    - Tests unitaires : un seul avertissement, `postProcess: 'typography' was registered with use()
      on another i18next instance; from v27 post-processors are per instance`. Il venait des tests
      (`locales.test.ts`, et de même `mcp/catalog.test.ts`), qui créaient des instances sans
      `.use(typography)` ; corrigé. L'app enregistre déjà `typography` sur ses deux instances
      (main, renderer).
    - App réelle (suites `language`, `settings`, `commands`, `base`, clair et sombre, console du
      main et du renderer relevée) : ni dépréciation, ni avertissement, ni clé manquante ; seulement
      `initialized` et `languageChanged`.
    - Les autres dépréciations de la 26.7 (langue `dev` sans `fallbackLng`, codes de langue
      canonisés, langue pointée `en.translation.key`, objets sans `returnObjects`, délimiteurs
      d'interpolation échappés, `/` échappé, `callbackApi` des backends et détecteurs, logger
      partagé) ne concernent pas Bobine : `fallbackLng` explicite, codes `fr` / `en`, ressources
      embarquées, `escapeValue: false`, ni backend ni détecteur.
    - **`t()` avant `init()`** (`''` au lieu de `undefined`) : le main appelle `initI18n` au
      démarrage (`src/main/index.ts`) avant toute fenêtre, le renderer dans `main.tsx` avant le
      rendu ; les `t()` au niveau module sont tous dans des fonctions (`DiffView`, `diagnostics`,
      `command-approval`), évaluées plus tard. Les tests partagés initialisent i18next dans leur
      `setupFiles`. Tests verts : sans effet.
  - **OpenCode 2.2.5** : `goal` annoncée à `session/new` (« keep working until an objective is met
    [pause|resume|clear] », sans `input`). Le menu « / » la reçoit par le chemin générique
    (`commandsOf` → `mergeCommands`) ; aucune commande de l'app ne porte ce nom, `/goal …` part
    donc à l'agent tel quel. Test unitaire ajouté avec la liste exacte (`app-commands.test.ts`).
  - **Sonde** : `--offline --accept` aurait réécrit `opencode-probe.expected.json` avec les seuls
    sondages hors ligne (les réponses avec modèle de la 2.0.32 auraient disparu). Corrigé
    (`acceptedExpectations`, testé) : en hors ligne, les réponses des sondages gratuits sont
    fusionnées et la version est notée sous `offline` ; `opencodeVersion` reste 2.0.32, la version
    réellement essayée avec modèle (et celle du profil, `testedVersions`). Écart au plan : petit
    changement du script, plutôt qu'une retouche à la main du JSON.
  - **Exclusion d'Electron** : à 21 h 03 UTC, Electron 45.2.3 (publiée le 2026-11-04 à 21 h 39
    UTC) n'avait pas encore un jour et pnpm la refusait encore. Retirée à 21 h 41 UTC :
    `pnpm install --frozen-lockfile` passe le contrôle des 799 entrées ; la clé
    `minimumReleaseAgeExclude`, devenue vide, est retirée avec son commentaire.
  - `./scripts/verify` vert (300 fichiers, 2305 tests ; un premier passage avait échoué sur la
    mesure de latence de `manager.test.ts`, fiche 046, sous la charge des autres sessions : vert
    seul puis au passage suivant).
  - `pnpm build && pnpm e2e --changed` : le lockfile ayant changé, toute la suite a tourné
    (139 essais, clair et sombre, 8 min 39 s) ; 138 verts, `diagnostic dark` en échec au nettoyage
    d'un dossier temporaire (`ENOTEMPTY`), vert relancé seul (`--jobs 1`, clair et sombre).
    Captures regardées : Mermaid (identiques), menu « / » (`16-commandes`), Réglages en anglais.
  - Après fusion de `main` (fiches 166, 167, 171, 173) : seul l'index en conflit ; `verify` vert
    (2352 tests). `pnpm build && pnpm e2e --changed` : 145 essais, **139 verts, 6 échecs** dans
    `debordements` (conversation étroite : `time.msg-time` et `conversation-drop` dépassent
    120 px) et `sommaire` (`outline-bars` jamais affiché), clair et sombre, reproduits seuls. **Les
    mêmes 6 échecs sur `main` seul** (worktree détaché, même build) : ils ne viennent pas de ce
    lot, à reprendre dans la fiche 173.
  - **Reste** : sonde d'OpenCode 2.2.5 avec un modèle gratuit (`pnpm opencode-probe`, puis
    `--accept` et 2.2.5 dans `testedVersions` du profil) ; i18next 26.7.2 au prochain lot.
