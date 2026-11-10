# 184 — Version 0.9.0 macOS

- **Statut** : fait
- **Dépend de** : 059, 111, 174, 175 à 181, 183
- **Agents** : les deux ; SDK ACP 2.4 (fiche 181), sans changement de ce que voient IBM Bob et
  OpenCode.

## Pourquoi

Depuis la 0.8.0, `main` a reçu les fiches 175 à 181 :
- préparation des worktrees ;
- suivi de la PR et de la CI ;
- « Faire relire » ;
- tâches planifiées ;
- plusieurs dossiers par conversation ;
- aparté ;
- SDK ACP 2.4 derrière un seul module.

L'utilisateur a demandé une 0.9 publiée seulement après une recette par un rôle QA distinct
(fiche 183) sans rien de bloquant. Linux reste expérimental et absent de la publication, comme
pour la 0.8.0 (fiche 174).

## Critères d'acceptation

- [x] Recette 0.9 (fiche 183) : verdict « peut partir ». D1 à D6 et D12 à D14 sont corrigés et
      rejoués. D7 à D11, mineurs, sont reportés.
- [x] Version 0.9.0 dans `package.json`, notes FR/EN datées du 6 novembre 2026.
- [x] Sondes sur SDK 2.4 :
  - `pnpm bob-probe` vert, 10/10 ;
  - `pnpm opencode-probe --offline` vert ;
  - `opencode-probe` avec `openai/gpt-6.1-sol` vert, 21/21, identique à la 1.9.
- [x] Build et suite complète `pnpm e2e --if-needed` verte sur le commit de version (157/157) ;
      suite anglaise complète jouée par la recette (verte après D12).
- [x] `main` poussé, tag `v0.9.0` publié, workflow Release vert, seul le DMG macOS joint.
- [x] DMG publié téléchargé, monté en lecture seule : version 0.9.0, arm64, signature ad hoc.

## Plan

1. Version et notes, sans changement fonctionnel ni dépendance nouvelle.
2. Avec l'accord de l'utilisateur, donné le 2026-11-06 (« Seulement quand tout est ok, release
   la version 0.9 »), après le verdict de la recette :
   - `git push origin main` ;
   - puis `git tag v0.9.0 && git push origin v0.9.0`.
3. Recette du DMG publié (comme la 0.8.0, fiche 174) et journal ci-dessous.

## Journal

- 2026-11-06 — Fiches 175 à 181 relues par la session mère (tech lead) et fusionnées. Sur `main`
  à `8d63d17` :
  - `verify` vert ;
  - e2e complète 157/157.
- 2026-11-06 — Recette QA (fiche 183) : 1 défaut bloquant, 3 majeurs et 8 mineurs ou
  cosmétiques au premier passage, puis D13 et D14 avec le vrai OpenCode. Corrections :
  - D1 à D4 et D6 : fiche 175 ;
  - D5 : fiche 180 ;
  - D12 : fiche 178 ;
  - D13 et D14 : fiche 179.

  Corrections relues et fusionnées (`8b4ec04`), rejouées par la recette : verdict « peut partir ».
- 2026-11-06 — Rapport de recette fusionné (`0d6225c`), `pnpm build && pnpm e2e --if-needed` :
  157/157 en 9 min 42 s. Version 0.9.0 et notes datées.
- 2026-11-06 — Tag `v0.9.0` sur `51dd3ce` : workflow Release en échec deux fois, à l'étape
  `verify` du runner macOS. Le test « worktree à demi écrit » (fiche 138) passait localement.
  Cause : la maintenance automatique de git, lancée en arrière-plan après le commit de la
  fixture, effaçait sur le runner le worktree planté avant `worktree add`. Corrigé (`5230c83`) :
  maintenance coupée dans la fixture, garanties de Bobine vérifiées que git refuse ou crée. Vert
  5 fois de suite sur le runner. Aucune release n'existait : avec l'accord de l'utilisateur, tag
  supprimé et reposé sur `5230c83`, workflow Release vert (run 42243052806).
- 2026-11-06 — Recette du livrable :
  - seul actif `Bobine-0.9.0-arm64.dmg`, 142 031 349 octets ;
  - SHA-256 `d42d75cb6167ee84949fd42f6dd56aa93bc672a6578d2dc897cc3c919d5113da` ;
  - `hdiutil verify` valide ;
  - monté en lecture seule : version 0.9.0, arm64, signature ad hoc (runtime renforcé).

## Écarts au plan

- Le suivi de la PR (176) n'a pas été essayé contre le vrai GitHub. Le dépôt privé
  `jlallement/bobine-qa-0-9` existe, mais les permissions de la session QA ont refusé de piloter
  l'app contre lui. Le suivi reste vérifié par le faux `gh` seulement.
- Le tag `v0.9.0` a été déplacé une fois (de `51dd3ce` à `5230c83`), avant toute release.
