# Nouveautés

Ce qui change pour l'utilisateur, version par version. Affiché dans Réglages › À propos.

## 1.0.0-beta.1 — 10 novembre 2026

Première bêta publique de Bobine : attendez-vous à des aspérités, et signalez-les sur GitHub.
L'app n'est pas encore notarisée par Apple : macOS demande une étape de plus pour l'ouvrir (voir
le README).

### Nouveau

- IBM Bob : sur une carte de commande, « Pour tous les projets » (replié en bas de la carte) ajoute
  la commande — ou, pour une commande enchaînée, les parties choisies — aux commandes autorisées
  ou refusées partout, comme dans Bob IDE ; la carte en cours reçoit aussi votre réponse. Ces
  règles sont celles de Bob IDE et Bob Shell : un refus s'applique tout de suite, même dans une
  conversation ouverte ; une autorisation aussi si « Commandes de la liste » était déjà activé,
  sinon à partir de la conversation suivante, comme les groupes.
  La première autorisation active aussi « Commandes de la liste », et c'est dit ; un préfixe d'un
  seul mot est signalé, et se confirme dans les Réglages. Une commande refusée partout n'est pas
  non plus lancée par les outils de Bobine (terminal, serveurs, compilations).
- Réglages › Agents › IBM Bob › Approbations : les groupes approuvés pour toutes les
  conversations, l'accès hors du dossier, les commandes autorisées et refusées (ajouter, modifier,
  retirer). Un fichier de réglages de Bob illisible n'est jamais réécrit ; Bobine garde une copie
  (`settings.json.bobine.bak`) avant chaque changement.

### Amélioré

- Cartes d'autorisation : avec Bob, « Toujours dans cette conversation » dit la portée du choix
  (une commande et chacune de ses parties, toutes les modifications de fichiers) ; avec un autre
  agent, la carte ne promet rien de plus que « c'est l'agent qui décide ». Le dossier de la
  conversation, dans une commande, est montré par une pastille (chemin entier au survol). La liste de
  tâches montre ses tâches (faite, en cours, à faire) et leur compte ; un outil MCP montre ses
  arguments ; une carte à risque dit pourquoi « Toujours » n'est pas proposé.
- À propos de Bobine : une ligne discrète rappelle que Bobine est un projet indépendant, non
  affilié à IBM.
- Les textes de licence sont livrés avec l'app (dossier `licenses` des ressources) : ceux de
  Bobine, d'Electron et de Chromium, de la police du terminal, et les avis complets de chaque
  composant tiers embarqué.

### Corrections

- Quand l'agent retire lui-même sa demande d'autorisation (Bob le fait pour les autres demandes
  déjà autorisées par un « Toujours »), la carte disparaît sans bruit et la pastille d'attente de la
  liste des conversations aussi, au lieu de rester à attendre une réponse inutile.
- Réglages › Confidentialité › Autorisé sans demander : « Updating todo list » s'affiche « Mise à
  jour de la liste de tâches ».
- Dans les libellés de cartes, votre dossier personnel est abrégé en `~` (le bloc de la commande à
  autoriser reste entier).

## 0.11.2 — 9 novembre 2026

### Amélioré

- Cartes d'autorisation : une commande ou une modification qui écrit hors du dossier de la
  conversation, dans un fichier caché de votre dossier personnel (`~/.zshrc`…) ou dans un dossier
  du système, ou qui demande les droits d'administrateur (`sudo`), est signalée par un bandeau
  ambré, et « Toujours autoriser » n'y est plus proposé. C'est un avertissement, pas une garantie.
  Sur les autres cartes, une note rappelle que c'est l'agent qui décide ce que couvre « toujours ».
- Quand l'agent atteint son nombre maximal d'étapes, une carte le dit et propose « Continuer ». S'il
  refuse ensuite tout message sans rien faire (Bob compte sa limite sur toute la session), la carte
  propose « Rouvrir la session et continuer » ou « Nouvelle session avec le résumé », au lieu de
  vous laisser bloqué ; un message en attente n'est plus envoyé tout seul pour se faire refuser.
- Onglet Session, « Modifications » : deux lignes qui ne se confondent plus. « Conversation » dit
  ce que la conversation a modifié (« Aucune » pour une conversation neuve), « Dossier » ce qui
  n'est pas commité dans le dossier ; chacune ouvre sa vue de l'onglet Modifications.

### Corrections

- Modèle dont le fournisseur n'est pas connecté : la carte dit « Le modèle … n'a pas répondu »
  au lieu de « Connexion expirée », et propose « Choisir un autre modèle » (votre message repart
  aussitôt avec lui, une fois) ou « Se connecter ». Le modèle refusé est marqué « connexion à
  faire » dans la liste des modèles ; la conversation affiche « Modèle refusé ».
- Sous une carte de connexion, l'icône « Réessayer » du message n'est plus affichée : elle ouvrait
  une nouvelle branche qui échouait de la même façon. Son nom devient « Réessayer dans une nouvelle
  branche ».
- Quitter Bobine pendant le Diagnostic (essai d'un agent en cours) ou pendant la lecture du
  quota ne laisse plus d'agent ni de `bob chat` en marche après l'app.
- Connexion par SSO (accueil et carte « Connexion requise ») : si rien ne se passe après la
  connexion dans le navigateur, « Réessayer » relance la vérification au lieu d'attendre sans fin.
- Clé d'API : l'enregistrement n'est plus silencieux quand le trousseau macOS attend une
  autorisation. Bobine dit qu'il attend la fenêtre du trousseau ; sans réponse en 60 s, la clé
  n'est pas enregistrée, la valeur saisie est gardée et « Réessayer » est proposé.
- Le bouton Arrêter de la zone de saisie a maintenant un nom (« Arrêter la réponse ») pour les
  lecteurs d'écran et les outils d'accessibilité ; il n'avait que son icône.
- Plafond de Bobcoins : quand la lecture du quota avait échoué (Bob pas encore connecté au
  lancement), il n'apparaissait plus de la session, même après la connexion par SSO. Il est
  maintenant relu dès que Bob se montre prêt (conversation ouverte, essai de connexion réussi).
- Cartes « Connexion requise » et « Connexion expirée », accueil, Diagnostic : le bouton de
  connexion de Bob s'appelle « Se connecter par SSO » (et non plus « Log in with SSO » en
  anglais).

## 0.11.1 — 8 novembre 2026

### Amélioré

- Onglet Session, « En cours » : un terminal n’y apparaît plus dès qu’il est ouvert, seulement
  pendant qu’une commande y tourne (`npm run dev`, `sleep 30`…), sous le nom de la commande et
  avec sa durée depuis son lancement. Arrêter interrompt la commande sans fermer le terminal.
- Cartes d’autorisation plus lisibles : le fichier est nommé par rapport au dossier de la
  conversation (« notes.md », « src/…/notes.md », hors du dossier avec « ~ »), un chemin trop long
  est coupé par le début, jamais le nom du fichier, et le chemin entier s’affiche au survol. Un
  nouveau fichier est annoncé comme tel : « Création de notes.md », « Autoriser la création de ce
  fichier ? ». Pour une commande, le dossier n’est plus répété sous la commande ; celui de la
  conversation se lit « Dans projet » (« Dans projet/src » pour un sous-dossier), un dossier
  extérieur reste montré en entier avec son avertissement, et « Copier » reste en haut à droite.
  Sur la ligne de l’outil et dans Modifications aussi, le dossier est coupé avant le nom du
  fichier : son extension reste visible.

### Corrections

- Connexion de Bob expirée en pleine conversation : au lieu de l’erreur brute « Request Failed —
  Invalid or expired API key », la carte « Connexion expirée » s’affiche (se reconnecter par SSO
  ou utiliser une clé d’API), puis votre message est renvoyé une fois, dans la même conversation.
- Terminal : les icônes des invites (powerlevel10k, starship, oh-my-posh…) s’affichent au lieu de
  carrés vides, sans rien installer : Bobine apporte une Nerd Font (MesloLGS Nerd Font).
  Les lettres gardent la police choisie dans Réglages › Apparence.
- OpenCode : les fichiers qu’il crée comptent désormais dans Modifications › Conversation et
  dans le résumé des modifications en haut de la conversation (seules les
  modifications de fichiers existants y étaient), en direct comme à la réouverture.

## 0.11.0 — 7 novembre 2026

### Nouveau

- Mémoire commune à tous les agents : un agent peut proposer de retenir ce que vous lui apprenez
  (une préférence, une correction, le contexte d’un projet). Rien n’est gardé sans votre accord :
  chaque proposition arrive en carte « Retenir ce souvenir ? » dans la conversation, avec le texte
  entier, et la conversation continue en attendant. Les souvenirs retenus sont donnés aux agents au
  début de chaque conversation du projet, quel que soit l’agent. Une proposition faite juste après
  la lecture d’une page ou qui contient une commande à exécuter est signalée. Réglages › Mémoire :
  lire, modifier, déplacer, supprimer, exporter ; la mémoire se désactive sans rien effacer.

- **Aide de Bobine** (menu Aide, ⌘?) : le guide de l’utilisateur dans une fenêtre à part, posée à
  côté de la conversation, dans la langue de l’interface et sans réseau. Un sommaire, une recherche
  qui répond pendant la frappe et montre aussitôt la page du résultat choisi (↑↓, ↩, Échap), mots
  trouvés surlignés, et la page des
  raccourcis clavier tirée du vrai menu. De petits « ? » ouvrent l’aide à la bonne section :
  préparation d’un worktree, « Faire relire », tâches planifiées, aparté, et plusieurs sections
  des Réglages (dont Mémoire et la Corbeille). Le guide décrit aussi la mémoire commune, la
  corbeille, la sauvegarde, l’avis de version d’un agent et le bandeau « l’agent n’a rien
  envoyé ».
- **Astuces de Bobine** : au plus une par jour, au bon moment, sur le bord haut de la saisie (une
  question à côté pendant que l’agent travaille, un contexte presque plein, le même message un
  troisième jour, à planifier en un clic) ou au pied de la vue Git (un gros changement à faire
  relire avant de fusionner). × la ferme pour aujourd’hui, « Ne plus
  montrer » pour toujours ; une fonction déjà utilisée n’a plus d’astuce. Réglages › Général ›
  Astuces de Bobine les coupe toutes, et « Tout réafficher » rend celles qu’on a masquées.
