# Essai à la vraie souris — fin des vagues (fiches 128 à 142)

Liste cumulée des vérifications que les e2e ne voient pas (zones de glissement, page native du
navigateur, menus de macOS, vrais agents). Chaque fiche garde sa liste détaillée ; ici, une ligne
par point, rangée par passage pour relancer l'app le moins possible. Branche `integration/vagues`.

Cocher `[x]` ce qui va, et noter ce qui ne va pas sous le point (capture si possible). En clair et
en sombre, sauf mention.

## Passage 1 — app d'essai, agent factice

### Barre latérale (131)
- [ ] Survol d'une ligne : fond plus clair que la sélection ; « … » par-dessus l'état, menu complet
      (fille comprise), la liste ne bouge pas pendant qu'il est ouvert.
- [ ] Repli des sections (Épinglées, Récents / Dossiers, Archivées) et des dossiers ; chevron au
      survol ; repli retrouvé après ⌘Q.
- [ ] Défilement : la zone du haut reste, le filet apparaît dès que la liste défile.
- [ ] Poignée de la barre (glisser, double-clic) : titres coupés proprement, chevron collé au nom,
      lien des filles intact.
- [ ] Filtre de Récents : menu Récents / Dossiers / Reprendre une session… ; icône alignée.

### Activité pendant un tour (128)
- [ ] `/scenario outil-en-preparation` : « Prépare une modification… », jamais « patch » ; temps de
      l'indicateur = l'étape ; survol : « Tour commencé il y a … ».
- [ ] `/scenario outil-en-preparation-interrompu` puis Échap : « Modification · interrompu ».
- [ ] `/scenario shell-en-preparation` : « Prépare une commande… », puis la commande.
- [ ] Sortie `execute` en JSON affichée indentée.
- [ ] Vue Modifications › « Committer » : message proposé pour un titre long fini sur un mot plein
      et « … ».

### Navigateur (129) — page de test longue, panneau étroit puis agrandi
- [ ] Molette et trackpad sans avoir cliqué dans la page, puis après un clic ; horizontal au
      trackpad.
- [ ] Clavier dans la page (espace, ↓, ⇟) ; dans la zone de saisie, espace écrit un espace.
- [ ] Poignée du panneau lente puis rapide, ⤢ agrandir / réduire, fenêtre redimensionnée, barre
      latérale repliée : la page suit sans trou ni débord, texte remis en page.
- [ ] Zoom de l'interface (⌘+ ×2, ⌘− ×3, ⌘0, clavier dans la saisie) : la page reste sur sa zone.
- [ ] Zoom de la page (clic dedans, ⌘+, ⌘=, ⌘−, ⌘0) : puce « 110 % », clic la remet à 100 % ;
      Présentation › Zoom avant ; pincer, Ctrl + molette ; deux onglets du même site indépendants.
- [ ] Raccourcis page au focus : ⌘L (adresse), ⌘R (page seule), ⌘[ ⌘] ; hors page, ⌘L va à la
      saisie.
- [ ] Menu « + », Réglages, ⌘K par-dessus la page : elle se masque puis revient à sa place.

### Annoter la page (132)
- [ ] « Annoter » : bouton teinté, bandeau, la page ne bouge pas d'un pixel (aussi zoomée).
- [ ] Épingle exactement sous le pointeur ; bulle dans le panneau ; ⌘↩, Annuler, Échap ; clic à côté
      ne perd pas le texte.
- [ ] Rouvrir une épingle : Enregistrer, corbeille, numérotation qui suit.
- [ ] Échap : bulle, puis page vivante (défile, répond aux clics) ; Échap dans la saisie interrompt
      l'agent sans quitter Annoter.
- [ ] Remarques gardées en changeant d'onglet ou de conversation ; corbeille vide tout.
- [ ] « Envoyer à l'agent » pendant un tour : le message attend dans la file ; épingles aux bons
      endroits sur l'image du fil.
- [ ] Menus et Réglages pendant Annoter : la vue native ne réapparaît pas par-dessus.

### Échanges ACP (135)
- [ ] « + » › « Échanges ACP » : les messages déjà échangés sont là.
- [ ] Clic : le JSON se déplie, se replie ; plusieurs lignes copiées → une ligne JSON par message.
- [ ] Pause pendant un tour, reprise ; filtre (`tool_call`, outil, mot du texte) ; « Regrouper les
      morceaux » décoché puis recoché.
- [ ] Panneau étroit (280 px) et agrandi ; niveau Normal : l'onglet marche, « Ouvrir agents.log »
      grisé si vide ; couleurs dans les 4 palettes.

### Réglages : groupes, Apparence, Journal (133, 136)
- [ ] Trois groupes, onglet actif, ⌘, ouvre sur Général ; fenêtre petite : en-tête fixe, cartes sans
      débordement.
- [ ] Apparence : une ligne « Thème » de cinq vignettes (retouche du 24/10) ; l'aperçu suit chaque
      clic ; vignettes au clavier (Tab, Espace) ; police des réponses « Sans serif » / « Serif ».
- [ ] Listes de polices : toutes celles du Mac ; police du code et du terminal appliquées (bloc de
      code, diff, sortie, onglet Terminal).
- [ ] Notifications : bandeau quand macOS bloque et son bouton ; rebond et compteur grisés quand
      coupées ; aides lisibles.
