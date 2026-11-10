# 187 — Robustesse pour une V1 distribuable : audit, registre des risques et barre de qualité

- **Statut** : en cours (audit fait ; R2 corrigé ; lots C, D, E, F, G pour la 0.11, A plus tard)
- **Dépend de** : 041 (robustesse du cœur), 080 (journal), 089 (limites ESLint), 111 (signature),
  115 (e2e), 138 (courses git), 145 (Linux), 148 (recommencer à neuf), 183 (recette 0.9)
- **Agents** : les deux (et l'agent factice) : rien de propre à un agent, sauf le suivi des
  versions de Bob et d'OpenCode (lot F)

## Pourquoi

Jérôme veut une V1 qu'il peut donner à d'autres « sans 1000 bugs ». La 0.9.0 a été jugée par un
seul utilisateur, sur une seule machine (macOS 27, Apple Silicon), avec un profil qui a grandi
avec l'app. Cette fiche dit, avec des preuves, ce qui casserait chez quelqu'un d'autre. Elle donne
aussi le plan pour y arriver et les critères qui permettent d'appeler une version « 1.0 ».

## Critères d'acceptation

- [x] Registre des risques classé par impact × probabilité, avec une preuve pour chaque risque
      (fichier:ligne, mesure ou reproduction) et un correctif chiffré S/M/L.
- [x] Matrice de compatibilité (pris en charge / essayé / inconnu).
- [x] Barre de qualité V1 : critères vérifiables.
- [x] Découpage en lots à confier à des sessions.
- [x] Preuves volumineuses dans les notes partagées, dossier `robustesse-v1/` (`mesures/`,
      `rapports/`, `scripts/`).
- [x] Corrections triviales confirmées, listées à part (une seule).
- [ ] Lots A à H faits, puis barre V1 cochée (chaque lot dans sa fiche).

## Méthode

- **Lecture** : doc (`architecture.md`, `audit-maturite-2026-10-21.md`, fiches citées) et code.
  Cinq relectures parallèles en lecture seule (données du profil, pannes agent/MCP, sécurité,
  compatibilité/distribution, performance/tests). Leurs rapports complets sont dans
  `robustesse-v1/rapports/`. Chaque point classé « haut » a été **revérifié** dans le code ou dans
  l'app avant d'entrer au registre.
- **Mesures** : app construite au commit `e96769f`, pilotée par le harnais e2e (`withApp`, agent
  factice). Profils jetables, dont un **profil 0.7.0 créé par la 0.7.0 construite au tag**. Profils
  abîmés à la main, 1 004 conversations, un fil de 5 000 éléments, un diff de 5 000 lignes. App
  packagée pour le fusible RunAsNode. Chiffres et journaux : `robustesse-v1/mesures/mesures.md`.
- **`./scripts/verify`** : vert, 330 fichiers et 2 525 tests en 62 s.

## Ce qui est déjà solide (à ne pas casser)

- **Écritures du profil** : temporaire, `fsync`, puis `rename` (`src/main/storage.ts:30-68`). Un
  JSON illisible est mis de côté en `.corrupt-<date>`, jamais supprimé. L'index a sa copie `.bak`
  et il est repris depuis elle. Les tâches planifiées et `usage.sqlite` refusent d'écraser un
  format plus récent. Mesuré : index tronqué → repris de `.bak` ; fil tronqué ou vide → carte « fil
  illisible, mis de côté » ; `usage.sqlite` illisible → recréé.
- **Montée et descente** : un profil 0.7.0 s'ouvre dans la 0.9 sans perte (3 conversations,
  Markdown, accents, diff). Le même profil, repassé par la 0.7.0, s'affiche aussi. Le 0.8 → 0.9
  est couvert par la recette 183.
- **Agent qui meurt en plein tour** : carte d'erreur, outils marqués interrompus, « Relancer »,
  relance au message suivant (`agent-host.ts:958-978`, scénarios `plantage` et `muet`, suite
  `failures`). Délais sur `initialize` (60 s) et `session/new|load|resume` (120 s). Réseau
  instable : 5 reprises.
- **Processus** : groupes de processus, `agents.pids`, orphelins récupérés au lancement suivant
  après vérification de la commande et de l'heure de départ (`process-registry.ts`).
- **Durcissement Electron** : `contextIsolation`, `sandbox`, CSP `default-src 'self'` sans
  `unsafe-eval`. Navigation et `window.open` bloqués, `openExternal` limité à http(s). Émetteur IPC
  vérifié. Fusibles RunAsNode, NODE_OPTIONS et inspect coupés, intégrité asar. Serveur MCP sur
  127.0.0.1 avec jeton et refus d'`Origin`. Clés dans `safeStorage`, sans repli en clair.
  `pnpm audit --prod` : aucune vulnérabilité.
