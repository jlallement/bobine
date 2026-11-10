# 177 — Faire relire avant de fusionner

- **Statut** : fait
- **Dépend de** : 085 (remarques sur le diff), 097 (conversations filles, ADR-0019), 160 (agent et
  modèle d'une fille, jamais choisis en silence ; ADR-0036), 029 (outils de l'app)
- **Agents** : tous. La relecture est une conversation fille ordinaire ; ses remarques reviennent
  par un outil du serveur MCP `bobine` (`report_findings`), comme `start_child` ou `ask_user` ;
  aucun nom d'agent hors des profils (ADR-0011, ADR-0028).

## Pourquoi

Avant de fusionner le travail d'une fille, ou de garder ce que la conversation vient de modifier,
on veut un **deuxième regard**, comme `/code-review` de Claude Code ou Bugbot de Cursor : un autre
agent (ou le même, à neuf) relit le diff, cherche d'abord les erreurs puis ce qui se simplifie, et
ses remarques arrivent **sur les lignes du diff**, prêtes à être renvoyées à l'auteur. Choix de
l'utilisateur pour la 0.9 (audit des concurrents, 06/11).

## Décisions

1. **Un relecteur = une conversation fille**, lancée par l'utilisateur (« Faire relire… »), visible
   sous la mère comme les autres filles, ouvrable, arrêtable, avec son coût sur sa ligne. Une fille
   ne peut pas avoir de fille (ADR-0019) : le relecteur d'une fille est donc sa **sœur** (fille de
   la même mère) ; celui d'une conversation ordinaire en est la fille. Il compte dans le plafond
   des filles (ADR-0020).
2. **Même dossier, en lecture seule annoncée et vérifiée** (plutôt qu'un worktree à part) :
   - un nouveau worktree partirait du dernier commit et ne verrait **pas** les modifications non
     commitées — c'est justement ce qu'on relit le plus souvent (la conversation en cours, une fille
     qui n'a pas encore commité) ; et créer un worktree sur la branche d'une autre (déjà extraite)
     demanderait de toucher `worktrees.ts` (fiche 175) ;
   - le relecteur travaille donc dans le dossier de l'auteur, **sans** enregistrement de worktree
     (le supprimer ne supprime rien d'autre ; pas de branche à fusionner) ; sa consigne lui
     interdit de modifier quoi que ce soit ;
   - **vérification** : l'app relève une empreinte du dossier au départ (`HEAD`, `git status`,
     `git diff HEAD`) et la compare à chaque fin de tour du relecteur. Si elle a changé, un avis
     le dit dans le fil du relecteur et sur la carte de relecture de l'auteur (« le dossier a
     changé pendant la relecture »), sans rien défaire : la cause peut être l'auteur lui-même ou
     l'utilisateur. On ne lance pas de relecture pendant que l'auteur répond.
   - Bloquer les écritures par ACP (refuser les demandes d'autorisation d'écriture) dépendrait
     de chaque agent (OpenCode écrit sans demander selon ses réglages) et toucherait le client ACP
     (fiche 181) : écarté.
3. **Remarques structurées par un outil de l'app**, `report_findings` du serveur `bobine`, proposé
   aux seules conversations de relecture (rôle `reviewer`) ; jamais d'analyse du texte libre. Chaque
   remarque : `file`, `line` (et `endLine`), `severity` (`high`, `medium`, `low`), `category`
   (`correctness`, `simplification`), `title`, `why`. L'app vérifie (chemin dans le dossier,
   lignes entières), lit le code cité dans le fichier et pose le tout dans le fil de **l'auteur**
   (élément `review`, une carte par relecture, mise à jour à chaque étape). L'outil peut être appelé
   plusieurs fois ; `findings: []` dit « rien à signaler ».
4. **Retour sur le diff** : à l'ouverture de l'onglet « Modifications » de l'auteur, chaque remarque
   devient une **remarque de diff** (fiche 085) — vue Git, sur ses lignes —, une seule fois. Elle est
   alors modifiable, supprimable, et part avec « Envoyer à l'agent » comme les autres : l'auteur
   garde son contexte et corrige. Une liste « Relecture » au-dessus des fichiers montre aussi les
   remarques dont le fichier n'est pas dans la vue (modifications déjà commitées d'une branche).
5. **Agent et modèle** : ceux de l'auteur **suggérés** dans le dialogue, que l'utilisateur confirme
   ou change ; rien ne part sans « Lancer la relecture » (règle de la fiche 160 ; le modèle n'est
   proposé que si le profil le permet, `childModelChoice`).
6. **Coût** : le dialogue dit que la relecture est une conversation de plus, qui coûte comme
   telle ; la carte de relecture de l'auteur affiche son coût (résumé de consommation du relecteur,
   fiche 109), comme la ligne de la fille dans la barre latérale.
