# 006 — Permissions et diffs

- **Statut** : fait
- **Dépend de** : 003

## Pourquoi

Aujourd'hui toute demande de permission est refusée automatiquement : un vrai agent ne peut rien
modifier. L'utilisateur doit pouvoir autoriser ou refuser chaque action sensible en voyant
précisément ce qui va changer.

## Critères d'acceptation

- [x] Une demande `session/request_permission` s'affiche dans la carte de l'outil concerné, avec un
      bouton par option proposée par l'agent (autoriser, toujours autoriser, refuser…).
- [x] La carte s'ouvre automatiquement tant que la permission est en attente, pour montrer le diff.
- [x] Après réponse, la carte indique le choix ; aucune réponse possible deux fois.
- [x] Stop pendant une demande en attente → la demande reçoit `cancelled` (exigé par ACP) et la carte
      l'indique ; idem si l'agent s'arrête.
- [x] Le main valide les réponses venant du renderer (demande connue, option proposée).
- [x] Diff ligne à ligne : ajouts / suppressions colorés, numéros de ligne, contexte de 3 lignes,
      lignes inchangées repliées ; nouveau fichier = tout en ajout.
- [x] Testé : réducteur, calcul du diff, `AgentHost` contre l'agent factice (autoriser, refuser,
      annuler pendant l'attente).
- [x] Essai réel avec Codex depuis l'app : demande affichée, réponse cliquée, effet constaté
      (voir journal : refus d'une écriture sur le Desktop, autorisation d'un accès réseau).

## Plan

**Partagé** :
- `agent.ts` — événements `permission-request` (`requestId`, `toolCall`, `options`) et
  `permission-resolved` (`requestId`, `optionId` ou `null` si annulée).
- `transcript.ts` — l'élément outil porte une `permission` (`pending` / choix / `cancelled`) ; une
  demande sur un outil inconnu crée l'outil ; fin de tour → permissions en attente annulées.
- `diff.ts` — `computeDiff(old, new)` : lignes avec numéros, regroupées en blocs avec 3 lignes de
  contexte et marqueurs « N lignes inchangées ». Dépendance : `diff` (jsdiff).

**Main** : `AgentHost` garde les demandes en attente (promesse par `requestId`), `respondPermission()`,
annulation de toutes les demandes sur Stop / arrêt / sortie. IPC `agent:respondPermission`.

**Renderer** : `ToolCall` affiche la barre de permission et `DiffView` ; carte ouverte tant qu'une
permission est en attente.

## Journal

