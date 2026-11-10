# 105 — Préparer le dépôt pour le public : licence, README, CI, contribution, signalement

- **Statut** : fait (`ci.yml` vert sur GitHub ; le passage du dépôt en public reste à faire par l'utilisateur)
- **Dépend de** : 059 (release), 061 (diagnostic), 074 (interface en anglais)
- **Agents** : les deux (rien ne touche les agents)

## Pourquoi

Bobine doit devenir un dépôt public pour les utilisateurs de Bob et les équipes qui ont des
modèles internes derrière OpenCode. Aujourd'hui : pas de licence, un README de six lignes en
français, `verify` qui ne tourne qu'au tag, rien pour contribuer ni pour signaler un problème.
C'est le chantier 4 de l'audit du 2026-10-21 (`docs/audit-maturite-2026-10-21.md`). Les fiches et
les ADR restent en français (mémoire de travail) ; seules les pages d'entrée existent en anglais.

## Critères d'acceptation

- [x] `LICENSE` à la racine (choix de l'utilisateur : MIT ou Apache-2.0, à lui demander avant),
      champ `license` dans `package.json` ; `THIRD-PARTY-NOTICES.md` ou section du README pour
      AXe, idb et les polices embarquées (vérifier leurs licences).
- [x] Historique git passé au scan des secrets (`gitleaks` ou équivalent, sans nouvelle
      dépendance du projet : outil lancé à part) ; résultat noté dans le journal de la fiche. Si
      un secret est trouvé : le dire à l'utilisateur, ne rien réécrire sans son accord.
- [x] `README.md` en anglais : une phrase, une capture ou un GIF (à prendre avec `pnpm e2e`, à
      déposer dans `docs/images/`), ce que Bobine est et n'est pas (Bob d'abord, OpenCode pour les
      modèles internes ou gratuits ; pas un remplaçant des apps de Claude ou de ChatGPT), les
      agents pris en charge, l'installation en trois commandes, « Known limitations » (macOS Apple
      Silicon, signature ad hoc, une seule personne l'a utilisée), liens vers `docs/` (français).
      `README.fr.md` garde l'actuel, enrichi de la même manière.
- [x] `CONTRIBUTING.md` (anglais) : renvoie à `AGENTS.md`, cycle fiche → plan → verify → e2e,
      conventions de commit, langues.
- [x] `SECURITY.md` (anglais) : comment signaler une faille, en privé.
- [x] `.github/ISSUE_TEMPLATE/bug.yml` (anglais) : demande le rapport de Réglages › Diagnostic
      (« Copier le rapport ») et la version ; `feature.yml` court.
- [x] `.github/workflows/ci.yml` : à chaque PR et push sur `main`, sur `ubuntu-latest` : `pnpm
      install --frozen-lockfile`, lint, typecheck, tests unitaires (vérifier ce qui ne passe pas
      sous Linux : `node-pty`, tests qui créent des commits ; exclure proprement, jamais
      désactiver un test pour faire passer). Les e2e restent sur macOS, au tag (`release.yml`) ;
      un `workflow_dispatch` pour les lancer à la main.
- [x] Réglages › Diagnostic : bouton « Signaler un problème » qui ouvre dans le navigateur
      l'issue GitHub préremplie (gabarit `bug.yml`, version, rapport de diagnostic dans le corps,
      tronqué à la limite d'URL, le reste à coller). Textes FR et EN.
- [x] `docs/installation.md` : la ligne « Le dépôt est privé » retirée ou conditionnée.
- [x] Testé : suite e2e `diagnostic` verte (bouton visible, URL attendue), captures regardées.
- [x] `ci.yml` vérifié par un premier passage sur GitHub : échec attendu sur `node-pty` (voir le
      journal), corrigé par une étape de compilation explicite.

## Plan

Décisions prises avant de coder (2026-10-21) :

- **Licence** : Apache-2.0 (choix de l'utilisateur, recommandée pour sa clause de brevets ; AXe et
  idb sont en MIT, compatibles). `LICENSE` (texte canonique), `NOTICE`, `license` et `repository`
  dans `package.json`, `THIRD-PARTY-NOTICES.md` (AXe, idb, Lucide en ISC, polices : aucune
  embarquée, celles du système).
- **Secrets** : `gitleaks` installé par Homebrew, lancé à part (`gitleaks git .`) ; résultat dans
  le journal ; `.gitleaksignore` pour la fausse alerte connue.
- **Pages d'entrée** (anglais) : `README.md` (phrase, capture `docs/images/`, ce que Bobine est et
  n'est pas, agents, installation en trois commandes, limites connues, liens vers `docs/`),
  `README.fr.md` (même plan, en français), `CONTRIBUTING.md`, `SECURITY.md` (signalement privé par
  l'onglet Security de GitHub ; pas d'adresse personnelle), gabarits `.github/ISSUE_TEMPLATE/`
  (`bug.yml` avec les champs `version` et `report`, `feature.yml`, `config.yml`).
- **CI** : `.github/workflows/ci.yml` (PR et push sur `main`, `ubuntu-latest`, `pnpm install
  --frozen-lockfile`, identité git pour les tests qui committent, `./scripts/verify`). Risques
  Linux relevés : `node-pty` 1.1.0 sans prébuild Linux (compilé par `node-gyp`, outils présents
  sur `ubuntu-latest`) ; `scripts/electron-local.test.ts` déjà en `describe.skipIf` hors macOS ;
  les autres tests injectent leurs commandes (`xcrun`, `simctl`, `xattr`) ou n'emploient que
  `/bin/sh` et `git`. Les e2e restent sur macOS : `.github/workflows/e2e.yml` en
  `workflow_dispatch` seulement (captures en artefact), pas rattaché au tag tant qu'un premier
  passage sur un runner GitHub n'a pas montré qu'Electron s'y pilote (un échec bloquerait une
  version).
