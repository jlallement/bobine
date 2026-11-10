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
| **Vérifier (obligatoire avant de dire « fini »)** | `./scripts/verify` |
| Tests seuls | `pnpm test` |
| Build | `pnpm build` |
| Formater | `pnpm format` |
| **Essais de bout en bout** | pendant le travail, les suites touchées par les fichiers modifiés depuis `main` : `pnpm build && pnpm e2e --changed` (ou nommées : `pnpm e2e <suite>…`, `pnpm e2e --list`) ; **avant chaque push** : `pnpm build && pnpm e2e --changed` ; **avant un tag de version** : `pnpm build && pnpm e2e --if-needed` (suite complète, 3 suites en parallèle, ≈ 4 min ; rien si elle est déjà verte pour ces sources et ce build) — captures dans `e2e/captures/` ; `--jobs N` (1 : une à la fois), `--dry-run` ; interface en anglais : `--lang en` (captures `en-…`) — fiche 115 |
| Agent ACP factice | `pnpm mock-agent --list` — voir `docs/mock-agent.md` |
| App installable (.app + .dmg) | `pnpm package` — puis `pnpm e2e:packaged` ; signature à blanc : `pnpm package --dry-run` (Developer ID, notarisation : fiche 111) |
| Publier une version (.dmg sur GitHub) | `pnpm build && pnpm e2e --if-needed` vert (suite complète), version dans `package.json`, « Prochaine version » de `CHANGELOG.md` (et « Next version » de `CHANGELOG.en.md`) renommée `X.Y.Z — date`, `main` poussé, puis `git tag vX.Y.Z && git push origin vX.Y.Z` (tag hors de `main` refusé) ; préversion `X.Y.Z-beta.N` : même chemin, Release marquée préversion — fiches 059, 218 |
| Electron sans réseau (archive obtenue ailleurs) | `pnpm electron-local <electron-vX-darwin-arm64.zip>` — fiche 065 |
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
   Si l'interface change : les suites e2e touchées passent (`pnpm e2e --changed`, clair et
   sombre), et leurs captures ont été regardées ; c'est aussi ce qui tourne **avant chaque push**.
   La suite complète (`pnpm e2e --if-needed`) tourne **avant un tag de version**, et quand le lot
   le justifie (refonte, fichier partagé par beaucoup de suites). Sur GitHub, `verify`
   tourne à chaque pull request (`ci.yml`, Linux) ; les e2e seulement à la main (`e2e.yml`,
   onglet Actions : Mac, ou Linux sous `xvfb` en expérimental, fiche 145).
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
