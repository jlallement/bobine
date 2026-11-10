# 090 — Puce du modèle dans la barre de saisie

- **Statut** : fait
- **Dépend de** : 013 (modes et options de configuration)
- **Agents** : les deux, générique — la puce suit le réglage ACP de catégorie `model`. OpenCode en
  expose un ; Bob non (« Model selection is not supported », son `ACP.md`) : rien ne change pour lui.

## Pourquoi

Avec OpenCode, on ne voit pas quel modèle répond sans ouvrir le menu des réglages de la session.
Claude Desktop affiche le modèle dans la barre de saisie ; Bobine n'y montre que le mode.

## Maquettes

DOM injecté dans l'app buildée (aucun code produit), agent factice renommé « OpenCode ». Captures
dans `e2e/captures/` (clair et sombre), comparaison dans `maquette-modele-comparaison-*` :

| Capture | Ce qu'elle montre |
|---|---|
| `maquette-modele-0-actuel` | Aujourd'hui : seule la puce du mode (« Build ») ; le modèle est dans ⚙ |
| `maquette-modele-a-gauche` | A : puce « GPT-6.1 Sol » à gauche, après le mode |
| `maquette-modele-a-gauche-fournisseur` | A avec le nom complet d'OpenCode (« openai/GPT-6.1 Sol ») |
| `maquette-modele-a-droite` | B : puce « GPT-6.1 Sol ⌄ » à droite, avant le choix de l'agent |
| `maquette-modele-avec-agent` | C : « OpenCode · GPT-6.1 Sol ⌄ » dans le choix de l'agent |

**Choix de l'utilisateur (2026-10-20)** : **B**, nom court. Écartés : A (à gauche avec le mode),
C (un seul menu pour deux choix).

## Critères d'acceptation

- [x] Quand l'agent expose un réglage `select` de catégorie `model`, une puce « nom ⌄ » apparaît à
      droite de la barre de saisie, juste avant le choix de l'agent ; sinon rien.
- [x] La puce montre le nom court (ce qui suit le dernier `/` : « openai/GPT-6.1 Sol » → « GPT-6.1
      Sol ») ; l'infobulle donne le nom du réglage et le nom complet.
- [x] Un clic ouvre la liste des modèles (groupes compris) ; choisir un modèle le règle comme le
      menu ⚙, qui garde aussi le réglage.
- [x] Désactivée tant que l'agent n'est pas prêt (comme la puce du mode).
- [x] Testé contre l'agent factice (scénario `demo` : réglage « Modèle », « Factice rapide » /
      « Factice précis ») : puce visible, changement de modèle depuis la puce.

## Plan

- `src/renderer/src/composer-view.ts` : `modelControl` (premier réglage `select` de catégorie
  `model`), à côté de `modeControl` ; test dans `composer-view.test.ts`.
- `src/renderer/src/components/common/Menus.tsx` : `ModelChip` (déclencheur comme `AgentMenu` :
  libellé + chevron, menu `SelectOptions` aligné à droite) et `shortModelName` (exportée, testée).
- `src/renderer/src/components/composer/ComposerBar.tsx` et `Composer.tsx` : passer `modelControl`,
  puce entre la consommation et l'agent.
- `src/renderer/src/styles.css` : largeur maximale du libellé (nom tronqué).
- `src/shared/i18n/locales/fr.json`, `en.json` : `sessionSettings.modelTip`.
- `e2e/suites/base.mjs` : puce visible, changement de modèle ; captures.
- `CHANGELOG.md`, `CHANGELOG.en.md`.
- Pas de nouvelle dépendance.

## Journal

- 2026-10-20 — Fiche créée, maquettes capturées (script jetable hors dépôt), variante B choisie.
- 2026-10-20 — Fait comme prévu : `modelControl` dans `composer-view.ts`, `ModelChip` et
  `shortModelName` dans `Menus.tsx` (libellé tronqué à 180 px), puce entre la consommation et
  l'agent. Tests : `ModelChip.test.tsx` (nom court, choix dans la liste), `composer-view.test.ts` ;
  e2e `base` (clair et sombre) : la puce suit le menu ⚙, puis règle le modèle elle-même, appliqué par
  l'agent factice ; capture `3b-puce-modele` regardée. `./scripts/verify` vert. Écart : aucun.
