# 249 — Sécurité et secrets avant la 1.0.0-rc.1 (lot rc-A de l'audit)

- **Statut** : fait
- **Dépend de** : 007, 072 (accord par site du navigateur), 080 (journaux), 182 (détection des
  secrets), 223 (écriture atomique), 244 (choix des fichiers à committer)
- **Agents** : les deux — rien ne dépend de l'agent (navigateur intégré, journaux, fichiers de
  configuration écrits par l'app, autorisations retenues).

## Pourquoi

L'audit du 2026-11-19 (`docs/audits/2026-11-19-audit-avant-rc.md`) relève deux bloquants de
sécurité avant la rc (B1, B2) et quatre points importants (SEC-2, SEC-4, SEC-6, SEC-8) :

- **B1 / SEC-1** : l'accord par site du navigateur intégré (fiche 072) n'est demandé que par
  `browser_navigate` et `browser_tabs new`. Un `browser_javascript` (`location = …`), un clic sur un
  lien ou une redirection emmènent l'agent sur un site jamais accordé, avec les sessions web de
  l'utilisateur ; il peut ensuite le lire et y agir.
- **B2 / R17** : `main.log` n'est jamais masqué ; la ligne « Agent lancé » écrit toute la commande,
  arguments d'un profil personnalisé compris (`--api-key …`). Ce journal est demandé publiquement
  pour les bugs.
- **SEC-2** : l'écriture atomique crée le nouveau fichier en 0666 (moins l'umask) : un `mcp.json` ou
  un `opencode.json` en 0600 repasse en 0644.
- **SEC-6** : `looksSecret` ne reconnaît que `.env*`, `*.pem`, `*.key`, `id_rsa*`, `*.p12`.
- **SEC-4** : fusible `EnableCookieEncryption` absent : cookies du navigateur intégré en clair sur le
  disque.
- **SEC-8** : « Toujours autoriser » retenu sur le seul titre quand l'agent ne dit pas le `kind`.

## Critères d'acceptation

- [x] **B1** : chaque outil de l'agent qui lit la page ou y agit (`browser_screenshot`,
      `browser_read_page`, `browser_get_page_text`, `browser_find`, `browser_click`,
      `browser_hover`, `browser_type`, `browser_key`, `browser_scroll`, `browser_drag`,
      `browser_form_input`, `browser_console`, `browser_network`, `browser_javascript`, dans un lot
      ou un film compris) vérifie d'abord le site de la page affichée : site extérieur ni accordé
      dans la conversation ni « toujours » → la même carte d'accord que `browser_navigate` (question
      propre : la page est déjà affichée) ; refus → l'outil échoue sans rien lire ni faire, un lot
      s'arrête.
- [x] **B1** : pendant une action de l'agent (et le délai de 1,5 s qui la suit), la page ne part pas
      vers un site non accordé : navigation de la page (`will-navigate`), redirection
      (`will-redirect`), lien « nouvel onglet » ; l'agent en est prévenu (note dans le résultat de
      l'outil : passer par `browser_navigate`, qui demande l'accord).
- [x] **B1** : `browser_navigate` back/forward/reload : la page d'arrivée passe par le même accord.
- [x] **B1** : la navigation de l'utilisateur (barre d'adresse, clic hors d'une action de l'agent)
      n'est pas gênée.
- [x] **B2** : chaque ligne de `main.log` (et de la console) passe par `redact()` ; les arguments en
      `--api-key valeur` (séparés par une espace) sont reconnus ; un secret enregistré par
      `addSecret` est masqué ; `agents.log` aussi, ligne entière.
- [x] **SEC-2** : `writeFileAtomic` / `writeFileAtomicAsync` reprennent le mode du fichier remplacé ;
      les fichiers de configuration d'agents créés par l'app (`mcp-files.ts`, `config-prune.ts` /
      `provider-files.ts`) naissent en 0600.
