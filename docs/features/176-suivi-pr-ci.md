# 176 — Suivi de la PR et de la CI

- **Statut** : fait
- **Dépend de** : 110 (cycle des worktrees : « Ouvrir une PR » par `gh`), 166 (onglet Session),
  080 (journal), ADR-0014 (ce qui va à l'agent n'est pas traduit)
- **Agents** : les deux. Tout passe par `gh` en ligne de commande dans le main process et par un
  message ordinaire à l'agent ; aucun code propre à un agent (ADR-0011).

## Pourquoi

Après « Ouvrir une PR » (fiche 110), Bobine ne dit plus rien de la PR : il faut aller sur GitHub
pour savoir si la CI passe, s'il y a des commentaires, si la PR est en conflit. Claude Desktop suit
la PR dans la conversation et propose de faire corriger les contrôles en échec par l'agent. Bobine
fait de même, sans jamais rien envoyer ni fusionner sans le choix explicite de l'utilisateur.

## Critères d'acceptation

- [x] **Carte « Pull request »** dans la barre du worktree (vue « Git » de l'onglet Modifications)
      dès qu'une PR existe pour la branche (ouverte par la barre, par l'agent ou à la main) :
      numéro et titre (lien), état (ouverte, brouillon, fusionnée, fermée), contrôles de la CI
      (en cours / réussis / en échec, avec le nom et le lien de chacun, ceux en échec d'abord),
      nombre de commentaires et de relectures, avis de relecture, fusionnable ou en conflit.
- [x] **Onglet Session** (fiche 166) : une ligne « Pull request » (numéro, état des contrôles)
      qui ouvre la vue « Git ».
- [x] **« Corriger les contrôles en échec »** : un clic envoie à l'agent un message (anglais,
      ADR-0014) avec chaque contrôle en échec, son lien et un extrait de son journal
      (`gh run view --job <id> --log-failed`, borné), et la consigne de corriger puis pousser.
      Rien ne part de soi-même, sauf si l'utilisateur coche « Corriger d'office » sur la carte :
      alors une fois par commit en tête de la PR, au plus 3 fois par conversation.
- [x] **« Fusionner quand tout est vert »** : case décochée par défaut ; cochée, l'app lance
      `gh pr merge --merge` quand la PR est ouverte, pas brouillon, fusionnable, tous les contrôles
      réussis et aucune relecture ne demande de changement. Le résultat est dit sur la carte.
- [x] **Cadence** : relève toutes les 30 s tant qu'un contrôle tourne, puis espacée (1, 2, 4, 8,
      jusqu'à 10 min) quand rien ne change ; remise à 30 s dès que quelque chose change ; arrêt
      quand la PR est fusionnée ou fermée ; app en arrière-plan (aucune fenêtre au premier plan) :
      au plus toutes les 10 min, et plus rien après 30 min, repris au retour au premier plan.
      « Actualiser » sur la carte relit tout de suite.
- [x] **Sans `gh`** (absent, non connecté, pas de dépôt distant) : aucune carte, aucun appel ; la
      phrase existante de la fiche 110 dit ce qui manque. Une erreur de `gh` est dite sur la carte
      sans rien casser, et la relève s'espace.
- [x] Une PR fusionnée sur GitHub propose « Nettoyer » (fiche 110), même si la base locale n'a pas
      encore le commit de fusion.
- [x] Chaque appel à `gh` dans `agents.log` (fiche 080). Jamais de vrai GitHub dans les essais.
- [x] Tests unitaires avec un `gh` simulé : lecture de l'état (contrôles des deux formes,
      commentaires, conflits), absence de PR, cadence et arrêt, correction (message, extrait,
      une fois par commit), fusion d'office (conditions).
- [x] Testé contre l'agent factice avec un faux `gh` (`BOBINE_GH`) : suite e2e `pr-ci` (clair,
      sombre), captures regardées.

## Plan

