# 223 — Rôles : des agents spécialisés à invoquer, et des filles lancées sans insister

- **Statut** : fait — phases 1 (délégation), 2 (rôles, cœur sans interface), 3 (interface : 3A
  gestion, 3B rôles au travail, intégrées) et 4 (« Installer dans Bob / OpenCode ») faites le
  2026-11-14
- **Dépend de** : 045 (commandes personnelles, fichiers Markdown du projet), 097 et 160
  (conversations filles, agent et modèle d'une fille, ADR-0019, ADR-0036), 112 (carte de
  propositions), 118 (filles proposées par l'agent, contexte de session), 177 (relecteur en lecture
  seule dans le même dossier), 013 (modes et options de session)
- **Agents** : tous. Un rôle est une conversation fille ordinaire, lancée avec une consigne, un
  mode et des outils choisis : rien de propre à un agent hors des profils (ADR-0011). Une seule
  capacité déclarée dans un profil : `writesWithoutAsking` (OpenCode, repère
  `writes-without-asking`), qui dit que la lecture seule n'y est que demandée. Phase 4 :
  « Installer dans… » passe par un adaptateur déclaré dans le profil (`roleExport` : Bob
  `bob-custom-modes`, OpenCode `opencode-agents`, repère `role-export` de `specificItems` et de la
  matrice de `docs/agents.md`, ADR-0047).

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

- [x] Un rôle se crée par le parcours retenu sur maquettes, se modifie et se supprime dans Réglages
      › Rôles ; portée personnelle ou projet (`.bobine/roles/*.md`), relu à chaud (phase 3A).
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
- [x] Icône et couleur du rôle sur la carte de la fille, dans « Sous-tâches » et dans la barre
      latérale ; textes en français et en anglais. (Phase 3B : carte de la fille, « Sous-tâches »,
      compte rendu, proposition, en-tête de la fille ; barre latérale : phase 3A ; un seul avatar
      depuis l'intégration.)
- [x] Contexte de session et description de `start_child` réécrits ; rappel après compaction et
      reprise ; banc de délégation joué avant et après, résultats dans le journal (phase 1).
- [x] Testé contre l'agent factice : scénarios « délègue à un rôle », « rôle inconnu », « rôle en
      lecture seule qui tente d'écrire » (avec et sans demande), « mode natif présent / absent ».
- [x] E2e : création d'un rôle, `@rôle`, carte de la fille, clair et sombre, fr et en.
      (`roles-gestion` : création, jeton posé par « Créer et essayer » et par la section Équipe,
      « Enregistrer comme rôle » ; `roles-travail` : `@rôle`, deux filles, proposition, lecture
      seule demandée.)
- [x] Phase 4 seulement : « Installer dans Bob / OpenCode », d'après leur documentation publique
      (modes personnels de Bob relus par ACP ? format des agents d'OpenCode), export à sens
      unique, copie de sauvegarde avant d'écrire, déclaré dans les profils (ADR-0011). (Bob 2.1.0
      par `pnpm bob-probe`, OpenCode 2.2.5 par `pnpm opencode-probe --offline` ; ADR-0047 ; e2e
      `roles-export`.)

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

### Phase 4 — « Installer dans Bob / OpenCode » (plan, 2026-11-14)

D'après les maquettes validées 05-1 à 05-4 et les faits relevés : Bob 2.1.0 (`pnpm bob-probe`,
commit `71e5b90`) liste par ACP les modes de `~/.bob/settings/custom_modes.yaml` et de
`<dossier>/.bob/custom_modes.yaml` après `agent`, `plan`, `ask` ; OpenCode (documentation publique,
à confirmer par `pnpm opencode-probe --offline`) lit `~/.config/opencode/agents/<id>.md` et
`<dossier>/.opencode/agents/<id>.md`. Export à sens unique, toujours sur un geste explicite.

