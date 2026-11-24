# Tour de table

Un tour de table pose la même question à deux à cinq modèles, sans qu'aucun voie les avis des
autres. La conversation compare ensuite les avis, les met en cause et rend une synthèse qui
tranche. Utile avant une décision qui compte : un choix d'architecture, un diagnostic, un plan.

Ici, vous pouvez :

- [lancer un tour de table](#lancer) ;
- [choisir les participants](#participants) ;
- [suivre les avis](#avis) ;
- [lire la synthèse](#synthese) ;
- [faire réagir les participants](#replique) ;
- savoir [ce que coûte un tour de table](#cout).

<a id="lancer"></a>

## Lancer un tour de table

Tapez `/roundtable` suivi de votre question, ou cliquez sur le bouton du tour de table dans la
barre de la zone de saisie, puis écrivez la question. La question porte alors l'étiquette « Tour
de table », et une ligne grise s'affiche dessous :
« 3 participants ▾ + synthèse · ≈ 4 fois les jetons d'une question simple ». ↩ envoie.

Échap, la croix de la ligne, ou ⌫ en tête de la question ramènent à une question simple.

Un tour de table ne se lance pas depuis un travail délégué, ni dans l'espace Discussion. Un seul
tour à la fois par conversation : un second attend la synthèse du premier.

<a id="participants"></a>

## Choisir les participants

« 3 participants ▾ » ouvre un menu à cases : les modèles utilisés récemment d'abord, puis
**Autres modèles…** pour chercher dans la liste complète. Un agent qui ne laisse pas choisir son
modèle (IBM Bob) tient sur une ligne. De deux à cinq participants ; au-delà, les autres cases se
désactivent.

Chaque case est retenue aussitôt, pour ce tour et les suivants : il n'y a rien à enregistrer. La
première fois, la ligne dit « Choisir les participants », et ↩ ouvre le menu.

Au survol de « 3 participants », une infobulle dit chez qui part chaque question et ce qui part
avec : les fichiers joints, le dernier échange de la conversation.

<a id="avis"></a>

## Suivre les avis

Une carte « Tour de table » s'affiche sous la question. Chaque participant y a sa ligne : son
modèle et son agent, ce qu'il lit, depuis combien de temps. Les participants sont en lecture
seule : un bouclier le rappelle, plein quand c'est garanti, marqué quand ce n'est que demandé (un
agent qui écrit sans demander). Si un participant modifie quand même le dossier, sa ligne le dit.

Une fois rendu, l'avis montre sa réponse courte et sa confiance ; un clic le déplie en entier,
avec **Ouvrir sa conversation**. Un participant en erreur dit pourquoi et propose **Relancer** ;
un modèle refusé propose **Choisir un autre modèle**, pour les tours suivants.

**Synthétiser sans attendre** apparaît dès deux avis : les participants encore au travail
s'arrêtent. **Arrêter** arrête un participant, ou tout le tour.

<a id="synthese"></a>

## Lire la synthèse

Quand tous ont fini avec au moins deux avis, la conversation reçoit d'elle-même les avis, sans le
nom des modèles (« Participant A, B, C ») : elle juge les arguments, pas les marques. Sa réponse
porte l'étiquette « Synthèse du tour de table », et la carte se replie en une ligne (un clic la
rouvre). Au survol ou au focus de « Participant C », le vrai nom s'affiche.

**Demander à … de l'appliquer** envoie à la conversation un message ordinaire : c'est le seul
moment où des fichiers peuvent changer.

Après un redémarrage de Bobine, rien ne repart seul : la carte propose **Synthétiser avec N avis**
ou **Reprendre**.

<a id="replique"></a>

## Faire réagir les participants

**Faire réagir les participants** envoie la synthèse à chacun, dans sa propre conversation : il
maintient, nuance ou se rallie, en disant pourquoi. La conversation tranche ensuite par une
décision. Une seule réplique par tour.

<a id="cout"></a>

## Ce que coûte un tour de table

Nettement plus qu'une question simple : chaque participant, puis la synthèse. La ligne le dit
avant l'envoi, sans estimation en argent. Au pied de la carte, **Consommé** donne ce que les
agents ont communiqué, par unité, sans conversion. Le plafond par conversation, s'il est activé,
s'applique à chaque participant comme à toute conversation.
