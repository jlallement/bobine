# 223 — Rôles : des agents spécialisés à invoquer, et des filles lancées sans insister

- **Statut** : en cours — phase 1 (délégation) et phase 2 (rôles, cœur sans interface) faites le
  2026-11-14 ; phases 3 (interface, maquettes validées) et 4 (export) à faire
- **Dépend de** : 045 (commandes personnelles, fichiers Markdown du projet), 097 et 160
  (conversations filles, agent et modèle d'une fille, ADR-0019, ADR-0036), 112 (carte de
  propositions), 118 (filles proposées par l'agent, contexte de session), 177 (relecteur en lecture
  seule dans le même dossier), 013 (modes et options de session)
- **Agents** : tous. Un rôle est une conversation fille ordinaire, lancée avec une consigne, un
  mode et des outils choisis : rien de propre à un agent hors des profils (ADR-0011). Une seule
  capacité déclarée dans un profil : `writesWithoutAsking` (OpenCode, repère
  `writes-without-asking`), qui dit que la lecture seule n'y est que demandée. L'export vers le
  mode natif d'un agent (phase 4) passera par un adaptateur du profil, déclaré dans
  `specificItems` et dans la matrice de `docs/agents.md`.

## Pourquoi

L'utilisateur veut des **agents spécialisés** qu'il crée une fois et invoque quand il veut : expert
UX/UI, expert Flutter, architecte front, architecte back, expert sécurité, tech lead, code
reviewer. Il veut aussi que l'agent principal **délègue de lui-même** à ces spécialistes : à
l'usage, les modèles ne lancent presque jamais de conversation fille sans qu'on insiste et qu'on
nomme `start_child`.

Bob (modes personnels) et OpenCode (agents) savent déjà définir des agents spécialisés, mais chacun
dans son format, et Bobine ne sait ni les créer, ni les invoquer d'un geste, ni les montrer au
travail. Un rôle de Bobine est écrit une fois et marche avec tous les agents.

## Décisions

Validées par l'utilisateur le 2026-11-14 (format : [ADR-0045](../adr/0045-roles-fichiers-markdown.md)) :

- Section « Équipe » repliable dans la barre latérale (phase 3) ; pas de palette ⌘K.
- Les sept rôles fournis (expert UX/UI, expert Flutter, architecte front, architecte back, expert
  sécu, tech lead, code reviewer) sont **actifs d'office, désactivables** ; modifiables et
  supprimables côté personnel (un rôle personnel du même nom les remplace).
- Plusieurs `@rôle` dans un message : **une fille par rôle, en parallèle** (saisie en phase 3 ; le
  cœur lance N filles avec rôles).
- À nom égal, le rôle du **projet** l'emporte sur le rôle personnel (qui l'emporte sur le fourni).
- Création (phase 3) : **assistant en 3 étapes** (Qui / Comment / Avec quoi, maquettes A1–A3) ;
  édition par **un écran unique** (formulaire, maquette B3) ; les entrées « sur place » (menu `@`
  « + Nouveau rôle », « Enregistrer comme rôle » sur une fille) ouvrent l'assistant prérempli.
  « Décrire en une phrase » n'est pas retenu pour l'instant.
- Format ci-dessous (fichier Markdown à en-tête), ADR-0045 accepté.
- Couleurs de rôle : uniquement les **couleurs d'accent existantes** de l'app.

Détail :

1. **Un rôle = un fichier Markdown** à en-tête, comme les commandes personnelles (fiche 045) et les
   sous-agents de Claude Code :
   ```markdown
   ---
   name: expert-secu
   label: Expert sécu
   icon: shield-check          # icône Lucide
   color: orange               # une des couleurs d'accent : orange, blue, violet, pink, green, graphite
   description: Audite la sécurité d'un changement (injection, secrets, permissions). Ne modifie rien.
   agent: opencode             # facultatif : sinon l'agent de la conversation
   mode: plan                  # facultatif : mode natif utilisé si l'agent l'a (valeur ou nom)
   model: …                    # facultatif, profils qui permettent le choix du modèle
   read-only: true             # même dossier, sans worktree ; écritures refusées et surveillées
   mcp: [terminal, browser]    # facultatif : familles d'outils de Bobine données à la fille
   ---
   Tu es un expert en sécurité applicative. Pour chaque risque : preuve (fichier:ligne),
   scénario d'attaque, gravité, correctif minimal…
   ```
   Portée : **projet** (`.bobine/roles/` du dossier de la mère, partagé par git) ou **personnel**
   (`<données de Bobine>/roles/`, tous les projets). Le projet l'emporte à nom égal. Sept rôles
   fournis, actifs d'office et désactivables : ceux cités par l'utilisateur. `mcp` désigne les
   familles d'outils de Bobine (`terminal`, `browser`, `preview`, `ios-simulator`,
   `android-emulator`, `memory`) : sans lui, la fille a toutes celles de la conversation ; avec,
   seulement celles-là (plus les questions et le lien avec la mère). Les serveurs MCP propres à un
   agent restent dans ses fichiers (fiche 025).
2. **Un rôle s'exécute toujours dans une conversation fille.** Elle a son propre contexte (la mère
   ne gonfle pas, utile avec Bob qui sature vite), elle est visible, ouvrable, arrêtable, et rend
   un compte rendu. Lecture seule : même dossier, comme le relecteur de la fiche 177 ; sinon son
   worktree, comme toute fille. Voir « Lecture seule : ce qui est garanti » ci-dessous.
