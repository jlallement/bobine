# 273 — 1.1 : montées de version (ADR-0057 accepté, mineures, SDK ACP 2.8, AXe 2, outillage)

- **Statut** : fait
- **Dépend de** : 252 (rc-D, chaîne d'approvisionnement), 233 (lot 2 des dépendances), 218
  (Dependabot), 217 (avis de licence), 043 (AXe) ; ADR-0057, ADR-0009, ADR-0010 ; audit du
  2026-11-19 (LCM-4, 7, 8, 10, 11)
- **Agents** : les deux (aucun code propre à un agent)

## Pourquoi

La 1.0 est figée (ADR-0057, point 4 : SDK ACP gelé pendant la rc). La branche 1.1 reprend ce qui a
été retenu : les mineures en attente, le SDK ACP 2.8 (schéma 1.33), AXe 2 (LCM-4, hors
Dependabot) et les restes d'outillage de l'audit (LCM-7, 8, 10, 11). L'ADR-0057 est accepté.

## Critères d'acceptation

- [x] ADR-0057 « accepté » (2026-11-21, accord de Jérôme), index des ADR à jour.
- [x] Mineures montées, chacune passée par le délai `minimumReleaseAge` de pnpm, sans exception.
- [x] `@agentclientprotocol/sdk` 2.8.0 exact ; changelog relu ; `pnpm opencode-probe --offline`
      (et en ligne si un modèle gratuit répond) ; `docs/acp.md` à jour si le contrat change.
- [x] AXe 2.0.4 : version et empreinte de l'archive publiée, notes de version relues, appels
      adaptés, `pnpm fetch-axe`, `pnpm simulator-smoke`, avis de licence — fait (collage du smoke
      vérifié depuis le 2026-11-21, voir Journal).
- [x] Outillage : ce que la fiche 252 n'a pas fait (runners nommés, sonde MCP, paquets dépréciés).
- [x] `./scripts/verify` à 0 après chaque lot ; `pnpm e2e --if-needed` (suite complète) à 0.

## Plan

Un commit par lot, `./scripts/verify` entre chaque :

1. **ADR-0057** : statut seulement, index `docs/adr/README.md`.
2. **Mineures** : vitest et `@vitest/coverage-v8` 5.1.1, i18next 27.2.x, react-i18next 18.0.x,
   lucide-react 1.77.x, typescript-eslint 8.73.x, ignore 7.0.16. Pas `typescript` (7 :
   incompatible avec typescript-eslint, pas d'API stable), pas `@types/node` (suit Node 24 de
   `.nvmrc`). Icônes renommées de lucide-react corrigées.
3. **SDK ACP** 2.7.0 → 2.8.0 exact ; adaptations dans le main process seulement.
4. **AXe** 1.8.0 → 2.0.4 : `scripts/fetch-axe` (`AXE_VERSION`, `AXE_SHA256`), archive et licences
   dans `vendor/archives/`, ADR-0009 si besoin, code d'appel et tests.
5. **Outillage** : LCM-7 (version de protocole de la sonde MCP), LCM-8 (paquets dépréciés de
   l'outillage), LCM-10/11 (`.nvmrc`, image Docker, runners).

Aucune nouvelle dépendance.

## Versions

| Paquet | Avant | Après | Note |
|---|---|---|---|
| `vitest`, `@vitest/coverage-v8` | 5.1.0 | 5.1.1 | `^` gardé pour vitest, exact pour la couverture |
| `i18next` | 27.1.2 | 27.2.2 | exact ; rend la PR Dependabot n° 15 (27.1.3) inutile, laissée ouverte |
| `react-i18next` | 18.0.1 | 18.0.3 | exact |
| `lucide-react` | 1.73.0 | 1.77.0 | `FoldVertical` → `ArrowsToAxisDashedHorizontal` (même dessin) |
| `typescript-eslint` | 8.72.2 | 8.73.0 | |
| `ignore` | 7.0.14 | 7.0.16 | exact |
| `@agentclientprotocol/sdk` | 2.7.0 | **2.8.0** exact | schéma 1.33 |
| AXe | 1.8.0 | **2.0.4** | dernière version MIT ; 2.1.0+ en GPL-3.0-only |
| `typescript`, `@types/node` | — | inchangés | TS 7 incompatible avec typescript-eslint < 6.1 et sans API stable ; types de Node 24 (`.nvmrc`) |

Délai de pnpm (défaut 1 jour) : la plus récente, lucide-react 1.77.0, publiée le 2026-11-20 à
06 h 17 UTC, installée le 2026-11-21 à 15 h 20 UTC ; aucune exception ajoutée.

## SDK ACP 2.8.0

Notes de version (GitHub `agentclientprotocol/typescript-sdk`) : schéma 1.33.0 et
2.0.0-alpha.17 ; notifications reçues avant que le pair ferme son flux désormais distribuées ;
aides du protocole hors du validateur. Schémas comparés à ceux de la 2.7.0 : `schema/v1/schema.json`
(stable) **identique** ; l'instable ajoute les curseurs de session (`cursor_update`,
`ClientSessionCapabilities.cursors`, `cursorId` de `session/fork`). Bobine n'annonce pas
`cursors` : rien à adapter, aucun code changé. `docs/acp.md` : paragraphe « SDK ACP 2.8 ».

## AXe 2.0.4

- Archive `AXe-macOS-v2.0.4-universal.tar.gz` (publiée le 2026-11-12) téléchargée dans un dossier
  neuf, jamais exécutée là ; SHA-256 `3178ec66…a208c3`, égal à l'empreinte publiée par GitHub pour
  ce fichier. Rangée dans `vendor/archives/` (ADR-0010), 1.8.0 retirée.
- **Licence** : 2.0.4 est la **dernière version MIT** ; depuis la 2.1.0, AXe est en GPL-3.0-only
  (notes de la v2.1.0). Commentaire à côté de `AXE_VERSION` dans `scripts/fetch-axe`. Avis de
  licence : `LICENSES.txt` assemblé par `fetch-axe` (MIT d'AXe, MIT d'idb) ; la section AXe de
  `THIRD-PARTY-NOTICES.md` dit MIT, les frameworks d'idb de la 2.0.4 (FBControlCore,
  FBSimulatorControl) et le détecteur de clavier adapté de sim-use (Apache-2.0, LY Corporation),
  dont la licence et le NOTICE sont livrés tels quels dans `AXe_AXe.bundle` (nouveau en 2.0).
