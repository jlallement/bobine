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
3. **Consigne** : si l'agent a le mode nommé par `mode` (liste des modes ACP de sa session), la
   fille est ouverte dans ce mode (prompt système et restrictions natives) ; sinon la consigne du
   rôle part en tête de son premier message (ACP ne permet pas de poser un prompt système).
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
pas arrêté par 2 : sa lecture seule n'est **que demandée**, sauf si le rôle nomme un mode natif qui
la tient (`mode: plan` pour OpenCode), et le fil de la fille le dit dès le lancement. Bobine
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
- [ ] `@` dans la saisie liste les rôles ; `@rôle texte` propose la fille avec ce rôle.
- [x] `start_child` accepte `role` ; un rôle inconnu est refusé avec la liste des rôles connus.
- [x] Le mode natif est utilisé quand l'agent l'a, la consigne en premier message sinon.
- [x] Un rôle en lecture seule travaille dans le même dossier ; ses demandes d'écriture sont
      refusées et dites ; une écriture faite sans demander est signalée (voir « Lecture seule »).
- [x] Les outils du rôle (`mcp` : familles d'outils de Bobine) sont ceux passés à la session de la
      fille.
- [ ] Icône et couleur du rôle sur la carte de la fille, dans « Sous-tâches » et dans la barre
      latérale ; textes en français et en anglais.
- [x] Contexte de session et description de `start_child` réécrits ; rappel après compaction et
      reprise ; banc de délégation joué avant et après, résultats dans le journal (phase 1).
- [x] Testé contre l'agent factice : scénarios « délègue à un rôle », « rôle inconnu », « rôle en
      lecture seule qui tente d'écrire » (avec et sans demande), « mode natif présent / absent ».
- [ ] E2e : création d'un rôle, `@rôle`, carte de la fille, clair et sombre, fr et en.
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
