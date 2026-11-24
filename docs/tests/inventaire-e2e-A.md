# Inventaire des e2e — groupe A (étape 1 de la pyramide remise à l'endroit)

Inventaire en lecture seule, du 2026-11-24 : rien n'est supprimé ni modifié. Chaque vérification
(`check(…)`, assertion nommée, `waitFor` qui porte un contrat) des 42 suites du groupe A a sa
ligne, avec sa classe, son remplaçant proposé et ce qui la couvre déjà (recherche par `grep` dans
`src/**/*.test.*` et `e2e/suites/parcours-*.mjs` ; les tests cités ont été vérifiés par
sondage ; les fichiers marqués « à créer » n'existent pas encore).

Classes : `parcours` (reste e2e) · `composant` (Vitest + Testing Library, sans l'app) ·
`unitaire-main` · `capture` (capture nocturne) · `doublon` (déjà vérifié ailleurs).

## Résumé chiffré

- **42 suites, 643 vérifications.**
- Par classe : **parcours 143** (22 %) · **composant 169** (26 %) · **unitaire-main 43** (7 %) ·
  **capture 37** (6 %) · **doublon 251** (39 %).
- **Déjà entièrement couvertes ailleurs : ≈ 294** (plus ≈ 130 couvertes en partie). Les lots ne
  comptent pas tout à fait de la même façon : les lots 1, 5 et 6 mettent les partielles à part.
  Pour les lots 3 et 4, le chiffre peut en inclure quelques-unes.

| Suite | N | parcours / composant / unit.-main / capture / doublon | Couvertes ailleurs | Verdict |
|---|---|---|---|---|
| about | 10 | 3 / 2 / 0 / 0 / 5 | 5 (+5 part.) | garder, réduite |
| aide | 15 | 5 / 5 / 1 / 0 / 4 | 4 (+9 part.) | garder, réduite |
| aparte | 12 | 1 / 4 / 0 / 1 / 6 | 6 (+4 part.) | disparaît (concurrence → parcours-matinee ét. 8) |
| aurore | 11 | 0 / 0 / 0 / 10 / 1 | 1 (+8 part.) | disparaît, si la capture nocturne garde des assertions de style calculé |
| base | 18 | 0 / 11 / 2 / 2 / 3 | 3 | disparaît (tests de composant d'abord à créer) |
| browser-annotate | 26 | 8 / 5 / 4 / 1 / 8 | 22 | garder, réduite |
| certificats | 24 | 11 / 5 / 2 / 0 / 6 | 16 | garder, réduite |
| command | 14 | 2 / 8 / 0 / 0 / 4 | 3 (+8 part.) | garder, réduite |
| commit-redige | 15 | 1 / 0 / 0 / 0 / 14 | 14 | disparaît (« Committer puis fusionner » → parcours-deleguer ét. 4) |
| cout-connexion | 6 | 1 / 2 / 0 / 0 / 3 | 3 | disparaît |
| degrade-haut | 28 | 27 / 1 / 0 / 0 / 0 | 0 | garder, réduite |
| dossiers | 8 | 1 / 1 / 0 / 0 / 6 | 8 | disparaît (si `additionalDirectories` devient une étape de journée) |
| fil | 17 | 0 / 6 / 0 / 0 / 11 | 11 (+4 part.) | disparaît |
| filles-tech-lead | 11 | 2 / 1 / 0 / 0 / 8 | 8 (+3 part.) | disparaît (vérif. 7–8 → parcours-deleguer ét. 3–4) |
| finitions | 10 | 1 / 2 / 0 / 5 / 2 | 2 (+5 part.) | disparaît (clic d'onglet au cran serré → parcours-longue ét. 5) |
| git | 19 | 1 / 8 / 2 / 4 / 4 | 6 | disparaît (point de branche → parcours-matinee ét. 5) |
| historique-saisie | 23 | 4 / 4 / 1 / 0 / 14 | 15 | garder, réduite |
| language | 8 | 2 / 1 / 3 / 0 / 2 | 2 | garder, réduite |
| limite-etapes | 7 | 1 / 2 / 0 / 0 / 4 | 7 | disparaît (réouverture → parcours-pannes) |
| mcp | 37 | 5 / 13 / 8 / 2 / 9 | 13 | garder, réduite |
| mermaid | 7 | 2 / 1 / 0 / 1 / 3 | 3 | disparaît (bloc Mermaid → parcours-longue ét. 1) |
| nouvelle-version | 13 | 1 / 1 / 0 / 1 / 10 | 10 (+2 part.) | garder, réduite |
| outils-projet | 8 | 1 / 1 / 0 / 0 / 6 | 6 (+2 part.) | disparaît (redémarrage jusqu'à `ios_build` → parcours-outils) |
| parallel | 5 | 2 / 1 / 0 / 0 / 2 | 2 (+2 part.) | disparaît (2 vérif. → parcours-matinee ét. 8, parcours-outils ét. 4) |
| parcours-matinee | 17 | 17 / 0 / 0 / 0 / 0 | 0 (13 part.) | **journée type, garder** |
| parcours-reglages | 11 | 11 / 0 / 0 / 0 / 0 | 0 (6 part.) | **journée type, garder** |
| permissions | 12 | 0 / 3 / 1 / 0 / 8 | 8 (+4 part.) | disparaît |
| plan | 11 | 0 / 4 / 1 / 4 / 2 | 2 (+6 part.) | garder, réduite |
| pr-ci-sans-ci | 4 | 1 / 3 / 0 / 0 / 0 | 0 | disparaît (après création de `PrCard.test.tsx`) |
| profil | 42 | 10 / 12 / 3 / 0 / 17 | 17 (+13 part.) | garder, réduite |
| queue | 9 | 0 / 2 / 1 / 0 / 6 | 6 (+2 part.) | disparaît |
| regles-approbation | 31 | 1 / 10 / 2 / 0 / 18 | 20 | disparaît |
| repere | 8 | 1 / 0 / 0 / 2 / 5 | 5 (+2 part.) | disparaît (1 vérif. → parcours-reglages ét. 10) |
| restart | 5 | 2 / 1 / 0 / 0 / 2 | 3 | disparaît |
| roles-gestion | 23 | 3 / 6 / 2 / 0 / 12 | 21 | disparaît (nouvelle étape de parcours-reglages + `TeamSection.test.tsx`) |
| rules | 3 | 0 / 2 / 0 / 0 / 1 | 1 (+2 part.) | disparaît |
| settings | 43 | 3 / 22 / 3 / 2 / 13 | 16 (+17 part.) | garder, réduite (seul le menu ☰ Linux reste e2e) |
| startup | 11 | 4 / 2 / 1 / 0 / 4 | 4 (+5 part.) | garder, réduite |
| terminal | 18 | 5 / 5 / 0 / 1 / 7 | 7 | disparaît (5 vérif. → parcours-outils ét. 1–2) |
| travail-recette | 9 | 0 / 1 / 1 / 0 / 7 | 7 (+2 part.) | disparaît |
| usage | 15 | 1 / 5 / 0 / 0 / 9 | 9 (+4 part.) | disparaît (rejeu tardif → parcours-longue ét. 8) |
| worktree-cycle | 19 | 2 / 6 / 5 / 1 / 5 | 9 | garder, réduite |

- **Suites qui peuvent disparaître entièrement : 25.** Presque toutes **sous condition** :
  déplacer d'abord 1 à 5 vérifications `parcours` dans une journée type, ou créer les tests de
  composant manquants. Ce sont : aparte, aurore, base, commit-redige, cout-connexion,
  dossiers, fil, filles-tech-lead, finitions, git, limite-etapes, mermaid, outils-projet,
  parallel, permissions, pr-ci-sans-ci, queue, regles-approbation, repere, restart,
  roles-gestion, rules, terminal, travail-recette, usage.
- **Suites à garder, réduites à leurs vérifications `parcours` : 15.** about, aide,
  browser-annotate, certificats, command, degrade-haut, historique-saisie, language, mcp,
  nouvelle-version, plan, profil, settings, startup, worktree-cycle.
- **Suites à garder telles quelles : 2.** parcours-matinee, parcours-reglages.

### Préalables avant toute suppression

1. **Tests de composant à créer** (aujourd'hui absents) : `BrowserTab.test.tsx`,
   `PageAnnotator.test.tsx`, `TeamSection.test.tsx`, `PrCard.test.tsx`, `WorkspaceMenu.test.tsx`,
   `EditorRow.test.tsx`, Welcome, menu des agents, menu du titre (renommer / supprimer), puce de
   branche, Réglages › Données (orphelins), Réglages › Confidentialité (commandes retenues,
   certificats). Compléments à `MermaidBlock`, `WorkCard`, `Transcript`, `page-layer`.
   Côté main : `renderer-windows.test.ts` (`setWindowOpenHandler`), `settings-effects.ts`
   (diffusion, menu natif), `profile-startup.ts`.
2. **Étapes à ajouter aux journées types** (voir la colonne « Remplaçant ») : parcours-matinee
   ét. 5 (point de branche après un tour), ét. 8 (aparté et concurrence, envoi depuis le volet
   d'à côté) ; parcours-deleguer ét. 3–4 (travail hors de la carte, « Committer puis
   fusionner ») ; parcours-outils (copier, ⌃` quand xterm a le clavier, redémarrage de l'agent
   pour `ios_build`, worktree depuis le menu du dossier) ; parcours-longue ét. 1 (Mermaid), ét. 4
   (saisie étroite mesurée), ét. 5 (onglet au cran serré), ét. 8 (rejeu tardif) ;
   parcours-pannes (« Rouvrir la session » après la limite d'étapes) ; parcours-reglages
   (rôle de projet créé puis essayé, repère d'un rôle délégué). Aucune journée ne couvre
   aujourd'hui la consommation gardée après un redémarrage (`restart` n° 2).
3. **La capture nocturne doit affirmer, pas seulement photographier** : 37 vérifications partent
   en `capture` (dont aurore en entier, plan, finitions). Sans assertions de style calculé ou
   quelqu'un qui regarde chaque matin, elles ne protègent plus rien.
4. **Défauts ouverts de parcours-deleguer** (fiche 277, défauts 1 et 2) : plusieurs « doublons »
   de `profil` reposent sur ses étapes 6–10, rouges aujourd'hui. Ne pas supprimer avant leur
   correction.

### Risques (ce qu'un test de composant ne verrait pas)

- **Mise en page réelle** : jsdom ne calcule ni boîtes, ni défilement, ni `scroll-timeline`, ni
  hit-test. `degrade-haut` entier, les fondus du fil, la barre du plan qui saute sous le pointeur,
  un ✕ invisible qui prend le clic (finitions 8), les débordements à 720 / 900 px, la saisie
  étroite : garder une mesure dans une journée, ou une capture qui affirme.
- **Câblage preload → IPC → main** : les tests de composant simulent `window.api`. Un canal mal
  branché (« Modifier » de la file, menu → effet, éditeur choisi → boutons du fil,
  `changes:gitChanged` vers deux composants, écriture de fichiers MCP / règles) ne se voit plus
  qu'en journée type.
- **Processus réels** : agent relancé (`tools/list` après redémarrage, limite d'étapes,
  `additionalDirectories`), seconde instance (`requestSingleInstanceLock`), arrêt de l'agent de
  rédaction pendant son démarrage (fiche 250 : à vérifier dans le test du main avant de supprimer
  commit-redige), course de retrait d'une permission (issue Linux n° 16).
- **Navigateur intégré et sécurité** : `WebContentsView`, vraie vérification de certificats par
  Chromium, isolement de session, IP contactée pour `.test`, valeur d'un champ de page jamais
  envoyée, en-têtes ajoutés par la pile réseau d'Electron (aucune donnée personnelle vers
  GitHub). Ces vérifications restent e2e.
- **Fenêtres natives** : position et écran disparu, fenêtre d'aide non modale, À propos unique et
  attachée, menu ☰ Linux et accélérateurs sans barre, `confirm()` natif absent, focus réel.
- **Profil sur disque** : vieux profils réels, restauration appliquée au lancement, lecture seule
  sur tous les écrivains (y compris hors IPC), vrai disque plein (`ENOSPC`, macOS seulement).
- **xterm.js réel** : clavier, sélection à la souris, police Nerd Font, largeur des glyphes.
- **Vérifications creuses repérées** : `regles-approbation` n° 31 (`check(true)`), `usage` n° 7
  (sélecteurs qui n'existent plus : passe toujours), un `check(true)` hors macOS dans `profil`.
  Les supprimer, ne rien porter.
- **Captures perdues** si les suites disparaissent (`156-*`, `246-*`, `aide-*`, `158-*`…) : à
  reprendre dans la capture nocturne si on veut encore les regarder.

---

## Lot 1

Suites : `profil.mjs`, `settings.mjs`, `rules.mjs`, `parallel.mjs`, `repere.mjs`, `queue.mjs`.
Comptes : « déjà couvertes ailleurs » = entièrement couvertes (citées) ; les partielles sont
comptées à part entre parenthèses. Les noms de tests cités ont été retrouvés par grep dans le
worktree `inventaire-e2e` (2026-11-24).

### `queue.mjs` — écrire pendant que l'agent travaille : file d'attente, « Modifier », « Envoyer maintenant », Échap (fiche 020, 247)
Verdict : **disparaît entièrement** — le parcours bout en bout est dans `parcours-matinee` (étapes 9-10) ; le reste se teste en composant ou est déjà dans `agent-host.test.ts`.
Compte : 9 vérifications — parcours 0, composant 2, unitaire-main 1, capture 0, doublon 6 ; déjà couvertes ailleurs : 6 (+2 partielles)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | accueil : l'invite demande quoi faire | invite `composer.placeholder.new` sur une conversation neuve | composant | `src/renderer/src/components/composer/Composer.test.tsx` (nouvel `it`) | non (seules les invites reply/busy/plan y sont) |
| 2 | pendant la réponse : invite « ajouter une suite » | invite `placeholder.busy` quand l'agent répond | doublon | — | `Composer.test.tsx › mode Plan pendant une réponse : l’invite de la réponse en cours reste prioritaire` |
| 3 | Entrée pendant la réponse : mis en file, la réponse continue | messages en file, pas de nouvelle bulle, Stop toujours là | doublon | — | `parcours-matinee` étape 9 (« retour : le tour continue, la suite attend dans la file ») ; `agent-host.test.ts › messages écrits pendant la réponse : envoyés ensemble à la fin du tour` |
| 4 | « Modifier » remet le message dans la saisie | le message quitte la file et revient dans la zone de saisie | composant | `QueuedMessages.test.tsx` + `Composer.test.tsx` (clic `queued-edit` → valeur de saisie) | partiel : `agent-host.test.ts › unqueue rend le message et le retire ; identifiant inconnu refusé` (côté main seul) |
| 5 | message modifié : il garde sa place | renvoyé après modification, il repasse devant le second | unitaire-main | garder `message-queue.test.ts` ; ajouter le lien renderer (« Modifier » renvoie avec la place) dans `Composer.test.tsx` | partiel : `message-queue.test.ts › un message modifié reprend sa place ; supprimé, non (fiche 247, D12)` (logique seule, pas le chemin renderer→IPC) |
| 6 | « Envoyer maintenant » : réponse interrompue, envoyés ensemble | tour annulé (avis « annulé »), file réunie en un message, file vide | doublon | — | `agent-host.test.ts › « Envoyer maintenant » : interrompt la réponse, ce message part en premier` |
| 7 | conversation : l'invite propose de répondre à l'agent nommé | `placeholder.reply` avec le nom de l'agent | doublon | — | `Composer.test.tsx › hors mode Plan : ni teinte, ni ligne de rappel, invite habituelle` |
| 8 | Échap arrête ; la file attend au lieu de partir seule | Stop par Échap, file gardée avec « interrompue » | doublon | — | `parcours-matinee` étape 10 (Stop, `queued.interrupted`) ; `composer-keys.test.ts › Échap arrête la réponse ; ↑ dans une zone vide reprend le dernier message en attente` ; `agent-host.test.ts › Stop : la file reste en attente, puis part à la demande` |
| 9 | message en attente envoyé à la demande | « Envoyer » après arrêt : file vidée, message parti | doublon | — | `parcours-matinee` étape 10 (« tour arrêté : la suite part à la demande, l’agent y répond ») |

### `rules.mjs` — règles actives (projet, personnelles, du mode) listées dans « Réglages de la session », ouvertes en aperçu (fiche 056)
Verdict : **disparaît entièrement** — la lecture des règles est testée côté main, l'affichage se teste en composant ; seul le « menu qui saute de côté » perd un peu de réalisme (voir risques).
Compte : 3 vérifications — parcours 0, composant 2, unitaire-main 0, capture 0, doublon 1 ; déjà couvertes ailleurs : 1 (+2 partielles)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | menu ouvert d'emblée à sa place (côtés relevés image par image) | le menu ne s'ouvre qu'une fois les règles lues, sans changer de côté (le relâché du clic ne choisit pas une ligne) | composant | `SessionSettingsMenu.test.tsx` (existant) + `menu-placement.test.ts` | partiel : `SessionSettingsMenu.test.tsx › s’affiche une fois les règles lues, à sa taille, pas avant (fiche 082)` ; `menu-placement.test.ts › opens above the composer when the whole menu fits there (conversation view)` — le positionnement Radix réel n'est pas vu |
| 2 | règles du projet, personnelles et du mode actif ; pas celles d'un autre mode | AGENTS.md en tête, `.bob/rules`, `~/.bob/rules-code` avec « Personnelle · code », pas `rules-plan` | composant | `SessionSettingsMenu.test.tsx` (libellés de portée `rules.scope.*`, `rules.scopeWithMode`) | partiel : `rules.test.ts › Bob : AGENTS.md du dossier, rules/ et rules-<mode>/ du projet, des greffons et de ~/.bob` ; `manager.test.ts › règles actives : selon le mode, lisibles en aperçu même hors du dossier ; rien d’autre (fiche 056)` (main) — libellés de portée affichés : non |
| 3 | règle personnelle (hors du dossier) ouverte en aperçu | clic sur une règle hors du dossier → aperçu Markdown | doublon | — | `manager.test.ts › règles actives : selon le mode, lisibles en aperçu même hors du dossier ; rien d’autre (fiche 056)` ; `useFileLinks.test.ts › une règle du dossier s’ouvre en aperçu` |

### `parallel.mjs` — conversations en parallèle : réponse qui continue ailleurs, conversation en worktree, côte à côte, suppression du worktree (fiche 036)
Verdict : **disparaît entièrement** — à condition de déplacer 2 vérifications dans des journées types (worktree par le menu du dossier, envoi côte à côte).
Compte : 5 vérifications — parcours 2, composant 1, unitaire-main 0, capture 0, doublon 2 ; déjà couvertes ailleurs : 2 (+2 partielles)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | la première conversation continue de répondre (indicateur) | tour long qui continue en arrière-plan, roue dans la barre latérale | doublon | — | `parcours-matinee` étape 8 (« la deuxième répond ; la première travaille encore (indicateur dans la barre latérale) ») |
| 2 | worktree : branche créée, dans l'infobulle, dépôt principal intact | « Nouvelle conversation dans un worktree » depuis le menu du dossier : vraie branche `bobine/…`, `data-branch`, infobulle, `git status` propre | parcours | `parcours-matinee` étape 8 (ouvrir la deuxième conversation dans un worktree) | partiel : `manager.test.ts › conversation dans un worktree : branche à part, suppression avec le worktree` ; `Sidebar.test.tsx › sous sa mère, son état à droite ; plus d’icône git (fiche 131)` (`data-branch`) — menu du dossier et infobulle : non |
| 3 | côte à côte : message envoyé à celle d'à côté, l'active ne change pas | saisie du volet d'à côté → envoi à la conversation non active, par l'IPC | parcours | `parcours-outils` étape 4 (ouvrir l'autre conversation à côté et lui écrire) | partiel : `useBeside.test.ts › ouverte : chargée à part, affichée avec son fil` (chargement seul, pas l'envoi) |
| 4 | (attente) case « supprimer le worktree » cochée d'office | rien à perdre → suppression du worktree proposée cochée | composant | `DeleteDialog.test.tsx` (nouvel `it`) | non (les tests existants n'ont que `removeWorktree: false`) |
| 5 | suppression : worktree et branche supprimés | dossier et branche `bobine/*` effacés avec la conversation | doublon | — | `manager.test.ts › conversation dans un worktree : branche à part, suppression avec le worktree` |

### `repere.mjs` — repère « ↑ … a répondu · Voir » en bas du fil quand un rôle délégué répond hors de l'écran (fiche 261)
Verdict : **disparaît entièrement** — logique et rendu déjà couverts par `WorkCue.test.tsx` / `work-cue.test.ts` ; une vérification à ajouter à `parcours-reglages` étape 10, deux mesures de mise en page à confier aux captures (voir risques).
Compte : 8 vérifications — parcours 1, composant 0, unitaire-main 0, capture 2, doublon 5 ; déjà couvertes ailleurs : 5 (+2 partielles)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | rôle au travail : pas de repère | rien tant que le rôle n'a pas répondu | doublon | — | `WorkCue.test.tsx › travail qui répond hors de l’écran : « ↑ Expert UX/UI a répondu · Voir », pas avant` |
| 2 | un rôle répond hors de l'écran : « ↑ Expert sécu a répondu · Voir », avec avatar | vrai tour de l'agent factice (verrou relâché) pendant qu'on relit le haut d'un vrai fil long | parcours | `parcours-reglages` étape 10 (remonter le fil avant que `@ux-ui-expert` réponde, vérifier le repère) | partiel : `WorkCue.test.tsx › travail qui répond hors de l’écran : « ↑ Expert UX/UI a répondu · Voir », pas avant` (défilement simulé) |
| 3 | « Voir » : carte à l'écran, entourée, focus ; plus de repère | défilement jusqu'à la carte, `data-cue-flash`, focus, anneau (box-shadow réel) | doublon | — (capture `261-repere-anneau` pour l'anneau CSS) | `WorkCue.test.tsx › « Voir » : défile jusqu’à la carte, l’entoure un instant, lui donne le focus, et le repère s’en va` |
| 4 | deux travaux : « ↑ 2 travaux ont répondu · Voir », sans avatar | compte, texte pluriel | doublon | — | `WorkCue.test.tsx › deux travaux : « ↑ 2 travaux ont répondu », « Voir » mène au plus ancien, puis l’autre reste` |
| 5 | « Voir » : le plus ancien montré, l'autre reste au repère | ordre de la file, compte qui passe à 1 | doublon | — | idem (même `it`) ; `work-cue.test.ts › plusieurs : dans l’ordre des réponses, le plus ancien d’abord, et le compte` |
| 6 | carte vue en défilant : le repère s'en va | vu au défilement = retiré | doublon | — | `WorkCue.test.tsx › la carte vue en défilant : le repère disparaît` |
| 7 | 900 px, nom long : nom coupé (titre en infobulle), verbe entier | ellipse réelle du nom, verbe jamais coupé (mesure CSS) | capture | capture nocturne `261-repere-900` | partiel : `WorkCue.test.tsx › le nom long seul se coupe, jamais le verbe : deux éléments` (structure, pas la mise en page réelle) |
| 8 | repère et « ↓ N nouveaux » ensemble : pastille à droite, sans couvrir | position réelle de la pastille par rapport au repère | capture | capture nocturne `261-repere-et-nouveaux` | non |

### `profil.mjs` — intégrité du profil : profils réels 0.7/0.8/0.9, profil abîmé, corbeille, restauration (au lancement, réversible), lecture seule d'un profil plus récent, disque plein réel (fiches 196, 197, 228)
Verdict : **à garder (réduite)** — garder les lancements que rien d'autre ne fait (vieux profils réels, restauration au lancement, lecture seule de bout en bout, disque plein réel) ; corbeille et avis passent en composant ou sont déjà couverts.
Compte : 42 vérifications — parcours 10, composant 12, unitaire-main 3, capture 0, doublon 17 ; déjà couvertes ailleurs : 17 (+13 partielles)

(Hors compte : `check(true, 'disque plein : image disque macOS seulement (ignoré ici)')` hors macOS, qui ne vérifie rien.)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | profil 0.7/0.8/0.9 : les trois conversations, épinglée et renommée (boucle ×3, clair seulement) | l'app neuve ouvre un vrai profil d'une ancienne version sans perte visible | parcours | garder ici | partiel : `profile-fixtures.test.ts › s’ouvre sans avis ni perte, reçoit sa marque de version` (main seul, pas le lancement réel) |
| 2 | profil N : aucun avis (boucle) | aucun avis de profil au lancement | doublon | — | `profile-fixtures.test.ts › s’ouvre sans avis ni perte, reçoit sa marque de version` |
| 3 | profil N : pas d'accueil du premier lancement (boucle) | un profil déjà utilisé n'a pas l'accueil | doublon | — | `onboarding.test.ts › settings.json avec seulement \`window\` (une 0.9 juste ouverte) : pas d’accueil` ; `onboarding.test.ts › dossier de données neuf : accueil dû ; réglages déjà là : non` |
| 4 | profil N : le fil se relit (boucle) | ouvrir la conversation épinglée affiche son fil | parcours | garder ici (même lancement que 1) | partiel : `profile-fixtures.test.ts › se réécrit sans rien perdre (réglages, index, fils)` |
| 5 | profil N : aucune marque d'accueil écrite (boucle) | `settings.onboarding` pas posé sur un vieux profil | unitaire-main | `onboarding.test.ts` (étendre au fichier écrit) | partiel : `onboarding.test.ts › settings.json avec seulement \`window\` (une 0.9 juste ouverte) : pas d’accueil` |
| 6 | profil N : marque de version posée, réglages gardés (boucle) | `formatVersion: 1`, thème et densité conservés | doublon | — | `profile-fixtures.test.ts › s’ouvre sans avis ni perte, reçoit sa marque de version` |
| 7 | trois avis, chacun à sa gravité | `data-level` warning,warning,info affiché | composant | `ProfileNotices.test.tsx` à créer | partiel : `profile-integrity.test.ts › chaque cas a sa gravité, sans chemin dans le texte ; fermés un par un` (main) |
| 8 | réglages mis de côté ; liste des conversations refaite | textes `profile.notice.settingsDamaged`, `indexRebuilt` (count 3) | composant | `ProfileNotices.test.tsx` à créer | partiel : `profile-integrity.test.ts › réglages du mauvais type ou illisibles : mis de côté et signalés` (main) |
| 9 | aucun nom de fichier dans les avis | pas de `.corrupt-` dans le texte | doublon | — | `profile-integrity.test.ts › chaque cas a sa gravité, sans chemin dans le texte ; fermés un par un` |
| 10 | les trois conversations retrouvées dans leurs fils | index perdu → liste reconstruite | doublon | — | `profile-fixtures.test.ts › index et copie perdus : les trois conversations reviennent de leurs fils (fiche 197)` |
| 11 | un avis se ferme par × | fermeture d'un avis dans l'interface | composant | `ProfileNotices.test.tsx` à créer | partiel : `profile-integrity.test.ts › chaque cas a sa gravité, sans chemin dans le texte ; fermés un par un` (main) |
| 12 | « Afficher dans le Finder » montre le fichier mis de côté | le bouton révèle `settings.json.corrupt-…` (journal d'ouverture) | unitaire-main | test du gestionnaire IPC de révélation (à créer, près de `profile-integrity.test.ts`) | non |
| 13 | réglages et autorisations abîmés gardés à côté, jamais effacés | fichiers `.corrupt-` présents sur le disque | doublon | — | `profile-integrity.test.ts › réglages du mauvais type ou illisibles : mis de côté et signalés` ; `profile-integrity.test.ts › autorisations : champs inconnus gardés ; abîmées : mises de côté et signalées` |
| 14 | index réécrit avec les trois conversations | `index.json` refait sur le disque | doublon | — | `store.test.ts › copie de l’enregistrement dans le fil ; index perdu : liste refaite (fiche 197)` |
| 15 | supprimer : « Mettre à la corbeille », case agent jamais cochée | libellé du bouton, `delete-from-agent` décochée | doublon | — | `DeleteDialog.test.tsx › « aussi chez l’agent » proposé seulement s’il sait le faire, jamais coché d’office` |
| 16 | la conversation est dans la corbeille de Réglages › Données | supprimée → ligne de corbeille | doublon | — | `parcours-deleguer` étape 7 ; `manager.test.ts › supprimer : à la corbeille avec son fil à jour, restaurée telle quelle (fiche 196)` |
| 17 | restaurée : de retour dans la liste, corbeille vide | « Restaurer » ramène la conversation | doublon | — | `parcours-deleguer` étape 7 (« restaurée : de retour dans la barre latérale ») |
| 18 | un dossier qui n'est pas une sauvegarde est refusé, en clair | `settings.data.restore.notBackup` affiché | composant | `ProfileData.test.tsx` (nouvel `it`) | partiel : `backup.test.ts › reconnaît une sauvegarde, une ancienne (sans description), refuse le reste` (main) |
| 19 | restauration : confirmation dans la carte (ce qui sera remplacé, clés à ressaisir) | textes `restore.confirmText` (3) et `restore.keys` | composant | `ProfileData.test.tsx` (nouvel `it`) | non |
| 20 | Échap ferme la confirmation, pas les réglages | Échap pris par la carte, le dialogue Réglages reste ouvert | composant | `ProfileData.test.tsx` rendu dans `SettingsDialog` (Radix imbriqué) | non |
| 21 | Échap : aucune restauration demandée | pas de `restauration-demandee.json` | composant | `ProfileData.test.tsx` (le rappel de confirmation n'est pas appelé) | non |
| 22 | effacée définitivement : plus rien sur le disque | « Effacer » confirmé dans la ligne → `.trash` vide | doublon | — | `trash.test.ts › purge après ${TRASH_DAYS} jours, effacement à la demande : plus rien sur le disque` |
| 23 | restaurée : le message part, l'agent répond, elle redevient prête (rc.4 T1) | une conversation restaurée se reprend | doublon | — | `parcours-deleguer` étape 8 (« mère restaurée : son fil, et l’agent répond ») ; `manager.test.ts › restaurée depuis la corbeille : sa vue et ses évènements passent après ceux d’avant (rc.4, T1)` |
| 24 | corbeille : la mère dit « avec son travail », elle seule | ligne `trash-children` sur la mère seule | doublon | — | `ProfileData.test.tsx › la mère dit les travaux supprimés avec elle, qui reviendront avec elle (recette rc.4, T7)` ; `trash.test.ts › la mère dit combien de travaux supprimés avec elle y sont encore (recette rc.4, T7)` |
| 25 | restaurer la mère ramène son travail | les deux reviennent, corbeille vide | doublon | — | `family-delete.test.ts › restaurer la mère restaure les filles supprimées avec elle, pas une supprimée avant (rc.4, T7)` ; `parcours-deleguer` étape 7 |
| 26 | restauration faite : avis de succès | une restauration demandée est faite au lancement, avis `success` | parcours | garder ici (lancement avec `restauration-demandee.json`) | partiel : `backup.test.ts › arrêt brutal une fois tout en place : la restauration est faite au lancement suivant` (`profile-startup.ts` sans test) |
| 27 | les conversations de la sauvegarde sont là | liste = celle de la sauvegarde 0.7 | parcours | garder ici (même lancement que 26) | partiel : `backup.test.ts › remplace le profil, garde l’état d’avant, qui se restaure à son tour (réversible)` |
| 28 | l'état d'avant est gardé dans restaurations/ | copie `avant-…` | doublon | — | `backup.test.ts › remplace le profil, garde l’état d’avant, qui se restaure à son tour (réversible)` |
| 29 | l'état d'avant se restaure : retour au profil 0.9 | réversible | doublon | — | idem |
| 30 | lecture seule : pas d'accueil | profil plus récent → pas d'accueil | doublon | — | `onboarding-state.test.ts › profil en lecture seule (fiche 196) : jamais, et aucune marque à écrire` |
| 31 | lecture seule : « Nouvelle conversation » désactivée | bouton désactivé | composant | `Sidebar.test.tsx` (nouvel `it`) | non |
| 32 | la saisie est inerte, la raison dessous | `composer-readonly` avec `[inert]` | composant | `Composer.test.tsx` (nouvel `it`) | non |
| 33 | les conversations se relisent (lecture seule) | les canaux de lecture restent permis | parcours | garder ici (même lancement que 34, 39) | partiel : `read-only-guard.test.ts › chaque canal déclaré est classé, une seule fois : sûr, ou il change le profil` |
| 34 | menus : épingler, renommer, archiver, supprimer désactivés (raison en infobulle) ; exporter permis | `data-disabled` + `title` = `profile.readOnly.line` | composant | `Sidebar.test.tsx` (menu ⋯ en lecture seule) | non |
| 35 | un envoi par l'IPC est refusé lui aussi | `window.api.agent.prompt` refusé par le main (garde réelle branchée) | parcours | garder ici | partiel : `read-only-guard.test.ts › en lecture seule, un canal hors de la liste sûre est refusé, même inconnu` ; `ipc-errors.test.ts › refus de la lecture seule (fiche 196) : dit dans la langue de l’interface, jamais brut` |
| 36 | Mon activité : la lecture seule est dite | `activity-readonly` au lieu d'une page vide | composant | `ActivityPage.test.tsx` (nouvel `it`) | non |
| 37 | Tâches planifiées : la lecture seule est dite | `scheduled-readonly` | composant | test du composant Tâches planifiées (à créer) | non |
| 38 | la tâche échue n'a rien lancé | planificateur pas démarré en lecture seule | unitaire-main | `scheduler-ipc.test.ts` à créer (`readOnly` → rien ne part) | non |
| 39 | rien n'a été écrit dans le profil (empreinte) | aucun écrivain de l'app (réglages, index, fils, marque, tâches, consommation) ne touche le profil | parcours | garder ici | partiel : `profile-integrity.test.ts › ouverture d’un profil plus récent : lecture seule, rien n’y est écrit (pas même la marque)` ; `profile-integrity.test.ts › profil en lecture seule : rien n’est écrit ni déplacé, sauf les fichiers exemptés` |
| 40 | disque plein : dit en clair par l'app, sans code d'erreur (macOS, clair) | vraie `ENOSPC` sur une image disque, avis `saveFailedDiskFull` sans « ENOSPC » | parcours | garder ici | partiel : `history-writer.test.ts › disque plein (fiche 197) : dit en clair, fil noté non enregistré, réessai en quittant` (erreur simulée) |
| 41 | aucun fichier temporaire laissé | pas de `.tmp` après échec réel | parcours | garder ici | partiel : `profile-integrity.test.ts › une écriture en échec ne laisse pas son fichier temporaire (synchrone et asynchrone)` |
| 42 | place libérée : les messages écrits pendant le disque plein sont sur le disque | réessai réel, rien de perdu | parcours | garder ici | partiel : `history-writer.test.ts › disque plein (fiche 197) : dit en clair, fil noté non enregistré, réessai en quittant` |

### `settings.mjs` — menus (macOS / Linux), raccourcis, ⌘K, largeur de la barre latérale, Réglages (apparence, confidentialité, notifications, conversations, agents, raccourcis, nouveautés, recherche), menu ☰ hors macOS (fiches 027, 051, 072, 101, 102, 113, 136, 145)
Verdict : **à garder (réduite)** — presque tout passe en composant ou est déjà couvert ; ne restent e2e que le menu ☰ Linux (barre native d'Electron, Alt, aller-retour par le main). Les cookies passent en unitaire-main.
Compte : 43 vérifications — parcours 3, composant 22, unitaire-main 3, capture 2, doublon 13 ; déjà couvertes ailleurs : 16 (+17 partielles)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | menus de la plateforme | macOS : « Bobine » en tête et Fenêtre ; Linux : Fichier…Aide | doublon | — | `menu.test.ts › menus, rôles, identifiants et raccourcis du Mac, à l’identique` ; `menu.test.ts › menus des apps Linux : ni menu « Bobine » ni Fenêtre` |
| 2 | menu Linux : Réglages et Quitter (Ctrl+Q) dans Fichier, F11, À propos en dernier (Linux seul) | forme du menu Linux, aucun rôle propre au Mac | doublon | — | `menu.test.ts › Fichier : nouvelle conversation, fenêtre rapide, Réglages (Ctrl+,), fermer, Quitter (Ctrl+Q)` ; `menu.test.ts › Affichage : Mon activité et plein écran en F11 ; Aide : À propos en dernier` |
| 3 | barre latérale : raccourcis ⌘1, ⇧⌘U (ou Ctrl) | puces de raccourcis dans la notation de la plateforme | composant | `Sidebar.test.tsx` | partiel : `Sidebar.test.tsx › « Mon activité » sous « Nouvelle conversation », ⇧⌘U, en surbrillance quand ouverte` ; `key-notation.test.ts › ailleurs : Ctrl, Alt, Maj dans cet ordre, ⌘ et ⌃ donnent Ctrl` (⌘1 de l'espace : non) |
| 4 | ⌥⌘↑ / ⌥⌘↓ : conversation précédente, suivante | commande de menu → conversation voisine active | composant | test de `goTo` d'`App.tsx` (à extraire et tester) | partiel : `menu.test.ts › chaque raccourci est dans le menu, une seule fois, et envoie sa commande` (envoi seul) |
| 5 | ⌘K : recherche sans accents, Entrée ouvre | « postgres » trouve « Postgres », Entrée l'ouvre | doublon | — | `AppDialogs.test.tsx › recherche par titre : la conversation est choisie, sans ⌘F` ; `conversation-search.test.ts › tous les mots, sans casse ni accents, dans le titre, le dossier ou l’agent` |
| 6 | ⌘B barre latérale, ⌘L zone de saisie | repli / dépli, focus dans la saisie | composant | `useMenuCommands.test.ts` ou test d'`App` | partiel : `menu.test.ts › chaque raccourci est dans le menu, une seule fois, et envoie sa commande` |
| 7 | barre latérale : 300 px par défaut | largeur par défaut | doublon | — | `sidebar-width.test.ts › 300 px par défaut, entre 220 et 440` |
| 8 | barre latérale : réglée à la poignée, 440 px au plus | glisser la poignée, plafond | doublon | — | `Sidebar.test.tsx › poignée entre 220 et 440 px, retenue, double-clic : 300 px` |
| 9 | double-clic sur la poignée : 300 px | remise à la largeur par défaut | doublon | — | idem |
| 10 | réglages : quatorze onglets en trois groupes | navigation des Réglages | doublon | — | `settings-search.test.ts › quatorze onglets en trois groupes (Mémoire, fiche 182 ; Rôles, fiche 223), sans Consommation (fiches 136, 144)` |
| 11 | mode « Sombre » appliqué à toute l'app (nativeTheme) | `nativeTheme.themeSource = 'dark'` côté main | doublon | — | `parcours-reglages` étape 4 (« thème sombre appliqué à l’app, puis retour au thème du système ») |
| 12 | thème black/aurora coché et appliqué ; plus d'accent « Comme le Mac » | `aria-checked`, `data-palette`, pas de `accent-system` | composant | `SettingsDialog.test.tsx` (application de `data-palette`) | partiel : `SettingsDialog.test.tsx › huit thèmes, six accents : chaque choix part dans les préférences ; Aurore « Nouveau »` ; `preferences.test.ts › accent (fiche 136) : six teintes ; « Comme le Mac » (\`system\`, retiré) revient au défaut` |
| 13 | thème Fjord coché et appliqué (fond `--bg`) | variable CSS `--bg` du thème posée | composant | test de l'application du thème (variables sur `:root`) | partiel : `themes.test.ts › palette affichée et fond des fenêtres au lancement` |
| 14 | apparence : police et taille du fil appliquées | `.msg-agent` en 14 px, Georgia (Serif) | composant | test des variables CSS posées par l'apparence (`appearance.test.ts`) | non (risque : la valeur calculée par le vrai CSS n'est pas vue) |
| 15 | navigateur : cookies gardés par défaut | case cochée par défaut | composant | `PrivacySettings.test.tsx` à créer (ou `preferences.test.ts` pour la valeur par défaut) | `src/renderer/src/components/settings/PrivacySettings.test.tsx` › « cookies gardés par défaut ; décocher part dans les préférences » |
| 16 | navigateur : « Effacer » vide les cookies et le dit | partition `persist:bob-browser` vidée, note affichée | unitaire-main | test du gestionnaire IPC d'effacement (session factice) + note en composant | `src/main/browser/browser-manager.test.ts` › « cookies gardés : la partition du disque vidée (stockage, cache, connexions), une fois » ; › « cookies pas gardés : la session en mémoire et ce qui restait sur le disque » ; › « un vidage en échec : l’erreur remonte (la note de Réglages la dit) » ; note : `src/renderer/src/components/settings/PrivacySettings.test.tsx` › « « Effacer » : bouton occupé pendant l’effacement, puis la note ; une erreur est dite » (sessions simulées : les cookies réellement partis restent e2e) |
| 17 | cookies plus gardés → ceux du disque effacés aussitôt | décocher déclenche l'effacement | unitaire-main | `settings-effects.test.ts` à créer | `src/main/settings-effects.test.ts` › « décoché : ceux du disque effacés aussitôt, une seule fois » ; › « recoché : rien n’est effacé ; décoché de nouveau : effacé de nouveau » ; › « effacement en échec : l’erreur est remontée, pas avalée » |
| 18 | rebond du Dock : activé par défaut | valeur par défaut | composant | `NotificationsSettings.test.tsx` (nouvel `it`) | non |
| 19 | rebond du Dock : en retrait sous « Notifications » | ligne `.settings-row.sub` | composant | `NotificationsSettings.test.tsx` | non |
| 20 | rebond du Dock : le réglage s'enregistre | bascule → préférence envoyée | composant | `NotificationsSettings.test.tsx` | non (seul le moteur l'est : `dock-bounce.test.ts › réglage coupé : rien`) |
| 21 | notifications coupées : rebond grisé, sa valeur gardée | `disabled` et `checked` | composant | `NotificationsSettings.test.tsx` | non |
| 22 | « Comme maintenant » tient dans les listes | texte mesuré dans la police réelle ≤ largeur de la liste | capture | capture nocturne `83-conversations` | non (mesure de police réelle, hors jsdom) |
| 23 | conversations gardées actives : de 6 à 2, pas en dessous | compteur, « − » désactivé au minimum | composant | `SettingsDialog.test.tsx` (section Conversations › Avancé) | partiel : `preferences.test.ts › conversations gardées actives (fiche 102) : un entier de 2 à 12, 6 par défaut` |
| 24 | baissées : la plus ancienne au repos mise en veille | agent en trop arrêté aussitôt | doublon | — | `manager.test.ts › réglage « Conversations gardées actives » (fiche 102) : en baissant, les agents en trop sont mis en veille aussitôt ; en montant, rien ne s’arrête` |
| 25 | réglages › agents : « Relire le PATH » n'est plus qu'au Diagnostic | absence du bouton dans Agents | composant | `SettingsDialog.test.tsx` | non |
| 26 | page de l'agent : version, ce qu'il annonce, ce qui lui est propre | page d'agent, titre = nom, version 0.1.0 | doublon | — | `SettingsDialog.test.tsx › une ligne par agent installé ; sa page dit ce qu’il annonce et ce qui lui est propre` (la version annoncée par le vrai agent factice n'y est pas) |
| 27 | page de l'agent : « ‹ Agents » ramène à la liste | retour à la liste | composant | `SettingsDialog.test.tsx` | non |
| 28 | réglages : liste des raccourcis | tableau avec ⌘N, ⌃\`, ⇧⌘U dans la notation | composant | `SettingsDialog.test.tsx` (onglet Raccourcis) | partiel : `settings-search.test.ts › raccourcis clavier par libellé ou par touches ; libellés qui suffisent d’abord` |
| 29 | réglages › nouveautés : icône et version, versions repliées sauf la plus récente | page Nouveautés | doublon | — | `SettingsDialog.test.tsx › nouveautés du CHANGELOG, une ligne par version, la plus récente seule ouverte` |
| 30 | recherche dans les réglages : ⌘F, « veille », Entrée → réglage mis en avant | ⌘F met le focus, Entrée ouvre la section et fait ressortir | composant | `SettingsDialog.test.tsx` (⌘F et Entrée) | partiel : `SettingsDialog.test.tsx › résultats à la place de la section ; un clic ouvre la section et fait ressortir le réglage` (clic, pas ⌘F ni Entrée) ; `settings-search.test.ts › sans casse ni accents, tous les mots, mots-clés compris` |
| 31 | recherche : une fonction propre à l'agent trouvée, sa page ouverte | résultat « Propre à … » → page d'agent | doublon | — | `SettingsDialog.test.tsx › « Propre à IBM Bob » ou « Clé » : la recherche ouvre la page de l’agent (fiche 136)` |
| 32 | recherche : un réglage d'« Avancé » déplié et mis en avant | proxy → `<details>` ouvert | doublon | — | `SettingsDialog.test.tsx › un réglage dans « Avancé » : la recherche le déplie (fiche 136)` |
| 33 | recherche : « empattements » trouve encore la police (fr seul) | mot-clé ancien gardé | composant | `settings-search.test.ts` (une ligne) | partiel : `settings-search.test.ts › sans casse ni accents, tous les mots, mots-clés compris` (autres mots-clés) |
| 34 | Échap vide d'abord la recherche, les réglages restent ouverts | priorité d'Échap ; « aucun résultat » | composant | `SettingsDialog.test.tsx` | partiel : `SettingsDialog.test.tsx › résultats à la place de la section ; un clic ouvre la section et fait ressortir le réglage` (« aucun résultat » seul) |
| 35 | taille du texte du terminal appliquée | xterm en 13,5 px | composant | test du panneau Terminal (option `fontSize` transmise à xterm) | non |
| 36 | ⇧⌘D modifications, ⌘J panneau de droite | commandes de menu → onglet Modifications, panneau fermé | composant | test d'`App` / `useMenuCommands.test.ts` | partiel : `menu.test.ts › chaque raccourci est dans le menu, une seule fois, et envoie sa commande` |
| 37 | réglages enregistrés | `settings.json` : thème, tailles, police, `maxLive` | unitaire-main | `settings-store.test.ts` (existant) | partiel : `settings-store.test.ts › enregistre chaque changement ; seuls ceux qui comptent pour l’app sont signalés` ; `settings.test.ts › aller-retour sauvegarde / lecture, sans fichier temporaire résiduel` |
| 38 | barre de menu d'Electron jamais montrée (Linux seul) | `isMenuBarVisible()` faux sur la vraie fenêtre | parcours | garder ici (Linux) | partiel : `app-menu.test.ts › Linux : barre d’Electron masquée, modèle servi, entrées connues déclenchées` |
| 39 | bouton ☰ : menu de Bobine, raccourcis en Ctrl (Linux) | entrées, Ctrl, rôle `menu` | composant | `AppMenu.test.tsx` (rendu du modèle) | partiel : `menu.test.ts › Fichier en tête, sous-menus, Réglages, Aide, À propos, puis Quitter` ; `app-menu.test.ts › accélérateurs d’Electron écrits comme sous Linux` (shared) |
| 40 | Échap : menu refermé, focus rendu au bouton ☰ (Linux) | accessibilité clavier du menu | composant | `AppMenu.test.tsx` | non |
| 41 | Alt seul : le menu ☰ s'ouvre, pas la barre d'Electron (Linux) | Alt réel sur la fenêtre native | parcours | garder ici (Linux) | partiel : `AppMenu.test.tsx › Alt appuyé puis relâché, sans autre touche` (pas la barre native) |
| 42 | Affichage › Barre latérale depuis ☰ : repliée, ☰ dans l'en-tête (Linux) | entrée de sous-menu → `app:menuInvoke` → main → commande renderer | parcours | garder ici (Linux) | partiel : `app-menu.test.ts › Linux : barre d’Electron masquée, modèle servi, entrées connues déclenchées` |
| 43 | Aurore nuit : menu ☰ opaque, sans flou ni fondu (Linux, sombre) | style calculé : `menu-in-opaque`, alpha 1, pas de `backdrop-filter` | capture | capture nocturne `app-menu-aurore-nuit` (ou test qui lit la feuille de style) | non |

#### Risques repérés (lot)

- **Positionnement réel des menus** (rules 1) : jsdom ne calcule pas la mise en page ; un menu Radix qui change de côté quand ses règles arrivent ne se verrait plus. Le test de composant ne couvre que la cause connue (affiché seulement une fois les règles lues).
- **Géométrie CSS réelle** (repere 7-8, settings 14, 22, 43, et l'anneau de repere 3) : ellipse du nom, pastille qui couvre le repère, police/taille calculées, texte qui déborde d'une liste, menu opaque. Une capture nocturne ne fait échouer personne : quelqu'un doit la regarder, ou bien il faut garder une mesure dans `parcours-longue` étape 4 (fenêtres étroite et large).
- **Câblage du lancement** (profil 1-6, 26-27) : `profile-startup.ts` et le câblage d'`index.ts` n'ont pas de test unitaire. Les tests main appellent les fonctions directement, mais seul un vrai lancement voit un vieux profil réel ou une restauration demandée qui ne serait pas appliquée.
- **Garde de la lecture seule de bout en bout** (profil 33, 35, 39) : `read-only-guard.test.ts` teste la liste, pas son branchement sur les vrais canaux, ni les écrivains (consommation, tâches, marque) qui passent hors IPC. L'empreinte du profil est la seule preuve globale.
- **Vrai disque plein** (profil 40-42) : les tests unitaires simulent l'erreur. Le comportement réel d'`ENOSPC` sur un écrivain atomique (fichier temporaire, renommage) ne se voit qu'avec une vraie image disque, sur macOS seulement.
- **Aller-retour renderer→IPC→main** (queue 4-5, parallel 2-3, settings 4, 6, 36) : l'IPC « Modifier » (unqueue puis renvoi à sa place), la création d'un worktree depuis le menu du dossier, l'envoi depuis le volet d'à côté vers une conversation non active, les commandes de menu jusqu'à leur effet. Les tests de composant simulent `window.api` et ne verraient pas un canal mal branché. D'où les 2 déplacements proposés dans `parcours-matinee` (étape 8) et `parcours-outils` (étape 4).
- **Sessions Electron** (settings 16-17) : l'effacement des cookies d'une partition persistante n'est testable qu'avec une session factice. Un test unitaire ne prouve pas que `clearStorageData` vide bien le disque.
- **Fenêtre native Linux** (settings 38, 41, 42) : barre d'Electron montrée par Alt et accélérateurs sans barre, seulement en vrai (et le protocole DevTools ne passe pas par les accélérateurs, fiche 145).
- **Dépendance à `parcours-deleguer`** (profil 16-17, 23, 25) : ces doublons reposent sur des étapes aujourd'hui rouges (défauts 1 et 2 de la fiche 277). Si l'on supprime `profil.mjs` avant leur correction, la reprise d'une conversation restaurée n'est plus vérifiée que par `manager.test.ts`.
- **Version annoncée par le vrai agent factice** (settings 26) : le test de composant donne la version en dur ; il ne verrait pas une annonce `agentInfo` perdue entre l'ACP et la page d'agent.


## Lot 2

Suites : `mcp.mjs`, `regles-approbation.mjs`, `pr-ci-sans-ci.mjs`, `restart.mjs`, `cout-connexion.mjs`, `degrade-haut.mjs`.
« Déjà couvertes ailleurs : k » ne compte que les vérifications **entièrement** couvertes (les « partiel » n'y sont pas).
Chemins des tests relatifs à la racine du dépôt ; numéros d'étape : fiche 277.

---

### `mcp.mjs` — Réglages › Serveurs MCP : outils de Bobine (familles, poids, coupure), serveurs des agents écrits dans les fichiers de Bob/OpenCode, « Tester », menu ⚙ de la session, tools/list avant/après redémarrage de l'agent
Verdict : **à garder (réduite)** — 5 vérifications exigent l'app réelle (tools/list réel de l'agent avant/après coupure + redémarrage, états réels des serveurs dans le menu ⚙, en-tête des Réglages qui défile) ; elles peuvent devenir une étape de `parcours-reglages` (alors la suite disparaît) ; le reste passe en composant/unitaire, dont beaucoup existent déjà.
Compte : 37 vérifications — parcours 5, composant 13, unitaire-main 8, capture 2, doublon 9 ; déjà couvertes ailleurs : 13

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Onglet « Bobine » en premier, choisi par défaut | Ordre et sélection des onglets | doublon | — | `src/renderer/src/components/settings/McpSettings.test.tsx › premier onglet, choisi par défaut, avec le nombre d’outils ; les agents ensuite` |
| 2 | Toutes les familles d'outils (iOS selon la plateforme) | Le catalogue réel arrive à l'écran ; famille iOS seulement là où le simulateur existe | unitaire-main | `src/main/mcp/catalog.test.ts` (+ cas plateforme sans simulateur) | partiel : `src/main/mcp/catalog.test.ts › toutes les familles, dans l’ordre où l’agent les reçoit, questions en tête` (pas le filtrage par plateforme, `FEATURES.simulator`) |
| 3 | Nombre de l'onglet = somme des cartes (> 40) | Total cohérent avec les cartes | composant | `McpSettings.test.tsx` (somme sur plusieurs familles) | partiel : `McpSettings.test.tsx › premier onglet, choisi par défaut…` (compte de l'onglet, une famille de fixture) |
| 4 | Conditions et accords (pastille orange sauf questions) | Textes de condition/accord par famille | composant | `McpSettings.test.tsx` | partiel : `McpSettings.test.tsx › une carte par famille : titre, nombre, phrase, condition, accord ; repliée` ; `src/main/mcp/catalog.test.ts › textes : une clé française et anglaise pour chaque titre, phrase, condition et accord` |
| 5 | Pastille d'accord d'une autre couleur que la condition | Couleur calculée (CSS réel) | capture | capture nocturne `a9-mcp-bobine` | non |
| 6 | Cartes repliées par défaut | État initial des cartes | doublon | — | `McpSettings.test.tsx › une carte par famille : … ; repliée` |
| 7 | Carte dépliée : noms en chasse fixe, description au survol | Noms + `title` ; police mono | composant | `McpSettings.test.tsx` (police mono → capture) | partiel : `McpSettings.test.tsx › dépliée : les noms des outils, avec la description de l’agent au survol` (pas la police) |
| 8 | Serveur déjà déclaré dans le fichier de Bob : listé | Lecture du `mcp.json` réel jusqu'à la liste | unitaire-main | `src/main/agent-config/mcp-files.test.ts` + liste dans `McpSettings.test.tsx` (à créer) | partiel : `src/main/agent-config/mcp-files.test.ts › ajout, désactivation, renommage, suppression ; champs inconnus gardés` (liste à l'écran non testée) |
| 9 | Désactivé : `disabled: true` chez Bob | Écriture de la désactivation | unitaire-main | — | `mcp-files.test.ts › ajout, désactivation, renommage, suppression ; champs inconnus gardés` |
| 10 | Nom invalide refusé avec un message | Validation affichée dans le formulaire | composant | `McpSettings.test.tsx` (formulaire, à créer) | partiel : `src/shared/mcp.test.ts › vérifié et nettoyé selon le transport` (règle ; message à l'écran non) |
| 11 | Réglages longs : en-tête fixe, seul le contenu défile | Mise en page réelle de la fenêtre des Réglages (défilement, `elementFromPoint`) | parcours | `degrade-haut.mjs` §10 (Réglages, fenêtre basse) | partiel : `degrade-haut.mjs` vérifie que `.settings-dialog` ne défile pas et que `.settings-header` n'est pas rogné, pas que le contenu défile |
| 12 | Ajouté dans `~/.bob/settings/mcp.json` au format de Bob | Découpe de la commande (guillemets), env, format | unitaire-main | — | `src/shared/mcp.test.ts › ligne de commande : mots, guillemets, aller-retour` ; `mcp-files.test.ts › ajout, désactivation, renommage, suppression…` |
| 13 | Copié vers OpenCode, à son format, commentaires gardés | Écriture `.jsonc` qui garde les commentaires | unitaire-main | — | `mcp-files.test.ts › opencode.jsonc existant : commentaires et autres réglages gardés` |
| 14 | Portée changée : déplacé dans `opencode.json` du dossier | Changement de portée = ajout + retrait de l'ancien | unitaire-main | `mcp-ipc.test.ts` ou `McpSettings.test.tsx` (déplacement, à créer) | partiel : `mcp-files.test.ts › sans fichier : opencode.json créé ; projet cherché jusqu’à la racine git` (pas le déplacement) |
| 15 | Premier clic : confirmation dans la ligne, rien supprimé | Confirmation en ligne avant suppression | composant | `McpSettings.test.tsx` (à créer) | non |
| 16 | Supprimé du fichier de Bob (confirmé) | Suppression écrite, l'autre serveur gardé | unitaire-main | — | `mcp-files.test.ts › ajout, désactivation, renommage, suppression…` |
| 17 | Dernier serveur du projet retiré : `opencode.json` supprimé | Pas de fichier vide laissé ; global intact | doublon | — | `mcp-files.test.ts › dernier serveur retiré : conteneur vide retiré, fichier supprimé s’il n’a rien d’autre (fiche 126)` |
| 18 | « Tester » : joignable, serveur, outils, prompts | Sonde réelle + rendu du résultat | composant | `McpSettings.test.tsx` (rendu du résultat, à créer) | partiel : `src/main/agent-config/mcp-probe.test.ts › commande locale : serveur, outils sur deux pages, prompts ; répond à ses requêtes` (la sonde, pas l'affichage) |
| 19 | « Tester » : noms des outils au survol | Infobulle du résultat | composant | `McpSettings.test.tsx` (à créer) | non |
| 20 | « Tout tester » : cause utile sur la ligne (module introuvable) | Sortie d'erreur du processus résumée sur la ligne | composant | `McpSettings.test.tsx` (à créer) | partiel : `mcp-probe.test.ts › erreurs lisibles : serveur qui s’arrête (avec sa sortie), muet, introuvable, adresse fausse` (sortie jointe, pas la ligne affichée) |
| 21 | « Tout tester » : serveur qui plante → code et sortie | Erreur de sonde complète | doublon | — | `mcp-probe.test.ts › erreurs lisibles : …` (`code 3`, `SERVICE_TOKEN manquante` à l'identique ; l'infobulle seule ne l'est pas) |
| 22 | Pastilles : joignable, en erreur, désactivé | État visuel par serveur | composant | `McpSettings.test.tsx` (à créer) | non |
| 23 | Menu ⚙ : serveurs MCP de l'agent et leur état réel | Sondes réelles déclenchées par la session, agent factice qui lit les fichiers de Bob | parcours | `parcours-reglages`, nouvelle étape (MCP) ; rendu : `SessionSettingsMenu.test.tsx` | partiel : `src/renderer/src/components/common/SessionSettingsMenu.test.tsx › Serveurs MCP : « bobine · intégré » et les outils reçus, puis les serveurs de l’agent (fiche 099)` (sans états) |
| 24 | Menu ⚙ : « bobine · intégré », N outils reçus | Libellé et décompte | doublon | — | `SessionSettingsMenu.test.tsx › Serveurs MCP : « bobine · intégré »…` ; `catalog.test.ts › le même décompte que les outils donnés à la session par le pont` |
| 25 | Outils reçus au survol : ni iOS ni filles hors projet/git | Filtrage des outils par dossier | doublon | — | `catalog.test.ts › dossier quelconque : ni iOS, ni Android, ni filles` |
| 26 | Menu ⚙ : poids estimé des outils | « ≈ N jetons » affiché | doublon | — | `SessionSettingsMenu.test.tsx › Serveurs MCP : …` (≈ 610 jetons) ; `catalog.test.ts › menu ⚙ : outils et poids de la session, et ce que recevra la prochaine` |
| 27 | Menu ⚙ › « Voir les outils » : onglet « Bobine » | Câblage menu → Réglages sur le bon onglet | composant | `SessionSettingsMenu.test.tsx` + `McpSettings.test.tsx` | partiel : `SessionSettingsMenu.test.tsx › Serveurs MCP : …` (`onOpenMcpSettings('bobine')`) ; le passage App → Réglages non |
| 28 | Menu ⚙ › un serveur : onglet de l'agent | Ouverture sur l'onglet de l'agent | composant | `McpSettings.test.tsx` | partiel : `McpSettings.test.tsx › ouvert sur l’onglet d’un agent (menu ⚙) : ses serveurs, sans les cartes de Bobine` |
| 29 | Réglages refermés : l'app répond encore (`pointer-events`) | Pas de menu Radix modal qui bloque la page | composant | — | partiel : `src/renderer/src/components/common/menus-modal.test.ts › are all non-modal: a modal Radix menu that opens a dialog leaves the page unclickable` (garde statique de la cause, pas le comportement Radix réel) |
| 30 | Avant : tools/list déclare le navigateur | Le serveur MCP de l'app, interrogé par l'agent, déclare les outils | parcours | `parcours-reglages`, nouvelle étape (MCP) | partiel : `src/main/mcp/tool-server.test.ts › initialize, tools/list, tools/call → la question va à la session` (sans agent) |
| 31 | Poids estimé de chaque famille (navigateur ≈ 1000–3000) | Estimation sur le vrai catalogue | unitaire-main | `catalog.test.ts` (borne sur la famille navigateur) | partiel : `catalog.test.ts › poids estimé : environ 4 caractères par jeton des définitions envoyées par `tools/list`` |
| 32 | Questions : « Toujours fournie », pas d'interrupteur | Texte à la place d'un interrupteur grisé | doublon | — | `McpSettings.test.tsx › poids estimé de chaque famille et total ; interrupteur, avis (fiche 109)` |
| 33 | Interrupteur : atteint par Tab, zone ≥ 30×18 px | Ordre clavier ; taille réelle | capture | Tab → `McpSettings.test.tsx` ; taille → capture nocturne | non |
| 34 | Navigateur coupé : avis « prochaines sessions », total recalculé | Coupure, avis, total | doublon | — | `McpSettings.test.tsx › poids estimé de chaque famille et total ; interrupteur, avis (fiche 109)` ; IPC : `src/main/agent-config/mcp-ipc.test.ts › familles d’outils de Bobine : coupées dans les réglages, arguments vérifiés (fiche 109)` |
| 35 | Menu ⚙ : N maintenant, N − navigateur au prochain démarrage | Ligne « au prochain démarrage » | composant | `SessionSettingsMenu.test.tsx` (`session-app-tools-next`, à créer) | partiel : `catalog.test.ts › menu ⚙ : outils et poids de la session, et ce que recevra la prochaine` (côté main) |
| 36 | Après redémarrage de l'agent : plus d'outil navigateur dans tools/list | Redémarrage réel, pont relu, MCP réel | parcours | `parcours-reglages`, nouvelle étape (MCP) | partiel : `catalog.test.ts › une famille coupée n’est plus donnée à la session (pont), relue à chaque ouverture` |
| 37 | Menu ⚙ après redémarrage : outils suivent les réglages | Session relancée, état du menu cohérent | parcours | `parcours-reglages`, nouvelle étape (MCP) | non |

---

### `regles-approbation.mjs` — Règles d'approbation « pour tous les projets » (fiche 215) : IPC, section des cartes de commande, refus par le terminal de l'app, page Réglages › Approbations, groupe interdit, fichier illisible
Verdict : **disparaît entièrement** — 18 vérifications existent déjà à l'identique (`GlobalRuleSection`, `ApprovalRulesPage`, `bob-approval-rules`, `approval-rules`) ; seule la commande refusée partout par le terminal de l'app (agent → MCP → règles relues) doit rester de bout en bout, comme variante de `parcours-outils` étape 2 ; les 10 vérifications de composant restantes vont dans `ApprovalRulesPage.test.tsx` et `GlobalRuleSection.test.tsx`.
Compte : 31 vérifications — parcours 1, composant 10, unitaire-main 2, capture 0, doublon 18 ; déjà couvertes ailleurs : 20

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | IPC : lecture, liste par défaut signalée | `approvalRules.get` lit le fichier jetable | unitaire-main | — | `src/main/agent-config/bob-approval-rules.test.ts › règles d’approbation : profils et IPC (fiche 215) › seuls les profils qui déclarent le format ; arguments du renderer vérifiés` ; `› fichier absent : défauts de Bob (Lecture seule, liste par défaut signalée)` |
| 2 | IPC : changement mal formé refusé | Le main valide ce qui vient du renderer | doublon | — | `bob-approval-rules.test.ts › seuls les profils qui déclarent le format ; arguments du renderer vérifiés` ; `src/shared/approval-rules.test.ts › seules les formes attendues passent, sans champ en trop` |
| 3 | IPC : profil sans règles → `unsupported` | Erreur typée | doublon | — | `bob-approval-rules.test.ts › seuls les profils qui déclarent le format ; …` (`unsupported`) |
| 4 | Commande couverte par la liste par défaut : « déjà autorisée partout · Gérer » | Pas de section quand tout est couvert | doublon | — | `src/renderer/src/components/thread/GlobalRuleSection.test.tsx › commande entièrement couverte : pas de section, « déjà autorisée partout · Gérer »` |
| 5 | « Pour tous les projets » replié en pied de carte | État initial | doublon | — | `GlobalRuleSection.test.tsx › replié par défaut ; commande entière proposée ; encadré « première fois »` |
| 6 | Dépliée : commande entière, encadré « première fois » | Proposition initiale | doublon | — | idem |
| 7 | Une seule note de portée ; « à la prochaine conversation » | Note de portée + quand la règle vaut | doublon | — | `src/renderer/src/components/thread/PermissionCardExtras.test.tsx › portée déclarée : « Toujours dans cette conversation » et UNE seule note, l’agent en gras (recette QA)` ; `GlobalRuleSection.test.tsx › quand la règle vaut : prochaine conversation sans « Commandes de la liste », sinon tout de suite` |
| 8 | Préfixe d'un seul mot : avertissement avec exemple | Avertissement | doublon | — | `GlobalRuleSection.test.tsx › préfixe d’un seul mot : avertissement, sans blocage` |
| 9 | « Autoriser partout » : liste par défaut recopiée, `execute` ajouté, reste gardé | Écriture du fichier de Bob | unitaire-main | — | `bob-approval-rules.test.ts › première fois : ajoute aussi le groupe `execute` (read recopié) et le dit` ; `› sans `allowedExecutors` : la liste par défaut est recopiée (piège vu le 2026-11-09)` ; `› clés inconnues, ordre et le reste du fichier gardés ; copie de sauvegarde` |
| 10 | « Autoriser partout » : la carte reçoit aussi « toujours » | Réponse à la carte | doublon | — | `GlobalRuleSection.test.tsx › « Autoriser partout » : écrit la règle, puis répond « toujours » (par genre) à la carte` |
| 11 | Ligne de réponse : « Toujours dans cette conversation », « Gérer » souligné | Libellé ; soulignement (CSS) | composant | `PermissionCardExtras.test.tsx` (soulignement → capture) | partiel : `PermissionCardExtras.test.tsx › ligne de réponse : même libellé que le bouton choisi (recette QA)` |
| 12 | Commit avec parenthèses entre guillemets : deux parties | Découpe respectant les guillemets | doublon | — | `src/shared/approval-rules.test.ts › guillemets respectés : %s` (cas `feat(calc)` à l'identique) |
| 13 | « Commandes de la liste » déjà permis : vaut tout de suite | Texte « quand » | doublon | — | `GlobalRuleSection.test.tsx › quand la règle vaut : …` |
| 14 | Commande enchaînée : 5 parties, `wc -l` déjà autorisée | Découpe et parties couvertes à l'écran sur la vraie commande longue | composant | `GlobalRuleSection.test.tsx` (avec `BOB_LONG_COMMAND`) | partiel : `GlobalRuleSection.test.tsx › commande enchaînée : une partie par champ, `cd` vers le dossier ignoré, parties décochables` ; `› partie déjà couverte par les listes de Bob : montrée, ni cochable ni écrite` |
| 15 | `execute` déjà permis : plus d'encadré « première fois » | Encadré absent | doublon | — | `GlobalRuleSection.test.tsx › groupe `execute` déjà permis : pas d’encadré « première fois »` |
| 16 | « Refuser partout » : partie choisie seule, écrite, carte refusée | Parties décochées non écrites, carte refusée | composant | `GlobalRuleSection.test.tsx` | partiel : `GlobalRuleSection.test.tsx › « Refuser partout » : ajoute aux refusées et refuse la carte en cours` + `› commande enchaînée : … parties décochables` |
| 17 | `node --version` refusée partout (par l'IPC) | Ajout aux refusées | doublon | — | `bob-approval-rules.test.ts › ajouter à une liste retire de l’autre ; retirer ; doublon ignoré` |
| 18 | Terminal de Bobine : refusée partout, ni question ni lancement, dit dans le fil | L'agent appelle l'outil terminal par MCP, le main relit les règles et refuse | parcours | `parcours-outils` étape 2 (variante « refusée partout ») | partiel : `src/main/mcp/command-approval.test.ts › refusée sans question ni lancement, même autorisée « toujours » ici` ; `bob-approval-rules.test.ts › relues à chaque appel ; profil sans règles ou fichier illisible : rien de refusé` |
| 19 | « Gérer » → Réglages › Agents › agent › Approbations | Navigation jusqu'à la page | composant | `SettingsDialog.test.tsx` (ouverture sur la page, à créer) | partiel : `GlobalRuleSection.test.tsx › après la réponse : la règle écrite rappelée sur la ligne, « Gérer » ouvre les réglages` (appel seulement) |
| 20 | Page : Commandes de la liste activé, Liste de tâches non | Groupes lus affichés | composant | `ApprovalRulesPage.test.tsx` (à compléter) | non |
| 21 | Interrupteur Liste de tâches : écrit dans le fichier | Clic → changement `setGroup` | composant | `ApprovalRulesPage.test.tsx` | partiel : `bob-approval-rules.test.ts › activer / couper un groupe ; groupes inconnus gardés ; défaut `read` recopié` (écriture, pas le clic) |
| 22 | Listes : ajout, modification, retrait écrits | Édition des listes depuis la page | composant | `ApprovalRulesPage.test.tsx` | partiel : `ApprovalRulesPage.test.tsx › autorisées : « Garder » n’écrit rien ; commande entière : pas de confirmation` (ajout) ; modification et retrait non |
| 23 | « git » aux autorisées : avertissement et confirmation avant d'écrire | Garde d'un seul mot | doublon | — | `src/renderer/src/components/settings/ApprovalRulesPage.test.tsx › autorisées : avertissement et confirmation explicite avant d’écrire` |
| 24 | « Garder » : rien écrit | Annulation | doublon | — | `ApprovalRulesPage.test.tsx › autorisées : « Garder » n’écrit rien ; commande entière : pas de confirmation` |
| 25 | Hors du dossier : effet de bord dit avant le clic | Note sous l'option | doublon | — | `ApprovalRulesPage.test.tsx › global éteint : l’effet de bord est dit sous l’option, et l’allumer écrit les deux` |
| 26 | Hors du dossier : option du groupe et global écrits | Les deux changements | doublon | — | idem ; `bob-approval-rules.test.ts › hors du dossier : interrupteur global et option par groupe` |
| 27 | Option éteinte : le global reste allumé, et c'est dit | Note « reste autorisé » | doublon | — | `ApprovalRulesPage.test.tsx › options éteintes, global resté allumé : dit, avec « Ne plus l’autoriser »` |
| 28 | « Ne plus l'autoriser » : global éteint | Bouton qui coupe le global | doublon | — | idem (clic `approval-outside-turn-off`) |
| 29 | Groupe interdit : interrupteur désactivé, raison dite | Rendu d'un groupe interdit | composant | `ApprovalRulesPage.test.tsx` (à compléter) | partiel : `bob-approval-rules.test.ts › lit groupes, listes, hors du dossier, groupes interdits et inconnus` (lecture) |
| 30 | Fichier illisible : bandeau avec la ligne, ni groupes ni listes | Rendu de l'erreur | composant | `ApprovalRulesPage.test.tsx` (à compléter) | partiel : `bob-approval-rules.test.ts › JSON invalide : la ligne de la première erreur est donnée` |
| 31 | Fichier corrigé : « Relire » montre les règles | Relecture | composant | `ApprovalRulesPage.test.tsx` (à compléter) | non (dans l'e2e, `check(true, …)` : seule l'attente le vérifie) |

---

### `pr-ci-sans-ci.mjs` — Carte de suivi de PR sur un dépôt sans CI (faux `gh`) : « Aucune CI détectée », fusion d'office qui n'aura jamais lieu, « Fusionner maintenant » refusé si la branche est en retard, puis fusion
Verdict : **disparaît entièrement** — la logique est déjà testée dans le main (`pr-watch`, `pr-tracking`) ; il manque un test de composant de `PrCard` (aucun aujourd'hui) pour les textes et l'état du bouton ; la fusion au clic de bout en bout (faux `gh`, worktree réel) rejoint `pr-ci.mjs` ou une journée type.
Compte : 4 vérifications — parcours 1, composant 3, unitaire-main 0, capture 0, doublon 0 ; déjà couvertes ailleurs : 0

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Ni workflow ni contrôle requis : « Aucune CI détectée », « Fusionner maintenant » proposé | Détection sans CI (appels branches/rules) et rendu | composant | `src/renderer/src/components/panel/PrCard.test.tsx` (à créer) | partiel : `src/main/changes/pr-watch.test.ts › aucun contrôle : pas de CI, attendus, puis « rien » après 5 min (D16, D20)` ; `› « Aucune CI » seulement si GitHub ne dit rien d’autre : CI externe, règles, blocage (remarque 1)` (main seulement) |
| 2 | Fusion d'office cochée : jamais sans contrôle, la carte le dit | Raison d'attente `no-ci` affichée, aucun `merge` | composant | `PrCard.test.tsx` (à créer) | partiel : `src/shared/pr-tracking.test.ts › pourquoi la fusion d’office attend : la raison la plus bloquante d’abord (0.9.1, D20)` ; `pr-watch.test.ts › aucun contrôle : …` |
| 3 | Branche à reprendre : bouton désactivé, raison en infobulle | Refus anticipé avec la raison | composant | `PrCard.test.tsx` (à créer) | partiel : `pr-watch.test.ts › « Fusionner maintenant » refusé, avec la raison, quand GitHub bloque (remarque 2)` |
| 4 | « Fusionner maintenant » : PR fusionnée (commit de fusion), « Nettoyer » proposé | Clic → `gh pr merge --merge --match-head-commit`, évènement, nettoyage proposé | parcours | `pr-ci.mjs` (phase « sans CI ») ou étape d'une journée type | partiel : `pr-watch.test.ts › « Fusionner maintenant » : sans CI seulement, sur clic` ; `› « Fusionner maintenant » relit la PR d’abord, puis épingle le commit vu (remarque 1)` ; `pr-ci.mjs` couvre la fusion d'office et « Nettoyer », pas ce bouton |

---

### `restart.mjs` — Redémarrage de l'app sur les mêmes données : conversation dans « Récents », consommation gardée, reprise par session/load, suppression confirmée dans l'app, replis de la barre latérale gardés
Verdict : **disparaît entièrement** — la reprise est déjà vérifiée par `parcours-matinee` (étapes 13–14) ; la consommation gardée et l'absence de boîte native s'ajoutent à des étapes existantes ; les replis sont couverts par `Sidebar.test.tsx`.
Compte : 5 vérifications — parcours 2, composant 1, unitaire-main 0, capture 0, doublon 2 ; déjà couvertes ailleurs : 3

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Après redémarrage : la conversation est dans « Récents » | Historique relu du disque | doublon | `parcours-matinee` étape 13 | `e2e/suites/parcours-matinee.mjs › relance : la conversation affichée, son fil (relecture comprise), son modèle et son mode` (les deux conversations dans la barre) |
| 2 | Après redémarrage : la consommation de la conversation est conservée | Usage persisté et relu | parcours | `parcours-matinee` étape 13 (ajouter `usage-meter`) | non (partiel côté données : `src/shared/usage-cost.test.ts › posée par usageDigest, relue du disque, absente sinon`) |
| 3 | Conversation rechargée (session/load) puis continuée | Reprise ACP réelle | doublon | `parcours-matinee` étape 13 | `parcours-matinee.mjs › agent relancé : il répond dans le même fil, avec les réglages de la conversation` |
| 4 | Suppression confirmée dans l'app : historique vide, accueil, aucune boîte native | Dialogue intégré, pas de `confirm()` du navigateur ; accueil après la dernière | parcours | `parcours-deleguer` étape 6 (ajouter `ui.dialogs.length === 0`) | partiel : `parcours-deleguer.mjs › mère et travaux à la corbeille : plus dans la barre latérale` (passe par `delete-dialog`) ; `src/renderer/src/components/sidebar/DeleteDialog.test.tsx` (dialogue) ; l'accueil après la dernière suppression non |
| 5 | Après redémarrage : « Épinglées » et dossier repliés, mode Dossiers gardé | Replis et regroupement persistés (`localStorage`) | composant | — | `src/renderer/src/components/sidebar/Sidebar.test.tsx › chaque section se replie, et le reste au redémarrage` ; `› un dossier se replie (seul son nom reste), et le reste au redémarrage` (regroupement lu de `localStorage`) |

---

### `cout-connexion.mjs` — Coût d'un modèle payant annoncé nul (« coût inconnu », jamais « gratuit » ni « 0,00 »), Mon activité cohérente, Mon activité à 720 px, modèles « sans doute » à connecter après un refus
Verdict : **disparaît entièrement** — tout est déjà testé en composant ou dans le main, sauf deux lignes de composant à compléter et la mise en page à 720 px, à reprendre par `degrade-haut.mjs` §8.
Compte : 6 vérifications — parcours 1, composant 2, unitaire-main 0, capture 0, doublon 3 ; déjà couvertes ailleurs : 3

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Coût nul d'un modèle payant : « coût inconnu » | Ni « gratuit » ni « 0,00 » | doublon | — | `src/renderer/src/components/composer/UsageMeter.test.tsx › coût nul d’un modèle payant : « coût inconnu », dit pourquoi (fiche 266, D12)` ; `src/shared/usage-cost.test.ts › abonnement (OpenCode connecté par abonnement, D12) : coût nul d’un modèle payant → coût inconnu` |
| 2 | Le détail dit pourquoi le coût est inconnu | Explication | doublon | — | `UsageMeter.test.tsx › coût nul d’un modèle payant : …` (`usage-cost-hint`) |
| 3 | Ni moyenne ni ligne d'échange à « ≈ 0,00 $US » | Lignes par échange cohérentes | composant | `UsageMeter.test.tsx` (lignes `usage-turn`, à compléter) | partiel : même test (total seulement) |
| 4 | Mon activité : la tuile compte 2 échanges sans coût, comme le tableau | Tuile et tableau d'accord sur les mêmes stats | composant | `ActivityPage.test.tsx` (compte `withoutCost`) | partiel : `src/renderer/src/components/activity/ActivityPage.test.tsx › coût nul en dollars : « coût inconnu » pour un modèle payant, « gratuit » sinon (fiche 266, D12)` (tuile et ligne, sans le compte) ; `src/main/usage/stats.test.ts` (`turnsWithoutCost`) |
| 5 | Mon activité à 720 px : pas de barre permanente, rien ne déborde | Mise en page réelle (`scrollWidth`, `scrollbar-width`) | parcours | `degrade-haut.mjs` §8 (fenêtre étroite) | non |
| 6 | Menu des modèles : refusé, même fournisseur « sans doute », gratuit sans marque | Marquage côté main et rendu | doublon | — | `src/main/agent/refused-models.test.ts › marqués, sauf le modèle choisi, un modèle gratuit, un modèle qui a répondu, un autre fournisseur` ; `src/renderer/src/components/composer/BlockerPanel.test.tsx › même fournisseur qu’un modèle refusé : « sans doute », jamais d’autres (fiche 266, D31)` |

---

### `degrade-haut.mjs` — Défilement vers un message (sommaire, message pas encore rendu, `scrollIntoView`, recherche) qui s'arrête sous le dégradé de la barre de titre ; racine et en-têtes immobiles sur chaque page (clavier, fenêtre étroite, débordement)
Verdict : **à garder (réduite)** — chaque vérification mesure la mise en page réelle (`getBoundingClientRect`, `scrollTop` de `html`/`body`/`#root`, `::after`, défilement doux), que jsdom ne calcule pas. On peut la réduire : moins de pas de Tab, une seule taille de fenêtre pour les Réglages, et le cas du sommaire joint à `parcours-longue` étape 2.
Compte : 28 vérifications — parcours 27, composant 1, unitaire-main 0, capture 0, doublon 0 ; déjà couvertes ailleurs : 0

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Accueil : racine et en-têtes immobiles | Pas de défilement parasite (D26) | parcours | garder ici | non |
| 2 | Accueil, 20 Tab : rien ne bouge | Le focus clavier ne fait pas défiler la racine | parcours | garder ici | non |
| 3 | Sommaire, messages 41 et 56 : sous le fondu (boucle ×2) | Le défilement doux s'arrête sous le dégradé | parcours | `parcours-longue` étape 2 (ajouter « sous le fondu ») | partiel : `parcours-longue.mjs › le troisième message est à l’écran, le fil n’est plus en bas` (à l'écran, pas sous le fondu) |
| 4 | Fil rouvert par la fin : premier message pas encore rendu | Rendu partiel (fiche 193), précondition | composant | `src/renderer/src/components/thread/useEntryWindow.test.ts` | partiel : `useEntryWindow.test.ts › fil vide, puis arrivée du fil : ouvert par la fin` |
| 5 | Sommaire, message à rendre : sous le fondu | Rendre puis montrer, sans passer sous le dégradé | parcours | garder ici | non |
| 6 | `scrollIntoView`, message 21 : sous le fondu | `scroll-padding`/marge réels | parcours | garder ici | non |
| 7 | `scrollIntoView`, dernier message : racine immobile | Le fil ne peut pas monter plus : rien autour ne défile | parcours | garder ici | non |
| 8 | Recherche : le résultat sous le fondu | Surlignage CSS centré hors du dégradé (commande de menu réelle) | parcours | garder ici | non |
| 9 | Fil : contenu qui dépasse, amené à l'écran, racine immobile | Racine `overflow` verrouillée | parcours | garder ici | non |
| 10 | Fil, 30 Tab : rien ne bouge | Focus clavier dans le fil | parcours | garder ici (réduire à 15 pas) | non |
| 11 | Fenêtre étroite, panneau ouvert, message 51 : sous le fondu | Même règle à 760 px avec panneau | parcours | garder ici | non |
| 12 | Panneau de droite, fenêtre étroite, 30 Tab | Focus dans le panneau | parcours | garder ici (fusionner avec 13) | non |
| 13 | Panneau de droite, 30 Tab | idem à la taille normale | parcours | fusionner avec 12 | non |
| 14 | Côte à côte, message 31 : sous le fondu | Règle dans la vue côte à côte | parcours | garder ici | non |
| 15 | Côte à côte : racine immobile après `scrollIntoView` à côté | La vue d'à côté ne fait pas défiler la racine | parcours | garder ici | non |
| 16 | Côte à côte, 20 Tab | Focus | parcours | garder ici | non |
| 17 | Mon activité ouverte : racine immobile | Page sans défilement parasite | parcours | garder ici | non |
| 18 | Mon activité, mois/année/semaine : racine immobile (boucle ×3) | Changement de période | parcours | garder ici (une période suffit) | non |
| 19 | Mon activité, grille défilée : racine immobile | Défilement horizontal de la grille | parcours | garder ici | non |
| 20 | Mon activité, 40 Tab | Focus | parcours | garder ici | non |
| 21 | Mon activité : contenu qui dépasse, racine immobile | Débordement | parcours | garder ici | non |
| 22 | Mon activité, fenêtre étroite, 40 Tab | Focus à 640 px | parcours | garder ici (y joindre le n° 5 de `cout-connexion`) | non |
| 23 | Tâches planifiées : racine immobile | Page | parcours | garder ici | non |
| 24 | Tâches planifiées, 30 Tab | Focus | parcours | garder ici | non |
| 25 | Tâches planifiées : contenu qui dépasse, racine immobile | Débordement | parcours | garder ici | non |
| 26 | Réglages › chaque rubrique (14) × 2 tailles, 30 Tab (boucle) | Fenêtre des Réglages jamais défilée sous son en-tête | parcours | garder ici (une taille, 15 pas) | non |
| 27 | Réglages, fenêtre basse : la liste des rubriques défile dans sa colonne, « Nouveautés » à l'écran | Colonne de navigation qui défile | parcours | garder ici | non |
| 28 | Réglages, fenêtre basse : racine immobile | Racine | parcours | garder ici | non |

---

#### Risques repérés (lot)

- **Mise en page réelle** : `degrade-haut` entier, `mcp` n° 11 (en-tête des Réglages fixe), `cout-connexion` n° 5 (720 px) et `mcp` n° 33 (taille de l'interrupteur) mesurent des boîtes, des défilements et des `::after` que jsdom ne calcule pas. Un test de composant passerait au vert sur une régression CSS (racine qui défile, message sous le dégradé).
- **Couleur et police** (`mcp` n° 5, n° 7, `regles-approbation` n° 11 soulignement) : sans CSS chargé, un test de composant ne voit rien ; seule une capture le voit.
- **Agent réel par MCP** : `mcp` n° 30, 36, 37 (tools/list avant/après redémarrage de l'agent) et `regles-approbation` n° 18 (outil terminal refusé par les règles relues à chaque appel) passent par l'agent factice, le serveur MCP de l'app et le pont. Les tests unitaires (`catalog`, `tool-server`, `command-approval`) couvrent les morceaux, pas leur enchaînement après un redémarrage.
- **Sondes réelles dans le menu ⚙** (`mcp` n° 23) : les états viennent de processus lancés par le main pour la session (l'agent factice lit les fichiers de Bob). Le rendu se teste en composant, pas le déclenchement des sondes.
- **Clic → fichier réel par l'IPC** : `regles-approbation` n° 9 et 21–22, `mcp` n° 9, 12–17. Les écritures sont testées dans le main sur des fichiers temporaires, et les composants avec un `window.api` simulé : le câblage preload → handler n'est plus exercé que par les parcours. Le déplacement de portée de `mcp` n° 14 (ajout + retrait de l'ancien) n'est testé nulle part ailleurs.
- **Menu Radix modal** (`mcp` n° 29) : le test statique `menus-modal.test.ts` garde la cause connue (`modal={false}`), pas une autre façon de laisser `pointer-events: none` sur la page.
- **Boîte native** (`restart` n° 4) : l'absence de `confirm()` natif ne se voit que dans Electron (`ui.dialogs`).
- **Persistance au vrai redémarrage** : `restart` n° 2 (consommation) n'est couvert par aucune journée type aujourd'hui. Les replis (`restart` n° 5) passent par `localStorage` : un démontage/remontage jsdom les couvre, mais pas une partition de session qui changerait entre deux lancements.
- **Plateforme** (`mcp` n° 2) : le filtrage de la famille iOS selon `FEATURES.simulator` (Linux/Windows) n'a pas de test unitaire.
- **`PrCard` sans aucun test de composant** : si `pr-ci-sans-ci` disparaît avant la création de `PrCard.test.tsx`, les textes et l'état désactivé du bouton (avec la raison en infobulle) ne sont plus vérifiés nulle part.
- **Vérification creuse** : `regles-approbation` n° 31 est un `check(true, …)` ; seule l'attente (`waitFor`) qui le précède vérifie quelque chose.


## Lot 3

Suites : `browser-annotate.mjs`, `certificats.mjs`, `roles-gestion.mjs`, `limite-etapes.mjs`,
`mermaid.mjs`, `dossiers.mjs`. Numéros d'étapes des journées : fiche 277.
« Déjà couvertes ailleurs : k » compte les vérifications dont la colonne « Déjà couvert ? » n'est
pas « non » (partielles comprises).

### `browser-annotate.mjs` — annoter une page vivante dans le navigateur intégré (défilement, zoom, bulle, épingles, Échap, envoi avec captures)
Verdict : **à garder (réduite)** — huit vérifications ne se voient que dans la vraie vue native (entrées réelles, gel/dégel de la vue, contenu ACP envoyé) ; parcours-outils étape 3 n'en couvre qu'une partie.
Compte : 26 vérifications — parcours 8, composant 5, unitaire-main 4, capture 1, doublon 8 ; déjà couvertes ailleurs : 22

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | la page est affichée (vue native) | la vue native de l'onglet est visible après `navigateur-vue` | doublon | parcours-outils, étape 3 | `parcours-outils.mjs` › étape « le navigateur intégré : annoter la page et l'envoyer » › check « la page est affichée dans le navigateur intégré » |
| 2 | bouton « Annoter » enfoncé | `aria-pressed=true` en mode Annoter | composant | `src/renderer/src/components/panel/BrowserTab.test.tsx` (à créer) | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « bouton « Annoter » enfoncé et bandeau d’aide ; second clic : le mode finit, le script part » |
| 3 | bandeau « La page défile et zoome… » | texte d'aide affiché (i18n `browser.annotate.hint`) | composant | `PageAnnotator.test.tsx` (à créer) | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « bouton « Annoter » enfoncé et bandeau d’aide ; second clic : le mode finit, le script part » (dans `BrowserTab.test.tsx` plutôt qu’un `PageAnnotator.test.tsx` : le geste traverse l’onglet, `usePageAnnotation` et la bulle) |
| 4 | le script de l'app est dans la page | `bobine-notes` injecté dans la page en mode Annoter | doublon | parcours-outils, étape 3 (l'attend, sans `check`) | partiel : `parcours-outils.mjs` étape 3 (attente implicite) ; `src/main/browser/page-layer.test.ts` › « mode Annoter : monde isolé, binding limité à ce monde, script, puis départ » |
| 5 | page vivante : la vue native reste affichée | le mode Annoter ne fige plus la page (pas d'image `page-frozen`) | parcours | parcours-outils, étape 3 (à ajouter) ou garder ici | non |
| 6 | curseur en croix sur la page | style `crosshair !important` appliqué dans la page | unitaire-main | `src/main/browser/page-layer.test.ts` (à ajouter) — la cascade CSS réelle de la page n'y serait pas vue | `src/main/browser/page-layer.test.ts` › « curseur en croix sur toute la page, même contre un style de la page ; parti à l’arrêt » (cascade de jsdom ; celle d’une vraie page reste vue en e2e) |
| 7 | mode Annoter : la page défile | la molette atteint encore la page (défaut de la fiche 132) | parcours | garder ici | non |
| 8 | bulle ouverte : la page est figée | la vue native est masquée le temps d'écrire | parcours | garder ici | partiel : `page-layer.test.ts` › « caché le temps d'une capture, puis rendu ; arrêté, la page reçoit de nouveau ses clics » (script seul, pas la vue) |
| 9 | ⌘↩ : la page redevient vivante | la vue native revient après l'enregistrement | parcours | garder ici | non |
| 10 | le clic n'atteint pas la page | le clic devient une remarque, `window.clics` reste à 0 | doublon | parcours-outils, étape 3 | `parcours-outils.mjs` étape 3 › check « remarque envoyée avec sa capture ; le clic n'a pas atteint la page » ; `page-layer.test.ts` › « le clic n'atteint pas la page : il devient une remarque, élément décrit » |
| 11 | barre « 1 remarque » | compte de la barre après une remarque | doublon | parcours-outils, étape 3 | `parcours-outils.mjs` étape 3 (`waitFor` sur `diffNotes.count` 1) |
| 12 | épingle dessinée dans la page (pixel ≈ accent) | l'épingle est rendue dans la vraie page, à la couleur d'accent du renderer | parcours | parcours-outils, étape 3 (un pixel) ou garder ici | partiel : `page-layer.test.ts` › « épingles dessinées dans une racine fermée ; un clic sur l'une rouvre sa remarque », « épingles et couleurs du renderer » (DOM simulé, pas de pixel) |
| 13 | Échap dans la bulle : remarque abandonnée, mode continue | Échap ferme la bulle sans remarque, mode Annoter gardé | composant | `PageAnnotator.test.tsx` (à créer) — le retour de la vue native n'y serait pas vu | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « Échap dans la bulle : la remarque est abandonnée, le mode continue » (dans `BrowserTab.test.tsx` plutôt qu’un `PageAnnotator.test.tsx` : le geste traverse l’onglet, `usePageAnnotation` et la bulle) ; le retour de la vue native reste e2e (#9) |
| 14 | barre « 3 remarques » (« Ajouter », page défilée) | bouton « Ajouter » de la bulle, compte après défilement | composant | `PageAnnotator.test.tsx` (à créer) | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « « Ajouter » : la barre compte les remarques ; ⌘↩ aussi » (dans `BrowserTab.test.tsx` plutôt qu’un `PageAnnotator.test.tsx` : le geste traverse l’onglet, `usePageAnnotation` et la bulle) |
| 15 | page à 150 % : l'épingle garde sa taille | taille à l'écran de l'épingle indépendante du zoom | capture | capture nocturne `28q-annoter-epingles` | partiel : `page-layer.test.ts` › « page zoomée : épingles et bulles gardent leur taille à l'écran » |
| 16 | Échap dans la page : le mode finit, le script part | une touche tapée dans la vue native termine le mode côté renderer | parcours | garder ici | partiel : `page-layer.test.ts` › « caché le temps d'une capture, puis rendu ; arrêté, la page reçoit de nouveau ses clics » (arrêt seul, pas la touche) |
| 17 | hors du mode, la page reçoit ses clics | plus aucun écouteur après le départ du script | unitaire-main | `page-layer.test.ts` | `page-layer.test.ts` › « caché le temps d'une capture, puis rendu ; arrêté, la page reçoit de nouveau ses clics » |
| 18 | remarques gardées (4) | la fin du mode ne vide pas la barre | composant | `PageAnnotator.test.tsx` (à créer) | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « fin du mode (bouton, ou Échap tapé dans la page) : les remarques sont gardées » (dans `BrowserTab.test.tsx` plutôt qu’un `PageAnnotator.test.tsx` : le geste traverse l’onglet, `usePageAnnotation` et la bulle) |
| 19 | un message : texte et deux images (3 blocs) | l'envoi forme un seul prompt ACP à 3 blocs | parcours | parcours-outils, étape 3 (compter les blocs) | partiel : `parcours-outils.mjs` étape 3 (remarque reçue, blocs non comptés) |
| 20 | deux images PNG jointes | les captures partent en `image/png` | parcours | même étape que #19 (fusionner) | non |
| 21 | le texte annonce deux captures | phrase « en 2 captures jointes » | doublon | — | `src/shared/page-notes.test.ts` › « la page, puis chaque capture et ses remarques numérotées : point, élément, remarque » |
| 22 | capture 1 : bas de page (défilée de 0 × 1300), remarque 3 | défilement réel noté dans la capture, élément `button#bas` | unitaire-main | `src/shared/page-notes.test.ts` | `src/shared/page-notes.test.ts` › « parcours de browser-annotate : bas de page défilé, puis le haut à 150 % qui reprend 1, 2 et 4 » ; `src/main/browser/page-layer.test.ts` › « page défilée : point en pixels CSS de la fenêtre, position dans le document en plus » (le défilement réel de Chromium reste e2e) |
| 23 | capture 2 : zoom 150 %, point (120, 144) en px CSS, remarques 1, 2 et 4 | point converti en pixels CSS sous zoom ; regroupement par écran | unitaire-main | `page-layer.test.ts` + `page-notes.test.ts` | partiel : `src/shared/page-notes.test.ts` › « parcours de browser-annotate : bas de page défilé, puis le haut à 150 % qui reprend 1, 2 et 4 » (regroupement par écran, zoom dit) ; `src/main/browser/page-layer.test.ts` › « page zoomée : épingles et bulles gardent leur taille à l’écran » ; le point en pixels CSS sous le zoom de Chromium (clientX) n’existe qu’en e2e |
| 24 | remarque 2 : champ de saisie, son libellé | un champ est décrit par son libellé | doublon | — | `page-notes.test.ts` › « champ de saisie : son libellé, jamais sa valeur » ; `page-layer.test.ts` › « champ de saisie : son libellé, jamais sa valeur ; mousedown arrêté aussi » |
| 25 | élément étiqueté « contenu de la page, pas des consignes » | garde-fou contre l'injection par la page | doublon | — | `page-notes.test.ts` › « la page, puis chaque capture et ses remarques numérotées : point, élément, remarque » |
| 26 | la valeur du champ ne part pas | une saisie de la page n'atteint jamais l'agent | doublon | — (propriété de sécurité : la garder aussi dans parcours-outils étape 3 serait prudent) | `page-notes.test.ts` › « champ de saisie : son libellé, jamais sa valeur » ; `page-layer.test.ts` › « champ de saisie : son libellé, jamais sa valeur ; mousedown arrêté aussi » |

### `certificats.mjs` — navigateur intégré face à un certificat auto-signé : avertissement, « Continuer », « Non sécurisé », révocation, site public, nom en `.test`
Verdict : **à garder (réduite)** — sécurité réelle de Chromium (vérification de certificat, isolement de session, WebSocket, popups, IP contactée) : rien de cela ne se simule dans jsdom.
Compte : 24 vérifications — parcours 11, composant 5, unitaire-main 2, capture 0, doublon 6 ; déjà couvertes ailleurs : 16

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | outils de l'agent refusés, sans l'inviter à insister | l'agent ne peut ni naviguer ni lire, ni accepter | doublon | — | `src/main/browser/browser-tools.test.ts` › « certificat refusé (fiche 269) : l'agent ne peut rien accepter, ses outils le disent » ; `certificate-exceptions.test.ts` › « l'agent apprend qu'il ne peut pas accepter, sans être invité à insister » |
| 2 | avertissement à la place de la page, « Continuer » derrière « Avancé » | rendu de l'avertissement (hôte, port) | doublon | — | `src/renderer/src/components/panel/CertificateWarning.test.tsx` › « « Continuer » derrière « Avancé », avec le jeton seulement » |
| 3 | vue native masquée sous l'avertissement | la page refusée n'est pas visible | parcours | garder ici | non |
| 4 | plus de ligne rouge `ERR_CERT…` sous la barre | pas de doublon d'erreur dans la barre | composant | `BrowserTab.test.tsx` (à créer) | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « adresse tapée, certificat refusé : l’avertissement, sans ligne d’erreur rouge sous la barre » ; cause côté main : `src/main/browser/browser-driver.test.ts` › « certificat refusé : l’onglet montre l’avertissement, pas d’erreur rendue à la barre » (échoue sans le correctif de `loadWithin`) |
| 5 | « Revenir en lieu sûr » sans page précédente : page vide | retour sans historique, rien d'accordé | composant | `CertificateWarning.test.tsx` + `BrowserTab.test.tsx` | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « « Revenir en lieu sûr » sans page précédente : page vide, rien d’accordé » ; `CertificateWarning.test.tsx` › « « Retour » ne touche à aucune exception » (le chargement d’`about:blank` par la vue reste e2e) |
| 6 | Avancé : hôte, port et empreinte SHA-256 exacte | empreinte lue du vrai certificat présenté | unitaire-main | `certificate-exceptions.test.ts` | partiel : `certificate-exceptions.test.ts` › « avertissement : continuer seulement pour une adresse locale ou privée » (hôte, port et empreinte exacte d’un vrai PEM dans l’avertissement) ; › « empreinte SHA-256 lue du PEM ou du DER ; illisible : rien » — le certificat réellement présenté par Chromium reste e2e |
| 7 | Continuer : la page s'affiche, « Non sécurisé », hôte et port | l'exception est réellement appliquée par Chromium | parcours | garder ici | non |
| 8 | la WebSocket `wss:` passe sous l'exception | rechargement à chaud d'un serveur de dev | parcours | garder ici | non |
| 9 | ailleurs que dans le panneau, toujours refusé | une fenêtre de l'app et `net` du main refusent encore | parcours | garder ici (sécurité) | non |
| 10 | après « Continuer », l'agent lit la page | l'exception de l'utilisateur vaut pour les outils de l'agent | parcours | garder ici | partiel : `certificate-exceptions.test.ts` › « accepté seulement pour l'hôte, le port, l'empreinte et le code exacts » |
| 11 | sous-ressource sous exception : « Non sécurisé » sur une page http | la puce s'allume aussi par une sous-ressource | parcours | garder ici | partiel : `certificate-exceptions.test.ts` › « « Non sécurisé » : une exception vraiment utilisée dans le document, encore accordée » |
| 12 | popup vers un site sous exception : refusée, avec un message | aucune exception pour une fenêtre popup | parcours | garder ici | non |
| 13 | certificat changé : l'avertissement revient, nouvelle empreinte | l'exception tient à l'empreinte | unitaire-main | `certificate-exceptions.test.ts` | `certificate-exceptions.test.ts` › « accepté seulement pour l'hôte, le port, l'empreinte et le code exacts » |
| 14 | « Se souvenir » : seul le certificat retenu écrit dans `approvals.json` | persistance (hôte, port, empreinte, code) | doublon | — | partiel : `src/main/approvals.test.ts` › « certificats (fiche 269) : session en mémoire, retenus relus, révocation dite » |
| 15 | WebSocket rouverte sous le certificat retenu | même mécanisme que #8 | doublon | — (de #8) | non (doublon de #8 dans la suite) |
| 16 | Réglages : « toujours » d'abord, puis l'ancien de la session ; empreinte en infobulle | liste des exceptions de Réglages › Confidentialité | composant | `PrivacySettings` : test à créer | `src/renderer/src/components/settings/PrivacySettings.test.tsx` › « dans l’ordre du main (« toujours » d’abord), « (ancien) », empreinte en infobulle ; révoquer après confirmation » ; tri : `approvals.test.ts` › « certificats (fiche 269) : retenus d'abord, « ancien » quand le serveur en présente un autre » |
| 17 | révoqué : plus rien dans `approvals.json` | la révocation efface la persistance | doublon | — | `approvals.test.ts` › « certificats (fiche 269) : session en mémoire, retenus relus, révocation dite » ; `src/main/ipc.test.ts` › « certificat révoqué (fiche 269) : exception vérifiée avant d'être oubliée » |
| 18 | révoqué : WebSocket ouverte fermée | connexions coupées à la révocation | parcours | garder ici | non |
| 19 | révoqué : la page rechargée retombe sur l'avertissement | révocation effective dans Chromium | parcours | garder ici | non |
| 20 | « Revenir en lieu sûr » : dernière page d'un autre site | retour dans l'historique réel de la vue | parcours | garder ici | partiel : `CertificateWarning.test.tsx` › « « Retour » ne touche à aucune exception » |
| 21 | puce « Non sécurisé » : « Certificat accepté pour <site> » | menu de la puce | composant | `BrowserTab.test.tsx` (à créer) | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « « Non sécurisé » : hôte et port visibles, menu « Certificat accepté pour… », « Ne plus accepter » révoque » ; › « « Non sécurisé » sur le port 443 : le site sans port » |
| 22 | puce : « Ne plus accepter » révoque | geste de révocation depuis la barre | composant | `BrowserTab.test.tsx` (à créer) ; l'effet dans Chromium reste vu par #19 | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « « Non sécurisé » : hôte et port visibles, menu « Certificat accepté pour… », « Ne plus accepter » révoque » ; `ipc.test.ts` › « certificat révoqué (fiche 269) : exception vérifiée avant d'être oubliée » (l’effet dans Chromium reste vu par #19) |
| 23 | site public : pas de « Continuer », « Ouvrir dans le navigateur », « Détails » | refus d'emblée hors réseau local | doublon | — | `CertificateWarning.test.tsx` › « site public : refus dit d'emblée, « Ouvrir dans le navigateur », « Détails » sans « Continuer » » ; `certificate-exceptions.test.ts` › « avertissement : continuer seulement pour une adresse locale ou privée » |
| 24 | nom en `.test` vers une IP locale : « Continuer » après vérification | l'IP réellement contactée par Chromium est lue puis vérifiée | parcours | garder ici | partiel : `certificate-exceptions.test.ts` › « `.test` et `.local` : l'IP réellement contactée doit être privée » |

### `roles-gestion.mjs` — section Équipe, assistant de création de rôle, « Créer et essayer », « Enregistrer comme rôle », Réglages › Rôles, changement de langue
Verdict : **disparaît entièrement** — à condition d'une nouvelle étape de `parcours-reglages` (créer un rôle de projet, fichier écrit, l'essayer ; puis relecture des rôles fournis au changement de langue de l'étape 2) et d'un `TeamSection.test.tsx` ; tout le reste est déjà en Vitest.
Compte : 23 vérifications — parcours 3, composant 6, unitaire-main 2, capture 0, doublon 12 ; déjà couvertes ailleurs : 21

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | section Équipe : sept rôles actifs (le relecteur du projet remplace le fourni) | contenu et titre de la section | composant | `src/renderer/src/components/roles/TeamSection.test.tsx` (à créer) | partiel : `src/main/roles/library.test.ts` › « projet > personnel > fourni à nom égal ; un fichier invalide est signalé sans bloquer les autres » |
| 2 | chaque tuile a un nom accessible | `aria-label` « Confier à … » | composant | `TeamSection.test.tsx` (à créer) | non |
| 3 | infobulle au survol : nom et description traduite | infobulle de la tuile | composant | `TeamSection.test.tsx` (à créer) | non |
| 4 | étape 1 vide : trois erreurs, on reste | validation de l'étape « Qui » | doublon | — | `RoleWizard.test.tsx` › « étape 1 : « Suivant » montre les erreurs de l'étape sans avancer » |
| 5 | identifiant tiré du nom, icône suggérée, aperçu | brouillon dérivé du libellé | doublon | — | `RoleWizard.test.tsx` › « les trois étapes au clavier, modèle présélectionné, enregistrement dans le projet » ; `role-draft.test.ts` › « tire l'identifiant du libellé : accents, espaces, ponctuation, longueur », « suggère icône et couleur d'après le libellé, jusqu'à un choix à la main » |
| 6 | lecture seule reprise du modèle | le modèle choisi impose la lecture seule | doublon | — | `RoleWizard.test.tsx` › « les trois étapes au clavier, modèle présélectionné, enregistrement dans le projet » |
| 7 | fichier `.bobine/roles/expert-perf.md` écrit | assistant → IPC → fichier réel du projet | parcours | `parcours-reglages`, nouvelle étape « créer un rôle et l'essayer » | partiel : `RoleWizard.test.tsx` (appel `save`) ; `library.test.ts` › « enregistre, renomme et supprime un rôle ; refuse un nom pris et un rôle invalide » |
| 8 | fille lancée depuis le jeton : avatar sous sa mère, saisie vidée | lancement réel d'une fille avec rôle | parcours | même nouvelle étape de `parcours-reglages` | partiel : `parcours-reglages.mjs` étape 10 (`@ux-ui-expert`, carte du rôle ; pas l'avatar) ; `parcours-matinee.mjs` étape 6 |
| 9 | clic sur une tuile : jeton, focus, « Sera confié à… » | un seul chemin pour invoquer un rôle | composant | `TeamSection.test.tsx` (à créer) | partiel : `roles-store.test.ts` › « invokeRole : remis à la saisie abonnée » ; `RoleComposer.test.tsx` (`role-destination`) |
| 10 | « Enregistrer comme rôle » seulement pour un travail sans rôle | règle d'affichage sur la carte du travail | composant | `WorkCard.test.tsx` (à compléter) | partiel : `save-as-role.test.ts` › « seulement pour une fille sans rôle, finie avec succès, dont la consigne est connue » |
| 11 | assistant prérempli : la demande devient la consigne | préremplissage | doublon | — | `save-as-role.test.ts` › « préremplissage : consigne de la fille, son agent, son modèle, lecture seule si rien modifié » |
| 12 | assistant prérempli : l'agent de la fille | préremplissage | doublon | — | idem #11 |
| 13 | Réglages : le relecteur du projet dit qu'il remplace le fourni | groupes et mention « Remplace » | doublon | — | `RolesSettings.test.tsx` › « trois groupes, rôle de projet qui en remplace un autre, rôle désactivé, fichier écarté » |
| 14 | rôle fourni : description dans la langue de l'interface | traduction des rôles fournis | doublon | — | `src/main/roles/builtin.test.ts` › « suivent la langue de l'interface au moment de la lecture » ; `RoleComposer.test.tsx` › « rôle fourni : description reçue du main (déjà dans la langue de l'interface), affichée et cherchée » |
| 15 | fichier écarté : chemin relatif (complet en infobulle) et raison | signalement d'un fichier invalide | doublon | — | `RolesSettings.test.tsx` › « trois groupes, rôle de projet qui en remplace un autre, rôle désactivé, fichier écarté » |
| 16 | rôle du projet : « Partagé par git » | mention dans l'édition | doublon | — | `RolesSettings.test.tsx` › « supprimer un rôle du projet demande confirmation, puis revient à la liste » (vérifie `role-edit-git`) |
| 17 | modifier : description réécrite dans le fichier | réécriture du fichier | unitaire-main | `library.test.ts` | partiel : `library.test.ts` › « enregistre, renomme et supprime un rôle ; refuse un nom pris et un rôle invalide » ; `RolesSettings.test.tsx` › « modifier un rôle personnel : renommé avec `previousName`, la page suit » |
| 18 | désactiver : pâli, quitte la section Équipe | effet croisé Réglages → barre latérale | composant | `TeamSection.test.tsx` (à créer) — le rafraîchissement par l'IPC n'y serait pas vu | partiel : `RolesSettings.test.tsx` › « activer un rôle passe par le main, puis la liste se relit » ; `library.test.ts` › « un rôle désactivé n'est plus proposé, mais reste listé » |
| 19 | supprimer : fichiers effacés, état vide, le fourni revient | suppression et retour du rôle fourni | unitaire-main | `library.test.ts` | partiel : `library.test.ts` › « enregistre, renomme et supprime un rôle… », « projet > personnel > fourni à nom égal… » ; `RolesSettings.test.tsx` › « aucun rôle à soi : l'état vide propose de créer, et « Nouveau rôle » ouvre l'assistant » |
| 20 | rôle fourni : pas de « Supprimer », bandeau | édition d'un rôle fourni | doublon | — | `RolesSettings.test.tsx` › « un rôle fourni s'enregistre en rôle personnel du même nom, sans « Supprimer » » |
| 21 | rôle fourni : description et consigne dans la langue (ADR-0046) | consigne traduite | doublon | — | `builtin.test.ts` › « chaque langue donne sept rôles valides, mêmes noms, icônes, couleurs et lecture seule », « suivent la langue de l'interface au moment de la lecture » |
| 22 | langue changée : liste et édition relues | changement de langue → le main relit les rôles → l'écran suit | parcours | `parcours-reglages`, étape 2 (ajouter la relecture d'un rôle fourni) | partiel : `builtin.test.ts` › « suivent la langue de l'interface au moment de la lecture » |
| 23 | langue d'origine : rôles relus | retour à la langue initiale | doublon | — (de #22) | partiel : idem #22 |

### `limite-etapes.mjs` — limite d'étapes de l'agent (imitation de Bob 2.0.9) : carte, refus, « Rouvrir la session », « Nouvelle session avec le résumé »
Verdict : **disparaît entièrement** — à condition que la réouverture réelle (#5) devienne une étape de `parcours-pannes` ; le reste est couvert par `TurnGuards.test.tsx`, `agent-host-turn-limit.test.ts` et `trace-replay.test.ts`.
Compte : 7 vérifications — parcours 1, composant 2, unitaire-main 0, capture 0, doublon 4 ; déjà couvertes ailleurs : 7

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | carte « s'est arrêté avant la fin », plus la ligne grise | `max_turn_requests` donne une carte | doublon | — | `src/shared/turn-limit.test.ts` › « fin en max_turn_requests : une carte à la place de l'avis gris » ; `TurnGuards.test.tsx` › « travail arrêté : « Continuer » seul » |
| 2 | un seul bouton principal « Continuer » ; pas de « Terminé ✓ » | boutons de la carte, pas de résumé de tour | composant | `TurnGuards.test.tsx` (ajouter l'absence de `turn-summary`, ou `Transcript.test.tsx`) | partiel : `TurnGuards.test.tsx` › « travail arrêté : « Continuer » seul » |
| 3 | « Continuer » refusé : carte « refuse de continuer ici », la première dit le choix | deux cartes différentes | doublon | — | `agent-host-turn-limit.test.ts` › « travail arrêté, puis refus sans rien faire : deux cartes différentes, réouverture proposée » ; `turn-limit.test.ts` (shared) › « refus sans activité : la carte le dit, avec la réouverture si le main la propose » |
| 4 | deux choix : « Rouvrir… » (principal), « Nouvelle session… » | ordre et bouton principal | doublon | — | `TurnGuards.test.tsx` › « refus : « Rouvrir la session et continuer » en premier, puis la session neuve » |
| 5 | réouverture : même session, message renvoyé une fois, l'agent reprend | relance réelle du processus + `session/load` avec rejeu tardif (comme Bob) | parcours | `parcours-pannes`, nouvelle étape après l'étape 6 (scénario `limite-etapes-session`, `MOCK_AGENT_REPLAY=late`) | partiel : `agent-host-turn-limit.test.ts` › « « Rouvrir la session et continuer » : agent relancé, même session, message renvoyé une fois » ; `trace-replay.test.ts` › « Bob 2.0.9, limite d'étapes : travail arrêté, refus sans rien faire, fin normale après rechargement » |
| 6 | refusé encore : seule « Nouvelle session avec le résumé » | limite qui survit à la relance | doublon | — | `TurnGuards.test.tsx` › « refus sans réouverture possible : la session neuve seule, en bouton principal » ; `agent-host-turn-limit.test.ts` › « refusé encore après la réouverture : seule la session neuve reste, qui repart avec le résumé » |
| 7 | session neuve : repère « Nouvelle session » avec la raison, l'agent répond | `handover-divider` `data-reason=turn-limit` et son texte | composant | `Transcript.test.tsx` (à compléter : repère de passation, raison `turn-limit`) | partiel : `agent-host-turn-limit.test.ts` › « refusé encore après la réouverture… » ; `turn-limit.test.ts` (shared) › « session neuve pour cause de limite : le contexte joint dit pourquoi (en anglais) » ; le repère n'est vu qu'en e2e (`handover.mjs`, `custom-agent.mjs`, autres raisons) |

### `mermaid.mjs` — diagrammes Mermaid : chargement paresseux, dessin réel, bloc invalide, couleurs du thème, code/diagramme, agrandir
Verdict : **disparaît entièrement** — à condition qu'un bloc Mermaid (et la vérification du chargement paresseux) rejoigne les réponses Markdown de `parcours-longue` étape 1 ; le reste va dans `MermaidBlock.test.tsx` ou en capture.
Compte : 7 vérifications — parcours 2, composant 1, unitaire-main 0, capture 1, doublon 3 ; déjà couvertes ailleurs : 3

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Mermaid pas chargé tant qu'aucun diagramme | découpage Vite réel : le morceau `Diagram` n'est pas préchargé | parcours | `parcours-longue`, étape 1 (avant le premier diagramme) — ou un contrôle du manifeste de build | non |
| 2 | organigramme et séquence dessinés | la vraie bibliothèque dessine dans Chromium (jsdom n'a pas de mise en page) | parcours | `parcours-longue`, étape 1 | partiel : `MermaidBlock.test.tsx` › « bloc ```mermaid dessiné ; « Voir le code » et retour » (`renderMermaid` simulé) |
| 3 | Mermaid chargé à l'arrivée du diagramme | complément de #1 | doublon | — (de #1) | non (doublon de #1 dans la suite) |
| 4 | bloc invalide : le code reste, avec l'erreur | erreur de rendu affichée | doublon | — | `MermaidBlock.test.tsx` › « invalide : le code reste, avec l'erreur de Mermaid en une ligne » |
| 5 | redessiné aux couleurs de la variante | changement de palette → nouveau rendu aux jetons du thème | capture | capture nocturne `m0-mermaid-<variante>` (les variables CSS réelles ne sont pas calculées par jsdom) | non |
| 6 | « Voir le code » puis le diagramme | bascule code/diagramme | doublon | — | `MermaidBlock.test.tsx` › « bloc ```mermaid dessiné ; « Voir le code » et retour » |
| 7 | agrandi dans une fenêtre, refermée par Échap | dialogue d'agrandissement | composant | `MermaidBlock.test.tsx` (à compléter) | non |

### `dossiers.mjs` — plusieurs dossiers par conversation : ajout, transmission à l'agent (`additionalDirectories`), ligne de contexte, retrait, agent sans la capacité
Verdict : **disparaît entièrement** — à condition que la transmission réelle (#3) devienne une étape de journée (par ex. `parcours-reglages`, agent factice avec `MOCK_AGENT_DIRECTORIES`) ; le reste est en Vitest.
Compte : 8 vérifications — parcours 1, composant 1, unitaire-main 0, capture 0, doublon 6 ; déjà couvertes ailleurs : 8

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | agent qui prend d'autres dossiers : « Ajouter un dossier… », aucun dossier | capacité annoncée → bouton, rien envoyé | doublon | — | `SessionFolders.test.tsx` › « avec la capacité : dossiers listés, ajout, retrait, affichage » ; `src/main/agent/additional-directories.test.ts` › « agent qui annonce la capacité : reçus à session/new, puis à la réouverture » |
| 2 | dossier ajouté : listé sous le dossier de travail, par son nom | dialogue du main → IPC → liste | composant | `SessionFolders.test.tsx` | partiel : `SessionFolders.test.tsx` › « avec la capacité : dossiers listés, ajout, retrait, affichage » ; `src/main/conversations/additional-directories.test.ts` › « ajout : mémorisé, sans doublon ni le dossier de travail ; agent prêt : session rouverte » |
| 3 | session rouverte : l'agent a reçu le dossier | `additionalDirectories` transmis par ACP à un vrai processus agent | parcours | `parcours-reglages`, nouvelle étape (onglet Session, ajouter un dossier) | partiel : `agent/additional-directories.test.ts` › « agent qui annonce la capacité : reçus à session/new, puis à la réouverture » |
| 4 | le message dit l'autre dossier (ligne D13) | ligne de contexte au premier message après changement | doublon | — | `agent/additional-directories.test.ts` › « ligne de contexte (D13) : au premier message, puis une fois par changement » |
| 5 | liste inchangée : pas de ligne au message suivant | ligne envoyée une seule fois | doublon | — | `agent/additional-directories.test.ts` › « directoriesContext : rien sans changement ; ajouts, retraits, autre session » |
| 6 | dossier retiré : plus reçu, le message le dit | retrait transmis et annoncé | doublon | — | `agent/additional-directories.test.ts` › « directoriesContext : rien sans changement ; ajouts, retraits, autre session » ; `conversations/additional-directories.test.ts` › « retrait du dernier : le champ disparaît » |
| 7 | agent sans la capacité : dossier gardé, « non transmis », pas d'ajout | dégradation propre (comme Bob) après relance | doublon | — | `SessionFolders.test.tsx` › « agent qui ne les prend pas : dossiers gardés, « non transmis », pas d'ajout » (la relecture après redémarrage n'est pas vue) |
| 8 | agent sans la capacité : rien envoyé | pas de champ refusé par l'agent | doublon | — | `agent/additional-directories.test.ts` › « agent qui ne l'annonce pas : rien envoyé (l'agent factice refuserait la session) » |

#### Risques repérés (lot)

- **Navigateur intégré (annoter, certificats)** : la vue native est un `WebContentsView` piloté par le main ; un test de composant ne voit ni son gel/dégel, ni les entrées réelles (molette, clic, Échap tapé dans la page), ni le pixel de l'épingle, ni le zoom Chromium. Les tests de `page-layer.test.ts` tournent sur un DOM simulé : la cascade CSS d'une vraie page (curseur, `!important`) et le monde isolé réel n'y sont pas.
- **Sécurité des certificats** : la vérification réelle de Chromium, l'isolement de la session du panneau (fenêtre de l'app et `net` refusent), les popups, la fermeture des WebSocket à la révocation et l'IP réellement contactée pour un nom `.test` n'existent qu'en e2e. Ne pas réduire en dessous des 11 vérifications `parcours`.
- **Valeur d'un champ de la page** (browser-annotate #26) : couverte par deux tests unitaires, mais c'est une propriété de sécurité de bout en bout ; la garder aussi dans `parcours-outils` étape 3 coûte une ligne.
- **Rôles** : la chaîne assistant → IPC → fichier → relecture à chaud → section Équipe, et la relecture des rôles fournis au changement de langue, traversent main et renderer ; les tests isolés simulent chaque bout. La section Équipe n'a aujourd'hui aucun test de composant.
- **Limite d'étapes** : la réouverture dépend d'une vraie relance du processus agent et du rejeu tardif de `session/load` (comportement observé de Bob 2.0.9) ; `agent-host-turn-limit.test.ts` utilise une connexion simulée. Le repère de passation (`handover-divider`) n'a pas de test de composant.
- **Mermaid** : jsdom ne met rien en page, donc le dessin réel, le chargement paresseux (découpage Vite) et les couleurs lues des variables CSS ne se voient qu'avec l'app ou en capture ; `MermaidBlock.test.tsx` simule `renderMermaid`.
- **Dossiers** : la transmission `additionalDirectories` à un vrai processus et la relecture de l'historique après redémarrage avec un agent sans la capacité ne sont pas vues par `SessionFolders.test.tsx`. La déplacer dans une journée suppose d'y lancer l'agent factice avec `MOCK_AGENT_DIRECTORIES=1`, ce qui peut gêner les autres étapes.
- **Remplaçants « à créer »** : `BrowserTab.test.tsx`, `PageAnnotator.test.tsx`, `TeamSection.test.tsx`, un test de `PrivacySettings` (liste des certificats), des compléments à `MermaidBlock.test.tsx`, `WorkCard.test.tsx`, `Transcript.test.tsx` et `page-layer.test.ts` doivent exister **avant** toute suppression. Faits le 2026-11-24 : `BrowserTab.test.tsx` (qui couvre aussi la bulle de `PageAnnotator`), `PrivacySettings.test.tsx`, compléments à `page-layer.test.ts` ; restent `TeamSection`, `MermaidBlock`, `WorkCard`, `Transcript`.


## Lot 4

Suites : `historique-saisie.mjs`, `git.mjs`, `worktree-cycle.mjs`, `terminal.mjs`, `base.mjs`, `language.mjs`.
Convention : « Déjà couvert ? » = « oui » seulement si un test existant vérifie la même chose (cité) ;
le compte « déjà couvertes ailleurs » ne compte que ces « oui » (pas les « partiel »).
Étapes de parcours : numéros de la fiche 277.

### `historique-saisie.mjs` — rappel des messages envoyés par ↑ / ↓ dans la saisie (fiche 227), dans un dépôt jetable avec un message confié à un rôle (fille)
Verdict : **à garder (réduite)** — seuls le repli réel des lignes longues (mesure du navigateur) et la saisie étroite pendant un tour demandent la vraie app ; tout le reste est déjà vérifié par `SentHistory.test.tsx` et `composer-keys.test.ts`
Compte : 23 vérifications — parcours 4, composant 4, unitaire-main 1, capture 0, doublon 14 ; déjà couvertes ailleurs : 15

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | conversation neuve : pas de rappel | rien proposé sans historique | doublon | — | oui : `SentHistory.test.tsx › conversation sans historique : ↑ ne fait rien, pas de rappel` |
| 2 | conversation neuve : ↑ ne fait rien | ↑ sans historique laisse la saisie vide | doublon | — | oui : même test |
| 3 | saisie vide : rappel « ↑ Messages précédents » | le rappel apparaît, focus et saisie vide | doublon | — | oui : `SentHistory.test.tsx › rappel « ↑ Messages précédents » : saisie vide avec le focus, tant qu’il n’a pas servi 3 fois` |
| 4 | ↑ : dernier envoyé (3/3), jeton du rôle et « Sera confié à… » | le message rappelé garde son jeton de rôle et sa ligne de destination | doublon | — | oui : `SentHistory.test.tsx › ↑ : le dernier envoyé (6/6)…` et `› jetons de rôle repris (ligne « Sera confié à… »)…` ; enregistrement côté main : `roles-children.test.ts › `@rôle` en premier message d’une conversation neuve : elle entre dans l’historique…` |
| 5 | position annoncée poliment | annonce `aria-live` « 3 sur 3 » | doublon | — | oui : `SentHistory.test.tsx › ↑ sur 1/6 ne fait rien ; annonce polie de la position` |
| 6 | aucun menu ouvert | ni menu « / » ni menu `@` au rappel | composant | `SentHistory.test.tsx` (ajouter le menu `@`) | partiel : `SentHistory.test.tsx › une commande reprise n’ouvre pas le menu « / »` (pas le menu fichiers) |
| 7 | ↑ : 2/3, curseur fin de ligne 1, champ remonté, jeton retiré | message sur plusieurs lignes : curseur et défilement du champ | composant | `SentHistory.test.tsx` | partiel : `visual-lines.test.ts › fin de la première ligne affichée…` ; `scrollTop` = 0 non vérifiable en jsdom (toujours 0) |
| 8 | lignes d’abord : ↓ descend d’une ligne, même message | ↓ hors dernière ligne ne change pas de message | doublon | — | oui : `composer-keys.test.ts › lignes d’abord : hors de la première (↑) ou de la dernière ligne (↓), le curseur bouge` |
| 9 | lignes d’abord : ↑ remonte en ligne 1, même message | idem en remontant | doublon | — | oui : même test |
| 10 | ligne repliée : curseur en fin de 1ʳᵉ ligne affichée | la ligne longue repliée par le navigateur compte comme deux | parcours | garder ici | partiel : `visual-lines.test.ts › la ligne repliée compte pour deux…` (mesures simulées, pas le vrai repli de la police) |
| 11 | ↑ sur 1/3 : rien, pas de boucle | borne haute de l’historique | doublon | — | oui : `SentHistory.test.tsx › ↑ sur 1/6 ne fait rien…` ; `composer-keys.test.ts › ↑ sur 1/10 ne fait rien ; ↓ sur 10/10 rend la saisie vide` |
| 12 | replis comptés : ↓ dans la même ligne réelle | ↓ parcourt les lignes affichées d’une ligne repliée | parcours | garder ici | partiel : `visual-lines.test.ts › la ligne repliée compte pour deux : première, milieu, dernière` |
| 13 | replis comptés : ↑ depuis la 2ᵉ ligne affichée | ↑ remonte sans changer de message | parcours | garder ici | partiel : même test |
| 14 | ↓ depuis la dernière ligne : message suivant, curseur en fin | passage au message suivant | composant | `SentHistory.test.tsx` (ajouter le curseur en fin) | partiel : `SentHistory.test.tsx › ↑ : le dernier envoyé (6/6), puis les précédents ; ↓ revient…` |
| 15 | message modifié : plus de pastille, ↑ ne change plus de message | une modification en fait un brouillon | doublon | — | oui : `SentHistory.test.tsx › une modification fait un brouillon…` ; `composer-keys.test.ts › message modifié (plus d’index)…` |
| 16 | (boucle 760 / 640 / 1280 px panneau ouvert) invite et rappel disjoints (≥ 8 px), « ↑ » seul ou entier, invite entière | pendant un tour, l’invite longue et le rappel ne se chevauchent jamais, à toutes les largeurs | parcours | `parcours-longue`, étape 4 (fenêtre étroite puis large : ajouter un tour en cours et le rappel) | non (CSS réel, largeurs réelles) |
| 17 | (attente) panneau replié à 760 px, rouvert seul à 1280 px, état mémorisé | repli automatique du panneau faute de place | doublon | — | oui : `usePanel.test.ts › replié à 760 px : fermé dans l’état et dans le stockage ; rouvert seul à 1280 px` |
| 18 | (attente) un seul appui ferme le panneau rouvert par l’app | pas de double appui après réouverture automatique | composant | `usePanel.test.ts` | partiel : `usePanel.test.ts › replié : un seul appui le rouvre, même dans la fenêtre étroite, et il y reste` (sens inverse) |
| 19 | commande reprise telle que tapée (4/4), menu « / » fermé | la commande, pas sa consigne ; doublon consécutif fusionné | doublon | — | oui : `SentHistory.test.tsx › à l’envoi : le texte tapé (la commande, pas sa consigne)…`, `› une commande reprise n’ouvre pas le menu « / »` ; `sent-history.test.ts › doublons consécutifs fusionnés…` |
| 20 | Échap : saisie vidée, la réponse continue | Échap quitte l’historique avant d’arrêter | doublon | — | oui : `SentHistory.test.tsx › Échap vide la saisie et quitte l’historique avant d’arrêter la réponse` |
| 21 | second Échap : la réponse s’arrête | le second Échap arrête le tour | doublon | — | oui : `composer-keys.test.ts › Échap quitte l’historique avant d’arrêter la réponse ; le second arrête` |
| 22 | après trois utilisations, plus de rappel | le rappel s’efface pour de bon | doublon | — | oui : `SentHistory.test.tsx › rappel déjà appris (3 utilisations) : rien` ; `settings-store.test.ts › rappel « ↑ Messages précédents » (fiche 227) : 3 utilisations, puis plus rien…` |
| 23 | fille : son historique commence par sa consigne (1/1) | l’historique de la fille ne reprend rien de la mère | unitaire-main | — | oui : `children.test.ts › lancée depuis la mère : worktree, consigne, compte rendu, nouvelles transmises une fois` (vérifie `sentHistory` de la fille et de la mère) |

### `git.mjs` — barre de titre, branche git dans la saisie, « Committer » hors worktree, fondus et flèche du fil (fiches 049, 123, 246)
Verdict : **disparaît entièrement** — le point de la branche après un tour de l’agent passe dans `parcours-matinee` étape 5 ; le commit réel est couvert par `parcours-matinee` étape 7 et les tests du main ; le reste est du composant ou de la capture
Compte : 19 vérifications — parcours 1, composant 8, unitaire-main 2, capture 4, doublon 4 ; déjà couvertes ailleurs : 6

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | branche sous la saisie ; ni bouton terminal ni titre (brouillon) | puce de branche dans le contexte de la saisie, en-tête vide pour un brouillon | composant | `Composer.test.tsx` + test de l’en-tête (à créer) | non |
| 2 | (attente) après le tour de l’agent : point sur la branche | les fichiers écrits par l’agent remontent dans l’état git sans action | parcours | `parcours-matinee`, étape 5 (vérifier `git-branch[data-dirty=true]`) | partiel : `parcours-matinee` étape 7 attend le point retiré après le commit ; `useGitStatus.test.ts › « Committer puis fusionner » ailleurs : le point « non commité » disparaît…` |
| 3 | titre de la conversation aligné à gauche (< 40 px) | position du titre dans l’en-tête | capture | capture nocturne | non |
| 4 | « Renommer » depuis le titre : en place et dans la barre latérale | menu du titre → renommage partagé | composant | test du menu du titre (à créer) | partiel : `manager.test.ts › titre proposé par l’agent ; renommage prioritaire ; suppression` (main seul) |
| 5 | « Supprimer » depuis le titre : même confirmation, page de nouveau cliquable | même boîte que la barre latérale ; Radix rend les clics | composant | test du menu du titre (à créer) | partiel : `menus-modal.test.ts › are all non-modal: a modal Radix menu that opens a dialog leaves the page unclickable` ; `DeleteDialog.test.tsx` |
| 6 | clic sur la branche : « Modifications » vue Git, 2 fichiers | la puce ouvre la vue Git sur l’état du dossier | composant | `ChangesTab.test.tsx` | partiel : `ChangesTab.test.tsx › espace Code : la vue Git et son texte, comme avant` |
| 7 | vue Git hors worktree : cases et « Committer », ni PR ni fusion | actions propres au dossier ordinaire | composant | `CommitBars.test.tsx` | partiel : `CommitBars.test.tsx › fichiers cochés, message proposé modifiable, commit, puis « Défaire »` ; `worktree-outcome.test.ts › pas de dépôt distant : ni bouton ni raison…` |
| 8 | message rédigé par l’agent : le seul fichier coché | rédaction par l’agent limitée aux cochés | doublon | — | oui : `commit-draft.test.ts (main) › réponse normale : message de l’agent, fichiers cochés…` ; `CommitChooser.test.tsx › un fichier décoché ne part pas, et le message ne le cite pas` ; agent réel : `parcours-matinee` étape 7 |
| 9 | message reçu : curseur à la fin | focus prêt à compléter | doublon | — | oui : `CommitBars.test.tsx › décocher met le message à jour ; curseur à la fin` |
| 10 | cases changées puis remises : message gardé, sans relance | pas de nouvelle rédaction pour un aller-retour | composant | `CommitDraft.test.tsx` (ajouter l’aller-retour) | partiel : `CommitDraft.test.tsx › cases changées après la réponse : le message retouché reste, « Rédiger à nouveau » le remplace` |
| 11 | commit dans le dossier de la conversation : le fichier coché seulement | git réel : seul README part | unitaire-main | — | oui : `worktree-ipc.test.ts › « Committer » hors worktree : dans le dossier de la conversation (fiche 123)` ; `worktree-cycle.test.ts › fichiers cochés seulement, puis « Défaire » tant que c’est le dernier` |
| 12 | « Défaire » : commit défait, modifications revenues | annulation réelle du dernier commit | unitaire-main | — | oui : `worktree-cycle.test.ts › fichiers cochés seulement, puis « Défaire » tant que c’est le dernier` |
| 13 | pastille des modifications : vue de la conversation | la pastille ouvre la vue Conversation | composant | `SessionChanges.test.tsx` ou test du panneau | partiel : `SessionChanges.test.tsx › après travail : ce que la conversation a modifié, qui ouvre la vue Conversation` |
| 14 | boutons de la réponse et indicateur séparés (≥ 2 px) | pas de chevauchement pendant un tour | capture | capture nocturne | non |
| 15 | fondus du fil haut / bas selon le défilement | fondus pilotés par la ligne de temps CSS | capture | capture nocturne | non (CSS `scroll-timeline`, invisible en jsdom) |
| 16 | en bas du fil : pas de flèche | flèche absente en bas | doublon | — | oui : `useThreadScroll.test.ts › le fil s’ouvre en bas, sans flèche ; le fil et son contenu sont observés` |
| 17 | flèche « Aller en bas » : montrée en remontant, ramène en bas | flèche et retour en bas | doublon | — | oui : `useThreadScroll.test.ts › remonté : la flèche se montre…` et `› « Aller en bas » : défilement doux, et le suivi reprend` |
| 18 | conversation plus courte que la page : pas de flèche | la flèche d’un fil remonté ne passe pas à une conversation courte | composant | `useThreadScroll.test.ts` (changement de conversation) | partiel : `useThreadScroll.test.ts › le fil s’ouvre en bas, sans flèche…` |
| 19 | libellés du haut de la barre latérale alignés | alignement « Nouvelle conversation » / « Mon activité » | capture | capture nocturne | non |

### `worktree-cycle.mjs` — cycle complet d’un worktree ouvert depuis le menu du dossier : départ, commit, fusion avec conflit résolu par l’agent, nettoyage, orphelins (fiches 110, 123, 126)
Verdict : **à garder (réduite)** — la bascule en worktree depuis le menu du dossier et la résolution d’un conflit par l’agent sur un seul worktree n’existent dans aucun parcours (`parcours-deleguer` passe par la fusion groupée, un autre chemin) ; le reste est couvert par `worktree-cycle.test.ts` / `worktree-ipc.test.ts` ou relève du composant
Compte : 19 vérifications — parcours 2, composant 6, unitaire-main 5, capture 1, doublon 5 ; déjà couvertes ailleurs : 9

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | (attente) menu du dossier › worktree : la conversation passe sur `bobine/…` | création réelle du worktree et agent relancé dedans | parcours | garder ici, ou nouvelle étape de `parcours-deleguer` | partiel : `worktrees.test.ts › création depuis un sous-dossier, exclusion locale, état, suppression` (main seul) |
| 2 | départ explicite : une carte en tête du fil (branche, commit, sujet, non commité), pas d’avis | la carte de départ remplace les avis | composant | `WorktreeStart.test.tsx` (+ place en tête du fil) | partiel : `WorktreeStart.test.tsx › branche et commit en code, date, sujet, modifications non commitées, « Vue Git »` ; `worktree-cycle.test.ts › départ relevé à la création…` |
| 3 | le haut du fil n’est pas dans le fondu de l’en-tête (≥ 28 px) | espace sous l’en-tête | capture | capture nocturne | non |
| 4 | « Vue Git » ouvre l’onglet Modifications en vue Git | bouton de la carte → panneau | composant | `WorktreeStart.test.tsx` | partiel : même test (présence du bouton) |
| 5 | vue Git du worktree : départ rappelé, avertissement, une case par fichier | barre du worktree | composant | `CommitBars.test.tsx` | partiel : `CommitChooser.test.tsx › la liste complète, toutes cochées…` |
| 6 | sans dépôt distant : ni « Ouvrir une PR » ni raison | pas de bouton inutile | doublon | — | oui : `worktree-outcome.test.ts › pas de dépôt distant : ni bouton ni raison, même si gh manque` |
| 7 | « Fusionner » bloqué tant qu’il reste du non commité (infobulle) | fusion impossible avec du non commité | composant | `CommitBars.test.tsx` | partiel : `worktree-cycle.test.ts (shared) › fusion : à committer d’abord, rien à fusionner, ou reprise d’une fusion arrêtée` (texte seul) |
| 8 | message rédigé par l’agent : Conventional Commits, seul fichier coché | rédaction limitée aux cochés | doublon | — | oui : `commit-draft.test.ts (main) › réponse normale…` ; `CommitChooser.test.tsx › un fichier décoché ne part pas, et le message ne le cite pas` |
| 9 | commit fait dans le worktree : README seul | git réel, cochés seulement | unitaire-main | — | oui : `worktree-cycle.test.ts › état, commit des fichiers cochés seulement, annulation, journal` |
| 10 | commit défait : branche revenue au départ | annulation réelle | unitaire-main | — | oui : même test |
| 11 | second commit : les deux fichiers | recocher puis tout committer | doublon | — | oui : même test |
| 12 | fusion refusée d’avance : notes.txt non commité dans le dossier principal | refus avant toute action, fichiers listés | doublon | — | oui : `worktree-cycle.test.ts › base extraite avec des modifications : refusée d’avance, fichiers listés (fiche 123)` ; `CommitBars.test.tsx › « Fusionner » refusé : encadré, puis « Mettre de côté » fusionne et le dit` |
| 13 | conflit : notes.txt déjà revenu dans le dossier principal | la mise de côté est remise même si la fusion s’arrête | unitaire-main | `worktree-cycle.test.ts` | partiel : `worktree-cycle.test.ts › « Mettre de côté » : stash, fusion, remise, entrée retirée (fiche 123)` ; `CommitBars.test.tsx › « Mettre de côté » retenu pour la reprise après un conflit` |
| 14 | fusion arrêtée : README.md en conflit, listé | conflit détecté et listé | unitaire-main | — | oui : `worktree-cycle.test.ts › conflit : listé, abandon, puis résolution et reprise` |
| 15 | l’agent a résolu le conflit, la fusion a repris : README fusionné, stash vide | tour réel de l’agent par ACP, puis git reprend la fusion | parcours | garder ici (ou étape de `parcours-deleguer`) | partiel : `worktree-ipc.test.ts › laisser l’agent résoudre : consigne envoyée, tour attendu, fusion reprise` ; `parcours-deleguer` étape 4 (fusion groupée, autre chemin) |
| 16 | nettoyage : conversation archivée, worktree et branche supprimés | nettoyage réel | unitaire-main | — | oui : `worktree-ipc.test.ts › nettoyage : la conversation quitte le worktree, puis il est supprimé avec sa branche` |
| 17 | Réglages › Données : worktree orphelin listé | détection et affichage des orphelins | composant | test de la section Données (à créer) | partiel : `worktree-ipc.test.ts › orphelins : dépôts des worktrees tenus…` (main seul) |
| 18 | « Nettoyer » : rien supprimé avant confirmation | ligne de confirmation obligatoire | composant | test de la section Données (à créer) | non (le motif `confirm-row` est testé ailleurs, pas pour les orphelins) |
| 19 | « Nettoyer » : orphelin et branche supprimés | suppression réelle | doublon | — | oui : `worktree-cycle.test.ts › orphelins : worktrees de Bobine sans conversation, nettoyés avec leur branche` |

### `terminal.mjs` — terminal à côté de la conversation : ⌃`, police d’icônes, commande de l’agent, commandes retenues, couleurs, extrait joint, refus (fiches 034, 072, 122, 134, 201)
Verdict : **disparaît entièrement** — à condition de déplacer ses 5 vérifications `parcours` dans `parcours-outils` étapes 1 et 2 ; le reste est déjà dans `parcours-outils`, dans les tests du main ou relève du composant
Compte : 18 vérifications — parcours 5, composant 5, unitaire-main 0, capture 1, doublon 7 ; déjà couvertes ailleurs : 7

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | ⌃` : un terminal s’ouvre à droite et prend le clavier | raccourci, pty réel, commande tapée | doublon | — | oui : `parcours-outils` étape 1 (même raccourci, commande à la main) |
| 2 | texte à 12 px du bord, sans cadre arrondi | marge du terminal (fiche 276) | capture | capture nocturne | non |
| 3 | Nerd Font livrée chargée, dans la police du terminal | la police livrée est réellement chargée par Chromium | parcours | `parcours-outils` étape 1 (ajouter le `printf` d’icônes) | partiel : `appearance.test.ts › Nerd Font livrée juste avant monospace, après les polices de lettres` (pile seule, pas le chargement) |
| 4 | icônes entières : une cellule d’avance, débord sur l’espace suivant seulement | glyphes powerline non coupés par xterm.js | parcours | `parcours-outils` étape 1 | non (mesure de la vraie police au canvas) |
| 5 | ⌃` ouvre et referme, même quand le terminal a le clavier | xterm ne mange pas le raccourci | parcours | `parcours-outils` étape 1 (refermer depuis le terminal) | partiel : `usePanel.test.ts › ⌃` ouvre le terminal avec le clavier, puis le referme` (sans xterm réel) |
| 6 | commande montrée avant de partir dans le terminal | rien ne part sans être vu | doublon | — | oui : `parcours-outils` étape 2 ; `terminal-tools.test.ts › commande montrée une fois, lancée dans un onglet neuf, puis lue` |
| 7 | trois choix (Lancer, Toujours cette commande ici, Refuser) | choix proposés | doublon | — | oui : `command-approval.test.ts › trois choix ; « Toujours cette commande ici » retenu pour ce dossier seulement` |
| 8 | commande lancée dans un onglet de l’agent (onglet 2), écran lu | l’agent a son onglet et lit la sortie | doublon | — | oui : `parcours-outils` étape 2 ; `terminal-manager.test.ts › onglet dans le dossier, commande lancée, écran lu comme l’utilisateur le voit` |
| 9 | onglet « Terminal » ouvert tout seul, historique affiché | panneau fermé : il s’ouvre et xterm rejoue la sortie | parcours | `parcours-outils` étape 2 (fermer le panneau avant) | partiel : `parcours-outils` étape 2 (panneau déjà ouvert) |
| 10 | Réglages › Confidentialité : commande retenue listée sous son dossier | la commande retenue est visible | composant | test de la section Confidentialité (à créer) | partiel : `approvals.test.ts › sites et commandes retenus, relus au lancement suivant, révocables` (main seul) |
| 11 | commande retenue oubliée depuis les Réglages | révocation par l’interface, avec confirmation | composant | même test (à créer) | partiel : même test (main seul) |
| 12 | saisie au clavier dans le terminal | frappe transmise au pty | doublon | — | oui : `parcours-outils` étape 1 |
| 13 | fond et palette ANSI des jetons | thème xterm issu des jetons | composant | test de `TerminalTab` (xterm simulé) | partiel : `themes.test.ts › variables CSS : noms en kebab, coloration et ANSI` |
| 14 | couleurs en variante sans rouvrir l’onglet | le thème suit la palette à chaud | composant | test de `TerminalTab` (xterm simulé) | non |
| 15 | extrait sélectionné à la souris joint au message, avec l’onglet d’origine | sélection xterm réelle → saisie | parcours | `parcours-outils` étape 2 (sélectionner la sortie, « Ajouter au message ») | partiel : `useComposerInbox.test.ts › message repris de la fenêtre rapide pour cette conversation, extrait du terminal` |
| 16 | nouvel onglet de terminal | « + » ajoute un onglet | composant | test de `TerminalTab` | non |
| 17 | commande refusée : la carte dit « refusé », sans coche verte | état « refusé » même si l’agent la dit finie | doublon | — | oui : `tool-outcome.test.ts › outil de l’app refusé : « refusé » même si l’agent le dit fini` |
| 18 | l’agent reçoit le refus (résultat en erreur) | refus transmis à l’agent | doublon | — | oui : `command-approval.test.ts › refus : résultat en erreur, marqué refusé pour la carte (fiche 122)` |

### `base.mjs` — essai de fumée historique : accueil, indicateur d’activité, autorisations, réglages de session, menu des agents, nouvelle conversation, renommage
Verdict : **disparaît entièrement** — aucune course ni processus propre ; autorisations et modèle/mode sont refaits par `parcours-matinee` ; le reste demande des tests de composant (plusieurs à créer)
Compte : 18 vérifications — parcours 0, composant 11, unitaire-main 2, capture 2, doublon 3 ; déjà couvertes ailleurs : 3

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | accueil affiché, saisie au centre | écran d’accueil | composant | `Welcome.test.tsx` (à créer) | non |
| 2 | accueil : la bobine à côté de la salutation | marque animée « intro » | composant | `Welcome.test.tsx` (à créer) | partiel : `SpoolMark.test.tsx › masques propres à chaque bobine, animation choisie, invite seulement en grand` |
| 3 | (attente) accueil : fil enroulé, animation terminée | l’animation d’ouverture s’arrête | capture | capture nocturne | non (Web Animations réelles, absentes de jsdom) |
| 4 | accueil : astuce de l’agent factice, déclarée par son profil | astuce venue du profil, pas d’un test sur l’identifiant | composant | `Welcome.test.tsx` (à créer) | partiel : `agent-host.test.ts › astuce d’accueil tirée du profil, dans l’instantané (fiche 088)` ; `profiles.test.ts › agent factice : astuce d’accueil ; aucun vrai agent n’en a` (pas l’affichage) |
| 5 | l’agent répond : « Écrit… » et le temps écoulé | libellé et durée de l’indicateur | composant | `WorkingIndicator.test.tsx` | partiel : `WorkingIndicator.test.tsx › fiche 267 (D14) : la durée du tour…` ; `activity.test.ts › rien encore, réflexion, texte, outil en cours, outil fini` |
| 6 | l’agent travaille : la bobine s’enroule en boucle | animation en boucle | capture | capture nocturne | non |
| 7 | réponse finie : indicateur retiré | l’indicateur part après Stop | composant | `WorkingIndicator.test.tsx` | partiel : `parcours-matinee` étape 10 (Stop, plus de roue dans la barre latérale) |
| 8 | autorisation demandée : « Attend votre accord » | l’autorisation passe avant le reste | composant | `WorkingIndicator.test.tsx` | partiel : `activity.test.ts › autorisation ou question en attente : passe avant le reste` |
| 9 | autorisation demandée : bobine immobile | pas d’animation pendant l’attente | composant | `WorkingIndicator.test.tsx` (`data-motion=none`) | non |
| 10 | permission autorisée → outil terminé | « Autoriser une fois » | doublon | — | oui : `parcours-matinee` étape 2 |
| 11 | permission refusée → outil « refusé » | « Refuser » | doublon | — | oui : `parcours-matinee` étape 3 ; `tool-outcome.test.ts › autorisation refusée : « refusé »…` |
| 12 | Stop pendant l’attente → demande annulée | la carte en attente passe à « annulée » | composant | `transcript.test.ts` + rendu de `ToolCall` | partiel : `transcript.test.ts › permission retirée par l’agent (fiche 214) : la carte disparaît, l’outil garde son état ; Stop : annulée` ; `mock-agent.test.ts › permission annulée par le client : tour annulé` |
| 13 | mode et modèle choisis dans les puces, appliqués par l’agent (`echo`) | réglages transmis par ACP | doublon | — | oui : `parcours-matinee` étape 11 |
| 14 | (attente) menu « Réglages de session » : modèle choisi, la puce suit | menu et puce partagent l’état | composant | `SessionSettingsMenu.test.tsx` / `ModelChip.test.tsx` | partiel : `ModelChip.test.tsx › la puce montre le nom court` (le choix par le menu n’est dans aucun parcours) |
| 15 | consultation du menu des agents : l’agent factice reste sélectionné | ouvrir le menu au clavier ne choisit pas une ligne (fiche 151) | composant | test du menu des agents (à créer) | non |
| 16 | nouvelle conversation : sans confirmation, l’ancienne dans « Récents » | aucune boîte native, ancienne gardée | unitaire-main | `manager.test.ts` | partiel : `manager.test.ts › nouvelle conversation : l’ancienne reste dans l’historique, avec son fil` (l’absence de boîte n’est pas vérifiée) |
| 17 | retour sur l’ancienne : fil intact, brouillon vide écarté | la conversation vide ne reste pas dans l’historique | unitaire-main | `manager.test.ts` | partiel : `manager.test.ts › au lancement : une conversation vide active, hors historique` ; `› conversation vide quittée : sa session est supprimée chez l’agent` |
| 18 | renommage depuis la barre latérale | menu ⋯ › Renommer, Entrée | composant | `Sidebar.test.tsx` | partiel : `manager.test.ts › titre proposé par l’agent ; renommage prioritaire ; suppression` ; `ipc.test.ts › conversations : liste, sélection, création, renommage, suppression` (pas l’interface) |

### `language.mjs` — langue de l’interface changée à chaud (fenêtres, menu macOS), gardée d’un lancement à l’autre (fiche 074)
Verdict : **à garder (réduite)** — « chaque fenêtre suit » et « relancée en anglais dès le départ » sont des vérifications entre processus ou après redémarrage, que `parcours-reglages` (sans redémarrage) ne fait pas
Compte : 8 vérifications — parcours 2, composant 1, unitaire-main 3, capture 0, doublon 2 ; déjà couvertes ailleurs : 2

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | réglage « Français » : interface et menu en français | réglage lu avant la fenêtre, menu traduit | unitaire-main | `i18n.test.ts`, `menu.test.ts` | partiel : `i18n.test.ts › lit le réglage dans settings.json avant toute fenêtre, « system » sinon` ; `menu.test.ts › entrées des rôles d’Electron toutes traduites, menu Fenêtre compris (fiche 093)` |
| 2 | English : les Réglages restent ouverts et passent à l’anglais | changement sans fermer les Réglages | composant | — | oui : `SettingsDialog.test.tsx › suit la langue sans fermer les réglages, et se retrouve en cherchant dans l’une ou l’autre` |
| 3 | English : menu macOS reconstruit en anglais | changement de langue → menu reconstruit | unitaire-main | `settings-effects.test.ts` (à créer : `changeLanguage` → `refreshMenu` + `languageChanged`) | partiel : `i18n.test.ts › change de langue à chaud et passe la sienne au renderer, que le preload relit` (`settings-effects.ts` n’a aucun test) |
| 4 | English : chaque fenêtre de l’app suit | la diffusion IPC atteint toutes les fenêtres (principale, rapide) | parcours | garder ici, ou `parcours-reglages` étape 2 (ajouter la vérification par le main) | non |
| 5 | English : accueil en anglais | l’invite de la saisie est traduite | doublon | — | oui : `parcours-reglages` étape 2 (l’invite change, puis revient) |
| 6 | choix gardé dans settings.json | persistance du réglage | unitaire-main | `settings.test.ts` | partiel : `settings.test.ts › aller-retour sauvegarde / lecture, sans fichier temporaire résiduel` ; `› préférences lues avant que l’app soit prête…` |
| 7 | relancée : en anglais dès le départ (page, invite, menu) | la langue gardée s’applique au lancement suivant, avant la fenêtre | parcours | garder ici | partiel : `i18n.test.ts › lit le réglage dans settings.json avant toute fenêtre…` (sans vraie relance) |
| 8 | retour au français : Réglages, menu et fenêtres | aller-retour (même chose que 3 et 4, sens inverse) | doublon | — | partiel : `parcours-reglages` étape 2 (retour à la langue d’origine, invite seule) |

#### Risques repérés (lot)

- **Repli réel des lignes** (`historique-saisie` 10, 12, 13) : `visual-lines.test.ts` mesure sur des valeurs simulées ; un écart entre la copie de mesure et le vrai `textarea` (police, marge réservée au rappel) ne se voit que dans Chromium.
- **`scrollTop` et curseur après ↑** : en jsdom, `scrollTop` vaut toujours 0 et les flèches ne déplacent pas le curseur ; le test de composant vérifie la décision de l’app, pas l’effet du navigateur (`historique-saisie` 7, 8, 9).
- **Géométrie CSS** (saisie étroite et rappel, fondus du fil, haut du fil sous l’en-tête, alignements, marge du terminal) : jsdom ne calcule ni la mise en page ni les `scroll-timeline` ; une capture nocturne montre le défaut sans l’affirmer. La saisie étroite (`historique-saisie` 16) mérite une vraie assertion dans `parcours-longue` étape 4.
- **xterm.js réel** : la capture de ⌃` quand xterm a le clavier, la sélection à la souris, la police Nerd Font chargée et la largeur des glyphes ne se testent pas sans Chromium ; à déplacer dans `parcours-outils`, pas en composant.
- **Diffusion à toutes les fenêtres et reconstruction du menu natif** (`language` 3, 4, 8) : `settings-effects.ts` n’a aucun test unitaire ; seul l’e2e voit aujourd’hui un oubli de `refreshMenu` ou de diffusion à la fenêtre rapide.
- **Relance** (`language` 7) : la langue passée au preload par les arguments du renderer n’est vérifiée de bout en bout qu’ici.
- **Résolution de conflit par l’agent sur un worktree seul** (`worktree-cycle` 15) et **bascule en worktree depuis le menu du dossier** (1) : chemins distincts de la fusion groupée de `parcours-deleguer` ; les supprimer sans les déplacer laisserait ces deux flux sans essai réel.
- **Point de la branche après un tour de l’agent** (`git` 2) : il dépend du rafraîchissement de l’état git en fin de tour, donc de l’IPC ; aucun test de composant ne verrait une régression de ce signal (`useGitStatus.test.ts` ne couvre que l’autre sens).
- **Animations** de la bobine (`base` 3, 6, 9) : Web Animations absentes de jsdom ; seul l’attribut `data-motion` est vérifiable en composant, pas l’animation qui s’arrête.
- **Tests de composant à créer** avant de supprimer `base.mjs` et `git.mjs` : `Welcome`, menu des agents (fiche 151), menu du titre (renommer / supprimer), puce de branche, section Données (orphelins) et section Confidentialité (commandes retenues). Aucun n’existe aujourd’hui (`grep` des `data-testid` : `title-menu`, `git-branch`, `welcome-hint`, `agent-option`, `forget-command`, `orphans-clean` absents de `src/**/*.test.*`).


## Lot 5

Suites : `parcours-matinee.mjs`, `fil.mjs`, `commit-redige.mjs`, `aide.mjs`, `usage.mjs`,
`command.mjs`, `outils-projet.mjs` (worktree `inventaire-e2e`, lu sans rien modifier).
Les noms de tests cités ont été retrouvés par grep (`rg`) dans `src/**/*.test.*` et `e2e/suites/`.

---

### `parcours-matinee.mjs` — journée type « matinée de dev » (fiche 277) : demande, autorisations, modifications, relecture, commit rédigé, deux conversations, file d’attente, Stop, modèle/mode, ⌘Q puis relance
Verdict : **à garder** — c’est l’une des journées types ; toutes ses vérifications enchaînent de vrais processus (agent factice par ACP, git réel, IPC, redémarrage).
Compte : 17 vérifications — parcours 17, composant 0, unitaire-main 0, capture 0, doublon 0 ; déjà couvertes ailleurs : 0 en entier (13 en partie)

| # | Vérification (libellé court) | Ce qu’elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | le dossier du projet est celui de la conversation | `BOBINE_WORKSPACE` → main → puce du dossier sous la saisie | parcours | garder ici (étape 1) | non |
| 2 | réponse reçue, la conversation est dans la barre latérale | premier échange ACP de bout en bout, une seule ligne créée | parcours | garder ici (étape 1) | non (d’autres e2e envoient un message, mais aucune ne vérifie « une seule ligne » à la première demande) |
| 3 | autorisée une fois : l’outil se termine | carte d’autorisation → réponse `allow_once` à l’agent → outil `completed` | parcours | garder ici (étape 2) | partiel : `src/main/agent/agent-host.test.ts › permission : la demande arrive avec ses options, autoriser applique le diff` |
| 4 | refusée : outil « refusé », l’agent en prend acte | `reject_once` part à l’agent, statut `refused`, réponse de l’agent | parcours | garder ici (étape 3) | partiel : e2e `autorisation-commande.mjs` (refus d’une commande, pas d’une modification) |
| 5 | demande suivante accordée d’office, sans carte | « Toujours autoriser » retenu par le main pour la suite de la session | parcours | garder ici (étape 4) | partiel : e2e `permissions.mjs` (`allow_always`) |
| 6 | Modifications : README.md et src/app.js, le diff de README sur le disque | modifications réelles sur disque, panneau Modifications, diff lu ; capture `276-matinee-modifications` | parcours | garder ici (étape 5) | partiel : e2e `changes.mjs` (vue Conversation / Git) |
| 7 | la relecture rend ses remarques, la conversation reste affichée | « Faire relire… » lance le rôle Code reviewer (2ᵉ session), réponse `replied` avec remarques | parcours | garder ici (étape 6) | partiel : e2e `relecture.mjs` (détail de la carte) |
| 8 | commit fait avec le message rédigé, rien dans le fil | session de rédaction à part, vrai `git commit`, dépôt propre, fil intact ; attente contractuelle : puce de branche plus « sale » (`changes:gitChanged`) | parcours | garder ici (étape 7) | partiel : `src/main/conversations/commit-draft.test.ts › réponse normale : message de l’agent, fichiers cochés, notes, secret retenu, lignes masquées ; agent arrêté, session supprimée` ; `src/main/changes/git-changed.test.ts › après un commit ou une fusion de Bobine, réussis ou non, la conversation est signalée` |
| 9 | la deuxième répond ; la première travaille encore (indicateur) | deux sessions d’agent en parallèle, indicateur de la barre latérale | parcours | garder ici (étape 8) | partiel : e2e `parallel.mjs` (« la première conversation continue de répondre (indicateur dans la barre latérale) ») |
| 10 | retour : le tour continue, la suite attend dans la file | changer de conversation pendant un tour ne le casse pas ; message mis en file | parcours | garder ici (étape 9) | partiel : e2e `queue.mjs` (file sans changement de conversation) |
| 11 | tour arrêté : la suite part à la demande, l’agent y répond | Stop → `session/cancel`, file « interrompue » (attente contractuelle sur `queued.interrupted`), « Envoyer maintenant » | parcours | garder ici (étape 10) | partiel : e2e `queue.mjs` (« Échap arrête la réponse ; la file attend… », « message en attente envoyé à la demande ») |
| 12 | modèle et mode appliqués par l’agent | `set_mode` / `set_config_option` reçus et appliqués par l’agent factice (`echo`) | parcours | garder ici (étape 11) | partiel : `src/main/agent/agent-host.test.ts › setControl : mode (set_mode) et option (set_config_option) appliqués par l’agent` |
| 13 | app quittée (⌘Q) | quitter sans blocage ni erreur au journal du main | parcours | garder ici (étape 12) | partiel : e2e `reprise.mjs` (quitter pendant un tour) |
| 14 | relance : conversation affichée, fil (relecture comprise), modèle, mode | réouverture de la conversation affichée en quittant (fiche 243), persistance du fil et des réglages | parcours | garder ici (étape 13) | partiel : `src/main/conversations/manager.test.ts › dernière conversation affichée : rouverte, fil chargé, agent repris` |
| 15 | agent relancé : il répond dans le même fil, avec les réglages | `session/load` ou reprise après redémarrage, réglages réappliqués | parcours | garder ici (étape 13) | partiel : `src/main/conversations/manager.test.ts › après redémarrage de l’app : historique rechargé, conversation reprise par session/load` ; e2e `restart.mjs` (« conversation rechargée (session/load) puis continuée ») |
| 16 | deuxième conversation : son historique, et elle répond après la relance | l’autre conversation est intacte et relance son propre agent | parcours | garder ici (étape 14) | non |
| 17 | (à chaque étape, boucle de `day()`) journal propre, affichage cohérent | aucune erreur au journal du main ni dans la page ; ligne active = conversation du main, titre, point d’état | parcours | garder ici | non (outil propre aux parcours, `e2e/parcours.mjs`) |

**Suites que cette journée rend redondantes** : aucune en entier. En partie :
- `commit-redige.mjs` : vérifications 1 à 3 (message rédigé par l’agent, « Committer » disponible, rien dans le fil) → étape 7.
- `queue.mjs` : « la file attend au lieu de partir seule » et « message en attente envoyé à la demande » → étapes 9-10 (avec Stop plutôt qu’Échap).
- `restart.mjs` : « conversation rechargée (session/load) puis continuée » et « la conversation est dans Récents » → étapes 13-14.
- `parallel.mjs` : « la première conversation continue de répondre (indicateur…) » → étape 8.
- `relecture.mjs` (lancement + remarques rendues seulement) et `changes.mjs` (liste des fichiers + diff de la vue Conversation) → étapes 5-6.

---

### `fil.mjs` — fil (fiche 156) : durée du tour, copier un message, image en grand et glissée, « Ouvrir dans l’éditeur », carte « Où en était-on ? »
Verdict : **disparaît entièrement** — tout se vérifie sans lancer l’app ; 11 vérifications le sont déjà, 6 tests de composant à ajouter (dont 4 en partie couverts) ; captures `156-*` → capture nocturne.
Compte : 17 vérifications — parcours 0, composant 6, unitaire-main 0, capture 0, doublon 11 ; déjà couvertes ailleurs : 11 (+4 en partie)

| # | Vérification (libellé court) | Ce qu’elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | durée de chaque tour sous sa dernière réponse | `turn-duration` au bon format, une par tour | doublon | — | `src/renderer/src/components/thread/ThreadExtras.test.tsx › durée du tour sous sa dernière réponse, copie du message envoyé` ; `src/shared/turn-duration.test.ts › sur la dernière réponse du tour, de l’envoi à la fin de la réponse` |
| 2 | copier un message envoyé : son texte dans le presse-papiers | `navigator.clipboard.writeText` reçoit le texte, libellé « Copié » | composant | `ThreadExtras.test.tsx` (à compléter : clipboard simulé, texte écrit, `aria-label` = `copy.done`) | partiel : `ThreadExtras.test.tsx › durée du tour…` (libellé seulement) ; permission : `src/main/default-permissions.test.ts › copier : accordé à la page de l’app, pas à un cadre ni à l’aperçu` |
| 3 | image du message : vue en grand au clic | `image-zoom-image` avec la `data:` URL | doublon | — | `ThreadExtras.test.tsx › image d’un message : en grand au clic, Échap ferme` |
| 4 | Échap ferme la vue en grand | fermeture au clavier | doublon | — | idem |
| 5 | glisser : image écrite pour le Finder | `images:startDrag` → le main écrit le fichier | doublon | — | `ThreadExtras.test.tsx › glisser une image : le main la reçoit, le glisser HTML est annulé` ; `src/main/thread-ipc.test.ts › glisser : type d’image vérifié avant le main` |
| 6 | glisser : le fichier temporaire existe | fichier réellement écrit | doublon | — | `src/main/thread-ipc.test.ts › écrit l’image décodée, nommée d’après la pièce jointe ; même image, même fichier` |
| 7 | lien de fichier : « Ouvrir dans VS Code » | éditeur par défaut = le premier installé ; libellé du bouton | composant | `ThreadExtras.test.tsx` (lien `fichier:ligne` d’un message) | partiel : `ThreadExtras.test.tsx › rien sans éditeur ; sinon le nom, et le chemin à la ligne` ; `src/main/editors/editors.test.ts › VS Code par sa commande fournie dans l’app, avant celle du PATH` |
| 8 | VS Code : dossier, puis --goto fichier:ligne | ligne de commande de VS Code | doublon | — | `src/main/editors/editors.test.ts › VS Code et Cursor : dossier, puis --goto fichier:ligne` ; `› fichier du dossier : lancé à la ligne` |
| 9 | Réglages › Général : les éditeurs installés seulement | liste du `<select>` = éditeurs détectés | composant | `src/renderer/src/components/settings/EditorRow.test.tsx` (à créer) | partiel : `src/main/thread-ipc.test.ts › éditeurs : le nom et l’id seulement` ; `src/main/editors/editors.test.ts › rien d’installé : aucun éditeur` |
| 10 | (attente) après le choix d’IntelliJ, le bouton dit « Ouvrir dans IntelliJ IDEA » | le réglage changé se propage aux boutons du fil | composant | `EditorRow.test.tsx` + `ThreadExtras.test.tsx` (contexte d’éditeur mis à jour) | non |
| 11 | IntelliJ IDEA : --line N fichier | ligne de commande JetBrains | doublon | — | `src/main/editors/editors.test.ts › JetBrains : --line N fichier, ou open -na App --args` |
| 12 | fichier introuvable dans le dossier : pas d’éditeur lancé (avis) | refus côté main, avis dans le fil | doublon | — | `src/main/editors/editors.test.ts › hors du dossier, par « .. » ou par un lien symbolique : refusé, rien de lancé` ; `ThreadExtras.test.tsx › avis d’une ouverture refusée` |
| 13 | pas de carte sans conversation | pas de carte de reprise sur une conversation neuve | composant | `ThreadExtras.test.tsx` (cas « aucun élément ») | partiel : `ThreadExtras.test.tsx › activité récente, ou nouveau message : pas de carte` ; `src/shared/resume-card.test.ts › rien avant un jour d’inactivité, ni sans heure` |
| 14 | carte de reprise : dernière demande et fichiers non commités | carte construite sans l’agent, fichiers lus par `changes.git` | doublon | — | `ThreadExtras.test.tsx › inactive depuis plus d’un jour : demande, tâches, fichiers non commités ; fermée, elle ne revient pas` |
| 15 | carte de reprise : les tâches du plan | tâches faites / en cours | doublon | — | idem ; `src/shared/resume-card.test.ts › dernière demande, tâches faites et en cours (en cours d’abord), fichiers` |
| 16 | carte de reprise repliable | `<details>` se replie au clic sur le titre | composant | `ThreadExtras.test.tsx` (à compléter) | non |
| 17 | fermée : pas de nouveau pour cette reprise | fermeture retenue même après un aller-retour de conversation | doublon | — | `ThreadExtras.test.tsx › inactive depuis plus d’un jour… ; fermée, elle ne revient pas` |

---

### `commit-redige.mjs` — message de commit rédigé par l’agent (fiche 246) : réponse normale + « Committer puis fusionner » depuis la carte, agent lent (repli, « Réessayer »), « Arrêter »
Verdict : **disparaît entièrement** — les tests du main lancent déjà le vrai agent factice et vérifient les processus ; seule la relecture automatique de la vue Git après « Committer puis fusionner » reste e2e, à porter dans `parcours-deleguer`.
Compte : 15 vérifications — parcours 1, composant 0, unitaire-main 0, capture 0, doublon 14 ; déjà couvertes ailleurs : 14

| # | Vérification (libellé court) | Ce qu’elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | message rédigé par l’agent, d’après les fichiers cochés et la demande de départ | consigne (fichiers, intention) → message de l’agent dans le champ | doublon | — | `src/main/conversations/commit-draft.test.ts › réponse normale : message de l’agent, fichiers cochés, notes, secret retenu, lignes masquées ; agent arrêté, session supprimée` ; `src/shared/commit-draft.test.ts › consigne, notes, intention, fichiers cochés et diff ; un fichier retenu ne donne que son chemin` ; `parcours-matinee` étape 7 |
| 2 | « Rédigé par Agent factice… », « Committer » disponible | ligne d’état et bouton actif | doublon | — | `src/renderer/src/components/panel/CommitDraft.test.tsx › message reçu : dans le champ, modifiable ; « Rédigé par… » ; committé tel que retouché` |
| 3 | rien dans le fil : session à part | rédaction hors de la conversation | doublon | — | `parcours-matinee` étape 7 (« rien dans le fil ») |
| 4 | l’agent de la rédaction est arrêté après la réponse | aucun processus orphelin | doublon | — | `commit-draft.test.ts › réponse normale : … agent arrêté, session supprimée` (vrai agent factice, pids relus) |
| 5 | D4 : après « Committer puis fusionner », vue Git et puce de branche à jour sans « Actualiser » | carte de travail → commit dans le dossier principal + fusion réelle → `changes:gitChanged` → deux composants se relisent | parcours | `parcours-deleguer` étape 4 (à étendre : dossier principal modifié, « Committer puis fusionner » depuis la carte, vue Git ouverte) | partiel : `src/main/changes/git-changed.test.ts › après un commit ou une fusion de Bobine, réussis ou non, la conversation est signalée` ; `src/renderer/src/components/thread/SubtasksMerge.test.tsx › « Committer d’abord » : message proposé modifiable, commit, puis la fusion part` |
| 6 | rédaction en cours : texte, champ en attente, « Committer » désactivé | état `drafting` | doublon | — | `CommitDraft.test.tsx › rédaction en cours : « Rédaction par OpenCode… », champ en attente, « Committer » désactivé ; « Arrêter »` |
| 7 | délai dépassé : message en anglais déduit des fichiers, la raison dite | repli `timeout` | doublon | — | `commit-draft.test.ts › réponse lente au-delà du délai : repli `timeout` en anglais, agent arrêté` ; `CommitDraft.test.tsx › délai dépassé : repli en anglais déduit des fichiers, la raison, « Réessayer »` ; `src/shared/commit-draft.test.ts › anglais, Conventional Commits, déduit des fichiers seuls : `chore` sans intention connue` |
| 8 | « Réessayer » : un nouvel agent de rédaction est lancé | nouvelle demande au main | doublon | — | `CommitDraft.test.tsx › délai dépassé : … « Réessayer »` ; `commit-draft.test.ts › nouvelle demande : la précédente s’arrête, son agent aussi` |
| 9 | « Réessayer » sans réponse : de nouveau le repli | repli au délai la 2ᵉ fois | doublon | — | `commit-draft.test.ts › réponse lente au-delà du délai…` |
| 10 | délai dépassé deux fois : aucun agent ne survit | pas d’orphelin | doublon | — | `commit-draft.test.ts › réponse lente au-delà du délai : … agent arrêté` ; `› nouvelle demande : la précédente s’arrête, son agent aussi` |
| 11 | commit fait avec le message du repli | vrai commit avec le texte du champ | doublon | — | `src/renderer/src/components/panel/CommitBars.test.tsx › fichiers cochés, message proposé modifiable, commit, puis « Défaire »` ; commit réel : `parcours-matinee` étape 7 |
| 12 | rédaction : un agent de rédaction est lancé | processus lancé | doublon | — | `commit-draft.test.ts › « Arrêter » pendant la rédaction : repli `stopped`, agent arrêté` |
| 13 | « Arrêter » : rédaction arrêtée, message déduit des fichiers | repli `stopped` | doublon | — | idem ; `CommitDraft.test.tsx › rédaction en cours : … ; « Arrêter »` |
| 14 | « Arrêter » : aucun agent de rédaction ne survit | pas d’orphelin | doublon | — | `commit-draft.test.ts › « Arrêter » pendant la rédaction : repli `stopped`, agent arrêté` |
| 15 | commit fait avec le message du repli (après Arrêter) | idem 11 | doublon | — | comme 11 |

---

### `aide.mjs` — aide intégrée (fiche 186) : fenêtre à part (⌘?), sommaire, langue, images, recherche au clavier avec surlignage, liens externes, liens « ? » des Réglages
Verdict : **à garder (réduite)** — garder la fenêtre native, le chargement réel des images et le surlignage visible (CSS Highlights + défilement : jsdom n’a ni l’un ni l’autre) ; « ? » → fenêtre d’aide à porter dans `parcours-reglages` ; le reste en tests de composant.
Compte : 15 vérifications — parcours 5, composant 5, unitaire-main 1, capture 0, doublon 4 ; déjà couvertes ailleurs : 4 (+9 en partie)

| # | Vérification (libellé court) | Ce qu’elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | menu Aide : une fenêtre à part, non modale, à droite, une seule | vraie `BrowserWindow`, position, instance unique, menu natif | parcours | `parcours-reglages` étape 9 (« ? » de Réglages › Mémoire ouvre l’aide à côté, une seule fenêtre) | partiel : `src/main/help-window.test.ts › collée à droite de la fenêtre principale s’il y a la place, même haut` ; `› une seule : la première cible est lue par la page, les suivantes lui sont envoyées` ; `src/main/menu.test.ts › Affichage : Mon activité et plein écran en F11 ; Aide : À propos en dernier` |
| 2 | titre « Aide de Bobine », curseur dans la recherche | `document.title`, focus à l’ouverture | composant | `src/renderer/src/components/help/HelpWindow.test.tsx` (à compléter : titre) | partiel : `HelpWindow.test.tsx › recherche pendant la frappe, au clavier seul : ↓, ↩ ouvre la section, Échap efface` (focus) |
| 3 | accueil du guide dans la langue de l’interface | guide fr/en selon la langue | doublon | — | `src/renderer/src/help/guide.test.ts › langue du guide : français pour fr-*, anglais sinon` |
| 4 | accueil : pas de lien brut vers l’autre langue ; insécables avant « : ; ? ! » | rendu propre de l’accueil | composant | `guide.test.ts` (à compléter : texte rendu de l’accueil) | partiel : `guide.test.ts › pages et ancres de l’aide, l’autre langue, les Nouveautés` (lien converti, pas la typographie) |
| 5 | page « Premiers pas » : image du guide chargée | image réellement chargée (`naturalWidth > 0`) dans la fenêtre sandboxée : empaquetage des images + CSP | parcours | garder ici | partiel : `guide.test.ts › chaque image d’une page est embarquée` ; `HelpWindow.test.tsx › images : celles du guide seulement` |
| 6 | résultats pendant la frappe, mot souligné, sans l’accueil | recherche, `<mark>`, accueil exclu | doublon | — | `HelpWindow.test.tsx › recherche pendant la frappe…` ; `guide.test.ts › mots trouvés au début d’un mot, soulignés dans l’extrait` ; `› recherche : l’accueil répond par ses notes, jamais par son sommaire` |
| 7 | le premier résultat est affiché, mot surligné à l’écran | `CSS.highlights` posé et visible après défilement | parcours | garder ici | non |
| 8 | ↓ change le résultat ET la page, défilée au mot surligné | navigation au clavier + défilement réel | parcours | garder ici | partiel : `HelpWindow.test.tsx › recherche pendant la frappe…` (↓/↑/↩, pas le défilement) |
| 9 | ↩ ouvre la section ; Échap efface, le sommaire revient | clavier | doublon | — | `HelpWindow.test.tsx › recherche pendant la frappe, au clavier seul : ↓, ↩ ouvre la section, Échap efface` |
| 10 | « astuces » trouve l’accueil, mot surligné à l’écran | l’accueil répond par ses notes | composant | `guide.test.ts` / `HelpWindow.test.tsx` (la partie « surligné à l’écran » est couverte par la ligne 7) | partiel : `guide.test.ts › recherche : l’accueil répond par ses notes, jamais par son sommaire` |
| 11 | blocs de code avec « Copier » | rendu Markdown du guide | composant | `HelpWindow.test.tsx` (rendu d’une page avec un bloc de code) | partiel : `src/renderer/src/components/thread/Markdown.test.tsx › tableaux dans un cadre qui défile, blocs de code avec un bouton « Copier »` (Markdown du fil) |
| 12 | lien hors du guide ouvert dans le navigateur du système | `target=_blank` → gestionnaire du main → `shell.openExternal` avec l’URL GitHub | unitaire-main | `src/main/renderer-windows.test.ts` (à créer : `setWindowOpenHandler` / `will-navigate`) | partiel : `HelpWindow.test.tsx › liens : aide dans l’app, http(s) dans le navigateur, le reste désactivé` ; `guide.test.ts › un autre fichier du dépôt sur GitHub ; http(s) dans le navigateur ; le reste désactivé` |
| 13 | « ? » des Réglages : la même fenêtre, à la section « autorisations » | fenêtre principale → main → fenêtre d’aide existante, ancre défilée | parcours | `parcours-reglages` étape 9 | partiel : `help-window.test.ts › une seule : …` ; `HelpWindow.test.tsx › suit les pages envoyées par l’app ; ⌘[ revient en arrière` ; `guide.test.ts › chaque sujet de l’interface vise une page et une ancre du guide, dans chaque langue` |
| 14 | seule la section visée ressort | pas de surbrillance restée de la page d’avant | composant | `HelpWindow.test.tsx` (à compléter : deux cibles de suite) | non |
| 15 | « ? » de Réglages › Mémoire : page « Mémoire commune » | même mécanisme que 13, autre cible | doublon | — | ligne 13 ; `guide.test.ts › chaque sujet de l’interface vise une page et une ancre du guide, dans chaque langue` |

---

### `usage.mjs` — consommation (fiches 019, 109, 113, 130, 245) : jauge, détail et coût par échange, alerte, compaction ; coût comme Bob (base de Bob), rejeu tardif à la réouverture, journal SQLite
Verdict : **disparaît entièrement** — le rendu et le calcul sont déjà couverts ou se vérifient en composant ; seule la réouverture avec rejeu tardif reste e2e, à porter dans `parcours-longue`.
Compte : 15 vérifications (17 appels, `checkCost` joué deux fois) — parcours 1, composant 5, unitaire-main 0, capture 0, doublon 9 ; déjà couvertes ailleurs : 9 (+4 en partie)

| # | Vérification (libellé court) | Ce qu’elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | rien d’affiché avant le premier échange | pas de puce sans données | composant | `src/renderer/src/components/composer/UsageMeter.test.tsx` (à compléter) | partiel : `src/shared/usage.test.ts › rien d’affiché sans données` |
| 2 | jauge de contexte près de la zone de saisie | « N % » d’après `usage_update` | doublon | — | `UsageMeter.test.tsx › total estimé après une compaction (fiche 257) : « ≈ » sur la puce et le détail, expliqué` (puce « 2 % ») ; `usage.test.ts › usage_update : contexte, et coût seulement s’il est fourni` |
| 3 | détail : jetons cumulés sur 2 échanges, coût | détail de la puce | doublon | — | `UsageMeter.test.tsx › coût cumulé, moyenne par échange et une ligne par échange, le plus récent en haut` |
| 4 | coût cumulé 2 × 0,0125 $US, en estimation (≈) | cumul ACP, « ≈ » | doublon | — | `UsageMeter.test.tsx › tour réel d’OpenCode : jetons traités = entrée + sortie, cache et réflexion à part, coût estimé (fiche 245)` ; `usage.test.ts › comme OpenCode : coût cumulé annoncé pendant le tour, jetons à la fin` |
| 5 | coût en dollars : dit estimé, d’après les tarifs de l’agent | `usage-cost-hint` | doublon | — | `UsageMeter.test.tsx › tour réel d’OpenCode : …` (`usage-cost-hint` contient « Agent factice ») |
| 6 | « Toute la consommation… » mène au tableau | libellé du lien (le clic n’est pas vérifié) | composant | `UsageMeter.test.tsx` (à compléter : libellé + action appelée) | non |
| 7 | (×2, ACP et Bob) rien dans la liste des conversations ni dans l’en-tête | coût absent ailleurs | composant | à supprimer : aucun `history-cost` ni `conversation-cost` n’existe plus dans `src/`, la vérification est toujours vraie | non (garde-fou vide) |
| 8 | (ACP) coût cumulé dans le détail de la consommation | `usage-cost` | doublon | — | `UsageMeter.test.tsx › coût cumulé, moyenne par échange…` |
| 9 | (Bob) coût en Bobcoins relu dans la base de Bob, montré dans le détail | coût lu par le main dans la base (d’essai) après le tour, envoyé au renderer | doublon | — | `src/main/agent/bob-costs.test.ts › vrai dossier : une écriture du coût par l’agent factice est signalée, base créée comprise` ; `src/main/agent/session-cost.test.ts › reads again shortly after the turn ends` ; `UsageMeter.test.tsx › agent qui ne donne que son coût (comme Bob) : la puce montre le coût, lignes sans jetons` |
| 10 | (×2) une ligne par échange, moyenne par échange | liste par tour + moyenne | doublon | — | `UsageMeter.test.tsx › coût cumulé, moyenne par échange et une ligne par échange…` ; `› agent qui ne donne que son coût (comme Bob)…` |
| 11 | contexte presque plein : jauge en alerte | classe `full` de la puce | composant | `UsageMeter.test.tsx` (à compléter) | partiel : `src/renderer/src/components/composer/UsageGuards.test.tsx › « Compacter » à 80 % quand l’agent a une commande de compaction` |
| 12 | compaction : « conversation résumée » dans le fil, contexte libéré | élément `compaction` `completed`, la puce n’est plus en alerte | composant | `Transcript.test.tsx` / `UsageMeter.test.tsx` | partiel : `src/shared/transcript.test.ts › compaction : élément créé, résumé en morceaux, statut mis à jour` ; `src/main/agent/agent-host-compaction.test.ts › estimée après la compaction, puis remplacée par le chiffre du tour suivant` |
| 13 | rien par ACP : pas de jauge de contexte | agent sans `usage_update` | doublon | — | `UsageMeter.test.tsx › agent qui ne donne que son coût (comme Bob)…` |
| 14 | rouverte (session/load, rejeu tardif comme Bob) : bilan du dernier tour et durées gardés | redémarrage + rejeu arrivé après la réponse à `session/load` sans écraser bilan ni durées | parcours | `parcours-longue` étape 8 (relance) en jouant l’agent factice comme Bob : `MOCK_AGENT_REPLAY=late`, `MOCK_AGENT_USAGE=bob` | partiel : `src/main/agent/trace-replay.test.ts › Bob, rejeu tardif : l’échange rejoué puis la réponse, une seule fois chacun` ; `src/main/agent/replay-buffer.test.ts › rejeu tardif : le calme sans rien entendu ne compte pas, le rejeu remis avant la réponse` |
| 15 | journal de consommation : une ligne par échange, coût de Bob sur la même ligne | `usage.sqlite` écrit par l’app | doublon | — | `src/main/usage/journal.test.ts › comme Bob : coût relu après la fin du tour, sur la même ligne` |

---

### `command.mjs` — dossier et lancement (fiche 158) : menu du dossier (Mac/Linux), `bobine <dossier> "message"` au premier lancement et par une seconde instance, installation de la commande
Verdict : **à garder (réduite)** — garder le lancement avec arguments et la seconde instance (vrais processus Electron, verrou d’instance unique) ; menu et réglage en composant, script déjà testé côté main.
Compte : 14 vérifications — parcours 2, composant 8, unitaire-main 0, capture 0, doublon 4 ; déjà couvertes ailleurs : 3 (+8 en partie)

| # | Vérification (libellé court) | Ce qu’elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | (boucle darwin/linux) « Afficher dans le Finder / le gestionnaire de fichiers » | libellé selon la plateforme | composant | `src/renderer/src/components/common/WorkspaceMenu.test.tsx` (à créer, `Menus.tsx`) | partiel : `src/shared/i18n/system-texts.test.ts › Windows nomme l’Explorateur et DPAPI ; Linux, le gestionnaire de fichiers` |
| 2 | (boucle) « Copier le chemin » et « Ouvrir un terminal ici » | entrées du menu | composant | `WorkspaceMenu.test.tsx` | non |
| 3 | « Afficher dans le Finder » montre le dossier lui-même | `fileLinks.open(id, '.', { reveal: true })` → Finder sur le dossier | composant | `WorkspaceMenu.test.tsx` (appel) + `src/main/files/file-links.test.ts` (cas `.`) | partiel : `file-links.test.ts › autre fichier du dossier : app par défaut ; dossier, ⌥-clic : Finder` |
| 4 | « Copier le chemin » copie le chemin du dossier | `navigator.clipboard.writeText(workspace)` (et non l’IPC, contrairement au commentaire de la suite) | composant | `WorkspaceMenu.test.tsx` | non |
| 5 | « Ouvrir un terminal ici » ouvre le terminal de Bobine | menu → `workspace:openTerminal` → onglet Terminal | composant | `WorkspaceMenu.test.tsx` ; terminal réel : `parcours-outils` étape 1 | partiel : `src/main/ipc.test.ts › actions requises et élicitation` (`workspace:openTerminal`) |
| 6 | premier lancement : nouvelle conversation dans le dossier demandé | argv réel → main → conversation dans ce dossier | parcours | garder ici | partiel : `src/main/launch-request.test.ts › le dossier est résolu depuis le dossier de travail` ; `› une demande du premier lancement attend l’app, puis son message l’interface` |
| 7 | le premier message est posé dans la saisie, pas envoyé | message reçu par l’interface, laissé dans la saisie | composant | test du renderer qui reçoit la demande de lancement (saisie remplie, rien envoyé) | partiel : `launch-request.test.ts › interface prête : la conversation et le message lui sont envoyés tout de suite` |
| 8 | seconde instance : la conversation s’ouvre dans l’autre dossier | 2ᵉ processus → `second-instance` → instance existante ; la 2ᵉ s’arrête | parcours | garder ici | partiel : `launch-request.test.ts › seconde instance depuis les sources : options en tête, le chemin de l’app reste sauté` |
| 9 | toujours rien d’envoyé | idem 7 | doublon | — | ligne 7 |
| 10 | avant : le réglage dit où la commande s’installera | note du réglage | composant | test du réglage « Commande bobine » (à créer) | partiel : `src/main/command-line.test.ts › sinon dans ~/.local/bin, et dit si le PATH le contient` |
| 11 | installer : le script est écrit et exécutable | écriture + bit x | doublon | — | `command-line.test.ts › installe dans le dossier système quand on peut y écrire` ; `› sinon dans ~/.local/bin, et dit si le PATH le contient` (POSIX seulement) |
| 12 | script reconnu à son marqueur | marqueur `# bobine-command` | doublon | — | `command-line.test.ts › désinstalle, et ne touche pas à un bobine qui n’est pas le sien` |
| 13 | après : le chemin du script, et l’avertissement PATH | texte du réglage après installation | composant | test du réglage « Commande bobine » | partiel : `command-line.test.ts › sinon dans ~/.local/bin, et dit si le PATH le contient` (côté main) |
| 14 | désinstaller : le script est retiré | suppression | doublon | — | `command-line.test.ts › désinstalle, et ne touche pas à un bobine qui n’est pas le sien` |

---

### `outils-projet.mjs` — outils iOS apparus avec un projet Xcode créé pendant la conversation (fiche 241) : agent qui ne suit pas la liste (avis, « Redémarrer l’agent ») et agent qui la suit
Verdict : **disparaît entièrement** — la détection, les avis et la relecture de la liste sont testés côté main et composant ; le redémarrage de bout en bout jusqu’à `ios_build` déclaré est à porter dans `parcours-outils`.
Compte : 8 vérifications — parcours 1, composant 1, unitaire-main 0, capture 0, doublon 6 ; déjà couvertes ailleurs : 6 (+2 en partie)

| # | Vérification (libellé court) | Ce qu’elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | dossier sans projet : pas d’outil iOS déclaré | catalogue selon le dossier | doublon | — | `src/main/mcp/catalog.test.ts › projet Xcode ou Swift : les outils iOS ; projet Gradle : ceux d’Android` ; `src/main/agent/app-tools-endpoint.test.ts › rien de nouveau dans le dossier : aucun avis, aucune notification` |
| 2 | projet Xcode créé pendant le tour : avis sous la réponse, avec « Redémarrer l’agent » | dossier relu après le tour, avis en dernier dans le fil | doublon | — | `app-tools-endpoint.test.ts › agent sans flux (Bob : inconnu) : avis redonné sous chaque réponse sans relire le dossier, puis donnés s’il relit` ; `src/shared/app-tools-notice.test.ts › « à redémarrer » : avis avec l’action, un seul à la fois, toujours le dernier du fil` |
| 3 | tour suivant : un seul avis, sous la dernière réponse | avis redonné, pas de doublon | doublon | — | `app-tools-notice.test.ts › « à redémarrer » : …` ; `app-tools-endpoint.test.ts › agent sans flux…` |
| 4 | après « Redémarrer l’agent » : ligne discrète, plus de bouton | changement d’état de l’avis | doublon | — | `src/renderer/src/components/thread/NoticeRestart.test.tsx › « Redémarrer l’agent » redémarre l’agent de la conversation` ; `› ligne discrète une fois les outils reçus : ni icône ni bouton` ; `app-tools-notice.test.ts › outils reçus ensuite : l’avis laisse la place à une ligne discrète, sans action` |
| 5 | après redémarrage : `ios_build` déclaré (tools/list) | vrai redémarrage de l’agent, nouvelle session MCP avec la famille iOS | parcours | `parcours-outils` (étape 8 à ajouter : projet Xcode créé → avis → « Redémarrer l’agent » → `ios_build` vu par l’agent) | partiel : `app-tools-endpoint.test.ts › session suivante (redémarrage) : elle a la famille, dite au fil ; sans HTTP, rien` |
| 6 | agent qui suit la liste : pas d’outil iOS au départ | idem 1 | doublon | — | comme 1 |
| 7 | agent qui relit la liste : outils ajoutés sans redémarrer, ligne discrète | `notifications/tools/list_changed` → l’agent relit | doublon | — | `src/main/mcp/tool-server.test.ts › agent qui suit le flux : notification envoyée, liste relue, nouveaux outils rendus` ; `app-tools-endpoint.test.ts › agent qui relit la liste après la notification : famille ajoutée sans redémarrer` |
| 8 | menu ⚙ : rien « au prochain démarrage » | pas de ligne `session-app-tools-next` | composant | `src/renderer/src/components/common/SessionSettingsMenu.test.tsx` (à compléter) | partiel : `SessionSettingsMenu.test.tsx › Serveurs MCP : « bobine · intégré » et les outils reçus, puis les serveurs de l’agent (fiche 099)` |

---

#### Risques repérés (lot)

- **Presse-papiers réel** (`fil` 2, `command` 4) : un test de composant simule `navigator.clipboard` ; il ne verrait pas un refus de permission dans la fenêtre sandboxée ni l’absence de focus. Seule la règle est testée (`default-permissions.test.ts › copier : accordé à la page de l’app…`). Le copier n’étant dans aucune journée type, garder un copier dans un parcours (par exemple `parcours-outils`).
- **Propagation d’un réglage aux composants ouverts** (`fil` 10 : éditeur choisi → boutons du fil) : magasin de réglages → IPC → contexte. Le test de composant ne vérifie que le contexte, pas l’aller-retour par le main.
- **Course arrêt / démarrage de l’agent de rédaction** (`commit-redige` 12-14, fiche 250) : sur une machine chargée, « Arrêter » partait avant que l’agent soit lancé. Le test du main lance le vrai agent factice, mais on ne sait pas s’il couvre l’arrêt *pendant* le démarrage ; c’est à vérifier avant de supprimer la suite.
- **Délai de rédaction réglable** (`BOBINE_COMMIT_DRAFT_TIMEOUT_MS`) : le passage de la variable d’environnement à `CommitDrafts` n’est vérifié que par l’e2e.
- **Relecture de la vue Git sans « Actualiser »** (`commit-redige` 5) : évènement `changes:gitChanged` du main vers deux composants (vue Git, puce de branche) après une fusion lancée depuis la carte. Les tests séparés (notifier, composant) ne verraient pas un abonnement manquant.
- **Aide** : fenêtre native (position, non modale, une seule), CSP et empaquetage des images, `CSS.highlights` et défilement réel, aller-retour entre deux fenêtres par le main (« ? » des Réglages). jsdom n’a ni mise en page ni `CSS.highlights`. `setWindowOpenHandler` (`renderer-windows.ts`) n’a aucun test unitaire aujourd’hui.
- **Lancement par arguments / seconde instance** (`command` 6, 8) : `requestSingleInstanceLock`, évènement `second-instance`, argv d’Electron : seuls de vrais processus le montrent.
- **Rejeu tardif de Bob après `session/load`** (`usage` 14) : course entre la réponse à `session/load` et le rejeu ; les tests du main la rejouent depuis une trace, mais pas avec la persistance ni le rendu du bilan après une relance.
- **Garde-fou vide** (`usage` 7) : les sélecteurs `history-cost` / `conversation-cost` n’existent plus, la vérification passe toujours. La supprimer, ne rien porter.
- **Redémarrage de l’agent pour de nouveaux outils** (`outils-projet` 5) : bouton → main → arrêt/relance du processus → nouvelle session MCP. Les morceaux sont testés, pas l’enchaînement.
- **Captures perdues si les suites disparaissent** : `156-*` (fil), `246-*` (commit-redige), `aide-*`, `14-*`/`15-*` (usage), `158-*` (command), `outils-projet-*`. Elles sont à reprendre dans la capture nocturne si on veut encore les regarder.


## Lot 6

Suites : permissions, nouvelle-version, aparte, startup, plan, parcours-reglages, filles-tech-lead,
aurore, finitions, about, travail-recette. Les `ui.shot(…)` ne sont pas des vérifications : ils sont
cités en fin de suite (« Captures ») et partent dans la capture nocturne. Une ligne par `check`
(boucle = une ligne). Chemins des tests relatifs à la racine du dépôt.

---

### `permissions.mjs` — « Toujours autoriser » retenu d'une conversation à l'autre, révocable, demande retirée par l'agent, cartes de la fiche 214 (pastille, tâches, MCP, risque)
Verdict : **disparaît entièrement** — tout est déjà testé côté composant (PermissionCardExtras) ou main (manager, agent-host) ; il manque deux petits tests (révocation qui fait revenir la demande, carte retirée sans « annulée »).
Compte : 12 vérifications — parcours 0, composant 3, unitaire-main 1, capture 0, doublon 8 ; déjà couvertes ailleurs : 12 (dont 4 en partie)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | carte : « Always allow » vaudra aussi pour les prochaines conversations | note `rememberNote` sur la carte d'un outil que Bobine retient | doublon | — | `src/renderer/src/components/thread/PermissionCardExtras.test.tsx › retenu par Bobine (fiche 042) : « Toujours autoriser » et la portée exacte, sans le profil` |
| 2 | nouvelle conversation : accordé d'office, sans demande | l'outil retenu n'est plus demandé dans une autre conversation | doublon | — | `src/main/conversations/manager.test.ts › « Toujours autoriser » retenu (fiche 042) : plus demandé dans les conversations suivantes` ; parcours-matinee étape 4 (même conversation seulement) |
| 3 | Réglages : outil listé avec son agent, titre traduit | Réglages › Confidentialité liste l'outil retenu, titre dans la langue | doublon | — | `src/renderer/src/components/settings/RememberedApprovals.test.tsx › « Updating todo list » est dit en %s, le titre de l'agent reste en infobulle` |
| 4 | Réglages fermés par Échap : focus à la saisie | le focus ne tombe pas sur la page | composant | `src/renderer/src/focus-keeper.test.ts` (existant) | partiel : `src/renderer/src/focus-keeper.test.ts › fenêtre fermée (Échap, ✕) dont le bouton d'ouverture est parti : la zone de saisie` (logique seule, pas la vraie fenêtre des Réglages) |
| 5 | révoqué : la demande revient | « Oublier » (bouton → IPC → réglages) fait reposer la question | unitaire-main | `src/main/conversations/manager.test.ts` : après `forgetTool`, un `/scenario liste-taches` redemande ; bouton déjà couvert par RememberedApprovals.test (onForgetTool) | partiel : `manager.test.ts › « Toujours autoriser » retenu (fiche 042)…` (liste vidée, pas la demande qui revient) ; `RememberedApprovals.test.tsx › un titre inconnu reste celui de l'agent ; révoquer désigne le titre exact de l'agent` |
| 6 | demande retirée par l'agent : carte disparue sans « annulée » ni échec, plus de pastille d'attente | `$/cancel_request` ferme la carte proprement dans le fil et la barre latérale | composant | `src/renderer/src/components/thread/Transcript.test.tsx` (évènement de retrait → ni « annulée » ni « échec ») + `src/renderer/src/components/sidebar/conversation-state.test.ts` (plus d'attente) | partiel : `src/main/agent/agent-host.test.ts › permission : l'agent retire sa demande ($/cancel_request), la carte se ferme` (côté main) |
| 7 | commande : dossier en pastille, chemin entier en infobulle | pastille du dossier de la conversation dans la commande | doublon | — | `PermissionCardExtras.test.tsx › pastille au nom du dossier, chemin entier en infobulle et nom accessible` |
| 8 | commande : « Toujours dans cette conversation » et portée du profil | portée déclarée par le profil (comme Bob) | doublon | — | `PermissionCardExtras.test.tsx › portée déclarée : « Toujours dans cette conversation » et UNE seule note, l'agent en gras (recette QA)` ; `src/main/agent/profiles.test.ts` (alwaysScope de Bob) |
| 9 | liste de tâches : question dédiée, quatre tâches, compte | carte dédiée aux tâches | doublon | — | `PermissionCardExtras.test.tsx › question dédiée, tâches avec leur état dit aux lecteurs d'écran, et le compte` |
| 10 | outil MCP : arguments tels que reçus, portée retenue par Bobine | carte d'outil MCP | doublon | — | `PermissionCardExtras.test.tsx › arguments tels que reçus, question générique` + `› retenu par Bobine (fiche 042)…` |
| 11 | carte à risque : pas de « Toujours », une ligne dit pourquoi | écriture hors dossier sans « Toujours » | doublon | — | `PermissionCardExtras.test.tsx › carte à risque : pas de « Toujours », une ligne dit pourquoi` ; `src/main/agent/permission-risk.test.ts` |
| 12 | « Autoriser une fois » : focus à la saisie (4 cartes) | le bouton parti avec la carte ne laisse pas le focus sur la page | composant | `src/renderer/src/focus-keeper.test.ts` (existant) | oui : `focus-keeper.test.ts › bouton d'une carte qui disparaît (« Autoriser une fois ») : la zone de saisie` |

Captures : `c0-autorisation-retenue`, `c1-outils-autorises`, `c2-demande-avant-retrait`, `c2-demande-retiree-par-agent`, `c3`–`c6` (cartes 214).

---

### `nouvelle-version.mjs` — avis de nouvelle version contre un faux serveur : ligne de la barre latérale, « Plus tard », « Voir », Réglages › Nouveautés, une fois par 24 h, échec silencieux, réglage coupé
Verdict : **à garder (réduite)** — un seul lancement suffit pour la vraie requête Electron (en-têtes réellement envoyés par la pile réseau de Chromium) ; le reste est déjà testé en unitaire et en composant.
Compte : 13 vérifications — parcours 1, composant 1, unitaire-main 0, capture 1, doublon 10 ; déjà couvertes ailleurs : 12 (dont 2 en partie)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | ligne de la barre latérale : version de la même ligne, pièges ignorés | choix de la version à annoncer, pas de préversion d'une autre ligne, texte piégé inoffensif | doublon | — | `src/shared/update-check.test.ts › deux lignes publiées en parallèle (ADR-0068) : jamais de saut de ligne ni de retour arrière` + `› brouillons, étiquettes invalides et pages inattendues ignorés` ; `src/renderer/src/components/sidebar/UpdateLine.test.tsx › un numéro piégé reste du texte` |
| 2 | une requête au lancement, User-Agent `Bobine/x`, sans cookie, jeton ni langue | en-têtes **réellement** envoyés par la session Electron (Accept-Language, cookies ajoutés par Chromium) | parcours | garder ici (un seul lancement) | partiel : `src/main/update-check-electron.test.ts › en-têtes génériques, sans cookie ni redirection, délai posé` (`net` simulé : ne voit pas ce que Chromium ajoute) |
| 3 | « Voir » : nom accessible avec la version | accessibilité du bouton | doublon | — | `UpdateLine.test.tsx › barre latérale : « Voir » et ✕ passent le numéro, jamais une adresse` (getByRole avec `updates.line.viewLabel`) |
| 4 | « Plus tard » : focus à la zone de saisie | focus pas perdu sur la page | doublon | — | `UpdateLine.test.tsx › ✕ et « Voir » : le focus va à la zone de saisie, pas sur la page (recette rc.4)` |
| 5 | Réglages › Nouveautés après « Plus tard » : nouvelle et actuelle version | l'avis masqué reste lisible dans les Réglages | composant | `UpdateLine.test.tsx` : état « masqué pour cette version » → l'encart des Réglages le montre encore | partiel : `UpdateLine.test.tsx › Réglages : jamais vérifié, à jour, nouvelle version, échec, en cours` ; `src/main/update-check.test.ts › « Plus tard » : masqué pour cette version, même relu du profil ; une plus récente revient` |
| 6 | encart « est disponible » : texte et bouton centrés (≤ 1,5 px) | alignement vertical réel (CSS) | capture | capture nocturne `nouvelle-version-reglages` | non (mise en page : jsdom ne la calcule pas) |
| 7 | « Voir la version » : la page vérifiée seulement | `shell.openExternal` reçoit la seule page GitHub vérifiée | doublon | — | `src/main/update-check.test.ts › « Voir » : ouvre la page vérifiée, et masque l'avis pour cette version` + `› « Voir » d'une version inconnue : refusé, rien d'ouvert` |
| 8 | version connue, « Vérifier maintenant » en échec : dit, la version reste | | doublon | — | `UpdateLine.test.tsx › Réglages : version déjà connue, « Vérifier maintenant » qui échoue le dit, la version reste (recette rc.4)` |
| 9 | (waitFor) à la main : « à jour » | | doublon | — | `UpdateLine.test.tsx › Réglages : jamais vérifié, à jour, nouvelle version, échec, en cours` |
| 10 | « Vérifier maintenant » en échec : texte de la limite | raison courte de la limite GitHub | doublon | — | `src/main/update-check-electron.test.ts › hors ligne, délai dépassé, limite, erreur du serveur : la raison courte` ; `src/main/update-check.test.ts › à la main : l'échec est dit, avec sa raison courte` |
| 11 | relance avant 24 h : aucune requête, aucun avis | date gardée dans le profil, relue au lancement | doublon | — | `src/main/update-check.test.ts › dernière vérification gardée dans le profil : rien avant 24 h après une relance` ; `update-check-electron.test.ts › écrit update-check.json, le relit, et coupe la vérification pour les essais` |
| 12 | vérification automatique en échec : silencieuse | | doublon | — | `src/main/update-check.test.ts › automatique : rien d'affiché, une ligne au journal, date inchangée, réessai au lancement suivant` |
| 13 | réglage coupé : aucune requête, aucun avis | | doublon | — | `src/main/update-check.test.ts › réglage coupé, coupure des essais ou lecture seule : aucune requête automatique` |

Captures : `nouvelle-version-ligne`, `-reglages`, `-connue-echec`, `-a-jour`, `-echec`.

---

### `aparte.mjs` — aparté (`/btw`, ⇧⌘A) : question à côté pendant un tour, session à part du même agent, lecture seule, « Ajouter au fil »
Verdict : **disparaît entièrement** — seule la vraie concurrence (aparté pendant un tour qui attend une permission) doit rester e2e : à poser comme sous-étape de `parcours-matinee` étape 8 (tour long).
Compte : 12 vérifications — parcours 1, composant 4, unitaire-main 0, capture 1, doublon 6 ; déjà couvertes ailleurs : 10 (dont 4 en partie)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | conversation vide : carte et réponse sur l'accueil, rien dans le fil, saisie vide | aparté possible avant tout message | composant | test de la zone basse avec accueil (`src/renderer/src/components/thread/AsideCard.test.tsx` ou test d'App) | partiel : `src/renderer/src/app-commands.test.ts › /btw ouvre un aparté avec la question tapée, ou vide (fiche 180)` |
| 2 | `/btw` proposée dans le menu « / » | la commande est listée | composant | `src/renderer/src/useCommandMenu.test.ts` | non |
| 3 | l'aparté reçoit la consigne de lecture seule | | doublon | — | `src/main/conversations/aside.test.ts › question sans le fil : session à part en mode plan, consigne de lecture seule, coût compté, session supprimée` ; `src/shared/aside.test.ts › consigne de lecture seule, après la question ; fin du fil seulement si demandée` |
| 4 | par défaut, rien du fil principal | | doublon | — | `src/shared/aside.test.ts › consigne de lecture seule, après la question ; fin du fil seulement si demandée` |
| 5 | carte au-dessus de la zone de saisie, saisie vide | placement réel (getBoundingClientRect) | capture | capture nocturne `180-aparte-reponse` | non |
| 6 | coût de l'aparté affiché | | doublon | — | `AsideCard.test.tsx › réponse, refus d'office, coût ; « Ajouter au fil » met la citation dans la saisie` |
| 7 | rien dans le fil, le tour principal attend toujours sa permission | deux sessions du même processus d'agent en parallèle, sans se gêner | parcours | `parcours-matinee` étape 8 (ajouter un `/btw` pendant le tour long) | partiel : `src/main/conversations/aside.test.ts › question sans le fil…` (session à part, sans tour principal en cours) |
| 8 | case cochée : la fin du fil part avec la question | | doublon | — | `aside.test.ts › avec le fil : la fin de la conversation part avec la question ; une deuxième question dans la même session` |
| 9 | demande d'autorisation de l'aparté refusée d'office, et dite | | doublon | — | `aside.test.ts › lecture seule : une demande d'autorisation est refusée d'office` ; `AsideCard.test.tsx › réponse, refus d'office, coût…` |
| 10 | question et réponse en citation dans la saisie, jamais envoyées | | doublon | — | `AsideCard.test.tsx › réponse, refus d'office, coût ; « Ajouter au fil » met la citation dans la saisie` ; `src/shared/aside.test.ts › « Ajouter au fil » : question et réponse en citation` |
| 11 | raccourci (`app:command aside`) : carte neuve, champ prêt | la commande du menu ouvre une carte vide avec le focus | composant | `src/renderer/src/app-commands.test.ts` + `AsideCard.test.tsx` | partiel : `AsideCard.test.tsx › vide : champ prêt, estimation du fil joint, « Demander » quand la question est tapée` ; `src/main/menu.test.ts` (accélérateur ⇧⌘A) |
| 12 | Échap ferme l'aparté, le clavier revient à la saisie | | composant | `AsideCard.test.tsx` (ajouter le retour du focus) | partiel : `AsideCard.test.tsx › pendant la réponse : « Demander » désactivé, pas de citation ; Échap ferme` |

Captures : `180-aparte-conversation-vide`, `180-avant-pendant-tour`, `180-menu-btw`, `180-aparte-reponse`, `180-aparte-refus`, `180-ajouter-au-fil`, `180-aparte-raccourci`.

---

### `startup.mjs` — premier lancement sans dossier, dossier choisi par le dialogue (simulé), fenêtre retrouvée à sa place puis ramenée d'un écran disparu, menu Fenêtre
Verdict : **à garder (réduite)** — le premier lancement devient composant + main ; garder deux relances : fenêtre native à sa place, puis ramenée et agrandie.
Compte : 11 vérifications — parcours 4, composant 2, unitaire-main 1, capture 0, doublon 4 ; déjà couvertes ailleurs : 9 (dont 5 en partie)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | premier lancement : « Choisissez le dossier de votre projet », un bouton | carte de blocage du dossier | doublon | — | `src/renderer/src/components/composer/BlockerPanel.test.tsx › titre, explication et un seul bouton, qui ouvre le choix du dossier` |
| 2 | saisie inactive : « Choisissez d'abord un dossier » | placeholder `composer.placeholder.needsFolder`, champ désactivé | composant | `src/renderer/src/components/composer/Composer.test.tsx` | non |
| 3 | puce du dossier « Choisir un dossier », agent au choix | | composant | `Composer.test.tsx` (ou test de la barre de saisie) | non |
| 4 | aucun agent démarré avant le choix du dossier | pas de processus d'agent sans dossier | unitaire-main | `src/main/conversations/agentless.test.ts` | partiel : `src/main/conversations/agentless.test.ts › accueil dû en essai : aucun dossier, l'agent attend le choix (fiche 242, D17)` |
| 5 | menu Fenêtre traduit (macOS) | | doublon | — | `src/main/menu.test.ts › entrées des rôles d'Electron toutes traduites, menu Fenêtre compris (fiche 093)` + `› Fenêtre › Mon activité, ⇧⌘U (fiche 144)` |
| 6 | dossier choisi : l'agent y démarre | | doublon | — | `src/main/conversations/manager.test.ts › dossier choisi : l'agent y démarre, le dossier entre dans les récents` (le dialogue est simulé dans l'e2e aussi) |
| 7 | dossiers récents : seulement celui choisi | | doublon | — | même test `manager.test.ts` ; `src/main/conversations/settings-view.test.ts › le dossier de repli interne de l'app n'est jamais un dossier récent` |
| 8 | fenêtre enregistrée en quittant (x, largeur, hauteur) | bornes de la vraie fenêtre écrites à la fermeture | parcours | garder ici | partiel : `src/main/window-state.test.ts › déplacement : enregistré une fois le geste fini ; fermeture : tout de suite` (fenêtre simulée) |
| 9 | relance : le dossier choisi est repris, l'agent démarre | redémarrage réel | parcours | garder ici (ou `parcours-matinee` étape 13 si le dossier y est choisi plutôt qu'imposé) | partiel : `manager.test.ts › dossier connu au lancement : l'agent par défaut démarre avant le choix d'un autre agent` |
| 10 | relance : fenêtre à sa place | fenêtre native rouverte aux mêmes bornes | parcours | garder ici | partiel : `window-state.test.ts › sur un écran présent : à l'identique, même à cheval sur deux écrans` |
| 11 | écran disparu : fenêtre ramenée sur l'écran principal, agrandie | vrai `screen` + vrai `isMaximized()` | parcours | garder ici | partiel : `window-state.test.ts › écran débranché : centrée sur l'écran principal, à une taille qui y tient` + `› affichage : agrandie avant de se montrer, plein écran ensuite` |

Captures : `44-premier-lancement`, `45-dossier-choisi`.

---

### `plan.mjs` — plan annoté (plan écrit dans `plan.md` comme Bob) : remarques, barre stable, plan long, rechargement, version 2 et diff, exécution unique
Verdict : **à garder (réduite)** — les mesures de mise en page (2, 3, 4, 6) ne se font pas sous jsdom ; tant que la capture nocturne ne les vérifie pas, garder un e2e court sur la barre du plan. Le reste passe en composant / partagé.
Compte : 11 vérifications — parcours 0, composant 4, unitaire-main 1, capture 4, doublon 2 ; déjà couvertes ailleurs : 8 (dont 6 en partie)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | mode plan : `plan.md` affiché comme document (version 1) | plan d'un fichier reconnu et rendu | composant | `src/renderer/src/components/thread/PlanDocument.test.tsx` (rendu) | partiel : `src/shared/plan-doc.test.ts › Bob : fichier Markdown écrit en mode plan, versions successives du même fichier` |
| 2 | remarque ajoutée : boutons à la même place, l'ancien « Envoyer » reste « Envoyer » | barre stable quand le texte d'aide change (D10) | capture | capture nocturne `97a-plan-premiere-remarque` (ou e2e court gardé) | partiel : `PlanDocument.test.tsx › boutons ancrés à droite : ni leur place ni leur ordre ne suivent le texte d'aide` (structure, pas de mesure) |
| 3 | première remarque : la barre ne remonte pas, rien sous le pointeur | formulaire replié sans faire remonter la barre (D27) | capture | idem | partiel : `PlanDocument.test.tsx › formulaire replié, remarque retirée : la barre ne remonte pas sous le pointeur (D27)` |
| 4 | fenêtre étroite : boutons à la même place avec ou sans remarque | | capture | capture nocturne `97-plan-barre-etroite` | partiel : mêmes tests PlanDocument |
| 5 | passage commenté : remarque listée, passage surligné | `CSS.highlights` posé sur le passage | composant | `PlanDocument.test.tsx` (avec une doublure de `CSS.highlights`, absent de jsdom) | non |
| 6 | plan long : rien de caché dans la carte, fin au-dessus des remarques | pas de défilement caché (fiche 095) | capture | capture nocturne `98b-plan-long-annote` | non |
| 7 | remarques en cours gardées après rechargement | stockage local relu | doublon | — | `src/renderer/src/plan-notes.test.ts › gardées par conversation et version, retrouvées après rechargement, effacées si vides` |
| 8 | remarques envoyées : passage cité et remarque | message de remarques | doublon | — | `src/shared/plan-doc.test.ts › message de remarques : passages cités, demande de mise à jour en restant en mode plan` |
| 9 | version 2 : « Voir ce qui a changé » montre le diff | diff entre versions du plan | composant | `PlanDocument.test.tsx` | non |
| 10 | exécuter : retour au mode d'exécution, puis demande d'exécution | mode changé avant l'envoi de la demande | unitaire-main | `src/main/conversations/manager.test.ts` (mode puis prompt, dans l'ordre) | partiel : `src/shared/plan-doc.test.ts › mode d'exécution : celui d'avant le plan, sinon ni plan ni ask` |
| 11 | plan exécuté : « Exécuter » désactivé, « Plan déjà exécuté » | pas de double exécution (fiche 272) | composant | `PlanDocument.test.tsx` | partiel : `src/shared/plan-doc.test.ts › « Exécute ce plan. » hors plan, tour réussi : exécuté, plus d'action` |

Captures : `97a`, `97`, `98`, `98b`, `99-plan-version-2`.

---

### `parcours-reglages.mjs` — journée type (fiche 277) : réglages changés pendant le travail (langue, thème, proxy, agent par défaut, mémoire, `@rôle`) sans rien perdre
Verdict : **à garder** — c'est une journée type ; chaque étape enchaîne IPC, processus d'agent et état réel.
Compte : 11 vérifications — parcours 11, composant 0, unitaire-main 0, capture 0, doublon 0 ; déjà couvertes ailleurs : 6 (toutes en partie)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | deux conversations dans la barre latérale (étape 1) | point de départ, l'une au travail | parcours | garder ici | non |
| 2 | langue changée deux fois : interface traduite, le tour continue, rien de perdu (étape 2) | changement de langue à chaud pendant un tour réel | parcours | garder ici | partiel : `src/main/i18n.test.ts › change de langue à chaud et passe la sienne au renderer, que le preload relit` ; `src/renderer/src/components/settings/SettingsDialog.test.tsx › suit la langue sans fermer les réglages, et se retrouve en cherchant dans l'une ou l'autre` |
| 3 | l'autre conversation a gardé son fil (étape 3) | Stop sans effet sur l'autre | parcours | garder ici | non |
| 4 | thème sombre appliqué à l'app, puis système (étape 4) | `nativeTheme.themeSource` réellement changé | parcours | garder ici | non |
| 5 | modèle injoignable : le proxy réglé est cité (étape 5) | proxy saisi → variables du prochain agent → bandeau | parcours | garder ici | partiel : `src/renderer/src/components/thread/AgentUnreachableBanner.test.tsx › tentative et décompte, piste du proxy, message de l'agent replié et tel quel` ; `src/main/agent-config/network-env.test.ts › variables posées aux agents : seulement ce qui est saisi ; NO_PROXY local par défaut` |
| 6 | sans proxy : piste Wi-Fi / VPN, la réponse arrive, le bandeau part (étape 6) | | parcours | garder ici | partiel : `AgentUnreachableBanner.test.tsx › sans proxy : piste Wi-Fi, VPN ; sans message : rien de replié ; Arrêter et Réglages` |
| 7 | nouvelle conversation avec l'agent choisi ; les autres gardent le leur (étape 7) | agent par défaut changé à chaud | parcours | garder ici | non |
| 8 | retenu : la conversation suivante (autre agent) le reçoit (étape 8) | mémoire écrite puis injectée à un autre agent | parcours | garder ici | partiel : `src/main/memory/memory-flow.test.ts › propose, le tour continue ; « Non » puis « Retenir » ; issue au message suivant ; index ensuite` |
| 9 | souvenir modifié dans Réglages › Mémoire (étape 9) | modification par l'écran, fichier réel | parcours | garder ici | partiel : `src/main/memory/memory-ipc.test.ts › modifier : mêmes validations que l'outil, secret refusé, version dépassée refusée` |
| 10 | souvenir oublié (étape 9) | suppression confirmée | parcours | garder ici | non |
| 11 | le rôle répond dans sa carte, la conversation reste affichée (étape 10) | `@ux-ui-expert` lance une fille qui répond | parcours | garder ici | partiel : `src/main/roles/roles-children.test.ts › `@rôle` de la saisie (phase 3B) : une fille par rôle, même texte, rôle inconnu rendu à part` |

Captures : `276-reglages-autre-langue`, `276-reglages-proxy`, `276-reglages-role`.

---

### `filles-tech-lead.mjs` — mère tech lead dans un dépôt git : agent inconnu refusé, modèle proposé et sa raison, correction par `message_child`, recommandation, fusion du seul travail de la carte, fille bavarde
Verdict : **disparaît entièrement** — tout est en double sauf la relecture des branches après de vrais commits et la fusion limitée à la carte, à ajouter à `parcours-deleguer` étapes 3–4 (un travail lancé à la main hors de la carte, non fusionné).
Compte : 11 vérifications — parcours 2, composant 1, unitaire-main 0, capture 0, doublon 8 ; déjà couvertes ailleurs : 11 (dont 3 en partie)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | `start_child` : agent inconnu refusé avec la liste, sans carte | | doublon | — | `src/main/mcp/children-tools.test.ts › agent ou modèle inconnus : erreur claire avec les valeurs possibles, sans carte` |
| 2 | carte : modèle proposé par la mère et sa raison | | doublon | — | `src/renderer/src/components/thread/ChildProposals.test.tsx › agent et modèle proposés par la mère, présélectionnés, et sa raison (fiche 160)` |
| 3 | carte : agent de la mère et modèle proposé présélectionnés | | doublon | — | même test ChildProposals |
| 4 | carte de groupe : ni « Sous-tâches », ni compte rendu, ni recommandation séparés | | doublon | — | `src/renderer/src/components/thread/WorkGroup.test.tsx › « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé` + `› message de l'agent au travail : dans sa carte ; recommandation : la pastille seule` |
| 5 | la correction (`message_child`) dans la carte du travail, puis sa réponse | | doublon | — | `WorkGroup.test.tsx › message de l'agent au travail : dans sa carte…` ; `src/main/conversations/children.test.ts › `filles-tech-lead` (fiche 160) : modèle proposé, correction, puis recommandation` |
| 6 | rien de fusionné par l'agent | | doublon | — | `children.test.ts › `filles-tech-lead` (fiche 160)…` (rev-list = 1) ; `children-tools.test.ts › recommend_merge : posé pour la fille, ne fusionne rien (fiche 160)` |
| 7 | carte de groupe : « Recommandée », le recommandé proposé ; l'autre travail a sa carte | branches relues après de vrais commits dans les worktrees, au retour à la mère (course de la fiche 250) | parcours | `parcours-deleguer` étape 3 (commits) + 4 | partiel : `WorkGroup.test.tsx › conversation réaffichée : ses branches se relisent (commits faits ailleurs entre-temps)` |
| 8 | fusion depuis la carte : son travail seulement | `git log main` réel : la branche hors carte n'est pas fusionnée | parcours | `parcours-deleguer` étape 4 | partiel : `src/renderer/src/components/thread/SubtasksMerge.test.tsx › le pied ne compte ni ne fusionne que les lignes de la carte, pas les travaux d'une bulle` ; `WorkGroup.test.tsx › pied : « Fusionner les 2 prêts dans main », lu et lancé pour les travaux de la carte seulement` |
| 9 | fille bavarde : la mère lit la réponse entière par `child_status` | compte rendu borné, suite lisible | doublon | — | `children.test.ts › `filles-bavarde` (fiches 160, 247) : compte rendu borné, sans la fin ; la mère lit la suite par `child_status`` ; `children-tools.test.ts › child_status `full` (fiche 247)…` |
| 10 | fille bavarde : 30 fichiers non commités dits sur sa ligne | compte du non commité sur la ligne | composant | `WorkGroup.test.tsx` (méta de ligne `workCard.dirty`) | partiel : `WorkGroup.test.tsx › modifications non commitées dans sa branche : dites, la fusion ne les prendra pas` |
| 11 | réponse dans la carte, repliée, commence par le récapitulatif | | doublon | — | `WorkGroup.test.tsx › une ligne se déplie sur la carte-réponse du travail : réponse entière, transmission, Ouvrir` |

Captures : `filles-tech-lead-1-proposition`, `-2-recommandee`, `-4-fusionnee`, `-5-bavarde`.

---

### `aurore.mjs` — thème Aurore / Aurore nuit : vignette « Nouveau », six touches (lueur, bulle, liseré, dégradé, ombre, verre), repli transparence réduite / contraste
Verdict : **disparaît entièrement** — ce sont des styles calculés par un vrai moteur : ils vont dans la capture nocturne, **à condition que ces assertions de style calculé y restent** (sinon elles sont perdues) ; les valeurs des jetons sont déjà testées dans `theme-aurora.test.ts`.
Compte : 11 vérifications — parcours 0, composant 0, unitaire-main 0, capture 10, doublon 1 ; déjà couvertes ailleurs : 9 (dont 8 en partie)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | vignette marquée « Nouveau », plus de Sépia | | doublon | — | `src/renderer/src/components/settings/SettingsDialog.test.tsx › huit thèmes, six accents : chaque choix part dans les préférences ; Aurore « Nouveau »` ; `src/shared/preferences.test.ts › Sépia retiré (fiche 226)…` |
| 2 | thème appliqué (`--bg` calculé = jeton) | la feuille de style chargée applique la palette | capture | capture nocturne `a1-apparence-aurore` | partiel : `src/shared/theme-aurora.test.ts › Aurore pose chaque variable neutre, et le repli n'en invente pas` |
| 3 | Réglages en verre dépoli (ou opaques sans `glass`) | `backdrop-filter` réel selon la plateforme | capture | capture nocturne `a1` | partiel : `theme-aurora.test.ts › ${palette} : verre des menus et des Réglages, sur le contenu flouté derrière` |
| 4 | lueur en haut de la barre latérale | | capture | capture `a2-aurore-fenetre` | partiel : `theme-aurora.test.ts › ${palette} : sous la lueur de la barre latérale, en tout point et pour chaque largeur` |
| 5 | bulle de l'utilisateur en dégradé | | capture | capture `a2` | partiel : `theme-aurora.test.ts › ${palette} : carte d'autorisation et son pied, bulle de l'utilisateur` |
| 6 | carte d'autorisation : ombre teintée, action en dégradé | | capture | capture `a2` | partiel : même test + `› le dégradé d'action part de l'accent (maquettes v3, « Touches légères »)` |
| 7 | aucun verre dans le fil | | capture | capture `a2` | non |
| 8 | saisie au focus : liseré dégradé | `:focus-within` réel | capture | capture `a2` | non |
| 9 | menu du panneau en verre (ou opaque) | | capture | capture `a2b-aurore-menu` | partiel : `theme-aurora.test.ts › ${palette} : verre des menus et des Réglages…` |
| 10 | repli (boucle : transparence réduite, contraste) : verre opaque, plus de lueur, dégradés unis | requêtes média réelles | capture | capture `a3-aurore-repli` | partiel : `theme-aurora.test.ts › repli : verre opaque, lueur et fonds de base retirés, dégradés unis` |
| 11 | préférences revenues : la lueur revient | | capture | capture nocturne | partiel : même test de repli |

---

### `finitions.mjs` — finitions 0.9.1 : pied de réponse (bilan), « ↓ N nouveaux », à 900 px onglets et puce de l'agent jamais coupés, pied du tour sans débordement
Verdict : **disparaît entièrement** — les mesures de mise en page vont dans la capture nocturne ; le clic sur un onglet serré (✕ invisible posé dessus) va dans `parcours-longue` étape 5 (panneau ouvert, fenêtre étroite).
Compte : 10 vérifications — parcours 1, composant 2, unitaire-main 0, capture 5, doublon 2 ; déjà couvertes ailleurs : 7 (dont 5 en partie)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | tour arrêté : pas de bilan sous « Interrompu » | | doublon | — | `src/renderer/src/components/thread/TurnSummary.test.tsx › tour arrêté, refusé, coupé ou en erreur : pas de « Terminé » sous son avis` ; `Transcript.test.tsx › tour arrêté : comme avant, l'heure et la durée au survol, sans bilan` |
| 2 | bilan dans le pied : « 1 fichier +1 −1 », sans « Travaille », une durée, « Copier » | | doublon | — | `TurnSummary.test.tsx › un seul pied : « heure · durée · 2 fichiers +2 −1 », sans « Terminé » (fiche 261)` |
| 3 | pied visible sans survol, une seule rangée | opacité réelle après le fondu, pas de rangée au survol | capture | capture nocturne `185-bilan-du-tour` | non |
| 4 | « ↓ N nouveaux » sur le bouton | compte des réponses arrivées pendant la relecture | composant | `src/renderer/src/useNewSinceScroll.test.ts` + test du bouton (libellés `app.scrollDownNew` / `scrollDownMany`) | partiel : `useNewSinceScroll.test.ts › compte ce qui arrive une fois le fil remonté, zéro en bas ou dans une autre conversation` |
| 5 | en bas du fil : plus de bouton | | composant | même test | partiel : même test |
| 6 | 900 px (boucle 2 onglets) : noms entiers ou icônes, aucun coupé, ✕ de l'actif visible | mise en page réelle des onglets | capture | capture nocturne `185-900-onglets` | non |
| 7 | 900 px : rangée au cran serré | classe `tight` posée par la mesure réelle | capture | capture nocturne | non |
| 8 | cran serré (boucle) : un clic sur l'icône l'ouvre, rien n'est fermé | le ✕ invisible posé dessus ne prend pas le clic (hit-test CSS réel) | parcours | `parcours-longue` étape 5 (panneau ouvert en fenêtre étroite) | partiel : `src/renderer/src/components/panel/tab-close-guard.test.ts › second clic d'un double clic : ne ferme jamais ; clic simple ou clavier : ferme` ; `SidePanelTabs.test.tsx › souris : clic aussitôt après l'activation : ferme ; second clic d'un double clic : non` (ne voient pas la superposition CSS) |
| 9 | 900 px : puce de l'agent nom entier ou icône, jamais un bout | | capture | capture nocturne | partiel : `src/renderer/src/components/composer/useBarFold.test.ts › plus étroit : l'agent passe à son icône et son chevron, jamais un bout de nom (fiche 185, D26)` |
| 10 | 900 px : pied du tour dans le fil, aucun élément coupé | | capture | capture nocturne `261-pied-900` | partiel : `parcours-longue` étape 4 (« rien ne déborde », 640 px) |

Captures : `185-bilan-du-tour`, `185-nouveaux`, `185-900-onglets`, `261-pied-900`.

---

### `about.mjs` — fenêtre « À propos de Bobine » : ouverte par le menu, une seule, attachée ; textes, « Copier les infos techniques », liens, « Nouveautés », Échap
Verdict : **à garder (réduite)** — garder la fenêtre native (une seule, attachée, taille), « Nouveautés » qui ouvre les Réglages de la fenêtre principale, et Échap ; les textes sont déjà testés en composant.
Compte : 10 vérifications — parcours 3, composant 2, unitaire-main 0, capture 0, doublon 5 ; déjà couvertes ailleurs : 10 (dont 5 en partie)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | menu › À propos : une fenêtre, attachée, 400 × 420, non redimensionnable, une seule | vraie `BrowserWindow` | parcours | garder ici | partiel : `src/main/about-window.test.ts › une seule à la fois, enfant de la fenêtre principale, montrée une fois prête` |
| 2 | nom, version, présentation, « projet indépendant » ; commit du build injecté | textes + commit injecté au build | composant | `src/renderer/src/components/about/AboutWindow.test.tsx` (existant) ; commit injecté : seulement visible sur un vrai build | partiel : `AboutWindow.test.tsx › nom, version et date en toutes lettres, présentation, non-affiliation ; aucune info technique affichée` |
| 3 | aucune information technique affichée | | doublon | — | même test AboutWindow |
| 4 | titre de la fenêtre « À propos de Bobine » | | doublon | — | même test AboutWindow (`document.title`) |
| 5 | « Copier les infos techniques » : version, commit, moteurs, système, langue, agents | | doublon | — | `src/main/technical-info.test.ts › version, commit, date, moteurs, système, langue et agents installés` ; `AboutWindow.test.tsx › « Copier les infos techniques » : bloc du main dans le presse-papiers, « Copié » deux secondes` |
| 6 | « Copié » affiché | | doublon | — | même test AboutWindow |
| 7 | « Copié » s'efface au bout de deux secondes | | doublon | — | même test AboutWindow |
| 8 | GitHub, licence, « Signaler un problème » ouverts dans le navigateur | adresses exactes passées à `openExternal` | composant | `AboutWindow.test.tsx` (ajouter GitHub et licence) | partiel : `AboutWindow.test.tsx › « Signaler un problème » : issue préremplie avec la version et le bloc ; « Nouveautés » ; Échap` |
| 9 | « Nouveautés » : fenêtre fermée, Réglages › Nouveautés ouverts | IPC d'une fenêtre à l'autre | parcours | garder ici | partiel : même test AboutWindow (côté page seulement) |
| 10 | Échap : fenêtre fermée | fermeture de la vraie fenêtre | parcours | garder ici | partiel : même test AboutWindow |

Captures : `o0-a-propos`, `o1-a-propos-copie`, `o2-nouveautes`.

---

### `travail-recette.mjs` — recette du 20 novembre (fiche 267) : quota gratuit épuisé (conversation et travail), `@rôle` + Entrée aussitôt, activité d'une longue commande sur une ligne
Verdict : **disparaît entièrement** — tout est déjà testé en composant (BlockerPanel, WorkCard, RoleComposerLoss) et en main (turn-quota, turn-auth-manager).
Compte : 9 vérifications — parcours 0, composant 1, unitaire-main 1, capture 0, doublon 7 ; déjà couvertes ailleurs : 9 (dont 2 en partie)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | quota épuisé : carte « Modèle refusé » et sa raison, jamais l'erreur brute | | doublon | — | `src/renderer/src/components/composer/BlockerPanel.test.tsx › fiche 267 (N3) : quota gratuit épuisé, la raison dite, « Choisir un autre modèle » d'abord` ; `src/main/agent/turn-quota.test.ts › profil OpenCode, l'erreur réelle : la carte du modèle de la session, quota épuisé` |
| 2 | « Choisir un autre modèle » en principal, la clé d'API en second | | doublon | — | même test BlockerPanel |
| 3 | pas d'avis en double dans le fil tant que la carte est là | | composant | `src/renderer/src/components/thread/Transcript.test.tsx` (avis masqué tant que la carte est là) | partiel : `turn-quota.test.ts › avis du fil : quota épuisé, marqué « refus »` |
| 4 | un autre modèle : le message repart et l'agent répond | | doublon | — | `turn-quota.test.ts › carte, pas d'erreur brute ; un autre modèle renvoie le message` ; `src/main/conversations/turn-auth-manager.test.ts › autre modèle choisi sur la carte (fiche 210) : même conversation, message renvoyé une fois, modèle refusé marqué` |
| 5 | rôle choisi, Entrée aussitôt puis encore : une bulle, un travail, saisie vide (N5) | | doublon | — | `src/renderer/src/components/roles/RoleComposerLoss.test.tsx › rôle de conseil choisi, texte tapé, Entrée aussitôt : il part, une fois` + `› double Entrée pendant l'envoi : un seul envoi, rien de perdu` |
| 6 | activité en direct : une ligne coupée, la commande entière en infobulle (N4) | | doublon | — | `src/renderer/src/components/thread/WorkCard.test.tsx › fiche 267 (N4) : une commande de dix lignes tient sur une ligne, l'entière en infobulle` (la hauteur mesurée n'y est pas : capture `267-activite-commande`) |
| 7 | en-tête « quota épuisé » et barre latérale « bloqué » | | doublon | — | `WorkCard.test.tsx › fiche 267 (N3, N8) : modèle du travail refusé (quota épuisé), dit dans sa carte, un autre modèle choisi depuis elle` ; `src/renderer/src/components/sidebar/conversation-state.test.ts › quota épuisé, modèle refusé : l'état bloqué, même avec une demande en attente` |
| 8 | carte du travail : quota dit, « Choisir un autre modèle » du travail | | doublon | — | même test WorkCard (N3, N8) |
| 9 | le travail repart avec l'autre modèle, réponse dans sa carte | modèle changé sur la **fille** depuis la carte de la mère, message renvoyé | unitaire-main | `src/main/conversations/turn-auth-manager.test.ts` (même cas pour une fille) | partiel : `turn-auth-manager.test.ts › autre modèle choisi sur la carte (fiche 210)…` (conversation elle-même, pas une fille) |

Captures : `267-quota-carte`, `267-activite-commande`, `267-quota-travail`.

---

#### Risques repérés (lot)

- **Pile réseau d'Electron** (nouvelle-version n° 2) : un `net` simulé ne voit pas ce que Chromium ajoute lui-même (Accept-Language de l'utilisateur, cookies). C'est la seule preuve qu'aucune donnée personnelle ne part vers GitHub : à garder en e2e.
- **Mise en page réelle** (plan 2–4 et 6, finitions 3, 6, 7, 9, 10, aparte 5, nouvelle-version 6) : jsdom ne calcule ni positions, ni débordements, ni opacité après un fondu. Les tests PlanDocument existants vérifient la structure, pas la mesure. Si la capture nocturne ne fait que photographier sans rien vérifier, les régressions D10/D27 (barre du plan qui saute sous le pointeur) ne seront plus détectées automatiquement.
- **Hit-test CSS** (finitions 8) : le défaut corrigé (un ✕ invisible posé sur l'onglet qui prend le clic) n'existe que dans un vrai moteur. tab-close-guard et SidePanelTabs ne le verraient pas : à placer dans une journée type.
- **Styles calculés du thème** (aurore, en entier) : `theme-aurora.test.ts` vérifie les valeurs des jetons, pas que la feuille de style les applique (cascade, `:focus-within`, `prefers-reduced-transparency`, `prefers-contrast`, `backdrop-filter` selon la plateforme, fiche 145 Linux). Sans assertions dans la capture nocturne, rien ne serait vérifié.
- **Focus réel** (permissions 4 et 12, nouvelle-version 4, aparte 12) : `focus-keeper.test.ts` teste la logique, pas que la vraie fenêtre des Réglages ou la carte la déclenchent bien dans Electron.
- **Concurrence entre sessions d'un même agent** (aparte 7) : aparté et tour principal en attente d'une permission sur le même processus d'agent. `aside.test.ts` n'a pas de tour principal en cours : à poser dans parcours-matinee.
- **Git réel et relecture des branches** (filles-tech-lead 7–8) : l'ordre « commits dans les worktrees → retour à la mère → plan relu » a déjà été fragile (fiche 250, Linux). Les tests WorkGroup simulent le plan. Ajouter à parcours-deleguer un travail hors de la carte, non fusionné.
- **Fenêtres natives et redémarrage** (startup 8–11, about 1, 9, 10) : bornes rendues par macOS, vrai `screen`, `isMaximized`, fenêtre enfant, IPC d'une fenêtre à l'autre, fermeture par Échap. window-state et about-window simulent la fenêtre.
- **Commit injecté au build** (about 2) : seul un vrai build le contient ; un test de composant le reçoit tout fait.
- **Retrait par l'agent** (permissions 6) : la course réelle (carte retirée juste après son arrivée, issue Linux n° 16) a été domptée par un signal. Un test de composant verra le rendu final, pas l'ordre des évènements à travers l'IPC.


