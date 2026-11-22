# 274 — Avis de nouvelle version

- **Statut** : à faire (spec, ADR et maquettes à valider par Jérôme avant tout code)
- **Dépend de** : 073 (installation et corbeille de l'ancienne app), 074 et 136 (Réglages ›
  Nouveautés), 194 (avis de l'app), 196 (profil en lecture seule), 218 (préversions) ; ADR-0023,
  ADR-0066 (proposé) ; risque R5 de la fiche 187 ; issue GitHub #19
- **Agents** : aucun (fonction de l'app, sans lien avec l'agent ni avec ACP)

## Pourquoi

Bobine ne se met pas à jour toute seule (ADR-0023) et ne dit pas qu'une version plus récente
existe. Un utilisateur reste donc sur une version boguée sans le savoir (R5, fiche 187, criticité
15 ; cible : 1.0 finale). Bobine doit **prévenir**, sobrement et au plus une fois par version, et
laisser l'utilisateur installer lui-même la nouvelle version depuis sa page GitHub. Rien ne se
télécharge ni ne s'installe.

## Décisions de Jérôme (2026-11-22)

- **Quand.** Bobine interroge l'API publique de GitHub, sans compte ni jeton :
  `GET https://api.github.com/repos/jlallement/bobine/releases`. La vérification est automatique
  au lancement, au plus une fois par 24 h ; la date de la dernière vérification est gardée dans le
  profil. Un réglage la coupe ; il est activé par défaut.
- **Silence.** Hors ligne, en cas d'erreur, de réponse illisible ou de limite atteinte, rien ne
  s'affiche : une ligne au journal, c'est tout.
- **Pas d'installation.** L'avis ouvre la page de la version dans le navigateur du Mac.
  L'adresse est vérifiée : `https://github.com/jlallement/bobine/releases/tag/<tag>`.
- **Préversions.** Elles dépendent de la version installée :
  - une préversion (`-rc.N`, `-beta.N`) est avertie des préversions suivantes et de la version
    finale ;
  - une version finale n'est avertie que des versions finales.

  La comparaison suit semver strictement, et les brouillons sont ignorés.
- **Une fois par version.** « Plus tard » ou la fermeture de l'avis ne le remontre plus pour
  cette version-là. Une version plus récente fait revenir l'avis.

Décision d'architecture : **ADR-0066** (proposé), qui remplace en partie l'ADR-0023 sur un seul
point, « aucun appel réseau de version ».

## Maquettes

`docs/maquettes/274-avis-nouvelle-version.html` (clair et sombre, sélecteur en haut ; textes en
français, écran principal et réglage aussi en anglais). Captures dans
`docs/maquettes/274-avis-nouvelle-version/` (`<écran>-clair.png`, `<écran>-sombre.png`) :

| Écran | Contenu |
|---|---|
| `option-a` | **Recommandée.** Une ligne discrète en bas de la barre latérale, au-dessus du pied de l'agent : « Bobine 1.0.1 est disponible », puis « Voir » et ✕ (Plus tard) |
| `option-a-en` | La même, en anglais |
| `option-b` | Un avis non bloquant en haut de la fenêtre, avec le composant des avis de l'app (fiche 194) |
| `reglages-a-jour` | Réglages › Nouveautés : interrupteur, date de dernière vérification et « Vérifier maintenant » ; résultat « à jour » |
| `reglages-nouvelle-version` | Le même écran, avec une nouvelle version (préversion installée → version finale) |
| `reglages-echec` | Le même écran, quand la vérification lancée à la main échoue |
| `reglages-en` | Le réglage en anglais (nouvelle version) |

**Option recommandée : A.** La ligne de la barre latérale ne couvre ni le fil ni la saisie, ne
s'anime pas et reste où l'œil revient naturellement (près de Réglages), jusqu'à ce que
l'utilisateur la ferme. L'option B reprend un composant qui existe déjà, mais elle se pose
par-dessus la conversation, avec le poids d'un incident (« Bobine a rencontré un problème »),
pour une information qui n'est pas urgente.

## Critères d'acceptation

Comportement :

- [ ] Au lancement, si le réglage est actif, que la dernière vérification réussie date de plus de
  24 h et que le profil n'est pas en lecture seule, Bobine fait **une** requête
  `GET /repos/jlallement/bobine/releases?per_page=30`, quelques secondes après l'ouverture de la
  fenêtre principale, sans retarder le lancement.
- [ ] La requête part sans cookie, jeton ni identifiant. Elle porte seulement les en-têtes
  `User-Agent: Bobine/<version>`, `Accept: application/vnd.github+json` et
  `X-GitHub-Api-Version`. Elle a un délai court (10 s), une réponse bornée (1 Mio) et ne suit
  aucune redirection hors de `api.github.com`.
- [ ] Les brouillons (`draft: true`) sont ignorés, ainsi que les étiquettes qui ne sont pas du
  semver strict (`vX.Y.Z` ou `vX.Y.Z-<pré>`).
- [ ] Une version **finale** installée n'est avertie que d'une version finale plus récente. Une
  **préversion** installée l'est de toute version plus récente, préversion ou finale ; on prend la
  plus haute. Une étiquette sans `-` mais marquée `prerelease` par GitHub compte comme une
  préversion (prudence pour les versions finales).
- [ ] Une release dont la page (`html_url`) n'est pas exactement
  `https://github.com/jlallement/bobine/releases/tag/<tag_name encodé>` est ignorée, avec une ligne
  au journal.
- [ ] Hors ligne, en cas d'erreur HTTP (403 ou 429 de la limite comprises), de délai dépassé, de
  JSON illisible ou de réponse trop grosse : aucun affichage automatique, une ligne
  `[update-check]` au journal. La date de dernière vérification réussie ne bouge pas, et le
  prochain lancement réessaie.
- [ ] Une nouvelle version fait apparaître la ligne de la barre latérale (option A) : « Bobine
  X.Y.Z est disponible », avec « préversion » si c'en est une. « Voir » ouvre la page vérifiée
  dans le navigateur du Mac. ✕ (Plus tard) masque la ligne pour cette version, même après
  relance ; une version plus récente la fait revenir.
- [ ] Réglages › Nouveautés : interrupteur « Vérifier les nouvelles versions » (activé par défaut),
  « Dernière vérification : … », bouton « Vérifier maintenant ». Le bouton marche même quand
  l'interrupteur est coupé, puisque c'est un geste explicite. États montrés : en cours, à jour,
  nouvelle version (« Voir la version »), échec (raison courte, sans détail technique). Ce
  dernier état n'apparaît **que** pour une vérification lancée à la main.
- [ ] Interrupteur coupé : aucune requête automatique ; la ligne déjà affichée disparaît.
- [ ] Profil en lecture seule (fiche 196) : pas de vérification automatique, rien n'est écrit.
  « Vérifier maintenant » affiche le résultat sans le garder.

Sécurité :

- [ ] Aucune donnée de l'utilisateur n'est envoyée : ni chemin, ni nom, ni identifiant de profil
  ou de machine. La version de l'app (dans le `User-Agent`) et l'adresse IP, que GitHub voit
  forcément, sont les seules informations transmises.
- [ ] Le renderer n'ouvre jamais d'adresse lui-même : il demande au main « ouvrir la page de la
  version X ». Le main ouvre l'adresse qu'**il** a vérifiée et gardée, et revérifie hôte et chemin
  juste avant `shell.openExternal`.
- [ ] Ce qui vient de GitHub (nom de la release, notes) n'est **jamais** rendu en HTML ni en
  Markdown. Seule l'étiquette de version, validée par l'expression semver, est affichée, comme du
  texte React. Les notes ne sont ni gardées ni affichées : elles sont dans la page GitHub et dans
  Réglages › Nouveautés de la version suivante.
- [ ] Une adresse de flux de remplacement (`BOBINE_RELEASES_URL`, réservée aux essais) n'est
  acceptée que vers `http://127.0.0.1` ou `http://localhost`. Elle ne change jamais la règle de la
  page ouverte.

Essais :

- [ ] Unitaires, sans réseau (`fetch` injecté) :
  - choix de la version (final/final, pré/pré, pré/final, final/pré ignorée, brouillon, étiquette
    invalide, `html_url` piégée : autre hôte, autre dépôt, `..`, `@`, schéma `http`) ;
  - délai de 24 h, échec silencieux, « Plus tard » par version, lecture seule ;
  - taille bornée et délai dépassé.
- [ ] e2e `nouvelle-version` contre un **faux serveur de versions local**, lancé par l'essai, avec
  l'app en clair et en sombre :
  - la ligne apparaît ; « Voir » est noté par `BOBINE_OPEN_LOG` avec la bonne adresse ;
  - ✕ la masque, et elle ne revient pas à la relance ;
  - à jour ; échec seulement en manuel ; interrupteur coupé → aucune requête reçue.

  **Jamais GitHub en essai.** `e2e/lib.mjs` fixe par défaut `BOBINE_RELEASES_URL` vers un port
  local fermé, pour qu'aucune autre suite ne sorte sur Internet.
- [ ] Captures de la suite regardées, clair et sombre.

## Plan

Aucune nouvelle dépendance : `net.fetch` d'Electron (proxy du système, comme Chromium),
`AbortSignal.timeout`, lecture du corps par morceaux avec plafond, et l'ordre semver de
`src/main/semver.ts`, complété d'une lecture stricte.

1. **Partagé** — `src/shared/update-check.ts` (pur, sans Electron) :
   - types `UpdateCheckView` (`enabled`, `lastCheckedAt?`, `status` : `idle` | `checking` |
     `up-to-date` | `available` | `failed`, `available?` : `{ version, prerelease }`,
     `dismissedVersion?`, `failure?` : `offline` | `limit` | `unreadable`) ;
   - `parseStrictVersion`, `pickUpdate(releases, installed)`, `isReleasePageUrl(url, tag)`.

   Préférence `updateCheck: boolean` (défaut `true`) dans `src/shared/preferences.ts`.
2. **Main** :
   - `src/main/update-check.ts` : `createUpdateChecker(deps)`, avec `fetchReleases`, `now`,
     `store`, `appVersion`, `readOnly`, `log` et `openExternal` injectés ; `checkOnLaunch()`,
     `checkNow()`, `dismiss(version)`, `openRelease(version)`, `view()` et l'évènement de
     changement ;
   - `src/main/update-check-electron.ts` : `net.fetch` (délai, plafond, en-têtes, refus d'une
     redirection hors `api.github.com`), adresse de remplacement locale pour les essais ;
   - état dans `update-check.json` du profil (`lastCheckedAt`, `dismissedVersion`, dernière version
     disponible et son adresse vérifiée), écrit de façon atomique comme les autres fichiers du
     profil, et ignoré s'il est illisible ;
   - branchement dans `src/main/index.ts` après l'ouverture de la fenêtre principale ; journal
     `[update-check]` (`src/main/log.ts`).
3. **IPC typé** (`src/shared/ipc.ts`, `src/main/app-ipc.ts`, `src/preload/api.ts`) :
   - `updates:view` → `UpdateCheckView` ;
   - `updates:check` → `UpdateCheckView` ;
   - `updates:dismiss` (`version`) ;
   - `updates:open` (`version`, refusé si ce n'est pas la version disponible connue) ;
   - évènement `updates:changed`.

   La préférence passe par le canal des préférences qui existe déjà.
4. **Renderer** :
   - `components/sidebar/UpdateLine.tsx` (ligne au-dessus de `.sidebar-footer`, dans
     `Sidebar.tsx`) ;
   - `components/settings/UpdateCheckCard.tsx` (carte sous l'en-tête de `AboutSettings.tsx`) ;
   - styles sur les jetons existants ;
   - clés `updates.*` dans `fr.json` et `en.json` (glossaire de `docs/traduction.md`) ;
   - recherche des réglages (`settings-search`) : « mise à jour », « version ».
5. **Essais** :
   - `src/shared/update-check.test.ts`, `src/main/update-check.test.ts`, composants (jsdom) ;
   - faux serveur `e2e/fixtures/faux-versions.mjs` (liste construite à partir de la version de
     l'app essayée) ;
   - suite `e2e/suites/nouvelle-version.mjs` (catalogue) ;
   - `BOBINE_RELEASES_URL` par défaut dans `e2e/lib.mjs`.
6. **Docs** :
   - `docs/architecture.md` (module, canal, seul appel réseau de l'app vers GitHub) ;
   - guide `docs/guide/{fr,en}/reglages.md` et FAQ des README (« pas de télémétrie » reste vrai,
     mais une vérification de version existe et se coupe) ;
   - `CHANGELOG.md` et `CHANGELOG.en.md` ;
   - fiche 187 (R5) ; ADR-0066 accepté.

## Points ouverts (à trancher par Jérôme)

1. **Option A ou B** pour l'avis (recommandée : A).
2. **« Voir »** ouvre la page et masque aussi l'avis pour cette version (proposé). L'information
   reste dans Réglages › Nouveautés. Autre choix : garder la ligne jusqu'à « Plus tard ».
3. **Barre latérale masquée** : rien de plus (proposé). L'avis reparaît à l'ouverture de la barre
   et reste dans les Réglages. Autre choix : une pastille sur le bouton Réglages de la barre
   repliée.
4. **Préversion installée** : avertie de toute version plus récente, une 1.1.0-beta.1 comprise
   pour une 1.0.0-rc.3 (proposé : c'est le plus simple, et qui teste une préversion veut la
   suivante). Autre choix : seulement la même ligne de version et la finale.
5. **Mention dans Réglages › Confidentialité** de ce seul appel vers GitHub, en plus de l'aide du
   réglage (proposé : oui, une ligne).

## Journal

- 2026-11-22 — Spec, ADR-0066 (proposé) et maquettes (options A et B, réglage et ses trois
  états, français et anglais), sans code. À valider par Jérôme.
