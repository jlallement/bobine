# Exploration « développeur pressé » — Bobine 1.0.0-rc.1 + OpenCode 2.3.0 (GPT-6.1 Sol) — 2026-11-19

Testeur : Claude (Opus 5.5), en utilisateur exigeant, par `pnpm pilote` (lecture, attente, notes)
et quelques actions DevTools (clics, saisie, fenêtre étroite émulée). Aucun fichier de code modifié.
Journal du pilote : `.pilote/sessions/2026-11-19-201025/journal.md`. Captures :
`.pilote/sessions/2026-11-19-201025/captures/` (chemins ci-dessous relatifs à `.pilote/`).

## Contexte

| | |
|---|---|
| Bobine | 1.0.0-rc.1, build du dépôt (`main` a8373cf), Electron 45.4.1, macOS 27.2.1 |
| Profil | temporaire (`pnpm pilote lancer --dossier …`), puis **copie** de ce profil relancée avec `--profil` pour l'essai « quitter et relancer » |
| Agent | OpenCode 2.3.0 (IBM Bob 2.1.0 présent, non utilisé) |
| Modèle | **openai/gpt-6.1-sol** — `gpt-6.2-sol` demandé, refusé puis plus proposé après connexion (voir O1) ; 6.1-sol est le `gpt-*-sol` le plus récent proposé |
| Projet | copie de `~/Dev/carnet-maison` → `~/Development/bobine-recette/explo-sol` (Quarkus, dépôt git propre) |
| Durée | 37 min d'app (20:10 → 20:47), 20 échanges, 13 min 04 s de travail d'agent (Mon activité) |
| Coût lu dans l'app | **≈ 0,00 $US** partout (Mon activité : 200k jetons traités, entrée 185,2k / sortie 14,8k, 1,4M relus en cache) — OpenCode connecté par abonnement renvoie un coût nul (voir D12) |
| Journal | Réglages › Diagnostic › Journal : Détaillé dès le début |
| Environnement | Docker arrêté sur le Mac : les tests REST (Testcontainers) n'ont jamais pu tourner ; les tests unitaires oui |

Parcours joué : accueil → décomposition des rappels d'échéance en sous-tâches → implémentation
(avec message en file) → deux filles en worktree (endpoint, README) → `/compact` de la mère pendant
qu'elles tournent → « Faire relire… » de la fille endpoint, remarque renvoyée à l'agent → fusion des
2 filles → interruption d'un tour → question à choix en changeant de conversation → commit par l'app
(message rédigé) → second `/compact` → sous-agents OpenCode (3 fois) → Mon activité → thème clair /
sombre, fenêtre étroite → quitter / relancer → filles de rôle « Code reviewer » arrêtées → mode Plan
et « Exécuter le plan » → changement de mode et de modèle entre conversations.

## Résumé du pilote (`journal --resume`)

```text
Session : 36 min 13 s · 15 attente(s), 6 min 06 s à attendre
Notes : 40 — Bloquant 0, Gênant 16, Mineur 21, Idée 3
Interventions : 1
  20:14:25 OpenCode refusait openai/gpt-6.2-sol (Authentication required). Jérôme s’est connecté lui-même
  dans le terminal de Bobine (opencode auth login) ; après connexion, gpt-6.2-sol n’est plus proposé par
  OpenCode : on prend gpt-6.1-sol, le sol le plus récent proposé.
Tours mesurés : 7 — médiane 14 s, max 1 min 31 s, total 3 min 00 s
Fins d'attente : accueil 1, erreur 1, tour-fini 11, carte 1, question 1
```

Le journal compte 40 notes ; le tableau ci-dessous en garde 39 pour Bobine, regroupées ou
précisées, plus 3 constats ajoutés à la relecture des captures et du code (D33, D35, D41), et sépare
ce qui vient d'OpenCode ou du modèle (O1 à O6).

## Constats — Bobine

Gravité : **G** gênant, **m** mineur, **i** idée (aucun bloquant). Statut : **confirmé** = vu au
moins deux fois ou reproduit ; **1×** = vu une fois.

