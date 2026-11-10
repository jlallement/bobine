# ADR-0037 — Préparation des worktrees : fichiers du dépôt, accord dans l'app

- **Statut** : proposé
- **Date** : 2026-11-06

## Contexte

Un worktree créé par Bobine (fiches 036, 097) part d'un `git worktree add` nu : ni dépendances,
ni fichiers ignorés (`.env`, certificats locaux). L'agent d'une fille ne peut ni tester ni lancer
l'app sans tout réinstaller, souvent mal. Conductor (`conductor.json`, scripts `setup` /
`archive`), Claude Code et Codex (`.worktreeinclude`, scripts des environnements locaux) préparent
le worktree avant que l'agent y travaille (fiche 175). Il faut choisir où se règle la préparation
et qui décide de lancer une commande.

## Décision

1. **Dans le dépôt** : `.worktreeinclude` à la racine (format de Claude Code tel quel : syntaxe
   `.gitignore`, seuls les fichiers **ignorés** par git sont copiés) et `.bobine/worktree.json`
   (`setup`, `archive` : une ligne de shell chacune), lus dans le dossier d'origine du worktree.
2. **Copier sans demander, lancer avec accord** : la copie ne sort rien du dépôt (garde-fous :
   pas de lien symbolique, dossiers parents résolus dans le dépôt, ni `.git` ni `.worktrees/`, rien
   d'écrasé, plafonds). Une commande, elle, ne part qu'après « Autoriser et lancer » ; l'accord est
   gardé dans `approvals.json` par racine de dépôt et **empreinte des deux commandes** (toute
   modification redemande), révocable dans Réglages › Confidentialité. **L'accord ne couvre que
   ce qui a été montré** (recette 0.9, D1, D2) : la carte montre toutes les commandes qu'il
   couvre (`setup` « à la création », `archive` « à la suppression », `archive` seule comprise),
   et le renderer renvoie l'empreinte affichée ; si le fichier a changé entre-temps, rien ne
   tourne et la carte redemande l'accord pour les nouvelles commandes.
3. **Hors du gestionnaire de conversations** : la préparation suit l'évènement `worktree-start`,
   retient les messages par la garde d'envoi (`promptGate`, chaînée) et écrit dans le fil par
   `post` (élément `worktree-setup`, un seul, remplacé à chaque étape).
4. **Une exécution sans surveillance n'attend jamais d'accord** (recette 0.9, D3) : une tâche
   planifiée part sans la commande non autorisée, comme une fille lancée par un agent, et
   l'historique de l'exécution le dit (« préparation non autorisée »).

## Alternatives écartées

- **Réglages de Bobine par dépôt** — la préparation dépend du projet et se partage avec l'équipe ;
  dans l'app, chacun la réécrirait, et elle ne suivrait pas les branches.
- **Lancer la commande du dépôt sans accord** (comme Conductor) — un dépôt cloné pourrait faire
  exécuter n'importe quoi à l'ouverture d'un worktree, avant toute question de l'agent.
- **Copier tout ce qui est ignoré** — `node_modules`, caches, sorties de build : lent et souvent
  faux d'une branche à l'autre ; c'est au projet de dire quoi copier.
- **Format propre à Bobine pour les motifs** — un dépôt déjà préparé pour Claude Code l'est ainsi
  pour Bobine, sans second fichier.

## Conséquences

- Une fille lancée par un agent ne peut pas obtenir l'accord : la première fois dans un dépôt,
  elle part sans la commande, et son agent en est prévenu (ligne de contexte) ; la carte attend
  l'utilisateur dans son fil.
- Le premier message attend la fin de la préparation (15 min au plus) : un `pnpm install` lent
  retarde le départ de l'agent, au profit d'un worktree utilisable. La carte dit qu'il attend, avec
  « Arrêter » et « Continuer sans attendre ». Dans une conversation lancée par l'utilisateur, il
  attend aussi l'accord, que « Continuer sans préparer » permet de passer.
- La sortie de la commande est gardée dans le fil (fin seulement), jamais dans les journaux.
- La commande `archive` n'est pas lancée par la fermeture de l'app (suppression synchrone des
  worktrees jamais commencés).