- Notes de la 2.0 relues : options utilisées par l'app inchangées (`describe-ui`, `tap`, `touch
  --down --up --delay`, `swipe`, `type --stdin`, `key-combo`, `button`, `stream-video --format
  --fps --scale --quality`, vérifiées dans `--help`) ; `describe-ui` rend toujours son arbre JSON.
  **Changement de sortie** : `axe --version` écrit `v2.0.4` (avant `1.8.0`). `parseAxeVersion`
  ne le lisait pas (`\b` entre « v » et le chiffre) : l'app aurait déclaré l'AXe livré
  « inutilisable ». Corrigé (`v?`), avec un test ; `fetch-axe` retire aussi le « v » ; le faux AXe
  de la suite `simulator` répond désormais comme AXe 2.
- `pnpm simulator-smoke` ne se lançait plus (`run.ts` importait `../process-launch` sans
  extension : ERR_MODULE_NOT_FOUND sous Node) ; corrigé, et le smoke ajouté au garde-fou
  `probe-imports.test.ts`. Il prenait aussi l'iPhone Duo (runtime iOS à part d'Xcode 27) : un
  iPhone ordinaire passe d'abord.
- ADR-0009 (accepté) cite encore 1.8.0 et les frameworks de la 1.8 : non modifié (un ADR accepté
  ne change pas) ; la version courante est celle de `scripts/fetch-axe`.

## Outillage (LCM-7, 8, 10, 11)

- Déjà fait par la fiche 252 : `.nvmrc` = 24 (LCM-10), image `ubuntu:24.04` épinglée par digest
  et écosystème `docker` dans Dependabot (LCM-11, partie image). Rien de refait.
- **LCM-11, runners** : plus de `-latest`. Chaque runner est épinglé sur l'image de son dernier
  passage vert (journaux `gh run view --log` du 2026-11-21) : `ubuntu-latest` → `ubuntu-26.04`
  (`ci.yml` verify Linux et gitleaks, `release.yml` contrôle du tag et Release GitHub,
  `opencode-probe.yml`), `macos-latest` → `macos-26` (image `macos-26-arm64`, `ci.yml`),
  `windows-latest` → `windows-2025` (image `windows-2025-vs2026`, `ci.yml` et l'installeur NSIS
  x64 de `release.yml` ; même étiquette pour le job Windows d'`e2e.yml`, qui n'a pas tourné parmi
  les 60 derniers passages). Restent en `ubuntu-24.04`, comme avant ce lot : `e2e.yml` (Linux x64)
  et la matrice `.deb` de `release.yml`, dont les derniers passages verts tournaient sur 24.04
  (cible D6).
- **LCM-7, sonde MCP** (« Tester » un serveur MCP, `mcp-probe.ts`) : annonçait `2025-06-18` ;
  passe à `2025-11-25`, dernière révision à poignée de main `initialize`, la même que le serveur
  de l'app accepte en tête. La révision `2026-07-28` (publiée) rend MCP sans état (plus
  d'`initialize` ni de `Mcp-Session-Id`, `server/discover`) : autre client, à décider dans une
  fiche (voir Reste).
- **LCM-8, paquets dépréciés** : `pnpm install` signale toujours `boolean@3.2.0`, `glob@7.2.3`,
  `inflight@1.0.6`, `rimraf@2.6.3`, tous tirés par electron-builder 26.18.1 (outillage, rien de
  livré). electron-builder 27 n'est qu'en `next` (27.0.0-alpha.15) : on attend sa version stable,
  comme le recommande l'audit. Rien changé.

## Journal

- 2026-11-21 — `simulator-smoke` sous iOS 27.2 (branche `feat/1.1-petits-restes`). Cause, lue
  dans `axe describe-ui` : le champ de recherche de Réglages est passé en bas, dans la barre
  d'outils (`Group 'Barre d'outils'`, à plus de vingt niveaux), et c'est un `TextField` **sans
  libellé ni valeur** tant qu'il est vide ; `formatScreen` ne liste que les éléments nommés, donc
  l'essai, qui cherchait dans sa liste, ne le voyait pas. De plus, Réglages rouvert reprenait la
  page « Compte Apple » touchée plus haut, sans champ. Correctif (script seul) : Réglages quitté
  puis relancé (`simctl terminate`), champ cherché dans l'arbre brut par son type (`TextField`,
  `SearchField`, `TextArea`, `TextView` ; visible, actif ; jamais un champ de mot de passe),
  attendu jusqu'à 10 s, touché en son centre ; la saisie est vérifiée sur la valeur du champ
  (`AXValue` = « Zoé ça »). Aucune coordonnée en dur. Deux passages de suite : **code 0** et
  **code 0** (11/11, simulateur supprimé à chaque fois ; deux simulateurs gardés pendant
  l'enquête, `--keep`, supprimés à la main). `vendor/axe` extrait par `pnpm fetch-axe` (archive
  versionnée). À noter, non corrigé : l'outil d'écran donné à l'agent (`formatScreen`) ne montre
  pas non plus ce champ vide sans nom ; un agent ne peut pas le désigner par sa liste.
