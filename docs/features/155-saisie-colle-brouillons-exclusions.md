# 155 — Zone de saisie : long texte collé, brouillon complet, exclusions de l'agent

- **Statut** : fait
- **Dépend de** : 005 (pièces jointes), 026 (brouillons), 057 (`@git-changes`), 140 (adaptateurs du profil)
- **Agents** : les deux pour le texte collé et le brouillon ; exclusions : Bob (`.bobignore`,
  `.gitignore`, `.env`), rien pour OpenCode (pas de fichier d'exclusion documenté) — ADR-0011

## Pourquoi

Lot B de la série 154-159 (principe du 28/10 : Bobine ne double pas les garde-fous de l'agent,
mais répond de ce qu'elle envoie elle-même).

- Un long texte collé (journal, trace) noie la saisie : il doit devenir une pièce jointe qu'on
  peut regarder ou remettre dans le texte.
- Le brouillon ne garde que le texte : changer de conversation perd les pièces jointes.
- Bob n'ouvre pas les fichiers que son `.bobignore` exclut, mais Bobine, elle, met dans le message
  les fichiers mentionnés avec `@`, joints, déposés, et le diff de `@git-changes` : elle contourne
  la règle que l'utilisateur a posée pour l'agent.

## Critères d'acceptation

- [x] Texte collé au-delà de 40 lignes ou 4 000 caractères (`PASTE_AS_ATTACHMENT`) : puce
      « Texte collé · N lignes » ; un clic l'ouvre en aperçu, d'où on peut le remettre dans la
      saisie ; il part en bloc `text` à part (tout agent ACP l'accepte), et le fil montre la puce.
- [x] Brouillon complet : texte et pièces jointes retrouvés en revenant sur une conversation ;
      après un redémarrage, fichiers, mentions de contexte, textes collés, et images tant que le
      stockage reste sous 2 Mo (`MAX_STORED_DRAFTS_CHARS`) ; stockage plein : on réessaie sans les
      images, puis on garde en mémoire (testé).
- [x] Le profil d'agent déclare ses fichiers d'exclusion (`ignoreFiles`, adaptateur
      `ExclusionSource`, ADR-0015) ; Bob et l'agent factice : `.bobignore` et `.gitignore` dans
      chaque dossier, de la racine au fichier, et `.env` (Bob 2.0.6, ordre non vérifié en réel) ; OpenCode : rien.
- [x] Mentions `@` : les fichiers exclus ne sont pas proposés.
- [x] `@git-changes` saute les fichiers exclus (état et diff) et le dit dans le bloc envoyé.
- [x] Pièce jointe exclue (choisie, déposée, collée) : confirmation « Joindre quand même » ou
      « Ne pas joindre ».
- [x] « Propre à <agent> » (Réglages › Agents) : ligne `ignore-files` ; matrice de
      `docs/agents.md` ; « Compatibilité Bob » de `docs/acp.md`.
- [ ] Testé contre l'agent factice : suites e2e `mentions` (exclusions, `@git-changes`),
      `attachments` (texte collé, confirmation) et `history` (brouillon d'une conversation à
      l'autre) — écrites, à lancer à la fusion.

## Plan

**Texte collé**
- `shared/attachments.ts` : genre `text` (`{ kind: 'text'; name; text }`), seuils
  `PASTE_AS_ATTACHMENT` (40 lignes, 4 000 caractères), borne `MAX_PASTED_TEXT_CHARS` (1 M),
  validé par `parseAttachments` ; `AttachmentView` `text` (avec le texte, pour l'aperçu du fil).
- `main/agent/prompt-content.ts` : bloc `text` « Texte collé (N lignes) : … » (pas de `resource` :
  pas d'URI à inventer, et tout agent accepte le texte).
- Renderer : `useAttachments.addText` et `paste` (texte long → puce), puce et aperçu
  (`PastedTextDialog`, Radix Dialog comme les autres), puce dans le fil (`Transcript`).

**Brouillon complet**
- `renderer/src/drafts.ts` : `Draft = { text; attachments: PromptAttachment[] }` ; ancien format
  (texte seul) relu. Mémoire : tout. Disque : sans images si le tout dépasse
  `MAX_STORED_DRAFTS_CHARS`, sans images si `setItem` échoue, puis rien (mémoire seule).
- `useAttachments(…, { initial })` et `useComposerDraft` (sorti de `Composer`, qui touchait la
  limite de 300 lignes) : pièces jointes du brouillon au montage, brouillon réécrit à chaque
  changement (texte ou pièces jointes).

**Exclusions de l'agent**
- `main/agent/adapters.ts` : `ExclusionSource { summary(); files; always? }`.
- `main/agent-config/exclusions.ts` (générique) : lit les fichiers déclarés dans chaque dossier, de
  la racine du dossier de travail au fichier (comme Bob), cache court ; `isExcluded(path)`.
- `main/agent-config/bob-exclusions.ts` : `BOB_EXCLUSIONS` ; profils `bob` et `mock`.
- `capabilities.ts` : ligne `ignore-files` ; `docs/agents.md`.
- IPC `workspace:excludedPaths` (renderer → main : quels chemins sont exclus, et par quels
  fichiers) ; `workspace:searchFiles` filtre ; `@git-changes` (`changes/git-context.ts`) reçoit le
  prédicat, exclut par pathspec `:(exclude,top,literal)…` et le dit.
- Renderer : `addPath` vérifie, confirmation (`ExcludedConfirm`, sous la zone de saisie).

**Nouvelle dépendance** : `ignore` (7.0.13, MIT, sans dépendance), en `devDependencies` (empaquetée
dans le main par electron-vite, comme le SDK ACP). Raison : `.bobignore` / `.gitignore` suivent la
syntaxe de gitignore, que cette bibliothèque reproduit — même syntaxe, mêmes cas limites (négation,
`**`, dossiers) ; elle était déjà dans le dépôt, tirée par ESLint. Écrire un analyseur gitignore
maison aurait donné des écarts avec Bob.

**Essais** : unitaires (seuils, `parseAttachments`, `buildPrompt`, brouillons et stockage plein,
exclusions, `gitChangesText`, `specificItems`) ; e2e `mentions` et `attachments` adaptés.

## Journal

- 2026-10-28 — Fiche et plan (lot B). Ce qu'on suppose de Bob 2.0.6 (non vérifié en réel) : pour
  un fichier du dossier de travail, Bob lit `.gitignore` (si `respectGitIgnore`, vrai par défaut) puis
  `.bobignore` dans chaque dossier, de la racine au dossier du fichier, avec la bibliothèque
  `ignore`, plus `.env` toujours ; lecture et écriture refusées (« Access denied … matches an ignore
  pattern »). Rien de connu sur le texte du message : Bob ne le filtre pas, à notre connaissance.
- 2026-10-28 — Implémenté (branche `claude/lot-b-saisie-41fd35`, sans push).
  - Texte collé : genre `text` de pièce jointe (`shared/attachments.ts`), bloc `text`
    « Texte collé (N lignes) : … » (`prompt-content.ts`), puce et aperçu (`PastedText.tsx`) dans
    la zone de saisie et dans le fil ; repris d'un message (branche) et de la file d'attente.
  - Brouillon : `drafts.ts` (format `{ text, attachments }`, ancien format relu), `useComposerDraft`.
  - Exclusions : `ExclusionSource` (adaptateurs), `exclusions.ts`, `bob-exclusions.ts` (profils
    `bob` et `mock`), ligne `ignore-files` de « Propre à <agent> », IPC `workspace:excludedPaths`,
    filtre de `searchWorkspaceFiles`, `@git-changes` qui saute et le dit, `ExcludedConfirm`.
  - Essais : unitaires (`attachments`, `prompt-content`, `drafts` dont stockage plein,
    `exclusions`, `git-context`, `workspace-files`, `ipc`, `capabilities`, `Composer`) ; e2e
    adaptés, **non lancés** (le tech lead les lance à la fusion) : `attachments` (fichier exclu,
    texte collé, aperçu, captures `19c-fichier-exclu`, `19d-texte-colle`), `mentions` (`@` sans le
    fichier exclu, `@git-changes` qui le saute), `history` (brouillon avec sa puce de texte collé).
  - Écarts : la puce part en bloc `text` et non en `resource` (pas d'URI à inventer, et un agent
    sans `embeddedContext` le reçoit aussi) ; Bob n'a pas de fichier d'exclusion seulement : sa
    déclaration suit son code (`.gitignore`, `.bobignore`, `.env`), sans lire son réglage
    `respectGitIgnore` ; la fenêtre rapide (fiche 027) ne transforme pas le texte collé ; le
    glisser d'un fichier exclu dans la fenêtre rapide n'est pas vérifié ; le texte d'un message
    rejoué par l'agent (`session/load`) remet le texte collé dans le message, comme `@git-changes`.
  - Reste à faire : essai avec Bob réel (mentionner à la main `@secret` d'un `.bobignore` et voir
    si Bob refuse de l'ouvrir ; le texte du message n'est pas filtré par Bob à notre connaissance).
- 2026-10-28 — Retours de relecture (tech lead).
  - Vérification des exclusions avant de joindre (`excludedAmong`) : par lots de 100 (le main en
    refuse davantage) ; un lot en échec (IPC refusée, dossier absent) est retenu en entier et la
    confirmation dit « Impossible de vérifier… » au lieu de tout laisser passer. Les images collées
    ou déposées qui ont un chemin passent aussi par la vérification ; confirmée, une image exclue
    est jointe par son chemin (le main la lit).
  - Export Markdown : le contenu d'un texte collé suit le message, dans un bloc de code dont la
    clôture est plus longue que tout accent grave du texte.
  - « Texte collé (1 ligne) » au singulier.
  - Cache des règles borné à 200 dossiers (`MAX_CACHED_DIRS`), le plus ancien oublié.
  - Ordre des règles : **écart volontaire avec git**, documenté ici et dans `docs/acp.md`. Git fait
    gagner le fichier le plus profond (`sub/.bobignore` avec `!keep.log` ré-inclut `sub/keep.log`
    exclu par `*.log` à la racine) ; Bob 2.0.6 parcourrait les dossiers de
    la racine vers le bas et exclurait dès qu'un dossier exclut (non vérifié en réel). Bobine suit l'agent, pas git : elle
    doit écarter ce que l'agent écarte. Un test fixe ce comportement.
- 29/10, intégration (tech lead) : e2e `attachments` corrigé (un collage synthétique n'insère jamais
  le texte : on vérifie que l'app le laisse au navigateur) ; copie d'un message fait seulement de texte
  collé (`copiedText`, fiche 156). Suite e2e complète verte (clair et sombre).
