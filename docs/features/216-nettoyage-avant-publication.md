# 216 — Nettoyage du dépôt avant sa publication

- **Statut** : fait
- **Dépend de** : 048 (sonde de Bob), 091 (quota), 116 (À propos), 213 à 215 (approbations)
- **Agents** : les deux pour la documentation ; la sonde ne concerne que Bob

## Pourquoi

Bobine sera publiée dans un **nouveau dépôt public**, fait d'un instantané propre de `main`
(l'historique n'est pas publié). Tout ce qui est dans l'arbre devient donc public. L'audit
d'ouverture du 2026-11-10 (hors dépôt) a relevé des passages qui n'ont rien à faire dans un dépôt
public : description de l'API privée de Bob, détails internes de Bob plutôt que son
comportement observé, contexte professionnel de l'utilisateur, chemins personnels, liens privés. Il manquait
aussi, dans l'app, une phrase qui dise que Bobine n'est pas un produit d'IBM.

## Décisions du propriétaire (2026-11-10)

- Les **ADR acceptés peuvent être expurgés** pour la publication : seuls les passages sensibles
  sont retirés, la décision ne change pas, et une note datée termine chaque ADR touché
  (« Texte expurgé le 2026-11-10 pour la publication du dépôt ; la décision est inchangée. »).
  Exception unique, écrite dans `AGENTS.md` à côté de la règle « Ne pas modifier un ADR accepté ».
- **`pnpm bob-probe` n'inspecte plus le paquet installé de Bob** : la sonde ne garde
  que des sondages de comportement (lancer `bob acp` ou `bob chat --help`, observer). Le sondage
  qui écrit la section `approval` comme Bobine puis vérifie que Bob la garde après un lancement
  reste.
- La liste des 15 commandes par défaut et le groupe `read` par défaut, recopiés par Bobine avant
  sa première règle (fiche 215), restent : ils viennent de ce qu'on a observé (Bob IDE recopie
  cette liste dans le fichier, `ls` demandé sans section `approval`) et de la
  [documentation publique d'IBM](https://bob.ibm.com/docs/shell/configuration/approval-settings).

## Critères d'acceptation

- [x] Plus aucune description de l'API privée de Bob (chemins de sa passerelle, signature des
      requêtes, clés) : « Bob lit son budget auprès de son service ; Bobine lit l'écran `/status`
      de Bob ».
- [x] Plus aucun nom interne de Bob : les faits observés restent (« vu », « constaté », avec la
      trace ou l'essai), ce qui n'avait pas été observé est retiré ou marqué « non vérifié ».
- [x] Sonde : plus d'inspection du paquet installé de Bob (ni défauts d'approbation, ni libellés
      de `/status`) ; attentes et essais à jour.
- [x] Contexte professionnel neutralisé (« l'utilisateur », « un poste géré », « des
      utilisateurs ») ; valeurs réelles de `/status` remplacées par des valeurs inventées dans les
      essais ; chiffres réels de budget retirés des recettes.
- [x] Chemins `/Users/<login>` remplacés par `/Users/me`.
- [x] Liens vers des maquettes privées retirés (la description reste).
- [x] Fenêtre À propos : « Projet indépendant, non affilié à IBM. » (clés `aboutWindow.notAffiliated`
      fr/en, glossaire de `docs/traduction.md`), en petit sous les liens ; essai unitaire et e2e
      `about`.
- [x] `./scripts/verify` vert ; `pnpm e2e --changed` vert, captures regardées.

## Plan

1. Sonde : `bob-probe.ts` (inspection du paquet, sondage et contrôle des défauts),
   `scripts/bob-probe.mts` (lecture du fichier installé, libellés de `/status`),
   `bob-probe.expected.json`, `bob-probe.test.ts`.
2. Documentation de Bob réécrite en comportement observé : `docs/acp.md`, `docs/agents.md`,
   `docs/mock-agent.md`, fiches 010, 019, 053, 056, 091, 155, 163, 200, 209, 213, 214, 215.
3. ADR expurgés avec note datée : 0017, 0023, 0043 ; index des ADR.
4. Contexte professionnel : audit de maturité du 2026-10-21, fiches 024, 091, 104, 111, 142, 153,
   173, 189 ; essais `bob-status.test.ts`, `quota.test.ts`, `AgentQuotaStatus.test.tsx` ;
   recettes du 2026-10-19 et du 2026-10-23.
