# 048 — Sonde du contrat ACP de Bob

- **Statut** : fait
- **Dépend de** : 011, 022, 041

## Pourquoi

Revue du 2026-10-14 : toute la compatibilité avec Bob a été vérifiée à la main sur Bob 2.0.6 et
consignée dans la matrice de `docs/acp.md`, mais rien ne prévient quand une nouvelle version de Bob
change ses réponses. L'app dépend pourtant de détails non documentés : un code d'erreur, des
messages reconnus par motif, des capacités, le schéma de la base des coûts. Une sonde gratuite,
lancée à chaque mise à jour de Bob, dit en quelques secondes ce qui a bougé et si l'app s'y
retrouve encore.

## Critères d'acceptation

- [x] `pnpm bob-probe` rejoue les sondages gratuits de `docs/acp.md` contre le Bob installé :
      `initialize`, `session/list` avant connexion, `session/new` (dossier non approuvé, sans
      connexion, clé factice sans licence), deux clés différentes, colonnes de `tasks` dans
      `~/.bob/db/bob.db`.
- [x] Aucun message au modèle (0 bobcoin) ; Bob tourne dans un `HOME` jetable, sans la clé de
      l'utilisateur, télémétrie coupée ; jamais `--accept-license` ; rien d'écrit dans le vrai
      `~/.bob`.
- [x] Contrat de l'app vérifié avec les **mêmes** codes et motifs que le code (module partagé
      `bob-contract.ts`) ; réponses comparées à des attentes versionnées, écarts listés ; code de
      sortie non nul en cas d'écart ou de contrat rompu ; `--accept` enregistre les nouvelles
      réponses.
- [x] Ni dans `verify` ni dans les tests automatiques (pas de vrai agent en CI) ; comparaison et
      contrat testés à part (fonctions pures).
- [x] Lancée une fois contre Bob 2.0.6 : résultat noté ci-dessous.

## Plan

1. `main/agent/bob-contract.ts` : `AUTH_REQUIRED`, `LICENSE_REQUIRED`, `UNTRUSTED_WORKSPACE`, repris
   par `agent-host.ts` et `profiles.ts` (comportement inchangé).
2. `main/agent/bob-probe.ts` (sans alias, chargé par Node) : `stablePaths`, `diffObservations`,
   `contractChecks`.
3. `scripts/bob-probe.mts` : bacs à sable (`HOME`, dossier), sondages par le SDK ACP, rapport,
   `--accept`, `--bob <commande>` ; `package.json` (`bob-probe`).
4. `scripts/bob-probe.expected.json` (Bob 2.0.6) ; tests ; `docs/acp.md`, `AGENTS.md`,
   `docs/architecture.md`.

Aucune nouvelle dépendance (`node:sqlite` est déjà utilisé pour les coûts).

## Journal

- 2026-10-14 — Fiche créée et faite (revue du projet, chantier 3 sur 3).
  - Relevés de Bob 2.0.6 identiques à la matrice de `docs/acp.md` : `bob-shell` / « Bob »,
    `loadSession`, `close` / `delete` / `list` / `resume` (pas de `fork`), images et contexte
    intégré, MCP `http`, méthode `sso`, extension `bob/extensions` version 1 (dans
    `agentCapabilities._meta`, pas à la racine de la réponse) ; `session/list` vide ;
    `-32600` dossier non approuvé, `-32000` « Authentication required », `-32600` licence ; deux
    clés différentes : Bob s'arrête avant `initialize` (« BOBSHELL_API_KEY and BOB_API_KEY are
    both set but have different values… », sur stderr). Contrat : 9 vérifications sur 9.
    **0 bobcoin**, ≈ 8 s.
  - Vérifié après coup : `~/.bob/settings/settings.json`, `trustedFolders.json`, `bob.db` et son
    WAL inchangés ; seul `bob.db-shm` est rafraîchi par la lecture du schéma (comme à chaque
    lecture des coûts par l'app) ; aucun dossier jetable laissé.
  - Écueils : sur macOS, le dossier temporaire passe par un lien (`/var` → `/private/var`) que
    Bob résout dans ses messages (chemins pris par `realpath`) ; Bob qui s'arrête au démarrage
    ferme la connexion avant que sa sortie soit lue (la raison est prise sur stderr) ; Bob envoie
    des statistiques d'usage par défaut (`telemetry.enabled`) : coupées dans le `HOME` jetable,
    et `OTEL_SDK_DISABLED`.
  - Écart au plan : aucun. Hors sonde, faute de session ouverte sans vraie connexion : modes,
    commandes annoncées, `session/load` — restent des vérifications manuelles.
  - `./scripts/verify` vert ; pas d'e2e (aucune interface touchée).
