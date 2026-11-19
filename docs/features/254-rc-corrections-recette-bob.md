# 254 — rc : corrections de la recette Bob courte (D1 à D3, gitleaks)

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 157 (coût hors protocole), 180 (aparté), 246 (message de commit rédigé, ADR-0056),
  249 (accord par site), 130 (journal de consommation), 016 (questions à choix)
- **Agents** : les deux — D1 touche surtout Bob (coût hors protocole, `costSource` du profil),
  mais le correctif est générique (toute source de coût du profil, et le coût par ACP) ; D2 et D3
  ne dépendent d'aucun agent.

## Pourquoi

La recette Bob courte avant la rc
([2026-11-19-recette-bob-rc1.md](../recettes/2026-11-19-recette-bob-rc1.md)) a trouvé deux
défauts gênants et deux cosmétiques. Une dépense en Bobcoins (la rédaction du message de commit)
échappe au compte et au plafond (D1) ; la carte « Site web » laisse envoyer une réponse vide qui
vaut refus, avec une option qui paraît choisie (D2) ; des interrupteurs des Réglages n'ont pas de
nom accessible (D3). En plus, le job « gitleaks (historique) » de la CI est rouge sur `main`.

## Critères d'acceptation

- [x] gitleaks (même commande que `ci.yml`, tout l'historique) : aucune fuite ; faux secrets des
      lots rc marqués en ligne et leur empreinte historique dans `.gitleaksignore`.
- [x] D1 : le coût de la session jetable de rédaction est lu **avant** sa suppression, même écrit
      par l'agent après sa réponse (attente du changement, bornée), puis ajouté à la conversation
      (total, plafond) et au journal de consommation (« Mon activité »). Même chose pour un agent
      qui donne son coût par ACP.
- [x] D2 : aucune option d'une carte de questions ne paraît choisie sans l'être ; « Envoyer » reste
      inactif tant que rien n'est choisi (aucune réponse vide envoyée), pour toutes les cartes du
      composant (site web, commande, `ask_user`, questions de l'agent).
- [x] D3 : chaque interrupteur des Réglages a un nom accessible.
- [x] D4 : cause probable écrite ici (pas de correctif avant la rc).
- [x] Testé contre l'agent factice (`--cout-bob --bob-db`), un test rouge sans correctif par point ;
      e2e `browser` (et suites touchées) vertes, captures regardées.

## Plan

0. **gitleaks** : `// gitleaks:allow — fake value for tests` en fin des deux lignes trouvées
   (`src/main/log.test.ts:93`, `src/main/secret-scan.test.ts:51`) et leurs empreintes
   `4b91b86…:<fichier>:generic-api-key:<ligne>` dans `.gitleaksignore` ; `gitleaks git` sur tout
   l'historique et `gitleaks dir` sur l'arbre.
1. **D1** — `src/main/conversations/commit-draft.ts` : les évènements de coût (`usage-report`,
   `usage_update`) arrivés après la fin de la rédaction sont encore lus ; à la fermeture, attente
   du coût (fin d'attente dès qu'un coût arrive après la fin du tour, borne fixe sinon), puis
   `aside-cost` posé, **puis** la session supprimée. `src/main/usage/journal.ts` : `aside-cost`
   écrit une ligne du journal (conversation, agent, dossier), comme un tour. Tests :
   `commit-draft.test.ts` (agent factice `--cout-bob --bob-db`, coût écrit 300 ms après la
   réponse ; agent factice qui donne son coût par ACP), `journal.test.ts`.
2. **D2** — `QuestionCard.tsx` : aucune ligne en surbrillance avant un geste (↑/↓, survol) ;
   « Envoyer » inactif et envoi refusé (clavier compris) tant qu'aucune question n'a de réponse.
   Tests de composant ; e2e `browser` : la carte « Site web » sans choix ni « Envoyer » actif ;
   e2e `questions` si touchée.
3. **D3** — `aria-label` (clé du libellé de la ligne, fr et en) sur les interrupteurs sans nom :
   Conversations (plafond), Général (veille, message de commit, astuces), Apparence (ligatures,
   présentation), Notifications (3), Confidentialité (cookies), Mémoire, Données (agents neufs).
   Test : chaque case à cocher de chaque section des Réglages a un nom accessible.
4. Fiche, index, CHANGELOG fr/en, `./scripts/verify`, e2e des suites touchées.

## D4 — titre « Résumé du projet Bobine… » (analyse seulement, fiche après la rc)

- **Ce que Bobine joint au premier message d'une session** (`agent-host.ts`, `sessionContextOf`,
  `host-options.ts` › `sessionContext`) : un second bloc texte, après celui de l'utilisateur
  (`withContext`). Dans un dépôt git, outils de l'app actifs, il contient le contexte complet des
  conversations filles (`capabilitiesContext`, `src/shared/children.ts`, balise
  `<bobine_capabilities>`), qui commence par « For context, about the app the user talks to you
  through (**Bobine**). This is not a task. » et nomme l'outil `start_child` « from the **bobine**
  tool server » ; plus l'index de la mémoire (`<bobine_memory>`) si la mémoire est active, et les
  rôles. D'où les « 2 blocs, 4,5 Ko » relevés.
- **Cause probable** : Bob tire le titre de la tâche (`session_info_update`) de **tout** le prompt
  du premier tour, blocs joints compris. Le message de l'utilisateur ne nommait pas le projet
  (« Lis ce petit projet et résume-le… ») ; le seul nom propre du prompt était « Bobine », et Bob
  l'a pris pour le nom du projet. Rien d'observé ne dit comment Bob choisit son titre : hypothèse
  cohérente avec l'unique cas vu, à confirmer par une trace (`agents.log` en Trace) avant tout
  correctif.
- **Pistes pour la fiche d'après la rc** (à arbitrer, aucune ne suppose rien de Bob) : ne pas
  nommer l'app dans ce contexte (« the app the user talks to you through ») ; le joindre au
  deuxième tour plutôt qu'au premier quand l'agent titre sur le premier ; ou, si l'agent l'annonce,
  ne plus le joindre au prompt (contexte de session hors message). Scénario d'agent factice
  « titre tiré du prompt complet » pour la non-régression.

## Journal

- 2026-11-19 : fiche ouverte, plan écrit.
- 2026-11-19 : **gitleaks** — `gitleaks git --redact --no-banner --verbose .` (8.30.1, comme
  `ci.yml`) trouvait exactement 2 fuites (les deux de la demande) sur 356 commits ; marquées en
  ligne et empreintes ajoutées. Ensuite : aucune fuite (historique), aucune non plus dans l'arbre
  (`gitleaks dir`). Aucun autre faux secret des lots rc ne sort.
- 2026-11-19 : **D1** — cause confirmée, et plus simple que les deux hypothèses de la recette :
  `CommitDrafts.onEvent` ignorait **tout** évènement une fois la rédaction finie, or elle finit à
  `turn-end`, et l'hôte n'annonce le coût lu hors protocole (`SessionCost.turnEnded`) qu'**après**
  `turn-end` (et Bob l'écrit encore plus tard). Le coût n'atteignait donc jamais la rédaction,
  quelle que soit l'attente de 2 s. En plus, `session/delete` efface la ligne de la tâche chez Bob
  (`docs/acp.md`, essai du 2026-10-12) : Mon activité, qui lit sa base, ne pouvait pas la voir non
  plus. Correctif : les évènements de coût sont lus après la fin ; `end()` attend un coût annoncé
  après la fin du tour (borne `DRAFT_COST_WAIT_MS` = 15 s pour un profil à `costSource`,
  `LATE_COST_MS` sinon ; finie dès qu'il arrive), pose `aside-cost`, **puis** supprime la session.
  Le journal de consommation écrit une ligne par `aside-cost` (`stopReason: aside`) : rédaction
  **et aparté** comptent désormais dans Mon activité (l'aparté n'y était pas non plus). Plafond :
  `aside-cost` va dans `usage.earlier`, déjà compté par `capReached` au message suivant.
  OpenCode / coût par ACP : déjà compté (`usage_update` avant `turn-end`), test ajouté.
  - Écart : l'aparté garde son attente fixe de 2 s avant la suppression (il lit les évènements
    tardifs tant qu'il est ouvert, donc ne perd le coût que s'il est fermé moins de 2 s après une
    réponse dont Bob écrit le coût plus tard). À aligner sur la rédaction après la rc si une
    recette le montre.
- 2026-11-19 : **D2** — cause : `QuestionCard` mettait la ligne 1 en surbrillance (`focus` à 0) à
  l'ouverture et n'inactivait « Envoyer » que pour une question **obligatoire** ; la carte « Site
  web » (fiche 249, via `askUserSchema`) n'en marque aucune. Choix le plus sûr : rien en
  surbrillance avant un geste (↑/↓, survol), et jamais d'envoi sans au moins une réponse (bouton,
  Entrée, espace) ; « Passer » reste. Pas de choix par défaut : sur une carte d'accord, un défaut
  « Autoriser » serait dangereux. Touche toutes les cartes du composant (site, commande des outils
  de l'app, `ask_user`, questions de l'agent). Pas touchées, et pas concernées : `PlanApproval` et
  `ChildProposals` (chaque option est un bouton qui envoie ; la ligne en surbrillance est celle
  qu'Entrée envoie). Clavier : depuis « aucune », ↓ mène à la 1ʳᵉ option (test ajusté).
- 2026-11-19 : **D3** — 12 interrupteurs sans nom (Général ×3 dont astuces, Apparence ×2,
  Notifications ×3, Conversations, Confidentialité, Mémoire, Données) : `aria-label` avec la clé
  du libellé de leur ligne (fr et en existantes). Les autres (agents, fournisseurs, MCP, rôles,
  outils de l'app, règles d'approbation) étaient déjà nommés. Test : chaque case à cocher des
  sections à interrupteurs a un nom ; « Plafond par conversation » trouvé par son nom.
- Vérifications : `./scripts/verify` vert ; e2e `browser questions autorisation-commande
  commit-redige aparte usage usage-board settings inbox` (clair et sombre) vertes ; la nouvelle
  vérification de `browser` échoue sur le build d'avant le correctif D2 (captures avant/après de
  `28h-site-affiche-accord` regardées).