- 2026-10-11 — Fiche créée.
- 2026-10-11 — Implémenté. 100 tests (réducteur, diff, `AgentHost` : autoriser, refuser, Stop et crash
  pendant l'attente, réponses invalides, pas de double réponse).
  - Essai de bout en bout dans l'app avec l'agent factice, 3 fois de suite : autoriser / refuser /
    Stop pendant l'attente, carte ouverte d'office, diff numéroté.
  - **Défauts trouvés par ces essais et corrigés** (chacun avec un test de non-régression) :
    1. un identifiant d'outil réutilisé dans un tour suivant réécrivait la carte d'un tour précédent
       → recherche d'outil limitée au tour en cours ;
    2. course : le SDK peut livrer la demande de permission **avant** le `tool_call` correspondant, qui
       écrasait alors la permission (carte « en attente » sans boutons, agent bloqué) → permission
       conservée ;
    3. cas réel Codex : la demande arrive avec le titre générique « Run command » qui remplaçait la
       commande exacte affichée sur la carte → le titre de la carte est conservé.
  - **Essais réels Codex** (quota autorisé par l'utilisateur) :
    - mode par défaut (`agent`, « Auto review ») : création de fichier, écriture dans `/tmp` et
      `curl` réseau exécutés **sans aucune demande au client** — Codex s'auto-approuve via sa relecture
      « Guardian Review » ; son bac à sable par défaut autorise aussi `/tmp`.
    - mode `read-only` (activé par script, l'UI ne sait pas encore changer de mode) : vraie demande
      `session/request_permission` reçue (options « Yes, proceed » / « Yes, and don't ask again… » /
      « No… », kinds `allow_once` / `allow_always` / `reject_once`), autorisée → fichier créé.
  - Choix des modes dans l'UI : nouvelle fiche 013.
- 2026-10-11 — Suite au constat de l'utilisateur (Codex a créé puis supprimé un fichier sur son Desktop
  sans rien demander) : **Codex est désormais ouvert en mode `workspace-write`** (champ `defaultModeId`
  du profil, appliqué par `session/set_mode` après `session/new` ; avis dans le fil si l'agent ne
  propose pas ce mode ou refuse). Choix de l'utilisateur, en attendant le sélecteur de la fiche 013.
  - Essai réel dans l'UI : écriture sur `~/Desktop` → demande affichée avec la commande exacte, clic
    « No… » → outil en échec, **fichier non créé** ; `curl` réseau → demande, clic « Yes, proceed » → 200.
  - À traiter plus tard : Codex joint la sortie des commandes en contenu `terminal` ACP, affiché pour
    l'instant comme « Terminal exec-… ».
- 2026-11-07 — 0.11, M1 (sécurité, recette avec le vrai Bob) : « Autoriser cette commande ? »
  ne montrait pas la commande (Bob la met dans le titre, la carte ne lisait que `content` et
  `locations`) ; la ligne la coupait sans infobulle ni dépliage ; le résumé `input.command` était
  ramené à une ligne de 200 caractères. Maquette validée par l'utilisateur
  (`side-session-notes/…/m1-autorisation/`). Fait :
  - le fil garde la commande entière de `rawInput.command` / `cmd` (tableau d'arguments joint),
    retours à la ligne compris, et son dossier (`cwd` / `workdir`) : `ToolItem.command`
    (`shared/command-view.ts`), au plus 1 Mio (au-delà : le début et la taille, dits par la carte) ;
    sinon la commande est le titre d'un outil `execute` (jamais pour du « Code Mode ») ;
  - `CommandBlock` dans la carte et dans le détail déplié : brute (sans le nettoyage de la fiche
    125), sans coloration ; seuls les opérateurs d'enchaînement hors guillemets sont marqués, avec
    un découpage prudent (rien au moindre doute : heredoc, `$( )`, backtick, `<( )`, `$'…'`,
    guillemets ou `${` non fermés ; ni `\;`, ni `2>&1`, `&>`, `>|`) ; dossier, « hors du dossier de
    la conversation » pour un chemin absolu hors de lui (comparaison de chemins normalisés, rien
    de deviné pour `~` ou un chemin relatif), « Copier » (toute la commande gardée) ; au-delà de 12
    lignes, défilement dans la carte (barre visible, ombre, « N lignes — faites défiler pour tout
    lire ») ; au-delà de 64 Kio, seul le début est affiché et la carte le dit ; aucun `autoFocus` ;
    carte étroite (900 px) : le bloc prend toute la largeur (requête de conteneur) ;
  - la ligne de l'outil : première ligne de la commande, la commande entière en infobulle ;
    dépliable après la décision (la commande, puis la sortie).
  Tests : `command-view.test.ts` (opérateurs, cas pièges, CRLF, Unicode, 100 Ko, source, dossier),
  `CommandBlock.test.tsx`, réducteur ; e2e `autorisation-commande` (scénarios `commande-bob`,
  `commande-courte`, `commande-tres-longue`, clair et sombre, 900 px) : texte entier, fin de la
  commande à l'écran avant d'accepter, pas de défilement horizontal, focus libre. `planOf` passe
  dans `tool-label.ts` (taille de `transcript.ts`). La recette refera l'essai avec le vrai Bob.
- 2026-11-07 — Relecture sécurité de M1 (à corriger avant fusion), faite :
  - caractères invisibles ou trompeurs rendus visibles dans la carte, la ligne repliée et
    l'infobulle : contrôles C0/C1, DEL, `\r` seul (␍), ESC (␛), marques et isolats bidi
    (U+202A–202E, U+2066–2069, U+200E/F, U+061C), zéro-largeur (U+200B–200D, U+2060, U+FEFF),
    espace insécable, trait d'union conditionnel, séparateurs U+2028/2029, remplissages hangul →
    ⟨U+XXXX⟩ ou image de contrôle, surlignés ; « contient des caractères invisibles » dans la
    barre ; `direction: ltr; unicode-bidi: isolate` sur le bloc ; « Copier » copie le brut ;
  - commande montrée = commande lancée : tableau d'arguments cité à la façon POSIX (`''` pour un
    argument vide, JSON pour ce qui n'est pas du texte), aucun opérateur marqué ; `command` +
    `args` / `arguments` affichés en entier ; `command` vide → `cmd` ; outil `execute` dont le
    titre ressemble à une commande et diffère de celle lancée : « Titre annoncé par l'agent : … » ;
  - au plus 2 000 lignes rendues (dit dans la même note que le plafond en caractères) ; infobulle
    au plus 4 Ko puis « … (ouvrir la ligne pour tout lire) » ; coupes par `safeCut` ;
  - `overscroll-behavior: contain` (e2e : la molette au bout du bloc ne fait pas défiler le fil,
    vérifié aussi qu'il échoue sans) ; anti-clic : un clic réel (`isTrusted`) sur un bouton de la
    carte n'est pris que 400 ms après son apparition et après le dernier défilement du fil
    (`useArmedCard`, attribut `data-armed` ; les e2e attendent la carte armée avant un clic
    réel) ;
  - accessibilité : `role="group"` nommé par « Commande », le dossier et les mentions ; le texte
    du bloc est lu (plus d'`aria-label` qui le masquait) ;
  - « hors du dossier » : un `cwd` relatif est pris depuis le dossier de la conversation ;
  - ligne repliée : première ligne de la commande entière (plus du résumé d'une ligne où `\r`
    devenait une espace), invisibles rendus visibles.
  Limites assumées : les **homoglyphes** (cyrillique « а » pour « a »…) ne sont pas signalés ;
  les **liens symboliques** ne sont pas résolus pour « hors du dossier » (pas de `realpath` côté
  main : la comparaison porte sur les chemins annoncés, normalisés) ; `~` et les variables ne sont
  jamais résolus, donc jamais signalés. Tests : `command-view.test.ts`, `CommandBlock.test.tsx`
  (dont l'anti-clic) ; e2e `autorisation-commande` avec `commande-piegee` et `commande-tableau`.
- 2026-11-07 — Seconde relecture de M1, faite :
  - caractères invisibles par **classes Unicode** (drapeau `u`) au lieu d'une liste de plages :
    tout Cc, Cf, Zl, Zp, Zs sauf l'espace ordinaire, Mn, Me, `\p{Variation_Selector}`, toute la
    plage des étiquettes U+E0000–E007F (U+E0000 n'est pas attribué), plus les remplissages hangul
    et le braille vide ; exceptions : tabulation, fin de ligne, `\r` d'un `\r\n`. Les espaces
    Unicode (U+2000–200A, U+202F, U+205F, U+3000, U+1680) qui font de `rm -rf` un seul mot pour
    le shell sont donc montrés. Conséquence assumée : une marque combinante (accent décomposé,
    voyelles de certaines écritures) est montrée ⟨U+XXXX⟩ ; un texte français ordinaire (accents
    précomposés, apostrophe typographique) ne l'est pas ;
  - anti-clic : jamais pour un clic au clavier (`detail === 0`) ni de script ; désarmé seulement
    par un défilement fait par l'utilisateur (molette, toucher, touches de défilement hors d'un
    bouton ou d'un champ), jamais par le fil qui suit le bas tout seul ; boutons visiblement
    inactifs tant que la carte n'est pas armée ;
  - titre annoncé : tout titre d'un outil `execute` qui diffère de la commande (espaces près),
    sauf une liste fermée de titres génériques (« Shell », « Run shell command », « Terminal »,
    « Exécuter une commande »…) ; « bash », « ls », « Git status » face à `curl x | sh` sont
    montrés.
- 2026-11-07 — Troisième relecture de M1 (faux positifs qui apprendraient à ignorer l'alerte),
  faite : repérage en contexte, sur la commande entière (`shared/invisible-chars.ts`) :
  - marque combinante après une lettre, deux au plus à la suite : du texte (français tapé sur
    macOS, en NFD ; devanagari, dont les marques ne se composent pas en NFC — d'où la règle « après
    une lettre » plutôt qu'un essai de composition NFC) ; montrées : marques isolées, piles de plus
    de deux (zalgo), marques de recouvrement U+0334–0338 et U+20D2, U+034F ;
  - U+FE0F après un pictogramme, U+200D entre deux pictogrammes (teintes comprises) : rien ;
  - espace insécable (U+00A0, U+202F) entre guillemets : signalée discrètement (soulignée en
    pointillé), sans « contient des caractères invisibles » ; hors guillemets ou guillemets non
    fermés : alerte, inchangée ;
  - U+1D159 ajouté (symbole qui se dessine comme du blanc) ; U+1D173–1D17A, de format, l'étaient
    déjà. Scénario `commande-texte` et e2e : texte ordinaire sans alerte.
- 2026-11-07 — Dernière relecture de M1 (règle : dans le doute, on alerte), faite :
  - une marque combinante après une lettre n'est du texte que si la suite se compose réellement
    en NFC (plus aucune marque une fois composée : « Résumé » en NFD), ou si la marque est de la
    même écriture que sa lettre (`\p{Script=…}` strict, liste fermée d'écritures à marques :
    devanagari, thaï, arabe…) sans être trompeuse (U+17B4, U+17B5, U+180B–180F) ; une marque
    « héritée » qui ne se compose pas (U+0332, U+20DD, U+20E5) ou d'une autre écriture (U+17B4
    après « a » : « /etc/pa◌sswd ») déclenche l'alerte. Conséquence assumée : une marque latine
    sans forme composée (« q » + point souscrit) aussi ;
  - l'insécable n'est discrète que si le découpage des guillemets est sûr : même doute que
    `commandParts` (`<<`, `$(`, backtick, `<(`, `$'`), commentaire `#` en début de mot jusqu'à la
    fin de la ligne ; sinon alerte. U+FE0F après © ou ® : laissé tel quel (marqué).
