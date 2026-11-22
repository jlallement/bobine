# 274 — Avis de nouvelle version

- **Statut** : fait, à relire (maquettes et ADR-0066 validés par Jérôme le 2026-11-22)
- **Dépend de** : 073 (installation et corbeille de l'ancienne app), 074 et 136 (Réglages ›
  Nouveautés), 194 (avis de l'app), 196 (profil en lecture seule), 218 (préversions) ; ADR-0023,
  ADR-0066 ; risque R5 de la fiche 187 ; issue GitHub #19
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
  - une préversion (`-rc.N`, `-beta.N`) n'est avertie que des préversions **de sa ligne**
    (même majeure.mineure) et des versions finales plus récentes, de n'importe quelle ligne : une
    1.0.0-rc.3 apprend la rc.4, la 1.0.0 puis les 1.0.x, jamais une 1.1.0-beta ;
  - une version finale n'est avertie que des versions finales.

  La comparaison suit semver strictement, et les brouillons sont ignorés.
- **Une fois par version.** « Plus tard » ou la fermeture de l'avis ne le remontre plus pour
  cette version-là. Une version plus récente fait revenir l'avis.

Validation des maquettes et de l'ADR (2026-11-22) :

- option **A**, la ligne en bas de la barre latérale ;
- « Voir » ouvre la page **et** masque l'avis pour cette version ;
- barre latérale masquée : rien de plus, l'information reste dans les Réglages ;
- une ligne dans Réglages › Confidentialité dit ce seul appel vers GitHub.

Décision d'architecture : **ADR-0066** (accepté), qui remplace en partie l'ADR-0023 sur un seul
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

- [x] Au lancement, si le réglage est actif, que la dernière vérification réussie date de plus de
  24 h et que le profil n'est pas en lecture seule, Bobine fait **une** requête
  `GET /repos/jlallement/bobine/releases?per_page=30`, quelques secondes après l'ouverture de la
  fenêtre principale, sans retarder le lancement.
- [x] La requête part sans cookie, jeton ni identifiant. Elle porte seulement les en-têtes
  `User-Agent: Bobine/<version>`, `Accept: application/vnd.github+json` et
  `X-GitHub-Api-Version`. Elle a un délai court (10 s), une réponse bornée (1 Mio) et ne suit
  aucune redirection.
- [x] Les brouillons (`draft: true`) sont ignorés, ainsi que les étiquettes qui ne sont pas du
  semver strict (`vX.Y.Z` ou `vX.Y.Z-<pré>`).
- [x] Une version **finale** installée n'est avertie que d'une version finale plus récente. Une
  **préversion** installée l'est d'une préversion plus récente de la même majeure.mineure, ou
  d'une version finale plus récente de n'importe quelle ligne ; on prend la plus haute. Une
  étiquette sans `-` mais marquée `prerelease` par GitHub compte comme une préversion (prudence
  pour les versions finales).
- [x] Une release dont la page (`html_url`) n'est pas exactement
  `https://github.com/jlallement/bobine/releases/tag/<tag_name encodé>` est ignorée, avec une ligne
  au journal.
- [x] Hors ligne, en cas d'erreur HTTP (403 ou 429 de la limite comprises), de délai dépassé, de
  JSON illisible ou de réponse trop grosse : aucun affichage automatique, une ligne
  `[update-check]` au journal. La date de dernière vérification réussie ne bouge pas, et le
  prochain lancement réessaie.
- [x] Une nouvelle version fait apparaître la ligne de la barre latérale (option A) : « Bobine
  X.Y.Z est disponible », avec « préversion » si c'en est une. « Voir » ouvre la page vérifiée
  dans le navigateur du Mac et masque la ligne pour cette version, comme ✕ (Plus tard), même
  après relance ; une version plus récente la fait revenir.
- [x] Réglages › Nouveautés : interrupteur « Vérifier les nouvelles versions » (activé par défaut),
  « Dernière vérification : … », bouton « Vérifier maintenant ». Le bouton marche même quand
  l'interrupteur est coupé, puisque c'est un geste explicite. États montrés : en cours, à jour,
  nouvelle version (« Voir la version »), échec (raison courte, sans détail technique). Ce
  dernier état n'apparaît **que** pour une vérification lancée à la main.
- [x] Interrupteur coupé : aucune requête automatique ; la ligne déjà affichée disparaît.
- [x] Profil en lecture seule (fiche 196) : pas de vérification automatique, rien n'est écrit.
  « Vérifier maintenant » affiche le résultat sans le garder.

Sécurité :

- [x] Aucune donnée de l'utilisateur n'est envoyée : ni chemin, ni nom, ni identifiant de profil
  ou de machine. La version de l'app (dans le `User-Agent`) et l'adresse IP, que GitHub voit
  forcément, sont les seules informations transmises.
- [x] Le renderer n'ouvre jamais d'adresse lui-même : il demande au main « ouvrir la page de la
  version X ». Le main ouvre l'adresse qu'**il** a vérifiée et gardée, et revérifie hôte et chemin
  juste avant `shell.openExternal`.
- [x] Ce qui vient de GitHub (nom de la release, notes) n'est **jamais** rendu en HTML ni en
  Markdown. Seule l'étiquette de version, validée par l'expression semver, est affichée, comme du
  texte React. Les notes ne sont ni gardées ni affichées : elles sont dans la page GitHub et dans
  Réglages › Nouveautés de la version suivante.
- [x] Une adresse de flux de remplacement (`BOBINE_RELEASES_URL`, réservée aux essais) est
  ignorée dans l'app packagée, et n'est acceptée que vers `http://127.0.0.1` ou
  `http://localhost`. Elle ne change jamais la règle de la page ouverte. `BOBINE_UPDATE_CHECK=off`
  coupe la vérification automatique (essais de l'app packagée, comme `BOBINE_QUOTA=off`).
- [x] Réglages › Confidentialité dit ce seul appel vers GitHub, et renvoie au réglage.

Essais :

- [x] Unitaires, sans réseau (`fetch` injecté) :
  - choix de la version (final/final, pré/pré, pré/final, final/pré ignorée, brouillon, étiquette
    invalide, `html_url` piégée : autre hôte, autre dépôt, `..`, `@`, schéma `http`) ;
  - délai de 24 h, échec silencieux, « Plus tard » par version, lecture seule ;
  - taille bornée et délai dépassé.
- [x] e2e `nouvelle-version` contre un **faux serveur de versions local**, lancé par l'essai, avec
  l'app en clair et en sombre :
  - la ligne apparaît (pièges ignorés) ; la requête reçue n'a ni cookie ni jeton ;
  - ✕ la masque ; « Voir la version » ouvre la page vérifiée (ouverture observée en remplaçant
    `shell.openExternal` dans le main) ; à la relance, ni requête ni avis ;
  - à jour ; échec seulement en manuel ; échec automatique silencieux ; réglage coupé → aucune
    requête reçue.

  **Jamais GitHub en essai.** `e2e/lib.mjs` fixe par défaut `BOBINE_RELEASES_URL` vers un port
  local fermé, pour qu'aucune autre suite ne sorte sur Internet.
- [x] Captures de la suite regardées, clair et sombre.

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

## Journal

- 2026-11-22 — Spec, ADR-0066 (proposé) et maquettes (options A et B, réglage et ses trois
  états, français et anglais), sans code. À valider par Jérôme.
- 2026-11-22 — Jérôme tranche : option A ; « Voir » masque aussi l'avis ; préversions de la même
  majeure.mineure seulement (finales de toute ligne) ; ADR-0066 accepté, avec une ligne dans
  Réglages › Confidentialité ; rien de plus quand la barre latérale est masquée.
- 2026-11-22 — Implémenté (branche `feat/r5-avis-nouvelle-version`).
  - Partagé : `src/shared/update-check.ts` (semver strict, `pickUpdate`, page vérifiée) ;
    préférence `updateCheck` (oui par défaut).
  - Main : `update-check.ts` (sans Electron), `update-check-electron.ts` (`net.fetch`, 10 s,
    1 Mio lu par morceaux, `credentials: 'omit'`, `redirect: 'error'`), `update-check-app.ts`
    (branchement, 5 s après le lancement) ; état `update-check.json`. Canaux `app:update*`, classés
    sûrs en lecture seule (rien n'y est écrit dans ce cas).
  - Renderer : `UpdateLine.tsx` au-dessus du pied de la barre latérale, `UpdateCheckCard.tsx` dans
    Nouveautés, ligne « Nouvelles versions » dans Confidentialité, recherche des réglages ; clés
    `updates.*` en français et en anglais.
  - Écarts au plan : `Accept-Language: en` posé (Chromium envoyait la langue de l'utilisateur,
    vu par l'e2e) ; aucune redirection suivie (plus strict que « hors `api.github.com` ») ;
    `BOBINE_UPDATE_CHECK=off` ajouté pour les essais de l'app packagée (`packaged.mjs`,
    `packaged-installed.mjs`), où `BOBINE_RELEASES_URL` est ignorée ; « Voir » observé par
    `shell.openExternal` remplacé dans le main plutôt que `BOBINE_OPEN_LOG`.
  - Essais : unitaires `shared/update-check.test.ts`, `main/update-check.test.ts`,
    `main/update-check-electron.test.ts`, `sidebar/UpdateLine.test.tsx` ; e2e `nouvelle-version`
    (clair et sombre) vert, captures regardées ; `settings`, `about`, `base`, `language` verts.
    `pnpm e2e --changed` choisirait toute la suite (fichiers globaux touchés) : pas lancée ici,
    à faire avant la 1.0.
  - Toutes les suites e2e coupent la vérification (`NEUTRAL_ENV` : `BOBINE_UPDATE_CHECK=off`,
    adresse locale fermée) : aucun essai ne contacte GitHub.
  - Docs : guide Réglages (fr, en), FAQ des README, CHANGELOG, `docs/architecture.md`.
  - Reste : `pnpm pilote` (recette) ne coupe pas la vérification : une recette avec un profil
    temporaire fait une vraie requête à GitHub, au plus une par lancement.