**Dépendance nouvelle** : `yaml` (eemeli, ISC, accord de l'utilisateur) — son API `Document`
ajoute, remplace ou retire notre seule entrée de `custom_modes.yaml` en gardant le reste du fichier
et ses commentaires ; `pnpm third-party-notices` mis à jour. ADR-0047 (Bobine écrit des rôles dans
les fichiers des agents).

Fichiers :
- `src/shared/role-export.ts` (nouveau) : formats (`bob-custom-modes`, `opencode-agents`), portées,
  aperçu, état d'une installation, erreurs ; canaux `roles:export*` ajoutés au contrat de
  `roles-ipc.ts` (`shared/ipc.ts` au plafond : rien à y ajouter).
- `src/main/roles/export/` (nouveau) : `bob-custom-modes.ts` et `opencode-agents.ts` (un adaptateur
  par format : chemin, noms réservés, texte écrit, lecture et retrait de notre entrée),
  `registry.ts` (registre des exports dans les données de Bobine), `backup.ts` (copie datée, nombre
  borné, avant toute écriture d'un fichier existant), `service.ts` (aperçu, installer, mettre à
  jour, retirer, état ; conflit, modification à la main, lien refusé), `ipc.ts`, `native.ts`
  (mode natif installé pour `useInBobine`).
- `src/main/agent/profiles.ts` : capacité `roleExport` (Bob : `bob-custom-modes` ; OpenCode :
  `opencode-agents` ; agent factice : selon `MOCK_AGENT_ROLE_EXPORT`) ; `capabilities.ts` : repère
  `role-export` dans `specificItems` ; `ProfileSummary.roleExport`.
- `src/main/roles/launch.ts`, `conversations/children.ts`, `roles/setup.ts` : au lancement d'une
  fille, rôle sans `mode` et installé avec « lancer dans ce mode » pour ce profil (projet : même
  dossier) : son mode natif s'il est dans les modes de la session ; lecture seule alors tenue par
  l'agent (`enforced`) si l'installation l'était.
- `src/main/index.ts` (au plafond) : profils et dossier des agents sortis dans un module, pour
  passer ce qu'il faut à `appRoles` sans ajouter de ligne.
- Renderer : `components/roles/RoleExport*.tsx` (bouton et menu « Installer dans… », feuille,
  lignes d'état), `RoleEditPage.tsx` les monte ; textes dans `fr.json` et `en.json`.
- Agent factice : `MOCK_AGENT_ROLE_EXPORT=bob|opencode` → `--modes-exportes bob|opencode`, il lit
  les fichiers du dossier personnel d'essai et du dossier de travail et liste ces modes après les
  siens ; `docs/mock-agent.md`.
- `scripts/opencode-probe.mts` : sondage sans modèle d'un agent écrit comme Bobine (personnel et
  projet), listé dans les modes par ACP ?
- E2e : suite `roles-export` (installer, à jour, rôle changé puis mettre à jour, conflit, retirer,
  `useInBobine` qui pose le mode), clair et sombre, fr et en.
- Docs : `docs/agents.md` (matrice), `docs/acp.md` (Bob, OpenCode), `docs/architecture.md`,
  `docs/mock-agent.md`, ADR-0047, `CHANGELOG.md` et `CHANGELOG.en.md`.

Étapes, `./scripts/verify` entre chacune : (1) adaptateurs et leurs essais ; (2) sonde
d'OpenCode ; (3) registre, sauvegarde, service et essais ; (4) profils, IPC ; (5) `useInBobine` au
lancement ; (6) agent factice ; (7) interface ; (8) e2e ; (9) docs et clôture.

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

### Phase 3A — interface : créer, modifier, gérer

- 2026-11-14 : **phase 3A faite** (branche `feat/223-roles-ui-create`), d'après les maquettes
  validées (A1–A3, B3, 04-1 à 04-3, section Équipe de 01-0). Renderer seulement : aucun canal
  nouveau, `roles:*` de la phase 2 et `conversation:startChild` avec `role`.
  - **Point d'entrée pour la phase 3B** (menu `@` « + Nouveau rôle », « Enregistrer comme rôle »
    sur une fille) : `openRoleWizard(prefill?: Partial<RoleDraft>)` de
    `renderer/src/roles/roles-store.ts`. `RoleDraft` (`roles/role-draft.ts`) : `label`, `name`,
    `icon`, `color`, `description`, `prompt`, `agent`, `mode`, `model`, `readOnly`, `mcp` (`null` :
    toutes), `scope` (`user` | `project`). Un libellé sans nom donne le nom ; une icône ou une
    couleur données ne sont plus suggérées. L'assistant est monté une fois (`RolesHost`, dans
    `AppDialogs`) : rien à brancher d'autre. Aussi : `openRoleChild(nom)` ouvre « Confier à
    <rôle> » (consigne, puis fille de la conversation affichée avec ce rôle), et `RoleAvatar`
    (`components/roles/RoleAvatar.tsx`) dessine l'icône et la couleur d'un rôle (`RoleBadge`,
    `RoleStamp` ou définition) dans la teinte de la palette affichée : à réutiliser pour les cartes
    de proposition, de fille et « Sous-tâches » plutôt qu'en écrire un second.
  - **Attendu de 3B** : « Créer et essayer » et le clic sur un rôle de la section Équipe ouvrent
    « Confier à <rôle> » (dialogue à part) faute de saisie préremplie ; une fois le menu `@` en
    place, ils pourraient poser `@nom ` dans la saisie (à décider à la fusion).
  - **Assistant** (`components/roles/RoleWizard.tsx`, aperçu `RolePreview.tsx`) : Qui (nom avec
    son avatar, identifiant tiré du nom tant qu'on ne l'écrit pas, 21 icônes Lucide et les 6
    couleurs d'accent, suggérées d'après le nom ; « Quand faire appel à lui ? » avec compteur et
    exemples), Comment (tuiles des rôles fournis — définition d'origine, même remplacés —, celle
    de même icône présélectionnée, « Page blanche » ; une consigne écrite à la main n'est remplacée
    qu'après confirmation), Avec quoi (agent, mode, modèle, lecture seule, outils de Bobine,
    portée). Validation par étape (toutes les erreurs de l'étape, sous leur champ, `aria-invalid`),
    `checkRole` du partagé avant l'envoi ; un refus du main (nom pris, lien refusé…) ramène à
    l'étape du champ, une exception (pas de projet, profil en lecture seule) s'affiche en pied.
    ⌘↩ : étape suivante ou créer ; Entrée dans le nom : suivante ; Échap ou Annuler après une
    saisie : « Abandonner ce rôle ? » ; clic hors de la fenêtre sans effet.
  - **Lecture seule seulement demandée** : dite sous l'interrupteur quand l'agent choisi (ou celui
    de la conversation) a `ProfileSummary.writesWithoutAsking` — aucun nom d'agent dans l'UI.
  - **Réglages › Rôles** (`RolesSettings.tsx`, onglet `roles` après Agents) : groupes Ce projet
    (nom du dossier), Personnels, Fournis avec Bobine (« n sur m actifs ») ; chaque ligne : avatar,
    libellé, description, pastilles « Remplace un rôle fourni/personnel » (`hides`), agent du rôle
    (« absent » s'il n'est pas installé), « Lecture seule », interrupteur d'activation (par nom,
    toutes portées), ligne pâlie si désactivé ; « Fichiers écartés » avec chemin et raison
    (`roles.error.*`). Sans rôle à soi : état vide « Montez votre équipe » (04-3) au-dessus des
    rôles fournis.
  - **Modifier** (`RoleEditPage.tsx`) : un écran, les champs de l'assistant (`RoleFields.tsx`,
    communs) ; Enregistrer / Annuler les modifications en pied collé ; renommer passe
    `previousName` ; bandeau « Partagé par git » pour un rôle du projet ; un rôle fourni s'enregistre
    en rôle personnel du même nom (bandeau, bouton « Enregistrer en rôle personnel », pas de
    Supprimer) ; Essayer, Dupliquer (assistant prérempli), Supprimer avec confirmation dans la page
    (`ConfirmRow`).
  - **Section « Équipe »** (`TeamSection.tsx`, en tête de la liste défilante de la barre latérale,
    repliable comme les autres, repli retenu sous `team`) : rôles actifs du projet affiché en
    avatars (infobulle : nom et description) ; clic : « Confier à <rôle> » ; « + » : assistant.
    Fille avec rôle : son avatar avant le titre dans la barre latérale (`HistoryItem`), « Rôle : … »
    dans l'infobulle.
  - **Conversation encore vide** : une fille ne s'y rattache pas (refus du main) ; « Confier à »
    le dit d'emblée et « Créer et essayer » n'est pas proposé.
  - **Écarts aux maquettes** (choix du plus simple et fiable) :
    - pas de « Décrire en une phrase » ni d'« Améliorer avec l'agent… » (non retenus) ; l'état vide
      n'a qu'un bouton « Créer mon premier rôle » (pas « Partir d'un modèle » à part : les tuiles
      sont à l'étape 2) ; pas de « Parcourir les modèles » ni de galerie ;
    - agent : liste déroulante (les agents installés peuvent être nombreux) au lieu d'un sélecteur
      segmenté ; mode et modèle : champs libres (« Par défaut de l'agent ») — les listes d'un agent
      ne se connaissent qu'avec une session ouverte ;
    - « Serveurs MCP propres au rôle » → « Outils de Bobine » (familles, sens de `mcp` validé en
      phase 2) ;
    - édition : enregistrement par bouton, pas automatique ; disposition empilée (pas en
      libellé / champ sur deux colonnes) ; pas de menu « … » (Dupliquer, Supprimer en boutons), ni
      « Ouvrir le fichier », « Rendre personnel », « Installer dans Bob / OpenCode » (phase 4) ;
      portée non modifiable après création ; pas de « utilisé N fois » ;
    - pas de réglage « L'agent peut proposer des rôles » (celui des filles, Réglages ›
      Conversations, vaut déjà) ; pas d'animation (avatar qui « vole », ligne qui clignote) ;
    - section Équipe : un clic ouvre « Confier à… » (fille de la conversation affichée), pas une
      nouvelle conversation ;
    - aperçu « Dans le fil, au travail » : texte fixe (« au travail », « relit le code ») ;
    - l'icône et la couleur sur la carte de proposition, de fille et « Sous-tâches » restent à la
      phase 3B.
  - **Tests** : `roles/role-draft.test.ts` (nom tiré du libellé, suggestions, préremplissage,
    validation par étape, champs envoyés, erreur du main placée), `RoleWizard.test.tsx` (erreurs
    de l'étape 1, trois étapes au clavier avec modèle présélectionné et portée projet, nom pris
    renvoyé à l'étape 1, « seulement demandée », sans projet, Échap, remplacement de consigne),
    `RolesSettings.test.tsx` (groupes, `hides`, fichier écarté, activation, état vide, renommage,
    rôle fourni enregistré en personnel, suppression confirmée) ; `settings-search.test.ts` (14
    onglets). Suite e2e **`roles-gestion`** (agent factice `streaming-texte`, dépôt jetable avec un
    rôle de projet `code-reviewer` et un fichier fautif) : section Équipe, assistant (erreurs, trois
    étapes, fichier écrit), « Créer et essayer » jusqu'à la fille avec son avatar, Réglages › Rôles
    (remplacement, fichier écarté), modifier, désactiver, supprimer deux rôles jusqu'à l'état vide
    (le fourni revient), page d'un rôle fourni ; clair et sombre, fr et `--lang en`. Captures
    regardées : `e2e/captures/r1-equipe`, `r2-assistant-qui`, `r3-assistant-comment`,
    `r4-assistant-avec-quoi`, `r5-confier`, `r6-fille-avec-role`, `r7-reglages-roles`,
    `r8-edition`, `r9-vide`, `r10-edition-fourni` (`-light` / `-dark`, `en-…`).
  - Aucune dépendance nouvelle ; aucun seuil ESLint relevé. Glossaire (`docs/traduction.md`) :
    rôle, consigne, équipe, confier, fichier écarté.

  - Vérifications : `./scripts/verify` vert (code de sortie 0 ; 432 fichiers, 3 896 essais).
    `pnpm build && pnpm e2e --changed --jobs 2` (toutes les suites : barre latérale et textes
    sont communs) : 192/194 vertes en 23 min 07 s ; les 2 échecs étaient `settings` (clair et
    sombre), qui comptait treize onglets — corrigé à quatorze (Rôles), suite rejouée seule : 2/2
    vertes. `roles-gestion` aussi en `--lang en` : 2/2 vertes.
- 2026-11-14 : **relecture tech lead de la phase 3A**, correctifs :
  1. Description d'un rôle fourni affichée dans la langue de l'interface
     (`rolesSettings.builtinDescription.*`, `shownDescription` de `renderer/src/roles/role-text.ts`)
     dans Réglages › Rôles et l'infobulle de la section Équipe ; celle envoyée à l'agent reste en
     anglais (ADR-0014). Les tuiles de l'assistant n'affichent pas de description. **Choix** : l'écran
     d'édition d'un rôle fourni montre la description de l'agent (anglaise), celle qui sera
     enregistrée dans le rôle personnel qui le remplace. `main/roles/builtin.test.ts` fige les sept
     noms traduits.
  2. Fichier écarté : chemin relatif à sa portée (`.bobine/roles/faute.md`, `roles/faute.md`), chemin
     complet en infobulle (`problemPath`).
  3. Section Équipe : les maquettes 01-0 et 03-6 n'y montrent que les avatars, nom et description en
     infobulle au survol ; chaque tuile a déjà son infobulle et son nom accessible (« Confier un
     travail à … ») — vérifiés par l'e2e (capture `r1b-equipe-infobulle`).

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
- **Relecture du tech lead** (corrigée) : l'anneau « au travail » tournait hors du carré de
  l'avatar (un toit au-dessus) : remplacé par un anneau **dans** le carré, qui pulse (fixe si les
  animations sont réduites) — écart à 03-5 (« anneau qui tourne »). La carte de proposition disait
  « chacune dans son propre worktree » même pour un rôle en lecture seule : en-tête adapté
  (`roleWork.proposalsWhere`) et lieu dit par ligne (« dans ce dossier » / « son worktree »). La
  description d'un rôle est lue par une seule fonction, `roleDescription` (`components/roles/
  role-view.ts`), pour l'affichage et la recherche du menu `@` : la description traduite de la 3A
  s'y branchera. Capture du nouvel état : `roles-travail-5b-au-travail-{light,dark}.png`.
- **Vérifications** : `./scripts/verify` vert (code de sortie 0, lu directement ; 434 fichiers,
  3 916 essais). `pnpm build && pnpm e2e --changed --jobs 2` (toutes les suites : `Composer.tsx` et
  `Transcript.tsx` sont communs) : 190/194, 4 échecs, tous de `mentions` (clair et sombre, la
  régression ci-dessus) ; corrigée, puis `pnpm e2e mentions roles-travail composer attachments
  commands user-commands --jobs 2` : 12/12 vertes. `roles-travail` aussi en `--lang en` : vert.
  La suite complète n'a pas été rejouée après le correctif (seulement les suites du menu `@`).
  Captures : `e2e/captures/roles-travail-{1-menu, 2-filtre, 3-jeton, 4-fille, 5-deux-roles,
  6-sous-taches, 7-fille-entete, 8-proposition, 9-jeton-demandee, 10-proposition-demandee,
  11-fille-demandee}-{light,dark}.png` (et `en-…`).

### Intégration 3A + 3B (2026-11-14)

Branches `feat/223-roles-ui-create` (3A) et `feat/223-roles-ui-work` (3B) fusionnées dans
`feat/223-roles` (`--no-ff`), puis branchées l'une sur l'autre.

- **Conflits** : `docs/architecture.md` et cette fiche (les deux phases gardées) ;
  `components/roles/RoleAvatar.tsx`, ajouté par les deux branches. Les locales, le type généré,
  les changelogs et le glossaire ont fusionné sans conflit.
- **Un seul avatar, une seule liste d'icônes, une seule feuille de style** (résolu dans le commit
  de fusion, c'était le conflit) : `RoleAvatar` garde les états de la maquette 03-5 (3B) et
  `label` / `testId` (3A, `data-testid="role-avatar"` par défaut) ; `useRoleTint` rend la teinte
  (3A), `useRoleStyle` le style `--role` (3B). Les deux phases avaient chacune leur échelle de
  tailles (`sm` valait 24 px en 3A et 22 px en 3B) : la taille est désormais le côté en pixels
  (18, 22, 24, 30, 32, 44), chaque appel garde sa taille d'avant. Icônes :
  `renderer/src/roles/role-icons.ts` seul, 31 icônes (les 21 de l'assistant, dans le même ordre,
  puis les 10 que seule la 3B affichait) — **écart visuel assumé** : la grille de l'assistant a une
  rangée de plus, pour que tout ce qui s'affiche puisse se choisir. Styles : `roles-work.css`
  versé dans `roles.css` (importé par `main.tsx`), règles d'avatar en un seul bloc ; liseré de
  l'avatar à 30 % de la couleur partout (3A : 26 %, différence imperceptible).
- **Descriptions** : `roleDescription` (3B, `role-view.ts`) passe par `shownDescription` (3A) ;
  menu `@` (affichage et recherche), jeton, infobulles, Réglages › Rôles et section Équipe lisent
  la description par elle : traduite pour un rôle fourni, celle du fichier sinon ; l'agent reçoit
  toujours celle du fichier (ADR-0014).
- **Entrées croisées** : « + Nouveau rôle » et « Créer un rôle » du menu `@` ouvrent l'assistant
  prérempli du nom tapé (`openRoleWizardNamed` : `perf-expert` → « Perf expert ») ; « Gérer »
  ouvre Réglages › Rôles.
- **Décision : un seul chemin pour invoquer un rôle depuis l'interface, le jeton `@rôle`.** Un
  clic sur un rôle de la section Équipe, « Essayer » (Réglages › Rôles, qui se ferment) et « Créer
  et essayer » (assistant) posent le jeton du rôle dans la saisie de la conversation affichée
  (`invokeRole`, reçu par `useRoleCompose`) et lui donnent le focus ; l'utilisateur écrit sa
  demande et envoie, comme avec le menu `@` (une fille par rôle, `roles:startChildren`). Le
  dialogue « Confier à… » (`RoleChildDialog`, `openRoleChild`, clés `team.child.*`) est retiré.
  Une fille ou un relecteur ne prend pas de jeton : un avertissement dit d'ouvrir la conversation
  mère (`team.notHere`). Une conversation encore vide prend le jeton ; la ligne « Partira à… » dit
  déjà qu'une fille se rattache à une conversation de l'historique (3B), et « Créer et essayer »
  n'y est pas proposé.
- **« Enregistrer comme rôle… »** (maquette 01-C2) : sur le compte rendu d'une fille **sans rôle**
  qui a fini son tour (`outcome: done`, consigne présente dans le fil), un bouton ouvre l'assistant
  prérempli (`roles/save-as-role.ts`) : consigne = la demande faite à la fille
  (`child-started.prompt`), agent = le sien, modèle = la valeur du réglage de modèle de sa session
  (lue par `conversation:view`, rien si la session est illisible), lecture seule cochée si elle n'a
  modifié aucun fichier. **Écart** : pas de fenêtre posée sur la carte ni de nom / description
  proposés d'après le titre ni d'« Améliorer » (l'assistant prérempli, décidé le 2026-11-14, est le
  plus simple) ; la fille ne reçoit pas après coup l'avatar du rôle créé.
- **Libellés des rôles fournis** (demande de l'utilisateur) : « Expert sécurité », « Architecte
  back-end », « Architecte front-end » (anglais inchangé : Security expert, Back-end architect,
  Front-end architect) ; identifiants inchangés ; `builtin.test.ts` les fige.
- **Essais instables** : `roles-children.test.ts` et `children.test.ts` sondaient toutes les
  10 ms en recalculant les fils (`manager.view`), ce qui chargeait la machine quand `verify`
  fait tourner 440 fichiers à la fois, et « réveil groupé » attendait jusqu'à 20 s dans un essai
  limité à 15 s. Ils attendent désormais sur les évènements du gestionnaire (`until` de
  `conversations/manager-until.ts` : vérification à chaque évènement et changement de liste, un
  contrôle lent de rattrapage toutes les 250 ms, délai de 10 s sous celui de l'essai, message qui
  dit ce qui était attendu). « Réveil groupé » est coupé en deux essais (réveil des filles lancées
  par l'agent ; aucune pour une fille lancée à la main). Mêmes vérifications, aucun délai relevé.
- **Tests** : `RoleComposer.test.tsx` (description traduite affichée et cherchée, jeton posé par
  `invokeRole`, refus dans une fille), `roles/roles-store.test.ts`, `roles/save-as-role.test.ts`,
  `Transcript.test.tsx` et `RoleWork.test.tsx` (bouton seulement sans rôle),
  `main/roles/builtin.test.ts` (libellés fr / en), `conversations/manager-until.test.ts`. E2e
  `roles-gestion` : « Créer et essayer » pose le jeton puis la fille part avec le rôle, clic sur la
  section Équipe (jeton, focus, « Partira à… »), « Enregistrer comme rôle » sur une fille lancée par
  « Lancer en parallèle… » (consigne et agent repris), puis abandon de l'assistant.
- **Régression vue par l'e2e `mentions`, corrigée** : une fois « + Nouveau rôle » branché, il
  passait en tête du menu `@` quand aucun rôle ne correspondait, et Entrée après `@git` ou `@term`
  ouvrait l'assistant au lieu de prendre la mention. Il est désormais **en fin de menu** (après
  les mentions et les fichiers, à l'écran comme au clavier) — écart à la maquette 02-1, qui le
  plaçait sous les rôles ; il reste aussi dans le pied du menu. Essai : `RoleComposer.test.tsx`.
  Le focus revient à la saisie après la fermeture de l'assistant ou des Réglages (Radix rend le
  focus au déclencheur dans une minuterie à 0 ms ; `requestAnimationFrame` ne tourne pas dans une
  fenêtre cachée, ce que l'e2e a montré).
- **Vérifications** : `./scripts/verify` vert (code de sortie 0, lu directement ; 442 fichiers,
  3 954 essais, après le dernier correctif). `pnpm build && pnpm
  e2e roles-gestion roles-travail mentions settings filles --jobs 3` : premier passage 5 échecs
  (`mentions` clair et sombre : la régression ci-dessus ; `roles-gestion` : deux attentes de
  l'essai lui-même, saisie vidée et focus vérifiés trop tôt), corrigés ; second passage 10/10
  vertes, code de sortie 0. `--lang en` sur `roles-gestion roles-travail` : 4/4 vertes, code 0.
  Suite complète non jouée (le tech lead la lance à la fin). Captures regardées :
  `e2e/captures/roles-travail-1-menu-*` (descriptions en français, nouveaux libellés, « + Nouveau
  rôle… » et « Gérer » au pied), `r7-reglages-roles-*`, `r1-equipe-*`, `r5b-equipe-jeton-*`,
  `r11-enregistrer-comme-role-*`, `r12-assistant-prerempli-*` (et `en-…`).

### Relecture phase 3 (2026-11-14)

Relecture indépendante de l'interface des rôles, points confirmés par le tech lead ; un commit
`fix:` par point (ou groupe lié), chacun avec un essai qui échouait avant.

1. **Icône héritée d'`Object`** (`icon: constructor`, `toString`, `__proto__`, valides pour l'en-tête)
   : `roleIcon` rendait `Object`, écran blanc. Clés propres seulement (`Object.hasOwn`), icône par
   défaut sinon ; c'est la validation à l'affichage (le fichier n'est pas rejeté).
   `role-icons.test.tsx`.
2. **Double envoi** : un envoi aux rôles à la fois (état `sending`, réf. et état), bouton
   désactivé et « Lancement… » ; la saisie n'est vidée que si son texte n'a pas changé.
3. **Texte des filles réécrit** : seuls `@nom` et l'espace qui suit sont retirés ; indentation,
   listes et code gardés ; une mention dans un bloc ``` ou entre `` ` `` n'en est pas une.
4. **Liste de la saisie pas à jour** : relue après `rolesChanged` et au retour du focus ; à l'envoi,
   un `@nom` inconnu qui a la forme d'un rôle fait relire la liste une fois avant de décider (rôle
   tout juste créé : il reçoit la demande ; sinon envoi ordinaire). `useComposerRoles.test.ts`.
5. **Rôles trouvés par leur seule description** : après les fichiers, sous leur propre libellé
   (« Rôles dont la description correspond ») ; `@test` + Entrée prend `tests/…`.
6. **Échec partiel** : la demande et les jetons des rôles refusés restent (les `@nom` tapés
   deviennent des jetons).
7. **Rien à demander après le rôle** : bouton désactivé, la ligne « Partira à… » dit pourquoi.
8. **Relecteur comme mère** : déjà refusé — un relecteur est toujours rattaché (`startedFrom`), le
   refus « un seul niveau » vaut pour `start_child` comme pour `@rôle`. Essai ajouté qui le fige
   (`children-review.test.ts`), pas de code changé.
9. **Profil en lecture seule** : Réglages › Rôles est déjà inerte (`fieldset` de la fiche 196, sauf
   Données, Diagnostic, À propos), la saisie aussi ; restait « Enregistrer comme rôle », masqué.
10. **« Essayer » sur un rôle désactivé** : désactivé avec la raison (« Activez d'abord ce rôle »).
    Retour arrière : retire le dernier jeton **visible**.
11. **Clic Équipe sans saisie à l'écran** (« Mon activité », « Tâches planifiées ») : le rôle attend
    10 s la prochaine saisie (`invokeRole`), la section ramène la conversation affichée (ou en
    ouvre une nouvelle s'il n'y en a pas).
12. **Mentions** : `(@code-reviewer)` ne laisse pas `()`, `@a,@code-reviewer` reconnu, casse ignorée.
13. **Agent ou modèle du rôle indisponibles** : une ligne dans le fil de la fille
    (`roles.notice.agentMissing` / `modelMissing`, d'après `roleDefaults().missing`).

Trouvé en route : `verify` a échoué une fois sur `roles-children.test.ts` › « demande sans `kind` »
(attente de 10 s dépassée). Cause probable, lue dans le code : les demandes ACP et les
`session/update` passent par des files distinctes du SDK, la demande d'autorisation pouvait être
traitée avant le `tool_call` qui la précède ; le genre retenu (`edit`) manquait, l'écriture n'était
pas refusée et la fille attendait une carte. Le gestionnaire laisse désormais passer les
notifications reçues (`settleNotifications`, comme la fin d'un tour) avant de répondre. Course non
reproduite à la demande (10 lancements parallèles verts avant le correctif) : pas d'essai qui
échoue avant pour ce point. Un autre échec isolé, sans lien (`jobs/command-job.test.ts`, sortie
vide d'un `/bin/sh` sous charge), est vert seul trois fois : noté, non corrigé.

Vérifications : `./scripts/verify` vert trois fois de suite (code de sortie 0, lu directement ;
445 fichiers, 3 971 essais). `pnpm build && pnpm e2e roles-gestion roles-travail mentions --jobs 3` :
6/6 vertes, code de sortie 0 (après le feu vert du tech lead).

### Essais réels avant 1.0.0-beta.2 (2026-11-14)

Build de `51cb748` (`out/`), `pnpm pilote lancer` sur profil temporaire. OpenCode 2.2.5, modèle
gratuit GLM-5.3-Flash Free (Zen), `--agents-neufs`, coût 0. Bob 2.1.0 (commit `8afc0007b`), sa
propre configuration (sans `--agents-neufs`), 3 consignes. `~/.bob/settings/*.json` et
`~/.bob/trustedFolders.json` sauvegardés avant, inchangés après (`diff` vide), recopiés quand même.

**Banc de délégation** (OpenCode ; même dépôt `calc`, mêmes 10 consignes que la phase 1, une
nouvelle conversation par consigne, « Quand ça s'y prête », cartes laissées sans réponse), plus
4 consignes qui nomment un rôle sans dire `start_child`. Un tirage par consigne (aucune ratée).

| # | Consigne | Attendu | Phase 1 (après) | Obtenu | Rôle choisi |
|---|---|---|---|---|---|
| 1 | Trois fonctions indépendantes, chacune avec son test | déléguer | 3 filles ✓ | 3 filles ✓ | aucun |
| 2 | « Fais relire src/auth.js par un regard neuf » | déléguer | 1 fille ✓ | 1 fille ✓ | `code-reviewer` |
| 3 | Audit sécurité et performance de auth.js et store.js | déléguer | 2 filles ✓ | 2 filles ✓ | `security-expert`, `tech-lead` |
| 4 | Tests de math.js et, à côté, doc de strings.js | déléguer | 2 filles ✓ | 2 filles ✓ | aucun |
| 5 | Réécrire store.js, « je veux le suivre à part » | déléguer | 1 fille ✓ | 1 fille ✓ | aucun |
| 6 | CLI `bin/calc.js` et, séparément, export CSV | déléguer | ✗ puis ✓ | 2 filles ✓ | aucun |
| 7 | « Que fait hash ? » | ne pas déléguer | répond ✓ | répond ✓ | — |
| 8 | Faute de frappe dans divide | ne pas déléguer | corrige ✓ | corrige ✓ | — |
| 9 | Renommer `sum` puis ajouter `average` | ne pas déléguer | fait ✓ | fait ✓ | — |
| 10 | « Où est géré le stockage des utilisateurs ? » | ne pas déléguer | répond ✓ | répond ✓ | — |
| 11 | « Fais relire src/auth.js par l'expert sécurité » | `security-expert` | — | 1 fille ✓ | `security-expert` |
| 12 | « Demande au tech lead un plan pour ajouter une CLI » | `tech-lead` | — | 1 fille ✓ | `tech-lead` |
| 13 | « J'aimerais l'avis du code reviewer sur store.js » | `code-reviewer` | — | 1 fille ✓ | `code-reviewer` |
| 14 | « Ajoute une fonction `median` à math.js » | ne pas déléguer | — | fait ✓ | — |

Décompte au premier tirage : 6/6 sur les consignes à déléguer du banc d'origine (phase 1 : avant
4/6, après 5/6), 0 à tort ; les trois rôles nommés sont reconnus, et l'agent choisit aussi un rôle
de lui-même quand il convient (n° 2 et 3). Cartes : badge et libellé du rôle, « lecture seule
demandée », « dans ce dossier ». Un seul tirage : un échantillon.

**Rôles au travail** (OpenCode) :
- `@code-reviewer relis math.js` (mère non vide) : fille lancée sans carte, avatar et badge,
  carte « Sous-tâches », compte rendu titré du rôle ✓ (compte rendu en anglais : la consigne du
  rôle l'est). Ligne « Lecture seule seulement demandée… » en tête du fil de la fille ✓.
- `@security-expert @code-reviewer relisez auth.js` : deux filles en parallèle, deux comptes
  rendus ✓.
- `@code-reviewer corrige directement la faute dans divide` : OpenCode écrit sans demander (le
  fichier change) ; avertissement de lancement ✓, « Le dossier a changé pendant le tour… » dans le
  fil de la fille et dans celui de la mère ✓. Le modèle dit lui-même qu'il est sorti de son rôle.
- Rôle personnel `planificateur` (`mode: plan`, fichier `.md` écrit dans `<profil>/roles/`, pas
  par l'assistant) : apparu dans la section Équipe sans redémarrage ; la fille démarre en mode
  **Plan** ✓, la mère reste en Build, et une nouvelle conversation ensuite démarre en **Build** ✓.

**Bob** (3 consignes, ≈ 0,31 bobcoin affichés : 0,0821 + 0,1137 + 0,1123) :
- « Fais relire src/auth.js par l'expert sécurité » : proposition avec rôle `security-expert`,
  « lecture seule » (garantie), « dans ce dossier » ✓.
- `@code-reviewer relis src/math.js` : fille avec badge, compte rendu ✓. La fille a demandé une
  commande `git log … && git diff …` (posée à l'utilisateur, comme prévu ; accordée une fois).
- `@code-reviewer corrige la faute dans divide` : Bob demande l'écriture (`Applying diff…`,
  `kind: edit`), **refus automatique**, « Écriture refusée par Bobine : ce rôle est en lecture
  seule » dans le fil, Bob continue sans s'arrêter et rend sa relecture ; dossier inchangé ✓.
  Confirme les deux points « à vérifier » de `docs/acp.md` (rôle passé sans insister, refus
  accepté).

**Écarts et accrocs** (aucun bloquant pour la publication) :
1. **Titre des filles chez Bob** (gênant) : la consigne `<bobine_role>` part en tête du premier
   message, or Bob titre sa tâche d'après le début du message (fiche 125, D18) : les filles
   s'appellent « Code review setup for src directory », « Code review setup for French
   message » au lieu de la demande. Pas chez OpenCode.
2. **Consigne du rôle affichée brute** (gênant) : dans le fil de la fille, le premier message
   montre le bloc `<bobine_role …>…</bobine_role>` en entier (OpenCode et Bob), alors que la carte
   de la mère le replie sous « Consigne ».
3. **`@rôle` tapé dans une fille** (mineur) : `@security-expert @code-reviewer relisez auth.js`
   envoyé par erreur dans une fille part tel quel à l'agent de la fille, sans avertissement (le
   clic Équipe, lui, avertit).
4. **En-tête d'une fille, fenêtre de 1 280 px avec panneau ouvert** (mineur) : le titre
   disparaît (il ne reste que « ↳ »), et la pastille « Profil temporaire » chevauche l'onglet
   « Session » du panneau.
5. **Coût du compte rendu chez Bob** (mineur) : « Sous-tâches » dit 0,1137 bobcoin pour la fille,
   la carte du compte rendu 0,0371.
6. **« Toujours dans cette conversation »** proposé sur une demande de commande d'une fille Bob en
   lecture seule (option `allow_always` de Bob) ; la fiche dit qu'aucun accord « toujours » n'est
   proposé à une fille en lecture seule — à trancher (non essayé).
7. **Cartes « Expirée »** (attendu) : les agents OpenCode inactifs sont arrêtés (code 130 au
   journal) ; les propositions des conversations précédentes passent « Expirée » avec « Lancer »
   gardé (« L'agent a redémarré entre-temps »).
8. Pilote : `etat` ne listait pas la carte de propositions « en attente » des n° 11 à 13 (visible
   en capture) ; `cliquer` ambigu entre une conversation de la barre latérale et le lien
   « ↳ depuis » ou l'entrée du panneau.

### Correctifs après essais réels (2026-11-14)

D'après « Essais réels avant 1.0.0-beta.2 » ci-dessus ; un commit `fix:` par point, chacun avec un
essai qui échouait avant.

1. **Demande d'abord, consigne après** (fiche 125, D18) : `roleOpening` met la demande en tête,
   puis le bloc `<bobine_role>` (consigne entière, lecture seule, langue). Le bloc est un contexte
   de l'app (`APP_CONTEXT_OPENINGS.role`) : `stripAppContext` coupe un titre de Bob à la demande.
   L'agent factice cherche `/scenario` dans la demande.
2. **Consigne repliée dans le fil de la fille** : `splitRoleBrief` sépare la demande du bloc (après
   ou, pour les fils d'avant, en tête) ; le premier message montre la demande seule et « Consigne du
   rôle » repliable, comme la carte de la mère (`RoleBriefFold`).
3. **Langue** : dernière ligne du bloc « Reply in the language of the user's request. »
   (`ROLE_LANGUAGE_LINE`, texte pour l'agent, non traduit).
4. **« Toujours » pour une fille en lecture seule** : `askReadOnly` retire les options
   `allow_always` / `reject_always` de l'agent quand une option « une fois » de même sens existe,
   et une réponse « toujours » qui arriverait quand même part en « une fois ».
5. **`@rôle` dans une fille** : les rôles du projet sont lus aussi pour une fille (`elsewhere`) ;
   un `@rôle` tapé y est signalé sous la saisie (`team.notHere`), le menu `@` n'en propose aucun
   (ni l'invitation), et le message part tel quel à son agent.
6. **En-tête étroit** : le titre garde 96 px au moins et se tronque, « depuis… » et le badge du
   rôle cèdent d'abord, la pastille « Profil temporaire » ne rétrécit pas ; rien ne déborde sur le
   panneau. Vérifié par `roles-travail` (pastille posée, 1 280 px, panneau ouvert ; avant : titre
   à 22 px). Au plus étroit, la pastille « lecture seule » du badge est coupée (sans « … »).
7. **Coût du compte rendu chez Bob** : cause — le compte rendu est fait à la fin du tour, alors que
   le coût de Bob est lu hors protocole juste après, puis 1,5 s plus tard (fiche 157). Le dernier
   compte rendu d'une fille au repos prend désormais son coût actuel, le même que « Sous-tâches » ;
   un compte rendu plus ancien garde le sien. Le texte du compte rendu donné à l'agent de la mère
   n'est pas changé.
8. **`docs/acp.md`** : ligne Rôles mise à jour avec l'observé de Bob 2.1.0.

Non repris : n° 7 et 8 des écarts (cartes « Expirée », attendu ; pilote, hors fiche).

### Rôles fournis bilingues (2026-11-14)

Demande de l'utilisateur : la description (« Quand faire appel à lui ? ») et la consigne des sept
rôles fournis suivent la langue de l'interface, comme leur libellé. Exception à ADR-0014 écrite
dans **ADR-0046** (accepté).

- **Textes en code** : `main/roles/builtin-en.ts` (noms, type `BuiltinTexts`, anglais d'origine)
  et `builtin-fr.ts` (français écrit d'après l'anglais, vocabulaire du glossaire, « tu » ; compte
  rendu pour la mère gardé dans les deux langues). `builtin.ts` garde ce qui ne dépend pas de la
  langue (icône, couleur, lecture seule) et `builtinRoles(langue = langue courante)` ; insécables
  du français posées par `frenchSpaces` (les textes s'écrivent avec des espaces ordinaires).
  Fichiers de données sans import à l'exécution : la suite e2e `roles-gestion` les lit.
- **Langue au moment de la lecture** : `builtinRoles()` est appelé à chaque lecture de la
  bibliothèque (`roles:list`, `roles:read`, contexte de session, `start_child`). Le renderer relit
  au changement de langue : `useRolesListing` (liste, Équipe, menu `@`), la page d'édition d'un
  rôle fourni, les tuiles de l'assistant. Un `RoleSnapshot` déjà figé garde sa langue (essai).
  Modifier un rôle fourni enregistre un rôle personnel dans la langue affichée.
- **Code mort retiré** : `shownDescription` (`role-text.ts`), `roleDescription` (`role-view.ts`),
  l'option `describe` de `matchRoleGroups` et les clés `rolesSettings.builtinDescription.*` : la
  description reçue du main est déjà dans la bonne langue, un seul chemin.
- **Inchangé** : l'enveloppe `<bobine_role>` reste en anglais et demande toujours de répondre dans
  la langue de la demande.
- **Essais** : `builtin.test.ts` (deux langues, sept rôles valides, mêmes noms, icônes, couleurs et
  lecture seule ; changement de langue ; rôle figé), `roles-children.test.ts` (consigne française
  reçue par la fille). E2e `roles-gestion` : description et consigne du rôle fourni dans la langue
  des essais, puis langue changée dans Réglages › Général et retour (liste et page d'édition
  relues). Pour cela la suite tient la langue par `settings.json` (`BOBINE_LANG` vidé), comme la
  suite `language`. `roles-gestion` et `roles-travail` vertes en français et en anglais, clair et
  sombre ; captures `r10-edition-fourni-*` et `en-r10-edition-fourni-*` regardées.
- **Écart à signaler** : la consigne de l'expert sécurité garde quatre niveaux de gravité
  (« critique, haute, moyenne, basse »), fidèle à l'anglais (« critical, high, medium, low »),
  alors que le glossaire n'en a que trois pour l'interface et proscrit « critique ». À trancher.

### Phase 4 — « Installer dans Bob / OpenCode » (2026-11-14)

- 2026-11-14 : **phase 4 faite** (branche `feat/223-export`), d'après les maquettes validées 05-1 à
  05-4 et le plan ci-dessus ; ADR-0047.
  - **Faits relevés** : Bob 2.1.0 (`pnpm bob-probe`, commit `71e5b90`) liste par ACP les modes de
    `custom_modes.yaml` (personnel et projet) après `agent`, `plan`, `ask`. OpenCode **2.2.5**
    (`pnpm opencode-probe --offline`, nouveau sondage « rôles installés (agents) », attentes
    acceptées) : un agent écrit **exactement comme Bobine** (`openCodeAgentFile`), personnel
    (`$XDG_CONFIG_HOME/opencode/agents/`, avec `permissions`) et du projet
    (`.opencode/agents/`), est listé dans le réglage « Session Mode » et s'y choisit ; nouveau
    contrôle « rôles installés comme agents … listés et choisis par ACP ». Que les permissions
    tiennent demande un modèle : non sondé. Groupes de Bob d'après la documentation d'IBM
    (`read`, `edit`, `execute`, `mcp`… — la sonde de Bob écrivait `command`, que la documentation
    ne connaît pas : sans effet sur ce qu'elle vérifie).
  - **Dépendance nouvelle** : `yaml` 2.9.0 (eemeli, ISC), accord de l'utilisateur ; avis de licence
    régénérés (`pnpm build && pnpm third-party-notices`).
  - **Main** : `main/roles/export/` (adaptateurs purs sur le texte, déclarés dans les profils —
    la règle ESLint des modules d'agent l'impose ; fichiers, copies, registre, service, IPC) ;
    `agent/app-agents.ts` sorti de `index.ts` (au plafond) ; `roles/setup.ts` crée `RoleExports`
    et passe `nativeRoleMode` aux filles ; `roles/launch.ts` : mode installé posé quand le rôle n'a
    pas de `mode` et que la session l'annonce, lecture seule alors `enforced` si l'installation
    l'était (`readOnlyLevel(…, heldByAgent)`). Canaux `roles:export*` classés : aperçu et état
    sûrs, installer et retirer refusés en lecture seule du profil (`read-only-guard.ts`).
  - **Interface** : `RoleExportStatus.tsx` (`useRoleExport` : bouton et menu « Installer dans… »,
    lignes d'état, erreur « rien n'a été changé »), `RoleExportSheet.tsx` (feuille) ; textes
    `roleExport.*` (fr, en), dont les textes propres à un format (`roleExport.format.<format>.*`) ;
    aucun nom d'agent dans le code de l'interface : nom listé, fichier partagé et consigne de base
    remplacée viennent de l'adaptateur (`listedAs`, `sharedFile`, `replacesBasePrompt`).
  - **Agent factice** : `--modes-installes bob|opencode --perso <dossier>`
    (`MOCK_AGENT_ROLE_EXPORT`, seulement avec `BOBINE_CONFIG_HOME`), `docs/mock-agent.md`.
  - **Écarts aux maquettes et aux décisions** :
    - le conflit, comme les autres refus (lien, fichier illisible, modifié à la main), ferme la
      feuille et s'affiche en ligne rouge sur la page (05-4) ; un identifiant réservé est dit
      dans la feuille, « Installer » désactivé ;
    - états en plus de la maquette : « modifié à la main depuis » (« Remplacer » et « Retirer »,
      chacun après confirmation dans la ligne), « n'est plus dans le fichier » (« Réinstaller »),
      « fichier illisible » (aucune action) ; « Retirer » d'une entrée intacte part sans
      confirmation, comme sur la maquette (copie faite avant) ;
    - « Installer dans… » désactivé tant que le rôle a des modifications non enregistrées (Bobine
      relit le rôle enregistré) ;
    - feuille d'OpenCode : la phrase sur les filles en worktree est aussi dite (la maquette ne
      disait que « à committer ») ; la ligne « lecture seule tenue par l'agent » est dite pour les
      deux agents, seulement pour un rôle en lecture seule ;
    - « le rôle a changé depuis » compare ce qui serait écrit aujourd'hui à ce qui l'a été : une
      icône ou une couleur changée ne compte pas ; un rôle fourni installé puis l'interface passée
      dans une autre langue compte (libellé et description traduits) ;
    - liens symboliques : le fichier lui-même est refusé partout, et pour un projet chaque dossier
      du chemin ; ADR-0044 suit le lien de `settings.json` — ici refusé (ADR-0047) ;
    - un rôle renommé laisse son ancienne installation sans ligne (registre par identifiant) : à
      retirer avant de renommer, non dit dans l'interface ;
    - format V2 d'OpenCode seulement (OpenCode 1.x non pris en charge pour l'installation).
  - **Tests** : `main/roles/export/adapters.test.ts` (fusion YAML : commentaires gardés, autres
    modes intacts, notre entrée remplacée puis retirée en rendant le fichier d'origine, fichiers
    refusés ; fichier d'OpenCode), `service.test.ts` (aperçu, installer, à jour, rôle changé et
    mise à jour, copie avant d'écrire, conflit, modifié à la main, entrée absente, noms réservés,
    liens, fichier illisible, fichier changé pendant l'écriture, `nativeMode`, registre illisible,
    copies bornées), `launch.test.ts` (mode installé posé, absent de la session, `mode` du rôle
    prioritaire, lecture seule), `mock-agent/modes-installes.test.ts`, `RoleExport.test.tsx`,
    `capabilities.test.ts`, `opencode-probe.test.ts`. Tous dans des dossiers jetables.
  - **E2e** `roles-export` (clair et sombre, fr et `--lang en`) : captures `rx1-bouton`,
    `rx2-feuille-bob`, `rx3-installe-conflit`, `rx4-role-change`, `rx5-fille-mode-installe`,
    `rx6-feuille-opencode`, `rx7-modifie-a-la-main` (`-light` / `-dark`, `en-…`), regardées.
    `pnpm build && pnpm e2e roles-export roles-gestion --jobs 2` : 4/4 vertes, et 4/4 en
    `--lang en`. Avec les vrais `bob` et `opencode` dans le PATH, le menu les propose aussi
    (dossier personnel d'essai : rien d'écrit hors du bac à sable).


### Relecture de la phase 4 (2026-11-14)

- 2026-11-14 : **correctifs après la relecture tech lead** (branche `feat/223-export`) :
  1. **`feat/223-langues` fusionnée** (rôles fournis bilingues, ADR-0046) : conflits réglés en
     gardant les deux côtés (changelogs : « Nouveau » puis « Amélioré » ; index des ADR : 0046 puis
     0047 ; journal de la fiche : les deux sections). `exportedDescription` retiré : un rôle fourni
     arrive déjà dans la langue de l'interface, et c'est ce qui part dans l'agent
     (`export/ipc.test.ts`, fr puis en).
  2. **Textes de la feuille** : plus aucun outil nommé (« Bob Shell, Bob IDE », « d'OpenCode ») ni
     mode de Bob (« Agent, Plan, Ask ») dans les textes d'un format ; l'agent est toujours son
     libellé (« … parmi ses modes, sous le nom X, dans Bobine et hors de Bobine aussi », « Dans
     Bobine, lancer ce rôle dans ce mode / avec cet agent »).
  3. **Refus montré** : rattaché à la version enregistrée du rôle ; effacé à l'enregistrement et
     par une action réussie (e2e : plus de conflit à côté de « le rôle a changé depuis »).
  4. **En-tête de la page d'un rôle** : titre et sous-titre sur une ligne chacun (« … », chemin
     complet en infobulle), les actions passent dessous faute de place (e2e `rx8-entete-nom-long`,
     libellé de 39 caractères).
  5. **Installations sans rôle** : groupe en bas de Réglages › Rôles (canal
     `roles:exportOrphans`, `RoleExports.orphans`), chaque ligne avec « Retirer » (mêmes règles,
     confirmation si modifiée à la main) ; enregistrer un rôle installé sous un nouvel identifiant
     le dit (« Installé sous l'ancien identifiant … »).
  6. **Sonde de Bob** : les deux modes personnalisés sont écrits par l'adaptateur de Bobine
     (personnel en lecture seule `[read, mcp]`, projet `[read, edit, execute, mcp]`) ; nouvelle
     option `--only` (ces sondages ne lisent rien du vrai `~/.bob`, contrat non jugé sur une
     partie, pas de `--accept`). `pnpm bob-probe --only "modes personnalisés"` sur **Bob 2.1.0** :
     modes `agent`, `plan`, `ask`, puis `bobine-sonde-perso` (personnel) et `bobine-sonde-projet`
     (projet) ; `session/set_mode` → `{}` ; fichiers gardés tels quels ; réponses identiques aux
     attentes (aucune acceptation). Le passage complet n'a pas été relancé (il lit
     `licenseConsent` et le schéma de `bob.db` dans le vrai `~/.bob`).
  - Vérifications : `./scripts/verify` vert ; `pnpm build && pnpm e2e roles-export roles-gestion
    roles-travail --jobs 3` : 6/6, et 6/6 en `--lang en` ; captures regardées (`rx2-feuille-bob`,
    `rx4-role-change`, `rx8-entete-nom-long`, `rx9-sans-role`, `-light` / `-dark`, `en-…`).

### Essai réel de la phase 4, puis correctifs (2026-11-14)

- 2026-11-14 : **essai réel** (pilote, profil temporaire, installations pour le projet, dépôt
  d'essai jetable) :
  - **Bob 2.1.0** : `.bob/custom_modes.yaml` écrit en français ; la fille a démarré dans le mode
    installé « Code reviewer », a trouvé les deux bogues et a refusé de modifier quand on le lui a
    demandé — mais elle a **répondu en anglais** (la ligne « Reply in the language of the user's
    request. » ignorée).
  - **OpenCode** (modèle gratuit) : fille lancée avec l'agent `code-reviewer`, réponse en
    français, restée en lecture seule.
  - Suite e2e complète verte sur la branche (198/198) avant les correctifs ci-dessous.
  - **Défaut** : `@rôle` en tout premier message d'une conversation neuve refusé (« Écrivez
    d'abord dans cette conversation… »), le texte restant dans la saisie.
- 2026-11-14 : **correctifs** :
  1. **Langue nommée** : la dernière ligne du bloc `<bobine_role>` nomme la langue de l'interface
     (`roleLanguageLine` : « Reply in French, the language of the user's request. », « Reply in
     English, … ») ; texte en anglais (ADR-0014), seule la langue y est nommée ; sans langue
     connue, l'ancienne ligne. `splitRoleBrief` replie l'ancienne comme la nouvelle (fils
     d'avant). Les filles sans rôle n'avaient pas de ligne de langue : rien à changer.
  2. **`@rôle` en premier message** : la conversation neuve entre dans l'historique juste avant
     la première fille (`ConversationManager.keepDraft`, titre tiré de la demande, aucun message à
     son agent ; rien si aucun rôle ne part), puis les filles s'y rattachent comme d'habitude
     (carte dans le fil, « Sous-tâches », Équipe, une fille par rôle cité). `manager.ts` étant au
     plafond, le passage à l'historique est mis en commun (`enterHistory`) et la réouverture
     sortie dans `helpers.ts` (`reopenOf`). La saisie est vidée dès l'envoi et remise en cas
     d'échec (la conversation passe de l'accueil au fil, la saisie est remontée) ; « Lancement… »
     reste affiché pendant l'envoi. Le message « Écrivez d'abord… » de la ligne « Partira à… »
     est retiré. **Écart** : le message de l'utilisateur n'est pas ajouté au fil de la mère comme
     un message envoyé : comme pour une mère existante, c'est la carte de chaque fille qui montre
     la demande et son rôle.
  - Essais : `roles.test.ts` (langue nommée, ancienne ligne repliée), `invoke.test.ts` (brouillon
    gardé une fois, avant la première fille ; rien si aucun rôle ne part), `roles-children.test.ts`
    (agent factice : conversation neuve, fille rattachée, ligne « Reply in French »),
    `RoleComposer.test.tsx` ; e2e `roles-travail` : conversation neuve → `@security-expert
    @code-reviewer relisez calc.js` directement (capture `roles-travail-0-premier-message`).
  - Vérifications : `./scripts/verify` vert ; `pnpm build && pnpm e2e roles-travail roles-export
    roles-gestion --jobs 3` : 6/6, et 6/6 en `--lang en`.
