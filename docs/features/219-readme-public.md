# 219 — README public pour la bêta 1.0.0-beta.1

- **Statut** : fait (2026-11-10) ; la description et les topics du dépôt restent à poser par
  Jérôme (réglages GitHub, hors de ma portée)
- **Dépend de** : 059 (publication), 111 (notarisation), 145 (préversion Linux)
- **Agents** : les deux (texte d'accueil, aucun code)

## Pourquoi

Le dépôt devient public (`jlallement/bobine`) avec une bêta non signée par Apple. L'audit
d'ouverture (rapports 02 et 05) a relevé : aucune mention « projet indépendant, non affilié à
IBM » alors que le README dit « Built for IBM Bob » ; installation qui commence par Node et
`git clone` ; Gatekeeper réduit à une parenthèse ; pas de « bêta » ; guide anglais non lié ; Linux
décrit à tort comme absent ; description du dépôt en français, sans topics.

## Critères d'acceptation

- [x] `README.md` en anglais, dans l'ordre : ce que c'est + capture, bêta, agents et versions
  essayées, installation par le `.dmg`, étapes Gatekeeper exactes, Linux, guide, construire
  depuis les sources, limites, liens, marques
- [x] Étapes Gatekeeper vérifiées sur support.apple.com (102445) ; `xattr -dr` en solution de
  rechange ; Ctrl-clic › Ouvrir dit inopérant depuis macOS 15
- [x] Prérequis vrais : Apple Silicon, macOS 13+ (plancher d'Electron 45, README d'Electron)
- [x] Mention de marques et de non-affiliation (IBM, OpenCode, Anthropic/Claude)
- [x] Rien sur l'employeur, des collègues, des quotas ou l'interne d'IBM
- [x] `README.fr.md` aligné, `docs/installation.md` aligné (Gatekeeper, `.dmg` d'abord)
- [x] `CONTRIBUTING.md` : démarrage rapide ajouté (le reste existait)
- [x] Chaque lien relatif vérifié (fichier existant) ; l'ancre `#install` / `#installer` existe
- [x] `./scripts/verify`

## Décisions

- **Deux fichiers** (`README.md` anglais, `README.fr.md` français, liés l'un à l'autre) plutôt
  qu'une section française : GitHub n'affiche qu'un README, l'anglais sert l'inconnu ; le français
  reste complet, sans alourdir la page d'accueil. Les docs internes restent en français, dit en une
  ligne dans la section « Documentation » et dans `CONTRIBUTING.md`.
- **Plancher macOS** : `electron-builder.yml` ne déclare pas de `minimumSystemVersion` ; le vrai
  plancher est celui d'Electron 45, macOS 13 Ventura (README d'Electron, branche `main` ; sources
  secondaires concordantes). Dit tel quel, avec « n'est essayée que sur des macOS récents ».
  Ajouter `mac.minimumSystemVersion: '13.0'` serait un plus (le système refuserait proprement
  l'ouverture plus tôt) : non fait, pas de changement de build dans ce lot.
- **Linux** : la fiche 145 dit « pas encore publié » (`BOBINE_LINUX_RELEASE` absente) : le README
  parle d'une préversion expérimentale, construite sous Linux, non jointe à la bêta ; construire
  depuis les sources en attendant.
- **Versions essayées** : `testedVersions` de `profiles.ts` (Bob 2.0.6, 2.0.9, 2.1.0 ; OpenCode
  1.19, 2.0.31, 2.0.32, 2.2.5). À remettre à jour à chaque sonde.
- « Built for IBM Bob » devient « Made first for IBM Bob » ; « not a replacement for the Claude or
  ChatGPT desktop apps » retiré (inutile, et cite des marques).

## À poser sur GitHub (non appliqué)

**Description** (≤ 350 caractères) : « macOS desktop app for ACP coding agents (IBM Bob, OpenCode):
chat, approve diffs, built-in browser, iOS Simulator and Android emulator. Public beta. Independent
project, not affiliated with IBM. »

**Topics** : `acp`, `agent-client-protocol`, `coding-agent`, `ai-agents`, `electron`, `macos`,
`desktop-app`, `typescript`, `react`, `ibm-bob`, `opencode`.

**Releases** : notes de version en anglais aussi (le texte de `CHANGELOG.en.md`), la bêta marquée
« pre-release » (voir l'audit 05, P1-2 : `release.yml` ne passe pas `--prerelease`, hors de ce lot).

## Journal

- 2026-11-10 — `README.md`, `README.fr.md`, `docs/installation.md`, `CONTRIBUTING.md` réécrits ou
  complétés. Écart au plan : le README et CONTRIBUTING existaient déjà en anglais (commit
  975f98c0) ; le lot les a corrigés plutôt que créés. Aucun changement de l'À propos ni de l'UI.
- Reste (propriétaire) : description et topics ; release en pré-version ; décider
  `minimumSystemVersion`.
