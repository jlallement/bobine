# 186 — Aide intégrée

- **Statut** : fait (bonus non faits : outil MCP de recherche dans l'aide, palette ⌘K)
- **Dépend de** : 041 (menu Aide), 162 (Nouveautés dans les réglages), 165 (outils MCP de l'app,
  pour le bonus)
- **Agents** : les deux. L'aide décrit Bobine, pas un agent ; les pages sur une fonction propre à
  un agent le disent, comme Réglages › Agents (ADR-0011).

## Pourquoi

Bobine a beaucoup grandi :
- worktrees et leur préparation ;
- conversations filles et fusion ;
- « Faire relire » ;
- suivi des PR ;
- tâches planifiées ;
- aparté ;
- plusieurs dossiers.

Beaucoup de ces fonctions ne se devinent pas seules. Pourtant, il n'existe **aucun guide pour
l'utilisateur** : `docs/` ne parle qu'aux développeurs (architecture, ADR, fiches), et le menu Aide
n'ouvre que le journal. L'utilisateur veut une documentation embarquée, avec une recherche
(demande du 2026-11-06), plutôt que seulement GitHub. Une aide dans l'app sert au moment où l'on
bloque. Elle marche aussi hors ligne et décrit la version installée, pas la dernière publiée.

## Décisions déjà prises (avec l'utilisateur, 2026-11-06)

- **Une seule source** : des pages Markdown dans le dépôt, `docs/guide/fr/` et `docs/guide/en/`.
  - GitHub les affiche tel quel : la version web ne coûte rien.
  - Les mêmes fichiers sont embarqués dans l'app au build.
- **Une fenêtre ou un panneau d'aide dans l'app** (menu Aide › Aide de Bobine, ⌘?). Il offre :
  - un sommaire et une recherche instantanée, hors ligne ;
  - une page « Raccourcis clavier » ;
  - un lien vers les Nouveautés (fiche 162).
- **Des liens « ? » discrets** là où ça aide, qui ouvrent la bonne page à la bonne section. Par
  exemple : carte « Préparation du worktree », dialogue « Faire relire », page des tâches
  planifiées, Réglages.
- Prévue pour la **0.10**, à côté de la mémoire commune (fiche 182).

## Critères d'acceptation

- [x] Guide en fr et en, pour au moins ces pages :
  - premiers pas ;
  - conversations et permissions ;
  - modes et modèles ;
  - worktrees (préparation comprise) ;
  - conversations filles et fusion ;
  - « Faire relire » ;
  - suivi des PR et de la CI ;
  - tâches planifiées ;
  - aparté ;
  - plusieurs dossiers ;
  - panneaux (navigateur, terminal, simulateur) ;
  - réglages, confidentialité et données ;
  - agents (IBM Bob, OpenCode) ;
  - dépannage, dont « connexion d'OpenCode expirée » (D10 de la fiche 183) ;
  - raccourcis clavier.
- [x] Aide ouverte par le menu Aide et ⌘?, dans la langue de l'interface, en clair et en sombre.
- [x] Recherche : résultats pendant la frappe, mots soulignés dans l'extrait, ouverture à la
      section, au clavier seul. Elle marche hors ligne.
- [x] Liens « ? » contextuels sur les écrans listés, ouvrant la bonne ancre.
- [x] Les liens internes des pages marchent dans l'app et sur GitHub.
- [x] La page des raccourcis est **générée** depuis les raccourcis réels du menu et de l'app, ou
      vérifiée par un essai : elle ne peut pas mentir.
- [x] Un essai vérifie que chaque page existe en fr et en en, que les liens et ancres sont
      valides, et que chaque lien « ? » de l'interface vise une ancre existante.
- [x] Sécurité : rendu Markdown sans HTML brut ni script. Les liens externes s'ouvrent dans le
      navigateur du système. Le renderer reste isolé (pas d'accès disque, pages passées par
      l'IPC ou par le build).
- [x] Captures : quelques images d'écran dans les pages, régénérables par les essais e2e, pour
      ne pas vieillir sans qu'on le voie.
- [x] Testé par une suite e2e `aide` : ouverture, recherche, lien « ? », clair et sombre, fr et en.

## Bonus (à décider pendant le plan)

- Un outil de l'app (serveur MCP de Bobine, fiche 165) qui permet à l'agent de chercher dans
  l'aide, pour répondre à « comment je fais X dans Bobine ? ». C'est générique : il ne dépend pas
  de l'agent.
- Une recherche dans l'aide depuis la palette de commandes, si elle existe.

## Questions ouvertes

- Fenêtre à part ou panneau de droite ? Une fenêtre à part peut rester ouverte à côté. Un panneau
  est plus léger.
- Moteur de recherche : index fait maison au build, ou petite dépendance ? Une dépendance doit
  être mentionnée ici, et justifiée par un ADR si elle est structurante.
- Qui écrit et relit les pages ? Le contenu en français vient en premier ; l'anglais suit le
  glossaire de `docs/traduction.md`.
- Comment garder le guide à jour ? Proposition : la définition de « fini » d'AGENTS.md gagne une
  ligne : « si l'utilisateur voit la différence, la page du guide est à jour ».

## Plan

À écrire avant de coder la fenêtre d'aide (proposée par une session d'expertise UX).

**Contenu du guide (fait en premier, sans code de l'app).**

- 16 pages dans `docs/guide/fr/`, puis les mêmes noms dans `docs/guide/en/` : `README.md`
  (sommaire), `premiers-pas`, `conversations`, `modes-et-modeles`, `worktrees`,
  `conversations-filles`, `faire-relire`, `suivi-pr-ci`, `taches-planifiees`, `aparte`,
  `plusieurs-dossiers`, `panneaux`, `reglages`, `agents`, `depannage`, `raccourcis`.
- **Ancres stables** : `<a id="…"></a>` juste avant chaque titre de section, en ASCII, les mêmes
  en français et en anglais. Les liens « ? » viseront `page.md#ancre`, quelle que soit la langue.
  GitHub les accepte ; le rendu de l'app devra reconnaître cette seule balise (le reste du HTML
  brut reste refusé, voir la sécurité plus haut).
- Liens internes relatifs, vers ces ancres seulement.
- `scripts/guide.test.ts` (dans `pnpm test`, donc dans `verify`) : mêmes pages et mêmes ancres
  dans chaque langue présente, pas d'ancre en double, chaque lien relatif vise un fichier qui
  existe et une ancre de ce fichier (images comprises).
- Captures en thème clair dans `docs/guide/images/<langue>/`, faites par
  `pnpm build && node e2e/guide-captures.mjs [--lang en]`, contre l'agent factice : à relancer
  quand l'interface montrée change.

**À faire ensuite.**

- La page `raccourcis.md` est écrite à la main depuis `src/shared/shortcuts.ts`,
  `src/shared/quick-entry.ts`, `src/main/menu.ts`, `composer-keys.ts` et
  `src/main/browser/page-view.ts`. Elle doit être **générée** depuis ces sources, ou vérifiée par
  un essai (critère d'acceptation) : sinon elle mentira au premier raccourci changé.
- Les libellés cités viennent des fichiers de langue au 2026-11-06 ; l'audit UX de la 0.9.1 peut
  en changer : un essai pourrait vérifier que les textes en gras du guide existent encore dans
  `fr.json` / `en.json`.

**Fenêtre d'aide (2026-11-07, maquette validée `ux-0-9-1/aide/aide-options`, option c).**

- **Fenêtre à part, non modale**, habillée comme les Réglages : sommaire à gauche (groupes
  Commencer / Travailler / Référence, titres `##` du `README.md` du guide), recherche en tête
  (⌘?), page à droite avec un fil d'Ariane. Posée **collée à droite** de la fenêtre principale
  s'il y a la place sur l'écran, sinon par-dessus son bord droit. Une seule : un nouvel appel la
  ramène et la mène à la bonne ancre. Page `#help` du même renderer, préférences durcies
  communes (`renderer-windows.ts`), comme la fenêtre À propos (fiche 116) : `main/help-window.ts`.
- **Contenu embarqué au build** : `import.meta.glob` des `docs/guide/<langue>/*.md` (texte brut)
  et des images, en morceaux chargés par la seule fenêtre d'aide. Le renderer ne lit pas le
  disque, aucune IPC pour le contenu.
- **Rendu** : `react-markdown` + `remark-gfm` (déjà là), `skipHtml`, et un petit greffon
  maison qui ne garde du HTML brut que `<a id="…"></a>` (posé en `id` sur le titre suivant).
  Liens : `page.md#ancre` et `#ancre` naviguent dans l'aide ; `../en/…` change de langue ;
  le CHANGELOG ouvre Réglages › Nouveautés ; les autres fichiers du dépôt et les `http(s)`
  partent dans le navigateur du système (`setWindowOpenHandler`, http(s) seulement) ; tout le
  reste est désactivé. Images : seulement celles du guide embarquées.
- **Recherche maison** (`renderer/src/help/search.ts`, pas de dépendance) : index des sections
  (titre, texte sans Markdown), mots sans accents ni casse, tous les mots doivent être trouvés,
  titre avant texte ; extrait autour du premier mot, mots surlignés. ↑↓ ↩ Échap, ⌘[ ⌘]
  historique. Les mots cherchés sont aussi surlignés dans la page ouverte (CSS Custom
  Highlight, sans toucher au DOM).
- **IPC** : `help:open` (renderer principal → main : page, ancre), `help:target` (la fenêtre
  d'aide demande sa cible au chargement), évènements `help:navigate` et `help:focusSearch`
  vers la seule fenêtre d'aide, `help:showChangelog`.
- **⌘?** : nouvelle entrée de `SHORTCUTS` (menu Aide, commande `help`), traitée par le main ;
  quand l'aide a déjà le focus, ⌘? va dans la recherche.
- **Liens « ? »** : composant `HelpLink` (icône `CircleHelp` 14 px, `--muted`, infobulle
  « Aide : <section> », Tab puis ↩), et `HelpFooterLink` (« Comment ça marche », en bas à gauche
  d'un dialogue). Cibles déclarées dans `shared/help-topics.ts` ; un essai vérifie que chacune
  vise une page et une ancre qui existent dans chaque langue. Écrans : préparation du worktree,
  dialogue « Faire relire », page des tâches planifiées, aparté, sections des Réglages.
- **Raccourcis** : `pnpm guide-shortcuts` réécrit les tableaux « Raccourcis des menus » et « Dans
  la zone de saisie » de `raccourcis.md` (fr, en) depuis `buildMenuTemplate` et
  `INTERFACE_SHORTCUTS`, entre deux commentaires `<!-- raccourcis:… -->` ; un essai échoue si la
  page n'est plus à jour : elle ne peut pas mentir, ni sur GitHub ni dans l'app.
- Bonus (outil MCP, palette ⌘K) : pas dans ce lot.

## Journal

- 2026-11-06 — Fiche ouverte à la demande de l'utilisateur. Une seule source Markdown, embarquée
  et lisible sur GitHub. Prévue pour la 0.10.
- 2026-11-06 — **Guide en français écrit** (`docs/guide/fr/`, 16 pages), sans code de l'app.
  Chaque fonction décrite a été vérifiée dans le code, les fichiers de langue et les fiches (075 à
  180), et les écrans des captures ont été vus dans l'app avec l'agent factice. Cinq captures :
  accueil, demande d'autorisation, aparté, préparation d'un worktree, tâches planifiées. Essai des
  liens et ancres : `scripts/guide.test.ts`. Écarts au plan : la page « Conversations et
  permissions » s'appelle « Conversations et autorisations » (glossaire) ; les ancres sont des
  `<a id>` explicites, pour être les mêmes dans les deux langues. Les captures montrent l'agent
  factice (« Agent factice », « Factice rapide ») : c'est le seul agent possible dans les essais.
  Reste : la traduction anglaise, après relecture du français.
- 2026-11-06 — Français relu par le tech lead : « Conversations et autorisations » gardé
  (glossaire) ; `opencode auth login` à la main tant que D10 n'est pas corrigé (page Dépannage à
  reprendre ensuite). Fenêtre d'aide décidée avec l'utilisateur : une fenêtre à part, comme les
  Réglages, ouverte à côté de la principale, ⌘? pour chercher, petits « ? » gris ; les ancres
  `<a id>` lui conviennent.
- 2026-11-06 — **Guide en anglais écrit** (`docs/guide/en/`, mêmes 16 fichiers, mêmes ancres),
  libellés tirés de `en.json` par la même clé que le français, glossaire de `docs/traduction.md`.
  Les libellés propres à un agent (« Allow once », « Session Mode »…) restent tels quels. Captures
  anglaises par `--lang en` ; le dossier d'exemple s'appelle `my-project` en anglais. Deux
  libellés faux du français corrigés au passage : Réglages › Serveurs MCP › **Outils de Bobine**
  (pas « Bobine »), et « Supprimer » sans points de suspension dans le menu « … » d'une tâche
  planifiée. Constat de plus : en anglais, une tâche dit « Monday to Friday at 09:00 » (24 h) à
  côté de « Nov 9, 2026, 9:00 AM » (12 h). Après la 0.9.1 (onglets du panneau, notes des réglages,
  états vides, carte de PR — D20), une passe de retouche sur les deux langues.

### Ce qui a semblé faux ou déroutant en écrivant le guide

Constats pour l'audit UX ; aucun n'est corrigé ici.

**Textes et libellés**
- Avec IBM Bob, les boutons d'autorisation sont ceux de Bob, en anglais (« Allow once », « Always
  allow », « Reject »), dans une carte en français ; la note cite « Always allow », et
  Réglages › Confidentialité parle de « Toujours autoriser », que l'utilisateur de Bob ne voit
  jamais.
- Pluriel faux : « Fusionner les 1 quand même » (`childrenMerge.recommended.confirmAction_one`).
- Export d'une relecture : « Relecture « Relecture : X » : N remarques » ; une relecture en cours
  s'exporte « 0 remarques ».
- Les remarques de relecture envoyées à l'agent sont toujours en français, même interface en
  anglais (`shared/diff-notes.ts`).
- « Où en était-on ? » titre deux écrans différents : le dialogue « Reprendre une session… »
  (⇧⌘O) et la carte de reprise d'une conversation.
- « Ouvrir un terminal ici » ouvre le terminal de Bobine depuis le menu du dossier, mais
  Terminal.app de macOS depuis la carte « Dossier non approuvé ».
- « Relancer » veut dire redémarrer l'agent (page d'un agent) et refaire les vérifications
  (Diagnostic).
- Réglages › Données a deux titres « Historique » (sauvegarde, et remise à zéro de la
  consommation) ; en anglais, « Reset… » sert à la consommation et à « Reset Bobine » sur la même
  page.
- Le nom du mode de Bob est « Mode » en dur (`session-controls.ts`), ceux d'OpenCode sont bruts
  (« Session Mode », « Model », « Effort », `build`) ; l'aide du mode Plan dit « Maj+Tab pour
  passer en build ».
- « Toujours demander » (Proposer des conversations filles) trompe : toute proposition passe déjà
  par la carte ; le réglage dit seulement à l'agent d'en proposer plus. « Jamais » n'empêche pas
  les propositions.
- `worktreeSetup.copiedNone` « Aucun fichier de .worktreeinclude à copier » se lit « fichier
  absent », alors qu'il veut dire « aucun fichier ne correspond ».
- « Pousser vers la PR » affiche « Poussée de la branche et création de la PR… » pendant la
  poussée.
- Le coût par exécution d'une tâche planifiée a quatre décimales (« ≈ 0,4567 $US »).
- Onglet Session d'un worktree : « Dossier » montre le nom du dossier du worktree
  (`20261106-1802-a128`), pas le projet.
- Anglais : « My activity » dans le menu Fenêtre (pas en Title Case) ; guillemets français dans
  `diagnostics.reportIssueTruncated` (« Copy report ») ; « off » / « disabled » et « Keychain » /
  « keychain » varient ; le préfixe « Terminal N (titre) : » d'« Ajouter au message » est en dur,
  avec l'espace française, dans les deux langues.
- Français : « Réglages → Agents » (flèche) dans `blocker.auth.keyHint`, « › » partout ailleurs ;
  `toolCall.permission.rememberNote` dit « révocable dans les réglages » sans dire où.
- macOS : le français dit « Enregistrement de l'écran », l'anglais le nom récent « Screen & System
  Audio Recording » ; à vérifier sur macOS 15 et plus.

**Comportements qui surprennent**
- Connexion d'OpenCode expirée (D10 de la fiche 183, toujours ouvert) : erreur brute en anglais,
  l'agent reste « Prêt », aucune étape « Se connecter dans le terminal ». Le guide donne
  `opencode auth login` à la main.
- « Ajouter au fil » ferme l'aparté : pas de question de suite possible après.
- La case « Joindre l'échange récent » renvoie l'extrait à chaque question de l'aparté ; le coût
  d'un aparté n'est pas compté pour un agent qui ne donne que des jetons.
- « Fusionner quand tout est vert » refuse aussi quand une relecture est seulement demandée
  (`review-required`) ; rien ne dit pourquoi la fusion ne part pas. Les deux cases du suivi de PR
  sont perdues au redémarrage.
- `gh` : son état est gardé 5 min ; après `gh auth login`, « pas connecté » reste affiché. Le
  message « gh introuvable » ne parle pas de « Relire le PATH ».
- `.bobine/worktree.json` ignore sans rien dire une liste, une valeur qui n'est pas une chaîne,
  une autre clé ou un JSON invalide. `setup` tourne à la racine du worktree, pas dans le
  sous-dossier de la conversation. Un motif `node_modules/` dans `.worktreeinclude` atteint vite
  le plafond de 5 000 fichiers.
- La commande `archive` n'est pas lancée par le nettoyage des worktrees orphelins, ni pour un
  worktree intact supprimé à la fermeture.
- Une relecture lancée depuis la vue Filles de la mère pose sa carte et ses remarques dans la
  fille : rien dans la mère, sauf une ligne de plus.
- Les relecteurs comptent comme des filles (vue Filles, plafond), sans branche.
- « Lancer en parallèle… » est caché dans certains cas (fille, brouillon, archivée) et grisé dans
  d'autres (hors git, plafond).
- Tâches planifiées : la case « nouveau worktree » ne vérifie pas que le dossier est un dépôt git
  (échec plus tard, « Lancement impossible ») ; « Plafond des réglages » s'affiche même quand un
  plafond est saisi dans l'autre unité ; 5 exécutions montrées sur 20 gardées, sans « voir
  plus » ; Modifier et Supprimer restent possibles pendant une exécution ; le bouton Pause /
  Reprendre a la même icône dans les deux états.
- Plusieurs dossiers : la ligne « Autres dossiers » n'apparaît qu'agent démarré ; ajouter un
  doublon ou le dossier de travail ne fait rien, sans rien dire ; un dossier disparu reste listé
  sans avertissement.
- Les liens `*.test` s'ouvrent dans le navigateur du Mac, alors que Bobine les traite ailleurs
  comme locaux.
- Rien ne distingue, dans le terminal, les onglets de l'agent des vôtres.

**Difficile à trouver**
- « Faire relire… », « Annoter la page » et « Joindre cette page au message » ne sont que des
  icônes ; « Faire relire… » disparaît quand la vue Filles est choisie.
- L'aparté n'a pas de bouton : seulement `/btw`, ⇧⌘A et le menu.
- « Puis nettoyer » ressemble à un bouton, c'est un interrupteur.
- Le dialogue « Faire relire » promet « Agent et modèle … à confirmer ou changer » même avec Bob
  (pas de modèle), et le CHANGELOG annonce un coût affiché que le dialogue ne montre pas.

**Documents en retard sur l'app**
- Fiche 110 et CHANGELOG 0.4 : les worktrees orphelins sont dans Réglages › Données, plus dans
  « Agents et dossiers ».
- Fiches 097, 118 et CHANGELOG 0.5 : « Réglages › Conversation » est devenu « Conversations » ;
  l'erreur envoyée à l'agent dit encore « Settings › Conversation ».
- CHANGELOG : « Réglages › À propos » est devenu « Nouveautés ».
- `docs/installation.md` ne décrit la licence de Bob que dans un terminal ; Bob 2.0.9 la demande
  aussi par un formulaire au premier message.
- Cette fiche disait que le menu Aide n'ouvre que le journal : il a aussi Raccourcis clavier (⌘/)
  et Diagnostic…. Le ⌘? prévu pour l'aide est ⇧⌘/ sur un clavier américain, tout près de ⌘/.

- 2026-11-07 — **Fenêtre d'aide faite** (plan ci-dessus, maquette `ux-0-9-1/aide/aide-options`,
  option c). Aide › Aide de Bobine (⌘?) ouvre une fenêtre à part, non modale, posée à droite de la
  fenêtre principale s'il y a la place, sinon contre le bord droit de l'écran ; une seule, ramenée
  et menée à la bonne ancre par chaque appel. Guide embarqué au build (`import.meta.glob`, un
  morceau chargé par la seule fenêtre d'aide) ; rendu `react-markdown` + `remark-gfm` avec
  `skipHtml` et un greffon qui ne lit que `<a id>` ; liens résolus un à un (`help/links.ts`) :
  aide, autre langue, Nouveautés, GitHub ou `http(s)` dans le navigateur du système, le reste
  désactivé ; images du guide seulement. Recherche maison (`help/search.ts`, aucune dépendance),
  mots surlignés aussi dans la page ouverte (CSS Custom Highlight). Liens « ? » : préparation du
  worktree, dialogue « Faire relire » (« Comment ça marche », en bas à gauche), page des tâches
  planifiées, aparté, Réglages › Confidentialité (deux sections), Données, Agents ; cibles dans
  `shared/help-topics.ts`, vérifiées dans les deux langues par `help/guide.test.ts`. Page des
  raccourcis **générée** : `pnpm guide-shortcuts` réécrit ses deux tableaux depuis
  `buildMenuTemplate` et `INTERFACE_SHORTCUTS` (`scripts/guide-shortcuts.test.ts` échoue si elle
  n'est plus à jour) ; `INTERFACE_SHORTCUTS` gagne ↑ (reprendre le message en attente) et « 1 à
  9 » traduit. Titres du sommaire du README renommés Commencer / Travailler / Référence, comme la
  maquette. Suite e2e `aide` (fr et en, clair et sombre) : ouverture et place de la fenêtre,
  recherche au clavier seul, image, lien externe, « ? » des Réglages. Pour tenir les plafonds de
  lignes (fiche 089) : `main/secondary-windows.ts` (À propos et aide sortis d'`index.ts`),
  `renderer/plan-badges.ts` et `useActiveQuota` sortis d'`App.tsx`.
  **Écarts à la maquette** : l'indication « ↑↓ résultats · ↩ ouvrir · Échap effacer » est au pied
  de la page pendant une recherche (comme la maquette sombre) ; la fenêtre a une largeur minimale de
  640 px au lieu d'un sommaire replié en menu en dessous ; le fil d'Ariane n'apparaît pas sur
  l'accueil et ne répète pas un nom de page identique à son groupe. Bonus (outil MCP, palette)
  non faits. À voir : la définition de « fini » d'AGENTS.md pourrait gagner « la page du guide est
  à jour » (question ouverte, pas tranchée ici).
- 2026-11-07 — **Essai réel avec OpenCode** (profil temporaire, modèle gratuit « Beam Free »,
  trois échanges) : pendant un tour, le texte tapé dans la saisie fait paraître l'astuce de
  l'aparté au bout de 2 s ; « Essayer » pose la question en aparté, qui répond
  (`git log -1 --oneline`) pendant que le tour principal continue et finit normalement ; l'aide
  ouverte pendant la conversation cherche (« aparté » : 9 résultats) sans rien gêner ; un second
  message reçoit sa réponse (« OK. »), aucune erreur ; l'astuce de l'aparté est ensuite masquée
  pour toujours (fonction utilisée). Captures `oc-aide-*` dans `nuit-0-10/aide/` (notes de
  session). Le calme des deux minutes était ramené à zéro pour l'essai (`BOBINE_TIPS_QUIET_MS`).
- 2026-11-07 — **Verdict de l'expert UX** (`nuit-0-10/aide/VERDICT-expert-ux.md`) : écarts acceptés,
  six défauts corrigés. Le résultat choisi (↑↓) est affiché aussitôt, défilé au premier mot
  surligné, sans entrer dans l'historique ; une section de la page qui porte le mot passe devant ;
  l'accueil n'est plus un résultat ; espaces insécables du français avant « : ; ? ! » dans les
  pages, titres et extraits (`frenchSpaces`, tiré de la typographie de l'app) ; champ
  « Rechercher » ; lignes réservées à GitHub (`<!-- hors-app -->`, le lien vers l'autre langue)
  retirées dans l'app ; blocs de code du fil (`CodeBlock`, bouton « Copier »). Fenêtre jamais hors
  de l'écran : essai sur 1280 × 800 et plusieurs écrans. Suite e2e `aide` : ↑↓ change la page,
  mot surligné visible, Copier, accueil sans lien brut.
- 2026-11-07 — **Relecture du tech lead**, corrigé (chacun avec son essai) : la cible initiale est lue
  une seule fois (changer de langue gardait la page initiale) ; deux demandes avant que la page ne
  soit prête : la seconde remplace la cible en attente (`targetRead`), et les suivantes vont à la
  seule fenêtre d'aide (`webContents.send`, plus de `broadcast`) ; titres et textes repliés une fois
  au chargement du guide, anti-rebond de 100 ms sur la frappe (↩ cherche tout de suite) ;
  `decodeURIComponent` protégé ; `HelpWindow` et `help.css` chargés à la demande (`lazy`, hors du
  morceau principal). **API réduite** pour la fenêtre d'aide : le main pose `--bobine-view=help`
  (`shared/window-view.ts`), le preload n'expose alors que `helpViewApi` (langue, apparence,
  erreurs, aide, réglages en lecture) ; avec `contextIsolation`, la page ne peut rien appeler
  d'autre. Reste possible plus tard : refuser aussi côté main les autres canaux venant de cette
  fenêtre (défense en profondeur, pas nécessaire tant que le preload ne les expose pas).
- 2026-11-07 — **Seconde relecture** : type `HelpViewApi`, et un essai qui ouvre la vue d'aide avec
  la seule `helpViewApi` (seuls `help:target` et `settings:get` sont appelés) ; surlignage et
  résultats suivent la recherche faite (après l'anti-rebond), plus chaque touche ; la page ouverte
  est gardée pour la fenêtre (`sessionStorage`) : « Recharger » depuis l'écran d'erreur y revient.
- 2026-11-07 — **Recette de l'intégration 0.10/0.11 (défaut D7)** : le guide n'avait rien sur la
  mémoire commune (182) ni sur les nouveautés visibles de la 0.11. Ajouté : page `memoire.md` (fr,
  en), section « Récupérer une conversation supprimée » (`reglages.md#corbeille`, 196), sauvegarde
  et restauration complétées (197), dans `depannage.md` l'avis de version dans la conversation
  (198), « L'agent ne dit plus rien » (`#silence`) et « Après un arrêt inattendu » (`#plantage`,
  194). « ? » ajoutés : Réglages › Mémoire (`memory`) et Données › Corbeille (`settingsTrash`).
  **Recherche et accueil** : l'accueil est désormais cherchable par son introduction et « Voir
  aussi » (seul endroit qui parle des astuces : « astuces » ne trouvait rien), **pas** par ses
  groupes du sommaire (que des liens vers les pages : l'accueil serait un résultat pour presque
  chaque mot) ; ses sections sont rangées après celles des pages, donc derrière elles à score égal.
  Essais : unitaire (`astuces`/`tips` trouvent « Voir aussi », aucun groupe du sommaire cherchable,
  « worktree » sans l'accueil, « agent » ne commence pas par l'accueil) ; e2e `aide` (« astuces »
  affiche l'accueil, mot surligné ; « ? » de Mémoire → page `memoire`).
  **Défaut trouvé par cet essai** : Échap vidait le champ, mais la recherche faite ne revenait à
  vide qu'au minuteur suivant ; retaper aussitôt l'annulait, et les résultats de l'ancienne
  recherche revenaient le temps de l'anti-rebond. Champ vidé (Échap, page envoyée par l'app, champ
  effacé) : la recherche faite est remise à vide dans le même geste (`clearSearch`). Essai unitaire
  (`HelpWindow.test.tsx`, échoue sans le correctif) et e2e.
  Second défaut vu sur les captures : en passant d'une page à l'autre, React réutilisait les titres
  de la page d'avant, avec la classe du « ressort » posée à la main (« Revoir et révoquer… » de
  Réglages ressortait encore sur la page Mémoire). Le rendu d'une page est recréé à chaque page
  (`key`), et l'e2e vérifie que seule l'ancre visée ressort. Le « ? » de Mémoire vise la section
  « Relire et ranger vos souvenirs » (`memoire#reglages`).
