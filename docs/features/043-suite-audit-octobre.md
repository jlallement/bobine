# 043 — Suite de l'audit d'octobre : hygiène, AXe, historique, tests, limites levées, export

- **Statut** : fait
- **Dépend de** : 008, 009, 020, 021, 040, 041

## Pourquoi

Audit complet du 2026-10-13 (code, doc, tests, fonctionnalités) : le socle est solide et `verify`
est vert (455 tests, aucun `any`, durcissement Electron complet, IPC validé, données atomiques),
mais il reste des points d'hygiène de dépôt, une persistance de l'historique qui ne passera pas à
l'échelle, aucun test du renderer hors e2e, une intégration d'AXe jamais vérifiée (ni version, ni
ADR), et des limites documentées dans les fiches 020, 021 et 040 qu'on peut lever.

Décisions de l'utilisateur (2026-10-13) : **plus tard** — CI/CD, mise à jour automatique, LICENSE et
CHANGELOG, diff d'images e2e, port e2e et sous-ensemble smoke, fin de tour déterministe
(`settleNotifications`), helper natif Swift pour le simulateur. **Conservé** : pnpm. **AXe** : gardé
et durci.

## Critères d'acceptation

Chantier 1 — Hygiène du dépôt

- [x] `.idea/` retiré de git et ignoré.
- [x] `package.json` : `engines` (Node ≥ 24, pnpm ≥ 12), `packageManager`, plus aucune dépendance
      en `*`.
- [x] Doc cohérente : vision, prérequis et exemple de `docs/README.md` ; arborescence ; schéma et
      points ouverts de `docs/architecture.md` ; scénario `liste-taches` dans `docs/mock-agent.md` ;
      statut de la fiche 010 dans l'index ; commentaire périmé dans `agent-host.ts` ; version du
      serveur MCP prise dans l'app ; section « Dépannage ».

Chantier 2 — AXe

- [x] Version d'AXe lue au démarrage du simulateur (`axe --version`, minimum 1.8.0) : message
      clair si absent ou trop ancien, version affichée dans l'état du simulateur.
- [x] AXe embarqué dans l'app packagée (`extraResources`) : `scripts/fetch-axe` télécharge la
      version épinglée et vérifie son SHA-256 dans `vendor/axe/` (ignoré par git) ; `findAxe`
      cherche d'abord là (app packagée et `pnpm dev`), puis le PATH ; avis de licence (AXe, idb)
      livrés avec l'app.
