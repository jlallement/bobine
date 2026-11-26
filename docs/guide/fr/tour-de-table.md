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
barre de la zone de saisie, puis écrivez la question. Quand la fenêtre est étroite, le bouton passe
dans le menu de 📎 (« Tour de table ») ; là où 📎 n'a pas de menu (sans capture d'écran), il reste
la commande `/roundtable`. La question porte alors l'étiquette « Tour
de table », et une ligne grise s'affiche dessous :
« 3 participants ▾ + synthèse · au moins 4 fois les jetons d'une question simple ». ↩ envoie.

Échap, la croix de la ligne, ou ⌫ en tête de la question ramènent à une question simple.

Un tour de table ne se lance pas depuis un travail délégué, ni dans l'espace Discussion. Un seul
tour à la fois par conversation : tant que le premier n'a pas rendu sa synthèse, le bouton est
grisé et `/roundtable` aussi, dans la liste des commandes, avec sa raison. Une question de plus de 8 000 caractères est refusée aussi : joignez le détail en
fichier.

<a id="participants"></a>

## Choisir les participants

« 3 participants ▾ » ouvre un menu à cases : les modèles utilisés récemment d'abord, puis
**Autres modèles…** pour chercher dans la liste complète. Un agent qui ne laisse pas choisir son
modèle (IBM Bob) tient sur une ligne. Un agent absent de cet ordinateur n'est pas proposé. De deux
à cinq participants ; au-delà, les autres cases se désactivent, et la ligne d'état en bas du menu
dit pourquoi.

Chaque case est retenue aussitôt, pour ce tour et les suivants : il n'y a rien à enregistrer. La
première fois, la ligne dit « Choisir les participants », et ↩ ouvre le menu.

Au survol de « 3 participants », une infobulle dit, pour chaque agent, où part la question, et ce
qui part avec : les fichiers joints, le dernier échange de la conversation.

<a id="avis"></a>

## Suivre les avis

Une carte « Tour de table » s'affiche sous la question. Chaque participant y a sa ligne : son
modèle et son agent, ce qu'il lit, depuis combien de temps. Les participants sont en lecture
seule ; le pied de la carte dit le niveau (garantie, ou seulement demandée et vérifiée sur les
fichiers suivis par git) ; une ligne dont le niveau diffère porte un bouclier.

Une fois rendu, l'avis montre sa réponse courte et sa confiance. Un clic sur une ligne la déplie :
l'avis entier, ou le détail d'une erreur ou d'un arrêt, et **Ouvrir sa conversation**. Un
participant en erreur dit pourquoi et propose **Relancer** ; un modèle refusé est dit sur sa ligne
(« modèle non appliqué ») et signalé dans le menu au tour suivant.

Si le dossier change pendant le tour, un seul avis le dit dans la carte, sous les lignes : « Le
dossier a changé pendant le tour de table : <fichiers>. Vérifiez avant d'appliquer. » La ligne d'un
participant porte « fichiers modifiés » seulement s'il a lui-même appelé un outil qui écrit ou une
commande pendant son tour ; sinon, personne n'est désigné.

**Synthétiser sans attendre** apparaît dès deux avis : les participants encore au travail
s'arrêtent. **Arrêter** arrête un participant, ou tout le tour.

Arrêter tout le tour attend que chaque participant ait fini de s'arrêter : la carte dit « arrêt en
cours », puis « arrêté ». Un participant dont la conversation a atteint son plafond est « retenu
par le plafond de sa conversation » : **Ouvrir sa conversation** pour choisir **Continuer**.

Pendant le tour, les conversations des participants sont dans la barre latérale, sous la vôtre ;
le tour fini, elles en sortent, et on les retrouve par la carte (**Ouvrir sa conversation**) ou la
recherche. Mise à la corbeille, la conversation d'un participant garde son avis lisible sur la
carte (« conversation à la corbeille ») ; restaurée, sa ligne redevient ce qu'elle était.

<a id="synthese"></a>

## Lire la synthèse

Quand tous ont fini avec au moins deux avis, la conversation reçoit d'elle-même les avis, sans le
nom des modèles (« Participant A, B, C ») : elle juge les arguments, pas les marques. Sa réponse
porte une seule ligne d'étiquette, « Synthèse du tour de table · <modèle> · N avis », et la carte
se replie en deux lignes : l'en-tête et **Consommé** (un clic la rouvre ; les lignes y sont alors
rangées par lettre). Au survol ou au focus de « Participant C » (ou « Participants B et C »), le vrai nom
s'affiche ; sur la carte, chaque ligne porte sa lettre, pour faire le lien quand la synthèse écrit
la lettre seule.

La synthèse et la décision se font en lecture seule. Ce qui est **garanti** : un agent qui demande
une autorisation avant d'écrire ou de lancer une commande (IBM Bob, par exemple) se la voit refuser
d'office pendant ces tours. Ce qui est seulement **demandé** : un agent qui agit sans demander
(OpenCode réglé par défaut) reçoit la consigne de ne rien écrire et de ne lancer aucune commande,
mais Bobine ne peut pas l'en empêcher. Elle le vérifie après coup : si le dossier a changé, un
avertissement s'affiche sous l'étiquette, avec les fichiers modifiés ; si l'agent a lancé une
commande, une ligne le dit. **Demander à … de l'appliquer** envoie à la conversation un message
ordinaire : c'est le moment prévu pour que des fichiers changent.

Le modèle de la conversation fait la synthèse : il ne peut pas être participant (il jugerait son
propre avis). Dans le menu, sa case est désactivée et dit pourquoi ; si vous changez le modèle de
la conversation pour celui d'un participant, la ligne le dit, et la synthèse ne part pas tant que
ce n'est pas réglé.

Après un redémarrage de Bobine, rien ne repart seul : la carte propose **Synthétiser avec N avis**
ou **Relancer le participant arrêté** (**Relancer les N participants arrêtés**).

<a id="replique"></a>

## Faire réagir les participants

**Faire réagir les participants** envoie la synthèse à chacun, dans sa propre conversation : il
maintient, nuance ou se rallie, en disant pourquoi. La conversation tranche ensuite par une
décision. Une seule réplique par tour.

<a id="cout"></a>

## Ce que coûte un tour de table

Nettement plus qu'une question simple : chaque participant, puis la synthèse. La ligne le dit
avant l'envoi, sans estimation en argent, et c'est un minimum : un participant qui explore le dépôt
avec ses outils coûte plus qu'une question, et la synthèse relit toute la conversation qui arbitre
(dans une longue conversation, des centaines de milliers de jetons). Au pied de la carte, **Consommé** donne en une ligne ce que
le tour a consommé : les jetons traités (entrée et sortie, comme dans Mon activité) et le coût de la
synthèse et de la décision, plus tout ce qu'ont consommé les conversations des participants (avis,
réplique, et ce que vous leur demandez ensuite), par unité, sans conversion. « Demander à … de
l'appliquer » et vos messages dans la conversation comptent avec elle, pas dans ce total. Le
détail, par modèle ou par conversation, est dans **Mon activité**.

Le plafond par conversation, s'il est activé, s'applique à chaque participant comme à toute
conversation. Un participant qui l'atteint s'arrête, et sa ligne le dit ; la carte « Plafond
atteint » est dans sa conversation (**Ouvrir sa conversation**). Si c'est la conversation qui
arbitre qui l'atteint, la demande de synthèse est retenue : la carte « Plafond atteint » s'affiche
dans le fil, et **Continuer** l'envoie.
