# ADR-0039 — Tâches planifiées : une conversation ordinaire, lancée par le main, app ouverte

- **Statut** : proposé
- **Date** : 2026-11-06

## Contexte

Fiche 178 : l'utilisateur enregistre une consigne, un dossier, un agent et une fréquence ; Bobine
la relance seule (comme les tâches planifiées de Claude Desktop ou les « Automations » de Codex).
Bob se paie en bobcoins (quota de 50) : une tâche qui part sans l'utilisateur ne doit jamais
coûter plus que prévu, partir deux fois, ni rejouer d'un coup les échéances d'une nuit de veille.
Il faut décider où vit le planificateur, ce qu'est une exécution, et quand elle peut partir.

## Décision

- **Le planificateur vit dans le main** (`src/main/scheduler/`), seul à lancer des agents. Il ne
  tourne que **tant que Bobine est ouverte** : pas d'agent `launchd`, pas de réveil du Mac.
- **Une exécution est une conversation ordinaire**, créée hors de l'active par le gestionnaire
  (`createDetached`, chemin commun avec les conversations filles), marquée `scheduled` dans son
  enregistrement, puis la consigne est envoyée par `prompt`. Elle passe par les mêmes
  autorisations, notifications et plafond de coût que toute conversation : aucun mode ni accord
  imposé, rien de propre à un agent.
- **Garde-fous du coût, dans le planificateur** : jamais deux exécutions d'une tâche à la fois
  (l'échéance est notée « sautée ») ; toutes les échéances passées donnent **au plus un**
  rattrapage (réglable par tâche, sinon « manquée ») et la suivante repart de maintenant ; le
  plafond de la tâche devient le **plafond propre** de la conversation (ADR-0035) dès que l'unité
  de l'agent est connue (exécution précédente, ou première consommation).
- **Stockage** : `scheduled-tasks.json` à côté de `settings.json`, versionné, écriture atomique,
  fichier abîmé mis de côté, fichier d'une version plus récente laissé intact ; 20 exécutions
  gardées par tâche.
- **Horloge** : un contrôle toutes les 30 s et au réveil du Mac (`powerMonitor` `resume`), plutôt
  qu'une minuterie longue jusqu'à l'échéance (elle dérive pendant la veille).

## Alternatives écartées

- **Agent de lancement macOS (`launchd`) qui ouvre Bobine à l'heure dite** — lance des agents
  payants sans l'utilisateur devant l'écran, demande une installation système, et ne marche pas
  sur la préversion Linux ; à reconsidérer seulement si le besoin d'exécutions app fermée est
  avéré.
- **Exécution « sans tête » hors conversation** — invisible dans la barre latérale, sans
  autorisations ni plafond : tout serait à refaire, et à contrôler deux fois.
- **Rejouer chaque échéance manquée** — une tâche horaire après une nuit de veille lancerait dix
  exécutions payantes d'un coup.

## Conséquences

- Une tâche ne part pas si Bobine est fermée ou le Mac en veille : la page le dit. Au retour, une
  exécution de rattrapage au plus.
- Le plafond d'une tâche ne vaut qu'à partir de la première consommation lors de la toute
  première exécution (la devise de l'agent n'est pas connue avant) ; ensuite, il est posé avant le
  premier message.
- `ConversationManager.createDetached` est le chemin de toute conversation créée hors de l'active ;
  une nouvelle origine (autre que mère ou tâche) passe par lui.
