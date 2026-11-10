# 103 — Bobine garde son propre fil : mise en veille et redémarrage sans perte

- **Statut** : fait (essai réel Bob et OpenCode à faire)
- **Dépend de** : 015 (historique), 041 (« Relancer » garde le fil), 055 (sessions reprises
  d'ailleurs), 096 (diffs d'OpenCode au rejeu), 102 (mise en veille)
- **Agents** : les deux (rien de propre à un agent : `session/resume` ou `session/load` selon ce
  que l'agent annonce)

## Pourquoi

Une conversation mise en veille (fiche 102) ou rouverte après un redémarrage est rechargée par
l'agent (`session/load`) : le gestionnaire rouvre la session sans `keepTranscript`, l'hôte émet
`reset`, et le fil est reconstruit à partir du rejeu. L'agent ne connaît que ses messages et ses
outils : tout ce que Bobine avait ajouté disparaît (cartes des outils de l'app, comptes rendus de
filles, remarques, libellés lisibles, « Réponse interrompue »), et les diffs d'OpenCode doivent
être retrouvés par un adaptateur (fiche 096). La fiche 102 nommait le remède : « Bobine garde
elle-même ce qu'elle ajoute au fil ». C'est le chantier 1 de l'audit du 2026-10-21
(`docs/audit-maturite-2026-10-21.md`).

Le fil est déjà sur le disque (`conversations/<id>.json`, écriture atomique, fiche 041) ; le
chemin « fil gardé » existe pour « Relancer » (`keepTranscript` : `session/resume` si l'agent le
permet, sinon `session/load` avec rejeu ignoré). Il manque la décision : **le fil enregistré par
Bobine fait foi pour l'affichage ; l'agent fait foi pour son contexte.**

## Critères d'acceptation

- [x] Une conversation qui a un fil enregistré est toujours rouverte avec ce fil : mise en veille
      puis retour, redémarrage de l'app, « Relancer ». Les cartes de l'app, les comptes rendus de
      filles, les remarques et la consommation sont identiques avant et après.
- [x] Le rejeu de l'agent ne sert plus que sans fil enregistré : session reprise d'ailleurs
      (fiche 055), fichier de fil illisible (mis de côté, avis).
- [x] Session continuée ailleurs pendant la veille (`bob chat`, Bob IDE, `opencode`) : les tours que
      le fil n'a pas sont ajoutés à la fin, sans doubler ceux qu'il a.
- [x] Le fil d'un agent mis en veille est écrit sur le disque avant l'arrêt de l'agent (file
      d'écriture vidée).
- [x] Le format du fil porte un numéro de version ; un fil sans version est lu comme aujourd'hui.
- [x] ADR : source de vérité du fil (ADR-0021).
- [x] Testé contre l'agent factice (scénarios : veille puis réveil avec cartes de l'app, session
      continuée ailleurs, fil illisible) ; suites e2e `resume`, `restart`, `replay-changes`,
      `filles` vertes, captures regardées.
- [ ] Essai réel : Bob et OpenCode, conversation mise en veille puis rouverte (0 ou presque
      0 bobcoin : `session/resume` ne rejoue rien).

## Plan

Décision (ADR-0021) : le fil enregistré par Bobine fait foi pour l'affichage ; l'agent fait foi
pour son contexte. Le rejeu ne reconstruit un fil que s'il n'y en a pas.

1. `src/shared/replay-tail.ts` (nouveau, pur) : `replayTail(stored, replayed)` rend les éléments
   du rejeu qui suivent le dernier message utilisateur connu du fil (compte des éléments `user`) ;
   vide si le rejeu n'en a pas plus. Tests.
2. `src/shared/agent.ts` : évènement `{ type: 'replayed', items }` ; `src/shared/transcript.ts` :
   `reduceTranscript` ajoute `replayTail(...)` au fil (identifiants renumérotés) et, s'il y a
   quelque chose, un avis `transcript.notice.continuedElsewhere` (FR, EN).
