# 202 — OpenCode : fichiers créés comptés dans les modifications

- **Statut** : fait
- **Dépend de** : 021, 096, 139
- **Agents** : les deux pour la règle générique (diff de la demande d'autorisation gardé) ;
  OpenCode pour le diff refait de l'entrée de `write` (profil `diffSource`, repère `replay-diffs`,
  `docs/agents.md`)

## Pourquoi

Recette réelle (OpenCode 2.2.5, modèle gratuit, app packagée) : un fichier **créé** par OpenCode
n'apparaît ni dans Modifications › Conversation (« L'agent n'a encore modifié aucun fichier ») ni
dans le résumé des modifications en haut de la conversation ; un fichier modifié, si. Les essais
unitaires et e2e ne l'ont pas vu : l'agent factice envoyait les diffs comme on le supposait, pas
comme OpenCode.

## Contrat réel relevé (2026-11-07)

`pnpm opencode-probe --only création --traces` (modèle `opencode/big-pickle`, `HOME`/`XDG_*` et
dossier jetables, `opencode.json` jetable pour `edit: ask`) ; traces dans
`src/main/agent/__traces__/opencode-2.2.5/creation-*.ndjson` (`-2` : la session rouverte par
`session/load` dans un autre processus).

| Message | `write` (nouveau fichier) | `write` (fichier existant) | `edit` |
|---|---|---|---|
| `tool_call` `pending` | titre « write », `kind: edit`, `locations: []`, `rawInput: {}` | idem | titre « edit », idem |
| `tool_call_update` `in_progress` | `locations` (absolu), `rawInput: { path, content }` | idem | `rawInput: { path, oldString, newString }` |
| `session/request_permission` (seulement `edit: ask`) | `content: [diff]`, `oldText: null` | `content: [diff]`, ancien texte complet | `content: [diff]` |
| `tool_call_update` `completed` | **un texte** « Created file successfully: <f> », `rawOutput.metadata: { truncated }` — **ni diff ni `metadata.files`** | **un texte** « Wrote file successfully: <f> », idem | texte + **diff** complet + `metadata.files[].patch` |
| Rejeu (`session/load`) | `tool_call` avec `locations` et `rawInput` (`path` **relatif**), puis la même fin | idem | idem, diff compris |

Une fin d'outil qui porte `content` remplace celui de la carte : même le diff de la demande
d'autorisation disparaissait. Le texte « Created / Wrote » vient du code d'OpenCode 2.2.5
(`existed ? "Wrote" : "Created"`, lu dans le binaire).

## Critères d'acceptation

- [x] Trace réelle d'OpenCode enregistrée (création, réécriture, modification ; autorisation
  d'office et demandée ; en direct et rouverte), rejouée par `trace-replay.test.ts`.
- [x] Un fichier créé par `write` compte dans Modifications › Conversation (créé, tout en ajout),
  une seule fois, en direct comme à la réouverture, avec ou sans demande d'autorisation.
- [x] Un fichier réécrit après une demande d'autorisation compte avec le diff accordé.
- [x] Rien ne change quand la fin porte déjà un diff (pas de double compte) ; Bob et les
  personas de la grille de conformité inchangés.
- [x] Testé contre l'agent factice (scénario `ecriture-opencode`, qui se comporte comme
  OpenCode 2.2.5) : grille aux limites et e2e `replay-changes`.

## Plan

1. Sonde : sondages `création (autorisée d'office)` et `création (autorisation demandée)`,
   option `--only`, traces enregistrées.
2. `tool-call-memory.ts` : ce que les mises à jour d'un outil ont dit (titre, genre, entrée,
   diffs de la demande d'autorisation), oublié à sa fin ; règle générique `withPermissionDiffs`.
3. `opencode-diffs.ts` : `withCreatedFile` dans `OPENCODE_DIFF_SOURCE` ; `DiffSource.complete`
   reçoit `soFar`.
4. `profile-updates.ts` : la mémoire, appliquée à toute mise à jour et à toute demande
   d'autorisation (hôte et rejeu des traces passent par là).
5. Agent factice : étape `opencode-write`, scénario `ecriture-opencode`.
6. Essais : traces réelles (échouent avant, passent après), unitaires, grille aux limites, e2e.

## Journal

- 2026-11-07 — Contrat relevé (voir plus haut). Choix : pas de calcul depuis git ou le disque.
  L'ancien texte d'un fichier n'est sûr que s'il est dit par l'agent : relire le disque à
  `in_progress` est une course (OpenCode écrit 3 ms après), et l'état git d'avant la conversation
  n'est pas celui d'avant l'outil — un diff faux ferait d'« Annuler cette modification » une
  remise en état fausse (voire la suppression d'un fichier qui existait). Donc :
  - **générique** : le diff de la demande d'autorisation est gardé quand la fin ne le porte pas ;
  - **OpenCode** : « Created file successfully » + `rawInput.content` → diff `null` → contenu.
- **Reste, assumé** : un fichier **réécrit** par `write` **sans** demande d'autorisation
  (réglage par défaut d'OpenCode) n'est pas compté — son ancien texte n'est dit nulle part. Même
  chose pour un fichier réécrit avec autorisation, après réouverture (la demande n'est pas
  rejouée). Les modèles GPT passent par `patch`, qui joint ses diffs (sonde du 2026-11-06).
- **Pas fait, texte à valider** : le titre de la carte reste « Modification de nouveau.txt » pour
  une création ; il faudrait une clé `toolCall.label.create` (« Création de {{target}} » /
  « Creating {{target}} »), nouvelle chaîne d'interface à faire valider. Le diff de la carte et
  la liste des modifications disent déjà « nouveau fichier » / « créé ». De même, le détail de
  Réglages › Agents (`capabilities.replayDiffs.detail`) ne cite que le rejeu.
- Sonde : les sondages `création (…)` n'ont pas encore d'attentes (`--accept` seulement après un
  passage complet avec `big-pickle`) ; d'ici là, ils apparaissent en écart « nouveau ».
