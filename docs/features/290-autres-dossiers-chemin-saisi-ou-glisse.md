# 290 — « Autres dossiers » : un chemin saisi au clavier ou un dossier glissé

- **Statut** : en cours (1.2) — temps 1 fait (main, essais unitaires, maquette) ; temps 2
  (interface) attend la validation de la maquette
- **Dépend de** : 179 (autres dossiers), 287 (fenêtre ouverte à côté du dossier, raison des boutons
  grisés), 145 et 229 (Linux, Windows)
- **Agents** : générique, selon la capacité annoncée `sessionCapabilities.additionalDirectories`
  (OpenCode l'annonce, Bob 2.0.9 non : `docs/agents.md`, ligne `additional-directories`). Rien de
  propre à un agent : la ligne « Autres dossiers » n'existe que pour un agent qui annonce la
  capacité (fiche 179), la saisie et le dépôt vivent dans cette ligne (ADR-0011).

## Pourquoi

« Autres dossiers » donne à l'agent l'accès à d'autres dépôts que le dossier de travail : c'est le
besoin principal d'un collègue de l'utilisateur. Aujourd'hui on n'ajoute un dossier que par la
fenêtre native (« Ajouter un dossier… ») : lente quand on connaît déjà le chemin, et que les essais
automatiques ne savent pas piloter. Décision de l'utilisateur (2026-11-26) : accepter aussi **un
chemin saisi au clavier ou un dossier glissé**, en plus de la fenêtre native.

## Décisions (temps 1)

**Un seul chemin de code.** Le renderer ne touche pas au disque : il envoie une chaîne par l'IPC
typé, le main décide. `conversation:addFolder(id, path?)` : sans `path`, la fenêtre native ; avec,
le chemin saisi ou celui du dossier glissé. Dans les deux cas, la même fonction
(`addAdditionalDirectory` → `checkExtraFolder` → `sameFolder`) ; le chemin rendu par la fenêtre
native n'a aucun passe-droit.

**Règles** (`src/main/conversations/extra-folder-check.ts`, pures, système injecté) :

| Entrée | Traitement | Raison du refus |
|---|---|---|
| espaces autour, retour à la ligne final, une paire de `"…"` ou `'…'` autour | retirés (collage ; « Copier en tant que chemin d'accès » de Windows met des guillemets) | — |
| vide après cela | refusé | `empty` |
| plus de 4 096 caractères (`MAX_FOLDER_INPUT`, jugé avant tout traitement) | refusé | `tooLong` |
| caractère de contrôle (retour à la ligne au milieu, tabulation, NUL…) | refusé : plusieurs chemins collés, ou rien d'un chemin | `invalid` |
| `~` et `~/…` (`~\…` sous Windows) | le dossier personnel (`os.homedir()`) | — |
| `~autre/…` | refusé (pas de dossier personnel d'un autre compte) | `notAbsolute` |
| chemin relatif (`lib`, `./lib`, `../lib`) | **refusé, jamais résolu** : relatif à quoi ? le dossier courant du main ne veut rien dire pour l'utilisateur, et rien dans la saisie ne montre le dossier de travail comme base | `notAbsolute` |
| Windows : `C:\…`, `C:/…`, `\\serveur\partage\…` | acceptés, séparateurs rendus en `\` | — |
| Windows : `C:dossier` (relatif au lecteur), `\dossier` (racine du lecteur courant), `/c/…` (Git Bash), `\\serveur` seul | refusés | `notAbsolute` |
| macOS, Linux : `C:\…` | pas absolu ; `\` reste un caractère du nom, jamais un séparateur | `notAbsolute` |
| `.`, `..`, séparateurs doublés ou finaux | normalisés (`path.resolve`) | — |
| lien symbolique (jonction NTFS comprise) | **suivi jusqu'au bout** (`realpathSync.native`) : le dossier réel est retenu, montré et donné à l'agent | — |
| rien à ce chemin, ou lien cassé | refusé | `notFound` |
| un fichier | refusé | `notDirectory` |
| dossier sans droit de lecture ou de traversée, chemin sous un dossier fermé (`EACCES`), liste qui ne s'ouvre pas (protection de macOS : `access` dit oui, `opendir` non) | refusé | `unreadable` |
| le dossier de travail (aussi par un lien, une autre casse) | refusé au moment d'écrire la liste | `isWorkspace` |
| un dossier déjà dans la liste (aussi par un lien, une autre casse) | refusé au moment d'écrire la liste | `alreadyAdded` |

Pourquoi suivre les liens : l'accès donné à l'agent est celui que l'utilisateur voit dans la liste
(un lien re-pointé plus tard ne déplace pas l'accès en silence) ; un doublon se reconnaît quel que
soit le chemin pris ; `realpath` natif rend la casse réelle sous macOS et Windows (`~/dev` et
`~/Dev` sont un seul dossier). Contrepartie : la liste montre le nom du dossier réel, pas celui du
lien saisi (question 4).

Les doublons se vérifient **dans** `updateRecord` (synchrone), pas avant : deux ajouts du même
dossier lancés ensemble ne peuvent pas passer tous les deux. Un dossier enregistré avant cette
fiche (lien non suivi) est comparé par son chemin réel s'il existe encore ; rien n'est réécrit.

**Réponse** (`src/shared/extra-folders.ts`) : `{ ok: true, folder }` (le dossier retenu) ou
`{ ok: false, reason, folder? }` (le chemin compris : `~` développé, normalisé, pour le montrer) ;
`null` si la fenêtre native est annulée. Le texte de chaque raison est une clé
`sessionTab.folderRefusal.<raison>` (fr, en), que l'interface affichera (`extraFolderRefusalKey`).
Refus noté au journal (`info`), avec le chemin compris.

**Pendant une réponse de l'agent** : erreur levée, comme pour le retrait et comme avant (texte
`conversations.error.busyFolders`) — ce n'est pas le chemin qui est en cause, et la ligne est déjà
désactivée avec sa raison (fiche 287). Ordre : le chemin est vérifié d'abord (lecture seule, sans
effet), puis l'écriture de la liste refuse (question 5).

**Glisser un dossier** — ce qu'Electron donne avec `sandbox: true` et `contextIsolation: true`,
sans rien affaiblir : `webUtils.getPathForFile(file)`, appelé **dans le preload**, est l'API prévue
(`File.path` a été retiré d'Electron 32). Le preload l'expose déjà (`window.api.files.pathFor`, servi
aux pièces jointes glissées et aux documents d'une discussion). Relevé le 2026-11-26 avec l'Electron du dépôt
(45.4.1), fenêtre `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, dépôt
simulé par le vrai glisser-déposer de Chromium (`Input.dispatchDragEvent`, celui de
`ui.dragFiles` des e2e) :
- dossier : un `File` (`type` vide, `size` 96), `getPathForFile` rend son chemin absolu,
  `webkitGetAsEntry().isDirectory` vaut `true` ;
- fichier : chemin rendu, `isDirectory` `false` ;
- lien vers un dossier : le chemin **du lien** (non suivi), `isDirectory` `true` — le main le suit.
Le renderer n'a donc rien à lire : il prend le chemin du premier élément déposé et l'envoie à
`conversation:addFolder`, le main dit oui ou pourquoi non (fichier compris). Un glisser venu du
Finder lui-même (et non simulé par Chromium) reste à vérifier à la main au temps 2.

## Maquette (à valider avant le temps 2)

`docs/maquettes/290-autres-dossiers-chemin.html` (bascule Système / Clair / Sombre en haut ; règles
de l'onglet Session recopiées de `session-tab.css`, jetons des thèmes, polices livrées). Captures
dans `docs/maquettes/290-autres-dossiers-chemin/` (`<état>-clair.png`, `<état>-sombre.png`) :

| État | Contenu |
|---|---|
| `vide` | Aucun autre dossier : champ « Chemin d'un dossier, ou glissez-le ici », bouton du bout (fenêtre du système, « Choisir dans une fenêtre… »), aide d'une ligne |
| `saisie` | Un dossier déjà là ; chemin tapé en chasse fixe, « Ajouter » (ou Entrée), Échap vide |
| `refus` | Raison `notFound` sous le champ, chemin compris (`~` développé) ; texte gardé pour corriger |
| `refus-relatif` | Raison `notAbsolute` |
| `ajoute` | Dossier listé (fond vert un instant), champ vidé et gardé au focus, « la session repart » |
| `depot` | Dossier glissé au-dessus de la zone d'ajout |
| `pendant-tour` | Champ et bouton désactivés, raison `sessionTab.foldersBusy` écrite |

Proposition : le champ est toujours visible sous la liste et remplace le lien « Ajouter un
dossier… », dont la fonction passe au bouton du bout du champ (`data-testid` gardé). Variante
écartée, à trancher : garder le lien seul, qui déplie le champ au clic.

## Critères d'acceptation

- [x] Un seul chemin de vérification pour la fenêtre native, la saisie et le glisser
  (`conversation:addFolder(id, path?)`) ; un dossier rendu par la fenêtre native est refusé pour
  les mêmes raisons qu'un chemin saisi (essai du canal).
- [x] Chaque cas du tableau ci-dessus a son essai unitaire (texte : POSIX et `path.win32` ; disque :
  simulé, puis vrai dossier jetable avec lien, lien cassé, fichier, dossier `chmod 000`).
- [x] Refus : une raison typée, une clé i18n par raison (fr, en), aucun texte en dur ; rien
  d'écrit ni de session rouverte.
- [x] Liens suivis : dossier réel retenu ; doublon et dossier de travail reconnus à travers un
  lien.
- [x] Fenêtre native : comportement visible inchangé (e2e `dossiers` : le dossier retenu est le
  chemin réel, `/private/var/…` pour `/var/…` sous macOS).
- [ ] Interface (temps 2, après validation de la maquette) : saisie et dépôt dans la ligne
  « Autres dossiers », états vide, saisie en cours, refus avec sa raison, dossier ajouté ;
  fenêtre native gardée ; clavier (Entrée, Échap) ; clair et sombre.
- [ ] Testé contre l'agent factice (temps 2, suite e2e `dossiers` complétée, agent
  `--dossiers-en-plus`, scénario `dossiers` qui répond avec les dossiers reçus) : chemin relatif,
  fichier, absent refusés avec leur raison à l'écran ; `~/…` puis chemin complet ajoutés, l'agent
  les reçoit ; dossier glissé (`ui.dragFiles`) ajouté ; fichier glissé refusé.
- [ ] CHANGELOG fr et en (temps 2, quand l'utilisateur voit la différence).

## Plan

**Temps 1 (fait)** — main et contrat :
1. `src/shared/extra-folders.ts` : raisons, `AddFolderResult`, `MAX_FOLDER_INPUT`,
   `extraFolderRefusalKey`.
2. `src/main/conversations/extra-folder-check.ts` : `parseFolderInput` (texte seul),
   `checkExtraFolder` (disque), `sameFolder` ; `NATIVE_FOLDER_SYSTEM`.
3. `additional-directories.ts` : `addAdditionalDirectory(manager, id, input, sys?)` vérifie puis
   écrit, rend `AddFolderResult`.
4. `additional-directories-ipc.ts`, `shared/ipc.ts`, `preload/api.ts` : `addFolder(id, path?)`.
5. Clés `sessionTab.folderRefusal.*` (fr, en).
6. Essais : `extra-folder-check.test.ts`, `additional-directories.test.ts`,
   `additional-directories-ipc.test.ts` ; e2e `dossiers` ajustée (dossier réel).
7. Maquette : `docs/maquettes/290-autres-dossiers-chemin.html` et ses captures.

**Temps 2 (après accord)** — interface, selon la maquette validée : `panel/SessionFolders.tsx`
(champ, zone de dépôt, message de refus), `SessionTab.tsx` (résultat de `addFolder` lu et
affiché), styles, essais du composant, e2e `dossiers` (saisie, refus, dépôt par `ui.dragFiles`),
captures clair et sombre, CHANGELOG fr et en, `docs/agents.md` inchangé (même capacité).

Aucune dépendance nouvelle. Pas d'ADR : la règle d'architecture (le main seul lit le disque) est
appliquée telle quelle.

## Questions ouvertes (pour le tech lead)

1. **Chemin relatif** : refusé (choix du temps 1). Variante : le résoudre depuis le dossier de
   travail (`../lib`), à condition que l'interface le montre avant l'ajout.
2. **Sous-dossier du dossier de travail, ou dossier parent** : acceptés (aucune règle demandée).
   Un sous-dossier n'apporte rien à l'agent ; un parent élargit son accès. Refuser, avertir, ou
   laisser ?
3. **`file:///…`** (glissé comme texte depuis certaines apps, ou collé) : refusé (`notAbsolute`).
   L'accepter coûte trois lignes (`fileURLToPath`).
4. **Lien suivi** : la liste montre le nom du dossier réel, pas celui du lien saisi. Montrer aussi
   « via <lien> » dans l'infobulle ?
5. **Pendant une réponse** : erreur levée (comme le retrait, comme avant), pas une raison du
   résultat. La saisie devra donc rester désactivée pendant un tour, comme le bouton.
6. **Agent sans la capacité** : le main ne refuse pas un ajout (l'interface n'offre rien) ; une
   raison `unsupported` côté main serait une garde de plus.
7. **Refus de la fenêtre native** : jusqu'au temps 2, le résultat n'est pas lu par l'interface ;
   choisir le dossier de travail ou un doublon dans la fenêtre native ne fait rien, comme avant.
8. **Protection de macOS** (Documents, Bureau, Téléchargements, disques externes) : la sonde
   `opendir` de `unreadable` peut faire apparaître la demande d'accès de macOS au moment de
   l'ajout d'un tel dossier tapé au clavier (l'agent, lancé par Bobine, en aurait besoin de toute
   façon). Non vérifié à l'écran.

## Journal

- 2026-11-26 — Temps 1. Fiche, règles, main, essais, maquette.
  - Fait selon le plan. `addAdditionalDirectory` rend désormais un résultat au lieu de filtrer en
    silence (doublon et dossier de travail étaient ignorés sans rien dire).
  - Relevé Electron du glisser (ci-dessus) fait par un script jetable hors dépôt (fenêtre
    `sandbox`, preload avec `webUtils.getPathForFile`, `Input.dispatchDragEvent` du CDP).
  - Écart : e2e `dossiers` ajustée, le dossier listé est maintenant le chemin réel du dossier
    rendu par la fenêtre simulée (`/var/folders/…` → `/private/var/folders/…` sous macOS).
  - Non vérifié : glisser depuis le vrai Finder, Explorateur ou gestionnaire de fichiers Linux ;
    essais du vrai disque sous Windows (jonction) et Linux (casse) tournent en CI, pas sur ce Mac.
