# Audit complet avant la 1.0 rc — 2026-11-19

Commit audité : `f3a1b4b` (1.0.0-beta.9). Six audits en lecture seule (dépendances et cycle de vie,
robustesse, sécurité, qualité et tests, publication et plates-formes, documentation), puis recoupés
par le tech lead : les constats les plus graves ont été revérifiés dans le code (marqués ✔︎), les
faux positifs écartés.

## Verdict

**Pas de rc en l'état.** Le cœur est sain : durcissement Electron complet (isolation, sandbox,
fusibles, CSP stricte, IPC vérifié), serveur MCP local à jeton, aucune vulnérabilité connue dans
les dépendances, licences en règle, 15 des 24 risques de la fiche 187 corrigés (le registre n'était
pas à jour), règles d'architecture respectées (aucun code propre à un agent dans l'interface,
i18n synchronisée). Mais il reste **un garde-fou de sécurité contournable**, **une fuite possible de
secrets dans le journal demandé aux utilisateurs**, **une CI qui ne donne plus de signal fiable**,
une phrase interdite dans la doc publique, et un parcours d'installation jamais joué en vrai.

Estimation : **4 à 5 jours** de travail délégué pour les bloquants, puis la recette Bob courte
(≈ 8–12 bobcoins) et l'essai d'installation réel.

## 1. Bloquants pour la rc

| # | Constat | Preuve | Correctif | Effort |
|---|---|---|---|---|
| B1 ✔︎ | **Accord par site du navigateur intégré contournable** (SEC-1). Seuls `browser_navigate` et `browser_tabs new` demandent l'accord ; `browser_javascript`, un clic, une redirection changent de site sans carte, avec les sessions web de l'utilisateur (partition persistante commune). Scénario : injection de consigne → `location='https://github.com/settings/tokens'` depuis `localhost`. | `browser-tools.ts:321,482` ; `browser-manager.ts:653-655` (`will-navigate` ne filtre que le schéma) | Vérifier le site courant avant chaque outil de l'agent ; pendant une action de l'agent, suspendre toute navigation vers un site non accordé (`will-navigate`, `will-redirect`). Test e2e factice. | S/M |
| B2 ✔︎ | **`main.log` jamais masqué** (R17). `formatLine` n'appelle pas `redact()` ; la ligne « Agent lancé » écrit toute la commande, arguments d'un profil personnalisé compris. Ce journal est demandé publiquement pour les bugs. | `log.ts:123-133` ; `agent-process.ts:96` | `redact()` dans `formatLine` ; test avec un faux `--api-key`. | S |
| B3 ✔︎ | **La doc publique dit s'appuyer sur le code de Bob** (DOC-1), contraire à la fiche 216. | `docs/acp.md:70` (« de sa documentation et de son code ») ; `features/017:66`, `features/155:103` | Réécrire en comportement observé/documenté ou retirer ; note datée fiche 216. | S |
| B4 ✔︎ | **La CI e2e ne donne plus de signal** (QUA-6, REL-3). Le job Linux échoue à chaque push (12/12), masqué par `continue-on-error` ; l'échec connu `terminal` cache d'autres échecs intermittents (fil, perf, permissions…). macOS et Windows ne tournent pas au push. | `e2e.yml:83-90` ; run 44448966403 | Quarantaine explicite de `terminal` sous Linux pour que le job redevienne vert et bloquant ; e2e macOS de nuit. | S/M |
| B5 | **Stabilité Windows non prouvée** (QUA-3, QUA-4) : 6 des 9 échecs récents de `main` viennent de tests Windows à attentes fixes. Les deux correctifs de cette semaine (WAL, abonnement stable) n'ont qu'un passage vert. | runs 43852489674, 44413453495, 44439977234 | Remplacer les attentes à durée fixe à risque par des attentes d'évènement (`terminal-manager`, `agent-host:167`, `manager:1033`…) ; 10 passages Windows consécutifs verts. | M |
| B6 | **Installation réelle jamais jouée** (REL-1) : aucun `.dmg` n'a été ouvert après téléchargement par un navigateur (quarantaine). L'ordre des étapes du README est trompeur (l'étape 2 est déjà le premier lancement que l'étape 3 dit bloqué). | fiches 059, 220 (`gh release download`, sans quarantaine) ; `README.md` | Recette sur un compte macOS 15+ neuf, téléchargement par Safari, README suivi à la lettre (captures, vidéo) ; README FR/EN réordonné. **Demande Jérôme** (compte neuf). | M |
| B7 | **Electron 45.3.3 a deux correctifs de retard** (LCM-1) : 45.4.1 porte des correctifs Chromium/V8. Sans mise à jour automatique, le binaire de la rc vivra longtemps chez les testeurs. | `pnpm view electron dist-tags` | Monter en 45.4.x, `pnpm e2e:packaged`, suite complète. | S |
| B8 | **Décisions non tranchées pour ce qui part en 1.0** (DOC-5, DOC-10) : 11 ADR « proposé » livrés depuis plusieurs versions (0022, 0028, 0030, 0035–0037, 0039–0042, 0048) ; fiche 213 (P1) ouverte alors que la 215 qui en dépend est livrée ; registre 187 périmé. | `docs/adr/README.md` ; `features/213:245-254` ; `features/187` | Accepter (note datée) ou amender chaque ADR ; reporter 213 après 1.0 ou la découper ; mettre la 187 au vrai (R1 = choix assumé). | M |
| B9 | **Contrat des agents non revérifié** (REL-8, DOC-11) : sonde Bob du 2026-11-14 (2.1.0), fiche 215 jamais sondée en réel, intro « Compatibilité Bob » sur 2.0.9. | `scripts/bob-probe.expected.json` ; `features/215:62` ; `acp.md:31,66` | `pnpm bob-probe` et `pnpm opencode-probe` < 7 jours avant le tag ; recette Bob courte. **Bobcoins : accord Jérôme.** | S + recette |

