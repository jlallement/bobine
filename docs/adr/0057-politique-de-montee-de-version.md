# ADR-0057 — Politique de montée de version

- **Statut** : proposé
- **Date** : 2026-11-19

## Contexte

Bobine n'a pas de mise à jour automatique : un binaire installé vit longtemps chez les testeurs.
Les montées se faisaient au fil des lots (fiches 143, 169, 172, 231, 233), sans règle écrite.
L'audit du 2026-11-19 (B7, LCM-1, 3, 6) en relève les trous :

- Electron 45.4.1 (correctifs Chromium et V8, publiée le 2026-11-19) est refusée un jour par le
  délai `minimumReleaseAge` de pnpm 12 ; les fiches 169 (exception gardée pour Electron) et 221
  (« pas d'exception ») se contredisent ; la fiche 252 a dû rester en 45.3.4.
- Electron 45 sort du support le **2027-04-27** (trois majeures prises en charge à la fois).
- Les bibliothèques livrées dans l'app sont des `devDependencies` (empaquetées par Vite) :
  `pnpm audit --prod` n'en voit presque rien.
- Dependabot ne voit ni AXe (`scripts/fetch-axe`, version et empreinte en dur), ni l'outillage
  NSIS d'electron-builder, ni (avant la fiche 252) l'image Docker des essais Linux.

## Décision

1. **Majeure d'Electron prise en charge** : l'app livrée tourne toujours sur une majeure encore
   prise en charge par Electron. On passe à la suivante (46, ou 47 si elle est stable) **au moins
   un mois avant** la fin du support de la majeure en cours : pour Electron 45, avant le
   2027-03-27. Une majeure d'Electron = sa fiche, `pnpm e2e` complète, `pnpm e2e:packaged`.
2. **Correctif de sécurité de Chromium ou V8** (notes d'Electron « Backported fixes from
   upstream … Chromium … V8 », ou avis de sécurité) : repris **sous 3 jours** après sa
   publication sur npm. Si une version est attendue avant la fin du délai de pnpm, une exception
   exacte et commentée `minimumReleaseAgeExclude: electron@X.Y.Z` (jamais une plage, jamais un
   autre paquet) est permise dans `pnpm-workspace.yaml`, retirée dès le délai écoulé. Toute autre
   montée attend le délai, sans exception.
3. **Alertes** : on trie sur `pnpm audit` **complet** (sans `--prod`). Pour chaque alerte :
   livrée dans l'app (`scripts/third-party/inventory.json`) ou outillage seulement ; correctif,
   override ciblé (comme minimatch, fiche 233) ou écart motivé dans une fiche.
4. **Gel du SDK ACP pendant une rc** : `@agentclientprotocol/sdk` en version exacte de la
   première rc jusqu'à la version finale ; une montée seulement pour un défaut bloquant, avec
   `pnpm opencode-probe` et `pnpm bob-probe`.
5. **Suivi à la main** de ce que Dependabot ne voit pas : AXe (`scripts/fetch-axe`), outillage
   NSIS et binaires tirés par electron-builder, version de Bob et d'OpenCode (ADR-0053).
6. **Vérification mensuelle** (premier lundi) : `pnpm view electron dist-tags`, date de fin de
   support de la majeure, `pnpm audit`, `pnpm outdated`, le point 5 ; ce qui est à faire va dans
   une fiche de lot.

## Alternatives écartées

- **Aucune exception au délai de pnpm** — un correctif Chromium attendrait sans raison ; le
  délai protège d'un paquet piégé, l'exception reste limitée à une version d'Electron relue.
- **Supprimer le délai de pnpm** — perd la protection pour tous les paquets.
- **Suivre chaque nouvelle majeure d'Electron dès sa sortie** — trop de risque pour une rc, sans
  bénéfice tant que la majeure en cours est prise en charge.

## Conséquences

- Une règle à appliquer à chaque lot de dépendances ; la fiche du lot dit laquelle s'applique.
- Pour la 1.0 : passer à Electron 46 (ou 47) avant le 2027-03-27, à planifier dans une fiche.
- Le gel du SDK ACP retarde les nouveautés du schéma (la 2.8, schéma 1.33) après la version finale.
- L'exception au délai de pnpm est un point de vigilance de relecture : une version exacte, un
  commentaire, une date de retrait.