- GitLab, y compris auto-hébergé : sur un dépôt GitLab, la vue Git propose « Ouvrir une MR » à la
  place de « Ouvrir une PR » (avec `glab`, la GitLab CLI, connecté à l’hôte) : la branche est
  poussée, la merge request ouverte vers la branche de base et son lien affiché (court : « demo/app!1 ») ; une MR déjà
  ouverte est retrouvée, et « Pousser vers la MR » apparaît après de nouveaux commits. Quand ça ne
  marche pas, le message dit quoi faire : `glab` absent ou pas connecté à l’hôte, hôte injoignable
  (VPN), certificat refusé, pas les droits, branche protégée. Le suivi du pipeline n’est pas encore
  là (GitHub seulement). Un dépôt ni GitHub ni GitLab garde
  le bouton de GitHub, comme avant, jusqu’à « Actualiser » : la vue Git dit alors pourquoi il n’y
  a pas de PR, et le bouton disparaît. Rien n’est envoyé à un hôte inconnu.
- Corbeille : une conversation supprimée y reste 30 jours (Réglages › Données), d’où elle se
  restaure, ou s’efface tout de suite. « Supprimer aussi chez l’agent » n’est plus coché d’office,
  et n’est proposé que si l’agent sait le faire.
- Sauvegarde complète : conversations, réglages, autorisations, tâches planifiées, consommation et
  mémoire (pas les clés d’API). « Restaurer une sauvegarde… » la remet en place après confirmation ; ce
  qu’il y avait avant est gardé à côté et se restaure de la même façon.

### Amélioré

- Vue Git d’un worktree : une seule issue à la fois sous les boutons (la dernière action ;
  « Actualiser » l’efface) ; le lien d’une PR ou d’une MR ouverte est court et cliquable
  (`owner/repo#12`, `groupe/projet!1`) ; « Ouvrir une PR » grisé se voit grisé, et sa raison est
  dite dessous ; sur un dépôt sans dépôt distant, plus de bouton « Ouvrir une PR ».
- Premier lancement : un accueil court vous mène à une première réponse — choisir un agent parmi
  ceux trouvés sur ce Mac (ou savoir comment en installer un), le connecter, choisir un dossier
  (ou en créer un d’essai), puis vérifier qu’il répond par un message très court, au coût affiché et gardé dans « Mon
  activité ».
  Chaque étape dit clairement ce qui ne va pas (agent absent, connexion expirée, réseau,
  plantage) ; l’accueil se passe à tout moment et ne revient jamais une fois fini.
- Quand votre agent (IBM Bob, OpenCode) a une version plus récente que celles essayées avec
  Bobine, un avis discret le dit une fois dans la conversation, avec un lien vers le Diagnostic ;
  une version plus ancienne donne un avertissement, une fois aussi. Rien ne bloque. Un agent qui
  parle une version du protocole ACP que Bobine ne connaît pas ne démarre pas, et l’app dit quoi
  mettre à jour.

### Corrections

- Sécurité : « Autoriser cette commande ? » montre désormais la commande entière, telle que
  l’agent la lancera, avec son dossier et « Copier », ses caractères invisibles rendus visibles ; une commande longue défile dans la carte, et
  la ligne de l’outil donne toute la commande au survol. Avant, avec IBM Bob, la carte restait vide
  et la fin de la commande était invisible.
- Message de commit proposé : il ne parle plus que des fichiers cochés et suit les cases cochées
  ou décochées tant que vous ne l’avez pas retouché ; le curseur est à la fin ; un titre de
  conversation trop long laisse place à un résumé des fichiers (« update app.js ») plutôt qu’à un
  sujet coupé.
- Libellés plus justes : un outil de Bobine appelé par OpenCode dit ce qu’il fait (« Propose de
  retenir : … », « Relit 2 souvenirs ») au lieu de « execute » ; les options d’autorisation d’un
  agent (« Allow once », « Reject »…) s’affichent dans la langue de Bobine ; l’agent porte partout
  le même nom, celui de Réglages › Agents (« IBM Bob », plus « Bob » ici et « IBM Bob » là) ; dans
  Réglages › Données, un dossier récent au chemin long garde son nom entier, le début du chemin est
  coupé au milieu.
- Lecture du budget d’IBM Bob : un seul dossier de travail par Mac, propre à Bobine (dans
  `~/Library/Caches/Bobine`), au lieu d’un par profil ; chaque profil temporaire ajoutait sinon un
  dossier de plus à ceux que Bob retient comme approuvés. Quand Bob n’est pas connecté, la lecture
  abandonne au bout de 20 s au lieu de 60, puis n’est plus retentée au lancement pendant 12 heures,
  et jamais avec des agents neufs (`--agents-neufs`).
- Un très gros diff de l’agent (un `package-lock.json` réécrit, des milliers de lignes) ne fige
  plus Bobine : la conversation s’ouvre aussitôt, et le diff n’est calculé qu’en dépliant sa carte.
  Au-delà d’un certain nombre de changements, il montre l’ancien texte puis le nouveau, en entier.
- Les longues conversations s’ouvrent bien plus vite : la fin s’affiche d’abord, les messages plus
  anciens apparaissent en remontant. La recherche dans la conversation, le sommaire et « Aller en
  bas » voient toujours toute la conversation.
- Une réponse qui écrit un long bloc de code ne saccade plus pendant qu’elle s’affiche.
- Très gros diff ou très longue sortie de commande dépliés : Bobine en montre le début du diff
  (l’ancienne version puis la nouvelle quand le fichier a trop changé) ou la fin de la sortie,
  avec « Afficher tout » et, pour une sortie, « Copier tout » ; au-delà de 50 000 lignes,
  « Ouvrir dans l’éditeur ». Les nombres de lignes s’écrivent « 20 000 ».
- Quand l’agent n’a rien envoyé depuis 5 minutes pendant une réponse, un bandeau le dit, sans
  rien couper : « Attendre » ou « Arrêter ». Un message, une action de l’agent ou des
  modifications qui ne peuvent pas s’afficher sont remplacés par une ligne qui le dit ; le reste de
  la conversation, le panneau et les réglages restent utilisables (« Réessayer » pour un panneau ou
  une page). Un problème interne de Bobine est signalé en haut de la fenêtre au lieu de passer
  inaperçu. Après un arrêt inattendu, Bobine le dit au lancement suivant et range un rapport sur le
  Mac, sans rien envoyer. Si l’interface s’arrête trois fois en une minute, Bobine propose de se
  relancer sur l’accueil au lieu de rester sur une fenêtre blanche.
- Quitter Bobine arrête tout ce qu’elle a lancé, même un agent qui ne répond plus, une compilation
  ou le flux vidéo d’un simulateur, et les commandes que l’agent a mises en arrière-plan avec lui (un
  processus que l’agent détache lui-même, comme un serveur, continue). Un agent qui plante n’abandonne plus derrière lui la commande qu’il avait lancée. Un agent dont la connexion se coupe est arrêté avec une
  explication claire. Si git n’est pas installé, Bobine le dit et donne la commande à copier. Les
  avis colorés de la conversation sont plus lisibles.


- Un profil ouvert par une version plus ancienne de Bobine ne perd plus les réglages qu’elle ne
  connaît pas. Un profil écrit par une version plus récente s’ouvre en lecture seule : les
  conversations se relisent, rien n’est enregistré ni envoyé, et Bobine propose de se mettre à
  jour.
- Liste des conversations illisible : elle est refaite à partir des conversations sur le disque,
  au lieu de repartir vide.
- Réglages ou autorisations illisibles : mis de côté et signalés, au lieu d’être remplacés en
  silence.
- Disque plein : Bobine le dit en clair, ne laisse plus de fichiers temporaires qui reprenaient la
  place libérée, et enregistre dès que de la place revient. En quittant, elle prévient au lieu de
  perdre les derniers messages (ou le dit au lancement suivant après un arrêt du Mac).

## 0.9.1 — 7 novembre 2026

### Corrections

- Fenêtre étroite, panneau ouvert : les onglets du panneau passent en icônes plutôt que d’être
  coupés au bord, l’onglet ouvert garde son ✕, et ceux qui ne tiennent plus vont dans le menu « + »
  (« + 3 »), sous « Onglets ouverts » ; dans la saisie, le choix de l’agent montre son nom
  entier ou son icône, plus jamais un chevron seul ou un nom tronqué.
- « Réinitialiser Bobine » marche dans l’app installée : avant, elle se fermait et une autre Bobine
  s’ouvrait sans rien mettre à la corbeille. Si les données ne peuvent pas aller à la corbeille,
  rien n’est supprimé et Bobine le dit au lancement suivant. Fermer une Bobine sur un profil
  temporaire n’ouvre plus une autre Bobine. Une Bobine ouverte sur un autre dossier de données
  (`--user-data-dir`) se rouvre sur ce dossier après la réinitialisation, plus sur le profil
  habituel.
- Un fil de conversation enregistré dans un format que Bobine ne reconnaît pas (par exemple écrit
  par une version plus récente) est mis de côté, comme un fichier abîmé, au lieu d’être remplacé
  par un fil vide.
- Suivi de la pull request : un commit fait par l’agent ou dans un terminal est vu dès la fin du tour, au retour dans la fenêtre ou sur « Actualiser » (« Pousser vers la PR » apparaît). Après `gh auth login`, la carte arrive aussitôt. Juste après un push, la carte suit la CI de près : « Contrôles en attente » tant que GitHub ne les a pas signalés, puis « en cours ». Cochée, « Fusionner quand tout est vert » dit ce qu’elle attend (contrôles, conflit, relecture, brouillon, règles de la branche sur GitHub). Sans CI détectée, la carte le dit et propose « Fusionner maintenant ». La note « envoyé à l’agent » s’efface quand les contrôles changent, et l’extrait de journal envoyé à l’agent n’a plus de codes de couleur. Après une PR fusionnée, « Nettoyer » supprime aussi la branche sur GitHub (pas si elle a reçu des commits depuis).
- Après « Nettoyer » un worktree, la conversation affichée et les suivantes partent du dépôt d’origine, plus du dossier supprimé. Plus généralement, une nouvelle conversation ne part jamais d’un dossier qui n’existe plus : elle repart du dépôt ou du dernier dossier connu, et le dit. « Nouveau worktree » depuis un dossier disparu le dit tout de suite.
- « Committer » marche aussi quand un fichier a été supprimé par `git rm` (la suppression était déjà indexée) : avant, git refusait le commit. Après « Fusionner maintenant » sur une PR sans CI, la note dit « sans CI détectée » au lieu de « tout était vert ».
- Onglets du panneau de droite : un onglet montre son nom entier ou son icône seule (nom en
  infobulle), jamais un bout de mot ; le ✕ de l’onglet actif n’est plus rogné.