- **Rien ne sort au démarrage** : aucune requête réseau de l'app. Proxys et certificats pris du
  shell de connexion.
- **Git** : file par dépôt, `LANGUAGE=C` sur chaque appel `gitRun`, arguments en tableau (jamais
  de chaîne de shell), reprise sur `index.lock`.

## Registre des risques

Impact (I) et probabilité (P) notés de 1 à 5 chez un utilisateur V1. Score = I × P.
Taille du correctif : **S** ≤ 1 jour, **M** 2 à 4 jours, **L** une semaine ou plus.

| # | Risque | I | P | Score | Preuve | Correctif | Taille | Lot |
|---|---|---|---|---|---|---|---|---|
| R1 | **Gatekeeper bloque le DMG téléchargé.** Signature ad hoc, pas de notarisation : refus au premier lancement, et depuis macOS 15, plus de contournement par clic droit. Souvent interdit sur un Mac géré. Chaque version change de signature : accès à l'écran, trousseau et notifications à redonner à chaque mise à jour. | 5 | 5 | **25** | `electron-builder.yml:52-56` ; fiche 111 (journal) ; `spctl` refuse l'app ; `docs/installation.md:175-178` (`xattr` en contournement) | Compte Developer ID, notarisation (chaîne prête dans `release.yml`, `--strict`) | M + 99 $/an | A |
| R2 | ✅ **Corrigé (0.9.1).** **« Réinitialiser Bobine » et le ménage du profil temporaire ne marchent pas dans l'app packagée.** Leur assistant est lancé par `ELECTRON_RUN_AS_NODE=1 Bobine -e …`, mais le fusible RunAsNode est coupé. Résultat : une **seconde Bobine graphique** démarre et rien n'est mis à la corbeille. Pour le profil temporaire, une Bobine s'ouvre en quittant. | 4 | 5 | **20** | **Reproduit** sur l'app packagée : `robustesse-v1/mesures/fuse-runasnode-app-packagee.log` (« dossier absent » : le script pris pour un dossier). `src/main/reset.ts:151-155`, `src/main/fresh-start.ts:104-107`, `electron-builder.yml:40`. Fiche 148, statut : « essai réel … sur l'app installée à faire » | Assistant en `/bin/sh` (ou `utilityProcess` avant de quitter), sans rouvrir le fusible ; suite e2e packagée « reset » | M | B |
| R3 | **Un gros diff venu de l'agent fige l'interface.** `diffLines` tourne sans borne, de façon synchrone dans le renderer, et chaque diff du fil est calculé **à l'ouverture**, même replié. Un `package-lock.json` réécrit suffit. | 4 | 4 | **16** | Mesuré : fil de 3 éléments avec un diff de 5 000 lignes, ouverture en **2,6 s** ; banc : 10 000 lignes en 8,5 s, 20 000 en 58 s. `DiffView.tsx:51`, `shared/diff.ts:35`, `ToolCall.tsx:170-177` | `maxEditLength` et délai, plafond (« diff trop grand, ouvrir dans l'onglet Modifications »), calcul seulement quand on déplie | S | D |
| R4 | **Une nouvelle version de Bob ou d'OpenCode casse en silence.** Une version non essayée n'est signalée que dans Diagnostic. Aucune sonde en CI. Les adaptateurs hors protocole de Bob (`bob.db`, `/status`) sont les premiers à tomber. OpenCode 2.2.5, sondé hors ligne, manque à `testedVersions`. | 4 | 4 | **16** | `diagnostics.ts:344-369`, `agent/profiles.ts:394,457`, `.github/workflows/*` (aucune sonde), `docs/acp.md:101` | Sonde OpenCode `--offline` hebdomadaire en CI sur `opencode@latest` ; avis une fois dans la conversation pour une version non essayée ; vérification de `protocolVersion` ; liste « à chaque version de Bob » | S/M | F |
| R5 | **Pas d'avis de nouvelle version.** Sans mise à jour automatique (ADR-0023) ni vérification, les utilisateurs restent sur une version boguée sans le savoir. | 3 | 5 | **15** | ADR-0023 ; aucun appel réseau de version | ADR (remplace en partie 0023) : vérification facultative ou au clic de `releases/latest`, lien vers la page ; silencieuse hors ligne ; puis cask Homebrew une fois signé | S + ADR | A |
| R6 | **Longs fils lourds.** Aucune virtualisation, ~10 passes O(n) par morceau, détection automatique du langage (highlight.js) refaite à chaque morceau pour un bloc de code sans langage. | 3 | 4 | **12** | Mesuré, fil de 5 000 éléments : ouverture 2,1 s dont une tâche longue de **1,8 s**, **385 000 nœuds DOM**, tas 326 Mo, RSS de l'app 744 → **1 592 Mo**. Banc : bloc de 200 lignes sans langage, 140 ms par morceau. `Transcript.tsx:134-169`, `Markdown.tsx:60-77` | Pas de détection pendant le streaming (S) ; `content-visibility: auto` par élément (S/M) ; puis liste fenêtrée et ouverture par la fin du fil (M/L) | S→L | E |
| R7 | **Agent figé en plein tour : la roue tourne sans fin.** `session/prompt` n'a pas de délai. La surveillance du silence écrit seulement au journal. Stop marche, mais il faut deviner. | 3 | 4 | **12** | `agent-host.ts:566-575`, `silence-watch.ts:23-38` | Bandeau « Aucune activité depuis N min — Arrêter / Relancer » hors attente de l'utilisateur | S | C |
| R8 | **Un seul filet d'erreur pour toute l'interface.** Un message qui casse le rendu remplace toute la fenêtre par l'écran d'erreur, et « Recharger » rouvre la même conversation (boucle probable, non jouée). | 4 | 3 | **12** | Seul `getDerivedStateFromError` : `ErrorBoundary.tsx:13`, monté à la racine (`main.tsx:29`) | Filet par élément du fil (« message non affichable »), par panneau et par page de réglages ; e2e qui le déclenche | M | C |
| R9 | **E2e instables et pas de CI macOS régulière.** Les régressions passent : `filles` échoue encore sous charge (cause non établie), et `e2e.yml` est lancé à la main seulement. | 3 | 3 | **9** | Fiches 115:101, 181:65-84, 183:195-205 ; `.github/workflows/e2e.yml` (`workflow_dispatch` seul) ; 83 `sleep()` dans `e2e/suites` | E2e de nuit sur macOS (cron), suivi des échecs par suite, cause de `filles` | M | H |
| R10 | **Format du profil sans version : une Bobine plus ancienne efface ce qu'elle ne connaît pas.** Réglages, accords et index ne gardent que les champs connus. Un fil d'une version future était écrasé (corrigé, voir plus bas). Pas de marque de version sur le profil. | 4 | 2 | **8** | `settings.ts:103-136`, `approvals.ts:154-170`, `store.ts:64` (enregistrements filtrés puis réécrits) ; rapport `donnees-profil.md` H2 | `formatVersion` par fichier, lecture seule si plus récent (comme `TaskStore`), champs inconnus gardés, marque `profile-version` et avertissement à la descente | M | G |
| R11 | **Index perdu = liste vide, alors que les fils sont sur le disque.** Ni reconstruction, ni moyen de retrouver les conversations depuis l'app. | 5 | 1 | **5** (mais « jamais perdre une conversation ») | **Mesuré** : `index.json` et `.bak` illisibles, ou absents → aucune conversation affichée, 3 fils intacts sur le disque. `store.ts:140-143` | Copie de l'enregistrement dans chaque fil ; reconstruction de l'index depuis les fils | M | G |
| R12 | **Supprimer une conversation est définitif.** Pas de corbeille. La case « supprimer aussi chez l'agent » est cochée par défaut. Une écriture en vol peut recréer le fichier supprimé (lu, non joué). | 4 | 2 | **8** | `manager.ts:1020` (`rmSync`), `ConversationMenu.tsx:192` | Corbeille `conversations/.trash/` 30 jours, « Annuler » ; l'écrivain ignore une conversation supprimée | M | G |
| R13 | **macOS minimum ni déclaré ni essayé.** Implicitement 13.0 (Electron 45), alors que toutes les recettes ont tourné sur macOS 27. ScreenCaptureKit, AXe et les entitlements n'ont jamais été vus sur 13 à 15. | 4 | 2 | **8** | `electron-builder.yml:45-66` (pas de `minimumSystemVersion`) ; recettes ; CI `macos-15` (e2e à la main) | Déclarer le minimum (proposé : 14) ; e2e complet sur un runner `macos-14` avant le tag | S | A |
| R14 | **Disque plein.** Chaque écriture échouée laisse un `.tmp` partiel, jamais nettoyé, qui reprend la place libérée. Si le disque est encore plein en quittant, les derniers tours sont perdus sans un mot. Aucun vrai essai ENOSPC. | 3 | 2 | **6** | `storage.ts:35-42,57-64` ; démo `ulimit -f` : 5 écritures, 5 `.tmp` de 51 Ko (`rapports/donnees-profil.md` M1) ; 0 test « ENOSPC » | `rm(tmp)` sur erreur et balayage au lancement (S) ; avertir en quittant s'il reste des écritures en échec ; essai sur une petite image disque `hdiutil` (M) | S/M | G |
| R15 | **Erreurs du main avalées, pas de rapport de plantage.** `uncaughtException` est écrit au journal et l'app continue dans un état inconnu. Après 3 plantages de l'interface en une minute : fenêtre blanche. Rien n'est proposé au lancement suivant. | 2 | 3 | **6** | `index.ts:150-158,258-263` ; aucun `crashReporter` | Avis « erreur interne » ; marque « en cours » qui, restée au lancement suivant, propose le rapport local (journal + minidump `crashReporter` sans envoi) ; page d'erreur après 3 rechargements | S/M | C |
| R16 | **Processus qui survivent à la fermeture.** Le SIGKILL de secours (`unref`) ne part jamais, car le main sort avant. Builds (`xcodebuild`, gradle), flux du simulateur et d'Android ne sont pas suivis. | 2 | 3 | **6** | `process-group.ts:35`, `index.ts:790-803`, `jobs/command-job.ts:32`, `simulator-manager.ts:344`, `android-manager.ts:227,287` | Attendre ~1,5 s dans `will-quit` puis SIGKILL ; `trackChild` pour les jobs et les flux | S | C |
| R17 | **`main.log` non masqué.** Ligne de commande complète de l'agent (un `--api-key` d'agent personnalisé y passerait), piles IPC. En Trace, le masquage par motifs laisse passer `{"name":"X_TOKEN","value":…}`, les clés AWS et le contenu des fichiers lus. | 3 | 2 | **6** | `log.ts:145-157` (pas de `redact()`), `agent-process.ts:95-97`, `log-redact.ts:21-33` | `redact()` dans `formatLine` ; motifs en plus ; mention « la trace contient des fichiers » | S | H′ |
| R18 | **Shells de connexion non POSIX.** tcsh refuse `-ilc` : PATH minimal, `bob` et `opencode` introuvables. nushell (déduit, non essayé) rendrait `"$HTTPS_PROXY"` en texte et casserait le proxy, sans avertissement. Un rc qui attend sur stdin bloque le démarrage 10 s. | 3 | 2 | **6** | `shell-env.ts:60-87`, `index.ts:350-357` | `$SHELL -l -c 'env -0'`, rejet des valeurs `$…`, repli sur `/bin/zsh -ilc`, `stdin: 'ignore'` | S | H′ |
| R19 | **Écritures en rafale sur un long fil.** Le fil entier est réécrit chaque seconde avec `fsync`, et ces écritures peuvent se chevaucher. L'index est réécrit en synchrone, avec `fsync` et `.bak`, à chaque message. | 2 | 3 | **6** | `history-writer.ts:22,96-103`, `storage.ts:30-50`, `manager.ts:1381,1387` | Une seule écriture en vol par conversation, index retardé et asynchrone (S) ; plus tard, journal par ajout (L) | S | E |
| R20 | **Pas de build Intel.** | 5 (pour eux) | 1 | **5** | `electron-builder.yml:48-49` | Décision V1 : « Apple Silicon seulement », écrit dans le README et l'installation. Faisable plus tard (node-pty x64, AXe universel, `node:sqlite`) | S (dire) / M (faire) | A |
| R21 | **Très gros dépôts.** `ls-files` et `diff HEAD` sont lus en entier puis coupés : au-delà de 64 Mo, échec au lieu d'une coupe. `git status -uall` a un délai de 30 s. | 2 | 2 | 4 | `workspace-files.ts:35`, `git-context.ts:91`, `simulator/run.ts:27` | Lecture en flux bornée, `-unormal` pour la pastille | S | H′ |
| R22 | **Serveur MCP** : un outil n'est pas interrompu quand le client coupe. Un échec de démarrage est seulement écrit au journal : l'agent n'a plus les outils de l'app, sans un mot. Une exception hors `try` laisse la requête sans réponse. | 2 | 2 | 4 | `mcp/tool-server.ts:48,154-172`, `index.ts:367-369` | `AbortSignal` sur `req.close`, budget par outil, avis si le serveur ne démarre pas, `try` autour de `handle` | S/M | C |
| R23 | **Réglages ou accords abîmés : remis par défaut sans le dire.** `settings.json` du mauvais type (`[1,2,3]`) n'est même pas mis de côté. | 2 | 1 | 2 | Mesuré (`corruption-profil.txt`) ; `settings.ts:105-106`, `approvals.ts:154` | Avis comme pour l'historique ; mise de côté du mauvais type | S | G |
| R24 | **Sauvegarde incomplète, sans restauration.** Elle copie seulement `conversations/` et `settings.json`. | 3 | 1 | 3 | `backup.ts:28-41` | Accords, tâches, commandes, consommation ; « Restaurer » | M | G |

