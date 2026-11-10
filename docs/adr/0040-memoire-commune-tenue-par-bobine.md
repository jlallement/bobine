# ADR-0040 — Mémoire commune tenue par Bobine, en clair, écrite par ses outils

- **Statut** : proposé
- **Date** : 2026-11-06

## Contexte

L'utilisateur veut une mémoire d'une session à l'autre « comme celle de Claude » (fiche 182),
**commune à tous les agents** (ce que Bob a appris vaut avec OpenCode), qu'il puisse regarder et
supprimer, et qu'un réglage désactive. ACP n'a aucune notion de mémoire ; ni Bob 2.0.9 ni OpenCode
2.2.5 n'en ont (`docs/agents.md`). Le schéma ACP 1.29 (instable, SDK 2.4, fiche 181) permet au
client de fournir un prompt système (`sessionCapabilities.systemPrompt`, mode `append`), mais
aucun des deux ne l'annonce. Contraintes : seul le main parle ACP et MCP, rien de propre à un agent
(ADR-0011), rien de supposé de Bob hors de sa documentation, textes donnés à l'agent en anglais
(ADR-0014).

## Décision

1. **Bobine tient la mémoire**, pas l'agent : `userData/memory/`, un dossier `user/` (commun à
   tous les projets) et un par projet, clé = racine du **dépôt principal** (`repoRootOf`, worktrees
   compris, résolue par le fichier `commondir` de git pour couvrir les dépôts nus ; hors dépôt, le
   dossier), nom lisible suivi d'une empreinte du chemin.
2. **Format de Claude Code, en clair** : un fichier Markdown par souvenir (en-tête `name`,
   `description`, `type` — `user`, `feedback`, `project`, `reference`), un index `MEMORY.md`
   régénéré par Bobine. Pas de chiffrement : fichiers `0600`.