3. **Consigne** : la consigne du rôle part **toujours** en tête du premier message (ACP ne permet
   pas de poser un prompt système) ; si l'agent a le mode nommé par `mode` (modes ou options de
   catégorie `mode` de sa session), la fille est en plus mise dans ce mode, pour elle seulement
   (relecture du 2026-11-14 : avant, la consigne n'était envoyée que sans mode natif).
4. **Deux façons d'invoquer, une seule définition** :
   - l'utilisateur : `@rôle …` dans la saisie lance la fille avec ce rôle et ce texte ;
   - l'agent : `start_child` reçoit un argument `role`, et la liste des rôles (nom + description)
     est donnée dans sa description et dans le contexte de session. L'agent propose, l'utilisateur
     décide sur la carte de proposition (fiche 112), comme aujourd'hui.
5. **Les rôles se voient au travail** : icône et couleur du rôle sur la carte de la fille, dans la
   carte « Sous-tâches » de la mère (avec ce que chacun fait en ce moment) et dans la barre
   latérale. Pas de nouvel écran tant que ces cartes suffisent.
6. **Création** : parcours choisi par l'utilisateur sur maquettes (assistant en étapes, « décrire
   en une phrase », création sur place depuis `@` ou depuis une fille réussie…). La gestion vit
   dans Réglages › Rôles ; le point d'entrée principal doit être visible hors des Réglages.
7. **Écarté** : les « skills » (pas une notion d'ACP, sens différent selon l'agent) ; la liste
   d'outils autorisés outil par outil (Bobine ne bloque que ce qui demande une autorisation : la
   restriction réelle passe par le mode natif) ; un agent qui crée seul ses rôles (il peut en
   proposer un, l'utilisateur valide) ; la synchronisation dans les deux sens avec les fichiers des
   agents.

## Lecture seule : ce qui est garanti (phase 2)

Bobine ne peut refuser que ce qu'un agent lui demande. Trois garde-fous, sans en promettre plus :

1. **Consigne** : le premier message dit à la fille qu'elle est en lecture seule (pas de fichier
   créé, modifié, supprimé ou déplacé, pas de commit, pas de commande qui écrit).
2. **Refus d'office** : toute demande d'autorisation de genre `edit`, `delete`, `move` ou
   `switch_mode` est refusée par Bobine (option « refuser », sinon annulée), avant tout accord
   d'office ou « toujours autorisé » ; une ligne du fil le dit. Les commandes (`execute`) restent
   posées à l'utilisateur : une relecture lance `git diff` ou les tests. Bob demande avant d'écrire
   (`kind: edit`, traces 2.0.9) : refus effectif.
3. **Surveillance du dossier**, indépendante des demandes : empreinte git (HEAD, `status`, `diff`,
   fichiers nouveaux) prise avant l'envoi d'un message de Bobine à la fille (consigne, message de
   la mère) — au départ du tour pour un message tapé dans la fille —, comparée à la fin du tour.
   Un écart est dit dans le fil de la fille et dans celui de la mère (même dossier). Rien n'est
   défait ni arrêté : le tour est déjà fini, l'utilisateur voit et décide. Pour ne pas accuser à
   tort, un tour n'est pas jugé si une autre conversation du même dossier a lancé pendant ce temps
   un outil qui peut écrire ; une modification faite à la main pendant le tour serait signalée (le
   texte dit seulement « le dossier a changé »).

Un agent qui **écrit sans demander** (OpenCode réglé par défaut, profil `writesWithoutAsking`) n'est
pas arrêté par 2 : sa lecture seule n'est **que demandée**, même si le rôle nomme un mode natif
(rien ne prouve que ce mode interdise l'écriture ; `mode: plan` d'OpenCode aide, mais `build`
écrit), et le fil de la fille le dit dès le lancement. Une fille en lecture seule n'a droit à aucun
accord « toujours » (outils de l'agent retenus, commandes « toujours dans ce projet » des outils de
Bobine) : tout est demandé. Hors périmètre, noté : Bob demande un changement de mode avec
`kind: "other"`, non attrapé par le refus de `switch_mode` (impact limité, les écritures restent
refusées). Bobine
n'impose pas d'office le mode plan de l'agent : celui de Bob écrit un plan et finit par une
question, seul le rôle sait quel mode lui convient.

## Lancer des filles sans insister

### Diagnostic (lu dans le code, 2026-11-14)

1. **Le contexte arrive une fois** : `capabilitiesContext` (`shared/children.ts`, fiche 118) est
   joint au premier message de chaque session. Il pèse peu face au prompt système de l'agent, et
   disparaît du contexte à la compaction.
2. **Les consignes sont surtout des interdits** : le réglage par défaut « Quand ça s'y prête » et
   la description de `start_child` (`main/mcp/children-tools.ts`) énumèrent ce qu'il ne faut pas
   faire, et renvoient explicitement vers « your own sub-agents ».
3. **Une fille paraît chère** : worktree, carte d'accord, attente du compte rendu. Sans raison
   concrète, l'agent fait le travail lui-même.
4. **Aucun spécialiste nommé** : « fais relire par l'expert sécu » est un déclencheur naturel ;
   « ouvre une conversation fille » ne l'est pas. C'est la description des sous-agents qui fait
   déléguer Claude Code.
5. Les petits modèles appellent rarement un outil MCP qu'ils ne connaissent pas.

### Corrections proposées

- **Les rôles eux-mêmes** : la liste des rôles, avec leur description « quand l'utiliser », dans la
  description de `start_child` et dans le contexte de session.