Points plus petits, non classés (rapports dans `robustesse-v1/rapports/`) :
- fusible `EnableCookieEncryption` à activer ;
- `![](file://…)` affiché depuis le Markdown d'un agent ;
- pas de vérification du `Host` sur le serveur MCP ;
- entitlements larges (`disable-library-validation`) à revoir après la signature ;
- cache `workspace-files` jamais purgé ;
- sortie d'outil (`rawOutput`) sans plafond dans le fil ;
- barre latérale non virtualisée (1 004 conversations : démarrage 1,0 s au lieu de 0,55 s,
  10 000 nœuds DOM : acceptable) ;
- git absent : `spawn git ENOENT` affiché brut ;
- `GIT_TERMINAL_PROMPT=0` non posé pour `git push`.

### Les 10 premiers

R1 signature, R2 réinitialisation cassée dans le DMG, R3 gros diff, R4 versions d'agents, R5 avis
de version, R6 longs fils, R7 agent figé, R8 filet d'erreur unique, R9 e2e instables, R10 format
du profil sans version. R11 et R12 sortent du classement par leur probabilité. Ils restent bloquants
pour la promesse « ne jamais perdre une conversation » : ils sont dans la barre V1.

## Matrice de compatibilité

✅ pris en charge et essayé · 🟡 pris en charge, pas ou peu essayé · ❓ inconnu · ❌ non pris en charge

