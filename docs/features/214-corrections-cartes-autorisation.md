# 214 — Corrections des cartes d'autorisation (étape 1 de la fiche 213)

- **Statut** : fait
- **Dépend de** : 042 (autorisations retenues), 203 (cartes lisibles), 211 (cartes à risque), 213
- **Agents** : les deux (générique ACP) ; ce que Bob envoie (`$/cancel_request`, `rawInput.todos`
  en texte à cases) est lu sans cas particulier : un agent qui annule sa demande, ou qui envoie
  `todos` en tableau, est traité pareil.

## Pourquoi

Défauts constatés avec le vrai Bob 2.0.9 pendant le banc de la fiche 213 (étape 1). Partie main /
logique seulement : **le rendu des cartes attend des maquettes validées** ; ici on ne change ni
l'apparence ni la place des éléments, on met à disposition ce que les maquettes afficheront.

1. **Carte fantôme** : Bob annule lui-même une demande en attente par `$/cancel_request` (cas vu :
   écriture hors du dossier, outil de fichiers bloqué par Bob). Bobine l'ignorait : carte et
   pastille ✋ de la liste des conversations restaient.
2. **Liste de tâches** : Bob envoie `kind: "other"`, titre « Updating todo list », `rawInput.todos` en
   texte à cases (`[x] fait`, `[ ] à faire`, `[-] en cours`). Rien n'arrivait aux données de la carte.
3. **Titre non traduit** : « Updating todo list » dans Réglages › Autorisations retenues.
4. **Chemin trop long** (`/private/tmp/…`) dans la carte de commande.
5. **Agent par défaut démarré** avant le choix d'un agent personnalisé.

## Critères d'acceptation

- [x] 1. Test qui rejoue une trace de Bob (demande puis `$/cancel_request`) : échouait avant, passe.
      Demande annulée retirée côté main, `permission-resolved` avec `cancelledBy: 'agent'`,
      pastille et état « attend votre accord » tombent ; une réponse de l'utilisateur tardive est
      sans effet (rien envoyé à l'agent, pas d'erreur).
- [x] 2. Analyseur partagé pur `todos` (texte ou tableau) → `[{ text, state }]`, très testé ; la carte
      de l'outil porte `todos` (champ disponible, rendu inchangé).
- [x] 3. Titre « Updating todo list » traduit (fr et en) dans Réglages › autorisations retenues.
- [x] 4. Fonction partagée pure de raccourcissement de chemin (dossier de la conversation → son nom,
      dossier personnel → `~`), testée, branchée à la préparation de la carte de commande.
- [x] 5. Défaut 5 reproduit contre l'agent factice, cause expliquée ; corrigé si petit et sûr, sinon
      décrit comme reste à faire.
- [x] Scénarios d'agent factice (annulation par l'agent ; liste de tâches avec `todos`) documentés
      dans `docs/mock-agent.md`. Suites e2e touchées vertes, captures regardées.

## Plan

Fichiers : `src/main/agent/pending-requests.ts`, `agent-host.ts`, `trace-replay.ts`,
`src/shared/agent.ts`, `permissions.ts`, `transcript.ts`, `src/shared/todos.ts` (nouveau),
`src/shared/path-display.ts` (nouveau, ou existant à étendre), `RememberedApprovals.tsx`,
`fr.json` / `en.json`, `src/mock-agent/*`, `docs/mock-agent.md`, trace réelle dans
`src/main/agent/__traces__/bob-2.0.9/`. Pas de nouvelle dépendance.

Ordre : trace + test qui échoue, puis correctif (1) ; analyseur (2) ; clés (3) ; chemin (4) ;
reproduction (5) ; scénarios, doc, e2e.

## Journal

