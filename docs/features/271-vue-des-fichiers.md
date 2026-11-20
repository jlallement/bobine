# 271 — Vue des fichiers du dossier de travail

- **Statut** : à faire — proposition (réflexion de design et d'architecture, rien n'est codé ;
  décisions à trancher en fin de fiche ; maquettes `docs/maquettes/271-vue-des-fichiers.html`)
- **Dépend de** : 005 et 126 (`@` et sa recherche), 052 (liens de fichiers, aperçu `.md`), 064 et
  114 (aperçu HTML cloisonné), 155 (exclusions de l'agent), 156 (« Ouvrir dans <éditeur> »), 021,
  161 et 265 (onglet Modifications), 166 et 179 (onglet Session, autres dossiers), 224 (onglet
  Documents de l'espace Discussion), 036 et 260 (worktrees, travaux délégués)
- **Agents** : tous. Bobine lit le disque et git elle-même ; rien n'est demandé à l'agent ni
  envoyé à l'agent, sauf ce que l'utilisateur joint avec `@` (déjà le cas). Rien de propre à un
  agent (ADR-0011), à part les exclusions de la fiche 155 qui viennent déjà du profil.
- **Décision à remplacer en partie** : « Bobine n'est pas un IDE : pas d'éditeur de fichiers, pas
  d'explorateur de projet » (`docs/features/README.md`, section Périmètre ; fiche 052). Cette règle
  n'est écrite dans aucun ADR : elle vit dans l'index et la fiche 052. La changer demande quand
  même un ADR (règle d'`AGENTS.md`) — brouillon plus bas.

## Pourquoi

Demande de l'utilisateur (2026-11-20) : « Dans Bobine, on aimerait avoir une vue des fichiers et
des ressources du dossier dans lequel on travaille. »

Précision de l'utilisateur, qui cadre toute la fiche :

> « L'idée, c'est de ne pas faire un truc comme Bob IDE, un IDE en premier et Bob en secondaire,
> mais plutôt dans l'esprit de Claude Code. Si on en a besoin, on peut voir l'arborescence et les
> fichiers, mais pas de manière centrale dans le logiciel. »

D'où quatre principes, qui servent de filtre à toutes les options ci-dessous :

1. **Secondaire et à la demande** : la vue des fichiers est un onglet du panneau de droite qu'on
   ouvre quand on en a besoin, comme Terminal ou Navigateur, ou une palette. **Jamais** une
   colonne permanente, jamais ouverte d'office, jamais centrale.
2. **La conversation reste au centre** : aucun fichier ouvert au centre ; un fichier s'ouvre dans
   l'onglet du panneau.
3. **Les fichiers se regardent et se raccrochent à la conversation** : lecture, commentaire sur une
   ligne envoyé à l'agent, `@` dans la saisie, ouvrir dans l'éditeur, Finder, copier le chemin.
4. **Référence principale : Claude Code** (desktop), relevée sur l'app réelle (section 3) — pas
   Bob IDE, pas Cursor.

Aujourd'hui, on ne voit un fichier du projet que s'il passe par la conversation (un lien, une
modification, une mention `@`) ou par Git. Pour savoir ce qu'il y a dans le dossier, ce que
l'agent a produit hors du diff (une image, un PDF, un rapport HTML, un fichier ignoré), ou pour
retrouver un fichier sans se souvenir de son nom exact, il faut quitter Bobine pour le Finder ou
l'éditeur. La question n'est pas « faut-il un IDE » (non), mais « quel est le plus petit regard
sur le dossier qui évite ces allers-retours ».

### Décisions de l'utilisateur (2026-11-20)

- **Lecture seule d'abord.** Pas d'édition dans la première version ; une édition légère (comme
  celle de Claude Code, option B′) pourra venir plus tard **si elle manque** à l'usage, avec son
  propre ADR. Les maquettes montrent la lecture seule : aucun réglage d'éditeur dans le menu.
- **Les commentaires sur une ligne, pour l'agent, restent** (remarques de diff de la fiche 085).
- **« La coloration de code, ce serait aussi un vrai plus. »** Elle fait partie du premier lot de
  l'affichage d'un fichier (L2), en réutilisant ce que Bobine a déjà (section 4, « Coloration »).

## 1. Inventaire : ce qui montre déjà des fichiers

Relevé dans le code et les fiches le 2026-11-20 (`~/Dev/bobine-oss`, `main`).

| # | Où | Ce qu'on voit | Ce qu'on peut faire | Source |
|---|---|---|---|---|
| I1 | Saisie, menu `@` | les fichiers du dossier qui correspondent à la frappe (30 au plus), après les rôles et `@git-changes` / `@terminal` | joindre au message | fiches 005, 126, 155 ; `main/workspace-files.ts` (`git ls-files --cached --others --exclude-standard`, sinon parcours borné à 20 000 fichiers qui saute `node_modules`, `dist`, `.venv`…, cache 15 s ; rang : nom, segment, contient, lettres dans l'ordre), `composer/FileMenu.tsx`, IPC `workspace:searchFiles(id, query)` |
| I2 | Saisie, trombone et glisser-déposer | sélecteur de fichiers du système, n'importe où | joindre (confirmation si exclu pour l'agent) | `workspace:pickFiles`, `DropOverlay`, `ExcludedConfirm`, `workspace:excludedPaths` |
| I3 | Fil, liens vers des fichiers | ce que l'agent cite (`src/app.ts:12`, `plan.md`) | `.md` → onglet **Aperçu** (lecture seule) ; `.html` → navigateur intégré ; autre → app par défaut ; dossier, exécutable, hors du dossier → Finder (et avis) ; ⌥-clic → Finder | fiches 052, 064, 114 ; `main/files/file-links.ts` (`real`, `inside`, exécutables), `panel/DocumentTab.tsx` |
| I4 | Fil, « Ouvrir dans <éditeur> » | — | ouvrir à la ligne dans VS Code, Cursor, Zed, JetBrains… détectés | fiche 156 ; `main/editors/editors.ts` (sans shell, dossier de la conversation seulement) |
| I5 | Fil, images | images jointes ou produites, en grand | glisser vers le Finder | fiche 156 ; `main/images/image-drag.ts` |
| I6 | Onglet **Modifications** | vue Conversation (diffs ACP de la conversation), vue Git (état contre le dernier commit), vue Travaux (worktrees des travaux délégués) | diff, annuler, ouvrir, afficher, commit, fusion, « Faire relire » | fiches 021, 161, 207, 265 ; `panel/ChangesTab.tsx`, `ChangesList.tsx` |
| I7 | Onglet **Session** | dossier, branche, autres dossiers, deux lignes « Modifications » | dossier → Finder, branche → vue Git, ajouter un dossier | fiches 166, 179, 207 ; `SessionEnvironment.tsx`, `SessionFolders.tsx`, `SessionChanges.tsx` |
| I8 | Carte d'un travail délégué | « N fichiers +a −r », branche | « Voir les modifications », fusion | fiches 260, 263, 264 |
| I9 | Espace Discussion, onglet **Documents** | **liste plate** des documents du dossier tenu par Bobine (nom, taille, date) | aperçu (texte, texte d'un Word par `textutil`, image ; rien pour un PDF ou un Excel), Ouvrir (liste blanche d'extensions), Enregistrer une copie…, Afficher dans le Finder, déposer | fiche 224 ; `discussion/DocumentsPanel.tsx`, `main/documents/ipc.ts`, `shared/documents.ts` (`DocumentPreview`, `OPENABLE_EXTENSIONS`) |
| I10 | Fil d'une discussion, cartes de documents | documents créés ou modifiés pendant le tour | Ouvrir, Enregistrer sous…, Finder | fiche 224 |
| I11 | Mention `@git-changes` | — | joindre le diff non commité | fiche 057 |

**Ce qui n'existe pas** : aucune liste de ce que contient le dossier de code ; aucun aperçu
d'un fichier de code, d'une image ou d'un PDF du projet qui n'est pas cité ; aucun moyen de voir
un fichier ignoré ou généré (sortie de build, captures) ; pas de « aller au fichier » hors de la
saisie ; pas de copie de chemin. **Il n'y a aucun surveillant de fichiers** dans le main (pas de
`chokidar`, pas de `fs.watch` sur le dossier de travail) : tout ce qui est relu l'est à la fin d'un
outil ou d'un tour (052, 224, 241).

**Briques réutilisables** (aucune nouvelle dépendance n'est nécessaire) : la liste `git ls-files`
et le rang de recherche (I1) ; `real` / `inside` et la règle des exécutables (I3) ; le lanceur
d'éditeurs (I4) ; l'aperçu `DocumentPreview` texte / image (I9) ; le serveur d'aperçu HTML
cloisonné (064, 114) ; `ignore` (déjà en dépendance, fiche 155) et la file git `gitRun` (138).

## 2. Le besoin réel, besoin par besoin

| Besoin | Fréquence probable | Couvert aujourd'hui ? | Par quoi / ce qui manque |
|---|---|---|---|
| **B1 — S'orienter** dans un projet (nouveau, ou après une session de l'agent) : qu'y a-t-il, où sont les tests, la doc | moyenne, surtout au début | **non** | le Finder ou l'éditeur. Une arborescence répond ; une recherche aussi, si l'on sait quoi chercher |
| **B2 — Retrouver un fichier cité ou créé** par l'agent | **haute** | **en partie** | le lien du fil (I3) s'il y en a un et si l'on retrouve le message ; Modifications (I6) s'il est suivi par git ou dans les diffs ACP. Manque : un fichier écrit par une commande (`npm run build`, script, capture) n'a ni diff ACP ni ligne git s'il est ignoré |
| **B3 — Joindre un fichier** à la demande (`@`) | haute | **oui** | `@` (I1), trombone et dépôt (I2). Une vue des fichiers peut **ajouter** « Mentionner » et le glisser vers la saisie, pas remplacer `@` |
| **B4 — Voir ce qu'un travail a créé** (worktree d'un travail délégué) | moyenne | **oui pour le code suivi** | carte du travail et vue Travaux (I6, I8). Manque : fichiers ignorés ou non suivis du worktree, sorties (captures, rapports) |
| **B5 — Ouvrir dans l'éditeur** | haute | **en partie** | seulement depuis un lien du fil ou une ligne de Modifications (I4, I6) |
| **B6 — Prévisualiser une image ou un PDF** du projet | moyenne (front, doc, maquettes, rapports) | **non** pour le code | Discussion : images seulement (I9). Code : l'image ou le PDF part dans l'app par défaut |
| **B7 — Voir les ressources** (assets, `docs/`, maquettes, données) | moyenne | **non** | — ; c'est littéralement la demande (« fichiers et ressources ») |
| **B8 — Voir les fichiers ignorés ou générés** (`dist/`, `.env.example`, captures e2e, journaux) | faible à moyenne, mais **sans autre chemin** dans Bobine | **non** | — ; I1 les exclut volontairement |
| **B9 — Copier un chemin** (pour le terminal, une question) | moyenne | **non** | — |
| **B10 — Savoir ce que l'agent peut voir** (exclusions `.bobignore`, autres dossiers) | faible | en partie | `ExcludedConfirm` au moment de joindre ; Session › Autres dossiers |

Lecture : B2, B5, B6, B7 sont le cœur ; B3 est déjà bien servi ; B1 et B8 justifient une
arborescence plutôt qu'une simple recherche ; personne ne demande d'**éditer** (l'éditeur de
l'utilisateur est à un clic, fiche 156).

## 3. La référence : Claude Code, relevé sur l'app réelle

### Claude Code (desktop) — relevé le 2026-11-20 sur cinq photos de l'utilisateur

Ce qui suit est **observé** (photos de l'app, en français), pas supposé.

| # | Observé | Ce qu'on en retient pour Bobine |
|---|---|---|
| R1 | Une **icône dossier** dans la barre d'icônes du panneau de droite, à côté de terminal, diff, navigateur et simulateur ; elle ouvre un onglet titré **« Fichiers »**, avec **Agrandir** (⤢) et **Fermer** (✕) | onglet du panneau, à la demande, au rang des autres outils : exactement la consigne « pas central » |
| R2 | Barre d'outils de l'onglet : **Réduire tous les dossiers** (icône), **Voir l'arborescence** (icône liste, bascule), **…** | mêmes trois boutons |
| R3 | Champ **« Filtrez ou ? pour chercher »**, puis l'**arbre complet** : dossiers cachés (`.claude`, `.github`, `.pilote`) et fichiers cachés (`.gitignore`, `.prettierrc`) listés ; `build`, `node_modules`, `out` **visibles, repliés, sans être grisés** ; dossiers d'abord ; icônes par type (`<>` code, page, Markdown) | arbre complet, ignorés montrés comme les autres. Le sens exact de « ? » n'est pas visible sur les photos : probablement une recherche dans le contenu (*incertain*) |
| R4 | Menu **…** : « Accéder à un fichier ou rechercher **⌘P** » ; « Voir l'arborescence **⇧⌘Y** » (coché) ; « Côté de l'arborescence : **Automatique** › » ; « Réduire tous les dossiers » ; puis réglages d'éditeur : « Onglets d'aperçu », « Enregistrement automatique », « La touche Tab indente », « Retour à la ligne automatique », « Repères d'indentation », « Afficher les espaces », « Défilement au-delà de la fin », « Taille de tabulation 4 › » | ⌘P et ⇧⌘Y repris tels quels. **Claude Code édite** : enregistrement automatique, Tab, tabulations. Pour Bobine, c'est la question ouverte de la section 5 |
| R5 | **Fichier ouvert** : l'onglet du panneau prend son nom (« fetch-opencode.sh ✕ ») ; dessous, un **fil d'Ariane** `scripts / ci / fetch-opencode.sh`, les boutons arborescence et … ; **numéros de ligne**, **coloration syntaxique**, **retour à la ligne**, repères d'indentation, ligne courante surlignée | fichier dans l'onglet, pas au centre ; fil d'Ariane, numéros, coloration, retour à la ligne |
| R6 | Au survol d'un numéro de ligne, un **« + »** ; au clic, une bulle **« Ligne 19 — Ajouter un commentaire »** sous la ligne | une remarque sur une ligne, pour l'agent. Bobine a déjà ce mécanisme sur le diff (fiche 085 : `DiffNote`, « Envoyer à l'agent ») |
| R7 | **Agrandi** : le panneau couvre la conversation ; le fichier à gauche et l'**arbre à droite**, côte à côte | Bobine sait déjà agrandir le panneau par-dessus la conversation (⌘⇧J) ; l'arbre se met de côté quand la place le permet (« Côté : Automatique ») |

Ce que les photos **ne montrent pas** : pastilles git dans l'arbre, menu contextuel d'une ligne,
section « fichiers de la conversation », aperçu d'image ou de PDF, comportement quand l'agent
écrit dans un fichier ouvert. Ces points restent à décider sans modèle.

### Les autres, de mémoire (mi-2026, non revérifiés)

| Produit | Explorateur ? | Ce qu'on en retient |
|---|---|---|
| **Codex** (app de bureau) | diff, relecture, terminal, ouvrir dans l'éditeur ; pas d'arbre à ma connaissance (*incertain*) | même parti « agent d'abord » |
| **Cursor**, **Zed** | éditeurs complets, explorateur permanent ; l'agent dans un panneau | ⌘P est le geste le plus utilisé |
| **Bob IDE** (IBM) — contre-exemple cité par l'utilisateur | IDE d'abord (base VS Code) : explorateur, éditeur et onglets au centre, l'agent à côté | ce que Bobine ne doit **pas** devenir |
| **Warp** | arbre et visionneuse légère à côté du terminal, avec une édition simple (*incertain* sur l'étendue) | un outil « agent » qui ajoute un arbre finit souvent par éditer : la frontière se décide, elle ne tient pas toute seule |

## 4. Les options

### Option A — Palette ⌘P seule, sans arbre

- **Où** : une palette au-dessus de la conversation (comme ⌘K pour les conversations).
- **Fait** : recherche de `@` (I1) ; le fichier choisi s'ouvre dans l'onglet Aperçu (052 élargi) ;
  ⌘↵ éditeur, ⇧↵ mentionner, ⌥↵ Finder, ⌘C chemin.
- **Ne fait pas** : pas d'arbre, pas de fichiers ignorés, pas d'édition.
- **Coût** : petit (≈ 2 jours). **Limite** : on ne voit que ce qu'on sait nommer ; loin du modèle
  Claude Code observé.

### Option B — « Comme Claude Code », en lecture seule (recommandée)

L'onglet Fichiers de Claude Code, point par point (R1–R7), **sans l'édition**.

- **Où** : un onglet **Fichiers** du panneau de droite (icône dossier), ouvert à la demande : menu
  « + », **⌘P** (aller au fichier, qui ouvre l'onglet au besoin), **⇧⌘Y** (voir / cacher
  l'arborescence), la ligne « Dossier » de l'onglet Session. Agrandir et Fermer comme les autres
  onglets. Jamais ouvert d'office.
- **Arbre** (R2, R3) : champ « Filtrer ou ? pour chercher » (le nom filtre l'arbre ; « ? » cherche
  dans le contenu, lot 5) ; arbre complet du dossier de la conversation (son worktree s'il en a
  un), dossiers d'abord, fichiers et dossiers cachés listés, `node_modules`, `out`, `build`
  **visibles et repliés, pas grisés** (comme Claude Code) ; chaque dossier lu **à son
  ouverture** ; barre d'outils : Réduire tous les dossiers, Voir l'arborescence, … .
- **Menu …** (R4) : Accéder à un fichier ou rechercher ⌘P ; Voir l'arborescence ⇧⌘Y ; Côté de
  l'arborescence (Automatique, Gauche, Droite) ; Réduire tous les dossiers ; Retour à la ligne
  automatique. **Aucun réglage d'édition** (onglets d'aperçu, enregistrement automatique, Tab,
  taille de tabulation…) : la vue est en lecture seule (décision de l'utilisateur).
- **Fichier ouvert** (R5) : l'onglet prend le nom du fichier (« ShoppingList.tsx ✕ », ✕ revient à
  l'arbre) ; fil d'Ariane cliquable (un segment ouvre ce dossier dans l'arbre) ; numéros de ligne,
  **coloration syntaxique** (voir « Coloration » ci-dessous), retour à la ligne ; mention discrète
  « Lecture seule » ; actions dans … : Ouvrir dans <éditeur> (à la ligne, fiche 156), Afficher dans
  le Finder, Mentionner dans la saisie, Copier le chemin, Voir le diff (fichier modifié). Markdown :
  rendu, comme l'Aperçu de 052 (qui devient ce même écran) ; image : affichée ; HTML : navigateur
  intégré (064) ; PDF, Office, binaire : « Ouvrir » avec l'app par défaut.
- **Coloration** (demandée par l'utilisateur, lot L2) : Bobine colore déjà le code du fil avec
  **highlight.js 11** (dépendance directe) par `rehype-highlight` dans `thread/Markdown.tsx`, et
  `syntax.css` (fiche 134) branche les classes `.hljs-*` sur les jetons `--syn-*` de chaque thème,
  clair, sombre et palettes comprises. La vue d'un fichier réutilise **les deux, sans nouvelle
  dépendance** : `hljs.highlight(texte, { language })` sur le fichier entier, langage tiré de
  l'extension (et du `#!` pour un script sans extension) plutôt que deviné — deviner essaie chaque
  grammaire, ≈ 140 ms pour 200 lignes (fiche 192) — puis le résultat coupé en lignes (les `span`
  ouverts refermés et rouverts à chaque fin de ligne) pour les numéros, le retour à la ligne et le
  « + » des commentaires. Sortie de highlight.js : texte échappé et `span` à classes seulement ;
  insérée telle quelle, jamais d'autre HTML. Bornes : coloration jusqu'à 200 Ko (au-delà, texte
  brut, et c'est dit), langage inconnu en texte brut. Les diffs de Modifications ne sont pas
  colorés aujourd'hui ; ils pourraient l'être avec la même fonction, plus tard (hors fiche).
- **Commentaire sur une ligne** (R6) : « + » au survol d'un numéro (ou glisser sur plusieurs
  numéros pour une plage), bulle « Ligne 19 — Ajouter un commentaire ». La remarque est une
  `DiffNote` de plus (fiche 085), avec une vue `file` à côté de `conversation` et `git` : même
  liste « Remarques en attente », même bouton **« Envoyer à l'agent »**, même message (fichier,
  lignes, code cité). Rien n'est envoyé sans ce geste.
- **Agrandi** (R7) : ⌘⇧J (agrandir le panneau, existant) ; avec un fichier ouvert et la place, le
  fichier à gauche et l'arbre à droite (« Côté : Automatique » ; à droite par défaut, comme Claude
  Code).
- **Ne fait pas** : pas d'édition, de création, de renommage, de déplacement, de suppression ; pas
  de surveillance continue du disque ; pas de colonne permanente ni de fichier au centre ; pas de
  lecture hors des dossiers de la conversation.
- **Sécurité** (non négociable, et écart assumé si Claude Code fait autrement) : le renderer
  demande `(conversation, chemin relatif)`, le main résout le chemin réel et refuse ce qui sort des
  dossiers de la conversation (liens symboliques compris, comme 052 et 114) ; un fichier de secret
  (`.env*`, clés, ce que `secret-scan.ts` reconnaît) est **listé sans être affiché** (cadenas,
  « Ouvrir dans <éditeur> » reste possible) — question 1 ; lecture bornée (1 Mo affiché,
  coloration sous 200 Ko, binaire détecté) ; jamais d'ouverture d'un exécutable.
- **Fraîcheur** : pas de surveillant (aucun aujourd'hui dans le main ; `fs.watch` récursif inégal
  sous Linux). Dossiers ouverts et fichier affiché relus **à la fin de chaque outil et de chaque
  tour**, au retour sur la fenêtre et par « Relire » ; un fichier affiché qui a changé est relu,
  ses remarques gardent le code cité.
- **Cohérence** : Modifications reste l'endroit des diffs (les remarques des deux vues partent
  ensemble) ; l'Aperçu de 052 devient le fichier ouvert de l'onglet Fichiers ; l'espace Discussion
  garde son onglet Documents (224) ; les travaux délégués (260) se regardent depuis leur
  conversation.

### Option B′ — La même, avec une édition légère (plus tard, si elle manque)

**Tranché le 2026-11-20 : lecture seule d'abord.** Claude Code édite (R4 : enregistrement
automatique, Tab indente, taille de tabulation) ; Bobine ne le fait pas dans la première version.
La comparaison reste ici pour le jour où l'édition manquerait :

| | **Lecture seule d'abord** (B) | **Édition légère, enregistrement automatique** (B′, comme Claude Code) |
|---|---|---|
| Ce qu'on gagne | rien à protéger : pas de conflit possible avec l'agent ; périmètre « pas un IDE » tenu à la lettre | corriger une faute, une valeur, une ligne sans ouvrir l'éditeur ni demander à l'agent |
| Composant | `highlight.js` (déjà là), rendu maison en lignes | un vrai éditeur : **CodeMirror 6** (nouvelle dépendance livrée, ≈ 300 Ko, licence MIT ; ADR et avis de licence, fiche 217). Monaco écarté (lourd, workers) |
| **Conflit avec l'agent** | aucun | l'agent écrit dans le fichier pendant que l'utilisateur tape : il faut, avant chaque enregistrement, vérifier que le disque n'a pas changé (empreinte et date) ; sinon bandeau « L'agent a modifié ce fichier — Garder la mienne / Prendre la sienne / Comparer ». Et l'inverse : l'agent a lu le fichier avant la frappe et l'écrase ensuite avec son ancienne vue (Bobine ne peut pas l'en empêcher : il écrit lui-même sur le disque, sauf par les permissions ACP) ; au mieux, éditeur en lecture seule pendant un tour, ce qui retire une bonne part de l'intérêt |
| **Annulation** | sans objet | ⌘Z dans l'éditeur seulement, perdu à la fermeture ; Modifications › Conversation ne voit pas les écritures de l'utilisateur (seulement celles de l'agent, diffs ACP) — seule la vue Git les montre ; « Annuler la modification » de l'agent peut écraser une retouche de l'utilisateur faite après |
| Autres risques | — | fins de ligne et encodage à préserver, fichiers énormes, formatage à l'enregistrement absent (pas de Prettier), enregistrement automatique pendant une fusion ou un commit de l'app (file git, fiche 138), secret ouvert en écriture |
| Coût | compris dans B | **+ 5 à 7 jours** (éditeur, enregistrement sûr, conflits, réglages, e2e), plus un ADR qui lève « pas d'éditeur » |
| Risque « IDE » | faible | réel : réglages d'éditeur, puis « Nouveau fichier », puis « Renommer »… |

**Décision** : B d'abord ; B′ seulement si l'édition manque à l'usage, avec un ADR. Le jour venu,
la borner : texte seulement, jamais pendant un tour de l'agent sur ce fichier, conflit
toujours dit, aucun fichier de secret, aucune création ni suppression.

### Option C — Explorateur permanent façon IDE (écartée)

Colonne de fichiers toujours visible (barre latérale), surveillance continue, éditeur au centre :
le modèle « Bob IDE » que l'utilisateur écarte. Décrite pour l'ADR seulement.

### Comparaison

| | A — ⌘P | **B — comme Claude Code, lecture** | B′ — + édition | C — permanent |
|---|---|---|---|---|
| Arbre | ✗ | ✓ à la demande | ✓ | ✓ toujours |
| ⌘P, ⇧⌘Y, filtre | ⌘P | ✓ | ✓ | ✓ |
| Fichier ouvert (fil d'Ariane, coloration) | Aperçu | ✓ dans l'onglet, coloré | ✓ | ✓ au centre |
| Commentaire sur une ligne → agent | ✗ | ✓ (remarques de diff) | ✓ | ✓ |
| Agrandi, arbre de côté | ✗ | ✓ | ✓ | — |
| Écriture | ✗ | ✗ | ✓ | ✓ |
| Nouvelle dépendance | — | — | CodeMirror 6 | surveillant, éditeur |
| Coût | ≈ 2 j | **≈ 9 j** | + 5 à 7 j (reportée) | > 15 j |
| Esprit Claude Code / « pas central » | partiel | **oui** | oui (Claude Code édite) | **non** |

## 5. Recommandation et lots chiffrés

**Option B : l'onglet Fichiers de Claude Code, en lecture seule, avec la coloration de code et le
commentaire sur une ligne envoyé à l'agent.** L'édition (B′) est reportée (décision de
l'utilisateur) : elle viendra si elle manque ; rien dans B ne l'empêche (l'écran du fichier ouvert
est le même).

Pourquoi : c'est le modèle demandé (« dans l'esprit de Claude Code », « pas de manière
centrale »), relevé sur l'app réelle ; il se construit avec ce que Bobine a déjà (`@` et sa liste
git, `real` / `inside` de 052, éditeurs de 156, highlight.js et `syntax.css` du fil, remarques de diff de 085, panneau
agrandi) et **sans nouvelle dépendance** ; il ne crée aucun conflit avec l'agent tant qu'on n'écrit
pas.

Chiffrage en jours de travail d'agent, relecture du tech lead et e2e comprises (estimation, ±30 %) :

| Lot | Contenu | Taille | Jours |
|---|---|---|---|
| **L1 — Onglet et arbre** | IPC `files:list(id, dossier)` (un niveau, trié, borné à 2 000 entrées, liens et secrets marqués), contrôles de chemin dans le main ; onglet Fichiers (icône, menu « + », Agrandir, Fermer), arbre paresseux, filtre par nom (rang de `@`), Réduire tous, ⇧⌘Y ; relecture fin d'outil, fin de tour, focus, « Relire » ; agent factice et e2e `files` | moyen | 3 |
| **L2 — Fichier ouvert, coloré** | IPC `files:read(id, chemin)` (1 Mo, binaire, secret refusé) ; vue du fichier dans l'onglet (nom ✕, fil d'Ariane, numéros, retour à la ligne) ; **coloration** : highlight.js et `syntax.css` déjà livrés, langage par extension et `#!`, découpe en lignes, 200 Ko au plus (≈ 0,5 j des 3) ; Markdown (reprend 052), images, HTML → navigateur, PDF → Ouvrir ; menu … (éditeur, Finder, Mentionner, Copier le chemin, Voir le diff) ; ⌘P (aller au fichier) | moyen | 3 |
| **L3 — Commentaire sur une ligne** | « + » au survol, plage par glisser, bulle « Ligne N » ; `DiffNote` vue `file` ; remarques en attente communes avec Modifications ; « Envoyer à l'agent » ; remarque gardée quand le fichier change (code cité) | petit-moyen | 1,5 |
| **L4 — Agrandi et finitions** | arbre de côté en agrandi (Côté : Automatique / Gauche / Droite), ligne « Dossier » de Session vers Fichiers, autres dossiers (179) sous la racine, textes Linux/Windows (Finder → gestionnaire de fichiers / Explorateur) | petit | 1,5 |
| L5 — « ? » cherche dans le contenu (optionnel) | `git grep` dans la file git (dépôt), rien hors dépôt ; résultats par fichier et ligne | petit | 1 |
| L6 — Édition légère B′ (reportée : si elle manque) | CodeMirror 6, ADR, enregistrement automatique sûr (empreinte avant écriture, écriture atomique), conflit dit, lecture seule pendant un tour de l'agent sur le fichier, réglages Tab / tabulation, e2e de conflit | gros | 5 à 7 |

Total B (L1–L4) : **≈ 9 jours**, coloration comprise, sans nouvelle dépendance ; plus 1 pour L5 ;
B′ (reportée) : **+ 5 à 7 jours**. Chaque lot se livre seul et
garde l'app cohérente (L1 seul est déjà utile : voir et ouvrir dans l'éditeur).

## 6. Brouillon d'ADR

> **ADR-0065 — Une vue des fichiers à la demande, comme Claude Code ; lecture seule d'abord**
>
> - **Statut** : proposé
> - **Remplace en partie** : la règle de périmètre « pas d'explorateur de projet »
>   (`docs/features/README.md`, Périmètre ; fiche 052), qui n'était pas un ADR. « Pas d'éditeur de
>   fichiers » est **maintenu** : lecture seule d'abord (décision de l'utilisateur du 2026-11-20),
>   l'édition légère seulement si elle manque, par un nouvel ADR.
>
> **Contexte.** Les utilisateurs veulent voir les fichiers et les ressources du dossier de travail,
> « dans l'esprit de Claude Code […], pas de manière centrale » (l'utilisateur, 2026-11-20).
> Claude Code (relevé sur l'app) offre un onglet Fichiers dans le panneau de droite : filtre, arbre,
> ⌘P, ⇧⌘Y, fichier ouvert dans l'onglet, commentaire sur une ligne, agrandi avec l'arbre de côté ;
> il permet aussi d'éditer.
>
> **Décision.**
> 1. Bobine montre les fichiers des dossiers de la conversation dans un **onglet « Fichiers » du
>    panneau, ouvert à la demande** : jamais d'office, jamais une colonne permanente, jamais un
>    fichier dans la zone de la conversation.
> 2. Un fichier s'y ouvre **en lecture seule** (fil d'Ariane, numéros, coloration syntaxique par
>    highlight.js et les jetons `--syn-*` déjà livrés ; Markdown rendu,
>    images ; HTML dans le navigateur intégré ; le reste dans l'app par défaut ou l'éditeur de
>    l'utilisateur).
> 3. Une remarque posée sur une ou plusieurs lignes est une remarque de diff (fiche 085) : elle
>    part vers l'agent avec les autres, par « Envoyer à l'agent », jamais seule.
> 4. **Le main seul lit le disque** : le renderer demande `(conversation, chemin relatif)` ; le main
>    résout le chemin réel, refuse ce qui sort des dossiers de la conversation (liens symboliques
>    compris), n'affiche jamais un fichier de secret, borne tailles et nombres.
> 5. **Pas de surveillance continue** : relecture à la fin des outils et des tours, au retour sur la
>    fenêtre et à la demande.
> 6. Aucune écriture de fichier par l'interface (édition, création, renommage, déplacement,
>    suppression). Une édition légère, comme celle de Claude Code, demandera un nouvel ADR qui dise
>    comment elle traite les écritures concurrentes de l'agent et l'annulation.
>
> **Conséquences.** + Les besoins « retrouver, regarder, commenter, ouvrir ailleurs » sont couverts
> sans quitter la conversation ; + aucune dépendance nouvelle ; + aucun conflit d'écriture avec
> l'agent. − Corriger une ligne demande l'éditeur ou l'agent ; − une écriture faite hors d'un tour
> n'apparaît qu'au retour sur la fenêtre ou par « Relire » ; − un PDF ne s'affiche pas dans l'app.
>
> **Options écartées.** Palette ⌘P seule (on ne voit que ce qu'on sait nommer) ; explorateur
> permanent et éditeur au centre (modèle « IDE d'abord », refusé) ; édition dès la première
> version (reportée, voir la fiche 271).

Périmètre de `docs/features/README.md` après acceptation : « Bobine n'est **pas un IDE** : la
conversation est au centre. Les fichiers du dossier se regardent à la demande, en lecture seule,
dans l'onglet Fichiers du panneau (ADR-0065, fiche 271) ; toute modification passe par l'agent ou
par l'éditeur de l'utilisateur. »

## 7. Questions restantes, à trancher par l'utilisateur

*Tranché* : édition → lecture seule d'abord ; coloration → dans le premier lot ; commentaires sur
une ligne → gardés.

1. **Secrets** : Claude Code affiche sans doute un `.env` comme un autre fichier ; Bobine le liste
   avec un cadenas sans l'afficher (recommandé), ou fait comme Claude Code ?
2. **« ? » dans le filtre** : recherche dans le contenu (`git grep`, lot 5) dès la première
   version, ou plus tard ?
3. **Fichiers de la conversation** (créés, modifiés, cités) : Claude Code n'en a pas de section ;
   on s'en passe (recommandé, Modifications et les liens le font), ou une section en tête de
   l'arbre ?
4. **Pastilles git** dans l'arbre (M, A) : absentes chez Claude Code d'après les photos ; on s'en
   passe (recommandé) ?
5. **Raccourcis** : ⌘P et ⇧⌘Y comme Claude Code (libres dans `shared/shortcuts.ts`) ?
6. **Onglet retenu** : rouvert avec la conversation comme Terminal (recommandé), ou oublié au
   redémarrage comme l'Aperçu de 052 ?
7. **Ligne « Dossier » de Session** : ouvre l'onglet Fichiers (recommandé, ⌥-clic garde le
   Finder) ?
8. **PDF** : « Ouvrir » avec l'app par défaut en v1 (recommandé) ?

## Critères d'acceptation (option B — à revoir après les réponses)

- [ ] ADR-0065 accepté ; périmètre de `docs/features/README.md` réécrit.
- [ ] Onglet Fichiers à la demande (menu « + », ⌘P, ⇧⌘Y, Session), Agrandir, Fermer ; jamais
      ouvert d'office.
- [ ] Arbre paresseux du dossier de la conversation (worktree compris), cachés listés, ignorés
      visibles et repliés, 2 000 entrées au plus par dossier, liens qui sortent jamais suivis.
- [ ] Filtre par nom ; Réduire tous ; Voir l'arborescence ; Côté de l'arborescence.
- [ ] Fichier ouvert dans l'onglet : nom ✕, fil d'Ariane, numéros, coloration (highlight.js et
      `syntax.css`, langage par extension, 200 Ko au plus, juste en clair et en sombre), retour à la ligne,
      « Lecture seule » ; Markdown, images, HTML → navigateur, PDF → Ouvrir ; secret jamais affiché.
- [ ] Commentaire sur une ligne ou une plage : remarque de diff (vue `file`), envoyée avec
      « Envoyer à l'agent ».
- [ ] Agrandi : fichier et arbre côte à côte.
- [ ] Aucun canal IPC d'écriture ; chemins vérifiés dans le main (tests : `..`, lien qui sort, lien
      vers `.env`, binaire, gros fichier).
- [ ] Relecture fin d'outil, fin de tour, focus, « Relire » ; aucun surveillant.
- [ ] Agent factice : scénario qui écrit un fichier ignoré et une image ; e2e `files`, captures
      claires et sombres regardées.
- [ ] Textes en `fr.json` et `en.json`, variantes Finder / gestionnaire de fichiers / Explorateur.

## Plan

À écrire après les réponses (plus de trois fichiers touchés : main `files/`, IPC partagé, panneau,
`diff-notes`, agent factice, e2e, docs). Aucune nouvelle dépendance pour B.

## Journal

- 2026-11-20 — Fiche créée en proposition : inventaire, besoins, référence, trois options,
  recommandation, brouillon d'ADR-0065, questions, maquettes. Rien n'est codé ni committé.
- 2026-11-20 — Recentrée sur la précision de l'utilisateur (« dans l'esprit de Claude Code […]
  pas de manière centrale ») : onglet à la demande, C écartée.
- 2026-11-20 — Alignée sur cinq photos de Claude Code (desktop) envoyées par l'utilisateur
  (relevé R1–R7) : recommandation « comme Claude Code » (filtre, ⌘P, ⇧⌘Y, fichier ouvert dans
  l'onglet avec fil d'Ariane et coloration, commentaire sur une ligne par les remarques de diff,
  agrandi avec l'arbre de côté) ; ignorés visibles et non grisés ; section « Cette conversation »
  et pastilles git passées en questions ; édition (B′) en question ouverte avec coût et risques ;
  lots refaits et chiffrés ; maquettes refaites.
- 2026-11-20 — Décisions de l'utilisateur : **lecture seule d'abord** (édition légère plus tard si
  elle manque), commentaires sur une ligne gardés, **coloration de code** dans le premier lot (L2,
  highlight.js et `syntax.css` déjà livrés, aucune nouvelle dépendance ; L2 passe à 3 jours).
  Maquettes : menu … sans réglage d'éditeur.

## Décisions de l'utilisateur (2026-11-20)

- Version **1.1** (pas dans la 1.0), développée sur une branche `1.1`.
- **Lecture seule d'abord** ; l'édition légère seulement plus tard, par un nouvel ADR, si elle manque.
- **Coloration du code** dans le premier lot (fichier ouvert).
- **Pas de palette ⌘P** (option A écartée, y compris comme fenêtre à part) : **⌘P ouvre l'onglet
  Fichiers avec le curseur dans le filtre**. Maquettes à corriger en conséquence au début du lot.
