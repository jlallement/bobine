# Guide de Bobine

Bobine est une application de bureau pour macOS qui pilote un agent de code : **IBM Bob** ou
**OpenCode**, ou tout autre agent qui parle le protocole ACP. Vous écrivez à l'agent comme dans
une messagerie ; il lit votre projet, propose des modifications, lance des commandes, et Bobine
vous montre tout ce qu'il fait, vous demande votre accord quand il le faut, et vous laisse
reprendre la main à tout moment.

Ce guide s'adresse aux développeurs qui utilisent Bobine. Chaque page commence par ce qu'on peut y
faire, puis donne la marche à suivre.

<!-- hors-app -->
*English version: [../en/README.md](../en/README.md).*
<!-- /hors-app -->

## Commencer

1. [Premiers pas](premiers-pas.md) : installer Bobine, choisir un dossier et un agent, envoyer un
   premier message.
2. [Conversations et autorisations](conversations.md) : écrire à l'agent, répondre à ses demandes,
   l'arrêter, retrouver une conversation.
3. [Modes et modèles](modes-et-modeles.md) : le mode Plan, changer de modèle, continuer avec un
   autre agent.

## Travailler

4. [Worktrees](worktrees.md) : une conversation sur sa propre branche, sa préparation
   (`.worktreeinclude`, `.bobine/worktree.json`), le retour dans `main`.
5. [Conversations filles et fusion](conversations-filles.md) : confier des tâches à d'autres
   conversations, puis fusionner leur travail.
6. [Faire relire](faire-relire.md) : demander à un autre agent de relire le travail.
7. [Suivi des PR et de la CI](suivi-pr-ci.md) : ouvrir une pull request et suivre ses contrôles.
8. [Tâches planifiées](taches-planifiees.md) : lancer une consigne à heure fixe.
9. [Aparté](aparte.md) : poser une question à côté, sans toucher à la conversation.
10. [Plusieurs dossiers](plusieurs-dossiers.md) : donner à l'agent un autre dossier en plus.
11. [Mémoire commune](memoire.md) : ce que les agents retiennent de vous, avec votre accord.

## Référence

12. [Panneaux](panneaux.md) : la session, les modifications, le navigateur intégré, le terminal,
    le simulateur iOS.
13. [Réglages : confidentialité et données](reglages.md) : ce que Bobine retient et comment
    l'effacer ; la corbeille, la sauvegarde.
14. [Agents](agents.md) : IBM Bob, OpenCode, et ce que chacun permet.
15. [Dépannage](depannage.md) : le diagnostic, le journal, les problèmes courants (agent muet,
    plantage, version d'agent).
16. [Raccourcis clavier](raccourcis.md).

## Voir aussi

- Ce guide est aussi dans l'app : Aide › **Aide de Bobine** (⌘?), avec une recherche, hors ligne.
  Les petits « ? » de l'interface l'ouvrent à la bonne section.
- Les **astuces de Bobine** (au plus une par jour, sur le bord de la zone de saisie) se coupent
  dans Réglages › Général › **Astuces de Bobine** ; « Tout réafficher » rend celles masquées.
- Les nouveautés de chaque version : Réglages › Nouveautés, ou le
  [CHANGELOG](../../../CHANGELOG.md).
- Installer depuis les sources, derrière un proxy ou sans réseau :
  [docs/installation.md](../../installation.md).
