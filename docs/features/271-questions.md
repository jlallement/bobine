# 271 — Questions à trancher avant de coder la vue des fichiers

- **Fiche** : `docs/features/271-vue-des-fichiers.md` (option B, lecture seule) ; maquettes
  `docs/maquettes/271-vue-des-fichiers.html`.
- **Rédigé le** 2026-11-20, sur la branche `1.1`, par une session « analyste métier et designer
  UX » ; à relire par le tech lead avant d'être posé à l'utilisateur. **Rien n'est codé.**
- **Déjà tranché, à ne pas reposer** : version 1.1 ; lecture seule d'abord (édition seulement plus
  tard, par un nouvel ADR) ; coloration du code dès le premier lot d'affichage (L2) ; commentaires
  sur une ligne gardés ; pas de palette : **⌘P ouvre l'onglet Fichiers, le curseur dans le
  filtre** ; un onglet à la demande dans le panneau de droite, comme Claude Code.

## Comment lire ce document

- **Partie A — À trancher par l'utilisateur** (Q1 à Q11) : goût, priorité, produit, ou habitude
  existante qui changerait. Une réponse par question ; la recommandation est l'option A sauf
  mention contraire.
- **Partie B — Recommandations par défaut** (Q12 à Q62) : ce que l'analyse et l'UX savent
  décider. L'utilisateur les valide **en bloc** ; il peut en sortir une pour la discuter.
- « Claude Code » renvoie aux cinq photos de l'app de bureau du 2026-11-20 (relevé R1 à R7 de la
  fiche). Ce que les photos ne montrent pas est dit « non visible ».

Ce que montrent les photos, en plus du relevé R1–R7 de la fiche :

- le fichier ouvert remplace le titre « Fichiers » de l'onglet (« fetch-opencode.sh ✕ ») ; le
  menu propose « Onglets d'aperçu », ce qui laisse penser que Claude Code sait en ouvrir plusieurs
  (*incertain*) ;
- en agrandi, l'arbre de droite **révèle le fichier ouvert** : `scripts › ci` dépliés, la ligne
  `fetch-opencode.sh` surlignée ;
- tri : dossiers d'abord, puis fichiers, ceux qui commencent par un point en tête, ensuite
  l'ordre alphabétique ; trois icônes seulement (`<>` code — YAML, JSON, TS, shell —, page de
  Markdown, page simple pour un fichier sans extension) ;
- la première ligne du fichier est surlignée (ligne courante), repères d'indentation visibles ;
- la bulle de commentaire « Ligne 19 — Ajouter un commentaire » porte une icône à droite, sans
  bouton visible.

---

## Partie A — À trancher par l'utilisateur

### Périmètre

#### Q1 — Quels lots entrent dans la 1.1, et dans quel ordre ?

- **Contexte.** La fiche chiffre L1 arbre (3 j), L2 fichier ouvert coloré (3 j), L3 commentaire
  sur une ligne (1,5 j), L4 agrandi et finitions (1,5 j), L5 « ? » cherche dans le contenu (1 j,
  optionnel). Chaque lot se livre seul ; aucune préversion ne peut partir de `1.1`
  (`docs/branche-1.1.md`).
- **Options.**
  - **A.** L1 → L2 → L3 → L4 dans la 1.1 (≈ 9 j) ; L5 dans une 1.1.x si le besoin se confirme.
  - **B.** L1 à L5 dans la 1.1 (≈ 10 j).
  - **C.** L1 et L2 seulement dans la 1.1 (≈ 6 j) ; L3 et L4 dans une 1.1.x.
- **Recommandation : A** — L3 est une des trois décisions déjà prises (commentaires gardés) et L4
  rend l'onglet utilisable en grand ; « ? » se remplace bien par `@` et par la question à l'agent.

### Ouverture et place dans l'app

#### Q2 — Que retient Bobine de l'onglet Fichiers au redémarrage ?

- **Contexte.** Le Terminal est rouvert avec sa conversation ; l'Aperçu de la fiche 052 est oublié
  au redémarrage. Claude Code : non visible.
- **Options.**
  - **A.** Tout, par conversation : onglet ouvert, fichier ouvert et sa position, dossiers dépliés.
  - **B.** L'onglet seulement, rouvert sur l'arbre replié.
  - **C.** Rien : l'onglet est oublié, comme l'Aperçu.
- **Recommandation : A** — on revient à une conversation pour reprendre un fil de pensée ; retrouver
  le fichier qu'on lisait coûte un peu de stockage local, pas de disque.