| N° | Grav. | Cat. | Statut | Ce qui se passe → ce qui était attendu | Reproduire | Capture | Hypothèse (code) |
|---|---|---|---|---|---|---|---|
| D1 | G | logique | **confirmé 3×** | Un sous-agent OpenCode (`explore`) travaille 1 min 21 s à 2 min, sa carte dit « Sous-agent · 1 en cours » avec un spinner, mais juste dessous : **« Terminé en 10 s »**, pied de barre « OpenCode Prêt », aucune pastille « En cours » sur la conversation (`attendre` du pilote rend `tour-fini`). La mère répond ensuite hors tour, collée sous sa première réponse sans séparation ni heure ; le bilan reste « Terminé en 10 s ». C'est le défaut « Terminé en 3 min alors que l'agent réfléchit encore » de Jérôme. → Tant qu'un sous-agent tourne : indicateur « en cours » (conversation, barre latérale, pied) ; bilan donné quand la réponse hors tour arrive, avec la durée réelle. | Demander « Lance un sous-agent explore qui liste les endpoints REST, puis résume-moi en 5 lignes » ; regarder sous la carte Sous-agent pendant qu'il tourne. | `sessions/2026-11-19-201025/captures/202543-note-fenetre.png`, `202828-capture-fil.png`, `203918-capture-fenetre.png`, `204127-capture-fenetre.png` | `src/renderer/src/components/thread/TurnSummary.tsx:22-50` : `lastTurnFacts` prend la réponse qui a fini le tour (`end_turn`) et écarte exprès la réponse hors tour (fiche 232) ; l'indicateur et le statut ne suivent que le tour ACP. |
| D2 | G | bug | **confirmé 2×** | Après `/compact` (« Conversation résumée pour libérer du contexte »), la jauge reste à **26,1k / 4 %** puis **38,3k / 6 %** (composer et Session › Contexte). Seule la répartition bouge : « Messages » tombe (20,5k → 1,1k) et « Agent (non détaillé) » absorbe l'écart (54 → 19,5k ; 4,7k → 31,2k). La jauge ne redescend qu'au tour suivant (12k / 2 %), où « Messages ≈ 0 » s'affiche alors qu'un message vient d'être échangé. C'est le défaut « 57 % après compactage » de Jérôme. → Après `compaction_update`, total marqué « à relire » ou estimé, pas l'ancien chiffre. | Conversation OpenCode de quelques tours → `/compact` → lire la jauge. | `202147-note-fenetre.png` | `src/shared/context-breakdown.ts:154-162` garde `usage.context.used` du dernier `usage_update` ; OpenCode n'en envoie aucun après `compaction_update` (agents.log) ; seul `contextStart` (l. 60) avance. `agent-host.ts:936` sait déjà qu'une compaction a eu lieu (`sessionContextDue = 'compacted'`). |
| D3 | G | bug | **confirmé 3×** | **Le mode et le modèle fuient d'une conversation à l'autre.** Après relance, je passe une conversation en **Plan** puis en **GPT-6 Sol** ; les filles « README », « Endpoint » et « Relecture », en Build / GPT-6.1 Sol jusque-là, s'ouvrent en Plan et GPT-6 Sol (agents.log : `session/load`, puis `set_config_option mode=plan` et `model=openai/gpt-6-sol` sur leur session). La mère, rouverte avant ces changements, reste en Build. Risque inverse : une conversation laissée en Plan rouverte en Build écrit sans qu'on l'ait voulu. → Une conversation rouverte garde ses propres réglages. | Relancer Bobine ; dans A, changer le mode ou le modèle ; ouvrir B, pas encore rouverte depuis la relance ; lire ses puces. | (agents.log, journal 20:46:39 et 20:47:01) | `src/main/conversations/host-options.ts:113` passe les réglages retenus pour le profil (`settings.current.controls[profile.id]`, dernier choix fait n'importe où) en `initialControls` ; `src/main/agent/agent-host.ts:1230-1237` les applique aussi à la réouverture, seul `initialMode` est écarté. |
| D4 | G | bug | **confirmé 2×** | Une fille de rôle (« Code reviewer ») arrêtée par ■ dans Session › En cours s'affiche **« Code reviewer a fini »** avec une coche verte (carte du rôle, ligne des Sous-tâches « 5 terminées », barre latérale « Finie »). Seul l'avis du dessous dit « … a été arrêté ». → L'état « arrêtée » partout. | Tuile Équipe « Code reviewer » → une demande → ■ dans Session › En cours au bout de 15 s. | `204414-note-fenetre.png`, `204432-capture-fenetre.png` | `src/shared/children.ts:350-375` : `ChildState` n'a pas d'état « arrêtée » ; une fille annulée revient à `ready` et tombe dans `'done'`. |
| D5 | G | logique | 1× | Seul le **dernier** tour garde son bilan. Un tour d'implémentation (≈ 1 min 30, 5 fichiers +130 −2), suivi d'un message en file, n'affiche plus que « Terminé en 4 s » (la réponse d'une phrase à ce message). Le bilan « Terminé en 14 s » du tour d'avant a disparu lui aussi. Avec une file d'attente, le seul bilan affiché parle d'un tour de 4 s. → Un bilan par tour, ou un bilan qui couvre toute la suite. | Envoyer une tâche, puis un 2e message pendant le tour. | — (journal 20:18:30) | `TurnSummary.tsx:22-50` (`lastTurnFacts`, dernier message utilisateur seulement). |
| D6 | G | bug | **confirmé 2×** | Après la connexion (`opencode auth login`) puis « Réessayer », et encore au message suivant : **erreur brute rouge « Internal error: Model unavailable: openai/gpt-6.2-sol »**, sans carte ni « Choisir un autre modèle ». L'avis jaune « … pas connecté à son fournisseur » reste affiché alors qu'on vient de se connecter. La puce du modèle montre l'identifiant brut « gpt-6.2-sol », qu'OpenCode ne propose plus. → La même carte « Modèle refusé » (fiche 210), et un avis périmé retiré. | Modèle d'un fournisseur non connecté → envoyer → se connecter → Réessayer, avec un compte qui ne propose pas ce modèle. | `201425-note-fenetre.png`, `201413-capture-fenetre.png` | Le `-32603 Model unavailable` n'est pas reconnu comme un modèle refusé (seul `-32000 Authentication required` l'est). |
| D7 | G | manque | 1× | Demandé « dans ta liste de tâches » : OpenCode 2.3 n'a ni outil de liste ni `plan` ACP (agents.md) ; il rend des cases Markdown. Le panneau Tâches dit « L'agent n'a pas encore de liste de tâches dans cette conversation » sans dire que cet agent n'en tient **jamais**. → Le dire (propre à l'agent), voire reprendre les cases du message. | Demander une décomposition en sous-tâches, ouvrir Tâches. | `201506-capture-panneau.png` | Limite d'OpenCode (O2) ; manque d'explication côté Bobine. |
| D8 | G | visuel | **confirmé** (plusieurs tours) | Les outils `execute` d'OpenCode s'affichent **« execute »** tout court : ni commande, ni intention. Déplié, on lit un JSON de découverte d'outils (`tools.opencode.worktree_list`, `tools.bobine.preview_list`…). → Un libellé humain (« Cherche ses outils ») ou ces appels masqués. | Premier tour d'une conversation OpenCode 2.3. | `201601-note-fenetre.png`, `201540-capture-fil.png` | Carte `execute` sans titre déduit quand `rawInput` ne porte pas de commande. |
| D9 | G | logique | 1× | Carte de fusion : « La mère recommande « README » ; **l'autre attend son avis** ». Or la mère est au repos et rien ne la réveille quand une fille change après sa recommandation (correctif de relecture committé dans « Endpoint », marqué « À revoir »). L'utilisateur attend un avis qui ne viendra pas. → Relancer la mère, ou un bouton « Demander son avis ». | Fille recommandée → relecture → « Envoyer à l'agent » → la fille corrige → revenir à la mère. | `203000-capture-fil.png`, `203008-capture-fenetre.png` | — |
| D10 | G | visuel | **confirmé** | Modifications › Filles, à la largeur par défaut du panneau : titres coupés (« Endpoint rapp… »), branche sur deux lignes, « +227 / −0 » coupé en deux, quatre icônes sans libellé. Illisible sans agrandir. | Ouvrir Modifications › Filles avec 2 filles. | `202355-note-fenetre.png`, `202328-capture-fenetre.png` | — |
| D11 | G | logique | 1× | Après « 2 fusionnées dans main », Modifications › Filles montre encore les deux filles « À revoir » et « Recommandée ». Seule la carte Sous-tâches dit « fusionnée ». → « Fusionnée » (et « Nettoyer ») dans le panneau aussi. | Fusionner depuis la carte Sous-tâches, puis ouvrir Modifications › Filles. | `203119-capture-fenetre.png` | — |
| D12 | G | logique | **confirmé** (partout) | **Coût « ≈ 0,00 $US » partout** (filles, Sous-tâches, relecture, Mon activité « Coût estimé ≈ 0,00 $US » pour 200k jetons sur GPT-6.1 Sol). OpenCode connecté par abonnement renvoie 0 : Bobine le présente comme gratuit, et un plafond de coût ne se déclencherait jamais. → « Inclus dans l'abonnement » ou « coût non communiqué ». | Toute la session. | `203545-note-fenetre.png` | Origine OpenCode (O3), présentation Bobine. |
| D13 | m | logique | **confirmé 2×** | « Terminé en 1 min 11 s » compte les 40 s passées à attendre ma décision sur « Tâches proposées » (« Terminé en 1 min 31 s » de même, avec une question). Et il s'affiche sous « Sous-tâches · 2 en cours ». | Carte de propositions → attendre 40 s → Lancer. | `201957-capture-fenetre.png` | — |
| D14 | m | logique | **confirmé** | L'indicateur montre la durée de l'**étape** (« Réfléchit… 3 s », « Écrit… 0 s » au bout de 20 à 60 s de tour). La durée du tour n'est que dans l'infobulle : on croit que le tour vient de commencer. | Tout tour long. | `201628-capture-fenetre.png` | `src/renderer/src/components/thread/WorkingIndicator.tsx:77-79` |
| D15 | m | visuel | 1× | Grand vide (≈ 100 px) entre un message parti de la file et la réponse de l'agent. | Message en file. | `201758-capture-fenetre.png` | — |
| D16 | m | visuel | **confirmé** | Liste à cases Markdown : la 2e ligne d'un élément long repart sous la case, sans alinéa sous le texte. | Réponse avec `- [ ]` long. | `201540-capture-fil.png` | CSS des `task-list-item`. |
| D17 | m | visuel | **confirmé 3×** | L'ordre des filles dans la barre latérale change à chaque activité (Endpoint, README et Relecture permutent 3 fois en 10 min). La carte Sous-tâches et Modifications › Filles gardent l'ordre de lancement. | Deux filles actives. | `201957-capture-fenetre.png`, `202203-capture-fenetre.png`, `203008-capture-fenetre.png` | — |
| D18 | m | visuel | 1× | Outil de la mère affiché « Recommande de fusionner **ddb49019-d530-4dc7-aae5-83d4301eb6b3** » : l'identifiant de la fille au lieu de son titre. | La mère recommande une fille. | — (journal 20:23:55) | `src/shared/app-tools.ts:306-315` cite `a['child']` tel quel ; `message_child` probablement aussi. |
| D19 | m | visuel | **confirmé** | Fille ouverte : titre très coupé (« Endpoint rappels et … ») alors qu'il reste de la place, suivi d'un glyphe « ⌙ » / « ↳ de… » peu clair. Session › Dossier affiche « 20261119-2019-74b5 » (nom technique du worktree). | Ouvrir une fille en worktree. | `202203-capture-fenetre.png`, `202844-capture-fenetre.png` | — |
| D20 | m | visuel | 1× | « Puis nettoyer » est un interrupteur (`aria-pressed`) dessiné comme un bouton d'action à côté de « Fusionner » : rien ne montre s'il est coché. | Carte Sous-tâches avec fusion possible. | `203008-capture-fenetre.png` | — |
| D21 | m | logique | 1× | Après la fusion, `main` reçoit « **Merge branch 'main' into bobine/20261119-2019-118a** » (la base entre dans le worktree, puis `main` avance en fast-forward). Dans `git log` de main, le message se lit à l'envers ; la branche de la fille est elle aussi modifiée. | Fusionner 2 filles dont la 2e est en retard. | — | `src/main/changes/worktree-cycle.ts:536-546` (ADR-0022). |
| D22 | m | manque | 1× | Pendant un tour, les puces Mode et Modèle sont grisées sans explication. L'infobulle « Session Mode : Build (Maj+Tab : mode suivant) » est en anglais et annonce un raccourci qui ne marche pas pendant le tour. Codex et Claude Code permettent de changer le mode en route (appliqué au prochain message). | Cliquer la puce Mode pendant un tour. | `203119-capture-fenetre.png` | — |
| D23 | m | logique | 1× | Message de commit rédigé par l'agent en anglais (« fix: validate request bodies… »), alors que l'historique du dépôt est en français. | Modifications › Git › Committer. | — (journal 20:34:21) | Consigne de rédaction (fiche 246). |
| D24 | m | visuel | 1× | Mon activité : la 1re étiquette de mois de la grille est coupée (« ’s » pour mars). Le panneau de droite garde la Session de la dernière conversation sur une page qui n'en est pas une. | Ouvrir Mon activité. | `203533-capture-fenetre.png` | — |
| D25 | m | visuel | 1× | Fenêtre étroite (720 px, clair) : Code | Discussion déborde de la barre latérale (« ⌘2 » coupé) ; titre réduit à « Je veu… » quand la pastille « Profil temporaire · effacé à la fermeture » garde toute sa largeur ; pastille des modifications collée au bord droit. | Viewport 720 px. | `narrow-720-clair.png`, `203645-note-fenetre.png` | — |
| D26 | m | visuel | 1× (provoqué) | La racine `#root` peut défiler : après un `scrollIntoView` (fait par mon outil, mais un focus peut faire pareil), l'app reste décalée de 10 px vers le haut (barre de titre rognée), sans moyen de revenir. | `scrollIntoView({block:'start'})` sur une carte du fil. | `narrow-900-sombre.png`, `204004-capture-fenetre.png` | `overflow: hidden` absent sur la racine. |
| D27 | m | visuel | 1× | Panneau Échanges ACP à la largeur par défaut : colonne méthode coupée à 4 ou 5 lettres (« répo… », « sess… », « tool… »). | Ouvrir l'onglet ACP. | `203930-capture-panneau.png` | — |
| D28 | m | visuel | 1× | Menu de mode : en-tête « Session Mode » et descriptions en anglais (« The default agent… ») dans l'interface française. Textes de l'agent (ADR-0014), mais l'en-tête pourrait être traduit. | Puce Mode. | — | — |
| D29 | m | logique | 1× | Réglages › Diagnostic : « OpenCode ne sait pas supprimer une session » (OpenCode 2.3 le sait, agents.md : `delete` ✓), et le pied de page dit « sa session d'essai est supprimée ensuite » : les deux phrases se contredisent. | Réglages › Diagnostic. | `201117-capture-fenetre.png` | — |
| D30 | m | logique | 1× | Accueil, étape Dossier : « L'agent lit et modifie les fichiers de ce dossier, **avec votre accord** » : faux pour OpenCode, choisi à l'étape 1, qui écrit sans demander. | Accueil avec OpenCode. | `201052-capture-fenetre.png` | — |
| D31 | m | logique | 1× | Menu des modèles : 100+ modèles `openai/…` proposés sans dire lesquels sont connectés ; après un refus, « connexion à faire » ne marque que GPT-6.2 Sol alors que tous partagent le même fournisseur. | Menu des modèles d'OpenCode. | `201254-capture-fenetre.png` | — |
| D32 | m | visuel | 1× | Nouvelle conversation après le refus : avis « Réglage « Model » non appliqué (openai/gpt-6.2-sol) : Valeur non proposée pour « Model » : openai/gpt-6.2-sol ». Message technique, mi-anglais, et repli silencieux sur un modèle gratuit (Tidepool Alpha Free). | Modèle retenu qui n'est plus proposé → Nouvelle conversation. | `201342-capture-fenetre.png` | `initial-controls.ts` (avis d'un réglage inapplicable). |
| D33 | m | visuel | 1× | Conversation de relecture : la consigne interne en anglais (« Report with the `report_findings` tool… ») s'affiche en entier comme un message de l'utilisateur. | Faire relire… → ouvrir la relecture. | `202844-capture-fenetre.png` | (ajouté à la relecture des captures) |
| D34 | m | visuel | **confirmé** | Le bilan « Terminé en 4 s » de la mère reste collé sous des cartes arrivées après lui (filles de rôle lancées et arrêtées, avis d'arrêt). | Lancer un rôle après un tour fini. | `204432-capture-fenetre.png` | — |
| D35 | m | logique | 1× | Pastille « compte rendu à lire » (⊙) gardée sur README, alors que la mère a déjà repris ce compte rendu ; « Endpoint », dont le compte rendu n'a pas été ouvert non plus, est en ✓. | Deux filles finies, mère réveillée. | `202317-capture-fenetre.png` | (ajouté à la relecture des captures) |
| D36 | m | logique | 1× | Au premier lancement, IBM Bob est présélectionné et **lancé** (`bob acp`, pid 51192, main.log 19:10:25), puis arrêté quand on choisit OpenCode. La barre latérale dit « IBM Bob Prêt » avant tout choix. Écart au titre de la fiche 242 (« aucun agent lancé sans être choisi »). | Profil temporaire, écran d'accueil. | `201027-capture-fenetre.png` | — |
| D37 | m | bug | 1× (en partie provoqué) | `main.log` note en **ERROR** « Interface (error) : ResizeObserver loop completed with undelivered notifications » (8 lignes) au redimensionnement : du bruit qui masquerait de vraies erreurs. | Fenêtre redimensionnée (émulation). | — | Filtre des erreurs du renderer. |
| D38 | i | manque | — | Accueil, étape Essai : modèle imposé (« opencode/Tidepool Alpha Free »), sans choix avant l'essai ; le libellé mêle l'identifiant du fournisseur et le nom affiché. | — | `201052-capture-fenetre.png` | — |
| D39 | i | manque | — | « Faire relire… » propose par défaut le **même** agent et le **même** modèle que l'auteur ; une relecture vaut surtout avec un autre modèle. Le rôle « Code reviewer » de l'Équipe n'y est pas proposé. | — | `202406-capture-fenetre.png` | — |
| D40 | i | manque | — | Titre de conversation = début du premier message coupé (« Lance un sous-agent explore qui liste le… »). Claude Desktop, Codex et Cursor génèrent un titre court. | — | — | — |
| D41 | i | manque | — | Après une fusion faite par Bobine, la mère n'en sait rien. À « quel est le dernier commit sur main ? », elle répond 20a1f23 (deux fusions et un commit plus tôt, et juste après un compactage). → Un avis à l'agent après fusion ou commit faits par l'app. | — | `203600-capture-fenetre.png` | (ajouté) |

### Ce qui a bien marché

Lancement des filles depuis « Tâches proposées » (« Committer d'abord » géré par l'agent), suivi en
direct, réveil de la mère quand toutes ont fini, « Faire relire… » de bout en bout (remarque posée
sur les lignes du diff, « Envoyer à l'agent », correctif committé), fusion de deux branches qui ne
se touchent pas, interruption propre (outil « interrompu », aucun fichier à moitié écrit),
question à choix retrouvée après un changement de conversation, message de commit rédigé puis
commit avec « Défaire », carte de plan (« Envoyer mes remarques » / « Exécuter le plan »), reprise
après relance (fil intact, session rechargée), thème clair et sombre sans contraste fautif.

## Constats — OpenCode, le modèle ou l'environnement

| N° | Origine | Constat |
|---|---|---|
| O1 | OpenCode / compte | `openai/gpt-6.2-sol` refusé (`-32000 Authentication required: provider authentication required`) alors que `opencode auth login` montrait déjà OpenAI ✓. Après la reconnexion de Jérôme (dans le terminal de Bobine), le modèle n'est plus proposé du tout (`-32603 Model unavailable`). Le catalogue d'OpenCode annonce des modèles que le compte ne sert pas. |
| O2 | OpenCode 2.3 | Ni outil de liste de tâches ni `plan` ACP : une décomposition « dans ta liste de tâches » donne des cases Markdown (D7). |
| O3 | OpenCode | Coût 0 par abonnement (D12) ; aucun `usage_update` après `compaction_update` (D2) ni après une réponse hors tour (jetons de cette réponse non comptés). |
| O4 | OpenCode | Écrit et **committe sans demander** (`git commit` avant de lancer les filles), comme documenté (`writes-without-asking`). Surprenant pour un utilisateur venu de Claude Code. |
| O5 | modèle | Après compactage, réponse fausse sur le dernier commit (D41). |
| O6 | environnement | Docker arrêté : tests REST (Testcontainers) jamais exécutés. L'agent le dit honnêtement à chaque tour. |

## Non retenus (artefacts du test)

- Bandeau « Bobine s'est arrêtée de façon inattendue » à la relance : causé par ma **copie** du
  profil, faite pendant que l'app tournait (`running.json` copié). Ce n'est pas un défaut.
- Nouvelle conversation affichée à la relance au lieu de la mère : normal, puisque le pilote impose
  le dossier (`--dossier` → `BOBINE_WORKSPACE`, exception documentée par la fiche 243).
- Terminal ouvert avec `opencode auth login` « tout seul » au premier refus : c'était Jérôme qui
  avait cliqué « Se connecter dans le terminal » (il suivait la session).
- Message « salut » dans la mère : envoyé par Jérôme. Il a servi de 2e reproduction de D6.

## Mes 5 priorités

1. **Un état « en cours » qui dit vrai** (D1, D5, D13, D34) : tant qu'un sous-agent ou une réponse
   hors tour est attendu, la conversation reste « en cours » (pastille, pied, indicateur), et le
   bilan « Terminé en … » ne s'affiche qu'à la vraie fin, avec la durée réelle. C'est la plainte n° 1
   de Jérôme, reproduite 3 fois.
2. **Garder les réglages de chaque conversation** (D3) : à la réouverture, ne pas appliquer le
   dernier mode ou modèle choisi ailleurs. Avec Bob, c'est aussi une question de sécurité
   (Plan → Build).
3. **La jauge de contexte après compactage** (D2) : invalider le total à `compaction_update`
   (`agent-host.ts:936` le détecte déjà), le marquer estimé jusqu'au prochain `usage_update`.
   C'est la plainte n° 2 de Jérôme, reproduite 2 fois.
4. **Des états de filles justes** (D4, D9, D11, D35) : « arrêtée » distincte de « finie »,
   « fusionnée » dans Modifications › Filles, la mère réveillée quand une fille change après sa
   recommandation.
5. **Modèle refusé ou indisponible et coût d'abonnement lisibles** (D6, D31, D32, D12) : reconnaître
   `Model unavailable` comme un modèle refusé (carte et choix d'un autre modèle), retirer l'avis
   « pas connecté » une fois connecté, et ne plus afficher « 0,00 $ » pour un abonnement.

## Complément — parcours « rôles » rejoué sur la RC1 installée (2026-11-19, 21:14–21:23)

Bobine 1.0.0-rc.1 packagée (`/Applications`), profil réel de Jérôme, OpenCode + GPT-6.1 Sol, projet
vide `~/Development/bobine-recette/usecase-rc1` (git sans commit). Parcours : créer l'appli →
Expert UX/UI « À quoi ça pourrait ressembler ? » → la mère applique → Code reviewer « Relis le code ».
Journal : `.pilote/sessions/2026-11-19-211439/`.

| N° | Grav. | Constat |
|---|---|---|
| R1 | G | Clic sur un rôle, avant toute saisie : gros avertissement jaune « 10 modifications non commitées », « part du dernier commit () » (parenthèses vides : aucun commit), trois choix. Pour une question à un expert, le défaut devrait être la lecture seule dans le dossier, sans worktree. C'est ce chemin qui a conduit Jérôme à un commit vide (« Committer d'abord » sur un dépôt vide). |
| R2 | G | Entrée n'envoie pas : le focus saute sur « Committer d'abord ». « Demander un avis en lecture seule » ne fait que changer l'option : il faut renvoyer. |
| R3 | G | Un avis = trois cartes (carte du rôle, Sous-tâches, compte rendu), trois « ≈ 0,00 $US ». |
| R4 | G | Le compte rendu n'affiche que la première phrase (« J'ai examiné l'interface… », « J'ai relu toute l'application… ») : l'avis et les défauts trouvés ne se lisent qu'en ouvrant la fille ; déplié, il reste tronqué en fondu avec du Markdown brut. |
| R5 | G | « Partira à l'agent avec votre prochain message » : la mère ne réagit pas à l'avis demandé. |
| R6 | m | 2e rôle parti en lecture seule sans avertissement : choix retenu en silence. |
| R7 | m | Fille toujours « Compte rendu à lire » après que la mère l'a repris (D35) ; bilan « Terminé en … » collé sous les cartes des rôles (D34). |
| R8 | m | Panneau Navigateur ouvert tout seul sur `127.0.0.1:5173`, page blanche (serveur de l'agent arrêté). Icône « ☰ » sans libellé en haut du fil. |
| R9 | m | D36 reproduit sur l'app packagée (Bob « Démarrage… » à l'accueil avant tout choix). |
| R10 | i | Deux chemins de relecture (rôle Code reviewer et « Faire relire… ») sans dire lequel prendre. |
