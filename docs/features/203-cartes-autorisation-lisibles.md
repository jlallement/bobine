# 203 — Cartes d'autorisation lisibles : fichier et commande

- **Statut** : fait (captures après à comparer à la maquette validée)
- **Dépend de** : 006 (autorisations, diffs), 107 (libellés des outils), 125 (chemins relatifs),
  0.11 M1 (commande entière, `src/shared/command-view.ts`)
- **Agents** : les deux (générique ACP : `kind`, `locations`, `rawInput.cwd` / `workdir`, diff
  `oldText`) — relevé sur OpenCode pendant la recette réelle

## Pourquoi

Recette réelle avec OpenCode : sur la carte « fichier », le chemin absolu était coupé à la fin et
le nom du fichier disparaissait ; un fichier créé s'appelait « Modification de notes.md ». Sur la
carte « commande », le dossier apparaissait deux fois (dans la barre, puis dans un bloc gris : c'est
l'emplacement `locations` qu'OpenCode envoie, égal au dossier), et « Copier » se retrouvait seul
sur sa ligne quand le chemin était long. Maquette validée par l'utilisateur
(`carte-autorisation.png`, 2026-11-07).

## Critères d'acceptation

- [x] En-tête du diff : chemin relatif au dossier de la conversation ; hors du dossier, avec `~` ;
      dossier grisé coupé **par le début**, nom jamais coupé (sauf un nom seul plus large que la
      carte : coupé à la fin) ; chemin entier en infobulle.
- [x] Création (`kind: edit`, chaque diff avec `oldText` nul ou absent, la règle du badge
      « nouveau fichier » de `DiffView`) : « Création de notes.md », icône « fichier + »,
      « Autoriser la création de ce fichier ? ». `oldText: ""` (Bob 2.0.9) : création seulement
      si le fichier était absent quand l'outil a été proposé (constaté par le main, jamais deviné).
- [x] Commande : un emplacement égal au dossier de la commande (normalisé, outil `execute`
      seulement, sans numéro de ligne) n'est plus répété ; un emplacement différent reste.
- [x] Dossier de la commande : « Dans projet » (dossier de la conversation), « Dans
      projet/src/renderer » (sous-dossier), sinon le chemin entier jamais coupé + l'alerte
      existante. Chemin entier en infobulle et pour le lecteur d'écran.
- [x] Barre de la commande en deux colonnes : le dossier et ses mentions à gauche (passent à la
      ligne dans leur colonne), « Copier » toujours en haut à droite.
- [x] Sécurité M1 inchangée : la commande reste entière, exacte, invisibles rendus visibles.
- [x] Testé contre l'agent factice (scénarios `commande-opencode`, `commande-sous-dossier`,
      `commande-hors-dossier`, `creation-fichier`, `creation-sous-dossier`,
      `modification-hors-dossier`, `creation-nom-tres-long` ; e2e `autorisation-commande`).
- [x] Correctif de recette (OpenCode 2.2.5) : `workdir` RELATIF + emplacement absolu → « Dans
      projet/docs », l'emplacement pas répété (avant comme après la décision) ; `workdir` relatif
      qui sort (`../..`) → alerte, chemin entier, emplacement gardé.
- [x] Correctif de recette (Bob 2.0.9) : fichier neuf annoncé avec `oldText: ""` → « Création »,
      à la demande, à la fin et à la réouverture ; fichier vide existant → « Modification ».
- [x] Correctif de recette : sur la ligne d'outil et dans Modifications, le dossier est coupé
      avant le nom ; le nom (extension comprise) ne l'est que s'il ne tient pas seul.

## Sécurité (relecture M1)

- `shortFolder` (`src/shared/command-view.ts`) ne raccourcit que si le test « dans le dossier »
  d'`outsideWorkspace` (même normalisation) dit « dedans » **et** qu'il n'y a aucun doute : chemin
  relatif, `~`, variable (`$`), segment `..` (un lien symbolique pourrait le faire sortir), chemin
  non normalisable, dossier de la conversation `/` → chemin entier. Le nom court passe par
  `visibleText`.
- Limite connue (fiche 006) : les liens symboliques ne sont pas résolus ; `projet/lien` vers
  `/etc` s'affiche « projet/lien ». Le chemin entier reste en infobulle et dans le nom accessible.
- Coupe par le début du chemin d'un fichier : `direction: rtl` sur le dossier, son texte isolé en
  LTR (`<bdi dir="ltr">`) et passé par `visibleText` (dossier, nom et infobulle) : un caractère
  bidi d'un chemin est rendu visible (⟨U+202E⟩) et ne peut pas retourner l'affichage.
