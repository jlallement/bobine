# 106 — Essais de bout en bout déterministes

- **Statut** : fait
- **Dépend de** : 002 (agent factice), 041 (suites e2e), 043 (décision « plus tard » :
  `settleNotifications`)
- **Agents** : agent factice seulement (rien ne change pour Bob ni OpenCode)

## Pourquoi

Les suites e2e échouent encore par intermittence : captures `e2e/captures/echec-*` du
2026-10-21 (« délai dépassé : document.querySelector(…) », « Cannot read properties of undefined
(reading 'inside') », « liste longue : curseur dans le champ de recherche »). Un échec
intermittent par jour rend la suite complète (≈ 6 min) inutile comme garde-fou avant push, et
c'est la première chose qu'un contributeur verra casser. C'est le chantier 5 de l'audit du
2026-10-21 (`docs/audit-maturite-2026-10-21.md`).

## Critères d'acceptation

- [x] Inventaire : chaque capture `echec-*` présente est rattachée à sa suite et à sa cause
      (attente sur un délai, ordre des notifications, état partagé entre suites, vraie régression).
      Noté dans le journal.
- [x] Fin de tour déterministe : l'app signale la fin d'un tour seulement quand toutes les
      notifications reçues avant la réponse de `session/prompt` sont appliquées
      (`settleNotifications` de la fiche 043, ou l'équivalent dans `AgentHost`), et les suites
      attendent cet état plutôt qu'un délai.
- [x] Les attentes `délai dépassé` de `e2e/lib.mjs` attendent une condition d'état (attribut
      `data-state`, `data-testid` posé en fin de rendu) et non un sélecteur qui peut apparaître
      avant que le composant soit prêt ; aucun `sleep` fixe ne subsiste hors des animations.
- [x] Les suites sont indépendantes : dossier de données et port propres à chaque suite, aucune
      suite ne dépend de l'ordre.
- [x] `pnpm e2e` lancé 5 fois de suite, en clair et en sombre : 0 échec. Résultat dans le journal.
- [x] Une suite qui échoue laisse, en plus de la capture, le journal du main et les 200 dernières
      lignes de la console du renderer (déjà partiel : vérifier, compléter).
- [x] `./scripts/verify` vert ; aucune vérification désactivée.

## Plan

Constat de l'inventaire (tableau dans le journal) : la première cause n'est ni une attente trop
courte ni l'ordre des notifications, mais **le focus de la machine**. Chaque app d'essai, en se
montrant (`win.show()`), devient l'application active de macOS ; les frappes de l'utilisateur qui
travaille à côté tombent dans sa zone de saisie (« 4/scenario questions », « e Bonjour »), et le
scénario demandé n'est pas joué. Reproduit : un passage sur cinq de `composer` + `questions`.

1. **L'app d'essai ne prend jamais le focus** — `src/main/window-state.ts` (`showRestored`) et
   `src/main/index.ts` : avec `BOBINE_SHOW_INACTIVE=1`, la fenêtre est montrée par
   `showInactive()` ; `e2e/lib.mjs` pose la variable et n'appelle plus `Page.bringToFront` (la
   page se croit active par `Emulation.setFocusEmulationEnabled`, ce qui suffit à la saisie CDP).
   Seul code touché hors `e2e/` ; rien dans `src/main/agent/`.
2. **Fin de tour** — `settleNotifications` existe déjà dans `AgentHost.prompt` (fiche 041) :
   après la réponse de `session/prompt`, trois tours de boucle d'évènements avant `turn-end`.
   Lecture du SDK (`jsonrpc.js`) : une notification est traitée dès réception par une chaîne de
   microtâches sans E/S ; la réponse résout la promesse du tour par une microtâche aussi. Un seul
   `setImmediate` vide donc tout ce qui a été reçu avant la réponse ; trois est une marge. Le
   `status: ready` part après `turn-end`, sur le même canal IPC, dans l'ordre ; le renderer réduit
   chaque évènement à l'arrivée (pas de regroupement différé). `ready()` est donc une condition
   d'état fiable : rien à changer, c'est documenté ici et vérifié par un test unitaire existant.
3. **Attentes** — `e2e/lib.mjs` : `ev` lève l'exception du renderer au lieu de renvoyer
   `undefined` (les « reading 'inside' » deviennent le vrai message) ; `ready()` vise le point
   d'état de l'agent dans la barre latérale (`.agent-avatar`), pas n'importe quel `.status-dot`
   (Réglages › Agents en affiche aussi) ; `send` vérifie que la zone de saisie contient exactement
   le texte avant Entrée, et le dit sinon. Suites : textes en dur (« Modification annulée »,
   « Réponse interrompue ») remplacés par `L()` ; attentes sur une condition d'état là où
   l'inventaire montre un sélecteur lu trop tôt.
4. **Indépendance** — ports libres choisis au lancement (essai de liaison), plus de tirage au
   sort : deux lancements en parallèle (sessions parallèles, `pnpm dev` ouvert) ne se parlent pas.
   Le dossier de données est déjà propre à chaque `withApp`.
