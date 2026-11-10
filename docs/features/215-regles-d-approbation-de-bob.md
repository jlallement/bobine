# 215 — Règles d'approbation de Bob : pour tous les projets, comme Bob IDE

- **Statut** : en cours (main, IPC et interface faits ; reste la sonde réelle `pnpm bob-probe`)
- **Dépend de** : 213 (étape 0, plan 4.c), ADR-0044 (spécification)
- **Agents** : Bob seul — les règles vivent dans `~/.bob/settings/settings.json` (section
  `approval`), partagé avec Bob IDE et Bob Shell. Déclaré dans son profil (`approvalRules`,
  ADR-0011), listé dans Réglages › Agents (`approval-rules`) et dans la matrice de `docs/agents.md`.
  L'agent factice déclare le même format **seulement** avec `BOBINE_CONFIG_HOME` (dossier personnel
  d'essai) : avec `pnpm dev`, jamais le vrai `~/.bob`.

## Pourquoi

Pour remplacer Bob IDE au quotidien, il faut gérer depuis Bobine les règles qui valent pour tous
les projets (commandes autorisées ou refusées partout, groupes approuvés pour toutes les tâches,
accès hors du dossier), sans rouvrir Bob IDE. Cette fiche fait la partie main : lire et écrire ces
règles comme Bob IDE, sans jamais abîmer le fichier de l'utilisateur, et l'API que l'interface
(carte de commande « Pour tous les projets », Réglages › Agents › Bob › Approbations) utilisera
une fois ses maquettes validées.

## Critères d'acceptation

- [x] Lecture : groupes (`allowed_permissions`, `["read"]` quand la clé est absente, comme Bob),
      commandes autorisées et refusées (`allowedExecutors[toolId=execute_command]`, liste par
      défaut de Bob 2.0.9 quand la clé est absente, signalée), `outsideWorkspaceAllowed`,
      `permissionOptions[].enableOutsideWorkspace`, `forbiddenApprovalGroups` (lecture seule),
      `autoApprovalEnabled` (lecture seule).
- [x] Écriture sur action explicite seulement : autoriser / refuser / retirer une commande
      (ajouter à une liste la retire de l'autre, comme Bob IDE), activer / couper un groupe, accès
      hors du dossier (global et par groupe), « autoriser partout » qui ajoute le groupe `execute`
      la première fois et le dit dans sa réponse.
- [x] `allowedExecutors` absent : la liste par défaut de Bob est recopiée avant la première
      modification ; `allowed_permissions` absent : `read` recopié avant d'ajouter un groupe.
- [x] Seules les clés en cause changent : clés inconnues, ordre et mise en forme gardés
      (`jsonc-parser`) ; écriture atomique ; copie de sauvegarde (`settings.json.bobine.bak`)
      avant ; lien symbolique suivi (le fichier visé est réécrit, pas le lien) ; droits gardés.
- [x] `forbiddenApprovalGroups` jamais écrit ; un groupe interdit n'est jamais permis (erreur
      typée).
- [x] Fichier illisible, JSON invalide (commentaires compris) ou format inattendu : erreur typée,
      rien d'écrit ; fichier absent : seulement ce qu'il faut est créé.
- [x] Fichier modifié entre la lecture et l'écriture : relu juste avant d'écrire, modification
      refaite sur la nouvelle version (trois essais, puis erreur typée).
- [x] Préfixe normalisé (espaces) ; préfixe d'un seul mot signalé (avertissement de l'interface).
- [x] IPC typé (`approvalRules:get`, `approvalRules:change`), exposé dans le preload ; refusé en
      profil en lecture seule pour l'écriture.
