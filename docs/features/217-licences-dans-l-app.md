# 217 — Textes de licence livrés avec l'app

- **Statut** : fait
- **Dépend de** : 012, 065, 105, 145, 201
- **Agents** : aucun (générique : construction et distribution de l'app)

## Pourquoi

Avant d'ouvrir le dépôt et de publier le DMG `1.0.0-beta.1`, l'audit des licences (P0-1, P0-2,
P1-1, P1-2, P1-4) a montré que l'app packagée ne contient **aucun** texte de licence : ni ceux de
Bobine, ni ceux des ~190 paquets que Vite copie dans `out/` (React, mermaid et ses dépendances,
le SDK ACP…, presque tous en `devDependencies` : `pnpm licenses --prod` n'en voit rien), ni ceux
d'Electron et de Chromium, ni ceux de la police embarquée. MIT, BSD, ISC, Apache-2.0 et Chromium
exigent ces textes avec toute distribution binaire. elkjs (EPL-2.0 OR GPL-3.0+) et dompurify
(MPL-2.0 OR Apache-2.0) sont livrés sans choix de licence écrit. `THIRD-PARTY-NOTICES.md` était
écrit à la main, incomplet, sans contrôle.

## Critères d'acceptation

- [x] `pnpm build && pnpm third-party-notices` écrit `THIRD-PARTY-NOTICES.md` d'après ce que le
      build met **réellement** dans l'app (paquets dont du code ou un fichier reste dans `out/`,
      relevés par un greffon Vite), plus les `dependencies` qu'electron-builder ajoute (node-pty,
      `@xterm/headless`, `@xterm/addon-serialize`, jsonc-parser), Electron, AXe (renvoi à son
      `LICENSES.txt` livré), la police MesloLGS Nerd Font et ses jeux d'icônes : nom, version,
      licence, texte intégral (textes identiques regroupés), NOTICE des paquets qui en ont.
- [x] Doubles licences : choix explicite écrit (elkjs → EPL-2.0 avec lien vers les sources,
      dompurify → Apache-2.0) ; une double licence sans choix fait échouer la génération.
- [x] Attributions CC BY 4.0 (Codicons, Font Awesome) et OFL 1.1 (Pomicons, Weather Icons) avec
      leurs textes.
- [x] Contrôle de dérive : `verify` (test unitaire, sans build) échoue si l'inventaire versionné
      ne correspond plus au lockfile ou aux dépendances de production installées, ou si le fichier
      d'avis n'est plus celui que produit le générateur ; `pnpm third-party-notices --check`
      (lancé par `pnpm package` et `pnpm e2e`) échoue si le build embarque autre chose que
      l'inventaire.
- [x] `Contents/Resources/licenses/` (macOS) et `resources/licenses/` (Linux, configuration
      seulement) : `LICENSE`, `NOTICE`, `THIRD-PARTY-NOTICES.md`, `electron/LICENSE`,
      `electron/LICENSES.chromium.html`, `fonts/` (licences et README de la police).
- [x] `copyright` d'electron-builder : « Copyright © 2026 Jérôme Lallement » (Info.plist) ;
      `package.json` : `author`, `homepage`, `bugs` (`private: true` gardé).
- [x] `pnpm e2e:packaged` vérifie les fichiers livrés.
- [x] Pas d'interface (« À propos › Licences » : plus tard).

## Plan

