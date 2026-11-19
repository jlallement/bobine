# 249 — Sécurité et secrets avant la 1.0.0-rc.1 (lot rc-A de l'audit)

- **Statut** : en cours
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

- [ ] **B1** : chaque outil de l'agent qui lit la page ou y agit (`browser_screenshot`,
      `browser_read_page`, `browser_get_page_text`, `browser_find`, `browser_click`,
      `browser_hover`, `browser_type`, `browser_key`, `browser_scroll`, `browser_drag`,
      `browser_form_input`, `browser_console`, `browser_network`, `browser_javascript`, dans un lot
      ou un film compris) vérifie d'abord le site de la page affichée : site extérieur ni accordé
      dans la conversation ni « toujours » → la même carte d'accord que `browser_navigate` (question
      propre : la page est déjà affichée) ; refus → l'outil échoue sans rien lire ni faire, un lot
      s'arrête.
- [ ] **B1** : pendant une action de l'agent (et le délai de 1,5 s qui la suit), la page ne part pas
      vers un site non accordé : navigation de la page (`will-navigate`), redirection
      (`will-redirect`), lien « nouvel onglet » ; l'agent en est prévenu (note dans le résultat de
      l'outil : passer par `browser_navigate`, qui demande l'accord).
- [ ] **B1** : `browser_navigate` back/forward/reload : la page d'arrivée passe par le même accord.
- [ ] **B1** : la navigation de l'utilisateur (barre d'adresse, clic hors d'une action de l'agent)
      n'est pas gênée.
- [ ] **B2** : chaque ligne de `main.log` (et de la console) passe par `redact()` ; les arguments en
      `--api-key valeur` (séparés par une espace) sont reconnus ; un secret enregistré par
      `addSecret` est masqué ; `agents.log` aussi, ligne entière.
- [ ] **SEC-2** : `writeFileAtomic` / `writeFileAtomicAsync` reprennent le mode du fichier remplacé ;
      les fichiers de configuration d'agents créés par l'app (`mcp-files.ts`, `config-prune.ts` /
      `provider-files.ts`) naissent en 0600.
- [ ] **SEC-6** : `looksSecret` reconnaît aussi `.npmrc`, `.netrc`, `.pypirc`, `id_rsa`,
      `id_ed25519`, `id_ecdsa` (pas leur `.pub`), `*.pfx`, `*.p12`, `*.jks`, `*.keystore`,
      `credentials.json`, `service-account*.json`. Le défaut « coché » n'est **pas** changé :
      décision explicite de la fiche 244 (Q2, validée par l'utilisateur le 2026-11-18).
- [ ] **SEC-4** : fusible `enableCookieEncryption: true` ; ce qui arrive aux cookies existants
      documenté ci-dessous.
- [ ] **SEC-8** : `rememberableTool` refuse un appel sans `kind`.
- [ ] Testé contre l'agent factice : unitaires pour chaque point ; scénario `changement-de-site`
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
