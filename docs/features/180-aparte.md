# 180 — Aparté : une question à côté, hors du fil

- **Statut** : fait
- **Dépend de** : ADR-0030 (session neuve du même agent), 039 (commandes « / » de l'app), 061
  (session d'essai supprimée), 055 (« Reprendre une session… »), 164 (coût de toutes les sessions)
- **Agents** : les deux (générique : une session ACP de plus chez le même agent, `session/new`)

## Pourquoi

En pleine conversation, souvent pendant que l'agent travaille, on a une petite question à côté
(« c'est quoi déjà ce flag ? »). La poser dans le fil l'allonge, coûte du contexte à l'agent et
peut le détourner de sa tâche. Claude Code (`/btw`), Cursor et Codex proposent une question en
aparté : répondue à part, puis oubliée — ou recopiée dans le fil si elle sert.

## Critères d'acceptation

- [x] `/btw <question>` (commande de l'app, même pendant un tour ou avant le premier message) ou
      ⇧⌘A (menu Conversation › Aparté…) ouvre une carte « Aparté » au-dessus de la zone de saisie ;
      `/btw` seul ou le raccourci l'ouvrent avec le champ de question prêt.
- [x] La question part dans une **session neuve** du même agent, même dossier, mêmes réglages
      retenus (modèle), en mode plan s'il en a un ; rien n'est ajouté au fil ni au contexte de la
      session principale ; le tour en cours n'est pas interrompu.
- [x] Par défaut, l'aparté ne reçoit **rien** de la conversation ; une case « Joindre l'échange
      récent (≈ N jetons) » joint la fin du fil (borné à 8 000 caractères). Le choix est retenu
      d'un aparté à l'autre.
- [x] Lecture seule : consigne à l'agent (ne rien modifier) ; toute demande d'autorisation de
      l'aparté est **refusée d'office** et la carte le dit ; pas d'outils de Bobine (navigateur,
      `ask_user`, filles), aucun outil « toujours autorisé » repris ; un formulaire est décliné.
- [x] La réponse s'affiche en Markdown dans la carte ; on peut poser une question de plus (même
      session d'aparté), fermer (✕, Échap), ou « Ajouter au fil » : question et réponse en citation
      dans la zone de saisie, **jamais envoyées** d'office.
- [x] Coût de l'aparté affiché dans la carte et compté dans le coût de la conversation (compteur
      de la saisie, plafond) — comme une session précédente (`usage.earlier`, fiche 164).
- [x] À la fermeture : session supprimée chez l'agent s'il sait le faire, sinon fermée et retenue
      par la conversation : jamais proposée dans « Reprendre une session… ». Agent arrêté.
- [x] Accessible : carte `role="region"` nommée, focus sur le champ à l'ouverture et rendu à la
      saisie à la fermeture, état annoncé (`aria-live`), boutons nommés.
- [x] Testé contre l'agent factice : module main (session neuve, refus, coût, suppression),
      réducteur (coût), commande, carte ; suite e2e `aparte` (claire et sombre).

## Plan

**Décisions**

- *Session* : comme l'ADR-0030, une session neuve du même agent (`session/new`), mais dans un
  **hôte à part** (un `AgentHost` de plus, son propre processus) : la session principale peut être
  en plein tour, et l'aparté ne doit rien croiser (file d'attente, rejeu, réglages). Pas de
  `session/fork` (instable dans ACP, copierait tout le contexte : cher). Aucun changement du
  client ACP (fiche 181) : l'API publique de l'hôte suffit (`start`, `prompt`, `cancel`,
  `respondPermission`, `respondElicitation`, `deleteSession`, `closeSession`, `stop`).
- *Contexte* : rien par défaut (une question à côté se suffit, et chaque jeton se paie) ; la case
  joint la fin du fil en texte (`conversationText` de la branche, borné à 8 000 caractères ≈ 2 000
  jetons), avec l'estimation affichée à côté. Choix retenu dans le navigateur de l'app
  (`localStorage`, confort par fenêtre).
- *Lecture seule* : mode plan de l'agent s'il en a un (`initialMode: 'plan'`, générique,
  `isPlanMode`), consigne `<bobine_aside>` jointe après la question (fiche 125), et refus d'office
  de toute autorisation (option `reject_once`, sinon annulation) : un agent en mode « tout
  autoriser » ne demande rien, la consigne reste alors le seul garde-fou — dit dans la fiche.
- *Coût* : coût cumulé de la session d'aparté (`usage_update`, `usage-report` de Bob), ajouté au
  fil principal par un évènement `aside-cost` (écart depuis le dernier envoi) qui l'ajoute à
  `usage.earlier` : total, plafond et résumé de l'index le comptent sans autre changement. Rien
  dans le fil. « Mon activité » (journal par tour) ne le voit pas : limite assumée.
- *Pas de session fantôme* : `deleteSession` si l'agent sait le faire ; sinon `closeSession` et
  l'identifiant est retenu dans l'enregistrement (`asideSessions`), exclu de « Reprendre une
  session… » (`agentSessions`). La fermeture attend jusqu'à 2 s après la fin du dernier tour (coût
  de Bob relu après la réponse).