- **« Signaler un problème »** : fonction pure `issueUrl()` dans `src/shared/issue-url.ts`
  (adresse `https://github.com/jlallement/bobine/issues/new?template=bug.yml&labels=bug&version=…&report=…`,
  rapport tronqué pour tenir sous 8 000 caractères d'URL, avec une ligne qui dit de coller le
  reste) ; lien `<a target="_blank">` dans `DiagnosticsSettings.tsx` (le main process ouvre
  déjà tout `https://` dans le navigateur système, rien de nouveau dans l'IPC) ; version lue par
  `app.getInfo`. Textes `diagnostics.reportIssue*` en FR et EN ; test unitaire de l'URL ; suite
  e2e `diagnostic` : lien visible, `href` attendu, clic observé en remplaçant
  `shell.openExternal` dans le main process (`--inspect`) pour ne pas ouvrir de navigateur.
- **Doc** : `docs/installation.md` sans la ligne « dépôt privé » ; `AGENTS.md` dit que `verify`
  tourne sur GitHub à chaque PR ; `docs/README.md` renvoie au README anglais.

## Journal

- 2026-10-21 — Fiche créée (audit de maturité, chantier 4). Le passage du dépôt en public
  lui-même est un geste de l'utilisateur.
- 2026-10-21 — Implémentée dans le worktree `claude/fiche-105-depot-public-736055`.
  - **Licence** : Apache-2.0, choisie par l'utilisateur (MIT proposée en alternative). `LICENSE`
    (texte canonique), `NOTICE`, `THIRD-PARTY-NOTICES.md` : AXe 1.8.0 et idb (MIT, texte déjà
    dans `vendor/archives/AXe-1.8.0-LICENSES.txt` et livré avec l'app), Lucide (ISC), aucune
    police embarquée (familles système), icône et fond d'installation : œuvre du projet.
  - **Scan des secrets** : `gitleaks` 8.30.1 (Homebrew), `gitleaks git .` sur les 252 commits
    (6,3 Mo) : **une seule alerte, fausse** — la clé factice `cle-e2e-0123456789` de
    `e2e/suites/auth.mjs` (commit 73ddb443). Rien à réécrire ; empreinte dans `.gitleaksignore`,
    et le scan est désormais vierge.
  - **Pages** : `README.md`, `README.fr.md` (captures `docs/images/bobine.png` et `bobine-fr.png`,
    prises par `pnpm e2e base` et `--lang en`, réduites à 1 600 px), `CONTRIBUTING.md`,
    `SECURITY.md` (signalement privé par « Security › Report a vulnerability » : **à activer dans
    les réglages du dépôt** ; pas d'adresse personnelle), `.github/ISSUE_TEMPLATE/` (`bug.yml`
    avec les champs `version`, `description`, `report`, `agent`, `logs` ; `feature.yml` ;
    `config.yml` qui renvoie vers l'avis de sécurité et la doc). `docs/installation.md` sans la
    ligne « dépôt privé » ; `AGENTS.md` et `docs/README.md` disent où tourne `verify`.
  - **CI** : `ci.yml` (PR, push sur `main`, `workflow_dispatch` ; `ubuntu-latest`, pnpm d'après
    `packageManager`, Node 24, identité git, `./scripts/verify`). Rien d'exclu : l'inventaire des
    tests n'a trouvé que `scripts/electron-local.test.ts` comme propre à macOS, déjà en
    `describe.skipIf`. Risque relevé : `node-pty` 1.1.0 n'a pas de prébuild Linux, `node-gyp` le
    construit (outils présents sur le runner). **Pas vérifié ici** : Docker n'est pas lancé, pas
    d'`act` ; c'est le premier passage sur GitHub qui tranchera. Écart au plan initial : les e2e
    ne sont pas rattachés au tag mais dans `e2e.yml` en `workflow_dispatch` (suites au choix,
    français puis anglais, captures en artefact), parce qu'Electron n'a jamais été piloté sur un
    runner GitHub et qu'un échec bloquerait une version.
  - **« Signaler un problème »** : `src/shared/issue-url.ts` (`issueUrl()`, limite 8 000
    caractères, coupe ligne à ligne et ajoute la ligne « rapport coupé ») et son test ; lien
    `<a class="btn small" target="_blank">` dans `DiagnosticsSettings.tsx` (le main process ouvre
    tout `https://` dans le navigateur système ; `a.btn` sans soulignement) ; version par
    `app.getInfo` ; textes `diagnostics.reportIssue`, `reportIssueHint`, `reportIssueTruncated`
    en FR et EN, mots-clés de la recherche des réglages. Suite e2e `diagnostic` : `href` attendu
    (gabarit, version de `package.json`, rapport, ≤ 8 000 caractères) et clic observé en
    remplaçant `shell.openExternal` dans le main process : verte en clair, sombre et `--lang en`,
    captures `k0-diagnostic-*` regardées. Un rapport réel fait ≈ 3 000 caractères d'adresse.
  - **Reste à l'utilisateur** : fusionner, passer le dépôt en public, activer « private
    vulnerability reporting » (Settings › Code security), regarder le premier passage de `ci.yml`
    et lancer `e2e.yml` une fois à la main.
- 2026-10-21 — **Premier passage de `ci.yml` sur GitHub** (poussée de `main`, run 39654664490) :
  lint, typecheck et 1 238 tests verts, **2 échecs** : `terminal-manager.test.ts` (« terminaux
  (vrai shell) »), `Cannot find module './prebuilds/linux-x64//pty.node'`. Cause : le risque
  relevé dans le plan, mais mal estimé. `node-gyp` ne construit rien, parce que
  `pnpm-workspace.yaml` interdit le script d'installation de `node-pty` (`allowBuilds: false`,
  voulu sur macOS où le binaire est livré), et `pnpm rebuild node-pty` respecte cette règle.
  Correction : une étape de `ci.yml` qui compile `node-pty` explicitement (`npx node-gyp@12
  rebuild` dans `node_modules/node-pty`, puis son `post-install.js`).
- 2026-10-21 — **Second passage de `ci.yml`** (run 39655556894, commit c37c938) : **vert** en
  5 min 20 (compilation de `node-pty` comprise), 1 244 tests. Seules annotations : avis de
  GitHub sur Node 20 (actions `@v4`, forcées sur Node 24, sans effet) et sur la migration
  d'`ubuntu-latest` vers Ubuntu 26. Reste à l'utilisateur : passer le dépôt en public, activer
  « private vulnerability reporting », lancer `e2e.yml` une fois à la main.
