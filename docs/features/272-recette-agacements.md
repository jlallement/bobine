# 272 — Corrections de la chasse aux agacements (recette du 2026-11-20)

- **Statut** : fait (e2e et relecture du tech lead : voir le journal)
- **Dépend de** : 202, 223, 260 à 270
- **Agents** : les deux. Toutes les corrections sont génériques (contrat ACP, catégories ACP,
  genres d'outils) ; aucune n'est propre à un agent. Le défaut G1 vient du contrat observé
  d'OpenCode, corrigé par une règle générique (`docs/agents.md` inchangé : pas de nouvelle capacité).

## Pourquoi

Recette exploratoire de la 1.0.0-rc.2 avec OpenCode 2.3.0 et le modèle gratuit Big Pickle
(rapport `bobine-recette/2026-11-20-chasse-agacements.md`, hors dépôt) : 0 bloquant, 9 gênants,
25 agaçants. Ligne 1.0 : corrections seulement, sur `main` (`docs/branche-1.1.md` de la branche 1.1).

## Critères d'acceptation

- [x] Chaque défaut corrigé a un essai qui échoue avant la correction (unitaire, jsdom ou e2e).
- [x] G1 : forme réelle d'OpenCode rejouée (fil enregistré de la recette, trace
  `__traces__/opencode-2.3.0/creation-autorisee-d-office`), scénario `reecriture-opencode`.
- [x] Textes fr et en, glossaire de `docs/traduction.md` ; CHANGELOG fr et en.
- [x] `./scripts/verify` vert ; `pnpm build && pnpm e2e --changed` (clair et sombre) : voir journal.

## Défauts, décisions et essais

### Gênants