5. **Sortie en cas d'échec** — en plus de la capture et du journal du main (sortie du process,
   déjà là) : les 200 dernières lignes de la console du renderer (`Runtime.consoleAPICalled`,
   `Runtime.exceptionThrown`, `Log.entryAdded`) dans le `.txt`.
6. **Preuve** — suites historiquement en échec relancées en boucle, puis `pnpm e2e` cinq fois.

## Journal

- 2026-10-21 — Fiche créée (audit de maturité, chantier 5).
- 2026-10-21 — **Inventaire** des captures `echec-*` présentes dans `e2e/captures/` (dépôt
  principal), rattachées à leur suite et à leur cause probable :

  | Date | Échec (capture) | Suite | Cause probable |
  |---|---|---|---|
  | 10-21 12:37 | `liste longue : curseur dans le champ de recherche`, `Cannot read … 'inside'` | composer | **Focus volé** : frappes parasites ; le menu s'est refermé (`ev` a avalé l'exception) |
  | 10-21 12:37 | `délai dépassé … [data-testid="questions"]` | questions | **Focus volé** : message « 4/scenario questions », scénario `demo` joué à la place |
  | 10-21 18:05 (en) | `délai dépassé … innerText.includes('Modification annulée')` ×2 | changes | Texte en dur en français, suite jouée en anglais → `L()` |
  | 10-20 21:00 | `délai dépassé … browser-download` ×2 | browser | Bandeau « Fichier enregistré » : nom choisi dans Enregistrer sous (corrigé fiche 094, `e8c0bbf`) ; à confirmer en boucle |
  | 10-20 19:35 | `querySelectorAll('.msg-user').length > 0` | ? (scénario demo) | **Plantage React** `removeChild` dans une infobulle de la barre de saisie ; non reproduit, à surveiller (console du renderer désormais capturée) |
  | 10-20 18:47 | `délai dépassé … querySelectorAll('button, span, div, p…')` (« Dossier non approuvé ») | bob | Texte attendu lu avant le rendu du panneau ; à confirmer en boucle |
  | 10-20 17:14 | `délai dépassé … .status-dot.ready` (« Bonjour », scénario demo, autorisation en attente) | composer (version du 10-20) | Suite réécrite depuis (fiche 092) ; même famille que le focus volé (scénario attendu non joué) |
  | 10-20 10:18 | `⌘K → ⌘F : recherche reprise … premier résultat surligné` ×2 | history | Surlignage `CSS.highlights` lu avant la fin du rendu → attente sur l'état |
  | 10-20 09:51 | `délai dépassé … [data-testid=change…` ×2 | changes | Après « Actualiser », la vue Git n'a pas encore les 3 fichiers → à confirmer en boucle |
  | 10-20 09:24 (en) | `Envoyer maintenant…`, `Échap arrête…` ×2 | queue | Texte en dur « Réponse interrompue » comparé en anglais → `L()` |
  | 10-19 22:04 | `« ajuster » : l'appareil retrouve sa taille` ×4 | android | Place du panneau changée par l'avis « flux interrompu » après la mesure → attente sur l'état |
  | 10-19 19:37 | `délai dépassé … [data-testid="document-…` ×3 | rules | Onglet Document ouvert sur `tests.md` au lieu de `style.md` ; textes comparés en dur (corrigé `d69ac7e`) |
  | 10-19 18:14 | `agrandi : la page native suit le panneau (0 / 1016)` ×2 | browser | Largeur de la vue native lue à 0 : vue pas encore visible → attente sur l'état |
  | 10-19 18:04 | `process principal injoignable (port 10562)` ×2 | panel | **Port** : `--inspect` sur `PORT + 1000` déjà pris (tirage au sort) → ports libres |
  | 10-19 17:43 | `ligne Battery…`, `reading 'fx'` | android (émulateur réel) | Essai réel hors e2e automatisé (dossier `bobine-reel-*`) ; hors périmètre |
  | 10-19 15:40 | `planche contact Android … (4 images)` ×2 | android | Nombre d'images de la planche dépendant du temps ; à confirmer en boucle |

  Reproduction avant correction : `pnpm e2e composer questions --dark` ×5 → 1 passage sur 5 en
  échec (3 échecs, tous avec « e » parasite dans la zone de saisie). Vérifié avec `lsappinfo` :
  l'app d'essai devient l'application active 1,5 s après son lancement, même sans
  `Page.bringToFront`.