- 2026-11-21 — `pnpm bob-probe` sur le SDK 2.8.0 (Bob 2.1.0, 0 bobcoin, `~/.bob` sauvegardé avant) :
  code 0, contrat respecté, réponses identiques à la référence 2.1.0 ; `~/.bob` inchangé (seuls
  les fichiers temporaires `-wal`/`-shm` de `bob.db` apparus à l'ouverture).

- 2026-11-21 : fiche créée ; branche `chore/1.1-lcm` depuis `1.1` (`0458dcc`).
  - Lot 1 (`5fd6e46`) : ADR-0057 accepté. `verify` : 0.
  - Lot 2 (`63dc10a`) : mineures, icône renommée, avis de licence régénérés. `verify` : 0.
  - Lot 3 (`0c2337d`) : SDK ACP 2.8.0. `verify` : 0. `pnpm opencode-probe --offline` : 0 (contrat
    12/12, réponses identiques). `pnpm opencode-probe` (modèle gratuit `opencode/big-pickle`),
    deux passages : 1er code 1 (« question en texte libre » : délai dépassé, le modèle n'a pas
    répondu), 2e code 2 (« travail du sous-agent rangé sous sa carte » non vérifié, le modèle ne
    l'a pas fait) ; chaque point manquant est vert dans l'autre passage, réponses **identiques**
    au 2e. Aucun écart de contrat. `pnpm bob-probe` : non lancé, à la charge de Jérôme.
  - Lot 4 (`630caeb`) : AXe 2.0.4. `verify` : 0. `pnpm fetch-axe` : 0.
    `pnpm simulator-smoke` (simulateur « Bobine Smoke », iPhone 17, iOS 27.2) : code 1, un
    échec sur onze : « saisie : aucun champ de texte trouvé dans Réglages ». Lecture de l'écran,
    toucher, capture, flux MJPEG (≈ 10 i/s) et BGRA (≈ 28 i/s) verts. **Même échec avec AXe 1.8.0**
    (archive versionnée, même script) : sans lien avec AXe ; probablement Réglages d'iOS 27, sans
    champ de recherche lisible sur sa page d'accueil (non creusé) ; le collage (`key-combo`) n'est donc pas vérifié en réel. Un premier passage
    interrompu par erreur a laissé un simulateur « Bobine Smoke » : supprimé à la main.
  - Lot 5 (`6bd61d8`) : runners nommés, sonde MCP en 2025-11-25. `verify` : 0.
  - Fin : `pnpm build && pnpm e2e --if-needed` (suite complète, aucune autre campagne en cours) :
    **code 0**, 236/236, 21 min 47 s. AXe est livré dans l'app : `pnpm package` (signature ad hoc)
    code 0, puis `pnpm e2e:packaged` code 0 (« AXe embarqué utilisé (2.0.4 : …/Contents/Resources/
    axe/axe) »). Nouveautés : une ligne pour AXe 2.0.4 (FR et EN), ajoutée après la campagne
    (texte seul).
- 2026-11-21 : retouches demandées à la relecture (un commit).
  - Runners : Linux épinglé en `ubuntu-26.04` (et non 24.04) là où ce lot avait remplacé
    `ubuntu-latest`, pour ne pas revenir en arrière ; `macos-26` et `windows-2025` vérifiés contre
    les images des derniers passages verts (`macos-26-arm64`, `windows-2025-vs2026`).
  - Exception `minimumReleaseAgeExclude: electron@45.4.1` retirée de `pnpm-workspace.yaml`
    (ADR-0057, point 2 : délai écoulé depuis le 2026-11-20 02 h 04 UTC ; suite de la fiche 252).
    `pnpm install --frozen-lockfile` : code 0, verrou inchangé.
  - `./scripts/verify` : code 0 ; pas d’e2e (workflows et configuration de pnpm seulement).

## Reste

- [ ] **AXe au-delà de 2.0.4** : 2.1.0 et suivantes sont en GPL-3.0-only alors que Bobine livre le
      binaire. **Une décision (licence) est nécessaire avant toute montée.**
- [x] `pnpm bob-probe` après le SDK 2.8.0 : fait le 2026-11-21 (voir Journal).
- [x] `simulator-smoke` : champ de saisie de Réglages retrouvé sous iOS 27.2 (journal du
      2026-11-21, « petits restes ») ; collage vérifié en réel.
- [ ] MCP 2026-07-28 (sans état) : fiche à ouvrir pour le serveur de l'app et « Tester ».
- [ ] Paquets dépréciés de l'outillage : à revoir avec electron-builder 27 stable.
