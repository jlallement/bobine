# ADR-0054 — Quota lu pour l'agent qui sert ; rien d'office chez les vrais agents en profil jetable

- **Statut** : accepté
- **Date** : 2026-11-18
- **Remplace en partie** : ADR-0017 (« au démarrage de Bobine, si Bob est installé ») et la pause
  de 12 h après un échec (fiche 091, D11). Le reste d'ADR-0017 (lecture par `/status` de
  `bob chat`, tâche vide supprimée par `session/delete`) est inchangé.

## Contexte

Recette « POC complet » du 2026-11-17, défaut D17 (fiche 242) : à la relance, OpenCode choisi et
aucun Bob lancé, Bobine lisait pourtant le quota de Bob 3 s après le démarrage. Chaque lecture lance
`bob chat`, qui crée une tâche dans `~/.bob`, que Bobine supprime ensuite ; `--trust` ajoute aussi
son dossier à `~/.bob/trustedFolders.json`. Sur un profil jetable (profil temporaire, dossier de
données d'essai, `pnpm pilote`), cela touche les données réelles de Bob alors que l'essai devait
n'en toucher aucune. La page Diagnostic fait de même : à son ouverture, elle ouvre puis supprime une
session chez chaque agent qui sait la supprimer.

Aucune voie documentée de Bob ne donne le budget sans `bob chat` (ADR-0017, `docs/acp.md`, « Budget
du compte ») : on ne peut pas lire le quota sans créer de tâche.

## Décision

1. **Le quota d'un agent n'est lu que quand l'agent sert** : une conversation dont l'agent se montre
   prêt, un essai réussi de l'accueil, un essai du diagnostic qui a ouvert une session (fiche 205),
   et sur demande (« Actualiser »). Plus de lecture au lancement pour les agents seulement
   installés ; la pause après un échec (D11), qui ne servait qu'à cette lecture, disparaît.
2. **Profil jetable dont les agents voient le vrai dossier personnel** (`touchesRealAgents` :
   profil temporaire ou `--user-data-dir`, sans `--agents-neufs` ni `BOBINE_CONFIG_HOME`) :
   Bobine ne fait rien d'office dans les données des agents — jamais de lecture du quota (pas même
   demandée : elle crée une tâche), et le diagnostic n'ouvre pas de session sans « Essayer une
   session » (l'agent est seulement initialisé). Ce que l'utilisateur fait lui-même avec un agent
   (essai de l'accueil, conversation, reprise de session) reste permis : c'est son choix.

## Alternatives écartées

- **Lire au lancement le quota de l'agent choisi dans les réglages** : redondant avec la lecture
  « agent prêt » quand il sert, et inutile (attente puis pause) quand il n'est pas connecté.
- **Lire le quota en profil jetable mais supprimer la tâche** (comme avant) : la tâche est quand
  même créée dans le vrai `~/.bob`, et le dossier de lecture retenu par `--trust`.
- **Dossier personnel jetable pour la seule lecture** : Bob n'y serait pas connecté (sa connexion
  vit dans `~/.bob`) ; rien de documenté pour lui passer la connexion d'ailleurs.

## Conséquences

- Le quota de Bob apparaît quelques secondes après que la conversation avec Bob est prête (et non
  plus 3 s après le lancement) ; si Bob n'est jamais utilisé, il n'apparaît pas.
- En profil jetable, le quota reste inconnu ; un essai complet du quota passe par un vrai profil ou
  par l'agent factice (`BOBINE_CONFIG_HOME`, `MOCK_AGENT_QUOTA=1`).
- Un `bob.pause.json` laissé par une version précédente dans le dossier de lecture est ignoré.
- Toute nouvelle action d'office qui écrirait chez un agent doit consulter `touchesRealAgents`.
