# ADR-0078 — Navigateur intégré : taille d'écran et thème réglés aussi par l'utilisateur

- **Statut** : accepté (2026-11-28 : « Oui, accepté », Jérôme, après la maquette validée de la
  fiche 295)
- **Date** : 2026-11-28
- **Remplace en partie** : dans l'ADR-0026, la phrase « Pas de menu de tailles pour
  l'utilisateur (décision de Jérôme, 23/10) » et l'alternative écartée « Menu de tailles d'écran
  (Mobile, Tablette…) pour l'utilisateur ». Le reste de l'ADR-0026 est inchangé (vue native, taille
  par le CDP réduite pour tenir, pixels CSS pour l'agent, annotation).
- **Fiche** : 295

## Contexte

Le 23 octobre, à la relecture des maquettes de la fiche 129, Jérôme a écarté un menu de tailles
pour l'utilisateur : la page devait d'abord suivre la largeur du panneau, comme dans Claude Code,
et seul l'agent imposait une taille (`browser_resize`), le temps de son tour.

Ce qui a changé depuis :

- **l'usage réel** : avec la 1.2 (rc.2) en main, Jérôme demande de pouvoir lui-même voir sa page
  comme un téléphone, une tablette ou en thème sombre, sans passer par l'agent (capture d'une autre
  app à l'appui, 2026-11-28) ;
- **le moteur existe** : `browser_resize` (fiches 031 et 129) pose déjà une taille et un thème par
  le CDP, réduit la page pour qu'elle tienne, garde les clics justes et s'annule à la fin du tour.
  Ce qui manque, c'est un réglage de l'utilisateur et la règle de partage avec l'agent ;
- la page suit toujours le panneau **par défaut** : ce que l'ADR-0026 protégeait reste vrai.

## Décision

1. **Une barre « Appareil » derrière un bouton de la barre d'adresse**, repliée par défaut :
   appareil, largeur × hauteur, rotation, thème Auto / Clair / Sombre, échelle quand la page est
   réduite. La barre ouverte est le réglage : refermée, la page reprend la largeur du panneau et
   le thème Auto. Aucun état caché.
2. **Deux couches, calculées dans le main** : le réglage de l'utilisateur (par conversation) et
   l'essai de l'agent (par onglet, comme aujourd'hui). Pendant son tour, l'essai de l'agent passe
   devant et la barre le montre en lecture seule, avec « Reprendre la main ». À la fin du tour,
   seul l'essai de l'agent s'efface et le réglage de l'utilisateur revient. Un geste de
   l'utilisateur pendant le tour efface l'essai de l'agent : l'utilisateur a le dernier mot.
3. **Mémoire par conversation, jusqu'à la fermeture de l'app**, comme les onglets du navigateur :
   rien n'est écrit sur le disque, une branche ne reprend pas le réglage.
4. **Appareils désignés par leur nom** (iPhone SE, iPhone 14, iPhone 14 Pro Max, Pixel 7,
   iPad mini, iPad Pro), plus « Portable » et « Bureau » : choix de Jérôme, contre la
   recommandation de libellés génériques. **Limite assumée et dite** : seule la taille de l'écran
   en pixels CSS est imitée, avec le mode mobile de Chromium et le tactile ; ni la densité de
   pixels, ni l'identité du navigateur, ni Safari. La taille figure toujours à côté du nom, et une
   ligne en bas du menu le dit. La liste est une donnée courte (`shared/browser-devices.ts`).
   Chaque entrée reprend la taille de l'entrée de même nom de la liste d'appareils de Chrome
   DevTools, et non celle du dernier modèle vendu sous ce nom. La liste est relue à chaque version
   majeure.
5. Seul le main parle à la page ; un seul canal IPC (`browser:setDevice`) qui revérifie tout ;
   aucun pouvoir nouveau au renderer ; les autorisations du navigateur (fiches 072, 249, 269) ne
   changent pas.

## Alternatives écartées

- **Garder l'ADR-0026 tel quel (pas de réglage pour l'utilisateur)** : l'utilisateur doit demander
  à l'agent, qui paie un tour et rend la main à la fin. C'est le besoin exprimé qu'on refusait.
- **Barre toujours visible** : 37 px de page en moins pour tout le monde, interface chargée.
- **Libellés génériques** (« Téléphone 390 × 844 ») : plus honnêtes et sans entretien, mais
  écartés par Jérôme, qui veut reconnaître ses appareils.
- **Le réglage de l'utilisateur prime, `browser_resize` refusé** : l'agent ne pourrait plus
  vérifier « en mobile » ce qu'on lui demande.
- **Mémoire par onglet, globale, ou gardée au redémarrage** : un nouvel onglet repartirait à la
  largeur du panneau, une conversation hériterait du réglage d'une autre, ou un état caché
  survivrait au redémarrage (ce que la fiche 129 a retiré pour l'agent).
- **Densité de pixels et identité du navigateur imitées** : plus proche d'un appareil, mais cela
  change les captures et les coordonnées et touche une session partagée par tous les onglets. Plus
  de risque pour peu de gain ; la question reste ouverte.

## Conséquences

- `endAgentTurn` n'efface plus que la couche de l'agent. C'est le point le plus fragile : il faut
  des essais dédiés, avec plusieurs onglets.
- `BrowserState` porte le réglage, le thème en vigueur et l'essai de l'agent. Le thème forcé par
  l'agent devient visible dans l'interface, ce qui n'est pas le cas aujourd'hui.
- Des noms de produits de tiers (Apple, Google) entrent dans l'interface. Il faut une règle
  d'entretien (fiche 295) et, si Jérôme le valide, une mention de marque à l'endroit où le dépôt
  en a déjà une.
- Si cet ADR est accepté, on ne touche pas au texte de l'ADR-0026 : seulement son statut,
  « accepté — en partie remplacé par ADR-0078 » (convention de `.claude/skills/nouvel-adr`). Même
  chose pour la mention dans la fiche 129.
