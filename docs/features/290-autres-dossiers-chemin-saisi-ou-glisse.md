# 290 — « Autres dossiers » : un chemin saisi au clavier ou un dossier glissé

- **Statut** : fait (1.2), à relire — moteur et interface ; recette manuelle à faire (voir les
  critères)
- **Dépend de** : 179 (autres dossiers), 287 (fenêtre ouverte à côté du dossier, raison des boutons
  grisés), 145 et 229 (Linux, Windows)
- **Agents** : générique, selon la capacité annoncée `sessionCapabilities.additionalDirectories`
  (OpenCode l'annonce, Bob 2.0.9 non : `docs/agents.md`, ligne `additional-directories`). Rien de
  propre à un agent : la ligne « Autres dossiers » n'existe que pour un agent qui annonce la
  capacité (fiche 179), le champ vit dans cette ligne (ADR-0011).

## Pourquoi

« Autres dossiers » donne à l'agent l'accès à d'autres dépôts que le dossier de travail : c'est le
besoin principal d'un collègue de l'utilisateur. On n'ajoutait un dossier que par la fenêtre du
système (« Ajouter un dossier… ») : lente quand on connaît déjà le chemin, et que les essais
automatiques ne savent pas piloter. Décision de l'utilisateur (2026-11-26) : accepter aussi **un
chemin saisi au clavier ou un dossier glissé**, en plus de la fenêtre du système.

## Moteur (main)

**Un seul chemin de code.** Le renderer ne touche pas au disque : il envoie une chaîne par l'IPC
typé, le main décide. `conversation:addFolder(id, path?)` : sans `path`, la fenêtre du système ;
avec, le chemin saisi ou celui du dossier glissé. Dans les trois cas : `addAdditionalDirectory`
→ `checkExtraFolder` → `folderKey` ; le chemin rendu par la fenêtre du système n'a aucun
passe-droit.

**Rien de synchrone sur le disque.** `realpath`, `stat`, `access`, `opendir` passent par
`fs.promises`, sous un délai de 5 s (`timeoutMs`) : un partage réseau figé rend `timeout`, le main
ne gèle pas. L'appel en cours n'est pas annulé (Node ne le permet pas) : il finit en arrière-plan,
son résultat est ignoré. Les clés du dossier de travail et des dossiers déjà là sont lues avant
l'écriture, sous le même délai (figé : chemin normalisé) ; la section synchrone
(`updateRecord`) ne fait plus qu'une comparaison de chaînes sur la liste fraîche : deux ajouts
concurrents du même dossier ne passent pas tous les deux (essai). `updateRecord` accepte qu'un
changement rende `false` : rien d'écrit ni de prévenu (une lecture).

**Règles** (`src/main/conversations/extra-folder-check.ts`, système injecté) :

| Entrée | Traitement | Raison du refus |
|---|---|---|
| espaces autour, retour à la ligne final, une paire de `"…"` ou `'…'` autour | retirés (collage ; « Copier en tant que chemin d'accès » de Windows met des guillemets). **Accepté : un espace en fin de nom est perdu** | — |
| vide après cela | refusé (garde seulement : l'interface n'envoie rien de vide) | `empty` |
| plus de 4 096 caractères (`MAX_FOLDER_INPUT`, jugé avant tout traitement) | refusé | `tooLong` |
| caractère de contrôle (retour à la ligne au milieu, tabulation, NUL…) | refusé : plusieurs chemins collés, ou rien d'un chemin | `invalid` |
| `file://…` (`localhost` compris) | converti par `fileURLToPath` à la façon de la plateforme (`file:///C:/x` → `C:\x`, `file://serveur/partage` → UNC sous Windows), puis mêmes règles | `invalid` si mal formé |
| `file://serveur/…` hors Windows ; tout autre schéma (`http://`, `smb://`…) | refusé | `notLocal` |
| `~` et `~/…` (`~\…` sous Windows) | le dossier personnel (`os.homedir()`) | — |
| `~autre/…`, chemin relatif (`lib`, `./lib`, `../lib`) | **refusé, jamais résolu** (relatif à quoi ?) | `notAbsolute` |
| Windows : `C:\…`, `C:/…`, `C://…` (un lecteur, pas un schéma), `\\serveur\partage\…` | acceptés, séparateurs rendus en `\` | — |
| Windows : `C:dossier`, `\dossier`, `/c/…` (Git Bash), `\\serveur` seul | refusés | `notAbsolute` |
| macOS, Linux : `C:\…` | pas absolu ; `\` reste un caractère du nom | `notAbsolute` |
| `.`, `..`, séparateurs doublés ou finaux | normalisés (`path.resolve`) | — |
| lien symbolique (jonction NTFS comprise) | **suivi jusqu'au bout** (`realpath` du système) : le dossier réel est retenu, montré et donné à l'agent | — |
| racine du disque, d'un lecteur ou d'un partage (`/`, `C:\`, `\\serveur\partage`), dossier personnel exact (aussi par un lien) | refusé : l'agent aurait `~/.ssh` et les configurations. Un parent du dossier de travail (`~/Dev`) reste accepté, sans avertissement | `tooBroad` |
| rien à ce chemin, ou lien cassé | refusé | `notFound` |
| un fichier | refusé | `notDirectory` |
| sans droit de lecture ou de traversée, chemin sous un dossier fermé (`EACCES`) | refusé | `unreadable` |
| macOS refuse l'accès (`EPERM` : Documents, Bureau, disques externes…) | refusé ; le texte mène à Réglages Système › Confidentialité et sécurité › Fichiers et dossiers | `privacy` |
| vérification plus longue que 5 s | refusé | `timeout` |
| le dossier de travail (aussi enregistré par un lien non résolu, ou une autre casse) | refusé | `isWorkspace` |
| un sous-dossier du dossier de travail | refusé : l'agent y a déjà accès | `insideWorkspace` |
| un dossier déjà dans la liste (aussi par un lien) | refusé | `alreadyAdded` |
| l'agent répond (avant la lecture du disque, et de nouveau à l'écriture) | refusé, rien d'écrit | `busy` |

Pourquoi suivre les liens : l'accès donné à l'agent est celui que l'utilisateur voit dans la liste
(un lien re-pointé plus tard ne déplace pas l'accès en silence) ; un doublon se reconnaît quel que
soit le chemin pris ; la casse réelle est rendue sous macOS et Windows. La liste montre le nom du
dossier réel, pas « via <lien> » (décision du 2026-11-26).

**Retrait** : la même comparaison que l'ajout (`folderKey` : chemin réel, ou normalisé si absent
ou figé). Pendant une réponse : erreur levée, comme avant (bouton déjà désactivé avec sa raison).

**Réponse** (`src/shared/extra-folders.ts`) : `{ ok: true, folder }` (le dossier retenu) ou
`{ ok: false, reason, folder? }` (le chemin compris, pour le montrer) ; `null` si la fenêtre est
annulée. Texte de chaque raison : `sessionTab.folderRefusal.<raison>` (fr, en). Refus noté au
journal (`info`).

**Agent sans la capacité** : pas de refus `unsupported` côté main (décision du 2026-11-26 : la
capacité n'est connue qu'après l'initialisation, et rien n'est envoyé à un agent qui ne l'annonce
pas, fiche 179).

**Glisser un dossier** — ce qu'Electron donne avec `sandbox: true` et `contextIsolation: true`,
sans rien affaiblir : `webUtils.getPathForFile(file)`, appelé **dans le preload**, est l'API
prévue (`File.path` a été retiré d'Electron 32) ; le preload l'expose déjà
(`window.api.files.pathFor`). Relevé le 2026-11-26 avec l'Electron du dépôt (45.4.1), fenêtre
`sandbox`, `contextIsolation`, sans `nodeIntegration`, dépôt par le vrai glisser-déposer de
Chromium (`Input.dispatchDragEvent`, celui de `ui.dragFiles`) : un dossier arrive comme un `File`
(`type` vide), `getPathForFile` rend son chemin absolu ; un lien rend le chemin **du lien**, que le
main suit.

## Interface

Maquette validée (avec retouches) par l'expert UX et le tech lead le 2026-11-26 :
`docs/maquettes/290-autres-dossiers-chemin.html`, captures à la largeur réelle du panneau
(320 px par défaut, 280 px au minimum) dans `docs/maquettes/290-autres-dossiers-chemin/`
(`<état>-<largeur>-<clair|sombre>.png` : `vide`, `saisie`, `refus`, `refus-relatif`, `ajoute`,
`depot`, `pendant-tour`).

`panel/FolderPathField.tsx`, sous la liste de `panel/SessionFolders.tsx` ; il **remplace** la
ligne « Ajouter un dossier… » :
- champ toujours visible, sans icône en tête ; invite « Chemin d'un dossier… » (police
  d'interface), chemin saisi en chasse fixe ; nom accessible « Chemin d'un autre dossier » ;
  focus : le `:focus-visible` de l'app ; largeur bornée à 420 px dans le panneau agrandi ;
- bouton `↵` « Ajouter ce dossier » (24 px), seulement si le champ n'est pas vide ; bouton
  « Choisir un dossier… » (fenêtre du système, infobulle `Tip`, `data-testid` gardé :
  `session-add-folder`) ;
- Entrée envoie ; **Entrée sur un champ vide ne fait rien** ; Échap vide le champ s'il a du texte,
  sinon l'évènement passe (raccourcis du panneau) ;
- refus : message sous le champ (icône), relié par `aria-describedby`, annoncé (`role="status"`,
  poli), `aria-invalid` seulement si le chemin venait du champ ; pas de bord rouge ; le texte reste,
  le message disparaît à la première frappe ; chemin compris passé à la ligne
  (`overflow-wrap: anywhere`). Un refus de la fenêtre du système ou d'un dépôt s'affiche au même
  endroit ;
- ajouté : un seul signal — fond vert bref sur le dossier et « Ajouté ; la session de l'agent
  repart. », effacés à la frappe ou après 4 s ; champ vidé si le chemin venait du champ ; le focus
  ne bouge pas (il reste dans le champ après une saisie, n'y va pas après un clic) ;
- pendant un tour, et pendant un ajout (la session repart) : champ `readOnly` + `aria-disabled`,
  atteignable au Tab, raison dans l'infobulle et la description (`aria-description`, comme
  `ReasonButton`) ; boutons par `ReasonButton` ; aucune ligne de plus ; le texte en cours reste ;
- dépôt : la zone est le champ lui-même (bord en tirets, « Déposer pour ajouter »), rien ne bouge
  autour (les boutons sont masqués par `visibility`) ;
- changement de conversation : le champ est vidé (composant remonté), pas de brouillon par
  conversation.

**Décisions sur le dépôt** (2026-11-26, une règle et un essai chacune) :
- plusieurs éléments déposés : « Un seul dossier à la fois. », rien d'ajouté ;
- une ligne de l'onglet Fichiers (`FILE_DRAG_TYPE`), du texte, une adresse (`text/uri-list` sans
  fichier) : ignorés, pas de zone de dépôt, rien d'inséré dans le champ (`dragover` refusé). Un
  `file://` compte quand il est saisi ou collé ; glissé, seul un élément « Fichiers » du système
  compte ;
- pendant un tour : zone de dépôt désactivée, rien d'ajouté ;
- zone de dépôt de la conversation (`useFileDrop` sur `.main`) : le panneau en est un voisin, pas
  un enfant ; le champ arrête aussi la propagation. Un dossier lâché sur le champ n'est jamais
  joint au message ; un fichier lâché sur la conversation n'ajoute jamais de dossier.

**Hors périmètre** : complétion des chemins dans le champ.

## Critères d'acceptation

- [x] Un seul chemin de vérification pour la fenêtre du système, la saisie et le glisser ; un
  dossier rendu par la fenêtre est refusé pour les mêmes raisons qu'un chemin saisi (essais du
  canal : dossier de travail par un lien, trop large, sous-dossier).
- [x] Chaque ligne du tableau des règles a son essai unitaire (texte : POSIX et `path.win32` ;
  disque : simulé — partage figé compris — puis vrai dossier jetable avec lien, lien cassé,
  fichier, `chmod 000`, racine, dossier personnel).
- [x] Rien de synchrone sur le disque pour un chemin tapé ; délai borné (`timeout`) ; ajout
  concurrent : un seul passe (essai).
- [x] Pendant un tour : `busy` dans le résultat, rien d'écrit (essais : avant la lecture du disque,
  et tour commencé pendant la vérification).
