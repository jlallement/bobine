# 233 — Dépendances, lot 2 de novembre : Electron 45.3.3, SDK ACP 2.7, minimatch

- **Statut** : fait (présentation de la référence de session à maquetter ; `.deb` et installeur
  Windows non construits ici)
- **Dépend de** : 231 (lot 1), 181 (SDK ACP 2), 169 (lot A, précédente montée d'Electron), 217
  (avis de licence)
- **Agents** : les deux (aucun code propre à un agent)

## Pourquoi

Suite du lot 1 (fiche 231) : les montées qui touchent le moteur de l'app et le protocole. Electron
45.3.3 apporte des correctifs de sécurité de Chromium et de V8 ; le SDK ACP 2.7 suit le schéma
1.32 ; l'alerte Dependabot n°1 (minimatch, outillage seulement) est à traiter ou à écarter avec
une raison.

## Critères d'acceptation

- [x] Electron 45.3.3 : notes des 45.3.0 à 45.3.3 relues ; `pnpm package --dry-run`, `pnpm
      package --dir` et `pnpm e2e:packaged` verts.
- [x] SDK ACP 2.7.0 : l'erreur de type de `context-breakdown.ts` corrigée à la cause ; la
      référence de session (`type: "session"`, schéma 1.31) traitée de façon générique, avec des
      essais, et émise par l'agent factice (scénario `reference-session`).
- [x] Nouveautés instables du schéma recensées, aucune implémentée ; leur arrivée ne casse rien.
- [x] minimatch : `pnpm audit` relu ; override ciblé ajouté après `verify`, `pnpm build` et
      `pnpm package --dry-run` verts, et l'app construite comparée avec et sans.
- [x] Avis de licence régénérés.
- [x] `./scripts/verify` vert ; suite e2e complète verte sur Mac, clair et sombre, captures
      regardées.
- [x] Sondes : `pnpm opencode-probe --offline` et `pnpm bob-probe`.

## Plan

Un commit par montée, un par conséquence. Bloqués, non montés : `typescript` 7
(typescript-eslint exige `<6.1`) et `@types/node` 26 (Electron 45 embarque Node 24).

Aucune nouvelle dépendance directe. Un `overrides` pnpm (minimatch) et une exclusion du délai de
publication (Electron) dans `pnpm-workspace.yaml`, commentés.

## Versions

| Paquet | Avant | Après | Note |
|---|---|---|---|
| `electron` | 45.2.3 | **45.3.3** | Chromium 156.0.8078.100, Node 24.22.3 (relus dans le binaire) |
| `@agentclientprotocol/sdk` | 2.4.0 | **2.7.0** | schéma ACP 1.30 → 1.32 |
| `minimatch` (transitif) | 9.0.9, 10.2.6 | **11.0.8** | override `minimatch@>=7.0.0 <11.0.1` ; 3.1.5 et 5.1.9 (non concernées) inchangées |

## Electron 45.3.0 → 45.3.3

Notes relues (GitHub, `electron/electron`) :

- 45.3.0 : Chromium 156.0.8078.96 et correctifs rétroportés ; blocage possible en quittant sur
  macOS avec `systemPreferences.subscribe*Notification` (non utilisé par Bobine) ; plantage du
  main quand `setPermissionRequestHandler` répond après la destruction d'un `<webview>` (Bobine en
  pose un, mais n'a pas de `<webview>`) ; boucles de redirection `webRequest`, `net.fetch`,
  fenêtres cachées sous Windows, extensions (non utilisés).
- 45.3.1 : fuite d'observateur de notification macOS (même API, non utilisée) ; certificats
  intermédiaires révoqués d'eMudhra plus acceptés.
- 45.3.2 : Chromium 156.0.8078.100 et correctifs rétroportés (ANGLE, Chromium, Dawn, Skia, V8) ;
  **cookies posés juste avant de quitter parfois perdus** : concerne la session persistante du
  navigateur intégré (fiche 072) ; DevTools.
- 45.3.3 : Node 24.22.3 ; DevTools.

Rien sur `safeStorage`, `WebContentsView`, `utilityProcess` ni le preload sandboxé.

**Délai de publication de pnpm** : 45.3.3 est sortie sur GitHub le 2026-11-14, mais publiée sur
npm le 2026-11-16 à 05 h 55 UTC, sous le délai d'un jour de pnpm (`minimumReleaseAge`). pnpm a
ajouté de lui-même `minimumReleaseAgeExclude: electron@45.3.3` ; gardé (version demandée
exactement), avec un commentaire, comme à la fiche 169 : à retirer au prochain lot.

## SDK ACP 2.5 → 2.7 (schéma 1.30 → 1.32)

### Référence de session dans le contenu d'un outil (1.31, instable)

`ToolCallContent` gagne une variante `{ type: "session", sessionId, _meta? }` : référence
« d'affichage seul » à une autre session que l'outil a créée, à qui il a délégué ou qu'il
attend (sous-agent annoncé par `subagent_update`, ou session ouverte). Elle ne donne ni la
propriété de la session ni aucun contrôle au client.

Ce que l'app en fait, de façon générique (aucun agent ne l'envoie aujourd'hui) :

- **Contexte** (`context-breakdown.ts`) : l'estimation lisait `content.content` de tout ce qui
  n'était ni diff ni terminal ; une référence l'aurait fait planter (TypeError, l'erreur TS2339
  annoncée). Elle n'y compte plus rien : le travail de l'autre session reste dans son contexte,
  comme celui d'un sous-agent.
- **Fil** : la référence est gardée telle quelle dans la carte de l'outil (et donc dans la
  conversation enregistrée). Elle n'a **pas encore de présentation** : une carte dont c'est le
  seul contenu ne propose plus de détails vides à déplier (`shownContent`, `ToolCall.tsx`).
  `ToolContent` a désormais un type de retour explicite : un nouveau genre de contenu ACP oublié
  est une erreur de type (vérifié : retirer un cas donne TS2366), plus un rendu vide silencieux.
