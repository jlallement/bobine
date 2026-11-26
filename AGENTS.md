# AGENTS.md — consignes pour les agents de code

Ce fichier est la **source unique** de consignes pour tous les agents (Claude Code, Codex, Bob…).
Il reste court : les détails vivent dans `docs/`. Ne dupliquez pas la doc ici, pointez vers elle.

## Le projet en une phrase

**Bobine** (anciennement Bob Desktop) : une application de bureau (Electron) dans l'esprit de
Claude Desktop, qui pilote un agent de code via **ACP** (Agent Client Protocol) — cible finale
`bob acp` (IBM Bob Shell), avec **OpenCode** (modèles gratuits) et un **agent factice** pour les
essais. Claude Code et Codex ne sont pas des cibles : on s'inspire de leurs fonctionnalités, sans
cas particuliers pour eux. Anciennement « Bob Desktop » : ADR-0013. Les variables de l'app sont
en `BOBINE_*` ; `BOB_API_KEY` et `~/.bob` sont à IBM Bob.

Lire avant toute tâche non triviale :
- `docs/architecture.md` — découpage main / renderer / ACP / MCP
- `docs/adr/` — décisions déjà prises (ne pas les remettre en cause sans nouvel ADR)
- la fiche concernée dans `docs/features/`

## Stack

- Electron + TypeScript (strict) + React, gestionnaire de paquets **pnpm**
- Client ACP : `@agentclientprotocol/sdk` (main process uniquement)
- Serveur MCP maison hébergé dans le main process (panneaux navigateur / simulateur)

## Commandes

