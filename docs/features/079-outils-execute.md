# 079 — Outils de l'app appelés par du code (`execute` d'OpenCode 2)

- **Statut** : fait
- **Dépend de** : 029 (outils de l'app), 047 (libellés lisibles), 071 (titres reconnus), 078
  (OpenCode 2)
- **Agents** : générique — rien ne dépend du nom de l'agent ni de celui de son outil. Le cas qui
  l'a fait naître est OpenCode 2 ; Bob et OpenCode 1 ne sont pas concernés (leurs cartes portent
  le titre de l'outil de l'app).

## Pourquoi

OpenCode 2 n'appelle pas directement les outils MCP de Bobine : il les appelle depuis du
JavaScript, par son outil `execute` (« Code Mode »). Dans le fil, toutes les cartes s'appellent
alors « execute », sans le libellé lisible de l'outil de l'app, et les captures ou planches
contact n'apparaissent pas sous la carte (essai réel du 2026-10-17, fiche 078).

## Relevé (OpenCode 2.0.32, 2026-10-17)

Trace ACP brute avec un serveur MCP qui imite celui de Bobine :

1. `tool_call` : titre `execute`, `kind: other`, `rawInput: {}`.
2. `tool_call_update` (`in_progress`) : `rawInput.code` = le JavaScript, qui cite les outils
   (`await tools.bobine.browser_screenshot({})`, `await tools.bobine.browser_filmstrip({ frames: 3 })`).
3. Les appels MCP arrivent à Bobine pendant que la carte est `in_progress`.
4. `tool_call_update` (`completed`) : les images des outils dans le contenu ;
   `rawOutput.metadata.toolCalls` liste les outils appelés (propre à OpenCode).

Couper le Code Mode : seulement serveur par serveur, dans le fichier de configuration d'OpenCode
(`codemode: false`, vrai par défaut) ; ACP ne transmet pas cette option avec les serveurs de la
session. Écarté : Bobine devrait écrire dans la configuration de l'agent.

## Décisions (utilisateur, 2026-10-17)

- **Rattacher** : un appel d'outil de l'app qu'aucune carte n'annonce par son titre est rattaché
  à la carte en cours dont l'entrée cite l'outil (la plus récente), sinon à la seule carte en
  cours. Libellé et captures arrivent pendant que la carte tourne, quel que soit l'agent. Si le
  code arrive après l'appel (relevé ci-dessous), l'appel est rattaché dès qu'une des cartes en
  cours au moment de l'appel le cite.
- **Titre d'une carte qui appelle plusieurs outils** : leurs libellés à la suite, dans l'ordre
  (« Capture la page · Filme la page pendant un geste »).

## Critères d'acceptation

- [x] Une carte `execute` qui appelle des outils de l'app prend leur libellé lisible (à la suite
      s'il y en a plusieurs) et montre leurs captures sous la carte, comme avec Bob.
- [x] Rien ne change pour Bob et OpenCode 1 (cartes reconnues par leur titre).
- [x] Un appel qu'on ne peut rattacher à rien reste sans carte, comme avant (pas de rattachement
      au hasard quand plusieurs cartes tournent sans citer l'outil).
- [x] Testé : unitaires (rattachement, titre à la suite) ; agent factice, scénario `outils-execute`
      qui imite OpenCode 2 ; e2e `browser`, clair et sombre, français et anglais ; essai réel avec
      OpenCode 2.
- [x] `pnpm opencode-probe` vérifie que les outils de l'app passent toujours par une carte qui
      les cite (et prévient si ça change).

## Plan

1. `main/agent/app-tools-bridge.ts` : cartes en cours non reconnues par leur titre (entrée
   relevée à chaque mise à jour), rattachement d'un appel MCP à l'une d'elles.
2. `main/agent/agent-host.ts` : passe aussi les `tool_call_update` de la session au pont.
3. `shared/transcript.ts` : `appTools` (tous les libellés de la carte) à côté d'`appTool` ;
   `shared/app-tools.ts` : titre à la suite ; `ToolCall.tsx` l'affiche.
4. Agent factice : étape `code-mode` (carte `execute`, code, appels MCP sans demande
   d'autorisation), scénario `outils-execute` ; e2e `browser`.
5. Sonde d'OpenCode : relevé de la carte `execute` et de son code ; contrat de l'app.
6. Clore : docs/acp.md, docs/agents.md, fiche, index, CHANGELOG.md et CHANGELOG.en.md.

## Journal

- 2026-10-17 — Fiche créée après l'essai réel d'OpenCode 2 dans Bobine (fiche 078) ; relevé ACP
  brut ; choix de l'utilisateur : rattacher, titres à la suite.
- 2026-10-17 — **Fait.**
  - **Pont** (`app-tools-bridge.ts`) : cartes en cours que leur titre ne relie à aucun outil de
    l'app, avec leur entrée en texte (mise à jour à chaque `tool_call_update`, retirées à leur fin
    et à la fin du tour) ; un appel MCP sans carte nommée va à la plus récente qui cite l'outil
    (nom entier), sinon à la seule en cours, sinon nulle part. `agent-host.ts` passe les
    `tool_call_update` de la session au pont.
  - **Course relevée** : sur la 2.0.32, l'appel MCP arrive parfois **avant** la mise à jour qui
    porte le code (même trace, même dixième de seconde). D'où le rattachement après coup : l'appel
    garde la liste des cartes en cours, et la première qui le cite le reçoit (libellé et captures).
  - **Fil** : `appTools` garde tous les libellés d'une carte, `appTool` le premier (groupes) ;
    titre à la suite (`appToolsText`, « Ouvre … · Capture la page · Filme la page pendant un
    geste »).
  - **Agent factice** : étape `code-mode` (carte `execute`, code, appels MCP sans demande
    d'autorisation), scénario `outils-execute` ; e2e `browser` : titre à la suite, capture et
    planche sous la carte.
  - **Sonde** : relevé « outils de l'app » (faux serveur MCP « bobine », `via` : titre, code ou
    rien ; carte en cours qui finit par citer l'outil), vérification au contrat, note si l'appel
    n'est plus rattachable. Attentes enregistrées sur la 2.0.32.
  - **Essai réel** (OpenCode 2.0.32, modèle gratuit) : cartes « execute » rattachées (« Ouvre … »,
    « Clique · Filme la page pendant un geste »), planche sous la carte.
