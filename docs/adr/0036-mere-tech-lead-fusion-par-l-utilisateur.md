# ADR-0036 — La mère pilote ses filles en tech lead ; l'utilisateur fusionne

- **Statut** : proposé
- **Date** : 2026-10-28

## Contexte

L'ADR-0019 a posé le lien mère-fille, le compte rendu de fin de tour (« la fin de sa dernière
réponse ») et le réveil groupé ; il laissait la mère « dire à l'utilisateur » quelles branches
fusionner, et l'utilisateur choisissait seul l'agent et le modèle de chaque fille (fiche 112).
Le 28/10, l'utilisateur a décidé de reproduire le fonctionnement des sessions de Claude Desktop :
la session mère reçoit une note courte à chaque fin de tour d'une session fille (jamais le diff),
vérifie elle-même, renvoie des remarques à la fille qui garde son contexte, et ne fusionne que si
l'utilisateur le demande. Sans bornes, plusieurs filles sur plusieurs tours rempliraient le
contexte de la mère ; sans verdict structuré, l'utilisateur ne sait pas quelle branche la mère a
vraiment relue.

## Décision

1. **La mère suggère, l'utilisateur choisit** l'agent et le modèle d'une fille (`start_child` :
   `agent`, `model`, `why` facultatifs) ; jamais un choix appliqué seul. Le main les valide contre
   les profils disponibles et les options du réglage de catégorie `model` de l'agent de la mère
   (le seul dont on connaisse les options) ; une valeur inconnue est une erreur pour l'agent, avec
   les valeurs possibles, sans carte. Le modèle n'est suggérable que si le **profil** de l'agent le
   permet (`childModelChoice: 'ask'`, déclaré dans le profil, listé dans `specificItems` et
   `docs/agents.md`) : sinon (Bob), erreur claire, et aucun champ modèle pour une fille, même dans
   « Lancer en parallèle… ». Toute fille de l'agent passe par la carte « Tâches proposées » : la
   suggestion y est présélectionnée, sélecteurs ouverts, avec sa raison, et ne s'applique que par
   « Lancer » (confirmée ou changée). Le main le vérifie lui-même : `ChildConversations.start`
   refuse un modèle pour un profil qui ne le permet pas, quel que soit le chemin (carte,
   « Lancer en parallèle… », IPC). Une consigne ou un message de la mère qui commence par une
   commande « / » est refusé : il changerait l'agent ou le modèle de la fille sans l'utilisateur.
2. **Le compte rendu est une note bornée** : état, branche, fichiers touchés avec +/− (8 cités, les
   autres comptés), le **début** du récapitulatif de la fille (400 caractères), au plus 1 200
   caractères par compte rendu dans ce qui part à l'agent. **Jamais de diff.** Un message de la
   fille à sa mère (`message_parent`) est borné de même (2 400 caractères, coupure dite). Ce choix remplace
   « la fin de sa dernière réponse » de l'ADR-0019.
3. **Le compte rendu n'est pas une preuve** : descriptions d'outils, réveil et contexte de session
   disent à la mère de vérifier par ses propres outils (git sur la branche de la fille, fichiers à
   risque, contrôles du projet) ou par un sous-agent, et de renvoyer les corrections par
   `message_child`.
4. **La mère recommande, l'utilisateur fusionne.** `recommend_merge` (`child`, `ready`, `note`)
   pose une recommandation dans le fil de la mère (élément `child-recommendation`), affichée dans
   le fil et sur la ligne de la fille dans « Sous-tâches ». Un nouveau tour de la fille la rend
   caduque. **Aucun outil de l'agent ne fusionne.** Dès qu'une recommandation existe, « Fusionner »
   ne prend que les filles recommandées ; les autres restent possibles après une confirmation.

## Alternatives écartées

- **Un outil `merge_child` pour l'agent** — la fusion touche la branche de base de l'utilisateur :
  elle reste son geste (ADR-0022, fiche 120).
- **Joindre le diff au compte rendu** — sature le contexte de la mère, et la mère peut le lire
  elle-même quand elle en a besoin (git sur la branche).
- **Laisser la mère choisir sans carte** — l'utilisateur perdrait le contrôle du coût (modèle) et
  de l'agent ; la présélection garde l'accord par fille de l'ADR-0019.
- **Dériver le choix du modèle de la seule présence d'un réglage `model`** — un agent peut en
  exposer un sans qu'on veuille le choisir pour une fille ; la capacité est déclarée par profil,
  comme les autres fonctions propres (ADR-0011). Décision de l'utilisateur du 28/10 : Bob, jamais.
- **Valider le modèle d'un autre agent** — Bobine ne connaît ses options qu'une fois sa session
  ouverte ; un autre agent prend son dernier modèle choisi, comme dans « Lancer en parallèle… ».

## Conséquences

- Générique : aucun nom d'agent hors des profils (ADR-0028) ; rien n'est supposé de Bob, les
  outils passent par le serveur MCP de l'app comme ceux de l'ADR-0019.
- Le récapitulatif lu est le début de la dernière réponse : `start_child` demande à la fille de
  commencer sa réponse finale par un court bilan.
- Une mère qui ne recommande jamais rien laisse la fusion de la fiche 120 inchangée (toutes les
  filles finies).
- À surveiller : qu'un vrai agent (Bob, OpenCode) appelle bien `recommend_merge` après avoir
  vérifié, et pas d'emblée ; ajuster les descriptions sinon.
