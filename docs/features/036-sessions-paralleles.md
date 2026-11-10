# 036 — Conversations en parallèle et worktrees git

- **Statut** : fait
- **Dépend de** : 015

## Pourquoi

Comme Claude Code Desktop : plusieurs conversations travaillent en même temps, chacune dans son
worktree git pour ne pas se marcher dessus, avec leur état visible dans la barre latérale.

## Critères d'acceptation

- [x] Plusieurs agents actifs en même temps ; pastille d'état par conversation (travaille, attend une
      réponse, fini, non lu).
- [x] « Nouvelle conversation dans un worktree » : branche dédiée, nettoyage à la suppression.
- [x] Vue côte à côte de deux conversations.
- [x] Testé : agent factice ; e2e ; Bob réel (démarrage dans un worktree).

## Plan

- **Déjà là** : un agent par conversation, jusqu'à 4 vivants, un agent occupé n'est jamais arrêté
  (fiche 015) ; pastilles « travaille / attend une réponse / à lire / erreur » (fiches 024, 026).
  Vérifié (fiche 041, test du gestionnaire) : une réponse longue continue pendant qu'on travaille
  dans une autre conversation.
- **Worktree** (`main/changes/worktrees.ts`, avec `Run` injecté) : « Nouvelle conversation dans un
  worktree » dans le menu du dossier, si le dossier est dans un dépôt git. `git worktree add -b
  bob/<date>-<id> <dépôt>/.worktrees/<id> HEAD` ; `/.worktrees/` ajouté à `.git/info/exclude`
  (rien de suivi par git n'est modifié) ; dans le dépôt, le dossier hérite de la confiance donnée à
  Bob. Un sous-dossier du dépôt garde son chemin relatif dans le worktree. La conversation retient
  dépôt, chemin, branche et commit de départ (`worktree` dans l'index).
- Branche montrée sous la zone de saisie et dans la barre latérale (icône de branche).
- **Suppression** d'une conversation en worktree : la confirmation indique les modifications non
  commitées et les commits de la branche ; « Supprimer aussi le worktree et la branche » coché
  seulement s'il n'y a rien à perdre (sinon à cocher soi-même, `--force`).
- **Côte à côte** : « Ouvrir à côté » dans le menu d'une conversation ; la fenêtre se partage en
  deux fils, chacun avec sa zone de saisie ; l'agent de la conversation d'à côté reste vivant
  (pas d'arrêt pour faire de la place) et elle compte comme « vue » pour les pastilles.
- IPC : `conversation:createWorktree`, `conversation:worktreeStatus`, `conversation:open`,
  `conversation:release`, option `removeWorktree` de la suppression.

## Journal

- 2026-10-11 — Fiche créée (inventaire calqué sur Claude Code Desktop, à trier).
- 2026-10-12 — Fait comme prévu. `main/changes/worktrees.ts` (`Worktrees` : création depuis un
  sous-dossier, exclusion locale, état, suppression ; testé contre un vrai dépôt),
  `ConversationManager.createInWorktree / worktreeStatus / open / release / shownIds`, option
  `removeWorktree`, `BesidePane`, actions par conversation (`actionsFor`), pastilles qui tiennent
  compte de la conversation d'à côté. Suite e2e `parallelSuite` : réponse longue qui continue
  ailleurs, worktree (branche, icône, dépôt principal intact), message envoyé à côté sans changer
  l'active, suppression avec le worktree.
- Bugs trouvés par les tests et l'essai réel : (1) supprimer la conversation active en worktree
  ouvrait la suivante dans le dossier supprimé → elle repart dans le dépôt principal ; (2) une
  conversation en worktree jamais commencée laissait son worktree et sa branche en quittant l'app
  → supprimés à la fermeture s'ils sont intacts (`removeIfUntouchedSync`).
- **Bob réel** : conversation en worktree dans `~/bob-essai/modifs-demo` → Bob prêt tout de suite,
  sans redemander la confiance (le worktree est sous un dossier approuvé). Aucun message : 0 bobcoin.
- Limites : pas de fusion de la branche depuis l'app (terminal ou outil git habituel ; fiche 037) ;
  dans la vue côte à côte, les commandes de l'app (`/compact`…) et le panneau latéral restent ceux
  de la conversation principale ; la fenêtre est partagée en deux parts égales.