- **Description réécrite en positif** : quand déléguer d'abord (plusieurs tâches indépendantes,
  relecture par un spécialiste, travail long), les exclusions ensuite, sans renvoi vers les
  sous-agents de l'agent pour un travail séparé.
- **Rappel court réinjecté** (quelques lignes) après une compaction, à la reprise d'une session
  (`session/load`) et quand le message de l'utilisateur nomme un rôle.
- **Filles de relecture sans worktree** (lecture seule, fiche 177) : moins chères, donc proposées
  plus volontiers.
- **Mesure avant et après** : un banc de dix consignes types (plusieurs tâches, « fais relire »,
  question simple qui ne doit pas déléguer…), joué à la main avec OpenCode et un modèle gratuit
  (0 coût), Bob seulement sur décision de l'utilisateur ; on compte les `start_child` justes et
  les délégations à tort. Le banc n'entre pas dans les essais automatiques (aucun vrai modèle).

## Critères d'acceptation

- [ ] Un rôle se crée par le parcours retenu sur maquettes, se modifie et se supprime dans Réglages
      › Rôles ; portée personnelle ou projet (`.bobine/roles/*.md`), relu à chaud.
- [x] Un fichier de rôle invalide est signalé (nom du fichier, raison) sans bloquer les autres
      (phase 2 : `roles:list` rend les problèmes ; l'écran viendra en phase 3).
- [x] `@` dans la saisie liste les rôles ; `@rôle texte` lance la fille avec ce rôle (phase 3B :
      sans carte d'accord, l'utilisateur l'a demandé ; plusieurs `@rôle` : une fille chacun).
- [x] `start_child` accepte `role` ; un rôle inconnu est refusé avec la liste des rôles connus.
- [x] Le mode natif est utilisé quand l'agent l'a ; la consigne part toujours en premier message.
- [x] Un rôle en lecture seule travaille dans le même dossier ; ses demandes d'écriture sont
      refusées et dites ; une écriture faite sans demander est signalée (voir « Lecture seule »).
- [x] Les outils du rôle (`mcp` : familles d'outils de Bobine) sont ceux passés à la session de la
      fille.
- [ ] Icône et couleur du rôle sur la carte de la fille, dans « Sous-tâches » et dans la barre
      latérale ; textes en français et en anglais. (Phase 3B faite : carte de la fille, « Sous-tâches »,
      compte rendu, proposition, en-tête de la fille ; barre latérale : phase 3A.)
- [x] Contexte de session et description de `start_child` réécrits ; rappel après compaction et
      reprise ; banc de délégation joué avant et après, résultats dans le journal (phase 1).
- [x] Testé contre l'agent factice : scénarios « délègue à un rôle », « rôle inconnu », « rôle en
      lecture seule qui tente d'écrire » (avec et sans demande), « mode natif présent / absent ».
- [ ] E2e : création d'un rôle, `@rôle`, carte de la fille, clair et sombre, fr et en. (Phase 3B :
      `roles-travail` pour `@rôle`, deux filles, proposition, lecture seule demandée ; création :
      phase 3A.)
- [ ] Phase 4 seulement : « Installer dans Bob / OpenCode », d'après leur documentation publique
      (modes personnels de Bob relus par ACP ? format des agents d'OpenCode), export à sens
      unique, copie de sauvegarde avant d'écrire, déclaré dans les profils (ADR-0011).

## Plan

Phases livrables séparément, chacune verte (`verify`, e2e touchées) :

1. **Délégation** (sans interface) : description de `start_child` et contexte réécrits, rappel
   après compaction et reprise ; banc joué avant et après. Petit, mesurable, utile tout de suite.
2. **Rôles, cœur** : `shared/roles.ts` (lecture et validation de l'en-tête), `main/roles/`
   (chargement personnel et projet, surveillance des fichiers), argument `role` de `start_child`,
   liste dans le contexte, lancement de la fille (mode, consigne, lecture seule, MCP), canaux IPC.
3. **Rôles, interface** (après validation des maquettes) : parcours de création, Réglages › Rôles,
   menu `@`, icône et couleur sur les cartes et dans la barre latérale.
4. **Export vers les agents** (après vérification de leur documentation publique).

Contraintes : `conversations/manager.ts`, `agent-host.ts`, `main/index.ts`, `shared/ipc.ts` et
`shared/transcript.ts` sont à leur plafond ESLint (audit du 13/11, CODE-2) : le code des rôles vit
dans ses propres modules, et un fichier au plafond est découpé avant d'y ajouter. Aucune nouvelle
dépendance (icônes Lucide déjà présentes). Un ADR pour le format des rôles et leur portée.

## Journal

- 2026-11-14 : fiche écrite ; diagnostic de la délégation lu dans le code ; maquettes demandées
  (plusieurs parcours de création, rôles au travail, Réglages › Rôles), en attente de validation.
- 2026-11-14 : **phase 1 (délégation) faite**, sans interface.
  - **Textes réécrits en positif** (anglais, génériques) : description de `start_child`
    (`main/mcp/children-tools.ts`) et contexte de session `capabilitiesContext`
    (`shared/children.ts`) disent d'abord quand déléguer (plusieurs tâches indépendantes, long
    travail à suivre, relecture ou audit par un regard neuf), puis les exclusions (question,
    lecture de code, petit correctif, tâches dépendantes ou sur les mêmes fichiers). Retirés :
    « (or with your own sub-agents) » de `start_child`, et le paragraphe qui réservait les
    sous-agents à la lecture ; à la place une ligne : « For a separate piece of work, start_child is
    the tool, not your own sub-agents. » Paragraphe « tech lead » resserré (même contenu).
  - **Rappel court** `capabilitiesReminder` (même balise `<bobine_capabilities>`, 3 ou 4 lignes de
    texte) : le contexte de session porte désormais son moment (`SessionMoment` de
    `shared/app-context.ts`). Session neuve (`opened`) : contexte complet ; session rouverte sous le
    même identifiant (`resumed` : `session/load` ou `session/resume`, dont l'historique a déjà le
    contexte complet) et premier message après une compaction (`compacted` : `/compact` ou
    `compaction_update`) : le rappel. Rien ailleurs, rien avec « Jamais »
    (`childrenSessionContext`). L'index de la mémoire (fiche 182) part aux mêmes moments qu'avant.
    **Écart** : la fiche prévoyait le rappel *en plus* ; il *remplace* le contexte complet qui
    repartait déjà à ces deux moments (fiches 118 et 182) — moins de contexte, et les détails
    restent dans la description de l'outil. Le rappel « quand le message nomme un rôle » attend
    la phase 2.
  - `agent-host.ts` (plafond) : à lignes égales (1 046), le drapeau booléen devient le moment ;
    type `SessionContext` dans `prompt-content.ts`.
  - **Relecture sans worktree depuis `start_child` : pas faite.** Le mécanisme de la fiche 177 ne
    s'y prête pas simplement : `ChildReviews.start` refuse quand l'auteur répond (or `start_child`
    est appelé en plein tour) ; il relit un diff (point de comparaison, liste de fichiers, refus si
    rien à relire), pas un audit libre d'un module ; ses remarques passent par `report_findings`
    vers une carte de l'auteur ; et la carte de proposition devrait dire « relecture en lecture
    seule », donc changer d'interface. À faire en phase 2 avec `read-only` des rôles.
  - Agent factice : aucun comportement de protocole nouveau (même bloc de texte, même balise : le
    scénario `chantiers` réagit au rappel comme au contexte). `docs/mock-agent.md`, `docs/acp.md`
    et `docs/architecture.md` le disent.
  - Tests : `shared/children.test.ts` (ordre « quand déléguer » puis exclusions, rappel de 3 à 5
    lignes, « Jamais »), `shared/app-context.test.ts` (rappel reconnu par `stripAppContext`),
    `mcp/children-tools.test.ts` (description en positif, plus de renvoi aux sous-agents),
    `agent/session-context.test.ts` (agent factice : complet au premier message, rien au
    deuxième, rappel une fois après `/compact`, rappel une fois après `session/load`, rien avec
    « Jamais » aux trois moments). Vérifié qu'il échoue si la reprise est prise pour une session
    neuve.
  - **Banc de délégation** (à la main, hors essais automatiques) : OpenCode 2.2.5, modèle gratuit
    GLM-5.3-Flash Free (Zen), `pnpm pilote lancer --agents-neufs` (profil temporaire, dossier
    personnel vide pour l'agent), dépôt jetable `calc` (git, 5 petits modules) remis à zéro avant
    chaque consigne, une nouvelle conversation par consigne, réglage par défaut « Quand ça s'y
    prête », cartes de proposition laissées sans réponse. Avant : build du commit `3699121` ;
    après : build de `5bdf87b`. Coût : 0.

    | # | Consigne | Attendu | Avant | Après |
    |---|---|---|---|---|
    | 1 | Trois fonctions indépendantes (`slugify`, `clamp`, `addDays`), chacune avec son test | déléguer | 3 filles ✓ | 3 filles ✓ |
    | 2 | « Fais relire src/auth.js par un regard neuf » | déléguer | fait lui-même ✗ | 1 fille ✓ |
    | 3 | « Audite la sécurité et la performance de auth.js et store.js » | déléguer | fait lui-même ✗ | 2 filles ✓ |
    | 4 | Tests complets de math.js et, à côté, doc de strings.js | déléguer | 2 filles ✓ | 2 filles ✓ |
    | 5 | Réécrire store.js (JSON, migration, tests), « je veux le suivre à part » | déléguer | 1 fille ✓ | 1 fille ✓ |
    | 6 | CLI `bin/calc.js` et, séparément, export CSV | déléguer | 2 filles ✓ | 1er essai : fait lui-même ✗ (« l'outil n'était pas disponible ») ; 2e essai : 2 filles ✓ |
    | 7 | « Que fait hash ? » | ne pas déléguer | répond ✓ | répond ✓ |
    | 8 | Faute de frappe dans divide | ne pas déléguer | corrige ✓ | corrige ✓ |
    | 9 | Renommer `sum` puis ajouter `average` (même fichier, dépendantes) | ne pas déléguer | fait ✓ | fait ✓ |
    | 10 | « Où est géré le stockage des utilisateurs ? » | ne pas déléguer | répond ✓ | répond ✓ |

    Décompte (premier essai de chaque consigne) : **avant** 4 délégations justes, 0 à tort,
    2 absences à tort (relecture, audit) ; **après** 5 justes, 0 à tort, 1 absence à tort (n° 6,
    juste au second essai). Le gain visé (relecture et audit) est là ; le n° 6 du premier essai
    reste inexpliqué : l'agent dit l'outil indisponible, aucun appel `start_child` dans le fil, et
    le journal de Bobine (niveau par défaut) n'en dit rien. Une suite e2e tournait en même temps sur
    la machine. Un seul tirage par consigne et par build : un échantillon, pas une mesure ; à
    rejouer avec un autre modèle gratuit et plusieurs tirages si l'écart compte. Bob non joué
    (bobcoins : sur décision de l'utilisateur).
  - Vérifications : `./scripts/verify` vert (code de sortie 0 ; 3 808 essais). `pnpm e2e --changed`
    sur le build de `5bdf87b` : 192/192 vertes, clair et sombre (toutes les suites : `agent-host.ts`
    est commun), code de sortie 0. Rien ne change à l'écran : captures non comparées une à une.
  - Après les docs, `verify` a échoué une fois sur `conformance-bob.test.ts` › « prompt simple »
    (« agent exited, attendu ready » ; aucun code touché depuis le premier passage vert), puis ce
    fichier vert 3 fois seul et `verify` vert de nouveau (code 0) : essai instable sous charge,
    noté ici, non corrigé dans cette phase.

- 2026-11-14 : **phase 2 (rôles, cœur sans interface) faite.** Décisions de l'utilisateur
  reportées (section « Décisions »), format accepté : ADR-0045.
  - **Découpage d'abord** (commit `refactor:` à part, sans changement de comportement) : réponses
    automatiques aux autorisations sorties d'`agent-host.ts` (`agent/permission-answers.ts`),
    création d'une fille sortie du gestionnaire (`childDetachedRequest` de `helpers.ts`),
    branchement des filles sorti d'`index.ts` (`conversations/children-setup.ts`), empreinte git
    sortie de `children-review.ts` (`conversations/folder-fingerprint.ts`). Après la phase :
    `agent-host.ts` 1 045/1 050, `manager.ts` 1 047/1 050, `index.ts` 850/850, `shared/ipc.ts`
    790/800 (requête de `conversation:startChild` devenue `ChildStartRequest`), `transcript.ts`
    inchangé (798/800) ; aucun seuil relevé.
  - **Format et bibliothèque** : `shared/roles.ts` (en-tête lu sans dépendance, comme les
    commandes de la fiche 045 mais avec listes et commentaires ; champ inconnu = fichier écarté,
    erreurs `{ code, field, line }` traduites `roles.error.*`), `main/roles/library.ts`
    (fournis, personnels `<données>/roles/`, projet `.bobine/roles/` de la **mère**), sept rôles
    fournis en anglais (`main/roles/builtin.ts`, libellés traduits) : `ux-ui-expert`,
    `flutter-expert`, `front-architect`, `back-architect`, `security-expert` (lecture seule),
    `tech-lead` (lecture seule), `code-reviewer` (lecture seule). Désactivation par nom
    (`rolesOff` des réglages). Canaux `roles:list`, `roles:read`, `roles:save`,
    `roles:setEnabled`, `roles:remove` (preload `roles.*`, profil en lecture seule : seuls
    `list` et `read` passent).
  - **Délégation** : `start_child` prend `role` (inconnu ou désactivé : refusé avec la liste) ;
    les rôles actifs (nom, « quand l'utiliser », lecture seule) dans sa description et dans le
    contexte de session complet et le rappel ; rappel joint aussi quand le message de
    l'utilisateur nomme un rôle (`@nom`, `extraContext(text, tools)` de l'hôte, reporté de la
    phase 1). Agent et modèle du rôle repris quand le profil le permet (`roles/choice.ts`), sinon
    une note pour la mère ; ce qu'elle passe elle-même l'emporte ; la carte porte la pastille du
    rôle (`ChildProposal.role`). `ChildConversations.start` prend `role` par son nom (servira à
    `@rôle` en phase 3, une fille par rôle) ; rôle retenu dans l'enregistrement de la fille
    (`ConversationRecord.role`, vérifié à la relecture de l'index), son résumé et `child-started`.
  - **Mode et consigne** : agent prêt, mode natif posé par `setControl` si un mode de la session a
    la valeur ou le nom du rôle (`roles/launch.ts`), et alors pas de consigne dans le message ;
    sinon la consigne en tête du premier message (`<bobine_role>`), et une ligne du fil dit que le
    mode manque. **Limite** : comme le modèle choisi d'une fille (fiche 160), le mode n'est posé
    qu'au lancement, pas à une session rouverte plus tard.
  - **Outils** (`mcp`) : **écart** — la fiche citait `mcp: [simulator]` comme « serveurs MCP
    propres au rôle ». Bobine ne passe aujourd'hui à l'agent que son propre serveur ; les serveurs
    MCP d'un agent vivent dans ses fichiers (fiche 025) et les repasser en `session/new` les
    doublerait sans rien de documenté chez Bob. `mcp` choisit donc les **familles d'outils de
    Bobine** données à la fille (`roleToolModules`), à valider par l'utilisateur.
  - **Lecture seule** (voir la section dédiée) : pas le mécanisme de la fiche 177 tel quel (qui
    relit un diff et rend `report_findings`), mais ses deux briques : même dossier sans worktree
    (`childDetachedRequest`) et empreinte git ; plus le refus d'office des demandes d'écriture
    (`AgentHostOptions.readOnly`), et l'honnêteté pour un agent qui écrit sans demander (retour
    du tech lead du 2026-11-14) : capacité `writesWithoutAsking` déclarée dans le profil
    d'OpenCode (repère `writes-without-asking`, Réglages › Agents et `docs/agents.md`), ligne
    « lecture seule seulement demandée » dans le fil de la fille, garde-fou par empreinte avant et
    après chaque tour. Le garde-fou ne défait ni n'arrête rien. **Écart** : pas d'arrêt de la
    fille, le tour est déjà fini quand l'écart se voit.
  - **Agent factice** : scénarios `roles-delegue`, `roles-inconnu`, `role-ecrit-avec-demande`,
    `role-ecrit-sans-demander` ; `/scenario` reconnu après la consigne d'un rôle
    (`docs/mock-agent.md`). Mode natif présent / absent joué avec `echo` (mode `ask` de l'agent
    factice, ou un mode qu'il n'a pas).
  - **Tests** : `shared/roles.test.ts` (lecture, refus motivés, aller-retour, priorité,
    désactivation, `@nom`, premier message), `roles/library.test.ts` (fournis, priorité, fichier
    invalide signalé, relecture à chaud, désactivation, écriture, renommage, suppression),
    `agent/permission-answers.test.ts`, `roles/launch.test.ts` (mode natif, niveau de lecture
    seule, familles d'outils), `roles/read-only-watch.test.ts`, `mcp/children-tools.test.ts`
    (argument `role`), `roles/roles-children.test.ts` (agent factice : délégation, rôle inconnu
    par l'outil et par l'IPC, écriture demandée puis refusée, écriture sans demander signalée chez
    la fille et la mère, mode natif présent / absent, rôle de projet non commité lu dans le dossier
    de la mère, rôles dans le contexte et rappel sur `@nom`). Aucun vrai modèle ni vrai agent.
  - Vérifications : `./scripts/verify` vert (code de sortie 0 ; 429 fichiers, 3 860 essais).
    `pnpm build && pnpm e2e --changed` : 192/192 vertes, clair et sombre (toutes les suites :
    `agent-host.ts` est commun), code de sortie 0, 15 min 10 s. Rien ne change à l'écran (pas
    d'interface en phase 2) : captures non comparées une à une.
  - Points ouverts pour la phase 3 : écran Réglages › Rôles et assistant (canaux prêts), menu `@`
    (une fille par rôle, `ChildStartRequest.role`), icône et couleur sur la carte de proposition
    (`ChildProposal.role`), dans « Sous-tâches » (`child-started.role`) et la barre latérale
    (`ConversationSummary.role`), mention « lecture seule seulement demandée » dans l'interface
    (`ProfileSummary.writesWithoutAsking`) ; valider le sens de `mcp` (familles de Bobine) ;
    évènement de liste changée si l'écran doit suivre les fichiers à chaud.
- 2026-11-14 : **relecture de la phase 2** (relecture indépendante, vérifiée par le tech lead) et
  correctifs, chacun avec un essai qui échouait avant :
  1. **Écrasement par lien symbolique** (bloquant) : `writeFileAtomic` et `writeFileAtomicAsync`
     (`storage.ts`, toute l'app) retirent un temporaire préexistant puis le créent en exclusif
     (`wx`), copie de sauvegarde en exclusif aussi ; la bibliothèque ne lit ni n'écrit à travers
     `.bobine` ou `.bobine/roles` liens (problème `link` signalé), et refuse un `<nom>.md` lien.
  2. **Mode et modèle retenus pour le profil** (bloquant) : `ConversationManager.setControl(…,
     { remember: false })`, utilisé par le mode d'un rôle **et** par `applyModel` — même défaut
     corrigé pour le modèle d'une fille de la fiche 160 et du relecteur de la fiche 177 : il
     devenait le modèle par défaut du profil.
  3. **Niveau de lecture seule** : pour un agent `writesWithoutAsking`, toujours « demandée », mode
     natif ou non (`mode: build` écrit).
  4. **Consigne toujours envoyée**, mode natif ou non ; ADR-0045 révisé (note datée, avant fusion,
     à la demande du tech lead).
  5. **Rôle de projet** : la proposition fige la définition (`RoleSnapshot` : consigne, mode,
     lecture seule, outils, portée, rôles remplacés), la carte de la phase 3 pourra les montrer,
     et le lancement part du figé sans relire par nom ; un rôle de projet qui en remplace un
     fourni ou personnel est signalé (`hides` dans la liste, ligne dans le fil de la fille).
  6. **Genre de l'outil** : la demande d'autorisation prend le `kind` annoncé par le `tool_call`
     quand elle n'en porte pas (`ProfileUpdates.permission`), avant le refus de lecture seule ;
     scénario `role-ecrit-sans-genre`.
  7. **Accords « toujours »** ignorés pour une fille en lecture seule (outils retenus de l'agent,
     commandes « toujours dans ce projet » des outils de Bobine, choix non proposé).
  8. **Écrasement du fichier d'un autre rôle** : `save` refuse un `<nom>.md` qui existe et n'est pas
     celui du rôle renommé (`duplicateName`).
  9. **Lecture seule perdue au rechargement** : un rôle retenu en lecture seule le reste avec un
     badge de repli si son libellé, son icône ou sa couleur sont abîmés (outils : aucun si la liste
     est illisible).
  - Mineurs : empreinte git qui échoue sur toute erreur ou délai (`ls-files -z`) et tour non
    vérifié dit dans le fil (`roles.notice.watchFailed`) ; empreinte préparée oubliée si l'envoi
    échoue ; un second message pendant un tour garde l'empreinte de départ ; en-tête : listes en
    tirets non indentés, `---` suivi d'espaces ; libellé et description sans saut de ligne ;
    fichier lu dans sa limite de taille, plus de 100 fichiers signalé (`tooMany`) ; liste des rôles
    donnée à l'agent bornée à 20 (fournis et personnels d'abord, description coupée à 200
    caractères, « and N more »).
  - Sens de `mcp` (familles d'outils de Bobine) validé par le tech lead.
  - Le test de la phase 2 « mode natif présent » vérifie désormais la consigne envoyée et l'absence
    de réglage retenu pour le profil.
  - Vérifications après correctifs : `./scripts/verify` vert (code de sortie 0 ; 429 fichiers,
    3 875 essais) ; `pnpm build && pnpm e2e --changed` : 192/192 vertes, clair et sombre, code de
    sortie 0, 15 min 00 s.

### Phase 3B — interface : invoquer et voir les rôles au travail (2026-11-14)

Maquettes validées suivies : 02-1, 02-2, 02-3, 02-4, 02-7, 03-1 à 03-5. Hors périmètre (non faits) :
02-5 carte au survol, 02-6 bande « Confier à… », 03-6 panneau Équipe, 03-7 présence en barre de
titre, 03-8 tableau d'équipe. Barre latérale, Réglages › Rôles et assistant : phase 3A (autre
branche).

- **Envoi direct** (décision) : `@rôle …` lance la fille sans carte d'accord — c'est l'utilisateur
  qui le demande, en toutes lettres. Plusieurs `@rôle` : une fille par rôle, même texte, rien
  envoyé à la mère. Canal `roles:startChildren` (`shared/roles-ipc.ts`, `main/roles/invoke.ts`) :
  rôles vérifiés et lancés **l'un après l'autre** (deux `git worktree add` à la fois dans un même
  dépôt peuvent se gêner, et le plafond des filles se compte juste), agent et modèle du rôle repris
  par `roleDefaults` comme pour `start_child` (sinon ceux de la mère) ; un rôle refusé (inconnu,
  désactivé, plafond) n'empêche pas les autres : sa raison est dite dans le fil. Refusé en lecture
  seule du profil (`read-only-guard.ts`). `appRoles` prend un seul accès tardif
  `() => ({ conversations, children })` (`index.ts` reste à 850 lignes).
- **Menu `@`** (`FileMenu`, `useMentions`, `components/roles/RoleMenu.tsx`) : section « Rôles » en
  tête, cinq rôles tant que rien n'est tapé puis « Tous les rôles (N) », recherche sans accents
  (nom et mots du libellé d'abord, puis description : `shared/role-mentions.ts`), marque d'un rôle
  du projet, clavier inchangé (↑↓, Tab/Entrée, Échap), libellés ARIA. Aucun rôle actif :
  l'invitation de 02-7, « Ne plus montrer » retenu dans le navigateur.
- **Jeton et « Partira à… »** (`useRoleCompose`, `RoleCompose.tsx`) : un rôle choisi devient un
  jeton (`@requête` sort du texte), retiré par × ou par retour arrière en tête de la saisie ; un
  `@nom` tapé en entier compte aussi ; un `@mot` inconnu reste du texte. Liseré de la couleur du
  rôle (neutre à plusieurs), ligne « Partira à… » : agent, lecture seule (garantie ou demandée),
  « dans ce dossier » ou « son worktree » ; plusieurs rôles : avatars empilés et un résumé.
- **Rôles au travail** (`RoleWork.tsx`, `RoleAvatar.tsx`) : la fille d'un rôle remplace la ligne
  « Conversation fille lancée » par une carte à son identité (avatar à son état, nom du rôle, ce
  qu'elle fait, lecture seule, consigne dépliable, « Ouvrir ») ; « Sous-tâches » : avatars empilés
  en tête, chaque ligne avec l'avatar, le nom du rôle, son état et l'outil en cours (dernier
  `tool_call` reçu de la fille par `agent:event`, effacé en fin de tour) ; compte rendu titré du
  rôle ; proposition de l'agent : badge, « Rôle — titre », lecture seule garantie / demandée ou
  « écrit du code », mode, agent choisi sur la carte, marque du projet et avertissement « il
  remplace le rôle fourni/personnel du même nom » (du `RoleSnapshot` figé) ; en-tête de la fille :
  avatar, nom, lecture seule. États de l'avatar unifiés (03-5) : repos, au travail (anneau qui
  tourne, fixe si les animations sont réduites), attend votre accord, a rendu, échec.
- **Lecture seule seulement demandée** : d'après `ProfileSummary.writesWithoutAsking` du profil de
  la fille (ou de celui choisi sur la carte), jamais d'après un nom d'agent ; dite « lecture seule
  demandée », expliquée en infobulle, sur la ligne « Partira à… », la proposition, la carte et
  l'en-tête de la fille (`role-view.ts`).
- **Couleurs** : seulement `ACCENT_COLORS`, valeur prise dans `TINTS` de la palette affichée
  (`useRoleTint`, suit le thème) et posée en `--role`. Icônes : une liste choisie de Lucide
  (`role-icons.ts`, 30 icônes, `bot` par défaut) — pas tout le paquet. Aucune dépendance.
- **Découpages** (plafonds ESLint) : touches de la saisie sorties de `Composer` (`composerKeyDown`,
  même comportement) ; logique des jetons dans `useRoleCompose`. `Transcript.tsx` : lancement
  passé à chaque fille (`last` pour la carte « Sous-tâches »), rôle passé au compte rendu.
- **Agent factice** : `MOCK_AGENT_WRITES=silent` déclare `writesWithoutAsking` sur le profil
  factice (comme OpenCode), pour l'e2e ; aucun scénario nouveau.
- **Écarts aux maquettes** :
  1. Le jeton n'est pas **dans** la ligne de texte (une zone de saisie `textarea` ne sait pas
     afficher un bloc insécable) : les jetons sont en tête de la saisie, au-dessus du texte ; le
     retour arrière en tête du texte retire le dernier. Un `@nom` tapé en entier reste du texte
     (pas de jeton), mais compte à l'envoi et la ligne « Partira à… » le dit.
  2. 03-1 : pas de bouton « Arrêter » ni de compteur « 4 fichiers lus · 2 recherches » sur la
     carte de la fille (pas d'information fiable côté mère) ; l'action en cours vient du dernier
     outil annoncé pendant que la carte est affichée (rien n'est relu d'avant). La carte
     « Sous-tâches » reste aussi pour une seule fille (fusion, coût, comme aujourd'hui).
  3. 03-2 : pas de « Autoriser / Refuser » sur la ligne (la demande d'accord reste dans la fille,
     ouverte d'un clic) ; pas de « Tout arrêter ».
  4. 03-3 : titre de la carte inchangé (« 1 tâche proposée ») — une mère n'a jamais de rôle (une
     fille ne lance pas de fille) ; pas de pied « Proposé d'après la description… » ni de
     « Tout lancer ».
  5. 03-4 : pas de pastilles de gravité ni de « Voir les remarques » (un rôle ne rend pas de
     remarques structurées, contrairement au relecteur de la fiche 177).
  6. 02-1 : pas de « coût ≈ 3 × une relecture » (02-4) ; « + Nouveau rôle » et « Gérer » sont
     prévus mais masqués tant que l'app ne sait pas les ouvrir (phase 3A).
  7. Conversation encore vide : une fille se rattache à une conversation de l'historique
     (`children.error.draft`) ; la ligne « Partira à… » le dit avant l'envoi, l'erreur reste
     celle du cœur. Les pièces jointes ne partent pas aux rôles : l'envoi le dit et ne part pas.
- **À brancher après la fusion avec la phase 3A** : `ComposerRoles.onCreate(name?)` (« + Nouveau
  rôle » du menu `@` et « Créer un rôle » de l'invitation, assistant prérempli du nom tapé) et
  `ComposerRoles.onManage()` (« Gérer » → Réglages › Rôles) dans `useComposerRoles` (App.tsx,
  quatrième argument) ; « Enregistrer comme rôle » sur une fille (3A) ; réconcilier les avatars
  (`components/roles/RoleAvatar.tsx`, `role-icons.ts`, `roles-work.css`) avec ceux de la barre
  latérale de la 3A pour n'en garder qu'un ; relire la liste quand les fichiers changent (le menu
  la relit à chaque ouverture).
- **Tests** : `shared/role-mentions.test.ts` (recherche, `@nom` d'un message, plusieurs rôles,
  rôle inconnu laissé en texte, retours à la ligne), `main/roles/invoke.test.ts` (requête
  vérifiée, une fille par rôle, agent du rôle, refus rendus), `roles-children.test.ts` (agent
  factice : deux rôles et un inconnu, lecture seule dans le dossier de la mère, worktree sinon),
  `components/roles/RoleComposer.test.tsx` (menu, filtre, clavier, jeton, retour arrière, envoi,
  deux rôles, inconnu, aucune fille partie, lecture seule demandée, conversation vide),
  `RoleWork.test.tsx` (carte de la fille, « Sous-tâches » et outil en cours, compte rendu,
  proposition : badge, mode, garantie / demandée, « écrit du code », projet qui remplace),
  `role-view.test.ts`. E2e `roles-travail` (agent factice, dépôt jetable avec un rôle du projet) :
  menu `@`, filtre, jeton, retour arrière, une fille, deux filles, « Sous-tâches », en-tête de la
  fille, proposition, puis `MOCK_AGENT_WRITES=silent` : lecture seule demandée (ligne, carte,
  en-tête). Clair, sombre, et `--lang en`.
- **Menu `@` partagé** : un rôle trouvé par sa seule description ne passe pas devant
  `@git-changes` / `@terminal` tapés par leur nom (régression vue par l'e2e `mentions` : `@git`
  puis Entrée prenait le code reviewer, dont la description cite `git diff`). En revanche, `@te`
  propose d'abord « Tech lead » (rôles en tête, maquette 02-1) : l'e2e `mentions` tape désormais
  `@term`.
- **Vérifications** : `./scripts/verify` vert (code de sortie 0, lu directement ; 434 fichiers,
  3 916 essais). `pnpm build && pnpm e2e --changed --jobs 2` (toutes les suites : `Composer.tsx` et
  `Transcript.tsx` sont communs) : 190/194, 4 échecs, tous de `mentions` (clair et sombre, la
  régression ci-dessus) ; corrigée, puis `pnpm e2e mentions roles-travail composer attachments
  commands user-commands --jobs 2` : 12/12 vertes. `roles-travail` aussi en `--lang en` : vert.
  La suite complète n'a pas été rejouée après le correctif (seulement les suites du menu `@`).
{1-menu, 2-filtre, 3-jeton, 4-fille, 5-deux-roles,
  6-sous-taches, 7-fille-entete, 8-proposition, 9-jeton-demandee, 10-proposition-demandee,
  11-fille-demandee}-{light,dark}.png` (et `en-…`).