1. Greffon Vite `scripts/third-party/bundled-plugin.mts` branché sur les trois builds
   d'electron-vite : à `generateBundle`, modules dont il reste du code (`renderedLength > 0`), CSS
   et fichiers d'origine des assets → paquets (`node_modules/<nom>` le plus profond du chemin,
   lu dans son `package.json`) ; modules virtuels `\0vite/…` et `\0rolldown/…` → Vite et
   Rolldown. Écrit `out/third-party/<build>.json` (exclu de l'app par `files`).
2. `scripts/third-party/packages.mts` : paquet par nom et version exacte dans
   `node_modules/.pnpm`, dépendances de production parcourues comme Node les résout (sans
   `node-addon-api`, exclu par `files`), fichiers LICENSE / COPYING / NOTICE, choix des doubles
   licences, cas sans fichier.
3. `scripts/third-party/render.mts` (rédaction pure, déterministe) et `notices.mts` (assemblage) ;
   CLI `scripts/third-party-notices.mts` (`pnpm third-party-notices [--check]`).
4. Inventaire versionné `scripts/third-party/inventory.json`, textes standards versionnés
   `scripts/third-party/texts/` (CC BY 4.0, OFL 1.1, licence de xterm.js).
5. `electron-builder.yml` (`extraResources` communs, `copyright`), `scripts/package` (`--check`
   après le build, macOS et Linux), `e2e/run.mjs` (`--check` avant de jouer), `e2e/packaged.mjs`.
6. Tests : `scripts/third-party-notices.test.ts`.

**Aucune nouvelle dépendance** : le greffon utilise l'API de Vite/Rolldown déjà là, le parcours
des dépendances et la lecture du lockfile sont faits à la main.

### Pourquoi deux contrôles (compromis)

Savoir exactement ce qui est embarqué demande un build (tree-shaking : mermaid tire ~120 paquets
dont certains disparaissent). Un build complet dans `./scripts/verify` coûterait du temps à chaque
vérification et doublerait celui des e2e. D'où :

- **`verify`** (rapide, sans build, aussi sur la CI Linux) : chaque paquet de l'inventaire versionné
  doit exister à cette version dans `pnpm-lock.yaml` (une montée de version de mermaid, React…
  retire l'ancienne du lockfile : échec), les dépendances de production et Electron doivent être
  celles installées, et `THIRD-PARTY-NOTICES.md` doit être exactement ce que le générateur produit
  de l'inventaire (fichier retouché à la main, texte de licence changé : échec).
- **`--check`** (contre le build) : l'inventaire du build doit être celui du dépôt, au paquet et à
  la version près ; il tourne au début de `pnpm e2e` (avant chaque envoi, AGENTS.md) et dans
  `pnpm package` (donc `release.yml`) — un paquet **nouvellement importé** par le code, que le
  lockfile seul ne trahit pas, est vu là. Il vérifie aussi que `LICENSE` et
  `LICENSES.chromium.html` d'Electron sont présents.

Angle mort assumé : une montée de version où l'ancienne version reste dans le lockfile pour un
autre usage n'est vue que par `--check` (e2e, packaging), pas par `verify`.

## Journal

- 2026-11-10 — Fait.
  - Inventaire réel : 6 paquets dans le main (SDK ACP, zod, diff, ignore, i18next, runtime de
    Rolldown), 0 dans le preload, 181 dans l'interface (dont l'aide au préchargement de Vite),
    4 dépendances de production ; 188 lignes au total, 83 textes distincts. highlight.js livré
    est la **11.11.2** (via lowlight / rehype-highlight), pas la 11.12.0 de `devDependencies`, que
    l'interface n'importe pas directement : c'est le build qui fait foi.
  - Paquets sans fichier de licence : `@xterm/headless` et `@xterm/addon-serialize` (texte de
    xterm.js versionné, même dépôt), react-remove-scroll-bar (texte MIT standard avec l'auteur de
    son `package.json`) ; khroma n'a pas de champ `license` (MIT lu dans son fichier, vérifié).
    Ces deux paquets xterm sont aussi livrés **sans** leur LICENSE dans `app.asar` : les avis
    couvrent ce manque.
  - Le `LICENSE.md` de Vite et celui de Rolldown reprennent les licences de tout ce qu'ils
    embarquent côté Node ; ils sont recopiés tels quels (trop large, jamais trop court).
  - `pnpm build && pnpm package` (signature ad hoc) : `Contents/Resources/licenses/` contient
    les 8 fichiers attendus, `axe/` reste là (les `extraResources` communs s'ajoutent à ceux de
    `mac`), `out/third-party` absent de `app.asar`, `NSHumanReadableCopyright` =
    « Copyright © 2026 Jérôme Lallement ». `pnpm e2e:packaged` vert, avec les nouveaux contrôles.
  - Écart : Electron installé depuis un `Electron.app` (`pnpm electron-local`, fiche 065) n'a ni
    `LICENSE` ni `LICENSES.chromium.html` : `--check` refuse alors de construire l'app, et dit
    d'utiliser l'archive `.zip`.
  - Linux : configuration seulement (`extraResources` communs, `--check` dans
    `scripts/package --linux`) ; pas construit ici (machine macOS).
  - Reste à faire / ouvert :
    - Écran « À propos › Licences » (audit P1-3), fiche à venir.
    - Meslo LG dérive de Menlo / Bitstream Vera : seul l'avis Apache-2.0 publié par Meslo est
      livré ; les jeux d'icônes MIT de la police n'ont pas d'avis de copyright propre dans
      l'archive Nerd Fonts (on livre ce que Nerd Fonts livre). À faire relire si besoin.
    - Code des outils de build hors paquet (aucun relevé) : seul ce qui vient d'un paquet de
      `node_modules` ou des modules virtuels de Vite et Rolldown est inventorié.