### Choix

- **Lecture** : une seule commande par relève, `gh pr view <branche> --json number,url,title,
  state,isDraft,headRefOid,mergeable,reviewDecision,statusCheckRollup,comments,reviews,
  autoMergeRequest` — un seul appel GraphQL à GitHub (limite : 5 000 points/h ; à 30 s, une PR
  coûte 120 appels/h au pire, quelques-uns par heure une fois la CI finie). Les journaux des
  contrôles en échec ne sont lus que pour « Corriger » (`gh run view --job`, un appel par
  contrôle, au plus 5).
- **Commentaires** : `comments` (fil de la PR) + relectures (`reviews`) avec un texte ou un avis ;
  les commentaires sur les lignes ne sont pas comptés un par un (`gh pr view` ne les donne pas).
- **Contrôles** : `CheckRun` (`status`, `conclusion`) et `StatusContext` (`state`) ramenés à
  `pending | passed | failed | skipped` ; résumé `failed` s'il y en a un en échec, sinon `pending`
  s'il en reste un qui tourne, sinon `passed`, `none` sans contrôle.
- **Où** : la relève vit dans le main (`PrWatcher`, un minuteur par conversation suivie) et pousse
  l'état par l'évènement `pr:changed` ; le renderer le lit par `pr:status` (qui commence le suivi)
  et l'affiche dans la barre du worktree et l'onglet Session. Pastille dans la barre latérale :
  hors périmètre (plus tard).
- **Choix de l'utilisateur** (« Corriger d'office », « Fusionner quand tout est vert ») : gardés
  en mémoire par conversation dans le main, pas sur le disque ; perdus au redémarrage de l'app
  (rien ne part de soi-même après un redémarrage : le prudent).
- **Fusion** : `gh pr merge <numéro> --merge` (commit de fusion, comme ADR-0022 : pas de squash)
  lancée par l'app, pas l'« auto-merge » de GitHub (qui demande un réglage du dépôt) : elle n'a
  lieu que si l'app tourne.

### Fichiers

- `src/shared/pr-tracking.ts` (nouveau) : types (`PrTrack`, `PrView`, `PrCheck`), `parsePrView`
  (JSON de `gh`), `checksSummary`, `readyToMerge`, `fixChecksPrompt` (anglais), `logExcerpt`,
  `nextDelay` (cadence). Tests.
- `src/main/changes/pr-watch.ts` (nouveau) : `PrWatcher` (`Run`, `gh`, horloge et minuteurs
  injectés) : `status`, `refresh`, `setOptions`, `fixChecks`, cadence, arrêt, arrière-plan,
  correction et fusion d'office. Tests avec un `gh` simulé et une horloge simulée.
- `src/main/changes/worktree-cycle.ts` : `ghStatus` partagé (le watcher le réutilise),
  `info().prMerged` pour « Nettoyer ».
- `src/main/changes/worktree-ipc.ts` : canaux `pr:status`, `pr:refresh`, `pr:options`,
  `pr:fixChecks` ; `BOBINE_GH` (faux `gh` des essais) ; suivi lancé après `pullRequest`.
- `src/shared/ipc.ts`, `src/preload/api.ts`, `src/main/index.ts` : canaux, évènement, focus des
  fenêtres.
- `src/renderer/src/usePrTrack.ts`, `panel/PrCard.tsx` (nouveaux), `panel/WorktreeBar.tsx`,
  `panel/SessionTab.tsx` (ligne), CSS.
- `fr.json` / `en.json`, `e2e/suites/pr-ci.mjs` + `e2e/fake-gh.mjs` (nouveaux), `e2e/catalog.mjs`,
  `docs/architecture.md`, `CHANGELOG*.md`.

### Hors périmètre

- Pastille d'état de la PR dans la barre latérale ; notification système quand la CI finit.
- Répondre aux commentaires depuis l'app ; les envoyer à l'agent (la fiche 177 traite la relecture).
- GitLab (`glab`), GitHub sans `gh`.