- [ ] Diagnostic › Journal : « Ouvrir » `main.log` dans Console, Finder sur le fichier ;
      `agents.log` grisé en Normal, ouvrable en Détaillé ; l'aide du niveau change aussitôt.
- [ ] Agents : liste « Comme maintenant » entière, plus rien sur le PATH ; clic sur une ligne,
      « ‹ Agents », Échap, « Relancer », « Avancé ».
- [ ] Recherche : « empattements », « journal », « log », « finder », « version », « proxy »,
      « propre à », « clé », « conversations gardées actives ».

### Thèmes et terminal (134, 136)
- [ ] Terminal ouvert : Clair → Sépia → Sombre → Nuit noire → Système, couleurs changées sans
      vider ni clignoter ; curseur et sélection à l'accent.
- [ ] Changer d'accent avec terminal et Mermaid affichés (six teintes ; « Comme le Mac » retiré).
- [ ] Relancer en Sépia puis Nuit noire : fenêtre et « À propos » sans éclair.
- [ ] Mode Système : basculer macOS clair / sombre, l'app et le terminal suivent en direct.
- [ ] Vrai shell (powerlevel10k) : `ls -G`, `git diff --color`, `git log --graph`, `htop` ou `vim`.
- [ ] Blocs de code et « Copier » dans les 4 palettes ; bordures en Sombre et Nuit noire ; bouton
      d'envoi sur l'accent ; mode Plan violet lisible.

### Consommation (137)
- [ ] Puce → « Toute la consommation… » : Réglages › Consommation, onglet en tête du 3e groupe.
- [ ] Fenêtre redimensionnée : graphique net, chiffres clés sur deux colonnes, tableaux sans
      débordement.
- [ ] « Exporter… » : menu sous le bouton, Enregistrer sous, CSV lisible dans Numbers.
- [ ] « Remettre à zéro… » : Échap referme la ligne sans fermer les réglages ; le tableau se vide,
      l'échange suivant est compté.
- [ ] Clic sur une conversation (archivée comprise) : elle s'ouvre.
- [ ] Recherche : « coût », « jetons », « quota », « remettre à zéro ».

### Agent ACP personnalisé (141)
- [ ] « Ajouter un agent ACP… » : survol, clic, Tab puis Entrée.
- [ ] Formulaire : focus sur « Nom », chemin entre guillemets, bloc `.env` collé ; ligne mal formée →
      erreur, « Ajouter » grisé ; Échap ; « ‹ Agents » sans rien enregistrer.
- [ ] Commande introuvable : point rouge, « Modifier… » corrige sans redémarrer.
- [ ] Clé d'API : « Définir » (une demande du trousseau au plus) ; changer la variable oublie
      l'ancienne clé.
- [ ] Agent factice `--sans-historique` déclaré, redémarrage : repère « Nouvelle session avec … »,
      le message suivant part avec l'échange d'avant (journal Détaillé).
- [ ] « Supprimer cet agent » : focus sur « Garder », Échap ; lecture seule au lancement suivant.
- [ ] Recherche : « acp », « ajouter agent ».

### Réseau, agent factice (142)
- [ ] `/scenario reseau-instable` : bandeau, décompte, Stop ; la réponse arrive sans nouvelle bulle.
- [ ] `/scenario reseau-coupe` : outil interrompu dès la première tentative ; « Réessayer
      maintenant » ×5, « Connexion impossible », « Réessayer ».
- [ ] Message écrit pendant l'attente (file), puis Échap : tentatives arrêtées, la file attend.

## Passage 2 — OpenCode (modèle gratuit)

- [ ] 128 : modification de plusieurs fichiers : « Prépare une modification… » pendant le patch.
- [ ] 129 : page zoomée à 150 %, l'agent clique juste ; « essaie la page en mobile » : 375 × 812
      réduit, entier, défile, puce dans l'adresse, rendu à la largeur au tour suivant.
- [ ] 132 : remarques envoyées, l'agent comprend quel élément est visé.
- [ ] 135 : la liste défile seule en bas pendant un tour, s'arrête quand on remonte.
- [ ] 137 : survol du graphique sur 30 jours avec de vraies données ; couleurs gardées en filtrant ;
      premier lancement sur le vrai historique compté une seule fois.
- [ ] 141 : `opencode acp` déclaré à la main : menu des agents, réponse, « Ce qu'il annonce » rempli.
- [ ] 142 : couper le Wi-Fi pendant un tour : bandeau, puis le rallumer (tentative en 2 s) ; cinq
      tentatives (≈ 1 min) ; capot fermé puis rouvert ; relever l'erreur dans `agents.log`.

## Passage 3 — Bob (bobcoins : à grouper)

- [ ] 142 : couper le Wi-Fi pendant un tour ; relever dans `agents.log` (Détaillé) l'erreur de
      `session/prompt` et la sortie d'erreur, à reporter dans `docs/acp.md` ; s'il réessaie seul
      sans rien dire, le noter.
- [ ] 137 : coût de Bob compté après « Remettre à zéro », l'ancien ne revient pas.
- [ ] ADR-0030 : session de Bob perdue puis « Relancer » : repère « Nouvelle session », l'échange
      d'avant part avec le message suivant.