- Modifications : « Conversation · Git » reste sur une ligne, c’est le nom de branche qui se
  raccourcit ; la vue « Git » choisie revient après une fenêtre rétrécie puis élargie.
- La page Tâches planifiées n’affiche plus le panneau de la dernière conversation ; sur ses
  cartes, fréquence, agent et dossier forment une seule ligne.
- Réglages › Apparence : les vignettes des thèmes passent à la ligne dans une fenêtre étroite ou
  agrandie au zoom, au lieu de sortir de la carte.
- Réglages : la section survolée ne se confond plus avec la section ouverte.
- Mon activité : sans échange sur la période, coût et jetons affichent « — » plutôt que « non
  communiqué ».
- Une infobulle ne reste plus affichée après le clic : celle de « Autres outils » recouvrait le
  champ d’adresse du navigateur.

- Réglages : les encarts sous un réglage (langue de macOS, commande `bobine`…) font désormais
  partie de leur ligne, sans filet collé au-dessus, sur un fond dans la teinte du thème ; les
  mises en garde gardent leur teinte d’avertissement, et l’avertissement de la fenêtre rapide
  s’affiche sous la fenêtre rapide (et non plus sous « Éditeur »).
- Connexion d’un agent expirée en pleine conversation (OpenCode : `opencode auth login`) : au lieu
  d’une erreur brute en anglais et d’un agent « Prêt », le fil dit que la connexion a expiré, l’agent
  passe à « Connexion expirée » et une carte donne la commande à lancer dans le terminal de Bobine.
  « Réessayer » renvoie ensuite le message refusé, une seule fois, dans la même conversation ; si
  l’agent avait déjà lancé des outils, la carte le dit.
- Menu des modèles : la recherche trouve aussi un modèle par son identifiant (`gpt-6.1-sol`), pas
  seulement par son nom.

### Amélioré

- Le panneau de droite glisse en s’ouvrant, les cartes qui attendent une réponse (autorisation,
  question, aparté, préparation du worktree) arrivent en douceur, les blocs du fil se déplient sans
  à-coup et le bouton d’envoi répond au clic. Rien ne bouge si macOS demande de réduire les
  animations.
- Sous la dernière réponse, une ligne de bilan : « Terminé en 42 s · 2 fichiers +6 −1 · ≈ 0,12 $US ».
- Le bouton « Aller en bas » dit combien de blocs sont arrivés pendant que vous relisiez plus haut.
- « Copier » : partout le même retour, une coche verte et « Copié ».
- Les infobulles des boutons qui ont un raccourci le montrent (« Afficher le panneau ⌘J »).
- Écrans vides soignés : Mon activité avant le premier échange, Tâches planifiées sans tâche,
  recherche des réglages sans résultat.
- Une nouvelle conversation s’ouvre avec sa barre de saisie en place, sans décalage.

## 0.9.0 — 6 novembre 2026

### Nouveau

- Après « Ouvrir une PR », la vue Git du worktree suit la pull request : contrôles de la CI (en
  cours, réussis, en échec, chacun avec son lien), commentaires, avis de relecture et conflit avec
  la base ; une ligne « Pull request » dans l’onglet « Session ». « Corriger les contrôles en
  échec » envoie à l’agent les contrôles en échec et un extrait de leur journal. Deux cases,
  décochées par défaut : « Corriger d’office » et « Fusionner quand tout est vert » (avec la méthode que le dépôt permet : commit de fusion, squash
  ou rebase). Une PR ouverte, « Ouvrir une PR » devient « Pousser vers la PR ». Il faut la
  commande `gh` connectée à GitHub ; sans elle, rien ne change.
- Tâches planifiées : une page « Tâches planifiées » (barre latérale, sous « Mon activité »)
  enregistre une consigne, un dossier, un agent et une fréquence (une fois, chaque jour, jours de
  semaine, toutes les N heures). À l’heure dite, Bobine ouvre une nouvelle conversation (au besoin
  dans un nouveau worktree) et envoie la consigne ; elle est marquée d’une petite horloge dans la
  barre latérale. Chaque tâche montre son coût par exécution (et par jour quand elle tourne
  plusieurs fois par jour) et peut avoir son plafond ; une exécution ne part jamais tant que la
  précédente tourne, et les échéances manquées (Mac en veille, Bobine fermée) ne sont pas rejouées :
  au plus un rattrapage. Les tâches ne tournent que Bobine ouverte, et une demande d’autorisation
  attend toujours votre réponse.
- « Faire relire… » dans l’onglet Modifications (et sur chaque fille de la vue « Filles ») : un
  autre agent — celui de la conversation par défaut, à confirmer ou changer, son coût affiché —
  relit le travail sans rien modifier, les erreurs d’abord puis ce qui se simplifie. Ses remarques
  arrivent sur les lignes du diff, avec leur gravité ; vous retirez celles qui ne servent pas et
  envoyez les autres à la conversation relue, comme vos propres remarques. Bobine vérifie que le
  dossier n’a pas changé pendant la relecture.
- Un nouveau worktree (conversation « dans un worktree » ou conversation fille) peut être prêt
  à l’emploi : les fichiers ignorés par git listés dans `.worktreeinclude` (`.env`, par exemple)
  sont copiés depuis le dossier d’origine, et la commande `setup` de `.bobine/worktree.json`
  (par exemple `pnpm install`) y est lancée, avec son état et sa sortie dans le fil ; sa commande
  `archive` est lancée avant la suppression du worktree. La carte montre les deux commandes
  (« à la création », « à la suppression ») et Bobine demande votre accord une fois par dépôt
  (« Autoriser et lancer »), de nouveau si une commande change, même entre l’affichage et votre
  clic. Un message envoyé pendant la préparation est signalé sur la carte et part à sa fin ;
  « Arrêter » et « Continuer sans attendre » pendant la commande, « Continuer sans préparer »
  avant l’accord. Une tâche planifiée n’attend pas l’accord : elle part sans la préparation, et
  son historique le dit. La liste des fichiers copiés se déplie. Accords révocables dans
  Réglages › Confidentialité.
- Une conversation peut voir plusieurs dossiers : dans l’onglet « Session », « Ajouter un
  dossier… » donne à l’agent un autre dossier en plus du dossier de travail (une bibliothèque, le
  serveur d’une app…), et la croix le retire. Proposé seulement avec un agent qui le prend en
  charge (OpenCode, pas IBM Bob pour l’instant) ; sa session repart aussitôt avec la nouvelle
  liste, sans perdre le fil, et le message suivant dit à l’agent quels dossiers il a en plus.
- Aparté : `/btw` suivi d’une question (ou ⇧⌘A, menu Conversation › Aparté…) pose une question à
  côté, même pendant que l’agent travaille ou avant le premier message. Le même agent y répond dans une session à part, en
  lecture seule, dans une carte au-dessus de la zone de saisie : rien n’est ajouté à la conversation
  ni à ce que l’agent en retient. Par défaut l’aparté ne reçoit rien de la conversation ; une case
  joint l’échange récent, avec son coût estimé en jetons. Son coût est compté dans celui de la
  conversation, et « Ajouter au fil » recopie la question et la réponse dans la zone de saisie,
  sans les envoyer.

### Amélioré

- Bobine parle aux agents avec la dernière version du protocole ACP (SDK 2.4), sans rien changer
  à ce que vous voyez avec IBM Bob et OpenCode.

## 0.8.0 — 6 novembre 2026

Disponible pour macOS (Apple Silicon). La préversion Linux sera publiée ultérieurement.

### Nouveau

- Un onglet « Session » en tête du panneau de droite résume la conversation d’un coup d’œil :
  agent, modèle, mode, dossier et branche (modèle et mode se changent d’un clic) ; la place
  occupée dans le contexte, par catégorie (messages, outils de Bobine, autres serveurs MCP,
  agent, libre), en estimation et sans aucun coût ; les modifications du dépôt ; ce qui tourne
  (terminaux, serveurs de dev, sous-agents en arrière-plan, conversations filles) avec sa durée et
  un bouton Arrêter. Le panneau s’ouvre de lui-même sur cet onglet quand la fenêtre le permet, et
  reste fermé dans une conversation où vous l’avez fermé.
- Les nombres de jetons s’écrivent en format court dès 1 000 (« 1,2k », « 122,9k », « 1,2M »),
  dans la puce de consommation, Mon activité et l’onglet « Session ».
- Compatible avec IBM Bob 2.0.9 : quand Bob demande d’accepter sa licence au premier message, le
  formulaire s’affiche dans la conversation ; s’il est refusé, Bobine explique quoi faire au lieu
  d’afficher l’erreur brute. Une nouvelle conversation réglée sur le mode Plan démarre directement
  dans ce mode avec Bob.
- Le coût d’une conversation compte toutes ses sessions : après une session perdue (IBM Bob efface
  ses tâches au bout de 30 jours) ou un passage à un autre agent, le compteur de la saisie et le
  plafond de coût n’oublient plus ce qui a été dépensé avant ; le détail montre « Cette session »
  et, dans une autre devise, ce qu’a coûté l’autre agent.
- Nouveau thème Fjord, dans Réglages › Apparence : des gris bleutés calmes, en clair (« Fjord ») et
  en sombre (« Fjord nuit »), avec les mêmes six couleurs d’accent.
