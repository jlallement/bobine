# 188 — Premier lancement soigné

- **Statut** : fait (2026-11-07, nuit), accepté par le tech lead — essai réel de Bob à faire
  (détection seulement)
- **Maquette** : `side-session-notes/…/nuit-0-10/premier-lancement/` (01-parcours, 02-erreurs,
  03-fenetre-etroite), validée sous réserve par l'expert UX le 2026-11-07
  (`VERDICT-expert-ux.md`, 20 corrections appliquées au code)
- **Dépend de** : 148 (profil neuf, `--profil-temporaire`), 186 (aide intégrée)
- **Agents** : les deux. L'accueil propose les agents trouvés sur la machine, sans rien de propre à
  l'un d'eux dans l'interface (ADR-0011). Ce qui diffère (connexion, clé) vient du profil d'agent.

## Pourquoi

C'est la première impression d'une V1 qu'on donne à d'autres (feuille de route V1, choix de
l'utilisateur le 2026-11-06). Aujourd'hui, une personne qui ouvre Bobine pour la première fois
doit deviner beaucoup de choses :
- quel agent installer ;
- comment le connecter ;
- s'il répond ;
- par quoi commencer.

Le premier lancement doit la mener en moins de deux minutes à une première réponse d'agent, avec
la même finition que le reste de l'app.

## Critères d'acceptation (à préciser au plan, maquette par l'audit d'interface)

- [x] Accueil court, quelques étapes au plus, passable à tout moment, jamais remontré une fois
      fini (ordre retenu après le verdict UX : Agent → Connexion → Dossier → Essai) :
  1. choisir un agent parmi ceux trouvés, ou apprendre comment en installer un ;
  2. le connecter : étape de connexion de l'agent, par exemple `opencode auth login`, ou clé
     dans le trousseau ;
  3. choisir un dossier ;
  4. vérifier qu'il répond, par un essai court au coût affiché — dans un dossier jetable de l'app,
     jamais dans le dossier choisi (décision du tech lead, voir le journal).
- [x] Erreurs claires à chaque étape : agent absent, connexion expirée (D10 de la fiche 183),
      réseau coupé, délai dépassé, plantage, annulé.
- [x] Première conversation : suggestions de départ adaptées au dossier (commande des tests selon
      le fichier de verrouillage) ; liens vers l'aide (« Premiers pas », « Autorisations », ⌘?).
- [x] Clair et sombre, fr et en, clavier seul, fenêtre étroite, animations sobres qui respectent
      « Réduire les animations ».
- [x] Essais :
  - e2e `onboarding` avec l'agent factice (dossier de données neuf et `BOBINE_ONBOARDING=1` : le
    harnais ne lance pas `--profil-temporaire`) ; essai réel avec `--profil-temporaire` ;
  - cas « aucun agent installé » ;
  - cas « connexion expirée ».

## Plan

Lu avant : `docs/architecture.md`, ADR-0011 et ADR-0028 (rien de propre à un agent hors du profil),
fiches 148 (profil neuf), 183 D10 (connexion expirée, corrigée par `agent/turn-auth.ts`), 186 (aide).

### Principe

Quatre étapes au plus, **dans une seule page de la zone principale** (pas une fenêtre de plus),
chacune passable (« Passer »), l'ensemble aussi (« Passer l'accueil ») ; finie ou passée, la marque
est posée et l'accueil ne revient plus. Tout ce qui sait déjà faire existe : on l'appelle, on ne le
refait pas.

