# Synthèse de la campagne de recette « comme un humain » — octobre 2026

Protocole : [plan de campagne](2026-10-22-plan-campagne-recette.md). Deux passages, même scénario
(« Carnet de lecture »), Bobine 0.4.0 packagée (`main` à `d936609`), vraie souris, un PV par agent :

| Passage | Agent | Date | Cas | Score § 7.2 | Bloquants | Majeurs | Mineurs | Cosmétiques | Coût |
|---|---|---|---|---|---|---|---|---|---|
| 1 — [PV OpenCode](2026-10-23-recette-opencode.md) | OpenCode 2.0.32 + GPT-6.1 Sol | 2026-10-22/23, 2 h 45 | 45 (19 ✓, 22 ~, 3 ✗, 1 renvoyé) | **74 / 100** | 0 | 2 (D3, D12) | 16 | 11 | 0 $ ; 1,34 bobcoin (fille Bob, acte croisé) |
| 2 — [PV Bob](2026-10-23-recette-bob.md) | IBM Bob 2.0.6 (Bob Shell) | 2026-10-23, 1 h 20 + acte 4 | 38 lignes (10 ✓, 21 ~, 1 ✗, 6 non joués ou renvoyés) | **74 / 100** | 0 | 2 (D3, D21) | 5 nouveaux + 8 revus | 2 nouveaux + 3 revus | **10,60 bobcoins** |
| **Campagne** | | | | **moyenne 74 / 100** | **0** | **3 ouverts** (D3, D12, D21) | 21 | 13 | **11,94 bobcoins** sur 15 à 20 |

## Verdict release candidate (§ 7.3)

Critères : aucun bloquant · au plus 3 majeurs ouverts · score ≥ 70 **avec Bob**.

- Bloquants : **0** ✓.
- Majeurs ouverts : **3** (D3 capture d'écran muette ; D12 sous-agents OpenCode « finis » qui
  tournent ; D21 fil corrompu après une panne de Bob) : **= 3**, à la limite ✓.
- Score avec Bob : **74** ✓ (toutes les familles observées, acte 4 complet).

