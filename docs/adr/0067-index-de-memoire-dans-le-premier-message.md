# ADR-0067 — Index de la mémoire dans le premier message de chaque session, pour tous les agents

- **Statut** : accepté
- **Date** : 2026-11-22
- **Remplace en partie** : ADR-0040 (décision 6 seulement ; les décisions 1 à 5, 7 et 8 sont
  inchangées)

## Contexte

La décision 6 de l'ADR-0040 prévoyait deux chemins pour donner l'index de la mémoire à l'agent :
en prompt système fourni par le client (`systemPrompt`, mode `append`, même valeur à
`session/load` / `session/resume`) quand l'agent annonce `sessionCapabilities.systemPrompt`, et
sinon en bloc de texte joint au premier message de chaque session et après une compaction.

Seul le second chemin existe (fiche 182, « Écarts au plan » ; question ouverte de l'ADR-0040 du
2026-11-19 ; issue #22). Constat dans le code au 2026-11-22 :

- **Aucune trace de `systemPrompt`** dans `src/`, `scripts/` ni `e2e/` : la capacité n'est pas lue
  (`announcementOf`, `src/main/agent/capabilities.ts`), `session/new` (`newSessionRequest`) et
  `session/load` / `session/resume` (`reopenRequest`, `src/main/agent/agent-host.ts`) n'envoient
  que `cwd`, les autres dossiers et les serveurs MCP. Pas de repère `system-prompt`, pas d'option
  `--prompt-systeme` dans l'agent factice.
- **L'index part en texte** : `MemoryService.sessionContext` (`src/main/memory/service.ts`) rend
  le bloc `<bobine_memory>` écrit par `memoryContext` (`src/shared/memory.ts` : consignes, puis
  souvenirs validés « Vous » et du projet, borné à 4 000 caractères) ; le `sessionContext` de
  `src/main/conversations/host-options.ts` le joint, après `<bobine_capabilities>`, à toute
  session qui a reçu l'outil `remember`, mémoire activée relue à l'envoi (pas en Discussion, pas
  au relecteur ni famille « Mémoire » coupée : l'outil n'est alors pas proposé).
- **Quand** : `AgentHost` retient un contexte dû (`sessionContextDue`) et `sessionContextOf`
  (`src/main/agent/prompt-content.ts`) le calcule au prochain envoi, joint **après** le texte de
  l'utilisateur (fiche 125) :
  - session ouverte, neuve ou rouverte (`applySession` : `opened` / `resumed`), donc au premier
    message de chaque session, nouvelle conversation, reprise, relance après un redémarrage ou une
    session neuve de l'ADR-0030 ;
  - message suivant une compaction, demandée depuis l'app (`isCompactionRequest` dans
    `AgentHost.prompt`) ou faite par l'agent (`compaction_update`) : `compacted` ;
  - message renvoyé dans une session neuve après une perte de connexion (`resendBlocked`).
  Le moment ne change que le bloc des filles (complet ou rappel, fiche 223) ; l'index de la
  mémoire part entier à chaque fois.

Côté agents : le schéma ACP a une capacité **facultative** de prompt système fourni par le client
(instable en 1.29, stabilisée en 1.30, `docs/acp.md`), mais ni Bob (2.0.9, 2.1.0) ni OpenCode
(2.2.5, 2.3.0) ne l'annoncent (sondes). ACP n'offre donc **aucun moyen commun** de poser un prompt
système chez les agents que Bobine sert ; le premier message est le seul canal que tous reçoivent.
L'agent factice (scénario `memoire-index`) et les essais réels d'OpenCode (fiche 182, journal du
2026-11-07) montrent que l'index lu au premier message suffit : l'agent le cite dans une nouvelle
conversation et appelle `remember` de lui-même.

## Décision

**L'index de la mémoire part en bloc de texte `<bobine_memory>`, joint après le message de
l'utilisateur, au premier message de chaque session (neuve, rouverte ou renouvelée) et au premier
message après une compaction, pour tous les agents, par le même chemin que le reste du contexte de
session (fiche 118).** Bobine n'envoie pas de prompt système. Le détail reste lu à la demande
(`recall`).

Le prompt système fourni par le client est **reporté** : il ne sera ajouté, par un nouvel ADR, que
le jour où un agent servi par Bobine annoncera `sessionCapabilities.systemPrompt`, avec un scénario
de l'agent factice qui l'annonce et un essai sur l'agent réel.

## Pourquoi c'est générique

- Même chose pour Bob, OpenCode et tout agent ACP : du texte ordinaire dans `session/prompt`, que
  tout agent accepte, comme `<bobine_capabilities>` ; aucun champ, `_meta`, option ou fichier
  propre à un agent, rien de supposé de Bob (ADR-0011, ADR-0028).
- Le bloc est reconnu par son début (`APP_CONTEXT_OPENINGS.memory`, `src/shared/app-context.ts`) :
  `stripAppContext` le coupe d'un titre de session tiré du premier message, quel que soit l'agent.
- Rejoint après une compaction, il survit à un résumé qui l'aurait perdu, sans dépendre de la façon
  dont chaque agent compacte.

## Alternatives écartées

- **Branche « prompt système » propre à un agent** (fichier de consignes ou de mode écrit pour
  l'agent, option de lancement, champ `_meta`) — un chemin par agent, contraire à ADR-0011 et à la
  règle « rien de non documenté sur Bob » ; pour Bob, rien de documenté ne le permet. Écrire dans
  les fichiers d'un agent est déjà écarté par l'ADR-0040 pour la mémoire elle-même.
- **Branche ACP `systemPrompt` codée dès maintenant, derrière la capacité** (décision 6 d'origine)
  — générique sur le papier, mais aucun agent servi ne l'annonce : du code mort, essayé seulement
  contre le factice, et deux chemins à garder cohérents (refus de l'agent, même valeur à
  `load` / `resume`, retour au premier message). Reportée, pas refusée (voir Décision).
- **Outil MCP seul, sans index envoyé** (`recall` ou une ressource que l'agent irait lire) —
  l'agent ne sait pas qu'il a quelque chose à lire ; déjà écarté par l'ADR-0040, pour la même
  raison que Claude Code donne l'index d'office.

## Conséquences

- La décision 6 de l'ADR-0040 est remplacée par celle-ci ; la conséquence de l'ADR-0040 sur la
  partie instable du schéma (« le retour au SDK 1.9 le coupe ») ne s'applique plus : rien ne
  dépend de `systemPrompt`.
- Le coût reste visible : ≈ 1 000 jetons au plus par session (index borné), ligne « Mémoire » de
  l'onglet Session (évènement `memory-context`), et de nouveau après chaque compaction.
- L'index fait partie du message de l'utilisateur pour l'agent : certains agents le rejouent dans
  leur historique (Bob le renvoie en `user_message_chunk`, trace
  `src/main/agent/__traces__/bob-2.0.9/limite-etapes-session-rouverte.ndjson`) ; Bobine le coupe des
  titres, et le fil de Bobine fait foi (ADR-0021).
- Un index reçu au premier message pèse moins qu'un prompt système pour certains modèles. À
  surveiller à la recette sur Bob réel (déjà demandé par l'ADR-0040) : qu'il lise l'index et
  appelle `remember` de lui-même.
- À revoir quand une sonde (`pnpm bob-probe`, `pnpm opencode-probe`) montrera
  `sessionCapabilities.systemPrompt` : c'est alors l'étape 5 de la fiche 182, par un nouvel ADR.
