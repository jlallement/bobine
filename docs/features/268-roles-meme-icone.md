# 268 — Rôles : deux rôles de même icône, et les vraies collisions d'identifiant

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 223 (rôles), ADR-0045, ADR-0047 ; décision : ADR-0063 (proposé)
- **Agents** : les deux (rien de propre à un agent ; l'installation chez Bob et OpenCode est vérifiée)

## Pourquoi

Un testeur rapporte qu'on ne peut pas créer plusieurs rôles experts de **même icône** (Réglages ›
Rôles, ou « + » de la section Équipe) : « le second écrit par-dessus le premier et le remplace ».

## Cause

**L'icône n'est une clé nulle part.** L'identifiant d'un rôle est son `name` (tiré du libellé par
`slugifyRoleName`, `src/renderer/src/roles/role-draft.ts:123`), son fichier est `<name>.md`
(`src/main/roles/library.ts`, `save`), la fusion des portées se fait par `name`
(`mergeRoles`, `src/shared/roles.ts:381` avant), les clés React, le registre des installations et les
fichiers des agents aussi. La seule lecture de l'icône comme critère est la présélection du modèle
de consigne à l'étape 2 (`RoleWizard.tsx`, « même icône suggérée ») : elle remplit la consigne,
n'écrit rien.

Reproduit, honnêtement, **sans** défaut pour le cas décrit : deux rôles de même icône et même
couleur, noms différents, créés par l'interface (essai e2e `roles-meme-icone`) ou par la
bibliothèque (`library.test.ts`, « deux rôles de même icône… ») donnent deux fichiers et deux
rôles — ce test passait déjà avant la correction.

**Ce qui cachait un rôle sans un mot** (avant, `src/main/roles/library.ts:128-133` dans
`main`) : `save` ne refusait un nom que **dans la même portée**. Un rôle créé ou renommé avec
l'identifiant d'un rôle d'une **autre portée** était écrit, puis `mergeRoles` (projet > personnel >
fourni) n'en montrait qu'un :

- un rôle personnel créé alors qu'un rôle **du projet** porte ce nom : écrit, jamais visible dans
  ce projet, sans aucun message ;
- un rôle du projet créé sur le nom d'un rôle **personnel** ou **fourni** : il le cachait, avec une
  simple remarque grise sous l'identifiant (« Remplacera le rôle … ») ;
- les libellés de rôles fournis tombent pile sur leur identifiant : « Code reviewer », « Tech lead »
  (fr et en), « Security expert », « Flutter expert », « UX/UI expert » (en) ; et la suggestion
  d'icône d'après le libellé leur donne **la même icône** que le rôle fourni (`review` → loupe,
  `lead` → boussole, `secur` → bouclier). Créer « Code reviewer » cachait donc le Code reviewer
  fourni, de même icône : c'est très probablement ce que le testeur a vu (« le second remplace le
  premier »). Non confirmé avec lui : nous n'avons pas sa manipulation exacte.
- renommer un rôle (écran d'édition) vers l'identifiant d'un rôle d'une autre portée : même effet.

## Autres collisions vérifiées

| Collision | Avant | Après |
|---|---|---|
| Même icône, même couleur, noms différents | deux rôles | inchangé (test qui le fige) |
| Même nom affiché, identifiants différents | deux rôles | inchangé ; le libellé n'est pas une clé (Bob les liste tous deux sous ce libellé : limite) |
| Libellés différents, même identifiant (« Expert C++ » / « Expert C# » → `expert-c`), même portée | refusé, « Un autre rôle porte déjà ce nom à cet endroit » | refusé, le rôle qui le porte est nommé, `@expert-c-2` proposé |
| Casse ou accents (« Expert Sécu » / « expert secu ») | même identifiant (minuscules, accents ôtés) | idem ligne précédente ; un fichier `Expert.md` sur un disque insensible à la casse est vu par `existsSync` |
| Nom d'un rôle fourni | caché par le nouveau, remarque grise | refusé, suggestion ; « Enregistrer en rôle personnel » d'un rôle fourni reste possible (`replaceBuiltin`) |
| Rôle du projet contre rôle personnel | l'un cachait l'autre (sans un mot dans un sens) | refusé dans les deux sens |
| Fichier `<nom>.md` dont l'en-tête nomme un autre rôle | refusé (`duplicateName`) | inchangé |
| Installés chez l'agent (Bob `custom_modes.yaml`, OpenCode `agents/<id>.md`) | un seul espace de noms par agent : deux rôles de Bobine du même identifiant (deux projets) partagent l'entrée ; le dernier installé l'emporte, l'autre se dit « à mettre à jour » ; une entrée étrangère n'est jamais touchée (`foreign`) | inchangé, figé par `service.test.ts` ; à la création, un même identifiant ne peut plus naître dans les portées visibles |

## Décisions

1. **L'identifiant reste le `name`** : il est déjà stable, unique par portée et indépendant de
   l'icône. Aucun nouvel identifiant, donc **aucune migration** : les fichiers déjà enregistrés et
   les installations chez les agents (registre par fichier et identifiant) restent reconnus tels
   quels. La règle de lecture d'ADR-0045 (portées, priorité par nom) ne change pas ; ce que
   l'interface permet d'écrire, si : ADR-0063 (proposé), qui la remplace en partie.
2. **Une création ou un renommage ne prend jamais l'identifiant d'un rôle connu ici** (fourni,
   personnel, du projet de la conversation, cachés compris) : refus `nameTaken` du main, qui fait
   foi, avec le rôle qui le porte et un identifiant libre proche (`freeRoleName` : `-2`, `-3`… ;
   seul un suffixe de 1 ou 2 chiffres s'incrémente, `release-2024` → `release-2024-2` ; 40
   caractères au plus, jamais le nom d'un fichier déjà là). L'assistant le dit dès l'étape 1 et
   demande l'identifiant libre au main (`roles:suggestName`, qui voit les rôles cachés et les
   fichiers non lus) ; « Utiliser @… » le prend d'un clic ; l'écran d'édition le dit au moment
   d'enregistrer. Un renommage n'est reconnu que si `previousName` existe dans la portée : sinon
   (IPC forgée) c'est une création, contrôlée.
3. **Seul remplacement voulu** : « Enregistrer en rôle personnel » d'un rôle fourni **sous son
   propre identifiant**, dit explicitement au main (`replaceBuiltin` porte le nom de ce rôle
   fourni ; le main n'exempte que lui, et seulement si le rôle enregistré porte ce nom ; l'écran ne
   l'envoie pas si l'identifiant a été changé). Ne plus pouvoir créer depuis l'assistant un rôle de
   projet qui cache volontairement un rôle personnel : c'est à écrire à la main dans
   `.bobine/roles/` (toujours lu, toujours signalé « Remplace … » dans Réglages › Rôles).
4. Par défaut, le main est strict : un appelant qui n'indique rien est une création.

## Limites

- **Un rôle déjà écrasé chez l'utilisateur est perdu.** Mais d'après la cause trouvée, aucun
  fichier n'a été écrasé : un rôle caché par un autre de même identifiant existe toujours sur le
  disque (`<données>/roles/` ou `.bobine/roles/`) et réapparaît si l'on renomme ou supprime celui
  qui le cache. Rien n'est promis au-delà.
- Seules les portées visibles sont vérifiées : un rôle personnel peut porter le nom d'un rôle de
  projet d'un **autre** dossier (inconnu au moment de créer) ; dans ce dossier-là, le rôle du
  projet l'emportera et Réglages › Rôles le dira (« Remplace … personnel »).
- Un fichier écrit à la main ou arrivé par git garde la règle d'ADR-0045 (projet > personnel >
  fourni), signalée dans Réglages › Rôles.
- Deux libellés identiques restent permis (identifiants différents) ; chez Bob, deux modes
  s'afficheraient sous le même nom.
- Maquette : pas de maquette validée pour la ligne d'erreur et le bouton « Utiliser @…-2 » (petit
  ajout au formulaire existant) ; captures `268-identifiant-pris-*` pour la relecture UX.