- *Entrées* : `/btw` (nom de Claude Code, non traduit comme les autres commandes) et ⇧⌘A (menu
  Conversation, liste des raccourcis). Pas de bouton de plus dans la barre de saisie (déjà
  chargée) : la commande apparaît dans le menu « / ».

**Fichiers**

- `src/shared/aside.ts` (nouveau) : `AsideView`, consigne et contexte joints, citation « Ajouter au
  fil », estimation de jetons ; `app-context.ts` : début `<bobine_aside>`.
- `src/shared/agent.ts`, `transcript.ts`, `usage.ts` : évènement `aside-cost` → `usage.earlier`.
- `src/main/conversations/aside.ts` (nouveau) : `Asides` (un aparté par conversation, hôte,
  refus, coût, fin de session) ; `aside-ipc.ts` (canaux `aside:*`).
- `src/main/conversations/manager.ts` : `asideHost` (options d'hôte de la conversation sans outils
  ni contexte), `noteAsideSession`, exclusion dans `agentSessions` ; `store.ts` : `asideSessions`.
- `src/shared/ipc.ts`, `src/main/ipc.ts`, `src/preload/api.ts`, `src/main/index.ts` : canaux
  `aside:ask`, `aside:close`, évènement `aside:changed`, arrêt à la sortie.
- `src/shared/app-commands.ts`, `renderer/app-commands.ts` : `/btw` ; `shared/shortcuts.ts` :
  commande de menu `aside`.
- `renderer/useAside.ts`, `components/thread/AsideCard.tsx` + CSS ; `App.tsx` (quelques lignes).
- i18n fr/en ; e2e `e2e/aparte.*` ; agent factice : scénario `aparte-ecriture` (demande
  d'écriture) si les scénarios existants ne suffisent pas.

Aucune dépendance nouvelle.

## Journal

- 06/11 : fiche et plan.
- 06/11, fait :
  - `shared/aside.ts` (vue, consigne `<bobine_aside>` en anglais, fin du fil bornée, estimation,
    citation) ; évènement `aside-cost` → `usage.earlier` (`withAsideCost`) ; début de bloc ajouté
    à `APP_CONTEXT_OPENINGS` (un titre d'agent qui reprendrait la consigne est coupé).
  - `main/conversations/aside.ts` (`Asides`) et `aside-ipc.ts` ; `Asides` créé par `ipc.ts` à
    partir du gestionnaire (index.ts à son plafond de lignes : une seule ligne ajoutée). Écouteur
    `stopped` du gestionnaire (sortie de l'app) ; `deleted` ferme l'aparté.
  - Gestionnaire à son plafond (1050) : « Reprendre une session… » et l'essai du diagnostic sortis
    dans `conversations/agent-outside.ts` (`agentSessions`, `knownSessionIds`, `checkAgentIn`) ;
    `asideHost`, `noteAsideSession` ajoutés ; `HostOptionsInput.reopen` facultatif.
  - Client ACP inchangé (fiche 181) : seule l'API publique d'`AgentHost` est utilisée.
  - Renderer : `useAside.ts`, `thread/AsideCard.tsx` + `aside.css` (bord pointillé : « à côté »),
    défilement jusqu'à la dernière réponse ; `/btw` (`app-commands`), ⇧⌘A (`shortcuts.ts`, menu
    Conversation et liste des raccourcis).
  - Agent factice : scénario `aparte`, joué d'office quand la consigne est là (`docs/mock-agent.md`).
  - Essais : `aside.test.ts` (8, contre l'agent factice : mode plan, contexte, refus, suppression,
    session retenue, fermeture), `shared/aside.test.ts`, `AsideCard.test.tsx`, `/btw` ; e2e
    `aparte` claire et sombre (captures `e2e/captures/180-*`).
  - Écarts : pas de bouton dans la barre de saisie (commande et raccourci seulement) ; le coût de
    l'aparté n'entre pas dans « Mon activité » (journal par tour du fil principal) ; un agent en
    mode « tout autoriser » ne demande rien : la consigne et le mode plan restent alors les seuls
    garde-fous. Non essayé avec le vrai Bob ni OpenCode (deuxième processus, `session/delete`).
- 06/11, recette 0.9 (fiche 183, D5) : dans une conversation neuve, sans message, `/btw` faisait
  répondre (et payer) l'aparté sans carte où le lire : l'accueil d'une conversation vide rendait la
  zone de saisie sans la carte. Choix : la carte s'affiche aussi sur l'accueil (l'aparté n'a pas
  besoin de la session principale : il ouvre la sienne) plutôt que de refuser `/btw` avant le
  premier message. Règle tenue : jamais de réponse payée sans être visible. Essai e2e `aparte` :
  `/btw` avant tout message, carte et réponse sur l'accueil, rien dans le fil, fermeture par ✕
  (capture `180-aparte-conversation-vide`).
