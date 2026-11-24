# Plan de suppression des e2e remplacées (étape 3 de la pyramide)

Établi le 2026-11-24 sur la branche `test/pyramide` (les six branches de remplaçants assemblées,
`./scripts/verify` vert). **Rien n'est supprimé ici** : ce plan attend la validation de
l'utilisateur. Sources : `docs/tests/inventaire-e2e-{A,B,C}.md` (colonne « Déjà couvert ? »,
après assemblage), ADR-0069, fiche 277. Généré ligne à ligne depuis les inventaires : chaque
vérification y a sa ligne, avec son numéro d'inventaire.

## Règle

**Une vérification e2e ne part que si son remplaçant nommé existe et est vert.**

- Remplaçant Vitest (`*.test.ts(x)`, `*.test.mjs`) : il existe (fichier vérifié) et `verify` est
  vert sur cette branche → état **vert**.
- Remplaçant dans une journée type (`parcours-*`) : étape ajoutée le 2026-11-24 et jamais jouée,
  ou étape de `parcours-deleguer` (rouge le 2026-11-23, défauts 1-2 de la fiche 277, corrigés
  depuis sur `main` mais pas rejoués) → état **à confirmer** : la vérification ne part qu'après
  une campagne `e2e.yml` verte (macOS + Linux, clair et sombre) de la journée.
- Étapes des journées jouées vertes le 2026-11-23 (matinée, réglages, outils, longue, pannes) →
  **vert**.
- Une vérification `parcours` reste e2e, sauf si une étape de journée la reprend. Une `capture`
  reste dans sa suite réduite avec sa mesure (`affirm`, fiche 277), sauf si une journée la mesure.
  Une vérification dont le remplaçant dit « reste e2e » pour une partie du contrat reste.

## Chiffres avant / après

| | Avant | Après étape 1 (remplaçants verts) | Après étape 2 (+ journées confirmées) |
|---|---:|---:|---:|
| Suites e2e | 126 | 118 | 115 |
| Vérifications e2e inventoriées | 1987 | 755 | 720 |
| Durée de la suite complète, temps machine (clair + sombre) | 75 min | ≈ 38 min | ≈ 36 min |
| Durée murale estimée (`--jobs 3`) | ≈ 25 min | ≈ 13 min | ≈ 12 min |

- Vérifications retirées : **1231** à l'étape 1 (remplaçant vert),
  **35** de plus à l'étape 2 (journée à confirmer), **1** creuse
  sans remplaçant. Restent : **720** (dont 394 `parcours`,
  113 `capture` à mesurer, et
  213 sans remplaçant complet : section
  « Pas encore remplaçable »).
- Suites : **8** supprimées entièrement à l'étape 1, **11** à l'étape 2 ;
  **107** réduites ; **8** gardées telles quelles : `degrade-haut`, `parcours-matinee`, `parcours-reglages`, `parcours-deleguer`, `parcours-outils`, `parcours-longue`, `parcours-pannes`, `parcours-premier-lancement`.
- Hors inventaire : `parcours-premier-lancement` (journée ajoutée le 2026-11-24, 11
  `check`, gardée ; sa durée est estimée à la moyenne des autres journées).
- Durées : dernier passage complet local (`~/Dev/bobine-oss/e2e/.durations.json`, 2026-11-23),
  somme des tâches clair et sombre. Après : une suite supprimée ne coûte plus rien ; une suite
  réduite garde 2.5 s de lancement par thème, plus le reste au prorata des vérifications
  gardées (estimation : le coût réel d'une vérification varie beaucoup d'une suite à l'autre).
  La durée murale est la somme divisée par trois tâches parallèles (borne basse).

**Supprimées entièrement à l'étape 1** (8) : `fil`, `astuces`, `export`, `providers`, `roles-meme-icone`, `textes-plateforme`, `reprise`, `touches`.

**Supprimées entièrement à l'étape 2 seulement** (3) : `acp`, `filles-non-commite`, `mentions`.

## Vérifications creuses (supprimées sans remplaçant)

- `usage` n° 7 (« rien dans la liste des conversations ni dans l'en-tête », ×2) :
  `e2e/suites/usage.mjs` cherche `[data-testid=history-cost], [data-testid=conversation-cost]` ;
  `grep -rn "history-cost\|conversation-cost" src/` ne trouve rien : ces éléments n'existent
  plus, la négation est toujours vraie (inventaire A et lot dialogues : « à supprimer, sans
  remplaçant »).
- `profil` (hors compte de l'inventaire), ligne 79 : `else check(true, 'disque plein : image disque
  macOS seulement (ignoré ici)')` hors macOS : ne vérifie rien. Retirer la branche `else`, garder
  l'essai macOS.
- Faux creux, **gardés** : les `check(true, …)` qui suivent un `waitFor` (ex. `regles-approbation`
  n° 31, nombreux `profil`, étapes « app quittée » des journées) vérifient par l'attente qui les
  précède ; `regles-approbation` n° 31 part quand même, mais parce que son remplaçant existe.

## Lecture des tableaux

Sort : **retirée** (avec remplaçant) · **reste** (avec la raison) · **creuse**. État : **vert**
ou **à confirmer** (voir la règle). Le remplaçant est recopié de l'inventaire, sans la valeur
« avant : » ; `R/` = `src/renderer/src/`, `M/` = `src/main/`, `C/` = `src/renderer/src/components/`.

## Suites du groupe A (`inventaire-e2e-A.md`)

### `queue` — réduire

9 vérifications : 8 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 11 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | accueil : l'invite demande quoi faire | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › conversation neuve : l’invite demande quoi faire (queue n° 1) | vert |
| 2 | pendant la réponse : invite « ajouter une suite » | doublon | retirée | `Composer.test.tsx › mode Plan pendant une réponse : l’invite de la réponse en cours reste prioritaire` | vert |
| 3 | Entrée pendant la réponse : mis en file, la réponse continue | doublon | retirée | `parcours-matinee` étape 9 (« retour : le tour continue, la suite attend dans la file ») ; `agent-host.test.ts › messages écrits pendant la réponse : envoyés ensemble à la fin du tour` | vert |
| 4 | « Modifier » remet le message dans la saisie | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › « Modifier » d’un message en attente : retiré pour modification, remis dans la saisie (queue n° 4) | vert |
| 5 | message modifié : il garde sa place | unitaire-main | reste | partiel : `message-queue.test.ts › un message modifié reprend sa place ; supprimé, non (fiche 247, D12)` (logique seule, pas le chemin renderer→IPC) | — |
| 6 | « Envoyer maintenant » : réponse interrompue, envoyés ensemble | doublon | retirée | `agent-host.test.ts › « Envoyer maintenant » : interrompt la réponse, ce message part en premier` | vert |
| 7 | conversation : l'invite propose de répondre à l'agent nommé | doublon | retirée | `Composer.test.tsx › hors mode Plan : ni teinte, ni ligne de rappel, invite habituelle` | vert |
| 8 | Échap arrête ; la file attend au lieu de partir seule | doublon | retirée | `parcours-matinee` étape 10 (Stop, `queued.interrupted`) ; `composer-keys.test.ts › Échap arrête la réponse ; ↑ dans une zone vide reprend le dernier message en attente` ; `agent-host.test.ts › Stop : la file reste en attente, puis part à la demande` | vert |
| 9 | message en attente envoyé à la demande | doublon | retirée | `parcours-matinee` étape 10 (« tour arrêté : la suite part à la demande, l’agent y répond ») | vert |

### `rules` — réduire

3 vérifications : 1 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 5 s → ≈ 5 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | menu ouvert d'emblée à sa place (côtés relevés image par image) | composant | reste | partiel : `SessionSettingsMenu.test.tsx › s’affiche une fois les règles lues, à sa taille, pas avant (fiche 082)` ; `menu-placement.test.ts › opens above the composer when the whole menu fits there (conversation view)` — le positionnement Radix réel n'est pas vu | — |
| 2 | règles du projet, personnelles et du mode actif ; pas celles d'un autre mode | composant | reste | partiel : `rules.test.ts › Bob : AGENTS.md du dossier, rules/ et rules-<mode>/ du projet, des greffons et de ~/.bob` ; `manager.test.ts › règles actives : selon le mode, lisibles en aperçu même hors du dossier ; rien d’autre (fiche 056)` (main) — libellés de portée affichés : non | — |
| 3 | règle personnelle (hors du dossier) ouverte en aperçu | doublon | retirée | `manager.test.ts › règles actives : selon le mode, lisibles en aperçu même hors du dossier ; rien d’autre (fiche 056)` ; `useFileLinks.test.ts › une règle du dossier s’ouvre en aperçu` | vert |

### `parallel` — réduire

5 vérifications : 3 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 23 s → ≈ 12 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | la première conversation continue de répondre (indicateur) | doublon | retirée | `parcours-matinee` étape 8 (« la deuxième répond ; la première travaille encore (indicateur dans la barre latérale) ») | vert |
| 2 | worktree : branche créée, dans l'infobulle, dépôt principal intact | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | côte à côte : message envoyé à celle d'à côté, l'active ne change pas | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | (attente) case « supprimer le worktree » cochée d'office | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/sidebar/DeleteDialog.test.tsx` › rien à perdre : « supprimer le worktree » coché d’office, et part avec la conversation | vert |
| 5 | suppression : worktree et branche supprimés | doublon | retirée | `manager.test.ts › conversation dans un worktree : branche à part, suppression avec le worktree` | vert |

### `repere` — réduire

8 vérifications : 5 retirées (dont 0 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 42 s → ≈ 19 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | rôle au travail : pas de repère | doublon | retirée | `WorkCue.test.tsx › travail qui répond hors de l’écran : « ↑ Expert UX/UI a répondu · Voir », pas avant` | vert |
| 2 | un rôle répond hors de l'écran : « ↑ Expert sécu a répondu · Voir », avec avatar | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | « Voir » : carte à l'écran, entourée, focus ; plus de repère | doublon | retirée | `WorkCue.test.tsx › « Voir » : défile jusqu’à la carte, l’entoure un instant, lui donne le focus, et le repère s’en va` | vert |
| 4 | deux travaux : « ↑ 2 travaux ont répondu · Voir », sans avatar | doublon | retirée | `WorkCue.test.tsx › deux travaux : « ↑ 2 travaux ont répondu », « Voir » mène au plus ancien, puis l’autre reste` | vert |
| 5 | « Voir » : le plus ancien montré, l'autre reste au repère | doublon | retirée | idem (même `it`) ; `work-cue.test.ts › plusieurs : dans l’ordre des réponses, le plus ancien d’abord, et le compte` | vert |
| 6 | carte vue en défilant : le repère s'en va | doublon | retirée | `WorkCue.test.tsx › la carte vue en défilant : le repère disparaît` | vert |
| 7 | 900 px, nom long : nom coupé (titre en infobulle), verbe entier | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 8 | repère et « ↓ N nouveaux » ensemble : pastille à droite, sans couvrir | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |

### `profil` — réduire

42 vérifications : 27 retirées (dont 1 à confirmer), 0 creuse(s), 15 restent. Durée (clair + sombre) : 65 s → ≈ 26 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | profil 0.7/0.8/0.9 : les trois conversations, épinglée et renommée (boucle ×3, clair seulement) | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | profil N : aucun avis (boucle) | doublon | retirée | `profile-fixtures.test.ts › s’ouvre sans avis ni perte, reçoit sa marque de version` | vert |
| 3 | profil N : pas d'accueil du premier lancement (boucle) | doublon | retirée | `onboarding.test.ts › settings.json avec seulement \`window\` (une 0.9 juste ouverte) : pas d’accueil` ; `onboarding.test.ts › dossier de données neuf : accueil dû ; réglages déjà là : non` | vert |
| 4 | profil N : le fil se relit (boucle) | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | profil N : aucune marque d'accueil écrite (boucle) | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/profile-fixtures.test.ts › profil réel %s (fiche 196) › pas d’accueil, et aucune marque d’accueil écrite dans ses réglages (e2e `profil` n° 5)` | vert |
| 6 | profil N : marque de version posée, réglages gardés (boucle) | doublon | retirée | `profile-fixtures.test.ts › s’ouvre sans avis ni perte, reçoit sa marque de version` | vert |
| 7 | trois avis, chacun à sa gravité | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/common/ProfileNotices.test.tsx` › « trois avis, chacun à sa gravité ; une erreur serait une alerte » | vert |
| 8 | réglages mis de côté ; liste des conversations refaite | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/common/ProfileNotices.test.tsx` › « réglages mis de côté ; liste des conversations refaite avec leur nombre ; sans chemin » | vert |
| 9 | aucun nom de fichier dans les avis | doublon | retirée | `profile-integrity.test.ts › chaque cas a sa gravité, sans chemin dans le texte ; fermés un par un` | vert |
| 10 | les trois conversations retrouvées dans leurs fils | doublon | retirée | `profile-fixtures.test.ts › index et copie perdus : les trois conversations reviennent de leurs fils (fiche 197)` | vert |
| 11 | un avis se ferme par × | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/common/ProfileNotices.test.tsx` › « un avis se ferme par × : les autres restent » | vert |
| 12 | « Afficher dans le Finder » montre le fichier mis de côté | unitaire-main | retirée | **oui, déjà couvert** (vérifié 2026-11-24) : `M/unsaved-at-quit.test.ts` › « un avis montre son fichier par son identifiant, jamais par un chemin venu de l’interface » ; `R/components/common/ProfileNotices.test.tsx` › « « Afficher dans le Finder » désigne l’avis ; le détail technique se déplie » —  ; **remplaçant écrit (2026-11-24)** : `src/main/profile-app.test.ts › profil au lancement, jusqu’aux canaux (fiches 196, 197) › réglages abîmés : mis de côté, l’avis le dit, « Afficher dans le Finder » montre ce fichier` | vert |
| 13 | réglages et autorisations abîmés gardés à côté, jamais effacés | doublon | retirée | `profile-integrity.test.ts › réglages du mauvais type ou illisibles : mis de côté et signalés` ; `profile-integrity.test.ts › autorisations : champs inconnus gardés ; abîmées : mises de côté et signalées` | vert |
| 14 | index réécrit avec les trois conversations | doublon | retirée | `store.test.ts › copie de l’enregistrement dans le fil ; index perdu : liste refaite (fiche 197)` | vert |
| 15 | supprimer : « Mettre à la corbeille », case agent jamais cochée | doublon | retirée | `DeleteDialog.test.tsx › « aussi chez l’agent » proposé seulement s’il sait le faire, jamais coché d’office` | vert |
| 16 | la conversation est dans la corbeille de Réglages › Données | doublon | retirée | `parcours-deleguer` étape 7 ; `manager.test.ts › supprimer : à la corbeille avec son fil à jour, restaurée telle quelle (fiche 196)` | vert |
| 17 | restaurée : de retour dans la liste, corbeille vide | doublon | retirée | `parcours-deleguer` étape 7 (« restaurée : de retour dans la barre latérale ») | à confirmer |
| 18 | un dossier qui n'est pas une sauvegarde est refusé, en clair | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ProfileData.test.tsx` › « un dossier qui n’est pas une sauvegarde : refusé, en clair, sans confirmation » | vert |
| 19 | restauration : confirmation dans la carte (ce qui sera remplacé, clés à ressaisir) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ProfileData.test.tsx` › « confirmation dans la carte : ce qui sera remplacé, gardé à côté, clés à ressaisir » | vert |
| 20 | Échap ferme la confirmation, pas les réglages | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « Échap ferme la confirmation de la restauration, pas les réglages » | vert |
| 21 | Échap : aucune restauration demandée | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ProfileData.test.tsx` › « Échap referme la confirmation : aucune restauration demandée » | vert |
| 22 | effacée définitivement : plus rien sur le disque | doublon | retirée | `trash.test.ts › purge après ${TRASH_DAYS} jours, effacement à la demande : plus rien sur le disque` | vert |
| 23 | restaurée : le message part, l'agent répond, elle redevient prête (rc.4 T1) | doublon | retirée | `parcours-deleguer` étape 8 (« mère restaurée : son fil, et l’agent répond ») ; `manager.test.ts › restaurée depuis la corbeille : sa vue et ses évènements passent après ceux d’avant (rc.4, T1)` | vert |
| 24 | corbeille : la mère dit « avec son travail », elle seule | doublon | retirée | `ProfileData.test.tsx › la mère dit les travaux supprimés avec elle, qui reviendront avec elle (recette rc.4, T7)` ; `trash.test.ts › la mère dit combien de travaux supprimés avec elle y sont encore (recette rc.4, T7)` | vert |
| 25 | restaurer la mère ramène son travail | doublon | retirée | `family-delete.test.ts › restaurer la mère restaure les filles supprimées avec elle, pas une supprimée avant (rc.4, T7)` ; `parcours-deleguer` étape 7 | vert |
| 26 | restauration faite : avis de succès | parcours | reste | parcours : vraie app nécessaire | — |
| 27 | les conversations de la sauvegarde sont là | parcours | reste | parcours : vraie app nécessaire | — |
| 28 | l'état d'avant est gardé dans restaurations/ | doublon | retirée | `backup.test.ts › remplace le profil, garde l’état d’avant, qui se restaure à son tour (réversible)` | vert |
| 29 | l'état d'avant se restaure : retour au profil 0.9 | doublon | retirée | comme n° 28 : `backup.test.ts › remplace le profil, garde l’état d’avant, qui se restaure à son tour (réversible)` | vert |
| 30 | lecture seule : pas d'accueil | doublon | retirée | `onboarding-state.test.ts › profil en lecture seule (fiche 196) : jamais, et aucune marque à écrire` | vert |
| 31 | lecture seule : « Nouvelle conversation » désactivée | composant | reste | aucun remplaçant écrit | — |
| 32 | la saisie est inerte, la raison dessous | composant | reste | aucun remplaçant écrit | — |
| 33 | les conversations se relisent (lecture seule) | parcours | reste | parcours : vraie app nécessaire | — |
| 34 | menus : épingler, renommer, archiver, supprimer désactivés (raison en infobulle) ; exporter permis | composant | reste | aucun remplaçant écrit | — |
| 35 | un envoi par l'IPC est refusé lui aussi | parcours | reste | parcours : vraie app nécessaire | — |
| 36 | Mon activité : la lecture seule est dite | composant | reste | aucun remplaçant écrit | — |
| 37 | Tâches planifiées : la lecture seule est dite | composant | reste | aucun remplaçant écrit | — |
| 38 | la tâche échue n'a rien lancé | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/scheduler/scheduler-ipc.test.ts › planificateur au lancement (fiches 178, 196) › profil en lecture seule : la tâche échue ne lance rien, le fichier n’est pas touché` | vert |
| 39 | rien n'a été écrit dans le profil (empreinte) | parcours | reste | parcours : vraie app nécessaire | — |
| 40 | disque plein : dit en clair par l'app, sans code d'erreur (macOS, clair) | parcours | reste | parcours : vraie app nécessaire | — |
| 41 | aucun fichier temporaire laissé | parcours | reste | parcours : vraie app nécessaire | — |
| 42 | place libérée : les messages écrits pendant le disque plein sont sur le disque | parcours | reste | parcours : vraie app nécessaire | — |

### `settings` — réduire

43 vérifications : 31 retirées (dont 0 à confirmer), 0 creuse(s), 12 restent. Durée (clair + sombre) : 23 s → ≈ 10 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | menus de la plateforme | doublon | retirée | `menu.test.ts › menus, rôles, identifiants et raccourcis du Mac, à l’identique` ; `menu.test.ts › menus des apps Linux : ni menu « Bobine » ni Fenêtre` | vert |
| 2 | menu Linux : Réglages et Quitter (Ctrl+Q) dans Fichier, F11, À propos en dernier (Linux seul) | doublon | retirée | `menu.test.ts › Fichier : nouvelle conversation, fenêtre rapide, Réglages (Ctrl+,), fermer, Quitter (Ctrl+Q)` ; `menu.test.ts › Affichage : Mon activité et plein écran en F11 ; Aide : À propos en dernier` | vert |
| 3 | barre latérale : raccourcis ⌘1, ⇧⌘U (ou Ctrl) | composant | reste | partiel : `Sidebar.test.tsx › « Mon activité » sous « Nouvelle conversation », ⇧⌘U, en surbrillance quand ouverte` ; `key-notation.test.ts › ailleurs : Ctrl, Alt, Maj dans cet ordre, ⌘ et ⌃ donnent Ctrl` (⌘1 de l'espace : non) | — |
| 4 | ⌥⌘↑ / ⌥⌘↓ : conversation précédente, suivante | composant | reste | partiel : `menu.test.ts › chaque raccourci est dans le menu, une seule fois, et envoie sa commande` (envoi seul) | — |
| 5 | ⌘K : recherche sans accents, Entrée ouvre | doublon | retirée | `AppDialogs.test.tsx › recherche par titre : la conversation est choisie, sans ⌘F` ; `conversation-search.test.ts › tous les mots, sans casse ni accents, dans le titre, le dossier ou l’agent` | vert |
| 6 | ⌘B barre latérale, ⌘L zone de saisie | composant | reste | partiel : `menu.test.ts › chaque raccourci est dans le menu, une seule fois, et envoie sa commande` | — |
| 7 | barre latérale : 300 px par défaut | doublon | retirée | `sidebar-width.test.ts › 300 px par défaut, entre 220 et 440` | vert |
| 8 | barre latérale : réglée à la poignée, 440 px au plus | doublon | retirée | `Sidebar.test.tsx › poignée entre 220 et 440 px, retenue, double-clic : 300 px` | vert |
| 9 | double-clic sur la poignée : 300 px | doublon | retirée | comme n° 8 : `Sidebar.test.tsx › poignée entre 220 et 440 px, retenue, double-clic : 300 px` | vert |
| 10 | réglages : quatorze onglets en trois groupes | doublon | retirée | `settings-search.test.ts › quatorze onglets en trois groupes (Mémoire, fiche 182 ; Rôles, fiche 223), sans Consommation (fiches 136, 144)` | vert |
| 11 | mode « Sombre » appliqué à toute l'app (nativeTheme) | doublon | retirée | `parcours-reglages` étape 4 (« thème sombre appliqué à l’app, puis retour au thème du système ») | vert |
| 12 | thème black/aurora coché et appliqué ; plus d'accent « Comme le Mac » | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/appearance.test.ts` › « Nuit noire en sombre : `data-palette` posé ; l’accent retiré « Comme le Mac » devient l’orange » | vert |
| 13 | thème Fjord coché et appliqué (fond `--bg`) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/appearance.test.ts` › « Aurore en clair, Fjord en clair : la palette suit le thème du mode affiché » — reste hors Vitest : couleur réelle de `--bg` : capture | vert |
| 14 | apparence : police et taille du fil appliquées | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/appearance.test.ts` › « police et taille du fil : Serif en 14 px » — reste hors Vitest : valeur calculée par le vrai CSS : capture | vert |
| 15 | navigateur : cookies gardés par défaut | composant | retirée | `src/renderer/src/components/settings/PrivacySettings.test.tsx` › « cookies gardés par défaut ; décocher part dans les préférences » ; **oui, remplaçant créé** (2026-11-24) : `R/components/settings/PrivacySettings.test.tsx` › « cookies gardés par défaut ; décocher part dans les préférences » | vert |
| 16 | navigateur : « Effacer » vide les cookies et le dit | unitaire-main | reste | remplaçant partiel : reste hors Vitest : vraie pile de Chromium : e2e | — |
| 17 | cookies plus gardés → ceux du disque effacés aussitôt | unitaire-main | retirée | `src/main/settings-effects.test.ts` › « décoché : ceux du disque effacés aussitôt, une seule fois » ; › « recoché : rien n’est effacé ; décoché de nouveau : effacé de nouveau » ; › « effacement en échec : l’erreur est remontée, pas avalée » ; **oui, remplaçant créé** (2026-11-24) : `M/settings-effects.test.ts` › « décoché : ceux du disque effacés aussitôt, une seule fois » ; `M/browser/browser-clear-data.test.ts` › « cookies plus gardés : la partition du disque est vidée aussi, pas seulement celle en mémoire » ; **remplaçant écrit (2026-11-24)** : `src/main/settings-effects.test.ts › effets des réglages › décoché : ceux du disque effacés aussitôt, une seule fois` | vert |
| 18 | rebond du Dock : activé par défaut | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/NotificationsSettings.test.tsx` › « activé par défaut, en retrait sous « Notifications » » | vert |
| 19 | rebond du Dock : en retrait sous « Notifications » | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/NotificationsSettings.test.tsx` › « activé par défaut, en retrait sous « Notifications » » | vert |
| 20 | rebond du Dock : le réglage s'enregistre | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/NotificationsSettings.test.tsx` › « le réglage s’enregistre » | vert |
| 21 | notifications coupées : rebond grisé, sa valeur gardée | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/NotificationsSettings.test.tsx` › « notifications coupées : rebond grisé, sa valeur gardée » | vert |
| 22 | « Comme maintenant » tient dans les listes | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 23 | conversations gardées actives : de 6 à 2, pas en dessous | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « conversations gardées actives : de 6 à 2, pas en dessous » | vert |
| 24 | baissées : la plus ancienne au repos mise en veille | doublon | retirée | `manager.test.ts › réglage « Conversations gardées actives » (fiche 102) : en baissant, les agents en trop sont mis en veille aussitôt ; en montant, rien ne s’arrête` | vert |
| 25 | réglages › agents : « Relire le PATH » n'est plus qu'au Diagnostic | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « « Relire le PATH » n’est plus dans Agents (il est au Diagnostic) » | vert |
| 26 | page de l'agent : version, ce qu'il annonce, ce qui lui est propre | doublon | retirée | `SettingsDialog.test.tsx › une ligne par agent installé ; sa page dit ce qu’il annonce et ce qui lui est propre` (la version annoncée par le vrai agent factice n'y est pas) | vert |
| 27 | page de l'agent : « ‹ Agents » ramène à la liste | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « page d’un agent : « ‹ Agents » ramène à la liste » | vert |
| 28 | réglages : liste des raccourcis | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « liste des raccourcis : ⌘N, ⌃`, ⇧⌘U dans la notation du Mac » | vert |
| 29 | réglages › nouveautés : icône et version, versions repliées sauf la plus récente | doublon | retirée | `SettingsDialog.test.tsx › nouveautés du CHANGELOG, une ligne par version, la plus récente seule ouverte` | vert |
| 30 | recherche dans les réglages : ⌘F, « veille », Entrée → réglage mis en avant | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « ⌘F met le focus dans la recherche ; « veille » puis Entrée : le réglage ouvert et mis en avant » | vert |
| 31 | recherche : une fonction propre à l'agent trouvée, sa page ouverte | doublon | retirée | `SettingsDialog.test.tsx › « Propre à IBM Bob » ou « Clé » : la recherche ouvre la page de l’agent (fiche 136)` | vert |
| 32 | recherche : un réglage d'« Avancé » déplié et mis en avant | doublon | retirée | `SettingsDialog.test.tsx › un réglage dans « Avancé » : la recherche le déplie (fiche 136)` | vert |
| 33 | recherche : « empattements » trouve encore la police (fr seul) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/settings-search.test.ts` › « « empattements », l’ancien mot (fiche 128), trouve encore la police des réponses » | vert |
| 34 | Échap vide d'abord la recherche, les réglages restent ouverts | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « Échap vide d’abord la recherche (« aucun résultat » avant) ; les réglages restent ouverts » | vert |
| 35 | taille du texte du terminal appliquée | composant | reste | aucun remplaçant écrit | — |
| 36 | ⇧⌘D modifications, ⌘J panneau de droite | composant | reste | partiel : `menu.test.ts › chaque raccourci est dans le menu, une seule fois, et envoie sa commande` | — |
| 37 | réglages enregistrés | unitaire-main | retirée | **oui, remplaçant créé** (2026-11-24) : `M/settings.test.ts` › « réglages changés dans l’interface : écrits dans settings.json, relus au lancement suivant » | vert |
| 38 | barre de menu d'Electron jamais montrée (Linux seul) | parcours | reste | parcours : vraie app nécessaire | — |
| 39 | bouton ☰ : menu de Bobine, raccourcis en Ctrl (Linux) | composant | reste | remplaçant partiel : reste hors Vitest : fenêtre sans barre de menu, accélérateurs natifs : e2e Linux | — |
| 40 | Échap : menu refermé, focus rendu au bouton ☰ (Linux) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/common/AppMenu.test.tsx` › « Échap : menu refermé, focus rendu au bouton ☰ » | vert |
| 41 | Alt seul : le menu ☰ s'ouvre, pas la barre d'Electron (Linux) | parcours | reste | parcours : vraie app nécessaire | — |
| 42 | Affichage › Barre latérale depuis ☰ : repliée, ☰ dans l'en-tête (Linux) | parcours | reste | parcours : vraie app nécessaire | — |
| 43 | Aurore nuit : menu ☰ opaque, sans flou ni fondu (Linux, sombre) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |

### `mcp` — réduire

37 vérifications : 13 retirées (dont 0 à confirmer), 0 creuse(s), 24 restent. Durée (clair + sombre) : 25 s → ≈ 18 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Onglet « Bobine » en premier, choisi par défaut | doublon | retirée | `src/renderer/src/components/settings/McpSettings.test.tsx › premier onglet, choisi par défaut, avec le nombre d’outils ; les agents ensuite` | vert |
| 2 | Toutes les familles d'outils (iOS selon la plateforme) | unitaire-main | reste | partiel : `src/main/mcp/catalog.test.ts › toutes les familles, dans l’ordre où l’agent les reçoit, questions en tête` (pas le filtrage par plateforme, `FEATURES.simulator`) | — |
| 3 | Nombre de l'onglet = somme des cartes (> 40) | composant | reste | partiel : `McpSettings.test.tsx › premier onglet, choisi par défaut…` (compte de l'onglet, une famille de fixture) | — |
| 4 | Conditions et accords (pastille orange sauf questions) | composant | reste | partiel : `McpSettings.test.tsx › une carte par famille : titre, nombre, phrase, condition, accord ; repliée` ; `src/main/mcp/catalog.test.ts › textes : une clé française et anglaise pour chaque titre, phrase, condition et accord` | — |
| 5 | Pastille d'accord d'une autre couleur que la condition | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 6 | Cartes repliées par défaut | doublon | retirée | `McpSettings.test.tsx › une carte par famille : … ; repliée` | vert |
| 7 | Carte dépliée : noms en chasse fixe, description au survol | composant | reste | partiel : `McpSettings.test.tsx › dépliée : les noms des outils, avec la description de l’agent au survol` (pas la police) | — |
| 8 | Serveur déjà déclaré dans le fichier de Bob : listé | unitaire-main | reste | partiel : `src/main/agent-config/mcp-files.test.ts › ajout, désactivation, renommage, suppression ; champs inconnus gardés` (liste à l'écran non testée) | — |
| 9 | Désactivé : `disabled: true` chez Bob | unitaire-main | retirée | `mcp-files.test.ts › ajout, désactivation, renommage, suppression ; champs inconnus gardés` | vert |
| 10 | Nom invalide refusé avec un message | composant | reste | partiel : `src/shared/mcp.test.ts › vérifié et nettoyé selon le transport` (règle ; message à l'écran non) | — |
| 11 | Réglages longs : en-tête fixe, seul le contenu défile | parcours | reste | parcours : vraie app nécessaire | — |
| 12 | Ajouté dans `~/.bob/settings/mcp.json` au format de Bob | unitaire-main | retirée | `src/shared/mcp.test.ts › ligne de commande : mots, guillemets, aller-retour` ; `mcp-files.test.ts › ajout, désactivation, renommage, suppression…` | vert |
| 13 | Copié vers OpenCode, à son format, commentaires gardés | unitaire-main | retirée | `mcp-files.test.ts › opencode.jsonc existant : commentaires et autres réglages gardés` | vert |
| 14 | Portée changée : déplacé dans `opencode.json` du dossier | unitaire-main | reste | partiel : `mcp-files.test.ts › sans fichier : opencode.json créé ; projet cherché jusqu’à la racine git` (pas le déplacement) | — |
| 15 | Premier clic : confirmation dans la ligne, rien supprimé | composant | reste | aucun remplaçant écrit | — |
| 16 | Supprimé du fichier de Bob (confirmé) | unitaire-main | retirée | `mcp-files.test.ts › ajout, désactivation, renommage, suppression…` | vert |
| 17 | Dernier serveur du projet retiré : `opencode.json` supprimé | doublon | retirée | `mcp-files.test.ts › dernier serveur retiré : conteneur vide retiré, fichier supprimé s’il n’a rien d’autre (fiche 126)` | vert |
| 18 | « Tester » : joignable, serveur, outils, prompts | composant | reste | partiel : `src/main/agent-config/mcp-probe.test.ts › commande locale : serveur, outils sur deux pages, prompts ; répond à ses requêtes` (la sonde, pas l'affichage) | — |
| 19 | « Tester » : noms des outils au survol | composant | reste | aucun remplaçant écrit | — |
| 20 | « Tout tester » : cause utile sur la ligne (module introuvable) | composant | reste | partiel : `mcp-probe.test.ts › erreurs lisibles : serveur qui s’arrête (avec sa sortie), muet, introuvable, adresse fausse` (sortie jointe, pas la ligne affichée) | — |
| 21 | « Tout tester » : serveur qui plante → code et sortie | doublon | retirée | `mcp-probe.test.ts › erreurs lisibles : …` (`code 3`, `SERVICE_TOKEN manquante` à l'identique ; l'infobulle seule ne l'est pas) | vert |
| 22 | Pastilles : joignable, en erreur, désactivé | composant | reste | aucun remplaçant écrit | — |
| 23 | Menu ⚙ : serveurs MCP de l'agent et leur état réel | parcours | reste | parcours : vraie app nécessaire | — |
| 24 | Menu ⚙ : « bobine · intégré », N outils reçus | doublon | retirée | `SessionSettingsMenu.test.tsx › Serveurs MCP : « bobine · intégré »…` ; `catalog.test.ts › le même décompte que les outils donnés à la session par le pont` | vert |
| 25 | Outils reçus au survol : ni iOS ni filles hors projet/git | doublon | retirée | `catalog.test.ts › dossier quelconque : ni iOS, ni Android, ni filles` | vert |
| 26 | Menu ⚙ : poids estimé des outils | doublon | retirée | `SessionSettingsMenu.test.tsx › Serveurs MCP : …` (≈ 610 jetons) ; `catalog.test.ts › menu ⚙ : outils et poids de la session, et ce que recevra la prochaine` | vert |
| 27 | Menu ⚙ › « Voir les outils » : onglet « Bobine » | composant | reste | partiel : `SessionSettingsMenu.test.tsx › Serveurs MCP : …` (`onOpenMcpSettings('bobine')`) ; le passage App → Réglages non | — |
| 28 | Menu ⚙ › un serveur : onglet de l'agent | composant | reste | partiel : `McpSettings.test.tsx › ouvert sur l’onglet d’un agent (menu ⚙) : ses serveurs, sans les cartes de Bobine` | — |
| 29 | Réglages refermés : l'app répond encore (`pointer-events`) | composant | reste | partiel : `src/renderer/src/components/common/menus-modal.test.ts › are all non-modal: a modal Radix menu that opens a dialog leaves the page unclickable` (garde statique de la cause, pas le comportement Radix réel) | — |
| 30 | Avant : tools/list déclare le navigateur | parcours | reste | parcours : vraie app nécessaire | — |
| 31 | Poids estimé de chaque famille (navigateur ≈ 1000–3000) | unitaire-main | reste | partiel : `catalog.test.ts › poids estimé : environ 4 caractères par jeton des définitions envoyées par `tools/list`` | — |
| 32 | Questions : « Toujours fournie », pas d'interrupteur | doublon | retirée | `McpSettings.test.tsx › poids estimé de chaque famille et total ; interrupteur, avis (fiche 109)` | vert |
| 33 | Interrupteur : atteint par Tab, zone ≥ 30×18 px | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 34 | Navigateur coupé : avis « prochaines sessions », total recalculé | doublon | retirée | `McpSettings.test.tsx › poids estimé de chaque famille et total ; interrupteur, avis (fiche 109)` ; IPC : `src/main/agent-config/mcp-ipc.test.ts › familles d’outils de Bobine : coupées dans les réglages, arguments vérifiés (fiche 109)` | vert |
| 35 | Menu ⚙ : N maintenant, N − navigateur au prochain démarrage | composant | reste | partiel : `catalog.test.ts › menu ⚙ : outils et poids de la session, et ce que recevra la prochaine` (côté main) | — |
| 36 | Après redémarrage de l'agent : plus d'outil navigateur dans tools/list | parcours | reste | parcours : vraie app nécessaire | — |
| 37 | Menu ⚙ après redémarrage : outils suivent les réglages | parcours | reste | parcours : vraie app nécessaire | — |

### `regles-approbation` — réduire

31 vérifications : 29 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 20 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | IPC : lecture, liste par défaut signalée | unitaire-main | retirée | `src/main/agent-config/bob-approval-rules.test.ts › règles d’approbation : profils et IPC (fiche 215) › seuls les profils qui déclarent le format ; arguments du renderer vérifiés` ; `› fichier absent : défauts de Bob (Lecture seule, liste par défaut signalée)` | vert |
| 2 | IPC : changement mal formé refusé | doublon | retirée | `bob-approval-rules.test.ts › seuls les profils qui déclarent le format ; arguments du renderer vérifiés` ; `src/shared/approval-rules.test.ts › seules les formes attendues passent, sans champ en trop` | vert |
| 3 | IPC : profil sans règles → `unsupported` | doublon | retirée | `bob-approval-rules.test.ts › seuls les profils qui déclarent le format ; …` (`unsupported`) | vert |
| 4 | Commande couverte par la liste par défaut : « déjà autorisée partout · Gérer » | doublon | retirée | `src/renderer/src/components/thread/GlobalRuleSection.test.tsx › commande entièrement couverte : pas de section, « déjà autorisée partout · Gérer »` | vert |
| 5 | « Pour tous les projets » replié en pied de carte | doublon | retirée | `GlobalRuleSection.test.tsx › replié par défaut ; commande entière proposée ; encadré « première fois »` | vert |
| 6 | Dépliée : commande entière, encadré « première fois » | doublon | retirée | comme n° 5 : `GlobalRuleSection.test.tsx › replié par défaut ; commande entière proposée ; encadré « première fois »` | vert |
| 7 | Une seule note de portée ; « à la prochaine conversation » | doublon | retirée | `src/renderer/src/components/thread/PermissionCardExtras.test.tsx › portée déclarée : « Toujours dans cette conversation » et UNE seule note, l’agent en gras (recette QA)` ; `GlobalRuleSection.test.tsx › quand la règle vaut : prochaine conversation sans « Commandes de la liste », sinon tout de suite` | vert |
| 8 | Préfixe d'un seul mot : avertissement avec exemple | doublon | retirée | `GlobalRuleSection.test.tsx › préfixe d’un seul mot : avertissement, sans blocage` | vert |
| 9 | « Autoriser partout » : liste par défaut recopiée, `execute` ajouté, reste gardé | unitaire-main | retirée | `bob-approval-rules.test.ts › première fois : ajoute aussi le groupe `execute` (read recopié) et le dit` ; `› sans `allowedExecutors` : la liste par défaut est recopiée (piège vu le 2026-11-09)` ; `› clés inconnues, ordre et le reste du fichier gardés ; copie de sauvegarde` | vert |
| 10 | « Autoriser partout » : la carte reçoit aussi « toujours » | doublon | retirée | `GlobalRuleSection.test.tsx › « Autoriser partout » : écrit la règle, puis répond « toujours » (par genre) à la carte` | vert |
| 11 | Ligne de réponse : « Toujours dans cette conversation », « Gérer » souligné | composant | reste | partiel : `PermissionCardExtras.test.tsx › ligne de réponse : même libellé que le bouton choisi (recette QA)` | — |
| 12 | Commit avec parenthèses entre guillemets : deux parties | doublon | retirée | `src/shared/approval-rules.test.ts › guillemets respectés : %s` (cas `feat(calc)` à l'identique) | vert |
| 13 | « Commandes de la liste » déjà permis : vaut tout de suite | doublon | retirée | `GlobalRuleSection.test.tsx › quand la règle vaut : …` | vert |
| 14 | Commande enchaînée : 5 parties, `wc -l` déjà autorisée | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/thread/GlobalRuleSection.test.tsx` › « vraie commande longue de Bob : 5 parties à cocher, `wc -l` déjà autorisée ; « Refuser partout » la seule cochée » | vert |
| 15 | `execute` déjà permis : plus d'encadré « première fois » | doublon | retirée | `GlobalRuleSection.test.tsx › groupe `execute` déjà permis : pas d’encadré « première fois »` | vert |
| 16 | « Refuser partout » : partie choisie seule, écrite, carte refusée | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/thread/GlobalRuleSection.test.tsx` › « vraie commande longue de Bob : 5 parties à cocher, `wc -l` déjà autorisée ; « Refuser partout » la seule cochée » | vert |
| 17 | `node --version` refusée partout (par l'IPC) | doublon | retirée | `bob-approval-rules.test.ts › ajouter à une liste retire de l’autre ; retirer ; doublon ignoré` | vert |
| 18 | Terminal de Bobine : refusée partout, ni question ni lancement, dit dans le fil | parcours | reste | parcours : vraie app nécessaire | — |
| 19 | « Gérer » → Réglages › Agents › agent › Approbations | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « « Gérer » d’une carte de commande : la page des approbations de l’agent » | vert |
| 20 | Page : Commandes de la liste activé, Liste de tâches non | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApprovalRulesPage.test.tsx` › « groupes lus : « Commandes de la liste » activé, « Liste de tâches » non » | vert |
| 21 | Interrupteur Liste de tâches : écrit dans le fichier | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApprovalRulesPage.test.tsx` › « interrupteur « Liste de tâches » : le changement part au main, la page suit » | vert |
| 22 | Listes : ajout, modification, retrait écrits | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApprovalRulesPage.test.tsx` › « listes : modifier retire puis ajoute ; retirer se confirme dans la ligne » ; `R/components/settings/ApprovalRulesPage.test.tsx` › « modifier en une saisie vide : refusé avant d’écrire, l’ancienne reste » | vert |
| 23 | « git » aux autorisées : avertissement et confirmation avant d'écrire | doublon | retirée | `src/renderer/src/components/settings/ApprovalRulesPage.test.tsx › autorisées : avertissement et confirmation explicite avant d’écrire` | vert |
| 24 | « Garder » : rien écrit | doublon | retirée | `ApprovalRulesPage.test.tsx › autorisées : « Garder » n’écrit rien ; commande entière : pas de confirmation` | vert |
| 25 | Hors du dossier : effet de bord dit avant le clic | doublon | retirée | `ApprovalRulesPage.test.tsx › global éteint : l’effet de bord est dit sous l’option, et l’allumer écrit les deux` | vert |
| 26 | Hors du dossier : option du groupe et global écrits | doublon | retirée | idem ; `bob-approval-rules.test.ts › hors du dossier : interrupteur global et option par groupe` | vert |
| 27 | Option éteinte : le global reste allumé, et c'est dit | doublon | retirée | `ApprovalRulesPage.test.tsx › options éteintes, global resté allumé : dit, avec « Ne plus l’autoriser »` | vert |
| 28 | « Ne plus l'autoriser » : global éteint | doublon | retirée | comme n° 27 : `ApprovalRulesPage.test.tsx › options éteintes, global resté allumé : dit, avec « Ne plus l’autoriser »` | vert |
| 29 | Groupe interdit : interrupteur désactivé, raison dite | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApprovalRulesPage.test.tsx` › « groupe interdit par l’organisation : interrupteur désactivé, raison dite » | vert |
| 30 | Fichier illisible : bandeau avec la ligne, ni groupes ni listes | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApprovalRulesPage.test.tsx` › « fichier illisible : bandeau avec la ligne, ni groupes ni listes ; corrigé, « Relire » » | vert |
| 31 | Fichier corrigé : « Relire » montre les règles | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApprovalRulesPage.test.tsx` › « fichier illisible : bandeau avec la ligne, ni groupes ni listes ; corrigé, « Relire » » | vert |

### `pr-ci-sans-ci` — réduire

4 vérifications : 3 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 14 s → ≈ 7 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Ni workflow ni contrôle requis : « Aucune CI détectée », « Fusionner maintenant » proposé | composant | retirée | oui : `src/renderer/src/components/panel/PrCard.test.tsx › carte « Pull request » sans CI (fiche 176, 0.9.1, D20) › ni workflow ni contrôle requis : « Aucune CI détectée », « Fusionner maintenant » proposé` (les appels `gh` qui détectent l’absence de CI : `pr-watch.test.ts`) | vert |
| 2 | Fusion d'office cochée : jamais sans contrôle, la carte le dit | composant | retirée | oui : `src/renderer/src/components/panel/PrCard.test.tsx › carte « Pull request » sans CI (fiche 176, 0.9.1, D20) › fusion d’office cochée : jamais sans contrôle, la carte le dit sans alarme` | vert |
| 3 | Branche à reprendre : bouton désactivé, raison en infobulle | composant | retirée | oui : `src/renderer/src/components/panel/PrCard.test.tsx › carte « Pull request » sans CI (fiche 176, 0.9.1, D20) › branche à reprendre : « Fusionner maintenant » désactivé, la raison en infobulle` | vert |
| 4 | « Fusionner maintenant » : PR fusionnée (commit de fusion), « Nettoyer » proposé | parcours | reste | parcours : vraie app nécessaire | — |

### `restart` — réduire

5 vérifications : 4 retirées (dont 1 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 12 s → ≈ 4 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Après redémarrage : la conversation est dans « Récents » | doublon | retirée | `e2e/suites/parcours-matinee.mjs › relance : la conversation affichée, son fil (relecture comprise), son modèle et son mode` (les deux conversations dans la barre) | vert |
| 2 | Après redémarrage : la consommation de la conversation est conservée | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | Conversation rechargée (session/load) puis continuée | doublon | retirée | `parcours-matinee.mjs › agent relancé : il répond dans le même fil, avec les réglages de la conversation` | vert |
| 4 | Suppression confirmée dans l'app : historique vide, accueil, aucune boîte native | parcours | retirée | **parcours-deleguer › étape 6** (`ui.dialogs.length === 0` ; journée rouge plus loin (fiche 277, défauts 1-2)) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 5 | Après redémarrage : « Épinglées » et dossier repliés, mode Dossiers gardé | composant | retirée | `src/renderer/src/components/sidebar/Sidebar.test.tsx › chaque section se replie, et le reste au redémarrage` ; `› un dossier se replie (seul son nom reste), et le reste au redémarrage` (regroupement lu de `localStorage`) | vert |

### `cout-connexion` — réduire

6 vérifications : 5 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 18 s → ≈ 7 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Coût nul d'un modèle payant : « coût inconnu » | doublon | retirée | `src/renderer/src/components/composer/UsageMeter.test.tsx › coût nul d’un modèle payant : « coût inconnu », dit pourquoi (fiche 266, D12)` ; `src/shared/usage-cost.test.ts › abonnement (OpenCode connecté par abonnement, D12) : coût nul d’un modèle payant → coût inconnu` | vert |
| 2 | Le détail dit pourquoi le coût est inconnu | doublon | retirée | `UsageMeter.test.tsx › coût nul d’un modèle payant : …` (`usage-cost-hint`) | vert |
| 3 | Ni moyenne ni ligne d'échange à « ≈ 0,00 $US » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/UsageMeter.test.tsx` › coût nul d’un modèle payant : ni moyenne ni ligne d’échange à « ≈ 0,00 $US » (cout-connexion n° 3) | vert |
| 4 | Mon activité : la tuile compte 2 échanges sans coût, comme le tableau | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/activity/ActivityPage.test.tsx` › échanges sans coût communiqué : la tuile du coût les compte, d’après les mêmes chiffres (`turnsWithoutCost` : `src/main/usage/stats.test.ts`) | vert |
| 5 | Mon activité à 720 px : pas de barre permanente, rien ne déborde | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | Menu des modèles : refusé, même fournisseur « sans doute », gratuit sans marque | doublon | retirée | `src/main/agent/refused-models.test.ts › marqués, sauf le modèle choisi, un modèle gratuit, un modèle qui a répondu, un autre fournisseur` ; `src/renderer/src/components/composer/BlockerPanel.test.tsx › même fournisseur qu’un modèle refusé : « sans doute », jamais d’autres (fiche 266, D31)` | vert |

### `degrade-haut` — garder

28 vérifications : 0 retirées (dont 0 à confirmer), 0 creuse(s), 28 restent. Durée (clair + sombre) : 111 s → ≈ 111 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Accueil : racine et en-têtes immobiles | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | Accueil, 20 Tab : rien ne bouge | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | Sommaire, messages 41 et 56 : sous le fondu (boucle ×2) | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | Fil rouvert par la fin : premier message pas encore rendu | composant | reste | partiel : `useEntryWindow.test.ts › fil vide, puis arrivée du fil : ouvert par la fin` | — |
| 5 | Sommaire, message à rendre : sous le fondu | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | `scrollIntoView`, message 21 : sous le fondu | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | `scrollIntoView`, dernier message : racine immobile | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | Recherche : le résultat sous le fondu | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | Fil : contenu qui dépasse, amené à l'écran, racine immobile | parcours | reste | parcours : vraie app nécessaire | — |
| 10 | Fil, 30 Tab : rien ne bouge | parcours | reste | parcours : vraie app nécessaire | — |
| 11 | Fenêtre étroite, panneau ouvert, message 51 : sous le fondu | parcours | reste | parcours : vraie app nécessaire | — |
| 12 | Panneau de droite, fenêtre étroite, 30 Tab | parcours | reste | parcours : vraie app nécessaire | — |
| 13 | Panneau de droite, 30 Tab | parcours | reste | parcours : vraie app nécessaire | — |
| 14 | Côte à côte, message 31 : sous le fondu | parcours | reste | parcours : vraie app nécessaire | — |
| 15 | Côte à côte : racine immobile après `scrollIntoView` à côté | parcours | reste | parcours : vraie app nécessaire | — |
| 16 | Côte à côte, 20 Tab | parcours | reste | parcours : vraie app nécessaire | — |
| 17 | Mon activité ouverte : racine immobile | parcours | reste | parcours : vraie app nécessaire | — |
| 18 | Mon activité, mois/année/semaine : racine immobile (boucle ×3) | parcours | reste | parcours : vraie app nécessaire | — |
| 19 | Mon activité, grille défilée : racine immobile | parcours | reste | parcours : vraie app nécessaire | — |
| 20 | Mon activité, 40 Tab | parcours | reste | parcours : vraie app nécessaire | — |
| 21 | Mon activité : contenu qui dépasse, racine immobile | parcours | reste | parcours : vraie app nécessaire | — |
| 22 | Mon activité, fenêtre étroite, 40 Tab | parcours | reste | parcours : vraie app nécessaire | — |
| 23 | Tâches planifiées : racine immobile | parcours | reste | parcours : vraie app nécessaire | — |
| 24 | Tâches planifiées, 30 Tab | parcours | reste | parcours : vraie app nécessaire | — |
| 25 | Tâches planifiées : contenu qui dépasse, racine immobile | parcours | reste | parcours : vraie app nécessaire | — |
| 26 | Réglages › chaque rubrique (14) × 2 tailles, 30 Tab (boucle) | parcours | reste | parcours : vraie app nécessaire | — |
| 27 | Réglages, fenêtre basse : la liste des rubriques défile dans sa colonne, « Nouveautés » à l'écran | parcours | reste | parcours : vraie app nécessaire | — |
| 28 | Réglages, fenêtre basse : racine immobile | parcours | reste | parcours : vraie app nécessaire | — |

### `browser-annotate` — réduire

26 vérifications : 12 retirées (dont 0 à confirmer), 0 creuse(s), 14 restent. Durée (clair + sombre) : 18 s → ≈ 12 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | la page est affichée (vue native) | doublon | retirée | `parcours-outils.mjs` › étape « le navigateur intégré : annoter la page et l'envoyer » › check « la page est affichée dans le navigateur intégré » | vert |
| 2 | bouton « Annoter » enfoncé | composant | retirée | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « bouton « Annoter » enfoncé et bandeau d’aide ; second clic : le mode finit, le script part » | vert |
| 3 | bandeau « La page défile et zoome… » | composant | retirée | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « bouton « Annoter » enfoncé et bandeau d’aide ; second clic : le mode finit, le script part » (dans `BrowserTab.test.tsx` plutôt qu’un `PageAnnotator.test.tsx` : le geste traverse l’onglet, `usePageAnnotation` et la bulle) | vert |
| 4 | le script de l'app est dans la page | doublon | reste | partiel : `parcours-outils.mjs` étape 3 (attente implicite) ; `src/main/browser/page-layer.test.ts` › « mode Annoter : monde isolé, binding limité à ce monde, script, puis départ » | — |
| 5 | page vivante : la vue native reste affichée | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | curseur en croix sur la page | unitaire-main | reste | remplaçant partiel : (cascade de jsdom ; celle d’une vraie page reste vue en e2e) | — |
| 7 | mode Annoter : la page défile | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | bulle ouverte : la page est figée | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | ⌘↩ : la page redevient vivante | parcours | reste | parcours : vraie app nécessaire | — |
| 10 | le clic n'atteint pas la page | doublon | retirée | `parcours-outils.mjs` étape 3 › check « remarque envoyée avec sa capture ; le clic n'a pas atteint la page » ; `page-layer.test.ts` › « le clic n'atteint pas la page : il devient une remarque, élément décrit » | vert |
| 11 | barre « 1 remarque » | doublon | retirée | `parcours-outils.mjs` étape 3 (`waitFor` sur `diffNotes.count` 1) | vert |
| 12 | épingle dessinée dans la page (pixel ≈ accent) | parcours | reste | parcours : vraie app nécessaire | — |
| 13 | Échap dans la bulle : remarque abandonnée, mode continue | composant | reste | remplaçant partiel : le retour de la vue native reste e2e (#9 | — |
| 14 | barre « 3 remarques » (« Ajouter », page défilée) | composant | retirée | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « « Ajouter » : la barre compte les remarques ; ⌘↩ aussi » (dans `BrowserTab.test.tsx` plutôt qu’un `PageAnnotator.test.tsx` : le geste traverse l’onglet, `usePageAnnotation` et la bulle) | vert |
| 15 | page à 150 % : l'épingle garde sa taille | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 16 | Échap dans la page : le mode finit, le script part | parcours | reste | parcours : vraie app nécessaire | — |
| 17 | hors du mode, la page reçoit ses clics | unitaire-main | retirée | `page-layer.test.ts` › « caché le temps d'une capture, puis rendu ; arrêté, la page reçoit de nouveau ses clics » | vert |
| 18 | remarques gardées (4) | composant | retirée | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « fin du mode (bouton, ou Échap tapé dans la page) : les remarques sont gardées » (dans `BrowserTab.test.tsx` plutôt qu’un `PageAnnotator.test.tsx` : le geste traverse l’onglet, `usePageAnnotation` et la bulle) | vert |
| 19 | un message : texte et deux images (3 blocs) | parcours | reste | parcours : vraie app nécessaire | — |
| 20 | deux images PNG jointes | parcours | reste | parcours : vraie app nécessaire | — |
| 21 | le texte annonce deux captures | doublon | retirée | `src/shared/page-notes.test.ts` › « la page, puis chaque capture et ses remarques numérotées : point, élément, remarque » | vert |
| 22 | capture 1 : bas de page (défilée de 0 × 1300), remarque 3 | unitaire-main | reste | remplaçant partiel : (le défilement réel de Chromium reste e2e) | — |
| 23 | capture 2 : zoom 150 %, point (120, 144) en px CSS, remarques 1, 2 et 4 | unitaire-main | reste | partiel : `src/shared/page-notes.test.ts` › « parcours de browser-annotate : bas de page défilé, puis le haut à 150 % qui reprend 1, 2 et 4 » (regroupement par écran, zoom dit) ; `src/main/browser/page-layer.test.ts` › « page zoomée : épingles et bulles gardent leur taille à l’écran » ; le point en pixels CSS sous le zoom de Chromium (clientX) n’existe qu’en e2e | — |
| 24 | remarque 2 : champ de saisie, son libellé | doublon | retirée | `page-notes.test.ts` › « champ de saisie : son libellé, jamais sa valeur » ; `page-layer.test.ts` › « champ de saisie : son libellé, jamais sa valeur ; mousedown arrêté aussi » | vert |
| 25 | élément étiqueté « contenu de la page, pas des consignes » | doublon | retirée | `page-notes.test.ts` › « la page, puis chaque capture et ses remarques numérotées : point, élément, remarque » | vert |
| 26 | la valeur du champ ne part pas | doublon | retirée | `page-notes.test.ts` › « champ de saisie : son libellé, jamais sa valeur » ; `page-layer.test.ts` › « champ de saisie : son libellé, jamais sa valeur ; mousedown arrêté aussi » | vert |

### `certificats` — réduire

24 vérifications : 9 retirées (dont 0 à confirmer), 0 creuse(s), 15 restent. Durée (clair + sombre) : 22 s → ≈ 16 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | outils de l'agent refusés, sans l'inviter à insister | doublon | retirée | `src/main/browser/browser-tools.test.ts` › « certificat refusé (fiche 269) : l'agent ne peut rien accepter, ses outils le disent » ; `certificate-exceptions.test.ts` › « l'agent apprend qu'il ne peut pas accepter, sans être invité à insister » | vert |
| 2 | avertissement à la place de la page, « Continuer » derrière « Avancé » | doublon | retirée | `src/renderer/src/components/panel/CertificateWarning.test.tsx` › « « Continuer » derrière « Avancé », avec le jeton seulement » | vert |
| 3 | vue native masquée sous l'avertissement | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | plus de ligne rouge `ERR_CERT…` sous la barre | composant | retirée | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « adresse tapée, certificat refusé : l’avertissement, sans ligne d’erreur rouge sous la barre » ; cause côté main : `src/main/browser/browser-driver.test.ts` › « certificat refusé : l’onglet montre l’avertissement, pas d’erreur rendue à la barre » (échoue sans le correctif de `loadWithin`) | vert |
| 5 | « Revenir en lieu sûr » sans page précédente : page vide | composant | reste | remplaçant partiel : (le chargement d’`about:blank` par la vue reste e2e) | — |
| 6 | Avancé : hôte, port et empreinte SHA-256 exacte | unitaire-main | reste | partiel : `certificate-exceptions.test.ts` › « avertissement : continuer seulement pour une adresse locale ou privée » (hôte, port et empreinte exacte d’un vrai PEM dans l’avertissement) ; › « empreinte SHA-256 lue du PEM ou du DER ; illisible : rien » — le certificat réellement présenté par Chromium reste e2e | — |
| 7 | Continuer : la page s'affiche, « Non sécurisé », hôte et port | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | la WebSocket `wss:` passe sous l'exception | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | ailleurs que dans le panneau, toujours refusé | parcours | reste | parcours : vraie app nécessaire | — |
| 10 | après « Continuer », l'agent lit la page | parcours | reste | parcours : vraie app nécessaire | — |
| 11 | sous-ressource sous exception : « Non sécurisé » sur une page http | parcours | reste | parcours : vraie app nécessaire | — |
| 12 | popup vers un site sous exception : refusée, avec un message | parcours | reste | parcours : vraie app nécessaire | — |
| 13 | certificat changé : l'avertissement revient, nouvelle empreinte | unitaire-main | retirée | `certificate-exceptions.test.ts` › « accepté seulement pour l'hôte, le port, l'empreinte et le code exacts » | vert |
| 14 | « Se souvenir » : seul le certificat retenu écrit dans `approvals.json` | doublon | reste | partiel : `src/main/approvals.test.ts` › « certificats (fiche 269) : session en mémoire, retenus relus, révocation dite » | — |
| 15 | WebSocket rouverte sous le certificat retenu | doublon | reste | aucun remplaçant écrit | — |
| 16 | Réglages : « toujours » d'abord, puis l'ancien de la session ; empreinte en infobulle | composant | retirée | `src/renderer/src/components/settings/PrivacySettings.test.tsx` › « dans l’ordre du main (« toujours » d’abord), « (ancien) », empreinte en infobulle ; révoquer après confirmation » ; tri : `approvals.test.ts` › « certificats (fiche 269) : retenus d'abord, « ancien » quand le serveur en présente un autre » ; **oui, remplaçant créé** (2026-11-24) : `R/components/settings/PrivacySettings.test.tsx` › « dans l’ordre du main (« toujours » d’abord), « (ancien) », empreinte en infobulle ; révoquer après confirmation » | vert |
| 17 | révoqué : plus rien dans `approvals.json` | doublon | retirée | `approvals.test.ts` › « certificats (fiche 269) : session en mémoire, retenus relus, révocation dite » ; `src/main/ipc.test.ts` › « certificat révoqué (fiche 269) : exception vérifiée avant d'être oubliée » | vert |
| 18 | révoqué : WebSocket ouverte fermée | parcours | reste | parcours : vraie app nécessaire | — |
| 19 | révoqué : la page rechargée retombe sur l'avertissement | parcours | reste | parcours : vraie app nécessaire | — |
| 20 | « Revenir en lieu sûr » : dernière page d'un autre site | parcours | reste | parcours : vraie app nécessaire | — |
| 21 | puce « Non sécurisé » : « Certificat accepté pour <site> » | composant | retirée | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « « Non sécurisé » : hôte et port visibles, menu « Certificat accepté pour… », « Ne plus accepter » révoque » ; › « « Non sécurisé » sur le port 443 : le site sans port » | vert |
| 22 | puce : « Ne plus accepter » révoque | composant | retirée | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « « Non sécurisé » : hôte et port visibles, menu « Certificat accepté pour… », « Ne plus accepter » révoque » ; `ipc.test.ts` › « certificat révoqué (fiche 269) : exception vérifiée avant d'être oubliée » (l’effet dans Chromium reste vu par #19) | vert |
| 23 | site public : pas de « Continuer », « Ouvrir dans le navigateur », « Détails » | doublon | retirée | `CertificateWarning.test.tsx` › « site public : refus dit d'emblée, « Ouvrir dans le navigateur », « Détails » sans « Continuer » » ; `certificate-exceptions.test.ts` › « avertissement : continuer seulement pour une adresse locale ou privée » | vert |
| 24 | nom en `.test` vers une IP locale : « Continuer » après vérification | parcours | reste | parcours : vraie app nécessaire | — |

### `roles-gestion` — réduire

23 vérifications : 17 retirées (dont 0 à confirmer), 0 creuse(s), 6 restent. Durée (clair + sombre) : 24 s → ≈ 10 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | section Équipe : sept rôles actifs (le relecteur du projet remplace le fourni) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/roles/TeamSection.test.tsx` › « les rôles actifs du projet de la conversation, sous le titre « Équipe » » | vert |
| 2 | chaque tuile a un nom accessible | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/roles/TeamSection.test.tsx` › « chaque tuile a un nom accessible « Confier un travail à … » » | vert |
| 3 | infobulle au survol : nom et description traduite | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/roles/TeamSection.test.tsx` › « infobulle au focus : le nom puis la description (reçue traduite du main) » | vert |
| 4 | étape 1 vide : trois erreurs, on reste | doublon | retirée | `RoleWizard.test.tsx` › « étape 1 : « Suivant » montre les erreurs de l'étape sans avancer » | vert |
| 5 | identifiant tiré du nom, icône suggérée, aperçu | doublon | retirée | `RoleWizard.test.tsx` › « les trois étapes au clavier, modèle présélectionné, enregistrement dans le projet » ; `role-draft.test.ts` › « tire l'identifiant du libellé : accents, espaces, ponctuation, longueur », « suggère icône et couleur d'après le libellé, jusqu'à un choix à la main » | vert |
| 6 | lecture seule reprise du modèle | doublon | retirée | `RoleWizard.test.tsx` › « les trois étapes au clavier, modèle présélectionné, enregistrement dans le projet » | vert |
| 7 | fichier `.bobine/roles/expert-perf.md` écrit | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | fille lancée depuis le jeton : avatar sous sa mère, saisie vidée | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | clic sur une tuile : jeton, focus, « Sera confié à… » | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/roles/TeamSection.test.tsx` › « clic sur une tuile : le rôle part à la saisie abonnée, sans ramener la conversation » ; `R/components/roles/TeamSection.test.tsx` › « aucune saisie à l’écran : la conversation est ramenée, le jeton l’attend » — reste hors Vitest : jeton et « Sera confié à… » : `RoleComposer.test.tsx` | vert |
| 10 | « Enregistrer comme rôle » seulement pour un travail sans rôle | composant | reste | partiel : `save-as-role.test.ts` › « seulement pour une fille sans rôle, finie avec succès, dont la consigne est connue » | — |
| 11 | assistant prérempli : la demande devient la consigne | doublon | retirée | `save-as-role.test.ts` › « préremplissage : consigne de la fille, son agent, son modèle, lecture seule si rien modifié » | vert |
| 12 | assistant prérempli : l'agent de la fille | doublon | retirée | comme n° 11 : `save-as-role.test.ts` › « préremplissage : consigne de la fille, son agent, son modèle, lecture seule si rien modifié » | vert |
| 13 | Réglages : le relecteur du projet dit qu'il remplace le fourni | doublon | retirée | `RolesSettings.test.tsx` › « trois groupes, rôle de projet qui en remplace un autre, rôle désactivé, fichier écarté » | vert |
| 14 | rôle fourni : description dans la langue de l'interface | doublon | retirée | `src/main/roles/builtin.test.ts` › « suivent la langue de l'interface au moment de la lecture » ; `RoleComposer.test.tsx` › « rôle fourni : description reçue du main (déjà dans la langue de l'interface), affichée et cherchée » | vert |
| 15 | fichier écarté : chemin relatif (complet en infobulle) et raison | doublon | retirée | `RolesSettings.test.tsx` › « trois groupes, rôle de projet qui en remplace un autre, rôle désactivé, fichier écarté » | vert |
| 16 | rôle du projet : « Partagé par git » | doublon | retirée | `RolesSettings.test.tsx` › « supprimer un rôle du projet demande confirmation, puis revient à la liste » (vérifie `role-edit-git`) | vert |
| 17 | modifier : description réécrite dans le fichier | unitaire-main | retirée | **oui, remplaçant créé** (2026-11-24) : `M/roles/library.test.ts` › « modifier : la description réécrite dans le fichier, le reste gardé ; supprimer le rôle du projet fait revenir le fourni » | vert |
| 18 | désactiver : pâli, quitte la section Équipe | composant | reste | remplaçant partiel : reste hors Vitest : rafraîchissement réel par l’IPC : journée type | — |
| 19 | supprimer : fichiers effacés, état vide, le fourni revient | unitaire-main | retirée | **oui, remplaçant créé** (2026-11-24) : `M/roles/library.test.ts` › « modifier : la description réécrite dans le fichier, le reste gardé ; supprimer le rôle du projet fait revenir le fourni » | vert |
| 20 | rôle fourni : pas de « Supprimer », bandeau | doublon | retirée | `RolesSettings.test.tsx` › « un rôle fourni s'enregistre en rôle personnel du même nom, sans « Supprimer » » | vert |
| 21 | rôle fourni : description et consigne dans la langue (ADR-0046) | doublon | retirée | `builtin.test.ts` › « chaque langue donne sept rôles valides, mêmes noms, icônes, couleurs et lecture seule », « suivent la langue de l'interface au moment de la lecture » | vert |
| 22 | langue changée : liste et édition relues | parcours | reste | parcours : vraie app nécessaire | — |
| 23 | langue d'origine : rôles relus | doublon | reste | partiel : idem #22 | — |

### `limite-etapes` — réduire

7 vérifications : 6 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 12 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | carte « s'est arrêté avant la fin », plus la ligne grise | doublon | retirée | `src/shared/turn-limit.test.ts` › « fin en max_turn_requests : une carte à la place de l'avis gris » ; `TurnGuards.test.tsx` › « travail arrêté : « Continuer » seul » | vert |
| 2 | un seul bouton principal « Continuer » ; pas de « Terminé ✓ » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Transcript.test.tsx` › tour arrêté par la limite d’étapes : la carte, pas de bilan « Terminé » sous la réponse (limite-etapes n° 2) + `src/renderer/src/components/thread/TurnGuards.test.tsx` › travail arrêté : « Continuer » seul | vert |
| 3 | « Continuer » refusé : carte « refuse de continuer ici », la première dit le choix | doublon | retirée | `agent-host-turn-limit.test.ts` › « travail arrêté, puis refus sans rien faire : deux cartes différentes, réouverture proposée » ; `turn-limit.test.ts` (shared) › « refus sans activité : la carte le dit, avec la réouverture si le main la propose » | vert |
| 4 | deux choix : « Rouvrir… » (principal), « Nouvelle session… » | doublon | retirée | `TurnGuards.test.tsx` › « refus : « Rouvrir la session et continuer » en premier, puis la session neuve » | vert |
| 5 | réouverture : même session, message renvoyé une fois, l'agent reprend | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | refusé encore : seule « Nouvelle session avec le résumé » | doublon | retirée | `TurnGuards.test.tsx` › « refus sans réouverture possible : la session neuve seule, en bouton principal » ; `agent-host-turn-limit.test.ts` › « refusé encore après la réouverture : seule la session neuve reste, qui repart avec le résumé » | vert |
| 7 | session neuve : repère « Nouvelle session » avec la raison, l'agent répond | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Transcript.test.tsx` › session neuve après la limite d’étapes : repère « Nouvelle session » avec la raison (limite-etapes n° 7) (l’agent qui répond : parcours-pannes) | vert |

### `mermaid` — réduire

7 vérifications : 5 retirées (dont 2 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 12 s → ≈ 7 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Mermaid pas chargé tant qu'aucun diagramme | parcours | retirée | **parcours-longue › étape 1** (`modulepreload` relu avant le premier diagramme) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 2 | organigramme et séquence dessinés | parcours | retirée | **parcours-longue › étape 1** (états `drawn drawn error`, sans relire les libellés) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 3 | Mermaid chargé à l'arrivée du diagramme | doublon | reste | aucun remplaçant écrit | — |
| 4 | bloc invalide : le code reste, avec l'erreur | doublon | retirée | `MermaidBlock.test.tsx` › « invalide : le code reste, avec l'erreur de Mermaid en une ligne » | vert |
| 5 | redessiné aux couleurs de la variante | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 6 | « Voir le code » puis le diagramme | doublon | retirée | `MermaidBlock.test.tsx` › « bloc ```mermaid dessiné ; « Voir le code » et retour » | vert |
| 7 | agrandi dans une fenêtre, refermée par Échap | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/MermaidBlock.test.tsx` › agrandi dans une fenêtre au clic, refermé par Échap | vert |

### `dossiers` — réduire

8 vérifications : 6 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 12 s → ≈ 7 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | agent qui prend d'autres dossiers : « Ajouter un dossier… », aucun dossier | doublon | retirée | `SessionFolders.test.tsx` › « avec la capacité : dossiers listés, ajout, retrait, affichage » ; `src/main/agent/additional-directories.test.ts` › « agent qui annonce la capacité : reçus à session/new, puis à la réouverture » | vert |
| 2 | dossier ajouté : listé sous le dossier de travail, par son nom | composant | reste | partiel : `SessionFolders.test.tsx` › « avec la capacité : dossiers listés, ajout, retrait, affichage » ; `src/main/conversations/additional-directories.test.ts` › « ajout : mémorisé, sans doublon ni le dossier de travail ; agent prêt : session rouverte » | — |
| 3 | session rouverte : l'agent a reçu le dossier | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | le message dit l'autre dossier (ligne D13) | doublon | retirée | `agent/additional-directories.test.ts` › « ligne de contexte (D13) : au premier message, puis une fois par changement » | vert |
| 5 | liste inchangée : pas de ligne au message suivant | doublon | retirée | `agent/additional-directories.test.ts` › « directoriesContext : rien sans changement ; ajouts, retraits, autre session » | vert |
| 6 | dossier retiré : plus reçu, le message le dit | doublon | retirée | `agent/additional-directories.test.ts` › « directoriesContext : rien sans changement ; ajouts, retraits, autre session » ; `conversations/additional-directories.test.ts` › « retrait du dernier : le champ disparaît » | vert |
| 7 | agent sans la capacité : dossier gardé, « non transmis », pas d'ajout | doublon | retirée | `SessionFolders.test.tsx` › « agent qui ne les prend pas : dossiers gardés, « non transmis », pas d'ajout » (la relecture après redémarrage n'est pas vue) | vert |
| 8 | agent sans la capacité : rien envoyé | doublon | retirée | `agent/additional-directories.test.ts` › « agent qui ne l'annonce pas : rien envoyé (l'agent factice refuserait la session) » | vert |

### `historique-saisie` — réduire

23 vérifications : 17 retirées (dont 0 à confirmer), 0 creuse(s), 6 restent. Durée (clair + sombre) : 14 s → ≈ 7 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | conversation neuve : pas de rappel | doublon | retirée | oui : `SentHistory.test.tsx › conversation sans historique : ↑ ne fait rien, pas de rappel` | vert |
| 2 | conversation neuve : ↑ ne fait rien | doublon | retirée | comme n° 1 : oui : `SentHistory.test.tsx › conversation sans historique : ↑ ne fait rien, pas de rappel` | vert |
| 3 | saisie vide : rappel « ↑ Messages précédents » | doublon | retirée | oui : `SentHistory.test.tsx › rappel « ↑ Messages précédents » : saisie vide avec le focus, tant qu’il n’a pas servi 3 fois` | vert |
| 4 | ↑ : dernier envoyé (3/3), jeton du rôle et « Sera confié à… » | doublon | retirée | oui : `SentHistory.test.tsx › ↑ : le dernier envoyé (6/6)…` et `› jetons de rôle repris (ligne « Sera confié à… »)…` ; enregistrement côté main : `roles-children.test.ts › `@rôle` en premier message d’une conversation neuve : elle entre dans l’historique…` | vert |
| 5 | position annoncée poliment | doublon | retirée | oui : `SentHistory.test.tsx › ↑ sur 1/6 ne fait rien ; annonce polie de la position` | vert |
| 6 | aucun menu ouvert | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/SentHistory.test.tsx` › un message repris avec « @Libellé » n’ouvre pas le menu des fichiers | vert |
| 7 | ↑ : 2/3, curseur fin de ligne 1, champ remonté, jeton retiré | composant | reste | partiel : `visual-lines.test.ts › fin de la première ligne affichée…` ; `scrollTop` = 0 non vérifiable en jsdom (toujours 0) — **Reste e2e ou capture (lot dialogues)** : e2e : jeton retiré couvert par `src/renderer/src/components/composer/SentHistory.test.tsx` › jetons de rôle repris (ligne « Sera confié à… ») ; rôle supprimé : « @Libellé » en texte ; curseur en fin de 1re ligne affichée et champ remonté demandent la mise en page (jsdom : scrollTop toujours 0) — garder la vérification dans historique-saisie réduite | — |
| 8 | lignes d’abord : ↓ descend d’une ligne, même message | doublon | retirée | oui : `composer-keys.test.ts › lignes d’abord : hors de la première (↑) ou de la dernière ligne (↓), le curseur bouge` | vert |
| 9 | lignes d’abord : ↑ remonte en ligne 1, même message | doublon | retirée | comme n° 8 : oui : `composer-keys.test.ts › lignes d’abord : hors de la première (↑) ou de la dernière ligne (↓), le curseur bouge` | vert |
| 10 | ligne repliée : curseur en fin de 1ʳᵉ ligne affichée | parcours | reste | parcours : vraie app nécessaire | — |
| 11 | ↑ sur 1/3 : rien, pas de boucle | doublon | retirée | oui : `SentHistory.test.tsx › ↑ sur 1/6 ne fait rien…` ; `composer-keys.test.ts › ↑ sur 1/10 ne fait rien ; ↓ sur 10/10 rend la saisie vide` | vert |
| 12 | replis comptés : ↓ dans la même ligne réelle | parcours | reste | parcours : vraie app nécessaire | — |
| 13 | replis comptés : ↑ depuis la 2ᵉ ligne affichée | parcours | reste | parcours : vraie app nécessaire | — |
| 14 | ↓ depuis la dernière ligne : message suivant, curseur en fin | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/SentHistory.test.tsx` › ↓ depuis la dernière ligne : le message suivant, le curseur à sa fin | vert |
| 15 | message modifié : plus de pastille, ↑ ne change plus de message | doublon | retirée | oui : `SentHistory.test.tsx › une modification fait un brouillon…` ; `composer-keys.test.ts › message modifié (plus d’index)…` | vert |
| 16 | (boucle 760 / 640 / 1280 px panneau ouvert) invite et rappel disjoints (≥ 8 px), « ↑ » seul ou entier, invite entière | parcours | reste | parcours : vraie app nécessaire | — |
| 17 | (attente) panneau replié à 760 px, rouvert seul à 1280 px, état mémorisé | doublon | retirée | oui : `usePanel.test.ts › replié à 760 px : fermé dans l’état et dans le stockage ; rouvert seul à 1280 px` | vert |
| 18 | (attente) un seul appui ferme le panneau rouvert par l’app | composant | reste | partiel : `usePanel.test.ts › replié : un seul appui le rouvre, même dans la fenêtre étroite, et il y reste` (sens inverse) | — |
| 19 | commande reprise telle que tapée (4/4), menu « / » fermé | doublon | retirée | oui : `SentHistory.test.tsx › à l’envoi : le texte tapé (la commande, pas sa consigne)…`, `› une commande reprise n’ouvre pas le menu « / »` ; `sent-history.test.ts › doublons consécutifs fusionnés…` | vert |
| 20 | Échap : saisie vidée, la réponse continue | doublon | retirée | oui : `SentHistory.test.tsx › Échap vide la saisie et quitte l’historique avant d’arrêter la réponse` | vert |
| 21 | second Échap : la réponse s’arrête | doublon | retirée | oui : `composer-keys.test.ts › Échap quitte l’historique avant d’arrêter la réponse ; le second arrête` | vert |
| 22 | après trois utilisations, plus de rappel | doublon | retirée | oui : `SentHistory.test.tsx › rappel déjà appris (3 utilisations) : rien` ; `settings-store.test.ts › rappel « ↑ Messages précédents » (fiche 227) : 3 utilisations, puis plus rien…` | vert |
| 23 | fille : son historique commence par sa consigne (1/1) | unitaire-main | retirée | oui : `children.test.ts › lancée depuis la mère : worktree, consigne, compte rendu, nouvelles transmises une fois` (vérifie `sentHistory` de la fille et de la mère) | vert |

### `git` — réduire

19 vérifications : 11 retirées (dont 1 à confirmer), 0 creuse(s), 8 restent. Durée (clair + sombre) : 54 s → ≈ 26 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | branche sous la saisie ; ni bouton terminal ni titre (brouillon) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › dossier et branche sur la ligne sous la saisie… (branche) ; en-tête sans terminal ni titre : voir ConversationTitle | vert |
| 2 | (attente) après le tour de l’agent : point sur la branche | parcours | retirée | **parcours-matinee › étape 5** — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 3 | titre de la conversation aligné à gauche (< 40 px) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 4 | « Renommer » depuis le titre : en place et dans la barre latérale | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/sidebar/ConversationTitle.test.tsx` › « Renommer » édite le titre en place ; Entrée enregistre le nouveau titre (git n° 4) (reprise dans la barre latérale : `src/main/conversations/manager.test.ts`) | vert |
| 5 | « Supprimer » depuis le titre : même confirmation, page de nouveau cliquable | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/sidebar/ConversationTitle.test.tsx` › « Supprimer » demande la confirmation, la page reste cliquable (menu non modal) (git n° 5) | vert |
| 6 | clic sur la branche : « Modifications » vue Git, 2 fichiers | composant | reste | partiel : `ChangesTab.test.tsx › espace Code : la vue Git et son texte, comme avant` | — |
| 7 | vue Git hors worktree : cases et « Committer », ni PR ni fusion | composant | reste | partiel : `CommitBars.test.tsx › fichiers cochés, message proposé modifiable, commit, puis « Défaire »` ; `worktree-outcome.test.ts › pas de dépôt distant : ni bouton ni raison…` | — |
| 8 | message rédigé par l’agent : le seul fichier coché | doublon | retirée | oui : `commit-draft.test.ts (main) › réponse normale : message de l’agent, fichiers cochés…` ; `CommitChooser.test.tsx › un fichier décoché ne part pas, et le message ne le cite pas` ; agent réel : `parcours-matinee` étape 7 | vert |
| 9 | message reçu : curseur à la fin | doublon | retirée | oui : `CommitBars.test.tsx › décocher met le message à jour ; curseur à la fin` | vert |
| 10 | cases changées puis remises : message gardé, sans relance | composant | reste | partiel : `CommitDraft.test.tsx › cases changées après la réponse : le message retouché reste, « Rédiger à nouveau » le remplace` | — |
| 11 | commit dans le dossier de la conversation : le fichier coché seulement | unitaire-main | retirée | oui : `worktree-ipc.test.ts › « Committer » hors worktree : dans le dossier de la conversation (fiche 123)` ; `worktree-cycle.test.ts › fichiers cochés seulement, puis « Défaire » tant que c’est le dernier` | vert |
| 12 | « Défaire » : commit défait, modifications revenues | unitaire-main | retirée | oui : `worktree-cycle.test.ts › fichiers cochés seulement, puis « Défaire » tant que c’est le dernier` | vert |
| 13 | pastille des modifications : vue de la conversation | composant | reste | partiel : `SessionChanges.test.tsx › après travail : ce que la conversation a modifié, qui ouvre la vue Conversation` | — |
| 14 | boutons de la réponse et indicateur séparés (≥ 2 px) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 15 | fondus du fil haut / bas selon le défilement | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 16 | en bas du fil : pas de flèche | doublon | retirée | oui : `useThreadScroll.test.ts › le fil s’ouvre en bas, sans flèche ; le fil et son contenu sont observés` | vert |
| 17 | flèche « Aller en bas » : montrée en remontant, ramène en bas | doublon | retirée | oui : `useThreadScroll.test.ts › remonté : la flèche se montre…` et `› « Aller en bas » : défilement doux, et le suivi reprend` | vert |
| 18 | conversation plus courte que la page : pas de flèche | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/useThreadScroll.test.ts` › fil remonté, puis une conversation plus courte que la page : pas de flèche | vert |
| 19 | libellés du haut de la barre latérale alignés | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |

### `worktree-cycle` — réduire

19 vérifications : 14 retirées (dont 0 à confirmer), 0 creuse(s), 5 restent. Durée (clair + sombre) : 27 s → ≈ 11 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | (attente) menu du dossier › worktree : la conversation passe sur `bobine/…` | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | départ explicite : une carte en tête du fil (branche, commit, sujet, non commité), pas d’avis | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/WorktreeStart.test.tsx` › départ explicite : la carte en tête du fil, avant le premier message, sans avis | vert |
| 3 | le haut du fil n’est pas dans le fondu de l’en-tête (≥ 28 px) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 4 | « Vue Git » ouvre l’onglet Modifications en vue Git | composant | reste | remplaçant partiel : (e2e worktree-cycle gardée) | — |
| 5 | vue Git du worktree : départ rappelé, avertissement, une case par fichier | composant | retirée | oui : `src/renderer/src/components/panel/WorktreeBar.test.tsx › barre du worktree : départ et fusion (fiches 110, 123) › départ rappelé (branche, commit), avertissement sur le dossier d’origine` ; `src/renderer/src/components/panel/ChangesTab.test.tsx › vue Git d’un worktree (fiche 110) › barre du worktree en tête, une case cochée par fichier modifié` | vert |
| 6 | sans dépôt distant : ni « Ouvrir une PR » ni raison | doublon | retirée | oui : `worktree-outcome.test.ts › pas de dépôt distant : ni bouton ni raison, même si gh manque` | vert |
| 7 | « Fusionner » bloqué tant qu’il reste du non commité (infobulle) | composant | retirée | oui : `src/renderer/src/components/panel/WorktreeBar.test.tsx › barre du worktree : départ et fusion (fiches 110, 123) › « Fusionner » bloqué tant qu’il reste du non commité, la raison en infobulle` | vert |
| 8 | message rédigé par l’agent : Conventional Commits, seul fichier coché | doublon | retirée | oui : `commit-draft.test.ts (main) › réponse normale…` ; `CommitChooser.test.tsx › un fichier décoché ne part pas, et le message ne le cite pas` | vert |
| 9 | commit fait dans le worktree : README seul | unitaire-main | retirée | oui : `worktree-cycle.test.ts › état, commit des fichiers cochés seulement, annulation, journal` | vert |
| 10 | commit défait : branche revenue au départ | unitaire-main | retirée | comme n° 9 : oui : `worktree-cycle.test.ts › état, commit des fichiers cochés seulement, annulation, journal` | vert |
| 11 | second commit : les deux fichiers | doublon | retirée | comme n° 10 : comme n° 9 : oui : `worktree-cycle.test.ts › état, commit des fichiers cochés seulement, annulation, journal` | vert |
| 12 | fusion refusée d’avance : notes.txt non commité dans le dossier principal | doublon | retirée | oui : `worktree-cycle.test.ts › base extraite avec des modifications : refusée d’avance, fichiers listés (fiche 123)` ; `CommitBars.test.tsx › « Fusionner » refusé : encadré, puis « Mettre de côté » fusionne et le dit` | vert |
| 13 | conflit : notes.txt déjà revenu dans le dossier principal | unitaire-main | reste | partiel : `worktree-cycle.test.ts › « Mettre de côté » : stash, fusion, remise, entrée retirée (fiche 123)` ; `CommitBars.test.tsx › « Mettre de côté » retenu pour la reprise après un conflit` | — |
| 14 | fusion arrêtée : README.md en conflit, listé | unitaire-main | retirée | oui : `worktree-cycle.test.ts › conflit : listé, abandon, puis résolution et reprise` | vert |
| 15 | l’agent a résolu le conflit, la fusion a repris : README fusionné, stash vide | parcours | reste | parcours : vraie app nécessaire | — |
| 16 | nettoyage : conversation archivée, worktree et branche supprimés | unitaire-main | retirée | oui : `worktree-ipc.test.ts › nettoyage : la conversation quitte le worktree, puis il est supprimé avec sa branche` | vert |
| 17 | Réglages › Données : worktree orphelin listé | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/OrphanWorktrees.test.tsx` › « orphelin listé : sa branche, ce qu’il contient, le chemin en infobulle » | vert |
| 18 | « Nettoyer » : rien supprimé avant confirmation | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/OrphanWorktrees.test.tsx` › « « Nettoyer » : rien n’est supprimé avant la confirmation, qui dit ce qui sera perdu » | vert |
| 19 | « Nettoyer » : orphelin et branche supprimés | doublon | retirée | oui : `worktree-cycle.test.ts › orphelins : worktrees de Bobine sans conversation, nettoyés avec leur branche` | vert |

### `terminal` — réduire

18 vérifications : 15 retirées (dont 3 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 14 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | ⌃` : un terminal s’ouvre à droite et prend le clavier | doublon | retirée | oui : `parcours-outils` étape 1 (même raccourci, commande à la main) | vert |
| 2 | texte à 12 px du bord, sans cadre arrondi | capture | retirée | **parcours-outils › étape 1** (capture qui affirme `277-outils-terminal`) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 3 | Nerd Font livrée chargée, dans la police du terminal | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | icônes entières : une cellule d’avance, débord sur l’espace suivant seulement | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | ⌃` ouvre et referme, même quand le terminal a le clavier | parcours | retirée | **parcours-outils › étape 1** — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 6 | commande montrée avant de partir dans le terminal | doublon | retirée | oui : `parcours-outils` étape 2 ; `terminal-tools.test.ts › commande montrée une fois, lancée dans un onglet neuf, puis lue` | vert |
| 7 | trois choix (Lancer, Toujours cette commande ici, Refuser) | doublon | retirée | oui : `command-approval.test.ts › trois choix ; « Toujours cette commande ici » retenu pour ce dossier seulement` | vert |
| 8 | commande lancée dans un onglet de l’agent (onglet 2), écran lu | doublon | retirée | oui : `parcours-outils` étape 2 ; `terminal-manager.test.ts › onglet dans le dossier, commande lancée, écran lu comme l’utilisateur le voit` | vert |
| 9 | onglet « Terminal » ouvert tout seul, historique affiché | parcours | retirée | **parcours-outils › étape 2** (terminal refermé à l’étape 1, rouvert par la commande de l’agent) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 10 | Réglages › Confidentialité : commande retenue listée sous son dossier | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/PrivacySettings.test.tsx` › « commande retenue listée sous son dossier, en chasse fixe » | vert |
| 11 | commande retenue oubliée depuis les Réglages | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/PrivacySettings.test.tsx` › « commande retenue oubliée : rien avant la confirmation, puis dossier et commande au main » | vert |
| 12 | saisie au clavier dans le terminal | doublon | retirée | oui : `parcours-outils` étape 1 | vert |
| 13 | fond et palette ANSI des jetons | composant | retirée | oui : `src/renderer/src/components/panel/TerminalTab.test.tsx › onglet « Terminal » (fiches 034, 134) › fond et palette ANSI : les jetons du thème affiché` (xterm.js simulé) | vert |
| 14 | couleurs en variante sans rouvrir l’onglet | composant | retirée | oui : `src/renderer/src/components/panel/TerminalTab.test.tsx › onglet « Terminal » (fiches 034, 134) › accent changé : les couleurs suivent, sans rouvrir l’onglet` | vert |
| 15 | extrait sélectionné à la souris joint au message, avec l’onglet d’origine | parcours | reste | parcours : vraie app nécessaire | — |
| 16 | nouvel onglet de terminal | composant | retirée | oui : `src/renderer/src/components/panel/TerminalTab.test.tsx › onglet « Terminal » (fiches 034, 134) › « + » : un nouvel onglet de terminal, affiché aussitôt` | vert |
| 17 | commande refusée : la carte dit « refusé », sans coche verte | doublon | retirée | oui : `tool-outcome.test.ts › outil de l’app refusé : « refusé » même si l’agent le dit fini` | vert |
| 18 | l’agent reçoit le refus (résultat en erreur) | doublon | retirée | oui : `command-approval.test.ts › refus : résultat en erreur, marqué refusé pour la carte (fiche 122)` | vert |

### `base` — réduire

18 vérifications : 15 retirées (dont 0 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 18 s → ≈ 7 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | accueil affiché, saisie au centre | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/Welcome.test.tsx` › accueil affiché : salutation, puis la saisie, puis les suggestions (base n° 1) (la mise au centre reste à la capture) | vert |
| 2 | accueil : la bobine à côté de la salutation | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/Welcome.test.tsx` › la bobine est dans la salutation, animée à l’arrivée (base n° 2) | vert |
| 3 | (attente) accueil : fil enroulé, animation terminée | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 4 | accueil : astuce de l’agent factice, déclarée par son profil | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/Welcome.test.tsx` › astuce d’accueil du profil affichée sous les suggestions (base n° 4) | vert |
| 5 | l’agent répond : « Écrit… » et le temps écoulé | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/WorkingIndicator.test.tsx` › l’agent écrit : « Écrit… », le temps écoulé, la bobine qui tourne (base n° 5) | vert |
| 6 | l’agent travaille : la bobine s’enroule en boucle | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 7 | réponse finie : indicateur retiré | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/TurnFooter.test.tsx` › réponse finie (agent prêt, rien après le tour) : indicateur retiré | vert |
| 8 | autorisation demandée : « Attend votre accord » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/WorkingIndicator.test.tsx` › autorisation demandée : « Attend votre accord », bobine immobile (base n° 8, 9) | vert |
| 9 | autorisation demandée : bobine immobile | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/WorkingIndicator.test.tsx` › autorisation demandée : « Attend votre accord », bobine immobile (base n° 8, 9) | vert |
| 10 | permission autorisée → outil terminé | doublon | retirée | oui : `parcours-matinee` étape 2 | vert |
| 11 | permission refusée → outil « refusé » | doublon | retirée | oui : `parcours-matinee` étape 3 ; `tool-outcome.test.ts › autorisation refusée : « refusé »…` | vert |
| 12 | Stop pendant l’attente → demande annulée | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/ToolCall.test.tsx` › Stop pendant l’attente : la demande dite « annulée », plus de boutons (base n° 12) + `src/shared/transcript.test.ts` › permission retirée par l’agent… ; Stop : annulée | vert |
| 13 | mode et modèle choisis dans les puces, appliqués par l’agent (`echo`) | doublon | retirée | oui : `parcours-matinee` étape 11 | vert |
| 14 | (attente) menu « Réglages de session » : modèle choisi, la puce suit | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › modèle choisi dans « Réglages de la session » : demandé à l’agent, la puce suit (base n° 14) | vert |
| 15 | consultation du menu des agents : l’agent factice reste sélectionné | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/AgentMenu.test.tsx` › menu consulté puis fermé : l’agent de la conversation reste choisi, rien n’est reconfiguré | vert |
| 16 | nouvelle conversation : sans confirmation, l’ancienne dans « Récents » | unitaire-main | reste | remplaçant partiel : )` natif dans la page reste e2e | — |
| 17 | retour sur l’ancienne : fil intact, brouillon vide écarté | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/ipc-agent.test.ts › IPC branché sur le vrai gestionnaire, contre l’agent factice › « Nouvelle conversation » : l’ancienne reste dans l’historique avec son fil ; le brouillon vide quitté disparaît` | vert |
| 18 | renommage depuis la barre latérale | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/sidebar/Sidebar.test.tsx` › « Renommer » depuis la barre latérale : en place, Entrée enregistre (base n° 18) | vert |

### `language` — réduire

8 vérifications : 3 retirées (dont 0 à confirmer), 0 creuse(s), 5 restent. Durée (clair + sombre) : 6 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | réglage « Français » : interface et menu en français | unitaire-main | reste | partiel : `i18n.test.ts › lit le réglage dans settings.json avant toute fenêtre, « system » sinon` ; `menu.test.ts › entrées des rôles d’Electron toutes traduites, menu Fenêtre compris (fiche 093)` | — |
| 2 | English : les Réglages restent ouverts et passent à l’anglais | composant | retirée | oui : `SettingsDialog.test.tsx › suit la langue sans fermer les réglages, et se retrouve en cherchant dans l’une ou l’autre` | vert |
| 3 | English : menu macOS reconstruit en anglais | unitaire-main | reste | remplaçant partiel : reste hors Vitest : menu natif réellement traduit : e2e | — |
| 4 | English : chaque fenêtre de l’app suit | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | English : accueil en anglais | doublon | retirée | oui : `parcours-reglages` étape 2 (l’invite change, puis revient) | vert |
| 6 | choix gardé dans settings.json | unitaire-main | retirée | **oui, remplaçant créé** (2026-11-24) : `M/settings.test.ts` › « réglages changés dans l’interface : écrits dans settings.json, relus au lancement suivant » | vert |
| 7 | relancée : en anglais dès le départ (page, invite, menu) | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | retour au français : Réglages, menu et fenêtres | doublon | reste | partiel : `parcours-reglages` étape 2 (retour à la langue d’origine, invite seule) | — |

### `parcours-matinee` — garder (journée type)

17 vérifications : 0 retirées (dont 0 à confirmer), 0 creuse(s), 17 restent. Durée (clair + sombre) : 90 s → ≈ 90 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | le dossier du projet est celui de la conversation | parcours | reste | journée type : reste entière | — |
| 2 | réponse reçue, la conversation est dans la barre latérale | parcours | reste | journée type : reste entière | — |
| 3 | autorisée une fois : l’outil se termine | parcours | reste | journée type : reste entière | — |
| 4 | refusée : outil « refusé », l’agent en prend acte | parcours | reste | journée type : reste entière | — |
| 5 | demande suivante accordée d’office, sans carte | parcours | reste | journée type : reste entière | — |
| 6 | Modifications : README.md et src/app.js, le diff de README sur le disque | parcours | reste | journée type : reste entière | — |
| 7 | la relecture rend ses remarques, la conversation reste affichée | parcours | reste | journée type : reste entière | — |
| 8 | commit fait avec le message rédigé, rien dans le fil | parcours | reste | journée type : reste entière | — |
| 9 | la deuxième répond ; la première travaille encore (indicateur) | parcours | reste | journée type : reste entière | — |
| 10 | retour : le tour continue, la suite attend dans la file | parcours | reste | journée type : reste entière | — |
| 11 | tour arrêté : la suite part à la demande, l’agent y répond | parcours | reste | journée type : reste entière | — |
| 12 | modèle et mode appliqués par l’agent | parcours | reste | journée type : reste entière | — |
| 13 | app quittée (⌘Q) | parcours | reste | journée type : reste entière | — |
| 14 | relance : conversation affichée, fil (relecture comprise), modèle, mode | parcours | reste | journée type : reste entière | — |
| 15 | agent relancé : il répond dans le même fil, avec les réglages | parcours | reste | journée type : reste entière | — |
| 16 | deuxième conversation : son historique, et elle répond après la relance | parcours | reste | journée type : reste entière | — |
| 17 | (à chaque étape, boucle de `day()`) journal propre, affichage cohérent | parcours | reste | journée type : reste entière | — |

### `fil` — supprimer entièrement

17 vérifications : 17 retirées (dont 0 à confirmer), 0 creuse(s), 0 restent. Durée (clair + sombre) : 24 s → ≈ 0 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | durée de chaque tour sous sa dernière réponse | doublon | retirée | `src/renderer/src/components/thread/ThreadExtras.test.tsx › durée du tour sous sa dernière réponse, copie du message envoyé` ; `src/shared/turn-duration.test.ts › sur la dernière réponse du tour, de l’envoi à la fin de la réponse` | vert |
| 2 | copier un message envoyé : son texte dans le presse-papiers | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/ThreadExtras.test.tsx` › copier un message envoyé : son texte dans le presse-papiers, puis « Copié » (fil n° 2) | vert |
| 3 | image du message : vue en grand au clic | doublon | retirée | `ThreadExtras.test.tsx › image d’un message : en grand au clic, Échap ferme` | vert |
| 4 | Échap ferme la vue en grand | doublon | retirée | comme n° 3 : `ThreadExtras.test.tsx › image d’un message : en grand au clic, Échap ferme` | vert |
| 5 | glisser : image écrite pour le Finder | doublon | retirée | `ThreadExtras.test.tsx › glisser une image : le main la reçoit, le glisser HTML est annulé` ; `src/main/thread-ipc.test.ts › glisser : type d’image vérifié avant le main` | vert |
| 6 | glisser : le fichier temporaire existe | doublon | retirée | `src/main/thread-ipc.test.ts › écrit l’image décodée, nommée d’après la pièce jointe ; même image, même fichier` | vert |
| 7 | lien de fichier : « Ouvrir dans VS Code » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/ThreadExtras.test.tsx` › lien `fichier:ligne` d’une réponse : « Ouvrir dans VS Code » juste après, à la ligne (fil n° 7) (éditeur par défaut : `src/main/editors/editors.test.ts`) | vert |
| 8 | VS Code : dossier, puis --goto fichier:ligne | doublon | retirée | `src/main/editors/editors.test.ts › VS Code et Cursor : dossier, puis --goto fichier:ligne` ; `› fichier du dossier : lancé à la ligne` | vert |
| 9 | Réglages › Général : les éditeurs installés seulement | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/EditorRow.test.tsx` › « seulement les éditeurs installés ; le choix part dans les préférences » ; `R/components/settings/EditorRow.test.tsx` › « aucun éditeur installé : pas de liste, la ligne le dit » | vert |
| 10 | (attente) après le choix d’IntelliJ, le bouton dit « Ouvrir dans IntelliJ IDEA » | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/EditorRow.test.tsx` › « le choix changé suit jusqu’aux boutons du fil : « Ouvrir dans IntelliJ IDEA » » | vert |
| 11 | IntelliJ IDEA : --line N fichier | doublon | retirée | `src/main/editors/editors.test.ts › JetBrains : --line N fichier, ou open -na App --args` | vert |
| 12 | fichier introuvable dans le dossier : pas d’éditeur lancé (avis) | doublon | retirée | `src/main/editors/editors.test.ts › hors du dossier, par « .. » ou par un lien symbolique : refusé, rien de lancé` ; `ThreadExtras.test.tsx › avis d’une ouverture refusée` | vert |
| 13 | pas de carte sans conversation | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/ThreadExtras.test.tsx` › conversation sans aucun élément : pas de carte de reprise (fil n° 13) | vert |
| 14 | carte de reprise : dernière demande et fichiers non commités | doublon | retirée | `ThreadExtras.test.tsx › inactive depuis plus d’un jour : demande, tâches, fichiers non commités ; fermée, elle ne revient pas` | vert |
| 15 | carte de reprise : les tâches du plan | doublon | retirée | idem ; `src/shared/resume-card.test.ts › dernière demande, tâches faites et en cours (en cours d’abord), fichiers` | vert |
| 16 | carte de reprise repliable | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/ThreadExtras.test.tsx` › carte de reprise repliable : ouverte, puis repliée par son titre (fil n° 16) (`<details>`/`<summary>` ; le clic natif reste au navigateur) | vert |
| 17 | fermée : pas de nouveau pour cette reprise | doublon | retirée | `ThreadExtras.test.tsx › inactive depuis plus d’un jour… ; fermée, elle ne revient pas` | vert |

### `commit-redige` — réduire

15 vérifications : 14 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 106 s → ≈ 12 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | message rédigé par l’agent, d’après les fichiers cochés et la demande de départ | doublon | retirée | `src/main/conversations/commit-draft.test.ts › réponse normale : message de l’agent, fichiers cochés, notes, secret retenu, lignes masquées ; agent arrêté, session supprimée` ; `src/shared/commit-draft.test.ts › consigne, notes, intention, fichiers cochés et diff ; un fichier retenu ne donne que son chemin` ; `parcours-matinee` étape 7 | vert |
| 2 | « Rédigé par Agent factice… », « Committer » disponible | doublon | retirée | `src/renderer/src/components/panel/CommitDraft.test.tsx › message reçu : dans le champ, modifiable ; « Rédigé par… » ; committé tel que retouché` | vert |
| 3 | rien dans le fil : session à part | doublon | retirée | `parcours-matinee` étape 7 (« rien dans le fil ») | vert |
| 4 | l’agent de la rédaction est arrêté après la réponse | doublon | retirée | `commit-draft.test.ts › réponse normale : … agent arrêté, session supprimée` (vrai agent factice, pids relus) | vert |
| 5 | D4 : après « Committer puis fusionner », vue Git et puce de branche à jour sans « Actualiser » | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | rédaction en cours : texte, champ en attente, « Committer » désactivé | doublon | retirée | `CommitDraft.test.tsx › rédaction en cours : « Rédaction par OpenCode… », champ en attente, « Committer » désactivé ; « Arrêter »` | vert |
| 7 | délai dépassé : message en anglais déduit des fichiers, la raison dite | doublon | retirée | `commit-draft.test.ts › réponse lente au-delà du délai : repli `timeout` en anglais, agent arrêté` ; `CommitDraft.test.tsx › délai dépassé : repli en anglais déduit des fichiers, la raison, « Réessayer »` ; `src/shared/commit-draft.test.ts › anglais, Conventional Commits, déduit des fichiers seuls : `chore` sans intention connue` | vert |
| 8 | « Réessayer » : un nouvel agent de rédaction est lancé | doublon | retirée | `CommitDraft.test.tsx › délai dépassé : … « Réessayer »` ; `commit-draft.test.ts › nouvelle demande : la précédente s’arrête, son agent aussi` | vert |
| 9 | « Réessayer » sans réponse : de nouveau le repli | doublon | retirée | `commit-draft.test.ts › réponse lente au-delà du délai…` | vert |
| 10 | délai dépassé deux fois : aucun agent ne survit | doublon | retirée | `commit-draft.test.ts › réponse lente au-delà du délai : … agent arrêté` ; `› nouvelle demande : la précédente s’arrête, son agent aussi` | vert |
| 11 | commit fait avec le message du repli | doublon | retirée | `src/renderer/src/components/panel/CommitBars.test.tsx › fichiers cochés, message proposé modifiable, commit, puis « Défaire »` ; commit réel : `parcours-matinee` étape 7 | vert |
| 12 | rédaction : un agent de rédaction est lancé | doublon | retirée | `commit-draft.test.ts › « Arrêter » pendant la rédaction : repli `stopped`, agent arrêté` | vert |
| 13 | « Arrêter » : rédaction arrêtée, message déduit des fichiers | doublon | retirée | idem ; `CommitDraft.test.tsx › rédaction en cours : … ; « Arrêter »` | vert |
| 14 | « Arrêter » : aucun agent de rédaction ne survit | doublon | retirée | `commit-draft.test.ts › « Arrêter » pendant la rédaction : repli `stopped`, agent arrêté` | vert |
| 15 | commit fait avec le message du repli (après Arrêter) | doublon | retirée | comme n° 11 : `src/renderer/src/components/panel/CommitBars.test.tsx › fichiers cochés, message proposé modifiable, commit, puis « Défaire »` ; commit réel : `parcours-matinee` étape 7 | vert |

### `aide` — réduire

15 vérifications : 4 retirées (dont 0 à confirmer), 0 creuse(s), 11 restent. Durée (clair + sombre) : 11 s → ≈ 9 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | menu Aide : une fenêtre à part, non modale, à droite, une seule | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | titre « Aide de Bobine », curseur dans la recherche | composant | reste | partiel : `HelpWindow.test.tsx › recherche pendant la frappe, au clavier seul : ↓, ↩ ouvre la section, Échap efface` (focus) | — |
| 3 | accueil du guide dans la langue de l’interface | doublon | retirée | `src/renderer/src/help/guide.test.ts › langue du guide : français pour fr-*, anglais sinon` | vert |
| 4 | accueil : pas de lien brut vers l’autre langue ; insécables avant « : ; ? ! » | composant | reste | partiel : `guide.test.ts › pages et ancres de l’aide, l’autre langue, les Nouveautés` (lien converti, pas la typographie) | — |
| 5 | page « Premiers pas » : image du guide chargée | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | résultats pendant la frappe, mot souligné, sans l’accueil | doublon | retirée | `HelpWindow.test.tsx › recherche pendant la frappe…` ; `guide.test.ts › mots trouvés au début d’un mot, soulignés dans l’extrait` ; `› recherche : l’accueil répond par ses notes, jamais par son sommaire` | vert |
| 7 | le premier résultat est affiché, mot surligné à l’écran | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | ↓ change le résultat ET la page, défilée au mot surligné | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | ↩ ouvre la section ; Échap efface, le sommaire revient | doublon | retirée | `HelpWindow.test.tsx › recherche pendant la frappe, au clavier seul : ↓, ↩ ouvre la section, Échap efface` | vert |
| 10 | « astuces » trouve l’accueil, mot surligné à l’écran | composant | reste | partiel : `guide.test.ts › recherche : l’accueil répond par ses notes, jamais par son sommaire` | — |
| 11 | blocs de code avec « Copier » | composant | reste | partiel : `src/renderer/src/components/thread/Markdown.test.tsx › tableaux dans un cadre qui défile, blocs de code avec un bouton « Copier »` (Markdown du fil) | — |
| 12 | lien hors du guide ouvert dans le navigateur du système | unitaire-main | reste | remplaçant partiel : le clic réel dans la page reste e2e | — |
| 13 | « ? » des Réglages : la même fenêtre, à la section « autorisations » | parcours | reste | parcours : vraie app nécessaire | — |
| 14 | seule la section visée ressort | composant | reste | aucun remplaçant écrit | — |
| 15 | « ? » de Réglages › Mémoire : page « Mémoire commune » | doublon | retirée | ligne 13 ; `guide.test.ts › chaque sujet de l’interface vise une page et une ancre du guide, dans chaque langue` | vert |

### `usage` — réduire

15 vérifications : 13 retirées (dont 0 à confirmer), 1 creuse(s), 1 restent. Durée (clair + sombre) : 9 s → ≈ 5 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | rien d’affiché avant le premier échange | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/UsageMeter.test.tsx` › rien d’affiché avant le premier échange (usage n° 1) | vert |
| 2 | jauge de contexte près de la zone de saisie | doublon | retirée | `UsageMeter.test.tsx › total estimé après une compaction (fiche 257) : « ≈ » sur la puce et le détail, expliqué` (puce « 2 % ») ; `usage.test.ts › usage_update : contexte, et coût seulement s’il est fourni` | vert |
| 3 | détail : jetons cumulés sur 2 échanges, coût | doublon | retirée | `UsageMeter.test.tsx › coût cumulé, moyenne par échange et une ligne par échange, le plus récent en haut` | vert |
| 4 | coût cumulé 2 × 0,0125 $US, en estimation (≈) | doublon | retirée | `UsageMeter.test.tsx › tour réel d’OpenCode : jetons traités = entrée + sortie, cache et réflexion à part, coût estimé (fiche 245)` ; `usage.test.ts › comme OpenCode : coût cumulé annoncé pendant le tour, jetons à la fin` | vert |
| 5 | coût en dollars : dit estimé, d’après les tarifs de l’agent | doublon | retirée | `UsageMeter.test.tsx › tour réel d’OpenCode : …` (`usage-cost-hint` contient « Agent factice ») | vert |
| 6 | « Toute la consommation… » mène au tableau | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/UsageMeter.test.tsx` › « Toute la consommation… » referme le détail et mène au tableau (usage n° 6) | vert |
| 7 | (×2, ACP et Bob) rien dans la liste des conversations ni dans l’en-tête | composant | creuse | aucun : vérification creuse (voir plus haut) | — |
| 8 | (ACP) coût cumulé dans le détail de la consommation | doublon | retirée | `UsageMeter.test.tsx › coût cumulé, moyenne par échange…` | vert |
| 9 | (Bob) coût en Bobcoins relu dans la base de Bob, montré dans le détail | doublon | retirée | `src/main/agent/bob-costs.test.ts › vrai dossier : une écriture du coût par l’agent factice est signalée, base créée comprise` ; `src/main/agent/session-cost.test.ts › reads again shortly after the turn ends` ; `UsageMeter.test.tsx › agent qui ne donne que son coût (comme Bob) : la puce montre le coût, lignes sans jetons` | vert |
| 10 | (×2) une ligne par échange, moyenne par échange | doublon | retirée | `UsageMeter.test.tsx › coût cumulé, moyenne par échange et une ligne par échange…` ; `› agent qui ne donne que son coût (comme Bob)…` | vert |
| 11 | contexte presque plein : jauge en alerte | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/UsageMeter.test.tsx` › contexte presque plein : la jauge en alerte ; libéré par une compaction, plus d’alerte (usage n° 11, 12) | vert |
| 12 | compaction : « conversation résumée » dans le fil, contexte libéré | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Transcript.test.tsx` › compaction finie : « Conversation résumée » dans le fil, le résumé replié (usage n° 12) (contexte libéré : `src/main/agent/agent-host-compaction.test.ts`) | vert |
| 13 | rien par ACP : pas de jauge de contexte | doublon | retirée | `UsageMeter.test.tsx › agent qui ne donne que son coût (comme Bob)…` | vert |
| 14 | rouverte (session/load, rejeu tardif comme Bob) : bilan du dernier tour et durées gardés | parcours | reste | parcours : vraie app nécessaire | — |
| 15 | journal de consommation : une ligne par échange, coût de Bob sur la même ligne | doublon | retirée | `src/main/usage/journal.test.ts › comme Bob : coût relu après la fin du tour, sur la même ligne` | vert |

### `command` — réduire

14 vérifications : 10 retirées (dont 0 à confirmer), 0 creuse(s), 4 restent. Durée (clair + sombre) : 15 s → ≈ 8 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | (boucle darwin/linux) « Afficher dans le Finder / le gestionnaire de fichiers » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/common/WorkspaceMenu.test.tsx` › macOS : « Afficher dans le Finder »… ; › Linux : « Afficher dans le gestionnaire de fichiers »… | vert |
| 2 | (boucle) « Copier le chemin » et « Ouvrir un terminal ici » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/common/WorkspaceMenu.test.tsx` › macOS : « Afficher dans le Finder », « Copier le chemin », « Ouvrir un terminal ici » | vert |
| 3 | « Afficher dans le Finder » montre le dossier lui-même | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/common/WorkspaceMenu.test.tsx` › « Afficher dans le Finder » et « Ouvrir un terminal ici » appellent leur action… (le cas `.` reste à `src/main/files/file-links.test.ts`) | vert |
| 4 | « Copier le chemin » copie le chemin du dossier | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/common/WorkspaceMenu.test.tsx` › « Copier le chemin » copie le chemin complet du dossier | vert |
| 5 | « Ouvrir un terminal ici » ouvre le terminal de Bobine | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/common/WorkspaceMenu.test.tsx` › « Afficher dans le Finder » et « Ouvrir un terminal ici » appellent leur action… (terminal réel : parcours-outils) | vert |
| 6 | premier lancement : nouvelle conversation dans le dossier demandé | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | le premier message est posé dans la saisie, pas envoyé | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › demande de lancement : le premier message posé dans la saisie, jamais envoyé (command n° 7) (envoi depuis le main : `src/main/launch-request.test.ts`) | vert |
| 8 | seconde instance : la conversation s’ouvre dans l’autre dossier | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | toujours rien d’envoyé | doublon | retirée | comme n° 7 : **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › demande de lancement : le premier message posé dans la saisie, jamais envoyé (command n° 7) (envoi depuis le main : `src/main/launch-request.test.ts`) | vert |
| 10 | avant : le réglage dit où la commande s’installera | composant | reste | partiel : `src/main/command-line.test.ts › sinon dans ~/.local/bin, et dit si le PATH le contient` | — |
| 11 | installer : le script est écrit et exécutable | doublon | retirée | `command-line.test.ts › installe dans le dossier système quand on peut y écrire` ; `› sinon dans ~/.local/bin, et dit si le PATH le contient` (POSIX seulement) | vert |
| 12 | script reconnu à son marqueur | doublon | retirée | `command-line.test.ts › désinstalle, et ne touche pas à un bobine qui n’est pas le sien` | vert |
| 13 | après : le chemin du script, et l’avertissement PATH | composant | reste | partiel : `command-line.test.ts › sinon dans ~/.local/bin, et dit si le PATH le contient` (côté main) | — |
| 14 | désinstaller : le script est retiré | doublon | retirée | `command-line.test.ts › désinstalle, et ne touche pas à un bobine qui n’est pas le sien` | vert |

### `outils-projet` — réduire

8 vérifications : 6 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 14 s → ≈ 7 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | dossier sans projet : pas d’outil iOS déclaré | doublon | retirée | `src/main/mcp/catalog.test.ts › projet Xcode ou Swift : les outils iOS ; projet Gradle : ceux d’Android` ; `src/main/agent/app-tools-endpoint.test.ts › rien de nouveau dans le dossier : aucun avis, aucune notification` | vert |
| 2 | projet Xcode créé pendant le tour : avis sous la réponse, avec « Redémarrer l’agent » | doublon | retirée | `app-tools-endpoint.test.ts › agent sans flux (Bob : inconnu) : avis redonné sous chaque réponse sans relire le dossier, puis donnés s’il relit` ; `src/shared/app-tools-notice.test.ts › « à redémarrer » : avis avec l’action, un seul à la fois, toujours le dernier du fil` | vert |
| 3 | tour suivant : un seul avis, sous la dernière réponse | doublon | retirée | `app-tools-notice.test.ts › « à redémarrer » : …` ; `app-tools-endpoint.test.ts › agent sans flux…` | vert |
| 4 | après « Redémarrer l’agent » : ligne discrète, plus de bouton | doublon | retirée | `src/renderer/src/components/thread/NoticeRestart.test.tsx › « Redémarrer l’agent » redémarre l’agent de la conversation` ; `› ligne discrète une fois les outils reçus : ni icône ni bouton` ; `app-tools-notice.test.ts › outils reçus ensuite : l’avis laisse la place à une ligne discrète, sans action` | vert |
| 5 | après redémarrage : `ios_build` déclaré (tools/list) | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | agent qui suit la liste : pas d’outil iOS au départ | doublon | retirée | comme n° 1 : `src/main/mcp/catalog.test.ts › projet Xcode ou Swift : les outils iOS ; projet Gradle : ceux d’Android` ; `src/main/agent/app-tools-endpoint.test.ts › rien de nouveau dans le dossier : aucun avis, aucune notification` | vert |
| 7 | agent qui relit la liste : outils ajoutés sans redémarrer, ligne discrète | doublon | retirée | `src/main/mcp/tool-server.test.ts › agent qui suit le flux : notification envoyée, liste relue, nouveaux outils rendus` ; `app-tools-endpoint.test.ts › agent qui relit la liste après la notification : famille ajoutée sans redémarrer` | vert |
| 8 | menu ⚙ : rien « au prochain démarrage » | composant | reste | partiel : `SessionSettingsMenu.test.tsx › Serveurs MCP : « bobine · intégré » et les outils reçus, puis les serveurs de l’agent (fiche 099)` | — |

### `permissions` — réduire

12 vérifications : 11 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 19 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | carte : « Always allow » vaudra aussi pour les prochaines conversations | doublon | retirée | `src/renderer/src/components/thread/PermissionCardExtras.test.tsx › retenu par Bobine (fiche 042) : « Toujours autoriser » et la portée exacte, sans le profil` | vert |
| 2 | nouvelle conversation : accordé d'office, sans demande | doublon | retirée | `src/main/conversations/manager.test.ts › « Toujours autoriser » retenu (fiche 042) : plus demandé dans les conversations suivantes` ; parcours-matinee étape 4 (même conversation seulement) | vert |
| 3 | Réglages : outil listé avec son agent, titre traduit | doublon | retirée | `src/renderer/src/components/settings/RememberedApprovals.test.tsx › « Updating todo list » est dit en %s, le titre de l'agent reste en infobulle` | vert |
| 4 | Réglages fermés par Échap : focus à la saisie | composant | reste | partiel : `src/renderer/src/focus-keeper.test.ts › fenêtre fermée (Échap, ✕) dont le bouton d'ouverture est parti : la zone de saisie` (logique seule, pas la vraie fenêtre des Réglages) | — |
| 5 | révoqué : la demande revient | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/ipc-agent.test.ts › IPC branché sur le vrai gestionnaire, contre l’agent factice › « Toujours autoriser » oublié par Réglages : la demande revient au tour suivant` | vert |
| 6 | demande retirée par l'agent : carte disparue sans « annulée » ni échec, plus de pastille d'attente | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Transcript.test.tsx` › autorisation retirée par l’agent : plus de carte, ni « annulée » ni échec sur l’outil (permissions n° 6) ; pastille d’attente levée : attention du main (`src/main/agent/agent-host.test.ts`) | vert |
| 7 | commande : dossier en pastille, chemin entier en infobulle | doublon | retirée | `PermissionCardExtras.test.tsx › pastille au nom du dossier, chemin entier en infobulle et nom accessible` | vert |
| 8 | commande : « Toujours dans cette conversation » et portée du profil | doublon | retirée | `PermissionCardExtras.test.tsx › portée déclarée : « Toujours dans cette conversation » et UNE seule note, l'agent en gras (recette QA)` ; `src/main/agent/profiles.test.ts` (alwaysScope de Bob) | vert |
| 9 | liste de tâches : question dédiée, quatre tâches, compte | doublon | retirée | `PermissionCardExtras.test.tsx › question dédiée, tâches avec leur état dit aux lecteurs d'écran, et le compte` | vert |
| 10 | outil MCP : arguments tels que reçus, portée retenue par Bobine | doublon | retirée | `PermissionCardExtras.test.tsx › arguments tels que reçus, question générique` + `› retenu par Bobine (fiche 042)…` | vert |
| 11 | carte à risque : pas de « Toujours », une ligne dit pourquoi | doublon | retirée | `PermissionCardExtras.test.tsx › carte à risque : pas de « Toujours », une ligne dit pourquoi` ; `src/main/agent/permission-risk.test.ts` | vert |
| 12 | « Autoriser une fois » : focus à la saisie (4 cartes) | composant | retirée | oui : `focus-keeper.test.ts › bouton d'une carte qui disparaît (« Autoriser une fois ») : la zone de saisie` | vert |

### `nouvelle-version` — réduire

13 vérifications : 11 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 67 s → ≈ 15 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | ligne de la barre latérale : version de la même ligne, pièges ignorés | doublon | retirée | `src/shared/update-check.test.ts › deux lignes publiées en parallèle (ADR-0068) : jamais de saut de ligne ni de retour arrière` + `› brouillons, étiquettes invalides et pages inattendues ignorés` ; `src/renderer/src/components/sidebar/UpdateLine.test.tsx › un numéro piégé reste du texte` | vert |
| 2 | une requête au lancement, User-Agent `Bobine/x`, sans cookie, jeton ni langue | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | « Voir » : nom accessible avec la version | doublon | retirée | `UpdateLine.test.tsx › barre latérale : « Voir » et ✕ passent le numéro, jamais une adresse` (getByRole avec `updates.line.viewLabel`) | vert |
| 4 | « Plus tard » : focus à la zone de saisie | doublon | retirée | `UpdateLine.test.tsx › ✕ et « Voir » : le focus va à la zone de saisie, pas sur la page (recette rc.4)` | vert |
| 5 | Réglages › Nouveautés après « Plus tard » : nouvelle et actuelle version | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/sidebar/UpdateLine.test.tsx` › « « Plus tard » : la barre latérale se tait, Réglages › Nouveautés montre encore la nouvelle et l’actuelle » | vert |
| 6 | encart « est disponible » : texte et bouton centrés (≤ 1,5 px) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 7 | « Voir la version » : la page vérifiée seulement | doublon | retirée | `src/main/update-check.test.ts › « Voir » : ouvre la page vérifiée, et masque l'avis pour cette version` + `› « Voir » d'une version inconnue : refusé, rien d'ouvert` | vert |
| 8 | version connue, « Vérifier maintenant » en échec : dit, la version reste | doublon | retirée | `UpdateLine.test.tsx › Réglages : version déjà connue, « Vérifier maintenant » qui échoue le dit, la version reste (recette rc.4)` | vert |
| 9 | (waitFor) à la main : « à jour » | doublon | retirée | `UpdateLine.test.tsx › Réglages : jamais vérifié, à jour, nouvelle version, échec, en cours` | vert |
| 10 | « Vérifier maintenant » en échec : texte de la limite | doublon | retirée | `src/main/update-check-electron.test.ts › hors ligne, délai dépassé, limite, erreur du serveur : la raison courte` ; `src/main/update-check.test.ts › à la main : l'échec est dit, avec sa raison courte` | vert |
| 11 | relance avant 24 h : aucune requête, aucun avis | doublon | retirée | `src/main/update-check.test.ts › dernière vérification gardée dans le profil : rien avant 24 h après une relance` ; `update-check-electron.test.ts › écrit update-check.json, le relit, et coupe la vérification pour les essais` | vert |
| 12 | vérification automatique en échec : silencieuse | doublon | retirée | `src/main/update-check.test.ts › automatique : rien d'affiché, une ligne au journal, date inchangée, réessai au lancement suivant` | vert |
| 13 | réglage coupé : aucune requête, aucun avis | doublon | retirée | `src/main/update-check.test.ts › réglage coupé, coupure des essais ou lecture seule : aucune requête automatique` | vert |

### `aparte` — réduire

12 vérifications : 11 retirées (dont 2 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 12 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | conversation vide : carte et réponse sur l'accueil, rien dans le fil, saisie vide | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/Welcome.test.tsx` › conversation vide : la carte de l’aparté sur l’accueil, au-dessus de la saisie (aparte n° 1) + `src/renderer/src/app-commands.test.ts` › /btw ouvre un aparté… (« rien dans le fil » : l’aparté a sa session à part, `src/main/conversations/aside.test.ts`) | vert |
| 2 | `/btw` proposée dans le menu « / » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › « / » : `/btw` (aparté) proposée parmi les commandes de l’app (aparte n° 2) | vert |
| 3 | l'aparté reçoit la consigne de lecture seule | doublon | retirée | `src/main/conversations/aside.test.ts › question sans le fil : session à part en mode plan, consigne de lecture seule, coût compté, session supprimée` ; `src/shared/aside.test.ts › consigne de lecture seule, après la question ; fin du fil seulement si demandée` | vert |
| 4 | par défaut, rien du fil principal | doublon | retirée | `src/shared/aside.test.ts › consigne de lecture seule, après la question ; fin du fil seulement si demandée` | vert |
| 5 | carte au-dessus de la zone de saisie, saisie vide | capture | retirée | **parcours-matinee › étape 9** (capture qui affirme `277-matinee-aparte`) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 6 | coût de l'aparté affiché | doublon | retirée | `AsideCard.test.tsx › réponse, refus d'office, coût ; « Ajouter au fil » met la citation dans la saisie` | vert |
| 7 | rien dans le fil, le tour principal attend toujours sa permission | parcours | retirée | **parcours-matinee › étape 9** (pendant un tour `attend-stop` (pas une permission), file comprise) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 8 | case cochée : la fin du fil part avec la question | doublon | retirée | `aside.test.ts › avec le fil : la fin de la conversation part avec la question ; une deuxième question dans la même session` | vert |
| 9 | demande d'autorisation de l'aparté refusée d'office, et dite | doublon | retirée | `aside.test.ts › lecture seule : une demande d'autorisation est refusée d'office` ; `AsideCard.test.tsx › réponse, refus d'office, coût…` | vert |
| 10 | question et réponse en citation dans la saisie, jamais envoyées | doublon | retirée | `AsideCard.test.tsx › réponse, refus d'office, coût ; « Ajouter au fil » met la citation dans la saisie` ; `src/shared/aside.test.ts › « Ajouter au fil » : question et réponse en citation` | vert |
| 11 | raccourci (`app:command aside`) : carte neuve, champ prêt | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : `src/renderer/src/app-commands.test.ts` › /btw ouvre un aparté avec la question tapée, ou vide (fiche 180) + `src/renderer/src/components/thread/AsideCard.test.tsx` › vide : champ prêt… ; menu → `startAside()` : câblage d’App, gardé par parcours-matinee ét. 8 | vert |
| 12 | Échap ferme l'aparté, le clavier revient à la saisie | composant | reste | partiel : `AsideCard.test.tsx › pendant la réponse : « Demander » désactivé, pas de citation ; Échap ferme` | — |

### `startup` — réduire

11 vérifications : 6 retirées (dont 0 à confirmer), 0 creuse(s), 5 restent. Durée (clair + sombre) : 8 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | premier lancement : « Choisissez le dossier de votre projet », un bouton | doublon | retirée | `src/renderer/src/components/composer/BlockerPanel.test.tsx › titre, explication et un seul bouton, qui ouvre le choix du dossier` | vert |
| 2 | saisie inactive : « Choisissez d'abord un dossier » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › pas encore de dossier : saisie inactive, « Choisissez d’abord un dossier » (startup n° 2) | vert |
| 3 | puce du dossier « Choisir un dossier », agent au choix | composant | reste | aucun remplaçant écrit | — |
| 4 | aucun agent démarré avant le choix du dossier | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/ipc-agent.test.ts › IPC branché sur le vrai gestionnaire, contre l’agent factice › conversation sans dossier (fiche 093) : aucun agent lancé, ni au lancement ni par les canaux de lecture` | vert |
| 5 | menu Fenêtre traduit (macOS) | doublon | retirée | `src/main/menu.test.ts › entrées des rôles d'Electron toutes traduites, menu Fenêtre compris (fiche 093)` + `› Fenêtre › Mon activité, ⇧⌘U (fiche 144)` | vert |
| 6 | dossier choisi : l'agent y démarre | doublon | retirée | `src/main/conversations/manager.test.ts › dossier choisi : l'agent y démarre, le dossier entre dans les récents` (le dialogue est simulé dans l'e2e aussi) | vert |
| 7 | dossiers récents : seulement celui choisi | doublon | retirée | même test `manager.test.ts` ; `src/main/conversations/settings-view.test.ts › le dossier de repli interne de l'app n'est jamais un dossier récent` | vert |
| 8 | fenêtre enregistrée en quittant (x, largeur, hauteur) | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | relance : le dossier choisi est repris, l'agent démarre | parcours | reste | parcours : vraie app nécessaire | — |
| 10 | relance : fenêtre à sa place | parcours | reste | parcours : vraie app nécessaire | — |
| 11 | écran disparu : fenêtre ramenée sur l'écran principal, agrandie | parcours | reste | parcours : vraie app nécessaire | — |

### `plan` — réduire

11 vérifications : 7 retirées (dont 0 à confirmer), 0 creuse(s), 4 restent. Durée (clair + sombre) : 11 s → ≈ 7 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | mode plan : `plan.md` affiché comme document (version 1) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/PlanDocument.test.tsx` › mode plan : `plan.md` affiché comme document, version 1, Markdown rendu (plan n° 1) | vert |
| 2 | remarque ajoutée : boutons à la même place, l'ancien « Envoyer » reste « Envoyer » | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 3 | première remarque : la barre ne remonte pas, rien sous le pointeur | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 4 | fenêtre étroite : boutons à la même place avec ou sans remarque | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 5 | passage commenté : remarque listée, passage surligné | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/PlanDocument.test.tsx` › passage commenté : la remarque listée, le passage surligné (plan n° 5) (couleur du surlignage : capture) | vert |
| 6 | plan long : rien de caché dans la carte, fin au-dessus des remarques | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 7 | remarques en cours gardées après rechargement | doublon | retirée | `src/renderer/src/plan-notes.test.ts › gardées par conversation et version, retrouvées après rechargement, effacées si vides` | vert |
| 8 | remarques envoyées : passage cité et remarque | doublon | retirée | `src/shared/plan-doc.test.ts › message de remarques : passages cités, demande de mise à jour en restant en mode plan` | vert |
| 9 | version 2 : « Voir ce qui a changé » montre le diff | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/PlanDocument.test.tsx` › version 2 : « Voir ce qui a changé » montre le diff, puis revient au plan (plan n° 9) | vert |
| 10 | exécuter : retour au mode d'exécution, puis demande d'exécution | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/ipc-agent.test.ts › IPC branché sur le vrai gestionnaire, contre l’agent factice › « Exécuter » le plan (fiche 095) : le mode changé arrive à l’agent avant la demande d’exécution` | vert |
| 11 | plan exécuté : « Exécuter » désactivé, « Plan déjà exécuté » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/PlanDocument.test.tsx` › plan exécuté : « Exécuter » désactivé, « Plan déjà exécuté » (plan n° 11) | vert |

### `parcours-reglages` — garder (journée type)

11 vérifications : 0 retirées (dont 0 à confirmer), 0 creuse(s), 11 restent. Durée (clair + sombre) : 77 s → ≈ 77 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | deux conversations dans la barre latérale (étape 1) | parcours | reste | journée type : reste entière | — |
| 2 | langue changée deux fois : interface traduite, le tour continue, rien de perdu (étape 2) | parcours | reste | journée type : reste entière | — |
| 3 | l'autre conversation a gardé son fil (étape 3) | parcours | reste | journée type : reste entière | — |
| 4 | thème sombre appliqué à l'app, puis système (étape 4) | parcours | reste | journée type : reste entière | — |
| 5 | modèle injoignable : le proxy réglé est cité (étape 5) | parcours | reste | journée type : reste entière | — |
| 6 | sans proxy : piste Wi-Fi / VPN, la réponse arrive, le bandeau part (étape 6) | parcours | reste | journée type : reste entière | — |
| 7 | nouvelle conversation avec l'agent choisi ; les autres gardent le leur (étape 7) | parcours | reste | journée type : reste entière | — |
| 8 | retenu : la conversation suivante (autre agent) le reçoit (étape 8) | parcours | reste | journée type : reste entière | — |
| 9 | souvenir modifié dans Réglages › Mémoire (étape 9) | parcours | reste | journée type : reste entière | — |
| 10 | souvenir oublié (étape 9) | parcours | reste | journée type : reste entière | — |
| 11 | le rôle répond dans sa carte, la conversation reste affichée (étape 10) | parcours | reste | journée type : reste entière | — |

### `filles-tech-lead` — réduire

11 vérifications : 9 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 50 s → ≈ 13 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | `start_child` : agent inconnu refusé avec la liste, sans carte | doublon | retirée | `src/main/mcp/children-tools.test.ts › agent ou modèle inconnus : erreur claire avec les valeurs possibles, sans carte` | vert |
| 2 | carte : modèle proposé par la mère et sa raison | doublon | retirée | `src/renderer/src/components/thread/ChildProposals.test.tsx › agent et modèle proposés par la mère, présélectionnés, et sa raison (fiche 160)` | vert |
| 3 | carte : agent de la mère et modèle proposé présélectionnés | doublon | retirée | comme n° 2 : `src/renderer/src/components/thread/ChildProposals.test.tsx › agent et modèle proposés par la mère, présélectionnés, et sa raison (fiche 160)` | vert |
| 4 | carte de groupe : ni « Sous-tâches », ni compte rendu, ni recommandation séparés | doublon | retirée | `src/renderer/src/components/thread/WorkGroup.test.tsx › « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé` + `› message de l'agent au travail : dans sa carte ; recommandation : la pastille seule` | vert |
| 5 | la correction (`message_child`) dans la carte du travail, puis sa réponse | doublon | retirée | `WorkGroup.test.tsx › message de l'agent au travail : dans sa carte…` ; `src/main/conversations/children.test.ts › `filles-tech-lead` (fiche 160) : modèle proposé, correction, puis recommandation` | vert |
| 6 | rien de fusionné par l'agent | doublon | retirée | `children.test.ts › `filles-tech-lead` (fiche 160)…` (rev-list = 1) ; `children-tools.test.ts › recommend_merge : posé pour la fille, ne fusionne rien (fiche 160)` | vert |
| 7 | carte de groupe : « Recommandée », le recommandé proposé ; l'autre travail a sa carte | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | fusion depuis la carte : son travail seulement | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | fille bavarde : la mère lit la réponse entière par `child_status` | doublon | retirée | `children.test.ts › `filles-bavarde` (fiches 160, 247) : compte rendu borné, sans la fin ; la mère lit la suite par `child_status`` ; `children-tools.test.ts › child_status `full` (fiche 247)…` | vert |
| 10 | fille bavarde : 30 fichiers non commités dits sur sa ligne | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/WorkGroup.test.tsx` › travail bavard : ses 30 modifications non commitées dites sur sa ligne (filles-tech-lead n° 10) | vert |
| 11 | réponse dans la carte, repliée, commence par le récapitulatif | doublon | retirée | `WorkGroup.test.tsx › une ligne se déplie sur la carte-réponse du travail : réponse entière, transmission, Ouvrir` | vert |

### `aurore` — réduire

11 vérifications : 1 retirées (dont 0 à confirmer), 0 creuse(s), 10 restent. Durée (clair + sombre) : 8 s → ≈ 8 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | vignette marquée « Nouveau », plus de Sépia | doublon | retirée | `src/renderer/src/components/settings/SettingsDialog.test.tsx › huit thèmes, six accents : chaque choix part dans les préférences ; Aurore « Nouveau »` ; `src/shared/preferences.test.ts › Sépia retiré (fiche 226)…` | vert |
| 2 | thème appliqué (`--bg` calculé = jeton) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 3 | Réglages en verre dépoli (ou opaques sans `glass`) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 4 | lueur en haut de la barre latérale | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 5 | bulle de l'utilisateur en dégradé | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 6 | carte d'autorisation : ombre teintée, action en dégradé | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 7 | aucun verre dans le fil | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 8 | saisie au focus : liseré dégradé | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 9 | menu du panneau en verre (ou opaque) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 10 | repli (boucle : transparence réduite, contraste) : verre opaque, plus de lueur, dégradés unis | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 11 | préférences revenues : la lueur revient | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |

### `finitions` — réduire

10 vérifications : 4 retirées (dont 0 à confirmer), 0 creuse(s), 6 restent. Durée (clair + sombre) : 22 s → ≈ 15 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | tour arrêté : pas de bilan sous « Interrompu » | doublon | retirée | `src/renderer/src/components/thread/TurnSummary.test.tsx › tour arrêté, refusé, coupé ou en erreur : pas de « Terminé » sous son avis` ; `Transcript.test.tsx › tour arrêté : comme avant, l'heure et la durée au survol, sans bilan` | vert |
| 2 | bilan dans le pied : « 1 fichier +1 −1 », sans « Travaille », une durée, « Copier » | doublon | retirée | `TurnSummary.test.tsx › un seul pied : « heure · durée · 2 fichiers +2 −1 », sans « Terminé » (fiche 261)` | vert |
| 3 | pied visible sans survol, une seule rangée | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 4 | « ↓ N nouveaux » sur le bouton | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/ScrollDownButton.test.tsx` › réponses arrivées pendant qu’on relit : « ↓ N nouveaux », puis « 99+ » (finitions n° 4) | vert |
| 5 | en bas du fil : plus de bouton | composant | retirée | comme n° 4 : **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/ScrollDownButton.test.tsx` › réponses arrivées pendant qu’on relit : « ↓ N nouveaux », puis « 99+ » (finitions n° 4) | vert |
| 6 | 900 px (boucle 2 onglets) : noms entiers ou icônes, aucun coupé, ✕ de l'actif visible | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 7 | 900 px : rangée au cran serré | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 8 | cran serré (boucle) : un clic sur l'icône l'ouvre, rien n'est fermé | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | 900 px : puce de l'agent nom entier ou icône, jamais un bout | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 10 | 900 px : pied du tour dans le fil, aucun élément coupé | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |

### `about` — réduire

10 vérifications : 3 retirées (dont 0 à confirmer), 0 creuse(s), 7 restent. Durée (clair + sombre) : 11 s → ≈ 9 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | menu › À propos : une fenêtre, attachée, 400 × 420, non redimensionnable, une seule | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | nom, version, présentation, « projet indépendant » ; commit du build injecté | composant | reste | partiel : `AboutWindow.test.tsx › nom, version et date en toutes lettres, présentation, non-affiliation ; aucune info technique affichée` | — |
| 3 | aucune information technique affichée | doublon | reste | partiel : comme n° 2 : partiel : `AboutWindow.test.tsx › nom, version et date en toutes lettres, présentation, non-affiliation ; aucune info technique affichée` | — |
| 4 | titre de la fenêtre « À propos de Bobine » | doublon | reste | partiel : comme n° 3 : comme n° 2 : partiel : `AboutWindow.test.tsx › nom, version et date en toutes lettres, présentation, non-affiliation ; aucune info technique affichée` | — |
| 5 | « Copier les infos techniques » : version, commit, moteurs, système, langue, agents | doublon | retirée | `src/main/technical-info.test.ts › version, commit, date, moteurs, système, langue et agents installés` ; `AboutWindow.test.tsx › « Copier les infos techniques » : bloc du main dans le presse-papiers, « Copié » deux secondes` | vert |
| 6 | « Copié » affiché | doublon | retirée | comme n° 5 : `src/main/technical-info.test.ts › version, commit, date, moteurs, système, langue et agents installés` ; `AboutWindow.test.tsx › « Copier les infos techniques » : bloc du main dans le presse-papiers, « Copié » deux secondes` | vert |
| 7 | « Copié » s'efface au bout de deux secondes | doublon | retirée | comme n° 6 : comme n° 5 : `src/main/technical-info.test.ts › version, commit, date, moteurs, système, langue et agents installés` ; `AboutWindow.test.tsx › « Copier les infos techniques » : bloc du main dans le presse-papiers, « Copié » deux secondes` | vert |
| 8 | GitHub, licence, « Signaler un problème » ouverts dans le navigateur | composant | reste | remplaçant partiel : reste hors Vitest : `openExternal` par le gestionnaire du main : e2e | — |
| 9 | « Nouveautés » : fenêtre fermée, Réglages › Nouveautés ouverts | parcours | reste | parcours : vraie app nécessaire | — |
| 10 | Échap : fenêtre fermée | parcours | reste | parcours : vraie app nécessaire | — |

### `travail-recette` — réduire

9 vérifications : 7 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 45 s → ≈ 14 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | quota épuisé : carte « Modèle refusé » et sa raison, jamais l'erreur brute | doublon | retirée | `src/renderer/src/components/composer/BlockerPanel.test.tsx › fiche 267 (N3) : quota gratuit épuisé, la raison dite, « Choisir un autre modèle » d'abord` ; `src/main/agent/turn-quota.test.ts › profil OpenCode, l'erreur réelle : la carte du modèle de la session, quota épuisé` | vert |
| 2 | « Choisir un autre modèle » en principal, la clé d'API en second | doublon | retirée | comme n° 1 : `src/renderer/src/components/composer/BlockerPanel.test.tsx › fiche 267 (N3) : quota gratuit épuisé, la raison dite, « Choisir un autre modèle » d'abord` ; `src/main/agent/turn-quota.test.ts › profil OpenCode, l'erreur réelle : la carte du modèle de la session, quota épuisé` | vert |
| 3 | pas d'avis en double dans le fil tant que la carte est là | composant | reste | partiel : `turn-quota.test.ts › avis du fil : quota épuisé, marqué « refus »` | — |
| 4 | un autre modèle : le message repart et l'agent répond | doublon | retirée | `turn-quota.test.ts › carte, pas d'erreur brute ; un autre modèle renvoie le message` ; `src/main/conversations/turn-auth-manager.test.ts › autre modèle choisi sur la carte (fiche 210) : même conversation, message renvoyé une fois, modèle refusé marqué` | vert |
| 5 | rôle choisi, Entrée aussitôt puis encore : une bulle, un travail, saisie vide (N5) | doublon | retirée | `src/renderer/src/components/roles/RoleComposerLoss.test.tsx › rôle de conseil choisi, texte tapé, Entrée aussitôt : il part, une fois` + `› double Entrée pendant l'envoi : un seul envoi, rien de perdu` | vert |
| 6 | activité en direct : une ligne coupée, la commande entière en infobulle (N4) | doublon | retirée | `src/renderer/src/components/thread/WorkCard.test.tsx › fiche 267 (N4) : une commande de dix lignes tient sur une ligne, l'entière en infobulle` (la hauteur mesurée n'y est pas : capture `267-activite-commande`) | vert |
| 7 | en-tête « quota épuisé » et barre latérale « bloqué » | doublon | retirée | `WorkCard.test.tsx › fiche 267 (N3, N8) : modèle du travail refusé (quota épuisé), dit dans sa carte, un autre modèle choisi depuis elle` ; `src/renderer/src/components/sidebar/conversation-state.test.ts › quota épuisé, modèle refusé : l'état bloqué, même avec une demande en attente` | vert |
| 8 | carte du travail : quota dit, « Choisir un autre modèle » du travail | doublon | retirée | comme n° 7 : `WorkCard.test.tsx › fiche 267 (N3, N8) : modèle du travail refusé (quota épuisé), dit dans sa carte, un autre modèle choisi depuis elle` ; `src/renderer/src/components/sidebar/conversation-state.test.ts › quota épuisé, modèle refusé : l'état bloqué, même avec une demande en attente` | vert |
| 9 | le travail repart avec l'autre modèle, réponse dans sa carte | unitaire-main | reste | partiel : `turn-auth-manager.test.ts › autre modèle choisi sur la carte (fiche 210)…` (conversation elle-même, pas une fille) | — |

## Suites du groupe B (`inventaire-e2e-B.md`)

### `acp` — supprimer entièrement (étape 1 : réduire)

14 vérifications : 14 retirées (dont 1 à confirmer), 0 creuse(s), 0 restent. Durée (clair + sombre) : 14 s → ≈ 0 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | onglet ouvert par le « + », démarrage de l'agent déjà là | parcours | retirée | **parcours-outils › étape 9** (dans une nouvelle conversation) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 2 | pied : clés et jetons masqués, messages en mémoire seulement | composant | retirée | oui : `src/renderer/src/components/panel/AcpTab.test.tsx › onglet « Échanges ACP » (fiche 135) › pied : clés et jetons masqués, messages en mémoire seulement` | vert |
| 3 | → session/prompt avec son identifiant | doublon | retirée | `src/renderer/src/acp-view.test.ts › méthode ou type de mise à jour, détail, durée de la réponse depuis sa requête` | vert |
| 4 | ← session/request_permission | doublon | retirée | comme n° 3 : `src/renderer/src/acp-view.test.ts › méthode ou type de mise à jour, détail, durée de la réponse depuis sa requête` | vert |
| 5 | réponse à la permission : → option choisie et durée | doublon | retirée | comme n° 3 : `src/renderer/src/acp-view.test.ts › méthode ou type de mise à jour, détail, durée de la réponse depuis sa requête` | vert |
| 6 | tool_call et ses mises à jour, heure à la ms | doublon | retirée | `acp-view.test.ts › heure à la milliseconde, taille et durée dans la langue de l’interface` | vert |
| 7 | morceaux de texte regroupés | doublon | retirée | `acp-view.test.ts › sans regroupement, un morceau par ligne ; messages différents jamais regroupés` ; `src/main/agent/acp-log.test.ts › morceaux de texte regroupés par message…` | vert |
| 8 | aucun morceau seul quand « Regrouper » est actif | doublon | retirée | comme n° 7 : `acp-view.test.ts › sans regroupement, un morceau par ligne ; messages différents jamais regroupés` ; `src/main/agent/acp-log.test.ts › morceaux de texte regroupés par message…` | vert |
| 9 | clic : JSON brut déplié, indenté et coloré | composant | retirée | oui : `src/renderer/src/components/panel/AcpTab.test.tsx › onglet « Échanges ACP » (fiche 135) › clic sur une ligne : JSON brut déplié, indenté et coloré ; second clic : replié` | vert |
| 10 | groupe déplié : ses N morceaux | composant | retirée | oui : `src/renderer/src/components/panel/AcpTab.test.tsx › onglet « Échanges ACP » (fiche 135) › morceaux regroupés ; groupe déplié : ses N morceaux, un par ligne` | vert |
| 11 | « Regrouper » décoché : un morceau par ligne | composant | retirée | oui : `src/renderer/src/components/panel/AcpTab.test.tsx › onglet « Échanges ACP » (fiche 135) › « Regrouper » décoché : un morceau par ligne, aucun groupe` | vert |
| 12 | filtre : seule la méthode cherchée reste | composant | retirée | oui : `src/renderer/src/components/panel/AcpTab.test.tsx › onglet « Échanges ACP » (fiche 135) › filtre : seule la méthode cherchée reste ; sans correspondance, c’est dit` | vert |
| 13 | en pause : la liste ne bouge plus | composant | retirée | oui : `src/renderer/src/components/panel/AcpTab.test.tsx › onglet « Échanges ACP » (fiche 135) › pause : la liste ne bouge plus, les arrivés sont comptés ; reprise : ils apparaissent` | vert |
| 14 | reprise : les messages arrivés entre-temps apparaissent | composant | retirée | comme n° 13 : oui : `src/renderer/src/components/panel/AcpTab.test.tsx › onglet « Échanges ACP » (fiche 135) › pause : la liste ne bouge plus, les arrivés sont comptés ; reprise : ils apparaissent` | vert |

### `android` — réduire

29 vérifications : 16 retirées (dont 0 à confirmer), 0 creuse(s), 13 restent. Durée (clair + sombre) : 32 s → ≈ 17 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | appareil trouvé (nom de l'AVD), app lancée par son activité | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | écran lu, toucher au centre du bouton (dp → px), saisie | doublon | retirée | `android-tools.test.ts › lire l’écran puis toucher par référence : dp convertis en pixels` ; `› capture en dp ; saisie ASCII seulement ; touche nommée` | vert |
| 3 | aucune autorisation ; onglet « Android » ouvert tout seul | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | débit de la vidéo affiché (fps) (waitFor) | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | vidéo H.264 décodée par Chromium et dessinée | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | écran de l'émulateur joint au message | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | vidéo : rien du faux `adb` ne survit à l'app | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | clic au centre de la vidéo : toucher au centre | composant | retirée | oui : `src/renderer/src/components/panel/AndroidTab.test.tsx › onglet « Android » (fiches 032, 081, 084) › clic au centre de l’écran : toucher au centre, en dp` (boîte de l’écran donnée : jsdom n’a pas de mise en page) | vert |
| 9 | bouton Retour du panneau | composant | retirée | oui : `src/renderer/src/components/panel/AndroidTab.test.tsx › onglet « Android » (fiches 032, 081, 084) › bouton Retour du panneau : KEYCODE_BACK ; volume de la tranche : volume_up` | vert |
| 10 | cadre de téléphone : proportions, perforation en haut au centre | doublon | retirée | `src/renderer/src/android-chassis.test.ts › phone in portrait: rounded screen, thin bezel, camera at the top, buttons on the right` | vert |
| 11 | commandes dans la barre sous le téléphone | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 12 | zoom : « ajuster » au départ, niveau affiché | composant | retirée | oui : `src/renderer/src/components/panel/AndroidTab.test.tsx › onglet « Android » (fiches 032, 081, 084) › zoom : « ajuster » au départ, niveau affiché ; cadre de téléphone en portrait` | vert |
| 13 | taille réelle : 1 pt par pt, défilement, barre visible | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 14 | zoom depuis « ajuster » : le milieu reste au centre | composant | retirée | oui : `src/renderer/src/device-zoom.test.ts › zoom des appareils : ce qu’on regardait reste au centre (fiche 084) › depuis « ajuster » : le milieu de l’écran au centre, pas son coin en haut à gauche` ; `src/renderer/src/device-zoom.test.ts › zoom des appareils : ce qu’on regardait reste au centre (fiche 084) › zoomé puis défilé : le point regardé reste au centre en zoomant encore` | vert |
| 15 | zoomé : un clic touche le point correspondant | composant | retirée | oui : `src/renderer/src/components/panel/AndroidTab.test.tsx › onglet « Android » (fiches 032, 081, 084) › zoomé et défilé : un clic touche le point vu ; la molette déplace la vue, sans balayage` | vert |
| 16 | zoomé : la molette déplace la vue, sans balayage | composant | retirée | oui : `src/renderer/src/components/panel/AndroidTab.test.tsx › onglet « Android » (fiches 032, 081, 084) › zoomé et défilé : un clic touche le point vu ; la molette déplace la vue, sans balayage` | vert |
| 17 | zoomer : palier suivant (125 %) | doublon | retirée | `device-zoom.test.ts › palier suivant et précédent d’après l’échelle affichée, même hors palier` | vert |
| 18 | « ajuster » : l'appareil tient en entier | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 19 | glisser : balayage de bas en haut, au bon endroit | doublon | retirée | `screen-gestures.test.ts › a drag is a swipe lasting as long as the gesture, within bounds` | vert |
| 20 | molette : balayage court vers le bas | doublon | retirée | `screen-gestures.test.ts › scrolling down pushes the content up from the pointer, away from the edges` | vert |
| 21 | appui long : toucher tenu à l'endroit du pointeur | doublon | retirée | `screen-gestures.test.ts › a click held still is a long press only where the device supports it` | vert |
| 22 | bouton de volume de la tranche | composant | retirée | comme n° 9 : oui : `src/renderer/src/components/panel/AndroidTab.test.tsx › onglet « Android » (fiches 032, 081, 084) › bouton Retour du panneau : KEYCODE_BACK ; volume de la tranche : volume_up` | vert |
| 23 | paysage : cadre tourné, perforation à gauche | parcours | reste | parcours : vraie app nécessaire | — |
| 24 | paysage : vidéo relancée à la taille tournée | parcours | reste | parcours : vraie app nécessaire | — |
| 25 | paysage : clic au quart → toucher au quart en px | composant | retirée | oui : `src/renderer/src/components/panel/AndroidTab.test.tsx › onglet « Android » (fiches 032, 081, 084) › paysage : cadre tourné ; clic au quart, toucher au quart dans l’orientation courante` | vert |
| 26 | tablette : cadre plus large, caméra dans le cadre | doublon | retirée | `android-chassis.test.ts › tablet from 600 dp on the short side: camera in the bezel, buttons on the top edge` | vert |
| 27 | planche contact : balayage filmé en images brutes | doublon | retirée | `android-tools.test.ts › filme avec un second screenrecord en images brutes, à la taille en dp` ; `› fait le geste pendant le film…` | vert |
| 28 | planche contact affichée dans la carte de l'outil | composant | reste | partiel : `Transcript.test.tsx` (`tool-images`) | — |
| 29 | planche : rien du faux `adb` ne survit | parcours | reste | parcours : vraie app nécessaire | — |

### `astuces` — supprimer entièrement

12 vérifications : 12 retirées (dont 0 à confirmer), 0 creuse(s), 0 restent. Durée (clair + sombre) : 57 s → ≈ 0 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | pas d'astuce avant deux secondes | doublon | retirée | `src/renderer/src/components/tips/ComposerTip.test.tsx › aparté : offerte après 2 s de texte tapé pendant que l’agent travaille, pas avant` | vert |
| 2 | astuce de l'aparté sur la saisie (/btw, ⇧⌘A) | doublon | retirée | `ComposerTip.test.tsx › aparté montrée : « Essayer »…, « En savoir plus », « Ne plus montrer », ×` | vert |
| 3 | × : astuce fermée | doublon | retirée | comme n° 2 : `ComposerTip.test.tsx › aparté montrée : « Essayer »…, « En savoir plus », « Ne plus montrer », ×` | vert |
| 4 | après relance : l'astuce fermée ne revient pas | unitaire-main | retirée | **oui, déjà couvert** (vérifié 2026-11-24) : `M/settings-store.test.ts` › « activées par défaut ; masquées gardées ; « Tout réafficher » garde le quota du jour » — reste hors Vitest : relecture au lancement : `M/settings.test.ts` | vert |
| 5 | contexte presque plein : astuce avec le pourcentage | doublon | retirée | `ComposerTip.test.tsx › contexte : au-delà de 85 %, une fois ; le pourcentage affiché` | vert |
| 6 | « Ne plus montrer » : masquée pour toujours | doublon | retirée | `src/renderer/src/useTips.test.ts › « Ne plus montrer » et fonction utilisée : jamais plus` ; `tips.test.ts › « Ne plus montrer » ou fonction utilisée : jamais plus` | vert |
| 7 | Réglages › Général : astuces activées, compte des masquées | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/TipsRow.test.tsx` › « activées : case cochée et « 1 astuce masquée » ; décochées, la préférence part » | vert |
| 8 | « Tout réafficher » : plus rien de masqué | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/TipsRow.test.tsx` › « « Tout réafficher » : plus rien de masqué, le compte et le lien s’en vont » | vert |
| 9 | même message un troisième jour, fin du tour : « Planifier… » | doublon | retirée | `tips.test.ts › troisième jour différent, une fois ce jour-là…` ; `useTips.test.ts › pas pendant le tour ; à sa fin, « Planifier… » ; rien ailleurs` | vert |
| 10 | « Planifier… » : tâche préremplie avec le message | doublon | retirée | `src/renderer/src/components/scheduled/ScheduledPage.test.tsx › ouvre une nouvelle tâche préremplie ; enregistrée, l’astuce ne reviendra plus` | vert |
| 11 | tâche préremplie : rien d'enregistré | doublon | retirée | `ScheduledPage.test.tsx › nouvelle tâche : enregistrée seulement quand la consigne et le dossier sont là` | vert |
| 12 | « Annuler » ramène à la conversation | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/scheduled/ScheduledPage.test.tsx` › tâche préremplie par l’astuce : « Annuler » ferme le formulaire, rien d’enregistré, retour à la conversation | vert |

### `auth` — réduire

30 vérifications : 17 retirées (dont 0 à confirmer), 0 creuse(s), 13 restent. Durée (clair + sombre) : 55 s → ≈ 27 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | SSO proposé | composant | reste | partiel : `src/renderer/src/components/onboarding/Onboarding.test.tsx › SSO qui ne revient pas (fiche 207)…` (clic `auth-mock-sso`) | — |
| 2 | SSO : libellé traduit | doublon | retirée | `src/main/agent/profiles.test.ts › Bob : « sso », la méthode relevée par la sonde, libellée dans la langue de l'app` | vert |
| 3 | clé d'API : agent relancé avec, plus de connexion | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | clé d'API : la conversation fonctionne | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | clé chiffrée sur disque (ou D4 : en clair marquée `plain:`, 0600) | unitaire-main | retirée | `src/main/agent-config/api-keys.test.ts › enregistre chiffré (fichier 0600)…` et `› en clair et marquée, jamais un faux chiffrement…` | vert |
| 6 | la clé ne revient jamais à l'interface | unitaire-main | retirée | **oui, remplaçant créé** (2026-11-24) : `M/settings-store.test.ts` › « clé d’API enregistrée : jamais sa valeur dans ce qui part à l’interface ni dans settings.json » —  ; **remplaçant écrit (2026-11-24)** : `src/main/ipc-agent.test.ts › IPC branché sur le vrai gestionnaire, contre l’agent factice › clé d’API enregistrée par le canal (fiche 022) : jamais renvoyée à l’interface, ni à l’enregistrement ni ensuite` — le DOM reste vu par `ApiKeys.test.tsx` (à créer) | vert |
| 7 | Réglages › page de l'agent : « Enregistrée » (ou « en clair » + avis D4) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApiKeys.test.tsx` › « saisie puis « Enregistrée » ; jamais la valeur à l’écran » ; `R/components/settings/ApiKeys.test.tsx` › « en clair (Linux sans trousseau) : l’état le dit, et l’avis nomme la variable » | vert |
| 8 | Réglages : clé supprimée | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApiKeys.test.tsx` › « supprimer : confirmation dans la ligne, puis l’état revient à « Aucune » » | vert |
| 9 | clé invalide refusée, message sans « Error » | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApiKeys.test.tsx` › « clé refusée par le main : la cause seule, sans « Error », la saisie reste ouverte » | vert |
| 10 | rouverte, clé illisible : conversation d'avant, connexion demandée dès la réouverture | parcours | reste | parcours : vraie app nécessaire | — |
| 11 | rouverte : clé ressaisie, la même conversation continue | parcours | reste | parcours : vraie app nécessaire | — |
| 12 | clé illisible : l'agent démarre sans, connexion demandée | unitaire-main | retirée | `src/main/agent-config/api-keys.test.ts › clé indéchiffrable (trousseau changé) : ignorée, signalée à ressaisir…` | vert |
| 13 | Réglages : clé illisible signalée | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApiKeys.test.tsx` › « clé illisible (nom de l’app changé) : dit, puis ressaisie, de nouveau « Enregistrée » » | vert |
| 14 | clé ressaisie : de nouveau enregistrée | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApiKeys.test.tsx` › « clé illisible (nom de l’app changé) : dit, puis ressaisie, de nouveau « Enregistrée » » | vert |
| 15 | connexion dans un terminal : commande lancée dans le terminal de l'app | parcours | reste | parcours : vraie app nécessaire | — |
| 16 | terminal : « Réessayer » relance l'agent, connecté | parcours | reste | parcours : vraie app nécessaire | — |
| 17 | carte de connexion : pas de question | composant | retirée | `src/renderer/src/components/composer/BlockerPanel.test.tsx › pas d'attente du navigateur : ni question ni « Réessayer »` | vert |
| 18 | attente du navigateur : la question et « Réessayer » | composant | retirée | `BlockerPanel.test.tsx › en attente du navigateur : la question, et « Réessayer » (principal) relance l'agent` | vert |
| 19 | SSO sans retour : « Réessayer » relance, connecté | doublon | reste | partiel : même relance que #16 ; `Onboarding.test.tsx › SSO qui ne revient pas (fiche 207)…` | — |
| 20 | Réglages, trousseau lent : champ et bouton désactivés, « Enregistrement… », attente dite | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApiKeys.test.tsx` › « trousseau lent : champ et bouton désactivés, « Enregistrement… », puis l’attente dite » | vert |
| 21 | Réglages : délai dépassé dit, valeur gardée, rien d'enregistré | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApiKeys.test.tsx` › « délai dépassé : le message, la valeur gardée, rien d’enregistré, puis « Réessayer » » | vert |
| 22 | Réglages : délai dépassé → « Réessayer » | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApiKeys.test.tsx` › « délai dépassé : le message, la valeur gardée, rien d’enregistré, puis « Réessayer » » | vert |
| 23 | Réglages : « Réessayer » repose la même question, clé enregistrée | unitaire-main | retirée | `src/main/agent-config/api-keys.test.ts › Réessayer attend la même question au trousseau, sans en poser une autre` | vert |
| 24 | carte : trousseau attendu dit | composant | retirée | `BlockerPanel.test.tsx › trousseau qui tarde : désactivé, « Enregistrement… », puis l'attente du trousseau dite` | vert |
| 25 | carte : délai dépassé, valeur gardée, « Réessayer » | composant | retirée | `BlockerPanel.test.tsx › délai dépassé : le message, la valeur gardée, « Réessayer »` | vert |
| 26 | carte : « Réessayer », clé enregistrée, agent relancé | doublon | reste | partiel : même enchaînement que #3 ; `api-keys.test.ts › Réessayer attend la même question…` | — |
| 27 | licence : panneau dédié avec le message de l'agent | composant | reste | partiel : `src/main/diagnostics.test.ts › blocages : dossier, connexion, licence…` (diagnostic, pas la carte) | — |
| 28 | licence : « Lire la licence » lance la commande dans le terminal | doublon | reste | partiel : même mécanisme d'étape → terminal que #15 | — |
| 29 | licence : jamais acceptée par l'app | unitaire-main | reste | partiel : `src/main/agent/capabilities.test.ts` (texte `bob --show-license`) | — |
| 30 | licence acceptée : « Réessayer » relance l'agent | doublon | reste | partiel : même relance que #16 | — |

### `bob` — réduire

9 vérifications : 5 retirées (dont 0 à confirmer), 0 creuse(s), 4 restent. Durée (clair + sombre) : 8 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | dossier non approuvé : panneau dédié | doublon | retirée | `src/renderer/src/components/composer/BlockerPanel.test.tsx › panneau « Dossier non approuvé » (fiche 088)` | vert |
| 2 | agent bloqué : changer d'agent ou de dossier reste possible | composant | reste | aucun remplaçant écrit | — |
| 3 | confiance pour la session → l'agent demande la connexion | doublon | retirée | `src/main/agent/agent-host.test.ts › premier lancement de Bob : dossier d’abord, PUIS connexion (ordre réel)` | vert |
| 4 | connexion SSO (simulée) → agent prêt | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | formulaire vide : erreurs, rien de transmis | doublon | retirée | `src/renderer/src/components/thread/ElicitationCard.test.tsx › formulaire : champs requis et bornes vérifiés avant l’envoi, contenu propre envoyé` | vert |
| 6 | formulaire rempli → réponse transmise à l'agent | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | page web demandée : refus transmis | doublon | retirée | `ElicitationCard.test.tsx › page à ouvrir : hôte affiché, accord ou refus` | vert |
| 8 | licence : message de l'agent sur ses quatre lignes | composant | reste | aucun remplaçant écrit | — |
| 9 | licence refusée : explication au lieu de l'erreur | doublon | retirée | `agent-host.test.ts › licence demandée au message (Bob 2.0.9) : formulaire refusé → explication, pas l’erreur brute` | vert |

### `browser-view` — réduire

21 vérifications : 2 retirées (dont 0 à confirmer), 0 creuse(s), 19 restent. Durée (clair + sombre) : 24 s → ≈ 22 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | la page couvre la zone, innerWidth = sa largeur | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | molette : la page défile | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | clavier (espace, flèche) : la page défile | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | colonne élargie à la poignée : innerWidth suit | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | panneau agrandi : la page prend toute la largeur | doublon | reste | partiel : même synchronisation des bornes que #4 | — |
| 6 | panneau réduit : la page suit | doublon | reste | partiel : même synchronisation que #4 | — |
| 7 | interface à 80 / 150 % : vue exacte (×2, boucle ; repli du panneau à 150 % puis réouverture) | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | menu « Taille réelle », interface au focus : retour à 100 % | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | ⌘+ dans la page : la page seule à 110 %, puce | parcours | reste | parcours : vraie app nécessaire | — |
| 10 | ⌘− dans la page : retour à 100 %, plus de puce | doublon | reste | partiel : même chemin que #9 ; `page-view.test.ts › paliers de zoom…` | — |
| 11 | menu « Zoom avant », page au focus : la page zoome, pas l'interface | parcours | reste | parcours : vraie app nécessaire | — |
| 12 | page à 150 % : l'agent clique juste, en pixels CSS | parcours | reste | parcours : vraie app nécessaire | — |
| 13 | clic sur la puce de zoom : retour à 100 % | composant | retirée | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « puce de zoom : affichée hors de 100 %, un clic remet la page à 100 % » | vert |
| 14 | ⌘L dans la page : le champ d'adresse prend le clavier | parcours | reste | parcours : vraie app nécessaire | — |
| 15 | ⌘R dans la page : elle se recharge | parcours | reste | parcours : vraie app nécessaire | — |
| 16 | ⌘[ et ⌘] : précédent, suivant | parcours | reste | parcours : vraie app nécessaire | — |
| 17 | taille mobile : l'agent clique juste et fait défiler | parcours | reste | parcours : vraie app nécessaire | — |
| 18 | taille imposée : 375 × 812 tient entier, puce affichée | parcours | reste | parcours : vraie app nécessaire | — |
| 19 | taille imposée : défile à la molette et jusqu'en bas | parcours | reste | parcours : vraie app nécessaire | — |
| 20 | fin du tour : la page reprend la largeur du panneau | parcours | reste | parcours : vraie app nécessaire | — |
| 21 | clic sur la puce de taille : la page reprend la largeur | composant | retirée | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « puce de taille imposée : la taille, et un clic rend la largeur du panneau » ; main : `browser-tools.test.ts` › « taille d'écran et thème : préréglages, tailles libres, retour au panneau » | vert |

### `changes` — réduire

14 vérifications : 12 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 12 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | pas de raccourci tant que rien n'est modifié | composant | retirée | oui : `src/renderer/src/components/panel/ChangesToggle.test.tsx › raccourci des modifications de l’en-tête (fiche 021) › pas de raccourci tant que rien n’est modifié` (raccourci sorti d’`App` dans `ChangesToggle.tsx`) | vert |
| 2 | en-tête : 2 fichiers, +6 −1 | composant | retirée | oui : `src/renderer/src/components/panel/ChangesToggle.test.tsx › raccourci des modifications de l’en-tête (fiche 021) › 2 fichiers, +6 −1 ; un clic ouvre l’onglet` | vert |
| 3 | vue « Conversation » : README.md, puis src/app.js créé | composant | retirée | oui : `src/renderer/src/components/panel/ChangesTab.test.tsx › vue Conversation de l’onglet Modifications (fiches 021, 071, 272) › README.md puis src/app.js créé (« A »), dans l’ordre ; deux modifications, un seul fichier` | vert |
| 4 | deux modifications du README fusionnées en un seul diff | doublon | retirée | `src/shared/changes.test.ts › regroupe par fichier, fusionne les modifications enchaînées, ignore les outils non aboutis` | vert |
| 5 | vue « Git » : aussi le fichier non suivi de l'utilisateur | unitaire-main | retirée | `src/main/changes/git-context.test.ts › état et diff depuis le dernier commit, fichiers non suivis listés` | vert |
| 6 | diff git chargé à la demande (contenu sur le disque) | doublon | retirée | `e2e/suites/parcours-matinee.mjs` étape 5 « Modifications : README.md et src/app.js, le diff de README sur le disque » ; partiel `ChangesTab.test.tsx › relu pendant le chargement…` | vert |
| 7 | annuler une modification : README remis, dit dans le fil | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | vue « Git » à jour : README n'est plus modifié | doublon | reste | partiel : `src/main/changes/git-changed.test.ts` (signal « dépôt changé ») + `ChangesTab.test.tsx › vue Git relue après un commit fait hors du panneau…` | — |
| 9 | Ouvrir : fichier ordinaire, app par défaut | unitaire-main | retirée | `src/main/files/file-links.test.ts › fichier ordinaire : app par défaut ; chemin absolu ou relatif` | vert |
| 10 | Ouvrir : un .command est montré dans le Finder, jamais lancé | unitaire-main | retirée | `src/main/files/file-links.test.ts › jamais rien d'exécuté : .command, .terminal sans bit x, script exécutable → Finder` | vert |
| 11 | l'onglet dit pourquoi le fichier n'a pas été ouvert | composant | retirée | oui : `src/renderer/src/components/panel/ChangesTab.test.tsx › vue Conversation de l’onglet Modifications (fiches 021, 071, 272) › « Ouvrir » un exécutable : l’onglet dit pourquoi il a été montré plutôt qu’ouvert` | vert |
| 12 | remarques : une ligne, puis une plage (Maj-clic, ⌘↩), gardées pour la conversation | composant | retirée | oui : `src/renderer/src/components/panel/ChangesDiffNotes.test.tsx › remarques sur les lignes des modifications (fiche 085) › une ligne, puis une plage (Maj-clic, ⌘↩), comptées et gardées pour la conversation` (Maj-clic par `shiftKey`, pas une vraie sélection) | vert |
| 13 | remarque supprimée puis modifiée | composant | retirée | oui : `src/renderer/src/components/panel/ChangesDiffNotes.test.tsx › remarques sur les lignes des modifications (fiche 085) › remarque supprimée puis modifiée : la liste et le compteur suivent` | vert |
| 14 | Envoyer : un message avec chaque remarque, fichier et lignes ; remarques effacées | composant | retirée | oui : `src/renderer/src/components/panel/ChangesDiffNotes.test.tsx › remarques sur les lignes des modifications (fiche 085) › Envoyer : un message avec chaque remarque, son fichier et ses lignes ; remarques effacées` | vert |

### `commands` — réduire

17 vérifications : 15 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 8 s → ≈ 5 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | « / » : commandes de l'agent (3) et de l'app (11), origine affichée | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › « / » : commandes de l’agent et de l’app, chacune avec son origine (commands n° 1) | vert |
| 2 | commande de l'app : l'agent de la conversation seul (pas « Bobine ») | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › commande de l’app : badge au nom de l’agent de la conversation, pas « Bobine » (commands n° 2) | vert |
| 3 | pastilles des commandes de l'app compactes | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 4 | menu entier dans la fenêtre, sous la saisie sur l'accueil | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 5 | Tab complète « /scenario » et rappelle l'argument | composant | retirée | `src/renderer/src/useCommandMenu.test.ts › commande complétée : rappel de l'argument attendu ; surlignage remis en tête` | vert |
| 6 | commande envoyée avec son argument | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › commande avec son argument : envoyée telle quelle, saisie vidée (commands n° 6) | vert |
| 7 | Entrée sur une commande sans argument : envoyée directement | composant | retirée | `Composer.test.tsx › commande de l'agent sans argument : envoyée telle quelle ; commande de l'app : traitée par l'app` | vert |
| 8 | aucune correspondance : message dans le menu | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › « / » sans correspondance : le menu le dit (commands n° 8) | vert |
| 9 | Échap ferme le menu sans effacer la saisie | composant | retirée | `useCommandMenu.test.ts › ouvert pendant la saisie du nom, filtré ; Échap le referme…` + `Composer.test.tsx › Échap ferme le menu, sans envoyer` | vert |
| 10 | /context : bilan dans le fil, rien envoyé à l'agent | composant | retirée | `src/renderer/src/app-commands.test.ts › /context et /cost : chacun son encadré titré, sans rien envoyer (fiche 126)` | vert |
| 11 | /context et /cost : deux encadrés, chacun son titre | doublon | retirée | `app-commands.test.ts › /context et /cost : chacun son encadré titré, sans rien envoyer (fiche 126)` | vert |
| 12 | /mode : liste des modes, l'actuel marqué | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/app-commands.test.ts` › /mode sans argument : la liste des modes, le mode courant marqué | vert |
| 13 | /mode plan : mode changé par son nom, puce à jour | doublon | retirée | `src/shared/app-commands.test.ts › option choisie par son nom, exact ou unique` + `e2e/suites/parcours-matinee.mjs` étape 11 (mode changé, appliqué) | vert |
| 14 | /help : commandes de l'agent et de l'app | doublon | retirée | `app-commands.test.ts › /help liste les commandes de l'agent puis celles de l'app` | vert |
| 15 | /compact : commande de compaction de l'agent, compaction affichée | doublon | retirée | `app-commands.test.ts › /compact envoie la commande de l'agent, ou dit qu'il ne sait pas` + `src/shared/transcript.test.ts › compaction : élément créé, résumé en morceaux, statut mis à jour` | vert |
| 16 | /compress répondu en texte : carte « Conversation résumée » | doublon | retirée | `src/shared/transcript.test.ts › réponse en texte à la commande de compaction : carte « Conversation résumée » (fiche 126)` | vert |
| 17 | /clear : nouvelle conversation vide, même agent, même dossier | composant | retirée | `app-commands.test.ts › /clear ouvre une conversation avec le même agent et le même dossier` | vert |

### `composer` — réduire

53 vérifications : 35 retirées (dont 2 à confirmer), 0 creuse(s), 18 restent. Durée (clair + sombre) : 112 s → ≈ 41 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | accueil : dossier sur la ligne sous la saisie, plus dans la barre | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › dossier et branche sur la ligne sous la saisie, pas dans la barre (composer n° 1, git n° 1) | vert |
| 2 | après un choix de mode, focus rendu à la saisie | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › mode choisi dans le menu : focus rendu à la saisie, sans infobulle ouverte (composer n° 2, 3) | vert |
| 3 | … sans infobulle ouverte | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › mode choisi dans le menu : focus rendu à la saisie, sans infobulle ouverte (composer n° 2, 3) (infobulle réellement survolée : parcours-matinee ét. 11) | vert |
| 4 | clic dans la saisie juste au-dessus de la puce, frappe : texte dans la saisie | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | Entrée envoie le message | doublon | retirée | `src/renderer/src/components/composer/Composer.test.tsx › Entrée envoie le message, Maj+Entrée non` | vert |
| 6 | fil remonté, message envoyé : retour en bas, bulle visible | doublon | retirée | `src/renderer/src/useThreadScroll.test.ts › message envoyé fil remonté : retour en bas tout de suite, la bulle et la réponse suivies (D26)` ; `parcours-longue`, étape 3 | vert |
| 7 | … réponse suivie jusqu'en bas (waitFor) | doublon | retirée | comme n° 6 : `src/renderer/src/useThreadScroll.test.ts › message envoyé fil remonté : retour en bas tout de suite, la bulle et la réponse suivies (D26)` ; `parcours-longue`, étape 3 | vert |
| 8 | une infobulle ouverte sur la saisie ne prend pas le pointeur | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/composer-css.test.ts` › une infobulle ne prend jamais le pointeur, ni son enveloppe de placement (composer n° 8) (vrai clic à travers : parcours-matinee ét. 11) | vert |
| 9 | un clic à travers l'infobulle met le curseur dans la saisie | doublon | reste | partiel : même contrat que #4 et #8 | — |
| 10 | Échap ferme le menu et rend le focus à la puce | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › Échap ferme le menu du mode et rend le focus à la puce (composer n° 10) | vert |
| 11 | liste longue : curseur dans la recherche | doublon | retirée | `src/renderer/src/components/common/ModelChip.test.tsx › longue liste : recherche focalisée, filtre, ↑ ↓ Entrée` | vert |
| 12 | liste longue (≥30) : dans la fenêtre, avec défilement | composant | reste | partiel : `menu-placement.test.ts › caps the height to the room above when above is the larger side but too small` — **Reste e2e ou capture (lot dialogues)** : e2e/capture : placement réel du menu et défilement de sa liste (Radix + mise en page) ; la règle de placement seule est à `src/renderer/src/components/composer/menu-placement.test.ts` | — |
| 13 | ouverte sur le modèle en cours, visible et en surbrillance | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/common/ModelChip.test.tsx` › longue liste ouverte : le modèle en cours amené au milieu de la partie visible (composer n° 13) (mesures simulées) | vert |
| 14 | ligne : nom court, fournisseur à part | doublon | retirée | `ModelChip.test.tsx › courte liste : pas de recherche, ouverte sur le modèle en cours, groupes affichés` ; `› nom court : ce qui suit le dernier « / »…` | vert |
| 15 | recherche, ↓, Entrée : modèle choisi, focus rendu à la saisie | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/common/ModelChip.test.tsx` › choix au clavier dans la zone de saisie : modèle réglé, focus rendu à la saisie (composer n° 15) | vert |
| 16 | le modèle choisi est appliqué par l'agent | doublon | retirée | `parcours-matinee`, étape 11 (modèle et mode changés, appliqués par `echo`) | vert |
| 17 | fenêtre large : barre complète (capture, %, nom du mode) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/composer-css.test.ts` › fenêtre large (niveau 0) : capture, pourcentage et nom du mode affichés (composer n° 17) + `src/renderer/src/components/composer/useBarFold.test.ts` › premier niveau auquel la barre tient | vert |
| 18 | … aucun nom tronqué | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 19 | 760 px : la capture passe sous 📎, la barre tient | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/composer-css.test.ts` › premier repli (≈ 760 px) : la capture passe sous 📎, le reste tient (composer n° 19) + `src/renderer/src/components/composer/AttachButton.test.tsx` › replié : « Joindre des fichiers… » et « Capturer une zone »… | vert |
| 20 | 760 px : rien de tronqué, sauf le modèle une fois tout replié | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 21 | 📎 replié : « Joindre des fichiers… » et « Capturer une zone » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/AttachButton.test.tsx` › replié : « Joindre des fichiers… » et « Capturer une zone » dans le menu de 📎 | vert |
| 22 | 📎 replié sans capture : bouton simple, sans menu | doublon | retirée | `AttachButton.test.tsx › sans capture d’écran : bouton simple « Joindre des fichiers… »…` | vert |
| 23 | le mode plan a son icône, distincte des autres | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › le mode Plan a son icône, distincte des autres modes (composer n° 23) | vert |
| 24 | 640 px : mode en icône, anneau seul, envoi visible | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/composer-css.test.ts` › niveau 3 (≈ 640 px) : mode en icône, anneau seul, envoi visible (composer n° 24) | vert |
| 25 | 640 px : réglages sous 📎 avant que modèle et agent cèdent | doublon | retirée | `useBarFold.test.ts › les réglages de la session passent sous 📎 avant que le modèle ne cède (fiche 276, T10)` | vert |
| 26 | 📎 replié : « Réglages de la session » en sous-menu | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/AttachButton.test.tsx` › replié avec les réglages : « Réglages de la session » sous un trait, dans le menu de 📎 | vert |
| 27 | 500 px : barre sur deux lignes, envoi visible | doublon | retirée | `useBarFold.test.ts › même au plus serré, rien ne tient : la barre passe sur deux lignes` | vert |
| 28 | 500 px, Plan : invite entière | composant | reste | partiel : `useTextareaLayout.test.tsx › suit la largeur : une ligne de plus quand la zone rétrécit, sans attendre le texte` — **Reste e2e ou capture (lot dialogues)** : e2e/capture : hauteur réelle de l’invite à 500 px (police, `scrollHeight` du navigateur) ; le mécanisme est à `src/renderer/src/useTextareaLayout.test.tsx` › suit la largeur… | — |
| 29 | 500 px, Code : invite entière | doublon | reste | partiel : comme n° 28 : partiel : `useTextareaLayout.test.tsx › suit la largeur : une ligne de plus quand la zone rétrécit, sans attendre le texte` — **Reste e2e ou capture (lot dialogues)** : e2e/capture : hauteur réelle de l’invite à 500 px (police, `scrollHeight` du navigateur) ; le mécanisme est à `src/renderer/src/useTextareaLayout.test.tsx` › suit la largeur… | — |
| 30 | 500 px : texte tapé entier, sans défilement | composant | reste | partiel : comme n° 28 : partiel : `useTextareaLayout.test.tsx › suit la largeur : une ligne de plus quand la zone rétrécit, sans attendre le texte` — **Reste e2e ou capture (lot dialogues)** : e2e/capture : hauteur réelle de l’invite à 500 px (police, `scrollHeight` du navigateur) ; le mécanisme est à `src/renderer/src/useTextareaLayout.test.tsx` › suit la largeur… | — |
| 31 | accueil à 760 px : saisie et envoi dans la fenêtre | capture | retirée | **parcours-premier-lancement › étape 5** (capture qui affirme `277-premier-accueil-760`) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 32 | accueil à 760 px : suggestions dans la fenêtre | capture | retirée | **parcours-premier-lancement › étape 5** (capture qui affirme `277-premier-accueil-760`) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 33 | accueil : dossier et branche sous la saisie | doublon | reste | partiel : même contrat que #1 | — |
| 34 | accueil à 760 px : le bouton d'envoi se clique | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › accueil : un clic sur Envoyer envoie le message (composer n° 34) (bouton dans la fenêtre à 760 px : capture) | vert |
| 35 | mode Code : saisie habituelle, sans rappel (transitions 150 ms) | doublon | retirée | `Composer.test.tsx › hors mode Plan : ni teinte, ni ligne de rappel, invite habituelle` | vert |
| 36 | « réduire les animations » : aucune transition du mode Plan | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/composer-css.test.ts` › « réduire les animations » : ni transition du mode Plan, ni animation de sa ligne de rappel (composer n° 36) | vert |
| 37 | Plan : bordure et halo de la couleur du plan, fond teinté | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 38 | la puce devient une pastille « Plan » colorée | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 39 | invite du mode Plan | doublon | retirée | `Composer.test.tsx › mode Plan (fiche 098) : zone teintée, invite et ligne de rappel, Maj+Tab vers le mode suivant` | vert |
| 40 | ligne de rappel sous la saisie, au-dessus du dossier | doublon | retirée | comme n° 39 : `Composer.test.tsx › mode Plan (fiche 098) : zone teintée, invite et ligne de rappel, Maj+Tab vers le mode suivant` | vert |
| 41 | contraste AA : ligne de rappel et pastille | doublon | retirée | `src/shared/themes.test.ts › ${palette}, accent ${accent} : contrastes AA` (paires `plan`/`bg` et `plan`/`planSoft`) | vert |
| 42 | l'envoi garde l'accent, distinct du Plan | doublon | reste | partiel : `themes.test.ts › le mode Plan reste distinct de l’accent` | — |
| 43 | en conversation : toujours Plan, même invite | parcours | reste | parcours : vraie app nécessaire | — |
| 44 | fenêtre étroite : la puce repliée en icône garde la couleur | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 45 | Maj+Tab : en Code, la saisie redevient normale | doublon | retirée | `Composer.test.tsx › mode Plan (fiche 098)…` + `› hors mode Plan…` | vert |
| 46 | Maj+Tab deux fois : de nouveau en Plan (waitFor) | doublon | retirée | `src/renderer/src/composer-keys.test.ts › mode suivant (Maj+Tab) › option suivante, en boucle` | vert |
| 47 | « Exécuter le plan » : en Code, saisie normale | parcours | reste | parcours : vraie app nécessaire | — |
| 48 | (×4, boucle) thème : Plan bleu ou violet, distinct de l'accent | doublon | reste | partiel : `themes.test.ts › le mode Plan reste distinct de l’accent` (pas le bleu/violet) | — |
| 49 | (×4, boucle) thème : contraste AA ligne et pastille | doublon | retirée | `themes.test.ts › ${palette}, accent ${accent} : contrastes AA` | vert |
| 50 | (×2, boucle) nouveau fil (code, discussion) : Entrée pendant le démarrage, texte reste | parcours | reste | parcours : vraie app nécessaire | — |
| 51 | (×2, boucle) … puis part tout seul, une fois, saisie vidée | parcours | reste | parcours : vraie app nécessaire | — |
| 52 | connexion demandée : Entrée pendant le démarrage | doublon | retirée | `Composer.test.tsx › démarrage fini en connexion demandée (needs-action) : rien ne part, le texte reste` | vert |
| 53 | … rien ne part : texte gardé, fil vide | doublon | retirée | comme n° 52 : `Composer.test.tsx › démarrage fini en connexion demandée (needs-action) : rien ne part, le texte reste` | vert |

### `custom-agent` — réduire

9 vérifications : 6 retirées (dont 0 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 13 s → ≈ 8 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Réglages › Agents : « Ajouter un agent ACP… » en dernière ligne | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « « Ajouter un agent ACP… » est la dernière ligne de la liste » | vert |
| 2 | formulaire : ligne de variable mal formée signalée sous son champ, « Ajouter » grisé | composant | retirée | `SettingsDialog.test.tsx › agents ACP déclarés (fiche 141) › « Ajouter un agent ACP… » : erreurs sous leur champ, « Ajouter » grisé, puis envoyé` + `src/shared/custom-agents.test.ts › rend la première ligne mal formée` | vert |
| 3 | page de l'agent déclaré : clé d'API, « Modifier… », « Déclaré dans Bobine » | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « page d’un agent déclaré : sa clé d’API, « Modifier… », « Déclaré dans Bobine » » | vert |
| 4 | déclaration enregistrée dans settings.json : commande, arguments, variables | unitaire-main | retirée | `src/main/settings-store.test.ts › ajouté, modifié, retiré : réglage enregistré et liste des profils tenue à jour` + `src/shared/custom-agents.test.ts › sans erreur : l'agent, et son formulaire à l'identique` | vert |
| 5 | l'agent déclaré répond | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | après redémarrage : « Nouvelle session avec Agent maison », pas de lecture seule | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | la session neuve reçoit l'échange d'avant avec le message | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | modifier : le formulaire reprend la déclaration | composant | retirée | `SettingsDialog.test.tsx › agents ACP déclarés (fiche 141) › introuvable mais listé ; sa page : modifier, puis supprimer après confirmation` | vert |
| 9 | supprimé : retiré de la liste des agents | composant | retirée | `SettingsDialog.test.tsx › … sa page : modifier, puis supprimer après confirmation` + `settings-store.test.ts › ajouté, modifié, retiré…` | vert |

### `diagnostic` — réduire

28 vérifications : 18 retirées (dont 0 à confirmer), 0 creuse(s), 10 restent. Durée (clair + sombre) : 47 s → ≈ 20 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | groupes : app, environnement, chaque agent, MCP, fournisseurs, simulateurs | unitaire-main | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/Diagnostics.test.tsx` › « groupes dans l’ordre : l’app, l’environnement, chaque agent, MCP, les fournisseurs » — reste hors Vitest : iOS selon le simulateur : `M/diagnostics.test.ts` (déjà là) | vert |
| 2 | agent factice : démarré, session d'essai prête | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | Bob absent du PATH : facultatif, installation et « Relire le PATH » | unitaire-main | retirée | `diagnostics.test.ts › introuvable : facultatif si un autre agent est installé, en erreur sinon` | vert |
| 4 | PATH du shell de connexion lu | unitaire-main | reste | partiel : `src/main/shell-env.test.ts › repli : zsh de connexion interactif sous macOS, sh de connexion ailleurs` et `› extrait les variables malgré le bruit des fichiers rc…` | — |
| 5 | facultatifs : AXe absent, aucun serveur MCP | unitaire-main | retirée | **oui, déjà couvert** (vérifié 2026-11-24) : `R/diagnostics-view.test.ts` › « aucun serveur, lecture, fichier illisible » ; `M/diagnostics.test.ts` › « facultatifs : ni Xcode ni AXe » | vert |
| 6 | la carte Journal suit le résumé | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/Diagnostics.test.tsx` › « la carte Journal suit le résumé, avant le premier groupe de vérifications » | vert |
| 7 | main.log et agents.log, « Afficher dans le Finder », puis le niveau | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/Diagnostics.test.tsx` › « Journal : main.log et agents.log, leur taille, « Afficher dans le Finder », puis le niveau » | vert |
| 8 | plus de chemin des journaux dans « Bobine » | unitaire-main | retirée | **oui, remplaçant créé** (2026-11-24) : `M/diagnostics.test.ts` › « groupe « Bobine » : version et dossier, plus le chemin des journaux (carte Journal, fiche 133) » | vert |
| 9 | l'icône du Finder montre main.log | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/Diagnostics.test.tsx` › « l’icône du Finder demande au main de montrer main.log » | vert |
| 10 | rapport copié : une ligne par vérification | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/Diagnostics.test.tsx` › « rapport copié : une ligne par vérification, avec sa marque » | vert |
| 11 | « Signaler un problème » : issue préremplie, version, rapport, ≤ 8 000 car. | doublon | retirée | `src/shared/issue-url.test.ts › gabarit bug.yml, version et rapport dans les champs du gabarit` et `› rapport trop long : coupé…` | vert |
| 12 | clic : ouvert dans le navigateur système, pas dans l'app | unitaire-main | reste | partiel : `src/main/ipc.test.ts › liens web (fiche 154) : adresse locale dans le navigateur intégré, le reste dans celui du Mac` | — |
| 13 | aucune conversation dans l'historique | unitaire-main | retirée | **oui, déjà couvert** (vérifié 2026-11-24) : `M/conversations/manager.test.ts` › « essaie l’agent hors conversation et supprime sa session d’essai » | vert |
| 14 | session d'essai supprimée chez l'agent | parcours | reste | parcours : vraie app nécessaire | — |
| 15 | Aide › Diagnostic… ouvre la page | parcours | reste | parcours : vraie app nécessaire | — |
| 16 | « Relancer » refait les vérifications | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/Diagnostics.test.tsx` › « « Relancer » refait les vérifications : en cours, puis finies » | vert |
| 17 | connexion requise : en erreur, avec les façons de se connecter | unitaire-main | retirée | `diagnostics.test.ts › blocages : dossier, connexion, licence, avec la marche à suivre` | vert |
| 18 | résumé : 1 problème | composant | retirée | `src/shared/diagnostics.test.ts › résumé et pastille d'un groupe` | vert |
| 19 | action « Réglages › Agents » : la page de l'agent, avec ses clés | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/Diagnostics.test.tsx` › « action « Réglages › Agents » d’un agent : la page de cet agent » ; `R/components/settings/SettingsPages.test.tsx` › « action « Réglages › Agents » : la page de l’agent, avec ses clés » | vert |
| 20 | essai de l'agent en cours (2 agents : conversation et essai) | parcours | reste | parcours : vraie app nécessaire | — |
| 21 | quitter pendant l'essai : aucun agent ne survit à l'app | parcours | reste | parcours : vraie app nécessaire | — |
| 22 | journal : Normal par défaut, réglable | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/Diagnostics.test.tsx` › « niveau du journal : Normal par défaut, réglable à chaud » | vert |
| 23 | Détaillé, à chaud : échanges ACP et appels MCP dans agents.log, sans contenu | parcours | reste | parcours : vraie app nécessaire | — |
| 24 | Trace : extraits du contenu (message, arguments des outils) | parcours | reste | parcours : vraie app nécessaire | — |
| 25 | main.log : agent lancé, tours, niveau changé | unitaire-main | reste | partiel : `agent-process.test.ts › journal Détaillé : … lancement et arrêt dans main.log` | — |
| 26 | Trace n'est pas enregistré (Détaillé l'est) | unitaire-main | retirée | `src/shared/preferences.test.ts › niveau du journal (fiche 080) : Normal ou Détaillé enregistrés, jamais Trace` | vert |
| 27 | relancée : de nouveau Détaillé, pas Trace | doublon | retirée | `preferences.test.ts › niveau du journal…jamais Trace` + `src/main/settings.test.ts › préférences lues avant que l'app soit prête…` | vert |
| 28 | BOBINE_LOG impose le niveau : réglage grisé, et dit pourquoi | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/Diagnostics.test.tsx` › « BOBINE_LOG impose le niveau : réglage grisé, et dit pourquoi » | vert |

### `export` — supprimer entièrement

5 vérifications : 5 retirées (dont 0 à confirmer), 0 creuse(s), 0 restent. Durée (clair + sombre) : 3 s → ≈ 0 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | export Markdown : fichier écrit | doublon | retirée | `parcours-outils`, étape 7 (export Markdown de toute la journée) | vert |
| 2 | export Markdown : une seule extension malgré la fenêtre | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/dialogs.test.ts › « Enregistrer sous » de l’export (fiches 043, 247 D14) › nom saisi avec son extension : la fenêtre de macOS la redouble, le main n’en garde qu’une` ; `src/main/ipc-agent.test.ts › IPC branché sur le vrai gestionnaire, contre l’agent factice › export Markdown et JSON par le canal : le fil réel écrit sur le disque, montré dans le Finder` | vert |
| 3 | export JSON : fichier `bobine-conversation` | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/ipc-agent.test.ts › IPC branché sur le vrai gestionnaire, contre l’agent factice › export Markdown et JSON par le canal : le fil réel écrit sur le disque, montré dans le Finder` | vert |
| 4 | export JSON : une seule extension | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/dialogs.test.ts › « Enregistrer sous » de l’export (fiches 043, 247 D14) › nom saisi avec son extension : la fenêtre de macOS la redouble, le main n’en garde qu’une` | vert |
| 5 | sauvegarde de l'historique : dossier avec `index.json` | doublon | retirée | `src/main/conversations/backup.test.ts › copie datée de tout le profil, sans clés d’API ni fichier temporaire, avec sa description` | vert |

### `filles-fusion` — réduire

14 vérifications : 10 retirées (dont 1 à confirmer), 0 creuse(s), 4 restent. Durée (clair + sombre) : 56 s → ≈ 20 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | trois travaux sur les lignes de leur carte : ni « Sous-tâches » ni compte rendu séparé | doublon | retirée | `src/renderer/src/components/thread/WorkGroup.test.tsx › « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé` | vert |
| 2 | trois filles, chacune dans son worktree | doublon | retirée | `e2e/suites/parcours-deleguer.mjs` étape 1 (« trois travaux finis, chacun dans son worktree ») | à confirmer |
| 3 | pied de carte : deux prêtes, recouvrement sur README.md, la troisième non commitée et dite | doublon | retirée | `SubtasksMerge.test.tsx › pied de carte : phrase d'état, « Fusionner les N »…` ; `src/main/conversations/children-merge.test.ts › recouvrement détecté…` et `› fille avec des modifications non commitées : exclue du plan, sautée si demandée` | vert |
| 4 | « Fusionner les 3 dans main », « Puis nettoyer » décoché par défaut | doublon | retirée | `SubtasksMerge.test.tsx › pied de carte : … « Puis nettoyer » en bascule` ; `parcours-deleguer.mjs` étape 3 | vert |
| 5 | fusion refusée d'avance : dossier principal non commité (fichiers) | doublon | retirée | `SubtasksMerge.test.tsx › dit pourquoi avec les fichiers ; pas de « Fusionner »…` ; `children-merge.test.ts › plan refusé avec les fichiers ; départ refusé ; rien n'avance` | vert |
| 6 | « Committer d'abord » : message rédigé par l'agent de la mère | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | en cours : celles d'avant fusionnées, une en conflit résolu par son travail, les suivantes en attente | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | pendant la fusion : modifications de la mère mises de côté, c'est dit | doublon | retirée | `SubtasksMerge.test.tsx › mise de côté dite pendant la fusion, puis à la fin…` ; `children-merge.test.ts › « Mettre de côté » : une mise de côté pour la chaîne…` | vert |
| 9 | fin : « … fusionnés … nettoyées … revenues » | doublon | retirée | `SubtasksMerge.test.tsx › finie : « 2 travaux fusionnés dans main en 12 s »…` et `› fin : modifications revenues` | vert |
| 10 | consigne de conflit partie au travail, avec sa provenance | doublon | retirée | `children-merge.test.ts › conflit sur la deuxième…` (vérifie `prompts[0].from` = merge) | vert |
| 11 | main a les trois filles, conflit résolu ; modifications de la mère revenues | parcours | reste | parcours : vraie app nécessaire | — |
| 12 | « Puis nettoyer » : worktrees et branches supprimés | doublon | retirée | `children-merge.test.ts › « Puis nettoyer » : filles fusionnées archivées, worktrees et branches supprimés` (vrai git) | vert |
| 13 | chaque ligne : « fusionné » seul | doublon | retirée | `WorkGroup.test.tsx › une colonne d'état : « fusionné » seul remplace « a répondu »…` | vert |
| 14 | après redémarrage : la carte dit toujours la fusion faite | parcours | reste | parcours : vraie app nécessaire | — |

### `filles-visibilite` — réduire

7 vérifications : 5 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 22 s → ≈ 10 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | préparation visible pendant la création du worktree (×3, boucle) | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | fille publiée à la fermeture du dialogue (×3, boucle) | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | section ouverte : fille visible sous sa mère pendant son premier tour | doublon | retirée | `Sidebar.test.tsx › nouvelle fille : visible dès la liste reçue, même sous le pointeur (diagnostic 149)` | vert |
| 4 | Récents replié : le lancement révèle immédiatement la fille | doublon | retirée | `Sidebar.test.tsx › une nouvelle fille révèle Récents replié` | vert |
| 5 | la nouvelle fille reste sous sa mère dans Récents | doublon | retirée | `Sidebar.test.tsx › une nouvelle fille révèle Récents replié` (`m ↳new`) | vert |
| 6 | dossier replié : le lancement révèle immédiatement la fille | doublon | retirée | `Sidebar.test.tsx › une nouvelle fille révèle son dossier et reste sous sa mère quand elle attend` | vert |
| 7 | les trois filles en cours restent sous leur mère | doublon | retirée | `Sidebar.test.tsx › sous sa mère, son état à droite ; plus d'icône git (fiche 131)` | vert |

### `fresh-start` — réduire

11 vérifications : 7 retirées (dont 0 à confirmer), 0 creuse(s), 4 restent. Durée (clair + sombre) : 20 s → ≈ 11 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | profil temporaire : la pastille dans la barre de titre | doublon | retirée | `src/renderer/src/components/settings/FreshStart.test.tsx › profil temporaire : pas de section, une pastille dans la barre de titre` ; `src/main/fresh-start.test.ts › profil temporaire : dossier neuf…` | vert |
| 2 | pastille : fiole seule dans un en-tête étroit, entière sinon | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 3 | dossier de données dans les fichiers temporaires | doublon | retirée | `fresh-start.test.ts › profil temporaire : dossier neuf dans les fichiers temporaires, supprimé à la fermeture` | vert |
| 4 | profil temporaire : pas de « Recommencer à neuf » dans Données | doublon | retirée | `FreshStart.test.tsx › profil temporaire : pas de section…` | vert |
| 5 | fermée, la Bobine temporaire ne laisse rien | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | confirmation : les conversations comptées, avec leur taille | doublon | retirée | `src/main/reset.test.ts › tailles par groupe, nombre de conversations, dossiers hors du dossier de données` ; `FreshStart.test.tsx › « Réinitialiser… » : ce qui part, avec les tailles…` | vert |
| 7 | confirmation : conversations, réglages, consommation, navigateur, le reste | doublon | retirée | `FreshStart.test.tsx › « Réinitialiser… » : ce qui part…` ; `reset.test.ts › chaque entrée du dossier de données dans son groupe` | vert |
| 8 | app non installée, dossier imposé : ni désinstallation, ni trousseau, « Tout effacer et fermer » | doublon | retirée | `FreshStart.test.tsx › app non installée (développement) : pas de case, Bobine se ferme sans relance` | vert |
| 9 | « Garder » : rien n'est effacé | doublon | retirée | `FreshStart.test.tsx › « Réinitialiser… » : … « Garder » n'efface rien` | vert |
| 10 | confirmé : Bobine quitte, son dossier part dans un dossier daté de la corbeille | parcours | reste | parcours : vraie app nécessaire | — |
| 11 | corbeille : dossier de données et LISEZ-MOI qui dit d'où il vient | parcours | reste | parcours : vraie app nécessaire | — |

### `gitlab` — réduire

16 vérifications : 10 retirées (dont 0 à confirmer), 0 creuse(s), 6 restent. Durée (clair + sombre) : 18 s → ≈ 10 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | waitFor bouton « Ouvrir une MR » | composant | reste | partiel : `src/main/changes/forge.test.ts › configuration de glab et de gh lue sans rien lancer` ; `src/main/changes/worktree-cycle-forge.test.ts › branche poussée, MR vers la base…` (côté main, pas le libellé) | — |
| 2 | waitFor raison `notLogged_mr` sous le bouton | composant | reste | partiel : `src/renderer/src/components/panel/worktree-outcome.test.ts › grisé avec la raison quand l’utilisateur peut y remédier` ; `worktree-cycle-forge.test.ts › glab absent, non connecté, révoqué, injoignable…` | — |
| 3 | « Ouvrir une MR » désactivé (glab non connecté) | composant | reste | partiel : `worktree-outcome.test.ts › grisé avec la raison quand l’utilisateur peut y remédier` | — |
| 4 | une seule issue sous les boutons (non connecté) | doublon | retirée | `src/renderer/src/components/panel/worktree-outcome.test.ts › gardée tant que le worktree, l’état de la forge et « Actualiser » sont les mêmes` ; `WorktreeBarOutcome.test.tsx › issue unique…` | vert |
| 5 | formulaire : « Pousser et ouvrir la MR » | composant | reste | aucun remplaçant écrit | — |
| 6 | une seule issue (formulaire) | doublon | retirée | `worktree-outcome.test.ts › une seule issue dans la barre du worktree…` | vert |
| 7 | MR ouverte : branche poussée, MR vers main, lien, pas de carte de suivi | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | une seule issue (MR ouverte) | doublon | retirée | `worktree-outcome.test.ts › une seule issue…` | vert |
| 9 | waitFor « Pousser vers la MR » après commit au terminal + Actualiser | doublon | retirée | `e2e/suites/pr-ci.mjs › « Actualiser » : le commit fait dans un terminal est vu…` ; `src/renderer/src/useWorktreeCycle.test.ts › « Actualiser » demande au main de relire aussi gh (D7)` | vert |
| 10 | une seule issue (pousser) | doublon | retirée | `worktree-outcome.test.ts › une seule issue…` | vert |
| 11 | « Pousser vers la MR » : branche poussée, MR existante retrouvée | doublon | retirée | `worktree-cycle-forge.test.ts › branche poussée, MR vers la base…, MR retrouvée, « Pousser vers la MR »` | vert |
| 12 | hôte injoignable : message clair, pas la sortie brute | doublon | retirée | `worktree-cycle-forge.test.ts › glab absent, non connecté, révoqué, injoignable, certificat…` ; `src/main/changes/forge.test.ts › ligne utile de glab, sans cadre ni fichier de reprise` | vert |
| 13 | une seule issue (injoignable) | doublon | retirée | `worktree-outcome.test.ts › une seule issue…` | vert |
| 14 | waitFor raison `unknownForge` avec l'hôte | composant | reste | partiel : `worktree-cycle-forge.test.ts › hôte inconnu : GitHub comme avant… « Actualiser » le dit inconnu` | — |
| 15 | forge inconnue : pas de bouton | doublon | retirée | `worktree-outcome.test.ts › forge inconnue : pas de bouton, la raison seulement avec des commits à proposer` | vert |
| 16 | après « Actualiser » : plus d'erreur ni de note d'avant | doublon | retirée | `worktree-outcome.test.ts › effacée par « Actualiser » et par un autre worktree, quelle que soit sa source` | vert |

### `history` — réduire

17 vérifications : 13 retirées (dont 0 à confirmer), 0 creuse(s), 4 restent. Durée (clair + sombre) : 21 s → ≈ 9 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | infobulle : titre complet, identique survol/clavier, une seule | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : en deux moitiés : `src/renderer/src/components/sidebar/Sidebar.test.tsx` (`rowTip` : au clavier, une seule infobulle, titre complet) + `src/renderer/src/title-tooltips.test.ts` › remplace l’infobulle native au survol, puis rend le title ; l’égalité survol/clavier au pixel reste à la capture | vert |
| 2 | recherche dans le contenu : bonne conversation, extrait, mots surlignés | doublon | retirée | `src/shared/conversation-search.test.ts › extrait autour du premier mot, mots surlignés…` ; `src/main/conversations/content-search.test.ts › fils sur le disque lus une fois…` ; `e2e/suites/parcours-outils.mjs` étape 6 | vert |
| 3 | ⌘K → ⌘F : recherche reprise, premier résultat surligné, focus | composant | reste | remplaçant partiel : (passage réel ⌘K → ⌘F : App, e2e) | — |
| 4 | « PÔINTE » trouve « pointe » (waitFor) | doublon | retirée | `src/renderer/src/thread-find.test.ts › sans casse ni accents, positions dans le texte d’origine` | vert |
| 5 | Échap : barre fermée, surlignage retiré | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/useThreadFind.test.tsx` › Échap : barre fermée, surlignage retiré (history n° 5) | vert |
| 6 | Édition › Rechercher… (⌘F) rouvre la barre sur la dernière recherche | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | plusieurs résultats : Entrée suivant, ⇧Entrée précédent | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/useThreadFind.test.tsx` › plusieurs résultats : Entrée suivant, ⇧Entrée précédent, en boucle (history n° 7) | vert |
| 8 | autre conversation : zone de saisie vide | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › brouillon par conversation : vide ailleurs, retrouvé en revenant, texte collé compris (history n° 8, 9, 10) | vert |
| 9 | brouillon retrouvé en revenant | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › brouillon par conversation : vide ailleurs, retrouvé en revenant, texte collé compris (history n° 8, 9, 10) | vert |
| 10 | brouillon : la pièce jointe (texte collé) revient | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › brouillon par conversation : vide ailleurs, retrouvé en revenant, texte collé compris (history n° 8, 9, 10) | vert |
| 11 | titres au bord, « … » dans la ligne, survol ≠ sélection | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 12 | clic droit : le menu de ⋯ au pointeur, aucun mot sélectionné | composant | reste | partiel : `src/renderer/src/components/sidebar/Sidebar.test.tsx › clic droit sur une ligne : le menu de ⋯, mêmes éléments dans le même ordre, sans menu natif (fiche 276)` — **Reste e2e ou capture (lot dialogues)** : e2e/capture pour la position : le menu au pointeur se place par Radix sur la mise en page réelle ; « aucun mot sélectionné » et mêmes éléments : `src/renderer/src/components/sidebar/Sidebar.test.tsx` › clic droit sur une ligne… | — |
| 13 | conversation épinglée, en tête (waitFor) | doublon | retirée | `Sidebar.test.tsx › dans l’ordre : Épinglées, Récents, Archivées…` ; `e2e/suites/restart.mjs` (épinglage) | vert |
| 14 | regroupement par projet : nom, chevron, ni icône ni compteur | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/sidebar/Sidebar.test.tsx` › regroupement par dossier : le nom et un chevron, ni icône de dossier ni compteur (history n° 14) | vert |
| 15 | un dossier se replie et se déplie | doublon | retirée | `Sidebar.test.tsx › un dossier se replie (seul son nom reste), et le reste au redémarrage` | vert |
| 16 | confirmation : corbeille, « aussi chez l’agent » jamais coché | doublon | retirée | `src/renderer/src/components/sidebar/DeleteDialog.test.tsx › « aussi chez l’agent » proposé seulement s’il sait le faire, jamais coché d’office` | vert |
| 17 | conversation supprimée (waitFor) | doublon | retirée | `e2e/suites/parcours-deleguer.mjs` étapes 5–6 ; `src/main/conversations/trash.test.ts` | vert |

### `launch` — réduire

5 vérifications : 1 retirées (dont 0 à confirmer), 0 creuse(s), 4 restent. Durée (clair + sombre) : 7 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | commande montrée avant le lancement | doublon | retirée | `src/main/preview/preview-tools.test.ts › commande montrée une fois, serveur démarré puis ouvert dans le navigateur` | vert |
| 2 | serveur démarré, journal lu, page ouverte et lue par l'agent | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | navigateur sur l'app ; serveur « web » en marche sous la barre d'adresse | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | journal du serveur visible dans l'onglet (waitFor) | composant | reste | partiel : `preview-tools.test.ts › journaux et arrêt` | — |
| 5 | serveur arrêté depuis l'onglet (waitFor) | parcours | reste | parcours : vraie app nécessaire | — |

### `links` — réduire

17 vérifications : 6 retirées (dont 0 à confirmer), 0 creuse(s), 11 restent. Durée (clair + sombre) : 15 s → ≈ 12 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | 6 liens de fichiers reconnus (le lien web reste web) | composant | reste | partiel : `src/shared/file-links.test.ts › chemins relatifs, absolus, file://, lignes citées` ; `› liens web, ancres, courriels : pas des fichiers` | — |
| 2 | code vers fichier inexistant : pas un lien ; existant : un lien | composant | reste | partiel : `src/main/ipc.test.ts › files:existing (fiche 272, rc.3)…` | — |
| 3 | .md du dossier : aperçu dans le panneau, rien d'ouvert ailleurs | doublon | retirée | `src/renderer/src/useFileLinks.test.ts › un .md s’ouvre en aperçu dans le panneau…` ; `src/main/files/file-links.test.ts › .md du dossier : aperçu, avec son dossier comme base de ses liens` | vert |
| 4 | lien relatif dans l'aperçu : depuis le dossier du document | doublon | retirée | `file-links.test.ts › .md du dossier : aperçu, avec son dossier comme base…` ; `useFileLinks.test.ts › les liens du document en aperçu s’ouvrent dans sa conversation` | vert |
| 5 | code : app par défaut | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | chemin sans dossier (`liste.js:2`) : app par défaut | doublon | retirée | `src/shared/file-links.test.ts › fichier sans dossier suivi d’une ligne ; jamais une adresse hôte:port` | vert |
| 7 | fichier absent cliqué deux fois : un seul avis, pied du tour reste | composant | reste | partiel : `useFileLinks.test.ts › fichier absent : avertissement…` | — |
| 8 | dossier : montré dans le Finder | doublon | retirée | `file-links.test.ts › autre fichier du dossier : app par défaut ; dossier, ⌥-clic : Finder` | vert |
| 9 | exécutable : Finder, jamais ouvert | doublon | retirée | `file-links.test.ts › jamais rien d’exécuté : exécutable, hors du dossier, lien symbolique…` | vert |
| 10 | le fil dit pourquoi l'exécutable n'a pas été ouvert | composant | reste | partiel : `useFileLinks.test.ts › … montré dans le Finder hors du dossier : information` | — |
| 11 | ⌥-clic : Finder | composant | reste | partiel : `file-links.test.ts › … dossier, ⌥-clic : Finder` (main) | — |
| 12 | aperçu fermé : l'onglet disparaît | doublon | retirée | `src/renderer/src/usePanel.test.ts › document en aperçu : onglet ouvert, document remplacé, fermé par ✕` | vert |
| 13 | page HTML : navigateur intégré, style, module, fetch, .env refusé | parcours | reste | parcours : vraie app nécessaire | — |
| 14 | page HTML : rien d'ouvert dans une autre app | parcours | reste | parcours : vraie app nécessaire | — |
| 15 | adresse locale : navigateur intégré, rien dans le navigateur du Mac | composant | reste | partiel : `src/shared/file-links.test.ts › adresses du poste : navigateur intégré` | — |
| 16 | autre adresse : navigateur du Mac | composant | reste | partiel : `file-links.test.ts (shared) › autres http(s) : navigateur du Mac…` | — |
| 17 | ⌥-clic sur une adresse locale : navigateur du Mac | composant | reste | aucun remplaçant écrit | — |

### `memoire` — réduire

17 vérifications : 16 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 26 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | waitFor carte proposée après le tour | doublon | retirée | `e2e/suites/parcours-reglages.mjs` étape « la mémoire : retenir, puis la retrouver ailleurs » ; `src/main/memory/memory-flow.test.ts › propose, le tour continue…` | vert |
| 2 | carte : Retenir en avant, aucun focus pris | doublon | retirée | `src/renderer/src/components/thread/MemoryProposalCard.test.tsx › carte ordinaire : texte entier, portée, Retenir en avant, aucun focus pris` | vert |
| 3 | pastille neutre « Mémoire » sur la conversation | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/sidebar/Sidebar.test.tsx` › proposition de mémoire en attente : pastille « Mémoire » sur la ligne, retirée une fois décidée (memoire n° 3, 6) | vert |
| 4 | pas de type sur la carte, seulement la portée | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : `src/renderer/src/components/thread/MemoryProposalCard.test.tsx` › carte ordinaire : texte entier, portée, Retenir en avant, aucun focus pris (« Préférence » absent, portée affichée) | vert |
| 5 | carte de l'outil : « Propose de retenir : … » | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : src/shared/app-tools.test.ts › remember, recall, forget : ce que fait l’appel, groupe mémoire (« Propose de retenir : … ») | vert |
| 6 | « Non » : ligne « Non retenu », pastille retirée | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/MemoryProposalCard.test.tsx` › « Non » : décision refusée transmise ; décidée, une ligne « Non retenu » sans « Voir » + `src/renderer/src/components/sidebar/Sidebar.test.tsx` › proposition de mémoire en attente : pastille… retirée une fois décidée | vert |
| 7 | issue dite au message suivant, pas de carte | doublon | retirée | `memory-tools.test.ts › « Retenir » : écrit, carte « kept », issue jointe une seule fois au message suivant` ; `memory-flow.test.ts › propose… ; issue au message suivant…` | vert |
| 8 | waitFor « Retenu » après « Retenir » | doublon | retirée | `parcours-reglages.mjs` étape « la mémoire : retenir… » ; `memory-tools.test.ts › « Retenir » : écrit, carte « kept »…` | vert |
| 9 | contenu externe : bandeau, commande surlignée, corps déplié, aucun bouton en avant | doublon | retirée | `MemoryProposalCard.test.tsx › contenu externe avec commande : un bandeau, commande surlignée, aucun bouton en avant` ; `memory-tools.test.ts › contenu externe dans le tour : proposition marquée…` | vert |
| 10 | Entrée dans la saisie : message envoyé, la carte attend | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : `src/renderer/src/components/thread/MemoryProposalCard.test.tsx` › … aucun focus pris + `src/renderer/src/components/composer/Composer.test.tsx` › Entrée envoie le message, Maj+Entrée non (les deux ensemble dans l'app : parcours-reglages) | vert |
| 11 | conversation suivante : index reçu | doublon | retirée | `parcours-reglages.mjs › retenu : la conversation suivante (autre agent) le reçoit` ; `memory-flow.test.ts` | vert |
| 12 | onglet Session : ligne « Mémoire » (waitFor) | composant | reste | aucun remplaçant écrit | — |
| 13 | modification : un secret est refusé | doublon | retirée | `src/main/memory/memory-ipc.test.ts › modifier : mêmes validations que l’outil, secret refusé…` ; `src/renderer/src/components/settings/MemoryEntryRow.test.tsx › « Garder » refusé pour un secret…` | vert |
| 14 | souvenir supprimé après confirmation | doublon | retirée | `parcours-reglages.mjs › souvenir oublié` | vert |
| 15 | fichier modifié hors de Bobine : signalé, puis gardé | doublon | retirée | `memory-tools.test.ts › fichier écrit hors de Bobine : ni index ni recall, jusqu’à « Garder… »` ; `src/main/memory/store.test.ts › écrit par Bobine : validé ; modifié à la main : plus validé…` ; `MemoryEntryRow.test.tsx` | vert |
| 16 | famille « Mémoire » sans interrupteur, avec le chemin du réglage | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/McpSettings.test.tsx` › « « Mémoire » : son état et le chemin du réglage, sans interrupteur ; le lien ouvre la section » | vert |
| 17 | mémoire coupée : pas d'outil | doublon | retirée | `memory-flow.test.ts › mémoire coupée : ni outil ni index pour les sessions suivantes` ; `memory-tools.test.ts › mémoire coupée : module absent…` | vert |

### `network` — réduire

6 vérifications : 5 retirées (dont 1 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 24 s → ≈ 8 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | bandeau « Connexion perdue » à la place de l'indicateur, Stop proposé | composant | reste | partiel : `TurnRetryBanner.test.tsx › décompte la prochaine tentative, et « Réessayer maintenant »` | — |
| 2 | décompte de la deuxième tentative | doublon | retirée | `TurnRetryBanner.test.tsx › décompte la prochaine tentative…` ; `src/main/agent/turn-retry.test.ts › cinq tentatives après 2, 4, 8, 16 puis 32 s, puis plus rien` | vert |
| 3 | réseau revenu : le message part, sans nouvelle bulle ni erreur | parcours | retirée | **parcours-pannes › étape 10** — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 4 | cinq échecs : « Connexion impossible », seul « Réessayer » | doublon | retirée | `TurnRetryBanner.test.tsx › limite de débit, puis tentatives épuisées : « Réessayer » seul` | vert |
| 5 | cinq échecs : une seule bulle, un seul avis d'erreur | doublon | retirée | `agent-host-retry.test.ts › cinq échecs : « Connexion impossible », une seule erreur, puis « Réessayer » repart` | vert |
| 6 | Échap pendant l'attente : plus de tentative, tour arrêté | doublon | retirée | `turn-retry.test.ts › Échap ou Stop annule les tentatives` ; `src/renderer/src/composer-keys.test.ts › Échap arrête la réponse…` | vert |

### `onboarding` — réduire

43 vérifications : 27 retirées (dont 4 à confirmer), 0 creuse(s), 16 restent. Durée (clair + sombre) : 76 s → ≈ 31 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | accueil : bienvenue, agent trouvé présélectionné | doublon | retirée | `src/renderer/src/components/onboarding/Onboarding.test.tsx › agent trouvé présélectionné, introuvable grisé ; pas de « Passer cette étape »` | vert |
| 2 | agent introuvable grisé, avec le conseil du profil | doublon | retirée | même test (`Onboarding.test.tsx › agent trouvé présélectionné…`) | vert |
| 3 | étape Agent : pas de « Passer cette étape » | doublon | retirée | comme n° 2 : même test (`Onboarding.test.tsx › agent trouvé présélectionné…`) | vert |
| 4 | connexion : « {agent} est prêt », sans message au modèle | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/onboarding/Onboarding.test.tsx` › connexion vérifiée : « Agent factice est prêt », le focus sur « Continuer » (onboarding n° 4, 5) (aucun message au modèle : `src/main/onboarding/agent-readiness.test.ts`) | vert |
| 5 | focus sur le bouton principal du nouvel état | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/onboarding/Onboarding.test.tsx` › connexion vérifiée : « Agent factice est prêt », le focus sur « Continuer » (onboarding n° 4, 5) | vert |
| 6 | barre latérale : l'agent choisi | parcours | retirée | **parcours-premier-lancement › étape 2** — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 7 | essai : le message à envoyer montré tel quel | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/onboarding/Onboarding.test.tsx` › essai : le message qui partira, montré tel quel (onboarding n° 7) | vert |
| 8 | essai : la réponse de l'agent | parcours | retirée | **parcours-premier-lancement › étape 4** — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 9 | essai réussi : « Commencer » a le focus | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/onboarding/Onboarding.test.tsx` › essai réussi : « Commencer » a le focus, et finit l’accueil (onboarding n° 9) | vert |
| 10 | première conversation : « Lance les tests » avec pnpm | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/Welcome.test.tsx` › première conversation : « Lance les tests (pnpm test) » à la place de la suggestion générique (onboarding n° 10) | vert |
| 11 | première conversation : liens vers l'aide | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/Welcome.test.tsx` › première conversation : liens vers « Premiers pas » et « Autorisations » de l’aide (onboarding n° 11) | vert |
| 12 | la suggestion remplit la saisie sans l'envoyer | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/Welcome.test.tsx` › une suggestion remplit la saisie, sans rien envoyer (onboarding n° 12) | vert |
| 13 | marque « fini » enregistrée | unitaire-main | reste | partiel : `onboarding-state.test.ts › fini ou passé : posé une fois, jamais défait` ; `Onboarding.test.tsx › « Passer l'accueil » : marqué passé` (côté skipped seulement) | — |
| 14 | relancée : l'accueil ne revient pas | parcours | retirée | **parcours-premier-lancement › étape 8** — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 15 | accueil ouvert, rien choisi : aucun agent de conversation lancé | parcours | reste | parcours : vraie app nécessaire | — |
| 16 | accueil ouvert, rien choisi : aucun quota lu | unitaire-main | reste | partiel : `quota-setup.test.ts › agent installé mais pas utilisé : son quota n'est pas lu au lancement` | — |
| 17 | agent choisi et essayé, pas de dossier : l'agent attend | parcours | reste | parcours : vraie app nécessaire | — |
| 18 | dossier choisi : l'agent démarre, dans ce dossier | parcours | retirée | **parcours-premier-lancement › étape 5** (dossier lu dans le menu du dossier, pas dans `ps`) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 19 | aucun agent : sous-titre et conseils des profils | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/onboarding/Onboarding.test.tsx` › aucun agent : le sous-titre, et ce que chaque profil dit d’installer, sans alerte (onboarding n° 19) | vert |
| 20 | « Chercher à nouveau » sans résultat | doublon | retirée | `Onboarding.test.tsx › aucun agent : « Chercher à nouveau » sans résultat le dit` | vert |
| 21 | explorer sans agent : marqué passé | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/onboarding/Onboarding.test.tsx` › aucun agent : « Explorer » marque l’accueil passé (onboarding n° 21) | vert |
| 22 | connexion à faire : la carte, avec la commande du profil | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/onboarding/Onboarding.test.tsx` › connexion à faire : la carte, avec la commande déclarée par le profil (onboarding n° 22) | vert |
| 23 | 900 px, terminal ouvert : étapes en numéros, carte ≥ 360 px | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 24 | connecté depuis le terminal : « Réessayer », puis prêt | parcours | reste | parcours : vraie app nécessaire | — |
| 25 | vérification simple : pas de « rien ne se passe ici ? » | doublon | retirée | `Onboarding.test.tsx › SSO qui ne revient pas (fiche 207)…` | vert |
| 26 | attente du navigateur : « waitBrowser » | doublon | retirée | comme n° 25 : `Onboarding.test.tsx › SSO qui ne revient pas (fiche 207)…` | vert |
| 27 | « Réessayer » : nouvelle vérification sans connexion, prêt | doublon | retirée | comme n° 26 : comme n° 25 : `Onboarding.test.tsx › SSO qui ne revient pas (fiche 207)…` | vert |
| 28 | l'agent resté en attente du navigateur est arrêté | parcours | reste | parcours : vraie app nécessaire | — |
| 29 | dossier d'essai créé dans le dossier prévu | unitaire-main | reste | partiel : `trial-folder.test.ts › créé avec son parent, toujours neuf…` | — |
| 30 | connexion expirée à l'essai : carte « Connexion expirée », pas l'erreur brute | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/onboarding/Onboarding.test.tsx` › connexion expirée pendant l’essai : la carte « Connexion expirée », pas l’erreur brute (onboarding n° 30) | vert |
| 31 | commande du profil dans le dossier réservé, pas dans le projet | parcours | reste | parcours : vraie app nécessaire | — |
| 32 | reconnecté : « Réessayer » relance l'essai, l'agent répond | parcours | reste | parcours : vraie app nécessaire | — |
| 33 | pendant l'essai : un agent de plus | parcours | reste | parcours : vraie app nécessaire | — |
| 34 | Échap pendant l'essai : annulé | doublon | retirée | `Onboarding.test.tsx › Continuer : … Échap annule, ne passe pas` | vert |
| 35 | aucun agent d'essai laissé derrière | parcours | reste | parcours : vraie app nécessaire | — |
| 36 | rien écrit dans le dossier pendant l'essai | doublon | retirée | `agent-readiness.test.ts › session d'essai toujours dans un dossier jetable de l'app, supprimé ; jamais le dossier de lancement` | vert |
| 37 | fenêtre fermée pendant l'essai : son agent arrêté | parcours | reste | parcours : vraie app nécessaire | — |
| 38 | essai en cours : son agent (Cmd+Q) | doublon | reste | partiel : comme n° 33 : partiel : `agent-readiness.test.ts › répond : …agent arrêté` | — |
| 39 | Cmd+Q pendant l'essai : aucun agent restant | parcours | reste | parcours : vraie app nécessaire | — |
| 40 | plantage : détails repliés, « Réessayer » a le focus | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/onboarding/Onboarding.test.tsx` › agent qui plante : détails repliés, « Réessayer » a le focus (onboarding n° 40) | vert |
| 41 | essai « comme Bob » : coût lu dans la base de l'agent | doublon | retirée | `agent-readiness.test.ts › agent « comme Bob » (coût dans sa base, rien par ACP) : lu avant la suppression, montré et rapporté` ; formatage : `Onboarding.test.tsx › essai répondu par un autre modèle…` | vert |
| 42 | « Mon activité » : tour d'essai et coût gardés | unitaire-main | reste | partiel : `onboarding.test.ts › tour d'essai : une ligne du journal de consommation, sur la conversation de l'accueil` | — |
| 43 | session d'essai supprimée de la base de l'agent | doublon | retirée | `agent-readiness.test.ts › répond : … session d'essai supprimée, agent arrêté` | vert |

### `panel` — réduire

25 vérifications : 20 retirées (dont 0 à confirmer), 0 creuse(s), 5 restent. Durée (clair + sombre) : 23 s → ≈ 9 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | panneau fermé au départ | doublon | retirée | `src/renderer/src/usePanel.test.ts › par défaut : fermé, sur « Session », 320 px…` | vert |
| 2 | ouvert à la main : sur « Session » | doublon | retirée | `usePanel.test.ts › par défaut : fermé, sur « Session »…` | vert |
| 3 | « Tâches » choisi dans « + » : pas encore de tâches | composant | retirée | oui : `src/renderer/src/components/panel/SidePanel.test.tsx › onglet « Tâches » (fiche 035) › pas encore de liste de tâches : l’état vide le dit` | vert |
| 4 | en-tête : progression du plan (3 / 3) | doublon | reste | doublon de la suite e2e `pinned-plan`, elle-même réduite ou supprimée | — |
| 5 | onglet Tâches : dernier plan avec sa progression | composant | retirée | oui : `src/renderer/src/components/panel/SidePanel.test.tsx › onglet « Tâches » (fiche 035) › dernier plan avec sa progression : 3 tâches faites sur 3` | vert |
| 6 | 320 px par défaut, largeur non enregistrée | doublon | retirée | `src/renderer/src/panel-width.test.ts › 320 px par défaut…` ; `› enregistrée seulement si elle a été tirée à la main` | vert |
| 7 | panneau redimensionné à la souris | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | largeur tirée : enregistrée (customWidth) | doublon | retirée | `usePanel.test.ts › tirée à la main : retenue…` | vert |
| 9 | onglets nommés : « Session » puis « Tâches 3/3 » | composant | retirée | oui : `src/renderer/src/components/panel/SidePanel.test.tsx › en-tête du panneau (fiches 082, 185, 226) › onglets nommés dans l’ordre donné, avec leur compte (« 3/3 », « 12 »)` (le choix des onglets : `panel-tabs.test.ts`) | vert |
| 10 | menu « + » : les autres outils (simulateur selon la plateforme) | doublon | retirée | `panel-tabs.test.ts › outil absent de la plateforme (fiche 145)…` ; `› utilisés, actif, ouverts…` | vert |
| 11 | outil choisi dans « + » : onglet à droite, Tâches ne bouge pas | doublon | retirée | `panel-tabs.test.ts › onglet qui apparaît (fiche 154) : à droite, les autres ne bougent plus` | vert |
| 12 | agrandi : à la place de la conversation, barre latérale reste, fil inert | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 13 | agrandi : la barre de la conversation dessous ne déplace pas la fenêtre | parcours | reste | parcours : vraie app nécessaire | — |
| 14 | Affichage › Agrandir le panneau : réduit, largeur d'avant | parcours | reste | parcours : vraie app nécessaire | — |
| 15 | poignée : infobulle « glisser · double-clic » | composant | retirée | oui : `src/renderer/src/components/panel/SidePanel.test.tsx › en-tête du panneau (fiches 082, 185, 226) › poignée : infobulle « glisser · double-clic », double-clic : largeur par défaut` | vert |
| 16 | double-clic sur la poignée : 320 px, plus rien d'enregistré | doublon | retirée | `usePanel.test.ts › double-clic sur le bord : retour au défaut, plus rien d’enregistré` | vert |
| 17 | agrandi sans barre latérale : bouton pour la rouvrir, place des feux | composant | retirée | oui : `src/renderer/src/components/panel/SidePanel.test.tsx › en-tête du panneau (fiches 082, 185, 226) › agrandi sans barre latérale : bouton pour la rouvrir, place gardée pour les feux` ; `src/renderer/src/components/panel/SidePanel.test.tsx › en-tête du panneau (fiches 082, 185, 226) › barre latérale visible : ni bouton, ni place pour les feux` | vert |
| 18 | agrandi : « Attend votre réponse » pendant la demande | composant | retirée | oui : `src/renderer/src/components/panel/SidePanel.test.tsx › en-tête du panneau (fiches 082, 185, 226) › agrandi : « Attend votre réponse » ; un clic revient à la conversation` ; `src/renderer/src/components/panel/SidePanel.test.tsx › en-tête du panneau (fiches 082, 185, 226) › l’état de l’agent ne s’affiche qu’agrandi (la conversation est alors cachée)` | vert |
| 19 | clic sur l'état de l'agent : retour au fil, demande là | composant | retirée | oui : `src/renderer/src/components/panel/SidePanel.test.tsx › en-tête du panneau (fiches 082, 185, 226) › agrandi : « Attend votre réponse » ; un clic revient à la conversation` (le retour au fil lui-même : `usePanel.test.ts`) | vert |
| 20 | ✕ sur l'onglet affiché : il disparaît, le voisin s'affiche | doublon | retirée | `usePanel.test.ts › ✕ : l’onglet disparaît, le voisin s’affiche, et c’est mémorisé` | vert |
| 21 | onglet fermé : rouvert par « + », il revient à droite | doublon | retirée | `panel-tabs.test.ts › onglet fermé : caché même si l’outil a servi…` ; `› onglet qui apparaît… à droite` | vert |
| 22 | clic molette sur un onglet : il se ferme | composant | retirée | oui : `src/renderer/src/components/panel/SidePanel.test.tsx › en-tête du panneau (fiches 082, 185, 226) › clic molette sur un onglet : il se ferme ; clic droit : non` | vert |
| 23 | dernier onglet fermé : le panneau se ferme | doublon | retirée | `usePanel.test.ts › le dernier onglet fermé ferme le panneau…` | vert |
| 24 | panneau rouvert : l'onglet fermé ne revient pas, retenu | doublon | retirée | `panel-tabs.test.ts › onglets fermés gardés d’un lancement à l’autre…` | vert |
| 25 | nouvelle conversation : le panneau se réduit | doublon | retirée | `usePanel.test.ts › réduit en changeant de conversation` | vert |

### `parcours-deleguer` — garder (journée type)

11 vérifications : 0 retirées (dont 0 à confirmer), 0 creuse(s), 11 restent. Durée (clair + sombre) : 76 s → ≈ 76 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | trois travaux finis, chacun dans son worktree ; la mère reste affichée | parcours | reste | journée type : reste entière | — |
| 2 | le travail répond dans sa conversation, lien vers la mère | parcours | reste | journée type : reste entière | — |
| 3 | retour à la mère : la ligne dit qu'il a répondu (waitFor) | parcours | reste | journée type : reste entière | — |
| 4 | « Fusionner les 3 dans main » proposé (waitFor) | parcours | reste | journée type : reste entière | — |
| 5 | main a les trois travaux, conflit résolu, dossier propre | parcours | reste | journée type : reste entière | — |
| 6 | travail supprimé : quitte la barre latérale, la mère reste affichée | parcours | reste | journée type : reste entière | — |
| 7 | mère et travaux à la corbeille | parcours | reste | journée type : reste entière | — |
| 8 | restaurée : de retour dans la barre latérale | parcours | reste | journée type : reste entière | — |
| 9 | mère restaurée : son fil, et l'agent répond | parcours | reste | journée type : reste entière | — |
| 10 | app quittée (check(true)) | parcours | reste | journée type : reste entière | — |
| 11 | après relance : la mère restaurée garde son fil et répond | parcours | reste | journée type : reste entière | — |

### `parcours-outils` — garder (journée type)

9 vérifications : 0 retirées (dont 0 à confirmer), 0 creuse(s), 9 restent. Durée (clair + sombre) : 79 s → ≈ 79 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | ⌃` : terminal ouvert dans le dossier, commande lancée à la main | parcours | reste | journée type : reste entière | — |
| 2 | commande montrée puis lancée dans un onglet de l'agent, qui lit sa sortie | parcours | reste | journée type : reste entière | — |
| 3 | la page est affichée dans le navigateur intégré | parcours | reste | journée type : reste entière | — |
| 4 | waitFor barre des remarques « 1 remarque » | composant | reste | journée type : reste entière | — |
| 5 | remarque envoyée avec sa capture ; le clic n'a pas atteint la page | parcours | reste | journée type : reste entière | — |
| 6 | retour à la première : son terminal et son navigateur sont là | parcours | reste | journée type : reste entière | — |
| 7 | fenêtre rapide : nouvelle conversation dans la fenêtre principale, réponse | parcours | reste | journée type : reste entière | — |
| 8 | recherche : une seule conversation trouvée, ouverte | parcours | reste | journée type : reste entière | — |
| 9 | export : tout le fil de la journée | parcours | reste | journée type : reste entière | — |

### `pendant-tour` — réduire

9 vérifications : 6 retirées (dont 0 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 0 s → ≈ 0 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | commande sans sortie : « Aucune sortie depuis 1 min » sur sa carte | doublon | retirée | `src/renderer/src/components/thread/TurnGuards.test.tsx › minutes à signaler au-delà du seuil…` ; `› « Aucune sortie depuis 3 min » et « Interrompre »…` | vert |
| 2 | Interrompre : commande interrompue, avis disparu | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | contexte à 85 % : puce et « Compacter » en orange (jeton warn) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 4 | Compacter : conversation résumée, bouton disparu | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | plafond franchi en plein outil : il finit, le suivant ne part pas, carte | doublon | retirée | `src/main/conversations/cost-cap.test.ts › coût qui monte : attend la fin de l’outil en cours, interrompt, puis « Continuer » relance` (agent factice réel) | vert |
| 6 | Continuer : plafond relevé à 2 $, agent relancé | doublon | retirée | `cost-cap.test.ts › coût qui monte… « Continuer » relance` ; `TurnGuards.test.tsx › une fois répondue : le plafond relevé, plus de boutons` | vert |
| 7 | détail : « Aucun » plafond pour la conversation | doublon | retirée | `UsageGuards.test.tsx › plafond de la conversation : celui des réglages, une valeur propre, « Aucun »` ; `cost-cap.test.ts › « Aucun » pour la conversation…` | vert |
| 8 | réglages : plafond activé, 1 dans l'unité de l'agent | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « plafond par conversation : activé, 1 en montant, le champ suit les préférences » | vert |
| 9 | sans coût connu : plafond de 1 000 jetons, carte en fin de tour, sans interruption | doublon | retirée | `cost-cap.test.ts › sans coût connu : plafond en jetons, carte à la fin du tour, sans interruption` ; `UsageGuards.test.tsx › sans coût connu : en jetons…` | vert |

### `pilote` — réduire

43 vérifications : 10 retirées (dont 0 à confirmer), 0 creuse(s), 33 restent. Durée (clair + sombre) : 57 s → ≈ 44 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | lancer : Bobine démarrée | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | lancer : l'état montre l'accueil | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | attendre : étape suivante de l'accueil (code 14) | unitaire-main | reste | partiel : `pilote.test.mjs › délai, carte, accueil qui change d'étape` | — |
| 4 | accueil : « Choisir… » | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | lancer --dossier : l'accueil travaille dans ce dossier | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | accueil : essai fini, « Commencer » proposé | unitaire-main | reste | partiel : `pilote.test.mjs › accueil, blocage, avis…` | — |
| 7 | etat : agent prêt, accueil fini | unitaire-main | reste | partiel : `pilote.test.mjs › écran calme : quelques lignes, sans ligne vide de sens` | — |
| 8 | envoyer : message parti | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | envoyer : zone vidée d'abord, le brouillon ne part pas | unitaire-main | reste | partiel : `cible.test.mjs › envoyer « /scenario … » : le menu « / » fermé d'abord, le message part tel quel` (DOM jsdom, pas React) | — |
| 10 | attendre → carte | unitaire-main | reste | partiel : `pilote.test.mjs › délai, carte, accueil qui change d'étape` | — |
| 11 | etat : titre, fichier et boutons de la carte | unitaire-main | reste | partiel : `pilote.test.mjs › carte en attente : titre, commande, dossier, boutons` | — |
| 12 | capture de la carte (demi-taille) | parcours | reste | parcours : vraie app nécessaire | — |
| 13 | repondre « Autoriser une fois » | parcours | reste | parcours : vraie app nécessaire | — |
| 14 | attendre → tour-fini | unitaire-main | reste | partiel : `pilote.test.mjs › tour fini après un écran calme, pas avant` | — |
| 15 | etat : dernier message de l'agent | unitaire-main | retirée | `pilote.test.mjs › message de l'agent : extrait et nombre de mots ; en entier avec --long` | vert |
| 16 | etat --json : genre de l'outil, onglet Modifications | unitaire-main | reste | partiel : `pilote.test.mjs › outils : par genre, groupés compris` | — |
| 17 | panneau modifications : onglet ouvert, compte affiché | unitaire-main | reste | partiel : `pilote.test.mjs › onglets du panneau, en français ou en anglais` | — |
| 18 | attendre → calme | doublon | retirée | `pilote.test.mjs › calme : un tour qui ne bouge plus ; l'horloge du tour ne compte pas` | vert |
| 19 | cliquer « Arrêter » | parcours | reste | parcours : vraie app nécessaire | — |
| 20 | après Arrêter : tour-fini | unitaire-main | reste | partiel : `pilote.test.mjs › tour : en cours, fini, ou rien` | — |
| 21 | note avec capture | unitaire-main | reste | partiel : `pilote.test.mjs › écrit les entrées (Markdown et JSONL) et les résume` | — |
| 22 | note : gravité inconnue refusée | unitaire-main | reste | partiel : `pilote.test.mjs › refuse une commande, une option ou une valeur manquante` | — |
| 23 | intervention notée | unitaire-main | reste | partiel : `pilote.test.mjs › écrit les entrées…` | — |
| 24 | journal --resume : notes, interventions, tours, fins d'attente | unitaire-main | retirée | `pilote.test.mjs › écrit les entrées (Markdown et JSONL) et les résume` | vert |
| 25 | journal : note, capture et état | unitaire-main | retirée | `pilote.test.mjs › écrit les entrées…` | vert |
| 26 | panneau navigateur ouvert | parcours | reste | parcours : vraie app nécessaire | — |
| 27 | navigateur intégré : la maquette est une cible DevTools | parcours | reste | parcours : vraie app nécessaire | — |
| 28 | etat, navigateur ouvert : la fenêtre de Bobine | doublon | retirée | `cible.test.mjs › navigateur intégré ouvert : etat, envoyer et capture visent la fenêtre de Bobine` | vert |
| 29 | envoyer, navigateur ouvert | doublon | retirée | comme n° 28 : `cible.test.mjs › navigateur intégré ouvert : etat, envoyer et capture visent la fenêtre de Bobine` | vert |
| 30 | attendre, navigateur ouvert : tour-fini | doublon | retirée | comme n° 29 : comme n° 28 : `cible.test.mjs › navigateur intégré ouvert : etat, envoyer et capture visent la fenêtre de Bobine` | vert |
| 31 | capture, navigateur ouvert : la fenêtre entière | parcours | reste | parcours : vraie app nécessaire | — |
| 32 | etat, onglet fermé : la fenêtre de Bobine | doublon | retirée | `cible.test.mjs › onglet fermé : oublié ; la commande suivante relit la liste` | vert |
| 33 | attendre → carte souvenir | doublon | retirée | `cible.test.mjs › carte « Retenir ce souvenir ? » : lue par etat, attendre rend « carte »` | vert |
| 34 | repondre « Retenir » | unitaire-main | reste | partiel : `cible.test.mjs › repondre vise la carte en attente…` | — |
| 35 | souvenir décidé : plus de carte | unitaire-main | reste | partiel : `cible.test.mjs › repondre rend la main une fois la carte décidée ; toujours là, une erreur le dit (fiche 250)` | — |
| 36 | attendre → tâches proposées | unitaire-main | reste | partiel : `cible.test.mjs › carte de groupe en attente : une carte, les boutons de la ligne en attente et « Tout lancer »` | — |
| 37 | repondre « Lancer » | unitaire-main | reste | partiel : `cible.test.mjs › repondre vise la carte en attente, pas une carte de groupe décidée plus bas` | — |
| 38 | « Tâches proposées » traitée : pas une carte en attente | doublon | retirée | `cible.test.mjs › carte de groupe toute décidée : pas en attente, même avec son bouton « Lancer »` | vert |
| 39 | envoyer dans la conversation fille | parcours | reste | parcours : vraie app nécessaire | — |
| 40 | envoyer : le message est dans la fille | parcours | reste | parcours : vraie app nécessaire | — |
| 41 | attendre dans la fille : tour-fini | doublon | reste | partiel : comme n° 14 : partiel : `pilote.test.mjs › tour fini après un écran calme, pas avant` | — |
| 42 | arreter : cette Bobine-là seulement | parcours | reste | parcours : vraie app nécessaire | — |
| 43 | etat sans Bobine : erreur claire | unitaire-main | reste | partiel : `cible.test.mjs › fenêtre absente ou ambiguë : erreur qui le dit, avec les pages vues` | — |

### `platform` — réduire

5 vérifications : 2 retirées (dont 0 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 10 s → ≈ 7 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | menu de la plateforme : macOS 7 menus, rôles, feux à (18, 19) ; ailleurs ☰, 5 menus, barre d'Electron jamais montrée (×3, boucle) | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | raccourcis notés selon la plateforme, ☰, cadre natif, barres fines, sans verre, marge des feux (×3, boucle) | composant | reste | partiel : `src/shared/key-notation.test.ts › ailleurs : Ctrl, Alt, Maj dans cet ordre…` + `src/main/platform.test.ts › relues telles quelles depuis la ligne de commande du renderer` | — |
| 3 | capture d'écran proposée (macOS) / masquée (×3, boucle) | composant | reste | partiel : `src/main/platform.test.ts › sous Linux, rien de ce que seul macOS a` (capacités seules) | — |
| 4 | simulateur iOS proposé / absent dans le « + » du panneau (×3, boucle) | composant | retirée | `src/renderer/src/panel-tabs.test.ts › outil absent de la plateforme (fiche 145) : ni onglet ni entrée du menu « + »` | vert |
| 5 | groupe iOS du Diagnostic présent / absent (×3, boucle) | doublon | retirée | `src/main/diagnostics.test.ts › sans simulateur (Linux, fiche 145) : ni groupe iOS ni commande Xcode` (+ `diagnostic.mjs` #1) | vert |

### `pr-ci` — réduire

19 vérifications : 13 retirées (dont 0 à confirmer), 0 creuse(s), 6 restent. Durée (clair + sombre) : 29 s → ≈ 13 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | sans PR : pas de carte (gh interrogé) | doublon | retirée | `src/main/changes/pr-watch.test.ts › pas de PR : pas de relève ; relu par status après une minute` | vert |
| 2 | PR neuve, CI dans le dépôt : « Contrôles en attente » | doublon | retirée | `pr-watch.test.ts › juste après un push : relève toutes les 10 s pendant 2 min, contrôles « attendus » (D16)` | vert |
| 3 | PR ouverte : note du lien non répétée, pas de bouton sans rien à pousser | composant | retirée | oui : `src/renderer/src/components/panel/WorktreeBar.test.tsx › barre du worktree et PR suivie (fiche 176) › PR ouverte : la note du lien n’est pas répétée sous la carte, pas de bouton sans rien à pousser` ; `src/renderer/src/components/panel/WorktreeBar.test.tsx › barre du worktree et PR suivie (fiche 176) › PR ouverte, rien à pousser : pas de bouton ; un commit à pousser : « Pousser vers la PR »` | vert |
| 4 | carte : contrôles en cours, choix d'office décochés | composant | retirée | oui : `src/renderer/src/components/panel/PrCard.test.tsx › carte « Pull request » (fiche 176) › PR ouverte, contrôles en cours : lien, état, ligne, choix d’office décochés` | vert |
| 5 | contrôle en échec d'abord, avec son lien ; commentaires, relecture, conflit | composant | retirée | oui : `src/renderer/src/components/panel/PrCard.test.tsx › carte « Pull request » (fiche 176) › contrôle en échec d’abord avec son lien ; commentaires, relecture, conflit ; « Corriger »` | vert |
| 6 | fusion d'office cochée en conflit : la raison, rien ne part | doublon | retirée | `pr-tracking.test.ts › pourquoi la fusion d’office attend…` ; `pr-watch.test.ts › « Fusionner quand tout est vert » : décochée, rien ; cochée, fusion une fois quand c’est prêt` | vert |
| 7 | rien n'est envoyé à l'agent sans clic | doublon | retirée | `pr-watch.test.ts › « Corriger les contrôles en échec » : consigne avec extraits, sur clic seulement` | vert |
| 8 | consigne envoyée : contrôle, lien, extrait sans couleurs (`gh run view --log-failed`) | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | « Pousser vers la PR » : branche poussée, PR gardée, bouton caché | parcours | reste | parcours : vraie app nécessaire | — |
| 10 | commit hors de la barre : pas encore vu sans relecture | composant | retirée | oui : `src/renderer/src/useWorktreeCycle.test.ts › useWorktreeCycle (fiche 176, D15 : commit fait hors de la barre) › commit fait hors de la barre, sans signal : pas relu de lui-même (pas de relève minutée)` | vert |
| 11 | « Actualiser » : commit fait au terminal vu, « Pousser vers la PR » revient | parcours | reste | parcours : vraie app nécessaire | — |
| 12 | onglet Session : ligne « Pull request » avec l'état des contrôles | composant | retirée | oui : `src/renderer/src/components/panel/SessionTab.test.tsx › onglet « Session » rendu entier (fiches 166, 176) › PR suivie : ligne « Pull request » avec l’état des contrôles, qui ouvre la vue Git` | vert |
| 13 | tout vert, case décochée : rien fusionné ; note « envoyé à l'agent » partie (D17) | doublon | retirée | `pr-watch.test.ts › « Fusionner quand tout est vert » : décochée, rien…` ; `› la note « envoyé à l’agent » s’efface quand les contrôles changent (0.9.1, D17)` | vert |
| 14 | cochée : fusionnée par `gh pr merge --squash`, méthode dite, « Nettoyer » proposé | parcours | reste | parcours : vraie app nécessaire | — |
| 15 | PR fusionnée : plus de relève | doublon | retirée | `pr-watch.test.ts › cadence : 30 s tant que ça tourne… arrêt à la fusion` | vert |
| 16 | question « Nettoyer » : la branche part aussi sur GitHub | composant | retirée | oui : `src/renderer/src/components/panel/WorktreeBar.test.tsx › barre du worktree et PR suivie (fiche 176) › PR fusionnée : « Nettoyer » ; la question dit que la branche part aussi sur GitHub` ; `src/renderer/src/components/panel/WorktreeBar.test.tsx › barre du worktree et PR suivie (fiche 176) › fusionnée en local, sans PR : la question ne parle pas de GitHub` | vert |
| 17 | nettoyée : worktree et branche distante supprimés, c'est dit | parcours | reste | parcours : vraie app nécessaire | — |
| 18 | après « Nettoyer » : conversation dans le dépôt principal, sans erreur git | parcours | reste | parcours : vraie app nécessaire | — |
| 19 | « Nouvelle conversation » après nettoyage : dans le dépôt principal | doublon | retirée | `manager.test.ts › nettoyage d’un worktree (0.9.1, D21)…` | vert |

### `providers` — supprimer entièrement

13 vérifications : 13 retirées (dont 0 à confirmer), 0 creuse(s), 0 restent. Durée (clair + sombre) : 10 s → ≈ 0 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | fournisseur du fichier listé, clé en clair signalée, fichier nommé | doublon | retirée | `src/main/agent-config/providers-settings.test.ts › clé en clair dans le fichier : signalée…` ; `src/renderer/src/components/settings/ProvidersSettings.test.tsx › liste : nom, identifiant, adresse, modèles, clé…` | vert |
| 2 | clé du fournisseur « enregistrée » (ou avis sans trousseau) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ProvidersSettings.test.tsx` › « clé enregistrée sans trousseau (Linux) : « Enregistrée en clair » et l’avis nomme la variable » | vert |
| 3 | clé définie : `{env:VAR}` dans le fichier, commentaire et champs gardés, `.bak` | doublon | retirée | `src/main/agent-config/provider-files.test.ts › fichier existant : commentaires… gardés ; .bak écrit` ; `providers-settings.test.ts › « Définir » la remplace par {env:VAR} et la chiffre` | vert |
| 4 | fournisseur ajouté au format d'OpenCode, deux modèles | doublon | retirée | `provider-files.test.ts › nouveau fournisseur : compatible OpenAI, clé attendue en {env:VAR}` ; `ProvidersSettings.test.tsx › formulaire : ajout avec les modèles « id = libellé »…` | vert |
| 5 | « Tester » : répond, 2 modèles, GET /models sans clé | unitaire-main | retirée | **oui, remplaçant créé** (2026-11-24) : `M/agent-config/provider-probe.test.ts` › « sans clé : GET /models sans en-tête Authorization » | vert |
| 6 | « Tester » : connexion refusée, marche à suivre | doublon | retirée | `provider-probe.test.ts › clé refusée, adresse sans /models, connexion refusée…` ; `ProvidersSettings.test.tsx › « Tester » : … erreur avec la marche à suivre` | vert |
| 7 | « Seulement ces fournisseurs » : `enabled_providers` = les activés | doublon | retirée | `provider-files.test.ts › activation : disabled_providers sans liste blanche, enabled_providers avec` ; `ProvidersSettings.test.tsx › activation, « seulement ces fournisseurs »…` | vert |
| 8 | réseau d'entreprise : « Avancé » fermé résume ce qui est défini | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/NetworkSettings.test.tsx` › « proxy enregistré sur Entrée : « Avancé » fermé résume ce qui est défini » ; `R/components/settings/NetworkSettings.test.tsx` › « fermé, « Avancé » dit qu’il n’y a rien ; la valeur du shell est en indication » | vert |
| 9 | réseau : proxy enregistré, « Tester » passe par lui | unitaire-main | retirée | **oui, remplaçant créé** (2026-11-24) : `M/agent-config/providers-settings.test.ts` › « « Tester » passe par le proxy saisi dans les réglages (SettingsStore), comme au lancement » | vert |
| 10 | diagnostic : fournisseur désactivé facultatif, l'autre joint | doublon | retirée | `providers-settings.test.ts › « Tester » avec la clé enregistrée… ; Diagnostic ligne par ligne` | vert |
| 11 | fournisseur supprimé, le reste du fichier intact | doublon | retirée | `provider-files.test.ts › renommage… ; suppression nettoie les listes` ; `ProvidersSettings.test.tsx › … suppression confirmée dans la ligne (fiche 126)` | vert |
| 12 | réglages › agents : la page de l'agent toujours là | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « fournisseur supprimé : on reste sur la page de l’agent » | vert |
| 13 | proxy effacé (espace) : champ vidé, résumé « aucun » (waitFor) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/NetworkSettings.test.tsx` › « proxy effacé par une saisie blanche : champ vidé, résumé revenu à « rien de défini » » | vert |

### `quick` — réduire

17 vérifications : 11 retirées (dont 0 à confirmer), 0 creuse(s), 6 restent. Durée (clair + sombre) : 14 s → ≈ 8 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | raccourci global ⌥⌘B enregistré | unitaire-main | reste | partiel : `quick-entry.test.ts › un seul raccourci à la fois, réenregistré quand le réglage change` (globalShortcut simulé) | — |
| 2 | Fichier › Fenêtre rapide : ouverte, rappelle où part le message | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | capture annulée : rien de joint, la fenêtre revient | unitaire-main | retirée | `screen-capture.test.ts › zone choisie : fichier lu, fenêtres masquées puis remises ; Échap : rien` | vert |
| 4 | capture annulée : aucun message | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/QuickEntry.test.tsx` › capture annulée : rien de joint, aucun message (quick n° 4) | vert |
| 5 | capture refusée par macOS après la sélection : rien de joint, le dit | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/QuickEntry.test.tsx` › refus de macOS après la sélection : rien de joint, la raison est dite (quick n° 5) | vert |
| 6 | autorisation refusée : pas de screencapture, fenêtre gardée, message | unitaire-main | reste | partiel : `screen-capture.test.ts › refusée ou restreinte : indisponible, sans lancer la commande ni masquer les fenêtres` | — |
| 7 | bouton : ouvre Réglages Système › Enregistrement de l'écran | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/QuickEntry.test.tsx` › autorisation refusée : le bouton ouvre le réglage de macOS (quick n° 7) (adresse : `src/main/diagnostics.test.ts`) | vert |
| 8 | autorisation rendue : capture jointe, le message s'en va | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/QuickEntry.test.tsx` › autorisation rendue : la capture suivante est jointe, l’avis s’en va (quick n° 8, 9) | vert |
| 9 | capture jointe comme image (waitFor img) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/QuickEntry.test.tsx` › autorisation rendue : la capture suivante est jointe, l’avis s’en va (quick n° 8, 9) | vert |
| 10 | sans capture d'écran : pas de bouton dans la fenêtre rapide | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/QuickEntry.test.tsx` › sans capture d’écran (plateforme) : pas de bouton (quick n° 10) | vert |
| 11 | Entrée : nouvelle conversation dans la fenêtre principale, image comprise, réponse sans doublon | parcours | reste | parcours : vraie app nécessaire | — |
| 12 | zone de saisie : capture jointe (waitFor) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › capture d’écran : l’image est jointe dans la zone de saisie (quick n° 12) | vert |
| 13 | zone de saisie, autorisation refusée : message sous la zone, rien de plus joint | doublon | retirée | `Composer.test.tsx › capture impossible (fiche 124) : dit sous la zone de saisie, réglage de macOS à ouvrir` | vert |
| 14 | sans capture d'écran : pas de bouton dans la zone de saisie | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › sans capture d’écran (plateforme) : pas de bouton de capture dans la saisie (quick n° 14) | vert |
| 15 | réglage : raccourci désactivé, puis remis | unitaire-main | retirée | `quick-entry.test.ts › un seul raccourci à la fois, réenregistré quand le réglage change` | vert |
| 16 | Échap : fenêtre rapide refermée | parcours | reste | parcours : vraie app nécessaire | — |
| 17 | agent qui attend une connexion : message et image dans la zone de saisie, sous son panneau | parcours | reste | parcours : vraie app nécessaire | — |

### `relecture-commits` — réduire

7 vérifications : 6 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 36 s → ≈ 9 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | le dernier commit est la fusion (contre son premier parent : le thème seul) | doublon | retirée | `src/main/conversations/review-target.test.ts › recette N1 : après une fusion de main dans la branche du travail…` | vert |
| 2 | la carte dit ce qui a été relu, d'où (4 commits, 3 fichiers, plage) | doublon | retirée | `review-target.test.ts › recette N1…` ; `src/renderer/src/components/thread/WorkReview.test.tsx › fiche 267 (recette N1) : la carte dit ce qui a été relu…` | vert |
| 3 | clic sur `fichier:ligne` : le diff relu, jamais « Aucune modification » | doublon | retirée | `WorkReview.test.tsx › fiche 267 (N2) : une portée commitée ouvre le diff de la portée relue` ; `src/renderer/src/components/panel/ChangesTab.test.tsx › remarque d'une branche ou d'un commit relus : le diff depuis ce point…` | vert |
| 4 | onglet Modifications : aucun débordement horizontal (×4, boucle) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 5 | corrigé depuis : le diff relu reste, la vue dit que le fichier a changé | doublon | retirée | `ChangesTab.test.tsx › fiche 267 (N2) : portée commitée, le diff relu même corrigé depuis, et la vue le dit` | vert |
| 6 | rien à signaler, et sur quoi : depuis la dernière relecture | doublon | retirée | `review-target.test.ts › depuis le dernier commit relu, s'il est un ancêtre de HEAD` ; `WorkReview.test.tsx › rien à signaler : dit dans l'en-tête et la carte…` | vert |
| 7 | fichier hors de la portée relue : dit, lignes citées mises en avant | doublon | retirée | `ChangesTab.test.tsx › fiche 267 (N2) : avec du non commité relu… ; inchangé : dit` | vert |

### `replay-changes` — réduire

12 vérifications : 11 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 37 s → ≈ 8 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | en direct : 3 fichiers, +20 −1 | doublon | retirée | `parcours-matinee › Modifications : README.md et src/app.js…` ; `src/shared/changes.test.ts › totaux, chemins` | vert |
| 2 | après redémarrage (rejeu) : mêmes fichiers et totaux qu'en direct | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | diff refait depuis le patch : avant et après | doublon | retirée | `opencode-diffs.test.ts › un diff par bloc du patch…` | vert |
| 4 | pied du tour : 2 fichiers, dont 1 sans totaux | doublon | retirée | `src/renderer/src/components/thread/TurnSummary.test.tsx › jamais « +0 −0 » : « sans totaux »…` ; `changes.test.ts › le fichier réécrit compte comme modifié, sans totaux inventés` | vert |
| 5 | en direct : README.md réécrit compte | doublon | retirée | `changes.test.ts › le fichier réécrit compte comme modifié…` ; `src/main/agent/trace-replay.test.ts › OpenCode, réécriture par write…` | vert |
| 6 | README.md : « modifié », sans totaux inventés | composant | retirée | oui : `src/renderer/src/components/panel/ChangesTab.test.tsx › vue Conversation de l’onglet Modifications (fiches 021, 071, 272) › fichier réécrit sans diff : « modifié », sans totaux inventés, et pas d’« Annuler »` | vert |
| 7 | pas d'« Annuler cette modification » sans ancien texte | composant | retirée | comme n° 6 : oui : `src/renderer/src/components/panel/ChangesTab.test.tsx › vue Conversation de l’onglet Modifications (fiches 021, 071, 272) › fichier réécrit sans diff : « modifié », sans totaux inventés, et pas d’« Annuler »` | vert |
| 8 | après redémarrage : README.md réécrit compte toujours | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/conversations/manager-relaunch.test.ts › après redémarrage de l’app : la conversation rouverte par session/load › write d’OpenCode qui réécrit (fil perdu : %s) : README.md compte toujours, sans totaux inventés` | vert |
| 9 | en direct : nouveau.txt et autorise.txt créés comptent avec README.md | doublon | retirée | `opencode-diffs.test.ts › « Created file successfully » : tout en ajout, depuis l'entrée de l'outil` | vert |
| 10 | après redémarrage : mêmes fichiers créés et mêmes totaux | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/conversations/manager-relaunch.test.ts › après redémarrage de l’app : la conversation rouverte par session/load › write d’OpenCode qui crée, avec et sans autorisation (fil perdu : %s) : mêmes créations et totaux` | vert |
| 11 | Bob, en direct : « Création de … alpha.txt » | doublon | retirée | `src/main/agent/new-files.test.ts › absent quand il est proposé : création…` ; `trace-replay.test.ts › Bob 2.0.9, fichier neuf…` | vert |
| 12 | Bob, après redémarrage (le fichier existe) : toujours « Création » | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/conversations/manager-relaunch.test.ts › après redémarrage de l’app : la conversation rouverte par session/load › fichier créé par Bob (diff oldText "") : toujours « Création » une fois le fichier sur le disque` | vert |

### `resume` — réduire

7 vérifications : 5 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 9 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | reprendre : la session du dossier, pas celle d'un autre dossier ni celles déjà connues | unitaire-main | retirée | `src/main/conversations/manager.test.ts › reprendre une session commencée ailleurs : liste filtrée, rejeu, pas de doublon (fiche 055)` | vert |
| 2 | tous les dossiers : sessions groupées par dossier | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/dialogs/ResumeDialog.test.tsx` › « Tous les dossiers » : la liste s’élargit, groupée par dossier (resume n° 2) | vert |
| 3 | filtre « parser » puis « postgres » : une session (waitFor) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/dialogs/ResumeDialog.test.tsx` › filtre « parser » puis « postgres » : une seule session reste (resume n° 3) | vert |
| 4 | reprise : conversation ouverte, échange rejoué | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | reprise : on continue la conversation | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | fenêtre refermée : le menu de l'historique se rouvre | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/dialogs/ResumeDialog.test.tsx` › fenêtre refermée : rien de modal ne reste, le menu de l’historique se clique (resume n° 6) | vert |
| 7 | menu Fichier (⇧⌘O) : la session reprise n'est plus proposée | doublon | retirée | `manager.test.ts › reprendre une session commencée ailleurs : … pas de doublon (fiche 055)` | vert |

### `roles-meme-icone` — supprimer entièrement

4 vérifications : 4 retirées (dont 0 à confirmer), 0 creuse(s), 0 restent. Durée (clair + sombre) : 6 s → ≈ 0 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | deux rôles de même icône et même couleur : deux fichiers, deux tuiles dans l'Équipe | doublon | retirée | `src/main/roles/library.test.ts › deux rôles de même icône et même couleur, noms différents : tous deux gardés` ; `src/renderer/src/components/roles/RoleWizard.test.tsx › même icône qu'un rôle connu, autre identifiant : rien n'est signalé, création normale` ; tuiles après création par l'assistant : `e2e/suites/roles-gestion.mjs` | vert |
| 2 | Réglages › Rôles : les deux rôles personnels listés | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/roles/RolesSettings.test.tsx` › « deux rôles personnels de même icône et même couleur : tous deux listés chez les personnels » | vert |
| 3 | identifiant d'un rôle fourni : refusé dès l'étape 1, le rôle qui le porte est nommé | doublon | retirée | `RoleWizard.test.tsx › identifiant d'un rôle connu : dit dès l'étape 1, « Utiliser @… » propose celui du main` | vert |
| 4 | « Utiliser @code-reviewer-2 » : rôle créé à côté du fourni, rien de remplacé | doublon | retirée | `library.test.ts › identifiant d'un rôle fourni : refusé à la création, sauf « Enregistrer en personnel »` et `› suggestion du main : rôles cachés et fichiers non lus compris…` ; `RoleWizard.test.tsx › identifiant d'un rôle connu…` | vert |

### `scheduled` — réduire

18 vérifications : 7 retirées (dont 0 à confirmer), 0 creuse(s), 11 restent. Durée (clair + sombre) : 11 s → ≈ 9 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | échéance atteinte : conversation « Revue du matin » dans la barre latérale, avec le repère | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | la tâche en retard sans rattrapage ne lance rien | doublon | retirée | `scheduler.test.ts › sans rattrapage : notée manquée, rien ne part` | vert |
| 3 | autorisation en attente : l'exécution reste « en cours » (waitFor) | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | titre de la page dans la barre de titre | composant | reste | aucun remplaçant écrit | — |
| 5 | l'exécution de la tâche à l'heure est terminée | unitaire-main | retirée | `scheduler.test.ts › fin du tour : issue et coût réel notés` | vert |
| 6 | échéances manquées sans rattrapage : une seule ligne « manquée » | doublon | retirée | `scheduler.test.ts › sans rattrapage : notée manquée…` ; `src/shared/schedule.test.ts › sans rattrapage : notée manquée, rien ne part` | vert |
| 7 | … qui compte les quatre échéances | composant | reste | partiel : `scheduler.test.ts › sans rattrapage…` (`missed` compté, affichage non testé) | — |
| 8 | la page dit que les tâches ne tournent que Bobine ouverte | composant | reste | aucun remplaçant écrit | — |
| 9 | plafond affiché dans la devise connue des exécutions passées | composant | retirée | `ScheduledPage.test.tsx › liste la tâche : fréquence, prochaine échéance, coût estimé, plafond, exécutions` ; `schedule.test.ts › unité connue d'une exécution passée…` | vert |
| 10 | actions de la tâche sur une seule ligne | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 11 | nouvelle tâche : dossier de la conversation ouverte proposé d'office, en tête du menu | doublon | retirée | `ScheduledPage.test.tsx › nouvelle tâche : dossier de la conversation ouverte prérempli, les récents au menu (fiche 276)` | vert |
| 12 | nouvelle tâche : l'agent des nouvelles conversations choisi d'office (check true) | composant | reste | aucun remplaçant écrit | — |
| 13 | toutes les 4 heures sans plafond : avertissement (waitFor) | doublon | retirée | `ScheduledPage.test.tsx › nouvelle tâche : enregistrée seulement quand…` (`scheduled-no-cap-warning`, « 6 exécutions ») | vert |
| 14 | tâche enregistrée, nommée d'après sa consigne | doublon | retirée | `schedule.test.ts › nettoie, nomme d'après la consigne…` ; `ScheduledPage.test.tsx › nouvelle tâche : enregistrée…` | vert |
| 15 | pendant l'exécution, « Lancer maintenant » désactivé | composant | reste | partiel : `scheduler.test.ts › jamais deux exécutions à la fois : l'échéance est sautée` | — |
| 16 | plafond franchi : exécution « arrêtée au plafond » (waitFor) | parcours | reste | parcours : vraie app nécessaire | — |
| 17 | coût réel de l'exécution affiché | composant | reste | partiel : `ScheduledPage.test.tsx › liste la tâche… exécutions` | — |
| 18 | la conversation de l'exécution s'ouvre sur la carte « Plafond atteint » (waitFor) | composant | reste | partiel : `ScheduledPage.test.tsx › liste la tâche…` (clic `scheduled-run-open`) ; `src/renderer/src/components/thread/TurnGuards.test.tsx` (`cost-cap-card`) | — |

### `simulator` — réduire

24 vérifications : 17 retirées (dont 0 à confirmer), 0 creuse(s), 7 restent. Durée (clair + sombre) : 24 s → ≈ 11 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | appareil démarré trouvé, app lancée | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | écran lu par l'accessibilité, toucher au centre du bouton désigné | doublon | retirée | `simulator-tools.test.ts › lire l'écran puis toucher par référence…` ; `src/main/simulator/axe.test.ts › une ligne par élément nommé, référence = centre du cadre` | vert |
| 3 | saisie « Zoé » collée (presse-papiers + ⌘V) | doublon | retirée | `simulator-tools.test.ts › … saisie et bouton passent par AXe` ; `simctl.test.ts › texte encodé en MacRoman pour le presse-papiers` | vert |
| 4 | aucune autorisation demandée ; onglet « Simulateur » ouvert tout seul | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | version d'AXe affichée avant le passage aux FPS | composant | retirée | oui : `src/renderer/src/components/panel/SimulatorTab.test.tsx › onglet « Simulateur » (fiches 008, 009) › appareil démarré : son nom, sa capture ; version d’AXe avant le direct` | vert |
| 6 | flux vidéo démarré (BGRA → JPEG) et dessiné | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | débit en direct affiché, version d'AXe dans l'infobulle | composant | retirée | oui : `src/renderer/src/components/panel/SimulatorTab.test.tsx › onglet « Simulateur » (fiches 008, 009) › en direct : débit affiché à la place de la version d’AXe, qui passe en infobulle` (`createImageBitmap` et canevas simulés) | vert |
| 8 | écran du simulateur joint au message (check true) | composant | retirée | oui : `src/renderer/src/components/panel/SimulatorTab.test.tsx › onglet « Simulateur » (fiches 008, 009) › « Joindre au message » : l’écran part dans la zone de saisie` | vert |
| 9 | châssis d'iPhone : coins arrondis, proportions, pas de bouton d'accueil | composant | retirée | oui : `src/renderer/src/components/panel/SimulatorTab.test.tsx › onglet « Simulateur » : châssis, zoom et gestes (fiches 044, 084) › iPhone récent : châssis sans bouton d’accueil ; zoom « ajuster » au départ, niveau affiché` (proportions et coins : `device-chassis.test.ts` ; le dessin : capture) | vert |
| 10 | commandes (accueil, verrouillage, joindre) sous l'iPhone | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 11 | clic sur la vidéo : toucher au point correspondant | composant | retirée | oui : `src/renderer/src/components/panel/SimulatorTab.test.tsx › onglet « Simulateur » : châssis, zoom et gestes (fiches 044, 084) › clic sur l’écran : toucher au point correspondant, à l’échelle affichée` | vert |
| 12 | glisser : balayage entre les deux points, durée du geste | doublon | retirée | `screen-gestures.test.ts › a drag is a swipe lasting as long as the gesture, within bounds` | vert |
| 13 | molette : balayage vers le haut à l'endroit du pointeur | doublon | retirée | `screen-gestures.test.ts › scrolling down pushes the content up from the pointer…` | vert |
| 14 | flux interrompu : retour aux captures successives, raison affichée | unitaire-main | retirée | oui : côté onglet : `src/renderer/src/components/panel/SimulatorTab.test.tsx › onglet « Simulateur » (fiches 008, 009) › flux interrompu : la raison est dite, et les captures successives reprennent` ; **remplaçant écrit (2026-11-24)** : `src/main/simulator/simulator-manager.test.ts › flux vidéo du simulateur : mort du processus (fiches 009, 044) › flux MJPEG tombé : la raison d’AXe va à l’onglet, qui repasse aux captures ; un nouveau flux repart` ; `src/main/simulator/simulator-manager.test.ts › flux vidéo du simulateur : mort du processus (fiches 009, 044) › l’IPC relaie la fin du flux à la fenêtre (`simulator:streamEnded`), avec sa conversation` | vert |
| 15 | capture de l'appareil affichée dans l'onglet | composant | retirée | comme n° 5 : oui : `src/renderer/src/components/panel/SimulatorTab.test.tsx › onglet « Simulateur » (fiches 008, 009) › appareil démarré : son nom, sa capture ; version d’AXe avant le direct` | vert |
| 16 | zoom : « ajuster » au départ, niveau affiché | composant | retirée | comme n° 9 : oui : `src/renderer/src/components/panel/SimulatorTab.test.tsx › onglet « Simulateur » : châssis, zoom et gestes (fiches 044, 084) › iPhone récent : châssis sans bouton d’accueil ; zoom « ajuster » au départ, niveau affiché` (proportions et coins : `device-chassis.test.ts` ; le dessin : capture) | vert |
| 17 | taille réelle : 1 point par point, défile, barre visible | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 18 | zoom depuis « ajuster » : le milieu reste au centre | composant | retirée | oui : `src/renderer/src/device-zoom.test.ts › zoom des appareils : ce qu’on regardait reste au centre (fiche 084) › depuis « ajuster » : le milieu de l’écran au centre, pas son coin en haut à gauche` | vert |
| 19 | zoomé : un clic touche le point correspondant | composant | retirée | oui : `src/renderer/src/components/panel/SimulatorTab.test.tsx › onglet « Simulateur » : châssis, zoom et gestes (fiches 044, 084) › zoomé et défilé : un clic touche le point vu ; la molette ne fait pas défiler l’app` | vert |
| 20 | zoomé : la molette déplace la vue, sans faire défiler l'app | composant | retirée | oui : `src/renderer/src/components/panel/SimulatorTab.test.tsx › onglet « Simulateur » : châssis, zoom et gestes (fiches 044, 084) › zoomé et défilé : un clic touche le point vu ; la molette ne fait pas défiler l’app` ; contre-épreuve : `src/renderer/src/components/panel/SimulatorTab.test.tsx › onglet « Simulateur » : châssis, zoom et gestes (fiches 044, 084) › « ajuster » : la molette fait défiler l’app (balayage court au pointeur)` | vert |
| 21 | zoomer : palier suivant (125 %) | doublon | retirée | `device-zoom.test.ts › palier suivant et précédent d'après l'échelle affichée` | vert |
| 22 | « ajuster » : l'appareil tient de nouveau en entier | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 23 | planche contact iOS : balayage filmé dans le flux d'AXe | doublon | retirée | `simulator-tools.test.ts › fait le geste pendant le film du flux, rend une planche…` | vert |
| 24 | planche contact iOS affichée dans la carte de l'outil | composant | reste | partiel : `Transcript.test.tsx` (`tool-images`) | — |

### `subagents` — réduire

29 vérifications : 22 retirées (dont 0 à confirmer), 0 creuse(s), 7 restent. Durée (clair + sombre) : 156 s → ≈ 41 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Bob : « Lancer ce sous-agent ? » sous la carte, avec sa consigne | doublon | retirée | `src/renderer/src/components/thread/SubagentsCard.test.tsx › autorisation en attente : sous la carte, avec la consigne…` | vert |
| 2 | Bob : durée et coût du sous-agent pendant qu'il travaille | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | indicateur « Sous-agent : … » et sa durée | doublon | retirée | `src/renderer/src/components/thread/WorkingIndicator.test.tsx › le sous-agent en cours, et le temps depuis l'envoi du message` | vert |
| 4 | Bob : coût final du sous-agent sur sa ligne (check true) | unitaire-main | reste | partiel : `bob-costs.test.ts › lignes subagent de la conversation… coût s'il est lisible` | — |
| 5 | Bob : carte « Sous-agent · 1 fini », ligne « explore · consigne » | doublon | retirée | `src/main/agent/bob-subagents.test.ts › Bob 2.0.6…` ; `SubagentsCard.test.tsx › sous-agents consécutifs : une carte, une ligne chacun, comptes et coût total` | vert |
| 6 | Bob : réponse mise en forme, sans `<task_result>` | doublon | retirée | `src/shared/subagent.test.ts › résultat sans balises (Bob, OpenCode), texte libre inchangé` | vert |
| 7 | OpenCode : consigne complète et réponse, sans `<task>` | doublon | retirée | `src/main/agent/opencode-subagents.test.ts › OpenCode 1.19 : rawInput.subagent_type, consigne complète gardée à part` ; `subagent.test.ts › résultat sans balises…` | vert |
| 8 | OpenCode : « Voir son travail » rejoue la session du sous-agent | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | OpenCode 2 : seule la réponse de l'agent dans le fil | doublon | retirée | `src/shared/transcript.test.ts › outils et texte rangés sous la carte, réflexion écartée, rien dans le fil` | vert |
| 10 | OpenCode 2 : ses outils ne sont pas dans le fil | doublon | retirée | `transcript.test.ts › outils et texte rangés sous la carte…` ; `src/main/agent/trace-replay.test.ts › OpenCode : … travail du sous-agent sous sa carte` | vert |
| 11 | OpenCode 2 : son travail sous la carte, sans bouton de rejeu | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/SubagentsCard.test.tsx` › OpenCode 2 : son travail reçu en direct sous la carte, sans « Voir son travail » | vert |
| 12 | arrière-plan : « en cours » après la fin du tour | doublon | retirée | `src/shared/subagent-background.test.ts › reste « en cours » après son outil et après la fin du tour` | vert |
| 13 | arrière-plan : fini quand sa session finit, avec sa réponse finale | doublon | retirée | `subagent-background.test.ts › fini avec sa réponse quand sa session a fini` ; `src/main/agent/subagent-tracker.test.ts` | vert |
| 14 | arrière-plan : « 1 fini » dans l'en-tête | doublon | retirée | `SubagentsCard.test.tsx › sous-agents consécutifs : … comptes et coût total` | vert |
| 15 | deux sous-agents : une carte, deux lignes, « 2 en cours », coût total en direct | doublon | retirée | `SubagentsCard.test.tsx › sous-agents consécutifs…` | vert |
| 16 | le premier finit d'abord | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : `src/renderer/src/components/thread/SubagentsCard.test.tsx` › sous-agents consécutifs : une carte, une ligne chacun, comptes et coût total (statuts `in_progress` / `completed` par ligne) | vert |
| 17 | « Réponse » déplie la réponse du premier, mise en forme | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : `src/renderer/src/components/thread/SubagentsCard.test.tsx` › sous-agents consécutifs… (« Réponse » déplie la réponse mise en forme, sans balises) | vert |
| 18 | arrière-plan : un autre message part avant sa fin, carte toujours « en cours » | doublon | retirée | `src/main/agent/agent-host-background.test.ts › un autre message pendant que le sous-agent travaille : il part tout de suite…` | vert |
| 19 | arrière-plan : fini dans le tour précédent, avec sa réponse (check true) | doublon | retirée | `subagent-background.test.ts › fini même si d'autres messages sont partis depuis (D25, fiche 127)` | vert |
| 20 | arrière-plan : toujours fini, avec sa réponse, après redémarrage | parcours | reste | parcours : vraie app nécessaire | — |
| 21 | 2.3.0 : deux sous-agents « en cours » après la fin du tour | doublon | retirée | `subagent-background.test.ts › OpenCode 2.3.0 : sous-agents toujours en arrière-plan` ; `src/main/agent/agent-host-opencode-2-3.test.ts` | vert |
| 22 | 2.3.0 : pied de la barre « en cours », pas de bilan | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : `src/renderer/src/components/sidebar/Sidebar.test.tsx` › pied de la barre : « Travaille encore… », point d’activité, plus « Prêt » + `src/renderer/src/components/thread/TurnSummary.test.tsx` › sous-agent en arrière-plan encore au travail (D1)… | vert |
| 23 | 2.3.0 : « Travaille encore… · N s » sous la réponse, sans indicateur en bas | doublon | retirée | `TurnSummary.test.tsx › travail après le tour : « Travaille encore… » sous la dernière réponse` ; `… › « Travaille encore… · 32 s »…` | vert |
| 24 | 2.3.0 : chaque ligne montre le travail de son sous-agent | unitaire-main | reste | partiel : `subagent-background.test.ts › à sa fin, son travail relu dans sa session remplace celui reçu en direct` | — |
| 25 | 2.3.0 : à leur fin, réponse et travail complet | doublon | retirée | `subagent-background.test.ts › à sa fin, son travail relu dans sa session remplace celui reçu en direct (incomplet)` | vert |
| 26 | 2.3.0 : réponse du parent hors tour = message à part | doublon | retirée | `agent-host-opencode-2-3.test.ts › réponse hors tour : … la réponse est un message à part` ; `subagent-background.test.ts › le parent répond hors tour…` | vert |
| 27 | 2.3.0 : bilan à la fin du travail, sous la réponse hors tour ; « Prêt » ensuite | unitaire-main | reste | partiel : `agent-host-background.test.ts › sous-agent en arrière-plan : « travaille encore » jusqu'à la réponse hors tour, qui finit le tour` | — |
| 28 | 2.3.0 : à la fin, le pied devient le bilan, une seule durée | doublon | retirée | `TurnSummary.test.tsx › un seul pied : « heure · durée · 2 fichiers +2 −1 »… (fiche 261)` | vert |
| 29 | 2.3.0 : après redémarrage, mêmes lignes finies, même travail, mêmes deux messages | parcours | reste | parcours : vraie app nécessaire | — |

### `textes-plateforme` — supprimer entièrement

9 vérifications : 9 retirées (dont 0 à confirmer), 0 creuse(s), 0 restent. Durée (clair + sombre) : 9 s → ≈ 0 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Réglages › Général, section « settings.general.mac » de la plateforme (×2, boucle) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPlatform.test.tsx` › « Général : la section de la plateforme, aucun mot du Mac » | vert |
| 2 | Général sans texte du Mac (×2, boucle) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPlatform.test.tsx` › « Général : la section de la plateforme, aucun mot du Mac » | vert |
| 3 | Notifications : libellé du rebond (×2, boucle) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPlatform.test.tsx` › « Notifications : le libellé du rebond de la plateforme, aucun mot du Mac » | vert |
| 4 | Notifications sans texte du Mac (×2, boucle) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPlatform.test.tsx` › « Notifications : le libellé du rebond de la plateforme, aucun mot du Mac » | vert |
| 5 | Données : « agentsLabel » de la plateforme (×2, boucle) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPlatform.test.tsx` › « Données : « agents neufs » de la plateforme, aucun mot du Mac » | vert |
| 6 | Données sans texte du Mac (×2, boucle) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPlatform.test.tsx` › « Données : « agents neufs » de la plateforme, aucun mot du Mac » | vert |
| 7 | Clés d'API : « keysHint » de la plateforme (×2, boucle) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPlatform.test.tsx` › « page de l’agent : l’aide des clés nomme le bon trousseau, aucun mot du Mac » ; `R/components/settings/SettingsPlatform.test.tsx` › « l’aide des clés diffère : DPAPI sous Windows, pas sous Linux » | vert |
| 8 | Linux sans trousseau : « en clair » et de quoi la chiffrer / Windows : chiffrée, pas d'avis (×2, boucle) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/ApiKeys.test.tsx` › « en clair (Linux sans trousseau) : l’état le dit, et l’avis nomme la variable » ; `R/components/settings/ApiKeys.test.tsx` › « chiffrée (Windows, Mac) : « Enregistrée », pas d’avis en clair » — reste hors Vitest : vrai `safeStorage` en `basic_text` : simulé côté main | vert |
| 9 | Agents sans texte du Mac (×2, boucle) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPlatform.test.tsx` › « page de l’agent : l’aide des clés nomme le bon trousseau, aucun mot du Mac » | vert |

### `travaux-groupe` — réduire

12 vérifications : 9 retirées (dont 0 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 115 s → ≈ 32 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | proposés : une carte de groupe, trois lignes (rôle, sans rôle, avis), « Tout lancer » | doublon | retirée | `src/renderer/src/components/thread/WorkGroup.test.tsx › une carte, ses lignes, « par OpenCode »… « Tout lancer »` ; `src/shared/work-groups.test.ts › propositions d'un tour : une carte…` | vert |
| 2 | en cours : la même carte, « 3 en cours », ni « Sous-tâches » ni lancement séparé | doublon | retirée | `WorkGroup.test.tsx › « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé` ; `parcours-deleguer › demander, puis lancer trois travaux` | vert |
| 3 | finis : « 3 finis », avis déplié en entier, « Fusionner le recommandé » | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | une colonne d'état : « Recommandé », « Pas encore prêt », « a répondu » ; « Inclure l'autre… » | doublon | retirée | `WorkGroup.test.tsx › une colonne d'état : « fusionné » seul remplace « a répondu » ; « Recommandé » neutre` ; `SubtasksMerge.test.tsx › … les autres après confirmation` | vert |
| 5 | conseil : « n'est pas encore recommandé », sans « attend son avis » | doublon | retirée | `WorkGroup.test.tsx › conseil : « pas encore prêt selon lui » quand l'agent l'a dit…` ; `… › conseil : sans avis sur l'autre…` | vert |
| 6 | pied : aucun bouton ne dépasse la carte (×3, boucle) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 7 | fusion : les deux branches dans main, le résultat dans la carte | doublon | retirée | `parcours-deleguer › main a les trois travaux, conflit résolu, dossier propre` ; `src/main/conversations/children-merge.test.ts › deux filles sans recouvrement : fusionnées dans l'ordre de lancement` | vert |
| 8 | travail qui écrit : « Voir les modifications », « Faire relire », « Fusionner dans main » | doublon | retirée | `WorkGroup.test.tsx › « Fusionner dans main » (cleanup), « Faire relire », « Voir les modifications »` | vert |
| 9 | Faire relire un travail : sa branche relue | composant | reste | partiel : `review-target.test.ts › non commité sur une branche : la branche contre sa base…` | — |
| 10 | relecture d'un travail : dans sa carte, remarques sur sa branche | doublon | retirée | `WorkReview.test.tsx › relecture d'un travail : dans sa carte, pas à sa place ; « corriger » le fait corriger` | vert |
| 11 | fusionné dans la carte : branche supprimée, aucune étape inventée | doublon | retirée | `WorkGroup.test.tsx › fusionné : « Fusionné dans main · branche supprimée »…` ; `… › en cours : les étapes réelles seulement…` ; `children-merge.test.ts › « Puis nettoyer » : … worktrees et branches supprimés` | vert |
| 12 | conflit qui reste : Réessayer, Abandonner, Voir le conflit ; rien d'autre fusionné | doublon | retirée | `WorkGroup.test.tsx › conflit qui reste : Réessayer, Abandonner, Voir le conflit, dans la carte` ; `children-merge.test.ts › conflit qui reste après le tour de la fille : la chaîne s'arrête et le dit` | vert |

### `user-commands` — réduire

6 vérifications : 5 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 13 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | réglages : commande du projet listée (revue.md, lecture seule) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/CommandsSettings.test.tsx` › « commande du projet listée, en lecture seule, son fichier en infobulle » | vert |
| 2 | réglages : ancien dossier `.bob-desktop/commands` encore lu | doublon | retirée | `src/main/user-commands.test.ts › still reads the old .bob-desktop/commands folder; .bobine wins on the same name` | vert |
| 3 | commande personnelle « /salut » enregistrée (check true) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/CommandsSettings.test.tsx` › « commande personnelle « /salut » créée par le formulaire, puis enregistrée » ; `R/components/settings/CommandsSettings.test.tsx` › « nom déjà pris : refusé tant qu’il ne change pas » | vert |
| 4 | menu « / » : « /revue <fichier> » (Projet) et « /salut » (Vous) | doublon | retirée | `src/shared/user-commands.test.ts › lists project commands first, then global ones, with their origin` ; `src/renderer/src/components/composer/Composer.test.tsx › menu « / » : commandes de l'agent et de l'app filtrées…` | vert |
| 5 | « /salut Jérôme » : l'agent reçoit la consigne développée | doublon | retirée | `Composer.test.tsx › commande personnelle : consigne développée envoyée, sauf si l'agent a le même nom` ; `shared/user-commands.test.ts › replaces $ARGUMENTS or appends the argument` | vert |
| 6 | « /revue src/app.js » : consigne du projet développée, reçue par l'agent | parcours | reste | parcours : vraie app nécessaire | — |

### `worktree-setup` — réduire

15 vérifications : 12 retirées (dont 0 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 48 s → ≈ 14 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | worktree : `.env` ignoré copié, commande du dépôt à autoriser, pas lancée | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | les deux commandes « à la création » et « à la suppression » (D1) | doublon | retirée | `src/renderer/src/components/thread/WorktreeSetup.test.tsx › les deux commandes que l'accord couvre, chacune avec son moment (D1)` | vert |
| 3 | à autoriser : message en attente, action principale pleine, « Continuer sans préparer », fichier listé | doublon | retirée | `WorktreeSetup.test.tsx › à autoriser : « Autoriser et lancer » en action principale…` ; `src/main/changes/worktree-setup-wiring.test.ts › à autoriser : le message attend sur la carte…` | vert |
| 4 | fichier changé avant l'accord : rien lancé, nouvelle commande, message en attente (D2) | doublon | retirée | `worktree-setup.test.ts › fichier changé entre l'affichage et l'accord… (D2)` ; `worktree-setup-wiring.test.ts › fichier changé avant « Autoriser »… (D2)` | vert |
| 5 | préparation autorisée : lancée, réussie, sortie gardée, message envoyé ensuite | doublon | retirée | `worktree-setup-wiring.test.ts › « Autoriser » avec l'empreinte montrée : la commande tourne, le message part à sa fin` ; `worktree-setup.test.ts › lancement réel par le shell` | vert |
| 6 | worktree suivant : préparation lancée d'office (accord retenu) | doublon | retirée | `src/main/approvals.test.ts › préparation des worktrees (fiche 175) : par dépôt et empreinte, révocable` | vert |
| 7 | dépôt principal intact | unitaire-main | reste | partiel : `worktree-include.test.ts › copie les fichiers ignorés retenus, jamais un lien, ni hors dépôt…` | — |
| 8 | commande en cours : « Votre message attend… », « Arrêter », « Continuer sans attendre » (D4) | doublon | retirée | `WorktreeSetup.test.tsx › commande en cours : … (D4)` ; `worktree-setup-wiring.test.ts › commande autorisée en cours : le message attend…` | vert |
| 9 | « Arrêter » : commande arrêtée, carte « Arrêtée », message envoyé (D4) | doublon | retirée | `worktree-setup-wiring.test.ts › … « Arrêter » l'envoie avec l'arrêt (D4)` ; `WorktreeSetup.test.tsx › arrêtée par l'utilisateur…` | vert |
| 10 | « Continuer sans attendre » : message envoyé, commande tourne encore (D4) | doublon | retirée | `worktree-setup-wiring.test.ts › commande en cours : « Continuer sans attendre »… (D4)` | vert |
| 11 | « Continuer sans préparer » : commande non lancée, message envoyé | doublon | retirée | `worktree-setup.test.ts › « Continuer sans préparer »…` ; `worktree-setup-wiring.test.ts › « Continuer sans » le libère…` | vert |
| 12 | `archive` seule : carte à autoriser, sans commande à la création (D6) | doublon | retirée | `WorktreeSetup.test.tsx › archive seule… (D6)` ; `worktree-setup-wiring.test.ts › archive seule… (D6)` | vert |
| 13 | archive autorisée : lancée à la suppression du worktree (D6) | parcours | reste | parcours : vraie app nécessaire | — |
| 14 | tâche planifiée, préparation non autorisée : finit sans l'attendre, historique le dit (D3) | doublon | retirée | `scheduler.test.ts › échéance passée, nouveau worktree à préparer non autorisé… (fiche 175)` ; `worktree-setup-wiring.test.ts › tâche planifiée : n'attend jamais l'accord… (D3)` | vert |
| 15 | sa conversation : carte « non lancée », exécution planifiée dite, sans bouton | doublon | retirée | `WorktreeSetup.test.tsx › arrêtée par l'utilisateur ; exécution planifiée non autorisée` | vert |

## Suites du groupe C (`inventaire-e2e-C.md`)

### `filles` — réduire

51 vérifications : 42 retirées (dont 2 à confirmer), 0 creuse(s), 9 restent. Durée (clair + sombre) : 158 s → ≈ 32 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Modifications sans fille : pas de vue « Filles » | doublon | retirée | `C/panel/ChildrenView.test.tsx` › « sans fille : ni bouton ni vue » | vert |
| 2 | Fenêtre : agent et modèle de la mère par défaut | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/sidebar/ChildDialog.test.tsx` › agent et modèle de la mère présélectionnés ; « Lancer » ne demande rien de plus | vert |
| 3 | La fille est sous sa mère, la mère reste affichée | doublon | retirée | `parcours-deleguer.mjs` › « trois travaux finis, chacun dans son worktree ; la mère reste affichée » ; `C/sidebar/Sidebar.test.tsx` › « nouvelle fille : visible dès la liste reçue, même sous le pointeur (diagnostic 149) » | vert |
| 4 | Carte seule : branche, fichiers, réponse, en attente ; rien de séparé | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : `src/renderer/src/components/thread/WorkGroup.test.tsx` › sans rôle : son titre, « un autre <agent> », sa fusion dans la carte + `src/renderer/src/components/thread/WorkCard.test.tsx` › rôle qui écrit : branche, fichiers, non commité laissé, « Voir les modifications » | vert |
| 5 | Coût de la fille au pied de sa réponse (« ≈ ») | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/WorkCard.test.tsx` › coût en dollars de la fille : « ≈ » au pied de sa réponse | vert |
| 6 | Liste : fille finie, lue chez sa mère affichée, état et infobulle | doublon | retirée | `C/sidebar/Sidebar.test.tsx` › « à droite : roue, coche verte d’une fille finie (le mot pour les lecteurs), sinon le jour » ; `M/notifications/attention.test.ts` › « mère affichée quand le compte rendu y arrive : la fille n’a plus rien à lire » | vert |
| 7 | La fille travaille dans son worktree (dépôt propre) | doublon | retirée | `M/conversations/children.test.ts` › « lancée depuis la mère : worktree, consigne, compte rendu, nouvelles transmises une fois » | vert |
| 8 | Deux lancements, deux cartes ; la deuxième attend l'accord | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : `src/renderer/src/components/thread/WorkCard.test.tsx` › fiche 267 : un travail qui attend autre chose (une autorisation) garde « Attend votre réponse » (deux lancements réels : parcours-deleguer) | vert |
| 9 | Vue « Filles » : filles directes, ordre des cartes, branche | doublon | retirée | `C/panel/ChildrenView.test.tsx` › « filles directes seulement, dans l’ordre des lancements » et « une ligne par fille : branche, compte rendu, recommandation, actions » | vert |
| 10 | Vue « Filles » : « Faire relire » ouvre la relecture sur sa branche | composant | reste | partiel : `C/panel/ChildrenView.test.tsx` › « une ligne par fille : branche, compte rendu, recommandation, actions » | — |
| 11 | Le compte rendu part avec le prochain message | doublon | retirée | `M/conversations/children.test.ts` › « lancée depuis la mère : worktree, consigne, compte rendu, nouvelles transmises une fois » ; `C/thread/WorkCard.test.tsx` › « transmise : action principale retirée, réponse discrète ; pas « transmise » si le tour a échoué » | vert |
| 12 | … et une seule fois | doublon | retirée | `M/conversations/children-wake.test.ts` › « un message de la mère emporte les comptes rendus : pas de réveil pour eux » | vert |
| 13 | « Ouvrir » affiche la fille | doublon | retirée | `parcours-deleguer.mjs` › « le travail répond dans sa conversation, le lien vers la mère est là » | à confirmer |
| 14 | Fille : « ↳ depuis « mère » » en en-tête, départ en tête du fil | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/sidebar/ConversationTitle.test.tsx` › fille : « ↳ depuis « mère » », qui ramène à la mère (filles n° 14) ; départ en tête du fil : `src/renderer/src/components/thread/WorktreeStart.test.tsx` | vert |
| 15 | « ↳ depuis » ramène à la mère | doublon | retirée | `parcours-deleguer.mjs` étape « ouvrir un travail, lui répondre, revenir à la mère » | à confirmer |
| 16 | Dossiers : deux filles sous leur mère, dossier du dépôt | doublon | retirée | `C/sidebar/Sidebar.test.tsx` › « deux filles en worktree sous leur mère, dans son dossier ; pas de compteur » ; `C/sidebar/history-order.test.ts` › « par projet, pas par dossier de worktree ; une fille dans le dossier de sa mère » | vert |
| 17 | Suppression : 3 filles nommées, case cochée, celle au travail signalée | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : `src/renderer/src/components/sidebar/DeleteDialog.test.tsx` › nomme la descendance sous ses mères, case cochée : la famille part avec la mère (3 travaux nommés, « en cours, sera arrêté ») | vert |
| 18 | Case décochée : la fille au travail le reste | doublon | retirée | `C/sidebar/DeleteDialog.test.tsx` › « case décochée : les filles restent, la note le dit » | vert |
| 19 | Mère supprimée : aucune lecture d'une conversation supprimée (journal) | parcours | reste | parcours : vraie app nécessaire | — |
| 20 | Mère supprimée (décochée) : filles en conversations ordinaires | doublon | retirée | `M/conversations/children.test.ts` › « mère archivée ou supprimée : la fille devient une conversation ordinaire » | vert |
| 21 | `start_child` : carte « 1 travail proposé », appel caché | doublon | retirée | `C/thread/ChildProposals.test.tsx` › « une ligne par proposition, le compte, la consigne dépliable » ; `C/thread/WorkGroup.test.tsx` › « lancement refusé (appel caché derrière la carte) : « pas lancé », la raison en infobulle » | vert |
| 22 | Ligne : consigne dépliable, agent et modèle de la mère | doublon | retirée | `C/thread/ChildProposals.test.tsx` › « agent et modèle proposés par la mère, présélectionnés, et sa raison (fiche 160) » | vert |
| 23 | Deuxième `start_child` : même carte, deux lignes, la première lancée sur place | composant | reste | remplaçant partiel : (second `start_child` réel : e2e filles) | — |
| 24 | Travail fini, réponse remise plus tard : « a répondu », compté, infobulle | doublon | retirée | `C/thread/WorkGroup.test.tsx` › « réponse remise à la fin de celle de l’agent : « a répondu », compté même avec une proposition » | vert |
| 25 | Lignes lancées : plus de bouton, « 2 travaux » | doublon | retirée | `C/thread/WorkGroup.test.tsx` › « « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé » | vert |
| 26 | Au-delà de la limite d'agents vivants, aucune fille arrêtée | doublon | retirée | `M/conversations/children.test.ts` › « éviction (fiche 043) : une fille qui démarre ou travaille n’est jamais arrêtée pour faire de la place » | vert |
| 27 | Deux filles lancées par l'agent, sous la mère, sur leurs lignes | doublon | retirée | `M/conversations/children.test.ts` › « `filles` : deux accords, deux filles, un seul réveil avec les comptes rendus » | vert |
| 28 | Réveil groupé : une fois, deux comptes rendus | doublon | retirée | `M/conversations/children.test.ts` › « réveil groupé : une fois, avec les comptes rendus des filles lancées par l’agent » ; `M/conversations/children-wake.test.ts` › « une seule fois, quand toutes les filles attendues ont fini et la mère est au repos » | vert |
| 29 | « Faire ici » : consigne rendue à l'agent, pas de fille | doublon | retirée | `M/conversations/children.test.ts` › « « Faire ici » (fiche 112) : la consigne revient à l’agent, aucune fille » | vert |
| 30 | `start_child` refusé : résultat clair, pas de fille | doublon | retirée | `M/conversations/children.test.ts` › « `filles-refus` : refus clair, aucune fille » | vert |
| 31 | Rafale : pointeur en place avant les propositions suivantes | parcours | reste | parcours : vraie app nécessaire | — |
| 32 | Rafale : ajoutées dessous, « Lancer » immobile sous le pointeur | parcours | reste | parcours : vraie app nécessaire | — |
| 33 | Pointeur sorti de la carte : le fil reprend le bas | parcours | reste | parcours : vraie app nécessaire | — |
| 34 | Rafale refusée : le tour finit, pas de fille | unitaire-main | reste | aucun remplaçant écrit | — |
| 35 | Au-delà du plafond : erreur qui cite le réglage | doublon | retirée | `M/conversations/children.test.ts` › « `filles-plafond` : au-delà du plafond, une erreur qui cite le réglage » | vert |
| 36 | « Lancer en parallèle… » grisé au plafond, infobulle | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/sidebar/Sidebar.test.tsx` › « Lancer en parallèle… » : désactivé au plafond des filles en cours (ADR-0020) (infobulle `children.limit` ajoutée) | vert |
| 37 | `message_child` : en file de la fille, « De la conversation mère » | doublon | retirée | `C/composer/QueuedMessages.test.tsx` › « message d’une autre conversation : sa provenance devant le texte (fiche 097) » ; `M/conversations/children.test.ts` › « messages : file d’attente de la conversation visée, avec leur provenance » | vert |
| 38 | La fille reçoit le message en sachant d'où il vient | doublon | retirée | `M/conversations/children.test.ts` › « `fille-message` : de la mère à la fille, puis de la fille à la mère » | vert |
| 39 | `message_parent` : dans la mère, « De la conversation fille » | doublon | retirée | `C/thread/Transcript.test.tsx` › « étape 2 : lancée par l’agent, compte rendu qui attend son réveil, provenance des messages » | vert |
| 40 | Consigne initiale repliée par défaut | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/WorkGroup.test.tsx` › consigne initiale et message de l’agent : repliés par défaut, sur la ligne du bon travail (filles n° 40, 42, 43) | vert |
| 41 | Consigne initiale complète, identique au lancement | doublon | retirée | `C/thread/WorkGroup.test.tsx` › « une ligne se déplie sur la carte-réponse du travail : réponse entière, transmission, Ouvrir » | vert |
| 42 | Consigne `message_child` repliée par défaut (×2 : avant / après redémarrage) | composant | reste | remplaçant partiel : (après redémarrage : la consigne relue du disque reste e2e) | — |
| 43 | Consigne rattachée à la bonne fille (×2) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/WorkGroup.test.tsx` › consigne initiale et message de l’agent : repliés par défaut, sur la ligne du bon travail (filles n° 40, 42, 43) | vert |
| 44 | Texte de `message_child` sans troncature (×2, dont après redémarrage) | parcours | reste | parcours : vraie app nécessaire | — |
| 45 | Recherche des réglages : « Proposer des conversations filles », « Quand ça s'y prête » par défaut | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « « Proposer des travaux » (ex-« conversations filles ») se trouve ; « Quand ça s’y prête » par défaut » | vert |
| 46 | « Jamais » : pas de carte, l'agent fait lui-même | doublon | retirée | `M/conversations/children.test.ts` › « `chantiers` (fiche 118) : « Jamais » : il fait le travail lui-même ; `/split` : il propose » | vert |
| 47 | « Quand ça s'y prête » : carte « Tâches proposées » sans consigne | doublon | retirée | `M/conversations/children.test.ts` › « contexte de session (fiche 118) : la mère le reçoit une fois, pas sa fille ; `chantiers` propose alors des filles » | vert |
| 48 | L'agent a proposé grâce au contexte de session | doublon | retirée | comme n° 47 : `M/conversations/children.test.ts` › « contexte de session (fiche 118) : la mère le reçoit une fois, pas sa fille ; `chantiers` propose alors des filles » | vert |
| 49 | Le contexte de session ne part qu'une fois | doublon | retirée | comme n° 48 : comme n° 47 : `M/conversations/children.test.ts` › « contexte de session (fiche 118) : la mère le reçoit une fois, pas sa fille ; `chantiers` propose alors des filles » | vert |
| 50 | `/split` : le message tapé part, sans la commande | doublon | retirée | `R/app-commands.test.ts` › « /split envoie le message avec la demande de découpage ; seul, il explique (fiche 118) » ; `M/agent/message-queue.test.ts` › « /split (fiche 118) : la demande reste attachée au message, tapé avec la commande » | vert |
| 51 | `/split` : carte sur demande même réglé « Jamais » | doublon | retirée | `M/conversations/children.test.ts` › « `chantiers` (fiche 118) : « Jamais » : il fait le travail lui-même ; `/split` : il propose » | vert |

### `filles-non-commite` — supprimer entièrement (étape 1 : réduire)

15 vérifications : 15 retirées (dont 1 à confirmer), 0 creuse(s), 0 restent. Durée (clair + sombre) : 68 s → ≈ 0 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Rôle : une ligne orange sous la saisie, aucun encadré | doublon | retirée | `C/roles/RoleComposerUncommitted.test.tsx` › « rôle qui écrit, dossier modifié : ni encadré ni bouton, la ligne en orange ; Entrée envoie » | vert |
| 2 | « Changer… › Voir la modification » liste le fichier | doublon | retirée | `C/roles/RoleComposerUncommitted.test.tsx` › « « Voir les N modifications » : la liste sous la ligne, les autres comptées » | vert |
| 3 | Entrée : la fille ne voit pas le non commité | parcours | retirée | **parcours-matinee › étape 16** (rôle `@front-architect`, `plan.md` non commité) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 4 | Partie sans elles : rappel sur sa carte-réponse | doublon | retirée | `C/thread/ChildReportLeftBehind.test.tsx` › « la ligne dit le commit de départ et ce qui manquait » | vert |
| 5 | Avis : la ligne dit « dans ce dossier » | doublon | retirée | `C/roles/RoleComposerUncommitted.test.tsx` › « « Juste un avis » : appliqué tout de suite, la ligne le dit, Entrée l’envoie ainsi » | vert |
| 6 | Avis en lecture seule : les deux filles voient le plan | doublon | retirée | `M/conversations/children-uncommitted.test.ts` › « avis en lecture seule : dans le dossier de la mère, sans worktree, il voit le non commité » | vert |
| 7 | Tâches proposées : ligne discrète, « Lancer » n'attend pas | doublon | retirée | `C/thread/ChildProposals.test.tsx` › « une ligne discrète pour la carte, sans encadré ; « Lancer » part sans elles, dit » | vert |
| 8 | Committer d'abord : liste complète (`.env` compris), tout coché | doublon | retirée | `C/panel/CommitChooser.test.tsx` › « la liste complète, toutes cochées ; longue, elle défile et se déplie » | vert |
| 9 | `.env` décoché : hors du message, « partira sans lui » | doublon | retirée | `C/panel/CommitChooser.test.tsx` › « un fichier décoché ne part pas, et le message ne le cite pas » ; `C/panel/CommitDraft.test.tsx` › « cases changées après la réponse : le message retouché reste, « Rédiger à nouveau » le remplace » | vert |
| 10 | Commit : `plan.md` seul, `.env` reste non suivi | doublon | retirée | `M/conversations/children-uncommitted.test.ts` › « fiche 244 : commit des cochés seulement ; la fille part sans le .env décoché, rappelé » | vert |
| 11 | Commit puis Lancer : la fille voit `plan.md`, sans `.env` (rappelé) | doublon | retirée | même test (fiche 244) ; `C/thread/ChildProposals.test.tsx` › « fiche 244 : un fichier décoché ne part pas ; « Lancer » part sans lui » | vert |
| 12 | Dépôt sans commit : le rôle travaillera dans ce dossier, rien à choisir | doublon | retirée | `C/roles/RoleComposerUncommitted.test.tsx` › « dépôt sans commit : dans ce dossier, sans « Changer… » ni « () » ; l’envoi part » | vert |
| 13 | Dépôt sans commit : la fille voit le plan, ni worktree ni commit | doublon | retirée | `M/conversations/children-uncommitted.test.ts` › « rôle qui écrit, sans choix : il part dans le dossier, sans worktree ni commit » | vert |
| 14 | Tâches proposées, sans commit : « dans ce dossier » | doublon | retirée | `C/thread/ChildProposals.test.tsx` › « dépôt sans commit : dans ce dossier, ni worktree ni choix ; « Lancer » part sans rien » | vert |
| 15 | Proposition lancée : dans le dossier, toujours aucun commit | doublon | retirée | `M/conversations/children-uncommitted.test.ts` › « fille sans rôle (« Lancer en parallèle… », `start_child`) : dans le dossier aussi » ; `M/mcp/children-tools.test.ts` › « fiche 262 : dépôt sans commit, la fille écrit dans le dossier ; jamais de commit vide » | vert |

### `handover` — réduire

8 vérifications : 6 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 9 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Menu : l'autre agent avec le modèle du fournisseur déclaré, puis « autre modèle… » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/AgentMenu.test.tsx` › conversation commencée : l’autre agent avec le modèle de son fournisseur déclaré, puis « autre modèle… » | vert |
| 2 | Destination : agent, modèle, fournisseur, adresse | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/HandoverDialog.test.tsx` › destination : agent, modèle (nom court), fournisseur et adresse | vert |
| 3 | Ce qui part (2 messages) et ce qui s'arrête | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/HandoverDialog.test.tsx` › ce qui part (les 2 messages de l’échange, pas les outils) et ce qui s’arrête | vert |
| 4 | Même conversation : trait « Suite avec », nouvel agent, son modèle, fil gardé | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | Premier message : échange précédent reçu en contexte, avec l'agent d'avant | doublon | retirée | `M/conversations/handover.test.ts` › « même conversation, nouvelle session, modèle réglé, contexte joint une seule fois » ; `S/handover.test.ts` › « contexte joint au prochain message, dit comme une session d’avant » | vert |
| 6 | Titre gardé malgré celui du nouvel agent | unitaire-main | reste | partiel : `M/conversations/manager.test.ts` › « titre de l’agent sans ce que l’app joint ; branche : le titre de l’app reste (fiche 125) » | — |
| 7 | Message suivant : plus de contexte | doublon | retirée | `M/conversations/handover.test.ts` › « même conversation, nouvelle session, modèle réglé, contexte joint une seule fois » | vert |
| 8 | Conversation vide : pas de « Continuer avec » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/AgentMenu.test.tsx` › conversation vide : pas de « Continuer avec », seulement le choix de l’agent | vert |

### `inbox` — réduire

25 vérifications : 17 retirées (dont 0 à confirmer), 0 creuse(s), 8 restent. Durée (clair + sombre) : 132 s → ≈ 46 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Autorisation et question : deux lignes signalées à leur place | doublon | retirée | `C/sidebar/Sidebar.test.tsx` › « questions, autorisations, erreurs et réponses restent à leur place ; détails dans l’infobulle » | vert |
| 2 | Quatre conversations signalées, filles sous leur mère | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | Raisons accessibles : outil, question, comptes rendus, mère en infobulle | doublon | retirée | `M/notifications/attention.test.ts` › « ce qu’attend chaque conversation : raison, détail, depuis quand (fiche 119) » ; `S/inbox.test.ts` › « une fille : son compte rendu (sa mère est dans l’infobulle, fiche 125) » | vert |
| 4 | Aucune section « À traiter » ni seconde ligne | doublon | retirée | `C/sidebar/Sidebar.test.tsx` › « plus de colonne d’icône vide : seule une fille sous sa mère en a une, avec son lien » | vert |
| 5 | Icônes de demande / non-lu ; titres non lus en gras | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/sidebar/Sidebar.test.tsx` › demande en attente et réponse non lue : chacune son icône, la ligne marquée non lue (inbox n° 5) (graisse réelle : capture) | vert |
| 6 | Couleurs communes demandes / réponses non lues | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 7 | Les deux filles non lues gardent leur lien sous la mère | doublon | retirée | `C/sidebar/Sidebar.test.tsx` › « plus de colonne d’icône vide : seule une fille sous sa mère en a une, avec son lien » | vert |
| 8 | Grille : titres et en-têtes sur une même verticale (×2 : avant / après traitement) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 9 | Grille : filles 30 px plus loin, chacune son lien (×2) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 10 | Grille : marge droite commune (temps, états, ⌘K, filtre) (×2) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 11 | Grille : en-têtes de section 11 px, 600, capitales (×2) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 12 | Une conversation qui attend n'apparaît qu'une fois | doublon | retirée | `C/sidebar/Sidebar.test.tsx` › « questions, autorisations, erreurs et réponses restent à leur place ; détails dans l’infobulle » | vert |
| 13 | Compteur du Dock : 4, posé par le main | parcours | reste | parcours : vraie app nécessaire | — |
| 14 | Bannière groupée unique pour les deux filles | doublon | retirée | `M/notifications/grouping.test.ts` › « trois filles qui finissent ensemble : une bannière, un seul son ou rebond » ; `M/notifications/attention.test.ts` › « bannières groupées : trois fins rapprochées, une bannière, un seul rebond (fiche 119) » | vert |
| 15 | Réglage « Compteur sur l'icône du Dock » trouvé, activé par défaut | doublon | retirée | `C/settings/NotificationsSettings.test.tsx` › « proposé là où la plateforme l’a, réglage et recherche » | vert |
| 16 | Réglage coupé : plus de compteur | doublon | retirée | `M/notifications/dock-badge.test.ts` › « réglage coupé : effacé, et rien tant qu’il l’est » | vert |
| 17 | Réglage rétabli : le compteur revient | doublon | retirée | `M/notifications/dock-badge.test.ts` › « le nombre « À traiter », posé seulement quand il change, effacé à zéro » | vert |
| 18 | Sans compteur (Linux/Windows) : ni réglage ni résultat | doublon | retirée | `C/settings/NotificationsSettings.test.tsx` › « ailleurs, ni réglage ni résultat de recherche » | vert |
| 19 | Autorisation donnée : ligne conservée, compteur à 3 | doublon | retirée | `S/inbox.test.ts` › « mêmes lignes, même ordre ; une ligne traitée reste, une nouvelle attend sa place » | vert |
| 20 | Fille ouverte : lue ; l'autre reste à lire | doublon | retirée | `M/notifications/attention.test.ts` › « vue en revenant dans la fenêtre : la pastille et les notifications disparaissent » | vert |
| 21 | Mère ouverte : le compte rendu de la fille dans son fil est lu | doublon | retirée | `M/notifications/attention.test.ts` › « mère ouverte plus tard : tous les comptes rendus de son fil sont lus, pas les autres » | vert |
| 22 | Tout traité : compteur effacé, conversations et filles conservées | doublon | retirée | `M/notifications/dock-badge.test.ts` › « le nombre « À traiter », posé seulement quand il change, effacé à zéro » ; `S/inbox.test.ts` › « mêmes lignes, même ordre ; une ligne traitée reste, une nouvelle attend sa place » | vert |
| 23 | Titre de l'agent avec le contexte de session : coupé au contexte | doublon | retirée | `M/conversations/manager.test.ts` › « titre de l’agent sans ce que l’app joint ; branche : le titre de l’app reste (fiche 125) » | vert |
| 24 | Titres bruts n° 1-3 : même libellé en infobulle et sur la carte (×3) | doublon | retirée | `M/notifications/attention.test.ts` › « titres bruts de l’agent : libellé lisible, chemins relatifs (fiche 125) » ; `S/tool-label.test.ts` › « commande : le « cd » vers le dossier de la conversation disparaît, ses chemins sont relatifs » et « liste de tâches (`rawInput.todos`) : ce que fait l’outil et combien, la liste en détail » | vert |
| 25 | Plus aucun chemin absolu du dossier dans la page | composant | reste | remplaçant partiel : (sur toute la page : e2e inbox) | — |

### `roles-export` — réduire

17 vérifications : 14 retirées (dont 0 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 36 s → ≈ 10 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Rôle jamais installé : aucune ligne d'état | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/roles/RoleExport.test.tsx` › « rôle jamais installé : aucune ligne d’état, le bouton seul » | vert |
| 2 | Feuille Bob : portée par défaut, chemins, lecture seule | doublon | retirée | `C/roles/RoleExport.test.tsx` › « feuille : portée du rôle, texte exact sur demande, installe avec « lancer dans ce mode » » ; `M/roles/export/service.test.ts` › « aperçu : chemins, portée du rôle par défaut, texte exact » | vert |
| 3 | « Voir ce qui sera écrit » : bloc YAML exact | doublon | retirée | `C/roles/RoleExport.test.tsx` › « feuille : portée du rôle, texte exact sur demande, installe avec « lancer dans ce mode » » ; `M/roles/export/adapters.test.ts` › « crée le fichier : lecture seule = lire et outils MCP, consigne et lecture seule écrites » | vert |
| 4 | Installé : mode ajouté à `~/.bob/settings/custom_modes.yaml`, reste et commentaires gardés | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | Conflit : mode du projet que Bobine n'a pas écrit, fichier inchangé, dit | doublon | retirée | `M/roles/export/service.test.ts` › « conflit : un mode du même nom que Bobine n’a pas écrit n’est jamais touché » ; `C/roles/RoleExport.test.tsx` › « conflit : la page dit que rien n’a été changé » | vert |
| 6 | Rôle réenregistré : le refus d'avant n'est plus montré | doublon | retirée | `C/roles/RoleExport.test.tsx` › « conflit : la page dit que rien n’a été changé » | vert |
| 7 | Rôle changé : « Mettre à jour » réécrit le mode, « à jour » | doublon | retirée | `M/roles/export/service.test.ts` › « installe, dit « à jour », puis « le rôle a changé » et met à jour » ; `C/roles/RoleExport.test.tsx` › « rôle changé : « Mettre à jour » ; modifié à la main : retirer seulement après confirmation » | vert |
| 8 | Lancer dans ce mode : la fille du rôle travaille dans le mode installé | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | Retirer : seul le mode de Bobine part, fichier d'origine rendu | doublon | retirée | `M/roles/export/adapters.test.ts` › « remplace notre seul mode, puis le retire en rendant le fichier d’origine » | vert |
| 10 | Feuille OpenCode : un fichier par agent, lecture seule par permissions | doublon | retirée | `M/roles/export/adapters.test.ts` › « chemins : XDG_CONFIG_HOME suivi, projet sous .opencode/agents » et « écrit un agent principal ; lecture seule par permissions, outils MCP laissés » | vert |
| 11 | Installé pour le projet : `.opencode/agents/security-expert.md` | doublon | retirée | `M/roles/export/service.test.ts` › « écrit le fichier de l’agent ; un fichier qui n’est pas à Bobine n’est pas touché » | vert |
| 12 | Modifié à la main : rien retiré sans confirmation | doublon | retirée | `M/roles/export/service.test.ts` › « modifié à la main : dit, rien sans confirmation ; remplacé ou retiré si confirmé » ; `C/roles/RoleExport.test.tsx` › « rôle changé : « Mettre à jour » ; modifié à la main : retirer seulement après confirmation » | vert |
| 13 | Retiré après confirmation : fichier supprimé | doublon | retirée | `M/roles/export/service.test.ts` › « retirer supprime le fichier, après une copie » | vert |
| 14 | En-tête : nom long lisible, sous-titre sur une ligne, chemin en infobulle | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 15 | Renommé alors qu'installé : dit à l'enregistrement | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/roles/RolesSettings.test.tsx` › « renommé alors qu’il est installé dans un agent : dit à l’enregistrement, avec l’ancien identifiant » | vert |
| 16 | « Installations sans rôle » : l'installation du rôle renommé reste visible | doublon | retirée | `C/roles/RoleExport.test.tsx` › « liste les installations d’un rôle renommé ou supprimé, et les retire » ; `M/roles/export/service.test.ts` › « restent visibles et se retirent ; projet : seulement dans son dossier » | vert |
| 17 | Installation sans rôle retirée : fichier supprimé | doublon | retirée | `M/roles/export/service.test.ts` › « restent visibles et se retirent ; projet : seulement dans son dossier » | vert |

### `autorisation-commande` — réduire

48 vérifications : 36 retirées (dont 0 à confirmer), 0 creuse(s), 12 restent. Durée (clair + sombre) : 45 s → ≈ 15 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | `<scénario>` : commande entière, brute (×5, par scénario/largeur) | composant | retirée | `thread/CommandBlock.test.tsx` › « comme Bob : la commande, dans le titre seulement, entière et brute dans la carte » ; › « rawInput : la commande entière (pas le résumé d'une ligne), brute, dossier hors du dossier » | vert |
| 2 | aucun bouton de la carte n'a pris le focus (×5) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/CommandBlock.test.tsx` › aucun bouton de la carte ne prend le focus à l’apparition (autorisation-commande n° 2) | vert |
| 3 | pas de défilement horizontal, carte dans le fil (×5) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 4 | la carte annonce les N lignes à faire défiler (×≈4, quand ça défile) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/CommandBlock.test.tsx` › commande qui défile dans son cadre : la carte annonce les lignes à faire défiler (autorisation-commande n° 4) (hauteurs simulées) | vert |
| 5 | la fin de la commande est à l'écran avant d'accepter (×5) | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | la molette au bout du bloc ne fait pas défiler le fil (×≈4) | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | dossier hors de celui de la conversation signalé (×4) | composant | retirée | `thread/CommandBlock.test.tsx` › « rawInput : la commande entière (pas le résumé d'une ligne), brute, dossier hors du dossier » | vert |
| 8 | après : commande entière en infobulle de la ligne | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/CommandBlock.test.tsx` › après la décision : la commande entière en infobulle de la ligne repliée (autorisation-commande n° 8) | vert |
| 9 | après : dépliée, la commande puis la sortie | composant | retirée | `thread/CommandBlock.test.tsx` › « après la décision : la ligne se déplie sur la commande, puis la sortie » | vert |
| 10 | commande piégée : \r, RLO, zéro-largeur, cadratin visibles, signalés | composant | retirée | `thread/CommandBlock.test.tsx` › « caractères invisibles : rendus visibles, signalés, « Copier » garde le brut » | vert |
| 11 | piégée : titre « npm test » annoncé montré à part | composant | retirée | `thread/CommandBlock.test.tsx` › « titre qui annonce une autre commande : montré au-dessus de la commande lancée » | vert |
| 12 | texte ordinaire (insécable, emoji, NFD) : aucune alerte | composant | retirée | `thread/CommandBlock.test.tsx` › « espace insécable dans un message entre guillemets : discrète, sans l'alerte » ; › « nom de fichier tapé sur macOS (NFD) : rien de signalé » | vert |
| 13 | tableau d'arguments cité, aucun opérateur | composant | retirée | `thread/CommandBlock.test.tsx` › « tableau d'arguments : cité, aucun opérateur marqué » | vert |
| 14 | dossier de la conversation : « Dans X », infobulle, pas répété | composant | retirée | `thread/AuthorizationCard.test.tsx` › « dossier de la conversation : « Dans projet », chemin entier en infobulle et lu » | vert |
| 15 | « Copier » en haut à droite de la barre (px) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 16 | commande OpenCode entière, inchangée | composant | retirée | `thread/CommandBlock.test.tsx` › « rawInput : la commande entière (pas le résumé d'une ligne), brute, dossier hors du dossier » | vert |
| 17 | OpenCode workdir relatif : « Dans X/docs », pas répété | composant | retirée | `thread/AuthorizationCard.test.tsx` › « OpenCode, `workdir` relatif confirmé par l'emplacement : « Dans projet/docs », une fois » | vert |
| 18 | idem après décision, dépliée | composant | retirée | `thread/AuthorizationCard.test.tsx` › « OpenCode, `workdir` relatif, après la décision, dépliée : toujours une fois » | vert |
| 19 | workdir « ../.. » : alerte, chemin entier, emplacement gardé | composant | retirée | `thread/AuthorizationCard.test.tsx` › « `workdir` relatif qui sort (`../..`) : alerte, chemin entier, emplacement gardé » | vert |
| 20 | mention passée à la ligne sans « · » en début de ligne | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 21 | sous-dossier absolu : « Dans X/src/renderer » | composant | retirée | `thread/AuthorizationCard.test.tsx` › « sous-dossier : « Dans projet/src/renderer » ; emplacement égal (barre finale) masqué » | vert |
| 22 | hors du dossier : chemin entier, jamais coupé | composant | retirée | `thread/AuthorizationCard.test.tsx` › « hors du dossier : chemin entier, jamais raccourci, invisible rendu visible, alerte » | vert |
| 23 | hors du dossier : « · » entre mentions, jamais en début de ligne | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 24 | hors du dossier : deux alertes, cadratin visible | composant | retirée | `thread/AuthorizationCard.test.tsx` › « hors du dossier : chemin entier, jamais raccourci, invisible rendu visible, alerte » | vert |
| 25 | hors du dossier : « Copier » reste sur la première ligne | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 26 | hors du dossier : commande entière exacte | composant | retirée | `src/shared/command-view.test.ts` › « caractères invisibles et trompeurs rendus visibles, le reste intact » | vert |
| 27 | création : libellé, icône « fichier + », question (×2) | composant | retirée | `thread/AuthorizationCard.test.tsx` › « création dans le dossier : « Création de notes.md », question, icône, nom seul » | vert |
| 28 | création : nom seul, infobulle, badge « nouveau fichier » (×2) | composant | retirée | comme n° 27 : `thread/AuthorizationCard.test.tsx` › « création dans le dossier : « Création de notes.md », question, icône, nom seul » | vert |
| 29 | sous-dossier : dossier grisé, nom entier, compteurs visibles (×2) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/ToolCall.test.tsx` › écriture dans un sous-dossier : dossier grisé à part, nom entier, compteurs visibles (autorisation-commande n° 29) | vert |
| 30 | hors du dossier : « ~ », nom entier, compteurs, infobulle (×2) | composant | retirée | `thread/AuthorizationCard.test.tsx` › « hors du dossier : avec `~`, chemin entier en infobulle » | vert |
| 31 | carte serrée (900) : début du chemin coupé | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 32 | ligne d'outil nom long : nom entier, dossier coupé d'abord (×2, normale/serrée) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 33 | nom tient seul : dossier effacé, pas de « / » seul | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/ToolCall.test.tsx` › le nom tient seul : le dossier effacé, jamais un « / » seul (autorisation-commande n° 33) (largeurs simulées) | vert |
| 34 | Modifications : dossier coupé avant le nom, chevrons entiers (×2) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 35 | Modifications : « configuration-par-defaut.ts » entier | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 36 | nom plus large que la carte : coupé à la fin, badge et compteurs visibles (×2) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 37 | Bob, fichier neuf (oldText "") : Création, badge | unitaire-main | retirée | `src/main/agent/trace-replay.test.ts` › « Bob 2.0.9, fichier neuf (oldText "", absent quand il est proposé) : une création » | vert |
| 38 | Bob, neuf, écrit depuis : toujours « Création » | unitaire-main | retirée | `src/main/agent/new-files.test.ts` › « absent quand il est proposé : création, à la demande comme à la fin, regardé une fois » | vert |
| 39 | Bob, fichier vide existant : Modification, pas de badge | unitaire-main | retirée | `src/main/agent/new-files.test.ts` › « fichier vide existant : oldText "" gardé (modification) » ; `src/main/agent/trace-replay.test.ts` › « Bob 2.0.9, même forme sur un fichier vide existant : une modification » | vert |
| 40 | Bob, vide existant, après : Modification | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/conversations/manager-relaunch.test.ts › après redémarrage de l’app : la conversation rouverte par session/load › fichier vide existant écrit par Bob (même forme, oldText "") : toujours « Modification »` | vert |
| 41 | écriture hors du dossier : bandeau | composant | retirée | `thread/AuthorizationCard.test.tsx` › « écriture hors du dossier : bandeau lu avant les boutons, pas de « Toujours », pas de note » | vert |
| 42 | carte à risque : pas de « Toujours », pas de note | composant | retirée | comme n° 41 : `thread/AuthorizationCard.test.tsx` › « écriture hors du dossier : bandeau lu avant les boutons, pas de « Toujours », pas de note » | vert |
| 43 | la commande reste montrée au-dessus du bandeau | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/ToolCall.test.tsx` › commande à risque : la commande montrée au-dessus du bandeau, puis les boutons (autorisation-commande n° 43) | vert |
| 44 | sudo : une ligne par chemin, raison la plus précise | composant | retirée | `thread/AuthorizationCard.test.tsx` › « sudo et dossier système : une ligne chacun » | vert |
| 45 | sudo : pas de « Toujours autoriser » | composant | retirée | `thread/PermissionCardExtras.test.tsx` › « carte à risque : pas de « Toujours », une ligne dit pourquoi » | vert |
| 46 | lecture hors du dossier : pas de bandeau, « Toujours » offert | composant | retirée | `src/main/agent/permission-risk.test.ts` › « un outil d'un autre genre (lecture, recherche) : jamais signalé » ; `thread/AuthorizationCard.test.tsx` › « carte ordinaire (commande) : « Toujours » offert, la note dit que l'agent décide » | vert |
| 47 | lecture : note « c'est l'agent qui décide » | composant | retirée | `thread/AuthorizationCard.test.tsx` › « carte ordinaire (commande) : « Toujours » offert, la note dit que l'agent décide » | vert |
| 48 | modification hors du dossier (outil edit, Bob) : bandeau, pas de Toujours | unitaire-main | retirée | `src/main/agent/permission-risk.test.ts` › « Bob 2.0.9 : rawInput.path et diff absolus, une seule mention par chemin » | vert |

### `browser` — réduire

48 vérifications : 25 retirées (dont 2 à confirmer), 0 creuse(s), 23 restent. Durée (clair + sombre) : 75 s → ≈ 38 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | l'agent a saisi, cliqué, lu le résultat dans la vraie page | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | outils du navigateur sans demande d'autorisation (≥ 8 cartes) | unitaire-main | retirée | `src/main/browser/browser-tools.test.ts` › « tous autorisés d'office et rattachés à l'onglet « Navigateur » » ; › « page locale : ouverte sans rien demander » | vert |
| 3 | page jointe au message (image nommée d'après la page) | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | lecture par l'arbre d'accessibilité de Chromium | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | onglet « Navigateur » ouvert seul, sur la page de l'agent | doublon | retirée | `parcours-outils` › étape « le navigateur intégré : annoter la page et l'envoyer » (attente `browser-address` + `viewShown`) | vert |
| 6 | capture de l'agent affichée dans sa carte | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | adresse saisie : page ouverte, « Précédent » actif | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | « Précédent » revient à la page de l'agent | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | console : erreur de la page lue | unitaire-main | retirée | `src/main/browser/browser-tools.test.ts` › « console : erreurs seulement, motif, vidage » | vert |
| 10 | réseau : 500 et corps de la réponse | unitaire-main | retirée | `src/main/browser/browser-tools.test.ts` › « réseau : liste filtrée, échecs signalés, corps d'une réponse » | vert |
| 11 | JavaScript évalué dans la page | unitaire-main | retirée | `src/main/browser/browser-tools.test.ts` › « JavaScript de débogage : résultat en JSON » | vert |
| 12 | émulation mobile + mode sombre | unitaire-main | retirée | `src/main/browser/browser-tools.test.ts` › « taille d'écran et thème : préréglages, tailles libres, retour au panneau » | vert |
| 13 | nouvel onglet : bandeau d'onglets (2) | composant | retirée | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « un seul onglet : pas de bandeau ; deux : deux puces, choisir et fermer passent au main » ; `browser-tools.test.ts` › « onglets : nouvel onglet vers un site extérieur soumis à l’accord, choisir, fermer » | vert |
| 14 | onglet fermé : retour au précédent | unitaire-main | retirée | `src/main/browser/browser-manager.test.ts` › « l’onglet actif fermé : le suivant prend sa place, le dernier rend la main au précédent » ; › « un autre onglet fermé : l’actif ne change pas ; inconnu : refusé » | vert |
| 15 | planche contact : carré filmé, ≥ 3 images différentes | parcours | reste | parcours : vraie app nécessaire | — |
| 16 | planche affichée dans la carte de l'outil | composant | retirée | `src/renderer/src/components/thread/ToolCall.images.test.tsx` › « l’image de la planche est sous la carte, sans rien déplier, agrandissable » (la taille réelle de l’image filmée reste vue par #15) | vert |
| 17 | planche reçue : le fil reste en bas, pas de « Aller en bas » | parcours | reste | parcours : vraie app nécessaire | — |
| 18 | carte « execute » : libellés des outils à la suite | unitaire-main | retirée | `src/main/agent/app-tools-bridge.test.ts` › « comme OpenCode 2 : carte « execute » dont le code cite les outils, libellés et images rattachés » | vert |
| 19 | carte « execute » : capture et planche dessous | unitaire-main | retirée | comme n° 18 : `src/main/agent/app-tools-bridge.test.ts` › « comme OpenCode 2 : carte « execute » dont le code cite les outils, libellés et images rattachés » | vert |
| 20 | « execute » dont un outil a échoué : « échec » | unitaire-main | retirée | `src/main/agent/agent-host.test.ts` › « OpenCode 2 : `execute` dont un appel est en erreur → carte en échec, en direct et au rejeu (fiche 122) » | vert |
| 21 | popup par action de l'agent : bloquée, l'agent prié de demander | unitaire-main | retirée | `src/main/browser/browser-tools.test.ts` › « popup bloquée pendant une action de l'agent : il est prié de demander à l'utilisateur (fiche 072) » | vert |
| 22 | aucune fenêtre ouverte par l'action de l'agent | parcours | reste | parcours : vraie app nécessaire | — |
| 23 | popup par clic de l'utilisateur : vraie fenêtre, `opener` | parcours | reste | parcours : vraie app nécessaire | — |
| 24 | `location = …` vers un site non accordé : arrêté, agent prévenu | parcours | retirée | **parcours-outils › étape 8** (garde de navigation (SEC-1)) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 25 | la page n'est jamais allée sur le site non accordé (après 2 s) | parcours | retirée | **parcours-outils › étape 8** — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 26 | navigation hors action de l'agent : la page part | unitaire-main | retirée | `src/main/browser/navigation-guard.test.ts` › « hors d'une action de l'agent : l'utilisateur navigue librement » | vert |
| 27 | page sur site non accordé : carte d'accord avant lecture | parcours | reste | parcours : vraie app nécessaire | — |
| 28 | carte « Site web » : rien de choisi, « Envoyer » inactif | composant | retirée | `thread/QuestionCard.test.tsx` › « carte « Site web » (fiche 254, D2) : rien ne paraît choisi, « Envoyer » inactif, aucune réponse vide » | vert |
| 29 | refusé : l'agent n'a rien lu | unitaire-main | retirée | `src/main/browser/browser-tools.test.ts` › « site non accordé, refus : rien n'est lu ni fait, l'outil échoue » | vert |
| 30 | autorisé : lit, sans redemander | unitaire-main | retirée | `src/main/browser/browser-tools.test.ts` › « accordé une fois : l'outil s'exécute, sans redemander ensuite » | vert |
| 31 | « Enregistrer sous » : Téléchargements, dit l'agent et la conversation | unitaire-main | retirée | `src/main/browser/browser-manager.test.ts` › « lancé par l’agent : dans Téléchargements, la fenêtre dit l’agent et sa conversation » ; › « lancé par l’agent sans titre connu : « lancé par l’agent » ; par la page : le site seul » ; `browser-tools.test.ts` › « téléchargement lancé par l’agent : la décision revient à l’utilisateur, puis son choix (fiche 094) » | vert |
| 32 | fenêtre ouverte : fichier en attente dans le dossier de l'app | unitaire-main | retirée | `src/main/browser/downloads.test.ts` › « rien hors du dossier d'attente avant le choix ; déplacé là où l'utilisateur l'a choisi » | vert |
| 33 | l'agent apprend que l'utilisateur décide, puis où | unitaire-main | retirée | `src/main/browser/browser-tools.test.ts` › « téléchargement lancé par l'agent : la décision revient à l'utilisateur, puis son choix (fiche 094) » | vert |
| 34 | fichier enregistré, contenu du blob déjà révoqué | parcours | reste | parcours : vraie app nécessaire | — |
| 35 | dossier d'attente vidé | unitaire-main | reste | partiel : comme n° 34 : partiel : `src/main/browser/downloads.test.ts` › « rien hors du dossier d'attente avant le choix ; déplacé là où l'utilisateur l'a choisi » | — |
| 36 | bandeau de téléchargement lisible (≥ 6em, rien ne dépasse) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 37 | « Afficher dans le Finder » montre le fichier | composant | retirée | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « « Afficher dans le Finder » montre le fichier enregistré ; l’autre conversation ne compte pas » ; › « échec : dit, sans « Afficher dans le Finder » » | vert |
| 38 | « Annuler » : rien enregistré, pas de bandeau, l'agent le sait | unitaire-main | retirée | `src/main/browser/downloads.test.ts` › « « Annuler » : le téléchargement est arrêté, rien ne reste » | vert |
| 39 | fenêtre laissée ouverte : l'agent n'attend pas, la conversation attend (point) | parcours | reste | parcours : vraie app nécessaire | — |
| 40 | « Exporter » cliqué par l'utilisateur : même fenêtre, sans mention de l'agent | parcours | reste | parcours : vraie app nécessaire | — |
| 41 | panneau le plus étroit : bandeau lisible | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 42 | boîte `confirm()` : l'outil revient, le suivant aussi ; la conversation attend | parcours | reste | parcours : vraie app nécessaire | — |
| 43 | réponse de l'utilisateur arrive à l'agent ; n'attend plus | parcours | reste | parcours : vraie app nécessaire | — |
| 44 | Réglages ouverts : page native masquée puis réaffichée | parcours | reste | parcours : vraie app nécessaire | — |
| 45 | menu « + » : page native masquée puis réaffichée | parcours | reste | parcours : vraie app nécessaire | — |
| 46 | agrandi : la page native suit le panneau | doublon | reste | partiel : e2e `browser-view.mjs` (la page suit le panneau, fiche 129) | — |
| 47 | agrandi : « Page jointe au message » dans l'en-tête, clic revient | composant | retirée | `src/renderer/src/components/panel/SidePanelAttached.test.tsx` › « « Page jointe au message » dans l’en-tête ; un clic revient à la conversation ; puis s’efface » | vert |
| 48 | branche : le navigateur reprend la page de l'originale | parcours | reste | parcours : vraie app nécessaire | — |

### `annotate` — réduire

7 vérifications : 2 retirées (dont 0 à confirmer), 0 creuse(s), 5 restent. Durée (clair + sombre) : 9 s → ≈ 8 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Échap : image inchangée | composant | retirée | `src/renderer/src/components/composer/ImageAnnotator.test.tsx` › « Échap : fermée sans rien appliquer, l’image reste celle d’origine » ; **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/ImageAnnotator.test.tsx` › Échap : fermée sans rien appliquer, l’image reste celle d’origine | vert |
| 2 | fenêtre d'annotation non déplaçable (`-webkit-app-region: no-drag`) | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | rectangle, flèche, texte dessinés (« Annuler le dernier » actif) | composant | retirée | `src/renderer/src/components/composer/ImageAnnotator.test.tsx` › « rectangle, flèche et texte dessinés ; « Annuler le dernier » et « Appliquer » s’activent » (contexte 2D simulé) ; `annotation.test.ts` › « dessine chaque forme en coordonnées de l'image » ; **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/ImageAnnotator.test.tsx` › rectangle, flèche et texte dessinés ; « Annuler le dernier » et « Appliquer » s’activent (image et canevas simulés) | vert |
| 4 | texte long : revient à la ligne dans l'image (mesures) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 5 | appliquée : image annotée à la place, mêmes dimensions | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | fenêtre rapide : agrandie pour annoter, image annotée | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | fenêtre rapide : revenue à sa taille | parcours | reste | parcours : vraie app nécessaire | — |

### `command-output` — réduire

5 vérifications : 4 retirées (dont 2 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 5 s → ≈ 5 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | sortie reçue en morceaux, couleurs ANSI rendues | parcours | retirée | **parcours-outils › étape 2** — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 2 | code de sortie affiché | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/TerminalView.test.tsx` › commande finie : la sortie, couleurs ANSI rendues, puis « code 0 » (command-output n° 2) | vert |
| 3 | fond et vert ANSI de la palette | capture | retirée | **parcours-outils › étape 2** (capture qui affirme `277-outils-sortie-commande` (palette du mode, pas sa variante)) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 4 | variante de palette : ses propres couleurs | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 5 | commande en échec : code 2 signalé (`failed`) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/TerminalView.test.tsx` › commande en échec : « code 2 », signalée en échec (command-output n° 5) | vert |

### `commit-choisi` — réduire

8 vérifications : 7 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 16 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | liste complète, 40 cases cochées, cadre défilant, pas de résumé | composant | retirée | `panel/CommitChooser.test.tsx` › « la liste complète, toutes cochées ; longue, elle défile et se déplie » | vert |
| 2 | « secret ? » sur le .env seulement, coché quand même | composant | retirée | `panel/CommitChooser.test.tsx` › « « secret ? » : .env*, *.pem, *.key, id_rsa*, *.p12, pas les autres » | vert |
| 3 | tout décoché : bouton désactivé, raison écrite | composant | retirée | `panel/CommitChooser.test.tsx` › « tout décoché : bouton désactivé, la raison est écrite ; la case de tête recoche tout » | vert |
| 4 | cases changées après la rédaction : dit, pas de relance | composant | retirée | `panel/CommitDraft.test.tsx` › « cases changées après la réponse : le message retouché reste, « Rédiger à nouveau » le remplace » | vert |
| 5 | .env décoché : hors du message, « reste non commité… », case de tête intermédiaire | composant | retirée | `panel/CommitBars.test.tsx` › « fiche 244 : liste complète à cocher ; le .env décoché ne part pas, il est mis de côté » (+ `src/main/conversations/commit-draft.test.ts` › « réponse normale : message de l'agent, fichiers cochés, notes, secret retenu, lignes masquées ; agent arrêté, session supprimée ») | vert |
| 6 | (waitFor) note « Fusionné… modification mise de côté revenue » | composant | retirée | `panel/CommitBars.test.tsx` › « fiche 244 : liste complète à cocher ; le .env décoché ne part pas, il est mis de côté » | vert |
| 7 | le .env n'est pas parti : non suivi, intact, hors historique, stash vide | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | les 39 cochés commités, puis la fusion a suivi | unitaire-main | retirée | comme n° 7 : `src/main/changes/worktree-cycle.test.ts` › « fiche 244 : « Committer d'abord » des cochés ; le .env décoché ne part pas, et revient après la fusion » | vert |

### `branch` — réduire

12 vérifications : 9 retirées (dont 0 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 21 s → ≈ 9 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | l'agent a modifié le README | doublon | retirée | `parcours-matinee` › étape « vraies modifications, vues dans Modifications » | vert |
| 2 | « Modifier » : le texte du message devient modifiable sur place | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Transcript.test.tsx` › « Modifier » : le message devient modifiable sur place, Entrée renvoie le texte modifié (branch n° 2) | vert |
| 3 | fichiers modifiés depuis proposés à la remise en état (case cochée) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/dialogs/BranchDialog.test.tsx` › fichiers modifiés depuis : proposés à la remise en état, case cochée (branch n° 3) | vert |
| 4 | fichiers remis dans leur état d'alors (README restauré, créé supprimé) | unitaire-main | retirée | `src/main/conversations/branching.test.ts` › « branche préparée : fil repris et marqué, pièces jointes, contexte, titre ; fichiers remis » | vert |
| 5 | branche : échange repris puis le nouveau message | unitaire-main | retirée | `src/main/conversations/branching.test.ts` › « branche préparée : fil repris et marqué, pièces jointes, contexte, titre ; fichiers remis » ; `src/shared/branch.test.ts` › « échange repris : ce qui précède, numérotation continue » | vert |
| 6 | l'agent a reçu l'échange repris en contexte | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | historique : icône de fork, titre complet en infobulle | composant | retirée | `sidebar/Sidebar.test.tsx` › « branche et original distinguables : repère visible, titre complet en infobulle (fiche 125) » | vert |
| 8 | en-tête : « ↳ branche de « … » » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/sidebar/ConversationTitle.test.tsx` › branche : « ↳ branche de « … » » avec le titre actuel de l’origine (branch n° 8) | vert |
| 9 | titre de session de l'agent (contexte) ni dans la liste, ni le titre, ni la carte | unitaire-main | retirée | **déjà couvert (vérifié le 2026-11-24)** : `src/main/conversations/manager.test.ts › ConversationManager › titre de l’agent sans ce que l’app joint ; branche : le titre de l’app reste (fiche 125)` | vert |
| 10 | « Voir l'original » : conversation d'origine intacte | parcours | reste | parcours : vraie app nécessaire | — |
| 11 | « Réessayer » : nouvelle branche, même message rejoué, pas de dialogue | parcours | reste | parcours : vraie app nécessaire | — |
| 12 | liste : branches à plat, repère, titres au même bord | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : `src/renderer/src/components/sidebar/Sidebar.test.tsx` › une branche garde sa place, sans flèche ; son origine dans l’infobulle (fiche 131) + › branche et original distinguables… (bord exact : capture) | vert |

### `roles-travail` — réduire

37 vérifications : 28 retirées (dont 2 à confirmer), 0 creuse(s), 9 restent. Durée (clair + sombre) : 55 s → ≈ 17 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | conversation neuve : historique vide (L134) | composant | retirée | `main/conversations/manager.test.ts` › « au lancement : une conversation vide active, hors historique » | vert |
| 2 | premier message `@rôle` : parti, saisie vidée, une bulle, une carte de groupe à 2 lignes (L143) | parcours | retirée | **parcours-matinee › étape 15** (`@code-reviewer @ux-ui-expert`) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 3 | historique titré d'après la demande, deux filles dessous (waitFor L149-155) | parcours | retirée | **parcours-matinee › étape 15** — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 4 | menu @ : cinq rôles, puis « Tous les rôles » (L176) | composant | retirée | `renderer/src/components/roles/RoleComposer.test.tsx` › « cinq rôles, « Tous les rôles (7) », puis les fichiers ; marque d'un rôle du projet » | vert |
| 5 | menu @ : section « Rôles », marque du rôle du projet (L179) | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : `src/renderer/src/components/roles/RoleComposer.test.tsx` › cinq rôles, « Tous les rôles (7) », puis les fichiers ; marque d’un rôle du projet (le titre « Rôles » y est lu : `getByText('Rôles')`) | vert |
| 6 | filtre « secu » : `security-expert` en tête (waitFor L192) | composant | retirée | `renderer/src/components/roles/RoleComposer.test.tsx` › « filtre : nom d'abord, puis la description ; accents ignorés » | vert |
| 7 | Échap referme le menu, le texte reste ; on rouvre (waitFor L196-198) | composant | retirée | `renderer/src/components/roles/RoleComposer.test.tsx` › « flèches puis Entrée : le rôle surligné ; Échap referme le menu » | vert |
| 8 | Entrée : jeton, `@requête` sort du texte (L201) | composant | retirée | `renderer/src/components/roles/RoleComposer.test.tsx` › « Entrée choisit le rôle : un jeton, `@requête` sort du texte ; « Sera confié à… » » | vert |
| 9 | ligne « Sera confié à… » : lecture seule, dans ce dossier (L207) | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : `src/renderer/src/components/roles/RoleComposer.test.tsx` › Entrée choisit le rôle : un jeton, `@requête` sort du texte ; « Sera confié à… » (« lecture seule », « dans ce dossier » y sont lus) | vert |
| 10 | rôle sans demande : l'aide en gris (couleur calculée = `--muted`) (L230) | doublon | retirée | `renderer/src/components/roles/RoleComposer.test.tsx` › « rien à demander après le rôle : bouton désactivé et dit pourquoi, Entrée n'envoie rien » | vert |
| 11 | retour arrière en tête de la saisie : le jeton part d'un coup (waitFor L237) | composant | retirée | `renderer/src/components/roles/RoleComposer.test.tsx` › « retour arrière en tête de la saisie : le dernier jeton part d'un coup » | vert |
| 12 | envoi : la saisie se vide, rien à la mère (L251) | composant | retirée | `renderer/src/components/roles/RoleComposer.test.tsx` › « un jeton : une fille, le texte sans rien d'autre ; rien à la conversation » | vert |
| 13 | une bulle avec la puce du rôle et une carte-réponse, rien d'autre (L254) | doublon | retirée | `renderer/src/components/thread/WorkCard.test.tsx` › « en cours : la bulle et sa carte dans un même groupe ; « Travaille… », puis les faits au passé » ; `parcours-reglages` › étape « confier une question à un rôle (@ux-ui-expert) » | vert |
| 14 | deux rôles : la ligne résume (« 2 ») (L268) | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : `src/renderer/src/components/roles/RoleComposer.test.tsx` › deux `@rôle` tapés en entier : deux filles, en parallèle, même texte (« Sera confié à 2 rôles… » y est lu) | vert |
| 15 | deux rôles : deux filles au travail, anneau sur l'avatar (L288) | doublon | reste | partiel : `parcours-deleguer` › étape 1 (« Tout lancer », tous répondent) ; `renderer/src/components/thread/WorkGroup.test.tsx` › « « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé » | — |
| 16 | capture prise pendant le travail (verrou tenu) (L291) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 17 | deux rôles : une bulle à deux puces, une carte de groupe, une ligne par rôle dans l'ordre (L300) | composant | retirée | `renderer/src/components/thread/WorkCard.test.tsx` › « plusieurs rôles : une bulle, deux puces, puis une carte de groupe sans « proposés » (fiche 264) » | vert |
| 18 | pas de carte « Sous-tâches » pour les travaux d'une bulle (L309) | composant | retirée | `renderer/src/components/thread/WorkCard.test.tsx` › « un travail lancé par l'agent garde « Sous-tâches » et son compte rendu, sans ceux des bulles » | vert |
| 19 | en-tête de la fille : son rôle, lecture seule garantie (L319) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/roles/RoleWork.test.tsx` › en-tête de la fille : son rôle et sa lecture seule garantie (agent qui demande) | vert |
| 20 | en-tête étroit + pastille temporaire : titre ≥ 90 px, rien ne déborde (L341) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 21 | en-tête étroit, profil temporaire : pastille entière (L365) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 22 | 800 px : pastille entière, titre ≥ 90 px, rien ne déborde (L372) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 23 | 800 px, mur de 260 px : pastille réduite à son icône, entière (L388) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 24 | proposition : lecture seule garantie, mode, rôle du projet qui remplace le fourni (L402) | composant | retirée | `renderer/src/components/roles/RoleWork.test.tsx` › « badge, mode, lecture seule garantie, agent ; rôle du projet qui en remplace un autre » | vert |
| 25 | proposition lancée : sa ligne dans sa carte de groupe, ni lancement ni « Sous-tâches » (L417) | composant | retirée | `renderer/src/components/thread/WorkGroup.test.tsx` › « « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé » | vert |
| 26 | en cours : bulle, carte juste dessous, temps `m:ss`, Arrêter, Ouvrir (L466) | composant | retirée | `renderer/src/components/thread/WorkCard.test.tsx` › « en cours : la bulle et sa carte dans un même groupe ; « Travaille… », puis les faits au passé » ; `WorkCard.test.tsx` › « minutes et secondes, puis heures » | vert |
| 27 | capture prise pendant le travail (L476) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 28 | a répondu : Markdown entier, replié, pas transmis ; Appliquer, Répondre (L497) | composant | retirée | `renderer/src/components/thread/WorkCard.test.tsx` › « a répondu : la réponse entière, repliée, « Lire la suite » ; pied « heure · durée · gratuit » » | vert |
| 29 | 900 px : rien ne déborde de la carte (L516) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 30 | « Lire la suite » déplie, « Replier » referme (L521) | composant | retirée | `renderer/src/components/thread/WorkCard.test.tsx` › « a répondu : la réponse entière, repliée, « Lire la suite » ; pied « heure · durée · gratuit » » | vert |
| 31 | transmise : le message préparé sous la carte, l'action principale disparue (L545) | composant | retirée | `renderer/src/components/thread/WorkCard.test.tsx` › « « Appliquer » : message lisible (rôle, titre), le travail visé à part ; un clic à la fois » ; `WorkCard.test.tsx` › « transmise : action principale retirée, réponse discrète ; pas « transmise » si le tour a échoué » | vert |
| 32 | Répondre : jeton `data-reply` (waitFor L556-558), la suite et sa réponse dans la même carte, aucun nouveau travail (L565) | parcours | reste | parcours : vraie app nécessaire | — |
| 33 | arrêté : ce travail seulement, « Relancer » proposé (L591) | composant | retirée | `renderer/src/components/thread/WorkCard.test.tsx` › « arrêté : état clair, « Relancer » renvoie la même demande, un clic à la fois » ; `renderer/src/components/roles/RoleWork.test.tsx` › « rôle arrêté par ■ : « arrêté », jamais « a répondu » (fiche 258, D4) » | vert |
| 34 | en erreur : l'erreur dite dans la carte, « Relancer » (L606) | composant | retirée | `renderer/src/components/thread/WorkCard.test.tsx` › « en erreur : l'erreur dite, « Relancer » ; un échec de l'envoi est dit » | vert |
| 35 | agent qui écrit sans demander : « lecture seule demandée » avant l'envoi (L623) | composant | retirée | `renderer/src/components/roles/RoleComposer.test.tsx` › « agent qui écrit sans demander : « lecture seule demandée » » | vert |
| 36 | proposition : lecture seule seulement demandée (L640) | composant | retirée | `renderer/src/components/roles/RoleWork.test.tsx` › « agent qui écrit sans demander : lecture seule seulement demandée, sans nom d'agent » | vert |
| 37 | en-tête de la fille : lecture seule seulement demandée (L657) | composant | retirée | `renderer/src/components/roles/RoleWork.test.tsx` › « en-tête de la fille : son rôle et sa lecture seule » | vert |

### `session` — réduire

31 vérifications : 26 retirées (dont 0 à confirmer), 0 creuse(s), 5 restent. Durée (clair + sombre) : 181 s → ≈ 33 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | conversation vide : panneau fermé (L116) | composant | retirée | `renderer/src/usePanel.test.ts` › « à l'ouverture d'une conversation non vide, s'il reste 500 px ; pas en fenêtre étroite » | vert |
| 2 | premier message : le panneau s'ouvre de lui-même sur « Session », premier onglet (L120) | composant | retirée | `renderer/src/usePanel.test.ts` › « à l'ouverture d'une conversation non vide, s'il reste 500 px ; pas en fenêtre étroite » ; `renderer/src/panel-tabs.test.ts` › « « Session » (fiche 166) : toujours en tête, hors ordre d'arrivée ; fermé, dans « + » » | vert |
| 3 | environnement : agent, modèle, mode, dossier et branche (L130) | composant | retirée | oui : `src/renderer/src/components/panel/SessionTab.test.tsx › onglet « Session » rendu entier (fiches 166, 176) › environnement : agent, modèle, mode, dossier et branche` | vert |
| 4 | la puce du modèle ouvre le menu des modèles (waitFor L139, check L140) | composant | retirée | comme n° 3 : oui : `src/renderer/src/components/panel/SessionTab.test.tsx › onglet « Session » rendu entier (fiches 166, 176) › environnement : agent, modèle, mode, dossier et branche` | vert |
| 5 | environnement : cinq icônes de 16 px au même x, lignes de 32 px (L171) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 6 | contexte : barre, %, lignes Messages…Libre dans l'ordre (L184) | composant | retirée | `renderer/src/components/panel/SessionTab.test.tsx` › « avec le total de l'agent : barre, pourcentage, Agent et Libre » | vert |
| 7 | estimations précédées de « ≈ », « Libre » sans (L192) | composant | retirée | `renderer/src/components/panel/SessionTab.test.tsx` › « total de l'agent : pas d'explication d'estimation, « Libre » exact » | vert |
| 8 | lignes occupées = total annoncé, toutes = taille (L208) | unitaire-main | retirée | `shared/context-breakdown.test.ts` › « avec un total : la somme des lignes vaut la taille, « Agent » est le reste » | vert |
| 9 | autres MCP : « Mesurer », aucun serveur lancé à l'ouverture (L216) | composant | retirée | `renderer/src/components/panel/SessionTab.test.tsx` › « l'affichage ne lance aucune sonde ; « measure » teste les serveurs activés » | vert |
| 10 | « Mesurer » lance le serveur une fois, la valeur s'affiche (L227) | parcours | reste | parcours : vraie app nécessaire | — |
| 11 | aucun coût dans l'onglet (L232) | composant | retirée | `renderer/src/components/panel/SessionTab.test.tsx` › « avec le total de l'agent : barre, pourcentage, Agent et Libre » (`not.toMatch(/\$\|USD/)`) | vert |
| 12 | modifications : conversation « Aucune », dossier « 1 fichier non commité +3 −1 » (L241) | composant | retirée | `renderer/src/components/panel/SessionChanges.test.tsx` › « conversation neuve dans un dossier au fichier non commité : « Aucune » / « 1 fichier non commité » » | vert |
| 13 | la ligne ouvre l'onglet Modifications (L252) | composant | retirée | oui : `src/renderer/src/components/panel/SessionChanges.test.tsx › onglet « Session » : Modifications (fiche 207) › conversation neuve dans un dossier au fichier non commité : « Aucune » / « 1 fichier non commité »` (clic → `onOpenGit`) ; `src/renderer/src/components/panel/SessionTab.test.tsx › onglet « Session » rendu entier (fiches 166, 176) › environnement : agent, modèle, mode, dossier et branche` (branche → `onOpenGit`) | vert |
| 14 | terminal à l'invite : rien en cours (L263) | composant | retirée | `renderer/src/session-running.test.ts` › « terminal : seulement pendant qu'une commande tourne, sous son nom, depuis son début » | vert |
| 15 | `sleep 30` : en cours sous le nom de la commande (waitFor L273, check L274) | parcours | reste | parcours : vraie app nécessaire | — |
| 16 | sous-agent en arrière-plan : en cours, sans Arrêter (L285) | composant | retirée | `renderer/src/session-running.test.ts` › « sous-agents en arrière-plan : ni arrêt (ACP n'en a pas), ni ceux de premier plan » | vert |
| 17 | serveur de dev : en cours (L298) | composant | retirée | `renderer/src/session-running.test.ts` › « serveur arrêté : terminé ; arrêtable tant qu'il tourne » | vert |
| 18 | en cours : terminal, sous-agent, serveur, fille, chacun avec sa durée (L317) | composant | retirée | `renderer/src/components/panel/SessionTab.test.tsx` › « durée, Arrêter quand Bobine sait, rien pour un sous-agent ; terminées repliées » | vert |
| 19 | Arrêter coupe la commande du terminal (onglet gardé), le serveur, le tour de la fille (×3, L332-341) | parcours | reste | parcours : vraie app nécessaire | — |
| 20 | Terminées : 3 (une commande du terminal n'y va pas) (L349) | composant | reste | partiel : `renderer/src/components/panel/SessionTab.test.tsx` › « durée, Arrêter quand Bobine sait, rien pour un sous-agent ; terminées repliées » | — |
| 21 | dépliées : les trois terminées ; plus rien en cours (L357) | composant | retirée | `renderer/src/components/panel/SessionTab.test.tsx` › « durée, Arrêter quand Bobine sait, rien pour un sous-agent ; terminées repliées » | vert |
| 22 | après /compact, Messages baisse (L370) | unitaire-main | retirée | `shared/context-breakdown.test.ts` › « compaction terminée : seuls les éléments depuis la dernière comptent » | vert |
| 23 | autre conversation : le panneau s'ouvre de nouveau (L382) | composant | retirée | `renderer/src/usePanel.test.ts` › « fermé par l'utilisateur : ne se rouvre plus de lui-même pour cette conversation » | vert |
| 24 | retour là où il a été fermé : il reste fermé (L392) | composant | retirée | `renderer/src/usePanel.test.ts` › « fermé par l'utilisateur : ne se rouvre plus de lui-même pour cette conversation » | vert |
| 25 | fenêtre étroite : pas d'ouverture d'office (L403) | composant | retirée | `renderer/src/panel-tabs.test.ts` › « ouverture d'office (fiche 166) : panneau fermé, pas refusé, et 500 px pour la conversation » | vert |
| 26 | sans total : « ≈ N utilisés », pas de % (L425) | composant | retirée | `renderer/src/components/panel/SessionTab.test.tsx` › « sans total (Bob) : « ≈ N utilisés », ni barre, ni Agent, ni Libre ; l'agent est nommé » | vert |
| 27 | sans total : seulement le détail connu, ni Agent ni Libre, explication (L431) | composant | retirée | `renderer/src/components/panel/SessionTab.test.tsx` › « sans total (Bob) : « ≈ N utilisés », ni barre, ni Agent, ni Libre ; l'agent est nommé » | vert |
| 28 | conversation neuve : « Aucune » / « 1 fichier non commité » (L482) | doublon | retirée | `renderer/src/components/panel/SessionChanges.test.tsx` › « conversation neuve dans un dossier au fichier non commité : « Aucune » / « 1 fichier non commité » » | vert |
| 29 | après travail : conversation « 2 fichiers +6 −1 », dossier « 3 non commités » (L498) | composant | retirée | `renderer/src/components/panel/SessionChanges.test.tsx` › « après travail : ce que la conversation a modifié, qui ouvre la vue Conversation » | vert |
| 30 | « Conversation » ouvre Modifications › Conversation (waitFor L508, check L511) | composant | retirée | `renderer/src/components/panel/SessionChanges.test.tsx` › « après travail : ce que la conversation a modifié, qui ouvre la vue Conversation » | vert |
| 31 | « Dossier » ouvre Modifications › Git (waitFor L515, check L516) | composant | retirée | oui : `src/renderer/src/components/panel/SessionChanges.test.tsx › onglet « Session » : Modifications (fiche 207) › conversation neuve dans un dossier au fichier non commité : « Aucune » / « 1 fichier non commité »` (« Dossier » → `onOpenGit` ; la vue Git ouverte : `usePanel.test.ts`) | vert |

### `connexion-expiree` — réduire

22 vérifications : 19 retirées (dont 0 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 46 s → ≈ 11 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | carte « Connexion expirée », pas d'avis en double, pas l'erreur brute (L46) | composant | retirée | `shared/transcript-notice.test.ts` › « pas d'avis en double tant que la carte est à l'écran » ; `main/agent/turn-auth.test.ts` › « message refusé : carte, pas l'erreur brute ; « Réessayer » le renvoie une fois » | vert |
| 2 | statut « Connexion expirée », invite de la saisie (L52) | composant | retirée | `renderer/src/turn-auth-text.test.ts` › « sans modèle (Bob) : « Connexion expirée », comme avant » | vert |
| 3 | carte : la commande du profil, pas de clé d'API (L58) | composant | retirée | `renderer/src/components/composer/BlockerPanel.test.tsx` › « commande déclarée par le profil : affichée telle quelle, sans rien supposer de l'agent » ; `main/agent/turn-auth.test.ts` › « clé d'API : seulement si le profil la dit utile, ou si c'est le seul moyen » | vert |
| 4 | un seul bouton principal : se connecter (L64) | composant | retirée | `renderer/src/components/composer/BlockerPanel.test.tsx` › « un seul bouton principal : la connexion, puis « Réessayer » une fois l'étape lancée » | vert |
| 5 | sous la carte : pas d'icône « Réessayer » en branche (L68) | composant | retirée | `renderer/src/components/thread/Transcript.test.tsx` › « message refusé, carte en attente : pas d'icône (la carte le renvoie en place) » | vert |
| 6 | commande lancée dans le terminal (waitFor L79), puis « Réessayer » devient principal (L83) | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | Réessayer : message renvoyé une fois, l'agent répond, redevient prêt (L91) | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | Réessayer : toujours une seule conversation, pas de branche (L96) | unitaire-main | reste | partiel : `main/conversations/turn-auth-manager.test.ts` › « SSO, puis un message écrit pendant le renvoi : un seul agent, renvoi puis le nouveau message » | — |
| 9 | prêt : l'icône revient, nommée « Réessayer dans une nouvelle branche » (L100) | doublon | retirée | `renderer/src/components/thread/Transcript.test.tsx` › « prêt : l'icône sous le dernier message, nommée « Réessayer dans une nouvelle branche » » | vert |
| 10 | outils déjà lancés : « Réessayer » demande confirmation, seul principal (L125) | composant | retirée | `renderer/src/components/composer/BlockerPanel.test.tsx` › « outils déjà lancés : la carte le dit, et « Réessayer » demande confirmation » | vert |
| 11 | confirmé : renvoyé une fois (L137) | unitaire-main | retirée | `main/agent/turn-auth.test.ts` › « refus après un outil : `toolsRan`, gardé si le renvoi est refusé de nouveau » | vert |
| 12 | Bob : carte, pas d'avis en double, pas l'erreur brute (L158) | unitaire-main | retirée | `main/agent/turn-auth.test.ts` › « refus de Bob 2.0.9 (`-32603`, fiche 200) : carte, clé d'API, SSO puis renvoi » ; `turn-auth.test.ts` › « la trace enregistrée est bien celle du mock (`connexion-expiree-bob`) » | vert |
| 13 | Bob : statut « Connexion expirée », SSO proposée (L164) | composant | retirée | `renderer/src/components/composer/BlockerPanel.test.tsx` › « connexion expirée refaite par SSO : la même question, un seul « Réessayer » » | vert |
| 14 | Bob : reconnecté par SSO, renvoyé une fois, l'agent répond (L175) | unitaire-main | retirée | `main/agent/turn-auth.test.ts` › « connexion par SSO (`authenticate`) : même session, le message renvoyé » | vert |
| 15 | modèle refusé : la carte nomme le modèle (L196) | composant | retirée | `renderer/src/components/composer/BlockerPanel.test.tsx` › « la carte nomme le modèle : « Choisir un autre modèle » (principal) et « Se connecter » » | vert |
| 16 | deux actions : « Choisir un autre modèle » (principal) et « Se connecter » (L202) | doublon | retirée | `renderer/src/components/composer/BlockerPanel.test.tsx` › « la carte nomme le modèle : « Choisir un autre modèle » (principal) et « Se connecter » » | vert |
| 17 | fil : pas d'avis en double tant que la carte nomme le modèle (L208) | composant | retirée | `shared/transcript-notice.test.ts` › « pas d'avis en double tant que la carte est à l'écran » | vert |
| 18 | sous la carte : pas d'icône « Réessayer », une seule conversation (L217) | composant | retirée | `renderer/src/components/thread/Transcript.test.tsx` › « message refusé, carte en attente : pas d'icône (la carte le renvoie en place) » | vert |
| 19 | statut « Modèle refusé », invite « Choisissez un autre modèle… » (L221) | composant | retirée | `renderer/src/turn-auth-text.test.ts` › « modèle nommé : « Modèle refusé », et une invite qui propose un autre modèle » | vert |
| 20 | sélecteur : modèle refusé marqué « connexion à faire », l'autre non (L232) | composant | retirée | `renderer/src/components/composer/BlockerPanel.test.tsx` › « le sélecteur s'ouvre ; un autre modèle choisi est rendu, le modèle refusé marqué » | vert |
| 21 | autre modèle : renvoyé une fois, même conversation, l'agent répond (L246) | unitaire-main | retirée | `main/agent/turn-auth-model.test.ts` › « carte avec le modèle ; un autre modèle choisi renvoie le message une fois, même session » ; `main/conversations/turn-auth-manager.test.ts` › « autre modèle choisi sur la carte (fiche 210) : même conversation, message renvoyé une fois, modèle refusé marqué » | vert |
| 22 | le modèle refusé reste marqué dans le sélecteur de la saisie (waitFor L256, check L259) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/common/ModelChip.test.tsx` › modèle refusé faute de connexion : marqué dans la liste, toujours choisissable (connexion-expiree n° 22) (marque posée par le main : `src/main/agent/turn-auth-model.test.ts`) | vert |

### `pannes-visibles` — réduire

24 vérifications : 15 retirées (dont 2 à confirmer), 0 creuse(s), 9 restent. Durée (clair + sombre) : 76 s → ≈ 32 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | agent qui réessaie : bandeau en statut, piste Wi-Fi / VPN, ni indicateur ni bandeau de silence (L36) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/TurnFooter.test.tsx` › agent qui réessaie de joindre son modèle : le bandeau, ni indicateur ni bandeau de silence (+ `src/renderer/src/components/thread/AgentUnreachableBanner.test.tsx` existant) | vert |
| 2 | « Réglages réseau » : Réglages › Agents, « Avancé » déplié, focus sur le proxy (waitFor L46, check L50) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/NetworkSettings.test.tsx` › « « Réglages réseau » d’un bandeau : Agents demandé, « Avancé » déplié, focus sur le proxy » | vert |
| 3 | proxy changé : « relancez-le pour les appliquer », « Relancer l'agent » (L68) | composant | retirée | `renderer/src/components/thread/AgentUnreachableBanner.test.tsx` › « réglages réseau changés (fiche 276) : piste et bouton de relance ; sans `onRestart`, comme avant » | vert |
| 4 | « Relancer l'agent » : agent relancé, message remis dans la saisie, rien d'envoyé (L81) | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | agent silencieux : bandeau « n'a rien envoyé depuis… », en statut, sans prendre le focus (L99) | composant | retirée | `renderer/src/components/thread/SilenceBanner.test.tsx` › « dit depuis combien de minutes, en statut (jamais une alerte), et suit l'heure » | vert |
| 6 | silence : « Réponse en cours » sans verbe ; boutons sous le texte et alignés (L109) | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : pour le texte : `src/renderer/src/components/thread/TurnFooter.test.tsx` › silence : l’indicateur dit « Réponse en cours », sans verbe ; l’alignement des boutons reste à la capture | vert |
| 7 | « Attendre » masque le bandeau (waitFor L118, check L119) | composant | retirée | `renderer/src/components/thread/SilenceBanner.test.tsx` › « « Arrêter » arrête la réponse ; « Attendre » masque jusqu'au prochain silence » | vert |
| 8 | agent figé qui ignore Stop **et SIGTERM** : arrêté, un seul avis clair (L126) | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | silence avec un proxy : cité masqué, jamais en clair dans la page (L139) | composant | retirée | **parcours-reglages › étape 5** (contrôle global : mot de passe du proxy absent du DOM, du texte, du titre et des champs) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 10 | adresse du proxy insécable, parenthèses comprises, en infobulle (L147) | composant | retirée | `renderer/src/components/thread/SilenceBanner.test.tsx` › « l'adresse du proxy d'une seule pièce avec ses parenthèses, entière en infobulle (fiche 276) » | vert |
| 11 | modèle injoignable avec un proxy : cité masqué (L159) | composant | retirée | **parcours-reglages › étape 5** (contrôle global : mot de passe du proxy absent du DOM, du texte, du titre et des champs) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 12 | agent tué par kill -9 : sa commande (`sleep 31.7`) ne survit pas (L178) | parcours | reste | parcours : vraie app nécessaire | — |
| 13 | commande en arrière-plan : elle continue après le tour (L188) | parcours | reste | parcours : vraie app nécessaire | — |
| 14 | …et ne survit pas à la fermeture de Bobine (L203) | parcours | reste | parcours : vraie app nécessaire | — |
| 15 | quitter en plein tour : aucun processus restant (L207) | parcours | reste | parcours : vraie app nécessaire | — |
| 16 | après kill -9 de Bobine : l'agent vit encore (orphelin) (L233) | parcours | reste | parcours : vraie app nécessaire | — |
| 17 | fil préparé : un message illisible (L240) | composant | retirée | `renderer/src/components/common/SafeBoundary.test.tsx` › « élément du fil : seul lui est remplacé, nommé selon ce qu'il est, détail replié » | vert |
| 18 | lancement après kill -9 : avis du plantage, rien d'envoyé (L248) | composant | retirée | `renderer/src/components/common/AppAlertsBar.test.tsx` › « plantage précédent : rien n'a été envoyé, « Afficher le rapport », ✕ » ; `main/crash-marker.test.ts` › « marque restée (kill -9) : rapport avec la fin du journal et les minidumps, rien d'autre » | vert |
| 19 | rapport local rangé dans le profil (`crash-reports/…/rapport.txt`) (L255) | unitaire-main | retirée | `main/crash-marker.test.ts` › « marque restée (kill -9) : rapport avec la fin du journal et les minidumps, rien d'autre » | vert |
| 20 | orphelins du lancement tué arrêtés au lancement suivant (L262) | parcours | reste | parcours : vraie app nécessaire | — |
| 21 | message illisible : « Ce message ne peut pas être affiché », le reste du fil est là (L271) | composant | retirée | `renderer/src/components/common/SafeBoundary.test.tsx` › « élément du fil : seul lui est remplacé, nommé selon ce qu'il est, détail replié » | vert |
| 22 | erreur interne : un seul avis, son compte suit (waitFor L289, check L292) | doublon | retirée | `main/app-alerts.test.ts` › « erreur interne : un seul avis par lancement, les suivantes augmentent son compte » ; `renderer/src/components/common/AppAlertsBar.test.tsx` › « problème interne : le compte suit, détail replié, « Afficher le journal » » | vert |
| 23 | fermé par ✕ : ne revient pas avant le prochain lancement (L299) | doublon | retirée | `main/app-alerts.test.ts` › « fermé par ✕ : ne revient pas avant le prochain lancement » | vert |
| 24 | en quittant : aucun processus restant (L313) | parcours | reste | parcours : vraie app nécessaire | — |

### `reprise` — supprimer entièrement

4 vérifications : 4 retirées (dont 0 à confirmer), 0 creuse(s), 0 restent. Durée (clair + sombre) : 9 s → ≈ 0 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | quitter en plein tour : « Un agent travaille encore » → Quitter (L56) | doublon | retirée | `main/quit-guard.test.ts` › « un agent travaille : question ; « Annuler » garde l'app, « Quitter » redemande de quitter » ; `parcours-pannes` › étape « quitter pendant un tour » (titre non vérifié) | vert |
| 2 | relance : la conversation qui travaillait est affichée, pas une nouvelle (L71) | doublon | retirée | `parcours-pannes` › étape « relancer : la conversation qui travaillait est rouverte » ; `main/conversations/manager.test.ts` › « quitter en plein tour : la conversation qui travaillait est rouverte » | vert |
| 3 | relance : saisie vide, le message envoyé avant de quitter n'y revient pas (L81) | composant | retirée | `renderer/src/drafts.test.ts` › « message envoyé puis app quittée aussitôt : le brouillon ne revient pas (fiche 243) » | vert |
| 4 | relance : la conversation reprend dans le même fil (L89) | doublon | retirée | `parcours-pannes` › étape « relancer : la conversation qui travaillait est rouverte » (« relance : la conversation interrompue reprend ») | vert |

### `failures` — réduire

11 vérifications : 10 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 31 s → ≈ 7 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | plantage en plein tour : l'outil en cours marqué interrompu (L19) | unitaire-main | retirée | `main/agent/agent-host.test.ts` › « plantage en plein tour : outil interrompu, un seul avis avec la fin de stderr » | vert |
| 2 | un seul avis, code de sortie et fin de stderr (L27) | doublon | retirée | `parcours-pannes` › étape « l'agent de l'une plante en plein tour » ; `main/agent/agent-host.test.ts` › « plantage en plein tour : outil interrompu, un seul avis avec la fin de stderr » | vert |
| 3 | « Relancer » : le fil est gardé, avis compris (L34) | unitaire-main | retirée | `main/conversations/manager.test.ts` › « « Relancer » après un plantage (fiche 041) : fil gardé, la conversation continue » | vert |
| 4 | la conversation continue et l'agent répond (L40) | doublon | retirée | `parcours-pannes` › étape « écrire à la conversation plantée relance son agent » | vert |
| 5 | agent figé qui ignore Stop : arrêté au bout du délai, message clair (L52) | doublon | retirée | `main/agent/agent-host.test.ts` › « agent figé qui ignore Stop : processus arrêté après le délai de grâce » ; `pannes-visibles` (L126) | vert |
| 6 | agent arrêté : écrire un message le relance, puis le message part (L59) | doublon | retirée | `main/conversations/manager.test.ts` › « message envoyé à un agent arrêté (fiche 041) : relancé d'abord, puis le message part » ; `parcours-pannes` › étape « écrire à la conversation plantée relance son agent » | vert |
| 7 | menu Aide → « Afficher le journal » (L66) | unitaire-main | retirée | `main/menu.test.ts` › « menus, rôles, identifiants et raccourcis du Mac, à l'identique » | vert |
| 8 | journal : arrêts de l'agent écrits dans `main.log` (L83) | unitaire-main | retirée | `main/agent/agent-process.test.ts` › « journal Détaillé : échanges et sortie d'erreur dans agents.log, clés masquées ; lancement et arrêt dans main.log » | vert |
| 9 | historique abîmé : l'app démarre et prévient (waitFor L94, check L97) | parcours | reste | parcours : vraie app nécessaire | — |
| 10 | la conversation est reprise de la dernière bonne copie (L98) | unitaire-main | retirée | `main/conversations/store.test.ts` › « index illisible : mis de côté, reprise sur la dernière bonne copie (fiche 041) » | vert |
| 11 | le fichier abîmé est mis de côté, pas écrasé (L106) | unitaire-main | retirée | `main/conversations/store.test.ts` › « index illisible : mis de côté, reprise sur la dernière bonne copie (fiche 041) » | vert |

### `perf` — réduire

25 vérifications : 7 retirées (dont 0 à confirmer), 0 creuse(s), 18 restent. Durée (clair + sombre) : 60 s → ≈ 44 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | gros diff N : ouverture < 1500 ms (×2 : 5 000, 20 000 lignes) | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | gros diff N : dépliage sans tâche > 2000 ms (×2) | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | diff simplifié : 200 retirées, 200 ajoutées, la note | doublon | retirée | `C/thread/DiffView.test.tsx` › « diff simplifié : 200 lignes retirées, 200 ajoutées, la note, les nombres localisés » | vert |
| 4 | diff : « Afficher tout » sans arrêt > 1000 ms | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | sortie longue : ouverte en bas, sur la dernière ligne | composant | reste | partiel : `C/thread/CappedText.test.tsx` › « longue : les 500 dernières lignes, le nombre masqué localisé, « Afficher tout » » | — |
| 6 | sortie : 40 000 lignes affichées sans arrêt > 1000 ms | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | sortie plafonnée : la première ligne est masquée | doublon | retirée | `C/thread/CappedText.test.tsx` › « longue : les 500 dernières lignes, le nombre masqué localisé, « Afficher tout » » | vert |
| 8 | recherche : le mot du début masqué est trouvé (1 / 1) | composant | reste | partiel : `C/thread/CappedText.test.tsx` › « recherche ouverte : le début masqué qui contient ce qu'on cherche est montré, par paquets » | — |
| 9 | sortie bornée : la ligne trouvée est à l'écran | parcours | reste | parcours : vraie app nécessaire | — |
| 10 | recherche : une ligne masquée du diff est trouvée | doublon | retirée | `C/thread/DiffView.test.tsx` › « recherche ouverte : les lignes masquées trouvées sont montrées, par paquets » | vert |
| 11 | diff : la ligne masquée trouvée est à l'écran | parcours | reste | parcours : vraie app nécessaire | — |
| 12 | diff : premier résultat à l'écran (1 / 11) | parcours | reste | parcours : vraie app nécessaire | — |
| 13 | diff : ↓ amène le suivant à l'écran (2 / 11) | parcours | reste | parcours : vraie app nécessaire | — |
| 14 | diff : ↑ du premier au dernier à l'écran (11 / 11) | parcours | reste | parcours : vraie app nécessaire | — |
| 15 | long fil : ouverture < 1500 ms | parcours | reste | parcours : vraie app nécessaire | — |
| 16 | long fil : aucune tâche > 1000 ms, < 50 000 nœuds | parcours | reste | parcours : vraie app nécessaire | — |
| 17 | ouvert par la fin : n messages rendus sur 1250 | doublon | retirée | `C/thread/useEntryWindow.test.ts` › « fil vide, puis arrivée du fil : ouvert par la fin » | vert |
| 18 | messages précédents rendus au-dessus, ce qu'on lit reste en place (±1 px) | parcours | reste | parcours : vraie app nécessaire | — |
| 19 | tout en haut : la page ajoutée ne déplace pas ce qu'on lit | parcours | reste | parcours : vraie app nécessaire | — |
| 20 | remonté jusqu'au début : tout le fil rendu | composant | reste | partiel : `C/thread/useEntryWindow.test.ts` › « court : tout rendu ; le fil qui grandit garde le même début » | — |
| 21 | rouvert : de nouveau par la fin | doublon | retirée | `C/thread/useEntryWindow.test.ts` › « conversation suivante (fil remonté) : de nouveau par la fin » | vert |
| 22 | sommaire : premier message rendu et amené à l'écran < 5000 ms | parcours | reste | parcours : vraie app nécessaire | — |
| 23 | « Aller en bas » : en bas du fil | doublon | retirée | `R/useThreadScroll.test.ts` › « « Aller en bas » : défilement doux, et le suivi reprend » | vert |
| 24 | recherche dans le fil : tout le fil rendu, premier message trouvé | doublon | retirée | `C/thread/useEntryWindow.test.ts` › « recherche ouverte : tout le fil » | vert |
| 25 | streaming : aucune tâche > 400 ms | parcours | reste | parcours : vraie app nécessaire | — |

### `usage-board` — réduire

29 vérifications : 17 retirées (dont 0 à confirmer), 0 creuse(s), 12 restent. Durée (clair + sombre) : 34 s → ≈ 17 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | barre latérale : loupe dans l'en-tête, « Mon activité » sous « Nouvelle conversation » | doublon | retirée | `C/sidebar/Sidebar.test.tsx` › « « Rechercher » en icône dans l'en-tête, à gauche du bouton qui masque la barre » et « « Mon activité » sous « Nouvelle conversation », ⇧⌘U, en surbrillance quand ouverte » | vert |
| 2 | libellés du haut de la barre alignés (left px) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 3 | la loupe ouvre la recherche | doublon | retirée | `C/sidebar/Sidebar.test.tsx` › « « Rechercher » en icône dans l'en-tête, à gauche du bouton qui masque la barre » | vert |
| 4 | « Toute mon activité… » : page, titre, ligne en surbrillance, sans saisie | composant | reste | partiel : `C/sidebar/Sidebar.test.tsx` › « « Mon activité » sous « Nouvelle conversation », ⇧⌘U, en surbrillance quand ouverte » | — |
| 5 | semaine : 2 échanges dans 1 conversation | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | coût dans son unité (≈ 0,025 $), jetons communiqués | composant | reste | partiel : `C/activity/ActivityPage.test.tsx` › « quatre chiffres clés, et l'écart à la semaine d'avant à date égale, en texte discret » | — |
| 7 | graphique de la semaine : 7 jours, agent en `--chart-1` | doublon | retirée | `C/activity/ActivityPage.test.tsx` › « graphique : une colonne par jour, segments empilés, légende, infobulle au survol » ; `R/usage-board.test.ts` › « couleurs par emplacement fixe, « Autres » à part » | vert |
| 8 | semaine en cours : « période suivante » grisée | doublon | retirée | `C/activity/ActivityPage.test.tsx` › « filtres : semaine en cours (suivante grisée), précédente, mois, agent » | vert |
| 9 | grille : 2 échanges sur 12 mois, aujourd'hui cerclé, niveau 4 | doublon | retirée | `C/activity/ActivityPage.test.tsx` › « grille : niveaux, aujourd'hui cerclé, jours hors période pâlis, infobulle, clic sur un jour » | vert |
| 10 | infobulle d'un jour : échanges et partage par agent | doublon | retirée | `C/activity/ActivityPage.test.tsx` › « grille : niveaux, aujourd'hui cerclé, jours hors période pâlis, infobulle, clic sur un jour » | vert |
| 11 | mesures « Temps » puis « Jetons » : pas de note avec un seul agent ; ordre des chiffres | composant | reste | partiel : `C/activity/ActivityPage.test.tsx` › « mesures comparables et partielles (fiche 147) : temps empilé, note de couverture » | — |
| 12 | mois : N jours, 2 échanges | doublon | retirée | `C/activity/ActivityPage.test.tsx` › « filtres : semaine en cours (suivante grisée), précédente, mois, agent » ; `R/usage-board.test.ts` › « seaux du graphique : heures, jours de la semaine ou du mois, mois » | vert |
| 13 | année : douze mois, aucun écart | doublon | retirée | `C/activity/ActivityPage.test.tsx` › « un jour se compare à la moyenne de son jour de la semaine ; l'année, à rien » | vert |
| 14 | semaine précédente : 0 échange, « suivante » active, grille pâlie | doublon | retirée | `C/activity/ActivityPage.test.tsx` › « filtres : semaine en cours (suivante grisée), précédente, mois, agent » | vert |
| 15 | un jour : barres par heure, aucun segment actif, jour cerclé | doublon | retirée | `C/activity/ActivityPage.test.tsx` › « grille : niveaux, aujourd'hui cerclé, jours hors période pâlis, infobulle, clic sur un jour » | vert |
| 16 | la croix revient à la semaine | doublon | retirée | `C/activity/ActivityPage.test.tsx` › « grille : niveaux, aujourd'hui cerclé, jours hors période pâlis, infobulle, clic sur un jour » | vert |
| 17 | filtre d'agent : tous, puis l'agent factice | doublon | retirée | `C/activity/ActivityPage.test.tsx` › « filtres : semaine en cours (suivante grisée), précédente, mois, agent » | vert |
| 18 | export par tour : en-tête et 2 lignes | unitaire-main | retirée | `src/main/usage/csv.test.ts` › « une ligne par tour : guillemets doublés, formules désarmées, valeurs absentes vides » ; `src/main/usage/usage-ipc.test.ts` › « export : « Enregistrer sous », écrit au chemin choisi ; annulé, rien d'écrit » | vert |
| 19 | export par jour : les 7 jours, 2 aujourd'hui | unitaire-main | retirée | `src/main/usage/csv.test.ts` › « une ligne par jour, jours vides compris, une colonne par unité jamais additionnées » | vert |
| 20 | export de tout l'historique : 2 lignes | doublon | retirée | `C/activity/ActivityPage.test.tsx` › « export : par tour ou par jour pour la période, ou tout l'historique » | vert |
| 21 | 1180 px : filtres sur une ligne, 4 chiffres, rien ne déborde | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 22 | 800 px, barre ouverte : 2 lignes de filtres, 2 colonnes, grille calée à droite | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 23 | 800 px, panneau ouvert : rien ne déborde | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 24 | 800 px, barre fermée : rien ne déborde | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 25 | clic sur la conversation : la page se referme, le fil revient | composant | reste | aucun remplaçant écrit | — |
| 26 | Fenêtre › Mon activité (⇧⌘U) rouvre la page | composant | reste | partiel : `src/main/menu.test.ts` › « Fenêtre › Mon activité, ⇧⌘U (fiche 144) » | — |
| 27 | remise à zéro depuis Réglages › Données : la page se relit, état vide | doublon | retirée | `C/settings/UsageReset.test.tsx` › « confirmation dans l'app ; « Garder » n'efface rien ; confirmé, le journal est vidé » ; `C/activity/ActivityPage.test.tsx` › « journal changé (un tour, une remise à zéro) : la page et la grille se relisent » et « journal vide : un état vide qui propose de commencer, ni grille ni chiffres (fiche 185) » | vert |
| 28 | après la remise à zéro, l'échange suivant est compté | parcours | reste | parcours : vraie app nécessaire | — |
| 29 | un clic sur une conversation du tableau l'ouvre | doublon | retirée | `C/activity/ActivityPage.test.tsx` › « tableaux : par modèle (non communiqué), par projet, conversations (un clic l'ouvre) » | vert |

### `quota` — réduire

13 vérifications : 7 retirées (dont 0 à confirmer), 0 creuse(s), 6 restent. Durée (clair + sombre) : 39 s → ≈ 21 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | quota lu, agent prêt : part sous le nom de l'agent | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | au-delà de 80 % : barre orange | doublon | retirée | `C/sidebar/AgentQuotaStatus.test.tsx` › « état, part consommée et barre orange au-delà de 80 % ; détail au clic » | vert |
| 3 | détail : « 812,5 / 1 000 Bobcoins » | doublon | retirée | `C/sidebar/AgentQuotaStatus.test.tsx` › « état, part consommée et barre orange au-delà de 80 % ; détail au clic » | vert |
| 4 | détail : reste « 187,5 Bobcoins » | doublon | retirée | `C/sidebar/AgentQuotaStatus.test.tsx` › « état, part consommée et barre orange au-delà de 80 % ; détail au clic » | vert |
| 5 | « Actualiser » relit le quota | doublon | retirée | `C/sidebar/AgentQuotaStatus.test.tsx` › « « Actualiser » relit le quota, « Lecture… » en attendant » | vert |
| 6 | aucune session vide laissée chez l'agent | doublon | retirée | `src/main/agent/quota.test.ts` › « lit le quota dans un dossier réservé, supprime les sessions laissées, prévient » | vert |
| 7 | conversation sans dossier : aucun agent lancé | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/ipc-agent.test.ts › IPC branché sur le vrai gestionnaire, contre l’agent factice › conversation sans dossier (fiche 093) : aucun agent lancé, ni au lancement ni par les canaux de lecture` | vert |
| 8 | agent pas utilisé : aucune lecture du quota | doublon | retirée | `src/main/agent/quota-setup.test.ts` › « agent installé mais pas utilisé : son quota n'est pas lu au lancement » | vert |
| 9 | rien écrit dans le dossier de lecture du quota | unitaire-main | reste | partiel : `src/main/agent/quota.test.ts` › « rien n'est lu tant qu'aucun agent ne s'est montré prêt ni qu'on ne l'a demandé » | — |
| 10 | pas de quota affiché (pas de %) | composant | reste | aucun remplaçant écrit | — |
| 11 | lecture du quota en cours (faux `bob chat` lent) | parcours | reste | parcours : vraie app nécessaire | — |
| 12 | quitter pendant la lecture : `bob chat` fermé avec l'app | parcours | reste | parcours : vraie app nécessaire | — |
| 13 | rien d'écrit dans les données après la sortie | parcours | reste | parcours : vraie app nécessaire | — |

### `versions` — réduire

10 vérifications : 4 retirées (dont 0 à confirmer), 0 creuse(s), 6 restent. Durée (clair + sombre) : 18 s → ≈ 13 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | version plus récente : avis gris, une fois | doublon | retirée | `src/main/agent/version-check.test.ts` › « version plus récente : avis une seule fois, l'agent répond » | vert |
| 2 | lien « Diagnostic » à la suite de l'avis | doublon | retirée | `C/thread/Transcript.test.tsx` › « « Diagnostic » à la suite du texte ouvre la section des Réglages » | vert |
| 3 | le lien ouvre Réglages › Diagnostic | composant | reste | partiel : `C/thread/Transcript.test.tsx` › « « Diagnostic » à la suite du texte ouvre la section des Réglages » | — |
| 4 | autre conversation : pas d'avis à nouveau | doublon | retirée | `src/main/agent/version-check.test.ts` › « version plus récente : avis une seule fois, l'agent répond » | vert |
| 5 | après un redémarrage : pas d'avis à nouveau | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | conversation rouverte : l'avis vu reste dans son fil, une fois | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | conversation rouverte, nouveau message : pas d'avis à nouveau | parcours | reste | parcours : vraie app nécessaire | — |
| 8 | version plus ancienne : avertissement, l'agent répond | doublon | retirée | `src/main/agent/version-check.test.ts` › « version plus ancienne : avertissement, jamais bloquant » | vert |
| 9 | sous le plancher : refusé, expliqué, un seul avis, « Relancer » sous la saisie | composant | reste | partiel : `src/main/agent/version-check.test.ts` › « sous le plancher : démarrage refusé, expliqué, sans sortie d'erreur » | — |
| 10 | protocole incompatible : idem | composant | reste | partiel : `src/main/agent/version-check.test.ts` › « protocole incompatible : démarrage refusé, expliqué » | — |

### `debordements` — réduire

11 vérifications : 5 retirées (dont 0 à confirmer), 0 creuse(s), 6 restent. Durée (clair + sombre) : 36 s → ≈ 22 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | carte de sous-agent dans le fil | doublon | retirée | `C/thread/SubagentsCard.test.tsx` › « un sous-agent seul a la même carte ; un texte ou un outil sépare deux cartes » | vert |
| 2 | 1440 px : panneau ouvert d'office sur « Session » | doublon | retirée | `R/panel-tabs.test.ts` › « ouverture d'office (fiche 166) : panneau fermé, pas refusé, et 500 px pour la conversation » ; `R/usePanel.test.ts` › « à l'ouverture d'une conversation non vide, s'il reste 500 px ; pas en fenêtre étroite » | vert |
| 3 | 1100 px : le panneau cède, conversation ≥ 500 px | doublon | retirée | `R/panel-tabs.test.ts` › « le panneau cède jusqu'à 280 px pour garder 500 px à la conversation » | vert |
| 4 | 720 px : panneau replié, conversation ≥ 500 px | doublon | retirée | `R/usePanel.test.ts` › « replié à 760 px : fermé dans l'état et dans le stockage ; rouvert seul à 1280 px » ; `R/panel-tabs.test.ts` › « sans place même à 280 px, il ne tient plus » | vert |
| 5 | 720 px : sélecteur Code / Discussion sans débordement | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 6 | fenêtre élargie : le panneau revient sur « Session » | doublon | retirée | `R/usePanel.test.ts` › « replié à 760 px : fermé dans l'état et dans le stockage ; rouvert seul à 1280 px » | vert |
| 7 | le fil ne défile pas de côté, aucun élément ne dépasse (×2 : 1440 px, étroite) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 8 | ni la fenêtre ni ses cadres ne défilent de côté (×2) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 9 | les blocs larges défilent dans leur cadre, ≥ 3 cadres (×2) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 10 | le fil ne se laisse pas décaler de côté, scrollLeft 0 (×2) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 11 | panneau ouvert à la main, conversation écrasée : rien ne dépasse | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |

### `onglets-etroits` — réduire

10 vérifications : 6 retirées (dont 0 à confirmer), 0 creuse(s), 4 restent. Durée (clair + sombre) : 22 s → ≈ 12 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Modifications actif : aucun onglet ni bouton coupé, aucun nom tronqué, ✕ entier (×2 langues) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 2 | « 12 » affiché sur l'onglet Modifications (×2) | composant | retirée | oui : `src/renderer/src/components/panel/SidePanel.test.tsx › en-tête du panneau (fiches 082, 185, 226) › onglets nommés dans l’ordre donné, avec leur compte (« 3/3 », « 12 »)` | vert |
| 3 | clic sur l'icône d'un inactif l'ouvre, aucun onglet fermé (×onglets ×2) | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | après chaque activation : rien de coupé, ✕ entier (×onglets ×2) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 5 | clic au bord droit puis second clic : ✕ jamais sous le pointeur, rien fermé (×2) | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | ✕ d'une ligne rangée dans « + » ferme l'onglet sans l'ouvrir (×2) | composant | retirée | oui : `src/renderer/src/components/panel/PanelMoreMenu.test.tsx › menu « + » : onglets rangés (fiche 185) › ✕ d’une ligne : ferme l’onglet sans l’ouvrir, le menu reste ouvert` | vert |
| 7 | appui sur ✕ glissé ailleurs : rien ne se ferme, menu reste ouvert (×2) | composant | retirée | oui : `src/renderer/src/components/panel/PanelMoreMenu.test.tsx › menu « + » : onglets rangés (fiche 185) › appui sur ✕ glissé hors de la ligne : rien ne se ferme, le menu reste ouvert` | vert |
| 8 | ↩ sur la ligne l'ouvre, rien n'est fermé (×2) | composant | retirée | oui : `src/renderer/src/components/panel/PanelMoreMenu.test.tsx › menu « + » : onglets rangés (fiche 185) › ↩ sur la ligne l’ouvre, même après un appui sur son ✕ : rien n’est fermé` | vert |
| 9 | ⌫ sur une ligne rangée ferme l'onglet, focus reste dans le menu (×2) | composant | retirée | oui : `src/renderer/src/components/panel/PanelMoreMenu.test.tsx › menu « + » : onglets rangés (fiche 185) › ⌫ sur une ligne rangée ferme l’onglet ; le focus passe à la ligne suivante` | vert |
| 10 | puce de l'agent en icône, nom gardé pour les lecteurs (×2) | composant | retirée | oui : `src/renderer/src/components/composer/AgentMenu.test.tsx › puce de l’agent (fiche 185, D26) › nom gardé dans la puce et dans son infobulle ; l’icône est décorative` + `useBarFold.test.ts` (passage en icône) ; le rendu à 280 px : capture | vert |

### `polices` — réduire

7 vérifications : 5 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 10 s → ≈ 7 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | interface en Inter, chargée depuis l'app | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | code en JetBrains Mono, chargée depuis l'app | parcours | reste | parcours : vraie app nécessaire | — |
| 3 | ligatures du code coupées par défaut (bloc, en ligne, prose) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/appearance.test.ts` › « ligatures du code : coupées par défaut, activées sur demande » — reste hors Vitest : application CSS au code : capture | vert |
| 4 | interrupteur des ligatures coupé par défaut | doublon | retirée | `C/settings/SettingsDialog.test.tsx` › « ligatures du code (fiche 145) : coupées par défaut, un interrupteur les active » | vert |
| 5 | police du code : JetBrains Mono, puis celle du système | doublon | retirée | `C/settings/SettingsDialog.test.tsx` › « polices livrées (fiche 145, D9) : Inter et JetBrains Mono par défaut, celles du système au choix » | vert |
| 6 | ligatures activées, texte inchangé | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/appearance.test.ts` › « ligatures du code : coupées par défaut, activées sur demande » — reste hors Vitest : style calculé : capture | vert |
| 7 | Aurore nuit gardée après le réglage des ligatures (sombre) | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/appearance.test.ts` › « Aurore nuit gardée après le réglage des ligatures (sombre) » | vert |

### `libelles` — réduire

4 vérifications : 3 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 11 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | un seul nom : barre latérale et puce disent le profil, pas « Factice annoncé » | doublon | retirée | `src/main/agent/agent-host.test.ts` › « un seul nom : celui du profil, pas le titre annoncé (recette 0.11, C4) » | vert |
| 2 | options d'autorisation traduites (Autoriser une fois / Refuser) | doublon | retirée | `src/shared/permissions.test.ts` › « genre ACP connu et unique : le libellé de l'app » | vert |
| 3 | nom donné par l'agent en infobulle (« Allow once ») | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/CommandBlock.test.tsx` › chaque bouton porte en infobulle le nom donné par l’agent (libelles n° 3) | vert |
| 4 | dossier récent : nom entier, début coupé, chemin en infobulle, ordre des 3 | composant | reste | partiel : `src/shared/presentation.test.ts` › « le nom du dossier à part, le reste avant, le dossier personnel en ~ » | — |

### `long-thread` — réduire

4 vérifications : 3 retirées (dont 0 à confirmer), 0 creuse(s), 1 restent. Durée (clair + sombre) : 43 s → ≈ 15 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | tâches longues observables | doublon | reste | partiel : `e2e/suites/perf.mjs` › « streaming : aucune tâche > 400 ms » | — |
| 2 | fil de ≥ 300 appels d'outils | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Transcript.test.tsx` › fil de 300 appels d’outils : regroupés en une ligne repliée, pas 300 cartes ouvertes (long-thread n° 2) (fluidité réelle : perf) | vert |
| 3 | outils consécutifs regroupés (30 groupes), résumé par genre | doublon | retirée | `C/thread/Transcript.test.tsx` › « outils consécutifs regroupés, libellés lisibles, dernière capture visible » ; `src/shared/tool-groups.test.ts` › « résumé par genre d'outil et par panneau de l'app ; état du groupe » | vert |
| 4 | cartes lisibles : chemins relatifs, infobulle | doublon | retirée | `C/thread/Transcript.test.tsx` › « outil de l'agent : ce qu'il a fait et sur quoi, chemin relatif au dossier (fiche 107) » | vert |

### `activity` — réduire

14 vérifications : 12 retirées (dont 0 à confirmer), 0 creuse(s), 2 restent. Durée (clair + sombre) : 45 s → ≈ 11 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | patch sans cible : « Prépare une modification… » | composant | retirée | `src/shared/tool-label.test.ts` › « outil annoncé sans rien d'autre : le libellé de son genre, le titre brut en infobulle (fiche 128) » | vert |
| 2 | titre brut en infobulle | composant | retirée | comme n° 1 : `src/shared/tool-label.test.ts` › « outil annoncé sans rien d'autre : le libellé de son genre, le titre brut en infobulle (fiche 128) » | vert |
| 3 | indicateur dit pareil, jamais « patch » | composant | retirée | `src/shared/activity.test.ts` › « un patch annoncé sans cible n'est jamais « patch » » ; `WorkingIndicator.test.tsx` › « fiche 267 (D14) : la durée du tour, l'étape en cours en plus petit » | vert |
| 4 | « patch » absent de tout le fil | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Transcript.test.tsx` › patch annoncé sans cible : jamais « patch » dans le fil, et pas de chronomètre par carte (activity n° 4, 6) | vert |
| 5 | durée du tour en infobulle | composant | retirée | `WorkingIndicator.test.tsx` › « fiche 267 (D14) : la durée du tour, l'étape en cours en plus petit » | vert |
| 6 | aucun chronomètre par carte | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Transcript.test.tsx` › patch annoncé sans cible : jamais « patch » dans le fil, et pas de chronomètre par carte (activity n° 4, 6) | vert |
| 7 | cible arrivée : « Modification de notes.md » | composant | retirée | `src/shared/tool-label.test.ts` › « lecture, modification, suppression, déplacement : d'après le premier emplacement » | vert |
| 8 | le patch se termine | doublon | reste | partiel : `parcours-matinee` étape « autoriser une modification une fois » | — |
| 9 | interrompu sans cible : « Modification · interrompu » | composant | retirée | `src/shared/tool-label.test.ts` › « sans cible, interrompu ou en échec : le nom du genre, la carte dit l'état (C6) » | vert |
| 10 | shell sans commande : « Prépare une commande… » | composant | retirée | `src/shared/tool-label.test.ts` › « « Prépare… » seulement sans cible, sans autorisation en attente, tant qu'il est annoncé » | vert |
| 11 | commande arrivée, la carte la montre | composant | retirée | `src/shared/tool-label.test.ts` › « commande : son texte en code ; le titre en détail s'il en diffère ; sans commande, rien » | vert |
| 12 | sortie JSON indentée, vrais retours à la ligne | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/ToolCall.test.tsx` › sortie JSON d’une commande : indentée, vrais retours à la ligne (activity n° 12) | vert |
| 13 | durée du tour puis étape en plus petit | composant | retirée | **Déjà couvert, vérifié (lot dialogues)** : pour le texte : `src/renderer/src/components/thread/WorkingIndicator.test.tsx` › fiche 267 (D14) : la durée du tour, l’étape en cours en plus petit ; la taille de police reste à la capture | vert |
| 14 | à 720 px, indicateur sur une ligne (≤ 40 px) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |

### `attachments` — réduire

17 vérifications : 14 retirées (dont 0 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 19 s → ≈ 8 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | image collée : vignette dans la saisie | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › image collée : sa vignette dans la saisie (attachments n° 1) | vert |
| 2 | @app : le fichier du dossier est proposé | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › `@app` : le fichier du dossier proposé ; Entrée insère son chemin et le joint (attachments n° 2, 4) (recherche réelle : `src/main/workspace-files.test.ts`) | vert |
| 3 | menu « @ » entier dans la fenêtre (accueil) | composant | retirée | `menu-placement.test.ts` › « opens below on the welcome screen when there is more room under the composer » | vert |
| 4 | Entrée : chemin inséré + fichier joint | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › `@app` : le fichier du dossier proposé ; Entrée insère son chemin et le joint (attachments n° 2, 4) | vert |
| 5 | l'agent reçoit l'image et le contenu du fichier | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | pièces jointes dans le message, saisie vidée | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Transcript.test.tsx` › message envoyé avec pièces jointes : fichier, mention de contexte et image montrés (attachments n° 6, mentions n° 6) ; saisie vidée : `src/renderer/src/components/composer/Composer.test.tsx` › Entrée envoie le message, Maj+Entrée non | vert |
| 7 | fichier glissé sur le fil : indication sur toute la conversation | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/useFileDrop.test.tsx` › au survol : l’indication sur toute la conversation ; partie à la sortie (attachments n° 7) | vert |
| 8 | déposé au milieu du fil : joint, indication retirée | parcours | reste | parcours : vraie app nécessaire | — |
| 9 | déposé sur la saisie : toujours joint | doublon | reste | partiel : `Composer.test.tsx` › « image déposée avec un chemin… » | — |
| 10 | fichier exclu : confirmation, pas encore joint | composant | retirée | `Composer.test.tsx` › « fichier exclu par l'agent : confirmation avant de le joindre » | vert |
| 11 | « Ne pas joindre » : rien de joint | composant | retirée | comme n° 10 : `Composer.test.tsx` › « fichier exclu par l'agent : confirmation avant de le joindre » | vert |
| 12 | « Joindre quand même » : joint | composant | retirée | comme n° 11 : comme n° 10 : `Composer.test.tsx` › « fichier exclu par l'agent : confirmation avant de le joindre » | vert |
| 13 | texte long collé : puce « Texte collé (45 lignes) » | composant | retirée | `Composer.test.tsx` › « long texte collé : une puce, qui part en pièce jointe ; un texte court reste dans la saisie » | vert |
| 14 | texte court laissé à la saisie | composant | retirée | comme n° 13 : `Composer.test.tsx` › « long texte collé : une puce, qui part en pièce jointe ; un texte court reste dans la saisie » | vert |
| 15 | l'agent reçoit le texte collé en bloc annoncé | unitaire-main | retirée | `src/main/agent/prompt-content.test.ts` › « bloc de texte à part, annoncé, même sans embeddedContext ; montré dans le fil » | vert |
| 16 | fil : puce du texte collé dans le message | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Transcript.test.tsx` › texte collé envoyé : sa puce dans le message, son aperçu à l’ouverture (attachments n° 16) | vert |
| 17 | « Remettre dans la saisie » | composant | retirée | `Composer.test.tsx` › « aperçu du texte collé, puis remis dans la saisie » | vert |

### `discussion` — réduire

16 vérifications : 10 retirées (dont 0 à confirmer), 0 creuse(s), 6 restent. Durée (clair + sombre) : 12 s → ≈ 7 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | lancement : espace Code sélectionné | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/discussion/Discussion.test.tsx` › lancement : l’espace Code sélectionné, Discussion à un clic (discussion n° 1) | vert |
| 2 | accueil discussion : ni dossier, ni branche, ni Équipe ; « Nouvelle discussion » | composant | reste | partiel : `Sidebar.test.tsx` › même test | — |
| 3 | document déposé copié, original intact | unitaire-main | retirée | `src/main/conversations/discussion-space.test.ts` › « documents : fichiers visibles du premier niveau ; copies numérotées, originaux intacts » | vert |
| 4 | écriture accordée dans les documents, refusée ailleurs, chacune dite | parcours | reste | parcours : vraie app nécessaire | — |
| 5 | carte du document créé | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/discussion/Discussion.test.tsx` › document créé pendant le tour : sa carte, nom et genre, « Ouvrir » avec son app (discussion n° 5) | vert |
| 6 | rien écrit hors du dossier | unitaire-main | retirée | `manager-discussion.test.ts` › « agent factice `discussion-document`… » | vert |
| 7 | panneau « Documents » : 2 documents, aperçu du plus récent | composant | reste | partiel : `documents/ipc.test.ts` › « aperçu : texte, image, texte d'un document Word, sinon rien » | — |
| 8 | onglet Session : « Cette discussion », sans identifiant | composant | retirée | `SessionTab.test.tsx` › « « Documents : Cette discussion », jamais l'identifiant ni le chemin ; s'affiche dans le Finder » | vert |
| 9 | onglet Modifications : ni vue Git ni « dernier commit » | composant | retirée | `ChangesTab.test.tsx` › « ses documents, jamais l'état git ni « depuis le dernier commit » » | vert |
| 10 | fil : jamais l'identifiant du dossier | composant | retirée | `src/shared/tool-label.test.ts` › « discussion (fiche 224) : le dossier se dit « Documents », en libellé comme en infobulle » | vert |
| 11 | autorisation en clair, commande repliée sous « Détails techniques » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/CommandBlock.test.tsx` › discussion : l’autorisation en clair, la commande repliée sous « Détails techniques » (discussion n° 11) | vert |
| 12 | commande : dossier « Documents », jamais l'identifiant | composant | reste | partiel : tool-label.test (même test que 10) | — |
| 13 | fichier à plusieurs noms : carte avec la raison | parcours | reste | parcours : vraie app nécessaire | — |
| 14 | refusé : fichier extérieur intact | parcours | reste | parcours : vraie app nécessaire | — |
| 15 | « Continuer dans un projet » : documents copiés par défaut | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/discussion/Discussion.test.tsx` › « Continuer dans un projet » : documents copiés par défaut (case cochée) (discussion n° 15) | vert |
| 16 | espace Code : les discussions n'y sont pas | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/sidebar/Sidebar.test.tsx` › espace Code : les discussions n’y sont pas (discussion n° 16) | vert |

### `fun` — réduire

10 vérifications : 6 retirées (dont 0 à confirmer), 0 creuse(s), 4 restent. Durée (clair + sombre) : 15 s → ≈ 9 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | plus de compteur de bobcoins dans la barre latérale | composant | reste | aucun remplaçant écrit | — |
| 2 | thème Aurore / Nuit noire : `--bg` attendu | composant | retirée | **oui, remplaçant créé** (2026-11-24) : `R/appearance.test.ts` › « Nuit noire en sombre : `data-palette` posé ; l’accent retiré « Comme le Mac » devient l’orange » ; `R/appearance.test.ts` › « Aurore en clair, Fjord en clair : la palette suit le thème du mode affiché » — reste hors Vitest : couleur réelle : capture | vert |
| 3 | police du code : Menlo / DejaVu Sans Mono | parcours | reste | parcours : vraie app nécessaire | — |
| 4 | accueil : salutation selon l'heure, avec le prénom | composant | reste | aucun remplaçant écrit | — |
| 5 | suggestion : texte dans la saisie, rien envoyé | composant | reste | aucun remplaçant écrit | — |
| 6 | sommaire : un trait par message | doublon | retirée | `outline-layout.test.ts` › « peu de messages : un trait chacun, écart habituel » | vert |
| 7 | sommaire : clic → message affiché, trait courant | doublon | retirée | `parcours-longue.mjs` › « le troisième message est à l'écran, le fil n'est plus en bas » | vert |
| 8 | bobcoins : coût de la conversation | composant | retirée | `UsageMeter.test.tsx` › « agent qui ne donne que son coût (comme Bob) : la puce montre le coût, lignes sans jetons » | vert |
| 9 | Bobcoins aujourd'hui / 7 jours / mois dans « Mon activité » | unitaire-main | retirée | `src/main/agent/bob-costs.test.ts` › « tâches utilisées aujourd'hui, sur sept jours, ce mois-ci ; lignes douteuses ignorées » ; `ActivityPage.test.tsx` › « IBM Bob sur ce Mac : quota du mois et dépense, venus des canaux génériques » | vert |
| 10 | budget dépassé : titre et description de Bob | unitaire-main | retirée | `src/main/agent/process-utils.test.ts` › « erreur de budget de Bob : titre et description au lieu de « Internal error » » | vert |

### `mentions` — supprimer entièrement (étape 1 : réduire)

6 vérifications : 6 retirées (dont 1 à confirmer), 0 creuse(s), 0 restent. Durée (clair + sombre) : 29 s → ≈ 0 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | menu « @ » : fichier exclu (.bobignore) non proposé | unitaire-main | retirée | `src/main/workspace-files.test.ts` › « un fichier exclu n'est pas proposé, la limite compte les autres » | vert |
| 2 | @git-changes et @terminal en pièces jointes | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/composer/Composer.test.tsx` › `@git-changes` et `@terminal` : proposés, joints en pièces jointes de contexte (mentions n° 2) | vert |
| 3 | à l'envoi : état et diff git joints | unitaire-main | retirée | `src/main/changes/git-context.test.ts` › « état et diff depuis le dernier commit, fichiers non suivis listés » ; `prompt-content.test.ts` › « @git-changes, @terminal (fiche 057) : contenu lu à l'envoi, joint en texte » | vert |
| 4 | @git-changes : fichier exclu sauté, et dit | unitaire-main | retirée | `git-context.test.ts` › « saute les fichiers exclus, dans l'état et le diff, et le dit » | vert |
| 5 | à l'envoi : dernières lignes du terminal jointes | parcours | retirée | **parcours-outils › étape 1** — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 6 | fil : pièces jointes montrées | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Transcript.test.tsx` › message envoyé avec pièces jointes : fichier, mention de contexte et image montrés (attachments n° 6, mentions n° 6) | vert |

### `notifications` — réduire

15 vérifications : 12 retirées (dont 0 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 12 s → ≈ 6 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | fenêtre sans focus : notification pour une autorisation | parcours | reste | parcours : vraie app nécessaire | — |
| 2 | un son (Glass) pour la demande | unitaire-main | retirée | `attention.test.ts` › « un son pour une action attendue, fenêtre sans focus ; pas pour une réponse finie » | vert |
| 3 | Dock rebondit (`critical`) | unitaire-main | retirée | `attention.test.ts` › « un agent attend : un rebond `critical`, quelle que soit la demande » | vert |
| 4 | badge du Dock : 1 | unitaire-main | retirée | `src/main/notifications/dock-badge.test.ts` › « le nombre « À traiter », posé seulement quand il change, effacé à zéro » | vert |
| 5 | retour dans la fenêtre : le rebond s'arrête | unitaire-main | retirée | `attention.test.ts` › « le retour dans la fenêtre arrête le rebond ; la demande suivante rebondit de nouveau » | vert |
| 6 | fin de réponse : notification avec sa conclusion sans Markdown | unitaire-main | retirée | `attention.test.ts` › « fin de tour hors de la fenêtre : notification avec la fin de la réponse, pastille » ; « retire le Markdown visible et garde la fin d'une longue réponse » | vert |
| 7 | fin de réponse : pas de son | unitaire-main | retirée | `attention.test.ts` › « un son pour une action attendue… » | vert |
| 8 | fin de réponse : un rebond `informational` | unitaire-main | retirée | `attention.test.ts` › « réponse finie : un rebond `informational` ; erreur aussi (mêmes moments qu'une notification) » | vert |
| 9 | réponse non lue : badge toujours à 1 | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/notifications/system-notifier.test.ts › appAttention : un refus des notifications ne coupe ni le Dock ni son compteur › macOS refuse la bannière : le Dock rebondit quand même, le compteur passe à 1 et y reste` | vert |
| 10 | clic sur la notification : sa conversation s'affiche | parcours | reste | parcours : vraie app nécessaire | — |
| 11 | conversation vue : pastille et badge effacés | unitaire-main | retirée | `attention.test.ts` › « vue en revenant dans la fenêtre : la pastille et les notifications disparaissent » | vert |
| 12 | coupées : ni notification ni badge, l'icône reste | unitaire-main | retirée | `attention.test.ts` › « réglage coupé : pas de notification, les pastilles restent » ; `dock-badge.test.ts` › « réglage coupé : effacé, et rien tant qu'il l'est » | vert |
| 13 | coupées : pas de rebond | unitaire-main | retirée | `attention.test.ts` › « la cloche et le réglage coupent le rebond ; le son, lui, reste » | vert |
| 14 | refus de macOS : cloche en alerte, explication, lien | parcours | reste | parcours : vraie app nécessaire | — |
| 15 | refus de macOS : le Dock rebondit quand même | unitaire-main | retirée | **remplaçant écrit (2026-11-24)** : `src/main/notifications/system-notifier.test.ts › appAttention : un refus des notifications ne coupe ni le Dock ni son compteur › macOS refuse la bannière : le Dock rebondit quand même, le compteur passe à 1 et y reste` | vert |

### `parcours-longue` — garder (journée type)

10 vérifications : 0 retirées (dont 0 à confirmer), 0 creuse(s), 10 restent. Durée (clair + sombre) : 116 s → ≈ 116 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | 36 messages, le fil suit le dernier | parcours | reste | journée type : reste entière | — |
| 2 | le sommaire a tous les messages | composant | reste | journée type : reste entière | — |
| 3 | clic sommaire : 3ᵉ message à l'écran, plus en bas | parcours | reste | journée type : reste entière | — |
| 4 | envoi depuis le haut : retour en bas, réponse visible | parcours | reste | journée type : reste entière | — |
| 5 | étroite puis large : rien ne déborde, saisie et dernier message visibles | parcours | reste | journée type : reste entière | — |
| 6 | panneau ouvert puis fermé : dernier message gardé | parcours | reste | journée type : reste entière | — |
| 7 | autre conversation puis retour : dernier message à l'écran | parcours | reste | journée type : reste entière | — |
| 8 | app quittée | parcours | reste | journée type : reste entière | — |
| 9 | relance : tous les messages, le dernier à l'écran | parcours | reste | journée type : reste entière | — |
| 10 | relance : le long fil continue | parcours | reste | journée type : reste entière | — |

### `parcours-pannes` — garder (journée type)

9 vérifications : 0 retirées (dont 0 à confirmer), 0 creuse(s), 9 restent. Durée (clair + sombre) : 98 s → ≈ 98 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | deux conversations | parcours | reste | journée type : reste entière | — |
| 2 | un avis de panne, avec le code de sortie | parcours | reste | journée type : reste entière | — |
| 3 | l'autre conversation : aucun avis, elle répond | parcours | reste | journée type : reste entière | — |
| 4 | écrire relance l'agent planté, le fil est gardé | parcours | reste | journée type : reste entière | — |
| 5 | bandeau de silence, « Arrêter », puis la suite | parcours | reste | journée type : reste entière | — |
| 6 | erreur de tour dite, la conversation continue | parcours | reste | journée type : reste entière | — |
| 7 | quitté pendant le tour | parcours | reste | journée type : reste entière | — |
| 8 | relance : la conversation interrompue reprend | parcours | reste | journée type : reste entière | — |
| 9 | l'autre a gardé ses pannes et répond | parcours | reste | journée type : reste entière | — |

### `pinned-plan` — réduire

9 vérifications : 4 retirées (dont 0 à confirmer), 0 creuse(s), 5 restent. Durée (clair + sombre) : 14 s → ≈ 10 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | épinglée juste au-dessus de la saisie (8 px) | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 2 | en-tête « Liste des tâches 1 / 3 » | composant | retirée | `PinnedPlan.test.tsx` › « dépliée : titre, progression, tâche en cours marquée et qui tourne » | vert |
| 3 | tâche en cours marquée, son cercle tourne | composant | retirée | comme n° 2 : `PinnedPlan.test.tsx` › « dépliée : titre, progression, tâche en cours marquée et qui tourne » | vert |
| 4 | tâches faites grisées, pas barrées | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 5 | pendant le tour : ni carte « Plan » ni compteur | composant | reste | partiel : `PinnedPlan.test.tsx` › « masquée pendant le tour, montrée sinon » | — |
| 6 | fil remonté : liste en place, flèche « Aller en bas » au-dessus | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 7 | repliée d'un clic : une ligne, tâche, « 1 / 3 » | composant | retirée | `PinnedPlan.test.tsx` › « repliée d'un clic sur une ligne, et retenue » | vert |
| 8 | à côté : liste épinglée, pas de carte « Plan » | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/BesidePane.test.tsx` › pendant le tour : la liste épinglée au-dessus de sa saisie, pas de carte « Plan » dans le fil (pinned-plan n° 8) | vert |
| 9 | fin du tour : liste retirée, carte « Plan » et compteur « 3 / 3 » | composant | reste | partiel : `PinnedPlan.test.tsx` › « épinglé tant que l'agent travaille, et s'il y a des tâches » | — |

### `presentation` — réduire

13 vérifications : 2 retirées (dont 0 à confirmer), 0 creuse(s), 11 restent. Durée (clair + sombre) : 10 s → ≈ 9 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | densité normale : 18 px entre messages | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 2 | compacte : jeton `--density-thread-gap` = 10px | composant | retirée | `themes.test.ts` › « la densité compacte resserre chaque espace, sans jamais en agrandir un » | vert |
| 3 | compacte : 10 px entre messages | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 4 | compacte : lignes de la barre latérale à 4 px | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 5 | barre latérale : retrait à gauche inchangé | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 6 | pastille absente au lancement | composant | reste | partiel : `src/main/presentation.test.ts` › « inactif au lancement, prévient seulement quand l'état change » | — |
| 7 | menu Affichage : « Mode présentation » décoché | unitaire-main | retirée | `src/main/menu.test.ts` › « Affichage › Mode présentation : case cochée selon l'état (fiche 159) » | vert |
| 8 | texte du fil agrandi de 3 px | composant | reste | aucun remplaçant écrit | — |
| 9 | menu coché, synchronisé avec les Réglages | parcours | reste | parcours : vraie app nécessaire | — |
| 10 | pastille de rappel affichée | composant | reste | aucun remplaçant écrit | — |
| 11 | quota et montants masqués | composant | reste | partiel : `TurnSummary.test.tsx` › « mode présentation : pas de montant » | — |
| 12 | détail de la consommation : aucun coût | composant | reste | partiel : `src/shared/usage.test.ts` › « sans coût nulle part : rien ; mode présentation : aucun montant » | — |
| 13 | pastille : quitte le mode, texte et menu rétablis | parcours | reste | parcours : vraie app nécessaire | — |

### `questions` — réduire

15 vérifications : 10 retirées (dont 0 à confirmer), 0 creuse(s), 5 restent. Durée (clair + sombre) : 11 s → ≈ 7 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Maj+Tab : mode suivant | composant | retirée | `Composer.test.tsx` › « mode Plan (fiche 098) : zone teintée, invite et ligne de rappel, Maj+Tab vers le mode suivant » | vert |
| 2 | la carte de questions remplace l'appel d'outil | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Transcript.test.tsx` › question posée par un outil : la carte de questions à la place de l’appel d’outil (questions n° 2) | vert |
| 3 | options numérotées avec description | composant | retirée | `QuestionCard.test.tsx` › « choix unique : un clic répond et envoie ; la carte a le focus clavier » | vert |
| 4 | touche 2 : option choisie, question suivante | composant | retirée | `QuestionCard.test.tsx` › « clavier : le chiffre de l'option choisit, ↓ puis Entrée aussi » ; « plusieurs questions : onglets, passage à la suivante, envoi groupé » | vert |
| 5 | réponses envoyées (unique, multiple, « Autre ») | composant | retirée | `src/shared/questions.test.ts` › « answerContent : choix, cases cochées, texte libre ; rien pour une question passée » | vert |
| 6 | résumé « question → réponse » dans le fil | composant | retirée | `ElicitationCard.test.tsx` › « après la réponse : résumé dans le fil » | vert |
| 7 | OpenCode 2 : outil question en questionnaire | composant | retirée | `questions.test.ts` › « forme d'OpenCode 2.0.31 (outil question) : q0 et q0_custom (fiche 078) » | vert |
| 8 | plan affiché en clair avant validation | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/PlanApproval.test.tsx` › le plan en clair, rendu en Markdown, avant les choix ; la carte a le focus (questions n° 8) | vert |
| 9 | touche 3 : « No, keep planning » transmis | composant | reste | partiel : `src/mock-agent/mock-agent.test.ts` › « plan-a-valider : « continuer à planifier » ne change pas de mode » | — |
| 10 | plan approuvé → mode Code | composant | reste | partiel : `mock-agent.test.ts` › « plan-a-valider : plan approuvé → mode code » | — |
| 11 | question obligatoire : « Envoyer » attend | composant | retirée | `QuestionCard.test.tsx` › « question obligatoire sans réponse : « Envoyer » reste inactif » ; `questions.test.ts` › « question obligatoire au format générique : `required`, « Autre » en `<clé>_custom` » | vert |
| 12 | plan (`rawInput.plan`) affiché | composant | reste | partiel : `src/shared/transcript.test.ts` › « plan à valider porté par rawInput.plan (cas réel Codex) ; réponse au formulaire conservée » | — |
| 13 | plan approuvé | doublon | retirée | `mock-agent.test.ts` › « plan-a-valider : plan approuvé → mode code » | vert |
| 14 | ask_user (MCP) : carte de questions, sans autorisation | parcours | reste | parcours : vraie app nécessaire | — |
| 15 | ask_user : la réponse revient comme résultat d'outil | parcours | reste | parcours : vraie app nécessaire | — |

### `relecture` — réduire

10 vérifications : 7 retirées (dont 0 à confirmer), 0 creuse(s), 3 restent. Durée (clair + sombre) : 17 s → ≈ 9 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | Modifications d'un dossier git : « Faire relire… » | composant | reste | partiel : `parcours-matinee` étape « faire relire par le Code reviewer » | — |
| 2 | dialogue : Code reviewer, non commité, autre modèle, coût | composant | retirée | `ReviewDialog.test.tsx` › « un autre modèle proposé d'office, dit ; il part avec la relecture » | vert |
| 3 | en cours : bulle « @Code reviewer Relis … », carte dessous, Arrêter | composant | retirée | `WorkReview.test.tsx` › « en cours : la bulle « @Code reviewer Relis … » et sa carte, sans remarque encore » | vert |
| 4 | remarques, avis, « corriger », « Voir sur le diff », « Répondre » | composant | retirée | `WorkReview.test.tsx` › « remarques visibles, rangées par gravité ; avis d'ensemble ; réponse repliée » ; « « Répondre à Code reviewer » et « Ouvrir sa conversation » » | vert |
| 5 | dossier relu intact | unitaire-main | reste | partiel : `src/main/conversations/children-review.test.ts` › « un relecteur qui écrit dans le dossier est signalé ; un relecteur muet aussi » | — |
| 6 | clic `fichier:ligne` : vue Git, remarque sous sa ligne, gravité | composant | retirée | `WorkReview.test.tsx` › « un clic sur `fichier:ligne` et « Voir sur le diff » ouvrent la vue Git de la conversation relue » ; `ChangesTab.test.tsx` › « remarques de diff : celles qui relisent cette conversation, pas un travail relu dans son fil » | vert |
| 7 | la ligne mise en avant, à l'écran | composant | retirée | `ChangesTab.test.tsx` › « sa ligne, si le diff la contient : amenée à l'écran et mise en avant ; sinon le fichier ouvert » | vert |
| 8 | remarques du diff dans la largeur visible | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 9 | corriger : message nommant le relecteur ; transmise | composant | retirée | `WorkReview.test.tsx` › « « Demander à OpenCode de corriger » : message qui nomme le relecteur, sa réponse visée à part » ; « transmise : plus de « corriger » ; « Voir sur le diff » reste » | vert |
| 10 | relecteur : la demande, consigne repliée | composant | retirée | `RoleWork.test.tsx` › « premier message : la demande seule, la consigne du rôle repliée sous « Consigne du rôle » » | vert |

### `sommaire` — réduire

8 vérifications : 4 retirées (dont 2 à confirmer), 0 creuse(s), 4 restent. Durée (clair + sombre) : 104 s → ≈ 54 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | colonne de traits dans sa hauteur max | composant | retirée | `outline-layout.test.ts` › « hauteur maximale : 30 % du fil, 240 px au plus » | vert |
| 2 | 80 messages, 20 à 79 traits | composant | retirée | `outline-layout.test.ts` › « beaucoup : un trait pour plusieurs messages, tous couverts une fois, dans la hauteur » | vert |
| 3 | la liste au survol garde les 80 messages | composant | reste | aucun remplaçant écrit | — |
| 4 | en bas : le dernier trait est le courant | parcours | retirée | **parcours-longue › étape 2** — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 5 | en haut : le premier trait est le courant | parcours | reste | parcours : vraie app nécessaire | — |
| 6 | au 41ᵉ message : le trait courant le couvre | parcours | reste | parcours : vraie app nécessaire | — |
| 7 | la liste s'ouvre sur le message lu | capture | retirée | **parcours-longue › étape 2** (capture qui affirme `277-longue-sommaire-liste`) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 8 | fenêtre basse : la colonne raccourcit | composant | reste | partiel : `outline-layout.test.ts` › « hauteur maximale : 30 % du fil, 240 px au plus » | — |

### `tables` — réduire

10 vérifications : 3 retirées (dont 2 à confirmer), 0 creuse(s), 7 restent. Durée (clair + sombre) : 17 s → ≈ 13 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | alignements Markdown respectés, gauche par défaut | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Markdown.test.tsx` › tableau : alignements Markdown respectés, rien d’imposé sans alignement | vert |
| 2 | pas de grille : lignes horizontales seules | capture | retirée | **parcours-longue › étape 4** (capture qui affirme `276-longue-etroite`) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 3 | tableau large : reste dans le fil, défile | capture | retirée | **parcours-longue › étape 4** (capture qui affirme `276-longue-etroite`) — remplaçant écrit, à jouer sur GitHub | à confirmer |
| 4 | police du fil : celle de l'app | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 5 | titres proportionnés au texte | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 6 | trait « --- » fin | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 7 | citation : filet à gauche | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 8 | cases à cocher sans puce en plus | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 9 | blocs de code : fond et coloration de la palette | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |
| 10 | blocs de code dans l'autre variante : ses couleurs | capture | reste | capture : mesure (`affirm`) à garder dans la suite réduite | — |

### `touches` — supprimer entièrement

8 vérifications : 8 retirées (dont 0 à confirmer), 0 creuse(s), 0 restent. Durée (clair + sombre) : 21 s → ≈ 0 s.

| # | Vérification | Classe | Sort | Remplaçant exact, ou raison | État |
|---|---|---|---|---|---|
| 1 | copier un bloc de code : le presse-papiers | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Markdown.test.tsx` › « Copier » d’un bloc de code : son texte exact dans le presse-papiers | vert |
| 2 | copier la réponse : le Markdown complet | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/ThreadExtras.test.tsx` › copier la réponse : le Markdown complet, pas le texte rendu | vert |
| 3 | heure du message et de la réponse | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/components/thread/Transcript.test.tsx` › heure du message et de la réponse, en `<time>` avec la date complète en infobulle (touches n° 3) | vert |
| 4 | couleur d'accent bleu appliquée | composant | retirée | `SettingsDialog.test.tsx` › « huit thèmes, six accents : chaque choix part dans les préférences ; Aurore « Nouveau » » ; `themes.test.ts` › « les accents sont ceux des préférences » | vert |
| 5 | largeur du fil : large (960px) | composant | retirée | **Remplaçant écrit (lot dialogues)** : `src/renderer/src/appearance.test.ts` › étroite, normale, large : 640, 740, 960 px | vert |
| 6 | nouvelle conversation : démarre en mode Plan | unitaire-main | retirée | `src/main/conversations/manager.test.ts` › « réglages d'une nouvelle conversation : agent, dossier et mode imposés » | vert |
| 7 | archivée : hors « Récents », dans « Archivées », repliée, sans compteur | composant | retirée | `Sidebar.test.tsx` › « dans l'ordre : Épinglées, Récents, Archivées (repliée) ; vides absentes » | vert |
| 8 | quitter pendant une réponse : confirmation, « Annuler » garde l'app | unitaire-main | retirée | `src/main/quit-guard.test.ts` › « un agent travaille : question ; « Annuler » garde l'app, « Quitter » redemande de quitter » | vert |

## Pas encore remplaçable

Vérifications qui ne sont ni `parcours` ni `capture`, et dont le remplaçant n'existe pas ou ne
couvre qu'une partie du contrat. **Elles restent** dans leur suite. Raison : ce qui manque, puis
le remplaçant proposé par l'inventaire.

| Suite | # | Vérification | Classe | Raison (ce qui existe déjà) | Remplaçant proposé |
|---|---|---|---|---|---|
| `queue` | 5 | message modifié : il garde sa place | unitaire-main | partiel : `message-queue.test.ts › un message modifié reprend sa place ; supprimé, non (fiche 247, D12)` (logique seule, pas le chemin renderer→IPC) | garder `message-queue.test.ts` ; ajouter le lien renderer (« Modifier » renvoie avec la place) dans `Composer.test.tsx` |
| `rules` | 1 | menu ouvert d'emblée à sa place (côtés relevés image par image) | composant | partiel : `SessionSettingsMenu.test.tsx › s’affiche une fois les règles lues, à sa taille, pas avant (fiche 082)` ; `menu-placement.test.ts › opens above the composer when the whole menu fits there (conversation view)` — le positionnement Radix réel n'est pas vu | `SessionSettingsMenu.test.tsx` (existant) + `menu-placement.test.ts` |
| `rules` | 2 | règles du projet, personnelles et du mode actif ; pas celles d'un autre mode | composant | partiel : `rules.test.ts › Bob : AGENTS.md du dossier, rules/ et rules-<mode>/ du projet, des greffons et de ~/.bob` ; `manager.test.ts › règles actives : selon le mode, lisibles en aperçu même hors du dossier ; rien d’autre (fiche 056)` (main) — libellés de portée affichés : non | `SessionSettingsMenu.test.tsx` (libellés de portée `rules.scope.*`, `rules.scopeWithMode`) |
| `profil` | 31 | lecture seule : « Nouvelle conversation » désactivée | composant | aucun remplaçant écrit | `Sidebar.test.tsx` (nouvel `it`) |
| `profil` | 32 | la saisie est inerte, la raison dessous | composant | aucun remplaçant écrit | `Composer.test.tsx` (nouvel `it`) |
| `profil` | 34 | menus : épingler, renommer, archiver, supprimer désactivés (raison en infobulle) ; exporter permis | composant | aucun remplaçant écrit | `Sidebar.test.tsx` (menu ⋯ en lecture seule) |
| `profil` | 36 | Mon activité : la lecture seule est dite | composant | aucun remplaçant écrit | `ActivityPage.test.tsx` (nouvel `it`) |
| `profil` | 37 | Tâches planifiées : la lecture seule est dite | composant | aucun remplaçant écrit | test du composant Tâches planifiées (à créer) |
| `settings` | 3 | barre latérale : raccourcis ⌘1, ⇧⌘U (ou Ctrl) | composant | partiel : `Sidebar.test.tsx › « Mon activité » sous « Nouvelle conversation », ⇧⌘U, en surbrillance quand ouverte` ; `key-notation.test.ts › ailleurs : Ctrl, Alt, Maj dans cet ordre, ⌘ et ⌃ donnent Ctrl` (⌘1 de l'espace : non) | `Sidebar.test.tsx` |
| `settings` | 4 | ⌥⌘↑ / ⌥⌘↓ : conversation précédente, suivante | composant | partiel : `menu.test.ts › chaque raccourci est dans le menu, une seule fois, et envoie sa commande` (envoi seul) | test de `goTo` d'`App.tsx` (à extraire et tester) |
| `settings` | 6 | ⌘B barre latérale, ⌘L zone de saisie | composant | partiel : `menu.test.ts › chaque raccourci est dans le menu, une seule fois, et envoie sa commande` | `useMenuCommands.test.ts` ou test d'`App` |
| `settings` | 16 | navigateur : « Effacer » vide les cookies et le dit | unitaire-main | remplaçant partiel : reste hors Vitest : vraie pile de Chromium : e2e | test du gestionnaire IPC d'effacement (session factice) + note en composant |
| `settings` | 35 | taille du texte du terminal appliquée | composant | aucun remplaçant écrit | test du panneau Terminal (option `fontSize` transmise à xterm) |
| `settings` | 36 | ⇧⌘D modifications, ⌘J panneau de droite | composant | partiel : `menu.test.ts › chaque raccourci est dans le menu, une seule fois, et envoie sa commande` | test d'`App` / `useMenuCommands.test.ts` |
| `settings` | 39 | bouton ☰ : menu de Bobine, raccourcis en Ctrl (Linux) | composant | remplaçant partiel : reste hors Vitest : fenêtre sans barre de menu, accélérateurs natifs : e2e Linux | `AppMenu.test.tsx` (rendu du modèle) |
| `mcp` | 2 | Toutes les familles d'outils (iOS selon la plateforme) | unitaire-main | partiel : `src/main/mcp/catalog.test.ts › toutes les familles, dans l’ordre où l’agent les reçoit, questions en tête` (pas le filtrage par plateforme, `FEATURES.simulator`) | `src/main/mcp/catalog.test.ts` (+ cas plateforme sans simulateur) |
| `mcp` | 3 | Nombre de l'onglet = somme des cartes (> 40) | composant | partiel : `McpSettings.test.tsx › premier onglet, choisi par défaut…` (compte de l'onglet, une famille de fixture) | `McpSettings.test.tsx` (somme sur plusieurs familles) |
| `mcp` | 4 | Conditions et accords (pastille orange sauf questions) | composant | partiel : `McpSettings.test.tsx › une carte par famille : titre, nombre, phrase, condition, accord ; repliée` ; `src/main/mcp/catalog.test.ts › textes : une clé française et anglaise pour chaque titre, phrase, condition et accord` | `McpSettings.test.tsx` |
| `mcp` | 7 | Carte dépliée : noms en chasse fixe, description au survol | composant | partiel : `McpSettings.test.tsx › dépliée : les noms des outils, avec la description de l’agent au survol` (pas la police) | `McpSettings.test.tsx` (police mono → capture) |
| `mcp` | 8 | Serveur déjà déclaré dans le fichier de Bob : listé | unitaire-main | partiel : `src/main/agent-config/mcp-files.test.ts › ajout, désactivation, renommage, suppression ; champs inconnus gardés` (liste à l'écran non testée) | `src/main/agent-config/mcp-files.test.ts` + liste dans `McpSettings.test.tsx` (à créer) |
| `mcp` | 10 | Nom invalide refusé avec un message | composant | partiel : `src/shared/mcp.test.ts › vérifié et nettoyé selon le transport` (règle ; message à l'écran non) | `McpSettings.test.tsx` (formulaire, à créer) |
| `mcp` | 14 | Portée changée : déplacé dans `opencode.json` du dossier | unitaire-main | partiel : `mcp-files.test.ts › sans fichier : opencode.json créé ; projet cherché jusqu’à la racine git` (pas le déplacement) | `mcp-ipc.test.ts` ou `McpSettings.test.tsx` (déplacement, à créer) |
| `mcp` | 15 | Premier clic : confirmation dans la ligne, rien supprimé | composant | aucun remplaçant écrit | `McpSettings.test.tsx` (à créer) |
| `mcp` | 18 | « Tester » : joignable, serveur, outils, prompts | composant | partiel : `src/main/agent-config/mcp-probe.test.ts › commande locale : serveur, outils sur deux pages, prompts ; répond à ses requêtes` (la sonde, pas l'affichage) | `McpSettings.test.tsx` (rendu du résultat, à créer) |
| `mcp` | 19 | « Tester » : noms des outils au survol | composant | aucun remplaçant écrit | `McpSettings.test.tsx` (à créer) |
| `mcp` | 20 | « Tout tester » : cause utile sur la ligne (module introuvable) | composant | partiel : `mcp-probe.test.ts › erreurs lisibles : serveur qui s’arrête (avec sa sortie), muet, introuvable, adresse fausse` (sortie jointe, pas la ligne affichée) | `McpSettings.test.tsx` (à créer) |
| `mcp` | 22 | Pastilles : joignable, en erreur, désactivé | composant | aucun remplaçant écrit | `McpSettings.test.tsx` (à créer) |
| `mcp` | 27 | Menu ⚙ › « Voir les outils » : onglet « Bobine » | composant | partiel : `SessionSettingsMenu.test.tsx › Serveurs MCP : …` (`onOpenMcpSettings('bobine')`) ; le passage App → Réglages non | `SessionSettingsMenu.test.tsx` + `McpSettings.test.tsx` |
| `mcp` | 28 | Menu ⚙ › un serveur : onglet de l'agent | composant | partiel : `McpSettings.test.tsx › ouvert sur l’onglet d’un agent (menu ⚙) : ses serveurs, sans les cartes de Bobine` | `McpSettings.test.tsx` |
| `mcp` | 29 | Réglages refermés : l'app répond encore (`pointer-events`) | composant | partiel : `src/renderer/src/components/common/menus-modal.test.ts › are all non-modal: a modal Radix menu that opens a dialog leaves the page unclickable` (garde statique de la cause, pas le comportement Radix réel) | — |
| `mcp` | 31 | Poids estimé de chaque famille (navigateur ≈ 1000–3000) | unitaire-main | partiel : `catalog.test.ts › poids estimé : environ 4 caractères par jeton des définitions envoyées par `tools/list`` | `catalog.test.ts` (borne sur la famille navigateur) |
| `mcp` | 35 | Menu ⚙ : N maintenant, N − navigateur au prochain démarrage | composant | partiel : `catalog.test.ts › menu ⚙ : outils et poids de la session, et ce que recevra la prochaine` (côté main) | `SessionSettingsMenu.test.tsx` (`session-app-tools-next`, à créer) |
| `regles-approbation` | 11 | Ligne de réponse : « Toujours dans cette conversation », « Gérer » souligné | composant | partiel : `PermissionCardExtras.test.tsx › ligne de réponse : même libellé que le bouton choisi (recette QA)` | `PermissionCardExtras.test.tsx` (soulignement → capture) |
| `degrade-haut` | 4 | Fil rouvert par la fin : premier message pas encore rendu | composant | partiel : `useEntryWindow.test.ts › fil vide, puis arrivée du fil : ouvert par la fin` | `src/renderer/src/components/thread/useEntryWindow.test.ts` |
| `browser-annotate` | 4 | le script de l'app est dans la page | doublon | partiel : `parcours-outils.mjs` étape 3 (attente implicite) ; `src/main/browser/page-layer.test.ts` › « mode Annoter : monde isolé, binding limité à ce monde, script, puis départ » | parcours-outils, étape 3 (l'attend, sans `check`) |
| `browser-annotate` | 6 | curseur en croix sur la page | unitaire-main | remplaçant partiel : (cascade de jsdom ; celle d’une vraie page reste vue en e2e) | `src/main/browser/page-layer.test.ts` (à ajouter) — la cascade CSS réelle de la page n'y serait pas vue |
| `browser-annotate` | 13 | Échap dans la bulle : remarque abandonnée, mode continue | composant | remplaçant partiel : le retour de la vue native reste e2e (#9 | `PageAnnotator.test.tsx` (à créer) — le retour de la vue native n'y serait pas vu |
| `browser-annotate` | 22 | capture 1 : bas de page (défilée de 0 × 1300), remarque 3 | unitaire-main | remplaçant partiel : (le défilement réel de Chromium reste e2e) | `src/shared/page-notes.test.ts` |
| `browser-annotate` | 23 | capture 2 : zoom 150 %, point (120, 144) en px CSS, remarques 1, 2 et 4 | unitaire-main | partiel : `src/shared/page-notes.test.ts` › « parcours de browser-annotate : bas de page défilé, puis le haut à 150 % qui reprend 1, 2 et 4 » (regroupement par écran, zoom dit) ; `src/main/browser/page-layer.test.ts` › « page zoomée : épingles et bulles gardent leur taille à l’écran » ; le point en pixels CSS sous le zoom de Chromium (clientX) n’existe qu’en e2e | `page-layer.test.ts` + `page-notes.test.ts` |
| `certificats` | 5 | « Revenir en lieu sûr » sans page précédente : page vide | composant | remplaçant partiel : (le chargement d’`about:blank` par la vue reste e2e) | `CertificateWarning.test.tsx` + `BrowserTab.test.tsx` |
| `certificats` | 6 | Avancé : hôte, port et empreinte SHA-256 exacte | unitaire-main | partiel : `certificate-exceptions.test.ts` › « avertissement : continuer seulement pour une adresse locale ou privée » (hôte, port et empreinte exacte d’un vrai PEM dans l’avertissement) ; › « empreinte SHA-256 lue du PEM ou du DER ; illisible : rien » — le certificat réellement présenté par Chromium reste e2e | `certificate-exceptions.test.ts` |
| `certificats` | 14 | « Se souvenir » : seul le certificat retenu écrit dans `approvals.json` | doublon | partiel : `src/main/approvals.test.ts` › « certificats (fiche 269) : session en mémoire, retenus relus, révocation dite » | — |
| `certificats` | 15 | WebSocket rouverte sous le certificat retenu | doublon | aucun remplaçant écrit | — (de #8) |
| `roles-gestion` | 10 | « Enregistrer comme rôle » seulement pour un travail sans rôle | composant | partiel : `save-as-role.test.ts` › « seulement pour une fille sans rôle, finie avec succès, dont la consigne est connue » | `WorkCard.test.tsx` (à compléter) |
| `roles-gestion` | 18 | désactiver : pâli, quitte la section Équipe | composant | remplaçant partiel : reste hors Vitest : rafraîchissement réel par l’IPC : journée type | `TeamSection.test.tsx` (à créer) — le rafraîchissement par l'IPC n'y serait pas vu |
| `roles-gestion` | 23 | langue d'origine : rôles relus | doublon | partiel : idem #22 | — (de #22) |
| `mermaid` | 3 | Mermaid chargé à l'arrivée du diagramme | doublon | aucun remplaçant écrit | — (de #1) |
| `dossiers` | 2 | dossier ajouté : listé sous le dossier de travail, par son nom | composant | partiel : `SessionFolders.test.tsx` › « avec la capacité : dossiers listés, ajout, retrait, affichage » ; `src/main/conversations/additional-directories.test.ts` › « ajout : mémorisé, sans doublon ni le dossier de travail ; agent prêt : session rouverte » | `SessionFolders.test.tsx` |
| `historique-saisie` | 7 | ↑ : 2/3, curseur fin de ligne 1, champ remonté, jeton retiré | composant | partiel : `visual-lines.test.ts › fin de la première ligne affichée…` ; `scrollTop` = 0 non vérifiable en jsdom (toujours 0) — **Reste e2e ou capture (lot dialogues)** : e2e : jeton retiré couvert par `src/renderer/src/components/composer/SentHistory.test.tsx` › jetons de rôle repris (ligne « Sera confié à… ») ; rôle supprimé : « @Libellé » en texte ; curseur en fin de 1re ligne affichée et champ remonté demandent la mise en page (jsdom : scrollTop toujours 0) — garder la vérification dans historique-saisie réduite | `SentHistory.test.tsx` |
| `historique-saisie` | 18 | (attente) un seul appui ferme le panneau rouvert par l’app | composant | partiel : `usePanel.test.ts › replié : un seul appui le rouvre, même dans la fenêtre étroite, et il y reste` (sens inverse) | `usePanel.test.ts` |
| `git` | 6 | clic sur la branche : « Modifications » vue Git, 2 fichiers | composant | partiel : `ChangesTab.test.tsx › espace Code : la vue Git et son texte, comme avant` | `ChangesTab.test.tsx` |
| `git` | 7 | vue Git hors worktree : cases et « Committer », ni PR ni fusion | composant | partiel : `CommitBars.test.tsx › fichiers cochés, message proposé modifiable, commit, puis « Défaire »` ; `worktree-outcome.test.ts › pas de dépôt distant : ni bouton ni raison…` | `CommitBars.test.tsx` |
| `git` | 10 | cases changées puis remises : message gardé, sans relance | composant | partiel : `CommitDraft.test.tsx › cases changées après la réponse : le message retouché reste, « Rédiger à nouveau » le remplace` | `CommitDraft.test.tsx` (ajouter l’aller-retour) |
| `git` | 13 | pastille des modifications : vue de la conversation | composant | partiel : `SessionChanges.test.tsx › après travail : ce que la conversation a modifié, qui ouvre la vue Conversation` | `SessionChanges.test.tsx` ou test du panneau |
| `worktree-cycle` | 4 | « Vue Git » ouvre l’onglet Modifications en vue Git | composant | remplaçant partiel : (e2e worktree-cycle gardée) | `WorktreeStart.test.tsx` |
| `worktree-cycle` | 13 | conflit : notes.txt déjà revenu dans le dossier principal | unitaire-main | partiel : `worktree-cycle.test.ts › « Mettre de côté » : stash, fusion, remise, entrée retirée (fiche 123)` ; `CommitBars.test.tsx › « Mettre de côté » retenu pour la reprise après un conflit` | `worktree-cycle.test.ts` |
| `base` | 16 | nouvelle conversation : sans confirmation, l’ancienne dans « Récents » | unitaire-main | remplaçant partiel : )` natif dans la page reste e2e | `manager.test.ts` |
| `language` | 1 | réglage « Français » : interface et menu en français | unitaire-main | partiel : `i18n.test.ts › lit le réglage dans settings.json avant toute fenêtre, « system » sinon` ; `menu.test.ts › entrées des rôles d’Electron toutes traduites, menu Fenêtre compris (fiche 093)` | `i18n.test.ts`, `menu.test.ts` |
| `language` | 3 | English : menu macOS reconstruit en anglais | unitaire-main | remplaçant partiel : reste hors Vitest : menu natif réellement traduit : e2e | `settings-effects.test.ts` (à créer : `changeLanguage` → `refreshMenu` + `languageChanged`) |
| `language` | 8 | retour au français : Réglages, menu et fenêtres | doublon | partiel : `parcours-reglages` étape 2 (retour à la langue d’origine, invite seule) | — |
| `aide` | 2 | titre « Aide de Bobine », curseur dans la recherche | composant | partiel : `HelpWindow.test.tsx › recherche pendant la frappe, au clavier seul : ↓, ↩ ouvre la section, Échap efface` (focus) | `src/renderer/src/components/help/HelpWindow.test.tsx` (à compléter : titre) |
| `aide` | 4 | accueil : pas de lien brut vers l’autre langue ; insécables avant « : ; ? ! » | composant | partiel : `guide.test.ts › pages et ancres de l’aide, l’autre langue, les Nouveautés` (lien converti, pas la typographie) | `guide.test.ts` (à compléter : texte rendu de l’accueil) |
| `aide` | 10 | « astuces » trouve l’accueil, mot surligné à l’écran | composant | partiel : `guide.test.ts › recherche : l’accueil répond par ses notes, jamais par son sommaire` | `guide.test.ts` / `HelpWindow.test.tsx` (la partie « surligné à l’écran » est couverte par la ligne 7) |
| `aide` | 11 | blocs de code avec « Copier » | composant | partiel : `src/renderer/src/components/thread/Markdown.test.tsx › tableaux dans un cadre qui défile, blocs de code avec un bouton « Copier »` (Markdown du fil) | `HelpWindow.test.tsx` (rendu d’une page avec un bloc de code) |
| `aide` | 12 | lien hors du guide ouvert dans le navigateur du système | unitaire-main | remplaçant partiel : le clic réel dans la page reste e2e | `src/main/renderer-windows.test.ts` (à créer : `setWindowOpenHandler` / `will-navigate`) |
| `aide` | 14 | seule la section visée ressort | composant | aucun remplaçant écrit | `HelpWindow.test.tsx` (à compléter : deux cibles de suite) |
| `command` | 10 | avant : le réglage dit où la commande s’installera | composant | partiel : `src/main/command-line.test.ts › sinon dans ~/.local/bin, et dit si le PATH le contient` | test du réglage « Commande bobine » (à créer) |
| `command` | 13 | après : le chemin du script, et l’avertissement PATH | composant | partiel : `command-line.test.ts › sinon dans ~/.local/bin, et dit si le PATH le contient` (côté main) | test du réglage « Commande bobine » |
| `outils-projet` | 8 | menu ⚙ : rien « au prochain démarrage » | composant | partiel : `SessionSettingsMenu.test.tsx › Serveurs MCP : « bobine · intégré » et les outils reçus, puis les serveurs de l’agent (fiche 099)` | `src/renderer/src/components/common/SessionSettingsMenu.test.tsx` (à compléter) |
| `permissions` | 4 | Réglages fermés par Échap : focus à la saisie | composant | partiel : `src/renderer/src/focus-keeper.test.ts › fenêtre fermée (Échap, ✕) dont le bouton d'ouverture est parti : la zone de saisie` (logique seule, pas la vraie fenêtre des Réglages) | `src/renderer/src/focus-keeper.test.ts` (existant) |
| `aparte` | 12 | Échap ferme l'aparté, le clavier revient à la saisie | composant | partiel : `AsideCard.test.tsx › pendant la réponse : « Demander » désactivé, pas de citation ; Échap ferme` | `AsideCard.test.tsx` (ajouter le retour du focus) |
| `startup` | 3 | puce du dossier « Choisir un dossier », agent au choix | composant | aucun remplaçant écrit | `Composer.test.tsx` (ou test de la barre de saisie) |
| `about` | 2 | nom, version, présentation, « projet indépendant » ; commit du build injecté | composant | partiel : `AboutWindow.test.tsx › nom, version et date en toutes lettres, présentation, non-affiliation ; aucune info technique affichée` | `src/renderer/src/components/about/AboutWindow.test.tsx` (existant) ; commit injecté : seulement visible sur un vrai build |
| `about` | 3 | aucune information technique affichée | doublon | partiel : comme n° 2 : partiel : `AboutWindow.test.tsx › nom, version et date en toutes lettres, présentation, non-affiliation ; aucune info technique affichée` | — |
| `about` | 4 | titre de la fenêtre « À propos de Bobine » | doublon | partiel : comme n° 3 : comme n° 2 : partiel : `AboutWindow.test.tsx › nom, version et date en toutes lettres, présentation, non-affiliation ; aucune info technique affichée` | — |
| `about` | 8 | GitHub, licence, « Signaler un problème » ouverts dans le navigateur | composant | remplaçant partiel : reste hors Vitest : `openExternal` par le gestionnaire du main : e2e | `AboutWindow.test.tsx` (ajouter GitHub et licence) |
| `travail-recette` | 3 | pas d'avis en double dans le fil tant que la carte est là | composant | partiel : `turn-quota.test.ts › avis du fil : quota épuisé, marqué « refus »` | `src/renderer/src/components/thread/Transcript.test.tsx` (avis masqué tant que la carte est là) |
| `travail-recette` | 9 | le travail repart avec l'autre modèle, réponse dans sa carte | unitaire-main | partiel : `turn-auth-manager.test.ts › autre modèle choisi sur la carte (fiche 210)…` (conversation elle-même, pas une fille) | `src/main/conversations/turn-auth-manager.test.ts` (même cas pour une fille) |
| `android` | 28 | planche contact affichée dans la carte de l'outil | composant | partiel : `Transcript.test.tsx` (`tool-images`) | `src/renderer/src/components/thread/Transcript.test.tsx` |
| `auth` | 1 | SSO proposé | composant | partiel : `src/renderer/src/components/onboarding/Onboarding.test.tsx › SSO qui ne revient pas (fiche 207)…` (clic `auth-mock-sso`) | `src/renderer/src/components/composer/BlockerPanel.test.tsx` (méthodes d'auth rendues) |
| `auth` | 19 | SSO sans retour : « Réessayer » relance, connecté | doublon | partiel : même relance que #16 ; `Onboarding.test.tsx › SSO qui ne revient pas (fiche 207)…` | — |
| `auth` | 26 | carte : « Réessayer », clé enregistrée, agent relancé | doublon | partiel : même enchaînement que #3 ; `api-keys.test.ts › Réessayer attend la même question…` | — |
| `auth` | 27 | licence : panneau dédié avec le message de l'agent | composant | partiel : `src/main/diagnostics.test.ts › blocages : dossier, connexion, licence…` (diagnostic, pas la carte) | `src/renderer/src/components/composer/BlockerPanel.test.tsx` (kind `license`) |
| `auth` | 28 | licence : « Lire la licence » lance la commande dans le terminal | doublon | partiel : même mécanisme d'étape → terminal que #15 | — |
| `auth` | 29 | licence : jamais acceptée par l'app | unitaire-main | partiel : `src/main/agent/capabilities.test.ts` (texte `bob --show-license`) | `src/main/agent/capabilities.test.ts` / profil Bob : aucune étape `--accept-license` |
| `auth` | 30 | licence acceptée : « Réessayer » relance l'agent | doublon | partiel : même relance que #16 | — |
| `bob` | 2 | agent bloqué : changer d'agent ou de dossier reste possible | composant | aucun remplaçant écrit | `Composer.test.tsx` ou `BlockerPanel.test.tsx` (nouveau it) |
| `bob` | 8 | licence : message de l'agent sur ses quatre lignes | composant | aucun remplaçant écrit | `ElicitationCard.test.tsx` (message multiligne) |
| `browser-view` | 5 | panneau agrandi : la page prend toute la largeur | doublon | partiel : même synchronisation des bornes que #4 | — |
| `browser-view` | 6 | panneau réduit : la page suit | doublon | partiel : même synchronisation que #4 | — |
| `browser-view` | 10 | ⌘− dans la page : retour à 100 %, plus de puce | doublon | partiel : même chemin que #9 ; `page-view.test.ts › paliers de zoom…` | — |
| `changes` | 8 | vue « Git » à jour : README n'est plus modifié | doublon | partiel : `src/main/changes/git-changed.test.ts` (signal « dépôt changé ») + `ChangesTab.test.tsx › vue Git relue après un commit fait hors du panneau…` | — |
| `composer` | 9 | un clic à travers l'infobulle met le curseur dans la saisie | doublon | partiel : même contrat que #4 et #8 | — |
| `composer` | 12 | liste longue (≥30) : dans la fenêtre, avec défilement | composant | partiel : `menu-placement.test.ts › caps the height to the room above when above is the larger side but too small` — **Reste e2e ou capture (lot dialogues)** : e2e/capture : placement réel du menu et défilement de sa liste (Radix + mise en page) ; la règle de placement seule est à `src/renderer/src/components/composer/menu-placement.test.ts` | `src/renderer/src/components/composer/menu-placement.test.ts` |
| `composer` | 28 | 500 px, Plan : invite entière | composant | partiel : `useTextareaLayout.test.tsx › suit la largeur : une ligne de plus quand la zone rétrécit, sans attendre le texte` — **Reste e2e ou capture (lot dialogues)** : e2e/capture : hauteur réelle de l’invite à 500 px (police, `scrollHeight` du navigateur) ; le mécanisme est à `src/renderer/src/useTextareaLayout.test.tsx` › suit la largeur… | `src/renderer/src/useTextareaLayout.test.tsx` |
| `composer` | 29 | 500 px, Code : invite entière | doublon | partiel : comme n° 28 : partiel : `useTextareaLayout.test.tsx › suit la largeur : une ligne de plus quand la zone rétrécit, sans attendre le texte` — **Reste e2e ou capture (lot dialogues)** : e2e/capture : hauteur réelle de l’invite à 500 px (police, `scrollHeight` du navigateur) ; le mécanisme est à `src/renderer/src/useTextareaLayout.test.tsx` › suit la largeur… | — |
| `composer` | 30 | 500 px : texte tapé entier, sans défilement | composant | partiel : comme n° 28 : partiel : `useTextareaLayout.test.tsx › suit la largeur : une ligne de plus quand la zone rétrécit, sans attendre le texte` — **Reste e2e ou capture (lot dialogues)** : e2e/capture : hauteur réelle de l’invite à 500 px (police, `scrollHeight` du navigateur) ; le mécanisme est à `src/renderer/src/useTextareaLayout.test.tsx` › suit la largeur… | `useTextareaLayout.test.tsx` |
| `composer` | 33 | accueil : dossier et branche sous la saisie | doublon | partiel : même contrat que #1 | — |
| `composer` | 42 | l'envoi garde l'accent, distinct du Plan | doublon | partiel : `themes.test.ts › le mode Plan reste distinct de l’accent` | — |
| `composer` | 48 | (×4, boucle) thème : Plan bleu ou violet, distinct de l'accent | doublon | partiel : `themes.test.ts › le mode Plan reste distinct de l’accent` (pas le bleu/violet) | — |
| `diagnostic` | 4 | PATH du shell de connexion lu | unitaire-main | partiel : `src/main/shell-env.test.ts › repli : zsh de connexion interactif sous macOS, sh de connexion ailleurs` et `› extrait les variables malgré le bruit des fichiers rc…` | — |
| `diagnostic` | 12 | clic : ouvert dans le navigateur système, pas dans l'app | unitaire-main | partiel : `src/main/ipc.test.ts › liens web (fiche 154) : adresse locale dans le navigateur intégré, le reste dans celui du Mac` | — |
| `diagnostic` | 25 | main.log : agent lancé, tours, niveau changé | unitaire-main | partiel : `agent-process.test.ts › journal Détaillé : … lancement et arrêt dans main.log` | `src/main/log.test.ts` |
| `gitlab` | 1 | waitFor bouton « Ouvrir une MR » | composant | partiel : `src/main/changes/forge.test.ts › configuration de glab et de gh lue sans rien lancer` ; `src/main/changes/worktree-cycle-forge.test.ts › branche poussée, MR vers la base…` (côté main, pas le libellé) | `src/renderer/src/components/panel/WorktreeBar.test.tsx` (à créer : libellé selon `forge.kind`) |
| `gitlab` | 2 | waitFor raison `notLogged_mr` sous le bouton | composant | partiel : `src/renderer/src/components/panel/worktree-outcome.test.ts › grisé avec la raison quand l’utilisateur peut y remédier` ; `worktree-cycle-forge.test.ts › glab absent, non connecté, révoqué, injoignable…` | `WorktreeBar.test.tsx` (à créer) |
| `gitlab` | 3 | « Ouvrir une MR » désactivé (glab non connecté) | composant | partiel : `worktree-outcome.test.ts › grisé avec la raison quand l’utilisateur peut y remédier` | `WorktreeBar.test.tsx` (à créer) |
| `gitlab` | 5 | formulaire : « Pousser et ouvrir la MR » | composant | aucun remplaçant écrit | `WorktreeBar.test.tsx` (à créer) |
| `gitlab` | 14 | waitFor raison `unknownForge` avec l'hôte | composant | partiel : `worktree-cycle-forge.test.ts › hôte inconnu : GitHub comme avant… « Actualiser » le dit inconnu` | `WorktreeBar.test.tsx` (à créer : rendu du texte) |
| `history` | 3 | ⌘K → ⌘F : recherche reprise, premier résultat surligné, focus | composant | remplaçant partiel : (passage réel ⌘K → ⌘F : App, e2e) | `src/renderer/src/useThreadFind.test.tsx` (ajouter : requête transmise depuis la recherche) |
| `history` | 12 | clic droit : le menu de ⋯ au pointeur, aucun mot sélectionné | composant | partiel : `src/renderer/src/components/sidebar/Sidebar.test.tsx › clic droit sur une ligne : le menu de ⋯, mêmes éléments dans le même ordre, sans menu natif (fiche 276)` — **Reste e2e ou capture (lot dialogues)** : e2e/capture pour la position : le menu au pointeur se place par Radix sur la mise en page réelle ; « aucun mot sélectionné » et mêmes éléments : `src/renderer/src/components/sidebar/Sidebar.test.tsx` › clic droit sur une ligne… | `Sidebar.test.tsx` (ajouter position) |
| `launch` | 4 | journal du serveur visible dans l'onglet (waitFor) | composant | partiel : `preview-tools.test.ts › journaux et arrêt` | test de la barre du serveur de dev (à créer) |
| `links` | 1 | 6 liens de fichiers reconnus (le lien web reste web) | composant | partiel : `src/shared/file-links.test.ts › chemins relatifs, absolus, file://, lignes citées` ; `› liens web, ancres, courriels : pas des fichiers` | `src/renderer/src/components/thread/Markdown.test.tsx` (à créer) |
| `links` | 2 | code vers fichier inexistant : pas un lien ; existant : un lien | composant | partiel : `src/main/ipc.test.ts › files:existing (fiche 272, rc.3)…` | `Markdown.test.tsx` (à créer, `api.files.existing` simulé) |
| `links` | 7 | fichier absent cliqué deux fois : un seul avis, pied du tour reste | composant | partiel : `useFileLinks.test.ts › fichier absent : avertissement…` | `src/renderer/src/components/thread/Thread.test.tsx` (à créer) ou `useFileLinks.test.ts` |
| `links` | 10 | le fil dit pourquoi l'exécutable n'a pas été ouvert | composant | partiel : `useFileLinks.test.ts › … montré dans le Finder hors du dossier : information` | `useFileLinks.test.ts` |
| `links` | 11 | ⌥-clic : Finder | composant | partiel : `file-links.test.ts › … dossier, ⌥-clic : Finder` (main) | `useFileLinks.test.ts` (ajouter altKey) |
| `links` | 15 | adresse locale : navigateur intégré, rien dans le navigateur du Mac | composant | partiel : `src/shared/file-links.test.ts › adresses du poste : navigateur intégré` | `Markdown.test.tsx` / `useFileLinks.test.ts` |
| `links` | 16 | autre adresse : navigateur du Mac | composant | partiel : `file-links.test.ts (shared) › autres http(s) : navigateur du Mac…` | idem 15 |
| `links` | 17 | ⌥-clic sur une adresse locale : navigateur du Mac | composant | aucun remplaçant écrit | idem 15 |
| `memoire` | 12 | onglet Session : ligne « Mémoire » (waitFor) | composant | aucun remplaçant écrit | `src/renderer/src/components/panel/SessionTab.test.tsx` (ajouter) |
| `network` | 1 | bandeau « Connexion perdue » à la place de l'indicateur, Stop proposé | composant | partiel : `TurnRetryBanner.test.tsx › décompte la prochaine tentative, et « Réessayer maintenant »` | `src/renderer/src/components/thread/TurnRetryBanner.test.tsx` + rendu du fil (indicateur masqué) |
| `onboarding` | 13 | marque « fini » enregistrée | unitaire-main | partiel : `onboarding-state.test.ts › fini ou passé : posé une fois, jamais défait` ; `Onboarding.test.tsx › « Passer l'accueil » : marqué passé` (côté skipped seulement) | `src/main/onboarding/onboarding.test.ts` + `Onboarding.test.tsx` (finish('finished')) |
| `onboarding` | 16 | accueil ouvert, rien choisi : aucun quota lu | unitaire-main | partiel : `quota-setup.test.ts › agent installé mais pas utilisé : son quota n'est pas lu au lancement` | `src/main/agent/quota-setup.test.ts` |
| `onboarding` | 29 | dossier d'essai créé dans le dossier prévu | unitaire-main | partiel : `trial-folder.test.ts › créé avec son parent, toujours neuf…` | `src/main/onboarding/trial-folder.test.ts` |
| `onboarding` | 38 | essai en cours : son agent (Cmd+Q) | doublon | partiel : comme n° 33 : partiel : `agent-readiness.test.ts › répond : …agent arrêté` | — |
| `onboarding` | 42 | « Mon activité » : tour d'essai et coût gardés | unitaire-main | partiel : `onboarding.test.ts › tour d'essai : une ligne du journal de consommation, sur la conversation de l'accueil` | `onboarding.test.ts` |
| `panel` | 4 | en-tête : progression du plan (3 / 3) | doublon | doublon de la suite e2e `pinned-plan`, elle-même réduite ou supprimée | — |
| `pilote` | 3 | attendre : étape suivante de l'accueil (code 14) | unitaire-main | partiel : `pilote.test.mjs › délai, carte, accueil qui change d'étape` | `pilote.test.mjs` |
| `pilote` | 6 | accueil : essai fini, « Commencer » proposé | unitaire-main | partiel : `pilote.test.mjs › accueil, blocage, avis…` | `pilote.test.mjs` |
| `pilote` | 7 | etat : agent prêt, accueil fini | unitaire-main | partiel : `pilote.test.mjs › écran calme : quelques lignes, sans ligne vide de sens` | `pilote.test.mjs` |
| `pilote` | 9 | envoyer : zone vidée d'abord, le brouillon ne part pas | unitaire-main | partiel : `cible.test.mjs › envoyer « /scenario … » : le menu « / » fermé d'abord, le message part tel quel` (DOM jsdom, pas React) | `cible.test.mjs` |
| `pilote` | 10 | attendre → carte | unitaire-main | partiel : `pilote.test.mjs › délai, carte, accueil qui change d'étape` | `pilote.test.mjs` |
| `pilote` | 11 | etat : titre, fichier et boutons de la carte | unitaire-main | partiel : `pilote.test.mjs › carte en attente : titre, commande, dossier, boutons` | `pilote.test.mjs` |
| `pilote` | 14 | attendre → tour-fini | unitaire-main | partiel : `pilote.test.mjs › tour fini après un écran calme, pas avant` | `pilote.test.mjs` |
| `pilote` | 16 | etat --json : genre de l'outil, onglet Modifications | unitaire-main | partiel : `pilote.test.mjs › outils : par genre, groupés compris` | `pilote.test.mjs` |
| `pilote` | 17 | panneau modifications : onglet ouvert, compte affiché | unitaire-main | partiel : `pilote.test.mjs › onglets du panneau, en français ou en anglais` | `pilote.test.mjs` |
| `pilote` | 20 | après Arrêter : tour-fini | unitaire-main | partiel : `pilote.test.mjs › tour : en cours, fini, ou rien` | `pilote.test.mjs` |
| `pilote` | 21 | note avec capture | unitaire-main | partiel : `pilote.test.mjs › écrit les entrées (Markdown et JSONL) et les résume` | `pilote.test.mjs` |
| `pilote` | 22 | note : gravité inconnue refusée | unitaire-main | partiel : `pilote.test.mjs › refuse une commande, une option ou une valeur manquante` | `pilote.test.mjs` |
| `pilote` | 23 | intervention notée | unitaire-main | partiel : `pilote.test.mjs › écrit les entrées…` | `pilote.test.mjs` |
| `pilote` | 34 | repondre « Retenir » | unitaire-main | partiel : `cible.test.mjs › repondre vise la carte en attente…` | `cible.test.mjs` |
| `pilote` | 35 | souvenir décidé : plus de carte | unitaire-main | partiel : `cible.test.mjs › repondre rend la main une fois la carte décidée ; toujours là, une erreur le dit (fiche 250)` | `cible.test.mjs` |
| `pilote` | 36 | attendre → tâches proposées | unitaire-main | partiel : `cible.test.mjs › carte de groupe en attente : une carte, les boutons de la ligne en attente et « Tout lancer »` | `cible.test.mjs` |
| `pilote` | 37 | repondre « Lancer » | unitaire-main | partiel : `cible.test.mjs › repondre vise la carte en attente, pas une carte de groupe décidée plus bas` | `cible.test.mjs` |
| `pilote` | 41 | attendre dans la fille : tour-fini | doublon | partiel : comme n° 14 : partiel : `pilote.test.mjs › tour fini après un écran calme, pas avant` | — |
| `pilote` | 43 | etat sans Bobine : erreur claire | unitaire-main | partiel : `cible.test.mjs › fenêtre absente ou ambiguë : erreur qui le dit, avec les pages vues` | `cible.test.mjs` |
| `platform` | 2 | raccourcis notés selon la plateforme, ☰, cadre natif, barres fines, sans verre, marge des feux (×3, boucle) | composant | partiel : `src/shared/key-notation.test.ts › ailleurs : Ctrl, Alt, Maj dans cet ordre…` + `src/main/platform.test.ts › relues telles quelles depuis la ligne de commande du renderer` | `src/renderer/src/…/platform-classes.test.ts` (classes de `<html>` selon les capacités) |
| `platform` | 3 | capture d'écran proposée (macOS) / masquée (×3, boucle) | composant | partiel : `src/main/platform.test.ts › sous Linux, rien de ce que seul macOS a` (capacités seules) | `src/renderer/src/components/composer/Composer.test.tsx` (capacité `screenCapture` absente) |
| `quick` | 1 | raccourci global ⌥⌘B enregistré | unitaire-main | partiel : `quick-entry.test.ts › un seul raccourci à la fois, réenregistré quand le réglage change` (globalShortcut simulé) | `src/main/quick-entry.test.ts` |
| `quick` | 6 | autorisation refusée : pas de screencapture, fenêtre gardée, message | unitaire-main | partiel : `screen-capture.test.ts › refusée ou restreinte : indisponible, sans lancer la commande ni masquer les fenêtres` | `src/main/screen-capture.test.ts` + `QuickEntry.test.tsx` pour le message |
| `scheduled` | 4 | titre de la page dans la barre de titre | composant | aucun remplaçant écrit | `src/renderer/src/components/scheduled/ScheduledPage.test.tsx` |
| `scheduled` | 7 | … qui compte les quatre échéances | composant | partiel : `scheduler.test.ts › sans rattrapage…` (`missed` compté, affichage non testé) | `ScheduledPage.test.tsx` |
| `scheduled` | 8 | la page dit que les tâches ne tournent que Bobine ouverte | composant | aucun remplaçant écrit | `ScheduledPage.test.tsx` |
| `scheduled` | 12 | nouvelle tâche : l'agent des nouvelles conversations choisi d'office (check true) | composant | aucun remplaçant écrit | `ScheduledPage.test.tsx` |
| `scheduled` | 15 | pendant l'exécution, « Lancer maintenant » désactivé | composant | partiel : `scheduler.test.ts › jamais deux exécutions à la fois : l'échéance est sautée` | `ScheduledPage.test.tsx` |
| `scheduled` | 17 | coût réel de l'exécution affiché | composant | partiel : `ScheduledPage.test.tsx › liste la tâche… exécutions` | `ScheduledPage.test.tsx` |
| `scheduled` | 18 | la conversation de l'exécution s'ouvre sur la carte « Plafond atteint » (waitFor) | composant | partiel : `ScheduledPage.test.tsx › liste la tâche…` (clic `scheduled-run-open`) ; `src/renderer/src/components/thread/TurnGuards.test.tsx` (`cost-cap-card`) | `ScheduledPage.test.tsx` + `TurnGuards.test.tsx` |
| `simulator` | 24 | planche contact iOS affichée dans la carte de l'outil | composant | partiel : `Transcript.test.tsx` (`tool-images`) | `src/renderer/src/components/thread/Transcript.test.tsx` |
| `subagents` | 4 | Bob : coût final du sous-agent sur sa ligne (check true) | unitaire-main | partiel : `bob-costs.test.ts › lignes subagent de la conversation… coût s'il est lisible` | `bob-costs.test.ts` |
| `subagents` | 24 | 2.3.0 : chaque ligne montre le travail de son sous-agent | unitaire-main | partiel : `subagent-background.test.ts › à sa fin, son travail relu dans sa session remplace celui reçu en direct` | `agent-host-opencode-2-3.test.ts` |
| `subagents` | 27 | 2.3.0 : bilan à la fin du travail, sous la réponse hors tour ; « Prêt » ensuite | unitaire-main | partiel : `agent-host-background.test.ts › sous-agent en arrière-plan : « travaille encore » jusqu'à la réponse hors tour, qui finit le tour` | `agent-host-background.test.ts` |
| `travaux-groupe` | 9 | Faire relire un travail : sa branche relue | composant | partiel : `review-target.test.ts › non commité sur une branche : la branche contre sa base…` | `src/renderer/src/components/panel/ReviewDialog.test.tsx` (ajouter la portée « branche ») |
| `worktree-setup` | 7 | dépôt principal intact | unitaire-main | partiel : `worktree-include.test.ts › copie les fichiers ignorés retenus, jamais un lien, ni hors dépôt…` | `src/main/changes/worktree-include.test.ts` |
| `filles` | 10 | Vue « Filles » : « Faire relire » ouvre la relecture sur sa branche | composant | partiel : `C/panel/ChildrenView.test.tsx` › « une ligne par fille : branche, compte rendu, recommandation, actions » | `C/panel/ChildrenView.test.tsx` (existant, cas à ajouter) |
| `filles` | 23 | Deuxième `start_child` : même carte, deux lignes, la première lancée sur place | composant | remplaçant partiel : (second `start_child` réel : e2e filles) | `C/thread/WorkGroup.test.tsx` (existant) |
| `filles` | 34 | Rafale refusée : le tour finit, pas de fille | unitaire-main | aucun remplaçant écrit | `M/conversations/children.test.ts` (scénario `filles-rafale` à ajouter) |
| `filles` | 42 | Consigne `message_child` repliée par défaut (×2 : avant / après redémarrage) | composant | remplaçant partiel : (après redémarrage : la consigne relue du disque reste e2e) | `C/thread/WorkGroup.test.tsx` (existant) |
| `handover` | 6 | Titre gardé malgré celui du nouvel agent | unitaire-main | partiel : `M/conversations/manager.test.ts` › « titre de l’agent sans ce que l’app joint ; branche : le titre de l’app reste (fiche 125) » | `M/conversations/handover.test.ts` (cas à ajouter) |
| `inbox` | 25 | Plus aucun chemin absolu du dossier dans la page | composant | remplaçant partiel : (sur toute la page : e2e inbox) | `C/thread/ToolCall.session.test.tsx` (existant) |
| `browser` | 35 | dossier d'attente vidé | unitaire-main | partiel : comme n° 34 : partiel : `src/main/browser/downloads.test.ts` › « rien hors du dossier d'attente avant le choix ; déplacé là où l'utilisateur l'a choisi » | `src/main/browser/downloads.test.ts` |
| `browser` | 46 | agrandi : la page native suit le panneau | doublon | partiel : e2e `browser-view.mjs` (la page suit le panneau, fiche 129) | `browser-view.mjs` |
| `roles-travail` | 15 | deux rôles : deux filles au travail, anneau sur l'avatar (L288) | doublon | partiel : `parcours-deleguer` › étape 1 (« Tout lancer », tous répondent) ; `renderer/src/components/thread/WorkGroup.test.tsx` › « « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé » | `parcours-deleguer` étape 1 (trois travaux lancés ensemble) ; rendu dans `WorkGroup.test.tsx` |
| `session` | 20 | Terminées : 3 (une commande du terminal n'y va pas) (L349) | composant | partiel : `renderer/src/components/panel/SessionTab.test.tsx` › « durée, Arrêter quand Bobine sait, rien pour un sous-agent ; terminées repliées » | `session-running.test.ts` (existant) |
| `connexion-expiree` | 8 | Réessayer : toujours une seule conversation, pas de branche (L96) | unitaire-main | partiel : `main/conversations/turn-auth-manager.test.ts` › « SSO, puis un message écrit pendant le renvoi : un seul agent, renvoi puis le nouveau message » | `main/conversations/turn-auth-manager.test.ts` (existant) |
| `perf` | 5 | sortie longue : ouverte en bas, sur la dernière ligne | composant | partiel : `C/thread/CappedText.test.tsx` › « longue : les 500 dernières lignes, le nombre masqué localisé, « Afficher tout » » | `C/thread/CappedText.test.tsx` (contenu) ; la position de défilement n'est pas vérifiable en jsdom |
| `perf` | 8 | recherche : le mot du début masqué est trouvé (1 / 1) | composant | partiel : `C/thread/CappedText.test.tsx` › « recherche ouverte : le début masqué qui contient ce qu'on cherche est montré, par paquets » | `C/thread/CappedText.test.tsx` + `R/useThreadFind.test.tsx` |
| `perf` | 20 | remonté jusqu'au début : tout le fil rendu | composant | partiel : `C/thread/useEntryWindow.test.ts` › « court : tout rendu ; le fil qui grandit garde le même début » | `C/thread/useEntryWindow.test.ts` (à compléter : extension page par page jusqu'au début) |
| `usage-board` | 4 | « Toute mon activité… » : page, titre, ligne en surbrillance, sans saisie | composant | partiel : `C/sidebar/Sidebar.test.tsx` › « « Mon activité » sous « Nouvelle conversation », ⇧⌘U, en surbrillance quand ouverte » | `C/composer/UsageMeter.test.tsx` (à compléter : `usage-open-board`) + test de `R/useActivityPage.ts` (à créer) |
| `usage-board` | 6 | coût dans son unité (≈ 0,025 $), jetons communiqués | composant | partiel : `C/activity/ActivityPage.test.tsx` › « quatre chiffres clés, et l'écart à la semaine d'avant à date égale, en texte discret » | `C/activity/ActivityPage.test.tsx` |
| `usage-board` | 11 | mesures « Temps » puis « Jetons » : pas de note avec un seul agent ; ordre des chiffres | composant | partiel : `C/activity/ActivityPage.test.tsx` › « mesures comparables et partielles (fiche 147) : temps empilé, note de couverture » | `C/activity/ActivityPage.test.tsx` (à compléter : un seul agent → pas de note, ordre) |
| `usage-board` | 25 | clic sur la conversation : la page se referme, le fil revient | composant | aucun remplaçant écrit | test de `R/useActivityPage.ts` (à créer) |
| `usage-board` | 26 | Fenêtre › Mon activité (⇧⌘U) rouvre la page | composant | partiel : `src/main/menu.test.ts` › « Fenêtre › Mon activité, ⇧⌘U (fiche 144) » | `src/main/menu.test.ts` + `R/useMenuCommands.test.ts` (à compléter : `activity`) |
| `quota` | 9 | rien écrit dans le dossier de lecture du quota | unitaire-main | partiel : `src/main/agent/quota.test.ts` › « rien n'est lu tant qu'aucun agent ne s'est montré prêt ni qu'on ne l'a demandé » | `src/main/agent/quota.test.ts` |
| `quota` | 10 | pas de quota affiché (pas de %) | composant | aucun remplaçant écrit | `C/sidebar/AgentQuotaStatus.test.tsx` (à compléter : quota absent) |
| `versions` | 3 | le lien ouvre Réglages › Diagnostic | composant | partiel : `C/thread/Transcript.test.tsx` › « « Diagnostic » à la suite du texte ouvre la section des Réglages » | `C/thread/Transcript.test.tsx` (callback) + `R/open-settings.ts` |
| `versions` | 9 | sous le plancher : refusé, expliqué, un seul avis, « Relancer » sous la saisie | composant | partiel : `src/main/agent/version-check.test.ts` › « sous le plancher : démarrage refusé, expliqué, sans sortie d'erreur » | `src/main/agent/version-check.test.ts` (refus) + test du statut du composer (à créer, `composer.failedToStart`) |
| `versions` | 10 | protocole incompatible : idem | composant | partiel : `src/main/agent/version-check.test.ts` › « protocole incompatible : démarrage refusé, expliqué » | idem |
| `libelles` | 4 | dossier récent : nom entier, début coupé, chemin en infobulle, ordre des 3 | composant | partiel : `src/shared/presentation.test.ts` › « le nom du dossier à part, le reste avant, le dossier personnel en ~ » | test de `DataSettings` (à créer) pour nom/infobulle/ordre ; la coupe réelle (scrollWidth) en capture |
| `long-thread` | 1 | tâches longues observables | doublon | partiel : `e2e/suites/perf.mjs` › « streaming : aucune tâche > 400 ms » | `e2e/suites/perf.mjs` (budgets réels) |
| `activity` | 8 | le patch se termine | doublon | partiel : `parcours-matinee` étape « autoriser une modification une fois » | journées types (tout outil fini) |
| `attachments` | 9 | déposé sur la saisie : toujours joint | doublon | partiel : `Composer.test.tsx` › « image déposée avec un chemin… » | supprimer |
| `discussion` | 2 | accueil discussion : ni dossier, ni branche, ni Équipe ; « Nouvelle discussion » | composant | partiel : `Sidebar.test.tsx` › même test | `Sidebar.test.tsx` + `Welcome.test.tsx` (à créer) |
| `discussion` | 7 | panneau « Documents » : 2 documents, aperçu du plus récent | composant | partiel : `documents/ipc.test.ts` › « aperçu : texte, image, texte d'un document Word, sinon rien » | `DocumentsPanel.test.tsx` (à créer) |
| `discussion` | 12 | commande : dossier « Documents », jamais l'identifiant | composant | partiel : tool-label.test (même test que 10) | `AuthorizationCard.test.tsx` |
| `fun` | 1 | plus de compteur de bobcoins dans la barre latérale | composant | aucun remplaçant écrit | `Sidebar.test.tsx` |
| `fun` | 4 | accueil : salutation selon l'heure, avec le prénom | composant | aucun remplaçant écrit | `Welcome.test.tsx` (à créer) |
| `fun` | 5 | suggestion : texte dans la saisie, rien envoyé | composant | aucun remplaçant écrit | `Welcome.test.tsx` (à créer) |
| `pinned-plan` | 5 | pendant le tour : ni carte « Plan » ni compteur | composant | partiel : `PinnedPlan.test.tsx` › « masquée pendant le tour, montrée sinon » | `PinnedPlan.test.tsx` + `Transcript.test.tsx` |
| `pinned-plan` | 9 | fin du tour : liste retirée, carte « Plan » et compteur « 3 / 3 » | composant | partiel : `PinnedPlan.test.tsx` › « épinglé tant que l'agent travaille, et s'il y a des tâches » | `PinnedPlan.test.tsx` + `Transcript.test.tsx` |
| `presentation` | 6 | pastille absente au lancement | composant | partiel : `src/main/presentation.test.ts` › « inactif au lancement, prévient seulement quand l'état change » | `PresentationPill.test.tsx` (à créer) |
| `presentation` | 8 | texte du fil agrandi de 3 px | composant | aucun remplaçant écrit | `presentation.test.ts` renderer (à créer) |
| `presentation` | 10 | pastille de rappel affichée | composant | aucun remplaçant écrit | `PresentationPill.test.tsx` (à créer) |
| `presentation` | 11 | quota et montants masqués | composant | partiel : `TurnSummary.test.tsx` › « mode présentation : pas de montant » | `UsageMeter.test.tsx` / `AgentQuotaStatus.test.tsx` (à compléter) |
| `presentation` | 12 | détail de la consommation : aucun coût | composant | partiel : `src/shared/usage.test.ts` › « sans coût nulle part : rien ; mode présentation : aucun montant » | `UsageMeter.test.tsx` (à compléter) |
| `questions` | 9 | touche 3 : « No, keep planning » transmis | composant | partiel : `src/mock-agent/mock-agent.test.ts` › « plan-a-valider : « continuer à planifier » ne change pas de mode » | `PlanApproval.test.tsx` (à créer) |
| `questions` | 10 | plan approuvé → mode Code | composant | partiel : `mock-agent.test.ts` › « plan-a-valider : plan approuvé → mode code » | `PlanApproval.test.tsx` (à créer) |
| `questions` | 12 | plan (`rawInput.plan`) affiché | composant | partiel : `src/shared/transcript.test.ts` › « plan à valider porté par rawInput.plan (cas réel Codex) ; réponse au formulaire conservée » | `PlanApproval.test.tsx` (à créer) |
| `relecture` | 1 | Modifications d'un dossier git : « Faire relire… » | composant | partiel : `parcours-matinee` étape « faire relire par le Code reviewer » | `ChangesTab.test.tsx` (à compléter) |
| `relecture` | 5 | dossier relu intact | unitaire-main | partiel : `src/main/conversations/children-review.test.ts` › « un relecteur qui écrit dans le dossier est signalé ; un relecteur muet aussi » | `children-review.test.ts` |
| `sommaire` | 3 | la liste au survol garde les 80 messages | composant | aucun remplaçant écrit | `ConversationOutline.test.tsx` (à créer) |
| `sommaire` | 8 | fenêtre basse : la colonne raccourcit | composant | partiel : `outline-layout.test.ts` › « hauteur maximale : 30 % du fil, 240 px au plus » | `outline-layout.test.ts` |

**Captures qui restent** (mesure à poser avec `affirm` au moment de la réduction, jamais une
photo seule) : `repere` 7, 8 ; `settings` 22, 43 ; `mcp` 5, 33 ; `browser-annotate` 15 ; `mermaid` 5 ; `git` 3, 14, 15, 19 ; `worktree-cycle` 3 ; `base` 3, 6 ; `nouvelle-version` 6 ; `plan` 2, 3, 4, 6 ; `aurore` 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ; `finitions` 3, 6, 7, 9, 10 ; `android` 11, 13, 18 ; `commands` 3, 4 ; `composer` 18, 20, 37, 38, 44 ; `fresh-start` 2 ; `history` 11 ; `onboarding` 23 ; `panel` 12 ; `pendant-tour` 3 ; `relecture-commits` 4 ; `scheduled` 10 ; `simulator` 10, 17, 22 ; `travaux-groupe` 6 ; `inbox` 6, 8, 9, 10, 11 ; `roles-export` 14 ; `autorisation-commande` 3, 15, 20, 23, 25, 31, 32, 34, 35, 36 ; `browser` 36, 41 ; `annotate` 4 ; `command-output` 4 ; `roles-travail` 16, 20, 21, 22, 23, 27, 29 ; `session` 5 ; `usage-board` 2, 21, 22, 23, 24 ; `debordements` 5, 7, 8, 9, 10, 11 ; `onglets-etroits` 1, 4 ; `activity` 14 ; `pinned-plan` 1, 4, 6 ; `presentation` 1, 3, 4, 5 ; `relecture` 8 ; `tables` 4, 5, 6, 7, 8, 9, 10.

## Risques

1. **Vus seulement par une journée type** (56 vérifications) : leur remplaçant
   est une étape de `parcours-*`. Une journée rouge masque tout ce qui suit dans la journée ; une
   étape retirée ou affaiblie plus tard fait perdre la vérification sans bruit. `queue` n° 9 (matinee) ; `parallel` n° 1 (matinee) ; `profil` n° 17 (deleguer) ; `settings` n° 11 (reglages) ; `restart` n° 1 (matinee) ; `restart` n° 3 (matinee) ; `restart` n° 4 (deleguer) ; `browser-annotate` n° 1 (outils) ; `browser-annotate` n° 11 (outils) ; `mermaid` n° 1 (longue) ; `mermaid` n° 2 (longue) ; `git` n° 2 (matinee) ; `terminal` n° 1 (outils) ; `terminal` n° 2 (outils) ; `terminal` n° 5 (outils) ; `terminal` n° 9 (outils) ; `terminal` n° 12 (outils) ; `base` n° 10 (matinee) ; `base` n° 13 (matinee) ; `language` n° 5 (reglages) ; `commit-redige` n° 3 (matinee) ; `aparte` n° 5 (matinee) ; `aparte` n° 7 (matinee) ; `acp` n° 1 (outils) ; `composer` n° 16 (matinee) ; `composer` n° 31 (premier-lancement) ; `composer` n° 32 (premier-lancement) ; `export` n° 1 (outils) ; `filles-fusion` n° 2 (deleguer) ; `memoire` n° 14 (reglages) ; `network` n° 3 (pannes) ; `onboarding` n° 6 (premier-lancement) ; `onboarding` n° 8 (premier-lancement) ; `onboarding` n° 14 (premier-lancement) ; `onboarding` n° 18 (premier-lancement) ; `filles` n° 13 (deleguer) ; `filles` n° 15 (deleguer) ; `filles-non-commite` n° 3 (matinee) ; `browser` n° 5 (outils) ; `browser` n° 24 (outils) ; `browser` n° 25 (outils) ; `command-output` n° 1 (outils) ; `command-output` n° 3 (outils) ; `branch` n° 1 (matinee) ; `roles-travail` n° 2 (matinee) ; `roles-travail` n° 3 (matinee) ; `pannes-visibles` n° 9 (reglages) ; `pannes-visibles` n° 11 (reglages) ; `reprise` n° 4 (pannes) ; `failures` n° 4 (pannes) ; `fun` n° 7 (longue) ; `mentions` n° 5 (outils) ; `sommaire` n° 4 (longue) ; `sommaire` n° 7 (longue) ; `tables` n° 2 (longue) ; `tables` n° 3 (longue).
2. **Vus seulement par une capture qui affirme** (5) : le remplaçant Vitest
   couvre la valeur posée, mais le rendu réel (style calculé) n'est plus vu que par la mesure
   d'une capture : `settings` n° 13 ; `settings` n° 14 ; `polices` n° 3 ; `polices` n° 6 ; `fun` n° 2. Les
   captures gardées dans les suites réduites doivent porter leur mesure `affirm` avant la
   suppression ; sans elle, ces rendus ne sont plus vus du tout.
3. **Nuit seulement** (ADR-0069) : la suite complète ne tourne que la nuit ; une régression
   d'une journée type n'est vue que le lendemain matin. Après suppression, la nuit porte les
   journées et les suites réduites : regarder la campagne chaque matin devient indispensable.
4. **Câblage preload → IPC → main** : les tests de composant simulent `window.api`, les tests du
   main simulent Electron. Un canal mal branché n'est plus vu que par une journée (risque 1 de
   l'inventaire C, risques de l'inventaire A).
5. **`parcours-deleguer`** : rouge le 2026-11-23 à l'étape 6 (défauts 1-2 de la fiche 277). Les
   correctifs sont sur `main` (`fix/restauration`, `fix/chasse2-correctifs`) mais la journée n'a
   pas été rejouée : tout ce qui repose sur ses étapes 6-10 reste « à confirmer ».
6. **Étapes ajoutées le 2026-11-24 jamais jouées** (y compris `parcours-premier-lancement` et
   `e2e/affirm.mjs`) : une première campagne `e2e.yml` (macOS + Linux, `--lang en` compris) doit
   être verte avant l'étape 2.
7. **Plateformes** : un remplaçant Vitest simule la plateforme (Electron et `process.platform`
   simulés) ; il tourne sur Linux en CI (`ci.yml`) et sur Mac dans `verify`. Ce qui dépend du vrai
   système (menu natif, Dock, trousseau, disque plein `ENOSPC`) est à garder dans une suite
   gardée ou réduite : à revérifier suite par suite au moment de la réduction.

## Ordre proposé après validation

1. Étape 1 : supprimer les vérifications « vert » et les creuses, suite par suite (un commit par
   lot), retirer les suites vidées de `e2e/catalog.mjs`, poser `affirm` sur les captures qui
   restent ; `verify` puis `pnpm e2e --changed` sur GitHub.
2. Campagne `e2e.yml` complète (macOS + Linux) : les journées vertes valident les « à confirmer ».
3. Étape 2 : supprimer les vérifications « à confirmer » dont la journée est verte.