#### Q3 — Que fait un clic sur la ligne « Dossier » de l'onglet Session ?

- **Contexte.** Aujourd'hui elle montre le dossier dans le Finder (fiches 166, 179). La fiche 271
  propose qu'elle ouvre l'onglet Fichiers. C'est une habitude existante qui changerait.
- **Options.**
  - **A.** Elle ouvre l'onglet Fichiers ; ⌥-clic garde le Finder (infobulle qui le dit).
  - **B.** Elle garde le Finder ; une petite icône « Fichiers » s'ajoute au bout de la ligne.
  - **C.** Inchangée : Fichiers ne s'ouvre que par le menu « + », ⌘P et ⇧⌘Y.
- **Recommandation : A** — rester dans Bobine est le but de la fiche, et ⌥-clic → Finder est déjà
  la règle des liens de fichiers (052).

#### Q4 — Dans l'espace Discussion, que devient l'onglet Documents ?

- **Contexte.** L'espace Discussion a son onglet Documents (fiche 224) : liste plate du dossier
  tenu par Bobine, aperçu texte / Word / image, Enregistrer une copie. Le dossier n'est pas un
  projet de code ; l'utilisateur ne l'a pas choisi.
- **Options.**
  - **A.** Documents reste tel quel ; pas d'onglet Fichiers dans l'espace Discussion.
  - **B.** Documents garde sa liste, mais son aperçu devient la vue du fichier ouvert de la 271
    (coloration, images, numéros) — même composant, deux portes.
  - **C.** Fichiers remplace Documents dans les deux espaces.
- **Recommandation : A** pour la 1.1 — Documents vient d'être livré et sert un autre public ;
  B est une bonne suite une fois la vue du fichier stable, sans la mettre sur le chemin critique.

### Arbre

#### Q5 — Comment montrer les dossiers ignorés par git (`node_modules`, `build`, `out`) ?

- **Contexte.** Claude Code les montre **repliés, sans les griser**, comme les autres. Ils sont
  utiles (B8 : sorties de build, captures, journaux) mais encombrent l'arbre d'un projet Node.
- **Options.**
  - **A.** Visibles et repliés, **légèrement atténués**, infobulle « Ignoré par git ».
  - **B.** Visibles et repliés, sans différence, exactement comme Claude Code.
  - **C.** Masqués par défaut ; « Afficher les fichiers ignorés » dans le menu ….
- **Recommandation : A** — rien n'est caché, mais on distingue d'un coup d'œil ce que git suit de
  ce qui est généré, ce qui aide à s'orienter (B1).

#### Q6 — L'arbre signale-t-il ce que la conversation a touché ?

- **Contexte.** Claude Code n'a ni pastille ni section de fichiers récents (non visible). Retrouver
  un fichier créé ou modifié par l'agent (B2) est le besoin le plus fréquent de la fiche. L'audit
  (CM7) relie une vue « Récents » au compte juste des fichiers d'un tour.
- **Options.**
  - **A.** Un point discret sur chaque fichier modifié par la conversation (diffs ACP déjà connus),
    et sur ses dossiers parents tant qu'ils sont repliés.
  - **B.** Rien, comme Claude Code : Modifications et les liens du fil s'en chargent.
  - **C.** A, plus une section « Cette conversation » en tête de l'arbre (créés, modifiés, cités).
- **Recommandation : A** — le point guide vers le bon dossier sans dupliquer Modifications ; la
  section C attend CM7, sinon elle aurait le même défaut de compte que F14 (fichiers écrits par
  une commande absents).

#### Q7 — Quel dossier montre l'arbre quand il y a des travaux délégués (worktrees) ?

- **Contexte.** Une conversation dans un worktree montre son worktree (fiche). Une mère qui a
  délégué des travaux a, en plus, un worktree par travail (fiches 036, 260). Claude Code : non
  visible.
- **Options.**
  - **A.** Seulement le dossier de la conversation affichée (son worktree si elle en a un) ; la
    carte d'un travail délégué gagne « Parcourir les fichiers », qui ouvre **sa** conversation sur
    l'onglet Fichiers.
  - **B.** Un sélecteur de racine en tête de l'arbre : le dossier, puis le worktree de chaque
    travail délégué en cours.
  - **C.** Les worktrees des travaux délégués comme racines supplémentaires, sous le dossier.
- **Recommandation : A** — une conversation, un dossier : la remarque sur une ligne part sans
  ambiguïté au bon agent (Q55), et rien ne mélange deux copies du même fichier dans un arbre.

