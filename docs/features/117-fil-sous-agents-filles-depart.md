# 117 — Fil : carte « Sous-agents », coût des filles, départ du worktree

- **Statut** : fait (essais réels avec Bob et OpenCode, et à la vraie souris, non faits)
- **Dépend de** : 010 et 053 (sous-agents), 097 (conversations filles), 109 (résumé de
  consommation), 110 (départ d'un worktree), 113 (interface allégée)
- **Agents** : les deux. Rien de propre à un agent : la carte lit ce que `subagent.ts` reconnaît
  déjà (Bob, OpenCode), le coût vient du résumé de consommation de chaque conversation, le départ
  du worktree de `git` (ADR-0011).

## Pourquoi

Retours de l'utilisateur du 2026-10-22, maquettes validées :

- Un sous-agent s'affiche comme une simple ligne d'outil grise, identique à « Lecture de … » : dans
  un fil chargé, on ne le voit pas. Deux sous-agents lancés ensemble font deux lignes sans lien.
- Les conversations filles n'affichent pas ce qu'elles coûtent, alors que le résumé de consommation
  de chaque conversation (`ConversationSummary.usage`, fiche 109) est déjà dans l'index, sans
  lecteur depuis la fiche 113.
- Le départ d'un worktree donne un texte gris centré qui se casse en deux lignes, puis un bandeau
  jaune d'un autre style. Et le premier élément de tout fil passe sous le fondu de l'en-tête dès
  que le fil défile (le fil commence 8 px sous l'en-tête, le fondu en fait 28).

## Choix d'interface (maquettes validées)

1. **Carte « Sous-agents »**, dans le langage visuel du compte rendu de fille : bordure gauche
   accent de 3 px, fond `--surface`, bord `--border-strong`. En-tête : pastille ronde teintée
   accent avec l'icône du robot, « Sous-agents » en gras, « · 1 en cours, 1 fini » en `--muted`, et
   à droite le coût total des sous-agents de la carte s'il est connu. Une ligne par sous-agent :
   état (roue accent, coche `--ok`, croix d'erreur), pastille du type (`explore`…), consigne
   tronquée, « 12 s · 0,0041 bobcoins » en chiffres tabulaires, et « Réponse » qui déplie ce que la
   carte dépliée montrait (consigne, réponse mise en forme, « Voir son travail », note). Les
   sous-agents consécutifs d'un même tour partagent la carte ; un sous-agent seul a la même carte,
   avec une ligne. L'autorisation de Bob reste sous la carte. L'indicateur sous le fil ne change
   pas.
2. **Coût des filles** : sur chaque ligne de « Sous-tâches », après les fichiers, une pastille
   (fond `--surface-2`, 12 px, chiffres tabulaires) avec le coût de la fille (bobcoins, dollars :
   même mise en forme que la puce de consommation), sinon ses jetons (« 31 k jetons ») ; rien sans
   consommation. À droite de l'en-tête de la carte, le total des filles (même unité, sinon rien).
   Sur le compte rendu, dans la ligne de métadonnées : le coût et le nombre d'échanges de la fille
   à ce moment-là.
3. **Départ du worktree** : une seule carte alignée à gauche, pleine largeur : icône de branche,
   « Parti de `main` · `e6ee04c` · 22 oct. 2026, 10:17 » (date en `--muted`), lien « Vue Git » à
   droite (onglet Modifications, vue Git) ; dessous le sujet du commit entre guillemets ; s'il y a
   des modifications non commitées du dossier d'origine, une dernière ligne d'avertissement.
   **En-tête** d'une fille : « ↳ depuis « Titre de la mère » » après le titre, cliquable.
   **Fil** : 32 px en haut au lieu de 8, pour que son premier élément ne soit plus dans le fondu.

## Critères d'acceptation

- [x] Un sous-agent s'affiche dans une carte « Sous-agents » distincte des outils ; les
      sous-agents consécutifs d'un tour partagent la carte (compte par état, coût total connu).
- [x] Chaque ligne : état, type, consigne, durée qui défile et coût en direct (Bob), « Réponse »
      qui déplie consigne, réponse, travail (OpenCode) et note.
- [x] L'autorisation de lancer un sous-agent (Bob) reste affichée sous la carte.
- [x] Ligne de « Sous-tâches » : coût de la fille (ou ses jetons), total des filles dans
      l'en-tête ; compte rendu : coût et échanges de la fille au moment du compte rendu (les
      anciens comptes rendus n'affichent rien).
- [x] Départ d'un worktree : un seul élément du fil (`worktree-start`), les anciens fils gardent
      leurs avis ; « Vue Git » ouvre l'onglet Modifications en vue Git.
- [x] En-tête d'une fille : « ↳ depuis « mère » », qui sélectionne la mère.
- [x] Le premier élément du fil n'est plus sous le fondu de l'en-tête ; l'accueil ne bouge pas.
- [x] Testé contre l'agent factice : nouveau scénario `sous-agents-paralleles` ; suites e2e
      `subagents`, `filles`, `worktree-cycle` en clair, en sombre et `--lang en`, captures
      regardées.

## Plan

### Partie 1 — carte « Sous-agents »

- `src/shared/tool-groups.ts` : `groupTools` rend aussi des entrées `subagents` (sous-agents
  consécutifs, quel que soit leur état, y compris en attente d'autorisation) ;
  `subagentsState(items)` (compte par état, coût total de même unité). Tests.
- `src/renderer/src/components/thread/SubagentsCard.tsx` (nouveau) : la carte, ses lignes
  (`<details>` par sous-agent : même geste que les cartes d'outils), le détail repris de
  `ToolCall.tsx` (`SubagentDetails`, `SubagentWork`, `WorkList`), les autorisations sous la carte.
- `ToolCall.tsx` : plus de rendu de sous-agent (un sous-agent reçu, ex. dans le travail d'un autre,
  passe par la carte) ; `PermissionView` exporté.
- `Transcript.tsx` : rend les entrées `subagents`. `styles.css`, locales (`toolCall.subagents.*`).
- Agent factice : scénario `sous-agents-paralleles` (format de Bob : deux `spawn_subagent`, deux
  autorisations, coûts dans la base de Bob, fins décalées). `docs/mock-agent.md`.
- e2e `subagents` adaptée (sélecteurs de la carte), nouvelle étape pour deux sous-agents, captures
  `g0`…`g3` et `g4-sous-agents-paralleles`.

### Partie 2 — coût des filles

- `src/shared/usage.ts` : `digestLabel(digest)` (coût, sinon jetons), `digestsTotal(digests)`
  (somme de même unité). Tests.
- `src/shared/children.ts` : `ChildReport.usage?: UsageDigest` ; `src/main/conversations/children.ts`
  le pose au compte rendu, lu dans le fil de la fille (`usageDigest`). Tests.
- `Subtasks.tsx` : pastille de coût par ligne, total dans l'en-tête, coût et échanges sur le compte
  rendu. Locales (`children.cost.*`, `children.report.turns`).
- e2e `filles` : coût de la fille (0,0125 par tour de l'agent factice) sur la ligne, le total, le
  compte rendu.

### Partie 3 — départ du worktree, en-tête, marge du fil

- `src/shared/transcript.ts` : élément `worktree-start` (branche de départ, commit, date, sujet,
  modifications non commitées) et évènement `worktree-start` (`src/shared/agent.ts`) ;
  `helpers.ts` : `worktreeStartEvent` remplace `worktreeStartNotices` ; `manager.ts`. Export
  (`export.ts`). Tests.
- `Transcript.tsx` : carte `WorktreeStart` ; `onOpenGitView` passé par `App.tsx`.
- `App.tsx` : « ↳ depuis « mère » » après le titre d'une fille.
- `styles.css` : `.thread { padding: 32px 0 24px }`, styles de la carte et du lien d'origine.
- Locales `worktrees.start.*`, `conversationTitle.from`.
- e2e `worktree-cycle` (lit la carte), `filles` (lien d'origine de l'en-tête).

Pas de nouvelle dépendance.

## Journal

- 2026-10-22 — Fiche créée, plan ci-dessus (maquettes validées par l'utilisateur).
- 2026-10-22 — **Partie 1 faite** : `groupTools` rend des entrées `subagents` (sous-agents
  consécutifs, dès un seul, y compris en attente d'autorisation) et `subagentsState` ;
  `SubagentsCard.tsx` reprend le détail qui était dans `ToolCall.tsx` (qui n'a plus de rendu de
  sous-agent ; `PermissionView` exporté, avec un détail fourni par la carte). Une ligne est un
  `<details>` (même geste que les cartes d'outils) ; une ligne en attente d'accord ne se déplie
  pas, son détail est dans la carte d'autorisation sous la carte. Choix : une autorisation déjà
  donnée (« Allow once ») passe dans le détail de sa ligne au lieu de rester sous la carte, pour
  qu'une carte de plusieurs sous-agents n'empile pas ces rappels. Titre au singulier pour un
  sous-agent seul (« Sous-agent · 1 fini »). Clés retirées : `toolCall.subagent.label`,
  `toolCall.state.working` (plus lues). Scénario `sous-agents-paralleles` (deux autorisations l'une
  après l'autre : le comportement réel de Bob avec deux sous-agents à la fois n'est pas relevé) ;
  test d'`AgentHost` (coût de chacun rattaché par sa consigne) ; e2e `subagents` en clair, sombre
  et `--lang en` (la suite n'avait plus de texte en dur), captures `g0`…`g5` regardées.
- 2026-10-22 — **Partie 2 faite** : `digestsTotal` (`usage.ts`, total seulement si toutes les
  filles qui ont consommé ont un coût de même unité : une fille qui ne donne que ses jetons, ou un
  autre agent, ôte le total plutôt que d'en donner un partiel) ; `ChildReport.usage` posé par
  `children.ts` à la fin du tour, lu dans le fil de la fille (`usageDigest`). Pastille, total et
  « 0,0125 $US · 1 échange » dans `Subtasks.tsx`. Tests : `usage.test.ts`, `children.test.ts`,
  `Subtasks.test.tsx` ; e2e `filles` en clair et sombre, captures `filles-2`, `filles-6` regardées.
  Limite : Bob écrit son coût juste après sa réponse (fiche 109), le compte rendu d'une fille de
  Bob donne donc le coût d'avant son dernier tour ; la pastille de sa ligne, elle, se met à jour.
- 2026-10-22 — **Partie 3 faite** : `WorktreeStart` (`shared/worktree-cycle.ts`), évènement et
  élément `worktree-start`, `worktreeStartEvent` (remplace `worktreeStartNotices`) ; la date est
  mise en forme à l'affichage, dans la langue de l'app (plus dans le main). Les anciens fils gardent
  leurs deux avis (clés `worktrees.notice.*` conservées). Carte `thread/WorktreeStart.tsx`, « Vue
  Git » par `onOpenGitView` du fil ; export Markdown (`export.worktreeStart`). En-tête d'une
  fille : bouton « ↳ depuis « mère » » (`title-origin`), qui sélectionne la mère. `.thread` : 32 px
  en haut. Écart : la classe `worktree-start` était déjà prise par la barre de la vue Git (fiche
  110) ; la carte du fil s'appelle `worktree-origin` (classes et identifiants d'essai). Tests :
  `transcript.test.ts`, `manager.test.ts`, `children.test.ts`, `WorktreeStart.test.tsx` ; e2e
  `worktree-cycle` (carte, « Vue Git », haut du fil à 32 px sous l'en-tête) et `filles` (lien
  d'origine), en clair, sombre et `--lang en`, captures `110-worktree-depart`, `filles-3`
  regardées. Une vérification de `filles` (infobulle du plafond, au survol) a échoué une fois en
  sombre puis est passée à la relance : aléa du survol, zone non touchée ici.
- 2026-10-22 — Suite e2e complète (`pnpm e2e`, clair et sombre) verte ; captures de l'accueil
  et d'un fil ordinaire (`1-accueil`, `2-permission`) regardées avec la nouvelle marge.
  **Non vérifié** : essai réel avec Bob (deux sous-agents à la fois, coût d'une fille de Bob) et
  OpenCode ; clic à la vraie souris sur « ↳ depuis » dans la barre de titre (marqué `no-drag`,
  mais les essais CDP ne voient pas les zones de déplacement de la fenêtre).