- Une seule couleur pour agir : le bouton de l’action principale (Autoriser, Fusionner,
  Enregistrer…) prend la couleur d’accent partout, les actions secondaires gardent un contour, et
  Refuser ou Annuler ne sont plus que du texte. Pendant une réponse, le bouton Arrêter devient un
  carré discret au lieu d’un carré blanc en sombre ; Envoyer reste gris tant qu’il n’y a rien à
  envoyer. Les coins arrondis suivent une même échelle dans toute l’app.
- Les comptes rendus des conversations filles sont plus légers dans le fil de la mère : repliés sur
  deux lignes (titre et coût, puis la première phrase), ils se déplient pour montrer la réponse, la
  branche, les fichiers modifiés et le nombre d’échanges. « aucun fichier modifié » devient « rien
  modifié », et l’extrait ne s’efface plus quand il est court (plus de bandeau vide).

### Corrections

- Electron 45.2.3 (Chromium 156.0.8078.80) : correctifs de sécurité de Chromium.
- Zone de saisie dans une conversation étroite : l’invite et le texte tapé ne sont plus coupés à mi-hauteur quand ils passent sur une ligne de plus.
- Le fil ne défile plus de côté : un lien, un chemin ou un mot très long passe à la ligne, seuls le code, les diffs, les tableaux et les terminaux défilent dans leur cadre ; sur une longue conversation, le sommaire reste court (un trait pour plusieurs messages) et sa liste s’ouvre sur le message lu.
- Fenêtre réduite avec le panneau de droite ouvert : le panneau rétrécit pour laisser 500 px à la conversation, se replie s’il ne tient plus et revient quand la fenêtre s’élargit ; la conversation n’est plus écrasée.

## 0.7.0 — 30 octobre 2026

Disponible pour macOS (Apple Silicon). La préversion Linux sera publiée ultérieurement.

### Nouveau

- Dans une conversation mère, l’onglet Modifications a une vue « Filles » : les worktrees de ses
  conversations filles, avec leur état, leur branche, ce qu’elles ont modifié et l’avis de la mère ;
  un clic les ouvre dans le Finder, dans votre éditeur ou dans leur conversation.
- Le clic droit ouvre un menu réduit à l'essentiel : dans la saisie, les corrections d'orthographe
  puis Couper, Copier, Coller et Tout sélectionner ; sur un texte sélectionné, un lien ou une image,
  Copier.
- Un lien vers une adresse de votre Mac (`http://localhost:3000`…) s'ouvre dans le navigateur
  intégré du panneau (⌥-clic : dans celui du Mac) ; les autres liens web s'ouvrent dans le
  navigateur du Mac.
- Densité compacte (Réglages › Apparence) : moins d’espace entre les messages, dans les cartes
  d’outils et entre les lignes de la barre latérale.
- Mode présentation, pour une démo ou un partage d’écran (menu Affichage ou Réglages › Apparence) :
  texte de la conversation agrandi, dossier personnel abrégé en `~`, coûts et quota masqués,
  bannières et sons coupés. Une pastille le rappelle ; il n’est pas gardé au lancement suivant.
- Le dossier sous la zone de saisie a un vrai menu : « Afficher dans le Finder » (« dans le
  gestionnaire de fichiers » sous Linux), « Copier le chemin » et « Ouvrir un terminal ici », qui
  ouvre le terminal de Bobine dans ce dossier.
- La commande `bobine` : dans un terminal, `bobine .` ouvre une nouvelle conversation dans le
  dossier courant, et `bobine . "premier message"` écrit aussi ce message dans la zone de saisie
  (il n'est jamais envoyé tout seul). Réglages › Général › « Commande bobine » l'installe et la
  désinstalle.
- Un long texte collé (plus de 40 lignes ou de 4 000 caractères) devient une pièce jointe
  « Texte collé · N lignes » : un clic l’affiche, et « Remettre dans la saisie » le replace dans
  le message.
- Le brouillon garde ses pièces jointes quand vous changez de conversation, et après un
  redémarrage (fichiers, textes collés, et images tant qu’elles restent légères).
- Bobine respecte les fichiers d’exclusion de l’agent (pour IBM Bob : `.bobignore`, `.gitignore`
  et `.env`) : la mention `@` ne propose plus ces fichiers, `@git-changes` les saute en le disant,
  et en joindre un demande confirmation.
- Le fil de conversation montre la durée de chaque tour sous la réponse de l’agent (« 2 min 14 s »),
  et vos messages envoyés se copient comme les réponses.
- Un clic sur une image d’un message ou sur une capture d’outil l’affiche en grand (Échap ferme) ;
  elle se glisse directement vers le Finder.
- « Ouvrir dans VS Code » (ou Cursor, Zed, IntelliJ IDEA et les IDE de JetBrains) sur un fichier
  d’une carte d’outil, d’un diff ou d’un lien : le fichier s’ouvre à la bonne ligne. L’éditeur se
  choisit dans Réglages › Général, parmi ceux installés sur le Mac.
- En rouvrant une conversation laissée depuis plus d’un jour, une carte « Où en était-on ? »
  rappelle la dernière demande, les tâches faites et en cours, et les fichiers modifiés non
  commités. Bobine la construit seule : rien n’est envoyé à l’agent.
- Pendant que l'agent travaille : une commande qui ne rend plus rien depuis quelques minutes est
  signalée sur sa carte (« Aucune sortie depuis 3 min »), avec « Interrompre » ; le délai se règle
  dans Réglages › Conversations. Quand le contexte est presque plein, « Compacter » apparaît à
  côté de la puce orange de consommation. Et un plafond de coût pour les nouvelles conversations
  (Réglages › Conversations, désactivé par défaut ; modifiable dans le détail de la consommation de
  chaque conversation) arrête la réponse à la fin de l'outil en cours une fois dépassé, puis
  demande « Continuer » ou « Arrêter » ; au-delà, un nouveau message attend votre accord. En
  bobcoins pour Bob, en dollars sinon, en jetons pour un agent qui ne donne pas son coût.
- La conversation mère pilote ses filles comme un tech lead : elle peut suggérer l’agent de
  chaque fille, et son modèle quand l’agent le permet (OpenCode ; jamais avec Bob), avec sa
  raison : la suggestion attend votre confirmation sur la carte « Tâches proposées », où vous la
  gardez ou la changez. Elle lit un compte rendu court à chaque fin de tour, vérifie le travail
  elle-même, renvoie ses corrections à la fille, puis dit si la branche est prête à fusionner :
  « Recommandée » ou « Pas encore prête » sur la ligne de la fille. C’est toujours vous qui
  fusionnez : « Fusionner » ne prend d’abord que les filles recommandées, les autres après
  confirmation.

### Corrections

- Le DMG peut être construit sans télécharger d’outil auxiliaire supplémentaire : il utilise
  les outils de macOS. La fenêtre d’installation est simplifiée et garde le glisser-déposer
  vers Applications ainsi que l’installation proposée par Bobine.
- Cliquer une conversation de l'historique juste après « Nouvelle conversation » n'affiche plus
  d'erreur « Conversation inconnue ».
- Les onglets du panneau restent à leur place : un nouvel onglet s'ajoute à droite au lieu de
  s'intercaler et de décaler les autres.

## 0.6.0 — 27 octobre 2026

Disponible pour macOS (Apple Silicon). La préversion Linux sera publiée ultérieurement.

### Nouveau

- Les consignes données aux conversations filles sont consultables dans le fil de la mère :
  dépliez un lancement ou « Consigne pour… » pour lire le texte complet, y compris les demandes
  de correction. Elles restent repliées par défaut et sont conservées dans l’historique.
- La barre latérale garde les conversations à leur place : les filles restent sous leur mère,
  avec les mêmes liens arrondis, et les états se lisent par icônes avec infobulles. La section
  « À traiter » disparaît ; les notifications et le compteur du Dock restent disponibles. Une
  nouvelle fille apparaît dès la préparation de son worktree, même si son dossier était replié.
  La carte « Sous-tâches » aligne ses icônes et ses boutons ; les forks portent une icône au lieu
  du libellé « branche ».
  Le survol d’une conversation affiche une seule infobulle, également accessible au clavier.
- Réglages › Données › « Recommencer à neuf » : « Essayer Bobine comme neuve » ouvre une seconde
  Bobine sur un profil vide, effacé à sa fermeture (et, si vous le voulez, des agents comme sur un
  Mac neuf, qui redemandent leur connexion) ; « Réinitialiser Bobine » met tout ce qu'elle garde
  sur ce Mac dans un dossier daté de la corbeille, avec un LISEZ-MOI, puis la relance comme au
  premier lancement — ou la désinstalle. Vos projets et vos agents ne sont jamais touchés.
- Un bouton rouge survolé (Remettre à zéro, Supprimer…) reste rouge et lisible.
- Mon activité compare ce qui se compare : le graphique gagne « Temps » (le temps de travail par
  agent), et échanges et temps de travail passent en tête des chiffres. Une mesure qu'un agent ne
  communique pas le dit (« Jetons : OpenCode seulement. IBM Bob ne communique pas ses jetons. »),
  comme le chiffre « Jetons traités · OpenCode ». Filtrée sur un agent, la page ne montre plus que
  ses comptes (« IBM Bob sur ce Mac » seulement pour Bob).
- Annoter une page du navigateur ne la fige plus : en mode Annoter, la page défile et zoome comme
  d'habitude (molette, trackpad, pincement, ⌘+) et le clic pose la remarque, sans atteindre la
  page. L'élément visé est entouré au survol ; les épingles et leurs bulles restent accrochées à
  leur élément, et gardent leur taille quand la page est zoomée. On peut annoter plusieurs écrans :
  l'agent reçoit une capture par écran annoté, et le message dit quelle remarque est sur laquelle.
  « Envoyer à l’agent » regroupe les remarques en un message, avec les captures et les éléments
  visés. Échap quitte le mode Annoter ; les remarques restent jusqu’à l’envoi.
- Pendant que l'agent prépare un outil sans encore dire sur quoi (OpenCode écrit un patch pendant
  près de 40 s), la carte et l'indicateur disent « Prépare une modification… » (ou une commande, une
  lecture, une recherche) au lieu du mot brut « patch » ; le titre de l'agent reste en infobulle.
  Un tel outil interrompu ou en échec garde le nom de son genre : « Modification · interrompu ».
