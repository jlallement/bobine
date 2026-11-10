# Modes et modèles

Le mode dit à l'agent comment travailler : agir, ou seulement lire et proposer un plan. Le modèle
est l'IA qui répond. Les deux dépendent de ce que l'agent propose.

Ici, vous pouvez :

- [changer de mode](#changer-de-mode) ;
- [planifier avant d'agir](#mode-plan) ;
- [changer de modèle](#modele) ;
- [voir tous les réglages de la session](#reglages-de-session) ;
- [choisir le mode de départ](#mode-de-depart) ;
- [continuer avec un autre agent](#continuer-avec).

<a id="changer-de-mode"></a>

## Changer de mode

Cliquez sur la puce du mode, sous la zone de saisie, et choisissez. Ou ⇧⇥ dans la zone de saisie
pour passer au mode suivant, ou tapez `/mode` suivi du nom du mode.

Les modes viennent de l'agent :

| Agent | Modes |
|---|---|
| IBM Bob | Agent, Plan, Ask, et vos modes personnels |
| OpenCode | réglage « Session Mode » : `build`, `plan`, et vos agents personnels |

<a id="mode-plan"></a>

## Planifier avant d'agir : le mode Plan

En mode Plan, l'agent lit et propose, sans rien modifier. La zone de saisie prend la couleur du
mode, la puce devient une pastille **Plan**, et une ligne rappelle comment en sortir.

Le plan s'affiche en document dans le fil : vous l'annotez, puis **Envoyer mes remarques** ou
**Exécuter le plan**. Voir [Relire et annoter un plan](conversations.md#plan).

Pour sortir du mode Plan : **Exécuter le plan**, la puce du mode, ou ⇧⇥.

<a id="modele"></a>

## Changer de modèle

**Agents :** OpenCode. IBM Bob ne propose pas de choix du modèle.

Cliquez sur la puce du modèle, à côté du choix de l'agent : la liste s'ouvre sur le modèle choisi,
avec une recherche au-delà de 10 modèles. Le fournisseur est indiqué à droite. Ou tapez `/model`
suivi du nom.

Avec certains modèles, OpenCode propose aussi un réglage **Effort**.

<a id="reglages-de-session"></a>

## Voir tous les réglages de la session

L'icône **Réglages de la session**, dans la barre de saisie, liste tout ce que l'agent permet de
régler (mode, modèle, effort…), ainsi que ses serveurs MCP et ses règles actives. Bobine retient
vos choix pour chaque agent.

<a id="mode-de-depart"></a>

## Choisir le mode de départ

Réglages › Conversations › Nouvelle conversation › **Mode** : **Comme la dernière fois** (par
défaut), **Exécution** ou **Plan**. Une nouvelle conversation démarre dans ce mode.

Dans la même rubrique : l'agent et le dossier des nouvelles conversations.

<a id="continuer-avec"></a>

## Continuer avec un autre agent

Une conversation commencée avec IBM Bob peut continuer avec OpenCode, et l'inverse.

1. Cliquez sur l'agent, à droite de la barre de saisie.
2. Sous **Continuer avec**, choisissez l'agent (et, pour OpenCode, un modèle).
3. Avant de confirmer, Bobine dit où partiront vos messages (agent, modèle, fournisseur). Cliquez
   sur **Continuer avec …**.

La conversation reste la même : le fil est gardé, un trait « Suite avec … » marque la bascule, et
l'échange précédent part en texte avec votre prochain message, pas avant. L'ancien agent ne reçoit
plus rien ; sa session reste chez lui.

Sous **Nouvelle conversation avec**, le même menu ouvre plutôt une nouvelle conversation.