| Dimension | État | Détail |
|---|---|---|
| macOS 27 (Apple Silicon) | ✅ | Toutes les recettes, e2e complet |
| macOS 15 | 🟡 | Runner `macos-15` de `release.yml` (construction) et `e2e.yml` (à la main) |
| macOS 13–14, 26 | ❓ | Minimum implicite 13.0 (Electron 45), jamais lancé |
| Intel (x64) | ❌ | Pas de build ; faisable (R20) |
| Linux x64 / arm64 | 🟡 aperçu | AppImage et .deb non signés, `verify` sur Ubuntu, e2e `xvfb` expérimental (fiche 145) |
| Windows | ❌ | Hors V1 (audit de maturité, § 7) |
| git | 🟡 | Aucune version minimale ; `rev-parse --path-format` (2.31+) avec repli ; git d'Apple ≥ 2.37 ; essayé : 2.56 |
| git traduit (Homebrew suit la langue du Mac) | ✅ | `LANGUAGE=C` sur `gitRun` (`git-queue.ts:153-173`) ; motifs d'erreur en anglais seulement |
| gh | 🟡 | Trouvé dans le PATH, `gh auth status` vérifié, aucune version minimale ; essayé avec un faux `gh` (e2e) et le vrai (recette 183) |
| Node (pour OpenCode installé par npm) | ❓ | Aucune vérification, rien ne dépend de Node côté app |
| Xcode / simctl / AXe | ✅ | `xcode-select -p` vérifié ; JSON de `simctl` ; AXe ≥ 1.8.0 |
| adb / Android | 🟡 | Pas de version minimale |
| Shell zsh / bash | ✅ | Essais unitaires de `shell-env` |
| Shell fish ≥ 3 | 🟡 | Déduit de la lecture |
| Shell tcsh / csh | ❌ | `-ilc` refusé (R18) |
| Shell nushell | ❌ | Déduit (R18) |
| Bob 2.0.6, 2.0.9 | ✅ | Recettes réelles, `bob-probe` le 2026-11-05 |
| Bob plus récent | ❓ | Avis dans Diagnostic seulement (R4) |
| OpenCode 2.0.31–2.0.32 | ✅ | Recettes réelles |
| OpenCode 2.2.5 | 🟡 | Sonde hors ligne verte, recette 183 bornée ; absent de `testedVersions` |
| OpenCode plus récent | ❓ | Pas de sonde en CI (R4) |
| SDK ACP | ✅ | 2.4.0 figé par le lockfile ; `protocolVersion` de l'agent jamais comparé |
| Chemins avec espaces ou accents | 🟡 | Arguments en tableau partout ; accents essayés dans les titres (profil 0.7), pas dans le chemin du dépôt |
| Très gros dépôts | 🟡 | Plafonds (500 fichiers, 512 Ko par diff, 20 000 fichiers pour les mentions) ; échec au-delà de 64 Mo (R21) |
| Sans réseau | ✅ | Rien n'est chargé au démarrage ; scénarios réseau de l'agent factice (fiche 142) |
| Proxy / certificats d'entreprise | 🟡 | Pris du shell de connexion (fiche 058) ; pas d'essai sur un vrai proxy |
| macOS dans une autre langue | ✅ | Interface fr / en ; git forcé en anglais ; `ps` en `LC_ALL=C` ; JSON de `simctl` |
| Profil 0.7 → 0.9, 0.8 → 0.9 | ✅ | Essai (cette fiche) et recette 183 |
| Profil 0.9 → 0.7 (descente) | 🟡 | Petit profil : rien de perdu ; perte des champs récents par lecture (R10) |