- [x] `pnpm bob-probe` : contrôle du format (règles écrites comme Bobine les écrit, relues après
      un lancement de `bob acp` dans un HOME jetable). Partie pure testée ; **sonde réelle pas lancée** (à faire par l'utilisateur).
- [x] IPC exercé dans le vrai Electron avec le profil de l'agent factice, dossier personnel
      jetable (suite e2e `regles-approbation`, sans interface).
- [x] Carte de commande : « Pour tous les projets » replié en pied de carte (composant à part,
      `GlobalRuleSection`), seulement si le profil déclare des règles, si l'agent propose
      « Toujours » et jamais sur une carte à risque ni avec un fichier illisible ; commande entière
      proposée, commande enchaînée proposée partie par partie (`cd` vers le dossier ignoré) ;
      « Autoriser partout » écrit puis répond `allow_always` (choisi par genre), « Refuser
      partout » écrit puis refuse la carte ; encadré « première fois », avertissement d'un seul
      mot, erreurs typées dites (rien répondu) ; ligne de réponse « … autorisée pour tous les
      projets · Gérer ».
- [x] Réglages › Agents › <agent> › Approbations : groupes (interdit grisé avec sa raison), hors du
      dossier, listes éditables (ajouter, modifier, retirer avec confirmation, « Tout afficher »),
      liste par défaut signalée, note sur la vérification de sécurité de Bob IDE, fichier
      illisible : bandeau, ligne, « Ouvrir le fichier », « Relire ».
- [x] e2e clair et sombre contre l'agent factice (suite `regles-approbation`), CHANGELOG fr et en.
- [ ] Sonde réelle (`pnpm bob-probe`) lancée, puis `--accept` après relecture.

## Plan

Fichiers :
- `src/shared/approval-rules.ts` — types partagés (vue, changements, erreurs, groupes), liste par
  défaut de Bob, `normalizeCommandPrefix` (pur, utilisable par l'interface pour l'avertissement
  pendant la saisie), `parseApprovalRulesChange` (validation des arguments venus du renderer).
- `src/shared/approval-rules-ipc.ts` — contrat IPC à part (comme `memory-ipc.ts`).
- `src/main/agent-config/bob-approval-rules.ts` — lecture, validation du format, calcul des
  modifications (pur sur le texte), écriture sûre (relecture, sauvegarde, atomique).
- `src/main/agent-config/approval-rules.ts` — point d'extension (interfaces) ;
  `approval-rules-settings.ts` — un lecteur par profil qui déclare le format, et les canaux IPC
  (comme `mcp-settings.ts` / `mcp-ipc.ts`).
- `e2e/suites/regles-approbation.mjs` — IPC dans le vrai Electron, sans interface.
- `src/main/agent/profiles.ts` (`approvalRules` sur Bob et l'agent factice, `approvalRules` dans
  `ProfileSummary`), `capabilities.ts` (`approval-rules`), `src/main/ipc.ts`, `src/main/index.ts`,
  `src/main/read-only-guard.ts`, `src/preload/api.ts`, `src/shared/ipc.ts`.
- `src/main/agent/bob-probe.ts` (contrôle pur) et `scripts/bob-probe.mts` (sondage).
- `fr.json` / `en.json`, `docs/agents.md`, `docs/acp.md`, `docs/architecture.md`.

Aucune nouvelle dépendance (`jsonc-parser` est déjà là, fiche 025).

Choix :
- JSON strict (pas de commentaires) : Bob écrit et relit du JSON simple ; un fichier qu'il ne lirait
  pas n'est pas réécrit.
- Sauvegarde sous un nom propre à Bobine (`settings.json.bobine.bak`), pour ne pas se mêler
  aux copies que Bob pourrait faire ; écrite depuis le texte relu (celui qu'on remplace).
- `autoApprovalEnabled` (effet de `false` non vérifié) lu seulement
  et rendu à l'interface, qui pourra le dire ; pas écrit (hors ADR-0044).

## Journal

- 2026-11-09 — Fiche ouverte (partie main / partagée / IPC ; l'interface attend les maquettes de
  la fiche 213). Défauts de `approval` repris des essais de la fiche 213 et de la
  documentation d'IBM : seul `read` permis, liste de 15 commandes (celle que Bob IDE recopie dans
  le fichier), Bob IDE recopie la liste puis ajoute ou retire, Bob ajoute
  `forbiddenApprovalGroups: []` au lancement quand la clé manque.
- 2026-11-09 — Partie main / partagée / IPC faite :
  - `shared/approval-rules.ts` (types, `BOB_DEFAULT_ALLOWED_COMMANDS`, `normalizeCommandPrefix`,
    `parseApprovalRulesChange`), `shared/approval-rules-ipc.ts` ;
  - point d'extension `agent-config/approval-rules.ts` (`ApprovalRulesSource.open`, imposé par
    la règle ESLint des modules d'agent), Bob dans `bob-approval-rules.ts`,
    `approval-rules-settings.ts` (profils et canaux) ; `approvalRules` sur les profils Bob et
    agent factice, `approvalRules: true` dans `ProfileSummary` (l'interface saura s'il faut
    proposer « partout ») ; repère `approval-rules` dans Réglages › Agents (`fileItems`, sorti de
    `specificItems` pour la complexité) ;
  - `pnpm bob-probe` : un sondage (`règles d’approbation : settings.json après lancement`) et
    son contrôle, « non vérifié » tant que les attentes ne le contiennent pas. Sonde réelle **pas
    lancée**. (Un second sondage, retiré le 2026-11-10 avec la fiche 216 : la sonde n'observe
    que le comportement de Bob.)
  - Écarts au plan : « autoriser partout » quand `execute` est interdit ajoute la commande sans
    permettre le groupe et le dit (`executeGroup: 'forbidden'`) plutôt que de tout refuser ;
    `addCommand` (Réglages) ne touche pas aux groupes, seul `allowCommandEverywhere` (carte) ajoute
    `execute`.
  - Reste à faire : interface (après maquettes) ; couper la fonction si `bob-probe` signale un
    format changé (ADR-0044, conséquences) ; la sonde réelle.
- 2026-11-09 — Relecture tech lead : profil de l'agent factice sans `approvalRules` hors d'un
  dossier personnel d'essai (`pnpm dev` aurait pu écrire le vrai `~/.bob`), test à l'appui.
- 2026-11-09 — Interface, d'après les maquettes validées (215-7, 215-8 et leurs décisions) :
  - `thread/GlobalRuleSection.tsx` (section et ligne de réponse), `thread/global-rules.ts`
    (contexte fourni par `App.tsx` quand l'agent de la conversation déclare des règles ; règles
    écrites depuis une carte gardées en mémoire pour la ligne de réponse), deux points
    d'insertion seulement dans `ToolCall.tsx` (fiche 214 en parallèle) ;
    `settings/ApprovalRulesPage.tsx`, sous-page de la page d'agent (`AgentSubPage`, demandée de
    l'extérieur par `AgentPageRequest` : « Gérer », « Voir la liste »), entrée dans `AgentPage` ;
    `approval-rules.css` ; `commandParts` (partagé) découpe sur `&&`, `||`, `;`, `|`, retour à la
    ligne hors guillemets, et rend la commande entière au moindre doute (`$( )`, accents graves,
    parenthèses, guillemet non fermé) ;
  - main : canal `approvalRules:open` (« Ouvrir le fichier », désigné par le profil, jamais par un
    chemin du renderer), ligne de l'erreur JSON (`line`) ;
  - captures regardées (clair et sombre) : `e2e/captures/215-a…j-*.png`.
  - Écarts : « Aussi hors du dossier » d'un groupe active aussi `outsideWorkspaceAllowed` (sans
    lui, Bob bloque tout outil hors du dossier : l'option seule ne servirait à rien) ; le couper
    ne touche pas à l'interrupteur global. Textes mentionnant Bob dans l'interface : seul format
    déclaré aujourd'hui (`bob-settings`), à rendre propres au format si un autre agent en déclare
    un. `autoApprovalEnabled: false` est dit en haut de la page (lu seulement).
  - Reste à faire : `pnpm bob-probe` réel puis `--accept` ; essai avec le vrai Bob (une commande
    autorisée partout passe sans carte dans une nouvelle conversation et dans Bob IDE).
- 2026-11-09 — Relecture tech lead de l'interface :
  - `commandCoverage` (partagé, testé) : même règle que celle documentée par IBM et vue sur Bob 2.0.9 — une règle couvre la
    commande si ses mots en sont les premiers, la plus longue gagne, égalité = autorisée. Sur la
    carte, une partie déjà couverte (liste par défaut comprise : `wc -l gros.txt` par `wc`) est
    montrée « déjà autorisée partout » ou « refusée partout », ni cochable ni écrite ; une
    commande entièrement couverte n'a pas de section, seulement « … : déjà autorisée partout ·
    Gérer ». Nouveau scénario `commande-lint` (absente des listes par défaut).
  - « Aussi hors du dossier » : l'effet sur `outsideWorkspaceAllowed` est dit sous l'option tant
    que le global est éteint ; options éteintes et global resté allumé : dit dans la carte des
    groupes, avec « Ne plus l'autoriser ». Tests et captures `215-k`, `215-l`, `215-m`.
- 2026-11-09 — Recette QA avec le vrai Bob (branche `integration-213` ; Bob s'est mis à jour seul
  en **2.1.0** pendant la recette, tout a été vu sur 2.1.0). Corrections :
  - `commandParts` respecte les guillemets et l'échappement : `git add -A && git commit -m
    "feat(x): …"` donne deux parties ; seule une construction ambiguë hors guillemets (`$( )`,
    accents graves, sous-shell, `<( )`, `>( )`, guillemet non fermé) rend la commande entière.
  - Réglages › Approbations : un seul mot ajouté (ou modifié) aux autorisées montre le même
    avertissement que la carte et demande « Autoriser quand même » ; rien pour les refusées.
  - Textes : les **listes de commandes valent tout de suite**, même dans une conversation
    ouverte ; les **groupes**, à la conversation suivante (observé en recette sur 2.1.0). Carte, page, CHANGELOG, `docs/acp.md`
    corrigés. **Pas vérifié de nouveau sur le vrai `~/.bob`** : l'interdiction d'origine de
    toucher au vrai `~/.bob` tient tant que l'utilisateur ne l'a pas levée lui-même.
  - Contournement par les outils de Bobine : quand le profil déclare des règles, les outils de
    l'app qui lancent une commande (terminal, serveurs, compilations : `approveCommand`)
    refusent sans question ni lancement une commande dont une partie est refusée partout
    (`deniedPart`, même `commandCoverage`), avec un message à l'agent et un avis dans le fil.
    Générique : `deniedCommandOf` (profil + dossier personnel) → `AgentHostOptions.deniedCommand`
    → `ToolContext.deniedCommand`. Scénario `terminal-refusee-partout`.
  - Exemples de l'avertissement « un seul mot » sans points de suspension, code en chasse fixe.
  - `bob-probe` : attentes Bob 2.1.0 reprises de la sortie relue de la sonde lancée en recette
    (`qa-213/bob-probe.txt` : seuls écarts, `is_unread` et les deux sondages d'approbation) ;
    **la sonde n'a pas été relancée** (l'utilisateur s'était réservé de la lancer). 2.1.0 ajouté
    aux versions vérifiées.
  - e2e `regles-approbation` : cas de la recette (commit à parenthèses, un seul mot dans les
    Réglages, terminal refusé, libellé de réponse, note unique) ; captures `215-n`, `215-o`,
    `215-p` et `215-b`, `215-d` refaites.
