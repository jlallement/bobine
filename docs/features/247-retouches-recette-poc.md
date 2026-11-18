# 247 — Retouches de la recette POC : « Toujours » dit vrai, comptes rendus lisibles en entier, file d'attente stable, extension unique

- **Statut** : fait
- **Dépend de** : 020 (file d'attente), 043 (export), 072 (accord des commandes), 097 et 160 (filles)
- **Agents** : les deux — rien de propre à un agent : libellé de l'app, outils de l'app (`child_status`,
  `message_parent`), file d'attente et export de Bobine.

## Pourquoi

La recette du 2026-11-17 (`docs/recettes/2026-11-17-poc-complet-opencode.md`) a relevé quatre
défauts mineurs, chacun trompeur ou agaçant : un libellé qui promet plus qu'il ne fait (D5), une
mère qui doit redemander un compte rendu coupé à sa fille (D11), un message modifié qui change de
place dans la file (D12), un export « .md.md » (D14).

## D5 — « Toujours dans ce projet » ne retient que la commande exacte

**Cause.** `command-approval.ts` retient l'accord par `(dossier, commande exacte)` : c'est voulu
(fiche 072, comme Claude Code), mais le libellé « Toujours dans ce projet — Sans redemander dans ce
dossier » laisse croire que toutes les commandes du dossier passeront.

**Correction.** Seul le libellé change : « Toujours cette commande ici » / « Sans redemander pour
cette commande exacte dans ce dossier ; révocable dans Réglages › Confidentialité. » (en anglais :
« Always this command here »). L'autorisation n'est **pas** élargie.

**Critères.**
- [x] Le choix et sa description disent « cette commande », en français et en anglais.
- [x] Une autre commande du même dossier redemande toujours (test inchangé dans son principe).
- [x] Test : `command-approval.test.ts` vérifie le libellé et la description proposés.

## D11 — Comptes rendus des filles coupés, sans moyen de lire la suite

**Cause.** Deux bornes protègent le contexte de la mère (fiche 160) : `message_parent` coupe un
message au-delà de `PARENT_MESSAGE_CHARS` (« (cut: N characters in all) »), et le compte rendu de fin
de tour ne garde que le début de la dernière réponse (`RECAP_CHARS`). Ni l'un ni l'autre ne disait
comment lire le reste : la mère de la recette a dû redemander le texte par `message_child`, ce qui
relance un tour de la fille.

**Correction.** Les bornes restent. La ligne coupée dit désormais à l'agent comment lire le texte
entier : `child_status` avec `{"child": "<id>", "full": true}`. `child_status` gagne deux
paramètres facultatifs : `child` (une seule fille) et `full` (sa dernière réponse en entier, et son
dernier message `message_parent` en entier), bornés à `FULL_TEXT_CHARS` (40 000 caractères) pour
qu'un diff collé ne noie pas la mère. Le message entier de `message_parent` est gardé en mémoire
par le module des filles (perdu à la relance de l'app : `child_status` le dit alors).

**Critères.**
- [x] `message_parent` long : coupé comme avant, suivi d'une ligne qui nomme `child_status` et
      l'id de la fille ; `child_status` `full` rend le message entier.
- [x] Compte rendu de fin de tour dont le récapitulatif est coupé : même ligne, avec la taille de
      la réponse entière ; rien de plus quand rien n'est coupé.
- [x] `child_status` sans paramètre : inchangé (toutes les filles, début de la réponse).
- [x] Scénario d'agent factice : `filles-bavarde` (la mère lit la suite par `child_status` et y
      trouve la fin de la réponse), testé dans `children.test.ts` et l'e2e `filles-tech-lead`.

## D12 — Un message modifié repasse en dernière position

**Cause.** « Modifier » retire le message de la file (`agent:unqueue`) et le remet dans la zone de
saisie ; renvoyé, il est ajouté en fin de file comme un nouveau message.

**Correction.** `agent:unqueue` reçoit `edit: true` pour « Modifier » : la file retient la place du
message retiré, et le prochain message tapé par l'utilisateur pendant la même réponse la reprend.
« Supprimer » ne retient rien. La place est oubliée quand la file part (fin du tour, « Envoyer
maintenant », « Relancer »). Aucun changement d'écran.

**Critères.**
- [x] File A, B, C ; « Modifier » A ; renvoyé : A′, B, C.
- [x] « Supprimer » puis un nouveau message : en fin de file.
- [x] Test : `message-queue.test.ts` ; e2e `queue` (modifie le premier message, vérifie l'ordre).

## D14 — Export « nom.md.md »

**Cause.** La fenêtre d'enregistrement de macOS, filtrée sur `md`, ajoute l'extension à un nom
saisi qui la porte déjà dans certains cas (extension masquée) ; Bobine écrivait le chemin rendu tel
quel.

**Correction.** Le chemin rendu par la fenêtre passe par `withExtension` (`src/shared/export.ts`) :
extension doublée (`.md.md`, `.MD.md`, `.json.json`) ramenée à une, extension ajoutée si le nom n'en
a pas (Linux, où la fenêtre GTK n'ajoute rien), casse ignorée. Vaut pour l'export d'une
conversation, l'export de la mémoire et l'export CSV de la consommation.

**Critères.**
- [x] `notes.md.md` → `notes.md` ; `Notes.MD.md` → `Notes.MD` ; `notes` → `notes.md` ; `notes.md`
      inchangé ; idem pour `json` et `csv`.
- [x] Test : `export.test.ts` ; e2e `export` (la fenêtre simulée rend `….md.md`, le fichier écrit
      finit par un seul `.md`).

## Plan

- D5 : `fr.json`, `en.json` (`approvals.alwaysInProject*`), commentaires de `command-approval.ts`,
  e2e `terminal` (lit la clé, rien à changer).
- D11 : `src/shared/children.ts` (`replyChars`, ligne de suite), `children-tools.ts`
  (`bounded`, `child_status`), `conversations/children.ts` (`fullText`, messages gardés),
  scénario `filles-bavarde`.
- D12 : `message-queue.ts`, `agent-host.ts`, `manager.ts`, `ipc.ts`, `shared/ipc.ts`, preload,
  `useConversations.ts`, `Composer.tsx`, `BesidePane.tsx`, `App.tsx` ; e2e `queue`.
- D14 : `src/shared/export.ts` (`withExtension`), `src/main/dialogs.ts` ; e2e `export`.

## Journal

- 2026-11-18 : fiche ouverte (lot C de la recette POC).
- 2026-11-18 : fait. Un commit par défaut. `./scripts/verify` vert (code de sortie 0). Rejoués sans
  le correctif (code de l'app pris sur `main`, essais et scénario de cette branche) : les 9 essais
  nouveaux ou modifiés échouent, chacun sur son défaut. E2e `pnpm e2e --changed` (suite complète :
  i18n et `ipc.ts` touchés, 216 tâches) : 214 verts, `filles-tech-lead` clair et sombre en échec
  sur le nouveau contrôle. Cause : l'attente reconnaissait « Suite lue » pendant que la phrase
  arrivait encore en flux, et le contrôle strict lisait une phrase incomplète (le texte complet est
  dans le relevé d'échec). L'attente demande désormais une des trois phrases entières ; le contrôle
  reste le même. Rejouée : verte en clair et en sombre, captures `filles-tech-lead-5-bavarde`
  regardées.
- Écarts au plan : les clés i18n gardent leur nom (`approvals.alwaysInProject*`), seuls les textes
  changent ; guides fr/en mis à jour. `withExtension` vaut aussi pour l'export CSV et l'export de la
  mémoire (même fenêtre). Le message entier de `message_parent` n'est gardé qu'en mémoire : après
  une relance de l'app, `child_status` dit qu'il n'en a plus.
