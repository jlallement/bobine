# Traces ACP (fiche 139)

Échanges JSON-RPC réels entre Bobine et un agent, un message par ligne (NDJSON), rejoués par
`trace-replay.test.ts` dans le tri des mises à jour et le réducteur du fil, et comparés à un
instantané (`../__snapshots__/trace-replay.test.ts.snap`).

- Première ligne : `{"trace": {agent, version, recordedAt, name, reconstituted?}}`.
- Puis `{"from": "client" | "agent", "t": <ms>, "msg": <message JSON-RPC>}`.
- Nettoyées : secrets masqués (`«masqué»`), dossiers jetables et dossier personnel remplacés par
  `<dossier>`, `<home>`, `<maison>`. Un test vérifie qu'aucun chemin de l'utilisateur ni jeton n'y
  reste.

## D'où elles viennent

- **Enregistrées** : `pnpm bob-probe --traces` et `pnpm opencode-probe --traces` écrivent une
  trace par sondage dans `<agent>-<version>/`. Après une mise à jour de l'agent : les relire,
  lancer `pnpm test`, regarder l'écart d'instantané, puis `pnpm vitest run trace-replay -u`.
- **Reconstituées** (`*-reconstituee/`, `reconstituted` dans l'en-tête) : rebâties à la main d'après
  les journaux de la recette d'octobre (`e2e/captures/recette-2026-10/*/journaux/agents.log`,
  niveau Détaillé : JSON coupé, identifiants raccourcis, textes regroupés). Ordre, formes et textes
  visibles sont ceux du journal ; le reste est complété. À remplacer par des traces enregistrées
  dès qu'une sonde les produit.
- **Enregistrées à la main** : `bob-2.0.9/commande-hors-dossier-et-sudo-refusees.ndjson` (fiche
  211) vient d'un petit client ACP de relevé (2026-11-09, `bob acp` sans option, deux demandes
  refusées) ; lignes de repère du client ôtées, dossier de la session remplacé par `<dossier>`,
  dossier voisin par `<maison>`.
- **Reconstituée d'une recette réelle** : `bob-2.0.9/limite-etapes-session-rouverte.ndjson` (fiche
  209) vient de `agents.log` de la recette du 2026-11-09 (`session.maxTurns: 2` posé un moment dans
  Bob 2.0.9, niveau Trace du journal, JSON coupé par le journal) : tour arrêté en
  `max_turn_requests`, refus en 6 ms sans mise à jour, relance du processus, `session/load`, message
  renvoyé, `end_turn`. Deux processus dans une seule trace ; `initialize` et `session/new` du
  premier, absents du journal, sont rebâtis ; message de mémoire, titre et commandes raccourcis.
- **Enregistrée** (fiche 214, 2026-11-09, Bob 2.0.9, client d'essai, projet jetable) :
  `bob-2.0.9/demandes-paralleles-cancel-request.ndjson` : trois `session/request_permission` en
  parallèle, `allow_always` sur la première, puis `$/cancel_request` de Bob pour les deux autres
  (déjà autorisées) et trois outils `completed`. Nettoyée (dossier du projet → `<dossier>`, dossier
  personnel → `<maison>`) ; sorties d'erreur et sortie du processus ôtées.
- **Reconstituée du banc des approbations** (2026-11-09, fiche 214, Bob 2.0.9, `agents.log` niveau
  Trace) : `bob-2.0.9/liste-de-taches-autorisee-une-fois.ndjson` (`tool_call` et demande portant
  `rawInput.todos` en texte à cases, réponse `allow`, fin, `plan`). Le journal ne garde pas les
  demandes d'autorisation : ces lignes sont rebâties d'après ce qu'il montre ; `initialize` et
  `session/new` viennent d'une autre trace du même Bob.
