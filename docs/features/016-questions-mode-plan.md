# 016 — Questions à choix et validation du plan, comme Claude Code

- **Statut** : fait (Claude Code réel à essayer après sa connexion)
- **Dépend de** : 006, 011, 013

## Pourquoi

Quand l'agent pose une question ou propose un plan, c'est lui qui attend : une présentation confuse
bloque la tâche. Claude Code affiche les questions (`AskUserQuestion`) comme une liste d'options
numérotées, cliquables, avec descriptions, aperçu et « Autre », et le plan à valider en clair avec
des choix explicites. L'app les affichait comme un formulaire générique et une autorisation générique.

## Comment ces demandes arrivent (vérifié dans le code de `claude-agent-acp` 0.89.1)

- **Questions** : élicitation `form` avec `toolCallId`. Une propriété `question_<n>` par question :
  choix unique = `string` + `oneOf` (`const`, `title`, `description`), choix multiple = `array` +
  `items.anyOf`. Chaque question est suivie d'un champ texte libre `question_<n>_custom` (« Other »).
  Le titre de la propriété est l'en-tête court (`header`) ; la question est dans `message` (une seule
  question) ou dans la `description` du champ (plusieurs). Aperçu éventuel d'une option dans
  `_meta["_claude/askUserQuestionOption"].preview`. Rien n'est obligatoire ; `decline` = « passer ».
- **Fin du mode plan** (`ExitPlanMode`) : demande d'autorisation dont l'appel d'outil est de genre
  `switch_mode`, titre « Ready to code? », plan en contenu texte (Markdown). Options : « Yes, clear
  context and … », « Yes, and use auto mode », « Yes, manually approve edits », « No, keep planning ».
- **Modes** de Claude Code : `default`, `acceptEdits`, `plan`, `auto`, `bypassPermissions` ;
  Maj+Tab les fait défiler dans Claude Code.

## Critères d'acceptation

- [x] Une élicitation composée uniquement de choix (et de leurs champs « Autre ») s'affiche comme une
      **carte de questions** : options numérotées avec description, sélection au clic ou au clavier
      (1–9, ↑/↓, Entrée), « Autre… » en texte libre, onglets quand il y a plusieurs questions.
- [x] Choix unique : un clic choisit et passe à la question suivante (envoie s'il n'y en a qu'une).
      Choix multiple : cases à cocher puis « Suivant » / « Envoyer ». « Passer » = `decline`.
- [x] Aperçu d'option affiché à côté des options quand l'agent en fournit.
- [x] Une fois répondu : résumé « question → réponse » dans le fil.
- [x] Tout autre formulaire garde l'affichage générique (fiche 011).
- [x] Autorisation de genre `switch_mode` : **carte de plan** avec le plan rendu en Markdown et les
      options de l'agent en liste numérotée (clavier 1–9), au lieu de l'autorisation générique.
- [x] Maj+Tab dans la zone de saisie passe au mode suivant (contrôle de catégorie `mode`).
- [x] Rien de spécifique à un agent dans l'UI : la lecture des formes propres à Claude (`_custom`,
      `_meta`) est isolée dans un adaptateur partagé.
- [x] Testé : agent factice (scénarios `questions`, `plan-a-valider`, `codex-question-plan`, copies
      des formes réelles), tests unitaires de l'adaptateur, `pnpm e2e` clair / sombre ; Codex et
      OpenCode réels.
- [ ] Essai réel Claude Code (après connexion de l'utilisateur en ligne de commande).

## Comment Codex les envoie (relevé réel, codex-acp 2.2.2)

- Réglage « Collaboration mode » = `plan` (option de configuration, pas un mode ACP).
- Question : élicitation `form` « Codex needs your input to continue. » ; question dans `title`,
  en-tête court dans `description`, option « None of the above », note libre `<clé>_note` marquée
  `_meta.codex.questionId` ; réponse **obligatoire** (`required`).
- Plan : autorisation `switch_mode` « Implement this plan? », plan dans **`rawInput.plan`** ; options
  « Yes, implement this plan » / « No, and tell Codex what to do differently ».

## Plan

- `src/shared/questions.ts` — adaptateur : `questionsOf(schema, message)` → liste de questions
  (clé, en-tête, texte, choix multiple, options avec description / aperçu, clé du champ « Autre »)
  ou `undefined` si le formulaire n'est pas un questionnaire ; `answerContent(...)` → contenu à envoyer.
- `src/renderer/src/components/QuestionCard.tsx` — carte de questions ; `ElicitationCard` la choisit
  quand `questionsOf` répond.
- `src/renderer/src/components/PlanApproval.tsx` — carte de plan ; `ToolCall` la choisit pour une
  autorisation `switch_mode`.
- `Composer` — Maj+Tab.
- Agent factice : `toolCallId` sur l'étape `elicitation` ; scénarios `questions` et `plan-a-valider`.
- e2e : répondre aux questions au clavier et à la souris, valider un plan.

## Journal

- 2026-10-11 — Fiche créée. Formes réelles relevées dans le code de `claude-agent-acp` 0.89.1.
  Essai réel bloqué : Claude Code n'est pas connecté en ligne de commande sur ce Mac
  (`claude auth status` → `loggedIn: false`, la connexion de Claude Desktop n'est pas partagée) ;
  l'adaptateur ne propose une connexion que si le client annonce `auth.terminal` (voir fiche 022).
- 2026-10-11 — Implémenté. Adaptateur `src/shared/questions.ts` (formes Claude Code **et** Codex),
  `QuestionCard`, `PlanApproval`, Maj+Tab, plan lu dans `rawInput.plan`, réponse conservée dans le
  fil (`content` de `elicitation-resolved`), carte d'outil qui pose la question masquée (`toolCallId`).
  Agent factice : scénarios `questions`, `plan-a-valider`, `codex-question-plan`, mode `plan`.
  161 tests ; `pnpm e2e` étendu (clavier, souris, « Autre », réponse obligatoire, plan approuvé /
  repris), clair et sombre.
  - **Essai réel Codex** (mode plan) dans l'app : sa question est apparue en carte (3 options avec
    descriptions), réponse « zsh » à la touche 2, plan affiché depuis `rawInput.plan`, « continuer à
    planifier » transmis ; aucun fichier écrit.
  - **Essai réel OpenCode** : pas de question ni de validation de plan par ACP (son mode `plan` bloque
    seulement les modifications) : rien à afficher.
  - Limites : le mode plan de Codex est dans « Réglages de la session » (pas dans la puce de mode, ni
    sur Maj+Tab) ; aperçus d'options en texte brut ; un e2e a échoué une fois sur 4 dans une suite
    antérieure (non reproduit).
- 2026-10-11 — **Bob réel** : modes `agent` / `plan` / `ask` (Maj+Tab les fait défiler) ; pas d'outil
  de question ni de validation de plan par ACP : en mode `plan`, Bob présente le plan en texte et
  demande « Valides-tu ce plan ? ». Rien à afficher de plus côté app.