## Journal

- 2026-11-06 — Fiche créée, plan ci-dessus.
- 2026-11-06 — **Fait**, selon le plan, sur la branche du worktree (pas de fusion dans `main`).
  - **Main** : `changes/pr-watch.ts` (`PrWatcher`), `changes/pr-watch-focus.ts` (premier plan des
    fenêtres, chargé par `import()` pour que les essais de `worktree-ipc.ts` n'importent pas
    Electron), `WorktreeCycle.ghFor`, canaux `pr:*` et évènement `pr:changed` ; `index.ts` est à
    son plafond (850 lignes) : `worktreeCycleDeps` reçoit `send` en une ligne. Le suivi part après
    « Ouvrir une PR » et à chaque lecture de l'état du worktree (`pr:status`) ; « Nettoyer » oublie
    la conversation.
  - **Renderer** : `usePrTrack`, `panel/PrCard.tsx` (+ `pr-card.css`) sous les boutons de la barre
    du worktree, ligne « Pull request » de l'onglet Session ; « Nettoyer » proposé aussi quand la PR
    est fusionnée sur GitHub.
  - **Essais** : `shared/pr-tracking.test.ts` (contrôles des deux formes, relance, commentaires,
    fusion possible, extrait, consigne, cadence), `changes/pr-watch.test.ts` (faux `gh`, horloge
    simulée : rien sans `gh`, pas de PR, cadence et arrêt, arrière-plan et veille, erreur, correction
    sur clic et d'office, fusion d'office et refus), `worktree-ipc.test.ts`, `worktree-cycle.test.ts`
    (`ghFor`). Suite e2e `pr-ci` avec `e2e/fake-gh.mjs` (clair, sombre) ; captures `176-pr-avant`,
    `176-pr-en-cours`, `176-pr-echec`, `176-pr-session`, `176-pr-fusionnee` regardées.
  - **Écarts et limites** :
    - Écrit sans GitHub (`gh` simulé) ; confronté ensuite aux vraies sorties de `gh`, voir
      l'entrée suivante.
    - Commentaires : fil de la PR et relectures ; les commentaires sur les lignes d'une relecture ne
      sont pas comptés un par un.
    - Les deux cases d'office sont gardées en mémoire du main, pas sur le disque : perdues au
      redémarrage (rien ne part de soi-même après un redémarrage).
    - Le message à l'agent part par `ConversationManager.prompt` sans attendre la fin du tour ; une
      erreur d'envoi va dans `agents.log`, pas sur la carte.
