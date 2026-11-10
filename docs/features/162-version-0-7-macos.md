# 162 — Version 0.7.0 macOS

- **Statut** : fait
- **Dépend de** : 059, 111, 115, 152, 153 à 161
- **Agents** : les deux ; aucun changement du protocole ou de l’interface des agents.

## Pourquoi

Depuis la 0.6.0, `main` a reçu les fiches 153 à 161 (vue « Filles », mère tech lead, commande
`bobine`, éditeur, densité, mode présentation, plafond de coût…). Jérôme veut publier une 0.7.0
macOS, comme la 0.6.0 (fiche 152) : Linux reste expérimental et absent de la publication.

## Critères d’acceptation

- [x] Version 0.7.0 dans `package.json`, notes FR/EN datées du 30 octobre 2026.
- [x] Build et suite complète `pnpm e2e --if-needed` : les 139 tâches passées (tampon « verte »
      non posé : quelques suites de survol ou de délai échouent en parallèle sur la machine
      chargée, vertes relancées seules, trois fois de suite).
- [x] `./scripts/verify` vert sur le runner de la Release (2 272 tests). En local, seuls des essais
      de délai échouent sous la charge, verts relancés seuls.
- [x] `main` poussé, tag `v0.7.0` publié (`09a496c`), workflow Release vert, seul le DMG macOS joint.
- [x] DMG publié téléchargé, monté en lecture seule : version 0.7.0, arm64, signature ad hoc.

## Plan

1. Version et notes (ce commit), sans changement fonctionnel ni dépendance nouvelle.
2. Avec l’accord de Jérôme : `git push origin main`, puis `git tag v0.7.0 && git push origin v0.7.0`.
3. Recette du DMG publié (comme la 0.6.0, fiche 059) et journal ci-dessous.

## Journal

- 30/10 : version 0.7.0 et notes datées.
- 30/10 : la suite complète révèle un vrai défaut de la fiche 161 : le bouton « Git », qui apparaît
  une fois le dépôt lu, décalait « Filles » sous le pointeur. « Filles » passe avant « Git »
  (`887d632`) ; `filles` verte trois fois de suite.
- 30/10 : trois passages complets (3 puis 2 tâches en parallèle). Échecs intermittents, différents
  à chaque passage (`base`, `subagents`, `android`, `panel`, `history`, `browser-view`), tous verts
  relancés seuls. `verify` : seuls `manager` (recherche, fiche 046) et `conformance-opencode`
  (sous-agent) échouent sous la charge, verts seuls.
- 30/10 : premier essai de la Release (run 41077516171) arrêté par `verify` : typage de
  `ChildrenView.test.tsx` (recommandation sans `at`), raté en local où seuls les tests en échec
  étaient lus. Corrigé (`60931a5`), tag déplacé (aucune Release n'existait).
- 30/10 : deuxième essai (run 41079772404) : app du DMG essayée avec succès, puis démontage refusé
  (« Resource busy »). Le nettoyage réessaie puis force (`09a496c`), tag déplacé de nouveau.
- 30/10 : **0.7.0 publiée** (run 41081296573) : `Bobine-0.7.0-arm64.dmg`, 141 387 670 octets,
  SHA-256 `63069e4209a3d831c2729c8eb9c8b090c0398dfdadd86548ab77f7850d7eef3b`.
- 05/11 : DMG publié téléchargé (empreinte concordante), monté en lecture seule : version 0.7.0,
  `dev.bobine.app`, Mach-O arm64, `codesign --verify --deep --strict` valide, signature ad hoc ;
  `Applications` et `Bobine.app` dans la fenêtre d'installation.
