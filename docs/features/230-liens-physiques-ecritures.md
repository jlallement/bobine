# 230 — Liens physiques : écritures accordées d'office et documents d'une discussion

- **Statut** : fait
- **Dépend de** : 224 (espace Discussion), 211 (risques d'une demande), 213 (approbations par genre)
- **Agents** : les deux — générique ACP (`kind`, emplacements, diffs) et système de fichiers ; rien de
  propre à un agent.

## Pourquoi

L'étude Windows (fiche 229) a relevé un trou présent aussi sur macOS et Linux. Bobine accorde
d'office une écriture dans le dossier d'une discussion (ADR-0048, `write-area.ts`) après avoir
vérifié le chemin réel (`realpath`), le premier niveau, le nom visible et l'absence de lien
symbolique. Mais un fichier à **plusieurs noms** (lien physique, `nlink > 1`) placé dans ce dossier
est le même contenu qu'un fichier ailleurs (`ln ~/.zshrc Notes.md`) : `realpath` n'y voit rien,
et écrire dans `Notes.md` modifie `~/.zshrc`. De même, Bobine montrait, ouvrait et copiait ce
« document » : l'aperçu, « Enregistrer une copie », la branche et « Continuer dans un projet »
auraient lu ou recopié le fichier extérieur (un secret copié dans un dépôt, par exemple).

Qui pose un tel lien : l'agent, par une commande (demandée, ou sans demander pour un agent qui écrit
sans demander, comme OpenCode). Aucun outil ordinaire n'en crée dans un dossier de documents (les
clones APFS ont `nlink = 1`).

## Ce qui était vulnérable (relu le 2026-11-15)

| Endroit | Avant | Après |
|---|---|---|
| Écriture d'une discussion accordée d'office (`write-area.ts`) | accordée si le nom est un fichier du premier niveau, même à plusieurs noms | **posée** à l'utilisateur ; la carte dit pourquoi |
| Bandeau de risque d'une carte (`permission-risk.ts`, fiche 211) | rien sur un lien physique | risque `shared-file` : « Modifie aussi un autre fichier, peut-être hors du dossier (lien physique) : Notes.md » (chemin dans le dossier, jamais l'identifiant d'une discussion) — pour toute écriture (`edit`, `delete`, `move`, commande qui écrit), dans les deux espaces |
| Risques d'une demande sans emplacement (Bob 2.1.0) | calculés sans les emplacements du `tool_call` | calculés avec (`withKnownLocations`), comme la décision d'écriture : sans cela la carte reposée n'aurait rien dit |
| Liste des documents, carte « documents » du tour, aperçu, « Ouvrir », « Afficher », « Enregistrer une copie » | un lien physique était un document | ce n'est pas un document (comme un lien symbolique) : ni listé, ni montré, ni ouvert, ni copié |
| Aperçu texte / image, `textutil` | ouverts sans suivre de lien symbolique, mais sans regarder `nlink` | ouverts par `openDocument` : `O_NOFOLLOW` + `fstat` sur le descripteur (fichier ordinaire, `nlink = 1`) |
| « Enregistrer une copie », branche d'une discussion, « Continuer dans un projet » | `copyFileSync` par le chemin | `copyDocument` : copie par le descripteur vérifié ; un lien (symbolique ou physique) est sauté |
| Fichiers joints par l'utilisateur (`addDocuments`) | copie vers un nom libre (`COPYFILE_EXCL` puis `rename`) | inchangé : la copie est un nouveau fichier ; l'original choisi par l'utilisateur peut avoir plusieurs noms, c'est son choix |

Relu sans changement :

- **Lectures accordées** : Bobine n'accorde aucune lecture d'office (les seuls accords d'office
  sont les outils de l'app, les outils retenus — jamais `edit`/`delete`/`move`/`execute` — et
  l'écriture d'une discussion) ; Bobine n'expose pas `fs/read_text_file` ni `fs/write_text_file`
  (capacités ACP à `false`). Ce que l'agent lit, il le lit lui-même : un lien physique ne lui ouvre
  rien qu'il ne pouvait lire.
- **Pièce jointe déjà dans les documents** : envoyée telle quelle à l'agent (chemin), Bobine ne la
  lit pas.