### Sécurité visible

#### Q8 — Un fichier de secret (`.env`, clé privée) s'affiche-t-il ?

- **Contexte.** La fiche propose « listé avec un cadenas, jamais affiché » ; Claude Code l'affiche
  sans doute comme un autre fichier (non relevé). Bobine a `secret-scan.ts` (noms et contenus) et
  refuse déjà de cocher `.env*` dans un commit par défaut (fiche 244).
- **Options.**
  - **A.** Listé avec un cadenas, **jamais affiché** ; « Ouvrir dans <éditeur> » et « Afficher
    dans le Finder » restent ; les modèles (`.env.example`, `.env.sample`, `.env.template`)
    s'affichent normalement.
  - **B.** Affiché, valeurs masquées (`••••`) ; « Montrer les valeurs » au clic, le temps de
    l'affichage.
  - **C.** Affiché comme les autres fichiers.
- **Recommandation : A** — un écran partagé, une capture d'e2e ou une vidéo de démo ne peuvent
  pas montrer une clé ; l'éditeur reste à un clic pour qui en a vraiment besoin.

### Fichier ouvert

#### Q9 — Un seul fichier à la fois, ou plusieurs ?

- **Contexte.** Sur les photos, le fichier prend la place du titre « Fichiers » et ✕ revient à
  l'arbre ; « Onglets d'aperçu » dans le menu suggère que Claude Code en ouvre plusieurs
  (*incertain*). L'audit relève que les onglets du panneau ne sont déjà plus que des icônes dès
  qu'il y en a plusieurs (F13).
- **Options.**
  - **A.** Un seul : l'onglet prend le nom du fichier, ✕ revient à l'arbre ; ⌃- / ⌃⇧- (ou les
    flèches ‹ › de la barre) reviennent au fichier précédent / suivant.
  - **B.** Plusieurs : chaque fichier ouvert devient un onglet du panneau.
  - **C.** Un onglet Fichiers qui contient ses propres sous-onglets de fichiers.
- **Recommandation : A** — fidèle aux photos, cohérent avec « pas un IDE », et ne charge pas la
  rangée d'onglets ; l'historique couvre le va-et-vient entre deux fichiers.

#### Q10 — Un fichier Markdown s'ouvre-t-il rendu ou en source ?

