# ADR-0063 — Une création de rôle ne cache jamais un rôle existant

- **Statut** : proposé
- **Date** : 2026-11-20
- **Remplace en partie** : ADR-0045 (décision 2, pour ce que l'interface permet d'écrire)

## Contexte

ADR-0045 range les rôles par portée et les fusionne par nom : à nom égal, le projet l'emporte sur
le personnel, qui l'emporte sur le fourni. L'assistant de création et l'écran d'édition
appliquaient cette règle à l'écriture : un rôle créé ou renommé avec l'identifiant d'un rôle d'une
autre portée était écrit, puis l'un des deux disparaissait de la liste, avec au mieux une remarque
grise sous le champ, et parfois sans un mot (personnel créé sous un rôle du projet). Un testeur l'a
lu comme « le second rôle écrase le premier » (fiche 268).

## Décision

Depuis l'interface de Bobine, **une création ou un renommage ne prend jamais l'identifiant d'un
rôle connu ici** (fourni, personnel, du projet de la conversation, cachés compris) : le main refuse
(`nameTaken`), nomme le rôle qui le porte et propose un identifiant libre (`-2`, `-3`…). Le seul
remplacement que permet l'interface est « Enregistrer en rôle personnel » d'un rôle fourni, sous
son propre identifiant (`replaceBuiltin` porte ce nom ; rien d'autre n'est exempté).

Un rôle de projet qui en cache un autre (personnel ou fourni) ne naît plus que **d'un fichier écrit
à la main** dans `.bobine/roles/` (ou arrivé par git). La règle de fusion d'ADR-0045 reste celle
de la lecture, et Réglages › Rôles signale toujours « Remplace … ».

## Alternatives écartées

- **Garder le remplacement dans l'assistant, avec une confirmation « Remplacer quand même »** — un
  geste de plus pour un besoin rare, et le cas silencieux (personnel sous un rôle du projet) n'a
  pas de sens à confirmer : le rôle créé ne serait jamais visible.
- **Un identifiant interne distinct du nom (uuid)** — le nom est déjà stable, unique par portée et
  indépendant de l'icône ; un second identifiant obligerait à migrer les fichiers, le registre des
  installations et les rôles figés des conversations, sans régler la fusion par nom.
- **Suffixe ajouté d'office** — l'identifiant est ce que l'on tape après `@` : il est proposé,
  jamais imposé.

## Conséquences

- Plus de rôle caché par une action de l'interface ; l'identifiant, les fichiers et les
  installations chez les agents ne changent pas (aucune migration).
- Seules les portées visibles sont vérifiées : un rôle personnel peut encore porter le nom d'un
  rôle de projet d'un autre dossier ; là-bas, le rôle du projet l'emporte et c'est signalé.
- Faire remplacer un rôle personnel par une version du projet demande d'écrire le fichier à la
  main.