| Action | Commande |
|---|---|
| Installer | `pnpm install` |
| Lancer en dev | `pnpm dev` |
| **Vérifier (obligatoire avant de dire « fini »)** | `./scripts/verify` (sous Windows : `bash scripts/verify` depuis Git Bash) ; en CI, bloquant sur macOS, Linux et Windows (`ci.yml`) — fiche 229 |
| Tests seuls | `pnpm test` |
| Build | `pnpm build` |
| Formater | `pnpm format` |
| **Essais de bout en bout** | pendant le travail, les suites touchées (`pnpm e2e --changed --dry-run` pour les nommer) jouées **sur GitHub** : `e2e.yml` lancé à la main sur la branche, macOS + Linux (`systeme: les-deux`) ; **avant de pousser `main`** : `verify` et ces suites vertes sur GitHub ; suite complète (≈ 13 à 21 min à 3 tâches depuis la réduction de la fiche 279, estimation à remesurer) **chaque nuit** sur GitHub et **en local juste avant un tag** : `pnpm build && pnpm e2e --if-needed` ; fumée : journées `parcours-*` (fiche 277) ; suites instables en quarantaine (`e2e/catalog.mjs`) — ADR-0069 ; thèmes : le clair pour toutes les suites, le sombre pour celles qui vérifient un rendu sombre (`dark` du catalogue), le sombre partout quand un fichier de thème ou de style est touché (`--changed`), la nuit et avant un tag ; `--themes both` pour tout jouer — ADR-0071 ; `--jobs` par défaut : un pour 3 cœurs, au plus 5 (3 sur GitHub), `--jobs 3` si d'autres travaux lourds tournent ; options du lanceur (`--list`, `--jobs N`, `--themes`, `--dry-run`, `--lang en`) : fiche 115 |
| Essais de bout en bout sous Linux (en local, Docker) | `pnpm e2e:linux [suites…]` : Ubuntu 24.04 dans Docker (Docker Desktop lancé), `xvfb` + openbox, `node_modules` Linux dans un volume à part (ceux du Mac jamais touchés), captures dans `e2e/captures/linux/` ; `--reset` repart d'un volume vide ; `BOBINE_E2E_CPUS=1` simule une machine lente — fiche 145 |
| Agent ACP factice | `pnpm mock-agent --list` — voir `docs/mock-agent.md` |
| App installable (.app + .dmg) | `pnpm package` — puis `pnpm e2e:packaged` (sous Linux et Windows : l'app installée, `.deb` ou NSIS, fiche 229) ; signature à blanc : `pnpm package --dry-run` (Developer ID, notarisation : fiche 111) |
| Installeur Windows (préversion, NSIS) | `pnpm package --win` (`--x64`, `--arm64`, `--dir`), depuis le Mac ou Windows (là : `node scripts/package-win.mts`) — fiche 229 |
| Publier une version (.dmg sur GitHub) | `pnpm build && pnpm e2e --if-needed` vert (suite complète), version dans `package.json`, « Prochaine version » de `CHANGELOG.md` (et « Next version » de `CHANGELOG.en.md`) renommée `X.Y.Z — date`, `main` poussé, puis `git tag vX.Y.Z && git push origin vX.Y.Z` (tag `v1.0.*` hors de `main`, `v1.1.*` hors de la branche `1.1` ou `v1.2.*` hors de la branche `1.2` refusé, ADR-0068, ADR-0073 ; rien n'est construit tant que `ci.yml` n'est pas vert sur les trois systèmes pour ce commit) ; préversion `X.Y.Z-beta.N` : même chemin, Release marquée préversion — fiches 059, 218 |
| Captures du README (vitrine, image de partage, GIF, vidéo) | à chaque version, et après un changement d'apparence : `pnpm build && pnpm vitrine` puis `pnpm vitrine --lang fr` (agent de démo, sans modèle ; `ffmpeg` et `gifski` requis, `--sans-video` sinon) — fiche 225 |
| Electron sans réseau (archive obtenue ailleurs) | `pnpm electron-local <electron-vX-darwin-arm64.zip>` — fiche 065 |
| Construire sur le plancher d'Electron (archive plus ancienne, 45.2.3) | `pnpm electron-local <electron-v45.2.3-darwin-arm64.zip>` puis `pnpm package --dir` : dépôt intact, app sans les correctifs de la version fixée ; fumée : `electron-floor.yml` (chaque nuit sur `1.2`, et à la main) — fiche 288, ADR-0074 |
| AXe (simulateur iOS) en dev | extrait par `pnpm dev` / `pnpm preview` (sinon `pnpm fetch-axe`) — essai réel : `pnpm simulator-smoke` |
| Sonde du contrat de Bob (après chaque mise à jour de Bob, 0 bobcoin) | `pnpm bob-probe` — voir `docs/acp.md` |
| Essayer Bobine comme neuve / la réinitialiser | Réglages › Données › Recommencer à neuf ; en ligne de commande, `--profil-temporaire` (et `--agents-neufs`) ou `--reinitialiser` (app packagée : `open -n -a Bobine --args --profil-temporaire`) — fiche 148 |
| Ouvrir un dossier dans Bobine depuis un terminal | `bobine <dossier> ["premier message"]` (installée par Réglages › Général › « Commande bobine » ; message posé dans la saisie, jamais envoyé) — fiche 158 |
| Déboguer avec un vrai agent (même l'app packagée) | Réglages › Diagnostic › Journal : Détaillé ou Trace, puis `~/Library/Logs/Bobine/agents.log` (échanges ACP, outils de l'app, sortie d'erreur) ; `BOBINE_LOG=trace` en développement — fiche 080 |
| Sonde de suivi d'OpenCode (après chaque mise à jour d'OpenCode, modèle gratuit) | `pnpm opencode-probe` (`--offline` sans modèle, `--opencode <cmd>`) — voir `docs/acp.md` |
| Avis de licence des composants livrés (après un ajout ou une montée de dépendance livrée) | `pnpm build && pnpm third-party-notices` ; vérifiés par `verify` (lockfile), `pnpm e2e` et `pnpm package` (`--check`, contre le build) — fiche 217 |
| Piloter Bobine en texte (recette, session longue) | `pnpm pilote lancer` (profil temporaire), `etat`, `attendre` (sans rien coûter, raison en sortie), `note`, `intervention`, `journal --resume`, `arreter` — voir `docs/pilote.md` (fiche 206) |

## Définition de « fini »

Une tâche est terminée seulement si :
1. `./scripts/verify` passe (lint + typecheck + tests).
2. Le comportement est testé — idéalement contre l'**agent factice**, jamais contre un vrai modèle en CI.
   Si l'interface change : les suites e2e touchées passent **sur GitHub** (`e2e.yml` sur la
   branche, macOS + Linux), et leurs captures ont été regardées ; c'est la condition pour pousser
   `main`. La suite complète tourne chaque nuit sur GitHub et en local juste avant un tag
   (`pnpm e2e --if-needed`), aux deux thèmes partout ; ailleurs, le sombre ne joue que pour les
   suites qui vérifient un rendu sombre, et pour toutes quand un fichier de thème ou de style est
   touché (ADR-0071). Nouvelle fonction : son étape dans le parcours `parcours-*` concerné ;
   essai instable : quarantaine nommée, corrigé à côté ; 1.0 gelée (corrections seulement) —
   méthode complète : ADR-0069. Sur GitHub, `verify`
   tourne à chaque pull request et poussée sur `main`, **bloquant sur macOS, Linux et Windows**
   (`ci.yml`, fiche 229) : un essai propre à un système y est sauté par capacité, avec la raison
   (`src/main/test-platform.ts`), jamais en vrac. Les e2e Linux partent à chaque poussée sur
   `main`, non bloquants (échecs connus) ; macOS et Windows à la main (`e2e.yml`, onglet Actions).
