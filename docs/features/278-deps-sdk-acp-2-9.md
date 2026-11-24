# 278 — Dépendances, lot de maintenance : SDK ACP 2.9.1, bibliothèques, OpenCode 2.4.1

- **Statut** : fait (suites e2e touchées à jouer sur GitHub)
- **Dépend de** : 233 (lot 2, SDK ACP 2.7), 217 (avis de licence), 198 (sonde d'OpenCode en CI),
  ADR-0057 (politique de montée de version), ADR-0070 (SDK ACP pendant une rc)
- **Agents** : les deux (aucun code propre à un agent)

## Pourquoi

Maintenance pendant le gel de la 1.0, décidée par l'utilisateur : suivre le SDK ACP (corrections
de l'ordre des messages), monter les bibliothèques en mineure ou corrective, et prendre acte
d'OpenCode 2.4.1, vue par la sonde hebdomadaire en CI.

## Critères d'acceptation

- [x] SDK ACP 2.9.1 : notes des 2.8.0, 2.9.0 et 2.9.1 relues, chaque changement confronté au
      main ; aucune hypothèse nouvelle sur Bob.
- [x] Montées mineures et correctives dans le délai de pnpm (ADR-0057, point 2 : aucune
      exception).
- [x] Avis de licence régénérés.
- [x] Référence de la sonde d'OpenCode à 2.4.1 (sans modèle) ; commandes traitées génériquement.
- [x] `pnpm opencode-probe --offline` et `pnpm bob-probe` : contrats verts avec le SDK 2.9.1.
- [x] `./scripts/verify` vert.
- [ ] Suites e2e touchées vertes sur GitHub (ADR-0069).

## Plan

Un commit pour les montées (lockfile et avis de licence), un pour la référence d'OpenCode, un
pour la doc. Aucune nouvelle dépendance. Non montés (décisions séparées) : TypeScript 7,
`@types/node` 26.

**SDK ACP pendant la rc** : conforme à l'ADR-0070 (décision de l'utilisateur du 2026-11-24, qui
remplace le gel du point 4 de l'ADR-0057) : sondes réelles de Bob et d'OpenCode vertes (contrat
complet), suites e2e touchées à jouer sur GitHub.

## Versions

| Paquet | Avant | Après | Publiée | Livré |
|---|---|---|---|---|
| `@agentclientprotocol/sdk` | 2.7.0 | **2.9.1** | 2026-11-21 | main |
| `i18next` | 27.1.2 | **27.2.4** | 2026-11-22 | main, interface |
| `react-i18next` | 18.0.1 | **18.0.3** | 2026-11-19 | interface |
| `lucide-react` | 1.73.0 | **1.77.0** | 2026-11-20 | interface |
| `ignore` | 7.0.14 | **7.0.16** | 2026-11-17 | main |
| `vitest`, `@vitest/coverage-v8` | 5.1.0 | **5.1.1** | 2026-11-18 | non (outillage) |
| `typescript-eslint` | 8.72.2 | **8.73.0** | 2026-11-16 | non (outillage) |

Toutes publiées depuis plus d'un jour : `pnpm install` les a prises sans exception au délai.

## SDK ACP 2.7.0 → 2.9.1 (schéma 1.32 → 1.34)

Notes relues (GitHub, `agentclientprotocol/typescript-sdk`, releases v2.8.0, v2.9.0, v2.9.1) et
types `dist/v1/unstable/schema/types.gen.d.ts` comparés entre les deux versions :

- **Schéma 1.33 et 1.34** : pour un client, que des ajouts. Instables : curseurs de session
  (`SessionCapabilities.cursors`, mise à jour `cursor_update`, `cursorId` facultatif). Stabilisés
  (déjà lus par l'app via l'entrée instable, `src/shared/acp-sdk.mts`) : `plan_update` /
  `plan_removed`, `subagent_update`, `session_message(_chunk)`, référence de session. Le reste :
  commentaires (MUST / SHOULD). `tsc` passe sans changement.
- `cursor_update` : non annoncée par l'app, envoyée par aucun agent ; reçue, elle serait ignorée
  par `routeUpdate` comme toute mise à jour inconnue (et compterait comme un signe de travail pour
  le bandeau de silence, `agent-progress.ts` : sans effet tant qu'aucun agent ne l'envoie).
- 2.8.0 : notifications reçues avant que l'agent ferme son flux délivrées ; validateur allégé.
- 2.9.0 : messages traités **dans l'ordre d'arrivée** ; messages en attente délivrés avant une
  erreur de lecture du flux ; repli sur `setImmediate`. Annulations v2, `-32601` pour
  `tool_call/cancel` et `terminal/cancel`, validation de `auth/status` (v1) : non utilisés par
  l'app.
- 2.9.1 : `assertSupportedMcpServers` refuse une commande MCP stdio relative ; aide côté agent,
  non utilisée (l'app ne donne qu'un serveur MCP HTTP, et l'agent factice ne l'appelle pas).

## Journal

- 2026-11-24 : montées faites (`f57ffaa`), avis de licence régénérés (`pnpm build && pnpm
  third-party-notices` : 183 paquets, Electron 45.4.1 ; inventaire reformaté par Prettier). Premier
  `verify` du worktree neuf : `ipc.test.ts` en échec, binaire d'Electron téléchargé au premier
  `require` par plusieurs fichiers d'essai à la fois (« File exists ») ; sans rapport avec le lot,
  vert au passage suivant.
- 2026-11-24 : OpenCode 2.4.1 (`dc0d53c`). Sonde hebdomadaire en CI du 2026-11-23 (run
  45234324357) : contrat 12/12, seul écart `session/new.commands` + `automation`. La référence
  sans modèle est mise à jour à la main (pas d'OpenCode 2.4.1 sur ce Mac) : seul ce champ change
  et `offline` vaut `2.4.1`, ce que ferait `--offline --accept` (`acceptedExpectations`). 2.4.1
  ajoutée à `testedVersions` (le test des profils l'exige pour la dernière version sans modèle).
  Commandes : `mergeCommands` et `appCommandOf` comparent les noms, `automation` n'en recoupe
  aucun de l'app ; rien à faire.
- 2026-11-24 : sondes réelles avec le SDK 2.9.1. `pnpm bob-probe` (Bob 2.1.0, 0 bobcoin,
  `~/.bob` sauvegardé puis restauré à l'identique) : contrat 12/12, réponses identiques à la
  référence 2.1.0. `pnpm opencode-probe --offline` (OpenCode 2.3.0 local, Homebrew ne propose pas
  encore la 2.4.1 dans son index local, non mis à jour) : contrat 12/12 ; sortie 1 attendue, seul
  écart la commande `automation` de la référence 2.4.1, absente de la 2.3.0.
- 2026-11-24 : l'utilisateur garde le SDK 2.9.1 pendant la rc : ADR-0070 (remplace le point 4
  de l'ADR-0057, dont seul le statut change).
- 2026-11-24 : suite e2e complète sur GitHub (run 45336692893). Linux vert ; macOS, 5 tâches
  rouges sur 242, chacune verte dans l'autre thème du même passage. Comparées aux passages macOS
  récents de `main` et des autres branches (`gh run list --workflow e2e.yml`) : aucune ne vient du
  lot ; deux sont déjà connues (`worktree-setup` clair, même attente, rouge sur `main` le
  2026-11-23, run 45174929251 ; service réseau de Chromium vivant après l'app, `filles-tech-lead`
  le 2026-11-23). Le SDK 2.9.1 (un message par tâche de la boucle) change au plus la durée des
  fenêtres de course ; aucune ne dépend de l'ordre des messages. Détail et correctifs : fiche 250
  (journal du 2026-11-24).
  - `session` sombre : **défaut de l'app**, « Arrêter » perdu quand l'agent de la fille démarre
    encore (statut `starting`, ou message en préparation) ; corrigé (`SendOrder`, `AgentHost`).
  - `worktree-setup` clair : **défaut de l'app**, la carte à autoriser bougeait sous le pointeur ;
    `data-scroll-hold`.
  - `parcours-reglages` clair : **essai**, bandeau transitoire (≈ 0,8 s) relevé toutes les 100 ms ;
    scénario `reseau-revenu-au-signal-2-3`, le réseau revient quand l'essai a vu le bandeau.
  - `parcours-outils` sombre : **essai**, processus de Chromium (`--type=`) attendus 10 s comme
    crashpad, l'essai échoue toujours s'ils restent.
  - `browser` clair : cause non établie (`inherit` avale ses erreurs) ; l'échec dit désormais
    l'état des pages du main. Pas de correctif à l'aveugle.
  `./scripts/verify` vert. Rien joué en local (ADR-0069).
- Reste : suites e2e touchées sur GitHub (`session`, `worktree-setup`, `parcours-reglages`,
  `parcours-outils`, `browser`, et celles des fichiers modifiés) ; sonde d'OpenCode 2.4.1 avec
  modèle gratuit.
