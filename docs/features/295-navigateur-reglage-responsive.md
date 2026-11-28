# 295 — Navigateur intégré : taille d'écran et thème réglés par l'utilisateur

- **Statut** : maquette arbitrée par Jérôme le 2026-11-28 ; ADR-0078 proposé ; rien de codé (1.3)
- **Dépend de** : 007 (navigateur intégré), 031 (`browser_resize`, CDP, ADR-0006), 129 (page
  réduite pour tenir, fin de tour, ADR-0026), 072 et 249 (autorisations du navigateur), 132 et 146
  (Annoter), 269 (avertissement de certificat)
- **Agents** : tous. Rien ne dépend de l'agent : c'est un réglage de l'interface, appliqué par le
  main au navigateur intégré par le CDP (ADR-0011 : rien dans les profils, aucune ligne de
  `docs/agents.md`).
- **Maquette** : [`docs/maquettes/295-navigateur-responsive.html`](../maquettes/295-navigateur-responsive.html),
  captures dans `docs/maquettes/295/` (`NN-…-clair.png`, et `-sombre.png` pour les planches 2, 3,
  4 et 5 ; `avant-…-clair` et `avant-…-sombre` : l'app réelle, 1.2, suite e2e `browser-view`).
- **ADR** : [ADR-0078](../adr/0078-taille-d-ecran-reglee-par-l-utilisateur.md) (proposé).

## Pourquoi

Le développeur front qui a ouvert sa page dans le navigateur intégré veut la voir telle qu'un
téléphone, une tablette ou un thème sombre la rendent, **sans demander à l'agent** ni ouvrir un
autre navigateur. Aujourd'hui seul l'agent peut changer la taille d'écran ou le thème, et seulement
le temps de son tour. Jérôme (2026-11-28), capture d'une autre app à l'appui : « je ne sais pas si
Bobine a la possibilité de régler le responsive », puis « Oui, fiche et maquette ».

**Décision antérieure à remplacer.** L'ADR-0026 (accepté, 23/10) dit « Pas de menu de tailles pour
l'utilisateur (décision de Jérôme, 23/10) », écarté alors parce que « la page suit la largeur du
panneau, comme dans Claude Code ». La page continuera de suivre le panneau par défaut (« Adaptatif ») ;
l'**ADR-0078** (proposé, à valider par Jérôme, qui revient ainsi sur sa décision d'octobre)
remplace cette ligne seulement. Le texte de l'ADR-0026 n'est pas touché ; son statut ne passera à
« en partie remplacé par ADR-0078 » qu'une fois l'ADR-0078 accepté.

## Ce qui existe (relevé dans le code, tête `34f9f5be`)

| Quoi | Où | Comportement réel |
|---|---|---|
| Outil `browser_resize` de l'agent | `src/main/browser/browser-tools.ts` (`PRESETS`, l. 119-123 ; outil l. 517-538 ; description l. 710-722) | Préréglages `mobile` 375 × 812 et `tablet` 768 × 1024 (tous deux `mobile: true`), `desktop` = plus d'émulation (taille du panneau) ; ou `width` / `height` libres bornés à **200-4 000** (`num(…, 200, 4000)`), `mobile` faux par défaut ; `color_scheme` `light` / `dark` / `auto`. |
| Émulation par le CDP | `src/main/browser/cdp-tab.ts`, `emulate()` l. 432-447, `setColorScheme()` l. 449-454 | `Emulation.setDeviceMetricsOverride { width, height, deviceScaleFactor: 0, mobile, scale }` puis `Emulation.setTouchEmulationEnabled { enabled: mobile }` ; thème par `Emulation.setEmulatedMedia` (`prefers-color-scheme`). État gardé **par onglet** (`CdpTab.emulation`, `CdpTab.colorScheme`). |
| Mise à l'échelle | `src/main/browser/page-view.ts`, `emulationFrame()` | `scale = min(1, largeur de la zone / largeur émulée, hauteur / hauteur)` ; la vue native est réduite à l'écran émulé × `scale`, **centrée en haut** de la zone. Jamais agrandie au-delà de 100 %. Recalculée quand la zone change (`BrowserManager.frameOf`). |
| Fin de tour | `src/main/index.ts` l. 676-683 → `BrowserManager.endAgentTurn()` | À `turn-end` / `turn-error`, **tous les onglets** de la conversation perdent taille **et** thème imposés. |
| Puce de la taille imposée | `BrowserTab.tsx`, `PageChips` ; clés `browser.emulation.chip` / `.tip` | « 375 × 812 » dans le champ d'adresse, infobulle « … affichée à 90 % pour tenir » ; un clic → `browser:clearEmulation` (largeur du panneau). |
| État vu par l'interface | `src/shared/browser.ts`, `BrowserState.emulation` | Taille et `scale` de l'onglet actif. **Le thème imposé n'y est pas** : un thème sombre forcé par l'agent est aujourd'hui invisible dans l'interface. |
| IPC | `src/shared/browser-ipc.ts`, `src/main/browser/browser-ipc.ts`, `browser-controller.ts`, `src/preload/api.ts` | `browser:clearEmulation` existe ; aucun canal pour **poser** une taille ou un thème depuis l'interface. Canal classé sûr en lecture seule (`read-only-guard.ts`). |
| Navigateur par conversation | `browser-manager.ts` | Un `Browser` par conversation, plusieurs onglets ; rien n'est gardé au redémarrage de l'app (onglets en mémoire). |
| Identité du navigateur | `browser-manager.ts` l. 846-853 | User-Agent de la **session** (Chrome de bureau, sans « Electron ») ; **aucune** émulation ne le change. |

