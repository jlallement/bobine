# 015 — Historique des conversations

- **Statut** : fait
- **Dépend de** : 003, 004, 013, 014

## Pourquoi

« Nouvelle conversation » effaçait la conversation en cours (avec une confirmation). Dans Claude
Desktop, elle rejoint l'historique et reste consultable et **reprenable**. Codex et Bob (vérifié sur
Bob 2.0.6) savent recharger leurs sessions (`loadSession`, `session/list`, `resume`, `close`, `delete`).

## Critères d'acceptation

- [x] « Nouvelle conversation » **sans confirmation** ; l'ancienne apparaît dans « Récents » (barre
      latérale), triée par dernière activité.
- [x] Clic sur une conversation : elle s'affiche ; on peut **reprendre l'échange**. Les conversations
      récentes restent vivantes (une réponse peut continuer en arrière-plan).
- [x] L'historique **survit au redémarrage** : à la réouverture, `session/load` (l'agent rejoue
      l'échange), sinon `session/resume` avec le fil mémorisé, sinon **lecture seule** avec un bouton
      « Continuer dans une nouvelle conversation ».
- [x] Chaque conversation garde **son agent et son dossier** ; changer d'agent / de dossier sur une
      conversation commencée ouvre une nouvelle conversation (sur une conversation vide : la reconfigure).
- [x] Renommer et supprimer une conversation (suppression côté agent si `session/delete` est supporté).
- [x] Le titre vient du premier message, ou de l'agent s'il en propose un (`session_info_update`).
- [x] Au plus quelques processus d'agent vivants : les conversations inactives les plus anciennes sont
      arrêtées (`session/close` si supporté) et rechargées à la demande.
- [x] Rien n'est supposé de l'agent : tout dépend des capacités annoncées à `initialize`.
- [x] Testé : agent factice avec et sans historique, persistance, gestionnaire ; `pnpm e2e` (nouvelle
      conversation, bascule, redémarrage de l'app puis reprise) ; essai réel avec Codex.

## Plan

**Architecture** : un `AgentHost` (processus + session) **par conversation**, lancé dans le dossier de
la conversation — conforme à Bob, dont les commandes héritent du dossier de `bob acp`.

- `AgentHost` — ouverture `new` / `load` / `resume` selon les capacités ; `reset` puis rejeu lors d'un
  `load` (les `user_message_chunk` ne sont pris en compte que pendant le rejeu) ; `closeSession()`,
  `deleteSession()` ; capacités dans le snapshot ; statut `read-only` si rien ne permet de reprendre.
- `src/main/conversations/store.ts` — index (`conversations/index.json`) + fil mémorisé par conversation
  (`conversations/<id>.json`), écritures atomiques.
- `src/main/conversations/manager.ts` — `ConversationManager` (remplace `AgentManager`) : brouillon
  courant (non persisté tant qu'il est vide), conversation active, hôtes vivants (limite + éviction),
  fil tenu à jour **dans le main** avec le réducteur partagé, titres, renommage, suppression.
- Événements : `{ conversationId, event }` ; événement `conversations` (liste mise à jour).
- IPC : `conversations:list`, `conversation:select`, `conversation:create`, `conversation:rename`,
  `conversation:delete` ; les `agent:*` prennent l'identifiant de conversation.
- **Agent factice** : sessions mémorisées sur disque (`--store <dossier>`), `session/load` (rejeu),
  `list`, `resume`, `close`, `delete` ; `--sans-historique` pour simuler un agent qui ne sait pas reprendre.
- **Renderer** : état par conversation, « Récents » avec menu (Renommer / Supprimer), bandeau lecture seule.

## Journal

- 2026-10-11 — Fiche créée. Bob 2.0.6 installé et sondé : `loadSession` + `list/resume/close/delete`.
- 2026-10-11 — Implémenté. 134 tests (agent factice : rejeu dans un nouveau processus, reprise,
  liste, suppression, titres, sans historique / sans rejeu ; `AgentHost` : 3 chemins de réouverture ;
  persistance ; `ConversationManager` : brouillon, historique, bascule, redémarrage, lecture seule,
  changement d'agent, titres, renommage, suppression, éviction, réglages). `pnpm e2e` étendu (nouvelle
  conversation sans confirmation, retour, renommage, **redémarrage de l'app puis reprise**, suppression).
  - **Essai réel Codex** : mot secret donné dans la conversation 1, nouvelle conversation, retour sur la 1
    → « ananas » (session vivante) ; **redémarrage de l'app** → conversation rechargée par `session/load`
    (2 messages reconstruits) → « ananas ». Codex titre lui-même ses conversations (`session_info_update`).
  - **Défaut trouvé et corrigé** : l'`AgentHost` émettait le message utilisateur avant de passer en
    « répond… » ; l'UI pouvait voir un message avec un agent « prêt ». Ordre inversé + test.
  - Architecture : un processus d'agent par conversation, lancé dans son dossier (conforme à Bob, dont
    les commandes héritent du dossier de `bob acp`) ; 4 vivants au plus, les plus anciens sont fermés
    (`session/close`) puis rouverts à la demande. `AgentManager` remplacé par `ConversationManager`.
  - Limites connues : supprimer une conversation **non vivante** ne la supprime que de l'app (pas de
    `session/delete` côté agent) ; le texte en cours de saisie n'est pas conservé quand on change de
    conversation ; Bob pas encore essayé (connexion nécessaire, fiche 011).
- 2026-10-11 — **Bob réel** : Bob rejoue l'historique **après** sa réponse à `session/load` ; l'app
  ignorait alors les messages de l'utilisateur rejoués (conversation rechargée sans eux). Corrigé : hors
  d'un tour lancé par l'app, un `user_message_chunk` est un rejeu. Option `--rejeu-tardif` de l'agent
  factice + test. Vérifié : conversation Bob rechargée avec ses messages, puis continuée.