- `sameFolder` (emplacement masqué) répond « non » au moindre doute : l'emplacement reste affiché.
- Dossier relatif (`commandFolderOf`, correctif de recette) : OpenCode 2.2.5 envoie `workdir`
  tel que le modèle l'a écrit (`"docs"`, `"../autre"`) et l'emplacement absolu résolu. Résolu
  depuis le dossier de la conversation **pour l'affichage seulement**, et seulement s'il est
  **confirmé** par un emplacement de l'agent (sans numéro de ligne, sans `..`) égal au chemin
  résolu. Sans `..` (ni dans le chemin, ni dans le dossier de la conversation) : forme courte et
  emplacement masqué. Avec `..` : le chemin absolu entier, l'emplacement reste. Pas d'emplacement,
  emplacement différent, `~`, `$` : la valeur brute, l'emplacement reste. L'alerte « hors du
  dossier » : `outsideWorkspace` sur le chemin résolu (`..` compris — `../..` alerte même sans
  emplacement, comme avant) ; et pour un relatif non confirmé, dès qu'un emplacement absolu de
  l'agent est hors du dossier (au moindre doute, on alerte). Les chemins absolus : inchangés.

## Plan

- `src/shared/tool-label.ts` : `createsFile`, `ToolLabel.created`, clé `toolCall.label.create`,
  `kindName.create` ; `filePathParts` (dossier / nom, `~`, `visibleText`).
- `src/shared/command-view.ts` : `shortFolder`, `sameFolder`.
- `ToolCall.tsx` : icône `FilePlus`, question `create`, emplacements filtrés (`ToolDetails`).
- `CommandBlock.tsx` + `styles.css` : barre en grille, dossier court, infobulle, nom accessible.
- `DiffView.tsx` + `styles.css` : en-tête du chemin ; `WorkspaceContext` déplacé dans
  `workspace-context.ts` (import circulaire évité), toujours réexporté par `ToolCall.tsx`.
- Notification d'autorisation (`main/notifications/attention.ts`) : le contenu de l'outil est
  passé au libellé (« Création de … » aussi dans la notification).
- Agent factice : `{cwd}` remplacé aussi dans le chemin d'un diff ; sept scénarios.

## Journal