- [x] Retrait : même comparaison que l'ajout (essai).
- [x] Interface selon la maquette, textes en clés i18n (fr, en), CHANGELOG fr et en.
- [x] Refus venu de la fenêtre du système affiché comme les autres (essai du composant).
- [x] Dépôt : plusieurs éléments, ligne de l'onglet Fichiers, texte, adresse, pendant un tour
  (essais du composant ; e2e : plusieurs éléments et pendant un tour).
- [x] Testé contre l'agent factice (`--dossiers-en-plus`, scénario `dossiers` qui répond avec les
  dossiers reçus ; suite e2e `dossiers`, clair et sombre) : chemin relatif refusé avec sa raison,
  chemin complet ajouté et reçu par l'agent, dossier glissé ajouté, plusieurs éléments refusés,
  panneau à 280 px, fenêtre du système (dossier réel, ouverte à côté), pendant un tour.
- [ ] Recette manuelle (tech lead) : glisser depuis le vrai Finder.
- [ ] Recette manuelle (tech lead) : demande d'accès de macOS (`~/Documents/x`).
- [ ] Recette réelle avec OpenCode (tech lead) : chemin tapé, l'agent lit un fichier du dossier au
  tour suivant.

## Plan

1. Moteur : `shared/extra-folders.ts`, `main/conversations/extra-folder-check.ts`,
   `additional-directories.ts` (ajout et retrait), `additional-directories-ipc.ts`,
   `shared/ipc.ts`, `preload/api.ts`, `ConversationManager.updateRecord` (`false` : rien écrit).