3. `src/main/agent/session-updates.ts` : avec le fil gardé, une mise à jour du rejeu est
   `{ kind: 'replayed' }` au lieu de `drop`. `src/main/agent/agent-host.ts` : ces mises à jour
   s'accumulent dans un fil de brouillon (`reduceTranscript`) ; il est émis (`replayed`) quand le
   rejeu se calme (réponse à `session/load` reçue et 300 ms sans mise à jour, pour le rejeu tardif
   de Bob), ou au plus tard au message suivant ; vidé à l'arrêt. Avec le fil gardé, `session/load`
   est préféré à `session/resume` quand l'agent sait les deux : le rejeu (sans appel au modèle)
   permet la réconciliation.
4. `src/main/conversations/manager.ts` (`ensureLive`) : le fil est gardé dès qu'il contient
   quelque chose ; une conversation sans fil (reprise d'ailleurs, fichier illisible) est rejouée
   comme avant.
5. `src/main/conversations/store.ts` : `version: 1` écrit avec le fil, retiré à la lecture.
6. Tests : hôte (fil gardé + rejeu : rien tant que le rejeu ne dépasse pas le fil ; session
   continuée ailleurs : la fin est ajoutée, une fois), gestionnaire (mise en veille d'une réponse
   interrompue puis réveil : fil identique, avis « interrompue » compris ; session continuée
   ailleurs), magasin (version). Suites e2e `restart`, `resume`, `replay-changes`, `filles`.
7. ADR-0021, `docs/architecture.md` (ligne historique), `docs/acp.md` (réouverture), changelog.

Aucune nouvelle dépendance.

## Journal

- 2026-10-21 — Fiche créée (audit de maturité, chantier 1).
- 2026-10-21 — Fait, sur la branche `fiche-103-fil-durable`.
  - **Politique** : `ensureLive` garde le fil dès qu'il contient quelque chose ; `AgentHost` préfère
    `session/load` même avec le fil gardé (le rejeu sert à la réconciliation), `session/resume`
    sinon. Le rejeu va dans un `ReplayBuffer` (`main/agent/replay-buffer.ts`, module à part :
    `agent-host.ts` était au plafond de lignes) et ressort en un évènement `replayed` quand il se
    calme (300 ms, rejeu tardif de Bob compris) ou au message suivant ; `reduceTranscript` n'en
    ajoute que la fin inconnue (`shared/replay-tail.ts`, compte des messages utilisateur), avec
    l'avis « Conversation continuée ailleurs : N échanges ajoutés ».
  - **Écriture avant la veille** : rien à ajouter, le gestionnaire garde le fil en mémoire tant
    qu'il n'est pas écrit (`releaseTranscripts` attend l'écrivain) ; vérifié par le test « mise en
    veille puis réveil ».
  - **Version** : `version: 1` écrit par `ConversationStore`, retiré à la lecture ; un fil sans
    version est lu tel quel.
  - **Écarts au plan** : aucun. En plus : `.claude/worktrees/` ignoré par ESLint et Prettier (les
    worktrees des sessions parallèles faisaient échouer `verify` du dépôt principal) ; un test de
    la fiche 102 attendait une demande d'autorisation sans l'attendre (intermittent, corrigé).
  - **Tests** : hôte (4 cas : agent qui rejoue, rejeu tardif seul, reprise seule, session continuée
    ailleurs), gestionnaire (réponse interrompue gardée après mise en veille), magasin (version),
    `replayTail`, `ReplayBuffer` ; `verify` vert (1 197 tests) ; suites e2e `restart`, `resume`,
    `replay-changes`, `filles` vertes en clair et en sombre.
  - **Reste** : l'essai réel avec Bob et OpenCode (conversation mise en veille puis rouverte, puis
    continuée dans `bob chat` ou `opencode` entre-temps) est à faire par l'utilisateur ; 0 bobcoin
    attendu (le rejeu n'appelle pas le modèle).
