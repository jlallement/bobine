# 167 — Invite coupée en conversation étroite, agent factice dans la langue des essais

- **Statut** : fait
- **Dépend de** : 092 (repli de la barre de saisie), 074 (langues, essais `--lang en`), 089
- **Agents** : les deux (zone de saisie) ; l'agent factice seul pour la langue (outil d'essai, ADR-0004)

## Pourquoi

Deux défauts relevés par l'audit UX du 2026-11-05 (§ 5.2 et § 7) :

1. **Invite coupée.** Quand la conversation est étroite (≈ 500 px, barre sur deux lignes), l'invite
   « Explorer et planifier avec Agent factice… » passe sur deux lignes mais la zone de texte n'en
   montre qu'une : la seconde est coupée à mi-hauteur (capture `composer-8-barre-500`). Le texte
   tapé l'était aussi quand on rétrécissait la fenêtre après l'avoir tapé.
2. **`pnpm e2e base --lang en` échoue** (clair et sombre) : l'essai attend « Mock agent », l'app
   affiche « Agent factice », le nom que l'agent factice annonce. Plus largement, en anglais,
   l'agent factice parlait français (nom, modes, modèles, réponses, permissions) : les captures
   anglaises étaient trompeuses.

## Critères d'acceptation

- [x] À 500 px en mode Plan, l'invite sur deux lignes est entière (zone de texte assez haute) ;
      idem en mode Code et avec du texte tapé avant de rétrécir (essai `composer`).
- [x] La hauteur de la zone de saisie suit sa largeur, pas seulement son texte (test unitaire).
- [x] L'agent factice parle anglais avec `--langue en` (ou `MOCK_AGENT_LANG=en`) : nom annoncé,
      modes, options et modèles, commandes « / », réponses des scénarios courants, libellés de
      permission ; le français reste le défaut (tests unitaires de l'agent factice).
- [x] Les essais `--lang en` lancent l'agent factice en anglais (`MOCK_AGENT_LANG`, à côté de
      `BOBINE_LANG`) ; la langue de l'interface n'a toujours aucun effet sur les agents (ADR-0014).
- [x] `pnpm e2e base composer --lang en` vert, clair et sombre ; `pnpm e2e --changed` vert.

## Plan

**Bug 1 — invite coupée.** Cause : `useTextareaLayout` ajuste la hauteur de la zone de texte
(`height: auto` puis `scrollHeight`) seulement quand le texte change. Quand la conversation
rétrécit ensuite, le texte (ou l'invite) se replie sur une ligne de plus sans que la hauteur
suive. Correction retenue : refaire le même calcul quand la **largeur** de la zone change
(`ResizeObserver`, en ignorant les changements de hauteur qu'il provoque lui-même). C'est plus
propre qu'une invite sur une ligne avec points de suspension : l'invite reste lisible entière,
et le texte tapé est couvert par le même mécanisme (les points de suspension ne valent que pour
l'invite).

- `src/renderer/src/useTextareaLayout.ts` (+ test) ; rien dans `styles.css`.
- Essai `composer` : à 500 px, la zone de texte n'est pas plus basse que son contenu, invite
  et texte tapé.

**Bug 2 — agent factice en anglais.** Confirmé préexistant sur `main` (6fffca4). On corrige
l'agent factice, pas l'essai : il parle la langue demandée, l'app ne traduit toujours rien de ce
qui vient de l'agent (ADR-0014).

- `src/mock-agent/langue.mts` : langue de l'agent (`fr` par défaut, `en`), dictionnaire
  français → anglais des phrases des scénarios, appliqué aux textes envoyés (réponses,
  réflexions, mises à jour, permissions) ; phrases absentes : restent en français.
- `agent.mts`, `scenario.mts`, `main.mts` : `--langue` / `MOCK_AGENT_LANG` ; nom annoncé, modes,
  options, modèles, commandes, écho dans la langue demandée.
- `src/main/agent/profiles.ts` : passe `--langue` d'après `MOCK_AGENT_LANG` (comme les autres
  `MOCK_AGENT_*`) ; `e2e/lib.mjs` pose `MOCK_AGENT_LANG` à la langue des essais.
- Essais qui comparent des textes de l'agent factice : `M('…')` (même dictionnaire) au lieu du
  français en dur.
- `docs/mock-agent.md`. Pas de nouvelle dépendance.

## Journal

- 2026-11-05 : fiche créée ; bug 2 reproduit sur `main` (`pnpm e2e base --lang en` : 1 échec en
  clair, 1 en sombre).
- 2026-11-05 : **bug 1** — `useTextareaLayout` refait son calcul de hauteur quand la largeur de la
  zone change (`ResizeObserver`, changements de hauteur ignorés : pas de boucle). L'essai
  `composer` mesure à 500 px la hauteur demandée par le contenu (invite posée le temps de la
  mesure) : avant la correction, 33 px pour 55 px en mode Plan, texte tapé sur 4 lignes coupé ;
  après, entiers (captures `composer-8-barre-500`, nouvelle `composer-8b-texte-500`). En mode
  Code, l'invite tient sur une ligne à 500 px : vérifiée quand même. Aucun changement de
  `styles.css`. Le `scrollHeight` d'une zone vide compte bien l'invite dans Chromium, d'où une
  correction sans cas particulier pour elle.
- 2026-11-05 : **bug 2** — `src/mock-agent/langue.mts` (dictionnaire français → anglais, `say`,
  `sayAll`, `describeSettings`) ; appliqué dans l'interpréteur (`text`, `thought`, `update`,
  `permission`, `hang`, écho) et dans `agent.mts` (nom, modes, options, commandes, méthodes de
  connexion, titre « Mock: »). `--langue` / `MOCK_AGENT_LANG` ; le profil factice (et le second,
  `mock-peer`) passe `--langue` d'après `MOCK_AGENT_LANG`, que `e2e/lib.mjs` pose à la langue des
  essais. Écart au plan : rien de lu dans `BOBINE_LANG` ni dans la langue de l'interface, pour
  respecter ADR-0014 (la langue de l'interface n'a aucun effet sur les agents).
  Essais : `M('…')` dans `base`, `composer`, `quick`, `history`, `commands`, `diagnostic`, `fun`,
  `filles-tech-lead`, `notifications`, `inbox`, `pinned-plan`, `browser-annotate` ; `base` compare
  l'écho avec `describeSettings` de l'agent.
- Reste : les scénarios rares (Mermaid, Markdown, filles, limites, Bob…) parlent encore français
  avec `--langue en` ; ajouter leurs phrases au dictionnaire quand un essai anglais les montre.
  La suite e2e complète en anglais n'a pas été passée (seulement `base` et `composer`) : d'autres
  suites comparent encore des textes de l'app ou de l'agent en français en dur (ex. `fun`).
- 2026-11-06 : **suite e2e complète en anglais verte** (`pnpm e2e --lang en`, 145 essais, clair et
  sombre). 19 suites comparaient encore des textes en dur : textes de l'app → `L('clé')` ou
  `Lpart` (dont les `aria-label` de `changes`, `git`, `user-commands`), textes de l'agent factice →
  `M('…')` ou sa langue (`MOCK_LANG` pour l'écho), formats propres à la langue (heure « 11:41 PM »,
  « 0.35 », listes `Intl.ListFormat`, « Mode: Plan »). Deux essais supposaient le français de
  l'agent : `acp` (un message d'un seul morceau en anglais reste seul : l'essai vérifie que deux
  morceaux consécutifs ne sont jamais sur deux lignes) et `commands` (« sce » trouve aussi `/aide`
  par sa description anglaise : on attend `/scenario` en tête). Aucun changement de l'app.