## Barre de qualité V1 (pour appeler une version « 1.0 »)

Chaque point est vérifiable. Une version est 1.0 quand tous sont cochés.

**Installer et se tenir à jour**
1. Le DMG est signé Developer ID et notarisé. `spctl -a -vv Bobine.app` dit « accepted ».
   Téléchargé par un navigateur sur un Mac neuf (le plus ancien macOS déclaré et le dernier), il
   s'ouvre au double-clic, sans passer par les Réglages.
2. Le README et `docs/installation.md` disent : Apple Silicon, macOS ≥ N (proposé : 14), Bob et
   OpenCode avec leurs versions essayées. `mac.minimumSystemVersion` vaut N.
3. Un avis de nouvelle version existe (ADR qui remplace en partie 0023) et marche hors ligne
   sans erreur.

**Ne jamais perdre de données**
4. Aucun défaut ouvert qui perd une conversation ou un réglage.
5. Une e2e « profil abîmé » rejoue tous les cas de `mesures/corruption-profil.txt`. Aucun ne
   perd de fil, et l'index se reconstruit depuis les fils.
6. Les profils 0.7, 0.8 et 0.9 (gardés comme fixtures dans le dépôt) s'ouvrent sans perte dans la
   version candidate (e2e). Ouvrir un profil plus récent ne le modifie pas (lecture seule et
   avertissement).
