# ADR-0033 — Annoter la page vivante : un script de l'app dans un monde isolé de la page

- **Statut** : accepté
- **Date** : 2026-10-24
- **Remplace** : le dernier point de la décision de l'ADR-0026 (« ce que l'interface doit dessiner
  sur la page se fait sur une image figée de la page »). Le reste de l'ADR-0026 tient.

## Contexte

La fiche 132 fige la page sur une capture dès « Annoter » : l'interface ne peut rien dessiner sur
la vue native, posée par-dessus. Jérôme, après un essai réel (24/10) : on ne peut plus faire défiler
ni zoomer, « donc on n'arrive pas à bien annoter ». Une page ne s'annote qu'écran par écran.

Deux sondes sur Electron 45 (fiche 146) :
- **Page masquée** (pour garder l'idée de la capture) : la molette envoyée par `sendInputEvent`
  n'avance que de 8 px sur 400, l'image ne change pas, `Input.dispatchMouseEvent` et
  `Page.captureScreenshot` du CDP restent bloqués. Seul `capturePage({ stayHidden: true })`
  redessine une page masquée (et suit les changements de son DOM).
- **Page vivante** : un écouteur `click` posé en phase de capture sur `window`, depuis un monde
  isolé, arrête le clic avant les gestionnaires de la page ; un binding CDP limité à ce monde
  rend le point et l'élément au main ; la page défile normalement.

## Décision

- **En mode Annoter, la vue native reste affichée et vivante.** Défilement, zoom, pincement restent
  ceux de Chromium.
- **Un script de l'app est lancé dans la page**, dans un monde isolé créé par le CDP
  (`Page.createIsolatedWorld`, nom `bobine-annoter`) : il partage le DOM de la page, pas son
  JavaScript. Il arrête les clics en phase de capture et parle au main par un binding
  (`Runtime.addBinding` limité à ce monde : la page ne le voit pas). Le main vérifie chaque message.
- **Ce que l'app dessine est dans la page**, dans un élément hôte `<bobine-notes>` à racine fermée
  (épingles, bulles en lecture, contour du survol) plus une feuille de style pour le curseur. Il
  n'existe qu'en mode Annoter. Aucun `innerHTML` (pages à Trusted Types).
- **Le texte se saisit dans Bobine** : au clic, la page est figée le temps d'écrire (capture
  affichée à la place de la vue, comme à la fiche 132) ; rien de ce que l'utilisateur écrit ne passe
  par un champ de la page.
- **Ce qui part à l'agent est propre** : la capture d'une remarque est prise page masquée, script
  caché (`capturePage({ stayHidden: true })`), avant que la page ne revienne.

## Alternatives écartées

- **Garder la page figée, transmettre molette et zoom à la page masquée et recapturer** — sondé :
  une page masquée ne se redessine pas (défilement doux arrêté, CDP bloqué). Défilement faux ou
  saccadé.
- **Une seconde vue native transparente par-dessus la page** pour dessiner les épingles dans
  Bobine — la molette n'atteindrait plus la page (il faudrait la retransmettre, sans l'inertie du
  trackpad), les épingles devraient suivre le défilement de la page à chaque image depuis un autre
  processus, et les boîtes qui défilent dans la page seraient hors d'atteinte.
- **Le mode « inspecter » du CDP (`Overlay.setInspectMode`)** — il désigne un élément mais ne rend
  pas le point du clic, et ne sait pas dessiner d'épingles ni de bulles.

## Conséquences

- L'app modifie le DOM de la page pendant le mode Annoter : un élément de plus sous `<html>`. Une
  page qui surveille tout son DOM peut le voir, comme le ferait une extension du navigateur ; il
  disparaît en quittant le mode. Les écouteurs `click` que la page pose elle-même en capture sur
  `window` avant le script passent encore ; ceux de ses éléments, non.
- Les cadres (`iframe`) ne reçoivent pas de clic en mode Annoter (`pointer-events: none`) : le clic
  désigne le cadre ; on n'annote pas l'intérieur d'un cadre, et l'on n'y fait pas défiler.
- Le monde isolé part avec le document : le main le recrée à chaque navigation (`did-navigate`,
  `dom-ready`) et après un contexte perdu.
- La page zoomée est suivie par le script (`devicePixelRatio`) : épingles et bulles gardent leur
  taille à l'écran.
- Le comportement à la vraie souris (inertie du trackpad, pincement, curseur) reste à essayer à la
  main : les e2e envoient leurs entrées par `sendInputEvent`.
