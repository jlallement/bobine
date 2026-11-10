# 059 — `.dmg` construit par GitHub à chaque version

- **Statut** : fait
- **Dépend de** : 012, 058
- **Agents** : les deux

## Pourquoi

Construire l'app sur chaque Mac demande Node, pnpm, le téléchargement d'Electron… Un `.dmg` prêt à
installer, construit à chaque version, évite tout cela.

## Critères d'acceptation

- [x] Un tag `vX.Y.Z` poussé construit le `.dmg` sur un Mac Apple Silicon de GitHub (`verify`,
      puis `pnpm package`, signature ad hoc) et l'attache à une Release `vX.Y.Z`.
- [x] Un tag qui ne correspond pas à la version de `package.json` échoue, avec le message.
- [x] Lancement à la main (onglet Actions) : le `.dmg` en artefact, sans Release.
- [x] Doc : publier une version (`AGENTS.md`), télécharger le `.dmg` (`installation.md`).
- [x] Essayé : tag `v0.1.1`, `.dmg` téléchargé et ouvert.

## Plan

`.github/workflows/release.yml` : `actions/checkout`, `pnpm/action-setup` (version de
`packageManager`), `actions/setup-node` (Node 24, cache pnpm), contrôle tag ↔ version,
`pnpm install --frozen-lockfile`, identité git (tests), `./scripts/verify`,
`pnpm package --publish never`, `gh release create`. Dépôt privé : minutes macOS comptées dix fois
sur le quota gratuit (≈ 200 minutes de Mac par mois).

## Journal

- 2026-10-14 — Fiche créée, workflow écrit, version 0.1.1.
- 2026-10-14 — Fait. Tag `v0.1.1` : construction réussie en 3 min (`verify`, `.dmg`, Release
  `v0.1.1`). `.dmg` téléchargé par `gh release download` (127 Mo, sans quarantaine) : signature ad
  hoc vérifiée (`codesign --verify --deep --strict`), version 0.1.1, AXe 1.8.0 embarqué ;
  `e2e/packaged.mjs` passé sur l'app téléchargée (`BOB_PACKAGED_APP`, ajouté pour essayer une app
  d'ailleurs que `dist/`). Avertissement de GitHub : les actions utilisées (v4) visent Node 20,
  déprécié ; versions majeures plus récentes disponibles (`checkout` et `setup-node` v7,
  `pnpm/action-setup` v6), à passer avec un lancement d'essai.