7. Une conversation supprimée se récupère pendant 30 jours.
8. « Réinitialiser » et le profil temporaire sont essayés sur l'**app packagée**
   (`pnpm e2e:packaged`).
9. Un disque plein pendant un tour ne laisse aucun fichier temporaire et prévient l'utilisateur
   (essai sur image disque).

**Tomber proprement**
10. Chaque panne du tableau ci-dessous a un scénario factice et un essai, avec ce que voit
    l'utilisateur : agent qui meurt (code, signal, au démarrage, au repos), agent figé (tour,
    `session/new`, `session/load`), sortie hors protocole, flot sur stderr, connexion coupée
    processus vivant, outil MCP qui ne rend jamais la main, client MCP qui coupe, `git` absent,
    `gh` non connecté, rendu d'un message qui lève une exception.
11. Après un `kill -9` de Bobine : au relancement, aucun processus orphelin, aucun fil bloqué « en
    cours », et le rapport local est proposé (e2e).

**Rester fluide** (suite e2e `perf`, mesurée avant chaque tag, sur la machine de référence)

| Budget | Seuil |
|---|---|
| Démarrage, 2 000 conversations | prêt < 2,5 s |
| Ouverture d'un fil de 5 000 éléments | < 1 s, aucune tâche longue > 200 ms |
| Streaming sur ce fil, bloc de code de 200 lignes sans langage | tâches longues ≤ 50 ms |
| Diff d'agent de 20 000 lignes | renderer bloqué < 200 ms, puis « diff trop grand » |
| Défilement de ce fil | aucune tâche longue > 100 ms |
| 4 h de tours en boucle (soak, agent factice) | RSS du main < 400 Mo, tas du renderer < 500 Mo, croissance < 10 %/h après la 1re heure |

**Sûr par défaut**
12. `pnpm audit --prod` : rien d'élevé. `main.log` et `agents.log` passent par `redact()`, avec un
    test sur un faux secret dans chaque canal. Aucun secret dans l'historique git (gitleaks).

