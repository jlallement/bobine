# 285 — Tour de table : une question, plusieurs modèles, une synthèse critique

- **Statut** : en cours (1.2, lots 1 à 4). Étude fonctionnelle et technique du 2026-11-24,
  révisée le même jour après les décisions de l'utilisateur, alignée sur les maquettes finales ;
  contrat partagé posé le 2026-11-24 (`src/shared/roundtable.ts`, `roundtable-prompts.ts`,
  `roundtable-ipc.ts`, voir « Plan »).
- **Dépend de** : 097, 160 (travaux et réveil groupé, ADR-0019, ADR-0020, ADR-0036), 108
  (destination des données, modèles vus), 112 et 118 (agent et modèle d'un travail), 157
  (plafond par conversation, ADR-0035), 177 et 265 (lecture seule vérifiée dans le même dossier),
  223 (rôles, consigne en tête, ADR-0045), 260 à 266 (bulle, carte-réponse, carte de groupe,
  vocabulaire et coût, ADR-0060, ADR-0061, ADR-0062), 196 (corbeille)
- **Agents** : les deux, générique. Les participants sont des travaux ordinaires, la synthèse est
  un tour de l'agent de la conversation. Tout passe par ACP et par le fil de Bobine. Le choix du
  modèle d'un participant suit la capacité de profil existante `childModelChoice` (ADR-0036) :
  OpenCode et l'agent factice l'ont, pas Bob. Aucune nouvelle capacité de profil, aucun mode
  imposé (ADR-0011).
- **Étude technique** : `docs/tour-de-table-etude-technique.md`. **ADR** : `docs/adr/0072-tour-de-table.md`
  (accepté le 2026-11-24).
- **Maquettes** (validées le 2026-11-24) : `docs/maquettes/1.2-tour-de-table-v2.html`, captures en
  clair et en sombre dans `docs/maquettes/1.2-tour-de-table-v2/` (`lancement-1-commande`,
  `lancement-2-pret`, `premier-usage`, `participants`, `surcout`, `carte-en-cours`, `avis-liste`,
  `apres-synthese`, `synthese-actions`, `replique`, `degrade-erreur`, `degrade-modele-refuse`,
  `degrade-un-seul-avis`, `fenetre-etroite`). Avis UX et choix tranchés :
  `docs/maquettes/1.2-tour-de-table-avis-ux.md`. En cas d'écart, les maquettes font foi pour
  l'écran, la fiche pour le comportement.

## Pourquoi

Avant une décision qui compte (une architecture, un diagnostic, un plan), un développeur demande
l'avis de plusieurs collègues, puis tranche. Aujourd'hui, dans Bobine, il faut ouvrir trois
conversations, recopier la question, puis recopier les réponses dans une quatrième pour les
comparer. Les avis se contaminent dès qu'on les recopie, et personne ne fait la critique.

Le **tour de table** (`/roundtable`) pose la même question à 2 à 5 modèles, sans qu'aucun voie les
avis des autres. L'agent de la conversation, dans le rôle de **tech lead**, compare ensuite les
avis, les challenge et rend une synthèse structurée qui tranche. Un seul tour de réplique est
possible. Personne n'écrit de fichier pendant le tour de table.

## Décisions de l'utilisateur (2026-11-24)

Elles priment sur le reste de la fiche, de l'étude et de l'ADR.

1. **Simplicité d'abord.** Un tour de table se lance en deux gestes ; le choix des participants
   se règle une fois.
2. **Rien de particulier pour les modèles gratuits** : ni étiquette, ni filtre, ni groupe par
   défaut, ni mise en avant.
3. **Aucune estimation de coût avant l'envoi**, ni en argent, ni en jetons.
4. **Pas de plafond propre au tour de table.** Le plafond par conversation, s'il est activé,
   s'applique tel qu'il est (voir « Plafond par conversation »).
5. **Surcoût précisé, mais discret** : une ligne avant l'envoi, un rappel sur le bouton de
   réplique, le total consommé en une ligne au pied de la carte. Ni bandeau, ni dialogue de
   confirmation.
6. **Avis rendus : une liste repliable**, sans vue côte à côte.
7. **Conservé** : lancement par l'utilisateur en v1 (par l'agent plus tard) ; avis indépendants,
   puis synthèse critique en six rubriques ; une seule réplique, à la demande ; participants en
   lecture seule ; 2 à 5 participants ; interface générique.

Seconde série, sur les maquettes (2026-11-24) :

8. **Participants : menu à cases**, ouvert par « 3 participants ▾ » dans la ligne du tour de
   table, sur le modèle du menu de modèle. Le dernier choix est retenu ; il n'y a ni bouton
   « Enregistrer », ni groupe à nommer, ni entrée dans les Réglages.
9. **Surcoût dans la ligne du tour de table**, sous la question, en gris, sur une seule ligne. Il
   dit explicitement que c'est la **consommation de jetons** qui est multipliée : « 3 participants
   ▾ + synthèse · ≈ 4 fois les jetons d'une question simple ». La même formule est à côté de
   « Faire réagir les participants ».
10. **Après la synthèse, la carte se replie en une ligne** ; les avis restent à un clic.
11. **Avis anonymisés pour la synthèse** : « Participant A, B, C », dans un ordre mélangé ;
    l'interface montre les vrais noms à l'utilisateur.
12. **Anciennes questions ouvertes**, recommandations retenues par le tech lead : voir
    « Décisions du 2026-11-24 (anciennes questions ouvertes) ».

## État de l'art (court)

Recherche du 2026-11-24. Les formes rencontrées :

| Forme | Exemples | Ce qui marche | Ce qui échoue |
|---|---|---|---|
| **Comparaison côte à côte**, sans synthèse | Chatroom d'OpenRouter, comparaison de Poe, ChatHub, `/compare` de Krater | Rapide, transparent, chaque réponse lisible | L'utilisateur fait seul la synthèse. Lire 4 longues réponses fatigue, on finit par n'en lire qu'une. |
| **Conseil de modèles** : avis indépendants, revue croisée anonymisée, puis président qui synthétise | `llm-council` (Karpathy) | Indépendance au premier tour. L'anonymisation de la revue évite les préférences de marque. | Les modèles préfèrent les réponses longues. Le président a ses propres goûts. Le coût est N + N revues + 1 (« weekend hack », de l'aveu de l'auteur). |
| **Mixture of Agents** : des « proposeurs », puis un « agrégateur » | Together AI (ICLR 2025) | La synthèse réécrite bat le simple choix de la meilleure réponse. Les modèles s'améliorent en voyant d'autres réponses. | Tous les modèles ne savent pas agréger : un bon proposeur peut être un mauvais agrégateur. Les couches multiplient coût et latence. |
| **Débat multi-agents** (plusieurs rondes) | Littérature « MAD » | La diversité des modèles aide. | Souvent pas mieux que des stratégies simples (self-consistency) pour un coût bien plus grand. **Conformisme** : les agents se rallient à la majorité ou au plus persuasif, jusqu'à un consensus prématuré. |
| **Positions imposées** (pour, contre, neutre) | outil `consensus` du serveur MCP Zen | Force la contradiction et évite la synthèse molle. | La contradiction est artificielle : un avis « contre » peut défendre une mauvaise idée. |
| **Plusieurs modèles sur la même tâche dans l'IDE**, puis jugement | Cursor (« Use Multiple Models », `/best-of-n`, jugement multi-agents de la 2.2) | Chaque exécution a son worktree. Le parent compare. | L'outil est orienté code produit, pas avis. Le parcours change souvent, et la fonction a été retirée puis remise selon les versions. |
| **Juge LLM** | Littérature « LLM-as-a-judge » | Un juge structuré passe à l'échelle. | **Biais d'auto-préférence** : un juge note mieux le texte qui lui ressemble, souvent le sien. Il note aussi mieux le texte le plus long. |

Ce qu'on en retient pour Bobine :

1. **L'indépendance au premier tour n'est pas négociable.** On ne montre jamais un avis à un autre
   participant avant qu'il ait rendu le sien. C'est la seule défense simple contre le conformisme.
2. **Le format des avis est court et comparable** : une longueur bornée et les mêmes rubriques
   pour tous. La longueur ne doit pas gagner par défaut.
3. **La synthèse doit trancher.** Une structure imposée, l'interdiction de compter les voix, et
   l'obligation de dire ce qui est rejeté et pourquoi. C'est l'antidote à la synthèse molle
   (« chacun a un peu raison »).
4. **Une seule réplique**, et seulement à la demande. Les rondes de débat coûtent cher et
   convergent vers la majorité. La consigne de réplique dit de ne changer d'avis que devant un
   argument ou une preuve, et de nommer lequel.
5. **Le plus lent ne doit pas tenir tout le monde en otage** : « Synthétiser sans attendre » dès
   que deux avis sont là.
6. **Le surcoût se dit**, en peu de mots : c'est N + 1 tours d'agent, souvent plus, car les
   participants lisent du code et la synthèse lit tous les avis.
7. L'anonymisation des avis donnés au tech lead est la contre-mesure documentée aux biais
   d'identité et d'auto-préférence : elle est retenue (décision 11).

Sources :

- https://github.com/karpathy/llm-council (projet et présentation :
  https://venturebeat.com/ai/a-weekend-vibe-code-hack-by-andrej-karpathy-quietly-sketches-the-missing)
- https://arxiv.org/abs/2406.04692 (Mixture-of-Agents, Wang et al., ICLR 2025)
- https://arxiv.org/abs/2311.17371 (« Should we be going MAD? », Smit et al.)
- https://arxiv.org/abs/2502.08788 (« Stop Overvaluing Multi-Agent Debate », Zhang et al., 2025 :
  l'hétérogénéité des modèles aide)
- https://arxiv.org/abs/2506.01332 (conformisme de groupe dans les systèmes multi-agents)
- https://arxiv.org/abs/2509.23055 (la complaisance mène au consensus prématuré dans le débat)
- https://arxiv.org/abs/2410.21819 (« Self-Preference Bias in LLM-as-a-Judge », Wataoka et al.)
- https://openrouter.ai/chat (comparaison côte à côte)
- https://glama.ai/mcp/servers/@BeehiveInnovations/zen-mcp-server/blob/7afc7c1cc96e23992c8f105f960132c657883bb1/docs/tools/consensus.md
  (positions imposées)
- https://forum.cursor.com/t/cursor-2-2-multi-agent-judging/145826 et
  https://forum.cursor.com/t/cant-use-mutiple-models-simultaneously/156063 (Cursor : jugement
  multi-agents, puis retrait du sélecteur multi-modèles)

Ces sources sont surtout des prépublications et des forums. Les chiffres ne se comparent pas d'une
étude à l'autre. On en retient des tendances, pas des mesures.

## Cas d'usage réels

1. **Choix d'architecture.** « Pour la synchro hors ligne de l'app Flutter : CRDT, journal
   d'opérations côté serveur, ou dernier écrit gagne ? Voici les contraintes. » Trois modèles
   d'OpenCode et Bob donnent leur avis. Le tech lead relève l'accord sur le journal d'opérations et
   rejette le CRDT, trop lourd pour deux écrans. Il laisse ouverte la question des conflits de
   suppression.
2. **Diagnostic d'un bug.** « Les essais `filles-fusion` échouent 1 fois sur 4 ; voici la trace. »
   Chaque participant lit le code, en lecture seule, et propose sa cause avec `fichier:ligne`. La
   synthèse classe les hypothèses selon leurs preuves et propose l'essai qui les départage.
3. **Relecture d'un plan.** « Relisez le plan de la fiche 285 avant qu'on code. » Les avis disent
   ce qui manque. Le tech lead garde trois remarques et en rejette deux, en disant pourquoi.
   « Appliquer » lui fait corriger la fiche.
4. **Estimation de risque avant une mise à jour.** « Passer à la version 3 du SDK ACP : qu'est-ce
   qui casse ? » Les avis convergent sur deux points. Un participant seul signale un risque que les
   autres n'ont pas vu. La synthèse le retient parce qu'il est prouvé par un fichier cité.
5. **Choix entre deux formulations ou deux interfaces.** « Libellé du bouton : “Appliquer” ou
   “Demander à l'agent d'appliquer” ? » Une question courte, des avis courts.
6. **Contre-expertise d'une réponse de Bob.** Bob, tech lead, vient de proposer une migration de
   base. L'utilisateur lance un tour de table avec trois modèles d'OpenCode sur cette proposition :
   les participants la reçoivent avec le dernier échange (décision D2), et Bob doit
   répondre aux objections dans sa synthèse.

## Parcours complet

### 1. Lancement : deux gestes

Maquettes `lancement-1-commande` et `lancement-2-pret`.

- On tape `/roundtable` suivi de la question, ou on clique le bouton du tour de table dans la barre
  de la saisie : la question porte alors l'étiquette « Tour de table ». Une **ligne du tour de
  table** s'affiche dans la saisie, sous la question, au-dessus de la barre, sans dialogue ni
  feuille :

  > ⁘ 3 participants ▾ + synthèse · ≈ 4 fois les jetons d'une question simple ✕

- **Entrée envoie.** Les deux gestes sont donc : taper `/roundtable question` (ou le bouton, puis
  la question), puis Entrée. Échap ou ✕ ramène à une question simple.
- La ligne reste discrète : « 3 participants ▾ » ouvre le menu des participants ; le reste est en
  gris, sur une seule ligne (voir « Surcoût » pour la formule et sa forme courte).
- **Au survol de « 3 participants »**, une infobulle donne la destination de chaque participant et
  ce qui part en plus de la question (fichiers joints, dernier échange) : maquette `surcout`. Ce
  détail n'est pas sur la ligne, pour qu'elle tienne sur une ligne.
- `/roundtable` seul, sans question, explique en une phrase comment s'en servir et n'envoie rien,
  comme `/split`. La commande figure dans l'aide des commandes et dans le menu `/`. Le bouton de la
  barre est l'autre point d'entrée ; il n'y en a pas d'autre en v1.

### 2. Les participants : un menu à cases, le dernier choix retenu

Maquettes `participants` et `premier-usage`.

- **Le menu.** « 3 participants ▾ » ouvre un menu à cases, comme le menu de modèle : titre
  « Participants · 2 à 5 », une ligne par couple agent et modèle (le nom du modèle, l'agent en
  gris à droite), « Autres modèles… » pour chercher dans la liste complète, et une phrase en pied :
  « Chacun reçoit la question et peut lire les fichiers de ce dossier. » Le compte de la ligne et
  le surcoût suivent les cases cochées.
