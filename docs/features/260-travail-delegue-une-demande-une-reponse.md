# 260 — Travail délégué : une demande, une réponse, une place

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 255, 258 (lot 1 des retours d'usage)
- **Agents** : les deux — tout est générique (rôles, travaux, fusion, relecture)

## Pourquoi

Recette réelle du 19 novembre (rapport `docs/recettes/2026-11-19-exploration-opencode-sol.md`,
constats D1–D41 et R1–R10) : l'utilisateur ne comprend plus les cartes du fil liées au travail
délégué. Une question à un rôle produit trois cartes identiques, l'avis lui-même est caché, la carte
« Sous-tâches » change de place, la fusion se déroule loin en haut du fil, le bilan « Terminé en … »
flotte sous des cartes arrivées après lui, et un avertissement bloque la saisie avant même qu'on ait
tapé (jusqu'à un commit vide sur un dépôt sans commit). Le vocabulaire est éclaté (fille,
sous-tâche, compte rendu, relecture…).

## Maquettes validées

`docs/maquettes/260-travail-delegue.html` (validées par Jérôme le 2026-11-19 : « J'aime bien »,
« Faut tout faire »). Décisions retenues pour les doutes de la page :

1. Coût nul : « gratuit », ou « inclus dans l'abonnement » quand l'agent est connecté par
   abonnement ; une seule fois par carte.
2. « Répondre à <rôle> » : nouvelle bulle @rôle ; la suite de l'échange s'ajoute dans la même
   carte-réponse (une carte par travail).
3. Transmission à l'agent principal : comportement actuel (avec le prochain message), dit
   clairement sur la carte (« Pas encore transmise… » → « Transmise à OpenCode »).
4. Rôle qui écrit sur un dossier non commité : « Partir sans elles » par défaut, retenu pour ce
   dossier jusqu'au prochain commit ; « Changer… » propose de committer d'abord.
5. Plusieurs @rôles dans un message : la même carte de groupe, sans l'étape « proposés ».
6. « Faire ici » : l'agent principal fait ce travail lui-même (comportement actuel).
7. Le repère « ↑ N travaux ont répondu · Voir » mène au plus ancien non vu.
8. **Les vérifications inventées de la fusion (« main n'a pas bougé », « tests de la branche ») sont
   retirées** : la carte ne montre que ce que la fusion fait réellement.
9. Noms de rôles : ceux de l'Équipe réelle.

## Le modèle (règles)

1. Ce qu'on confie est un **travail**, fait par un **rôle** (ou « un autre <agent> »). Les mots
   « fille », « sous-tâche », « compte rendu » quittent l'interface. Les sous-agents de l'agent
   restent dans le flux de ses outils.
2. Une demande à un rôle est une bulle « @Rôle … » dans le fil ; juste dessous, **une seule
   carte-réponse**, à cette place pour toujours : activité en direct, puis réponse complète en
   Markdown, puis actions (« Demander à <agent> de l'appliquer », « Répondre », « Ouvrir sa
   conversation »).
3. Un travail qui écrit déroule diff, relecture et fusion **dans sa carte**. Plusieurs travaux
   lancés ensemble forment **une carte de groupe** à place fixe.
4. En bas du fil, un **repère** (« ↑ … a répondu · Voir »), jamais une copie.
5. Le bilan du tour est **le pied de la réponse** qui finit le tour ; « Travaille encore… » tant
   qu'un sous-agent tourne.
6. Jamais d'alerte avant la frappe ; un rôle de conseil part en lecture seule dans le dossier ;
   Entrée envoie toujours ; un dépôt sans commit ne crée jamais de commit vide.
7. « Faire relire » lance le rôle Code reviewer, avec la même carte-réponse et ses remarques
   visibles.

## Plan (lots, dans cet ordre)

| Lot | Fiche | Écrans | Contenu |
|---|---|---|---|
| 1 | 261 | F, E | bilan dans le pied de la réponse ; repère en bas du fil |
| 1 | 262 | B | saisie avec un rôle : règles lecture seule / worktree, ligne discrète, « Changer… », Entrée, dépôt sans commit |
| 2 | 263 | A | bulle @rôle et carte-réponse unique (remplace lancement + ligne Sous-tâches + compte rendu pour un travail seul) |
| 3 | 264 | C, D | carte de groupe à place fixe (propositions → en cours → finis), fusion dans la carte |
| 4 | 265 | G | relecture par le rôle Code reviewer, remarques visibles |
| 5 | 266 | — | vocabulaire unique (fr/en), coût « gratuit » / « inclus dans l'abonnement » |

Les lots 261 et 262 tournent en parallèle (fichiers disjoints) ; les suivants l'un après l'autre
(ils touchent tous `Transcript.tsx`, `Subtasks.tsx`, `transcript.ts`). Les anciennes conversations
(éléments `child-started`, `child-report`, `review` déjà enregistrés) doivent toujours s'afficher.
Chaque lot : fiche propre, agent factice, tests, `./scripts/verify` ; suites e2e lancées par le
tech lead ; captures avant/après envoyées à Jérôme. À la fin : suite e2e complète, recette réelle
(OpenCode, parcours rôles), rc.2.

## Journal

- 2026-11-19 : maquettes validées, plan en 6 fiches (261–266).
- 2026-11-19 → 20 : lots livrés, chacun avec revue du tech lead, puis revues UX et QA :
  - **261** : bilan du tour dans le pied de la réponse qui le finit, « < 1 s » sous la seconde ;
    repère « ↑ … a répondu · Voir » en bas du fil.
  - **262** : saisie avec un rôle sans alerte avant la frappe, ligne discrète et « Changer… »,
    Entrée envoie ; dépôt sans commit : travail dans le dossier, jamais de commit vide.
  - **263** : bulle « @Rôle … » et carte-réponse unique (activité, réponse entière, transmission,
    « Répondre à <rôle> » dans la même carte).
  - **264** : carte de groupe à place fixe (proposés → en cours → ont répondu), fusion dans la carte ;
    vérifications inventées de la fusion retirées (décision 8).
  - **265** : « Faire relire » lance le rôle Code reviewer, remarques visibles, « Demander à <agent>
    de corriger », un autre modèle proposé.
  - **266** : vocabulaire unique (travail, réponse, a répondu, la conversation qui l'a lancé) en
    fr, en et dans le guide, essai des mots retirés ; coût « gratuit » / « coût non communiqué »
    (jamais un modèle payant présenté comme gratuit) ; écart à la décision 1 : « inclus dans
    l'abonnement » jamais affiché, aucun agent ne le dit ; D31, D32.
  Reste (hors de ce chantier) : recette réelle OpenCode (parcours rôles), rc.2.