- **Contexte.** L'Aperçu de 052 rend le Markdown. Un commentaire sur une ligne a besoin des
  numéros de ligne, que seul le source a. Le projet (et beaucoup d'autres) a l'essentiel de sa doc
  en `.md`.
- **Options.**
  - **A.** Rendu par défaut ; bascule « Source » dans la barre (retenue pour la session) ; les
    commentaires se posent en Source.
  - **B.** Source colorée par défaut ; bascule « Rendu ».
  - **C.** Rendu seulement, comme aujourd'hui (pas de commentaire sur un `.md`).
- **Recommandation : A** — on lit un `.md` plus qu'on ne le commente, et 052 a habitué à le voir
  rendu ; la bascule garde le commentaire possible sur un plan ou une fiche.

### Lien avec la conversation

#### Q11 — Que fait un clic sur un lien de fichier dans une réponse de l'agent ?

- **Contexte.** Aujourd'hui (052) : `.md` → Aperçu ; `.html` → navigateur intégré ; autre fichier
  → app par défaut (sans la ligne : macOS ne la transmet pas) ; ⌥-clic → Finder. Changer cela
  change une habitude, et l'Aperçu deviendrait l'onglet Fichiers.
- **Options.**
  - **A.** Tout fichier texte, image ou Markdown du dossier s'ouvre dans l'onglet Fichiers, **à la
    ligne** (surlignée) ; ⌘-clic → « Ouvrir dans <éditeur> » à la ligne ; ⌥-clic → Finder ;
    HTML et PDF gardent leur chemin actuel.
  - **B.** Seuls les `.md` changent (l'Aperçu devient l'onglet Fichiers) ; le code part toujours
    dans l'app par défaut.
  - **C.** Rien ne change ; l'Aperçu de 052 reste un onglet à part.
- **Recommandation : A** — retrouver un fichier cité (B2) est le besoin le plus fréquent, la ligne
  est enfin respectée, et l'on n'a plus deux visionneuses qui font presque la même chose.

---

## Partie B — Recommandations par défaut (à valider en bloc)

### Périmètre et méthode

**Q12 — Faut-il accepter l'ADR-0065 avant L1 ?**
Contexte : la règle « pas d'explorateur » vit dans l'index et la fiche 052 ; `AGENTS.md` demande
un ADR pour la changer. Options : A accepter l'ADR au début de L1 ; B l'écrire à la fin.
**Recommandation : A** — il fixe les règles de sécurité et de lecture seule que chaque lot doit
tenir.

**Q13 — Les maquettes sont-elles corrigées avant L1 ?**
Contexte : l'écran 5 (palette ⌘P) est écarté par l'utilisateur ; l'écran 3 montre ⌘P comme une
recherche. Options : A corriger au début de L1 (retirer l'écran 5, ⌘P → filtre) ; B laisser.
**Recommandation : A** — les maquettes servent de référence aux e2e et au relecteur.

**Q14 — Faut-il une nouvelle dépendance ?**
Contexte : highlight.js, `ignore`, la liste `git ls-files` et `syntax.css` sont déjà là. Options :
A aucune ; B un paquet d'icônes de fichiers ; C un composant d'arbre virtualisé.
**Recommandation : A** — tout se construit avec l'existant ; une virtualisation maison suffit
(Q24).

### Ouverture

**Q15 — Par où ouvre-t-on l'onglet ?**
Contexte : Claude Code a une icône dossier dans la barre du panneau. Options : A menu « + »,
⌘P, ⇧⌘Y, ligne Dossier de Session (selon Q3), lien du fil (selon Q11) ; B en plus, une icône
permanente dans la barre du panneau. **Recommandation : A** — Bobine n'a pas de barre d'icônes
permanente ; le menu « + » est l'endroit des onglets à la demande.

**Q16 — L'onglet s'ouvre-t-il un jour tout seul ?**
Contexte : `panelAutoOpens` ouvre certains onglets d'office. Options : A jamais ; B quand l'agent
crée une image ou un rapport. **Recommandation : A** — principe 1 de la fiche (« jamais ouvert
d'office »).

**Q17 — Que fait ⌘P exactement ?**
Contexte : décidé : il ouvre Fichiers, le curseur dans le filtre. Options : A ouvre le panneau
s'il est fermé, l'onglet Fichiers (revient à l'arbre si un fichier est ouvert), place le curseur
dans le filtre et sélectionne son texte ; un second ⌘P resélectionne ; Échap sur un filtre vide
rend le focus à la saisie ; B ⌘P bascule (ferme si déjà là). **Recommandation : A** — un
raccourci de recherche ne doit jamais fermer ce qu'on cherche.

**Q18 — Que fait ⇧⌘Y ?**
Contexte : Claude Code : « Voir l'arborescence ⇧⌘Y », coché. Options : A panneau étroit : bascule
entre l'arbre et le fichier ouvert ; agrandi : montre ou cache l'arbre à côté du fichier ; sans
onglet Fichiers : l'ouvre sur l'arbre ; B ouvrir / fermer l'onglet. **Recommandation : A** — même
sens que chez Claude Code ; ⌘P et ✕ couvrent ouvrir et fermer.

**Q19 — Conversation sans dossier lisible ?**
Contexte : accueil sans conversation, dossier disparu ou démonté. Options : A Fichiers absent du
menu « + », ⌘P sans effet hors conversation ; dossier disparu : l'onglet dit « Ce dossier
n'existe plus » avec « Choisir un dossier… » de l'existant ; B onglet vide sans explication.
**Recommandation : A**.

**Q20 — Le changement de conversation change-t-il l'arbre ?**
Contexte : le panneau suit la conversation affichée. Options : A oui, chaque conversation a son
arbre et son état (Q2) ; B un arbre global. **Recommandation : A** — un dossier par conversation.

### Arbre

**Q21 — Fichiers et dossiers cachés ?**
Contexte : Claude Code liste `.claude`, `.github`, `.gitignore`. Options : A listés ; `.git` et
`.DS_Store` jamais ; B cachés derrière une bascule. **Recommandation : A** — comme Claude Code,
et `.github` ou `.claude` sont souvent ce qu'on cherche.

**Q22 — Tri ?**
Options : A dossiers d'abord, puis fichiers ; dans chaque groupe, ordre naturel insensible à la
casse (`file2` avant `file10`), les noms à point en tête (comme Claude Code) ; B ordre
alphabétique strict. **Recommandation : A**.

**Q23 — Icônes par type ?**
Contexte : Claude Code : trois icônes (code, Markdown, page). Options : A un petit jeu maison :
dossier, code, Markdown, image, PDF, texte, binaire, lien symbolique, cadenas ; B une icône par
langage. **Recommandation : A** — lisible, sans dépendance, cohérent avec les icônes de Bobine.

**Q24 — Très gros dossiers ?**
Contexte : un `node_modules` a des milliers d'entrées. Options : A chaque dossier lu à son
ouverture, 2 000 entrées au plus, puis une ligne « 1 234 de plus — filtrer pour les trouver » ;
lignes virtualisées au-delà de quelques centaines visibles ; B tout lire d'un coup.
**Recommandation : A** — chiffres de la fiche, l'app reste fluide.

**Q25 — Liens symboliques ?**
Options : A listés avec une petite flèche ; suivis seulement si la cible reste dans les dossiers de
la conversation ; sinon grisés, ni dépliables ni ouvrables, infobulle « Hors du dossier de la
conversation » ; B jamais suivis. **Recommandation : A** — règle `real` / `inside` de 052, déjà
testée.

**Q26 — Plusieurs dossiers dans la session (fiche 179) ?**
Contexte : « Autres dossiers » de Session. Options : A une racine par dossier : le dossier principal
déplié, les autres repliés en dessous, chacun avec son nom (L4) ; B le dossier principal seulement.
**Recommandation : A** — ce que l'agent voit, l'utilisateur doit pouvoir le voir ; marqués « non
transmis » si l'agent ne les reçoit pas (179).

**Q27 — Fichiers exclus pour l'agent (`.bobignore`, fiche 155) ?**
Options : A une petite marque « invisible pour l'agent » (œil barré, infobulle) ; B rien.
**Recommandation : A** — répond à B10 pour presque rien, la liste vient déjà du profil.

**Q28 — Pastilles git (M, A, U) dans l'arbre ?**
Contexte : absentes chez Claude Code. Options : A non ; B oui. **Recommandation : A** — la vue Git
de Modifications le fait ; Q6 couvre ce que la conversation a touché.

**Q29 — Quand l'arbre est-il relu ?**
Contexte : aucun surveillant de fichiers dans le main. Options : A dossiers dépliés et fichier
ouvert relus à la fin de chaque outil et de chaque tour, au retour sur la fenêtre, et par
« Relire » dans … ; B un surveillant `fs.watch`. **Recommandation : A** — décision de la fiche et
de l'ADR ; `fs.watch` récursif est inégal sous Linux.

**Q30 — Un fichier ou un dossier disparaît ?**
Options : A il quitte l'arbre à la relecture ; le fichier ouvert affiche « Ce fichier n'existe
plus » avec « Revenir à l'arbre » ; B erreur. **Recommandation : A**.

**Q31 — Le fichier ouvert est-il révélé dans l'arbre ?**
Contexte : photo 5 : ancêtres dépliés, ligne surlignée. Options : A oui, à chaque ouverture ;
B non. **Recommandation : A** — on voit où il est, et ses voisins.

**Q32 — Réduire tous les dossiers ?**
Options : A bouton de la barre (icône de Claude Code) et entrée du menu … ; la racine reste
dépliée ; B menu seulement. **Recommandation : A**.

### Filtre

**Q33 — Que filtre le champ ?**
Contexte : « Filtrez ou ? pour chercher » chez Claude Code ; le rang de `@` existe (nom, segment,
contient, lettres dans l'ordre). Options : A le chemin relatif complet avec le rang de `@` (qui est
déjà un flou léger) ; résultats en **liste plate** classée (nom en gras, dossier en gris), l'arbre
revient quand le champ est vide ; B l'arbre élagué aux correspondances. **Recommandation : A** —
c'est ce qu'on attend de ⌘P, et le rang est déjà éprouvé.

**Q34 — Les fichiers ignorés sont-ils cherchés ?**
Contexte : la source de `@` (`git ls-files … --exclude-standard`) les exclut. Options : A non, et
la liste le dit en pied (« Fichiers ignorés non cherchés — les parcourir dans l'arbre ») ; B oui.
**Recommandation : A** — chercher dans `node_modules` noierait les résultats et coûterait cher.

**Q35 — Le filtre accepte-t-il une ligne ?**
Options : A `chemin:42` ouvre le fichier à la ligne 42 ; B non. **Recommandation : A** — même
syntaxe que les liens du fil.

**Q36 — Clavier dans la liste filtrée ?**
Options : A ↑ ↓ parcourent, ↵ ouvre, ⌘↵ éditeur, ⇧↵ mentionner dans la saisie, Échap efface puis
rend le focus ; B ↵ seulement. **Recommandation : A** — repris de l'option A de la fiche, sans la
palette.

**Q37 — Que dit le champ tant que « ? » n'existe pas (L5) ?**
Options : A « Filtrer » seulement ; « ? » apparaît avec L5 (recherche dans le contenu par
`git grep`, dans le dépôt seulement) ; B le texte de Claude Code dès L1. **Recommandation : A** —
ne jamais promettre une fonction absente.

### Fichier ouvert

**Q38 — Barre du fichier ouvert ?**
Contexte : photos : nom ✕ en titre, fil d'Ariane, bouton arborescence, …. Options : A pareil, plus
une mention discrète « Lecture seule » ; chaque segment du fil d'Ariane révèle ce dossier dans
l'arbre ; B sans fil d'Ariane. **Recommandation : A**.

**Q39 — Taille maximale ?**
Options : A jusqu'à 1 Mo affiché ; au-delà, le premier Mo et un bandeau « Fichier tronqué (12 Mo) —
Ouvrir dans <éditeur> » ; coloration jusqu'à 200 Ko, au-delà texte brut, et c'est dit ; B refuser
au-delà d'1 Mo. **Recommandation : A** — un journal de 12 Mo se lit par son début.

**Q40 — Binaires ?**
Options : A détectés (octet nul dans les 8 premiers Ko, ou encodage illisible) : une fiche « Fichier
binaire · 3,2 Mo » avec Ouvrir / Finder ; B afficher les octets. **Recommandation : A**.

**Q41 — Images ?**
Options : A PNG, JPEG, GIF, WebP, AVIF, ICO affichés ajustés au panneau, clic : taille réelle ;
dimensions et poids sous l'image ; 20 Mo au plus ; B « Ouvrir » seulement. **Recommandation : A** —
B6 et B7 (ressources, maquettes, captures).

**Q42 — SVG ?**
Options : A affiché comme image (balise `img` : scripts inertes), bascule « Source » colorée ;
B source seulement. **Recommandation : A** — on veut voir l'icône, sans jamais insérer le SVG
dans le DOM.

**Q43 — HTML ?**
Contexte : 052 ouvre un `.html` dans le navigateur intégré (aperçu cloisonné, 064 et 114).
Options : A source colorée dans Fichiers, bouton « Ouvrir dans le navigateur » ; B navigateur
directement. **Recommandation : A** — depuis l'arbre, on veut souvent le code ; le lien du fil
garde le navigateur (Q11).

**Q44 — PDF, Office ?**
Options : A « Ouvrir » avec l'app par défaut (et Finder) ; aperçu PDF plus tard ; B aperçu PDF
dans le navigateur intégré dès la 1.1. **Recommandation : A** — question 8 de la fiche ; l'aperçu
PDF demande d'ouvrir le visionneur de Chromium, à cloisonner.

**Q45 — Gros JSON et fichiers minifiés ?**
Options : A comme un texte : coloré sous 200 Ko, retour à la ligne ; pas de mise en forme ni
d'arbre JSON ; B formater le JSON. **Recommandation : A** — lecture seule : on montre le fichier
tel qu'il est.

**Q46 — Coloration : thème et langages ?**
Options : A jetons `--syn-*` de `syntax.css` (clair, sombre, palettes) ; langage par extension, par
nom (`Dockerfile`, `Makefile`) et par `#!` ; les langues du paquet courant de highlight.js ;
inconnu → texte brut ; jamais de détection automatique ; B détection automatique.
**Recommandation : A** — la détection coûte ≈ 140 ms pour 200 lignes (fiche 192) et se trompe.

**Q47 — Retour à la ligne, repères, ligne courante ?**
Contexte : photos : retour à la ligne et repères d'indentation activés, ligne courante surlignée.
Options : A retour à la ligne activé par défaut, bascule dans … retenue pour tous les fichiers ;
ligne surlignée seulement à l'arrivée par un lien ou `:ligne` ; pas de repères d'indentation en
1.1 ; B tout comme Claude Code. **Recommandation : A** — les repères coûtent sans servir la
lecture seule.

**Q48 — Aller à une ligne, chercher, copier ?**
Options : A ⌃G « Aller à la ligne » ; ⌘F cherche **dans le fichier** quand le focus y est (sinon
dans la conversation, comme aujourd'hui) ; sélection native, numéros non sélectionnables ;
« Copier le chemin » dans … ; B rien en 1.1. **Recommandation : A** — ⌘L et ⌘G sont déjà pris
dans Bobine ; ⌃G est le geste de VS Code sur Mac.

**Q49 — Le fichier affiché change sur le disque ?**
Options : A relu (Q29) en gardant le défilement ; bandeau discret « Modifié à 15:11 — Voir le
diff » ; B rechargé en haut. **Recommandation : A** — on ne perd pas sa place.

### Actions sur un fichier ou un dossier

**Q50 — Quelles actions, et où ?**
Contexte : Claude Code : non visible (pas de menu contextuel sur les photos). Options : A menu
contextuel (clic droit) sur une ligne de l'arbre, mêmes entrées dans … du fichier ouvert :
**Ouvrir dans <éditeur>** (à la ligne, 156), **Ouvrir avec l'app par défaut** (jamais pour un
exécutable), **Afficher dans le Finder**, **Mentionner dans la saisie**, **Copier le chemin
relatif**, **Copier le chemin absolu**, **Voir le diff** (fichier modifié) ; pour un dossier :
Finder, éditeur, copier les chemins, Réduire ; B … du fichier seulement. **Recommandation : A**.

**Q51 — « Mentionner dans la saisie » et glisser vers la saisie ?**
Options : A insère `@chemin` au curseur de la saisie et y met le focus ; glisser une ligne de
l'arbre sur la saisie fait de même (une mention, pas une copie jointe) ; fichier exclu pour
l'agent → la confirmation `ExcludedConfirm` existante ; B mention seulement par le menu.
**Recommandation : A** — B3 et B5 en un geste.

**Q52 — « Voir le diff » ouvre quoi ?**
Options : A Modifications sur ce fichier : vue Conversation s'il a un diff ACP, sinon vue Git ;
B un diff dans l'onglet Fichiers. **Recommandation : A** — Modifications reste l'endroit des diffs
(fiche).

**Q53 — Exécutables ?**
Options : A un script se **lit** comme un texte (la photo montre un `.sh`) ; « Ouvrir avec l'app
par défaut » absent pour lui ; Finder seulement ; B ne pas les afficher. **Recommandation : A** —
lire ne lance rien ; la règle de 052 ne porte que sur l'ouverture.

### Commentaire sur une ligne

**Q54 — Choisir une ou plusieurs lignes ?**
Contexte : Claude Code : « + » au survol, bulle « Ligne 19 ». Options : A « + » au survol du
numéro, Maj-clic pour une plage (comme 085), atteignable au clavier ; bulle « Ligne 19 » ou
« Lignes 19 à 24 » ; ⌘↵ ajoute, Échap annule ; B glisser sur les numéros. **Recommandation : A** —
le geste de 085 que l'utilisateur connaît déjà.

**Q55 — À qui part la remarque, et avec quoi ?**
Options : A une `DiffNote` de vue `file` dans la **même file** que les remarques de diff de la
conversation ; la barre « N remarques » apparaît aussi en tête de l'onglet Fichiers ; « Envoyer à
l'agent » envoie tout d'un coup à l'agent **de la conversation affichée** (pendant une réponse :
la file de la fiche 020) ; chemin relatif à la racine, racine nommée si ce n'est pas le dossier
principal ; message en français (ADR-0014) ; B une file propre à Fichiers. **Recommandation : A** —
décision de l'utilisateur (« les commentaires restent ») et de la fiche.

**Q56 — La remarque, si le fichier change ?**
Options : A elle garde le code cité ; elle reste sous sa ligne si ce code y est encore, sinon elle
le suit s'il est retrouvé tel quel ailleurs, sinon elle passe en fin de fichier avec « ligne 19 à
l'origine — le code a changé » ; le message à l'agent cite le code du moment de la remarque ; B elle
reste au même numéro. **Recommandation : A** — même comportement que 085 pour une ligne disparue.

**Q57 — Remarque sur un Markdown rendu, une image, un secret ?**
Options : A seulement sur du texte avec numéros (Markdown en Source, Q10) ; jamais sur une image ni
un secret (non affiché) ; B partout. **Recommandation : A**.

### Mode agrandi

**Q58 — De quel côté va l'arbre ?**
Contexte : Claude Code : « Côté de l'arborescence : Automatique », arbre à droite sur la photo 5.
Options : A Automatique = à droite quand l'onglet agrandi dépasse ≈ 900 px, sinon un seul des deux
(Q18) ; Gauche / Droite dans …, retenu pour tous ; B toujours à gauche (habitude des IDE).
**Recommandation : A** — comme Claude Code, et l'arbre à droite rappelle qu'on n'est pas dans un
IDE.

### Clavier et accessibilité

**Q59 — Quel contrat clavier et lecteur d'écran ?**
Options : A arbre en `role="tree"` / `treeitem` avec `aria-expanded` ; ↑ ↓ parcourent, → déplie ou
entre, ← replie ou remonte au parent, ↵ ouvre, Début / Fin ; taper une lettre envoie au filtre ;
focus toujours visible ; le fichier ouvert s'annonce « nom, 120 lignes, Shell, lecture seule » ;
« + » des numéros atteignable au Tab ; contrastes des `--syn-*` déjà vérifiés (134) ; pas
d'animation sous « réduire les animations » ; B souris d'abord, clavier ensuite.
**Recommandation : A** — dû dès L1, plus cher à rattraper.

### Sécurité

**Q60 — Quelles règles dans le main ?**
Options : A le renderer envoie `(conversation, racine, chemin relatif)`, jamais un chemin absolu ;
le main résout le chemin réel et refuse ce qui sort des racines (liens compris) ; lecture finale en
`O_NOFOLLOW` (comme 224 M1) ; tailles bornées (Q24, Q39) ; **aucun canal IPC d'écriture** ;
secrets reconnus par nom (`.env*` sauf modèles, `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`…) ; dans
un fichier affiché, ce que `secret-scan.ts` reconnaît est masqué (`••••`) ; le journal
(`agents.log`) note le chemin, jamais le contenu ; rien n'est envoyé à l'agent sans geste (mention,
remarque) ; B confiance dans le renderer. **Recommandation : A** — règles de la fiche et de
l'ADR, tests `..`, lien qui sort, lien vers `.env`, binaire, gros fichier.

### macOS, préversions Linux et Windows

**Q61 — Qu'est-ce qui change hors macOS ?**
Options : A raccourcis par `CmdOrCtrl` (Ctrl+P, Ctrl+Maj+Y) ; « Aller à la ligne » sans raccourci
hors macOS (Ctrl+G y est déjà « suivant » de la recherche), par … et par `:42` dans le filtre ;
« Finder » devient « gestionnaire de fichiers » (Linux) et « Explorateur » (Windows), comme
ailleurs ; chemins affichés avec `/` partout, chemin absolu copié sous la forme du
système (`C:\…`) ; tri et filtre insensibles à la casse partout ; sous Windows, « caché » = nom à
point (l'attribut caché est ignoré en 1.1), jonctions traitées comme liens ; e2e `files` sur macOS
et Linux (Docker), Windows à la main ; B macOS seulement en 1.1. **Recommandation : A** — les
préversions Linux et Windows suivent la règle de la fiche 229.

### Traductions et nom

**Q62 — Nom de l'onglet et textes ?**
Options : A « Fichiers » / « Files » ; « Filtrer » / « Filter » (« Filtrer ou ? pour chercher » /
« Filter or ? to search » avec L5) ; « Lecture seule » / « Read-only » ; « remarque » /
« comment » (glossaire de `docs/traduction.md`) ; clés dans `fr.json` et `en.json`, e2e par
`L('clé')` ; lignes de `CHANGELOG.md` et `CHANGELOG.en.md` à chaque lot visible ; B « Explorateur »
/ « Explorer ». **Recommandation : A** — le mot de Claude Code, et « Explorateur » évoque l'IDE
qu'on ne veut pas devenir.

---

## Récapitulatif

| Partie | Thème | Questions |
|---|---|---|
| A — à trancher par l'utilisateur | Périmètre | Q1 |
| | Ouverture et place dans l'app | Q2, Q3, Q4 |
| | Arbre | Q5, Q6, Q7 |
| | Sécurité visible | Q8 |
| | Fichier ouvert | Q9, Q10 |
| | Lien avec la conversation | Q11 |
| B — recommandations par défaut | Périmètre et méthode | Q12–Q14 |
| | Ouverture | Q15–Q20 |
| | Arbre | Q21–Q32 |
| | Filtre | Q33–Q37 |
| | Fichier ouvert | Q38–Q49 |
| | Actions | Q50–Q53 |
| | Commentaire sur une ligne | Q54–Q57 |
| | Agrandi, clavier, sécurité, plateformes, textes | Q58–Q62 |

**11 questions à trancher, 51 recommandations par défaut.** Les réponses iront dans la section
« Décisions de l'utilisateur » de la fiche 271, puis dans son plan.
