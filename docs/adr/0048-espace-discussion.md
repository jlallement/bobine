# ADR-0048 — Espace Discussion : même moteur, dossier tenu par Bobine, interface à part

- **Statut** : accepté (2026-11-19 : acceptée au vu de la livraison, fiches 224, 230)
- **Date** : 2026-11-14
- **Précise** : ADR-0011 (générique d'abord), fiche 093 (pas de conversation sans dossier)

## Contexte

L'utilisateur veut se servir de Bobine comme d'un chat et l'ouvrir à un public moins technique
qui travaille avec des documents (Word, Excel, PDF), sans mélanger cet usage avec le code (fiche
224 ; première maquette refusée : « trop mélangé »). ACP exige un dossier (`session/new`, `cwd`).
Claude Desktop et ChatGPT gardent les fichiers d'une conversation dans un espace caché ; Bobine,
elle, fait tourner l'agent sur le Mac de l'utilisateur.

## Décision

1. **Deux espaces, un seul moteur** : une discussion est une conversation ordinaire de l'agent
   (`ConversationRecord.space: 'discussion'`, absent = espace Code), avec son fil, sa session, sa
   corbeille. L'interface sépare les espaces (sélecteur Code | Discussion, ⌘1 / ⌘2) ; l'espace
   Code ne change pas.
2. **Dossier tenu par Bobine** : `<données>/discussions/<id>/`, créé avec la discussion, jamais
   dans les dossiers récents, sans git, règles, mémoire, serveurs MCP « projet » ni serveurs de
   dev. Il reste en place quand la discussion part à la corbeille, et part avec son effacement.
   Un brouillon quitté sans rien y laisser emporte son dossier vide.
3. **Moins d'outils, écritures bornées** : aucune famille d'outils de Bobine (`toolModules` vide :
   ni navigateur, ni terminal, ni filles, ni mémoire). Une demande d'écrire (`edit`, `delete`,
   `move`) dont tous les emplacements sont dans le dossier est accordée une fois par Bobine ; un
   emplacement ailleurs : refusée ; sans emplacement connu (demande, puis `tool_call` qui la
   précède) : posée à l'utilisateur. Chaque réponse d'office est dite dans le fil. Les commandes
   restent demandées. Bobine ne prétend pas borner ce qu'un agent fait sans demander (OpenCode).
   Un fichier existant à plusieurs noms (lien physique, `nlink > 1`) n'est jamais accordé
   d'office : la demande est posée, la carte dit pourquoi (fiche 230, ajout du 2026-11-15, ADR
   encore proposé).
4. **Documents** : un fichier joint est copié dans le dossier (l'original n'est jamais touché) et
   c'est la copie que l'agent reçoit ; à la fin de chaque tour, les documents créés ou modifiés
   sont posés dans le fil (élément `documents`), quel que soit le moyen de l'agent. Un document est
   un fichier ordinaire du premier niveau, ni lien symbolique ni lien physique (fiche 230) : Bobine
   ne montre, n'ouvre ni ne copie jamais un fichier dont le contenu est celui d'un autre nom.
5. **Continuer dans un projet** : une nouvelle conversation de l'espace Code dans le dossier
   choisi, le fil de la discussion repris puis une bascule (`handover`, raison `discussion`) ;
   l'échange part en texte avec le premier message (ADR-0024). La discussion reste telle quelle.

## Alternatives écartées

- **Dossier vide en lecture seule et mode « question » de l'agent** (première version) : ne permet
  pas de produire un document ; le mode `ask` de Bob est propre à Bob.
- **Un dossier partagé par toutes les discussions** : ce qu'une discussion écrit, les autres le
  verraient ; le vider détruirait des documents.
- **La discussion dans l'espace Code** (entrée du menu du dossier, section de la même liste) :
  refusée sur maquette (« trop mélangé »).
- **Un bac à sable de Bobine qui exécute du code** (comme Claude ou ChatGPT) : hors du rôle d'un
  client ACP ; l'agent garde ses outils.

## Conséquences

- Rien de propre à un agent : Bob 2.1.0 et OpenCode 2.2.5 ont été relevés dans ce dossier
  (`docs/acp.md`, 2026-11-14).
- La règle d'écriture ne vaut que pour ce que l'agent demande : un agent qui écrit sans demander
  peut écrire ailleurs (relevé : OpenCode extrait un `.xlsx` dans le dossier temporaire du
  système).
- Une branche de discussion partage le dossier de l'originale ; l'effacer n'efface que le sien.

## Acceptation (2026-11-19)

Acceptée au vu de la livraison (fiches 224, 230), vérifiée dans le code lors de la préparation de la
1.0.0-rc.1 (fiche 251). Mise en œuvre plus stricte que le point 3 (relecture de la fiche 224) : un déplacement est toujours demandé ; seul un fichier visible du premier niveau est accordé sans carte (sous-dossiers et fichiers cachés comme `.bob/` demandés), chemins relatifs ou en `~` demandés ; preuve `src/main/agent/write-area.ts:6-12,123-136`, `src/main/conversations/host-options.ts:110-112`.