- 2026-10-21 — **Corrections** (commits `bf5dfe6`, `e0fcdd2`) :
  - `BOBINE_SHOW_INACTIVE=1` → `showInactive()` (`src/main/window-state.ts`, `src/main/index.ts`,
    test unitaire) ; vérifié avec `lsappinfo` : l'application active ne change plus. Seul code
    touché hors `e2e/` et des tests ; rien dans `src/main/agent/`.
  - `e2e/lib.mjs` : `BOBINE_SHOW_INACTIVE` posé, plus de `Page.bringToFront` ; ports libres
    (essai de liaison, départ tiré au sort) ; `ev` lève l'exception de la page, `waitFor` dit la
    dernière en cas de délai dépassé ; `ready()` et l'attente initiale visent
    `.agent-avatar .status-dot` ; `send` vérifie le texte de la zone de saisie (sélection
    comprise : la suite `fun` remplace une suggestion) ; console du renderer (200 lignes :
    `Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Log.entryAdded`) dans le `.txt`.
  - Fin de tour : rien à changer dans `AgentHost` (analyse du SDK dans le plan) ; test unitaire
    « fin de tour déterministe (fiche 106) » : le dernier morceau précède `turn-end`, puis `ready`.
  - Suites : `changes` (« Modification annulée », « Modification N sur M »), `queue` (« Réponse
    interrompue »), `export` (« Conversation exportée », « Sauvegardé dans ») passent par `L()` ;
    `android` attend l'appel `adb` dans le journal du faux `adb` (`called`) au lieu de le lire tout
    de suite (paysage : 1 échec sur 3 passages), ce qui retire deux `sleep` fixes.
  - Boucle de reproduction après correction : les 16 suites historiquement en échec (`fun composer
    questions changes queue browser history android panel bob rules startup export notifications
    resume auth`) ×3, clair et sombre : 1 seul échec (`android`, paysage, corrigé ci-dessus).
- 2026-10-21 — **Preuve.** `android` ×5 (clair et sombre) : 5/5 ok. Puis `pnpm build && pnpm e2e`
  cinq fois de suite, chaque passage jouant les 49 suites en clair puis en sombre :

  | Passage | Résultat | Durée |
  |---|---|---|
  | 1 | ✓ 0 échec | 652 s |
  | 2 | ✓ 0 échec | 654 s |
  | 3 | ✓ 0 échec | 652 s |
  | 4 | ✓ 0 échec | 653 s |
  | 5 | ✓ 0 échec | 654 s |

  Pendant ces passages, l'utilisateur et trois sessions parallèles travaillaient sur la machine
  (charge moyenne 3 à 5) : aucune frappe parasite, aucun port disputé. La capture d'un échec
  (vue sur l'échec `android` du 10-21) contient bien les trois parties : texte de la fenêtre,
  console du renderer, journal du main.
  Écarts au plan : aucun `sleep` ajouté, aucun délai élargi, aucun test retiré. Les `sleep`
  restants des suites accompagnent un geste (glisser, appui long, molette), une infobulle ou une
  animation, pas une attente d'état. Le plantage React `removeChild` du 10-20 n'a pas été
  reproduit en 5 passages ; la console du renderer désormais capturée en dira plus s'il revient.
  Pas de ligne de changelog : rien ne change pour l'utilisateur.
- 2026-10-21 — **Premier plan.** L'utilisateur voyait les apps d'essai repasser devant pendant
  `pnpm e2e`. Relevé `lsappinfo` (application active toutes les 300 ms) sur six suites (68 s) :
  l'app d'essai devenait l'application active quatre fois, dans `notifications` (clic simulé sur
  une notification → `focusMainWindow` : `show()` + `focus()`) et `quick` (fenêtre rapide :
  `show()` + `focus()`). `BOBINE_SHOW_INACTIVE=1` vaut désormais pour toutes les façons de montrer
  une fenêtre : `revealWindow` (`src/main/window-state.ts`, test unitaire) remplace les
  `show()` + `focus()` de `focusMainWindow` (notification, menu, fenêtre rapide envoyée, seconde
  instance) et de la fenêtre rapide (`QuickEntryOptions.inactive` ; son `toggle` referme la
  fenêtre visible même sans focus). Relevé après correction sur `usage usage-bob settings
  notifications quick` (58 s) : l'application active n'a pas changé une seule fois.
- 2026-10-22 — Suite : fiche 115 (suites en parallèle). Les ports libres ne suffisaient plus
  entre processus d'essai : un port choisi au lancement n'est tenu que pendant que l'app tourne.
  Chaque job a désormais sa tranche de la plage (`BOBINE_E2E_JOB`), et les captures d'échec
  portent le nom de la suite (`echec-<suite>-NN-…`).
- 2026-10-22 — **Course dans `debogage-web`** (relevée par la fiche 115, machine chargée : cinq
  apps d'essai à la fois). Le scénario lisait le journal réseau juste après le chargement de la
  page, sans attendre la réponse de `fetch('/api')` : « GET … Fetch » sans statut, et la
  vérification « réseau : requête en échec 500 » de la suite `browser` échouait. Il relit
  désormais `browser_network` jusqu'au statut (`pollTool` + `networkPending`,
  `src/mock-agent/scenarios.mts` : pause de deux ticks entre deux lectures, 10 s au plus depuis la
  première ; une réponse qui n'est pas « en attente », outil absent compris, arrête l'attente).
  Tests unitaires dans `mock-agent.test.ts`. Pas de ligne de changelog.
