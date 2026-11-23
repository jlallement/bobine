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
| A20 — `fichier:ligne` en code non cliquable | Plugin rehype `rehypeInlineFileCode` : code en ligne qui a l'air d'un chemin (dossier ou ligne, extension) → lien de fichier ; jamais dans un bloc de code ; règle (revue) : extension avec au moins une lettre ; `./` ou `../` en tête, toujours un chemin ; refus d'un `@` dans le premier segment (sauf en tête, `@scope/…`), d'un premier segment domaine ou IP suivi d'un `/`, d'un `hôte:port` dont le domaine de premier niveau n'est jamais une extension de fichier (`com`, `org`, `ch`…). Risque accepté : un domaine hors de cette liste, seul ou avec un port, est pris pour un fichier. Recette de la rc.3 : lien seulement vers un fichier qui existe dans le dossier de la conversation (`files:existing`, voir le journal). | `inline-file-code.test.ts`, `Markdown.test.tsx`, `file-exists.test.ts`, e2e `links` |
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

- 2026-11-21 — CI Windows de `main` (run 44894413723, verify (Windows)) : « dossier de travail
  disparu » rouge, stderr reçu `spawn C:\Program Files\Git\ucrt64\bin\git.exe ENOENT`. Cause :
  `GIT_MISSING` lisait le programme avec `\S*`, arrêté par l'espace de « Program Files » ; ni git
  absent ni dossier disparu n'étaient reconnus, et l'erreur brute passait. Règle refaite
  (`\bspawn (?:[^\n]*[\\/])?git(?:\.exe)? ENOENT\b`) : `git` seul ou un chemin qui finit par
  `/git` ou `\git.exe`, espaces comprises, sur une seule ligne ; elle ne prend plus `digit`,
  `legit.exe` ni `respawn` (faux positifs de l'ancienne). Essais unitaires indépendants de la
  plateforme (`explainMissingGit` avec le système en paramètre) : chemins Windows avec et sans
  espaces, Unix, faux positifs, dossier disparu avec git dans « Program Files ». Aucune autre règle
  en `\S*` sur un chemin de programme dans `src/` (`repo.ts` teste `ENOENT` seul).

- 2026-11-21 — Trois défauts d'affichage relevés en usage réel, avant rc.3.
  - Modifications vide : `.side-panel-empty` n'avait pas de marge dans les onglets `flush`
    (Modifications, Activité ACP, Simulateur, Android, Navigateur), dont le corps n'a pas les 16 px
    de `.side-panel-body` ; la phrase « …pas un dépôt git » touchait les bords et était rognée.
    `.side-panel-body.flush .side-panel-empty { padding: 0 16px }` : la marge de Tâches, sans
    changement pour les états vides courts.
  - Carte de chaleur : le défilement retenu est arrondi à la colonne supérieure (revue QA,
    `eaa9a67`) ; une étiquette jugée « entièrement cachée » pouvait donc dépasser de 14 px dans la
    vue (« s » pour « mars »). Une étiquette qui commence avant le bord gauche de la vue n'est plus
    montrée du tout ; la grille ne bouge pas. Essai : défilée de 20 px, « oct. » n'apparaît plus
    (échouait avant).
  - Typographie : `fr.json` était déjà juste (espaces ordinaires, insécables posées à l'affichage
    par `typography.ts`, fiche 126 ; non modifié). Les Nouveautés, rendues telles quelles, ne
    l'étaient pas. Une première version réécrivait `CHANGELOG.md` (1 619 insécables) : refusée en
    relecture, contraire au choix de la fiche 126 et source de conflits avec les branches qui
    ajoutent des lignes. Retenu : `Markdown` prend `french`, qui ajoute `remarkFrenchSpaces` (celui
    du guide, fiche 186) ; il ne touche que les nœuds `text`, jamais le code en ligne, les blocs ni
    les adresses. Réglages › Nouveautés le passe pour le journal français. `CHANGELOG.md` s'écrit
    toujours avec des espaces ordinaires. Essais : `Markdown.test.tsx` (texte, code en ligne, bloc,
    lien), et dans le glossaire, des guillemets de `fr.json` détachés de leur mot (sinon la
    typographie ne les lie pas). Les e2e passent par `L()` et ne lisent pas les Nouveautés.

- 2026-11-21 — Recette du build de `main` avec OpenCode (avant le tag rc.3), branche
  `fix/rc3-liens` :
  - **D1 — code vers un fichier qui n'existe pas souligné comme un lien** (`package.json` absent,
    `tests/liste.test.js` à créer, `../liste.js` relatif au fichier à créer). Un code en ligne
    n'est plus un lien que si le fichier existe : nouveau canal `files:existing` (aucun moyen de
    tester l'existence n'existait ; `openFileLink` ne le dit qu'au clic), `existingFileLinks`
    (`main/files/file-exists.ts`) : 200 chemins par appel, 1024 caractères par chemin, 2 s en tout
    (ce qui n'a pas répondu reste du code), confiné au dossier de travail comme les liens (base
    hors du dossier ignorée, `..` qui en sort, chemin absolu ailleurs ou lien symbolique vers le
    dehors : pas un fichier). Côté interface, `useInlineFiles` : le rendu collecte les candidats,
    un seul appel groupé par message après lui (pendant le flux, après 300 ms de pause) ; tant
    qu'on ne sait pas, du code ; fichiers trouvés retenus par conversation (un fil rouvert les
    montre en liens d'emblée, sans passer par du code) ; un absent est redemandé quand le message
    est remonté. Vérificateur fourni par `ConversationScope` et par l'aperçu d'un document
    (`DocumentTab`, relatif au document) ; ailleurs (Réglages › Nouveautés…), aucun lien. Les
    liens Markdown `[x](chemin)` ne changent pas. Limite d'abord assumée, levée par la relecture
    (voir plus bas) : un fichier créé après sa mention restait du code ; seuls
    les fichiers du dossier de travail comptent (pas les autres dossiers de la fiche 179, que les
    liens ne savent pas ouvrir non plus, sinon dans le Finder).
  - **D2 — carte rouge par clic sur un fichier introuvable, pied du tour disparu.** Cause : le
    résultat `missing` de `files:openLink` part en `notices.warn` (`useFileLinks`), c'est-à-dire
    `fail` de `useConversations`, qui pousse un avis de niveau `error` dans le fil de la
    conversation active, donc dans le dernier tour ; `endedBadly` (`shared/turn-end.ts`) prend tout
    avis `error` sans réponse datée après lui pour une fin anormale du tour, et le pied disparaît.
    **Déjà le cas avant la fiche 272** pour un lien Markdown vers un fichier absent (avis depuis la
    fiche 052, pied masqué depuis la fiche 261) ; la fiche 272 l'a rendu courant en faisant de
    chaque chemin en code un lien. Correction à la cause : les avis de l'interface portent
    `local` (`useConversations`, évènement `notice`), `endedBadly` les ignore (pied et plan), et
    le même avis local redonné remplace le précédent au lieu de s'empiler (`reduceNotice`,
    `transcript-notice.ts`). **Pas fait** : l'avis reste dans le fil jusqu'au prochain
    chargement. L'app n'a aucun mécanisme d'avis passager (les avis du haut de la fenêtre,
    fiche 194, sont persistants et réservés aux problèmes internes ; les notes passagères du
    panneau sont propres au Navigateur et à l'onglet joint) : en faire un serait un nouvel
    élément visuel, à maquetter d'abord (voir Reste).
  - Essais : `file-exists.test.ts` (main), `Markdown.test.tsx` (absent, existant, un appel par
    message, retenus, sans vérificateur, vérification en échec), `TurnSummary.test.tsx` (pied
    gardé après deux avis locaux), `useConversations.test.ts` (un seul avis local) ; e2e `links`
    (scénario `liens-fichiers` complété : codes absents pas des liens, `liste.js:2` lié et ouvert,
    `absent.md` cliqué deux fois : un avis, pied visible).
  - `./scripts/verify` vert (code 0) ; `pnpm build` (code 0) ; `pnpm e2e links fil changes` vert
    (code 0, 6 tâches, clair et sombre, 36 s) ; captures `44-code-fichiers-absents` et
    `45-fichier-absent-pied` (clair et sombre) regardées.