- 2026-11-06 — **Relecture du tech lead**, quatre remarques traitées :
  1. **Vraies sorties de `gh`** (2.103.3, lecture seule, PR publiques de `cli/cli` et
     `kubernetes/kubernetes`) : `gh pr view <n> --json <PR_VIEW_FIELDS>` sur une PR en brouillon
     avec un contrôle en échec, une verte approuvée, une fusionnée, une avec changements demandés,
     une à `StatusContext` ; `gh pr view <branche>` sans PR (« no pull requests found for branch »,
     code 1) ; `gh run view --job <id> --log-failed` ; `gh repo view --json mergeCommitAllowed,
     squashMergeAllowed,rebaseMergeAllowed`. Chaque champ lu existe avec la forme attendue
     (`CheckRun` : `name`, `workflowName`, `status`, `conclusion`, `detailsUrl` en
     `…/actions/runs/<run>/job/<job>` ; `StatusContext` : `context`, `state`, `targetUrl` ;
     `reviews[].state/body`, `comments[]`, `mergeable` `UNKNOWN` une fois fusionnée). Sorties
     réduites et anonymisées dans `src/main/changes/fixtures/gh/`, lues par `pr-tracking-real.test.ts`.
     **Écart trouvé** : dans un vrai journal, la fin est le nettoyage du job (identifiants git,
     processus orphelins) et l'échec est ~80 lignes avant ; l'extrait prend maintenant les lignes
     d'échec (`##[error]`, `FAIL`, `Error:`, `panic:`…) avec leur contexte, et les dernières
     lignes seulement s'il n'en trouve pas.
  2. **Méthode de fusion** : lue une fois par `gh repo view` quand « Fusionner quand tout est
     vert » est coché, puis commit de fusion, sinon squash, sinon rebase (vu : `rust-lang/rust`
     n'a que le commit de fusion, `facebook/react` que le squash) ; dite sur la case et dans la
     note de fusion ; aucune permise : la carte le dit, rien ne part.
  3. **Vue Git** : sous la carte, la note « PR ouverte : <lien> » n'est plus répétée ; PR ouverte :
     « Ouvrir une PR » devient « Pousser vers la PR » (même action, sans formulaire), caché quand
     rien n'est à pousser (`WorktreeCycleView.unpushed`, `git rev-list <branche>@{u}..<branche>`) ;
     PR fusionnée : caché.
  4. Un envoi raté de « Corriger les contrôles en échec » est dit sur la carte (`fix-failed`).
  Le faux `gh` des essais applique `--jq .url` comme le vrai et refuse une deuxième PR ouverte
  pour la même branche. Capture ajoutée : `176-pr-pousser`.
- 2026-11-06 — `main` fusionné dans la branche (fiches 175, 179, 180, 181) : conflits de
  CHANGELOG, index, architecture et traductions gardés des deux côtés. `src/main/ipc.ts`
  dépassait déjà son plafond sur `main` (803 lignes sur 800) : les canaux du simulateur iOS et de
  l'émulateur Android en sortent dans `main/device-ipc.ts` (`deviceHandlers`, avec leurs types de
  contrôleur, réexportés par `ipc.ts`), sans changer de comportement.
