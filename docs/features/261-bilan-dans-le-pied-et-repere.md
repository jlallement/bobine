# 261 — Bilan dans le pied de la réponse, repère en bas du fil

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 260, 255
- **Agents** : les deux — rendu du fil seulement, à partir de ce que l'app sait déjà de tout agent
  (heures des réponses, durée des tours, travail après le tour de la fiche 255, liste des
  conversations) ; rien de propre à un agent (ADR-0011).

## Pourquoi

Lot 1 de la fiche cadre [260](260-travail-delegue-une-demande-une-reponse.md), écrans **F** et **E**
des maquettes validées (`docs/maquettes/260-travail-delegue.html`).

- **F** : la réponse qui finit un tour a deux pieds, la ligne « heure · durée » au survol
  (`MessageDuration`, fiche 156) et le bilan « Terminé en … · N fichiers +a −r · coût »
  (fiches 185, 255) : la durée y est deux fois. Le bilan doit devenir le pied de la réponse,
  fixe, et dire « Travaille encore… » tant que le travail n'est pas fini.
- **E** : quand le travail confié à un rôle répond loin au-dessus, rien ne le dit en bas du fil.

## Critères d'acceptation

- [x] Un seul pied sous la réponse qui finit un tour bien fini, toujours visible : « Copier ·
      21:17 · 2 min 29 s · 9 fichiers +346 −0 · coût », l'attente de l'utilisateur à part
      (« 40 s à vous attendre », fiche 255) ; plus de « Terminé en ».
- [x] Ce pied est dans le groupe de la réponse : ce qui arrive après s'affiche dessous, il ne bouge
      plus.
- [x] Tant que l'agent travaille **après** le tour (fiche 255 : sous-agent en arrière-plan, y
      compris d'un tour plus ancien, ou réponse hors tour attendue), le pied de sa dernière réponse
      dit « Travaille encore… » avec un petit indicateur. Pendant un tour ordinaire, aucun pied :
      l'indicateur du bas suffit (règle 5 de la fiche 260).
- [x] Le statut « occupé » d'un nouveau message, arrivé avant ce message, ne change pas le pied du
      tour fini.
- [x] Tour arrêté, refusé, coupé, en erreur ou à la limite d'étapes : comme aujourd'hui (heure et
      durée au survol, pas de bilan). Fil en lecture seule (côte à côte) : comme aujourd'hui.
- [x] `data-testid` gardés : `turn-summary` (le pied d'un tour fini), `turn-duration` (sa durée) ;
      le pilote les lit toujours.
- [x] Repère : une carte de travail délégué hors de l'écran qui passe à « a répondu » / « a fini »
      fait paraître au-dessus de la saisie « ↑ Expert UX/UI a répondu · Voir » ; plusieurs :
      « ↑ 2 travaux ont répondu · Voir », qui mène au plus ancien non vu.
- [x] « Voir » fait défiler jusqu'à la carte (rendue d'abord si le long fil ne l'a pas encore
      rendue, fiche 193) et l'entoure un instant ; aucun mouvement si les animations sont réduites.
