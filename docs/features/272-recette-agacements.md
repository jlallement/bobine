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
| G1 — fichier réécrit par `write` absent du bilan | `conversationChanges` : un outil `edit` abouti sans `diff` compte ses `locations` comme modifiées (`unknown`), sans totaux inventés ni « Annuler » ; la ligne dit « modifié », dépliée elle renvoie à la vue Git ; en-tête, Modifications, pied du tour et Session disent « sans totaux » (tous) ou « · N sans totaux » (`LineTotals`), et « binaire » pour un fichier binaire, jamais « +0 −0 » ; terme au glossaire (« sans totaux » / « without line counts »). `docs/acp.md` à jour (OpenCode `write` ; retouches `.docx` de Bob avec `locations` : comptées) ; reste assumé de la fiche 202 levé. Règle générique (genre ACP), sans regarder le titre ni l'agent. Le « reste assumé » de la fiche 202 est levé. | `changes.test.ts` (forme exacte du fil de la recette) ; `trace-replay.test.ts` (traces réelles 2.2.5 et 2.3.0) ; `agent-host.test.ts` (rejeu générique) ; `TurnSummary.test.tsx` et `LineTotals.test.tsx` (« sans totaux », binaire) ; e2e `replay-changes` (`reecriture-opencode`, en direct et après redémarrage) |
| G2 — « Exécuter le plan » reste actif | `planVersions` : `executed` seulement si un message ultérieur a pour texte exact `planExecution(plan.path)`, part hors des modes plan et ask, et que son tour a une réponse datée de l'agent ou ne finit pas mal (`endedBadly`, mis en commun dans `shared/turn-end.ts` avec le pied du tour) : une panne de l'agent après sa réponse ne réactive pas le plan. Choix assumé : app quittée pendant l'exécution (tour sans fin connue), le plan reste exécuté. Verrou d'envoi par conversation dans `planActionsFor` (jusqu'à la fin ou l'échec de l'envoi, sans minuterie) : deux clics pendant le changement de mode n'envoient qu'une fois ; boutons désactivés, « Plan déjà exécuté ». Revue : la première règle (tout message hors plan) figeait le plan après une question en Ask ou en Build, ou une exécution arrêtée. | `plan-doc.test.ts` (Ask, question en Build, exécution arrêtée puis réussie, panne après le tour) ; `plan-badges.test.ts` (deux clics, un envoi) ; e2e `plan` |
| G3 — ✕ sous le pointeur, double clic qui ferme | En panneau serré, l'actif garde la marge droite des inactifs (son ✕ s'ajoute après, jamais sous le pointeur) ; le ✕ ignore le second clic d'un double clic (`detail` > 1). Revue : la fenêtre de 500 ms après l'activation, d'abord ajoutée, avalait des clics volontaires et bloquait le clavier : retirée (et l'attente de l'e2e `panel` avec). | `tab-close-guard.test.ts` ; `SidePanelTabs.test.tsx` (jsdom, panneau large : l'ordre de tabulation et la garde du double clic ; le clavier y est simulé par un clic `detail` 0, comme Chromium le produit pour Entrée) ; le mode serré (marge, ✕ jamais sous le pointeur) n'est couvert que par l'e2e `onglets-etroits` |
| G4 — remarques coupées dans le diff | `.diff-table` est un conteneur (`container-type: inline-size`) ; la remarque : `max-width: min(520px, 100cqw − 40px)`. | e2e `relecture` (remarque dans la largeur visible) |
| G5 — travail mis à la corbeille | État `gone` quand la conversation du travail n'existe plus **dans la liste complète** (`SubtasksInfo.exists`), même après sa réponse : « conversation supprimée » (étiquette et phrase alignées : la corbeille a pu être vidée), une phrase dit pourquoi les boutons ont disparu (sans promettre une restauration, la corbeille a pu être vidée), pas de « Transmise ». Une fille détachée mais existante (mère restaurée sans ses filles) garde l'état de sa dernière réponse. Côté main, même critère (`exists` = la conversation existe, `manager.ts`) : `childContext` ne joint plus ses nouvelles, et **le réveil de la mère** (`children-wake.ts`) ne se déclenche plus pour elle. Conforme aux fiches 263 et 264, dont le libellé reste « conversation supprimée ». | `WorkCard.test.tsx` (supprimée, détachée) ; `children.test.ts` (main) ; `children-wake.test.ts` |
| G6 — `/compact` emporte les réponses | Une compaction ne reçoit pas le contexte joint (`extraContext`) ; `childNews`, `handoverContext`, `memoryOutcomes` et `relayOf` ne comptent pas un message de compaction comme « prochain message ». | `agent-host-compaction.test.ts` ; `children.test.ts` (shared) ; `work-card.test.ts` ; `handover.test.ts` |
| G7 — dossier disparu, « git introuvable » | Avant l'envoi (`send-folder.ts`) : en Discussion, le dossier est recréé (`ensureDiscussionFolder`) ; ailleurs, refus (`conversations.error.folderGoneAtSend`) seulement sur `ENOENT`, `ENOTDIR` ou un chemin qui n'est plus un dossier ; une autre erreur (`EACCES`, `ETIMEDOUT`) laisse passer ; `stat` asynchrone borné à 2 s (un partage réseau muet ne fige pas l'app). La préparation des envois d'une conversation est enchaînée (`send-order.ts`) : deux envois rapprochés gardent leur ordre. `explainMissingGit` et `notARepoOrError` distinguent le dossier disparu (`git.folderMissing`) du binaire absent. | `send-folder.test.ts` ; `manager-send-order.test.ts` (garde du premier plus lente) ; `manager.test.ts` ; `git-queue.test.ts` (vrai git) ; `repo.test.ts` |
| G8 — fil resté au-dessus du bas (à rejouer) | **Reproduit en jsdom** : après un envoi depuis une carte (`followSent`), le saut en bas fait passer une carte `data-scroll-hold` sous le pointeur immobile ; Chromium le signale (`pointerover`) et le fil se figeait. Désormais la position du pointeur est suivie au `pointerdown` et au `pointermove` (celle du clic, pas de l'entrée dans la carte) ; un `pointerover` à cette position après l'envoi ne retient pas le fil ; un vrai mouvement, si. Sans envoi, une carte qui arrive sous un pointeur immobile retient toujours le fil (fiche 124). | `useThreadScroll.test.ts` (entrée et clic à des positions différentes ; carte arrivée sous un pointeur immobile) |
| G9 — lien local sans effet visible (à rejouer) | **Reproduit** (logique) : `files:openLink` attendait le chargement de la page (jusqu'à 30 s) avant de rendre la main ; le panneau ne passait sur le Navigateur qu'après. L'onglet est créé tout de suite, le chargement n'est plus attendu. Écran verrouillé de la recette non rejoué. | `ipc.test.ts` (page qui ne finit jamais de charger) |

### Agaçants

| Défaut | Correction (décision) | Essai |
|---|---|---|
| A1 — « Model », « Session Mode » | `controlName` : nom traduit pour les catégories ACP connues (`model`, `mode`, `thought_level`), sinon celui de l'agent. Descriptions et noms de fournisseurs viennent de l'agent : inchangés (ADR-0014). | `control-name.test.ts` |
| A2 — menus macOS en anglais | `CFBundleLocalizations: [en, fr]`, `CFBundleDevelopmentRegion: en`, `en.lproj` et `fr.lproj` (`build/lproj`) copiés dans Contents/Resources. Conséquence vérifiée : `app.getLocale()` ne vaut plus que en ou fr. Seuls usages : la langue de l'app (déjà `app.getPreferredSystemLanguages()`), et `nativeLanguage` (langue des menus de macOS de ce lancement : c'est bien en/fr qu'il doit dire). Le navigateur intégré, qui suivait la langue de Chromium, envoie désormais un `Accept-Language` tiré de `getPreferredSystemLanguages()` (`accept-languages.ts`). `navigator.languages`, dans les pages, reste celui de Chromium (en/fr) : il ne change pas. Doublon « Plein écran » / « Enter Full Screen » : l'article de l'app n'a déjà pas de rôle `togglefullscreen` (fiche 126) ; macOS ajoutait pourtant le sien au menu Fenêtre. Au démarrage de l'app packagée, sur macOS seulement, `NSFullScreenMenuItemEverywhere = false` (préférence de l'app, avant la création du menu ; pas en développement, où le domaine d'Electron est partagé) : seul reste « Plein écran » / « Quitter le plein écran » de l'app, traduit. Rien sous Linux ni Windows. | `scripts/signing.test.ts` ; `accept-languages.test.ts` ; `full-screen-menu.test.ts` (macOS, Linux, Windows simulés) ; `menu.test.ts` (un seul article de plein écran, traduit, sans rôle) |
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
| A14 — « Exécution » / « Build » | **Gardé, décision de l'utilisateur** (glossaire, `docs/traduction.md`, point tranché 3 : « Exécution » / « Act », paire Plan / Act) : Réglages garde « Exécution » ; la saisie affiche le nom du mode donné par l'agent. Le changement d'abord fait est annulé (commit `revert:`). | — |
| A15 — `profil/workspace` dans les récents | Filtré de la vue des réglages (`neutralFolder`). Décision : filtrer à l'affichage plutôt que dans le magasin (le gestionnaire est au plafond de lignes) ; l'effet est le même partout où la liste s'affiche. | `settings-view.test.ts` |
| A16 — « L'agent s'est arrêté » trois fois, SIGKILL | Le fil le dit une fois ; sous la saisie, « Relancer » seul ; invite « Écrivez pour relancer l'agent… » ; SIGKILL dit « arrêt forcé par le système ou un autre programme (SIGKILL) ». | `Composer.test.tsx`, `agent-host.test.ts` |
| A17 — « Adresse (ex. localhost:3C » | Invite « localhost:3000 », nom entier en `aria-label` et infobulle. | `glossary-typography.test.ts` (16 caractères au plus) |
| A18 — Discussion : navigateur sans onglet | `shownPanelTab` : un onglet absent de l'espace cède la place au premier affiché. | `panel-tabs.test.ts` |
| A19 — bouton sans nom accessible | `aria-label` sur « Masquer la barre latérale » (et les boutons de la barre repliée). | `Sidebar.test.tsx` |
| A20 — `fichier:ligne` en code non cliquable | Plugin rehype `rehypeInlineFileCode` : code en ligne qui a l'air d'un chemin (dossier ou ligne, extension) → lien de fichier ; jamais dans un bloc de code ; règle (revue) : extension avec au moins une lettre ; `./` ou `../` en tête, toujours un chemin ; refus d'un `@` dans le premier segment (sauf en tête, `@scope/…`), d'un premier segment domaine ou IP suivi d'un `/`, d'un `hôte:port` dont le domaine de premier niveau n'est jamais une extension de fichier (`com`, `org`, `ch`…). Risque accepté : un domaine hors de cette liste, seul ou avec un port, est pris pour un fichier. | `inline-file-code.test.ts`, `Markdown.test.tsx` |
| A21 — « coût inconnu » pour Big Pickle | **Décision : gardé.** Règle de la fiche 266 (« gratuit » seulement pour un modèle qui se dit gratuit) ; l'infobulle explique ; reconnaître Big Pickle demanderait une liste propre à un agent. | — |
| A22 — agent de l'ancienne conversation démarré au lancement avec un dossier | `startActive(false)` quand une demande `bobine <dossier>` attend (`launch.pending`) : avis posés, agent non démarré. | `launch-request.test.ts`, `manager.test.ts` |
| A23 — carte de plan sans pied | Le pied de la réponse remplacée suit la carte du plan. | `Transcript.test.tsx` |
| A24 — travaux d'un même message indiscernables | Plusieurs rôles : chaque travail titré « Rôle · demande ». | `invoke.test.ts` |
| A25 — libellés français des rôles en anglais | `relabelRoles` : libellé du moment pour les rôles fournis (portée `builtin`) dans le fil ; les rôles personnels ou de projet gardent le leur ; mémoïsé (`useThreadItems`). | `role-labels.test.ts` |

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

- 2026-11-21 — Reprises de la relecture indépendante (12 points) : G2 (règle exacte), G5
  (existence dans la liste complète, réveil de la mère), G8 (position du clic), G1 (« sans
  totaux », docs), G3 (fenêtre de 500 ms retirée), A14 (annulé, décision du glossaire), G7
  (Discussion, codes d'erreur, `stat` asynchrone borné), A20 (adresses), A25 (mémoïsation), A2
  (`Accept-Language`), doublon de commentaire d'un essai. `./scripts/verify` vert ;
  `pnpm build && pnpm e2e --changed` vert (code 0, 21 min 33 s, clair et sombre).

- 2026-11-21 — Seconde relecture : A20 (règle refaite, faux positifs et négatifs), G2 (panne après
  le tour, double clic), G7 (ordre des envois), et mineurs (libellé « conversation supprimée »,
  binaire, glossaire, `navigator.languages`, portée de l'essai de G3).

- 2026-11-21 — Lien `fichier:ligne` sans dossier (`liste.js:17`, en code ou en lien Markdown) :
  souligné, mais le clic ne faisait rien. react-markdown passe chaque adresse à `urlTransform`
  après les plugins ; `defaultUrlTransform` prenait `liste.js:` pour un schéma inconnu et vidait
  l'adresse (défaut de la 1.0 pour `[x](liste.js:9)`, étendu par les liens en code). Une seule
  règle, `isPathNotScheme` (`@shared/file-links`), lue par `parseFileLink` et par le rendu
  Markdown. Essais : `Markdown.test.tsx` (les deux formes, échouait avant), e2e `links`
  (`liste.js:2` en code : app par défaut, notée dans le journal des ouvertures).

- 2026-11-21 — Relecture de ce correctif : `isPathNotScheme` en temps linéaire (l'ancienne
  expression revenait en arrière à chaque point : plusieurs secondes sur une entrée géante, à
  chaque rendu en streaming) ; une adresse `hôte:port` (`example.com:8080`, `127.0.0.1:3000`) en
  lien Markdown n'est plus prise pour un fichier : la règle d'adresse des chemins en code
  (`pathLike`, `IP`, `HOST_TLD`) vit dans `@shared/file-links`, seul endroit ; essais des pièges
  de `urlTransform` (`javascript.js:1` gardé et ouvert par l'app, `javascript:`, `JaVaScRiPt:`,
  `vbscript:`, `data:` vidés, `C:/…` selon `windowsPaths`) et d'une durée bornée.

- 2026-11-21 — Premier envoi d’un nouveau fil (pilote, OpenCode) : juste après « Nouvelle
  conversation » ou « Nouvelle discussion », une Entrée dans la première seconde ne faisait rien,
  texte laissé dans la saisie, sans aucun signe. Cause : le main ne rend la vue du nouveau fil
  (`create` → `activate`) qu’une fois l’agent démarré, et le renderer écarte les évènements d’une
  conversation sans vue ; la saisie a donc `snapshot` nul, puis `starting`, et `canSendNow` est
  faux : `sendToConversation` rendait la main sans rien dire. Déjà le cas dans la rc.2 (mêmes
  `canSendNow` et `activate`). `send-order.ts` et `draft-discard.ts` n’y sont pour rien.
  Correctif, renderer seul (`usePendingSend`) : Entrée ou Envoyer pendant le démarrage d’une
  conversation connue (`draftKey`) retient l’envoi ; le texte reste dans la saisie, le bouton
  Envoyer passe grisé ; dès que l’agent est prêt (ou répond), l’envoi part par le chemin normal,
  une seule fois. L’attente tombe, texte gardé comme dans la rc.2, si le texte ou les pièces
  jointes changent, si la conversation change, si le démarrage finit autrement (connexion
  demandée, échec, lecture seule) ou si la saisie est démontée. Essais : `Composer.test.tsx`
  (envoi unique à `ready`, double Entrée, texte modifié, `needs-action`, autre conversation ;
  échouaient avant), e2e `composer` (`firstSendWhileStarting` : démarrage lent de 1,5 s, Code et
  Discussion, puis `bob-auth-requise` : texte resté, fil vide).
  Approche abandonnée (gardée pour la 1.1 dans la branche `fix/rc3-premier-envoi-abandon-1.1`) :
  accepter l’envoi tout de suite et laisser le main attendre le démarrage. La saisie se vidait
  sans rien montrer (l’utilisateur retape, envoi en double) ; un message refusé ensuite
  (`needs-action`, courant avec Bob) se perdait, ce qui a demandé une marque « pas parti » sur
  tout le chemin main/IPC, fragile (un `catch` global) ; un changement de conversation avant la
  fin du démarrage jetait le brouillon, et le message partait dans une session invisible. Elle
  échouait aussi en Discussion à l’e2e : le message partait, mais sa bulle n’apparaissait jamais.
  Cause : l’évènement « message de l’utilisateur » arrivait avant la vue du fil, donc écarté, et
  la vue, prise un instant plus tôt, ne le contenait pas (course entre les deux voies, gagnée par
  hasard en Code). La nouvelle approche n’envoie qu’une fois la vue chargée : elle n’y est pas
  exposée.

## Reste

- A2 : doublon traité (`NSFullScreenMenuItemEverywhere`), essayé en unitaire ; les e2e tournent
  sur l'app non packagée, où la préférence n'est pas posée : menus réels non regardés. `.app` construit sans
  signature (electron-builder `--dir`, `identity: null`, sans AXe ni DMG, dans un dossier jetable) :
  `CFBundleLocalizations` = `["en","fr"]`, `CFBundleDevelopmentRegion` = `en`, `en.lproj` et
  `fr.lproj` dans Contents/Resources. Les menus eux-mêmes ne sont pas regardés (app non lancée).
- A21 : décision de garder « coût inconnu » (voir plus haut).
- G8, G9 : reproduits en essai (jsdom, IPC) ; pas rejoués écran ouvert dans l'app.
