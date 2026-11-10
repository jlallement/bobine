# Dépannage

Quand quelque chose ne marche pas : commencez par le diagnostic, puis cherchez votre cas
ci-dessous.

Ici, vous pouvez :

- [lancer le diagnostic](#diagnostic) ;
- [lire le journal](#journal) ;
- [signaler un problème](#signaler) ;
- régler les cas courants : [agent introuvable](#agent-introuvable),
  [connexion d'OpenCode expirée](#opencode-connexion), [IBM Bob bloqué au démarrage](#bob-bloque),
  [`gh` absent ou pas connecté](#gh), [connexion perdue](#connexion-perdue),
  [capture d'écran indisponible](#capture), [version d'agent non vérifiée](#version),
  [l'agent ne dit plus rien](#silence), [après un arrêt inattendu](#plantage).

<a id="diagnostic"></a>

## Lancer le diagnostic

Réglages › Diagnostic (ou Aide › Diagnostic…) vérifie tout d'un coup : les agents trouvés et leur
version, une session d'essai dans le dossier courant (dossier approuvé, connexion, licence), les
serveurs MCP, les fournisseurs de modèles, Xcode, les simulateurs et AXe, le SDK Android. Chaque
problème vient avec sa marche à suivre.

- **Relancer** refait les vérifications.
- **Copier le rapport** copie le tout en texte.

Rien n'est envoyé à un modèle : la session d'essai est supprimée ensuite.

<a id="journal"></a>

## Lire le journal

Réglages › Diagnostic › **Journal** montre les deux fichiers, avec **Ouvrir** et **Afficher dans le
Finder** :

- `main.log` : démarrage, erreurs, agents lancés et arrêtés, durée des tours ;
- `agents.log` : les échanges avec les agents, aux niveaux Détaillé et Trace.

Ils sont dans `~/Library/Logs/Bobine/`. Aide › Afficher le journal ouvre `main.log`.

**Niveau du journal** :

- **Normal** : seul `main.log` est écrit ;
- **Détaillé** : en plus, chaque échange avec les agents (messages, outils de l'app, sortie
  d'erreur), sans leur contenu ;
- **Trace** : en plus, des extraits du contenu, secrets masqués, jusqu'au prochain lancement.

Pour comprendre un souci avec un agent : passez en **Détaillé**, refaites l'opération, puis lisez
`agents.log`. L'onglet [Échanges ACP](panneaux.md#echanges-acp) montre aussi les messages en
direct.

<a id="signaler"></a>

## Signaler un problème

Réglages › Diagnostic › **Signaler un problème** ouvre dans votre navigateur une issue GitHub
préremplie avec la version et le rapport. Rien ne part avant que vous ne la validiez sur GitHub.

La fenêtre Bobine › À propos de Bobine a aussi **Copier les infos techniques** (version, commit,
macOS, agents installés), à coller dans un signalement.

<a id="agent-introuvable"></a>

## L'agent n'apparaît pas, ou « commande introuvable »

Bobine ne propose que les agents installés. Après avoir installé `bob` ou `opencode` (surtout dans
votre dossier personnel) : Réglages › Diagnostic › **Relire le PATH**. Bobine relit le `PATH` de
votre shell de connexion.

Même chose pour « git introuvable » : installez les outils en ligne de commande
(`xcode-select --install`), puis **Relire le PATH**.

<a id="opencode-connexion"></a>

## La connexion d'OpenCode a expiré

Symptôme : une erreur en anglais dans le fil, par exemple
`Integration.Authorization: Request failed: 400`, alors que l'agent est toujours « Prêt ».

Bobine ne reconnaît pas encore ce cas. Pour vous reconnecter, dans un terminal (celui de Bobine,
⌃`, convient) :

```bash
opencode auth login
```

Puis renvoyez votre message.

<a id="bob-bloque"></a>

## IBM Bob est bloqué au démarrage

- **Dossier non approuvé** : **Faire confiance à ce dossier** (Bob s'en souvient), ou **Faire
  confiance pour cette session** pour un dossier jetable.
- **Connexion requise** : le bouton de connexion de Bob ouvre votre navigateur ; ou **Utiliser une
  clé d'API**. Voir [Agents](agents.md#cle-bob).
- **Licence à accepter** : lisez-la, acceptez-la vous-même avec `bob --accept-license` dans un
  terminal, puis **Réessayer**. Si Bob la demande au premier message, renvoyez votre message et
  acceptez-la dans le formulaire qui s'affiche.

Bob s'arrête au premier refus : le diagnostic vérifie la suite une fois le dossier approuvé.

**Quota épuisé** : un budget ou un quota dépassé n'est pas réessayé ; l'erreur s'affiche dans le
fil. Le quota du mois est sous le nom de Bob, en bas de la barre latérale.

<a id="gh"></a>

## `gh` absent ou pas connecté à GitHub

« Ouvrir une PR » et le [suivi des PR](suivi-pr-ci.md) passent par la commande `gh` (GitHub CLI).
La vue Git du worktree dit ce qui manque :

- **`gh` introuvable** : installez-le (`brew install gh`), puis Réglages › Diagnostic › **Relire
  le PATH** ;
- **`gh` pas connecté** : dans un terminal, `gh auth login`.

Après la connexion, Bobine peut mettre jusqu'à 5 minutes à s'en apercevoir.

- **Pas de dépôt distant** : ajoutez-en un (`git remote add origin …`) pour pouvoir pousser la
  branche.

<a id="connexion-perdue"></a>

## La connexion est perdue pendant une réponse

Réseau coupé, proxy, limite de débit : Bobine réessaie seule. Un bandeau dit « Connexion perdue »
et « Nouvelle tentative dans 8 s (3 sur 5) » ; votre message reste en attente et repart sans avoir
à le renvoyer. Cinq tentatives, de plus en plus espacées, et tout de suite si le réseau revient ou
si le Mac sort de veille.

**Réessayer maintenant** n'attend pas ; Échap ou Arrêter abandonne. Après la cinquième :
« Connexion impossible » et **Réessayer**.

Derrière un proxy d'entreprise : voir [Réseau d'entreprise](agents.md#reseau).

<a id="capture"></a>

## La capture d'écran est indisponible

La capture d'une zone de l'écran (zone de saisie, fenêtre rapide) demande l'autorisation
« Enregistrement de l'écran » de macOS. Cochez Bobine dans Réglages Système › Confidentialité et
sécurité, puis relancez l'app. Le bouton **Ouvrir les Réglages Système** y mène.

Joindre la page du navigateur intégré ou l'écran du simulateur n'en a pas besoin.

Après une mise à jour de Bobine, macOS peut redemander cette autorisation, ainsi que l'accès au
trousseau (« Bobine Safe Storage ») : répondez **Toujours autoriser**.

<a id="version"></a>

## « Bobine a été vérifié avec … »

Quand votre agent a une version **plus récente** que celles essayées avec Bobine, un avis discret le
dit une fois dans la conversation, avec un lien vers le Diagnostic. Une version **plus ancienne**
donne un avertissement, une fois aussi. Rien ne bloque : l'avis ne revient pas, ni dans une autre
conversation, ni après un redémarrage, tant que la version ne change pas. Seul un agent qui parle
une version du protocole ACP que Bobine ne connaît pas ne démarre pas ; le message dit qui mettre
à jour, l'agent ou Bobine.

Le diagnostic prévient quand un agent annonce une version que Bobine n'a pas vérifiée. L'essentiel
marche, mais les fonctions propres à cet agent peuvent ne pas marcher. Si quelque chose cloche,
[signalez-le](#signaler) avec le journal en **Détaillé**. Les versions vérifiées sont sur la
[page de l'agent](agents.md#page-agent).

<a id="silence"></a>

## L'agent ne dit plus rien

Quand l'agent n'a rien envoyé depuis 5 minutes pendant une réponse, un bandeau le dit en bas de la
conversation. C'est normal pendant une longue commande ou une longue réflexion : rien n'est coupé.
**Attendre** le cache ; **Arrêter** arrête la réponse, la conversation est gardée. Le bandeau part
dès que l'agent reparle.

<a id="plantage"></a>

## Après un arrêt inattendu

Si Bobine s'est arrêtée sans quitter (plantage, Mac éteint), elle le dit au lancement suivant et
range un rapport sur ce Mac, **sans rien envoyer**. **Afficher le rapport** le montre dans le
Finder ; relisez-le avant de le joindre à un [signalement](#signaler) : il peut contenir des
extraits de vos conversations. Vos conversations sont gardées.

Si l'interface s'arrête trois fois en une minute, Bobine propose de se relancer sur l'accueil.
Un message ou un panneau qui ne peut pas s'afficher est remplacé par une ligne qui le dit
(**Réessayer**), et le reste de la fenêtre reste utilisable.
