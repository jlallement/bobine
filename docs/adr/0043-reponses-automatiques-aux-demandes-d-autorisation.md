# ADR-0043 — Bobine répond aux demandes d'autorisation selon le mode choisi

- **Statut** : proposé
- **Date** : 2026-11-09

## Contexte

Sur un même parcours de 10 messages (fiche 213), Bobine demande 14 confirmations avec Bob en ACP,
Bob Shell 13 et Bob IDE 11. Avec tous les groupes cochés dans Bob IDE, il en reste 4. Les équipes
travaillent dans Bob IDE et Bob Shell : Bobine doit pouvoir les remplacer sans demander plus
souvent qu'eux.

ACP ne permet pas de régler les autorisations d'une tâche : Bob IDE coche ses groupes dans le
moteur de Bob, ce qu'aucun message ACP ne permet de faire. La seule prise de Bobine est la réponse
à `session/request_permission`.

Il y a deux voies écartées. `bob acp --auto-approve` ne vaut qu'au lancement du processus et n'existe
que pour Bob. Il fait aussi tout passer, sauf les cas où Bob exige un accord explicite : on a vu
`cp` hors du dossier, `rm -rf`, `chmod -R 777` et `push --force` s'exécuter sans carte. Réécrire des
règles d'approbation dans Bobine, elle, irait contre « moins de logique dans Bobine ».

Bob exige un accord explicite, sans proposer l'option `allow_always`, pour l'écriture dans `~/.bob`
et pour un outil hors du dossier (relevé du 2026-11-09, `docs/acp.md`) ; d'autres cas sont possibles
(groupe interdit par l'administration, commande qu'il ne sait pas découper), non vérifiés.

## Décision

Bobine peut répondre à la place de l'utilisateur à une demande d'autorisation, et seulement si
toutes ces conditions sont réunies :

1. **L'utilisateur a choisi le genre d'action pour la conversation en cours.** Les genres
   proposés sont Lecture (`read`, `search`), Modifications dans le dossier (`edit`, `delete`,
   `move`) et Autres outils (`other` : outils MCP, skills, sous-agents, modes, liste de tâches), pris
   du seul `kind` ACP : Bob envoie tous ces outils en `other`, et Bobine ne lit pas ses titres. Il n'y a pas de genre « Commandes ». Le choix
   par défaut se règle dans Réglages, et seule la Lecture est cochée au départ, comme dans Bob IDE.
   Le mode « Tout approuver » couvre tous les genres : il est activé explicitement, vaut pour une
   conversation, n'est jamais enregistré et reste signalé par une pastille.
2. **L'agent propose l'option `allow_always`.** Sinon, c'est que l'agent veut un accord explicite
   et la carte est montrée, quel que soit le mode.
3. **Bobine ne repère aucun risque** dans la demande (`permission-risk.ts`, fiche 211).
4. **La réponse est tracée** : une ligne dans le fil et une dans `agents.log` (action, mode,
   heure).

Bobine choisit l'option par son genre ACP (`allow_always`, sinon `allow_once`), jamais par son
identifiant (Bob : `allow_always`, OpenCode : `always`), pour que l'agent retienne lui-même la
décision. Bobine ne passe jamais
`--auto-approve` et ne réimplémente aucune règle de l'agent : elle ne compare pas les commandes et
ne tient pas de liste propre aux agents.

## Alternatives écartées

- **Passer `--auto-approve` à Bob** — propre à Bob, fixé au lancement du processus, et sans
  aucun garde-fou de Bobine, puisque les demandes n'arrivent plus.
- **Règles d'approbation tenues par Bobine** (préfixes, listes de commandes) — on réimplémenterait
  ce que Bob fait déjà, avec deux sources de vérité qui divergeraient.
- **Une case « Commandes »** — Bob IDE ne fait passer que les commandes de sa liste globale, même
  avec Execute coché. Faire passer toutes les commandes serait plus permissif que Bob IDE. Les
  commandes passent par la liste de Bob (ADR-0044) ou par « Tout approuver ».

## Conséquences

- Le mécanisme est générique : il marche pour tout agent qui demande. OpenCode, réglé par défaut,
  ne demande rien (relevé 2.2.5) : rien n'y change tant que son profil ne lui passe pas une
  configuration `ask` (décision à part, fiche 213).
- Bobine n'accepte jamais seule plus que l'agent ne permet de retenir : les accords explicites
  voulus par Bob restent des cartes, même en « Tout approuver ».
- Les hooks `PreToolUse` de Bob passent avant toute demande (vu en ACP, même avec
  `--auto-approve`) : les garde-fous d'une équipe posés en hooks restent appliqués.
- La protection dépend de ce que l'agent signale. Bob en ACP n'a pas la vérification de sécurité
  des commandes de Bob IDE : `curl`, `sudo` et `cp` hors du dossier arrivent avec `allow_always`.
  Sur ces cas, seul le bandeau de la fiche 211 arrête « Tout approuver ». Il faut demander à IBM
  d'ouvrir cette vérification à ACP.
- Remplace la règle « Bobine ne passe jamais `--auto-approve` » de `docs/acp.md`, qui reste vraie,
  par une règle plus précise.
- À surveiller : un agent qui proposerait `allow_always` pour tout, ce qui rendrait la condition 2
  sans effet. Chaque nouvel agent sera relevé (sonde) avant que le mode lui soit ouvert.

---

Texte expurgé le 2026-11-10 pour la publication du dépôt ; la décision est inchangée.