- 2026-11-06 — **0.9.1, défauts de la recette 0.9** (fiche 183, D7 et D15 à D20, rejoués par la
  recette sur un vrai dépôt GitHub privé). Branche `claude/176-qa-0-9-1`.
  - **D15** (commit fait hors de « Committer », par l'agent ou dans un terminal : barre figée,
    pas de « Pousser vers la PR ») : le main relisait bien git, mais le renderer ne relisait la
    barre qu'à la fin d'un outil. « Actualiser » de l'onglet ne relisait que la liste des
    fichiers, et celui de la carte que la PR. `useWorktreeCycle` relit maintenant aussi à chaque
    fin de tour de l'agent (`turn-end`, `turn-error`) et quand la fenêtre reprend la main ; les
    deux « Actualiser » relisent la barre. Essais : crochet (`useWorktreeCycle.test.ts`),
    `worktree-cycle.test.ts` (commit fait par `git` à côté), e2e (commit dans le worktree, puis
    « Actualiser »).
  - **D7** : `gh` absent ou non connecté n'est plus gardé 5 min mais 15 s, et « Actualiser »
    (onglet : `worktree:info` avec `fresh`, carte : `pr:refresh`) l'oublie tout de suite.
  - **D16** : après un push (« Ouvrir une PR », « Pousser vers la PR ») ou un nouveau commit en
    tête, relève toutes les 10 s pendant 2 min, par PR, jamais fenêtre cachée (10 min au plus).
    Une PR sans contrôle dit « Contrôles en attente » (CI attendue), « Aucun contrôle signalé »
    (rien après 5 min) ou « Aucune CI détectée ».
  - **D17** : une note de la carte (correction envoyée, fusion ratée) vaut pour un commit en tête
    et un état des contrôles (`checksKey`) ; elle s'efface quand ils changent. « PR fusionnée »
    reste.
  - **D18** : l'extrait de journal envoyé à l'agent est sans séquences de couleur (`stripAnsi`).
  - **D20** : sous « Fusionner quand tout est vert » cochée, une ligne dit pourquoi la fusion
    attend, la raison la plus bloquante d'abord (`mergeWait`) : brouillon, conflit, changements
    demandés, relecture demandée, contrôles en échec, en cours, pas encore signalés, base à
    reprendre, bloquée par les règles de la base, GitHub qui calcule. Jamais de fusion d'office
    sans contrôle (`readyToMerge`, inchangé sur ce point) ni quand GitHub dit `BLOCKED`,
    `BEHIND` ou `DIRTY`.
    - **Aucune CI détectée** (remarque du tech lead : une CI externe ou des contrôles requis ne
      se voient pas dans `.github/workflows`) : seulement si rien ne dit le contraire. Il ne faut
      ni workflow dans la branche (indice local), ni contrôle requis par la protection classique
      de la base (`gh api repos/{owner}/{repo}/branches/<base>`) ou par ses rulesets
      (`…/rules/branches/<base>`, lus une fois par base). Il faut aussi que GitHub ne bloque pas
      la PR pour une raison que la relecture n'explique pas. Une lecture ratée suppose une CI.
      Vu en lecture seule sur `cli/cli` (protection : trois contrôles requis), `vercel/next.js`
      (ruleset `required_status_checks`), `rust-lang/rust` (rulesets sans contrôle requis) et le
      dépôt de recette (privé, compte gratuit : rulesets en 403 « Upgrade to GitHub Pro », donc
      aucun). Sorties dans `fixtures/gh/`.
    - Dans ce cas, **« Fusionner maintenant »** fusionne au clic, avec la méthode du dépôt. Il
      est refusé d'avance, avec la raison, sur un brouillon, un conflit, `BLOCKED`, `BEHIND`, ou
      tant que GitHub calcule. Un refus de `gh pr merge` est dit sur la carte comme avant.
    - `gh pr view` demande en plus `mergeStateStatus` et `baseRefName` (`PrView.mergeState`,
      `PrView.base`).
  - **D19** (décision de l'utilisateur) : après une PR fusionnée, « Nettoyer » supprime aussi la
    branche distante, et la question le dit. Elle n'est supprimée que si elle porte encore le
    dernier commit de la PR fusionnée (`git ls-remote`, puis `git push
    --force-with-lease=<ref>:<commit> --delete`) : une branche qui a reçu des commits depuis est
    gardée, et c'est dit. Déjà partie (GitHub supprime à la fusion si le dépôt le demande) :
    rien à redire. En cas d'échec, l'erreur est dite et le nettoyage local est fait quand même
    (`worktree:cleanup` rend `{ state, remote }`).
    - Le nettoyage affiche une autre conversation, ce qui remonte l'onglet : la note passe par un
      petit relais (`WorktreeCleaned.tsx`), lu une fois par l'onglet Modifications suivant.
  - Maquettes validées par l'utilisateur avant le code (v1, puis v2 avec les remarques du tech
    lead) : `side-session-notes/…/176-maquette-0-9-1/`. Captures ajoutées : `176-pr-attendus`,
    `176-pr-attente`, `176-pr-nettoyee`, `176-pr-sans-ci`, `176-pr-sans-ci-refus`. Nouvelle suite
    e2e `pr-ci-sans-ci` ; dépôt et faux `gh` partagés dans `e2e/pr-repo.mjs`. Le faux `gh`
    répond à `gh api` (règles de la base) et peut refuser `pr merge`.
  - Écart au périmètre : `ChangesTab.tsx` touché pour la note du nettoyage et « Actualiser »
    (deux lignes chacun), à côté de la barre du worktree.
  - **Vu en passant, non corrigé** (préexistant, fiche 110) : après « Nettoyer », la
    conversation affichée a pour dossier celui du worktree supprimé. L'onglet Modifications y
    montre « spawn git ENOENT » (capture `176-pr-nettoyee`).
