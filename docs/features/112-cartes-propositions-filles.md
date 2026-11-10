# 112 — Carte de propositions de conversations filles : groupée, « Faire ici », agent et modèle

- **Statut** : fait (essai réel avec Bob et OpenCode à faire)
- **Dépend de** : 097 (conversations filles, ADR-0019), 028 (carte de questions), 030 (cartes
  d'accord)
- **Agents** : les deux. Tout passe par l'outil `start_child` du serveur `bobine`, que Bob et
  OpenCode reçoivent déjà ; aucun code propre à un agent (ADR-0011).

## Pourquoi

Quand l'agent propose des conversations filles (`start_child`, fiche 097), chaque proposition est
une carte de questions « Lancer / Refuser », l'une après l'autre. Ce que l'utilisateur aime dans
Claude Code Desktop, et qui manque ici (relevé du 2026-10-21) :

- **« Faire ici »** : un refus dit à l'agent de se débrouiller, rien ne lui dit « fais-le toi-même
  dans cette conversation ».
- **L'agent et le modèle sur la carte** : le dialogue « Lancer en parallèle… » les propose, la
  carte de l'agent prend ceux de la mère. Pour l'utilisateur c'est le point utile : une fille de
  relecture sur un modèle interne, une fille de codage sur Bob.
- **Une seule carte par tour** : trois propositions font trois cartes, sans le résumé « 3 proposées,
  2 lancées » ni l'état de chacune.

Le worktree reste imposé (ADR-0019) : deux agents qui écrivent dans le même dossier s'écrasent,
c'est ce que l'ADR évite. Pas de nouvel ADR : la mécanique ne change pas, seule la carte change.

## Critères d'acceptation

- [x] Les propositions de `start_child` d'un même tour (entre deux messages de l'utilisateur)
      forment **une carte « Tâches proposées »** à la place de la première, avec le compte
      (« 3 proposées · 2 lancées, 1 faite ici ») ; les cartes des appels `start_child` eux-mêmes
      sont cachées, comme l'appel d'une question l'est derrière la carte de questions.
- [x] Chaque ligne montre le titre, la consigne (repliée, dépliable) et, tant qu'elle attend :
      **Lancer** (par défaut), **Faire ici**, **Refuser**, et un bouton d'options qui ouvre le
      choix de l'**agent** et du **modèle** (mêmes règles que le dialogue « Lancer en parallèle… » :
      ceux de la mère par défaut, le modèle proposé seulement pour l'agent de la mère).
- [x] **Lancer** crée la fille avec l'agent et le modèle choisis (`start_child` reçoit le même
      résultat qu'aujourd'hui). **Faire ici** renvoie à l'agent la consigne avec l'instruction de
      la faire lui-même, dans cette conversation : dans le résultat de l'outil s'il attend encore,
      sinon en message de l'utilisateur dès qu'il est prêt (réponse tardive, fiche 097). **Refuser**
      ne change pas.
- [x] Une ligne répondue garde son issue (Lancée, Faite ici, Refusée) ; une ligne annulée par le
      redémarrage de l'agent (fiche 097 : les questions en attente sont annulées) est marquée
      « Expirée » et garde **Lancer**, qui passe alors par « Lancer en parallèle… » (fille lancée
      par l'utilisateur, avec la consigne proposée).
- [x] Textes FR et EN ; clavier : Entrée lance la ligne en surbrillance, comme la carte de
      questions.
- [x] Testé contre l'agent factice : scénario `filles` (deux propositions, une carte), `filles-refus`
      joué avec « Faire ici » (l'agent dit qu'il fait le travail ici), `filles-plafond` inchangé ;
      unitaires sur la décision (`shared/children.ts`), l'outil (`children-tools.ts`), le pont
      (`app-tools-bridge.ts`), la carte et le regroupement dans le fil ; suite e2e `filles` verte
      en clair, sombre et `--lang en`, captures regardées.

## Plan

Aucune nouvelle dépendance. La carte s'appuie sur l'élicitation existante (`ask`, réponse
tardive, attention « attend un accord », annulation au redémarrage) : rien de nouveau à
persister ni à réveiller.

**Données** (`src/shared/`).

- `agent.ts` : l'élicitation de formulaire porte `child?: ChildProposal` (titre, consigne), ce qui
  fait de la carte une carte de proposition et non de questions.
- `children.ts` : `ChildProposal`, `ChildDecision` (`start` | `here` | `refuse`, agent, modèle),
  `childProposalSchema()` (schéma d'élicitation : `decision`, `profileId`, `modelControl`,
  `modelValue`, tous des chaînes, pour que la validation du main et un client générique le
  comprennent), `parseChildDecision(content)`, `childDecisionContent(decision)`.

**Main.**

- `mcp/tools.ts` : `ToolContext.proposeChild(proposal, onLate)` → décision ou `'late'`, à côté de
  `ask` (qui reste pour les autres outils) ; `catalog.ts` : talon.
- `agent/app-tools-bridge.ts` : `elicit` prend une élicitation déjà construite ; `proposeChild`
  la construit avec `child` et la relie à la carte de l'appel `start_child` (titre dans
  `rawInput`), comme `ask_user` est relié par sa question.