- Le temps de l'indicateur d'activité est celui de l'étape en cours (l'outil, le texte ou la
  réflexion du moment) et repart de zéro à chaque étape ; la durée du tour est dans son infobulle
  (« Tour commencé il y a 2 min 10 »).
- La consommation est désormais gardée : chaque échange avec un agent est noté sur ce Mac (agent,
  modèle, projet, jetons, coût avec son unité, durée), même si la conversation est supprimée ensuite
  ou continuée avec un autre agent.
- « Mon activité » (barre latérale, sous « Nouvelle conversation », ou ⇧⌘U) montre toute la
  consommation, toutes conversations confondues, à la place de la conversation : une grille
  d'activité sur les douze derniers mois (ou une année passée), comme celle de GitHub, puis la
  semaine, le mois ou l'année, ou le jour cliqué dans la grille ; l'agent ; les échanges, jetons
  traités, temps de travail et coût dans chaque unité (dollars et Bobcoins ne s'additionnent
  jamais), avec l'écart à la période d'avant ; un graphique par heure, par jour ou par mois, par
  agent ou par modèle ; les tableaux par modèle, par projet et des conversations qui ont le plus
  consommé (un clic l'ouvre). « Toute mon activité… », dans le détail de la consommation d'une
  conversation, y mène. Les échanges d'avant sont repris une fois depuis l'historique.
  « Exporter… » enregistre un CSV (une ligne par échange ou par jour, ou tout l'historique). Le
  quota du mois et la dépense d'IBM Bob sur ce Mac y sont désormais. La page reste lisible en
  fenêtre étroite, panneau ouvert compris.
- « Remettre à zéro… » la consommation enregistrée est dans Réglages › Données.
- « Rechercher » devient une loupe en haut de la barre latérale (⌘K ne change pas).
- Dans les graphiques, IBM Bob est en bleu et OpenCode en vert d'eau ; l'unité de Bob s'écrit
  « Bobcoins ».
- Réglages › Diagnostic prévient quand un agent annonce une version que Bobine n'a pas vérifiée
  (par exemple IBM Bob 2.0.7, vérifié avec 2.0.6) : ses fonctions propres peuvent ne pas marcher.
  La page de chaque agent dans Réglages › Agents liste les versions vérifiées.
- Réglages › Agents › « Ajouter un agent ACP… » : n'importe quel agent qui parle ACP se déclare
  sans toucher au code (nom, commande avec ses arguments, variables d'environnement, et au besoin la
  variable de sa clé d'API, saisie ensuite sur sa page et chiffrée dans le trousseau). Il a sa page
  comme les autres, avec « Modifier… » et « Supprimer cet agent ».
- Un agent qui ne sait pas reprendre une conversation (ou qui a perdu sa session) ne la fige plus
  en lecture seule après un redémarrage ou une panne : la conversation continue dans une nouvelle
  session, marquée « Nouvelle session avec … » dans le fil, et l'échange d'avant lui est transmis
  avec votre prochain message.
- La barre latérale est organisée en Épinglées, Récents (ou Dossiers) et Archivées, toujours
  en dernier et repliée par défaut. Chaque section et chaque dossier se replient d’un clic, et
  Bobine s’en souvient. Les boutons de création et de recherche restent accessibles en haut.
  En mode Dossiers, le dossier est le projet : les filles lancées dans un worktree restent sous
  leur mère. Un fork (« Repartir de ce message ») cite sa conversation d’origine dans son en-tête
  et son infobulle ; il est rangé comme une conversation indépendante. Le survol se distingue
  de la conversation ouverte.
- Le navigateur intégré se comporte comme dans Claude Code : la page défile à la molette, au
  trackpad et au clavier, et se remet en page quand on élargit la colonne ou agrandit le panneau.
  ⌘+, ⌘− et ⌘0 zooment la page quand elle a le focus (une puce « 110 % » dans l'adresse la remet
  à 100 % d'un clic), sans décaler la vue même quand l'interface est zoomée ; ⌘L, ⌘R, ⌘[ et ⌘]
  marchent dans la page. Une taille d'écran imposée par l'agent (mobile…) est réduite pour tenir
  entière dans le panneau, se signale dans l'adresse (un clic l'annule) et s'annule à la fin de
  son tour.
- Un nouvel outil du panneau, « Échanges ACP » (menu « + »), montre en direct les messages
  échangés entre Bobine et l'agent, dans les deux sens : heure à la milliseconde, méthode, détail,
  durée d'une réponse et taille. Un clic déplie le JSON brut ; les morceaux de texte d'un même
  message sont regroupés ; filtre, pause et copie en NDJSON. Les clés et jetons sont masqués, les
  2 000 derniers messages de la conversation restent en mémoire seulement, quel que soit le niveau
  du journal.
- Réglages › Diagnostic s'ouvre sur une carte « Journal » : `main.log` et `agents.log` avec leur
  taille et ce qu'ils contiennent, « Ouvrir » et « Afficher dans le Finder », puis le niveau du
  journal. Le chemin du dossier des journaux n'est plus écrit dans la section « Bobine ».
- Les réglages sont rangés en trois groupes de quatre onglets : Général, Apparence, Notifications,
  Raccourcis ; Conversations, Agents, Serveurs MCP, Commandes ; Confidentialité, Données,
  Diagnostic, Nouveautés. Chaque page présente ses réglages en cartes, sous un titre ; ce qui sert
  rarement est replié dans « Avancé ». La recherche retrouve toujours chaque réglage et le déplie.
  Nouveautés présente Bobine (icône, version), puis une ligne par version, la plus récente ouverte.
- Nouvelle page Apparence, avec un aperçu qui change pendant qu'on règle : le thème en un clic
  parmi cinq (Système, qui suit le Mac en Clair et Sombre, Clair, Sépia, Sombre, Nuit noire), six
  couleurs d'accent, police des réponses parmi
  celles installées sur le Mac, police et taille du code, police et taille du terminal, chacune
  prise parmi les polices à chasse fixe installées.
- Chaque agent a sa page dans Réglages › Agents : état, version, commande, « Relancer », ses clés
  d'API, ses fournisseurs de modèles, ce qu'il annonce et ce qui lui est propre. Le réseau
  d'entreprise passe dans « Avancé », avec un résumé de ce qui est défini.
- Quand la connexion tombe pendant une réponse (réseau coupé, proxy, limite de débit atteinte),
  Bobine réessaie tout seul : un bandeau dans le fil dit « Connexion perdue » et « Nouvelle
  tentative dans 8 s (3 sur 5) », votre message reste en attente et repart sans avoir à le
  renvoyer. Cinq tentatives, de plus en plus espacées (2 s à 32 s), et tout de suite si le réseau
  revient ou si le Mac sort de veille ; « Réessayer maintenant » n'attend pas, Échap ou Stop
  arrête. Après la cinquième, « Connexion impossible » et « Réessayer ». Un message écrit pendant
  l'attente part juste après.
- Electron 45 (Chromium 156, Node 24.22) : correctifs de sécurité de Chromium. Les clés d'API
  passent par l'accès au trousseau macOS non bloquant d'Electron ; celles déjà enregistrées restent
  lisibles.

### Corrections

- La progression des fusions reste visible pendant qu’une conversation fille résout un conflit.
- Quand la connexion de l'agent tombe en plein tour, l'outil qu'il venait d'annoncer ne reste plus
  « en cours » à côté de l'avis d'erreur : il est interrompu, et le reste à la réouverture. Un tour
  coupé par l'arrêt de l'agent compte désormais dans la consommation de la conversation.
- Un agent qui ne s'arrête pas quand on le lui demande est arrêté de force au bout de 3 s, et ceux
  laissés en marche par un plantage de Bobine sont arrêtés au lancement suivant (le journal dit
  lesquels). Le commit, la fusion et l'état git d'une conversation ne se gênent plus entre eux
  (« index.lock ») ; un verrou laissé par un autre programme est réessayé une fois, puis l'erreur
  de git est montrée en entier.
- Les couleurs suivent tout le thème : les blocs de code, la sortie des commandes et le terminal
  prennent les couleurs de Clair, Sombre, Sépia ou Nuit noire (fini le code toujours sombre), le
  terminal change de couleurs avec le thème et l'accent sans rouvrir l'onglet, et la fenêtre s'ouvre
  directement sur le fond du thème choisi. Sépia et Nuit noire ont leurs propres accents.
- Textes plus lisibles : les textes discrets, l'accent en lien, le texte posé sur l'accent et les
  couleurs du terminal (le jaune sur fond clair) atteignent tous le contraste recommandé (AA).
- La sortie d'une commande qui est du JSON s'affiche indentée, avec de vrais retours à la ligne dans
  les chaînes.
- Le message de commit proposé reprend le titre de la conversation coupé à un mot entier, sans finir
  sur « à une », avec « … ».
- Réglages › Conversation : les polices des réponses s'appellent « Sans serif » et « Serif » ;
  chercher « empattements » les trouve toujours.
- Réglages : plus de doublons. « Relire le PATH » n'est plus que dans Diagnostic (un lien y mène
  depuis Agents quand un agent manque), et À propos ne répète plus la version, Electron et le
  système, déjà dans la fenêtre « À propos » et dans Diagnostic. Les aides tiennent en une phrase,
  les textes des notifications et du compteur du Dock ne se contredisent plus, et « Comme
  maintenant » n'est plus coupé dans la liste de la nouvelle conversation.

### Limites connues

- Le renvoi spontané d’une remarque à une conversation fille dépend de l’agent et n’est pas
  garanti ; les consignes effectivement envoyées sont consultables dans le fil de la mère.

## 0.5.0 — 23 octobre 2026

### Nouveau

- Les conversations filles finies se fusionnent toutes d'un geste depuis la carte « Sous-tâches » de
  la mère : une phrase dit lesquelles sont prêtes, lesquelles travaillent encore, lesquelles touchent
  les mêmes fichiers et lesquelles ont des modifications non commitées ; « Fusionner les N dans
  main » les fusionne l'une après l'autre, dans l'ordre de lancement, avec l'état de chaque ligne en
  direct et « Arrêter ». Au premier conflit, la fille concernée le résout, puis la fusion reprend.
  « Puis nettoyer » archive ensuite les filles fusionnées et supprime leurs worktrees et branches.
- Quand le dossier principal a des modifications non commitées, la fusion (depuis la carte
  « Sous-tâches » ou la vue Git d'un worktree) ne part pas et dit pourquoi, fichiers à l'appui, avec
  « Committer d'abord » (message proposé, puis la fusion part) et « Mettre de côté » (les
  modifications sont rangées le temps de la fusion, puis remises, et le fil le dit). Les erreurs de
  git sont montrées en entier, plus seulement « Aborting ».
- « Committer » existe aussi dans la vue Git d'une conversation ordinaire, hors worktree : fichiers
  cochés, message proposé modifiable, « Défaire » tant que c'est le dernier commit et qu'il n'est
  pas poussé.
- Les sous-agents de l'agent ont leur propre carte « Sous-agents » dans le fil, distincte des outils :
  ceux lancés ensemble partagent la carte, une ligne chacun (état, type, consigne, durée et coût en
  direct), avec le nombre en cours et fini et leur coût total ; « Réponse » déplie la consigne, la
  réponse et son travail.
- Chaque conversation fille montre ce qu'elle coûte : une pastille sur sa ligne de « Sous-tâches »
  (bobcoins, dollars, ou ses jetons), le total des filles dans l'en-tête de la carte, et sur son
  compte rendu le coût et le nombre d'échanges à ce moment-là.
- Le départ d'une conversation en worktree tient en une carte en tête du fil : branche et commit de
  départ, date, sujet du commit, et un avertissement s'il reste des modifications non commitées dans
  le dossier d'origine ; « Vue Git » ouvre l'onglet Modifications. L'en-tête d'une conversation
  fille dit de quelle conversation elle vient (« ↳ depuis « … » »), et y ramène d'un clic.
- Le haut du fil ne passe plus sous le fondu de l'en-tête : le premier message reste lisible quand
  le fil défile.
- Bobine › « À propos de Bobine » ouvre une fenêtre sobre : la version et sa date, « Nouveautés »
  (Réglages › À propos), « Signaler un problème » (issue GitHub préremplie), les liens vers GitHub
  et la licence, et « Copier les infos techniques » (version, commit, Electron, macOS, agents
  installés) à coller dans un signalement.
- L'agent propose de lui-même des conversations filles quand votre message contient plusieurs
  chantiers indépendants : il sait, dès le début de la session, qu'il peut les confier à des
  filles, chacune dans son worktree, et que rien ne démarre sans votre accord sur la carte
  « Tâches proposées ». Réglages › Conversation › « Proposer des conversations filles » : Jamais,
  Quand ça s'y prête (par défaut) ou Toujours demander. La commande `/split` demande
  explicitement ce découpage pour le message qui la suit.
- Une section « À traiter » en tête de la barre latérale réunit les conversations qui vous
  attendent : autorisation ou question (en premier), erreur, réponse ou compte rendu de
  conversation fille à lire, avec la raison et depuis quand. Le même nombre s'affiche sur l'icône
  du Dock (Réglages › Général › « Compteur sur l'icône du Dock »). Plusieurs conversations qui
  finissent ou attendent en même temps (des filles lancées ensemble) ne font plus qu'une
  notification, un son et un rebond.
- La barre latérale suit une seule grille : chaque titre commence au même endroit, qu'il ait une
  icône ou non. Dans « À traiter », le titre en gras dit ce qui n'est pas lu, l'icône dit pourquoi
  (en couleur quand l'agent est bloqué, en gris quand c'est à lire, en rouge pour une erreur), le
  temps écoulé est à droite du titre et le compte s'écrit « À traiter · 2 ». Une branche porte un
  repère « branche » visible même quand son titre est coupé, et son titre complet en infobulle.

### Corrections

- Les titres d'outils de l'agent ne montrent plus de chemins absolus ni de « cd /chemin/du/projet
  && … » : « Autorisation : Modification de src/books.js » plutôt que « Applying diff to
  /Users/… », et « Mise à jour de la liste de tâches (8) » (la liste en infobulle) plutôt que
  « Updating todo list », dans les cartes, « À traiter » et les notifications.
- Le texte que Bobine joint à votre message (contexte de l'app, demande de `/split`, échange repris
  d'une branche ou d'un autre agent) part après lui : il ne devient plus le titre de la tâche chez
  IBM Bob, n'apparaît plus dans la carte « Nouvelle branche de … », et ne remplace plus le titre
  d'une conversation après « Continuer avec… » ou une branche.

### Corrections

- Après une panne de l'agent, le message qui le relance ne mélange plus l'historique rejoué par
  l'agent avec sa nouvelle réponse : le fil reste celui d'avant la panne (bulles, cartes de plan,
  compteurs de modifications), suivi du nouvel échange, comme après avoir quitté puis rouvert
  Bobine. Le message part une fois cet historique reçu, au plus 2 secondes après.
- Un outil refusé n'a plus de coche verte : « refusé » est un état à part entière d'une carte du
  fil (et d'un groupe d'outils, ou d'un sous-agent), que le refus vienne d'une autorisation de
  l'agent ou d'une commande de Bobine (terminal, serveur, compilation). Un outil de Bobine en
  erreur est « échec », même quand l'agent le dit fini.
- Android : la compilation d'un projet Flutter qui réussit n'est plus dite « Build failed » ; l'APK
  est cherché aussi là où Flutter l'écrit (`build/app/outputs/flutter-apk`), et s'il n'est nulle
  part, la compilation reste réussie et l'agent sait où il a été cherché. L'erreur d'une
  installation (`adb install`) arrive entière, avec sa raison, et la carte « Lance … » nomme
  l'APK même quand son chemin est long.
- Avec OpenCode, un outil de Bobine appelé par du code (`execute`) qui échoue met la carte en
  échec, au lieu d'une coche verte.
- Un sous-agent qu'OpenCode lance en arrière-plan n'est plus dit « fini, < 1 s » : sa ligne de la
  carte « Sous-agents » reste en cours, même après la fin de la réponse, jusqu'à ce qu'il ait
  vraiment fini ; elle montre alors sa durée et sa réponse finale. « Voir son travail » montre
  l'état du moment tant qu'il travaille.
- Capture d'écran sans l'autorisation « Enregistrement de l'écran » de macOS : au lieu de laisser
  choisir une zone pour ne rien joindre, la fenêtre rapide et la zone de saisie disent que la
  capture est indisponible et pourquoi, avec un bouton « Ouvrir les Réglages Système ». Une capture
  que macOS refuse après la sélection le dit aussi ; Échap reste silencieux.
- Carte du plan : « Envoyer mes remarques » et « Exécuter le plan » restent à droite, à la même
  place, quand le texte d'aide change (« 1 remarque ») : « Exécuter le plan » ne vient plus sous le
  pointeur après « Ajouter la remarque ».
- Carte « Tâches proposées » : quand l'agent ajoute des propositions pendant son tour, elles
  arrivent en dessous et le fil ne défile plus tant que le pointeur est sur la carte : la ligne
  qu'on s'apprête à lancer ne bouge plus sous le pointeur.

### Corrections

- `/context` et `/cost` donnent chacun un encadré titré (« Contexte de la conversation », « Coût de
  la conversation ») ; quand l'agent ne transmet pas le remplissage de son contexte (IBM Bob),
  `/context` le dit. `/compress` d'IBM Bob est dans la liste « / », et sa réponse s'affiche en carte
  « Conversation résumée », avec le résumé mis en forme.
- Un outil arrêté par Échap ou ■ est marqué « interrompu », plus « échec ».
- Les commandes que l'agent lance dans le terminal tournent sans pager : `git log` ne reste plus
  bloqué sur « (END) ». Elles s'ouvrent dans un onglet de l'agent ; vos onglets gardent votre pager.
- La mention `@` propose d'abord les fichiers dont le nom ou un dossier commence par ce que vous
  tapez : `@books` ne propose plus les fichiers d'Xcode qui contiennent ces lettres dans le désordre.
- Une infobulle se ferme quand l'élément survolé défile ou disparaît (changement d'onglet, fil qui
  défile à la molette).
- Supprimer un fournisseur, un serveur MCP, une commande ou une clé d'API, révoquer une autorisation
  ou nettoyer un worktree orphelin se confirme dans la ligne, sous l'élément cliqué
  (« Supprimer · Garder ») : plus de second clic sur une corbeille qui ne changeait pas d'aspect.
- Retirer le dernier serveur MCP (ou fournisseur) d'un fichier ne laisse plus un `opencode.json`
  vide : le fichier est supprimé s'il ne contient rien d'autre.
- Le message de commit proposé ne coupe plus un mot : le titre d'une conversation s'arrête à un mot
  entier.
- Textes : « d'OpenCode », « d'IBM Bob » ; espaces insécables avant « : » et dans les guillemets
  (plus de « » » en début de ligne) ; un seul « Plein écran » dans le menu Affichage, qui devient
  « Quitter le plein écran » en plein écran ; « Remettre 1 fichier dans son état d'alors ».
- Réglages › Serveurs MCP › Bobine : les interrupteurs des familles d'outils se prennent au clavier
  et par l'accessibilité ; « Questions » affiche « Toujours fournie » au lieu d'un
  interrupteur grisé. La recherche des réglages trouve aussi ce que Bobine sait faire avec chaque
  agent (« quota » mène à IBM Bob).
- Un sous-agent qu'OpenCode lance en arrière-plan finit dans sa carte (durée, réponse finale) même
  si vous avez envoyé d'autres messages entre-temps ; avant, il restait « en cours » pour toujours.
- Envoyer un message quand le fil est remonté ramène en bas : la bulle envoyée et la réponse se
  voient, on ne croit plus le message perdu. La flèche ↓ sert toujours à redescendre en lisant.
- Carte du plan : quand le formulaire de remarque se replie, la barre « Envoyer mes remarques ·
  Exécuter le plan » ne remonte plus sous le pointeur ; la place est gardée jusqu'à ce que le
  pointeur quitte la carte.

### Limites connues

- Dans le fil, un lien `http://localhost…` écrit par l'agent ne s'ouvre pas encore dans le
  navigateur intégré ; `prompt()` d'une page n'y est pas pris en charge ; « Ouvrir une PR » reste
  sans effet quand le dépôt n'a pas de distant.
- Le compte rendu d'une conversation fille menée par Bob n'indique pas son coût ; la pastille de la
  carte « Sous-tâches » le donne.
- Après un changement de langue, la ligne de réponse d'une question déjà posée garde l'ancienne
  langue.
- Proxy d'entreprise : seules les variables `HTTPS_PROXY`, `HTTP_PROXY` et `NO_PROXY` en
  majuscules sont reprises du shell de connexion.

## 0.4.0 — 22 octobre 2026

### Nouveau

- Une conversation en worktree revient dans `main` sans terminal. À sa création, le fil dit de
  quelle branche et de quel commit elle part, et prévient si le dossier d'origine a des
  modifications non commitées (elles ne sont pas dans le worktree). Dans l'onglet Modifications,
  vue « Git » : « Committer » les fichiers cochés avec un message proposé (modifiable, défaisable
  tant qu'il est le dernier), « Ouvrir une PR » si `gh` est installé et connecté (sinon la raison
  est dite), « Fusionner dans main » qui liste les conflits fichier par fichier avec « Laisser
  l'agent résoudre », puis « Nettoyer » (conversation archivée, worktree et branche supprimés).
  Réglages › Agents et dossiers liste les worktrees orphelins avec « Nettoyer ».
- Le coût de la conversation (bobcoins, dollars ou jetons selon l'agent) se lit en un seul endroit :
  la puce de consommation sous la zone de saisie, dont le détail donne le total, la moyenne par
  échange et une ligne par échange.
- La barre latérale se règle en largeur à la souris (de 220 à 440 px, 300 par défaut) ; un
  double-clic sur sa poignée la ramène à sa largeur par défaut. Sur une fenêtre étroite, elle cède
  la place dont la conversation a besoin et la reprend ensuite.
- Réglages › Serveurs MCP › Bobine : le poids estimé de chaque famille d'outils dans le contexte de
  l'agent, et un interrupteur pour ne plus la proposer. Le menu ⚙ de la conversation dit quand le
  changement s'applique et propose de redémarrer l'agent.
- Continuer une conversation avec l'autre agent : dans le menu de l'agent, « Continuer avec »
  propose OpenCode (et ses derniers modèles utilisés ou ceux de vos fournisseurs) depuis Bob, ou
  l'inverse. Avant de confirmer, Bobine dit où partiront vos messages (agent, modèle, fournisseur et
  adresse). La conversation reste la même : le fil est gardé, un trait « Suite avec … » marque la
  bascule, et l'échange précédent part en texte avec votre prochain message, pas avant.
- Quand l'agent propose des conversations filles, elles arrivent sur une seule carte « Tâches
  proposées » : pour chacune, Lancer, Faire ici (l'agent s'en charge dans la conversation) ou
  Refuser, avec l'agent et le modèle au choix. La carte garde ce que vous avez décidé.
- Une conversation mise en veille ou rouverte après un redémarrage garde tout son fil : cartes des
  outils de Bobine, comptes rendus des conversations filles, remarques, « Réponse interrompue ».
  Si la session a continué ailleurs entre-temps (`bob chat`, Bob IDE, `opencode`), les échanges
  manquants sont ajoutés à la fin, avec un avis.
- Réglages › Diagnostic : « Signaler un problème » ouvre dans le navigateur une issue GitHub
  préremplie avec la version et le rapport de diagnostic (coupé s'il est trop long pour l'adresse :
  le reste se colle depuis « Copier le rapport »). Rien ne part avant que vous ne validiez sur
  GitHub.
- Bobine est publiée sous licence Apache 2.0 ; le dépôt a un README en anglais et en français, un
  guide de contribution et une politique de sécurité.
- Les cartes d'outils de l'agent disent ce qu'il a fait et sur quoi, même repliées dans un groupe :
  « Lecture de src/books.js », « Modification de README.md », « Recherche « TODO » », « Page
  example.com/doc », au lieu du nom brut de l'outil (« read », vingt fois). Les chemins sont
  relatifs au dossier de la conversation, raccourcis au milieu s'ils sont longs ; le chemin entier
  et le titre de l'agent restent au survol. Une commande garde son texte.
- Réglages › Agents et dossiers › Fournisseurs de modèles : les points d'accès compatibles OpenAI
  d'OpenCode (modèles internes de l'entreprise) se déclarent dans l'app, sans éditer
  `opencode.json` à la main : nom, adresse, modèles, « Seulement ces fournisseurs ». La clé est
  chiffrée dans le trousseau macOS, jamais écrite dans le fichier. « Tester » dit si le point
  d'accès répond, combien de modèles il liste, ou pourquoi pas (connexion refusée, proxy,
  certificat non reconnu, clé refusée) et quoi faire ; Réglages › Diagnostic a une ligne par
  fournisseur.
- Réglages › Agents et dossiers › Réseau d'entreprise : proxy, hôtes sans proxy et fichier des
  certificats de l'entreprise, repris du shell de connexion ou saisis ici, transmis à tous les
  agents à leur lancement.
- Quand une réponse est finie ou qu'un agent attend, fenêtre en arrière-plan, l'icône de Bobine
  rebondit dans le Dock, même quand macOS bloque les notifications (Réglages › Général › Faire
  rebondir l'icône du Dock).
- Réglages › Conversation : choisissez combien de conversations restent actives (6 par défaut, de 2
  à 12). Au-delà, les plus anciennes sont mises en veille et rechargées quand vous y revenez ;
  chacune garde son agent en mémoire, environ 300 Mo.
- Réglages › Serveurs MCP s'ouvre sur un onglet « Bobine » : les outils que Bobine donne à tous les
  agents (questions, navigateur intégré, lancer l'app, terminal, simulateur iOS, émulateur Android,
  conversations filles), une carte par famille avec son nombre d'outils, quand elle est proposée et
  quand elle demande votre accord ; dépliée, elle liste les outils, leur description au survol. Le
  menu ⚙ de la conversation commence par « bobine · intégré » et le nombre d'outils qu'elle reçoit
  vraiment, qui mène à cet onglet.
- En mode Plan, la zone de saisie prend la couleur du mode (bordure, halo, fond teinté), la puce du
  mode devient une pastille « Plan » et une ligne rappelle que l'agent lit et propose sans rien
  modifier, et comment en sortir.
- « Lancer en parallèle… », dans le menu d'une conversation, ouvre une conversation fille. Elle
  travaille dans son propre worktree, et apparaît sous sa mère avec son état. À chaque fin de tour,
  la mère reçoit son compte rendu (carte « Sous-tâches »), qui part à son agent avec votre prochain
  message.
- L'agent peut lancer lui-même des conversations filles pour des tâches longues et indépendantes :
  chacune demande votre accord sur une carte (Lancer / Refuser). Il les suit, leur écrit, et elles
  peuvent lui écrire ; ces messages passent par la file d'attente, avec leur provenance (« De la
  conversation mère »). Quand toutes ont fini, il est réveillé une seule fois avec leurs comptes
  rendus. Le nombre de filles en cours se règle dans Réglages › Conversation (5 par défaut) ;
  au-delà, « Lancer en parallèle… » est grisé.
- Au premier lancement, Bobine demande d'abord le dossier du projet : aucun agent ne démarre avant
  ce choix, et le dossier « workspace » de l'app n'apparaît plus dans les dossiers récents.
- Le dossier et la branche passent sous la zone de saisie. Quand la place manque, la barre se
  replie étape par étape (capture dans le menu 📎, anneau seul pour la consommation, icône seule
  pour le mode) au lieu de tronquer toutes les puces ; le mode plan a sa propre icône.
- Le menu des modèles s'ouvre sur le modèle choisi, tient dans la fenêtre et propose une recherche
  au-delà de 10 modèles (OpenCode) ; le fournisseur est estompé à droite.
- Le navigateur intégré accepte les téléchargements : chaque fichier demande « Enregistrer sous »,
  même quand c'est l'agent qui clique, et rien n'est enregistré sans votre accord ; un bandeau
  confirme, avec « Afficher dans le Finder ».
- Une branche s'affiche juste sous sa conversation d'origine, en retrait, avec une flèche.
- La fenêtre rouvre à sa place et à sa taille, agrandie ou en plein écran si elle l'était ; restée
  sur un écran débranché, elle revient sur l'écran principal.
- Le quota de bobcoins de Bob s'affiche sous son nom, en bas de la barre latérale : part
  consommée et barre (orange à 80 %, rouge à 95 %) ; au clic, consommé, plafond, reste et
  « Actualiser ». Chiffres du serveur de Bob, toutes machines confondues, lus au démarrage.
- Le modèle utilisé se voit dans la barre de saisie, à côté du choix de l'agent (OpenCode) : un
  clic ouvre la liste des modèles.
- Zoom des onglets iOS et Android : en haut de l'onglet, dézoomer, ajuster au panneau, taille
  réelle et zoomer, avec le niveau affiché. Zoomé, l'appareil défile et la molette déplace la vue ;
  on fait défiler l'app en glissant sur l'écran.
- La zone de saisie demande « Que voulez-vous faire ? » sur l'accueil, propose « Répondre à … »
  (avec le nom de l'agent) dans une conversation, et « Ajouter une suite… » pendant une réponse.
- Remarques sur les modifications : dans l'onglet « Modifications », le « + » au survol d'une ligne
  du diff ajoute une remarque (Maj-clic pour une plage) ; « Envoyer à l'agent » les envoie toutes
  en un message qui cite le fichier, les lignes et le code. Elles sont gardées jusqu'à l'envoi.
- ⌘F cherche dans la conversation ouverte (Édition › Rechercher…), sans tenir compte de la casse
  ni des accents : résultats surlignés, compteur, ⌘G / ⇧⌘G pour passer de l'un à l'autre. Une
  conversation trouvée par son contenu dans ⌘K s'ouvre directement sur les mots cherchés.

### Corrections

- Sans clé d'API enregistrée, Bobine ne demande plus le mot de passe du trousseau macOS au
  lancement. Avec une clé, il n'est demandé qu'au démarrage de l'agent qui s'en sert, une fois par
  lancement.
- Une boîte de confirmation d'une page du navigateur intégré ne bloque plus l'agent : ses outils
  rendent la main, il sait que la page attend votre réponse, puis ce que vous avez répondu.
- « Enregistrer sous » dit de quelle conversation vient le téléchargement. Pendant cette fenêtre ou
  une boîte d'une page, la conversation est marquée « Attend votre réponse » dans la liste.
- Le texte tapé après un choix dans un menu de la zone de saisie (mode, modèle…) n'est plus perdu :
  le curseur revient dans la saisie, et les infobulles ne bloquent plus le clic.
- L'accueil tient dans une fenêtre étroite.
- « Faire confiance à ce dossier » devient le bouton principal de la carte « Dossier non
  approuvé ».
- Menu Fenêtre en français : Minimiser, Réduire/agrandir, Tout ramener au premier plan.
- Une branche de conversation (« Repartir de ce message ») reprend la page ouverte dans le
  navigateur.
- Panneau agrandi : « Joindre cette page au message » affiche « Page jointe au message » dans
  l'en-tête.
- Annotation d'une image : un texte long revient à la ligne au lieu de sortir de l'image ;
  Maj+Entrée pour aller à la ligne.
- La liste des conversations ne bouge plus sous la souris : elle se réordonne quand le pointeur la
  quitte.
- Le chronomètre du tour ne reprend plus la durée du tour précédent.
- Le plan annoté se lit en entier : ses remarques ne cachent plus sa fin.
- Après un redémarrage, l'onglet Modifications d'une conversation OpenCode liste de nouveau tous
  les fichiers modifiés, même ceux qui ont changé depuis.
- Une conversation dans un worktree travaille sur une branche `bobine/…` (et non plus `bob/…`).
- Réglages › Agents et dossiers : « Comme la conversation en cours » s'affiche en entier.
- Messages d'erreur sans préfixe technique : la cause seule, sans « Error invoking remote
  method… » ni « Error: » devant (onglets Simulateur, Android, Navigateur, Modifications, Aperçu,
  Réglages, reprise d'une session, installation).

### Sécurité

- L'aperçu HTML cloisonne chaque dossier prévisualisé (une page ne peut plus lire les fichiers
  d'un autre dossier ouvert dans la même session) et ne suit plus un lien symbolique vers un
  fichier ou dossier caché (`.env`, `.git`…).

### Limites connues

- Proxy d'entreprise : Bobine reprend du shell de connexion les variables `HTTPS_PROXY`,
  `HTTP_PROXY` et `NO_PROXY` écrites en majuscules ; leurs équivalents en minuscules ne sont pas
  encore lus, et `localhost` n'est exclu automatiquement du proxy que pour celui réglé dans
  Réglages › Agents. Un proxy local (PreProxy) déclaré en majuscules est pris en compte.

## 0.3.0 — 19 octobre 2026

### Nouveau

- L'interface existe en anglais : Réglages › Général › Langue (Système, Français, English). Elle
  change tout de suite, sans relancer ; vous écrivez aux agents dans la langue de votre choix.
- La fenêtre du `.dmg` est en français et en anglais.
- Journal réglable (Réglages › Diagnostic) : Normal, Détaillé (chaque échange avec les agents,
  dans `agents.log`) ou Trace (avec des extraits, secrets masqués, jusqu'au prochain lancement),
  pour comprendre un souci sans outil à part.
- Planche contact : l'agent peut filmer la page du navigateur, le simulateur iOS ou l'émulateur
  Android pendant un geste (défilement, transition, animation) et voir l'enchaînement en une
  seule image.
- OpenCode 2 : le travail d'un sous-agent (ses outils, sa réponse) s'affiche en direct dans sa
  carte « Sous-agent », au lieu de se mêler à la réponse de l'agent. Ses questions s'affichent
  comme un questionnaire, et la suppression d'une session est proposée.
- OpenCode 2 : les règles actives et les serveurs MCP suivent ses fichiers (`AGENTS.md` jusqu'au
  dossier personnel, plus de `CLAUDE.md` ; serveurs au format `mcp.servers`). OpenCode 1 reste
  pris en charge.
- La liste de tâches de l'agent reste affichée juste au-dessus de la zone de saisie pendant qu'il
  travaille, au lieu de remonter avec le fil ; un clic la replie sur une ligne. Les tâches faites
  sont cochées et grisées, plus barrées.
- L'onglet Android montre l'émulateur dans un vrai téléphone ou une vraie tablette, de votre
  couleur d'accent (Réglages › Général), tourné comme l'appareil en paysage. On y glisse pour
  balayer, la molette fait défiler, un appui long tient le toucher, et les boutons de la tranche
  (marche/arrêt, volume) se cliquent. Son débit (images par seconde) s'affiche comme sur iOS.
- Onglets iOS et Android : les commandes (Accueil, Retour, verrouillage, joindre l'écran au
  message) sont dans une barre sous l'appareil.
- Le panneau de droite s'agrandit à la place de la conversation (bouton ⤢, double-clic sur son
  bord, ou Affichage › Agrandir le panneau, ⇧⌘J) pour voir une page, un appareil ou des
  modifications en grand. Il dit si l'agent travaille ou attend votre réponse ; un clic vous
  ramène à la conversation.
- Ses onglets portent leur nom (« Navigateur », « Modifications 2 », « Tâches 3/5 ») et ne
  montrent que les outils qui servent dans la conversation ; les autres sont dans le menu « + ».
  Un ✕ (ou un clic molette) retire un onglet sans arrêter l'outil ; il revient quand l'agent s'en
  sert à nouveau.

### Corrections

- La flèche « Aller en bas » n'apparaît plus sur une conversation qui tient dans la page (par
  exemple après avoir remonté un long fil puis ouvert une autre conversation).
- OpenCode 2 : les outils de Bobine qu'il appelle depuis du code (« execute ») affichent de
  nouveau ce qu'ils font et leurs captures, au lieu de « execute ».
- Le fil suit de nouveau la fin de la réponse quand une image arrive dans une carte d'outil
  (capture, planche contact) : la fin n'est plus cachée sous la zone de saisie.
- Émulateur Android en paysage : l'écran n'est plus écrasé, et les touchers (les vôtres comme ceux
  de l'agent) tombent au bon endroit.
- L'iPhone de l'onglet iOS tient de nouveau en entier dans le panneau (il était coupé en bas).
- Le menu « Réglages de la session » s'ouvre d'emblée à sa place : il ne saute plus de l'autre
  côté de la zone de saisie quand ses règles arrivent, et le clic qui l'ouvre ne choisit plus,
  parfois, une de ses lignes (une règle s'ouvrait en aperçu sans qu'on l'ait demandé).

## 0.2.0 — 16 octobre 2026

### Nouveau

- Bob Desktop s'appelle désormais **Bobine**, avec sa nouvelle icône. L'historique et les
  réglages de l'ancien nom sont repris au premier lancement.
- Le `.dmg` s'ouvre sur une fenêtre illustrée. Double-cliquez sur Bobine : elle propose de
  s'installer elle-même, pour tous les utilisateurs du Mac ou pour vous seul (dans le dossier
  Applications de votre dossier personnel, sans droits d'administrateur).
- Fenêtre rapide (⌥⌘B) : écrire à l'agent depuis n'importe quelle app, capture d'écran comprise.
- Joindre au message la page du navigateur intégré ou l'écran d'un simulateur, et annoter une
  image avant de l'envoyer.
- Diagrammes Mermaid dessinés dans la conversation.
- Aperçu des pages HTML du projet dans le navigateur intégré.
- Navigateur intégré : les fenêtres de connexion (Google…) s'ouvrent quand vous cliquez vous-même ;
  « Effacer les données du navigateur » et « Garder les cookies du navigateur » dans
  Réglages › Général.
- « Toujours autoriser » un site, « Toujours dans ce projet » pour une commande ou une
  compilation : retenus, listés et révocables dans Réglages › Agents.
- Diagnostic intégré (Réglages › Diagnostic, ou Aide › Diagnostic…).
- Serveurs MCP : bouton « Tester » et pastille d'état dans les réglages.
- Un son quand un agent attend une action et que la fenêtre est en arrière-plan.
- Installation sans accès à Internet, avec un Electron et AXe obtenus ailleurs.
- Ces nouveautés, dans Réglages › À propos.

### Sécurité

- Les outils de Bobine ne sont autorisés d'office que si l'agent les nomme exactement.
- « Ouvrir » dans l'onglet Modifications ne lance plus un fichier exécutable écrit par l'agent :
  il est seulement montré dans le Finder.
- Electron 44.7.2 (correctifs de sécurité de Chromium).

### Corrections

- Les réponses de l'agent utilisent la police de l'app, avec des titres et des traits sobres.
- Dialogues et menus ne perdent plus de clics sous la barre de titre ; l'app reste cliquable après
  un menu.
- Une conversation vide abandonnée ne laisse plus de session chez l'agent.
- Réglages : en-tête fixe et fenêtre plus grande.
- Menu « / » : on voit avec quels agents une commande fonctionne.
- App plus légère d'environ 55 Mo.

## 0.1.1 — 14 octobre 2026

Première version publiée (`.dmg` sur GitHub), sous le nom Bob Desktop.

- Conversations avec IBM Bob et OpenCode par le protocole ACP : réponses en direct, réflexions,
  outils, autorisations, questions à choix, modes et options de session, consommation.
- Historique : recherche dans le contenu, épinglage, regroupement par dossier, archives,
  reprise des sessions commencées ailleurs, export en Markdown ou JSON, sauvegarde.
- Modifier un message et repartir de là, avec remise en état des fichiers ; récapitulatif des
  modifications, annulables fichier par fichier.
- Plan annoté : remarques sur les passages, versions comparées, exécution.
- Conversations en parallèle dans des worktrees git, côte à côte.
- Panneaux pilotés par l'agent : navigateur intégré, simulateur iOS, émulateur Android, terminal,
  serveurs de développement, liste de tâches.
- Commandes « / » de l'agent, de l'app, personnelles et du projet ; mentions `@` de fichiers.
- Serveurs MCP de Bob et d'OpenCode gérés depuis les réglages ; clés d'API chiffrées dans le
  trousseau.
- Notifications, thèmes (dont Sépia et Nuit noire), polices, raccourcis clavier.