3. La fiche `docs/features/NNN-*.md` est à jour (statut, ce qui a été fait, écarts au plan).
4. Si une décision structurante a été prise : un ADR existe dans `docs/adr/`.
5. Si l'architecture a bougé : `docs/architecture.md` est à jour.

Si une étape n'a pas pu être faite, le dire explicitement — ne jamais prétendre que c'est vert.

## Workflow

1. **Spec** : créer ou compléter la fiche dans `docs/features/` (modèle : `docs/features/_modele.md`).
2. **Plan** : écrire le plan dans la fiche avant de coder si la tâche touche plus de ~3 fichiers.
3. **Implémenter** par petits incréments, `./scripts/verify` entre chaque.
4. **Clore** : mettre à jour la fiche (statut, journal) et l'index `docs/features/README.md` ; si
   l'utilisateur voit la différence, une ligne dans `CHANGELOG.md` (« Prochaine version », en
   français, de son point de vue) et la même dans `CHANGELOG.en.md` (« Next version »), affichés
   dans Réglages › Nouveautés selon la langue.

## Règles d'architecture (non négociables)

- **Seul le main process parle ACP et MCP.** Le renderer ne lance aucun processus, ne touche pas au
  système de fichiers : il passe par l'IPC typé exposé dans le preload.
- **Aucun code spécifique à un agent dans l'UI.** Les différences entre agents (Bob, OpenCode)
  sont isolées dans des « profils d'agent » côté main (`command`, `args`, `env`, capacités).
- **Générique d'abord.** Une fonction propre à un agent est déclarée dans son profil, listée dans
  Réglages › Agents (`specificItems`) et dans la matrice de `docs/agents.md`, et sa fiche dit
  « Agents : … » (ADR-0011).
- **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`** sur toutes les fenêtres.
- Les champs `_meta` propres à un agent sont lus dans un adaptateur dédié, jamais dans les composants.

## Compatibilité Bob (cible finale)

Bob n'est pas disponible en développement. Toute fonctionnalité qui touche ACP doit :
- être confrontée à la section « Compatibilité Bob » de `docs/acp.md` (mise à jour si besoin) ;
- ne **rien supposer** de non documenté sur Bob (pas de mode, d'option ou de flag imposé à son profil) ;
- ne décrire que le comportement **observé** de Bob (ACP, fichiers, écrans) et sa documentation
  publique, jamais son code (fiche 216) ;
- être générique côté protocole (ex. modes **et** options de configuration), avec un scénario d'agent
  factice pour chaque comportement de Bob documenté.

## Conventions

- Code, identifiants, messages de commit : **anglais**. Documentation et commentaires d'explication
  métier : **français**.
- Commits : Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Pas de `any` implicite, pas de `// @ts-ignore` sans commentaire justificatif.
- Pas de nouvelle dépendance sans le mentionner dans la fiche (et un ADR si elle est structurante).
- Taille et complexité bornées par ESLint (fiche 089) : `complexity` 40, 300 lignes par fonction,
  800 par fichier. Découper plutôt que d'ajouter une exception ; une exception dit pourquoi
  (`-- raison`), et un seuil ne remonte jamais.
- Textes de l'interface : jamais en dur (une règle ESLint le refuse dans le renderer) ; une clé dans
  `src/shared/i18n/locales/fr.json` et `en.json` (vocabulaire : glossaire de `docs/traduction.md`),
  `t()` pour l'afficher. Ce qui va à l'agent ou au journal n'est pas traduit (ADR-0014). Les essais
  e2e comparent les textes de l'app avec `L('clé')`, pas en dur.

## Interdits

- Ne jamais committer de secret (`BOBSHELL_API_KEY`, tokens…). Utiliser `.env.local` (ignoré par git).
- Ne pas appeler de vrai modèle / vrai agent dans les tests automatisés.
- Ne pas désactiver une vérification (lint, test) pour faire passer `verify`.
- Ne pas modifier un ADR accepté : en écrire un nouveau qui le remplace. Seule exception, unique :
  l'expurgation du 2026-11-10 avant publication (fiche 216), décision inchangée et note datée.