- 2026-10-16 — Version 0.2.0. Les notes de la Release sont la section de la version dans
  `CHANGELOG.md` (fiche 073), en français ; sans section, la liste des commits faite par GitHub.
  Premier essai du tag `v0.2.0` en échec à la construction : Electron absent. Depuis 44.7.2, le
  paquet `electron` n'a plus de script d'installation (il télécharge son binaire au premier
  lancement) ; `scripts/check-electron`, appelé par `pnpm package`, le télécharge maintenant
  lui-même (`install.js` d'Electron) avant de conclure qu'il manque. Tag déplacé sur le correctif
  (aucune Release n'avait été créée).
  Second essai réussi : Release `v0.2.0` publiée (notes tirées de `CHANGELOG.md`). `.dmg` téléchargé
  par `gh release download` (127 Mo) : version 0.2.0, signature ad hoc vérifiée
  (`codesign --verify --deep --strict`), `e2e/packaged.mjs` passé sur l'app du `.dmg` monté
  (`BOBINE_PACKAGED_APP`, nouveau nom de `BOB_PACKAGED_APP`).
- 2026-10-19 — Version 0.3.0 (fiches 074 à 082). Tag `v0.3.0` : construction réussie du premier
  coup (contrôle tag ↔ version, `verify`, `.dmg`, Release publiée, notes tirées de
  `CHANGELOG.md`). `.dmg` téléchargé par `gh release download` (127 Mo, sans quarantaine, somme de
  contrôle valide) et monté en lecture seule : version 0.3.0, `dev.bobine.app`, signature ad hoc
  vérifiée (`codesign --verify --deep --strict`), AXe 1.8.0 embarqué ; `e2e/packaged.mjs` passé sur
  l'app du `.dmg` (`BOBINE_PACKAGED_APP`), IBM Bob et OpenCode trouvés. Les actions du workflow
  sont toujours en v4 (Node 20 déprécié, voir plus haut).
- 2026-10-22 — Version 0.4.0 préparée (package.json, sections des deux changelogs, « Limites
  connues » : proxy en minuscules, fiche 104). Tag `v0.4.0` à poser après les essais réels des
  fiches 103, 108, 109 et 112.
- 2026-10-23 — Version 0.5.0 préparée (package.json, sections des deux changelogs, « Limites
  connues » : liens localhost, `prompt()`, PR sans distant, coût des filles Bob, langue d'une réponse,
  proxy en minuscules). Campagne de recette et lot de corrections : `docs/recettes/`, fiches 121 à
  127 ; suite e2e complète et `verify` verts sur ce commit. Tag `v0.5.0` à poser par Jérôme.
- 2026-10-27 — Préparation de la 0.6.0 macOS uniquement (fiche 152) : numéro et notes FR/EN
  consolidées, publication Linux différée. Validation, publication et recette du DMG à consigner
  dans la fiche 152.
- 2026-10-27 — Contrôle du livrable avant publication (fiche 152) : le workflow vérifie que
  Node et le binaire de l’app montée depuis le DMG sont ARM64, puis exécute l’essai packagé
  natif. `e2e/packaged-ci.mjs` fournit un HOME/profil shell jetable et une commande `opencode`
  factice externe à l’app, qui lance l’agent ACP factice du dépôt via Node. Même vérification de
  l’absence du profil factice dans le paquet, aucun vrai agent ni modèle nécessaire. Capture
  de l’essai en artefact ; tout échec précède la création de la Release. Le DMG local construit
  avec Electron Intel sur un hôte Intel n’est pas un livrable ARM64, même si son nom le prétend.
- 2026-10-27 — **0.6.0 publiée** : tag `v0.6.0` (`180ca49`), workflow 40519611305 vert,
  seul DMG macOS arm64 joint (Linux désactivé). Contrôle natif de l’app du DMG dans le runner
  ARM64 à agent factice vert avant publication. DMG publié téléchargé et monté en lecture seule :
  SHA-256 GitHub concordant, version 0.6.0, Mach-O arm64, signature ad hoc stricte valide. Capture
  native regardée ; détails de recette et empreinte dans la fiche 152.
- 2026-10-30 — **0.7.0 publiée** : tag `v0.7.0` (`09a496c`), workflow 41081296573 vert, seul DMG
  macOS arm64 joint. Deux essais avant : typage d'un test (`verify`), puis démontage du DMG après
  l'essai natif (« Resource busy ») : il réessaie désormais, puis force. DMG publié téléchargé et
  monté en lecture seule : SHA-256 GitHub concordant, version 0.7.0, Mach-O arm64, signature ad
  hoc stricte valide (fiche 162).
- 2026-11-10 — Préversions et dépôt public (fiche 218). Procédure inchangée pour une version
  `X.Y.Z`, avec deux précisions : **pousser `main` avant le tag** (job `guard` : un tag dont le
  commit n'est pas sur `main` ne publie rien) ; une version `X.Y.Z-beta.N` (ou `-rc.N`) suit le
  même chemin — titre `## 1.0.0-beta.1 — date` dans les deux changelogs, tag `v1.0.0-beta.1` — et
  sa Release est marquée **préversion** (jamais « Latest » : `releases/latest` reste la dernière
  version finale). Le workflow a changé de forme : construction (`dmg`, `linux`) sans jeton en
  écriture, fichiers déposés en artefacts, puis job `publish` seul en écriture ; Linux (s'il est
  activé) se construit en parallèle du `.dmg`, et son échec ne publie rien.
- 2026-11-10 — Notes de la Release en anglais puis en français (fiche 220) : section de la
  version dans `CHANGELOG.en.md`, puis dans `CHANGELOG.md` ; liste des commits de GitHub
  seulement si aucune des deux n'existe.