- 2026-11-21 — Relecture indépendante de `fix/rc3-liens` (rien de bloquant), reprises :
  - Mémoire par **conversation** (`file-checks.ts`, `fileChecksFor`, 30 conversations, 2000
    réponses chacune) et non plus par fonction : A → B → A retrouve les liens de A sans clignoter
    ni redemander. Les demandes de tous les messages d'un même instant partent en **un seul**
    appel (200 chemins au plus par appel). Essai par le chemin réel de l'app (`ConversationScope`
    remonté par `key`).
  - Réponses indexées par `base` dans la mémoire de la conversation : une réponse arrivée après un
    changement de document (aperçu) ne s'applique pas au nouveau.
  - Un « non » n'est plus définitif : `filesRevision` (outil `edit`, `delete`, `move`, `execute`,
    `other` terminé, réponse finie) passé à `ConversationScope` (fil actif et conversation à côté) ;
    quand il change, les « non » sont oubliés et redemandés par les messages qui les citent. Un
    délai dépassé ou un appel en échec n'est ni oui ni non : redemandé au signal suivant.
  - Main : `files:existing` rend `{ existing, unknown }` ; le délai de 2 s couvre aussi les chemins
    réels du dossier et de la base ; 8 `stat` à la fois ; chemin absolu accepté sous la forme
    donnée du dossier comme sous son chemin réel (comme `openWorkspaceFile`) ; comparaison sans
    casse sous Windows (`insideOn`).
  - `reduceNotice` : ne remplace que l'avis local identique (niveau, titre, texte) le plus récent
    du tour en cours. `local` documenté : jamais envoyé au main ni écrit sur disque.
  - CHANGELOG : un chemin hors du dossier n'est plus un lien ; un fichier créé ensuite le devient.
  - Essais : `inline-files.test.tsx` (fil entier en un appel, A → B → A, document changé, fichier
    créé après sa mention, délai et échec, 300 ms pendant l'écriture, signal), `file-exists.test.ts`
    (forme donnée, casse sous Windows, borne : non vérifiés inconnus), `file-exists-timeout.test.ts`
    (chemin réel muet : rendu au délai), `ipc.test.ts` (raccordement de `files:existing`),
    `transcript-notice.test.ts` (titre, niveau, tour).
- 2026-11-21 — Deuxième relecture (8 points sur 9 validés), dernière reprise :
  - Un signal ne refait plus aucun rendu : la mémoire garde ses « non » (affichés en code),
    les revérifie elle-même en un appel groupé, et ne prévient les messages que si un lien apparaît
    ou disparaît ; la signature d'un message ne porte que sur l'affichage (lien ou non). Essai qui
    compte les rendus Markdown : 30 outils terminés, 30 revérifications, aucun rendu ; un fichier
    apparu, un seul rendu.
  - Signal arrivé pendant une demande : la réponse d'avant ne dit plus « non », le chemin est
    redemandé (sauf « oui »).
  - Main : 2 opérations de fichiers à la fois (la moitié des 4 fils de libuv au plus) ; après un
    délai dépassé, plus aucune vérification dans ce dossier pendant 30 s (tout « inconnu »).
  - Au-delà de 2000 réponses, les plus anciennes sont oubliées une à une (jamais une en cours de
    demande), sans prévenir les messages : plus d'effacement complet qui faisait clignoter.

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
- 2026-11-21 — Minuteur du menu « Réglages de la session » (CI Linux de `main`, run
  44904885423 : tous les essais verts, mais Vitest attrapait « window is not defined » venu de
  `SessionSettingsMenu.test.tsx`). Cause : le repli de 300 ms posé à l'ouverture (`Menus.tsx`)
  n'était jamais annulé ; il appelait `setOpen` après le démontage, en CI après la fin de jsdom.
  Déjà le cas dans la rc.2. Correctif : minuteur gardé dans une ref, annulé à la fermeture, à
  une nouvelle ouverture et au démontage ; au démontage, ni le repli ni les
  lectures qui aboutissent ensuite (`show`, `whenStill`) ne touchent plus l'état. Comportement visible
  inchangé. Essai : démonté avant 300 ms, plus aucun minuteur en attente, ni erreur ni
  avertissement après les lectures et 1 s de minuteurs (échouait avant : un minuteur restait).
  Même recherche dans `src/renderer` : les autres `setTimeout` qui mettent à jour un état sont
  annulés au nettoyage de leur effet ; restent, sans `setState` et non touchés, le repli de la
  molette de `screen-gestures.ts` (envoie un geste au simulateur s'il tombe après le démontage)
  et le double minuteur de focus de `useRoleCompose.tsx`.
- 2026-11-23 — Seconde chasse avant la 1.0.0-rc.4 (branche `fix/chasse2-correctifs`, journaux du
  pilote `chasse-rc4/.pilote/sessions/2026-11-23-*`) :
  - **Focus perdu sur `<body>`** après une décision (« Vérifier maintenant » désactivé pendant
    « Vérification… », « Attendre » et « Arrêter » du bandeau de silence, « Arrêter » du bandeau
    « modèle injoignable », « Autoriser une fois » / « Refuser », « Retenir », Stop, « Committer »,
    Réglages fermés par Échap ou ✕). Cause commune : l'élément qui avait le focus part ou se
    désactive, et Chromium pose le focus sur la page sans évènement. Un mécanisme unique,
    `renderer/src/focus-keeper.ts`, posé par `main.tsx` pour la fenêtre principale : il retient le
    dernier élément focalisé (`focusin`) et, quand le focus est sur la page (ou sur un élément
    désactivé) parce que cet élément est parti, désactivé ou masqué (`focusout` sans destination,
    ou mutation de la page), envoie le focus à l'élément suivant de la fenêtre modale ouverte
    (sinon à son premier élément), sinon à la zone de saisie. Après 60 ms : Radix (qui rend le
    focus dans un `setTimeout`) et quiconque pose le focus ailleurs passent d'abord ; un clic dans
    le vide (élément toujours là) laisse le focus où il est, et l'oublie. Cas propres : « Modifier »
    d'un souvenir met le focus dans le premier champ (`MemoryEntryRow`) ; ouvrir l'onglet Terminal
    ou Navigateur leur donne le clavier (`usePanel.select`, `focusTab` remplace `focusTerminal` ;
    le navigateur : `browser:show` prend un troisième argument `focus`, le main fait
    `webContents.focus()` de la page ; sans page, le champ d'adresse). Preuves :
    `focus-keeper.test.ts` (carte partie, bouton désactivé, fenêtre ouverte → suivant, fenêtre
    fermée → saisie, clic dans le vide, quelqu'un d'autre d'abord), `MemoryEntryRow.test.tsx`,
    `usePanel.test.ts`, `ipc.test.ts` (`focus` vérifié) ; e2e `permissions` (« Autoriser une fois »
    et Réglages fermés par Échap : focus dans la zone de saisie).
  - **Listes sans nom** de Réglages › Général (Langue, Fenêtre rapide, Éditeur), et de même
    Conversation (agent, dossier), Notifications (son), Diagnostic (niveau du journal), polices de
    l'Apparence : `aria-label` du libellé de leur ligne. Thèmes « Nouveau » annoncés
    « AuroraNew » : nom accessible « Aurore, nouveau » (`settings.appearance.theme.newName`).
    Preuve : l'essai « interrupteurs nommés » de `SettingsDialog.test.tsx` regarde aussi les
    listes et les choix de chaque section (rouge sans le correctif), et le nom d'Aurore.
  - « Mémoire : clé des empreintes créée » écrit en WARN : c'est une création normale (premier
    lancement, profil neuf) ; le journal de `approvalSigner` prend un niveau, INFO ici, WARN pour
    le reste (clé illisible, trousseau indisponible). Preuve : `approval-key.test.ts`.

## Reste

- A2 : doublon traité (`NSFullScreenMenuItemEverywhere`), essayé en unitaire ; les e2e tournent
  sur l'app non packagée, où la préférence n'est pas posée : menus réels non regardés. `.app` construit sans
  signature (electron-builder `--dir`, `identity: null`, sans AXe ni DMG, dans un dossier jetable) :
  `CFBundleLocalizations` = `["en","fr"]`, `CFBundleDevelopmentRegion` = `en`, `en.lproj` et
  `fr.lproj` dans Contents/Resources. Les menus eux-mêmes ne sont pas regardés (app non lancée).
- A21 : décision de garder « coût inconnu » (voir plus haut).
- G8, G9 : reproduits en essai (jsdom, IPC) ; pas rejoués écran ouvert dans l'app.
- D2 (rc.3) : un avis passager (disparaît seul après quelques secondes, sans entrer dans le fil)
  pour les erreurs de clic sur un lien demanderait un élément visuel nouveau : à maquetter et
  valider avant de le coder. En attendant : un seul avis par texte, pied du tour intact.
- Liens en code (rc.3) : l'aperçu d'un document d'une conversation qui n'est ni l'active ni celle
  d'à côté ne reçoit pas le signal « des fichiers ont pu changer » ; ses « non » ne sont
  revérifiés qu'au prochain signal de cette conversation. Laissé tel quel (relecture, point E).