7. **Ce qui est relu** :
   - auteur dans un worktree (fille, fiche 036) : tout depuis le point de départ de sa branche
     (`git merge-base HEAD <branche de base>`, sinon le commit de départ), commits **et**
     modifications non commitées ;
   - sinon : les modifications non commitées (`git diff HEAD` et fichiers nouveaux).
   L'app calcule ce point et la liste des fichiers (bornée) et les met dans la consigne. Rien à
   relire : refus clair.
8. **Sans git** : « Faire relire » n'est pas proposé (ni diff de référence, ni fille possible) ;
   l'appel IPC le refuse avec un message clair.

## Critères d'acceptation

- [x] « Faire relire… » dans l'onglet « Modifications » d'une conversation dans un dépôt git (pas
      d'un relecteur), et sur chaque ligne de la vue « Filles » ; dialogue : points à surveiller
      (facultatif), agent et modèle de l'auteur présélectionnés « à confirmer », note de coût.
- [x] Le relecteur part dans le dossier de l'auteur, sous la bonne mère, avec une consigne fixe
      (correction d'abord, puis simplification ; ne rien modifier ; `report_findings`) qui cite le
      point de comparaison et les fichiers.
- [x] `report_findings` n'est offert qu'au relecteur ; il valide ses arguments (erreur claire à
      l'agent), lit le code cité, et la carte « Relecture » de l'auteur passe à « N remarques ».
- [x] Les remarques deviennent des remarques de diff de l'auteur (une seule fois), visibles sur
      leurs lignes en vue Git et dans la liste « Relecture », envoyables par « Envoyer à l'agent ».
- [x] Empreinte du dossier : un relecteur qui modifie un fichier est signalé (fil du relecteur,
      carte de l'auteur) ; une fin de tour sans `report_findings` est dite sur la carte.
- [x] Pas de compte rendu de fille ni de réveil de la mère pour un relecteur ; pas de ligne de
      fusion (pas de worktree, pas d'élément `child-started`).
- [x] Sans git : action absente ; IPC refusé.
- [x] Textes fr et en ; consigne et description de l'outil en anglais (ADR-0014).
- [x] Testé contre l'agent factice : scénarios `relecture` (remarques par l'outil),
      `relecture-vide` (aucune remarque), `relecture-modifie` (le relecteur écrit : signalé) ;
      unitaires ; suite e2e `relecture` (clair et sombre).

## Plan

Pas de nouvelle dépendance, pas d'ADR (le mécanisme des filles et des outils de l'app est repris
tel quel ; la seule décision nouvelle, « même dossier en lecture seule vérifiée », est dite ici).

### Fichiers

- `src/shared/review.ts` (nouveau, + test) : `ReviewFinding`, `Review` (élément du fil), consigne
  `reviewBrief`, `parseFindings` (validation des arguments de l'outil), `reviewNotes` (remarques
  de diff tirées d'une relecture).
- `src/shared/agent.ts` : `ConversationSummary.reviewOf`, évènement `review`.
- `src/shared/transcript.ts` : élément `review`, remplacé par `reviewId` (comme `children-merge`).
- `src/shared/export.ts` : ligne d'export.
- `src/shared/diff-notes.ts` : bloc de code omis s'il est vide ; `DiffNote.review` (gravité).
- `src/main/conversations/store.ts`, `helpers.ts` (`summaryOf`) : `reviewOf` persisté.
- `src/main/conversations/manager.ts` : `createChild` accepte un dossier existant (pas de worktree)
  et le lien `reviewOf`.
- `src/main/conversations/children-review.ts` (nouveau, + test) : `ChildReviews` — `start`
  (validation, point de comparaison, fichiers, empreinte, consigne), `report` (outil), `onEvent`
  (fin de tour : empreinte, carte « sans remarque »).
- `src/main/conversations/children.ts` : rôle `reviewer`, pas de compte rendu pour un relecteur,
  canal IPC `conversation:startReview`.
- `src/main/mcp/review-tools.ts` (nouveau, + test) : module `review`, outil `report_findings` ;
  `children-tools.ts` : rien pour le rôle `reviewer`.
- `src/main/index.ts`, `src/main/ipc.ts`, `src/shared/ipc.ts`, `src/preload/api.ts` : branchements.
- Renderer : `components/sidebar/ReviewDialog.tsx` (nouveau), `panel/ChangesBars.tsx` (bouton),
  `panel/ChildrenView.tsx` (bouton par fille), `panel/ChangesTab.tsx` (import, liste
  « Relecture »), `panel/ReviewNotes.tsx` (nouveau), `thread/ReviewCard.tsx` (nouveau),
  `thread/Transcript.tsx`, `diff-notes-store.ts` (remarques déjà importées), `styles.css`,
  `fr.json`, `en.json`.
- Agent factice : `src/mock-agent/scenarios-relecture.mts` (nouveau) et reconnaissance de la
  consigne de relecture dans `pickScenario`.
- e2e : `e2e/suites/relecture.mjs` (nouveau), inscrit au catalogue.
- Docs : `docs/architecture.md`, `docs/agents.md` (ligne « relecture » : générique), `docs/acp.md`
  (rien de Bob : un outil de plus sur `bobine`), `docs/mock-agent.md`, CHANGELOG fr et en, index.

### Étapes

1. Partagé (types, consigne, validation, élément du fil) ; tests.
2. Main : enregistrement, `createChild` en place, `ChildReviews`, outil, IPC ; tests.
3. Renderer : dialogue, boutons, carte, import des remarques ; tests.
4. Agent factice, suite e2e, captures avant/après.
5. Docs, `./scripts/verify`, `pnpm build && pnpm e2e --changed`, commits.

## Journal

- 2026-11-06 : fiche, décisions et plan.
- 2026-11-06 : implémenté selon le plan, avec ces écarts :
  - **Pas de module d'outils à part** : `report_findings` est offert par le module des filles
    (`children-tools.ts`, rôle `reviewer`), et `ChildReviews` est tenu par `ChildConversations`
    (`reviews`). Raison : `index.ts` était déjà à son plafond de lignes (850) ; la relecture n'y
    ajoute rien. Dans Réglages › Serveurs MCP, l'outil apparaît dans la famille « Conversations
    filles ».
  - `manager.ts` (plafond 1 050) : `sharesWorktree` passe dans `helpers.ts` pour faire la place de
    `createChild(…, { of })`. `transcript.ts` (plafond 800) : `upsert` commun à `children-merge` et
    `review`.
  - Le bouton de l'onglet Modifications est une **icône** (infobulle « Faire relire : … ») : avec la
    vue « Filles », un libellé faisait passer la barre sur deux lignes (vu sur la première capture).
  - Le relecteur est une fille : il compte dans la vue « Filles » et dans le plafond. Il n'a ni
    branche ni élément `child-started`, donc pas de ligne de fusion. Sa ligne garde le bouton
    « Ouvrir », pas « Faire relire » (une relecture ne se fait pas relire).
  - Coût : porté par la carte (`Review.usage`, résumé du fil du relecteur, mis à jour à chaque
    rapport et à chaque fin de tour).
  - Après un redémarrage pendant une relecture, l'empreinte de départ est perdue (en mémoire) :
    plus de vérification « dossier changé » pour ce relecteur ; `report_findings` marche toujours
    (lien `reviewOf` persisté).
  - L'agent factice en anglais (`--lang en`) garde les remarques en français : les arguments d'un
    outil ne passent pas par son dictionnaire.
  - Tests : `shared/review.test.ts`, `mcp/review-tools.test.ts`, intégration
    `conversations/children-review.test.ts` (vrai dépôt git, agent factice, serveur MCP : non
    commité, sœur sur une branche, relecteur qui écrit, relecteur muet, refus) ; e2e `relecture`.
  - Compatibilité Bob (`docs/acp.md`) : rien de nouveau côté protocole. **Pas essayé avec un vrai
    agent** : à vérifier avec Bob et OpenCode qu'ils appellent bien `report_findings` (sinon la
    carte le dit : « sans remarques structurées »).
- 2026-11-06 : `./scripts/verify` vert (2 385 essais). `pnpm build && pnpm e2e --changed` : 147
  tâches (toutes les suites : fichiers communs touchés), 144 vertes ; `session` (clair, sombre) et
  `long-thread` (sombre) en délai dépassé sous la charge (une douzaine de sessions en parallèle sur
  la machine), puis **vertes relancées seules** (`pnpm e2e session long-thread --jobs 1`).
  Suite `relecture` verte en clair et en sombre, captures regardées. Captures avant/après (hors du dépôt) : dossier de notes partagé des sessions,
  `side-session-notes/local_dc542b87-7cc9-475b-98d0-f24ecc36f3cc/177-captures/` :
  `avant-modifications-*`, `avant-vue-filles-*` (onglet sans relecture), `apres-1-faire-relire-*`
  à `apres-5-relecteur-*`.
- 2026-11-06 : relecture du tech lead, corrections.
  - Captures retirées du dépôt (et de l'historique de la branche) : elles sont dans le dossier de
    notes partagé, cité plus haut.
  - **Une seule échelle de gravité**, « haute / moyenne / basse » (« high / medium / low ») :
    carte (« 1 haute » au lieu de « 1 grave »), liste, remarque sur le diff (pastille ajoutée),
    export, message à l'agent ; ligne au glossaire de `docs/traduction.md`. Au passage : modifier
    une remarque de relecture sur le diff lui gardait son texte mais perdait sa gravité (et la
    sortait de la liste) ; elle la garde.
  - Relecteur qui n'appelle pas `report_findings` (carte « sans remarques structurées », ou
    échec) : sa réponse du tour est gardée sur la carte (`Review.reply`, 4 000 caractères au
    plus, rendue comme un compte rendu de fille), pour qu'une relecture en texte libre ne soit pas
    perdue. Testé (`relecture-muette`).