- **Lectures du contenu ailleurs** (diffs, fichiers changés, export Markdown, sous-agents, plan,
  OpenCode) : toutes filtrent par `type` ; une référence y est ignorée sans erreur.
- **Agent factice** : scénario `reference-session` (une référence seule pendant le travail, puis
  avec le résultat).

**À maquetter avant toute présentation** (rien d'implémenté) : la session référencée n'est pas
montrée par le fil (un `subagent_update` ne crée pas de carte, fiche 010), l'app ne peut donc
renvoyer vers rien. Pistes : une ligne discrète dans les détails de l'outil (« Travail dans une
autre session », identifiant en infobulle) ; ou, le jour où les sessions de `subagent_update`
auront une carte, un lien vers elle. Une référence pourrait aussi servir de `sessionId` générique
au rejeu d'un sous-agent (`SubagentRun.sessionId`), à la place de ce que les profils lisent dans
le résultat ; c'est le terrain des sous-agents d'OpenCode 2.3.0 (fiche 232), laissé de côté ici.

### Autres nouveautés du schéma : recensées, aucune implémentée

| Schéma | Nouveauté | Statut | Utile à Bobine ? | Effet aujourd'hui |
|---|---|---|---|---|
| 1.30 | `systemPrompt` aux requêtes de session, capacité `sessionCapabilities.systemPrompt` | **stabilisé** | Oui, à terme : consignes de l'app (outils, rôles) passées comme invite système plutôt que dans le message, si l'agent l'annonce | Aucun : l'app ne l'envoie pas ; Bob 2.1.0 et OpenCode 2.3.0 ne l'annoncent pas (sondes) |
| 1.31 | `description` d'`AuthAccount` | instable | Peu : texte d'appoint du choix de compte | Aucun (champ non lu) |
| 1.31 | `session/options` et valeurs initiales des options de configuration | instable | Oui : appliquer les réglages mémorisés (fiche 013) dès `session/new`, sans `set_config_option` après coup | Aucun (non envoyé) |
| 1.31 | précisions sur les sous-agents d'un seul tour | instable | Lu pour la référence de session | — |
| 1.32 | `prompt_suggestions_update` et capacité client | instable | Oui : suggestions de réponse sous le dernier message | Aucun : capacité non annoncée ; une mise à jour reçue quand même est ignorée par le fil (essai) |
| 1.32 | catégorie d'option `speed` | instable | Rangée avec les autres options génériques | Aucun : les catégories sont déjà un `string` ouvert ; l'app ne place à part que `mode` et `model` |
| 1.32 | options initiales à `session/fork` | instable | Avec `session/fork` (fiche 023, « Modifier et relancer »), si un agent l'annonce | Aucun (non envoyé) |
| 1.32 | plans Markdown : `path` remplace le type `file` | instable | Non | Aucun : l'app ne lit pas `plan_update` |

Rien ne change sur le fil pour Bob ni pour OpenCode : l'app n'envoie aucun champ nouveau (voir
Journal pour les sondes).

## minimatch (alerte Dependabot n°1, GHSA-g3hv-75wg-m249)

- **Avant** : `pnpm audit` signale une vulnérabilité modérée (déni de service par amplification
  des `globparts`, versions `>=7.0.0 <11.0.1`), 11 chemins, tous d'outillage :
  `@electron/universal` → 9.0.9 (`^9.0.3`), `@typescript-eslint/typescript-estree` → 10.2.6
  (`^10.2.2`), `app-builder-lib` → 10.2.6 (`^10.2.5`). Rien de livré dans l'app.