5. Chemins personnels, liens privés.
6. À propos : composant, styles, clés i18n, glossaire, essais, CHANGELOG.
7. `AGENTS.md` : exception d'expurgation ; règle « ne décrire que le comportement observé de Bob ».

## Ce qui a été retiré ou réécrit (par catégorie, sans reprendre le texte retiré)

- **API privée de Bob** (3 documents et 1 ADR) : chemins de la passerelle, signature des requêtes
  et clé de Bob, dans ADR-0017, fiche 091, `docs/acp.md` (ligne « Budget du compte ») ; fiche 019
  et `bob-costs.ts` reformulés de même (« Bob lit son budget auprès de son service »).
- **Détails internes de Bob** (≈ 30 passages dans 17 fichiers) : noms internes et affirmations
  non observées dans `docs/acp.md` (approbations, liste de tâches, limite d'étapes, budget épuisé, exclusions,
  règles, sous-agents, sonde), `docs/agents.md`, fiches 010, 053, 056, 155, 163, 200, 209, 213,
  214, 215, ADR-0043, commentaires de `approval-rules.ts`, `bob-approval-rules.ts`,
  `bob-rules.ts`, `bob-exclusions.ts`, `bob-costs.ts`, `turn-limit.ts`, `limite-etapes.mts`,
  `scenario.mts`, `status-screen.mts`, `bob-status.ts`. Ce qui n'avait pas été observé est
  désormais marqué « non vérifié » (ordre des fichiers d'exclusion, effet de
  `autoApprovalEnabled: false`, politique d'administration, reprise dans le même processus après la
  limite d'étapes, forme exacte du budget épuisé, connexion SSO par `authenticate`…).
- **Sonde** : deux inspections du paquet installé de Bob retirées (défauts d'approbation, libellés
  et commande de `/status`), avec leur contrôle et leur essai. Le contrôle
  « quota lisible » ne vérifie plus que les options de `bob chat --help` ; les libellés de `/status` se vérifient dans l'app (« Budget du compte »).
- **Contexte professionnel** (≈ 30 passages dans 12 documents) : cadre de travail de
  l'utilisateur, premiers utilisateurs visés, poste et réseau de l'utilisateur, gestion de son
  budget ; ADR-0023 et son index. Valeurs réelles de `/status` (budget,
  consommation, identifiant de tâche, commit de Bob) dans trois essais et deux documents ;
  pourcentages et montants de quota dans deux recettes.
- **Chemins personnels** : 6 occurrences (un essai, deux fiches, deux recettes).
- **Liens privés** : 10 liens vers des maquettes dans 10 fichiers ; la description et la date de
  validation restent.

## Ce qui reste au propriétaire

- Relire les ADR expurgés (0017, 0023, 0043) et `docs/acp.md` avant l'instantané public.
- Lancer `pnpm bob-probe --accept` à la prochaine mise à jour de Bob : les attentes ont été
  retirées à la main pour les deux sondages supprimés, la sonde n'a pas été relancée (pas de vrai
  Bob ici).
- Décisions de l'audit hors de ce lot : adresse des commits publics, release « Bob Desktop
  0.1.1 », réglages GitHub, licences livrées dans l'app, conditions d'utilisation de Bob
  (automatisation de `bob chat` pour `/status`).
- Les recettes, feuilles de route et l'audit de maturité restent des documents de travail en
  français ; on peut les ranger à part plus tard.

## Journal

- 2026-11-10 — Fait (branche du worktree, sans push). `./scripts/verify` vert ;
  `pnpm build && pnpm e2e --changed` (192 tâches, styles partagés touchés) : 191 vertes, `filles`
  sombre en échec sur un essai de pointeur sans lien avec ce lot, verte au rejeu
  (`pnpm e2e filles`, clair et sombre) ; captures de la fenêtre À propos (`o0-a-propos-*`)
  regardées en clair et en sombre. Écarts au plan : la sonde perd aussi le contrôle des libellés de `/status` (tiré du paquet
  installé de Bob, comme les défauts d'approbation) ; ajout dans `AGENTS.md` d'une règle
  courte : ne décrire que le comportement observé de Bob et sa documentation publique.