- `mcp/children-tools.ts` : `start_child` passe par `proposeChild` ; `start` → fille avec agent et
  modèle de la décision ; `here` → résultat « do this task yourself, now, in this conversation »
  avec la consigne, ou `tellAgent` si tardif ; `refuse` → inchangé.

**Renderer.**

- `sidebar/child-options.ts` (nouveau) : le choix de l'agent et du modèle sorti de
  `ChildDialog.tsx` (`useChildOptions(mother)`), partagé avec la carte.
- `thread/ChildProposals.tsx` (nouveau) : la carte groupée (`data-testid="proposals"`, lignes
  `proposal-row` avec `data-title`, boutons `proposal-start`, `proposal-here`,
  `proposal-refuse`, options `proposal-options`, sélecteurs `proposal-agent`, `proposal-model`).
- `thread/Transcript.tsx` : regroupement par tour, carte à la place de la première élicitation
  `child`, appels `start_child` cachés par leur `toolCallId` ; nouvelle entrée `proposals`
  (conversation affichée, profils) passée par `App.tsx`.
- `styles.css` : section de la carte, à la suite des sous-tâches.
- `fr.json`, `en.json` : `children.proposals.*` ; `children.approval.*` retiré.

**Agent factice.** `filles-refus` : si le résultat dit de faire le travail ici, l'agent le dit.
`docs/mock-agent.md` à jour.

**Essais.** `shared/children.test.ts`, `mcp/children-tools.test.ts`, `agent/app-tools-bridge`
(liaison à la carte), `thread/ChildProposals.test.tsx`, `thread/Transcript.test.tsx` ;
`e2e/suites/filles.mjs` : la carte groupée, les options, « Faire ici », captures.

## Journal

- 2026-10-21 — Fiche créée après comparaison avec les cartes de tâches de Claude Code Desktop.
- 2026-10-21 — **Implémentée** selon le plan, dans le worktree `fiche-112-cartes-propositions`.
  - Données : `ElicitationPrompt.child` (`shared/agent.ts`) ; `ChildProposal`, `ChildDecision`,
    `childProposalSchema`, `childDecisionContent`, `parseChildDecision`, `isChildProposal`,
    `childProposalGroups` (`shared/children.ts`).
  - Main : `ToolContext.proposeChild` (`mcp/tools.ts`, talon dans `catalog.ts`) ;
    `AppToolsBridge.elicit` prend une élicitation construite (`questionPrompt`, `proposalPrompt`
    reliée à l'appel `start_child` par le titre de `rawInput`) ; `children-tools.ts` : `start`
    avec agent et modèle, `here` en résultat d'outil ou par `tellAgent` si tardif.
  - Renderer : `sidebar/child-options.tsx` (`useMotherModel`, `childChoiceRequest`,
    `ChildOptions`, partagés avec `ChildDialog.tsx`) ; `thread/ChildProposals.tsx` ;
    `Transcript.tsx` (regroupement, appels cachés, entrée `proposals` donnée par `App.tsx`) ;
    `conversation:startChild` accepte `title` (proposition expirée relancée).
  - Essais : unitaires (décision, regroupement, outil, pont, carte, fil, `children.test.ts` avec
    « Faire ici ») ; suite e2e `filles` en clair, sombre et anglais, captures
    `filles-5-propositions`, `filles-5b-deux-propositions`, `filles-6b-faire-ici` regardées.
  - Écart au plan : l'agent factice enchaîne ses `start_child` (le deuxième part quand le
    premier a sa réponse), donc la carte se remplit ligne après ligne au lieu d'arriver avec ses
    deux lignes ; un agent qui appelle l'outil deux fois d'un coup les verrait ensemble. Le
    regroupement par tour couvre les deux cas.
  - Limite connue : une proposition encore en attente quand l'agent redémarre est annulée
    (fiche 097) ; la ligne reste, « Expirée », avec « Lancer » par le chemin de « Lancer en
    parallèle… » (pas de réveil de l'agent dans ce cas).
  - Non vérifié : Bob et OpenCode réels (prompts 3 à 13 de la fiche 097, avec « Faire ici » en
    plus : l'agent doit faire le travail dans la conversation sans rappeler `start_child`).
  - Trouvé par la suite e2e (`fille-message`) : quand la fille part avec un modèle à régler (ce
    que la carte fait toujours, comme le dialogue : le modèle de la mère), sa consigne attend le
    réglage, et un `message_child` envoyé aussitôt par l'agent arrivait **avant** la consigne.
    Corrigé dans `conversations/children.ts` : une fille dont la consigne n'est pas encore partie
    (`launching`) met les messages reçus en file derrière elle. Test dans `children.test.ts`.
- 2026-10-23 — Écart (fiche 124, défaut D13) : la carte, tant qu'elle a des lignes à décider,
  suspend le suivi du bas du fil sous le pointeur (`data-scroll-hold`) ; les propositions qui
  arrivent s'ajoutent en dessous sans déplacer la ligne visée.