- **Fiche 213** (« Tout approuver », genres cochés) : pas encore codée. Sa promesse : les
  garde-fous de Bobine restent actifs même en « Tout approuver », et une carte à risque s'y
  arrête. Le nouveau risque `shared-file` entre dans ces garde-fous : en « Tout approuver », une
  écriture dans un fichier à plusieurs noms sera posée, sans casser la promesse (elle ne couvre
  jamais ce que Bobine signale). Les outils « toujours autorisés » (fiche 042) exigent déjà zéro
  risque.

## Critères d'acceptation

- [x] Une écriture d'une discussion sur un fichier existant dont `nlink > 1` n'est plus accordée
      d'office : posée, avec une raison traduite sur la carte.
- [x] Un fichier à créer, ou à un seul nom, reste accordé d'office.
- [x] Un lien physique du dossier n'est ni listé, ni montré, ni ouvert, ni copié par Bobine.
- [x] Tests unitaires avec de vrais liens (`fs.linkSync`) : `write-area`, `permission-risk`,
      `discussion-space`, `documents/ipc`.
- [x] Testé contre l'agent factice (scénario `discussion-lien-physique`,
      `manager-discussion.test.ts`) et en e2e (suite `discussion`, clair et sombre, capture
      `discussion-6-lien-physique`).

## Plan

- `src/main/agent/hard-links.ts` (nouveau) : `sharesContent`, `hasOtherNames`.
- `write-area.ts` : `isDocument` refuse `nlink > 1` → `ask`.
- `permission-risk.ts` : risque `shared-file` (après système, fichier caché, hors du dossier) ;
  `@shared/permissions` (type), `PermissionRisks.tsx` (clé), `fr.json`/`en.json`.
- `permission-answers.ts` : `withKnownLocations`, partagé par la décision et par `agent-host.ts`
  pour les risques.
- `discussion-space.ts` : `isDocumentFile`, `openDocument`, `copyDocument`,
  `addDocuments(…, { fromDocuments })` ; `documents/ipc.ts` les utilise.
- Agent factice : `discussion-lien-physique` ; e2e `discussion`.
- ADR-0048 (proposé) complété ; pas de nouvelle dépendance.

## Limites

- **Course entre la décision et l'écriture** : Bobine décide, c'est l'agent qui écrit. Le `lstat`
  est fait au moment de répondre, juste avant ; un lien posé **après** la réponse (par l'agent
  lui-même, sans demander) n'est pas vu. Bobine n'a aucune prise sur l'écriture : la seule parade
  serait de ne rien accorder d'office. Poser un lien demande une commande (`ln`, `cp -l`), donc
  une carte, sauf pour un agent qui écrit sans demander — limite déjà dite par ADR-0048 et par le
  fil (« la limite aux documents ne lui est que demandée »).
- **« Ouvrir » et « Afficher »** passent un chemin au Finder ou à l'app par défaut : le contrôle
  est fait juste avant, sans descripteur possible ; un lien posé entre les deux n'est pas vu.
- Un agent qui écrit par « écrire ailleurs puis renommer » casse le lien et ne touche pas l'autre
  nom ; un agent qui écrit en place le modifie. Bobine ne le sait pas d'avance : elle pose la
  question dans les deux cas.
- Windows (fiche 229) : `nlink` est rendu par `lstat` sur NTFS ; non essayé ici.

## Journal

- 2026-11-15 — Relu `write-area.ts`, `permission-answers.ts`, `permission-risk.ts`,
  `discussion-space.ts`, `documents/ipc.ts`, ADR-0043/0048, fiches 213/224. Corrigé comme ci-dessus.
  Écart au plan initial : les risques d'une demande sans emplacement prennent désormais ceux du
  `tool_call` (nécessaire pour que la carte reposée dise pourquoi) ; cela vaut aussi pour les
  autres risques (hors du dossier, système) des demandes de Bob 2.1.0 dans l'espace Code.
- 2026-11-15 — Le chemin du risque `shared-file` est dit relatif au dossier (`Notes.md`) : la
  première capture montrait le chemin entier, avec l'identifiant de la discussion. Reste hors de
  cette fiche : le bloc de chemin de la carte d'écriture d'une discussion montre encore le chemin
  entier (comportement antérieur). `./scripts/verify` vert ; `pnpm e2e --changed` : 203/204, seul
  `history light` en échec (infobulle, sans rapport), vert relancé seul ; `discussion` relancée
  après le dernier changement, verte en clair et en sombre.