- **Correctif seulement en 11** : un saut de version majeure par rapport à ce que ces paquets
  demandent. Le journal de minimatch 11 retire `makeRe()`, `Minimatch#regexp`, la classe `AST`,
  l'option `debug` et les méthodes `matchOne` / `slashSplit` ; il change aussi la mise en
  correspondance partielle avec `**` et les éléments de `Minimatch#set`.
- **Usages relus** : typescript-estree appelle `minimatch(chemin, motif, { dot: true })`
  (`allowDefaultProject`) ; @electron/universal `minimatch(…, { matchBase: true })` (construction
  universelle, que Bobine ne fait pas) ; app-builder-lib crée des `Minimatch`, lit `set`
  (`hasMagic`) et appelle `match(chemin, partiel)` pour choisir les fichiers de l'app. Aucun
  n'utilise ce qui est retiré ; le risque est dans le choix des fichiers.
- **Essai** : `pnpm package --dir` sans puis avec l'override : `app.asar` **identique octet pour
  octet** (même SHA-256), liste de son contenu (403 entrées) et des fichiers du `.app` (266)
  identiques. `--dry-run` seul ne construit rien et n'aurait rien prouvé.
- **Décision** : override ciblé `minimatch@>=7.0.0 <11.0.1: 11.0.8` dans `pnpm-workspace.yaml`
  (3.1.5 et 5.1.9, hors de la plage, restent). `pnpm audit` : aucune vulnérabilité. À retirer
  quand electron-builder et typescript-eslint demanderont eux-mêmes minimatch 11.
- **Non vérifié** : le `.deb` et l'installeur Windows ne sont pas construits ici ; ils passent par
  le même filtre d'app-builder-lib (CI et `pnpm package --win`).

## Journal

- 2026-11-16 : fiche créée ; départ de `078ec7d` (lot 1 fusionné), branche `claude/deps-lot-2`.
  - Electron 45.3.3 : binaire relu (Chromium 156.0.8078.100, Node 24.22.3).
  - SDK 2.7 : seule erreur de type celle annoncée (`context-breakdown.ts:77`). Essais nouveaux :
    `ToolCall.session.test.tsx` (carte sans détails vides ; avec un résultat, seul le résultat
    s'affiche), `context-breakdown.test.ts`, `transcript.test.ts` (référence gardée ;
    `prompt_suggestions_update` sans effet sur le fil), `mock-agent.test.ts` (scénario). Les deux
    premiers sont rouges sans le correctif (vérifié en le retirant : TypeError, puis `<details>`
    présent).
  - Avertissement de Vite à chaque `vitest` (`configLoader: 'native'`, `vitest.config.ts` en ESM
    chargé comme CommonJS) : déjà là au lot 1, sans effet ; non traité ici.
  - Avis de licence : seules les lignes d'Electron et du SDK changent.
  - `pnpm package --dir` puis `pnpm e2e:packaged` (Electron 45.3.3, sans l'override) : vert
    (démarrage, renderer isolé, agents trouvés, profil temporaire, réinitialisation). Lancé
    pendant une campagne e2e de la fiche 232 (autre session) : ce n'est pas une campagne, mais la
    machine était chargée.
  - Fichiers communs avec la branche `claude/opencode-2-3` (fiche 232) : `scenarios.mts`,
    `CHANGELOG.md`, `CHANGELOG.en.md`, `docs/acp.md`, `docs/features/README.md`.
  - `./scripts/verify` : code de sortie 0 (4639 essais, 3 sautés), après l'override.
  - `pnpm build && pnpm e2e --if-needed` (suite complète, après l'override et la ligne du
    CHANGELOG) : 208/208 du premier coup, clair et sombre, sans relance (16 min 09 s), lancée
    après 8 min d'attente de la campagne de la fiche 232. Captures regardées : Nouveautés (la
    « Prochaine version » et sa ligne), cartes d'outils et débordements (`173-debordements-*`),
    ouverture dans l'éditeur, questions : rien de changé.
  - Sondes, l'une après l'autre, hors de toute campagne e2e (après celle d'une autre session) :
    `pnpm opencode-probe --offline` (OpenCode 2.3.0) : code 0, contrat 12/12, « rien de
    nouveau », réponses identiques ; `pnpm bob-probe` (Bob 2.1.0, 0 bobcoin) : code 0, contrat
    12/12, réponses identiques à la référence 2.1.0. La sonde de Bob lit, en lecture seule, les
    colonnes de `tasks` de `~/.bob/db/bob.db` et `licenseConsent` de `~/.bob/settings/settings.json`
    (fiche 048) ; Bob tourne dans un HOME jetable.
  - `docs/acp.md` : SDK 2.7 dans « Compatibilité Bob », référence de session dans « Sous-agents ».
  - **Reste** : maquettes de la référence de session ; au prochain lot, retirer l'exclusion
    d'Electron ; retirer l'override de minimatch quand electron-builder et typescript-eslint
    passeront à minimatch 11.