- 2026-11-09 — Corrections faites, partie main / partagée / logique ; **aucun changement de rendu des
  cartes** (les maquettes de la fiche 213 viennent ensuite).
  1. **Carte fantôme.** Test d'abord (trace rebâtie `bob-2.0.9/ecriture-hors-dossier-annulee-par-bob`
     : demande, `$/cancel_request`, outil `failed`) : échouait (aucune fermeture). Correctif : le SDK
     ACP abandonne le `signal` du gestionnaire de `session/request_permission` à la réception de
     `$/cancel_request` ; `PendingRequests.permission(…, signal)` retire alors la demande
     (`permission-resolved` avec `cancelledBy: 'agent'`, réponse `cancelled`), l'état « attend votre
     accord » (`waiting()`, silence) et la pastille (`attention.ts`, déjà suspendue à
     `permission-resolved`) tombent. Seule l'annulation de la requête (code -32800) compte : la
     fermeture de la connexion (agent mort) reste traitée par `cancelAll`. Une réponse de
     l'utilisateur après le retrait est un no-op silencieux (jeu borné de 50 identifiants). Repère
     pour les maquettes : `ToolPermission.cancelledBy === 'agent'` dans le fil (le renderer montre
     aujourd'hui l'état « annulée » existant). Rejeu (`trace-replay.ts`) aligné. Scénario
     `annulation-par-agent` (étape `agentCancels` de l'agent factice), test d'hôte, e2e `permissions`.
  2. **Liste de tâches.** `src/shared/todos.ts` : `parseTodos` (texte à cases ou tableau →
     `{ text, state: pending | in_progress | completed }`), marqueurs `[ ]`, `[x]` (vus chez Bob),
     `[X]`, `[-]` / `[~]` (en cours) ; lignes sans case ignorées), tableau de textes ou
     d'objets, bornes (200 tâches, 500 caractères). Le fil porte `todos` sur la carte de l'outil
     (`ToolItem.todos`), lu dans `rawInput.todos` pour toute carte, sans regarder titre ni `kind`.
     `input.todos` (lignes brutes, libellé « Mise à jour de la liste de tâches (n) » de la fiche 125)
     reste tel quel. Trace `bob-2.0.9/liste-de-taches-autorisee-une-fois` (formes du journal réel :
     `tool_call` et demande portent `rawInput.todos`, puis `plan`). Scénario `liste-taches-bob`.
  3. **Titre traduit.** `rememberedToolText` (`permissions.ts`) : « Updating todo list » → clé
     `settings.privacy.tools.known.todoList` (fr « Mise à jour de la liste de tâches », en « Task list
     update »), titre d'origine en infobulle ; l'outil révoqué reste désigné par son titre exact. Titre
     inconnu : tel quel.
  4. **Chemin court.** `src/shared/path-display.ts` : `shortFolderPath` (dossier de la conversation →
     son nom, dossier personnel → `~`, sinon rien ; doute → rien) et `shortenHomeIn` (texte libre).
     Branchées sur les **libellés** : `cleanCommand` / `cleanTitle` (ligne de la carte), en-tête des
     diffs hors du dossier (`filePathParts`). Le dossier personnel vient du main (argument de fenêtre
     `--bobine-home`, comme la langue ; `window.api.app.home`) ; `setHomeFolder` au démarrage du
     renderer et du main. **Volontairement pas touchés** : le bloc de la commande à autoriser et la
     ligne « Dans <dossier> » d'un dossier hors du dossier de la conversation, qui restent entiers
     (fiche 203, sécurité M1 : « hors du dossier : jamais raccourci »). Je n'ai pas pu voir la capture
     d'origine : si le chemin long qui gênait était celui de cette ligne « Dans… » ou du bloc, c'est
     une décision d'interface à prendre avec les maquettes. Pas traité : l'alias macOS
     `/tmp` = `/private/tmp` (un dossier de conversation `/tmp/x` et une commande en
     `/private/tmp/x` sont lus comme deux dossiers ; `realpath` côté main, à décider).
  5. **Agent par défaut démarré.** Reproduit (test `manager.test.ts`, « dossier connu au lancement :
     l'agent par défaut démarre avant le choix d'un autre agent ») : avec un dossier connu,
     `startActive()` démarre l'agent du profil par défaut au lancement (voulu : fiche 093, modèles et
     modes disponibles dès l'ouverture) ; choisir ensuite un autre agent jette le brouillon et arrête
     le premier. Le premier lancement sans dossier ne démarre rien (fiche 093, essai existant) : le
     cas de la recette d'octobre est donc déjà réglé. **Pas corrigé** : démarrer à la première
     frappe plutôt qu'au lancement changerait ce que voit l'utilisateur (sélecteurs de modèle et de
     mode, état de l'agent) et touche tous les agents ; reste à faire avec les maquettes, ou
     contournement : choisir l'agent voulu comme agent par défaut (Réglages › Conversation › Nouvelle conversation › Agent).
- CHANGELOG fr et en (« Prochaine version »). Pas d'ADR (pas de décision structurante), pas de
  nouvelle dépendance. `docs/acp.md` : lignes « Demande d'autorisation retirée par l'agent » et
  « Liste de tâches ». `docs/mock-agent.md` : scénarios et étape `agentCancels`.
- Essais : `./scripts/verify` vert ; `pnpm build && pnpm e2e --changed` (suite complète, 190 tâches,
  clair et sombre) : tout vert sauf `permissions`, dont mon nouveau contrôle comptait aussi la pastille
  d'une autre conversation de la même suite ; contrôle limité à la conversation active, `pnpm e2e
  permissions` vert. Captures regardées : `e2e/captures/c2-demande-retiree-par-agent-{light,dark}.png`
  (carte « Demande d'autorisation annulée », outil en échec, plus de pastille sur la conversation).

- 2026-11-09 (suite, revue du tech lead) — **Point 1 repris sur une trace RÉELLE** (relevé par le
  tech lead avec Bob 2.0.9) : Bob envoie trois demandes en parallèle ; après `allow_always` sur la
  première il retire les deux autres par `$/cancel_request` **parce qu'elles sont déjà autorisées**,
  puis les trois outils se terminent `completed`. Ce n'est donc pas une annulation : la carte
  disparaît **sans bruit** (ni « Demande d'autorisation annulée », ni échec) et l'outil garde l'état
  que l'agent lui donne. `permission-resolved` avec `cancelledBy: 'agent'` retire la demande du fil
  (`withoutPermission`) ; `ToolPermission.cancelledBy` supprimé. La trace reconstituée est
  remplacée par `bob-2.0.9/demandes-paralleles-cancel-request.ndjson` (enregistrée, nettoyée) ; le
  test de rejeu écarte les réponses du client d'essai aux demandes 1 et 2 (l'utilisateur ne répond
  qu'à la première) et échouait sur le code précédent. Scénario `annulation-par-agent` : retrait
  PUIS outil `completed`. La maquette 214-5 (« Demande retirée par l'agent ») n'est **pas** mise en
  œuvre : l'afficher serait trompeur (la demande n'a pas été refusée, l'outil a réussi).
- 2026-11-09 — **Interface d'après les maquettes validées** (`maquettes-214-215`) :
  - Portée de « Toujours » **déclarée par le profil** : `AgentProfile.alwaysScope` (Bob :
    `lasts: 'conversation'`, `covers: { execute: 'parts', edit: 'all-edits' }`), passée à
    l'interface par `AgentInfo.alwaysScope`, listée dans `specificItems` (`always-scope`) et la matrice
    de `docs/agents.md`. Carte : bouton « Toujours dans cette conversation » et précision par genre
    (commande : « cette commande et chacune de ses parties… » ; modification : « toutes les
    modifications… ») ; agent sans déclaration : « Toujours autoriser » et « C'est l'agent qui décide
    ce que couvre « toujours » » seulement. Quand Bobine retient (fiche 042) : « Toujours autoriser »
    et la portée exacte (outil ou liste de tâches, agent, conversations suivantes). Aucun test de
    l'agent dans l'UI : `AgentCardContext` porte ce que le profil déclare.
  - Pastille du dossier de la conversation dans la commande (`folderChunks`, `CommandBlock`) :
    frontière nette, jamais au moindre doute ; chemin entier en infobulle et nom accessible ; le texte
    copié est celui de l'agent ; les autres chemins restent du texte (fiche 203, M1).
  - Carte de liste de tâches (question dédiée, tâches par état, compte, texte caché pour le lecteur
    d'écran) ; carte d'outil MCP : arguments de `rawInput` (`ToolItem.args`, `kind: other`, valeurs
    simples, 8 au plus) ; carte à risque : ligne « Toujours n'est pas proposé pour une action signalée ».
  - Point d'insertion pour la fiche 215 : `PermissionFooter` (composant vide, sous les notes de la
    carte, reçoit l'outil et sa demande).
  - Écarts aux maquettes : les lignes d'une liste de tâches sans case ne sont pas montrées (Bob les
    ignore aussi) ; pas de repli après 8 tâches (Q4 non tranchée) ; la phrase « les autres outils du
    même serveur seront demandés » n'est pas écrite (on ne sait pas qu'un outil vient d'un serveur
    MCP) ; la pastille `~` (dossier personnel) n'est pas dans la commande (décision : seul le dossier
    de la conversation) ; la ligne d'outil repliée garde le libellé relatif de la fiche 125.
  - e2e `permissions` (clair et sombre) : captures `c3-commande-pastille`, `c4-liste-taches`,
    `c5-outil-mcp`, `c6-carte-a-risque`, `c2-demande-retiree-par-agent`.
- Essais finaux : `./scripts/verify` vert ; `pnpm build && pnpm e2e --changed` (suite complète, 190 tâches, clair et sombre) entièrement vert (14 min 58 s). Captures regardées : `e2e/captures/c3-commande-pastille-*.png`, `c4-liste-taches-*.png`, `c5-outil-mcp-*.png`, `c6-carte-a-risque-*.png`, `c2-demande-avant-retrait-*.png`, `c2-demande-retiree-par-agent-*.png` (clair et sombre).
- Correctifs de revue : pastille (cause : `text-indent: -2ch` hérité de la ligne de commande décalait le contenu de la pastille sur l'icône ; `text-indent: 0`, nom long coupé avec le chemin entier en infobulle), boutons atténués sur la capture (cause : carte pas encore « armée », 400 ms, opacité 0,55 par conception — la capture attend maintenant `data-armed`), compte des tâches au pluriel i18n (« 1 faite », « 2 faites »), icône de liste (ListTodo) sur la ligne d'outil.
- 2026-11-09 — Recette QA avec le vrai Bob (branche `integration-213`, Bob passé seul en 2.1.0
  pendant la recette) : quand le profil déclare la portée de « Toujours », la carte n'a plus
  qu'UNE note, comme la maquette 214-2 (« **IBM Bob** : cette commande et chacune de ses
  parties… »), sans la phrase générique, réservée aux agents sans déclaration (décision Q1) ; la
  ligne de réponse reprend le libellé du bouton choisi (« Toujours dans cette conversation »).
  Tests (`PermissionCardExtras.test.tsx`) et captures `215-b`, `215-d` (e2e `regles-approbation`).
