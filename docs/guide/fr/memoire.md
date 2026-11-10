# Mémoire commune

Un agent peut proposer de retenir ce que vous lui apprenez : une préférence, une correction, le
contexte d'un projet. Les souvenirs que vous acceptez sont donnés aux agents au début de chaque
conversation, **quel que soit l'agent** : ce qu'IBM Bob a appris vaut encore avec OpenCode. Rien
n'est gardé sans votre accord.

Ici, vous pouvez :

- [accepter ou refuser une proposition](#proposition) ;
- [relire, modifier, déplacer ou supprimer vos souvenirs](#reglages) ;
- [désactiver la mémoire](#desactiver).

<a id="proposition"></a>

## Accepter ou refuser une proposition

Quand l'agent veut retenir quelque chose, une carte **Retenir ce souvenir ?** arrive dans la
conversation, avec le texte entier. La conversation continue en attendant votre réponse.

- **Retenir** : le souvenir est gardé, et l'agent l'apprend à votre message suivant.
- **Non** : rien n'est gardé.

Un souvenir vaut pour **Vous · tous les projets** (vos préférences) ou pour **Ce projet** seulement.
Un worktree et le dépôt d'où il vient partagent la même mémoire.

L'agent peut aussi proposer d'oublier un souvenir devenu faux (**Oublier ce souvenir ?**), ou d'en
remplacer un : la carte montre alors l'ancien texte.

Soyez attentif aux cartes signalées : une proposition faite juste après la lecture d'une page web
ou d'un fichier joint peut venir de ce contenu plutôt que de vous, et une proposition qui contient
une commande à exécuter la surligne. Relisez-les : un souvenir revient à chaque conversation du
projet. Un texte qui ressemble à un secret (clé, jeton, mot de passe) est refusé.

<a id="reglages"></a>

## Relire et ranger vos souvenirs

Réglages › **Mémoire** › **Souvenirs** : choisissez **Vous · tous les projets** ou un projet, puis
dépliez un souvenir pour voir qui l'a proposé et quand. Vous pouvez :

- **Modifier** sa description, son type ou son texte ;
- **Déplacer vers Vous** (ou vers ce projet) ;
- **Supprimer** ; **Tout effacer…** vide la mémoire affichée ;
- **Exporter…** la mémoire affichée en Markdown ;
- **Rattacher à un dossier…** les souvenirs d'un projet dont le dossier a été déplacé.

Les souvenirs sont des fichiers Markdown, en clair sur ce Mac (**Afficher dans le Finder**). Un
fichier modifié hors de Bobine, par un éditeur ou par un agent avec ses propres outils, n'est plus
donné aux agents tant que vous ne l'avez pas relu : **Garder ces modifications** le valide.

La mémoire fait partie d'une [sauvegarde](reglages.md#sauvegarde).

<a id="desactiver"></a>

## Désactiver la mémoire

Réglages › Mémoire › **Mémoire activée** : coupée, les agents ne reçoivent ni souvenirs ni moyen
d'en proposer. Vos souvenirs restent là, et reviennent quand vous la réactivez.