**Prouvé par les essais**
13. Suite e2e complète verte **trois fois de suite** (fr et en, clair et sombre) sur la version
    candidate. E2e de nuit sur macOS verts 10 nuits sur 10 sans échec inexpliqué.
14. Couverture des tests unitaires en cliquet dans `verify` (seuils au niveau actuel).
15. Sondes : `opencode-probe --offline` hebdomadaire verte sur le dernier OpenCode, et
    `bob-probe` joué sur la version de Bob annoncée.

**Usé par d'autres**
16. Bêta de deux semaines avec au moins cinq utilisateurs hors Jérôme, Bob et OpenCode. Aucun
    défaut bloquant ouvert. Chaque défaut trouvé a son essai.

## Lots à confier

Numéros de fiche à attribuer à la création, car plusieurs sessions numérotent en parallèle.
Ordre proposé : B et D d'abord (petits, gros effet), puis C, G, E, F, H en parallèle, A dès que
le compte Apple existe.

| Lot | Contenu | Risques | Taille | Dépend de | Remarques |
|---|---|---|---|---|---|
| **A — Livraison** | Developer ID et notarisation, `minimumSystemVersion`, e2e sur `macos-14`, ADR « avis de nouvelle version » et avis, README « Apple Silicon, macOS ≥ 14 » ; ensuite cask Homebrew | R1, R5, R13, R20 | M | **Décision de Jérôme** : compte Apple à 99 $/an | Le reste du lot avance sans le compte |
| **B — Assistants hors fusible** ✅ fait (0.9.1) | Réinitialisation et ménage du profil temporaire sans `ELECTRON_RUN_AS_NODE` (`/bin/sh` ou `utilityProcess`) ; suite e2e packagée ; journal de la fiche 148 | R2 | M | — | **Urgent** : la fonction est publiée et ne marche pas dans le DMG |
| **C — Pannes visibles** ✅ fait (fiches 194, 195) | Bandeau de silence ; filets d'erreur par élément et par panneau ; avis d'erreur interne, marque de plantage et rapport local (`crashReporter` sans envoi) ; page après 3 rechargements ; SIGKILL en quittant, jobs et flux suivis ; MCP : abandon, budget, avis au démarrage ; `git` absent, `GIT_TERMINAL_PROMPT=0` ; nouveaux scénarios factices (figé sur `session/new` et `load`, plantage à `initialize`, signal, flot stderr, connexion coupée) | R7, R8, R15, R16, R22 | M (en deux fiches) | — | Une fiche « filets et rapports », une fiche « processus et MCP » |
| **D — Gros contenus** | Garde des diffs d'agent (`maxEditLength`, plafond, calcul au dépliage) ; pas de détection de langage pendant le streaming ; plafond de `rawOutput` dans le fil ; cache des statistiques par outil | R3, R6 (partie S) | S | — | Gain immédiat, bancs du rapport `performance-tests.md` |
| **E — Longs fils** | `content-visibility`, puis liste fenêtrée ; ouverture par la fin du fil (IPC paginé) ; une écriture en vol par conversation, index retardé ; suite e2e `perf` avec les budgets | R6, R19 | L | D | ADR si une bibliothèque de liste fenêtrée entre |
| **F — Suivi des agents** | Sonde OpenCode hors ligne en CI hebdomadaire (`schedule:`) ; avis dans la conversation pour une version non essayée et plancher par profil ; `protocolVersion` ; `testedVersions` à jour ; liste « nouvelle version de Bob » (sonde, coûts, quota) | R4 | S/M | — | Bob reste à la main (bobcoins, identifiants) |
| **G — Intégrité du profil** | `formatVersion` et lecture seule si plus récent, champs inconnus gardés, marque de version ; enregistrement copié dans le fil et index reconstruit ; corbeille des conversations ; `.tmp` nettoyés ; avis pour réglages ou accords abîmés ; sauvegarde complète et restauration ; fixtures 0.7 / 0.8 / 0.9 et e2e « profil abîmé » ; essai ENOSPC | R10, R11, R12, R14, R23, R24 | L (en deux fiches) | — | 1) versions et corbeille, 2) reconstruction, disque plein, sauvegarde |
| **H — Banc d'essai V1** | E2e de nuit sur macOS (cron) et suivi des échecs ; cause de `filles` ; moins de `sleep` fixes ; cliquet de couverture ; soak de 4 h | R9 | M | E (budgets) | — |
| **H′ — Durcissement en vrac** | `redact()` dans `main.log`, motifs en plus ; shell de connexion robuste ; gros dépôts en flux ; fusible de chiffrement des cookies ; `img` `file:` refusé ; `Host` vérifié sur le serveur MCP | R17, R18, R21 + petits points | S chacun | — | Bon lot pour une session « petites tâches » |