**Ce que fait vraiment `mobile: true`** (d'après le code, et la documentation du domaine
`Emulation` du CDP) :

- `setDeviceMetricsOverride` avec `mobile: true` : Chromium se comporte en « appareil mobile » pour
  la mise en page — la balise `<meta name="viewport">` est prise en compte (une page sans elle est
  mise en page sur 980 px puis réduite, ADR-0026 « Conséquences »), barres de défilement
  superposées, ajustement automatique du texte ;
- `setTouchEmulationEnabled { enabled: true }` : la page voit un écran tactile (évènements tactiles
  disponibles) ; **la souris de l'utilisateur reste une souris** (`Emulation.setEmitTouchEventsForMouse`
  n'est appelé nulle part) ;
- **densité de pixels inchangée** : `deviceScaleFactor: 0` = celle de l'écran du Mac (souvent 2) ;
- **identité inchangée** : pas de `setUserAgentOverride`, la page voit toujours Chrome de bureau
  sur macOS — un site qui choisit sa version mobile d'après l'identité du navigateur ne la
  servira pas ;
- **non vérifié** : l'effet exact sur les requêtes média `(pointer: coarse)` et `(hover: none)`.
  À relever par une sonde au lot 1 avant d'en dire quoi que ce soit à l'utilisateur.

**Ce qui manque** : un réglage pour l'utilisateur (aucun bouton, aucun menu) ; un état distinct
« réglage de l'utilisateur » / « essai de l'agent » (aujourd'hui une seule émulation par onglet,
que la fin de tour efface) ; le thème dans `BrowserState`.

## Périmètre

**Dedans** : une barre « Appareil », repliée par défaut, ouverte par un bouton de la barre
d'adresse : menu d'appareils, largeur × hauteur, rotation, thème Auto / Clair / Sombre, échelle
affichée quand la page est réduite. Générique, aucun agent concerné.

**Dehors, explicitement** : émulation du réseau (lent, hors ligne), de la géolocalisation, des
capteurs ; densité de pixels réglable ; identité du navigateur (User-Agent) ; capture d'un
appareil avec son cadre ; liste d'appareils éditable ou enregistrée ; zoom d'affichage choisi
(« 100 % et défiler » au lieu de « réduite pour tenir ») ; règles de points de rupture ; tout ce qui
ressemble aux outils de développement complets de Chrome. Popups de l'utilisateur (fenêtres à part,
fiche 072) : non concernées.

## Parcours et états

Les numéros renvoient aux planches de la maquette.

