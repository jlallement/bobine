# ADR-0074 — Plancher d'Electron : une version minimale tenue à côté de la version fixée

- **Statut** : accepté (2026-11-26 : choix de Jérôme « Plancher tenu »)
- **Date** : 2026-11-26
- **Complète** : [ADR-0057](0057-politique-de-montee-de-version.md) (sans le modifier)
- **Fiches** : [288](../features/288-plancher-electron.md), [065](../features/065-installation-hors-ligne.md)

## Contexte

L'ADR-0057 fixe Electron à une version exacte (45.4.1, correctifs de sécurité de Chromium et V8)
et `pnpm electron-local` (fiche 065) n'accepte que cette version. Sur un Mac au réseau verrouillé,
ni Electron ni le `.dmg` ne se téléchargent ; l'utilisateur y dispose de l'archive officielle
d'Electron **45.2.3** et ne peut donc ni lancer ni construire l'app sans modifier le dépôt
(`package.json`, lockfile, avis de licence). Le 2026-11-26, 45.2.3 a été essayé sur le tag
`v1.2.0-beta.3` : suite e2e complète verte (131/131), app construite et `pnpm e2e:packaged` vert.

## Décision

1. **Le plancher** est une version d'Electron exacte, plus ancienne que la version fixée et de la
   même majeure, écrite dans `scripts/electron-floor.json` avec les empreintes SHA-256 officielles
   de ses archives macOS (recopiées du `SHASUMS256.txt` publié par Electron). C'est la seule
   source : scripts et CI la lisent. Pour Electron 45 : **45.2.3**.
2. **Deux versions acceptées, pas une plage** : la version fixée (comportement inchangé) et le
   plancher. `pnpm electron-local` installe l'archive du plancher après avoir vérifié son
   empreinte hors ligne contre celles du dépôt ; toute autre version est refusée, avec la raison.
   On ne prétend soutenir que ce qui est essayé.
3. **Les binaires publiés restent sur la version fixée.** Le plancher sert à construire l'app sur
   place ; pas de version de Bobine ni de `.dmg` à part.
4. **Construire sur le plancher ne modifie pas le dépôt.** Le paquet npm `electron` reste celui de
   la version fixée (typages compris) ; seul son `dist/` vient du plancher. L'app construite
   embarque des avis de licence qui nomment l'Electron réellement livré, écrits hors du dépôt ;
   `third-party-notices --check` reste strict pour la version fixée.
5. **Dit à chaque fois** : `check-electron` (avant `pnpm dev`, `pnpm e2e`, `pnpm package`…),
   `electron-local` et `pnpm package` disent que l'Electron installé est le plancher et qu'une app
   construite dessus n'a pas les correctifs de sécurité de la version fixée.
6. **Essayé** : une fumée sur le plancher (journées `parcours-*`, `pnpm package --dir`,
   `pnpm e2e:packaged`, dépôt propre) sur un Mac de GitHub (`electron-floor.yml`).
7. **Monter le plancher** est une décision annoncée dans les nouveautés (`CHANGELOG.md`, « Prochaine
   version ») : quelqu'un qui construit sur l'ancien plancher doit obtenir une autre archive.
8. **Plancher redéfini à chaque majeure d'Electron** (ADR-0057, point 1) : un plancher d'une autre
   majeure que la version fixée est refusé (essai de cohérence dans `verify`, refus dans
   `electron-local`) ; la fiche de la montée de majeure fixe le nouveau plancher, ou le retire.

## Réserve de sécurité

Une app construite sur le plancher n'a pas les correctifs de sécurité publiés entre le plancher et
la version fixée (pour 45.2.3 → 45.4.1 : correctifs de Chromium et de V8). Elle charge des pages
web (navigateur intégré, aperçus) : c'est un risque accepté pour la personne qui construit sur
place, dit par l'app à la construction, jamais imposé aux binaires publiés. Le plancher n'est pas
une version qu'on recommande : c'est la version la plus ancienne avec laquelle l'app est essayée.

## Alternatives écartées

- **Changer la version d'Electron dans `package.json` sur la machine** (essai du 2026-11-26) —
  salit le dépôt (`package.json`, lockfile, avis) et demande `pnpm install --no-frozen-lockfile` :
  ni reproductible ni vérifiable par la CI.
- **Une plage de versions acceptées** — on prétendrait soutenir des versions jamais essayées.
- **Une préversion ou un `.dmg` construit sur le plancher** — deux binaires à publier et à
  suivre, pour un besoin qui est de construire sur place.
- **Assouplir `third-party-notices --check`** — le contrôle du fichier committé resterait juste
  pour la version fixée mais les avis livrés mentiraient sur le plancher.

## Conséquences

- Une valeur de plus à tenir à chaque montée de majeure d'Electron (point 8).
- Le code de l'app est typé contre la version fixée : une API apparue après le plancher dans la
  même majeure passerait `typecheck` ; seule la fumée sur le plancher le verrait.
- La fumée sur le plancher ne tourne que si on la lance ; la faire tourner chaque nuit sur la ligne
  1.2 demande un déclencheur sur `main` (branche par défaut, seule à recevoir `schedule`) : choix
  laissé ouvert dans la fiche 288.