- [x] **SEC-6** : `looksSecret` reconnaît aussi `.npmrc`, `.netrc`, `.pypirc`, `id_rsa`,
      `id_ed25519`, `id_ecdsa` (et leur `.pub`, comme `id_rsa*` avant), `*.pfx`, `*.p12`, `*.jks`, `*.keystore`,
      `credentials.json`, `service-account*.json`. Le défaut « coché » n'est **pas** changé :
      décision explicite de la fiche 244 (Q2, validée par l'utilisateur le 2026-11-18).
- [x] **SEC-4** : fusible `enableCookieEncryption: true` ; ce qui arrive aux cookies existants
      documenté ci-dessous.
- [x] **SEC-8** : `rememberableTool` refuse un appel sans `kind`.
- [x] Testé contre l'agent factice : unitaires pour chaque point ; scénario `changement-de-site`
      (navigate local, puis `browser_javascript` `location = 'https://…invalid/'` → arrêté, l'agent
      prévenu, la page reste locale) ; page partie hors d'une action de l'agent → carte d'accord à
      l'outil suivant, refus → rien de lu. Suite e2e `browser`.

## Plan

1. **B1** — `browser-manager.ts` : option `siteAllowed(conversationId, url)` ; par onglet, un
   compteur d'actions de l'agent en cours (`agentBusy`) en plus de `agentUntil` ; `will-navigate`
   et `will-redirect` (cadre principal) : pendant une action de l'agent, site non accordé →
   `preventDefault()` et noté (`blockedNavigations`) ; même chose pour un lien « nouvel onglet ».
   `browser-driver.ts` : `asAgent` encadre l'action (début / fin), `go` passe aussi par `asAgent`,
   `blockedNavigations()` exposé. `browser-tools.ts` : `allows(id, url)` sur le module ; chaque
   action listée vérifie le site de la page (`approve` avec une question « page affichée ») ;
   history → vérification après coup ; note des navigations arrêtées dans `withPageNotes` ; liste
   des onglets : titre masqué pour un site non accordé. `browser-setup.ts` : branche
   `siteAllowed`. Clé i18n `approvals.site.questionCurrent` (fr, en). Tests unitaires
   (`browser-tools.test.ts`). Scénario `changement-de-site` (`src/mock-agent/scenarios.mts`,
   `docs/mock-agent.md`) et e2e `browser`.
2. **B2** — `log.ts` : `formatLine` masque la ligne entière (`redact`), `agentLog.line` aussi ;
   `secret-scan.ts` : motif des options en ligne de commande (`--api-key valeur`,
   `--token valeur`…). Tests `log.test.ts`, `secret-scan` / `log-redact`.
3. **SEC-2** — `storage.ts` : mode du fichier remplacé repris (`fchmod`, sans l'umask), sinon
   `createMode` (0666 par défaut) ; `mode` explicite garde la priorité. `mcp-files.ts`,
   `config-prune.ts` : `createMode: 0o600`. Tests `storage.test.ts`, `mcp-files.test.ts`.
4. **SEC-6** — `worktree-cycle.ts` : `looksSecret` élargi ; tests.
5. **SEC-4** — `electron-builder.yml` : `enableCookieEncryption: true` ; `pnpm package --dry-run`.
6. **SEC-8** — `permissions.ts` : `kind` absent → pas de « toujours » ; tests.
7. CHANGELOG (fr, en), index des fiches, `docs/architecture.md` si besoin.

Aucune nouvelle dépendance.

## Journal

- 2026-11-19 — Fiche créée (lot rc-A de l'audit avant la rc).
- 2026-11-19 — **Fait** (branche `rc/a-securite`).
  - **B1** : `navigation-guard.ts` (nouveau, sans `electron`) : un onglet compte les actions de
    l'agent en cours (`agentBusy`, en plus du délai de 1,5 s de la fiche 072 — une navigation de
    l'agent dure plus que ce délai) ; `will-navigate` et `will-redirect` (cadre principal)
    arrêtent un site non accordé pendant une action de l'agent et le notent ; même chose pour un
    lien « nouvel onglet » (`setWindowOpenHandler`). `BrowserManager.beginAgentAction` remplace
    `markAgentInput` ; le pilote encadre aussi `go` (historique). `browser-tools.ts` : chaque outil
    de `PAGE_TOOLS` vérifie le site affiché (`checkShownSite`) avant de s'exécuter, en lot et en
    film compris ; carte « Site web » identique, question propre
    (`approvals.site.questionShown`) ; refus → l'outil échoue (un lot s'arrête à la première
    action, une seule carte) ; historique : vérification à l'arrivée ; note
    `blockedNavigationNote` dans le résultat ; liste des onglets : ni titre ni adresse entière
    d'un onglet sur un site non accordé. Le module expose `allows(id, url)`, branché sur le
    gestionnaire par `browser-setup.ts`.
  - **Choix** : une navigation de l'agent vers un site non accordé est **refusée** avec une note
    (« passer par `browser_navigate`, qui demande l'accord »), pas une carte au milieu d'un
    évènement de navigation ; une page partie ailleurs hors d'une action de l'agent (lien suivi
    par l'utilisateur, redirection tardive d'une page) donne la carte à l'outil suivant. Un site
    où l'utilisateur va par un clic n'est pas accordé d'office (seule la barre d'adresse l'est,
    fiche 072) : l'agent demande s'il doit le lire.
  - **Limites connues** : un clic de l'utilisateur dans la page pendant une action de l'agent (ou
    1,5 s après) vers un site non accordé est arrêté comme s'il venait de l'agent (les gestes de
    l'agent passent par le CDP et ne se distinguent pas dans ce délai) ; il suffit de recliquer.
    Les cadres (`iframe`) ne sont pas gardés : les outils lisent le cadre principal.
  - **B2** : `formatLine` passe la ligne entière par `redact()` (fichier et console) ;
    `agentLog.line` aussi. Nouveau motif dans `secret-scan.ts` : option de ligne de commande nommée
    comme un secret suivie de sa valeur (`--api-key valeur`, `"--api-key","valeur"`), sans masquer
    `--max-tokens 4096` ni une option suivie d'une autre option. Il vaut aussi pour la mémoire
    (`findSecret`, fiche 182).
  - **SEC-2** : `writeFileAtomic` / `writeFileAtomicAsync` : `mode` imposé, sinon les droits du
    fichier remplacé (posés par `fchmod`, sans l'umask), sinon `createMode` (0666 moins l'umask par
    défaut). `mcp-files.ts` et `config-prune.ts` (donc `provider-files.ts`) : `createMode: 0o600`.
    Un fichier existant en 0644 le reste (droits de l'utilisateur respectés).
  - **SEC-6** : `looksSecret` élargi. **Défaut non changé** : la fiche 244 a décidé (Q2, validée le
    2026-11-18) que le fichier « secret ? » reste coché ; à rouvrir avec l'utilisateur si besoin.
    L'élargissement vaut aussi pour le diff envoyé à l'agent qui rédige le message de commit
    (`commit-diff.ts`, fiche 246 : contenu d'un fichier « secret ? » jamais envoyé).
  - **SEC-4** : `enableCookieEncryption: true` (`electron-builder.yml`), lu dans l'app packagée
    (`@electron/fuses` : `EnableCookieEncryption` activé). Ce qui arrive aux cookies existants
    (documentation d'Electron, non rejoué sur un vrai profil) : passage à sens unique ; les cookies
    en clair restent lisibles et sont chiffrés à la réécriture, les sessions restent ouvertes ;
    retirer plus tard le fusible rendrait les cookies chiffrés illisibles (déconnexion des sites).
    La clé est celle de `safeStorage` (élément « Bobine Safe Storage » du trousseau de session sur
    Mac), déjà utilisée par les clés d'API (fiche 022) : pas de nouvel élément au trousseau. Avec
    une signature ad hoc, macOS peut redemander l'accès à cet élément après une mise à jour, comme
    pour les clés d'API. Le mode développement (`pnpm dev`) n'a pas de fusibles : cookies en clair.
  - **SEC-8** : `rememberableTool` : `kind` absent → `undefined` ; le bouton « Toujours » reste,
    avec la portée de l'agent (fiche 214), sans être retenu par l'app. Le test qui retenait un
    titre sans `kind` est réécrit avec `kind: 'fetch'`.
  - **Agent factice** : scénarios `changement-de-site` et `page-affichee` (`docs/mock-agent.md`) ;
    e2e `browser` : site « extérieur » `bobine-e2e.example` résolu vers le serveur de l'essai par
    `--host-resolver-rules`, sans réseau ; capture `28h-site-affiche-accord` (clair, sombre).
  - **Essais** : unitaires (rouges sans correctif, vérifié en remettant chaque fichier source de
    `main` : 7 + 6 + 4 + 2 échecs) ; `verify` vert ; e2e `browser` (clair, sombre) ; app packagée
    (`pnpm package`, `pnpm e2e:packaged`).
