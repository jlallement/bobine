# 271 — Vue des fichiers du dossier de travail

- **Statut** : fait (L1 à L4) — 1.1, sur la branche `1.1` ; L5 (« ? » dans le contenu) plus tard.
  Décisions : `docs/features/271-questions.md` ; ADR-0065 ; maquettes
  `docs/maquettes/271-vue-des-fichiers.html`. Écarts au plan : voir le journal du 2026-11-20 (soir)
- **Dépend de** : 005 et 126 (`@` et sa recherche), 052 (liens de fichiers, aperçu `.md`), 064 et
  114 (aperçu HTML cloisonné), 155 (exclusions de l'agent), 156 (« Ouvrir dans <éditeur> »), 021,
  161 et 265 (onglet Modifications), 166 et 179 (onglet Session, autres dossiers), 224 (onglet
  Documents de l'espace Discussion), 036 et 260 (worktrees, travaux délégués)
- **Agents** : tous. Bobine lit le disque et git elle-même ; rien n'est demandé à l'agent ni
  envoyé à l'agent, sauf ce que l'utilisateur joint avec `@` (déjà le cas). Rien de propre à un
  agent (ADR-0011), à part les exclusions de la fiche 155 qui viennent déjà du profil.
- **Décision à remplacer en partie** : « Bobine n'est pas un IDE : pas d'éditeur de fichiers, pas
  d'explorateur de projet » (`docs/features/README.md`, section Périmètre ; fiche 052). Cette règle
  n'est écrite dans aucun ADR : elle vit dans l'index et la fiche 052. Remplacée par
  **ADR-0065** (accepté le 2026-11-20, `docs/adr/0065-vue-des-fichiers-a-la-demande.md`).

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
  « + », **⌘P** (ouvre l'onglet au besoin, le curseur dans le filtre), **⇧⌘Y** (voir / cacher
  l'arborescence), un lien de fichier du fil. La ligne « Dossier » de l'onglet Session garde le
  Finder (Q3). Agrandir et Fermer comme les autres onglets. Jamais ouvert d'office.
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
  rendu, comme l'Aperçu de 052 (qui devient ce même écran), bascule « Source » ; image et SVG :
  affichés ; HTML : source colorée et « Ouvrir dans le navigateur » (064) ; PDF, Office, binaire :
  « Ouvrir » avec l'app par défaut.
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
  dossiers de la conversation (liens symboliques compris, comme 052 et 114) ; lecture bornée (1 Mo
  affiché, coloration sous 200 Ko, binaire détecté) ; jamais d'ouverture d'un exécutable. **Un
  fichier de secret (`.env`, clé) s'affiche comme les autres** (décision Q8) : un écran partagé ou
  une capture peut le montrer ; les essais et captures e2e n'utilisent que des valeurs factices.
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
| **L1 — Onglet et arbre** | IPC `files:list(id, racine, dossier)` (un niveau, trié, borné à 2 000 entrées, liens marqués), contrôles de chemin dans le main ; onglet Fichiers (menu « + », Agrandir, Fermer), arbre paresseux (cachés listés, ignorés atténués, point sur les fichiers modifiés par la conversation, marque « invisible pour l'agent »), filtre par nom en liste plate (rang de `@`, `chemin:ligne`), Réduire tous, ⌘P (curseur dans le filtre), ⇧⌘Y ; état retenu par conversation ; relecture fin d'outil, fin de tour, focus, « Relire » ; agent factice et e2e `files` | moyen | 3 |
| **L2 — Fichier ouvert, coloré** | IPC `files:read(id, racine, chemin)` (1 Mo, binaire, `O_NOFOLLOW`) ; vue du fichier dans l'onglet (nom ✕, fil d'Ariane, numéros, retour à la ligne, « Lecture seule », précédent / suivant) ; **coloration** : highlight.js et `syntax.css` déjà livrés, langage par extension, nom et `#!`, découpe en lignes, 200 Ko au plus ; Markdown rendu avec bascule « Source » (remplace l'Aperçu de 052), images, SVG en image, HTML en source avec « Ouvrir dans le navigateur », PDF → Ouvrir ; ⌃G, ⌘F dans le fichier ; menu contextuel et … (éditeur, app par défaut, Finder, Mentionner, copier les chemins, Voir le diff), glisser vers la saisie ; **liens du fil** vers l'onglet à la ligne (⌘-clic éditeur, ⌥-clic Finder) | moyen | 3,5 |
| **L3 — Commentaire sur une ligne** | « + » au survol et au clavier, Maj-clic pour une plage, bulle « Ligne N » ; `DiffNote` vue `file` ; remarques en attente communes avec Modifications, barre en tête de l'onglet ; « Envoyer à l'agent » ; remarque qui suit son code quand le fichier change | petit-moyen | 1,5 |
| **L4 — Agrandi et finitions** | arbre de côté en agrandi (Côté : Automatique / Gauche / Droite), autres dossiers (179) en racines, « Parcourir les fichiers » sur la carte d'un travail délégué, textes Linux / Windows (Finder → gestionnaire de fichiers / Explorateur) | petit | 1,5 |
| L5 — « ? » cherche dans le contenu (**plus tard**, Q1) | `git grep` dans la file git (dépôt), rien hors dépôt ; résultats par fichier et ligne | petit | 1 |
| L6 — Édition légère B′ (reportée : si elle manque) | CodeMirror 6, ADR, enregistrement automatique sûr (empreinte avant écriture, écriture atomique), conflit dit, lecture seule pendant un tour de l'agent sur le fichier, réglages Tab / tabulation, e2e de conflit | gros | 5 à 7 |

Total de la 1.1 (L1–L4, décision Q1) : **≈ 9,5 jours** (L2 prend les liens du fil, Q11), coloration
comprise, sans nouvelle dépendance ; L5 plus tard (1 jour) ;
B′ (reportée) : **+ 5 à 7 jours**. Chaque lot se livre seul et
garde l'app cohérente (L1 seul est déjà utile : voir et ouvrir dans l'éditeur).

## 6. ADR

**ADR-0065 — Une vue des fichiers à la demande, comme Claude Code ; lecture seule d'abord**,
accepté le 2026-11-20 : `docs/adr/0065-vue-des-fichiers-a-la-demande.md`. Le brouillon qui était
ici y est repris, ajusté aux décisions (secrets affichés, Q8).

Périmètre de `docs/features/README.md`, réécrit le même jour : « Bobine n'est **pas un IDE** : la
conversation est au centre. Les fichiers du dossier se regardent à la demande, en lecture seule,
dans l'onglet Fichiers du panneau (ADR-0065, fiche 271) ; toute modification passe par l'agent ou
par l'éditeur de l'utilisateur. »

## 7. Questions — tranchées le 2026-11-20

Les 62 questions et leurs réponses sont dans `docs/features/271-questions.md`. En bref :
Q1 A (L1 à L4 ; L5 plus tard), Q2 A (tout retenu par conversation), **Q3 C** (la ligne « Dossier »
de Session garde le Finder), Q4 A (Documents inchangé), Q5 A (ignorés atténués), Q6 A (point sur
les fichiers modifiés), Q7 A (dossier de la conversation ; « Parcourir les fichiers » sur la carte
d'un travail), **Q8 C** (un secret s'affiche comme un autre fichier), Q9 A (un seul fichier,
précédent / suivant), Q10 A (Markdown rendu, bascule « Source »), Q11 A (lien du fil → onglet
Fichiers à la ligne) ; Q12 à Q62 validées en bloc (Q15, Q23, Q57, Q60 ajustées à Q3 et Q8).

## Critères d'acceptation

- [x] ADR-0065 accepté ; périmètre de `docs/features/README.md` réécrit.
- [x] Onglet Fichiers à la demande (menu « + », ⌘P avec le curseur dans le filtre, ⇧⌘Y, lien du
      fil), Agrandir, Fermer ; jamais ouvert d'office ; la ligne « Dossier » de Session inchangée.
- [x] État retenu par conversation au redémarrage : onglet, fichier ouvert et position, dossiers
      dépliés (stockage essayé en unitaire ; pas de relance de l'app en e2e).
- [x] Arbre paresseux du dossier de la conversation (worktree compris) et des autres dossiers
      (179) ; cachés listés (`.git`, `.DS_Store` jamais) ; ignorés visibles, repliés, atténués ;
      point sur les fichiers modifiés par la conversation ; marque « invisible pour l'agent » ;
      2 000 entrées au plus par dossier ; liens qui sortent jamais suivis. Plusieurs racines :
      essayées en unitaire (`treeRows`, canaux), pas en e2e.
- [x] Filtre : liste plate classée (rang de `@`), `chemin:ligne`, ↑ ↓ ↵ ⌘↵ ⇧↵ Échap ; Réduire
      tous ; Voir l'arborescence ; Côté de l'arborescence.
- [x] Fichier ouvert : nom ✕, fil d'Ariane, numéros, coloration (200 Ko au plus, juste en clair et
      en sombre), retour à la ligne, « Lecture seule », précédent / suivant, ⌃G, ⌘F ; Markdown
      rendu avec « Source » ; images et SVG affichés ; HTML en source ; PDF et binaires → Ouvrir ;
      1 Mo affiché au plus, au-delà tronqué et dit ; un `.env` s'affiche comme un autre fichier.
      ⌘F, le focus dans le fichier : recherche ligne à ligne (↵ suivant, ⇧↵ précédent).
- [x] Liens du fil : fichier texte, image ou Markdown ouvert dans l'onglet à la ligne ; ⌘-clic
      éditeur ; ⌥-clic Finder ; HTML et PDF inchangés. L'onglet Aperçu de 052 ne sert plus qu'aux
      règles actives (fiche 056), qui peuvent être hors du dossier.
- [x] Actions : menu contextuel et … (éditeur, app par défaut sauf exécutable, Finder, Mentionner,
      copier le chemin relatif et absolu, Voir le diff) ; glisser vers la saisie = mention.
- [x] Commentaire sur une ligne ou une plage : remarque de diff (vue `file`), même file que
      Modifications, envoyée avec « Envoyer à l'agent » ; suit son code quand le fichier change.
- [x] Agrandi : fichier et arbre côte à côte (à droite en Automatique).
- [x] « Parcourir les fichiers » sur la ligne d'un travail délégué (Modifications › Travaux).
- [x] Aucun canal IPC d'écriture ; chemins vérifiés dans le main (tests : `..`, chemin absolu,
      octet nul, lien qui sort, binaire, gros fichier, racine inconnue) ; journal sans contenu.
- [x] Relecture fin d'outil, fin de tour, focus, « Relire » ; aucun surveillant.
- [x] Clavier et lecteur d'écran : `role="tree"`, flèches, Début / Fin, annonce du fichier ouvert.
- [x] Agent factice : scénario `fichiers` (fichier modifié, sortie ignorée, `.env` **aux valeurs
      factices**) ; e2e `files` et `links` mis à jour, captures claires et sombres regardées.
- [x] Textes en `fr.json` et `en.json`, variantes Finder / gestionnaire de fichiers / Explorateur ;
      CHANGELOG fr et en ; `docs/architecture.md`.

## Plan

Quatre lots, chacun livré seul sur `1.1` (`./scripts/verify` et `pnpm e2e --changed` verts avant
chaque commit de lot) ; **aucune nouvelle dépendance**. Au début de L1 : maquettes déjà corrigées
(fait le 2026-11-20).

**L1 — Onglet et arbre (3 j)**

1. `src/shared/files-ipc.ts` : types `FileEntry` (nom, type, taille, ignoré, exclu, lien, cible
   dans les racines), `FilesListRequest`, canaux `files:list`, `files:roots`.
2. `src/main/files/file-tree.ts` (+ test) : racines d'une conversation (dossier ou worktree,
   autres dossiers de la 179), résolution `realpath` et refus hors racine, lecture d'un niveau
   (`readdir` + `lstat`), tri naturel, borne 2 000, ignorés par `git check-ignore --stdin` dans la
   file git (`gitRun`) ou `ignore` hors dépôt, exclusions de la fiche 155 ; `src/main/files/ipc.ts`
   branché dans `main/ipc.ts` ; preload.
3. `src/shared/panel.ts` : onglet `files` ; `panel-tabs.ts` : menu « + », jamais dans
   `panelAutoOpens` ; `shortcuts.ts` : `CmdOrCtrl+P`, `CmdOrCtrl+Shift+Y`.
4. `src/renderer/src/components/files/` : `FilesTab.tsx`, `FileTree.tsx` (virtualisé, ARIA
   `tree`), `FileFilter.tsx` (rang de `workspace-files.ts` exposé par `workspace:searchFiles`),
   `useFileTree.ts` (état par conversation, `localStorage`, relecture sur les évènements de fin
   d'outil, de tour et de focus) ; point « modifié » tiré des diffs ACP déjà chargés.
5. Agent factice : scénario `fichiers` (fichier ignoré, image, `.env` factice) ; e2e `files`.

**L2 — Fichier ouvert, coloré (3,5 j)**

1. `files:read` dans `file-tree.ts` (1 Mo, `O_NOFOLLOW`, binaire par octet nul, encodage,
   images en `data:` bornées à 20 Mo).
2. `src/renderer/src/code-lines.ts` (+ test) : `hljs.highlight` par langage (table extension,
   nom, `#!`), découpe en lignes avec `span` refermés et rouverts.
3. `FileView.tsx` (barre, fil d'Ariane, numéros, retour à la ligne, ⌃G, ⌘F local, précédent /
   suivant), `MarkdownView` repris de `DocumentTab` avec bascule « Source », `ImageView`.
4. Menu contextuel et … partagés (`FileActions.tsx`) : `openInEditor` (156), `files:openLink`
   (052), mention vers `ComposerInbox`, copier, « Voir le diff » vers `ChangesTab`.
5. Liens du fil : `FileLinksContext` ouvre l'onglet Fichiers ; `DocumentTab` et l'onglet
   `document` retirés ; e2e `links` mis à jour.

**L3 — Commentaire sur une ligne (1,5 j)**

1. `shared/diff-notes.ts` : vue `file` ; `diffFeedback` cite chemin, racine, lignes et code.
2. Colonne « + » et bulle reprises de `DiffView` dans `FileView` ; barre « N remarques » commune
   (`ReviewNotes` / `ChangesTab`) ; ancrage par le code cité à la relecture.
3. e2e `files` : remarque, plage, envoi, fichier modifié entre-temps.

**L4 — Agrandi et finitions (1,5 j)**

1. Agrandi (⇧⌘J) : fichier et arbre côte à côte, Côté Automatique / Gauche / Droite retenu.
2. Autres dossiers en racines ; « Parcourir les fichiers » sur la carte d'un travail délégué
   (`ChildrenView`, carte de travail) ; libellés Linux / Windows.
3. Docs : `docs/architecture.md`, `docs/README.md`, CHANGELOG fr et en, fiche close.

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
- 2026-11-20 — Réponses de l'utilisateur aux 62 questions (`271-questions.md`) : L1 à L4 dans la
  1.1, L5 plus tard ; **ligne « Dossier » de Session inchangée** (Q3 C) ; **secrets affichés comme
  les autres fichiers** (Q8 C : écran partagé et captures peuvent les montrer ; captures e2e aux
  valeurs factices seulement) ; le reste comme recommandé. ADR-0065 accepté, périmètre de l'index
  réécrit, lots, critères et plan mis à jour, maquettes corrigées (palette retirée, ⌘P → filtre,
  ligne Dossier inchangée, `.env` affiché).
- 2026-11-20 (soir) — **L1 à L4 faits**, à la demande de l'utilisateur (« en autonomie »).
  - Main : `files/file-tree.ts` (racines, chemins réels, un niveau, ignorés par
    `git check-ignore` — sans `-z`, qui exige `--stdin` —, lecture bornée en `O_NOFOLLOW`),
    `files/files-ipc.ts` (six canaux de lecture, classés sûrs pour la lecture seule de la fiche
    196) ; un lien de fichier du fil rend `file` pour le texte, le code, le Markdown et les images.
  - Renderer : `components/files/` ; ⌘P et ⇧⌘Y dans le menu Affichage (`files`, `files-tree`) ;
    remarques `DiffNote` vue `file` (message « Remarques sur le code ») ; mention par la boîte de la
    saisie ; « Parcourir les fichiers » dans Modifications › Travaux.
  - Agent factice : scénario `fichiers`. e2e : suite `files` (nouvelle), `links` mise à jour (un
    `.md` et le code s'ouvrent dans l'onglet Fichiers ; un script s'y lit au lieu du Finder, Q53).
  - **Écarts au plan** : coloration par la transformation de `rehype-highlight` (lowlight,
    highlight.js 11.11 déjà livré avec le fil), pas par `highlight.js` en direct : la dépendance
    directe (11.12) n'est importée nulle part, l'importer aurait livré une seconde copie et changé
    les avis de licence ; ⌘F, le focus dans le fichier, cherche dans le fichier ligne à ligne
    (la ligne trouvée est amenée et éclairée, sans surligner le mot) ; ⌃G pour aller à une ligne sur macOS, `chemin:ligne` dans le filtre partout (hors
    macOS, Ctrl+G est « suivant » de la recherche) ; pas de vraie liste virtualisée, mais
    `content-visibility` sur les lignes de l'arbre et du code ; l'onglet Aperçu (052) reste pour
    les règles actives ; une remarque sur un autre dossier cite son chemin absolu ; hors dépôt git,
    rien n'est marqué ignoré.
  - Essais : unitaires (`file-tree`, `files-ipc`, `code-lines`, `files-state`, `file-notes`,
    `FileTree`, `useFileLinks`) ; `./scripts/verify` vert ; `pnpm e2e --changed` (236 tâches) : vert sauf
    `panel` (le menu « + » propose désormais Fichiers, attente mise à jour) et `files` (essai de ⌘F
    écrit pendant la passe), relancés verts avec `links`, `history` et `degrade-haut` ; captures
    `271-*` regardées en clair et en sombre. Linux et Windows : non essayés (textes et raccourcis
    prévus, `CmdOrCtrl`).

- 2026-11-20 (nuit) — **Revue UX indépendante, 26 points, tous corrigés** (demande du tech
  lead : rien en « plus tard »).
  - ⌘F ne répond dans le fichier que si du code est affiché (sinon la recherche du fil) ; ⌘P et
    ⇧⌘Y désactivés dans l'espace Discussion (canal `app:setSpace`, menu reconstruit).
  - Un seul ✕ : celui de l'onglet ramène à l'arbre, puis ferme ; un seul menu de vue (…) au niveau
    de l'onglet (filtrer, arborescence, côté, réduire, retour à la ligne, « Aller à la ligne… ⌃G »,
    relire), dans l'en-tête du fichier quand il est affiché ; les actions du fichier dans leur
    propre menu (⋮), libellé « Actions sur … ».
  - Code : retrait suspendu en retour à la ligne (indentation + 2ch, tabulation = 4) ; lignes
    commentées marquées d'une barre d'accent dans la gouttière ; la ligne demandée n'est éclairée
    que le temps d'un éclair ; la gouttière prend la teinte de sa ligne ; un seul arrêt de
    tabulation dans la gouttière (↑ ↓, + ou ↵ pour remarquer).
  - Recherche ⌘F : premier résultat dès la frappe, « 1 sur 3 », boutons ↑ ↓ ✕, barre au-dessus du
    code (jamais par-dessus). « Aller à la ligne » dans la même barre.
  - Filtre : 80 ms après la dernière frappe, derniers résultats gardés pendant la recherche,
    « aucun » seulement après la réponse, numéro de recherche contre les réponses périmées
    (`useFileFilter`) ; premier résultat présélectionné (`aria-selected`, `combobox`) ; ⌘↵ et ⇧↵
    aussi sur un résultat qui a le focus ; pastille ⌘P dans le champ ; une lettre tapée dans
    l'arbre part au filtre ; Échap sur un filtre vide rend le clavier à la zone de saisie.
  - Barre des remarques : « N remarques · X sur ce fichier, Y sur d'autres fichiers, Z sur des
    diffs », « Voir » (Modifications), corbeille avec « Annuler » pendant 6 s.
  - Rendu / Source retenu pour la session, en contrôle segmenté ; « Lecture seule » en pastille à
    droite du fil d'Ariane ; « Voir le diff » dans le bandeau « Modifié à … ».
  - Exécutable : drapeau `executable` dans `FileEntry` et la lecture ; jamais « Ouvrir avec l'app
    par défaut » (menu, fiche d'un binaire).
  - Côte à côte selon la largeur de l'onglet (`ResizeObserver`), plus celle de la fenêtre. Fil
    d'Ariane : le nom d'abord, dossiers du milieu en « … », ceux qui restent cèdent par la gauche ;
    panneau de moins de 440 px, le fil d'Ariane passe sur sa propre ligne.
  - Menu contextuel au pointeur, ou sous la ligne par Maj+F10 et la touche Menu ; « Réduire » dans
    le menu d'un dossier déplié. Pas d'infobulle native sur les lignes : œil barré avec « Invisible
    pour l'agent (.bobignore) », point « Modifié dans cette conversation » ; la ligne s'annonce
    entière au lecteur d'écran.
  - Icône de l'onglet : dossier, puis celle du fichier ouvert. Vocabulaire : « Mentionner dans la
    zone de saisie ». Le contenu n'est recoloré que si le fichier a changé (date et taille).
  - **Écart à Q51** : « Mentionner » et le glisser d'une ligne vers la saisie joignent le fichier
    en **pièce jointe** (puce sous la zone de saisie, comme le trombone), pas un texte `@chemin`
    dans le message — même effet pour l'agent, et la confirmation des fichiers exclus (fiche 155)
    s'applique.
  - Essais : unitaires (`useFileFilter`, `CodeView`, `useFilesTabTitle`, `files-state` ⌘F, menu,
    `file-tree` exécutable) ; e2e `files` refaite (≈ 40 vérifications), captures `271-arbre`,
    `-filtre`, `-menu`, `-actions`, `-image`, `-binaire`, `-disparu`, `-retour-ligne`,
    `-recherche`, `-remarque`, `-markdown-source`, `-chemin-long` (panneau à 360 px), `-agrandi`,
    en clair et en sombre, et en anglais (`--lang en`).

## Décisions de l'utilisateur (2026-11-20)

- Version **1.1** (pas dans la 1.0), développée sur une branche `1.1`.
- **Lecture seule d'abord** ; l'édition légère seulement plus tard, par un nouvel ADR, si elle manque.
- **Coloration du code** dans le premier lot (fichier ouvert).
- **Pas de palette ⌘P** (option A écartée, y compris comme fenêtre à part) : **⌘P ouvre l'onglet
  Fichiers avec le curseur dans le filtre**. Maquettes corrigées le 2026-11-20.
- **Réponses aux questions (2026-11-20, `271-questions.md`)** : L1 à L4 dans la 1.1, L5 plus
  tard ; état de l'onglet retenu par conversation ; **la ligne « Dossier » de Session garde le
  Finder** ; Documents inchangé dans l'espace Discussion ; ignorés visibles, repliés, atténués ;
  point discret sur les fichiers modifiés ; dossier de la conversation affichée, plus « Parcourir
  les fichiers » sur la carte d'un travail ; **un `.env` ou une clé s'affiche comme les autres
  fichiers** (conséquence assumée : écran partagé, captures ; les captures e2e ne montrent que des
  valeurs factices) ; un seul fichier ouvert, précédent / suivant ; Markdown rendu avec bascule
  « Source » ; un lien de fichier du fil ouvre l'onglet à la ligne (⌘-clic éditeur, ⌥-clic
  Finder). Q12 à Q62 validées en bloc.
