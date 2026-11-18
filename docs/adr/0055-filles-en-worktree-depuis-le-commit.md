# ADR-0055 — Filles en worktree depuis le commit, choix avant le lancement, avis sans worktree

- **Statut** : accepté (décision de Jérôme du 2026-11-18, fiche 240 ; maquettes validées le même jour)
- **Date** : 2026-11-18

## Contexte

Une conversation fille qui part en worktree (`@rôle`, carte « Tâches proposées », `/split` qui y
mène, « Lancer en parallèle… ») part **du dernier commit** du dossier de sa mère (fiche 036,
fiche 097). Le travail en cours de la mère, non commité, n'y est pas. La recette « POC complet »
du 2026-11-17 (fiche 238, défaut D1) l'a montré quatre fois sur quatre : deux avis d'experts vides
(le plan et les maquettes n'étaient pas commités), et deux filles qui ont refait tout le serveur et
la page à côté de ceux de la mère, sans alerte, avec un projet incohérent après la fusion.

Bobine le savait (avis « N modifications non commitées du dossier d'origine ne sont pas ici. » en
tête du fil de la fille, fiche 110) mais ne le disait ni avant le lancement, ni dans la mère, ni à
l'agent qui lance les filles.

## Décision

1. **Worktree depuis le commit, maintenu.** Le non commité de la mère n'est jamais copié dans le
   worktree d'une fille.
2. **Choix avant le lancement.** Une fille qui partirait en worktree d'un dossier qui a du non
   commité ne part pas sans un choix de l'utilisateur, montré avant l'envoi par chacun des chemins
   (saisie `@rôle`, carte « Tâches proposées », « Lancer en parallèle… ») : **Committer d'abord**
   (le formulaire de la carte de fusion, puis le lancement part du nouveau commit) ou **Partir
   quand même**. Le main refuse le lancement sans choix (`children.error.uncommitted`) : le
   renderer ne fait pas foi. « Mettre de côté » (`git stash`), proposé d'abord, a été retiré par
   l'utilisateur : avant un lancement, il ne donne rien à la fille et vide seulement le dossier de
   la mère.
3. **Avis sans worktree.** Un envoi `@rôle` part en avis — dans le dossier de la mère, en lecture
   seule (imposée ou demandée selon l'agent, surveillée comme un rôle en lecture seule, ADR-0045),
   non commité compris — si tous les rôles cités sont en lecture seule, ou si l'utilisateur choisit
   « Demander un avis en lecture seule » dans l'avertissement. Bobine ne devine pas l'intention
   d'après le texte du message.
4. **Rappel dans la mère.** Une fille partie quand même porte ce qu'elle a laissé derrière elle
   (nombre de modifications, commit de départ, lus de son worktree : `dirtyAtStart`, `base`) sur sa
   carte de lancement, sur chacun de ses comptes rendus, et dans ce qui part à l'agent de la mère.
5. **Côté agent.** La description de `start_child` dit de committer d'abord ; l'outil renvoie un
   avertissement (nombre, fichiers, commit, ce qui manquera à la fille) quand le dossier a du non
   commité et que la fille part quand même, ou que la carte est encore ouverte.

## Alternatives écartées

- **Copier le non commité dans le worktree** (`git stash` puis `apply`, ou copie de fichiers) —
  fragile : fichiers ignorés, fichiers lourds, conflits au retour, et deux copies du même travail
  qui divergent. Claude Code fait de même (worktree depuis le commit, consigne « committez
  d'abord »).
- **Committer d'office avant le lancement** — un commit que l'utilisateur n'a pas voulu, avec un
  message inventé, sur sa branche.
- **Reconnaître un avis d'après le texte** (« avis », « relis »…) — dépend de la langue, se trompe
  dans les deux sens ; le choix explicite coûte un clic, seulement quand le dossier est modifié.
- **« Mettre de côté » avant un lancement** — voir la décision 2.

## Conséquences

- Nouveaux canaux IPC : `conversation:childFolderDirty` (lecture) et
  `conversation:commitForChildren` (écriture, refusée en profil en lecture seule) ; champ
  `uncommitted` (`anyway` / `readOnly`) sur les demandes de lancement et la décision de la carte.
- Le lancement d'une fille en worktree lit `git status` du dossier de la mère (une commande de
  plus, dans la file git de l'app, journalisée dans `agents.log`).
- Un essai ou un outil qui lance une fille d'un dossier modifié sans choix est refusé : il doit
  committer d'abord ou passer `uncommitted: 'anyway'`.
- À surveiller : un agent qui lance des filles en rafale sur un dossier modifié verra la carte
  attendre ; la description de `start_child` lui dit de committer d'abord.