## Décisions de Jérôme (2026-11-06)

- **R2 dans la 0.9.1** : fait dans cette branche (voir plus bas et le journal de la fiche 148).
- **Lots pour la 0.11** : D et E (gros diffs, longs fils), C (pannes visibles), G (intégrité du
  profil), F (versions des agents).
- **Lot A plus tard** : pas de compte développeur Apple pour l'instant (R1 reste ouvert). Le reste
  du lot (minimum macOS, avis de version, README) attend aussi.
- H et H′ (banc d'essai, durcissement en vrac) : non tranchés.

## R2 corrigé : assistants hors fusible (0.9.1)

Fusible RunAsNode gardé coupé. Les deux assistants sont des scripts `sh` lancés par `/bin/sh -c`
(`src/main/reset.ts`, `src/main/fresh-start.ts`).

La réinitialisation est tout ou rien :
- elle attend la fin de Bobine, sans rien toucher si elle tourne encore ;
- elle déplace avec `mv` ;
- au premier échec, elle remet tout en place et ne touche ni au trousseau ni aux préférences ;
- elle écrit la raison dans le dossier de données. La Bobine relancée l'affiche une fois dans la
  conversation de l'accueil.

Essais : unitaires (le script pour de vrai, échecs compris) et `pnpm e2e:packaged` étendu (profil
temporaire, réinitialisation, réinitialisation impossible, jamais de seconde Bobine). Il tourne aussi
dans `release.yml` sur le DMG. Détail : journal de la fiche 148.

## Corrections triviales faites dans cette branche

- **Fil JSON valide mais qui n'est pas un fil : écrasé.** Reproduit : `[...]` ou `items: "x"` à
  la place d'un fil. Il était remplacé par un fil vide à la première écriture, et la carte disait
  pourtant « mis de côté ». Il est maintenant mis de côté comme un fichier illisible, sur le modèle
  de `loadIndex` (`src/main/conversations/store.ts:160-163`). Essai :
  `store.test.ts` « fil JSON valide mais qui n'est pas un fil ». Ligne dans les deux changelogs.
  Le cas voisin d'une erreur de lecture autre que ENOENT (EACCES) reste au lot G.

## Plan

Audit seulement : pas de code au-delà de la correction triviale. Fichiers touchés : cette fiche,
l'index, `store.ts` et son essai, `CHANGELOG.md`, `CHANGELOG.en.md`.

## Journal

- 2026-11-06 — Audit fait :
  - lecture et cinq relectures parallèles ;
  - mesures sur l'app construite (démarrage, 1 004 conversations, fil de 5 000 éléments, diff de
    5 000 lignes, neuf profils abîmés, montée 0.7 → 0.9 et descente) ;
  - fusible RunAsNode essayé sur l'app packagée (0.7.0 : même `electron-builder.yml:40` depuis la
    0.1, inchangé en 0.9).

  Écarts : la descente n'a été jouée que sur un petit profil. Les mesures de mémoire sont des RSS
  cumulées sur une machine partagée avec d'autres essais : ce sont des ordres de grandeur. La boucle
  de l'écran d'erreur (R8) et nushell (R18) ont été déduits du code, sans être joués. Reste : les
  lots A à H.
- 2026-11-06 — Décisions de Jérôme notées. R2 corrigé (assistants en `sh`, tout ou rien, avis
  au lancement suivant) : `./scripts/verify`, `pnpm e2e:packaged` (et sa variante de
  `release.yml`, `e2e/packaged-ci.mjs`), `pnpm e2e --changed` verts.
- 2026-11-06 — D24 (recette 0.9.1, fiche 183) corrigé : après une réinitialisation, la relance de
  l'app installée garde le dossier de données imposé (`--user-data-dir`) au lieu de rouvrir le vrai
  profil ; pas de relance pour un profil temporaire. Détail : journal de la fiche 148.
- 2026-11-07 — Lot G fait (fiches 196 et 197, branche `claude/robustesse-g-profil`, en relecture) :
  R10, R11, R12, R14, R23, R24, et le cas EACCES laissé de côté plus haut (fichier illisible qu'on
  ne peut pas déplacer : jamais écrasé). ADR-0042.