**Verdict : release candidate, sous réserve de corriger D21 avant le tag.** D21 touche la
fonction que la 0.4.0 met en avant (fil durable, relance après panne, fiche 103) et abîme
définitivement une conversation Bob à chaque plantage ; les deux autres majeurs ont un
contournement (donner l'autorisation macOS ; redemander la conclusion du sous-agent). Les familles
les plus faibles dans les deux PV — **reprise et rejeu** (Bob), **sous-agents** (OpenCode),
**git et worktrees** (les deux), **Android** (D17, APK Flutter) — font la feuille de route.

**Rejeu après corrections (2026-10-23)** — [PV du rejeu](2026-10-23-rejeu-apres-corrections.md), app packagée depuis `59a1f72`, 0,90 bobcoin : 1.3 Bob ✓ (D5), 2.7 Bob ✓ (D21 : fil identique après `kill -9`, relance et ⌘Q), 2.5 OpenCode ~ (D12 corrigé, mais **D25** majeur : un sous-agent en arrière-plan reste « en cours » pour toujours si un autre message part avant sa fin), 3.3 OpenCode ✓ (D22), 4.4 OpenCode ✓ (D17) ; nouveaux D26, D27 (mineurs), C14. **Verdict mis à jour : release candidate** (0 bloquant ; majeurs ouverts : D25, et D3 corrigé mais non rejoué ; score avec Bob ≥ 74) ; la réserve D21 est levée, corriger D25 avant le tag est recommandé. **Rejeu de 2.5 après la fiche 127 (2026-10-23, 20:40)** — app depuis `c6a2943`, OpenCode, 0 bobcoin : D25 ✓ (un puis deux sous-agents finis avec leur réponse malgré un message parti avant leur fin, toujours finis après ⌘Q et relance), D26 ✓, D27 ✓ ; nouvel écart C15 (durée affichée plus longue que la vraie). **Verdict mis à jour : release candidate sans réserve** (0 bloquant, aucun majeur ouvert hormis D3 corrigé dans le code mais non rejoué, score avec Bob ≥ 74).

## Top 10 des défauts à corriger avant la release

| # | Défaut | Gravité | Agents | Fiche probable | Pourquoi d'abord |
|---|---|---|---|---|---|
| 1 | **D21** — relance après panne : le rejeu de `session/load` est fondu dans le fil (bulles perdues, textes collés, cartes de plan aplaties, compteurs doublés, fil durable corrompu) | majeur | Bob (OpenCode à vérifier) | 103 (fil durable), 041 (stabilisation), 011/acp.md (rejeu différé de Bob) | la panne est le cas que la fonction doit couvrir ; perte définitive |
| 2 | **D12** — sous-agents OpenCode en arrière-plan affichés « fini < 1 s », sans résultat | majeur | OpenCode | 053, 117 | fonction trompeuse sur son point central |
| 3 | **D3** — capture d'écran sans l'autorisation « Enregistrement de l'écran » : rien, sans un mot (4 reproductions) | majeur | les deux (app) | 062, 066 | toute installation neuve ; une phrase suffit |
| 4 | **D22** — « Fusionner les N » refusé quand la mère a des modifications non commitées : « Aborting », sans « Committer » hors worktree | mineur, bloquant en pratique | les deux (app) | 110, 120 | cas ordinaire du travail en parallèle ; une sortie claire + « Committer » dans la mère |
| 5 | **D14** — brouillon fantôme dans le worktree supprimé après « Nettoyer » (vue Git), avec « fatal: Unable to read current working directory » ; **D15** — changer d'agent sur un worktree vide le supprime | mineur ×2 | les deux (app) | 110, 036 | cycle des worktrees ; retour à la mère déjà juste par la fusion Sous-tâches |
| 6 | **D5 + D17** — outil de Bobine refusé ou en échec marqué ✓ (OpenCode : l'erreur passée par `execute` n'atteint pas la carte ; avec Bob l'état est juste) ; « Build failed » pour un Gradle réussi dont l'APK Flutter est sous `build/app/outputs/flutter-apk/` (les deux agents) ; erreurs Android coupées | mineur | OpenCode (état), app (Android) | 006, 079, 032, 033 | l'état d'une carte doit dire vrai (grille § 4, point 2) ; chercher l'APK Flutter |
| 7 | **D10 + D13 + (1.3 Bob)** — boutons et lignes qui glissent sous le pointeur : plan après remarque, tâches proposées une à une, carte d'autorisation sous le bandeau de file | mineur ×2 | les deux (app) | 040, 112, 020 | a déjà lancé une exécution non voulue ; trois occurrences par passage |
| 8 | **D18 + D20 + D24** — préambule de Bobine dans le premier message : titres de tâches Bob, carte de branche qui le cite, titre de conversation remplacé | mineur ×3 | Bob | 118, 108, 023 (acp.md : bloc après le message) | visible partout où Bob titre ; une seule cause |
| 9 | **D23 + coût périmé (3.2 OpenCode)** — compte rendu de fille Bob sans coût, ou périmé ; coût figé pendant un tour | mineur | Bob | 109, 117, 120 | la pastille Sous-tâches est juste, le compte rendu non |
| 10 | **D11 + D7 + D8** — liens `http://localhost` morts dans le fil ; `prompt()` muet dans le navigateur ; onglet du panneau fermé au lieu d'affiché (non reproduit avec Bob) | mineur ×3 | les deux (app) | 052, 094, 082 | gestes quotidiens du développeur web |

Juste derrière : **D19** (diff qui défile à droite après une remarque), **D9** (« annulée » perdue),
**D16** (« Ouvrir une PR » muet sans distant), **D1/D2** (confirmation de suppression invisible,
`opencode.json` vide), **C12** (infobulles qui restent), **C13** (`/context` = `/cost` avec Bob).

## Recommandations

1. **Corriger D21 avant le tag** : à la relance d'un agent planté, traiter le rejeu différé de Bob
   comme au ⌘Q (ignorer ou dédoublonner contre le fil durable) ; ajouter un scénario d'agent factice
   « rejeu après `session/load` pendant un tour » (fiche 103) et le rejouer en 2.7 avec Bob.
2. **Fusion depuis Sous-tâches** : vérifier l'arbre du dossier principal avant de fusionner,
   proposer « Committer d'abord » avec message, afficher les lignes `error:` de git (D22) ; offrir
   « Committer » dans la vue Git hors worktree (manque des deux PV).
3. **Cycle des worktrees** : après « Nettoyer » par la vue Git, revenir à la mère ou au dossier
   principal comme le promet la confirmation (D14) ; garder le worktree quand on change d'agent
   (D15) ; désactiver « Ouvrir une PR » sans distant (D16) ; retirer les worktrees supprimés de
   « Dossiers récents ».
4. **Sous-agents OpenCode** : lire `metadata.status` et garder la ligne « en cours » jusqu'à la fin
   de la session fille (D12) ; prendre la réponse finale dans « Voir son travail ».
5. **États des cartes** : « refusé » et « échec » comme états à part entière (D5, D17, D5 Bob) ;
   l'erreur de l'outil de Bobine rendue par `execute` (OpenCode 2) doit atteindre la carte.
6. **Mise en page stable sous le pointeur** : largeur fixe pour les barres de boutons (D10),
   nouvelles lignes ajoutées sous les lignes affichées (D13), bandeau de file qui ne déplace pas
   la carte en attente (1.3 Bob).
7. **Préambule de Bobine** : joindre les blocs `<bobine_capabilities>` et `<child_conversations_request>`
   **après** le message de l'utilisateur chez Bob (comme `docs/acp.md` le prévoit), ne pas citer
   ces blocs dans la carte de branche, ne pas remplacer un titre existant par celui de l'agent
   (D18, D20, D24).
8. **Coût Bob** : écrire le compte rendu de fille avec le coût de la ligne Sous-tâches, le mettre à
   jour à la relecture de `bob.db` (D23) ; dire « coût du tour en cours inconnu » tant que Bob n'a
   pas écrit ; prévenir qu'une relance après panne refacture le contexte.
9. **Capture d'écran** : message « Capture d'écran indisponible : autorisation Enregistrement de
   l'écran refusée » avec la commande `open` du Diagnostic (D3).
10. **Dispositif pour la suite** : l'AVD a été agrandi et 4.4 rejouée avec Bob (cadre, gestes,
    rotation : bons ; flux vidéo muet au premier boot jusqu'à la rotation, à regarder : fiche 076) ;
    4.1 à 4.3 jouées avec Bob (flux 30 fps, châssis, `describe` / `tap`, filmstrip, écran annoté : bons ; 4.2 a coûté 1,01 bobcoin) ; rejouer « Faire confiance » dans
    un dossier hors de `~/Development` ; les e2e pourraient couvrir D19, D22, D14, D24 avec l'agent
    factice.

## Ce qui tient dans les deux passages

Autorisations et questions (cartes exemplaires, « À traiter »), mode Plan avec versions, liste de
tâches de Bob, sous-agents de Bob avec coût exact, filles proposées d'elles-mêmes et fusion avec
conflit résolu par la fille, « Continuer avec l'autre agent », page jointe annotée, terminal →
message, ⌘K / ⌘F, réglages complets et cherchables, quota de Bob, bandeau de panne. Aucun
`ERROR` dans les journaux des deux passages (10 + 4 `WARN`, tous expliqués).

## Fichiers

- PV OpenCode : `docs/recettes/2026-10-23-recette-opencode.md` (542 captures dans
  `e2e/captures/recette-2026-10/opencode/`).
- PV Bob : `docs/recettes/2026-10-23-recette-bob.md` (286 captures dans
  `e2e/captures/recette-2026-10/bob/`, journaux dans `journaux/`).
- Projet d'essai : `~/Development/bobine-recette/carnet-de-lecture` — `main` (premier passage,
  `af45e0f`) et `recette-bob` (second passage, `6307bcb`).
