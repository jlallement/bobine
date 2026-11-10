# ADR-0044 — Bobine écrit les règles d'approbation de Bob

- **Statut** : accepté
- **Date** : 2026-11-09

## Contexte

Pour remplacer Bob IDE au quotidien, il doit être possible de gérer depuis Bobine les règles qui
valent pour tous les projets : commandes autorisées ou refusées partout, groupes approuvés pour
toutes les tâches. Sans cela, il faudrait rouvrir Bob IDE pour les régler.

Ces règles vivent dans `~/.bob/settings/settings.json`, section `approval`. Le format est documenté
par IBM ([approval settings](https://bob.ibm.com/docs/shell/configuration/approval-settings)), et le
fichier est partagé par Bob IDE, Bob Shell et `bob acp`.

Relevé du 2026-11-09 (fiche 213) :
- « Allow command globally » dans Bob IDE ajoute le préfixe à
  `allowedExecutors[execute_command].approvedCommands` et le retire des refusés.
- Cette liste n'a aucun effet tant que le groupe `execute` n'est pas permis.
- Une règle vaut à partir de la session suivante.
- `forbiddenApprovalGroups` est une clé d'administration : Bob la remet à zéro si l'utilisateur
  l'écrit lui-même.

## Décision

Fonction propre à Bob (ADR-0011), déclarée dans son profil et listée dans Réglages › Agents et dans
`docs/agents.md`. Bobine écrit dans la section `approval` de ce fichier, **seulement sur une
action explicite de l'utilisateur** :

- sur une carte de commande : « Autoriser cette commande partout » ou « Refuser cette commande
  partout », avec un préfixe modifiable. Bobine propose la commande entière par défaut et prévient
  quand le préfixe ne fait qu'un mot. La carte en cours reçoit en même temps « pour cette
  conversation ».
- la première autorisation « partout » permet aussi le groupe `execute` pour tous les projets, en
  le disant, comme quand on coche Execute dans Bob IDE ;
- Réglages › Agents › Bob › Approbations : groupes, commandes autorisées et refusées, accès hors
  du dossier.

Règles d'écriture :
- ne toucher qu'aux clés en cause et garder tout le reste tel quel, clés inconnues comprises ;
- écrire d'un coup (fichier temporaire puis renommage), après une copie de sauvegarde ;
- quand `allowedExecutors` est absent, recopier d'abord la liste par défaut de Bob, comme Bob IDE :
  l'écrire avec une seule commande effacerait `cat`, `ls`, `git status`… (vu le 2026-11-09) ;
- ne jamais écrire `forbiddenApprovalGroups` ;
- ne jamais permettre un groupe que l'administration interdit.

`pnpm bob-probe` contrôle à chaque mise à jour de Bob que les clés attendues existent.

## Alternatives écartées

- **Ne rien écrire et renvoyer vers Bob IDE** — Bobine ne remplacerait pas Bob IDE, ce qui est le
  but.
- **Une liste de commandes propre à Bobine** — deux sources de vérité, et des règles qui ne
  vaudraient ni dans Bob IDE ni dans Bob Shell (voir aussi ADR-0043).
- **Autoriser par défaut le premier mot de la commande** (`git`), comme le propose aussi Bob IDE
  — un préfixe large peut servir à lancer d'autres commandes (rapport public PromptArmor sur Bob).

## Conséquences

- Les règles posées dans Bobine valent dans Bob IDE et Bob Shell, et l'inverse.
- Bobine modifie un fichier de l'utilisateur partagé avec d'autres outils : risque d'écritures
  concurrentes avec Bob IDE ouvert. Vérifié le 2026-11-09 : Bob IDE relit le fichier aussitôt et
  garde une règle écrite à côté quand il écrit à son tour.
- Le format reste celui d'IBM : s'il change, `bob-probe` le signale et cette fonction est coupée
  jusqu'à sa mise à jour, plutôt que d'écrire un fichier que Bob lirait mal.
- Permettre `execute` pour tous les projets fait aussi passer les commandes de lecture de la liste
  par défaut de Bob (`cat`, `ls`, `git status`…), comme dans Bob IDE. C'est dit à l'utilisateur.