- **Le dernier choix est le choix par défaut.** Chaque case cochée ou décochée est retenue aussitôt
  (préférence de l'app), pour ce tour et les suivants, toutes conversations confondues. Il n'y a
  ni bouton « Enregistrer », ni groupe à nommer, ni entrée dans les Réglages : le menu est le seul
  endroit où l'on choisit.
- **Premier usage.** Tant qu'aucun participant n'est retenu, rien n'est présélectionné : la ligne
  dit « Choisir les participants ▾ · 2 à 5 modèles », le bouton d'envoi est atténué, et Entrée
  ouvre le menu au lieu d'envoyer. Dès deux cases cochées, la ligne prend sa forme habituelle et
  Entrée envoie. C'est le même menu que les fois suivantes : pas d'écran propre au premier usage.
- **De 2 à 5 participants.** Un participant est un couple agent et modèle, par exemple
  « OpenCode · Qwen3 32B » ou « IBM Bob ».
  - Pour un agent qui permet le choix du modèle (`childModelChoice`), on choisit parmi ses modèles
    connus : les options de sa session si c'est l'agent de la conversation, sinon les modèles vus
    lors de sa dernière session (`modelsSeen`, fiche 108). Les modèles **récemment utilisés**
    d'abord, puis « Autres modèles… » pour les autres (décision C6), sans autre mise en avant.
  - Pour un agent qui ne le permet pas (Bob), une seule ligne « IBM Bob », au plus une fois.
  - Un couple agent et modèle déjà présent est refusé : deux fois le même modèle n'apporte pas
    d'indépendance.
- **Le modèle du tech lead peut participer.** Il répond alors à neuf, dans sa propre conversation.
- **Destination des données.** Le menu montre l'agent de chaque participant et sa phrase de pied
  (« Chacun reçoit la question et peut lire les fichiers de ce dossier. ») ; l'infobulle de
  « 3 participants » donne la destination complète de chacun d'après `destinationOf` (fiche 108) et
  ce qui part avec la question. C'est la seule explication du tour de table ; il n'y a pas
  d'encadré de premier usage (voir « Surcoût »).
- **Places.** Les participants comptent dans « Travaux en même temps, au plus » (ADR-0020). S'il
  manque des places, la ligne le dit à la place du surcoût (« Il manque 2 places de travaux ·
  Réglages ») et Entrée n'envoie pas. On ne lance jamais un tour partiel.

### 3. Ce que reçoit chaque participant

Chaque participant travaille dans **sa propre conversation**, un travail en **lecture seule** dans
le dossier de la conversation d'origine, sans worktree. C'est le mécanisme d'un rôle de conseil
(fiches 223, 262) : refus d'office des écritures demandées, empreinte git avant et après, et
lecture seule seulement demandée pour un agent qui écrit sans demander.

Son premier message contient, dans cet ordre (l'ordre réel, voulu : un agent qui titre sa tâche
d'après le début du premier message, comme Bob, garde la question, fiche 125) :

1. **La question**, telle que tapée.
2. **Le dernier échange de la conversation**, s'il y en a un : dernier message et dernière
   réponse, sur le rendu de la fiche 108 (`conversationText`), borné à environ 8 000 caractères
   (décision D2), encadré comme une donnée. Sans case à cocher ; l'infobulle de « 3 participants »
   le dit.
3. **La consigne du participant** (bloc `<bobine_role name="participant">`), en anglais, car ce
   qui va à l'agent ne se traduit pas (ADR-0014). Voir « Consigne donnée aux participants ».

**Les pièces jointes du message** partent avec ce premier message (blocs à part). Le participant
peut lire le dépôt lui-même : il a ses outils de lecture.

Ce qu'un participant ne reçoit jamais : les avis des autres, le nom des autres modèles, et le reste
du fil. Il n'a aucun outil de Bobine (mémoire comprise).

### 4. L'attente

- Dans le fil, une **bulle** « Tour de table » avec la question, puis, juste dessous, **une carte
  de tour de table** à place fixe (maquette `carte-en-cours`). C'est la carte de groupe de la
  fiche 264, généralisée : une ligne repliée par participant (modèle · agent, état, temps écoulé,
  outil en cours). Ni jetons ni coût par ligne, ni bandeau d'attente. Le pied rappelle « Lecture
  seule · chacun répond sans voir les autres ».
- Les avis arrivent dans le désordre. Chaque ligne passe à « a répondu ». La carte dit « 2 avis
  sur 4 ».
- **« Synthétiser sans attendre »** apparaît dès que deux avis sont là. Il lance la synthèse avec
  les avis présents ; les autres participants sont arrêtés.
- Il n'y a pas de délai ni de minuterie. Un participant silencieux le montre sur sa ligne (état de
  silence déjà suivi, fiche 194).
- « Arrêter » sur une ligne arrête ce participant. « Arrêter le tour de table » arrête tout, sans
  synthèse.
- La saisie reste libre. Voir « Une question envoyée pendant un tour ».

### 5. Les avis : une liste repliable

- Maquette `avis-liste`. Chaque ligne se déplie sur la **réponse entière** du participant, en
  Markdown, un seul avis déplié à la fois, repliée après une
  dizaine de lignes avec « Lire la suite ». C'est la carte-réponse de la fiche 263 (20 000
  caractères gardés au plus). Une seule présentation : la liste. Pas de vue côte à côte.
- Repliée, la ligne montre la **réponse courte** et la **confiance** (haute, moyenne, basse), lues
  dans les rubriques imposées. Si un modèle ne respecte pas le format, l'avis s'affiche tel quel,
  avec une mention discrète « format non suivi ». Rien ne s'invente.
- « Ouvrir sa conversation » reste possible. Les avis **ne partent pas** à l'agent de la
  conversation avec le prochain message de l'utilisateur, contrairement aux travaux : ils lui
  parviennent seulement par la demande de synthèse, une fois.

### 6. La synthèse

- **Déclenchement.** Quand tous les participants ont fini (répondu, en erreur ou arrêtés) et qu'au
  moins **deux avis** sont exploitables, l'app envoie **d'elle-même** à l'agent de la conversation
  une **demande de synthèse**, dès qu'il est au repos (décision D3). Elle est visible dans le fil
  comme une ligne de l'app (provenance « Tour de table »). Un participant en erreur n'arrête rien :
  la synthèse part avec les avis présents et nomme l'absent (maquette `degrade-erreur`). Seule
  exception : après un redémarrage de l'app, rien ne part seul ; le pied propose « Synthétiser avec
  N avis ».
