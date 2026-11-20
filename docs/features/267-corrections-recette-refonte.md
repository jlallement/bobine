# 267 — Corrections de la recette réelle de la refonte (travail délégué)

- **Statut** : en cours
- **Dépend de** : 260 (cadre), 261–266 (lots), 258 (états des travaux), 259 (modèle refusé)
- **Agents** : les deux — tout est générique ; la reconnaissance du quota épuisé est déclarée dans
  le profil d'OpenCode (`modelRefusedAtTurn`, comme le refus de modèle de la 259), ADR-0011

## Pourquoi

Recette réelle du 20 novembre avec OpenCode (`docs/recettes/2026-11-20-recette-refonte-travail-delegue.md`).
La refonte tient, mais la relecture donne une fausse assurance : `@Code reviewer` « Relis ce qui a
été fait » n'a relu que le dernier commit, un commit de fusion, et la carte a dit « Rien à
signaler » (N1) ; le clic sur `fichier:ligne` ouvre un diff « Aucune modification » (N2). Un quota
gratuit épuisé s'affiche en erreur brute en anglais (N3). L'activité d'une carte montre des
commandes de dix lignes (N4). Plus une série de mineurs (N5–N10, R7, F6, F8, D14, D17, D24).

## Critères d'acceptation

- [ ] **N1** `@Code reviewer` sans portée précise (portée d'office) :
  - non commité : le non commité, plus les commits de la conversation non relus s'il y en a
    (`git diff <base>`, une branche : la branche contre sa base) ;
  - rien de non commité, une branche : la branche contre sa base (inchangé) ;
  - rien de non commité, branche principale : les commits de la conversation (premier parent
    depuis sa création, ou depuis le dernier commit relu), à défaut les 5 derniers ; **jamais un
    commit de fusion seul** (sa base devient le point commun de ses parents).
  - La carte dit toujours ce qui a été relu (« Relu : 4 commits, 12 fichiers (ffa5062..db4a5e1) »),
    remarques ou rien à signaler.
- [ ] **N2** `fichier:ligne` d'une portée commitée : le diff de la portée relue (base..commit relu),
  même si le fichier a changé depuis — et la vue le dit ; une portée avec du non commité : le diff
  relu à nouveau à chaque changement du dépôt ; fichier hors de la portée : dit, avec le code cité.
- [ ] **N3** « Free usage limit reached » (`-32603` d'OpenCode 2.3.0) : carte « Modèle refusé » avec
  « Choisir un autre modèle », motif précis dans le profil, sans faux positif ; dans la carte d'un
  travail, l'état et le choix d'un autre modèle **du travail**.
- [ ] **N4** Activité en direct : une seule ligne coupée (première ligne, ≈ 80 caractères), la
  commande entière en infobulle.
- [ ] **N5** Saisie avec un rôle : essais de composant et e2e (envoi pendant la lecture du dossier,
  juste après le choix du rôle, double Entrée) ; texte jamais perdu.
- [ ] **N6** Consigne des rôles : « résumé de deux lignes », plus « compte rendu » (fr, en).
- [ ] **N7** Aide avant la frappe en gris (`--muted`).
- [ ] **N9** « Relancer » ne repose pas de bulle.
- [ ] **N10** Tuile et tableau de Mon activité : même compte d'échanges sans coût.
- [ ] **R7 / D35** « À lire » tombe quand la réponse est vue (carte dépliée et visible, ou
  conversation affichée), erreurs comprises.
- [ ] **F8** Après « Répondre à <rôle> », focus dans la saisie.
- [ ] **F6** Big Pickle : signal regardé, décision documentée.
- [ ] **D14** Indicateur : durée du tour, l'étape en plus petit.
- [ ] **D17** Travaux de la barre latérale dans l'ordre de lancement.
- [ ] **D24** Première étiquette de mois entière.
- [ ] Testé contre l'agent factice (scénarios `quota-gratuit`, `commande-longue`) ; captures `267-*`
  clair et sombre pour N1, N2, N3, N4, N10.

## Plan

**N1 — portée d'office** (`src/main/conversations/review-target.ts`, `src/shared/review.ts`,
`children-review.ts`, `src/shared/children.ts`)

1. `TargetSource` : `startedAt` (création de la conversation) et `lastReviewed` (commit de fin de
   la dernière relecture finie de cette conversation, lu dans son fil).
2. Nouvelle portée `commits` : `base` (commit, ou l'arbre vide), `commit` (HEAD relu), `commits`
   (nombre), `withUncommitted`. Calcul : premier parent depuis HEAD, au plus 50 commits ; base = le
   dernier relu s'il est ancêtre de HEAD et différent, sinon le premier commit d'avant la création
   de la conversation, sinon (aucun commit de la conversation) les 5 derniers. Une plage réduite à
   un commit de fusion : base = `merge-base --octopus` de ses parents.
3. Non commité (`auto`) : branche → branche contre sa base (non suivis compris) ; branche principale
   avec des commits de la conversation non relus → `commits` + `withUncommitted` ; sinon le non
   commité seul (comme avant).
4. `Review` : `commits`, `head` (commit de fin relu), `withUncommitted` ; `reviewBrief`,
   `askText`, contexte de la mère (`children.ts`) pour `commits`.
5. Carte : ligne « Relu : … » (`ReviewScopeLine` dans `WorkReview.tsx`), dans tous les états finis.

**N2 — diff d'une remarque** (`git.ts` `fileDiff`, `ReviewFileDiff.tsx`, `ChangesTab.tsx`, `ipc.ts`)

6. `DiffTarget.until` (le commit relu, portée commitée) ; `changes:gitFile(…, since, until)` : la
   version relue au lieu du disque, et `changedSince` si le disque diffère. Bandeau : « version
   relue · ce fichier a changé depuis ». Sans `until` : relu à chaque relecture du dépôt
   (`git` en dépendance : cause du « Aucune modification » figé après le correctif). Fichier
   inchangé dans la portée : « Pas modifié dans ce qui a été relu ».

**N3 / N8 — quota** (`opencode-contract.ts`, `profiles.ts`, `turn-auth.ts`, carte d'un travail)

7. `modelRefusedAtTurn.quota` : motif `^(Internal error: )?Free usage limit reached\b` au code
   `-32603`, vaut pour le modèle de la session (le message ne le nomme pas) ; `model.reason:
   'quota'` → sous-titre « quota gratuit épuisé ». Agent factice : scénario `quota-gratuit`.
8. Carte d'un travail « attend » à cause d'un modèle refusé : le dire, avec « Choisir un autre
   modèle » (réglage de modèle **du travail**, `setControl` sur sa conversation, le message refusé
   repart comme dans la 259).

**Mineurs**

9. N4 `WorkCard.tsx` `factText` : première ligne, 80 caractères, `title` = commande entière.
10. N5 `useRoleCompose.tsx` : tests de composant (lecture du dossier, juste après le choix, double
    Entrée) ; texte remis si l'envoi n'a pas eu lieu ; e2e ciblé.
11. N6 `builtin-fr.ts`, `builtin-en.ts`.
12. N7 `RoleCompose.tsx`, `roles.css` : classe `role-destination-hint`, `--muted`.
13. N9 `roles:reply` avec `retry` : pas de nouvelle bulle (`children.ts`, `WorkFoot.tsx`).
14. N10 `usage/stats.ts` : un coût nul en monnaie d'un modèle non gratuit compte « sans coût ».
15. R7 `attention.ts` : réponse en erreur effacée comme une réponse finie ; signal « vu » du
    renderer pour une carte dépliée et visible (`attention:seen`).
16. F8 `useRoleCompose` / `WorkFoot` : focus vérifié par un essai, corrigé si besoin.
17. D14 `WorkingIndicator.tsx` ; D17 `history-order.ts` (`createdAt`) ; D24 `UsageChart.tsx`.

Pas de nouvelle dépendance.

## Hors de ce lot

- **D21** (« Merge branch 'main' into bobine/… » : sens du commit de fusion, ADR-0022) : suite à
  décider. La relecture n'en dépend plus (N1).

## Journal

- 2026-11-20 : fiche et plan.
