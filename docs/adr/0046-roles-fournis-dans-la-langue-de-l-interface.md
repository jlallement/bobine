# ADR-0046 — Rôles fournis dans la langue de l'interface

- **Statut** : accepté
- **Date** : 2026-11-14

## Contexte

ADR-0014 (point 5) ne traduit que l'interface : tout ce que l'app envoie à l'agent reste tel quel,
en anglais. Les sept rôles fournis (fiche 223) suivaient cette règle : seul leur libellé était
traduit, et leur description affichée passait par une clé de `fr.json` (`shownDescription`). Leur
**description** (« Quand faire appel à lui ? ») et leur **consigne** partent pourtant à l'agent
**et** s'affichent dans l'interface : la page d'édition d'un rôle fourni montrait de l'anglais
dans une interface en français, et un rôle personnel tiré d'un rôle fourni restait en anglais.
L'utilisateur demande que ces textes suivent la langue de l'interface.

## Décision

Exception à ADR-0014, **pour les rôles fournis seulement** : leur libellé, leur description et
leur consigne sont écrits dans chaque langue de l'interface et donnés dans la langue courante.

- Les textes vivent en code (`src/main/roles/builtin-en.ts`, `builtin-fr.ts`), pas dans les
  ressources `locales/*.json` : ce sont des textes longs, adressés à un agent, relus comme du code.
- La langue est celle de l'interface **au moment où la liste est lue** (`builtinRoles()`, à chaque
  `roles:list`, `roles:read`, contexte de session, outil `start_child`). Changer la langue relit
  les rôles fournis partout (liste, section Équipe, menu `@`, page d'édition, rôles donnés à
  l'agent à la prochaine lecture).
- Un rôle déjà figé (`RoleSnapshot` d'une carte de proposition, fille lancée) garde sa langue.
- Modifier un rôle fourni enregistre un rôle personnel dans la langue affichée.
- Le reste de ce qui part à l'agent n'est pas traduit, y compris l'enveloppe `<bobine_role>`
  (anglais), qui demande toujours à la fille de répondre dans la langue de la demande.

## Alternatives écartées

- **Garder les consignes en anglais, traduire seulement l'affichage** — l'interface montrerait un
  texte et l'agent en recevrait un autre ; le rôle personnel tiré d'un rôle fourni resterait en
  anglais. C'est ce que corrige cette décision.
- **Textes dans `fr.json` / `en.json`** — des consignes de dix lignes en clés JSON se relisent mal,
  et elles ne sont pas des textes d'interface : la typographie d'i18next et le typage des clés ne
  leur apportent rien.
- **Langue choisie par rôle ou par conversation** — une option de plus pour un gain incertain ;
  l'utilisateur qui veut une autre langue écrit un rôle personnel.

## Conséquences

- Ajouter une langue à l'interface demande aussi un `builtin-<langue>.ts` (le typage l'exige :
  `Record<Language, BuiltinTexts>`).
- Un rôle fourni ajouté ou modifié l'est dans chaque langue ; un essai vérifie que les langues
  donnent les mêmes noms, icônes, couleurs et lecture seule.
- Une conversation fille lancée avant un changement de langue garde sa consigne d'origine ; une
  nouvelle fille du même rôle reçoit celle de la nouvelle langue.
