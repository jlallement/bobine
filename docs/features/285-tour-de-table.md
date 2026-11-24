# 285 — Tour de table : une question, plusieurs modèles, une synthèse critique

- **Statut** : maquettes validées, à planifier (1.2). Étude fonctionnelle et technique du
  2026-11-24, révisée le même jour après les décisions de l'utilisateur, puis alignée sur les
  maquettes finales.
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
  (proposé).
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
    lors de sa dernière session (`modelsSeen`, fiche 108). La liste suit l'ordre habituel des
    menus de modèles, sans mise en avant particulière.
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

Son premier message contient, dans cet ordre :

1. **La consigne du participant**, en anglais, car ce qui va à l'agent ne se traduit pas
   (ADR-0014). Voir « Consigne donnée aux participants ».
2. **La question**, telle que tapée.
3. **Les pièces jointes du message** et les fichiers cités par `@fichier`. Le participant peut
   lire le dépôt lui-même : il a ses outils de lecture.
4. **Le dernier échange de la conversation**, s'il y en a un : dernier message et dernière
   réponse, sur le rendu de la fiche 108 (`conversationText`), borné à environ 8 000 caractères
   (décision D2). Sans case à cocher ; l'infobulle de « 3 participants » le dit.

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

- **« Appliquer »**, sous la synthèse ou la décision : met dans la saisie un message préparé
  (« Applique ta recommandation du tour de table. »), modifiable avant l'envoi, comme « Demander à
  <agent> d'appliquer cette réponse » (fiche 263). L'agent travaille alors normalement, avec ses
  autorisations habituelles : c'est le seul moment où des fichiers peuvent changer.
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
- **Un modèle non appliqué** (l'agent ne le propose plus, ou en garde un autre) : **pas de
  substitution silencieuse.** L'avis D32 de la fiche 266 remplace un modèle non proposé par le
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
  lecture seule n'est que demandée (`writesWithoutAsking`), et leur ligne le dit.
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
  - supprimer la conversation d'un participant avant la synthèse la sort de la synthèse et de la
    réplique ; après, son avis reste lisible dans la carte, sa ligne dit « conversation supprimée »
    et perd « Ouvrir ».
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
  `roundtable_id`), reportée après la v1. Les participants y figurent déjà comme travaux de la
  conversation d'origine.
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

- [ ] `/roundtable <question>` (ou le bouton de la saisie) affiche la ligne du tour de table sous
      la question : « N participants ▾ + synthèse · ≈ N + 1 fois les jetons d'une question
      simple », en gris, sur une ligne, forme courte en saisie étroite, jamais coupée ; Entrée
      envoie. `/roundtable` seul explique et n'envoie rien. La commande est listée dans l'aide.
- [ ] « N participants ▾ » ouvre le menu à cases ; chaque case est retenue aussitôt pour les
      tours suivants, sans bouton « Enregistrer » ni entrée dans les Réglages. Sans participant
      retenu, la ligne dit « Choisir les participants ▾ », rien n'est présélectionné, et Entrée
      ouvre le menu au lieu d'envoyer.
- [ ] Le menu accepte de 2 à 5 participants : il refuse un doublon d'agent et de modèle, ne
      propose Bob qu'une fois et sans modèle, et montre l'agent de chacun ; l'infobulle de « N
      participants » donne la destination et ce qui part avec la question. Aucun modèle n'est mis
      en avant ou étiqueté à part.
- [ ] S'il manque des places de travaux, la ligne le dit et rien ne part.

**Indépendance et lecture seule**

- [ ] Chaque participant reçoit consigne, question, fichiers et dernier échange borné, et
      **jamais** l'avis ni le nom d'un autre. Vérifié par un scénario de
      l'agent factice qui répète ce qu'il a reçu.
- [ ] Les participants sont en lecture seule dans le dossier d'origine, sans worktree, sans outil
      de Bobine : écritures demandées refusées, empreinte comparée, mention « lecture seule
      demandée » pour un agent qui écrit sans demander, « non vérifiée » hors git.
- [ ] Un modèle non appliqué met le participant en erreur avant l'envoi de la question, sans
      substitution.

**Attente, avis, synthèse**

- [ ] La bulle et la carte du tour de table restent à leur place. Chaque ligne a son état et sa
      durée ; repliée, elle montre la réponse courte et la confiance ; dépliée, l'avis entier.
- [ ] La synthèse part seule quand tous ont fini et qu'au moins deux avis sont là, au premier
      repos de l'agent, même avec un participant en erreur. « Synthétiser sans attendre » existe
      dès deux avis et arrête les participants restants. Moins de deux avis : pas de synthèse.
- [ ] La demande de synthèse contient les avis bornés à 6 000 caractères (coupure dite),
      anonymisés (« Participant A, B, C », ordre mélangé, sans table des lettres ni nom de
      modèle), avec les absents nommés par leur lettre. Les avis ne repartent pas avec le message
      suivant de l'utilisateur.
- [ ] La synthèse est marquée dans le fil ; au survol, une lettre montre le vrai nom du
      participant. La carte se replie en une ligne à l'arrivée de la synthèse et se rouvre d'un
      clic.

**Réplique et suite**

- [ ] « Faire réagir les participants », suivi en gris de « ≈ N + 1 fois les jetons d'une
      question simple », envoie la synthèse et la lettre
      du participant à chaque participant qui a répondu, dans sa conversation. Les répliques
      s'ajoutent à la carte, puis la décision du tech lead. Le main refuse une seconde réplique.
- [ ] « Appliquer » met un message préparé et modifiable dans la saisie.

**Surcoût et plafond**

- [ ] Aucune estimation de coût, en argent ou en jetons, n'est affichée avant l'envoi.
- [ ] Le pied de la carte affiche, en une ligne, le total consommé par unité (participants,
      synthèse, réplique, décision), sans conversion, avec les participants sans chiffre comptés.
- [ ] Aucun bandeau, aucun dialogue de confirmation, aucun encadré de premier usage.
- [ ] Plafond par conversation activé : un participant au plafond est « arrêté : plafond
      atteint » ; une synthèse retenue par le plafond du tech lead affiche la carte habituelle, et
      « Continuer » l'envoie.

**Cas limites**

- [ ] Un participant en erreur ou arrêté n'empêche pas la synthèse des autres.
- [ ] Un second `/roundtable` dans la même conversation est refusé tant que le premier n'a pas
      rendu sa synthèse. Un message pendant le tour part sans les avis, et la synthèse attend la
      fin de la réponse.
- [ ] Après un redémarrage, la carte se relit du fil : les participants en cours sont « arrêtés
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
- [ ] Unitaires : désignation et mélange, bornes, dernier échange, total par unité, état lu du fil
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