## 2. Importants (avant la 1.0 finale)

**Sécurité**
- SEC-2 ✔︎ Les écritures de config MCP / fournisseurs repassent un fichier 0600 en 0644 (`storage.ts:191`, `mode ?? 0o666`) : reprendre le mode existant, 0600 par défaut. S
- SEC-6 `looksSecret` étroit (`.npmrc`, `.netrc`, `id_ed25519`, `*.pfx`, `credentials.json`…) et le fichier signalé reste coché : élargir, décocher par défaut. S
- SEC-3 « Toujours cette commande » retient le texte (`pnpm dev`) pas son contenu : l'agent modifie le script puis lance `preview_start` sans carte. Empreinte des fichiers de définition dans la clé. M
- SEC-4 Fusible `EnableCookieEncryption` absent : cookies du navigateur intégré en clair. S
- SEC-5 / REL-2 Pas de `SHA256SUMS` ni d'attestation de provenance pour le `.dmg`. S
- SEC-8 (déduit) « Toujours autoriser » sur le seul titre si `kind` est absent : exclure `kind` absent. S

**Fiabilité**
- R5 / SEC-7 Aucun avis de nouvelle version (ADR-0023) : nouvel ADR, vérification facultative de `releases/latest`, ouverture de la page seulement. S + ADR
- R13 / REL-4 `minimumSystemVersion` absent alors que « macOS 13+ » est annoncé : déclarer, essayer le `.dmg` sur `macos-14`. S
- ROB-1 Pas de délai sur `session/set_mode` et `set_config_option` au démarrage : un agent muet bloque sans bandeau. S
- R18 Shell de connexion : `-ilc` sans repli, stdin non coupé (attente 10 s avec un rc qui lit l'entrée). S
- ROB-2 (déduit) `actionsFor(id)` neuf à chaque rendu : la recherche `@` ne part pas tant qu'un fil voisin écrit. S
- R21 Très gros dépôts (`maxBuffer` 64 Mo, `-uall`). S

**Tests et chaîne**
- QUA-1/2 ✔︎ 120 tests de 20 fichiers finissent avec `window.api` restauré avant le démontage : `sequence.hooks: 'list'` sur le projet renderer (essayé : 938/938 verts) + `cleanup()` dans 3 fichiers imbriqués. S
- QUA-5 / QUA-7 82 `setTimeout` dans les tests unitaires, 177 `sleep` dans les e2e : chasse par ordre de risque, règle ESLint contre les pauses ≥ 100 ms sans raison. M/L
- LCM-3 ADR « politique de montée de version » (Electron 45 hors support le 2027-04-27, correctif Chromium sous N jours, tri des alertes sur l'audit complet). S
- LCM-6 Geler `@agentclientprotocol/sdk` (version exacte) pendant la rc. S
- LCM-4 AXe 1.8.0 épinglé, 2.0.4 disponible (hors Dependabot) : après la rc. M

**Documentation**
- DOC-2/3/4 Versions de Bob et OpenCode périmées dans `acp.md`, README (OpenCode 2.3.0), `agents.md`. S
- DOC-7/8/9/12/13 Statuts de fiches faux (224, 182, 145) et critères « essai réel avec Bob » non cochés sur des fiches « fait » (121, 200). M
- REL-6 Linux et Windows : rester « préversion » à la 1.0 (statuts 145/229 au vrai, essai packagé `.deb`/`.exe` dans `release.yml`). M
- REL-7/9 Exploitation documentée pour le Mac seulement ; `installation.md` parle encore de notarisation « prête ». S

## 3. Mineurs
QUA-8 fichiers au plafond (`manager.ts`, `agent-host.ts`, `ipc.ts`) — découper avant d'y toucher ;
QUA-9 3 `eslint-disable` sans raison ; QUA-10 navigateur (`cdp-tab`, `browser-manager`) sans test
unitaire ; QUA-11 19 worktrees à élaguer ; LCM-7/8/10/11 (sonde MCP, paquets dépréciés de
l'outillage, `.nvmrc`, image Docker et runners non épinglés) ; REL-10/12 (CODE_OF_CONDUCT, gabarit
de PR, « Supported versions ») ; ROB-3/4/5 (sérialisation synchrone des longs fils, réécriture de
tous les fils en quittant, lecture synchrone de `bob.db`) à mesurer ; DOC-6, DOC-14.

## 4. Écartés ou corrigés au recoupement
- « Release beta.9 publiée sur un commit rouge » (QUA-3) : faux. Le commit `eb71bdd` était rouge,
  la publication a été arrêtée ; le tag publié pointe sur `f3a1b4b`, vert partout.
- DOC-15 (pas de « Prochaine version » au CHANGELOG) : normal juste après une publication.
- REL-3 classé important plutôt que bloquant seul : la suite e2e Mac complète tourne en local avant
  chaque tag ; il devient bloquant par B4 (le signal de la CI).
- R1 (Gatekeeper) : choix assumé, pas de notarisation.

## 5. Plan proposé

| Lot | Contenu | Effort | Qui |
|---|---|---|---|
| rc-A Sécurité et secrets | B1, B2, SEC-2, SEC-6, SEC-4, SEC-8 | ≈ 1,5 j | filles, relecture tech lead |
| rc-B CI digne de confiance | B4, B5, QUA-1/2, SEC-5/REL-2, R13 | ≈ 1,5 j | filles |
| rc-C Décisions et docs | B3, B8, DOC-2/3/4/7/8/9, REL-6/9 | ≈ 1 j | filles ; arbitrages Jérôme |
| rc-D Chaîne | B7, LCM-6, LCM-3 (ADR) | ≈ 0,5 j | filles |
| rc-E Fiabilité agents | ROB-1, R18, ROB-2 | ≈ 0,5 j | filles |
| Vérifications réelles | B6 installation (compte neuf), B9 sondes + recette Bob courte | ≈ 0,5 j + 8–12 bobcoins | Jérôme + tech lead |

Puis 1.0.0-rc.1 ; la finale après ≥ 7 jours de rc sans bloquant, l'avis de nouvelle version (R5),
et au moins un retour d'installation extérieur.

## Décisions attendues de Jérôme
1. Avis de nouvelle version (R5) : pour la rc, la finale, ou jamais ?
2. Linux et Windows : « préversion » à la 1.0 (recommandé) ?
3. Fiche 213 (« Tout approuver ») : reportée après la 1.0 (recommandé) ?
4. Recrutement de 2–3 essayeurs extérieurs pour la rc.