## Plan

1. Main : `RoleLibrary.save(scope, fields, projectDir, { previousName, replaceBuiltin })`, contrôle
   `nameTaken` sur toutes les portées visibles ; `suggestName` ; `freeRoleName` dans
   `shared/roles.ts`.
2. IPC `roles:save` : option `replaceBuiltin` (nom) vérifiée ; écran d'un rôle fourni la passe
   sous son identifiant ; nouveau canal `roles:suggestName`.
3. Assistant : erreur dès l'étape 1 (`nameTakenError`), bouton « Utiliser @…-2 » sous l'erreur
   (`NameFields`) ; la remarque « Remplacera le rôle … » disparaît (clé `roleForm.name.replaces`
   retirée), clés `roles.error.nameTaken` et `roleForm.name.useSuggestion` (fr, en).
4. Tests : main contre un vrai dossier temporaire, installation chez Bob et OpenCode dans un
   dossier personnel jetable, composants, e2e `roles-meme-icone` (nouvelle suite, captures
   `268-deux-roles-meme-icone` et `268-identifiant-pris`, clair et sombre).

## Journal

- **2026-11-20** — Lu 223, ADR-0045/0047, `library.ts`, `roles.ts`, `role-draft.ts`, l'assistant,
  l'écran d'édition, l'export. Essai e2e de reproduction (deux rôles de même icône, personnels puis
  du projet, icône choisie ou suggérée, modèle présélectionné) : deux fichiers à chaque fois, pas
  de défaut pour ce cas. Cause des disparitions trouvée dans la fusion entre portées (ci-dessus) ;
  tests main écrits d'abord : 5 rouges sur l'ancien `library.ts` (identifiant d'un rôle fourni,
  projet contre personnel, renommage, suggestion, test d'origine mis à jour), le test « même
  icône » vert avant comme après.
- Correction main + assistant + écran d'édition ; tests composants (identifiant pris dès l'étape
  1, suggestion, refus du main, même icône sans alerte, `replaceBuiltin` de l'écran d'un rôle
  fourni). Suite e2e `roles-meme-icone` ajoutée au catalogue. Captures regardées : bouton de
  suggestion d'abord étiré sur toute la largeur, ramené à sa taille (`.role-name-suggestion`).
- Écart au plan : aucune migration, l'identifiant ne changeant pas (décision 1).
- **Revue QA** (même jour), chaque point avec un test rouge sans son correctif :
  `replaceBuiltin` booléen exemptait tout rôle fourni → il porte le nom du rôle fourni, exempté
  seulement sous ce nom, et l'écran ne l'envoie plus pour un identifiant changé ; un `previousName`
  forgé (absent de la portée) faisait sauter le contrôle → plus maintenant (test par
  `rolesHandlers`) ; `freeRoleName` incrémentait `release-2024` → seuls 1 ou 2 chiffres ;
  la suggestion de l'assistant ignorait rôles cachés et fichiers → demandée au main
  (`roles:suggestName`). ADR-0063 (proposé) écrit, index des ADR à jour (ADR-0045 : « remplacé en
  partie »).