- 2026-11-06 — **0.9.1, relecture du tech lead** (dix remarques, trois bloquantes) :
  1. « Fusionner maintenant » relit la PR avant de décider : la carte pouvait dater de 10 min et
     l'agent avoir poussé depuis. Toute fusion (au clic ou d'office) passe
     `--match-head-commit <commit vu>` : si la branche a bougé, GitHub refuse.
  2. Règles de la base : seule une lecture réussie est gardée. Un échec (délai, quota, 5xx, GHES)
     est relu au plus toutes les 2 min, ou tout de suite par « Actualiser » (`refreshNow`). Une CI
     est alors supposée et la carte le dit (« Règles de la branche illisibles sur GitHub : une CI
     est supposée. »).
  3. Une fusion d'office ratée reste dite tant que le commit en tête est le même, au lieu de
     disparaître quand un contrôle est relancé (la case cochée ne reste plus muette). Une seule
     nouvelle tentative quand les contrôles changent.
  4. Suppression de la branche distante : seul un bail refusé (« stale info ») veut dire
     « gardée ». Un autre refus du dépôt (branche protégée, ruleset, droits) est une erreur avec
     les lignes `remote:` du dépôt.
  5. Le commit passé au bail doit être un identifiant complet (`^[0-9a-f]{40,64}$`) ; un dépôt
     distant `.` ou commençant par `-` est refusé.
  6. Un suivi oublié (`forget`) est marqué `disposed` : plus d'évènement ni de minuteur, même
     pour une lecture en cours. Un commit en tête vu pour la première fois sans push de l'app
     (redémarrage) est daté par son commit (`git show -s --format=%ct`) : une vieille PR sans
     contrôle n'est plus « en attente ».
  7. La note du nettoyage n'est reprise qu'une fois, dans les 10 s, par l'onglet affiché. Elle
     reste attachée à sa conversation, est oubliée quand celle-ci change, et se masque.
  8. `useWorktreeCycle` numérote ses relectures : une réponse plus ancienne n'écrase plus une
     plus récente.
  9. `readyToMerge` exige un état de fusion `clean` ou `unstable` (plus `unknown`).
  10. Essais :
      - course du bail sur un vrai dépôt nu (la branche bouge entre `ls-remote` et la
        suppression) et refus par un crochet `pre-receive`, aussi sur un vrai dépôt ;
      - `mergeNow` sur une carte périmée ;
      - `gh api` en échec puis « Actualiser » ;
      - fusion ratée puis contrôles relancés ;
      - suivi oublié pendant une lecture, et PR ancienne au démarrage ;
      - ordre des réponses et note du nettoyage côté renderer.

      Le faux `gh` refuse `--match-head-commit` sur un commit qui a bougé, comme GitHub.
      `mergeStateStatus` et `baseRefName` ont été relevés sur les PR réelles des fixtures.
- 2026-11-06 — **0.9.1, derniers points de la relecture** : une relecture ratée de « Fusionner
  maintenant » (réseau, `gh`) dit sa vraie erreur ; la date d'un commit passe par le git du cycle
  (`WorktreeCycle.commitDate`), pas par `git` du `PATH`. Un `mergeStateStatus` qui reste
  `UNKNOWN` (vieux GHES, calcul sans fin) bloque toujours la fusion d'office (on refuse dans le
  doute), mais au bout de 10 min la ligne d'attente dit que GitHub ne dit pas si la PR est
  fusionnable, et qu'il faut fusionner depuis GitHub.
