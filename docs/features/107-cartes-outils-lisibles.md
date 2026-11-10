# 107 — Cartes d'outils de l'agent lisibles

- **Statut** : fait (reste l'essai réel)
- **Dépend de** : 047 (outils regroupés, libellés des outils de l'app)
- **Agents** : les deux (le libellé se déduit du protocole : `kind`, `locations`, `rawInput` ;
  rien de propre à un agent, ADR-0011)

## Pourquoi

Avec OpenCode 2, un groupe d'outils replié montre vingt lignes « read » identiques : le titre de
la carte est le nom brut de l'outil, et le fichier lu n'apparaît qu'en dépliant. Bob titre ses
cartes plus longuement (« Reading file… »), mais toujours à sa façon. La fiche 047 avait rendu
lisibles les outils de l'app (« Saisit « Ada » ») ; les outils de l'agent lui-même (lecture,
modification, recherche, commande, page web) restaient sous le titre que l'agent envoie.

Le protocole en dit assez : `kind` (read, edit, search, execute, fetch…), `locations[].path`,
et `rawInput` (chemin, motif, adresse, commande). L'app peut dire ce que l'outil a fait et sur
quoi : « Lecture de src/books.js », « Recherche « TODO » », « Page example.com/doc ». Un libellé
lisible, pas une refonte des cartes.

## Critères d'acceptation

- [x] Dans un groupe replié comme hors groupe, une carte d'outil de l'agent dit ce qu'il a fait et
      sur quoi : « Lecture de src/books.js », « Modification de README.md », « Suppression de… »,
      « Déplacement de… », « Recherche « TODO » », « Liste de src/ », « Page example.com/doc » ;
      une commande garde son texte (`git status --short`) ; un outil sans genre connu ou sans cible
      garde le titre de l'agent.
- [x] Les chemins sont relatifs au dossier de la conversation (hors du dossier : chemin complet),
      tronqués au milieu s'ils sont longs ; le chemin complet et le titre de l'agent restent en
      infobulle. Plusieurs fichiers : le premier « et N autres ».
- [x] Le libellé est déduit du protocole seulement (`kind`, `locations`, `rawInput`) : aucun cas
      particulier d'agent. Le résumé du groupe (« 29 lectures, 2 commandes et 2 outils ») ne
      change pas.
- [x] Textes en français et en anglais (`toolCall.label.*`).
- [x] Testé contre l'agent factice : scénario `fil-long` (titres bruts « read », « grep », comme
      OpenCode 2 ; chemins sous le dossier de la session), suite e2e `long-thread` en clair et
      en sombre, captures regardées.
- [ ] À vérifier avec un vrai OpenCode 2 et un vrai Bob (journal Trace, fiche 080) : les
      champs de `rawInput` pour `read`, `edit`, `grep`, `glob`, `list`, `webfetch`, `bash`
      (`filePath` / `path`, `pattern`, `url`, `command`) et la présence de `locations`.

## Plan

Ce qu'on sait des agents (docs et agent factice, pas de journal réel sur cette machine) :

| Outil | OpenCode (1.19 relevé, 2 supposé pareil) | Bob (doc IBM, fiche 047) |
|---|---|---|
| lecture | titre `read`, `kind: read`, `locations: [{ path }]`, `rawInput.path` (ou `filePath`) | « Reading… », `kind: read`, `locations` ? |
| modification | `edit` / `write` / `patch`, `kind: edit`, `locations`, diff | « Writing file », « Applying diff to », `kind: edit`, diff |
| recherche | `grep` / `glob`, `kind: search`, **pas de `locations`**, `rawInput.pattern` (+ `path`) | ? |
| liste | `list`, `rawInput.path` | ? |
| page web | `webfetch`, `kind: fetch`, `rawInput.url` | ? |
| commande | `shell` / `bash`, titre = commande, `kind: execute`, `rawInput.command` | `kind: execute`, titre ? |

Le réducteur ne garde pas `rawInput` (sauf le plan et le sous-agent) : pour les outils sans
`locations` (recherche, page, commande chez Bob), il faut en garder un résumé.

1. `src/shared/tool-label.ts` (nouveau, pur) :
   - `toolInputOf(rawInput): ToolInput | undefined` — `{ path?, pattern?, url?, command? }` lu
     sous ses noms usuels (`filePath` / `file_path` / `path` / `file`, `pattern` / `query` /
     `regex` / `glob`, `url`, `command` / `cmd`), textes courts (une ligne, 200 caractères).
   - `toolLabel(item, workspace): { text, detail?, code? } | undefined` d'après `toolKind`,
     `locations[0].path` (sinon `input.path`), `input.pattern`, `input.url`, `input.command` ;
     « Liste de… » quand le titre est le nom nu `list` / `ls` (genre `read` ou `search`) ;
     `execute` : la commande si `rawInput` la donne, sinon le titre, en code ; `think`,
     `switch_mode`, `other`, ou sans cible : `undefined` (titre brut).
   - Chemin relatif au dossier (`~` pour le dossier personnel), tronqué au milieu au-delà de
     48 caractères, le nom du fichier toujours entier ; `detail` = chemin complet.
2. `src/shared/transcript.ts` : champ `input?: ToolInput` de l'élément `tool`, posé dans
   `applyUpdateItems` (`tool_call`, `tool_call_update`) et dans `permission-request` — **le
   strict minimum** (fiche 103 travaille sur ce fichier) : une ligne par endroit.
3. Locales `toolCall.label.read` / `edit` / `delete` / `move` / `search` / `list` / `fetch`
   (`{{target}}`), `others` (`{{target}} et {{count}} autres`).
4. `ToolCall.tsx` : la ligne affiche ce libellé quand il existe (après celui des outils de l'app,
   qui prime), infobulle = chemin complet puis titre de l'agent ; `Transcript` reçoit `workspace`
   (App, BesidePane) et le donne par un contexte `WorkspaceContext` (ToolGroup est mémoïsé sur
   ses outils : le contexte passe quand même).
5. Agent factice : scénario `fil-long` aux titres bruts d'OpenCode 2 (`read`, `grep`, commande),
   `rawInput` fourni, chemins sous le dossier de la session (`{cwd}` remplacé dans
   `locations[].path` par l'étape `update`). Suite `long-thread` : vérifie les libellés, dossier
   de travail jetable (`BOBINE_WORKSPACE`).
6. Tests : `tool-label.test.ts`, `transcript.test.ts` (champ `input`), `Transcript.test.tsx`
   (libellé d'un outil de l'agent, infobulle).

Aucune nouvelle dépendance.

## Journal

- 2026-10-21 — Fiche créée (session lancée depuis l'audit de maturité).
- 2026-10-21 — **Fait.**
  - `shared/tool-label.ts` : `toolInputOf` (résumé de `rawInput` : chemin, motif, adresse,
    commande, sous leurs noms usuels), `relativePath`, `shortenPath` (48 caractères, nom du
    fichier entier), `toolLabel` (lecture, modification, suppression, déplacement, recherche
    « motif » / dans un dossier, liste, page, commande en code ; `think`, `switch_mode`, `other`
    ou sans cible : rien).
  - `shared/transcript.ts` : champ `input` posé en une ligne à chaque création ou mise à jour de
    carte (fiche 103 travaille sur ce fichier : rien d'autre n'y a bougé).
  - `ToolCall` : libellé (`data-testid="tool-label"`), infobulle = cible entière puis titre de
    l'agent, `WorkspaceContext` fourni par `Transcript` (prop `workspace`, donnée par `App` et
    `BesidePane`) ; `ToolGroup` nomme l'outil en cours par son libellé ; l'indicateur d'activité
    (`shared/activity.ts`, `WorkingIndicator`) aussi.
  - Agent factice : `{cwd}` remplacé par le dossier de la session dans `locations[].path` et les
    valeurs texte de `rawInput` (étape `update`) ; scénario `fil-long` titré comme OpenCode 2.
  - Tests : `tool-label.test.ts` (15 cas), réducteur (champ `input`), `Transcript.test.tsx`
    (libellé, chemin relatif, infobulle, titre gardé sans cible). e2e : `long-thread` vérifie
    les dix cartes du dernier groupe (texte et infobulle), dossier jetable ; `subagents` adapté
    (cherchait les titres bruts « glob » / « read »). `long-thread`, `base`, `subagents` verts
    en clair et en sombre, captures 36, 37, g3 regardées.
  - **Écarts au plan** : pas de `~` pour le dossier personnel (le renderer ne le connaît pas ;
    hors du dossier, le chemin complet, tronqué au milieu). Les scénarios `demo`, `appel-outil`
    et `diff` gardent leurs chemins `/projet/…` (hors dossier, affichés en entier) : passer au
    dossier réel aurait touché le récapitulatif des modifications.
  - **Reste** : essai réel OpenCode 2 et Bob (journal Trace) pour confirmer les champs de
    `rawInput` et la présence de `locations` ; ajouter un alias dans `INPUT_KEYS` au besoin.
- 2026-10-23 — Écart, fiche 125 : le même nettoyage hors des cartes (« À traiter », notifications)
  et pour les titres sans libellé (chemins du dossier relatifs) ; `cd <dossier> && …` retiré des
  commandes ; `rawInput.todos` libellé « Mise à jour de la liste de tâches (N) » ; vérifié sur les
  titres réels de Bob 2.0.6 (journal de la recette du 2026-10-23, scénario `titres-bob`).