2. Interface : `panel/FolderPathField.tsx`, `panel/SessionFolders.tsx`, `panel/SessionTab.tsx`,
   `session-tab.css`, clés `sessionTab.*` (fr, en).
3. Essais : unitaires (`extra-folder-check`, `additional-directories`,
   `additional-directories-ipc`, `FolderPathField`, `SessionFolders`) ; e2e `dossiers` étendue,
   sources ajoutées au catalogue.
4. Docs : fiche, index, `architecture.md`, CHANGELOG fr et en.

Aucune dépendance nouvelle. Pas d'ADR : la règle d'architecture (le main seul lit le disque) est
appliquée telle quelle.

## Journal

- 2026-11-26 — Temps 1 : fiche, règles, main, essais, maquette (420 px). `addAdditionalDirectory`
  rend un résultat au lieu de filtrer en silence. Relevé Electron du glisser par un script jetable
  hors dépôt. e2e `dossiers` ajustée : le dossier listé est le chemin réel (`/var/folders/…` →
  `/private/var/folders/…` sous macOS).
- 2026-11-26 — Relecture du tech lead et d'un BA, puis de l'expert UX ; décisions intégrées :
  - moteur : `tooBroad`, `insideWorkspace`, lecture du disque asynchrone et bornée (`timeout`),
    `busy` dans le résultat, `file://` accepté (autres schémas : `notLocal`), `privacy` (macOS),
    retrait par la même comparaison ; chemin relatif toujours refusé ; pas de « via <lien> » ;
    pas de `unsupported` ;
  - interface : champ toujours visible, maquette refaite à 320 et 280 px, décisions sur le dépôt,
    Échap, changement de conversation, pas de complétion.
  - Écart : `updateRecord` (gestionnaire à son plafond de lignes) accepte qu'un changement rende
    `false` plutôt qu'une méthode de lecture de plus.
- 2026-11-26 — Interface faite. Défaut trouvé par l'e2e et corrigé à la cause : pendant que la
  session repart après un ajout, l'instantané de l'agent ne dit pas encore la capacité ; la ligne
  passait à « Non transmis » et le champ disparaissait (avec la ligne « Ajouté »). La dernière
  capacité vue d'un agent prêt est gardée pour la conversation (`panel/folder-capability.ts`,
  essai). Vérifié : `./scripts/verify` vert ; `pnpm build` ; suites nommées en clair et en
  sombre : `dossiers`, `session`, `attachments`, `aparte`, `pr-ci`, `pilote` (celles du catalogue
  dont les sources touchent l'onglet Session ou le dépôt de fichiers) ; suite complète laissée à la
  branche d'intégration (consigne du 2026-11-26).
- Non vérifié : glisser depuis le vrai Finder, Explorateur ou gestionnaire de fichiers Linux ;
  demande d'accès de macOS ; essais du vrai disque sous Windows (jonction) et Linux (casse), qui
  tournent en CI, pas sur ce Mac ; recette avec un vrai OpenCode.