- 2026-11-06 — **0.9.1, recette rejouée sur GitHub** (D15, D16, D17, D19, D20 confirmés ; PR #7
  fusionnée 2 s après le vert). Deux restes, branche `claude/176-qa-0-9-1-b` :
  - **D18** : `gh run view --log-failed` n'écrit pas l'octet ESC mais la notation caret, les deux
    caractères `^[` suivis de `[36;1m…` (relevé sur le vrai journal du dépôt de recette,
    `fixtures/gh/run-log-failed-caret.txt`). `logExcerpt` ôte maintenant les deux formes.
  - **D21** (nouveau) : après « Nettoyer », la nouvelle conversation partait du worktree
    supprimé (« spawn git ENOENT », agent arrêté, « Nouveau worktree » en échec).
    - Cause : `leaveWorktree` archivait la conversation avant de la ramener dans le dépôt, et le
      brouillon créé à sa place héritait du dossier du worktree. L'ordre est inversé.
    - Plus largement, une nouvelle conversation ne part jamais d'un dossier disparu
      (`conversations/folder-fallback.ts`). Elle repart de l'origine d'un dossier de worktree
      (même sous-dossier s'il existe), sinon du dossier par défaut, du dernier dossier, d'un
      dossier récent qui existe, sinon d'aucun (fiche 093). Le fil le dit (« Le dossier … n'existe
      plus : la conversation part de … »).
    - Un dossier demandé explicitement et introuvable reste refusé.
    - `Worktrees.create` refuse tout de suite un dossier disparu.
    - `manager.ts` étant à son plafond, la vue des réglages en sort (`settings-view.ts`).
    - Essais : `folder-fallback.test.ts` ; `manager.test.ts` (nettoyage puis nouvelle conversation
      dans le dépôt, dossier hérité disparu, worktree refusé en moins d'une seconde) ; e2e `pr-ci`
      (après « Nettoyer » et « Nouvelle conversation » : dossier du dépôt, aucune erreur git).
  - **D22** (préexistant, fiche 110) : « Committer » échouait sur une suppression déjà indexée
    (`git rm`) : `git add -A -- <chemins>` refuse un chemin absent du disque et de l'index
    (« pathspec did not match »). Ces chemins ne passent plus par `git add`, et
    `git commit --only` les prend tels quels. Essai sur un vrai dépôt : `git rm`, suppression à la
    main et fichier modifié, committés ensemble.
  - **D23** : après « Fusionner maintenant » sans CI, la note dit « PR fusionnée (…), sans CI
    détectée. » et non « tout était vert » (`merged.noCi`).
- 2026-11-06 — **0.9.1, relecture de la branche `-b`** (cinq points, avant fusion) :
  1. **Chemins pris comme motifs** (préexistant, étendu par D22) : cocher `a[1].txt` committait
     aussi `a1.txt`. Les `git add`, `ls-files` et `commit` du cycle reçoivent les chemins choisis
     avec `--literal-pathspecs`, comme le `git add` des conflits résolus. Les autres appels git
     de la vue Git n'en prennent pas, ou les marquent déjà `literal` (`git-context.ts`). Essai
     sur un vrai dépôt : `a[1].txt` à côté de `a1.txt`, et `*.txt`.
  2. **D18** : la notation caret n'ôte que les séquences de couleur (`^[[` puis chiffres et `;`,
     puis une lettre) ; `grep '^[[:space:]]'` arrive intact à l'agent. L'octet ESC reste ôté
     sous toutes ses formes : il n'apparaît pas dans du texte ordinaire.
  3. **`worktreeOrigin`** prend le dernier `.worktrees` du chemin. Un repli n'est jamais pris dans
     un `.worktrees` (le worktree d'une autre conversation).
  4. **Repli** : seulement l'origine du worktree ou le dossier par défaut des nouvelles
     conversations ; sinon aucun dossier, et l'app le demande. Plus jamais un dossier récent pris
     au hasard, où l'agent démarrerait dans un autre projet.
  5. **Renommage indexé** (`git mv`) : la vue Git n'envoie que le nouveau chemin. `commitIn`
     ajoute l'ancien, lu dans `git status`, pour que le commit ne prenne pas la moitié du
     renommage. Essai sur un vrai dépôt.