- **Contenu de la demande** : la question, la consigne du tech lead, et les avis. Chaque avis est
  borné à 6 000 caractères ; la coupure est dite. Les avis sont **anonymisés** (décision 11) :
  désignés par une lettre, « Participant A, B, C… », tirée dans un ordre mélangé à chaque tour. Le
  tech lead ne reçoit ni le nom des modèles ni la table des lettres, même quand son propre modèle
  participe. Les absents sont nommés par leur lettre, avec la raison (« Participant C : pas
  d'avis, en erreur »). Le tech lead peut lire le dépôt pour vérifier une affirmation.
- **Affichage.** La synthèse est la réponse de l'agent dans le fil, juste sous la carte, marquée
  « Synthèse du tour de table · <modèle> » (maquette `synthese-actions`). L'interface montre les
  vrais noms : un survol de « Participant C » dans la synthèse montre « IBM Bob ». La table des
  lettres vit dans l'élément du tour, côté app seulement.
- **La carte se replie en une ligne** dès que la synthèse arrive (maquette `apres-synthese`) :
  « Tour de table · DeepSeek V4.1 Flash, GLM 5.3 Flash, IBM Bob · 3 avis › », puis la ligne
  « Consommé ». Un clic sur la ligne rouvre la liste des avis. La synthèse est ainsi la seule chose
  à lire.
- Le **pied de la carte** donne le total consommé (voir « Surcoût ») et les actions de la suite.

### 7. La réplique

- Le bouton **« Faire réagir les participants »** sous la synthèse, action secondaire à côté de
  « Demander à <agent> de l'appliquer », suivi en gris du rappel « ≈ 4 fois les jetons d'une
  question simple » (N répliques et la décision). Aucun dialogue.
- Chaque participant qui a répondu reçoit, **dans sa propre conversation** (qui garde son premier
  avis), **la synthèse entière**, bornée à 8 000 caractères, avec la lettre qui le désigne
  (« Tu es le participant B ») pour y trouver les objections qui le visent. Il ne reçoit pas les
  avis des autres. La consigne de réplique : réponse courte (≈ 200 mots) ; garder sa position si
  ses arguments tiennent, ne la changer que devant un argument ou une preuve, en disant lequel ;
  dire ce qui a changé.
- Les répliques s'ajoutent dans une carte « Réplique » (maquette `replique`), même présentation
  repliable ; chaque ligne dit « maintient », « nuance » ou « se rallie ».
- Le tech lead reçoit ensuite les répliques, bornées et désignées de la même façon, et
  **tranche** : sa réponse est marquée « Décision du tour de table ». Elle reprend la structure de
  la synthèse, en plus court, avec une rubrique « Ce qui a changé après la réplique ».
- **Une seule réplique par tour de table**, garantie par le main. Le bouton disparaît après usage.
  Pour aller plus loin, on lance un nouveau tour de table.

### 8. La suite

- **« Demander à <agent> de l'appliquer »**, sous la synthèse ou la décision : envoie directement
  le message « Applique ta recommandation du tour de table. », comme le bouton du même nom des
  cartes de travaux (fiche 263) — décision du tech lead du 2026-11-24, qui remplace « met dans la
  saisie ». Un envoi à la fois ; masqué si un message de l'utilisateur suit déjà le tour, ou si un
  message attend dans la file. L'agent travaille alors normalement, avec ses autorisations
  habituelles : c'est le seul moment où des fichiers peuvent changer.
- « Ouvrir sa conversation » : la conversation du participant, ouvrable comme tout travail. Ce
  qu'on y échange ensuite ne revient pas au tech lead.

## Structure imposée de la synthèse du tech lead

La consigne du tech lead (en anglais, rendue ici en français) impose ces six rubriques, dans cet
ordre :

1. **Accords** : ce sur quoi les avis convergent, et si l'accord est fondé sur des preuves ou
   seulement partagé.
2. **Divergences, et pourquoi** : pour chaque désaccord, la cause (hypothèse différente,
   information manquante, préférence, erreur).
3. **Ce que je retiens** : les arguments gardés, avec la lettre du participant et la preuve
   (`fichier:ligne`, essai, documentation).
4. **Ce que je rejette, argumenté** : au moins un point rejeté, avec la lettre du participant, ou
   la phrase explicite « rien à rejeter, parce que… ». Jamais un rejet sans raison.
5. **Ce qui reste ouvert** : ce qu'aucun avis ne règle, et ce qu'il faudrait savoir ou essayer
   pour le régler.
6. **Ma recommandation** : une position nette, avec son niveau de confiance. Si les éléments ne
   suffisent pas, il le dit et donne l'étape qui permettrait de trancher.

Règles données au tech lead :

- La majorité n'est pas une preuve : ne pas compter les voix.
- La longueur ou l'assurance d'un avis ne lui donnent aucun poids.
- Vérifier soi-même, avec ses outils de lecture, une affirmation décisive quand c'est peu coûteux.
- Signaler un avis sans preuve sur un point qui en demande une.
- Ne rien modifier pendant la synthèse : on applique seulement à la demande de l'utilisateur.
- Répondre dans la langue de la question.

## Consigne donnée aux participants

En anglais, résumée ici. Le participant :

- donne **son propre avis**, indépendant ; il ne verra la synthèse que s'il y a une réplique ;
- est **en lecture seule** : il lit le code, il ne crée, ne modifie, ne supprime ni ne committe
  rien (même texte que les rôles de conseil) ;
- lit ce qu'il faut pour répondre, pas plus, car le temps et le coût comptent ;
- répond dans la langue de la question, en **400 mots au plus**, avec ces rubriques :
  1. **Réponse courte** : deux phrases au plus.
  2. **Arguments** : cinq au plus, chacun avec sa preuve quand il y en a une (`fichier:ligne`,
     sortie de commande, documentation).
  3. **Hypothèses** : ce qu'il suppose sans l'avoir vérifié.
  4. **Ce qui me ferait changer d'avis.**
  5. **Confiance** : haute, moyenne ou basse, et pourquoi en une phrase.
- dit « je ne sais pas » plutôt que d'inventer ;
- ne propose pas de patch complet : un extrait de quelques lignes suffit pour illustrer.

## Cas limites

- **Un participant en erreur** (modèle injoignable, erreur ACP, session qui ne s'ouvre pas) : sa
  ligne passe à « en erreur », avec la raison en clair, et propose « Relancer » tant que d'autres
  participants travaillent encore. Les autres continuent. Quand tous ont fini avec au moins deux
  avis, la synthèse part seule ; la ligne dit « sans avis ».
- **Un modèle introuvable ou non appliqué** (absent du catalogue de l'agent : « modèle
  introuvable » ; réglage refusé ou valeur relue différente : « modèle non appliqué ») : **pas de
  substitution silencieuse** (décision C4). L'avis D32 de la fiche 266 remplace un modèle non proposé par le
  modèle par défaut ; ici, ce remplacement casserait l'indépendance (deux participants sur le même
  modèle sans le savoir). Le participant est « en erreur : modèle non appliqué », la question ne
  lui est pas envoyée (maquette `degrade-modele-refuse`). « Choisir un autre modèle » ouvre le menu
  des participants : le changement vaut pour les tours suivants ; ce tour continue sans lui. Pas
  d'ajout de participant en cours de tour.
- **Un participant arrêté** par l'utilisateur : son avis est absent ; la synthèse le dit.
- **Moins de deux avis** (tous les autres en erreur ou arrêtés) : pas de synthèse. La carte dit
  « Un seul avis : pas de synthèse. » (ou « Aucun avis ») et garde « Relancer » sur les lignes
  sans avis (maquette `degrade-un-seul-avis`). Aucun autre bouton, aucun coût de synthèse.
- **Le plafond par conversation** : voir « Plafond par conversation ».
- **Une question envoyée pendant un tour** : la saisie reste libre, et le message part à l'agent
  de la conversation comme d'habitude, sans les avis. Si la synthèse doit partir pendant que
  l'agent répond, elle attend la fin de sa réponse. Un second `/roundtable` dans la même
  conversation est refusé tant que le premier n'a pas rendu sa synthèse : un tour de table à la
  fois par conversation.
- **Une conversation fille** : pas de tour de table depuis un travail (un travail n'a pas de
  travaux, ADR-0019) ; `/roundtable` le dit.
- **Un participant retenu devenu indisponible** (agent retiré des réglages) : la ligne le dit
  et la ligne du tour de table renvoie au menu des participants ; rien ne part avec moins de deux
  participants.
- **Une conversation hors dépôt git** : le tour de table marche, car les participants sont en
  lecture seule dans le dossier, comme un rôle de conseil (fiche 262). Sans git, la surveillance
  par empreinte est impossible : la ligne du participant dit « lecture seule demandée, non
  vérifiée (dossier hors git) ».
- **Bob tech lead, participants OpenCode** : les avis, bornés, ménagent le contexte de Bob, qui
  sature vite. Rien n'est supposé de Bob : la demande de synthèse est un message ordinaire.
- **OpenCode tech lead, Bob participant** : Bob, sans choix de modèle, figure une seule fois. Sa
  lecture seule est effective, puisqu'il demande avant d'écrire et que la demande est refusée. Son
  coût en bobcoins est lu dans sa base, après la réponse. Pour les participants OpenCode, la
  lecture seule n'est que demandée (`writesWithoutAsking`), et leur ligne le dit, sauf si le rôle
  « Participant » est installé dans OpenCode (décision C3).
- **Une conversation d'origine déjà longue** : les participants ne reçoivent que le dernier
  échange, borné ; la synthèse ajoute au tech lead N avis bornés à 6 000 caractères. La jauge de
  contexte habituelle suffit ; rien de plus n'est affiché.
- **Un redémarrage de l'app au milieu** : l'état du tour de table **se lit du fil** (élément du
  tour, lancements, réponses), comme les cartes des ADR-0060 et 0061 ; rien n'est gardé seulement
  en mémoire.
  - Les participants en cours au moment de l'arrêt sont « arrêtés (redémarrage) » et proposent
    « Relancer ».
  - La synthèse **ne part pas seule après un redémarrage**, pour ne pas dépenser sans geste. La
    carte propose « Synthétiser avec N avis » (si N ≥ 2).
  - Une synthèse ou une réplique interrompue se relance par le même bouton.
- **La corbeille et l'archivage** :
  - les participants suivent la conversation d'origine comme ses autres travaux : archivés avec
    elle, supprimés avec elle ou détachés selon la confirmation de famille (fiche 228) ;
  - mettre la conversation d'un participant à la corbeille avant la synthèse la sort de la synthèse
    et de la réplique ; après, son avis reste lisible dans la carte ; sa ligne dit « à la
    corbeille » (restaurable, sans « Ouvrir ») ou « conversation supprimée » (corbeille vidée),
    selon le contrat du moteur (recette fonctionnelle S1/S2, branchement de l'interface en attente) ;
  - les conversations des participants ne figurent dans la barre latérale que tant que leur tour
    est en cours (recueil ou réplique), sauf la conversation affichée ; ensuite, on les ouvre depuis
    la carte ou par la recherche (décision M7 du tech lead, 2026-11-25).
- **Le dossier modifié pendant le tour** (par l'utilisateur ou un autre agent) : avis neutre de
  la lecture seule, déjà existant. Le tour de table continue.

## Surcoût

Un tour de table coûte **nettement plus** qu'une question simple : N tours de participants, plus
la synthèse, plus, sur demande, N répliques et la décision. L'interface le dit en peu de mots, sans
alarme, sans chiffre deviné, et sans confirmation de plus.

1. **Avant l'envoi**, dans la ligne du tour de table, sous la question, en gris, sur une seule
   ligne : « 3 participants ▾ + synthèse · ≈ 4 fois les jetons d'une question simple ». Elle dit
   ce qui est multiplié : la **consommation de jetons**. Le multiplicateur vaut N + 1 (2
   participants ≈ 3 fois, 5 ≈ 6 fois). C'est un compte de tours, pas une estimation : il ne
   dépend d'aucun prix, et la ligne ne donne aucun nombre de jetons.
   - En anglais : « 3 participants ▾ + synthesis · ≈ 4× the tokens of a plain question ».
   - **Forme courte**, quand la saisie est trop étroite pour la phrase entière (moins de 560 px
     environ) : « + synthèse · ≈ 4 fois plus de jetons » (« + synthesis · ≈ 4× more tokens ») ;
     la phrase entière reste dans l'infobulle. Le mot « jetons » ne disparaît jamais, et le texte
     n'est jamais coupé par des points de suspension (maquette `fenetre-etroite`).
2. **À côté du bouton de réplique**, en gris : « ≈ 4 fois les jetons d'une question simple »
   (N répliques et la décision).
3. **Au pied de la carte**, une ligne : le total réellement consommé par le tour (participants,
   synthèse, réplique et décision), avec les chiffres que les agents communiquent, par unité, sans
   conversion : « Consommé : 182 000 jetons · ≈ 0,04 $US + 0,6 bobcoin ». Un participant qui ne
   communique rien est dit (« 1 participant sans chiffre »). Le total avance pendant le tour. Les
   chiffres de chaque participant restent visibles dans sa conversation, comme pour tout travail.
4. **Premier usage** : pas d'encadré. La phrase du menu des participants et la ligne du tour de
   table suffisent ; un encadré de plus demanderait un état « Compris » à retenir, pour une
   information que la ligne redonne à chaque fois.

## Plafond par conversation

Le tour de table n'a **pas de plafond propre** et n'ajoute aucun réglage. Si le plafond par
conversation (fiche 157) est activé, il s'applique tel qu'il fonctionne aujourd'hui, **à chaque
conversation séparément** : chaque participant a le sien, le tech lead a le sien. Il n'y a pas de
plafond sur le total du tour.

Comment il fonctionne aujourd'hui avec les conversations filles (vérifié dans le code) :

- Le gardien est unique et suit toutes les conversations, filles comprises
  (`src/main/index.ts:697`, abonnement `src/main/conversations/cost-cap.ts:90`).
- Au premier message d'une conversation, si le réglage est activé, il fige `settings` dans son fil
  (`cost-cap.ts:178`, `:219-231`). Le premier message d'une fille passe par le même chemin
  (`ChildConversations.launch` → `prompt`, `children.ts:962` ; évènement `user-message`,
  `agent-host.ts:607-608`) : une fille née après l'activation a donc son propre plafond, au
  montant des réglages. Le réglage est désactivé par défaut (`shared/preferences.ts:248`).
- La dépense comptée est celle de la conversation seule (`spentIn`, `shared/cost-cap.ts:84-89`).
  Le coût des filles n'est pas ajouté à celui de la mère (seul l'aparté l'est,
  `shared/transcript.ts:409-410`).
- Franchi pendant un tour, sans outil en cours, il interrompt le tour et pose la carte « Plafond
  atteint » dans le fil de cette conversation (`cost-cap.ts:202-216`).
- Tout envoi passe par la garde (`promptGate`, `manager.ts:672`) : un message vers une
  conversation au plafond est retenu, avec la carte. Cela vaut pour un message de l'app vers une
  fille (`deliver`, `children.ts:897`). « Continuer » renvoie le message retenu avec ses options
  (`cost-cap.ts:133-134`).

Ce que cela donne pour un tour de table, sans nouvelle interface :

- **Un participant au plafond** : son avis est interrompu ; sa ligne passe à « arrêté : plafond
  atteint », et la carte « Plafond atteint » est dans sa conversation (« Ouvrir »). Il compte comme
  un participant arrêté.
- **La synthèse ou la décision au plafond du tech lead** : la demande est retenue, et la carte
  « Plafond atteint » habituelle s'affiche dans la conversation d'origine, sous les yeux de
  l'utilisateur. « Continuer » l'envoie.
- **Une réplique au plafond d'un participant** : retenue de la même façon ; sa ligne dit
  « réplique retenue : plafond atteint ».

## Ce qui n'est PAS dans la v1

- L'agent qui **propose** un tour de table (carte de proposition à confirmer) : étape suivante.
- Toute **estimation de coût** avant l'envoi, en argent ou en jetons.
- Un **plafond propre au tour de table**, ou un réglage qui lui serait propre : les participants
  se choisissent dans le menu de la saisie seulement, sans entrée dans les Réglages.
- Un **délai** par participant.
- Une **vue côte à côte** des avis.
- Un **total des tours de table dans Mon activité** : il demande une migration du journal (colonne
  `roundtable_id`), reportée après la v1. Les participants y figurent comme des conversations
  séparées (une ligne chacun), pas comme des travaux de la conversation d'origine (recette
  fonctionnelle du 2026-11-25).
- Une mise en avant, une étiquette ou un groupe par défaut pour les **modèles gratuits**.
- Un encadré d'explication de premier usage.
- « Poser une question à un participant » depuis la carte : on ouvre sa conversation.
- Une entrée « Tour de table… » dans le menu de la conversation : `/roundtable` et le bouton de
  la saisie seulement en v1.
- Un participant ajouté ou remplacé en cours de tour.
- « Le faire commenter par la conversation » quand il n'y a qu'un avis.
- Des **rôles** comme participants (« Expert sécu sur Bob, Architecte back sur Qwen ») : la
  structure le permettra, mais la v1 ne prend que des couples agent et modèle.
- Des positions imposées (pour, contre) ou un avocat du diable désigné.
- Plus d'une réplique, un débat en plusieurs rondes, ou une revue croisée où chaque participant
  note les autres (étape 2 de `llm-council`).
- Un vote, un score, ou un classement des participants.
- Un tour de table en écriture, avec des worktrees et du code produit en parallèle à comparer :
  c'est « Lancer en parallèle », à part.
- Un tour de table **dans un travail** (un travail n'a pas de travaux, ADR-0019).
- Le choix d'un autre tech lead que l'agent de la conversation.
- Un dossier de contexte rédigé par un modèle.
- L'export dédié d'un tour de table : l'export de la conversation le contient.

## Critères d'acceptation

**Lancement et participants**

- [x] `/roundtable <question>` (ou le bouton de la saisie) affiche la ligne du tour de table sous
      la question : « N participants ▾ + synthèse · ≈ N + 1 fois les jetons d'une question
      simple », en gris, sur une ligne, forme courte en saisie étroite, jamais coupée ; Entrée
      envoie. `/roundtable` seul explique et n'envoie rien. La commande est listée dans l'aide.
- [x] « N participants ▾ » ouvre le menu à cases ; chaque case est retenue aussitôt pour les
      tours suivants, sans bouton « Enregistrer » ni entrée dans les Réglages. Sans participant
      retenu, la ligne dit « Choisir les participants ▾ », rien n'est présélectionné, et Entrée
      ouvre le menu au lieu d'envoyer.
- [x] Le menu accepte de 2 à 5 participants : il refuse un doublon d'agent et de modèle, ne
      propose Bob qu'une fois et sans modèle, et montre l'agent de chacun ; l'infobulle de « N
      participants » donne la destination et ce qui part avec la question. Aucun modèle n'est mis
      en avant ou étiqueté à part.
- [x] S'il manque des places de travaux, la ligne le dit et rien ne part.

**Indépendance et lecture seule**

- [x] Chaque participant reçoit consigne, question, fichiers et dernier échange borné, et
      **jamais** l'avis ni le nom d'un autre. Vérifié par un scénario de
      l'agent factice qui répète ce qu'il a reçu.
- [x] Les participants sont en lecture seule dans le dossier d'origine, sans worktree, sans outil
      de Bobine : écritures demandées refusées, empreinte comparée, mention « lecture seule
      demandée » pour un agent qui écrit sans demander, « non vérifiée » hors git.
- [x] Un modèle non appliqué met le participant en erreur avant l'envoi de la question, sans
      substitution.

**Attente, avis, synthèse**

- [x] La bulle et la carte du tour de table restent à leur place. Chaque ligne a son état et sa
      durée ; repliée, elle montre la réponse courte et la confiance ; dépliée, l'avis entier.
- [x] La synthèse part seule quand tous ont fini et qu'au moins deux avis sont là, au premier
      repos de l'agent, même avec un participant en erreur. « Synthétiser sans attendre » existe
      dès deux avis et arrête les participants restants. Moins de deux avis : pas de synthèse.
- [x] La demande de synthèse contient les avis bornés à 6 000 caractères (coupure dite),
      anonymisés (« Participant A, B, C », ordre mélangé, sans table des lettres ni nom de
      modèle), avec les absents nommés par leur lettre. Les avis ne repartent pas avec le message
      suivant de l'utilisateur.
- [x] La synthèse est marquée dans le fil ; au survol, une lettre montre le vrai nom du
      participant. La carte se replie en une ligne à l'arrivée de la synthèse et se rouvre d'un
      clic.

**Réplique et suite**

- [x] « Faire réagir les participants », suivi en gris de « ≈ N + 1 fois les jetons d'une
      question simple », envoie la synthèse et la lettre
      du participant à chaque participant qui a répondu, dans sa conversation. Les répliques
      s'ajoutent à la carte, puis la décision du tech lead. Le main refuse une seconde réplique.
- [x] « Demander à <agent> de l'appliquer » envoie un message ordinaire, un seul à la fois (décision
      du tech lead, 2026-11-24).

**Surcoût et plafond**

- [x] Aucune estimation de coût, en argent ou en jetons, n'est affichée avant l'envoi.
- [x] Le pied de la carte affiche, en une ligne, le total consommé par unité (participants,
      synthèse, réplique, décision), sans conversion, avec les participants sans chiffre comptés.
- [x] Aucun bandeau, aucun dialogue de confirmation, aucun encadré de premier usage.
- [ ] Plafond par conversation activé : un participant au plafond est « arrêté : plafond
      atteint » ; une synthèse retenue par le plafond du tech lead affiche la carte habituelle, et
      « Continuer » l'envoie.

**Cas limites**

- [x] Un participant en erreur ou arrêté n'empêche pas la synthèse des autres.
- [x] Un second `/roundtable` dans la même conversation est refusé tant que le premier n'a pas
      rendu sa synthèse. Un message pendant le tour part sans les avis, et la synthèse attend la
      fin de la réponse.
- [x] Après un redémarrage, la carte se relit du fil : les participants en cours sont « arrêtés
      (redémarrage) », et aucune synthèse ne part sans geste.
- [ ] Corbeille et archivage : les participants suivent la famille ; la conversation d'un
      participant supprimée après la synthèse laisse son avis lisible.

**Essais**

- [ ] Testé contre l'agent factice, avec deux agents factices (`BOBINE_MOCK_PEER=1`) et des
      modèles déclarés (`MOCK_MODELS=…`). Scénarios à écrire :
  - `avis-participant` : avis au format imposé, qui varie avec le modèle et répète ce qu'il a
    reçu ;
  - `avis-hors-format` ;
  - `avis-erreur` ;
  - `participant-ecrit`, pour la lecture seule, avec et sans demande ;
  - `synthese-tour-de-table` : la synthèse rend les six rubriques et cite les lettres reçues ;
  - `replique` ;
  - coût dans une unité propre (bobcoins) et participant sans chiffre, en réutilisant
    `--cout-bob` et `--sans-usage`.
- [x] Unitaires : désignation et mélange, bornes, dernier échange, total par unité, état lu du fil
      (redémarrage), réplique unique, quorum.
- [ ] e2e `tour-de-table`, en clair et en sombre, avec `--lang en` : lancement en deux gestes,
      premier usage (menu ouvert par Entrée), menu à cases, ligne en saisie étroite, carte,
      synthèse et carte repliée, réplique, plafond par conversation. Captures comparées aux
      maquettes.
      Une étape s'ajoute au parcours `parcours-*` concerné.

## Découpage en lots livrables

| Lot | Contenu | Livre à l'utilisateur | Taille |
|---|---|---|---|
| **0. Observations réelles** | Plusieurs `opencode acp` et `bob acp` simultanés dans un même dossier, modèle qui tient, lectures demandées par Bob, mémoire (détail dans l'étude) | Rien : lève les inconnues | S |
| **1. Lancer et recueillir** | `/roundtable` et le bouton, la ligne du tour de table, le menu des participants (dernier choix retenu), les participants en lecture seule et en parallèle, le modèle strict, la bulle et la carte (liste repliable), arrêt, erreurs, redémarrage | Les avis indépendants, réunis dans une carte | L |
| **2. Synthèse** | La demande de synthèse au repos, les avis bornés et anonymisés, les six rubriques, la carte repliée, « Synthétiser sans attendre », moins de deux avis, le total consommé au pied de la carte | Le tour de table utile de bout en bout | M |
| **3. Réplique et suite** | « Faire réagir les participants » et son rappel en jetons, les répliques, la décision, « Appliquer » | Le débat d'un tour, puis l'action | S |
| **4. Robustesse et recette** | Corbeille et archivage, hors git, plafond par conversation (essais, aucun code attendu), étape du parcours réel enchaîné, recette avec OpenCode puis Bob sur décision de l'utilisateur | Fiabilité | M |

Les lots 1 et 2 forment le minimum publiable : un tour de table sans synthèse n'apporte rien de
plus que des travaux lancés à la main. Le lot 3 complète la v1, le lot 4 la précède. Après la v1 :
le lancement par l'agent (`propose_roundtable`), le total dans Mon activité, et, si la recette le
demande, le regroupement des participants dans la barre latérale.

## Vocabulaire fr / en proposé pour le glossaire

| Français | Anglais | Remarque |
|---|---|---|
| tour de table | roundtable | Le nom de la fonction ; la commande est `/roundtable`. |
| participant | participant | Un couple agent et modèle, jamais un « rôle » en v1. |
| N participants ▾ | N participants | Bouton du menu à cases, dans la ligne du tour de table. |
| Participants · 2 à 5 | Participants · 2 to 5 | Titre du menu. |
| Choisir les participants | Choose participants | Ligne du premier usage. |
| Chacun reçoit la question et peut lire les fichiers de ce dossier. | Each one gets the question and can read the files in this folder. | Pied du menu. |
| avis (d'un participant) | opinion | À distinguer d'« avis (dans le fil) » → « notice ». |
| tech lead (concept) | tech lead | **Pas dans l'interface** : « Tech lead » est déjà un rôle fourni (fiche 223). L'interface nomme l'agent : « Synthèse de OpenCode · Qwen3 32B ». |
| synthèse | synthesis | « Synthèse du tour de table » → « Roundtable synthesis ». |
| Synthétiser sans attendre | Synthesize now | |
| Faire réagir les participants | Ask participants to respond | Rappel en gris à côté : la formule du surcoût. |
| réplique | rebuttal | |
| décision (du tour de table) | decision | La réponse finale du tech lead après la réplique. |
| réponse courte ; confiance haute / moyenne / basse | short answer; high / medium / low confidence | |
| format non suivi | format not followed | |
| + synthèse · ≈ N fois les jetons d'une question simple | + synthesis · ≈ N× the tokens of a plain question | Ligne du tour de table ; seul le rappel « ≈ N fois… » à côté de la réplique. « jetons » / « tokens » : glossaire. |
| ≈ N fois plus de jetons | ≈ N× more tokens | Forme courte, saisie étroite. |
| Consommé | Used | Pied de la carte. |
| Participant A, B, C | Participant A, B, C | Lettres de la désignation. |
| arrêté : plafond atteint | stopped: cost cap reached | Reprend « plafond par conversation ». |

## Contradictions tranchées (révision du 2026-11-24)

La fiche et l'étude, écrites à part, divergeaient. Tranché ainsi :

- **Attente et quorum.** Fiche : délai réglable de 10 minutes par participant ; étude : pas de
  minuterie. Retenu : pas de délai, rien à régler ; synthèse automatique quand tous ont fini et
  qu'au moins deux avis sont exploitables ; « Synthétiser sans attendre » dès deux avis.
- **Lancement.** Fiche : feuille au-dessus de la saisie avec le choix à chaque fois ; étude :
  dialogue avec estimation et plafond. Retenu : une ligne dans la saisie, Entrée envoie ; le choix
  des participants n'apparaît qu'au premier usage ou à la demande (menu à cases depuis, voir la
  seconde révision).
- **Réplique.** Fiche : synthèse et objections faites à l'avis ; étude : synthèse bornée et
  objections visant le participant. Retenu : la synthèse entière (8 000 caractères au plus) et la
  lettre du participant ; aucun extrait d'objections calculé par l'app, aucun avis des autres.
- **Bornes des avis pour la synthèse.** Fiche : 6 000 caractères ; étude : 20 000. Retenu :
  6 000, pour ménager le contexte du tech lead (les avis visent 400 mots).
- **Langue des réponses.** Fiche : celle de la question ; étude : celle de l'interface. Retenu :
  celle de la question.
- **Structure de la synthèse.** L'étude en proposait une autre ; retenu : les six rubriques de la
  fiche.
- **Moins de deux avis.** Fiche : « Demander l'avis du tech lead sur cette réponse » ; étude :
  « Relancer ». Retenu : pas de synthèse, « Relancer » sur les lignes en erreur.
- **Modèle refusé.** Fiche : choisir un autre modèle sur la ligne ; étude : « Changer de modèle »
  par une nouvelle fille. Retenu : erreur, sans substitution (bouton revu dans la seconde
  révision).
- **Questions à un participant.** Fiche : « Poser une question », dont la réponse partait au tech
  lead avec le prochain message ; étude : participants exclus des nouvelles transmises. Retenu :
  l'exclusion ; on ouvre la conversation du participant, sans retour au tech lead.
- **Mon activité.** Fiche : tours de table comptés ; étude : migration `roundtable_id`. Retenu :
  reporté après la v1 (migration), le total reste sur la carte.
- **Plafond.** Fiche : champ « Plafond pour ce tour » ; étude : plafond du tour activé par défaut
  et plafond retiré aux participants (`'none'`). Retenu : aucun des deux ; le plafond par
  conversation s'applique tel quel à chaque conversation.

Seconde révision, sur les maquettes finales et l'avis UX (2026-11-24), tranchée pour le plus
simple :

- **Premier usage.** Fiche : panneau de choix et « Enregistrer et lancer » ; avis UX : « le
  dernier choix est le choix par défaut ». Retenu : aucun bouton d'enregistrement. Sans
  participant retenu, Entrée ouvre le menu à cases ; chaque case est retenue aussitôt ; dès deux,
  Entrée envoie.
- **Réglages.** Fiche : Réglages › Conversations › Tour de table et « Modifier » ; maquettes : le
  menu seul (l'option « Réglages seulement » a été écartée). Retenu : le menu seul.
- **Ce qui part avec la question.** Fiche : « + 2 fichiers », « + le dernier échange » sur la
  ligne ; maquettes : une ligne courte. Retenu : dans l'infobulle de « 3 participants ».
- **Participant en erreur.** Maquettes v2 : la synthèse attend un geste ; décision : synthèse
  automatique sauf après un redémarrage. Retenu : synthèse automatique avec les avis présents ;
  « Synthétiser avec N avis » seulement après un redémarrage.
- **Un seul avis.** Maquettes v2 : « Le faire commenter par la conversation » ; fiche : « Relancer »
  seul. Retenu : la fiche.
- **Modèle refusé.** Fiche : « Relancer » et « Modifier » ; maquettes : « Choisir un autre
  modèle ». Retenu : « Choisir un autre modèle » ouvre le menu, pour les tours suivants ; pas de
  remplacement en cours de tour.
- **Délai.** Une capture v2 montrait « délai dépassé (10 min) » ; pas de délai. Retiré.

## Décisions du 2026-11-24 (anciennes questions ouvertes)

L'utilisateur a tranché l'anonymat ; le tech lead a retenu les recommandations pour les trois
autres. Il ne reste aucune question ouverte.

1. **D1. Avis anonymisés pour la synthèse.** Le tech lead voit « Participant A, B, C », dans un
   ordre mélangé, sans table des lettres ; l'interface montre les vrais noms. Les biais
   d'auto-préférence et d'identité sont documentés, et le modèle du tech lead peut être
   participant. Donner la table à la fin rendrait le biais possible au moment où il compte.
2. **D2. Contexte des participants : la question, les fichiers, et le dernier échange borné.**
   Dernier message et dernière réponse de la conversation, bornés à 8 000 caractères, sans case à
   cocher ; l'infobulle de « 3 participants » le dit. Écartés : la question seule (les cas
   d'usage 3 et 6 en ont besoin) et un extrait plus long ou un dossier rédigé par le tech lead
   (coût × N, un tour de plus, avis orientés). Qui n'en veut pas lance le tour dans une
   conversation neuve.
3. **D3. La synthèse part d'elle-même**, sauf après un redémarrage de l'app, où un geste est
   demandé (« Synthétiser avec N avis »). Le lancement l'annonce (« + synthèse ») ; un bouton de
   plus contredirait les deux gestes. « Synthétiser sans attendre » couvre le participant lent.
4. **D4. Les participants sont rangés comme des travaux ordinaires** sous la conversation
   d'origine (liste imbriquée et repliable existante, fiche 095), sans regroupement ni archivage
   d'office en v1. On mesure l'encombrement à la recette ; si besoin, on les regroupe sous une
   ligne « Tour de table » après la v1.

## Décisions du 2026-11-24 (contrat, lancement des lots 1 à 4)

Prises par l'utilisateur avant le code ; elles priment sur l'étude. Numérotées C1 à C8.

1. **C1. Qui rédige la synthèse** : la conversation en cours, avec son agent et son modèle. Rien à
   choisir.
2. **C2. Rôle de la conversation en cours** : elle **arbitre** seulement. Elle ne donne pas son
   propre avis comme un participant (consigne de synthèse : « You are the arbiter… do not add your
   own opinion as one more participant »).
3. **C3. Lecture seule chez un agent qui écrit sans demander** (OpenCode, lot 0, O8 à O10) :
   - Bobine demande le mode le plus restrictif disponible : le rôle installé s'il est là, jamais
     `plan`, qui n'est pas une garantie (il écrit par le shell) ;
   - « Participant » est un **rôle fourni** (`participant`), de conseil, en lecture seule, sans
     famille d'outils de Bobine ;
   - installé dans l'agent par « Installer dans… » (fiche 223 phase 4, ADR-0047,
     `src/main/roles/export/`), il sert de **mode natif garanti** (lecture seule `native`) ;
   - sinon la lecture seule est seulement **demandée** : `ReadOnlyWatch`
     (`src/main/roles/read-only-watch.ts`) compare le dossier avant et après, et la ligne du
     participant signale tout fichier modifié (`changedFolder`), sans l'écarter de la synthèse
     (l'agent qui synthétise en est averti) ;
   - **jamais d'installation automatique**.
4. **C4. Modèle strict** : un seul réglage de modèle par session ; une erreur de réglage met le
   participant en erreur ; la valeur est relue après les `config_option_update`, avant l'envoi ; un
   modèle absent du catalogue donne « modèle introuvable » ; jamais de repli silencieux.
5. **C5. Hors dépôt git** : le tour de table fonctionne, en lecture seule dans le dossier ; la
   lecture seule seulement demandée y est « non vérifiée » (`unverified`).
6. **C6. Menu des participants** : les modèles récemment utilisés d'abord, puis « Autres
   modèles… ».
7. **C7. ADR-0072 accepté.**
8. **C8. Périmètre** : les lots 1 à 4 sont à faire ; fiche en cours.

Écarts du contrat à la lettre de la commande, assumés :

- le plafond de la conversation **arrête** un participant (`stopped: 'cost-cap'`, « Arrêté :
  plafond de la conversation atteint »), comme le dit la section « Plafond par conversation » ; ce
  n'est pas une erreur ;
- « a modifié des fichiers » est une **marque** sur la ligne (`changedFolder`), pas une erreur :
  l'avis reste lisible et part à la synthèse avec un avertissement (C3) ;
- deux phases de plus que la liste de départ : `deciding` (décision demandée) et `insufficient`
  (moins de deux avis, pas de synthèse).

## Plan

Détail dans l'étude technique (`docs/tour-de-table-etude-technique.md`, § 3). En bref :

- **Un ADR** (`docs/adr/0072-tour-de-table.md`, proposé) : participants filles en lecture seule,
  tour mené par l'app, état dans le fil de la mère, avis bornés transmis une seule fois par la
  demande de synthèse (complète l'ADR-0036 et sa note de compte rendu bornée à 1 200 caractères).
- **Réutilisation** :
  - travaux en lecture seule et `ReadOnlyWatch` (fiches 223, 265) ;
  - bulle et clé de carte (ADR-0060, ADR-0061) ;
  - logique du réveil groupé (ADR-0019), sans `ChildWake` lui-même ;
  - `destinationOf` et `modelsSeen` (fiche 108) ;
  - plafond par conversation, inchangé (fiche 157) ;
  - règle du coût et `digestsPartial` (fiche 266).
- **Compatibilité Bob** : confrontée à la section « Compatibilité Bob » de `docs/acp.md` (étude,
  § 2.9). Rien n'est supposé de Bob : pas de mode, pas de modèle, uniquement des messages
  ordinaires.
- **Pas de nouvelle dépendance attendue.** Pas de migration du journal en v1.

### Contrat partagé (posé le 2026-11-24, un commit)

- `src/shared/roundtable.ts` : types (`RoundtableChoice`, `RoundtableParticipant`,
  `RoundtableSeat`, `RoundtablePhase`, `RoundtableStep`, `Roundtable`, `RoundtableEvent`,
  `RoundtableTotal`), réducteur `reduceRoundtable` (un geste hors phase rend le même objet : le main
  refuse), reprise `settleRoundtable`, élément de fil `reduceRoundtableItem`, quorum, sélection
  (`selectionProblem`, `toggleChoice`), lettres (`shuffledLetters`, aléa injecté), multiplicateur,
  `participantIds`, `roundtableTotal`.
- `src/shared/roundtable-prompts.ts` : tout ce qui part aux agents, en anglais et borné
  (`PARTICIPANT_BRIEF`, `participantMessage`, `lastExchangeText`, `synthesisRequest`,
  `verdictRequest`, `rebuttalMessage`), avis encadrés comme des données (`asData` neutralise les
  balises `<bobine…`) ; lecture des avis (`opinionDigest`, `rebuttalStance`).
- `src/shared/roundtable-ipc.ts` : canaux `roundtable:*`, types de requête et de réponse,
  `parse…` des arguments du renderer, `ROUNDTABLE_READ_ONLY_SAFE`. **Pas encore branchés** dans
  `IpcInvokeContract` : c'est la première tâche du lot 1 main.
- Déclarations : élément `roundtable` (`transcript.ts`, `agent.ts`), provenance
  `MessageOrigin.kind = 'roundtable'` (`children.ts`), début de bloc `<bobine_roundtable`
  (`app-context.ts`), ligne d'export (`export.ts`).
- Clés `roundtable.*` (et `children.from.roundtable`, `appCommands.list.roundtable`,
  `roles.builtin.participant`) dans `fr.json` et `en.json` ; termes au glossaire de
  `docs/traduction.md`.

### Qui touche quoi

Deux agents travaillent en parallèle : **main** et **renderer**. Les fichiers du contrat
(`src/shared/roundtable*.ts`) sont **gelés** : un changement passe par une demande au chef, qui
l'applique sur la branche commune avant que l'un ou l'autre ne s'en serve. Règles :

| Fichier | Propriétaire |
|---|---|
| `src/shared/roundtable.ts`, `roundtable-prompts.ts`, `roundtable-ipc.ts` | gelés (chef) |
| `src/shared/ipc.ts`, `src/main/ipc.ts`, `src/preload/api.ts`, `src/main/read-only-guard.ts` | main |
| `src/shared/preferences.ts`, `src/main/settings-store.ts`, `src/main/settings.ts` (`roundtableParticipants`) | main |
| `src/main/**`, `src/mock-agent/**`, `docs/mock-agent.md` | main |
| `src/shared/work-groups.ts`, `src/shared/app-commands.ts` | renderer |
| `src/renderer/**`, `e2e/**` | renderer |
| `src/shared/i18n/locales/*.json`, `fr.generated.d.ts` | renderer ; le main n'ajoute que sous `roundtable.error.*` et `roles.builtin.*`, et régénère `fr.generated.d.ts` (`pnpm i18n-types`) en cas de conflit |
| `docs/features/285-tour-de-table.md` (journal), `CHANGELOG*.md` | chacun sa ligne de journal ; le changelog en fin de lot 4 |

### Lot 1 — lancer et recueillir

**Main** (d'abord le branchement, pour débloquer le renderer) :

1. Canaux : `RoundtableIpcContract` ajouté à `IpcInvokeContract` et `ROUNDTABLE_CHANNELS` à
   `IPC_CHANNELS` (`src/shared/ipc.ts`) ; gestionnaires dans `src/main/roundtable/ipc.ts`
   (arguments par `parseRoundtableId`, `parseRoundtableStartRequest`, `parseRoundtableLetter`),
   enregistrés par `src/main/ipc.ts` ; classement dans `read-only-guard.ts`
   (`ROUNDTABLE_READ_ONLY_SAFE`, les autres changent) ; preload `window.api.roundtable.{options,
   start, synthesize, rebuttal, decide, relaunch, stop}` (`src/preload/api.ts`). Livré en premier,
   avec des gestionnaires qui refusent tant que l'orchestrateur manque.
2. Préférence `roundtableParticipants: RoundtableChoice[]` (`shared/preferences.ts`, défaut `[]`,
   relue par `parseRoundtableChoices`) et `settings-store.ts` ; elle passe par le canal des
   préférences existant.
3. `roundtable:options` (`src/main/roundtable/options.ts`) : agents installés, `modelChoice` d'après
   `ProfileSummary.childModel`, modèles `recent` puis `others` (`ModelsSeen` et `targetModels` de
   `conversations/handover.ts`, options de la session si c'est l'agent de la conversation),
   `destination`, lecture seule attendue (`native` si le rôle `participant` est installé,
   `enforced`, `requested`, `unverified` hors git), `freeSlots`, `inGit`, `lastExchange`, `refused`.
4. Rôle fourni `participant` (`src/main/roles/builtin.ts`, `builtin-en.ts`, `builtin-fr.ts`) :
   lecture seule, `mcp: []`, consigne `PARTICIPANT_BRIEF` ; installable par « Installer dans… »
   sans code de plus. Le premier message d'un participant part toujours avec la consigne
   anglaise, figée par le code (`roleSnapshot`).
5. Orchestrateur `src/main/roundtable/roundtables.ts` (`Roundtables`) : `start` vérifie
   (`selectionProblem`, un tour à la fois par conversation, pas depuis un travail, ni archivée, ni
   discussion), réserve les N places d'un coup ou refuse (`missingSlots`), tire les lettres
   (`newSeats(…, Math.random)`), pose l'élément (`post(id, { type: 'roundtable' })`), lance chaque
   participant par `ChildConversations.start` (`card = roundtableId`, rôle figé, pièces jointes,
   `participantMessage(question, lastExchangeText(items))`), suit leurs fins de tour
   (`seat-answered`, `seat-failed`, `seat-stopped`) et applique `reduceRoundtable`. « Arrêter »,
   « Relancer », `seat-removed` (corbeille), `seat-changed-folder` (alerte de `ReadOnlyWatch`).
6. Modèle strict (`src/main/roundtable/strict-model.ts`, et `applyModel` de
   `conversations/children-review.ts` qui dit s'il a appliqué, le repli restant pour les autres
   usages) : un seul `session/set_config_option`, attente des `config_option_update`, relecture
   de `snapshot.controls` avant l'envoi ; valeur absente du catalogue → `model-not-found`, refus ou
   écart → `model-not-applied` ; la question ne part pas.
7. `conversations/children.ts` : `ChildRequest.attachments` (passées à `prompt`), modèle strict en
   option, réservation de N places, `children()` sans les participants ; `host-options.ts`
   (`extraContext` filtre `participantIds`), `children-wake.ts` et `mcp/children-tools.ts` les
   ignorent.
8. Reprise : au chargement du fil d'une conversation, `settleRoundtable` sur chaque élément en
   cours, posé de nouveau s'il change.
9. Agent factice (`src/mock-agent/`, `docs/mock-agent.md`) : `MOCK_AGENT_SCENARIO_BY_MODEL`,
   `MOCK_AGENT_REFUSE_MODEL`, scénarios `avis-participant` (répète ce qu'il a reçu),
   `avis-hors-format`, `avis-erreur`, `participant-ecrit`.
10. Essais : `src/main/roundtable/*.test.ts` (places, strict, exclusions une par une, reprise),
    suites e2e `filles*`, `roles-travail`, `travaux-groupe`, `parcours-deleguer` repassées.

**Renderer** (contre le contrat, avec un `window.api.roundtable` factice dans les essais tant que
le main n'a pas livré l'étape 1) :

1. `/roundtable` : `src/shared/app-commands.ts` et `src/renderer/src/app-commands.ts`
   (`/roundtable` seul : `roundtable.command.usage`, rien n'est envoyé ; depuis un travail :
   `roundtable.error.task`) ; bouton de la barre (`composer/ComposerBar.tsx`).
2. Ligne du tour de table `components/roundtable/RoundtableLine.tsx` : étiquette, « N participants
   ▾ », `roundtable.line.plusSynthesis` · `roundtable.cost.full` (ou `cost.short` sous 560 px,
   jamais coupé), infobulle (destinations, `sendsAll`…), places manquantes, participant
   indisponible, premier usage (Entrée ouvre le menu) ; Échap ou ✕ ramènent à une question simple
   (`composer/Composer.tsx`, `composer-key-down.ts`).
3. Menu à cases `components/roundtable/RoundtableParticipants.tsx` : `toggleChoice`, préférence
   écrite à chaque case, récents puis « Autres modèles… », une seule ligne sans modèle pour un
   agent sans choix, 5 au plus.
4. `src/shared/work-groups.ts` : genre « tour de table » dans `workLayout` (lancements dont `card`
   est un `roundtableId` rangés dans une carte ancrée sur l'élément, jamais en cartes seules).
5. Carte `components/thread/RoundtableCard.tsx` (lignes par `WorkGroupRow`), rendue par
   `Transcript.tsx` : progression, états, durée, outil en cours, réponse courte et confiance
   (`opinionDigest`), « format non suivi », un avis déplié à la fois, « Ouvrir sa conversation »,
   « Arrêter », « Relancer », « Choisir un autre modèle », lecture seule par ligne.
6. Essais de composants (ligne, menu, carte par phase), captures en clair et en sombre.

### Lot 2 — synthèse

- **Main** (`roundtables.ts`) : demande au premier repos de l'agent (même règle que
  `ChildWake.check`, réessai si l'utilisateur a écrit entre-temps) par
  `prompt(id, request.prompt, [], { from: { kind: 'roundtable', id, title, step: 'synthesis' },
  context: request.context })` (`synthesisRequest`, avis lus des `child-report` gardés, lettres
  seulement) ; `step-sent`, `step-held` (message retenu par le plafond), `step-answered` avec la
  consommation du tour (`TurnUsage`), `step-usage` pour un coût tardif (Bob), `step-failed` ;
  `roundtable:synthesize` (« sans attendre », « avec N avis » après un redémarrage).
- **Renderer** : ligne de l'app « Synthèse demandée · N avis » à la place du message
  (`Transcript.tsx`, provenance `roundtable`, sans lien « ouvrir ») ; étiquette « Synthèse du tour
  de table · <modèle> » sur la réponse qui suit ; lettres « Participant X » survolées → vrai nom
  (rendu Markdown) ; carte repliée en une ligne, rouverte d'un clic ; « Synthétiser sans
  attendre » (« Synthétiser » sous 480 px) ; « Un seul avis : pas de synthèse. » ; pied
  « Consommé : … » par `roundtableTotal` (digests des participants et des étapes).

### Lot 3 — réplique et « Appliquer »

- **Main** : `ChildConversations.followUp(childId, text, from)` (expose `deliver`) ;
  `roundtable:rebuttal` (refusé hors `canRebut`, une seule fois), `rebuttalMessage(letter,
  synthèse bornée)` à chaque participant qui a répondu, `rebuttal-seat` (position par
  `rebuttalStance`, `held` au plafond), puis la décision (`verdictRequest`, `step: 'verdict'`) ;
  `roundtable:decide` après un redémarrage.
- **Renderer** : « Faire réagir les participants » et son rappel `cost.full` (`rebuttalMultiplier`),
  section « Réplique » (maintient, nuance, se rallie), étiquette « Décision du tour de table »,
  « Demander à <agent> de l'appliquer » qui met `roundtable.synthesis.applyDraft` dans la saisie.

### Lot 4 — robustesse et recette

- **Main** : corbeille et archivage (`seat-removed`, famille), hors git (`unverified`), plafond par
  conversation (`seat-stopped: cost-cap`, `step-held` puis « Continuer »), essais de bout en bout
  de l'orchestrateur ; redémarrage pendant chaque phase.
- **Renderer** : suite e2e `tour-de-table` (clair, sombre, `--lang en`, captures comparées aux
  maquettes) ; étape du parcours réel enchaîné (`parcours-tour-de-table`, fiche 277) ; ligne du
  `CHANGELOG.md` et de `CHANGELOG.en.md`.
- **Recette** : OpenCode, puis Bob sur décision de l'utilisateur.

## Journal

- 2026-11-24 : étude fonctionnelle (fiches 097, 108, 112, 118, 160, 177, 223, 260 à 266 ; ADR-0019,
  0020, 0036, 0045, 0060 à 0062 ; état de l'art). Ajout du surcoût à la demande de l'utilisateur.
- 2026-11-24 : révision après les décisions de l'utilisateur. Retirés : l'estimation de coût
  (médianes du journal) et son lot, le plafond du tour et ses réglages, le délai réglable, la mise
  en avant des modèles gratuits, l'encadré de premier usage, la case « sans le contexte », le
  signal de jauge, « Poser une question à un participant », le total dans Mon activité (reporté).
  Lancement réduit à une ligne et Entrée ; participants réglés une fois. Contradictions avec
  l'étude tranchées (section dédiée). Comportement du plafond par conversation avec les filles
  vérifié dans le code.
- 2026-11-24 : maquettes finales validées (`docs/maquettes/1.2-tour-de-table-v2.html`) ; premières
  maquettes supprimées. Choix de l'utilisateur : menu à cases, surcoût en jetons dans la ligne du
  tour de table (« + synthèse · ≈ 4 fois les jetons d'une question simple », forme courte en
  saisie étroite), carte repliée après la synthèse, avis anonymisés. Questions ouvertes passées en
  décisions D1 à D4. Contradictions avec l'avis UX tranchées (premier usage sans
  « Enregistrer et lancer », pas d'entrée dans les Réglages, synthèse automatique malgré un
  participant en erreur). Statut : maquettes validées, à planifier (1.2).
- 2026-11-24 : décisions C1 à C8 de l'utilisateur ; ADR-0072 accepté ; statut « en cours ».
  Contrat partagé posé (types, réducteur, reprise, messages aux agents avec avis encadrés comme
  des données, canaux IPC et vérification de leurs arguments, clés de traduction, glossaire) ;
  plan par lot et partage des fichiers entre main et renderer. Aucune interface ni orchestration
  encore : rien de visible pour l'utilisateur.
- 2026-11-24 : **lot main 1 à 4** (branche `1.2`). Commits `feat(roundtable): ipc wiring`
  (canaux `roundtable:*` dans `IpcInvokeContract`, preload `window.api.roundtable.*`, gardien de
  lecture seule, préférence `roundtableParticipants`), puis orchestrateur, essais et docs.
  - **Fait** : module `src/main/roundtable/` (`roundtables.ts`, `seat-events.ts`, `steps.ts`,
    `options.ts`, `strict-model.ts`, `participant-role.ts`, `participants.ts`, `readings.ts`,
    `setup.ts`, `ipc.ts`) ; rôle fourni « Participant » (`builtin*.ts`, consigne
    `PARTICIPANT_BRIEF` dans les deux langues, `mcp: []`, aucun outil de Bobine) ;
    `ChildConversations` : `reserve`, `ChildRequest.attachments` / `strictModel` / `reserved` /
    `proceed` / `launchFailed`, `relaunchParticipant`, `followUp`, `onFolderChanged`,
    `watchSettled`, `children()` sans les participants (`ChildRequest` sorti dans
    `children-request.ts`) ; exclusions dans `host-options.ts` et `children-wake.ts` ; option
    `settleLoaded` du gestionnaire (`loadedEvents`, `helpers.ts`) ; agent factice
    (`--scenario-par-modele`, `--refuser-modele`, `--modele-retombe`, étape `computed`, scénarios
    `avis-*`, `participant-ecrit*`, `synthese-tour-de-table`, `replique`).
  - **Contrat** (changement additif, demandé par le chef pour l'interface) : `askedAt` sur
    `RoundtableSeat` et `RoundtableRebuttal`, porté par `seat-working` et `rebuttal-seat` : l'heure
    d'envoi de la question (de la réplique) dans la conversation du participant ; le compte rendu
    dont `askedAt` est égal porte l'avis (la réplique), relance ou erreur intermédiaire comprises.
    Effacé par `seat-relaunched`. Testé dans `shared/roundtable.test.ts`.
  - **Écarts** : « Relancer » repart dans la **même** conversation (pas une nouvelle fille) ; après
    un redémarrage, un tour dont la question avait des pièces jointes refuse « Relancer »
    (`roundtable.error.attachmentsLost`) plutôt que de relancer sans elles. Un réglage refusé par
    l'agent donne « modèle non appliqué » (avec sa raison, « model not found » chez OpenCode) ;
    « modèle introuvable » est réservé à une valeur absente des options annoncées (rien de propre
    à un agent). La question n'est pas posée en message dans le fil de la mère (la bulle vient de
    l'élément) ; son historique de saisie est écrit par le renderer (`conversation:recordSent`),
    pas par le main, pour ne pas le doubler. Archiver la mère pendant que des participants
    travaillent reste refusé (fiche 228) ; archivée avec une synthèse en attente, le tour s'arrête.
  - **Essais** (agent factice, aucun vrai agent) : `src/main/roundtable/*.test.ts` (indépendance,
    synthèse anonymisée au repos et attente du repos, cloisonnement, refus d'un second tour et
    depuis un travail, réplique unique et décision, modèle strict, sélection et places, quorum,
    « Synthétiser sans attendre », arrêts, relance, lecture seule demandée / refusée / hors git,
    avis piégé, corbeille, archivage, plafond, redémarrage pendant le recueil et pendant la
    réplique), `children-wake.test.ts`, `settings-store.test.ts`, `preferences.test.ts`,
    `builtin.test.ts`. Pas d'e2e locale (ADR-0069).
  - **Non couvert par un essai main** : réplique retenue au plafond d'un participant (« Continuer »
    dans sa conversation) ; agent qui plante pendant son avis (couvert seulement par l'erreur de
    tour) ; tout ce qui s'affiche (renderer).
- 2026-11-24 : **corrections de la revue sécurité et code** (branche `1.2-rt-engine-fix`).
  - Lecture seule : participants d'un même tour jugés ensemble par le garde-fou (un outil de l'un
    ne rend plus les tours des autres « partagés ») ; un changement est dit à tous les tours qui se
    chevauchent ; un tour non jugé ramène « demandée » à « non vérifiée ». Empreinte du dossier
    élargie (`.git/config`, crochets, branche, ignorés du premier niveau ; ≈ 150 ms contre ≈ 35 ms
    sur le dépôt de Bobine), ce qu'elle ne voit pas est écrit dans `folder-fingerprint.ts`.
  - Niveau `native` : installation relue sur le disque (entrée intacte, aucun fichier du projet du
    même identifiant), mode reconnu par sa valeur seulement ; profil introuvable : `unverified`.
  - Participant marqué dans sa fiche (`roundtable`) : aucun outil de l'app (`ask_user` compris),
    commandes refusées d'office comme les écritures ; un rôle nommé `participant` garde ses outils.
  - Jeton par lancement, « Relancer » attend la fin du lancement précédent ; places suivantes non
    lancées après un arrêt ; réessai espacé ; tours finis oubliés en mémoire.
  - Réplique envoyée avec la provenance `roundtable` (`step: 'rebuttal'`), retirée de la file ou du
    plafond à l'arrêt ; synthèse en route ou retenue coupée par l'arrêt.
  - Modèle strict : réglage de catégorie `model` seulement, modèle relu au départ et à la fin de
    chaque tour ; avis et répliques entiers ; noms de modèles pris chez l'agent ; question de plus
    de 8 000 caractères refusée.
  - Balises à suffixe aléatoire par demande, `asData` après NFKC, sans caractères de format, avec
    entités et lettres d'autres alphabets reconnues ; consignes d'anonymat.
  - Dossier changé distingué entre l'avis et la réplique ; participants hors de la fusion.
  - **Contrat** (à suivre par l'interface) : `MessageOrigin.step` accepte `rebuttal` ;
    `RoundtableStartError` accepte `question` ; `RoundtableRebuttal.changedFolder` ; balises
    `bobine_*_<nonce>` ; `PARTICIPANT_BRIEF` et règles de synthèse complétés. Clé ajoutée :
    `roundtable.error.question`. À reformuler par l'interface : `roundtable.state.readOnly.requested`
    (« vérifiée dans le dépôt seulement »).
- 2026-11-25 : **corrections de la recette fonctionnelle et de la revue UX** (branche
  `1.2-rt-engine-fix2`) : arrêt du tour cohérent (« arrêt en cours », participants arrêtés et
  attendus, puis « arrêté ») ; fiche de chaque participant tenue à jour (tour en cours ou non,
  état de sa place : jamais « fini » pour un modèle refusé) ; rien de figé à la corbeille (une place
  au travail est arrêtée, une conversation absente sort de la synthèse, l'interface lit
  l'existence) ; agent et modèle de la synthèse et de la décision relevés à leur départ ; plafond
  d'un participant : avis complet compté, question retenue dans un état explicite repris par
  « Continuer », libellés traduits sur la carte du plafond ; erreurs typées (question trop longue,
  conversation archivée) ; durée repartie à la relance ; titres et libellés lisibles, sans
  préfixe ; hors git sans avertissement ; rôle « Participant » interne ; recherche et export sans
  texte interne. Ordre réel du premier message d'un participant corrigé ci-dessus (question,
  dernier échange, consigne).

- 2026-11-24 : interface (renderer, branche `1.2-rt-ui`, lots 1 à 3 côté renderer), contre le
  contrat gelé et un `window.api.roundtable` factice dans les essais. Livré :
  - saisie : `/roundtable` (tapé, collé ou choisi dans le menu « / ») et le bouton de la barre ;
    étiquette « Tour de table » ; ligne du tour (`RoundtableLine`) : participants, surcoût en jetons
    et sa forme courte en saisie étroite (requête de conteneur, jamais coupée), infobulle par agent
    avec la destination et ce qui part ; premier usage, places manquantes, participant
    indisponible et refus du main (`selection`, `slots`, `running`, `task`, `archived`,
    `discussion`) dits dans la ligne, la question gardée ; Échap, ✕ ou retour arrière en tête
    ramènent à une question simple ;
  - menu à cases (`RoundtableParticipants`) : récents puis « Autres modèles… » et sa recherche,
    2 à 5 (cases désactivées au-delà, avec la raison), une ligne pour un agent sans choix de
    modèle, préférence `roundtableParticipants` écrite à chaque case, liste à choix multiples au
    clavier ;
  - fil : `workLayout` range chaque participant dans la carte de son tour (clé de carte partagée
    départagée par la place) ; bulle de la question et carte (`RoundtableCard`, `RoundtableRow`)
    à place fixe, par phase ; carte repliée en une ligne à la synthèse ; pied « Consommé » ;
    demande de l'app en ligne « Synthèse demandée · N avis » ; étiquette « Synthèse du tour de
    table · <modèle> », lettres « Participant X » qui montrent le vrai nom (greffon rehype,
    infobulle au survol et au focus) ; « Demander à <agent> de l'appliquer » et « Faire réagir
    les participants » avec le rappel en jetons ; carte « Réplique » et décision
    (`RoundtableTurn`) ;
  - squelette de la suite e2e `e2e/suites/tour-de-table.mjs`, **hors catalogue, pas encore
    lancée** (attend le moteur et les scénarios de l'agent factice).
  Écarts aux maquettes : l'étiquette « Tour de table » est sur sa ligne au-dessus de la question
  (comme les jetons de rôle), pas dans le texte ; la commande n'a pas d'icône dans le menu « / »
  (le menu n'en montre aucune) ; « Appliquer » envoie un message ordinaire (comme la fiche 263),
  au lieu de le poser dans la saisie. Non fait : l'état « silencieux depuis … » d'un participant.
- 2026-11-24 : **intégration** (branche `1.2`, fusion de `1.2-rt-ui`) et relecture de l'interface.
  - Adaptations au moteur : avis et réplique désignés par `askedAt` (comptes rendus `done`
    seulement, plus aucune déduction par l'ordre) ; refus des gestes dits sur la carte
    (`roundtable.error.unknown`, `attachmentsLost`, `phase`, `quorum`, `rebuttalOnce`) ; « Relancer »
    non proposé après un redémarrage d'un tour avec pièces jointes, la raison dite ; les quatre
    niveaux de lecture seule dits discrètement (bouclier, nom en clair) ; la question entre une
    seule fois dans l'historique de la saisie (`conversation:recordSent` par le renderer).
  - Relecture (20 points) : retenus disparus (agent retiré, modèle hors catalogue) en tête du menu,
    décochables ; clavier de « Autres modèles… » ; lettres gardées pendant l'écriture (contexte,
    composant défini une fois, une tabulation par lettre) ; « Appliquer » au motif de `WorkFoot` ;
    texte tapé pendant un envoi lent gardé ; Échap rend le focus à la saisie ; gestes un à la fois ;
    troisième palier de largeur ; la synthèse s'arrête à sa fin rendue ; participants reconnus par
    leur clé de carte ; commande masquée en Discussion ; brouillon gardé en tour de table ;
    lectures d'options concurrentes. Trouvé par l'e2e : la saisie qui passe de l'accueil au fil
    rouvrait le tour de table depuis le brouillon (vidé au départ, rétabli sur un refus) ; un refus
    lu plus tôt est relu à Entrée ; noms courts des modèles sur la carte ; la ligne passe à la ligne
    plutôt que de déborder ; le repère « travaux ont répondu » mène à la carte du tour.
  - Essais : suites e2e `tour-de-table` (clair et sombre, sombre ciblé) et
    `parcours-tour-de-table` (journée type, fiche 277), au catalogue, vertes en local. Non joué :
    `--lang en`, et le plafond par conversation en e2e (couvert par les essais du main).
  - Docs : page d'aide « Tour de table » (fr, en), `CHANGELOG.md` et `CHANGELOG.en.md`,
    `docs/architecture.md` (renderer).
- 2026-11-25 : recette fonctionnelle, partie interface (branche `1.2-rt-engine-fix`). Fait : le
  sommaire ne montre plus les demandes de l'app (provenance `roundtable`) et a une entrée par tour,
  sa question marquée « Tour de table » (S4) ; « N participants sans chiffre » ne compte que les
  participants finis (M5) ; conversation archivée : aucun geste, ni « Appliquer » ni « Faire
  réagir » (M11) ; un seul participant coché : « 1 participant · il en faut au moins 2 » (M13) ;
  l'infobulle ne montre jamais un préfixe de modèle brut, l'agent seul à défaut d'une destination
  déclarée (M14) ; « Ouvrir sa conversation » sur toute ligne dont la conversation existe ; page
  d'aide corrigée (second tour refusé, plafond, lecture seule demandée vérifiée dans le dépôt
  seulement, non vérifiée hors git). Décisions notées : barre latérale réduite aux participants
  d'un tour en cours (M7) ; rôle « Participant » caché de la barre Équipe et des mentions `@`,
  gardé dans Réglages › Rôles. En attente du moteur (`1.2-rt-engine-fix2`) : étiquette de la
  synthèse par l'agent et le modèle réellement utilisés (S3), place « retenue par le plafond »
  (S5), corbeille et suppression (S1/S2), filtre de la barre latérale (M7), marqueur du rôle.
  Côté main : l'aperçu « retenu » de la carte « Plafond atteint » et les extraits de la recherche
  se construisent dans le main (`held` du `CostCapCard`, `conversations/content-search.ts`).

- 2026-11-25 : revue UX/UI (dans la vraie app), partie interface. Fait : raison traduite « Sans
  avis : … », texte brut de l'agent en infobulle seulement, pas de « au bout de » sous 5 s (B1) ;
  icône du tour pour les participants dans la barre latérale et Session › En cours (B2) ; arrêté
  par un cercle barré, bouton d'arrêt de 24 px (B3) ; aucun repère « travaux ont répondu » pour les
  participants (B4) ; ligne de la saisie à quatre paliers sur une ligne, « + synthèse » et
  « jetons » toujours là (« 5 ▾ » sous 420 px, « ≈ 5× jetons » sous 340 px) (A1) ; menu ancré
  au-dessus de la saisie, hauteur bornée, ordre figé pendant qu'il est ouvert, recherche qui filtre
  (A2) ; lecture seule dite une fois au pied, boucliers seulement quand les niveaux diffèrent (A3) ;
  « Faire réagir » et son rappel d'un tenant, place gardée (A4) ; détail du pied « Consommé » par
  participant (A6) ; infobulle sous la ligne, sans « X · par X » (B6) ; méta sous le nom sous
  600 px (B7) ; un tour posé après masque les actions du précédent (B8) ; titres de l'avis déplié à
  la taille du corps, réponse courte non répétée (B9) ; double Échap (B10) ; bouton et commande
  désactivés pendant un tour (B11) ; en-tête « arrêté » (B12) ; « a modifié des fichiers » sur sa
  ligne (B14) ; « N avis · M sans avis » (B15) ; ordre des cases du menu (B16) ; marge basse du fil
  quand « ↓ » est visible (B18) ; « Relancer les N participants arrêtés » (B19). **Non fait, A5**
  (étiquette en ligne dans la question par `text-indent`) : la zone de saisie est un `textarea`
  partagé (historique, mentions, jetons de rôle, pièces jointes au-dessus) ; décaler sa première
  ligne de la largeur d'une pastille posée par-dessus casse la sélection à la souris en tête de
  texte, le placement du curseur et la composition (IME) sur la première ligne, et dépend de la
  police chargée : l'étiquette reste sur sa ligne, comme les jetons de rôle.

- 2026-11-25 : interface sur le contrat de `1.2-rt-engine-fix2` (branche `1.2-rt-engine-fix`).
  Fait : « arrêt en cours » (`Roundtable.stopping`) dans l'en-tête et sur le bouton, qui attend la
  fin de `roundtable:stop`, aucun geste de ligne pendant l'arrêt ; place retenue par le plafond
  (`RoundtableSeat.held`, S5) avec « Ouvrir sa conversation » ; étiquettes de la synthèse et de la
  décision lues de `RoundtableStep.by` (S3) ; `roundtableTotal` reçoit `null` pour un participant
  au travail (M5) ; corbeille et suppression lues de l'existence de la conversation (liste, puis
  corbeille par `trash:list` quand elle manque, `useTrashedIds`) : à la corbeille, l'avis se lit
  sans « Ouvrir », restaurée la ligne revient (S1, S2) ; barre latérale : un participant n'y est que
  pendant son tour, ou quand il est affiché (`ConversationSummary.roundtable.active`, M7) ; état
  d'une place en erreur ou arrêtée jamais « fini » dans la barre (B5b) ; icône et marqueur par
  `summary.roundtable`, barre Équipe et mentions par `Role.internal` ; dialogue de suppression de
  la famille sans « worktree gardé » pour des participants (M8). B17 : le bouclier, montré quand les
  niveaux diffèrent, est focalisable et porte son niveau en nom accessible. B5 : vérifié en e2e
  (participant lent, arrêt lent de l'agent factice `MOCK_AGENT_SLOW_CANCEL_MS`) : carte, panneau
  Session et barre latérale disent la même chose pendant et après l'arrêt. Libellés `roundtable.held.*`
  et `roundtable.error.archivedGesture` relus, gardés, ajoutés au glossaire ; `readOnly.requested`
  dit déjà « vérifiée dans le dépôt seulement ». E2e : section « vie des participants »
  (`tour-de-table-vie.mjs`) : arrêt, barre latérale pendant et après, « Ouvrir sa conversation »,
  corbeille puis restauration, synthèse retenue par le plafond puis « Continuer ».
  Défaut trouvé par l'e2e (une fois sur trois sous charge) : l'infobulle ouverte par le focus
  clavier d'une lettre se refermait aussitôt, au défilement qui amène l'élément en vue (Radix ferme
  au défilement). `Tip` (`common/Menus.tsx`) garde ouverte une infobulle ouverte par le focus quand
  un défilement la ferme dans les 300 ms ; le départ du pointeur la ferme toujours (`Tip.test.tsx`).

- 2026-11-25 : contre-revue, partie interface (branche `1.2-fix3-ui`). N3 : un brouillon
  `/roundtable …` n'est repris en tour de table que si celui-ci est utilisable dans la conversation
  (Discussion, `/roundtable` de l'agent ou de l'utilisateur : le texte garde son préfixe ;
  réglages lus après le montage : repris à ce moment-là). N9 : plus de marge basse du fil qui
  apparaît avec « ↓ » (elle recalait le défilement près du bas, et `:has()` était réévalué à
  chaque insertion) ; un espace réservé, fixe, sous une carte du tour en bout de fil ; mesuré en
  e2e (pied visible près du bas, aucun saut quand « ↓ » disparaît). N10 : corbeille relue quand
  elle change dans la fenêtre (évènement `bobine:trash-changed`, posé par Réglages › Données, le
  main n'en publie pas) et à chaque réouverture de la carte. N11 : seule une infobulle ouverte par
  le focus lui-même résiste au défilement qui suit ; JSDoc de `focusWithoutIntent` remis à sa
  place. Titre « Tour de table » jamais coupé, le résumé de droite se réduit. N12 : l'aperçu
  « retenu » se construit dans le main, rien côté interface. Suite e2e complète sur GitHub :
  menu des participants sans les agents absents de la machine (on ne propose pas ce qu'on ne peut
  pas choisir ; déjà retenu, il reste en tête avec sa raison ; le contrat n'a pas d'état « pas
  prêt » distinct d'« absent », `ProfileSummary.available` seul) ; le bouton du tour de table se
  replie au niveau 4 dans le menu de 📎 avec les réglages de la session (barre sur deux lignes à
  760 px avec les polices de Linux) ; `files` : l'essai attendait le chemin de la vue, pas son
  code (défaut de l'essai, déjà en 1.1).

- 2026-11-25 : contre-revue, régression `roles-export` et recette réelle, partie main (branche
  `1.2-fix3-engine`). Chaque correction a un essai qui échoue sans elle (vérifié).
  - Contre-revue. N1 : question retenue par le plafond puis place arrêtée, « Continuer » ne
    l'envoie plus (`PromptOptions.roundtableQuestion`, reconnu par `dropHeld`) ; N12 : la carte
    du plafond dit « Question du tour de table », jamais la consigne. N2 : « garanti par l'agent »
    (`native`) seulement dans un dépôt git, et seulement si aucune définition du même nom n'est
    ailleurs chez OpenCode (projet et parents, `.opencode`, configuration personnelle et système,
    clés `agent` d'`opencode.json(c)`, d'après sa documentation publique du 2026-11-25). N4 :
    `asData` repère les balises sur une copie normalisée et transmet le texte d'origine, borné
    après neutralisation. N5 : le contexte joint commence par sa balise ; l'export ne retire que
    les messages de l'app. N6 : un seul passage dans l'export. N7 : la réplique part au repos du
    participant (ni tour ni file), empreinte prise avant l'envoi ; `core.hooksPath` dans
    l'empreinte. N10 : participant supprimé pendant le recueil, absence dite à la synthèse. Le
    chevauchement des tours entre participants n'est plus propagé (chacun juge son tour) ;
    « réponse en cours » ne coupe que la demande partie.
  - **Décision (N8)** : pendant un tour, un participant n'a aucune carte d'autorisation ; seules
    une lecture ou une recherche dont toutes les cibles sont dans le dossier de la conversation
    sont accordées d'office ; tout le reste est refusé et dit dans son fil (écriture, commande,
    réseau `fetch`, `other`, genre absent, cible hors du dossier ou inconnue). « Garanti par
    l'agent » dépend des réglages d'acceptation automatique de l'agent : Bobine ne tient ce niveau
    que si le profil sait les lire, et ne suppose rien de Bob.
  - Régression `roles-export` (« lancer dans ce mode ») : les vérifications sur le disque de N2 ne
    s'appliquent qu'au rôle fourni « Participant » (`nativeMode(..., { strict })`) ; une
    installation de Bobine à jour, dans le projet ou personnelle, redevient reconnue. Suite e2e
    `roles-export` verte en local.
  - Recette réelle. S1 : la synthèse et la décision sont en lecture seule le temps de leur tour
    (`stepReadOnly` : `edit`, `delete`, `move`, `execute`, `switch_mode` refusés d'office ; la
    lecture reste) ; empreinte du dossier avant l'envoi, comparée à la fin : `changedFolder` et
    quelques fichiers (`changedFiles`) sur l'étape ; consigne « Do not create, edit or delete any
    file… ». S2 : dernier échange = dernier message tapé et la réponse qui suit ; **choix** : si un
    tour (ou un message de l'app) l'a suivi, rien n'est joint (le plus sûr : pas de synthèse d'un
    tour précédent reprise, pas d'échange ancien présenté comme le dernier). S3 : « Participant A »
    en toutes lettres, avec un exemple. G1 : agents des participants arrêtés au repos aux phases
    `synthesized`, `decided`, `insufficient`, `stopped` (`releaseIdle`, mêmes règles que la mise en
    veille : une conversation affichée garde le sien) ; agent au coût lu après coup (`costSource`)
    libéré après la relecture du coût ; la réplique rouvre la session, modèle relu à son départ.
    G3 : `ConversationSummary.roundtable.since`, début du travail en cours (avis, puis réplique).
    G6 : la réponse courte garde `>` et `_` du texte. C1 : nom court du modèle sur l'arbitre et
    l'étiquette de l'étape. C3 : sans réponse courte, « format non suivi ».
  - **Décision du tech lead** : l'arbitre (agent et modèle de la conversation ; l'agent seul sans
    choix de modèle) n'est jamais participant : problème de sélection `arbiter`, `roundtable:options`
    rend `arbiter` (et un agent sans choix de modèle qui arbitre est indisponible, avec sa raison),
    et la synthèse ne part pas si la conversation est passée au modèle d'un participant
    (`step-failed`, `roundtable.error.arbiter`).
  - Agent factice : `arbitre-ecrit`, `arbitre-demande-ecrire`, `participant-ecrit-replique`.

- 2026-11-25 : recette réelle, partie interface (branche `1.2-fix3-ui`, avec `1.2-fix3-engine` et
  `origin/1.1` fusionnées). G2 : un tour posé après masque aussi « Faire réagir » du précédent (un
  simple message la laisse). S3 : lettres groupées (« Participants A et B », « A, B et C »,
  « and »), jamais une lettre seule ; pastille de la lettre sur chaque ligne dès que la synthèse
  est partie (scénario factice `synthese-lettres-seules`). S1 : avertissement sous l'étiquette de
  la synthèse ou de la décision quand `changedFolder` est posé, fichiers compris (8 au plus). Arbitre :
  désactivé dans le menu avec sa raison (agent sans choix de modèle compris, montré même
  indisponible), retenu devenu l'arbitre dit sur la ligne (Entrée ouvre le menu), étape refusée
  (`roundtable.error.arbiter`) dite au pied, en-tête « synthèse non rendue », reprise par
  « Synthétiser » ; une autre panne d'étape : texte traduit, brut en infobulle. G3 : chronomètre de
  Session › En cours pris de `roundtable.since`, et une entrée finie qui repart repart de zéro. G5 :
  « au moins N fois les jetons d'une question simple » partout (ligne, rappel, aide, glossaire). C1 :
  nom court du modèle sur les étiquettes. C2 : l'aide nomme le bouton de relance. C3 : « format non
  suivi » passe avant la confiance. Réplique pas encore partie : « en attente : il finit son
  travail en cours ». Permissions : aucune carte d'autorisation pour un participant (e2e `Omega`).


- 2026-11-25 : contre-recette réelle, partie main (branche `1.2-fix4-engine`).
  - N1 (Bob participant libéré tard) : son agent attendait 65 s fixes après la synthèse, même
    quand son coût était lu depuis longtemps ; avec une synthèse longue, l'échéance tombait au
    lancement du tour suivant. Désormais libéré dès qu'un coût suit son dernier tour
    (`IdleWaiters.costAfterTurn`), 65 s restant l'échéance.
  - N2 (ligne « OpenCode » seule) : un agent à choix de modèle sans modèle connu est essayé hors
    conversation (`agent-models.ts`, par l'essai du diagnostic : session supprimée aussitôt, aucune
    en profil jetable) ; `RoundtableAgentOption.modelsState` dit `loading` pendant l'essai,
    `default` si rien n'est connu (« <agent> · modèle par défaut ») ; un essai sans modèle n'est pas
    refait avant 10 min.
  - N3 (coût d'une synthèse en échec) : le total d'une étape additionne toutes ses tentatives,
    en erreur ou arrêtées comprises, coût lu après coup compris (`RoundtableStep.spent`, interne).
    Trace de Bob 2.1.0 gardée : scénario `synthese-erreur-serveur`, `docs/acp.md`.
    Cause trouvée en chemin : l'hôte ne relisait pas le coût hors protocole après un tour en échec
    (seulement après un tour répondu) ; il le relit désormais aussi (`agent-host.ts`), sinon il
    n'arrivait qu'au tour suivant.

- 2026-11-25 : interface, contre-recette (branche `1.2`). Lignes immobiles : une ligne de la carte
  garde sa hauteur quel que soit l'état du participant (nom et seconde ligne jamais à la ligne, texte
  entier en infobulle ; marque « fichiers modifiés » et gestes dans la colonne de droite, sa hauteur
  réservée, sous le nom sous 600 px ; pied toujours sur une rangée) ; mesuré en e2e pendant le
  recueil à largeur normale, 760 et 520 px (position et hauteur de chaque ligne et du pied
  inchangées malgré les changements d'état) ; clic direct sur « Choisir un autre modèle ». Arbitre :
  raison en clair à la place de l'agent dans le menu (« fait la synthèse de ce tour »). Sans menu 📎
  (pas de capture d'écran), le bouton du tour quitte la barre repliée. N2 : agent dont les modèles
  se chargent, ligne « <agent> · chargement des modèles… » non cochable, relue chaque seconde menu
  ouvert (15 s au plus, puis « modèle par défaut »), remplacée à sa place par les modèles ;
  « <agent> · modèle par défaut » dans le menu, la carte et l'infobulle. N1/N3 : e2e d'une synthèse
  en échec (`synthese-erreur-serveur`, coût comme Bob) puis relancée, « Consommé » à 0,05.


- 2026-11-25 : passe de contrôle, S1 côté main (branche `1.2-fix5-engine`). Un seul participant
  écrivait, tous ceux qui travaillaient en même temps étaient accusés, avec un bandeau chacun.
  - Le fait appartient au tour : `Roundtable.folderChanged` (`collecting`, `rebuttal`), quelques
    fichiers lus dans `git status` (empreinte avant les questions ou les répliques, comparée à la
    fin de l'étape, `tour-folder.ts`).
  - Une place n'est marquée `changedFolder` que si l'écart lui est attribuable : elle a lancé un
    outil `edit`, `delete`, `move` ou `execute` pendant son tour. Jamais un tour arrêté ou en
    échec. (La règle « ou seul au travail pendant son tour » a été retirée le même jour : elle
    dépendait du minutage et accusait à tort sous Windows, voir plus bas.)
  - Plus de bandeau par participant dans la conversation d'origine (celui du participant reste ;
    rôles de conseil inchangés).
  - Demande de synthèse ou de décision : une seule mention, « The folder changed during the
    roundtable: <fichiers>. », avec les participants attribuables, plus d'avertissement par avis.
  - Agent factice : `participant-ecrit` annonce son outil `write` ; `participant-ecrit-cache`.

- 2026-11-25 : dernière passe de contrôle, partie interface (branche `1.2`, avec `1.2-fix5-engine`).
  S2 : « Choisir un autre modèle » retiré (et `roundtable-menu-request.ts`) ; la saisie ne passe
  jamais en tour de table pendant un tour ; un refus est périmé au changement de phase. S3 : menu
  des participants à côté fixé à l'ouverture, liste à hauteur gardée pendant la recherche, champ à
  la place du bouton (M2), raison d'une case désactivée dans une ligne d'état (M6). S4 : au repli
  de la carte, si le fil ne suivait pas le bas, le haut de la carte reste en place. S5 : colonne
  de droite de hauteur fixe ; mesures aux trois largeurs avec un « Relancer » qui paraît. S1 : un
  seul avis du dossier modifié par étape, dans la carte ; la marque de ligne seulement si
  attribuable ; formule « un rôle en lecture seule qui travaille dans ce dossier » retirée.
  Simplifications : boucliers seulement sur une ligne qui diffère du pied ; un seul accès à la
  conversation d'un participant (ligne dépliée, toute ligne se déplie) ; plus de « sans avis » à
  droite ni de note « Synthèse avec N avis » ; une seule ligne d'étiquette par synthèse ou
  décision ; « Consommé » sans « N participants sans chiffre » ; avis déplié en entier ; pas
  d'icône devant la ligne de la saisie ; infobulle sans « Chacun reçoit la question », la
  destination de chaque agent (M15). Mineurs : M1 (carte étroite), M3, M4 (`/roundtable` grisé
  pendant un tour), M5 (bouton ou menu 📎), M11 (lignes par lettre au repli), M12 (`costText`),
  M14. Textes revus (français, anglais, glossaire) ; page d'aide alignée. GitHub : mesure large
  panneau fermé (le panneau « Session » s'ouvre au premier message et faisait passer la colonne
  sous 600 px) ; le coût tardif d'une tentative de synthèse en échec est perdu si l'on relance
  avant sa relecture (réducteur : `step-usage` ignoré pendant une nouvelle tentative) — défaut
  côté moteur signalé, l'essai attend ce coût avant de relancer.


- 2026-11-25 : course du coût tardif d'une tentative (branche `1.2-fix6-engine`). Après une
  synthèse (ou une décision) en échec, le coût façon Bob de la tentative est relu ≈ 1,5 s plus
  tard ; « Synthétiser » cliqué avant le perdait (relevé écarté tant qu'une nouvelle tentative
  était en route). Désormais chaque tentative est désignée par l'heure de son départ
  (`RoundtableStep.attempts`, interne) avec le coût cumulé de la conversation à son départ et le
  dernier relevé qui lui revient ; `step-usage` vise sa tentative (`attempt`). Le total compte
  chaque tentative sans recouvrir l'intervalle d'une autre : rien de perdu, rien de compté deux
  fois, quel que soit l'ordre d'arrivée. Un message tapé entre-temps arrête le relevé à la fin de
  son tour. Siège relancé : pas concerné (le coût d'un participant est celui de toute sa
  conversation, coût tardif compris). Agent factice : `decision-erreur-serveur`. E2e : le cas
  « synthèse en échec » relance tout de suite, sans attendre le coût tardif.

- 2026-11-25 : CI rouge sur les trois systèmes au commit e59814d1 (branche `1.2-fix8-engine`).
  - « Arrêter » tout le tour attendait la borne de 10 s : une place dont le lancement est abandonné
    (tour arrêté pendant le lancement) quitte « démarre » par la liste seule, sans évènement de
    son agent ; l'attente du repos ne le voyait pas. **Défaut produit** : « arrêt en cours » jusqu'à
    10 s dans l'app. `IdleWaiters.recheck` à chaque changement de la liste.
  - Décision : un relevé tardif du coût de la synthèse arrivé pendant la décision était compté aussi
    à la décision (machine lente). **Défaut produit** : la décision ne recouvre plus la synthèse
    (`attemptsTotal(…, floor)`, recalculé à chaque évènement d'étape).
  - N7 (macOS) : l'écriture de la réplique, sans outil annoncé, n'était plus attribuable quand un
    autre participant répliquait en même temps : le scénario annonce son outil `write`.
  - Bornes injectables : `RoundtablesDeps.timeouts` (`stopMs`, `relaunchMs`) ; les essais les
    règlent à 60 s, pour qu'une attente qui irait à sa borne échoue au lieu de passer lentement.

- 2026-11-25 : CI Windows au commit 5bf5ac2c (branche `1.2-fix9-engine`). Un participant qui
  n'avait rien écrit était désigné (« Attributable to Participant B, Participant C ») : seul au
  travail pendant que l'écriture d'un autre paraissait dans le dossier. **Décision du tech lead** :
  la règle « seul au travail » est retirée ; une place n'est attribuable que si elle a elle-même
  appelé un outil `edit`, `delete`, `move` ou `execute` pendant son tour. Sinon, seule la marque
  du tour reste, « No participant can be identified as the author. ». Page d'aide corrigée.

- 2026-11-25 : tests du moteur rendus indépendants de la vitesse des agents factices (branche
  `1.2-fix10-engine`). Chaque assertion sur un état intermédiaire (« en cours », « en attente »,
  « démarre ») est garantie par un verrou explicite (`--verrou-fin-de-tour`, et le nouveau
  `--verrou-demarrage` de l'agent factice : `initialize` attend que le fichier disparaisse), ou
  remplacée par un état terminal. Vitesse de l'agent factice variable pour les passes de stress
  (`ROUNDTABLE_MOCK_DELAY_MS`).

- 2026-11-25 : recette de la 1.2.0-beta.1 packagée, partie main (branche `1.2-fix12-engine`).
  - S-B1 : le coût d'« Appliquer » gonflait la décision (0,38136 au lieu de 0,0612). Cause, dans
    le fil réel : Bob écrit sa dépense au fil du tour, relue à la fin d'un outil ; le relevé de la
    décision restait ouvert pendant le message suivant (« ce qui arrive pendant son tour revient à
    la tentative », fix6). Il se ferme désormais dès qu'un autre message part ; seule une nouvelle
    tentative de la même étape le garde. Coûts des tentatives arrondis (0,3813599999…). Scénario
    `arbitre-applique-comme-bob`. **Limite acceptée** : si « Appliquer » (ou un autre message)
    part avant que Bob ait écrit le coût de la décision, ce reste n'est pas compté dans le tour ;
    le total est alors un peu en dessous, jamais gonflé (le total de la conversation reste juste).
  - G-B1 : « coût inconnu » pour 0 $ de modèles gratuits. Régression de la revue finale de
    l'interface (`costText(c, false)` au pied) ; le total porte maintenant, par unité, si tout vient
    de modèles gratuits (`RoundtableTotal.costs[].free`, `free` des étapes).
  - G-B4 : ligne vide pour un avis sans réponse courte lisible. Variantes réelles non reconnues
    (« Réponse brève », « Suppositions ») et avis sans réponse courte (Nemotron) ; le résumé de la
    ligne prend le début de l'avis (`OpinionDigest.excerpt`). Scénario
    `avis-long-sans-reponse-courte`.
  - G-B1 prouvé de bout en bout (`roundtables-cost.test.ts`, agent factice `--cout-nul`, modèles
    « … Free ») : tour gratuit → « gratuit » ; arbitre en Bobcoins → « gratuit + … Bobcoins » ;
    0 $ d'un modèle qui ne se dit pas gratuit → « coût inconnu ». La gratuité d'une place vient du
    résumé de sa conversation (`usageDigest` : `freeModels`), celle d'une étape de `steps.ts`.
  - G-B2 : l'arbitre OpenCode lance des commandes pendant la synthèse. Aucun mode plus restrictif
    observé chez OpenCode pour l'arbitre (`plan` écrit par le shell, lot 0 O8 ; le mode
    « participant » porte la consigne d'un participant) : rien n'est posé. La lecture seule de
    l'étape reste garantie pour un agent qui demande (refus d'office), demandée sinon ; une
    commande partie pendant l'étape pose `RoundtableStep.ranCommand`, dit en une ligne ; une commande
    demandée puis refusée d'office ne l'est pas (scénario `arbitre-demande-commande`). Page d'aide
    corrigée (garanti / demandé). Scénario `arbitre-commande`.

- 2026-11-25 : CI rouge à eb212df9 (branche `1.2-fix13-engine`).
  - `verify (Windows)` : l'essai « commande lancée par l'arbitre » jouait trois tours dans un seul
    `it` (15,1 s) ; trois essais, ≈ 1 s chacun en local. Aucun essai de
    `roundtables-recette.test.ts` au-dessus de 2,7 s en local.
  - `pnpm e2e (macOS)` : la suite `tour-de-table` est passée de 2 min 08 à 3 min 42 sur le Mac de
    GitHub. Fix12 n'a touché à aucune suite e2e ; en local, avant et après fix12, la suite dure la
    même chose (50/53 s contre 51/54 s ; sous `taskpolicy -b`, 164 s contre 163 s). Cause établie
    ensuite : un incident GitHub (« Actions dégradées » ce jour-là) ; un lot comparatif lancé à la
    même heure sur v1.2.0-beta.1 et sur `1.2` donne des durées normales des deux côtés. Marge : la vie des participants devient une suite à part, `tour-de-table-vie`
    (clair, sombre seulement avec `--themes both`, aucun rendu sombre vérifié), mêmes vérifications
    et mêmes captures. La carte « en cours » se regarde sous verrou de fin de tour (sous charge,
    elle pouvait déjà être repliée).

- 2026-11-25 : `tour-de-table-vie` rouge une fois sur le Mac de GitHub (lot anglais, 80d636d6 ;
  branche `1.2-fix14-engine`).
  - « recueil, 760 px » : `changes: 2` en 47 images. Cause, à la lecture : la sonde comptait les
    changements d'état **une fois par image** (`requestAnimationFrame`) et n'était posée qu'après
    l'apparition de la carte ; une suite rapide (17 s) faisait passer plusieurs participants d'un
    état à l'autre entre deux images, ou avant la pose. Les trois sondes « recueil » (largeur
    normale, 760 px, 520 px) suivent maintenant chaque changement d'une ligne
    (`MutationObserver` sur `data-state`), et les agents factices restent « en attente » sous un
    verrou de démarrage (`MOCK_AGENT_START_LOCK`, nouveau) tant que la mesure n'est pas posée :
    chaque ligne change sous ses yeux, quelle que soit la vitesse. Seuil inchangé (3).
  - « délai dépassé : innerWidth === 1280 » au retour à la vraie taille : non reproduit (vie seule
    10/10 et sous charge 5/5 en anglais, trois lots de démarrage à 3 jobs). La vraie fenêtre n'était
    plus de 1280 px de large à ce moment (une largeur émulée de 1280 aurait satisfait l'attente),
    pourquoi n'est pas établi ; l'échec dit désormais ce que la page voyait (largeurs, écran,
    visibilité) pour la prochaine fois.


- 2026-11-25 : essais du tour de table trop près du délai de 15 s sous Windows (`verify (Windows)`
  rouge à f129b7dc ; branche `1.2-fix15-engine`, refaite après relecture).
  - Cause mesurée : les processus git, tous à la suite dans la file git de l'app (≈ 6 ms chacun en
    local, des dizaines sous Windows) : 60 pour l'essai le plus simple, 5 273 pour les cinq
    fichiers d'essais du tour de table. Le garde-fou de lecture seule par tour et par participant
    (deux empreintes), l'empreinte du tour et celle de l'étape, chacune de 8 commandes, plus un
    `git status` de plus. S'y ajoutent l'attente réelle du modèle strict (250 ms par place dont le
    modèle change) et le lancement des agents factices (≈ 90 ms chacun en local).
  - Produit (aucune vérification retirée) : empreinte en 5 commandes, qui rend ses lignes de
    `git status`, réutilisées par l'étape ; chemins joints à la racine du dépôt (ceux de
    `git status` en partent : un dossier de travail sous la racine voyait mal ses fichiers non
    suivis et ignorés). Nouveaux essais d'équivalence (dossier non suivi, espaces, non ASCII,
    sous-dossier, renommage), verts avec l'ancienne et la nouvelle empreinte.
  - Essais : dossier sans dépôt git par défaut, un vrai dépôt pour les essais qui vérifient la
    surveillance (ils échouent sans) ; attente du modèle strict à 0 dans les essais, champ à part
    (`strictSettleMs`), la branche stricte toujours prise (essai qui le prouve), l'attente réelle
    gardée dans l'essai du modèle qui retombe. Processus git : 5 273 → 685 ; durée locale des cinq
    fichiers 113 → 91 s.
  - Relevé, non corrigé : une étape qui part avant la relecture tardive du coût de l'échange
    précédent (Bob) compte aussi cet échange (`costStart` encore inconnu) ; le délai des empreintes
    git le masquait dans les essais.
  - Retiré après relecture : l'absence d'empreinte par tour pour un participant `enforced`
    (déclaration du profil, pas une observation : Bob peut écrire sans demander si ses règles
    d'approbation le permettent).

- 2026-11-25 : course du coût tardif corrigée dans le produit (relevée à fix15 ; branche
  `1.2-fix16-engine`). Règle : un total peut être un peu bas, jamais gonflé.
  - Cause : une étape qui part avant la relecture tardive du coût de l'échange précédent (agent au
    coût lu après coup, Bob) prend pour départ le coût d'avant cette relecture ; le relevé arrivé
    pendant l'étape lui comptait aussi l'échange précédent.
  - Correction : avant le départ d'une étape, attente bornée (6 s, `PREVIOUS_COST_WAIT_MS`) de la
    **fin de la relecture du coût** du dernier tour de la conversation. Le lecteur de coût
    (`session-cost.ts`) l'annonce lui-même : `cost-reading` actif à la fin d'un tour (agent à
    `costSource`), fini dès qu'un coût est relevé ou après la dernière relecture à heure fixe (5 s)
    sans changement ; `unknown` si la dernière lecture n'a rien rendu (source illisible). Une
    relecture remplacée par celle d'un tour plus récent ne finit pas pour lui. La marque est
    tenue par conversation (`observeCost(id, …)`, identifiant de l'évènement). L'attente court en
    même temps que l'empreinte du dossier ; ce qu'elle a duré va au journal Détaillé
    (`agents.log` : « relecture du coût du tour d'avant attendue N ms »). Fin de relecture : le
    coût connu est le coût de départ. Borne dépassée ou source illisible (le seul vrai cas
    d'ignorance) : la tentative part marquée `startUnknown`, son coût n'est pas compté (total bas,
    coût de l'étape « non communiqué » s'il n'y a qu'elle ; son relevé borne quand même les
    tentatives suivantes). Choisi plutôt que « le premier relevé après le départ est celui
    d'avant » : Bob écrit sa dépense au fil du tour (S-B1), ce relevé pourrait déjà compter une
    part de l'étape, et l'attente donne le compte exact dans le cas ordinaire.
  - Première version refusée à la relecture : l'attente ne se levait que sur un relevé ; un tour
    d'avant sans dépense (arrêté, en erreur, coût inchangé) faisait attendre 6 s, puis l'étape
    était comptée pour rien. Levée désormais à la fin de la relecture, avec ou sans changement.
  - Reste : une écriture du coût plus tardive que la relecture de 5 s (vue ensuite par la veille
    de la source) n'est pas attendue ; elle serait comptée à l'étape partie entre-temps.
  - Essais : agent factice `--cout-bob-delai <ms>` (coût écrit 3 s après la réponse) ; tour lancé
    avant la relecture (synthèse et pied du tour à 0,0125 au lieu de 0,025, rouge avant la
    correction) et attente dépassée (borne de 200 ms : départ inconnu, rien de compté, rouge
    avant) ; tour d'avant sans dépense (`--cout-bob-gratuit 2`, borne d'essai de 60 s) : la
    synthèse part à la fin de la relecture de la conversation (≈ 5 s), après la fin de celle du
    participant façon Bob qui ne l'a pas levée, et son coût est compté (rouge sur la première
    version : partie à la borne) ; arbitre au coût annoncé et participant façon Bob en relecture :
    l'arbitre n'attend pas. `session-cost.test.ts` : fin sur un relevé, à 5 s sans changement,
    `unknown` sur une source illisible, relecture remplacée. L'attente du coût du premier échange
    ajoutée aux essais de coût à fix15 est retirée ; les essais où le coût tardif appartient bien à
    l'étape restent verts.

- 2026-11-25 : essai « participant mis à la corbeille pendant le recueil puis restauré » rouge
  sous forte charge (charge 37, vérification avant push ; branche `1.2-fix16-engine`).
  - Défaut de l'essai, pas du produit. La mise à la corbeille arrête la place tout de suite
    (`deleted` → `seat-stopped`), puis `manager.delete` attend le déplacement du fil
    (`trashed.put`). Si les deux autres avis sont déjà là, la synthèse part pendant ce temps, et
    l'absence se lit à ce moment (`gone` : `exists`, lu en direct, rien de mis en cache) : elle dit
    « supprimé », ce qui est juste à cet instant. L'essai restaurait après `delete`, donc trop tard.
    Reproduit à coup sûr en ralentissant `trashed.put` de 300 ms.
  - Masqué jusqu'à fix15 : avec un dépôt git, les empreintes (lecture seule des participants, fin
    du recueil) retardaient le départ de la synthèse. Avec 50 ms de plus sur `trashed.put` :
    rouge 3 fois sur 3 sans dépôt, vert 3 fois sur 3 avec. fix16 n'y est pour rien (aucun agent
    au coût lu après coup dans cet essai).
  - Corrigé : recueil tenu par le verrou de fin de tour pour tous les participants ; la phase est
    encore « recueil » après la restauration (vérifié), puis le verrou est levé. Vert aussi avec
    `trashed.put` ralenti de 300 ms. Mêmes assertions.
  - Revue des autres essais du dossier qui agissent pendant le recueil (corbeille, arrêt,
    relance, « Synthétiser sans attendre », plafond, modèle changé, redémarrage) : tous tiennent
    déjà le recueil (verrou de fin de tour ou de démarrage, ou porte sur `children.start`), ou
    n'agissent qu'après la synthèse ; « participant supprimé pendant le recueil » attend que la
    synthèse dise « supprimé », ce qui est l'état au départ par construction.

- 2026-11-25 : évaluation réelle de la 1.2.0-beta.1 (OpenCode sur abonnement ChatGPT), E2 « pas de
  ligne Consommé » (branche `1.2-fix17-engine`).
  - Ni le moteur ni le calcul ne manquaient : les fils réels gardent les jetons des participants
    (≈ 20 k en entrée, 1 k en sortie) et de la synthèse, coût annoncé 0 $US ; rendue avec ces
    données, la carte « Réplique » disait « Consommé en tout : 456,4k jetons · coût inconnu ». Mais
    la carte du tour perdait sa ligne dès la réplique (`!rebutted`, total déplacé sur la carte
    « Réplique », plus bas, sous la synthèse) : c'est la carte du tour qu'on regarde.
  - Corrigé : la carte du tour garde sa ligne dans toutes les phases, « Consommé en tout » après la
    réplique (même total que la carte « Réplique », gardée comme sur la maquette). Écart à la
    maquette : la ligne apparaît deux fois après la réplique.
  - Essais : `RoundtableCard.test.tsx` (données d'abonnement, repliée et dépliée ; rouge avant) ;
    e2e `tour-de-table` : capture `285-carte-apres-replique` et vérification (rouge avant).