| Étape | Ce qui existe et sert tel quel | Ce qui est nouveau |
|---|---|---|
| 1. Agent | `summarizeProfiles` (`available`, `reason` = commande introuvable + `installHint` du profil) ; agents personnalisés (fiche 141) | liste « trouvés / à installer », rien d'autre |
| 2. Connexion | `sessionBlocker` (méthodes annoncées à `initialize`, `terminalSteps` du profil, clé d'API) ; terminal de l'app ; `ApiKeyStore` | essai « connecté ? » : `initialize` + `session/new`, **sans appel au modèle** |
| 3. Répond ? | `turnAuthBlocker` (connexion expirée au message, D10), `classifyTurnFailure` (réseau, débit), `usage_update` (coût), `spawnAgent`/`killTree` | essai « répond ? » : un message court, délai borné, annulable, coût affiché si l'agent le donne |
| 4. Dossier | carte « dossier à choisir » (fiche 093), dialogue, dossiers récents | suggestions de départ (après maquette) |

### Côté main (cette nuit, invisible)

1. **`src/main/agent/session-list.ts`** : `withAgent` (agent lancé pour l'occasion, initialisé, arrêté
   quoi qu'il arrive) devient réutilisable : gestionnaires de notifications et de demandes en plus,
   signal d'annulation. Rien ne change pour `session/list` et `session/delete`.
2. **`src/main/onboarding/agent-readiness.ts`** (nouveau) : `checkAgent({ profile, cwd, level:
   'connect' | 'reply', credentials, apiKey, signal, timeouts })` → un état parmi `ready`
   (`reply` : texte, coût s'il est annoncé, jetons, durée), `missing`, `auth` (carte de la fiche 022,
   aussi au message : D10), `license`, `trust`, `network`, `timeout`, `crashed` (code, fin de la
   sortie d'erreur), `failed`, `cancelled`. Garanties : délai de chaque étape borné ; annulation =
   `session/cancel` puis arrêt du groupe de processus ; processus **toujours** arrêté
   (`finally`), session d'essai supprimée si l'agent sait le faire (`session/delete`) ; demande
   d'autorisation d'un outil refusée (l'essai ne fait rien dans le dossier) ; texte de réponse
   tronqué. Le message envoyé est en anglais (il va à l'agent, ADR-0014). Aucun nom d'agent.
3. **`src/main/onboarding/onboarding-state.ts`** (nouveau, pur) : `onboarding` dans `settings.json`
   (`{ outcome: 'finished' | 'skipped', at, version }`), écrit une fois, jamais effacé (seul
   « Réinitialiser Bobine » le fait, en mettant le dossier de données à la corbeille).
   `onboardingDue()` : l'accueil ne se montre **que** si aucune marque, aucune conversation, aucun
   dossier récent, aucun agent choisi, et un `settings.json` absent (un fichier abîmé mis de côté
   ne vaut pas une première fois : une personne qui a déjà utilisé Bobine ne revoit jamais
   l'accueil, y compris en passant de la 0.9 à la 0.10). Essais (dossier de données imposé) :
   jamais, sauf `BOBINE_ONBOARDING=1` ; `--profil-temporaire` : oui (« comme neuve », fiche 148).
4. **`src/main/settings.ts`** : champ `onboarding` lu et vérifié.
5. **Agent factice** : scénario `premier-essai` (réponse d'un mot, coût annoncé) ; les autres cas
   existent déjà : `connexion-terminal` (connexion à faire), `connexion-expiree` (refus au
   message), `lent` + délai court (délai dépassé, annulation), `--demarrage-lent`,
   `reseau-instable`, `plantage` ; « absent » = commande introuvable.
6. **Tests** : `agent-readiness.test.ts` contre l'agent factice en vrai sous-processus (chaque état,
   processus mort après chaque cas, session supprimée) ; `onboarding-state.test.ts` ;
   `settings.test.ts`.

### Après validation des maquettes (fait la même nuit, voir le journal)

7. IPC `onboarding:*` (état, agents, essai, annulation, fin) dans un module à part (`index.ts` est
   déjà au-delà du plafond) ; page `components/onboarding/` ; textes fr et en ; clavier seul,
   900 px, « Réduire les animations ».
8. Première conversation : suggestions de départ d'après le dossier (dépôt git, `package.json`…),
   liens vers l'aide (fiche 186).
9. e2e `onboarding` (nouvelle suite, `--profil-temporaire` + agent factice) : parcours complet,
   aucun agent installé, connexion expirée ; captures clair et sombre, fr et en.
10. Docs : `architecture.md`, `docs/mock-agent.md`, CHANGELOG fr et en, index.

Pas de nouvelle dépendance. Pas d'ADR prévu : la marque et l'essai vivent dans le main, comme le
reste (ADR-0002, ADR-0011).

### Questions pour l'utilisateur (avec les maquettes)

- Ordre : l'essai « répond ? » tourne dans un dossier neutre de Bobine, avant le choix du dossier.
  Un agent qui demande d'approuver chaque dossier (Bob) ne le refusera-t-il pas ? Alternative :
  choisir le dossier avant l'essai (3 ↔ 4).
- L'essai coûte un vrai message (gratuit avec les modèles gratuits d'OpenCode, quelques bobcoins
  chez Bob ?) : bouton explicite « Envoyer un message d'essai », jamais lancé tout seul — à
  confirmer.

## Journal

- 2026-11-06 — Fiche ouverte : retenue pour la V1 par l'utilisateur.

### 2026-11-07 — plan, main invisible, maquettes (nuit, sans l'utilisateur)

- **Fait** (étapes 1 à 6 du plan) :
  - `agent/short-lived-agent.ts` : `withAgent` sorti de `session-list.ts`, avec gestionnaires de
    l'agent (`setup`), annulation (`signal` → `AgentCancelled`), mort typée (`AgentExited` : code,
    signal) et fin de la sortie d'erreur ; `race` rejette maintenant une `AgentTimeout` (même
    message). `session-list.ts` inchangé sinon.
  - `onboarding/agent-readiness.ts` : `checkAgent` (voir le plan). Délais : 30 s au démarrage,
    30 s à `session/new`, 90 s à la réponse, 5 s à la suppression. Une connexion fermée par la mort
    de l'agent est attendue 300 ms pour dire « plantage » plutôt que « réseau ». Un tour fini
    `cancelled` sans annulation de l'utilisateur (outil demandé, refusé par l'essai) compte comme
    une réponse s'il y a du texte.
  - `onboarding/onboarding-state.ts` + champ `onboarding` de `settings.json` : marque `pending`
    posée au premier lancement (l'accueil reprend après un « Quitter » en cours de route),
    `finished` / `skipped` jamais défaites.
  - Agent factice : scénario `premier-essai`.
- **Tests** : `agent-readiness.test.ts` (16 cas contre l'agent factice en vrai sous-processus :
  répond avec coût et jetons, connecté sans message, absent sans rien lancer, connexion à faire
  avec l'étape du profil, connexion faite, connexion expirée au message, dossier à approuver,
  réseau, plantage avec sortie d'erreur, démarrage lent, agent figé, annulé pendant et avant, outil
  refusé ; chaque fois : processus arrêté, session d'essai supprimée), `onboarding-state.test.ts`,
  `settings.test.ts`.
- **Essai réel** (HOME et `XDG_*` jetables, comme « Agents comme sur un Mac neuf », jamais le
  profil de l'utilisateur ; par un test vitest non commité appelant `checkAgent` — l'interface
  n'existe pas encore, donc pas par `--profil-temporaire`) :
  - détection : `bob` et `opencode` trouvés dans le PATH ;
  - OpenCode **2.2.5** (hors `testedVersions` : 1.19, 2.0.31, 2.0.32), sans aucune configuration :
    `connect` prêt en 0,6 s ; `reply` « OK » en 1,3 s, coût annoncé **0 $** (`usage_update`), 3 699
    jetons envoyés, 3 reçus — le modèle par défaut d'un OpenCode neuf est donc gratuit et sans
    connexion ; même chose avec `opencode/big-pickle` imposé ;
  - annulation : `cancelled` ; le processus est encore là juste après le retour (délai de grâce
    du SIGTERM, fiche 138), plus là 4 s après ;
  - IBM Bob : détection seulement (`bob --version` → 2.0.9), aucune requête.
- **Maquettes** (non validées) : `side-session-notes/…/nuit-0-10/premier-lancement/` —
  `01-parcours` (chaque étape), `02-erreurs` (chaque erreur), `03-fenetre-etroite` (900 px),
  HTML + PNG, Fjord clair et sombre, en français, jetons réels.
- **Non fait** (attend les maquettes) : étapes 7 à 10 du plan (IPC, interface, e2e, CHANGELOG).
  Rien de visible n'a changé : pas de ligne de CHANGELOG.
- **Écart** : textes « modèles gratuits / choisissez OpenCode Zen » et « brew install opencode »
  des maquettes à tirer du profil (nouveau champ d'aide à la connexion, `installHint` existant)
  — à valider avec la maquette.

### 2026-11-07 — verdict UX appliqué, interface, e2e, essai réel de bout en bout

- **Verdict** (expert UX, `VERDICT-expert-ux.md`) : validé sous réserve, 20 corrections, appliquées :
  ordre Agent → Connexion → Dossier → Essai (l'essai finit l'accueil, « Commencer ») ; pas
  d'écran propre à Bob (refus de dossier : le panneau générique) ; Échap annule une attente, ne
  passe jamais une étape ; étapes faites cliquables pour revenir ; « Passer cette étape »
  seulement à la Connexion (agent pas prêt) et à l'Essai ; « {agent} est prêt » au lieu de
  « Connecté » ; contenu ancré en haut, fondu de 150 ms coupé par « Réduire les animations » ;
  focus sur le bouton principal de chaque état, carte en `aria-live`, focus par le
  `:focus-visible` de l'app ; détails techniques repliés ; dossier d'essai `essai`, `essai-2`… ;
  suggestions qui remplissent la saisie sans l'envoyer ; aucun nouveau champ de profil.
- **Exigences du tech lead** : outil demandé pendant l'essai → refusé, tour annulé
  (`session/cancel`), scénario `premier-essai-outil` ; session d'essai supprimée chez l'agent, ou,
  s'il ne sait pas le faire, essai dans un dossier jetable supprimé ensuite (« Reprendre une
  session » écarte les dossiers disparus) ; aucun processus laissé (test unitaire et e2e : un
  agent de plus pendant l'essai, autant qu'avant après l'annulation) ; dossier d'essai créé
  atomiquement, jamais dans un dossier non vide.
- **Fait** :
  - main : `onboarding/onboarding.ts` (essais liés à la conversation de l'accueil : son dossier,
    son terminal ; étape de connexion = commande du profil seulement), `trial-folder.ts`
    (dossier d'essai, commande des tests), canaux `onboarding:*` (`state`, `check`, `cancel`,
    `finish`, `runStep`, `trialFolder`, `hints`), `BOBINE_TRIAL_DIR` (essais) ;
  - renderer : `components/onboarding/` (`useOnboarding`, `Onboarding`, `OnboardingParts`),
    `onboarding.css` ; la carte de connexion est celle des conversations (`BlockerPanel`, fiche
    022), ses actions passant par l'essai ; page d'accueil sortie d'`App.tsx` dans
    `components/Welcome.tsx` (plafond de lignes d'`App.tsx`), qui montre l'accueil à sa place.
- **Tests** : unitaires main (46 dans `src/main/onboarding/`), renderer (`Onboarding.test.tsx` :
  présélection, Échap, passer, sortie par la barre latérale, aucun agent) ; e2e `onboarding`
  (nouvelle suite, 27 vérifications par thème) en fr et en, clair et sombre : parcours complet et
  relance sans accueil, aucun agent, connexion à faire dans le terminal à 900 px terminal ouvert,
  connexion expirée à l'essai, annulation par Échap (agent arrêté, rien écrit), plantage. Captures
  regardées : `e2e/captures/188-*`, `en-188-*`, copiées dans le dossier de notes
  (`captures-e2e/`, avant : `captures-avant/`).
- **Essai réel de bout en bout** (app construite, `--profil-temporaire --agents-neufs`,
  `BOBINE_TRIAL_DIR` jetable, pilotée par CDP) : agents trouvés IBM Bob et OpenCode ; OpenCode
  2.2.5 prêt en 3,1 s ; dossier d'essai créé ; « OK » en 3,4 s, **0,00 $**, 3 685 jetons envoyés,
  3 reçus, modèle « opencode/Big Pickle » ; accueil fini en 11 s (clics immédiats) ; aucun
  processus `opencode acp` restant 4 s après la fermeture. Captures : `captures-reelles/`.
  Bob : aucune requête (détection seulement).
- **Écarts** :
  - liens vers l'aide de la première conversation : pas faits, la fiche 186 n'est pas sur `main`
    (à brancher à sa fusion : « Premiers pas », « Autorisations ») ;
  - pied de la barre latérale : il montre l'agent de la conversation de l'accueil avec son statut
    habituel (« Action requise »), pas « Accueil en cours » ; sans agent trouvé, le profil par
    défaut (IBM Bob) ;
  - pas de « Faire confiance à ce dossier » pendant l'essai (l'essai ne relance jamais l'agent avec
    `--trust`) : le panneau propose le terminal et « Réessayer » ;
  - textes des cartes de connexion, de licence et de dossier : ceux des conversations (fiche 022),
    réutilisés tels quels plutôt que ceux des maquettes ;
  - la vérification dans le terminal de l'e2e garde le vrai shell (celui des essais sans agent ne
    lance aucune commande) et choisit l'agent factice elle-même.
- **Suite e2e complète** (`--changed` joue tout : `App.tsx` est partagé ; `--jobs 2`) : 159 tâches
  sur 167 vertes ; les 8 rouges (`quick`, `base`, `composer`, `bob`, `restart` : « fenêtre de l'app
  absente ») tombaient pendant la panne d'Electron de la machine (alerte macOS de restauration
  après plantage, corrigée par la session mère), rejouées seules : vertes. Un premier passage
  avait été arrêté par le `pkill` d'une autre session.
- **Non vérifié** : Bob réel (SSO, refus de dossier, coût de l'essai en bobcoins) ; lecteur
  d'écran (VoiceOver).

### 2026-11-07 — relecture du tech lead (bloquant), corrections

- **Décision** : l'essai « répond ? » tourne **toujours** dans un dossier jetable vide créé sous le
  dossier de données de l'app (`onboarding-trials/essai-*`), supprimé après ; l'agent est lancé
  dans le dossier réservé de l'app (`workspace/`), où tourne aussi la commande de connexion. Jamais
  le projet de l'utilisateur : un agent réglé pour tout approuver n'y ferait rien, et l'historique
  d'un vrai dossier ne reçoit jamais de session d'essai. L'ordre de l'expert reste (Dossier puis
  Essai) ; la première vraie conversation s'ouvre dans le dossier choisi.
- **Corrigé, chacun testé** :
  1. `session/delete` partait sur une promesse déjà rejetée après une annulation : la suppression a
     maintenant son propre délai, après la fin (bornée) du tour annulé — sans quoi l'agent factice
     réenregistrait sa session après la suppression. Vaut pour annulation, délai dépassé, outil
     refusé, « connecté ? » annulé, `session/new` arrivé en retard. Sessions d'essai notées avant le
     message (`onboarding/trial-sessions.ts`, `userData/onboarding-sessions.json`, écriture
     atomique), masquées de « Reprendre une session » (`hiddenSessions` du gestionnaire,
     `agent-outside.ts`), suppression retentée 8 s après le lancement suivant.
  2. Fermeture : `shutdown` et la fermeture ou le rechargement de la fenêtre principale arrêtent
     l'agent de l'essai sur-le-champ (`Onboarding.stop`, arrêt du groupe de processus).
  3. Dossier d'essai : parent qui n'est pas un lien et dont le chemin réel reste sous le dossier
     personnel, toujours un dossier neuf (`essai`, `essai-2`…), jamais un existant ni un lien ;
     chemin montré fourni par le main (`OnboardingState.trialFolder`).
  4. Méthode de connexion : seulement une méthode annoncée par l'agent (refus mémorisé par
     `Onboarding`, vérifié de nouveau après `initialize`).
- **Tests ajoutés** : magasin de l'agent factice vide après annulation, délai, outil refusé,
  « connecté ? » annulé ; branche « autoriser » jamais jouée ; session masquée après une
  suppression ratée, relance comprise ; suppression retentée ; arrêt immédiat ; plantage en plein
  tour → processus arrêté ; liens et hors du dossier personnel refusés ; `settings.json` avec
  seulement `window` → pas d'accueil ; méthode inconnue refusée. e2e : fenêtre fermée pendant
  l'essai → son agent arrêté ; Cmd+Q pendant l'essai → aucun agent restant (comptés par le dossier
  de données de l'app, jamais ceux des autres suites).
- **Contre-épreuve** : sans `Onboarding.stop` à la fermeture de la fenêtre, l'e2e « fenêtre fermée »
  échoue ; l'e2e « Cmd+Q » reste vert même sans les deux arrêts, parce que l'agent factice s'arrête
  de lui-même quand son entrée se ferme : c'est le test unitaire « arrêt immédiat » qui couvre un
  agent qui ne le ferait pas.
- **Vérifié** : `./scripts/verify` vert ; e2e `onboarding`, `connexion-expiree`, `auth`, `resume`,
  `startup`, `quick` en clair et sombre, `onboarding` aussi en anglais ; essai réel de bout en bout
  rejoué (`--profil-temporaire --agents-neufs`, OpenCode 2.2.5) : prêt en 1,9 s, « OK » en 3,2 s,
  0,00 $, accueil fini en 8 s ; quatre agents `opencode acp` lancés par l'app, aucun 4 s après la
  fermeture (suivis par leur dossier personnel dans le profil temporaire ; un `opencode acp` d'une
  autre session vu au premier passage n'était pas le nôtre). Rien créé dans `~` (dossiers d'essai
  sous `BOBINE_TRIAL_DIR` jetable).

### 2026-11-07 — seconde relecture du tech lead (non bloquante), derniers points

1. Agent sans `session/delete` : la session d'essai n'est plus notée (son dossier jetable disparaît,
   elle est déjà écartée). Au lancement suivant, suppression session par session
   (`deleteEachSession` de `session-list.ts`) : faite ou introuvable (`-32002`, agent qui ne sait
   pas supprimer) → oubliée ; ratée → retentée, 3 fois au plus (`TrialSessions.failed`).
2. Dossier jetable supprimé **après** l'arrêt de l'agent (dans `checkAgent`, après `withAgent`),
   sans jamais lever (`onboarding/scratch.ts` : `maxRetries`, échec noté au journal) ; restes de
   `userData/onboarding-trials` vidés au démarrage.
3. Pas de suppression retentée pendant un essai.
4. Rechargement de la fenêtre : `did-start-navigation` du cadre principal seulement (et pas une
   navigation dans le même document).
5. `loggedInAt` de l'agent factice documenté dans `docs/mock-agent.md`.
6. Test unitaire de `Onboarding.stop()` (arrêt appelé une fois, essai annulé, plus rien en cours).

Tests : 71 unitaires (`src/main/onboarding`, `session-list`, interface), stables sur trois passages ;
`./scripts/verify` vert ; e2e `onboarding`, `connexion-expiree`, `auth`, `resume`, `startup`,
`quick` en clair et sombre.

### 2026-11-07 — fusion de `claude/integration-0-10-0-11` (aide 186, astuces 191, GitLab 189)

- Fusion (pas de rebase) : conflits dans `App.tsx` (bloc `<main>` réindenté par l'aide : version
  intégrée reprise, page d'accueil remplacée par `<Welcome>`), `settings-store.ts`, i18n fr/en
  (ajouts de cette branche réappliqués sur la version intégrée), CHANGELOG fr/en (une seule
  section « Nouveau »), index des fiches.
- Astuces : leur « premier jour » est celui de l'accueil quand il a eu lieu (`tipsSince` lit la
  marque `onboarding`), sinon le jour retenu par le main.
- Première conversation : liens vers l'aide maintenant que la fiche 186 est là (sujets
  `gettingStarted` et `permissions` de `help-topics.ts`).
- Mineurs : dossier de données pas inscriptible → essai en échec dit, pas une exception ; une
  session n'est oubliée que sur `-32002` ou un message qui parle de session introuvable
  (`sessionNotFound`), pas sur un « not found » quelconque.
- Vérifié : `./scripts/verify` vert ; e2e `aide`, `astuces`, `onboarding`, `gitlab`, `startup`,
  `connexion-expiree`, `resume`, `quick`, `base`, `composer` en clair et sombre, `onboarding` en
  anglais.

### 2026-11-08 — coût de l'essai pour un agent qui ne le donne pas par ACP (recette 0.10, D10)

- **Constat** (recette réelle avec Bob) : le coût de l'essai « répond ? » n'était pas affiché pour
  Bob, qui ne le donne pas par ACP mais l'écrit dans sa base locale (`costSource` du profil) ; et
  la suppression de la session d'essai efface sa ligne de coût dans `bob.db` : le coût disparaissait
  aussi du suivi de consommation.
- **Correction** (branche `claude/fix-0-11-essai`, rien de propre à Bob) :
  - après la réponse, le coût est lu comme pour une conversation : celui annoncé par ACP, sinon la
    source du profil, attendue 3 s au plus (l'agent l'écrit juste après sa réponse), **avant** la
    suppression de la session ; affiché sur l'écran de succès (champ « Coût » déjà maquetté) ;
  - le tour d'essai, quelle qu'en soit l'issue (réponse, annulation, délai, erreur), est rapporté
    (`onTrialTurn`) et écrit dans le journal de consommation (`recordUsage` → `usage.sqlite`),
    rattaché à la conversation de l'accueil : il compte dans « Mon activité » ; une écriture
    refusée n'interrompt pas l'essai ;
  - agent factice : comme Bob, `session/delete` efface la tâche de `--bob-db`, coût compris.
- **Tests** : unitaires « comme Bob » (coût lu, rapporté, ligne absente de la base après la
  suppression : il fallait la lire avant), « comme OpenCode » (coût par ACP), annulé (tour
  rapporté), « connecté ? » (aucun tour), ligne du journal et journal qui refuse l'écriture ; e2e
  `onboarding` : « Coût 0,0125 Bobcoins » à l'écran, la ligne dans `usage.sqlite`, plus aucune tâche
  dans la base de l'agent.
- **Non vérifié** : avec le vrai Bob (la recette le dira : délai réel d'écriture du coût par Bob).