- 2026-11-08 — Correctif de recette réelle (Bob 2.0.9) : la création de `notes/alpha.txt` se
  lisait « Modification de … ». Contrat réel relevé d'abord (script jetable hors du dépôt, dossier
  sous le dossier temporaire, `bob acp` **sans** `--trust` — Bob 2.0.9 approuve en ACP un dossier
  jamais décidé, vérifié d'abord dans un HOME jetable : aucun `trustedFolders.json` écrit —, un
  seul message, autorisé une fois, ≈ 0,08 bobcoin ; `~/.bob/trustedFolders.json` inchangé) :
  trace `src/main/agent/__traces__/bob-2.0.9/creation-fichier-neuf-autorisee-une-fois.ndjson`.
  Bob envoie un `tool_call` en attente **sans contenu** (« Writing file <absolu> »,
  `rawInput.path` absolu), puis la demande d'autorisation avec le diff **`oldText: ""`** (pas
  `null`) et un chemin absolu, puis la fin avec le même diff : rien, dans les messages, ne
  distingue un fichier neuf d'un fichier vide réécrit. Fait : `src/main/agent/new-files.ts`
  (générique, ADR-0011) — quand un outil `edit` est proposé (`tool_call` en attente ou demande
  d'autorisation, jamais pendant le rejeu de `session/load`), le main regarde une fois chaque
  chemin **absolu** proposé (`lstat`, rien n'est lu ni suivi ; au moindre doute : « existe ») et
  garde le constat avec l'appel (`ToolCallSoFar`) ; ses diffs `oldText: ""` d'un fichier absent
  sont remis à la convention (`oldText: null`) dans la demande comme dans la fin. Le renderer, le
  fil enregistré et la réouverture n'ont rien d'autre à savoir (le fil de Bobine fait foi,
  ADR-0021 : pas de nouveau regard sur le disque, qui dirait « existe »). Deuxième défaut trouvé
  par l'e2e (thème sombre seulement : course) : la demande d'autorisation peut atteindre le fil
  avant le `tool_call` qui la précède ; ce `tool_call` sans contenu vidait la carte (plus de diff,
  « Modification »). Il garde maintenant le contenu et les emplacements de la carte quand il n'en a
  pas (`src/shared/tool-call-kept.ts`, sorti de `transcript.ts` pour sa taille). Essais :
  `trace-replay.test.ts` (trace réelle : création à la demande et à la fin ; même trace avec le
  fichier existant : modification) — échoue avant, passe après ; `new-files.test.ts`
  (absent, existant vide, vrai ancien texte, déjà lancé, autre genre, relatif, rejeu ; `lstat`) ;
  `transcript.test.ts` (demande avant `tool_call`, échoue avant). Agent factice : étape
  `write-file`, scénarios `creation-bob` (copie de la trace) et `modification-fichier-vide-bob` ;
  e2e `autorisation-commande` (carte et ligne, captures `F203-k`, `F203-l`) et `replay-changes`
  (après redémarrage, fichier présent : toujours « Création », `F203-m`). Limite : un agent qui
  n'annonce l'outil qu'une fois lancé (`in_progress`, comme l'étape `edit-file` façon Bob 2.0.6)
  et sans demande d'autorisation garde « Modification » pour `oldText: ""` : rien plutôt qu'un
  constat fait après l'écriture.

- 2026-11-07 — Deuxième recette réelle (app packagée, OpenCode 2.2.5, 1280 px, panneau ouvert) :
  le nom demandait 311 px, en avait 302 ; le « …/ » minimal (14 px) coûtait l'extension alors que
  le nom tenait seul. Corrigé : `FileLabelParts` (mesure : largeur de la ligne, largeurs
  naturelles du texte et du nom, un seul `ResizeObserver` partagé par toutes les lignes) n'affiche
  plus du tout le dossier quand le nom ne tient qu'en effaçant aussi « …/ » ; le nom n'est coupé
  que s'il ne tient pas seul ; avant la mise en page (essais sans rendu), le dossier reste.
  Mentions de la barre d'une commande : le « · » n'est plus dans le texte traduit mais dessiné
  dans l'espace à gauche de la mention (`.cmd-warn::before`) ; passée à la ligne, la mention
  commence la ligne et son « · » tombe hors de la colonne (coupé) : plus de « · » seul en début de
  ligne. e2e : la ligne réglée pour que le nom tienne seul mais pas avec « …/ » (badge
  « autorisation requise » en place), et les « · » des mentions — échouent sur c8699ef4,
  passent après.

- 2026-11-07 — Correctif de recette réelle (OpenCode 2.2.5). Contrat relevé d'abord : sonde
  `pnpm opencode-probe --only commande --traces` (cas « commande dans un sous-dossier », autorisé
  une fois, et « commande hors du dossier (refusée) », `HOME` jetable, `bash: ask`), traces
  `src/main/agent/__traces__/opencode-2.2.5/commande-*.ndjson`, `docs/acp.md`. Cause : notre
  scénario `commande-sous-dossier` envoyait un `workdir` ABSOLU (supposé) ; OpenCode l'envoie
  relatif, `shortFolder` refusait le relatif (valeur brute « docs ») et `sameFolder("docs", …)`
  gardait l'emplacement absolu. Fait : `commandFolderOf` (voir Sécurité), scénarios
  `commande-sous-dossier` (copie de la trace), `commande-dossier-relatif-sortant` (`../..`),
  `commande-sous-dossier-absolu` (l'ancien), jeton `{cwd:<relatif>}` de l'agent factice ; essai
  de rendu nourri par les traces réelles (`AuthorizationCard.trace.test.tsx`). Ligne d'outil :
  libellé d'un outil de fichier en morceaux (`ToolLabel.file` : texte, dossier, nom, texte), le
  dossier coupé en premier par le début et réduit au plus à « …/ » (jamais un « / » seul devant le
  nom, qu'on lirait comme un chemin absolu), le nom coupé à la fin seulement s'il ne tient pas ;
  `label.text` (infobulle, notification) inchangé. Modifications : nom avant dossier (le dossier
  ne prend que la place qui reste), chevron qui ne rétrécit plus. Écarts : un relatif non
  confirmé reste affiché brut (« Dans docs ») plutôt que deviné ; avec `..`, le chemin absolu
  apparaît deux fois (barre et emplacement), par prudence. Le libellé en morceaux est fait
  d'éléments flex : son `innerText` sépare le texte et le nom par un retour à la ligne (même
  chose que l'en-tête du diff) ; `textContent` est inchangé. La réduction à « …/ » coûte au nom
  au plus 1 em dans le cas limite où il tiendrait tout juste sans dossier. Les attentes de la
  sonde ne sont pas mises à jour (`--accept` exige un passage complet, comme pour la fiche 202) :
  la sonde affiche ces nouvelles réponses en « nouveau ».

- 2026-11-07 — Fait. Écart à la maquette : quand le nom, le badge et les compteurs ne tiennent
  pas sur une ligne (carte très étroite, ou nom seul plus large que la carte), le badge et les
  compteurs passent à la ligne, à droite, plutôt que de couper le nom (la maquette les garde sur
  la ligne du nom dans le cas limite). `DiffView` des panneaux Modifications et du plan (`bare`)
  n'a pas d'en-tête : inchangé. Aucune nouvelle dépendance.
