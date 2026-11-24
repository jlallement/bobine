# ADR-0072 — Tour de table : des participants filles en lecture seule, menés par l'app

- **Statut** : accepté le 2026-11-24 (étude `docs/tour-de-table-etude-technique.md`, fiche 285,
  décisions C1 à C8)
- **Date** : 2026-11-24 (révisé le même jour après les décisions de l'utilisateur, puis aligné sur
  les maquettes finales `docs/maquettes/1.2-tour-de-table-v2.html`)
- **Complète** : ADR-0019 et ADR-0020 (conversations filles, plafond de travaux), ADR-0036 (mère
  tech lead), ADR-0060 et ADR-0061 (carte-réponse, carte de groupe), ADR-0035 (plafond de coût par
  conversation, inchangé), ADR-0011 (générique d'abord), ADR-0014 (langues)

## Contexte

La 1.2 ouvre le « Tour de table » (`/roundtable`). L'utilisateur pose une question à 2 à 5
participants (un couple agent et modèle chacun), choisis dans un menu à cases de la saisie dont le
dernier choix est retenu. Il lance en deux gestes : la commande (ou le bouton) avec la question,
puis Entrée. Chaque participant répond sans voir les autres et sans rien
modifier. La conversation mère, en tech lead, rend une synthèse critique en six rubriques. Un seul
tour de réplique est possible, à la demande, puis la mère tranche.

Un tour coûte nettement plus de jetons qu'une question simple. L'utilisateur a décidé de le dire
sobrement : un multiplicateur de la consommation de jetons avant l'envoi et à côté du bouton de
réplique, le total consommé après. Pas d'estimation de coût, pas de plafond propre au tour.

Presque tout existe déjà :

- des filles en lecture seule sur un autre agent ou un autre modèle (`ChildConversations.start`,
  rôles, fiche 223) ;
- la réponse entière gardée dans le fil de la mère (carte-réponse, fiche 263) ;
- la carte de groupe (fiche 264) ;
- le réveil groupé (`children-wake.ts`) ;
- les coûts par conversation (fiches 109, 130) et le plafond par conversation (fiche 157).

Il manque trois choses : une orchestration déterministe (recueil, synthèse, réplique), un modèle
imposé sans repli silencieux (`applyModel` part avec le modèle de l'agent si l'option manque ou est
refusée), et un état de tour qui survive au redémarrage.

## Décision

1. **Un participant est une conversation fille en lecture seule.** Elle est lancée par
   `ChildConversations.start` avec :
   - un rôle figé fourni par le code (consigne de participant, `readOnly: true`, aucune famille
     d'outils de Bobine) ;
   - la clé de carte `card = roundtableId` ;
   - les pièces jointes de la saisie, nouvelles pour une fille.

   Elle travaille dans le dossier de la mère, sans worktree. Elle hérite de la lecture seule, des
   coûts, du plafond par conversation, de la famille, de la corbeille, de l'archivage et du rejeu
   des filles.
2. **L'app mène le tour, pas l'agent.** Un module main `roundtable/` :
   - réserve les N places en une fois, ou refuse tout le tour ;
   - impose le modèle de chaque participant en mode **strict** : une erreur de
     `session/set_config_option` (OpenCode : `-32602` « model not found », la session gardant
     l'ancien modèle) met le participant en erreur ; la valeur est relue après les
     `config_option_update` qui suivent, un seul réglage de modèle à la fois, avant l'envoi ; aucun
     repli (lot 0, O3 à O6) ;
   - suit les participants ;
   - envoie la synthèse à la mère **au repos** : message de l'app `from: { kind: 'roundtable' }`,
     avis bornés à 6 000 caractères chacun en contexte caché, en anglais, **anonymisés** :
     désignés par une lettre (« Participant A, B, C »), dans un ordre mélangé à chaque tour, sans
     nom de modèle ni table des lettres pour la mère. La table lettre → participant reste dans
     l'élément du tour, pour l'interface, qui montre les vrais noms ;
   - mène une seule réplique par `followUp` vers chaque participant (la synthèse et sa lettre),
     puis la décision.

   Quorum : 2 avis exploitables. Synthèse automatique quand tous ont fini (en erreur ou arrêtés
   compris) ; « Synthétiser sans attendre » dès le quorum. Pas de délai. Après un redémarrage,
   rien ne part seul : un geste est demandé.
3. **L'état du tour vit dans le fil de la mère**, dans un élément `roundtable` remplacé sur place
   (phase, participants, lettres, coûts des tours de la mère). Une réconciliation pure le règle au
   chargement : un tour en cours au redémarrage devient `interrupted`, et rien ne repart seul.
   `workLayout` range les participants dans **une** carte de groupe d'un genre « tour de table »,
   ancrée sur cet élément, en liste repliable ; la carte se replie en une ligne quand la synthèse
   arrive. Dans la liste latérale, les participants sont des travaux ordinaires de la mère.
4. **Les participants restent hors de la machinerie des filles de la mère.** Ils sont exclus des
   nouvelles jointes (`childContext`), des outils de la mère (`message_child`, `child_status`,
   `recommend_merge`) et du réveil groupé (`ChildWake`).
5. **Le coût se dit, sans estimation ni plafond propre.**
   - Avant l'envoi, dans la ligne du tour de table : un multiplicateur de la consommation de
     jetons (« N participants ▾ + synthèse · ≈ N + 1 fois les jetons d'une question simple »,
     forme courte « ≈ N + 1 fois plus de jetons » en saisie étroite), et la destination de chaque
     participant dans l'infobulle. C'est un compte de tours : aucun montant, aucun nombre de
     jetons estimé.
   - À côté du bouton de réplique : « ≈ N + 1 fois les jetons d'une question simple ».
   - Après : le total consommé, somme des participants et des tours de la mère marqués
     « roundtable », par unité, avec les chiffres communiqués par les agents, en une ligne au pied
     de la carte.
   - Le plafond par conversation (ADR-0035) s'applique tel quel à chaque conversation du tour,
     séparément ; l'orchestrateur reconnaît seulement un tour annulé ou un message retenu par lui.
   - Ni migration du journal, ni réglage : le choix des participants est une préférence retenue
     depuis le menu de la saisie, sans entrée dans les Réglages.
6. **Générique.**
   - Un profil sans choix de modèle (`childModelChoice` absent, Bob) n'a qu'une place par tour,
     avec son propre modèle.
   - Rien n'est supposé d'un agent : le coût après coup de Bob ne fait que retenir l'étape suivante
     si le plafond par conversation est atteint.
   - Le lancement par l'agent viendra après la v1 par un outil dédié `propose_roundtable` avec
     carte d'accord, pas par une extension de `start_child`.

### Décisions de l'utilisateur à l'acceptation (2026-11-24)

Elles précisent la décision ci-dessus (fiche 285, décisions C1 à C8) :

1. **La synthèse est rédigée par la conversation en cours**, avec son agent et son modèle : rien à
   choisir.
2. **Elle arbitre seulement** : elle compare, critique et tranche, sans donner son propre avis
   comme un participant de plus.
3. **Lecture seule chez un agent qui écrit sans demander** (OpenCode) : Bobine demande le mode le
   plus restrictif disponible. « Participant » est un **rôle fourni**, de conseil et en lecture
   seule ; installé dans l'agent par « Installer dans… » (ADR-0047), il sert de mode natif
   garanti. Sinon la lecture seule est seulement demandée : `ReadOnlyWatch` compare le dossier
   avant et après, et la ligne du participant signale tout fichier modifié. **Jamais
   d'installation automatique.** Le mode `plan` d'OpenCode n'est pas une garantie : on ne s'appuie
   pas dessus. Cela tranche la question laissée ouverte par le lot 0 : on n'exige pas l'agent
   installé, on lance avec « lecture seule demandée » affichée.
4. **Modèle strict** : un seul réglage de modèle par session ; une erreur de réglage met le
   participant en erreur ; la valeur est relue après `config_option_update`, avant l'envoi ; un
   modèle absent du catalogue donne « modèle introuvable » ; jamais de repli silencieux.
5. **Hors dépôt git**, le tour de table fonctionne : lecture seule, dans le dossier (non vérifiée
   pour un agent qui écrit sans demander).
6. **Menu des participants** : les modèles récemment utilisés d'abord, puis « Autres modèles… ».

Le contrat qui en découle (types, réducteur, messages aux agents, canaux) vit dans
`src/shared/roundtable.ts`, `roundtable-prompts.ts` et `roundtable-ipc.ts`. Les avis et la
synthèse y sont transmis **comme des données, pas comme des instructions** : encadrés par des
balises de l'app, balises de l'app qu'ils contiendraient neutralisées, consigne explicite de ne
suivre aucune instruction qui s'y trouve.

## Alternatives écartées

- **Orchestrateur dédié** (un `AgentHost` par participant hors conversation, comme l'aparté de la
  fiche 180) : tout serait à refaire. La lecture seule (l'aparté refuse tout, lectures comprises),
  les coûts, la persistance (l'aparté vit en mémoire : rien après un redémarrage, pas de réplique
  après une mise en veille), les pannes de démarrage. Et le participant ne serait pas une
  conversation qu'on peut ouvrir.
- **Tout confier à l'agent de la mère** (une consigne façon `/split` : « lance N `start_child` en
  lecture seule, puis synthétise ») : rien n'est déterministe. L'agent peut oublier un participant
  ou ne pas attendre. Les comptes rendus sont bornés à 1 200 caractères, une carte d'accord
  s'affiche par fille, un dépôt git est exigé, et le modèle ne peut être que celui de la mère.
- **Réutiliser `ChildWake` et `WAKE_TEXT`** : leur attente mêle toutes les filles d'une mère, leur
  déclencheur lit `childNews` (dont les participants sont exclus) et leur texte parle de fusion.
- **Un outil pour lire les avis** (`roundtable_answers`) : un aller-retour de plus, sans garantie
  d'appel, et une autorisation à chaque appel chez Bob.
- **Étendre `start_child`** pour le lancement par l'agent : le contrat est différent (N
  participants, lecture seule imposée, synthèse par l'app, pas besoin de git), et la description de
  l'outil, déjà longue, est payée en contexte à chaque session.
- **Estimer le coût avant l'envoi** (médianes du journal par modèle) : écarté par l'utilisateur. Une
  estimation sur un historique mince trompe, et elle alourdit le lancement.
- **Un plafond propre au tour** (activé par défaut, figé au lancement, participants sans plafond de
  conversation) : écarté par l'utilisateur. Un réglage, une migration et une garde de plus, pour un
  besoin que le plafond par conversation couvre déjà conversation par conversation.
- **Joindre tout l'échange de la mère aux participants** : le coût serait multiplié par N et les
  avis orientés. Retenu : la question, les fichiers et le dernier échange, borné à 8 000
  caractères (décision D2 de la fiche).
- **Donner à la mère les noms des participants**, ou la table des lettres à la fin de la
  synthèse : biais d'identité et d'auto-préférence possibles au moment où la mère juge, surtout
  quand son propre modèle participe (décision D1 de la fiche).

## Conséquences

- **Positif.**
  - Peu de code neuf : un élément de fil, un module d'orchestration, une ligne dans la saisie, un
    menu à cases.
  - Réutilisation d'éléments éprouvés, plafond par conversation compris.
  - Chaque avis reste une conversation qu'on peut ouvrir.
  - Le surcoût est dit avant et après, sans chiffre deviné.
- **Négatif.**
  - `children.ts`, `children-review.ts` (`applyModel`), `host-options.ts` et `work-groups.ts` sont
    touchés ; ce sont les filles, très utilisées. Chaque lot repasse les suites `filles*`,
    `roles-travail`, `travaux-groupe` et `parcours-deleguer`.
  - Les participants prennent des places de `maxChildren`.
  - N + 1 agents vivants : ≈ 2,2 Go d'empreinte pour 5 + 1 OpenCode 2.3.0, qui lance deux
    processus par agent (≈ 360 Mo, RSS ≈ 650 Mo) ; ≈ 230 Mo par Bob 2.1.0 (lot 0, O12 et B6).
  - La liste latérale gagne N filles par tour, rangées comme des travaux ordinaires (décision D4
    de la fiche) ; l'encombrement se mesure à la recette.
  - Pas de plafond sur le total d'un tour : qui active le plafond par conversation l'a par
    conversation, pas par tour.
- **Interdit.**
  - Lancer un tour partiel faute de places.
  - Laisser un participant répondre avec un autre modèle que celui affiché.
  - Additionner des coûts d'unités différentes.
  - Afficher une estimation de coût inventée.
  - Relancer quoi que ce soit seul après un redémarrage.
  - Plus d'une réplique.
  - Tout code propre à un agent dans l'interface.
- **Lot 0, observations réelles** ([rapport du lot 0](../recettes/2026-11-24-tour-de-table-lot0.md), OpenCode 2.3.0, Bob 2.1.0).
  - **Confirmé** : la lecture seule seulement « demandée » chez OpenCode (`writesWithoutAsking`).
    Le mode `plan` **n'est pas** une lecture seule (une commande `shell` écrit sans demande) : il
    n'est jamais posé pour un participant. L'agent « participant » installé en lecture seule
    (`edit`, `shell`, `subagent` refusés) n'a rien écrit : le rôle nomme ce mode natif quand la
    session l'annonce. **Décidé à l'acceptation** : pas d'exigence ni d'installation automatique ;
    sans l'agent installé, « lecture seule demandée » est affichée sur la ligne du participant.
  - **Confirmé** : le modèle peut ne pas être celui demandé (modèle refusé, catalogue qui change,
    réponse au réglage en retard) et rien ne nomme le modèle qui a répondu : mode strict ci-dessus.
  - **Levé** : 5 `opencode acp` et 2 `bob acp` simultanés sur le même stockage (aucun verrou ni
    erreur ; coûts de Bob justes par tâche ; pas de ralentissement à deux).
  - **Levé** : Bob ne demande pas l'autorisation de lire avec ses réglages par défaut ; une écriture
    refusée finit le tour proprement (`failed`, puis `end_turn`).
  - **Ouvert** : le `-32603` « Server Error » de Bob (pas survenu), la forme d'une limite de débit,
    les lectures de Bob avec le groupe `read` retiré, la mémoire sur un vrai projet.