| Défaut | Correction | Essai |
|---|---|---|
| G1 — fichier réécrit par `write` absent du bilan | `conversationChanges` : un outil `edit` abouti sans `diff` compte ses `locations` comme modifiées (`unknown`), sans totaux inventés ni « Annuler » ; la ligne dit « modifié », dépliée elle renvoie à la vue Git. Règle générique (genre ACP), sans regarder le titre ni l'agent. Le « reste assumé » de la fiche 202 est levé. | `changes.test.ts` (forme exacte du fil de la recette) ; `trace-replay.test.ts` (traces réelles 2.2.5 et 2.3.0) ; `agent-host.test.ts` (rejeu générique) ; e2e `replay-changes` (`reecriture-opencode`, en direct et après redémarrage) |
| G2 — « Exécuter le plan » reste actif | `planVersions` : `executed` dès qu'un message hors du mode plan suit le plan ; boutons désactivés, « Plan déjà exécuté ». | `plan-doc.test.ts` ; e2e `plan` |
| G3 — ✕ sous le pointeur, double clic qui ferme | En panneau serré, l'actif garde la marge droite des inactifs (son ✕ s'ajoute après) ; le ✕ ignore le second clic d'un double clic et les clics dans les 500 ms qui suivent l'activation de son onglet (`tab-close-guard.ts`). | `tab-close-guard.test.ts` ; e2e `onglets-etroits` (clic au bord droit puis second clic) |
| G4 — remarques coupées dans le diff | `.diff-table` est un conteneur (`container-type: inline-size`) ; la remarque : `max-width: min(520px, 100cqw − 40px)`. | e2e `relecture` (remarque dans la largeur visible) |
| G5 — travail mis à la corbeille | État `gone` dès que la conversation du travail n'existe plus, même après sa réponse : « mis à la corbeille », phrase qui explique la disparition des boutons, pas de « Transmise » ; côté main, `childContext` ne joint plus les nouvelles d'un travail disparu (`exists`). Conforme aux fiches 263 (« conversation supprimée ») et 264, dont le libellé devient « mis à la corbeille ». | `WorkCard.test.tsx` ; `children.test.ts` (main, fille supprimée) |
| G6 — `/compact` emporte les réponses | Une compaction ne reçoit pas le contexte joint (`extraContext`) ; `childNews`, `handoverContext`, `memoryOutcomes` et `relayOf` ne comptent pas un message de compaction comme « prochain message ». | `agent-host-compaction.test.ts` ; `children.test.ts` (shared) ; `work-card.test.ts` ; `handover.test.ts` |
| G7 — dossier disparu, « git introuvable » | Envoi refusé avant tout départ, message `conversations.error.folderGoneAtSend` (`missingFolder`) ; `explainMissingGit` et `notARepoOrError` distinguent le dossier disparu (`git.folderMissing`) du binaire absent. | `manager.test.ts` ; `git-queue.test.ts` (vrai git, dossier disparu) ; `repo.test.ts` |
| G8 — fil resté au-dessus du bas (à rejouer) | **Reproduit en jsdom** : après un envoi depuis une carte (`followSent`), le saut en bas fait passer une carte `data-scroll-hold` sous le pointeur immobile ; Chromium le signale (`pointerover`) et le fil se figeait. Désormais un `pointerover` à la position du pointeur au moment de l'envoi ne retient pas le fil ; un vrai mouvement, si. | `useThreadScroll.test.ts` |
| G9 — lien local sans effet visible (à rejouer) | **Reproduit** (logique) : `files:openLink` attendait le chargement de la page (jusqu'à 30 s) avant de rendre la main ; le panneau ne passait sur le Navigateur qu'après. L'onglet est créé tout de suite, le chargement n'est plus attendu. Écran verrouillé de la recette non rejoué. | `ipc.test.ts` (page qui ne finit jamais de charger) |

### Agaçants

| Défaut | Correction (décision) | Essai |
|---|---|---|
| A1 — « Model », « Session Mode » | `controlName` : nom traduit pour les catégories ACP connues (`model`, `mode`, `thought_level`), sinon celui de l'agent. Descriptions et noms de fournisseurs viennent de l'agent : inchangés (ADR-0014). | `control-name.test.ts` |
| A2 — menus macOS en anglais | `CFBundleLocalizations: [en, fr]`, `CFBundleDevelopmentRegion: en`, `en.lproj` et `fr.lproj` (`build/lproj`) copiés dans Contents/Resources. Le doublon « Plein écran » / « Enter Full Screen » n'est pas traité (voir « Reste »). | `scripts/signing.test.ts` |
| A3 — « Partira à Code reviewer » | « Sera confié à … » (glossaire : confier un travail à un rôle) ; « Sera transmise à l'agent… » pour les réponses en attente. | `RoleComposer.test.tsx`, `Transcript.test.tsx` |
| A4 — invite « Répondre à OpenCode… » avec un rôle | « Votre demande à {{role}}… », « Votre demande aux N rôles… ». | `RoleComposer.test.tsx` |
| A5 — activité brute « read » | `useChildActivity` garde ce que chaque outil a dit et le libelle par `toolText` (« Lecture de liste.js »). | `RoleWork.test.tsx` |
| A6 — « Voir les modifications » en lecture seule | Masqué quand tous les travaux de la carte sont en lecture seule. | `WorkGroup.test.tsx` |
| A7 — recherche qui montre `<bobine_role…` | Texte cherchable des messages : `stripAppContext`. | `content-search.test.ts` |
| A8 — Code / Discussion qui déborde | Boutons `min-width: 0`, raccourci masqué sous 260 px (requête de conteneur). | e2e `debordements` (720 px) |
| A9 — « N fichiers non commités » sur deux lignes | Texte dans `.session-link-text` (une ligne, coupée). | `SessionChanges.test.tsx` |
| A10 — `@git-changes`, `@terminal` sous « Fichiers » | Titre « Contexte » pour eux ; « Fichiers · … » avant le premier fichier. | `RoleComposer.test.tsx` |
| A11 — badges « IBM Bob » dans une conversation OpenCode | Commande de l'app : badge de l'agent de la conversation seul (`installedAgents` retiré). Descriptions anglaises : celles de l'agent (ADR-0014), le badge le dit. | e2e `commands` |
| A12 — apostrophes droites | `fr.json` et CHANGELOG (fr, en) hors code ; garde-fou. | `glossary-typography.test.ts` |
| A13 — « bobcoin » | « Bobcoin ». | `glossary-typography.test.ts` |
| A14 — « Exécution » / « Build » | Réglages › Conversations › Mode : le nom que l'agent donne à son mode d'exécution (celui de la conversation affichée, si c'est l'agent des nouvelles conversations), sinon « Exécution ». | `execute-mode-name.test.ts` |
| A15 — `profil/workspace` dans les récents | Filtré de la vue des réglages (`neutralFolder`). Décision : filtrer à l'affichage plutôt que dans le magasin (le gestionnaire est au plafond de lignes) ; l'effet est le même partout où la liste s'affiche. | `settings-view.test.ts` |
| A16 — « L'agent s'est arrêté » trois fois, SIGKILL | Le fil le dit une fois ; sous la saisie, « Relancer » seul ; invite « Écrivez pour relancer l'agent… » ; SIGKILL dit « arrêt forcé par le système ou un autre programme (SIGKILL) ». | `Composer.test.tsx`, `agent-host.test.ts` |
| A17 — « Adresse (ex. localhost:3C » | Invite « localhost:3000 », nom entier en `aria-label` et infobulle. | `glossary-typography.test.ts` (16 caractères au plus) |
| A18 — Discussion : navigateur sans onglet | `shownPanelTab` : un onglet absent de l'espace cède la place au premier affiché. | `panel-tabs.test.ts` |
| A19 — bouton sans nom accessible | `aria-label` sur « Masquer la barre latérale » (et les boutons de la barre repliée). | `Sidebar.test.tsx` |
| A20 — `fichier:ligne` en code non cliquable | Plugin rehype `rehypeInlineFileCode` : code en ligne qui a l'air d'un chemin (dossier ou ligne, extension) → lien de fichier. Jamais dans un bloc de code. | `inline-file-code.test.ts`, `Markdown.test.tsx` |
| A21 — « coût inconnu » pour Big Pickle | **Décision : gardé.** Règle de la fiche 266 (« gratuit » seulement pour un modèle qui se dit gratuit) ; l'infobulle explique ; reconnaître Big Pickle demanderait une liste propre à un agent. | — |
| A22 — agent de l'ancienne conversation démarré au lancement avec un dossier | `startActive(false)` quand une demande `bobine <dossier>` attend (`launch.pending`) : avis posés, agent non démarré. | `launch-request.test.ts`, `manager.test.ts` |
| A23 — carte de plan sans pied | Le pied de la réponse remplacée suit la carte du plan. | `Transcript.test.tsx` |
| A24 — travaux d'un même message indiscernables | Plusieurs rôles : chaque travail titré « Rôle · demande ». | `invoke.test.ts` |
| A25 — libellés français des rôles en anglais | `relabelRoles` : libellé du moment pour les rôles fournis (portée `builtin`) dans le fil ; les rôles personnels ou de projet gardent le leur. | `role-labels.test.ts` |

## Plan

Fait défaut par défaut, un commit par lot cohérent (voir le journal) ; pas de nouvelle dépendance.
Fichiers principaux : `shared/changes.ts`, `shared/plan-doc.ts`, `panel/SidePanel.tsx`,
`panel/tab-close-guard.ts`, `styles.css`, `thread/work-card.ts`, `WorkFoot.tsx`, `WorkGroup.tsx`,
`main/agent/agent-host.ts`, `main/conversations/{host-options,manager,folder-fallback,settings-view,
content-search,draft-discard}.ts`, `main/git/{git-queue,repo}.ts`, `main/ipc.ts`,
`useThreadScroll.ts`, `control-name.ts`, `role-labels.ts`, `inline-file-code.ts`,
`electron-builder.yml`, `build/lproj/`.

## Journal

- 2026-11-21 — Toutes les corrections faites, dans le worktree `fix/chasse-agacements` (partie de
  `main` à la 1.0.0-rc.2). Contrat de G1 pris du fil enregistré de la recette (profil de recette,
  `conversations/474dd4ea….json`) : `write` sur un fichier existant fini par
  `content: [{ type: 'content', content: { type: 'text', text: 'Wrote file successfully: src/cli.js' } }]`
  et `locations`, sans `diff` ; la création porte un `diff` (`oldText: null`). Le journal
  `agents.log` (mode Détaillé) ne garde que des résumés : la trace réelle 2.3.0 du dépôt
  (`creation-autorisee-d-office`) a la même forme et sert à l'essai de rejeu.
- `manager.ts` au plafond de lignes : la sortie d'un brouillon passe dans `draft-discard.ts`.
- Écart : la clé `conversations.error.folderMissing` existait (« Dossier introuvable ») ; elle est
  gardée, le refus d'envoi a sa clé (`folderGoneAtSend`).
- e2e : `pnpm build && pnpm e2e --changed` (234 tâches, clair et sombre) : `panel` en échec, un
  ✕ cliqué dans la foulée de l'activation de son onglet, désormais ignoré par conception (G3) ; la
  suite attend la demi-seconde de garde. Puis `pnpm e2e panel about` vert, et une seconde campagne
  `pnpm e2e --changed` entière, verte (code de sortie 0, 21 min 29 s).
- Essais modifiés parce que le comportement attendu change : `trace-replay` (fichier réécrit sans
  autorisation : compté), `agent-host` (rejeu générique : README compté sans totaux), textes « Sera
  confié à », `repo.test` (`/x` inexistant : c'est le dossier qui manque), `invoke.test`
  (`withoutAsk` retire aussi le titre, essayé à part), e2e `commands` (un seul badge),
  `manager-discussion` (dossier de repli à part, comme dans l'app), e2e `panel` (garde du ✕).

## Reste

- A2 : le doublon « Plein écran » (menu Affichage de l'app) / « Passer en plein écran » (ajouté par
  macOS) n'est pas traité ; `NSFullScreenMenuItemEverywhere` serait la piste. `.app` construit sans
  signature (electron-builder `--dir`, `identity: null`, sans AXe ni DMG, dans un dossier jetable) :
  `CFBundleLocalizations` = `["en","fr"]`, `CFBundleDevelopmentRegion` = `en`, `en.lproj` et
  `fr.lproj` dans Contents/Resources. Les menus eux-mêmes ne sont pas regardés (app non lancée).
- A21 : décision de garder « coût inconnu » (voir plus haut).
- G8, G9 : reproduits en essai (jsdom, IPC) ; pas rejoués écran ouvert dans l'app.