- [x] `axe batch` évalué pour les gestes composés ; conclusion dans le journal.
- [x] Script d'essai manuel `pnpm simulator-smoke` contre un simulateur créé pour l'occasion
      (jamais celui de l'utilisateur) : version, lecture d'écran, toucher par libellé, capture,
      quelques images du flux vidéo.
- [x] ADR-0009 : AXe pour piloter le simulateur (alternatives idb, XCUITest, CGEvent, helper natif).

Chantier 3 — Robustesse

- [x] Fils chargés à la demande (index seul au démarrage) ; la recherche dans le contenu charge ce
      qu'il lui faut.
- [x] Écritures de l'historique asynchrones, hors du chemin IPC, sérialisées par conversation ;
      synchrones seulement à la fermeture ; test de charge avec un fil de 20 Mo.
- [x] Pages du navigateur et terminaux fermés à l'archivage ; pages seules à l'éviction (voir journal).
- [x] PATH du shell : délai 10 s, dépassement journalisé, « Relire le PATH » dans Réglages › Agents.

Chantier 4 — Tests

- [x] `pnpm coverage` (v8), rapport texte et HTML.
- [x] Tests de composants React (jsdom + Testing Library) : `QuestionCard`, `ElicitationCard`,
      `Markdown`, menu « / » du `Composer`.

Chantier 5 — Limites levées et export

- [x] Remarques du plan (040) gardées par conversation, retrouvées après redémarrage.
- [x] File d'attente (020) conservée quand « Relancer » recrée l'hôte.
- [x] « Annuler cette modification » dans l'onglet Modifications (021), fichier par fichier, avec
      les garde-fous de la branche (modifié depuis = pas touché).
- [x] Export d'une conversation en Markdown ou JSON (menu « … ») ; sauvegarde de l'historique
      complet depuis les Réglages.
- [x] Testé contre l'agent factice ; e2e pour ce qui change l'interface.

## Plan

Un commit par chantier, `./scripts/verify` entre chaque ; `pnpm build && pnpm e2e` sur les suites
touchées quand l'interface change.

1. **Hygiène** : `.gitignore`, `package.json` (+ lockfile), `docs/README.md`,
   `docs/architecture.md`, `docs/mock-agent.md`, `docs/features/README.md`,
   `src/main/agent/agent-host.ts` (commentaire), `src/main/mcp/tool-server.ts` (version injectée
   par `src/main/index.ts`).
2. **AXe** : `src/main/simulator/axe.ts` (`findAxe` avec le dossier des ressources, `version()`,
   `MIN_AXE_VERSION`), `simulator-manager.ts` (état avec la version, erreur « trop ancien »),
   `shared/simulator.ts` (`SimulatorState.axe`), `SimulatorTab.tsx` (affichage),
   `scripts/fetch-axe` (version + SHA-256 épinglés, `vendor/axe/`), `electron-builder.yml`
   (`extraResources`), `build/THIRD_PARTY_LICENSES` (ou `vendor/axe/LICENSES`),
   `scripts/simulator-smoke`, `docs/adr/0009-axe-simulateur.md`, tests et e2e (faux `axe` répond
   à `--version`).
3. **Robustesse** : `conversations/store.ts` et `manager.ts` (fil chargé à la sélection, cache),
   `storage.ts` (`writeFileAtomicAsync`), `history-writer.ts` (file d'écriture par conversation,
   `flushSync` à la fermeture), `content-search.ts` (chargement paresseux), test de charge ;
   `manager.ts` (`onReleased(id)` à l'archivage et à l'éviction) + `index.ts` (fermer navigateur
   et terminaux) ; `shell-env.ts` (délai, journal), IPC `app:reloadShellEnv`, `SettingsDialog.tsx`.
4. **Tests** : `@vitest/coverage-v8` (même version que vitest), `jsdom`, `@testing-library/react`,
   projet vitest « renderer » (`environment: jsdom`), premiers tests de composants.
5. **Limites et export** : `renderer/plan-notes.ts` (comme `drafts.ts`), `manager.restart`
   reprend `host.queue` (`MessageQueue.takeAll` / `restore`), IPC `changes:revert` +
   `restore-files.ts` par fichier + bouton dans `ChangesTab.tsx`, `shared/export.ts` (Markdown,
   JSON) + IPC `conversation:export` (dialogue d'enregistrement injecté) + entrée du menu « … » ;
   `app:backupHistory` (copie datée du dossier de données) dans Réglages › Général.

## Journal

- 2026-10-13 — Fiche créée après l'audit (voir « Pourquoi »). Relevés utiles : AXe 1.8.0 =
  binaire Swift signé Developer ID (Cameron Cooke) qui embarque `FBSimulatorControl`,
  `FBControlCore`, `FBDeviceControl`, `XCTestBootstrap` (fork épinglé d'idb) : touchers par HID
  privé de CoreSimulator, écran par l'accessibilité privée ; `stream-video` = boucle de captures
  (10 i/s par défaut, 30 max, ≈ 19 obtenues) ; archive `AXe-macOS-v1.8.0-universal.tar.gz`
  (8,4 Mo, 37 Mo extraite : `axe` + `Frameworks/` + `AXe_AXe.bundle/`), SHA-256
  `7b76340b72e90d0f211bc7c4636f15009076eff07acef2f2b632b175debd8834` ; mêmes droits (entitlements)
  que l'app. Versions des dépendances cohérentes (aucun avertissement de pairs ; `@types/node` 24
  = Node 24.21 d'Electron 44.7 ; vite 8 attend electron-vite 6, TypeScript 7 attend
  typescript-eslint).
- 2026-10-13 — **Chantier 1 (hygiène)** fait, commit `9479b2d` : `.idea/` sorti de git ; `engines`
  + `packageManager` (pnpm 12 écrit alors sa propre entrée dans le lockfile) ; bornes `^7.1.1` et
  `^17.13.0` ; doc remise d'équerre (vision, exemple `opencode`, arborescence, schéma, points
  ouverts, `liste-taches`, statut 010, section « Dépannage ») ; version du serveur MCP = celle
  de l'app.
- 2026-10-13 — **Chantier 2 (AXe)** fait.
  - `axe.ts` : `checkAxe` (`--version`, minimum 1.8.0), messages distincts pour l'utilisateur
    (onglet) et pour l'agent (résultat d'outil) ; `findAxe` cherche d'abord les binaires livrés.
    `SimulatorManager` vérifie au premier usage (revérifie après 10 s si ça manquait), `state()`
    porte `axe.version` / `axe.error`, le flux vidéo exige un AXe utilisable. Onglet : « AXe 1.8.0 »
    dans la barre, raison affichée sinon. Tests unitaires (version, trop ancien, muet, absent,
    priorité du binaire livré) ; e2e `simulator` (faux `axe` répondant à `--version`) ; les essais
    neutres passent `BOB_AXE=` vide (= pas d'AXe) au lieu d'un faux qui échoue.
  - `scripts/fetch-axe` : archive universelle 1.8.0 (SHA-256 épinglé), signature Developer ID
    de l'auteur vérifiée, `--version` vérifié, avis de licence (AXe + idb) assemblés dans
    `LICENSES.txt`. **Écueil** : les frameworks ont des dossiers vides (`Versions/A/Frameworks`)
    et les liens de convention qui y mènent ; electron-builder ne copie pas les dossiers vides, le
    lien se retrouvait cassé dans l'app et la signature échouait (`ENOENT … stat`) : retirés au
    téléchargement, la signature des frameworks reste valide.
  - `electron-builder.yml` : `extraResources` → `Contents/Resources/axe` (40 Mo, app 303 Mo),
    re-signé ad hoc avec les mêmes trois droits qu'AXe porte déjà ; `codesign --verify --deep
    --strict` ok ; le binaire embarqué répond `1.8.0`. `pnpm package` appelle `fetch-axe`.
  - `pnpm simulator-smoke` (vrai AXe, simulateur « Bob Desktop Smoke » créé puis supprimé, iOS
    26.5) : lecture de l'écran (21 éléments, 402×874), toucher (Réglages → compte Apple), saisie
    « Zoé ça » collée et relue dans le champ, capture 125 Ko, flux 9 images/s à `--fps 10`.
  - `pnpm e2e:packaged` vérifie qu'AXe embarqué est trouvé sans PATH et répond. **Bug trouvé en
    route** (préexistant depuis la fiche 022) : ce script se figeait sans fin, le main process
    bloqué dans `SecItemCopyMatching` — la boîte du trousseau macOS ouverte par `safeStorage` pour
    une app ad hoc fraîchement signée. Corrigé : `--use-mock-keychain` comme les autres essais, et
    30 s au plus par évaluation CDP (un blocage devient un échec). Symptôme ajouté au Dépannage.
  - `axe batch` : évalué, écarté (un appel d'outil = un geste ; voir ADR-0009).
  - Écart au plan : `batch` non utilisé ; rien d'autre.
- 2026-10-13 — **Chantier 3 (robustesse)** fait.
  - **Fils à la demande** : le gestionnaire ne lit plus que l'index au démarrage ; `transcriptOf`
    charge un fil à sa première demande (sélection, vue, recherche, branche, évènement) et le garde
    en mémoire. Un fil abîmé est mis de côté à ce moment-là, et la conversation le dit dans son fil
    (avis), au lieu d'un avis global au lancement. Test : fichier abîmé laissé en place tant que la
    conversation n'est pas ouverte, puis mis de côté et avis dans le fil.
  - **Écriture asynchrone** : `writeFileAtomicAsync` (`storage.ts`, fichier temporaire unique,
    `fsync` hors du fil principal, `commit` consulté avant le renommage) ; `HistoryWriter` numérote
    les écritures par fil : une écriture dépassée ne remplace pas le fichier, et l'écriture
    synchrone de la fermeture (`stopAll`) garde le dernier mot. Index et réglages restent
    synchrones (petits). Test de charge : fil de 20 Mo (2 000 réponses de 10 Ko) écrit sans que la
    boucle d'évènements reste bloquée plus de 300 ms (la sérialisation JSON, elle, reste sur le fil
    principal : ≈ 50 ms pour 20 Mo). Non fait : décharger de la mémoire les fils des conversations
    évincées (une écriture différée pourrait les référencer) — à voir si la mémoire devient un sujet.
  - **Libération** : `onReleased(id, 'archived' | 'evicted')` du gestionnaire. **Écart au plan** :
    à l'archivage, pages du navigateur et terminaux sont fermés ; à l'éviction (agent arrêté
    pour faire de la place, à l'insu de l'utilisateur), seules les pages le sont — un shell où
    tourne un serveur ou une compilation ne doit pas disparaître parce qu'on a ouvert une cinquième
    conversation. Test avec `maxLive: 1`.
  - **PATH du shell** : `loginShellEnv` rend `{ values, problem?, ms }`, délai 10 s ; un shell muet,
    trop lent ou sans PATH est dit dans le journal. Nouveau canal `settings:reloadShellEnv`
    (« Relire le PATH », Réglages › Agents) : relit le shell, réapplique le PATH, rend les réglages
    à jour (profils disponibles recalculés) ; en cas de problème, la raison s'affiche sous le
    bouton. Tests : shell lent arrêté au délai, canal IPC ; e2e `settings` (capture `84-agents`).
  - Dépannage de `docs/README.md` mis à jour (PATH, trousseau).
- 2026-10-13 — **Chantier 4 (tests)** fait.
  - `vitest.config.ts` en deux projets : « node » (main, preload, partagé, agent factice) et
    « renderer » (jsdom, `@vitejs/plugin-react`, `src/renderer/src/test-setup.ts` qui fournit
    `scrollIntoView` et un `window.api` minimal). Nouvelles dépendances de dev :
    `@vitest/coverage-v8` (même version que vitest), `jsdom`, `@testing-library/react` et `dom`.
  - 18 tests de composants : `Markdown` (liens vers le navigateur système, `javascript:`
    neutralisé, tableaux encadrés, bouton Copier, GFM), `QuestionCard` (clic, clavier 1–9 / ↓ /
    Entrée, « Autre », choix multiple, obligatoire, plusieurs questions), `ElicitationCard`
    (formulaire : requis et `minLength` vérifiés par l'app, `min` par le navigateur avant l'app,
    refus, page à ouvrir, questionnaire reconnu, résumé après réponse), `Composer` (Entrée /
    Maj+Entrée, menu « / » filtré, complétion d'une commande à argument, commande de l'agent ou
    de l'app, Échap). `TerminalTab` (xterm.js) est remplacé par un faux dans le test du Composer.
  - **Observation** : jsdom et Chromium appliquent la validation HTML5 (`min`, `type=email`) avant
    le `submit` : pour ces contraintes, c'est l'infobulle native qui s'affiche, pas le message
    français de l'app ; seules les contraintes sans équivalent HTML (`minLength`, `pattern`,
    `enum`) passent par `validateElicitationContent`. Acceptable ; noté.
  - `pnpm coverage` : 57,7 % des instructions, 52,9 % des branches, 46,0 % des fonctions, 59,1 %
    des lignes (`coverage/` en HTML, ignoré par git). Le renderer et les gestionnaires Electron
    (navigateur, simulateur, Android, terminal) restent couverts surtout par les e2e.
- 2026-10-13 — **Chantier 5 (limites levées, export)** fait.
  - **Remarques du plan** (040) : `renderer/plan-notes.ts` (stockage local, par conversation et
    version, 50 plans au plus) remplace la `Map` en mémoire de `PlanDocument` ; test unitaire
    (projet renderer) et e2e `plan` (remarque retrouvée après `location.reload()`).
  - **File d'attente** (020) : `MessageQueue.drain` / `restore`, `AgentHost.takeQueued` /
    `restoreQueued` ; `ConversationManager.restart` confie la file au nouvel hôte, qui la montre
    et la laisse partir à la demande (« Envoyer maintenant »), jamais seule. Test du gestionnaire.
  - **Annuler une modification** (021) : canal `changes:revert` → `ConversationManager.revertFile`
    (le chemin doit être celui d'un diff de la conversation ; `planRestore` / `applyRestore` de la
    fiche 023 : remis en état, déjà dans son état d'avant, modifié depuis = pas touché, hors du
    dossier, échec) ; le fil reçoit un avis dans tous les cas. Onglet Modifications : flèche
    « Annuler cette modification », confirmation sous la ligne du fichier (créé par l'agent :
    « il sera supprimé »), puis « annulée » ; vue Git rafraîchie. Tests du gestionnaire (remis,
    créé supprimé, inchangé, conflit) et de l'IPC ; e2e `changes`.
  - **Export** : `shared/export.ts` (Markdown lisible : messages, réflexions, outils avec fichiers
    et sortie de terminal sans codes couleur, tâches, questions, consommation ; JSON complet
    `bob-desktop-conversation` v1), canal `conversation:export` (dialogue d'enregistrement injecté,
    fichier montré dans le Finder, avis dans le fil), entrées « Exporter en Markdown… / en JSON… »
    du menu « … ». **Sauvegarde** : `conversations/backup.ts` (copie datée des conversations sans
    fichiers temporaires + réglages) via `app:backupHistory` après `settled()`, bouton
    « Sauvegarder… » dans Réglages › Général. Tests unitaires (export, sauvegarde, IPC) ; nouvelle
    suite e2e `export` (dialogues natifs et Finder remplacés dans le main par `--inspect`).
  - Doc : `docs/README.md` (historique, modifications, plan), fiches 020, 021 et 040 amendées.
- 2026-10-13 — **Bilan** : 5 commits, `verify` vert (74 fichiers, 497 tests), e2e vertes sur les
  suites touchées (`simulator`, `settings`, `restart`, `history`, `base`, `changes`, `plan`,
  `export`, `queue`, `failures`), app packagée essayée (`pnpm e2e:packaged`), simulateur réel
  essayé (`pnpm simulator-smoke`). **Plus tard** (décisions de l'utilisateur) : CI/CD, mise à
  jour automatique, LICENSE et CHANGELOG, fin de tour déterministe (`settleNotifications`), diff
  d'images e2e, port e2e libre et sous-ensemble smoke, helper natif Swift pour le simulateur,
  fiche 037 (git / PR / CI). Reste des idées de l'audit non retenues ici : personnalisation
  (raccourcis, suggestions d'accueil, accent libre), « Effacer les données du navigateur »,
  annonces `aria-live` pour les lecteurs d'écran, déchargement mémoire des fils évincés.
- 2026-10-13 — **Deux bugs d'affichage** vus par l'utilisateur, corrigés dans la foulée :
  - Menu « / » ou « @ » coupé en haut sur l'écran d'accueil (zone de saisie centrée, peu de place
    au-dessus ; le menu de 380 px débordait de 53 px dès la fenêtre par défaut, davantage en petite
    fenêtre). La capture `16-commandes` le montrait déjà et ce n'avait pas été vu en relisant les
    captures. Correction : `useMenuPlacement` (menus « / » et « @ ») mesure la place entre
    l'en-tête et le bas de la fenêtre, ouvre le menu du côté où il tient (en dessous sur l'accueil)
    et plafonne sa hauteur ; recalcul au redimensionnement et quand la zone de saisie change de
    taille. Test unitaire de `placeMenu` ; e2e `commands` et `attachments` vérifient que le menu
    reste entier dans la fenêtre sans recouvrir l'en-tête.
  - Pastille d'origine « Bob Desktop » (fiche 039) étalée en barre sur toute la ligne : sa classe
    modificatrice `app` entrait en collision avec le conteneur racine `.app` (`display: flex ;
    height: 100%`). Renommée `from-app` ; e2e `commands` vérifie que la pastille reste compacte.
- 2026-10-14 — À la demande de l'utilisateur (Mac derrière un proxy) : l'archive d'AXe
  et ses licences sont versionnées dans `vendor/archives/` (ADR-0010) ; `scripts/fetch-axe` les
  prend là, sinon les télécharge et les y range, mêmes vérifications. Essayé : premier passage
  téléchargé et rangé, second passage depuis l'archive locale, `axe --version` = 1.8.0.
- 2026-10-14 — Sur un Mac fraîchement cloné, le simulateur disait « AXe n’est pas
  installé » : `vendor/axe/` est ignoré par git, seule l'archive est versionnée, et rien ne
  l'extrayait avant `pnpm dev` / `pnpm preview`. Corrigé : scripts `predev` et `prepreview` qui
  lancent `fetch-axe` (immédiat si AXe est déjà là, sans réseau sinon, jamais bloquant) ;
  `fetch-axe` ne fait rien hors de macOS ; en développement, le message du simulateur dit de lancer
  `pnpm fetch-axe`. Vérifié dans un clone neuf : AXe 1.8.0 extrait depuis l'archive, `--version`
  répond.