- [x] Le repère disparaît dès que la carte est vue (à l'écran), et ne se copie jamais dans le fil.
- [x] Tests de composants (`Transcript`, pied, repère) et unitaires (logique du repère) ; e2e
      `finitions` mise à jour, `subagents` complétée.

## Plan

**Pied (F)**

1. `TurnSummary.tsx` : `replyFeet(items, times, usage, open)` → id de réponse → pied
   (`done` + bilan, ou `working`), à partir de `turnFacts` (gardé) ; le composant `TurnSummary`
   devient `ReplyFoot` (copier, heure, durée, attente, fichiers colorés, coût ; ou
   indicateur + « Travaille encore… »). Classe `msg-agent-actions reply-foot` : la rangée des
   actions de la réponse, rendue fixe et visible (la rangée au survol n'existe plus pour elle).
2. `MessageTime.tsx` (nouveau) : `MessageTime` et `MessageDuration` sortis de `Transcript.tsx`
   (partagés avec le pied ; `Transcript.tsx` est proche de son plafond de 800 lignes).
3. `Transcript.tsx` : le pied passé à `Item` (mémoïsé, objets stables), plus d'élément
   `TurnSummary` après l'entrée.
4. CSS (`thread-extras.css`, `motion.css`) : `.reply-foot`, retrait de `.turn-summary`.

**Repère (E)**

5. `work-cue.ts` (nouveau, pur) : interface `CueTarget` (clé, élément du fil à montrer, libellé,
   rôle, état `working | replied | finished | idle`) et mémoire du repère : transitions vers
   « a répondu / a fini » d'une carte hors de l'écran → en attente (dans l'ordre), retirées quand
   la carte est vue ou que la cible disparaît ; résumé (une cible ou un nombre, la plus ancienne).
6. `work-cue-targets.ts` (nouveau, pur) : l'adaptateur d'aujourd'hui, les cibles tirées du fil
   (`child-started`, dernier `child-report`) et de la liste des conversations (`childState`). La
   fiche 263 n'aura qu'à le rebrancher.
7. `WorkCue.tsx` (nouveau) : la ligne au-dessus de la saisie ; mesure de la visibilité dans
   l'élément qui défile (défilement, taille, changement des cibles) ; « Voir » : défilement au
   centre, ou `reveal.go` puis défilement une fois la carte rendue ; anneau d'une seconde.
8. Ancres `data-work-anchor` sur les cartes d'aujourd'hui : `RoleLaunch`, ligne de lancement,
   `ChildReportItem`.
9. `App.tsx` : le repère dans `thread-dock`, juste avant la saisie, recréé à chaque conversation.

**Textes, tests, docs**

10. i18n fr / en : `turnSummary.working`, `turnSummary.fileCount`, `workCue.*` ; retrait de
    `turnSummary.done`, `doneQuick`, `files` ; glossaire (« travaux » → « tasks »).
11. Tests : `TurnSummary.test.tsx` (pieds, états), `Transcript.test.tsx` (un seul pied, sous la
    réponse, ce qui vient après dessous), `work-cue.test.ts`, `work-cue-targets.test.ts`,
    `WorkCue.test.tsx` (apparition, clic, disparition) ; e2e `finitions` (texte du pied),
    `subagents` (pied « Travaille encore… » puis bilan), pilote (fixtures).
12. `architecture.md` si besoin, changelogs, index.

Aucune nouvelle dépendance, pas d'ADR (rendu dérivé de l'état existant).

## Journal

### 2026-11-19

- Fiche et plan.
- **Pied (F)** : `replyFeet` range un pied par tour sous sa réponse : `done` (bilan) pour un tour
  bien fini, `working` sous la dernière réponse d'un tour où l'agent travaille encore (le dernier
  quand l'agent répond ou travaille après le tour, ou tout tour dont un sous-agent en arrière-plan
  n'a pas fini, fiche 255), rien pour un tour arrêté, refusé, coupé, en erreur ou à la limite
  d'étapes (l'heure et la durée restent au survol, comme avant). `turnFacts` est gardé (dérivé) pour
  les essais de la fiche 255. Le pied est la rangée des actions de la réponse (classe
  `msg-agent-actions reply-foot`), rendue fixe : copier, puis une seule ligne de texte
  « 21:17 · 2 min 29 s · 40 s à vous attendre · 9 fichiers +346 −0 · coût » (lue telle quelle par
  le pilote). Plus de « Terminé en » ni de coche.
- Les réponses sont mémoïsées (fiche 047) : le pied, recalculé à chaque morceau de réponse, aurait
  refait le rendu de toutes les réponses finies. `Item` compare son pied par sa valeur
  (`sameFoot`) ; un essai le vérifie (une réponse finie ne refait pas son Markdown).
- `MessageTime` / `MessageDuration` sortis dans `MessageTime.tsx` (partagés avec le pied).
- **Repère (E)** : logique pure (`work-cue.ts`), adaptateur des cartes d'aujourd'hui
  (`work-cue-targets.ts`), ligne `WorkCue.tsx`. Une cible entre dans la file quand elle passe de
  « travaille » (en cours, ou attend l'utilisateur) à « a répondu » (fille d'un rôle) ou « a fini »
  (autre fille) alors que sa carte n'est pas à l'écran (au moins 24 px visibles, ou toute la carte) ;
  elle en sort quand sa carte est vue (défilement, taille du fil), sur « Voir », quand elle repart
  au travail ou disparaît. La visibilité est mesurée après le suivi du bas du fil (effet, pas effet
  de mise en page) : un compte rendu ajouté en bas, sous les yeux, ne fait pas de repère.
  « Voir » : défilement au centre (sans animation si elles sont réduites), anneau d'une seconde
  (attribut `data-cue-flash`, que React ne gère pas) ; carte d'un long fil pas encore rendue :
  `reveal.go`, puis montrée dès qu'elle est rendue (30 images au plus).
- **`App.tsx`** était à 800 lignes comptées sur 800 : le bas de la conversation (flèche « Aller en
  bas », plan épinglé, aparté, repère, saisie) est sorti dans `ThreadDock.tsx` ; `App.tsx` perd une
  ligne.
- Tests : `TurnSummary.test.tsx` (pied fini, « Travaille encore… », attente, coût, présentation,
  pieds par tour, tour plus ancien au travail, tour arrêté, `sameFoot`), `Transcript.test.tsx` (un
  seul pied dans le groupe de la réponse, avant les cartes d'après ; « Travaille encore… » ; le pied
  ne bouge plus ; tour arrêté et fil côte à côte comme avant ; pas de nouveau rendu des réponses
  finies), `work-cue.test.ts`, `work-cue-targets.test.ts`, `WorkCue.test.tsx` (apparition, pas de
  repère pour une carte à l'écran, « Voir » avec défilement et anneau, disparition au défilement,
  deux travaux et le plus ancien d'abord, carte pas encore rendue, travail reparti). e2e
  `finitions` (texte et place du pied) et `subagents` (« Travaille encore… » puis bilan) mises à
  jour, **non lancées** ; fixtures du pilote mises au nouveau texte.

### Décisions du tech lead (relecture, 2026-11-19)

- **« Travaille encore… »** réservé au travail après le tour (règle 5 de la fiche 260) : pendant un
  tour ordinaire, aucun pied sous la dernière réponse. `replyFeet` prend l'état de l'agent
  (`{ busy, background }`) au lieu d'un seul drapeau `open`.
- **Saut à l'envoi corrigé** : le statut « occupé » arrive avant le message de l'utilisateur
  (fiche 095). Un tour dont une réponse est datée est fini (les réponses ne sont datées qu'à la fin
  du tour, `turn-end`, ou à la fin du travail après le tour, `background-work`) : il garde son
  bilan, ou « Travaille encore… », tant qu'aucun nouveau message n'est arrivé. Essai dédié dans
  `TurnSummary.test.tsx`.
- **Maquette 260** : `main` la contient déjà formatée (0b2e5a2) ; mon commit de formatage a été
  retiré, la branche est rebasée sur `main`.

- **e2e `finitions`** (campagne du tech lead) : l'étape « pied visible sans survol » lisait
  l'opacité du pied pendant son fondu d'arrivée (200 ms, `motion.css`, 0,199 relevé). Essai mal
  écrit, pas une régression : il attend maintenant la fin du fondu, puis vérifie 300 ms plus tard que
  le pied est toujours à 1, sans survol, avec une seule rangée ; il dit les valeurs lues. `finitions`
  verte en clair et en sombre.

### Revue QA (2026-11-19)

Chaque défaut a un essai qui échoue sans son correctif.

1. **« Travaille encore… » pour toujours après une panne** : `closeBackground` (`transcript.ts`)
   marque aussi le sous-agent `lost` ; et `replyFeet` ne dit « Travaille encore… » que si l'agent
   est actif (`busy` ou `background`). Essai du réducteur (`status: exited`, puis `replyFeet`).
2. **Deux « Travaille encore… »** : le pied va au seul tour qui a lancé le sous-agent encore au
   travail ; le dernier tour garde son bilan. Le pied « réponse hors tour attendue » (dernier tour,
   `background`) seulement quand aucun sous-agent ne tourne.
3. **Essai complaisant** rejoué avec `{ busy: false, background: true }`, le dernier tour exige
   `done`.
4. **Le repère clignotait** quand une fille finit sous les yeux (l'état « fini » arrive avant le
   compte rendu, la cible visait la carte de lancement plus haut) : une cible qui vient de répondre
   attend `SETTLE_MS` (600 ms, file `settling`) avant d'entrer au repère, et n'y entre pas si sa
   carte est alors à l'écran.
5. **Pilote** : `lecture.mjs` lit `turn-working` (`shot.turnWorking`), « Tour : travaille encore —
   … », et l'attente continue (`busy`) : l'indicateur du bas ne le dit plus.
6. `turnFacts` retiré (les essais passent par `replyFeet`).
7. **Le nombre de fichiers ouvre l'onglet Modifications** (vue de la conversation), bouton
   accessible ; texte simple dans le fil côte à côte.
8. `e2e/maquettes/run-245.mjs` mis au nouveau pied.
9. `finitions` attend l'opacité (`waitFor`) puis la revérifie.
10. **« Réessayer » réussi** (fiche 142) : un avis d'erreur suivi d'une réponse datée ne fait plus
    perdre le bilan.
11. `WorkCue` : un seul anneau et une seule attente d'image à la fois, tout annulé au démontage.

### Revue UX (2026-11-19)

1. Nouvelle suite e2e `repere` (dépôt jetable, deux rôles du projet, verrou de fin de tour de
   l'agent factice) : un rôle, deux rôles, 900 px avec un nom long, avec « ↓ N nouveaux » ;
   captures `261-repere-un-role`, `-deux`, `-anneau`, `-900`, `-et-nouveaux`.
2. Seul le nom se coupe (28ch, titre complet en infobulle), jamais le verbe : deux éléments, deux
   clés (`workCue.replied` / `finished` ne portent plus que le verbe).
3. Travail après le tour dit une seule fois : avec un pied « Travaille encore… · 32 s »,
   l'indicateur du bas se tait (`TurnFooter`, `hasWorkingFoot`).
4. « < 1 s » sous la seconde (`transcript.duration.underSecond`).
5. Anneau à la couleur du rôle sur le compte rendu d'un rôle (`useRoleStyle`), coins de la ligne de
   lancement.
6. Focus sur la carte après « Voir » (`tabindex=-1`, `preventScroll`).
7. Pastille ↓ à droite quand le repère est là (`:has`).
8. `g6b-2-3-fini` : défilé jusqu'au pied.
9. Séparateurs `reply-foot-sep` (0,6, 2 px), texte lu inchangé.
10. Fenêtre étroite : chaque élément du pied insécable, espace insécable avant « · » ; capture
    `261-pied-900` (finitions).
11. Pied « Travaille encore… » sans Copier, indicateur en `--muted`.
12. Repère : fondu de 150 ms (aucun si les animations sont réduites), région `aria-live` toujours
    présente, anneau de 1,4 s.
14. Fichiers : soulignement pointillé au survol, infobulle « Voir dans Modifications (toute la
    conversation) ».

### Limites connues

- **Pied pendant « Travaille encore… »** : rien à copier tant que le travail n'est pas fini (le
  texte reste sélectionnable).
- **Repère** : rebranché par la fiche 263 (carte-réponse à place fixe), par `work-cue-targets.ts`
  seulement. Il ne couvre ni les erreurs, ni les arrêts d'un travail, ni les réponses arrivées
  pendant qu'on regardait une autre conversation (on ne sait pas quand elles sont arrivées ; la
  barre latérale dit déjà « à lire »).
- **Aujourd'hui, le compte rendu s'ajoute en bas du fil** : il est en général à l'écran quand la
  fille finit, et le repère ne paraît que si l'on a remonté le fil (l'état de la fille, arrivé
  avant son compte rendu, ne le fait plus clignoter : délai de revue de 600 ms).
- Anglais « tasks » pour « travaux » en attendant le vocabulaire unique (fiche 266).