| # | État | Ce que voit l'utilisateur |
|---|---|---|
| 0 | Aujourd'hui | Barre d'adresse : précédent, suivant, recharger, adresse, Annoter, Joindre. Rien pour la taille. |
| 1 | Barre repliée (défaut) | Un bouton « Appareil » (icône écran + téléphone, `MonitorSmartphone`) entre l'adresse et Annoter. Infobulle « Taille d'écran et thème ». Page à la largeur du panneau. |
| 2 | Barre ouverte, « Adaptatif » | Bouton enfoncé ; sous l'adresse, une barre de 36 px : `[Adaptatif ▾] [612] × [740] [rotation] ······ [Auto · Clair · Sombre]`. Les champs montrent la taille réelle de la zone, en gris (rotation grisée). La page est inchangée. |
| 3 | Menu d'appareils déroulé | Menu habituel de l'app (`.menu`) : Adaptatif, séparateur, huit appareils nommés avec leur taille en gris, coche sur le choix, ligne de bas de menu sur ce qui est imité. **Pendant que le menu est ouvert, la page se masque** (règle existante de la fiche 129 : un menu de l'app passe sur la page, la vue native le couvrirait) ; elle revient à la fermeture. |
| 4 | Appareil choisi | Ex. iPhone SE 375 × 667 : la page est rendue à 375 px de large, à 100 % si elle tient, centrée en haut, sur un fond gris (`--surface-2`, **nouveau** : aujourd'hui la page réduite par l'agent se perd sur le fond blanc de la zone, capture e2e `28z`) ; elle défile dans son cadre. Pas d'échelle affichée à 100 %. |
| 5 | Appareil plus grand que le panneau | Ex. iPad Pro 1032 × 1376 dans une zone de 558 × 689 : page réduite pour tenir, centrée ; « 50 % » en gris dans la barre (infobulle « Affichée à 50 % pour tenir dans le panneau »). Jamais coupée, jamais agrandie au-delà de 100 %. |
| 6 | Taille libre | Dès qu'un champ est modifié, le libellé passe du nom de l'appareil à « Taille libre » (ce n'est plus l'appareil nommé). Entrée ou sortie du champ appliquent. Saisie invalide : bord rouge, ligne « Entre 200 et 4 000 px. » sous la barre, la page garde la dernière taille valable. Dans le menu, « Taille libre » apparaît cochée sous la liste, avec sa taille ; choisir un appareil la remplace (planche 6c). |
| 7 | Rotation | Largeur et hauteur échangées (844 × 390) ; le libellé devient « iPhone 14, paysage » ; une taille libre se tourne de même. |
| 8 | Thème forcé | « Sombre » choisi : `prefers-color-scheme: dark` pour la page. Seule une page qui suit ce réglage change (dit dans l'infobulle du choix) ; l'interface de Bobine ne change pas. |
| 9 | Panneau étroit (≤ 420 px de barre) | Le thème passe en un bouton à icône qui ouvre un petit menu ; le nom de l'appareil se réduit à une icône avec chevron ; l'échelle passe dans l'infobulle des champs. À 280 px (minimum du panneau), tout tient sur une ligne, sans texte tronqué. |
| 10 | L'agent redimensionne pendant un réglage | Voir « Qui a la main ». La barre montre l'essai de l'agent en lecture seule (menu « Essai de l'agent » grisé, champs grisés à ses valeurs) et une ligne « L'agent essaie … · Reprendre la main » ; la puce existante reste dans l'adresse. |
| 11 | Panneau agrandi (⤢) | Même barre, plus de place : la page réduite reprend jusqu'à 100 % (l'échelle disparaît quand elle vaut 100 %). Ex. iPad mini, paysage, 1024 × 768. |
| — | Plusieurs onglets du navigateur | Le réglage vaut pour **tous les onglets de la conversation**, y compris ceux ouverts ensuite (lien « nouvel onglet », `browser_tabs new`). Une seule barre, sous le bandeau d'onglets. |
| — | Retour à « Adaptatif » | Choisir Adaptatif dans le menu, ou **refermer la barre** : la page reprend la largeur du panneau et le thème Auto. Rouvrir la barre rend le dernier réglage de la conversation. |

## Règles difficiles, tranchées

### Ouvrir, fermer : un interrupteur, pas d'état caché

La barre **est** le réglage : barre ouverte = réglage appliqué ; barre fermée = page à la largeur
du panneau et thème Auto (comme la barre d'appareil de Chrome). Ainsi aucune taille ni aucun thème
forcé n'est en vigueur sans être visible. Le bouton reste enfoncé tant que la barre est ouverte.

### Qui a la main (tranché, question 3)

Deux couches par onglet, calculées dans le main : **réglage de l'utilisateur** (pour la
conversation) et **essai de l'agent** (par onglet, comme aujourd'hui). Ce qui s'applique : l'essai
de l'agent s'il y en a un, sinon le réglage de l'utilisateur, sinon la largeur du panneau.

- **L'agent appelle `browser_resize` pendant que l'utilisateur a un réglage** : l'essai de l'agent
  s'applique (il doit pouvoir vérifier « en mobile » ce qu'on lui demande). La barre, si elle est
  ouverte, grise ses champs et montre les valeurs de l'agent avec une ligne « L'agent essaie
  768 × 1024 jusqu'à la fin de son tour · Reprendre la main » ; la puce de l'adresse reste
  (« 768 × 1024 », et « · sombre » quand il force le thème, nouveau). `desktop` de l'agent = essai
  « largeur du panneau », qui passe aussi devant le réglage.
- **À la fin du tour** : l'essai de l'agent s'efface (règle de la fiche 129 inchangée) et **le
  réglage de l'utilisateur revient tel quel**. Rien ne l'efface en dehors de l'utilisateur.
- **L'utilisateur touche la barre (ou clique la puce, ou « Reprendre la main ») pendant le tour** :
  l'essai de l'agent s'efface pour l'onglet, le réglage de l'utilisateur s'applique. L'utilisateur
  a toujours le dernier mot. L'agent n'en est pas prévenu sur le moment ; ses outils suivants
  lisent la taille réelle (`viewport()` relu à chaque appel), donc captures et clics restent justes.