3. **L'agent propose, l'utilisateur décide** (décision de l'utilisateur, 2026-11-06) : l'agent
   passe seulement par les outils de l'app (`remember`, `forget`, `recall`, serveur MCP `bobine`),
   jamais par le dossier. Bobine valide tout de suite le format, les bornes, et **refuse** (sans
   masquer) tout ce que la détection de secrets partagée avec le journal reconnaît. Une proposition
   valide devient une carte « Retenir ? » / « Oublier ? » dans le fil, qui montre le **texte
   entier** : **rien n'est écrit ni oublié sans un clic** sur « Retenir » / « Oublier ». L'outil
   répond aussitôt « en attente de l'utilisateur » : le tour de l'agent continue, et l'issue lui
   est jointe avec le message suivant de la conversation. Dans l'écran « Mémoire »,
   l'utilisateur modifie et supprime lui-même, sans autre accord.
4. **Écritures sûres** : **atomiques** (temporaire dans le même dossier, `fsync`, `rename`), **une
   file par projet** dans le main, index régénéré dans la même opération ; une carte acceptée sur
   une version dépassée du souvenir demande « Remplacer quand même ? » au lieu d'écraser ; un
   fichier illisible est mis de côté, jamais fatal.
5. **Les souvenirs sont des notes, pas des consignes** : le bloc donné à l'agent le dit ; une
   proposition faite après l'entrée d'un contenu externe dans la conversation (web, autre serveur
   MCP, fichier joint) est marquée `source: external` et signalée sur la carte, dans l'écran et
   dans l'index, en information de plus pour l'utilisateur.
6. **L'index arrive par capacité** : en prompt système (`append`, même valeur à `load` / `resume`)
   si l'agent annonce `sessionCapabilities.systemPrompt` ; sinon en bloc de texte joint au premier
   message de chaque session et après une compaction (mécanisme de la fiche 118). Le détail est lu
   à la demande (`recall`).
7. **Désactivée** : ni outils ni index, rien d'écrit ; les souvenirs restent, visibles et
   supprimables dans l'écran « Mémoire ».
8. **Bobine ne double pas l'agent** : elle n'écrit jamais dans la mémoire d'un agent. Le jour où un
   agent aura une mémoire documentée, elle est déclarée dans son profil (ADR-0011) ; si elle peut
   être coupée par une option documentée, l'utilisateur choisit laquelle sert, sinon l'écran
   montre aussi celle de l'agent, en lecture seule.

## Alternatives écartées

- **Chiffrer avec `safeStorage`** (comme les clés d'API) — illisible hors de Bobine, perdu avec la
  clé du trousseau (« Recommencer à neuf », autre Mac), alors que les conversations, plus riches,
  sont déjà en clair dans `userData` ; les secrets sont refusés à l'entrée. À reprendre par un
  nouvel ADR si l'utilisateur le demande.
- **Dans le dépôt** (`.bobine/memory/`, ou ajout à `AGENTS.md`) — partagé par git avec d'autres,
  modifie les fichiers du projet, et `AGENTS.md` est lu différemment par chaque agent.
- **Dans les fichiers d'un agent** (`~/.bob`, `~/.config/opencode`) — propre à un agent, non
  documenté pour Bob, contraire à « commune à tous les agents ».
- **L'agent écrit lui-même les fichiers** (comme Claude Code) — aucun contrôle des secrets ni du
  format, demande d'autorisation d'écriture hors du dossier, chemin à donner à chaque agent.
- **Mémoire offerte seulement en ressource ou outil MCP, sans index** — l'agent ne sait pas qu'il
  a quelque chose à lire ; Claude Code donne l'index d'office pour cette raison.
- **Masquer les secrets au lieu de refuser** — un souvenir à moitié masqué tromperait la session
  suivante ; l'agent reformule après un refus.
- **Retenir sans demander, avec « Annuler »** (première proposition du plan) — une fausse
  consigne poussée par une page piégée serait écrite avant que l'utilisateur la voie ; écarté par
  l'utilisateur au profit de l'accord systématique.
- **Accord seulement pour les souvenirs exposés** (contenu externe, `feedback`, portée « Vous ») —
  le repérage du contenu externe a des trous ; écarté par l'utilisateur.
- **Outil qui attend la réponse de l'utilisateur** (comme `ask_user`) — bloquerait le tour, et
  dépasserait la limite de ≈ 60 s d'un appel MCP chez Bob.
- **Recherche par similarité (embeddings)** — dépendance et modèle de plus pour quelques dizaines
  de souvenirs ; l'index et `recall` suffisent.

## Conséquences

- Fonctionne sans rien changer pour Bob et OpenCode : outils MCP qu'ils reçoivent déjà, texte joint
  au message. À vérifier sur Bob réel : qu'il lise l'index et appelle `remember` de lui-même.
- Le premier message d'une session porte ≈ 1 000 jetons de plus au plus (index borné), visibles
  dans l'onglet Session (ligne « Mémoire »).
- Le prompt système dépend d'une partie **instable** du schéma ACP : derrière la capacité annoncée,
  et le retour au SDK 1.9 (ADR-0038) le coupe sans autre effet que le repli au premier message.
- La détection de secrets devient un module commun (`main/secret-scan.ts`) : un faux négatif laisse
  passer un secret en clair sur le disque ; un faux positif refuse un souvenir (l'agent reformule).
- Un dossier déplacé perd sa mémoire jusqu'à ce que l'utilisateur la rattache.
- **Injection persistante** : c'est le risque principal (une page piégée fait retenir une fausse
  consigne qui reviendrait à chaque session). L'accord systématique la ramène à ce que
  l'utilisateur accepte en lisant le texte entier ; le signalement « contenu externe » a des trous
  (un contenu lu par un outil propre à l'agent sans carte reconnaissable n'est pas repéré).
- L'agent ne sait pas tout de suite si sa proposition est retenue : il l'apprend au message
  suivant, et ses consignes lui disent de ne pas l'attendre ni la refaire. Des cartes peuvent
  s'accumuler (au plus 10 en attente par conversation).
- **Un fichier de la mémoire peut être écrit hors de Bobine** (éditeur, ou l'agent par son shell
  ou son outil d'édition : le dossier est lisible et inscriptible par l'utilisateur). Pour que
  « jamais sans accord » tienne quand même (relecture du tech lead, 2026-11-07), Bobine retient
  l'empreinte du contenu au moment du clic (« Retenir », modification dans l'écran), dans
  `userData/memory.approved.json`, hors du dossier de la mémoire, écrit de façon atomique. Un
  souvenir sans empreinte ou dont l'empreinte diffère n'est **ni dans l'index ni rendu par
  `recall`** ; l'écran le montre « Modifié hors de Bobine » avec « Garder ces modifications »
  (refusé s'il contient un secret ; auteur dit « inconnu », commandes surlignées). La modification
  à la main reste possible, simplement re-validée. L'empreinte est un **HMAC-SHA-256** à clé
  aléatoire, gardée chiffrée par le trousseau (`safeStorage`, `userData/memory.key`) : réécrire le
  fichier des empreintes ne suffit pas, il faut la clé, que seul le trousseau rend (invite
  visible). **Limite réduite, pas supprimée** : un agent qui obtiendrait l'accès au trousseau, ou
  une machine **sans trousseau du tout** (repli SHA-256 documenté, ligne au journal ; sous Linux,
  `safeStorage.getSelectedStorageBackend() === 'basic_text'` compte comme « sans trousseau » : son
  mot de passe est écrit en dur dans Chromium), contourne la règle. **On ne redescend jamais d'un
  cran** : si `memory.key` ou une empreinte `hmac:` existe, un trousseau devenu indisponible (un
  agent peut arrêter le trousseau sous Linux) donne « clé illisible », jamais le repli. Il reste
  qu'un agent qui supprime à la fois la clé et le fichier des empreintes, sur une machine sans
  trousseau, retombe dans le repli ; c'est une défense contre l'écriture dans le dossier, pas un bac à sable. Coût : la clé
  est déchiffrée une fois par lancement, au premier souvenir à vérifier (comme une clé d'API,
  fiche 100). **Clé présente mais illisible** (trousseau refusé ou réinitialisé) : jamais de repli,
  aucune empreinte ne correspond, rien n'est donné aux agents ni validé (« Retenir » et « Garder »
  refusés, avec la raison), la clé n'est jamais remplacée ; l'écran le dit en un bandeau. Clé
  absente alors que des empreintes existaient : recréée, souvenirs à revalider un par un, l'écran
  le dit.
  Un lien symbolique n'est jamais suivi (mis de côté).
- Mémoire coupée en pleine session : la liste d'outils de la session est figée, mais chaque appel
  relit le réglage et refuse ; l'index n'est plus joint.
- Les écritures passent par une file : une écriture lente (disque) retarde les autres écritures du
  projet, jamais les lectures.

## Écarts relevés à l'implémentation (2026-11-07, statut inchangé)

L'ADR reste **proposé**. L'implémentation (interface comprise, maquettes validées sous réserve
par un expert UX, corrections appliquées) suit les décisions 1 à 5, 7 et 8. Écart à la
décision 6 : le prompt système fourni par le client n'est pas implémenté (aucun agent ne
l'annonce) ; l'index part au premier message de chaque session et après une compaction, pour tous
les agents. Détail dans la fiche 182 (« Écarts au plan »).
