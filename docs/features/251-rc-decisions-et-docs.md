# 251 — Préparation de la 1.0.0-rc.1 : décisions et documentation (lot rc-C)

- **Statut** : fait (branche `rc/c-docs`, sans push ; relecture du tech lead)
- **Dépend de** : [audit avant rc du 2026-11-19](../audits/2026-11-19-audit-avant-rc.md), 216
  (règle : comportement observé de Bob seulement), 187 (registre des risques), 145 et 229
  (préversions Linux et Windows)
- **Agents** : les deux — documentation seulement, aucun code produit

## Pourquoi

L'audit avant rc a relevé une phrase interdite dans la doc publique (B3 / DOC-1 : relevés « tirés
du code » de Bob), onze ADR « proposé » pourtant livrés (B8 / DOC-5), un registre des risques
périmé (fiche 187), des versions d'agents et des statuts de fiches faux (DOC-2 à DOC-13), et une
documentation d'exploitation et de communauté incomplète (REL-6/7/9/10/12). La 1.0.0-rc.1 ne part
pas avec une documentation qui dit autre chose que le code.

## Critères d'acceptation

- [x] Plus aucune mention, dans `docs/`, les README, le CHANGELOG et les pages d'entrée, d'un relevé
      tiré du code de Bob ; réécrit en comportement observé ou documentation publique d'IBM, ou
      retiré ; note datée au journal de la fiche 216. Aucun ADR accepté modifié.
- [x] ADR « proposé » livrés vérifiés dans le code et acceptés avec une note datée (0022, 0028,
      0030, 0035, 0036, 0037, 0039, 0041, 0042, 0048) ; ADR-0040 laissé proposé avec la question
      à trancher ; ADR-0043 proposé (fiche 213 reportée après la 1.0) ; index à jour.
- [x] Registre de la fiche 187 au vrai, risque par risque, d'après le code.
- [x] Versions de Bob et d'OpenCode à jour (`docs/acp.md`, README fr/en, `docs/agents.md`).
- [x] Statuts faux corrigés (224, 182, 145, 229, 213) ; critères non cochés des fiches « fait »
      cochés avec preuve ou annotés « Reporté (2026-11-19) : raison ».
- [x] Linux et Windows « préversion » partout ; `docs/installation.md` sans « notarisation prête » ;
      README fr/en : blocage de Gatekeeper au premier double-clic ; `SECURITY.md` (versions 1.x,
      journaux Linux et Windows) ; gabarit d'issue avec le système ; `CODE_OF_CONDUCT.md`
      (Contributor Covenant 2.1) ; gabarit de pull request.
- [x] Section vide « Prochaine version » / « Next version » en tête des deux CHANGELOG.
- [x] `./scripts/verify` vert.

## Plan

Documentation seulement : `docs/acp.md`, `docs/agents.md`, `docs/installation.md`, fiches 017,
028, 155, 187, 213, 216, 224, 182, 145, 229 et celles aux critères non cochés, ADR 0022 à 0048
(statut et note d'acceptation, uniquement des ADR « proposé »), index, README fr/en,
`SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/bug.yml`,
`.github/pull_request_template.md`, CHANGELOG (titre vide). Pas de nouvelle dépendance.

## Journal

- 2026-11-19 — Fait (branche `rc/c-docs`, sans push).
  - **B3 / DOC-1** : `docs/acp.md` (intro « Compatibilité Bob » ; ligne « Fichiers d'exclusion »
    réécrite d'après la page publique d'IBM *Ignoring files* : seul `.bobignore` y est documenté,
    `.gitignore`, `.env`, sous-dossiers et ordre marqués « non documenté et non vérifié en
    réel »), `docs/agents.md` (`ignore-files`), fiches 017, 028, 155. Aucun ADR accepté ne
    contenait de telle phrase (ADR-0050 évoque, parmi les options écartées, la lecture du script
    `bob.cmd` qu'npm génère à l'installation : ce n'est pas le code de Bob, laissé tel quel).
    **Hors périmètre (code)** : les commentaires de `src/main/agent-config/bob-exclusions.ts:2-6` et
    `src/main/agent-config/exclusions.ts:4` décrivent encore le fonctionnement interne supposé de
    Bob (bibliothèque `ignore`, `respectGitIgnore`) : à reformuler par un lot de code.
  - **B8 / DOC-5** : dix ADR acceptés avec une section « Acceptation (2026-11-19) » et leurs
    preuves ; écarts plus stricts notés (0022 : dossier principal modifié refusé, fiche 123 ;
    0048 : zone d'écriture plus étroite que le point 3, relecture de la fiche 224). ADR-0040 :
    section « Question ouverte » (prompt système absent du code, choix (a) amender par un nouvel
    ADR puis accepter, ou (b) attendre l'étape 5 de la fiche 182).
  - **Fiche 187** : chaque risque porte son état ; lots D, E (en partie), F, G marqués faits ; R5
    ouvert, cible 1.0 finale (décision de Jérôme du 2026-11-19).
  - **Décisions de Jérôme du 2026-11-19** intégrées : fiche 213 reportée après la 1.0 (ADR-0043
    proposé) ; Linux et Windows en préversion à la 1.0 ; avis de nouvelle version pour la 1.0
    finale.
  - **Écarts** : fiches 225 et 227 (« relecture du tech lead ») laissées telles quelles, à acter
    par le tech lead. Le bandeau « Public beta » des README n'est pas changé (texte de la
    publication de la rc). Le parcours d'installation réordonné n'est pas encore joué en vrai
    (B6 : recette sur un compte macOS neuf). Contact du code de conduite : le signalement privé
    de GitHub, comme `SECURITY.md` (pas d'adresse électronique publique).