- **L'agent ne voit pas la barre** et n'a pas d'outil pour la régler. `browser_resize` dit dans son
  résultat la taille appliquée (déjà le cas), et, si l'utilisateur avait un réglage, qu'il
  reviendra à la fin du tour (une phrase ajoutée au résultat, en anglais, non traduite : ADR-0014).

Variante écartée : le réglage de l'utilisateur prime et `browser_resize` est refusé tant que la
barre est ouverte. Raison : l'agent ne pourrait plus vérifier « en mobile » ce qu'on lui demande.

### Mémoire (tranché, question 4)

**Par conversation, en mémoire**, comme les onglets du navigateur eux-mêmes : changer de
conversation montre le réglage de celle-ci ; une branche (fiche 094, `inherit`) ne le reprend pas
(elle reprend la page, pas le réglage) ; **rien au redémarrage** de l'app (les pages ne sont pas
rouvertes non plus). Seule préférence gardée : aucune. Pas de nouvelle clé de réglages, pas
d'écriture sur le disque, donc rien à classer pour le profil en lecture seule hormis le canal IPC.

Écartés : par onglet (un lien « nouvel onglet » repartirait en largeur du panneau, surprenant) ;
global (une conversation sur une app de bureau hériterait du téléphone d'une autre) ; gardé au
redémarrage (état caché qui survit, ce que la fiche 129 a déjà retiré pour l'agent).

### Champs, bornes, clavier

- **Bornes** : entiers de **200 à 4 000** px, les mêmes que `browser_resize` (une constante
  partagée dans `src/shared/`, utilisée par l'outil et par l'IPC).
- **Saisie invalide** (vide, non numérique, hors bornes) : bord rouge, ligne d'erreur sous la barre
  (`role="alert"`), rien n'est envoyé ; la page garde la dernière taille valable. Décimales
  arrondies. Le main revérifie tout (l'IPC ne fait pas confiance au renderer).
- **Valeur collée** : « 390x844 », « 390 × 844 », « 390,844 » ou « 390 844 » collés dans l'un ou
  l'autre champ remplissent les deux ; tout autre texte collé suit la règle de saisie invalide.
- **Clavier** : Entrée applique ; Échap rend la dernière valeur appliquée et quitte le champ ;
  ↑ / ↓ ±1 et Maj+↑ / ↓ ±10, appliqués aussitôt ; Tab passe de la largeur à la hauteur. Sortie du
  champ : applique si valable, sinon rend la dernière valeur. Le menu et le choix du thème suivent
  le clavier des menus et des groupes de boutons de l'app.
- **Rotation** : échange largeur et hauteur, pour un appareil comme pour une taille libre ; grisée
  en Adaptatif.
- **Adaptatif** : les champs montrent la taille réelle de la zone (pixels CSS de la page), en gris,
  et suivent le panneau. Taper une valeur dans l'un passe en « Taille libre » : l'autre champ garde
  la taille de la zone à ce moment.
- **Type d'écran** (`mobile`) : vrai pour les téléphones et tablettes, faux pour portable et
  bureau ; une taille saisie ou tournée **garde le type de l'appareil d'où elle part**
  (taille libre partie d'Adaptatif : faux). Pas de choix « tactile » à part.

### Liste d'appareils (tranché, question 2 : noms d'appareils)

Choix de Jérôme, contre la recommandation de libellés génériques : la liste de sa capture, avec la
taille toujours affichée à côté du nom.

**Règle des valeurs (une seule source).** Chaque entrée reprend la taille, en **pixels CSS**, de
**l'entrée de même nom** de la liste d'appareils des outils de développement de Chrome
(`front_end/models/emulation/EmulatedDevices.ts`, dépôt ChromeDevTools/devtools-frontend, branche
`main`, lue le 2026-11-28). C'est la liste que les développeurs connaissent et contre laquelle ils
compareront. **Ces tailles sont celles de la liste de Chrome, pas celles du dernier modèle vendu
sous ce nom** (ex. l'entrée « iPad Mini » est la taille des iPad mini de 2019 et avant).

| Libellé (fr / en) | CSS (l × h) | `mobile` (tactile, `meta viewport`) | Densité (pour information, non appliquée) | Entrée DevTools exacte |
|---|---|---|---|---|
| iPhone SE | 375 × 667 | oui | 2 | `iPhone SE` |
| iPhone 14 | 390 × 844 | oui | 3 | `iPhone 14` |
| iPhone 14 Pro Max | 430 × 932 | oui | 3 | `iPhone 14 Pro Max` |
| Pixel 7 | 412 × 915 | oui | 2,625 | `Pixel 7` |
| iPad mini | 768 × 1024 | oui | 2 | `iPad Mini` |
| iPad Pro | 1032 × 1376 | oui | 2 | `iPad Pro 13` : la liste n'a **aucune** entrée nommée exactement « iPad Pro » (vérifié le 2026-11-28). C'est la seule entrée iPad Pro, donc la plus proche du nom. |
| Portable / Laptop | 1280 × 800 | non | 1 | `Laptop with MDPI screen` (donnée en 800 × 1280, sens portrait de la liste ; un portable s'affiche en paysage). Aucune entrée nommée « Laptop » seule. |
| Bureau / Desktop | 1920 × 1080 | non | 1 | Aucune entrée : valeur **conventionnelle** (Full HD). L'entrée la plus proche, `Laptop with HiDPI screen` (1440 × 900), est un portable : la prendre ferait de « Bureau » un second portable. |

Plus « Adaptatif » (en tête) et « Taille libre » (sous la liste, seulement quand une taille libre
est en vigueur). Le préréglage `tablet` de l'agent (768 × 1024) reste celui de l'agent : il n'est
pas dans le menu et n'est pas renommé.

**Ce qui se traduit** : les noms d'appareils, non (« iPhone 14 » en français comme en anglais).
« Portable » / « Laptop », « Bureau » / « Desktop », « Adaptatif » / « Responsive » et « Taille
libre » / « Custom size » sont des clés i18n.

**Règle d'entretien** (risque accepté par Jérôme : liste à tenir à jour, promesse d'un appareil
que Bobine n'émule pas vraiment) :

- **on suit l'entrée de même nom de la liste d'appareils de Chrome DevTools, relue à chaque
  version majeure** de Bobine ;
- la liste est une **donnée**, dans `src/shared/browser-devices.ts` : identifiant, nom, largeur,
  hauteur, `mobile`, et le nom exact de l'entrée DevTools suivie (`devtools`, absent pour
  « Bureau », marqué conventionnel). Aucun code ne dépend d'un appareil particulier ;
- elle reste **courte** (huit entrées au plus) ;
- **aucun appareil n'est ajouté sans son entrée DevTools**. Un essai unitaire vérifie que chaque
  entrée nomme son entrée (sauf « Bureau ») et reste dans les bornes (200 à 4 000 px) ;
- la ligne de bas de menu dit toujours la limite.

**Noms de produits de tiers.** Ils servent seulement à désigner un appareil : pas de logo, pas
d'icône de marque (l'icône générique `Smartphone` de Lucide), pas d'« officiel ». Proposition pour
la mention de marque, **à trancher par Jérôme** : `THIRD-PARTY-NOTICES.md` est généré
(`pnpm third-party-notices`, fiche 217) à partir des composants livrés et de leurs licences ; ce
n'est pas sa place, et un ajout à la main y serait écrasé. Le dépôt a déjà une section « Marques et
absence d'affiliation » dans `README.md` et `README.fr.md`. Proposé : y ajouter une phrase, en
anglais et en français (« iPhone, iPad and iPad mini are trademarks of Apple Inc.; Pixel is a
trademark of Google LLC. These names are used only to name the screen sizes the built-in browser
can imitate. »). Option en plus, non recommandée pour la 1.3 : la même mention dans Réglages ›
À propos (une clé i18n de plus).

### Ce que la fiche promet à l'utilisateur, sans survendre

La ligne en bas du menu d'appareils (et l'infobulle du bouton) dit : « Seule la taille de l'écran
est imitée, en tactile. Ce n'est pas le vrai appareil : même navigateur, densité de l'écran du
Mac. » Rien sur Safari, iOS ou Android.

## Architecture

- **Seul le main parle à la page.** Le renderer envoie un réglage ; le main le vérifie, le garde par
  conversation, et l'applique à chaque onglet par le CDP (`CdpTab.emulate`, `setColorScheme`,
  inchangés). Aucun nouveau pouvoir au renderer, `contextIsolation`, `sandbox` inchangés.
- **IPC typé** (fiche 114 : émetteur vérifié comme tous les canaux) : un seul nouveau canal
  `browser:setDevice(conversationId, device | null)`, `device = { width, height, mobile,
  colorScheme: 'light' | 'dark' | null, preset?: string }` (`preset` : identifiant de la liste, pour
  l'affichage). Analyse stricte dans `browser-ipc.ts` (entiers bornés, booléen, énumération), refus
  sinon. Classé **sûr** dans `read-only-guard.ts` (n'écrit rien). `browser:clearEmulation` garde
  son sens : efface l'essai de l'agent.
- **État** : `BrowserState` gagne `device?` (réglage de l'utilisateur), `colorScheme?` (thème en
  vigueur) et `agent?: { emulation?, colorScheme? }` (essai de l'agent, pour la barre et la puce),
  `emulation` restant la taille en vigueur avec son `scale`.
- **Moteur réutilisé** : `emulationFrame`, `cssViewport`, `frameOf` (recalcul de `scale` quand la
  zone change), `endAgentTurn` (qui n'efface plus que la couche de l'agent puis réapplique celle de
  l'utilisateur), pilote de l'agent (`browser-driver.ts` : coordonnées × `scale`, déjà juste sous
  émulation). Le choix « quelle couche s'applique » est une fonction pure dans `page-view.ts`,
  testée sans Electron. La liste d'appareils et l'analyse des tailles collées sont dans
  `src/shared/browser-devices.ts` (pur, testé).
- **Autorisations (fiches 072, 249)** : inchangées. Régler la taille ne navigue pas, ne lit pas la
  page, ne donne rien à l'agent ; l'accord par site, le blocage des popups de l'agent, les
  certificats (269) ne sont pas touchés. Sous un avertissement de certificat, la barre reste
  utilisable, l'avertissement s'affiche comme aujourd'hui.
- **Annoter (132, 146)** : marche déjà sous l'émulation de l'agent (`page-layer.ts` lit
  `cdp.emulation`) ; à revérifier avec le réglage de l'utilisateur (épingles à leur place sur une
  page réduite).
- **ADR-0078** (proposé) : remplace la ligne « Pas de menu de tailles pour l'utilisateur » de
  l'ADR-0026 et pose les deux couches (utilisateur, agent), la règle de fin de tour, la mémoire par
  conversation et les noms d'appareils avec leur limite.

## Critères d'acceptation

- [ ] Bouton « Appareil » dans la barre d'adresse ; barre repliée par défaut ; ouverte, elle montre
      menu, largeur × hauteur, rotation, thème ; fermée, la page reprend la largeur du panneau et
      le thème Auto.
- [ ] Choisir « iPhone 14 » : `innerWidth` de la page = 390, `innerHeight` = 844, la page est
      centrée en haut de la zone ; `matchMedia('(prefers-color-scheme: dark)')` suit le thème choisi.
- [ ] iPad Pro dans une zone plus petite : page entière, réduite, échelle affichée et juste (± 1 %) ;
      panneau agrandi : échelle recalculée, 100 % au plus, et elle disparaît à 100 %.
- [ ] Bornes : 199, 4 001, vide, « abc » refusés (rouge, message, page inchangée) ; « 390x844 »
      collé remplit les deux champs ; Entrée, Échap, ↑ / ↓, Maj+↑ / ↓ comme décrit.
- [ ] Rotation : 390 × 844 → 844 × 390, `innerWidth` = 844.
- [ ] Le réglage vaut pour un onglet ouvert ensuite ; changer de conversation montre le réglage de
      l'autre ; une branche ne le reprend pas ; rien n'en reste après un redémarrage.
- [ ] Agent pendant un réglage (scénario factice `navigateur-mobile`) : son essai s'applique, la
      barre le montre avec « Reprendre la main », la puce dit la taille (et « sombre » s'il force
      le thème) ; à la fin du tour le réglage de l'utilisateur revient exactement ;
      « Reprendre la main » pendant le tour efface l'essai tout de suite.
- [ ] Clics de l'agent justes sur une page réduite par le réglage de l'utilisateur (même essai que
      la fiche 129, à 150 % de zoom de la page aussi).
- [ ] Panneau à 280 px : la barre tient sur une ligne, aucun texte coupé, le menu ne déborde pas de
      la fenêtre.
- [ ] Profil en lecture seule : le réglage marche (canal classé sûr).
- [ ] Le main refuse un `browser:setDevice` mal formé (essai unitaire de `browser-ipc.ts`).
- [ ] **Essais** : unitaires (`page-view.test.ts` : couche en vigueur ; `browser-devices.test.ts` :
      liste, bornes, collage ; `browser-ipc` : analyse ; `browser-manager.test.ts` : fin de tour ;
      `BrowserTab` / barre : clavier, erreurs) ; e2e contre une **page locale servie par l'essai**
      (jamais un vrai site) qui affiche `innerWidth`, `innerHeight`, le thème et
      `'ontouchstart' in window` ; agent factice seulement ; **clair et sombre, français et
      anglais** (`--lang en`), captures regardées.
- [ ] Textes : aucun en dur, clés fr / en ci-dessous, glossaire respecté ; noms d'appareils identiques dans les deux langues.
- [ ] `browser-devices.test.ts` : chaque appareil nomme son entrée DevTools (sauf « Bureau », conventionnel) et reste dans les bornes.
- [ ] ADR-0078 accepté, statut de l'ADR-0026 mis à jour ; `docs/architecture.md` (ligne du navigateur), `CHANGELOG.md` et
      `CHANGELOG.en.md` à jour.

## Textes (clés i18n proposées)

| Clé | fr | en |
|---|---|---|
| `browser.device.button` | Taille d'écran et thème | Screen size and theme |
| `browser.device.responsive` | Adaptatif | Responsive |
| `browser.device.responsiveHint` | Largeur du panneau | Panel width |
| `browser.device.custom` | Taille libre | Custom size |
| `browser.device.landscape` | {{name}}, paysage | {{name}}, landscape |
| `browser.device.laptop` | Portable | Laptop |
| `browser.device.desktop` | Bureau | Desktop |
| `browser.device.size` | {{width}} × {{height}} | {{width}} × {{height}} |
| `browser.device.width` | Largeur (px) | Width (px) |
| `browser.device.height` | Hauteur (px) | Height (px) |
| `browser.device.rotate` | Tourner l'écran | Rotate the screen |
| `browser.device.invalid` | Entre {{min}} et {{max}} px. | Between {{min}} and {{max}} px. |
| `browser.device.scale` | {{percent}} % | {{percent}}% |
| `browser.device.scaleTip` | Affichée à {{percent}} % pour tenir dans le panneau | Shown at {{percent}}% to fit the panel |
| `browser.device.theme` | Thème de la page | Page theme |
| `browser.device.themeAuto` | Auto | Auto |
| `browser.device.themeLight` | Clair | Light |
| `browser.device.themeDark` | Sombre | Dark |
| `browser.device.themeTip` | Seules les pages qui suivent le thème du système changent | Only pages that follow the system theme change |
| `browser.device.honest` | Seule la taille de l'écran est imitée, en tactile. Ce n'est pas le vrai appareil : même navigateur, densité de l'écran du Mac. | Only the screen size is imitated, as a touch screen. It is not the real device: same browser, your Mac's pixel density. |
| `browser.device.agent` | L'agent essaie {{size}} jusqu'à la fin de son tour | The agent is trying {{size}} until the end of its turn |
| `browser.device.takeBack` | Reprendre la main | Take over |
| `browser.device.agentLabel` | Essai de l'agent | Agent's test |
| `browser.emulation.chipTheme` | {{width}} × {{height}} · {{theme}} | {{width}} × {{height}} · {{theme}} |

« Adaptatif / Responsive », « Clair / Light », « Sombre / Dark » : glossaire (thème clair, sombre).
« Mac » dans `browser.device.honest` : sous Linux et Windows, variante « de votre écran » (fiche 145,
même règle que les textes du Finder). Les noms d'appareils ne sont pas des clés i18n : ils viennent
de `shared/browser-devices.ts`, identiques dans les deux langues.

## Questions pour Jérôme — tranchées le 2026-11-28

Réponses de Jérôme par questions interactives, après huit planches de la maquette ; aucun retour
sur le reste de la maquette.

1. **Où vit la barre ?** — « Derrière un bouton (Recommandé) ». Écartée : barre toujours visible
   (37 px de page en moins pour tout le monde, interface chargée).
2. **La liste d'appareils ?** — « Noms d'appareils », contre la recommandation. Écartés : libellés
   génériques (« Téléphone 390 × 844 »), plus honnêtes et sans entretien, mais Jérôme veut
   reconnaître ses appareils. Risque accepté et traité plus haut : règle d'entretien, taille
   toujours affichée, ligne de bas de menu.
3. **Qui a la main ?** — « L'agent pendant son tour (Recommandé) ». Écartée : réglage de
   l'utilisateur prioritaire et `browser_resize` refusé (l'agent ne pourrait plus vérifier « en
   mobile »).
4. **Mémoire ?** — « Par conversation, jusqu'à la fermeture (Recommandé) ». Écartée : retenu sur le
   disque (clé d'historique, profil en lecture seule à traiter, page en téléphone au lancement sans
   qu'on s'en souvienne).

Reste à trancher par Jérôme : la **mention de marque** (proposition dans « Liste d'appareils ») et
l'**acceptation de l'ADR-0078**.

## Plan

Maquette et quatre réponses arbitrées le 2026-11-28 ; rien n'est codé avant l'acceptation de l'ADR-0078. Seule la liste d'appareils a changé depuis la première version du plan.

| Lot | Contenu | Fichiers | Taille |
|---|---|---|---|
| 0 | Sonde (Electron du dépôt, page locale) : `pointer` / `hover` sous `setTouchEmulationEnabled`, changement de réglage pendant un `browser_resize`, Annoter sur page réduite ; liste relue contre DevTools. ADR-0078 accepté (statut de l'ADR-0026 mis à jour). | script jetable, `docs/adr/` | ½ jour |
| 1 | Moteur : liste et bornes partagées ; deux couches par onglet, couche en vigueur (pure) ; `endAgentTurn` qui rend le réglage ; nouveaux onglets ; `BrowserState` (`device`, `colorScheme`, `agent`) ; canal `browser:setDevice` (analyse, garde lecture seule, préload) ; phrase du résultat de `browser_resize` | `shared/browser.ts`, `shared/browser-devices.ts` (nouveau : la liste et ses sources), `shared/browser-ipc.ts`, `main/browser/page-view.ts`, `browser-manager.ts`, `browser-controller.ts`, `browser-setup.ts`, `browser-ipc.ts`, `browser-tools.ts`, `cdp-tab.ts` (rien, sauf si la sonde l'exige), `read-only-guard.ts`, `preload/api.ts` + essais | ≈ 350 lignes + 300 d'essais |
| 2 | Interface : bouton, `DeviceBar.tsx` (nouveau ; `BrowserTab.tsx` est à 520 lignes, plafond 800), menu, champs, thème, repli étroit (requêtes de conteneur), ligne de l'agent, puce « · sombre » ; clés fr / en ; styles | `components/panel/DeviceBar.tsx`, `BrowserTab.tsx`, `styles.css`, `locales/fr.json`, `en.json` + essais | ≈ 300 lignes + 150 d'essais |
| 3 | e2e : page locale de mesure, suite `browser-device` (ou extension de `browser-view`), scénario factice existant `navigateur-mobile` réutilisé, clair / sombre, fr / en ; captures regardées. Docs : architecture, CHANGELOG fr / en, `docs/mock-agent.md` si scénario | `e2e/suites/…`, `docs/` | ≈ 250 lignes |

**Taille estimée** : 2 à 3 jours de développement et d'essais (lots 0 à 3), ≈ 650 lignes de code et
≈ 700 d'essais. **Dépendances nouvelles : aucune** (lucide-react a déjà `MonitorSmartphone`,
`RotateCcwSquare`, `Sun`, `Moon`, `Contrast` ; menus Radix déjà dans l'app).

**Risques de régression** (le navigateur en a déjà coûté) :

- **Pose de la vue native** (fiche 129 : page coupée, vue décalée au zoom de l'interface, suivi par
  `ResizeObserver`) : une barre de plus au-dessus de la zone déplace la zone ; ouvrir / fermer la
  barre doit relancer la pose. Essai : vue exacte avant / après, interface à 80 et 150 %.
- **Fin de tour** (fiche 129) : aujourd'hui tout est effacé ; demain seule la couche de l'agent.
  Un oubli laisse un état caché, ou efface le réglage. Essai dédié, plusieurs onglets.
- **Menus sur la page** (fiche 129 et seconde chasse rc.4) : le menu d'appareils masque la page
  pendant qu'il est ouvert ; il doit revenir exactement (suivi de 20 images existant). Les
  infobulles de la barre s'ouvrent **vers le haut** : vers le bas, la vue native les couvrirait
  (elle est posée par-dessus l'interface, ADR-0026).
- **Clics de l'agent sous `scale`** (fiche 129, sonde : le CDP attend des coordonnées × `scale`) :
  inchangé, mais à revérifier quand la réduction vient du réglage de l'utilisateur.
- **Annoter** (fiches 132, 146) et **certificats** (fiche 269 : la vue laisse place à
  l'avertissement) : revérifiés avec une taille réglée.
- **Molette et défilement** (fiche 129, worktree `browser-view-molette`) : la page réduite doit
  défiler jusqu'en bas ; essai existant de `browser-view` repris avec le réglage.

## Journal

- 2026-11-28 : fiche et maquette (BA / UX). Relevé du code à `34f9f5be` ; captures « avant » par la
  suite e2e `browser-view` (agent factice, page locale). Rien de codé ; en attente des réponses de
  Jérôme et de la validation de la maquette.
- 2026-11-28 : réponses de Jérôme aux quatre questions (barre derrière un bouton, noms d'appareils,
  l'agent pendant son tour, par conversation jusqu'à la fermeture). Maquette ramenée à une seule
  forme, sans les variantes écartées ; liste par noms d'appareils, avec sources et règle
  d'entretien ; « Taille libre » dès qu'un champ change (planche 6c) ; ADR-0078 proposé ; captures
  « avant » en sombre ajoutées. Rien de codé.
- 2026-11-28 : relecture du tech lead : une seule source, l'entrée de même nom de la liste de
  Chrome DevTools. iPad mini passe à 768 × 1024 (entrée `iPad Mini`) au lieu de la valeur dérivée
  de la fiche Apple. Pour iPad Pro, la liste n'a pas d'entrée « iPad Pro » : on garde `iPad Pro 13`
  (1032 × 1376), la seule entrée de ce nom. Bureau reste conventionnel. Captures du menu et du
  panneau agrandi refaites.
