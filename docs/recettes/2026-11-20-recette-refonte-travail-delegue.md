# Recette de la refonte « travail délégué » (fiches 255–266) — 2026-11-20

Testeur : Claude (Opus 5.5), en utilisateur exigeant, par `pnpm pilote` et quelques évènements
DevTools (saisie, clics, fenêtre étroite émulée). Aucun fichier de code modifié, rien de commité
dans le dépôt. Les chemins de captures ci-dessous sont relatifs à `.pilote/sessions/`.

## Contexte

| | |
|---|---|
| Bobine | 1.0.0-rc.1, build du dépôt, `main` **854d9f1**, Electron 45.4.1, macOS 27.2.1 |
| Profil | copie `~/Development/bobine-recette/profil-recette-266` (`--profil`, `--vrai-trousseau`) ; journal Détaillé |
| Projet | `~/Development/bobine-recette/recette-266`, dépôt git vide sans commit, recréé avant chaque passage |
| Agent | OpenCode 2.3.0 |
| Passages | **A** 08:25–08:27 : openai/gpt-6.1-sol refusé (`-32000 Authentication required`), arrêt (`2026-11-20-082558/`) · **B** 08:28–08:58 : modèles gratuits, DeepSeek V4.1 Flash Free puis Big Pickle, étapes 1 à 4 (`2026-11-20-082814/`) · **C** 08:58–09:24 : **openai/gpt-6.1-sol** après la reconnexion de Jérôme, étapes 1 à 13 (`2026-11-20-085815/`) |
| Durée | 59 min d'app en tout ; passage C : 26 min, 7 tours mesurés (médiane 1 min 30 s, max 3 min 09 s), 0 intervention |
| Coût lu dans l'app | GPT-6.1 Sol : **« coût inconnu »** partout (cartes, carte de groupe, Mon activité). DeepSeek V4.1 Flash Free : « gratuit ». Big Pickle : « coût inconnu ». Jamais « ≈ 0,00 $US ». |

Parcours C : décomposition (sans code) → implémentation minimale (12 fichiers, sans commit) →
`@Expert UX/UI` (dépôt sans commit, non propre : le cas de Jérôme) → appliquer → répondre à
l'expert → commit par Modifications › Git (message rédigé) → 2 travaux en parallèle (thème sombre,
édition par double-clic) → commit de chaque travail depuis sa vue Git → fusion avec « Puis
nettoyer » → `@Code reviewer` → remarque → « Demander à OpenCode de corriger » → sous-agent
`explore` → `/compact` → mode Plan et GPT-6 Sol, puis réouverture d'une autre conversation →
`@Expert sécurité` arrêté → Mon activité → repère en bas du fil → fenêtre 720 px, clair et sombre.

## Tableau de vérification (constats d'origine)

C = passage C (GPT-6.1 Sol), B = passage B (gratuit).

| Constat | Statut | Preuve |
|---|---|---|
| **R1** alerte avant la frappe, « dernier commit () », commit vide | **corrigé** : aucun avertissement, ligne discrète « Partira à Expert UX/UI, dans sa propre conversation · OpenCode · lecture seule demandée · dans ce dossier » ; `git log --all` vide après l'envoi. Il reste une ligne d'aide en jaune (N7). | avant `2026-11-19-211439/captures/211740-capture-fenetre.png` → après `2026-11-20-085815/captures/090228-capture-fenetre.png` |
| **R2** Entrée n'envoie pas | **corrigé** (Entrée envoie, focus dans la saisie), avec 1 perte de texte non reproduite (N5) | `2026-11-20-085815/captures/090358-capture-fenetre.png` |
| **R3** trois cartes pour un avis | **corrigé** : la bulle « @Expert UX/UI … », puis une seule carte | avant `2026-11-19-211439/captures/211902-capture-fenetre.png` → après `2026-11-20-085815/captures/090358-capture-fenetre.png` |
| **R4** avis réduit à une phrase | **corrigé** : réponse entière en Markdown, « Lire la suite » / « Replier » | avant `2026-11-19-211439/captures/211912-capture-fenetre.png` → après `2026-11-20-082814/captures/085309-capture-fenetre.png` |
| **R5** la mère ne réagit pas | **corrigé** : « Demander à OpenCode d'appliquer cette réponse » → « Transmise à OpenCode · 09:04 », l'agent applique (3 fichiers +39 −10) | `2026-11-20-085815/captures/090408-capture-fenetre.png` |
| Répondre au rôle dans la même carte | **corrigé** : la bulle de suite et sa réponse s'ajoutent dans la carte | `2026-11-20-085815/captures/090549-capture-fenetre.png` |
| **R6** choix retenu en silence | **corrigé** : la ligne dit le mode à chaque fois | idem R1 |
| **R7 / D35** « à lire » gardé | **non corrigé** : la conversation affichée garde « Réponse à lire » ; les travaux lus dans leur carte restent en gras « non lu » | `2026-11-20-085815/captures/092424-capture-fenetre.png` |
| **R8** navigateur ouvert seul | non jugé : l'agent ouvre bien le panneau Navigateur sur son serveur, mais la page est une vue native, absente des captures du pilote | — |
| **R9 / D36** Bob lancé sans être choisi | **corrigé** : au démarrage, seul `opencode acp` est lancé (main.log 07:58:16) ; `bob acp` ne l'est qu'à l'ouverture de Réglages › Diagnostic (sonde de version, voulue) | main.log |
| **R10 / D39** deux chemins de relecture | **en partie** : `@Code reviewer` donne bien la carte-réponse et ses remarques ; « Faire relire » de Modifications non rejoué | — |
| **D1** « Terminé en 10 s » pendant un sous-agent | **corrigé** : pendant le sous-agent `explore`, pied « Travaille encore… » (état `ready background`), pastille « En cours » ; à la vraie fin, le bilan « 09:19 · 28 s » arrive sous la réponse hors tour. Reste : cette réponse est collée sous la première, sans séparation (N15). | avant `2026-11-19-201025/captures/202543-note-fenetre.png` → après `2026-11-20-085815/captures/092019-capture-fenetre.png` |
| **D2** jauge figée après `/compact` | **corrigé** : 55,1k (9 %) → « ≈ 817 sur 628k (≈ 0 %) », avec « Estimé après le résumé… OpenCode donnera le chiffre exact au prochain échange » | avant `2026-11-19-201025/captures/202147-note-fenetre.png` → après `2026-11-20-085815/captures/092104-capture-fenetre.png` |
| **D3** mode et modèle qui fuient | **corrigé** : mère passée en Plan + GPT-6 Sol ; une conversation pas encore rouverte garde Big Pickle · Build, aucun `set_config_option` à son `session/load` (agents.log 08:21:59) | `2026-11-20-085815/captures/092204-capture-fenetre.png` |
| **D4** rôle arrêté affiché « a fini » | **corrigé** : « arrêté » en rouge, « Arrêté avant la fin de sa réponse. », barre latérale « Arrêté », « Relancer » | avant `2026-11-19-201025/captures/204414-note-fenetre.png` → après `2026-11-20-085815/captures/092246-capture-fenetre.png` |
| **D5** un seul bilan | **corrigé** dans ce parcours : chaque réponse qui finit un tour garde son pied (09:02, 09:05, 09:07, 09:12, 09:19) ; la file d'attente n'a pas été rejouée | `2026-11-20-085815/captures/091220-capture-fenetre.png` |
| **D6** modèle indisponible en erreur brute | **en partie** : `-32000` → carte « Le modèle … n'a pas répondu » avec « Choisir un autre modèle » / « Se connecter dans le terminal » ; mais « Free usage limit reached » reste une erreur brute (N3) | `2026-11-20-082558/captures/082650-capture-fenetre.png`, `2026-11-20-082814/captures/085511-capture-fenetre.png` |
| **D8** outils « execute » | **corrigé** : 0 libellé « execute » nu sur 44 | — |
| **D10** Modifications › Filles illisible | **en partie** : onglet « Travaux », « fusionné · nettoyé » lisible ; titres encore coupés (« Thème sombre … ») et 4 icônes sans libellé | `2026-11-20-085815/captures/091414-capture-panneau.png` |
| **D11** fusionnées montrées « À revoir » | **corrigé** : « fusionné · nettoyé » | idem |
| **D12** « ≈ 0,00 $US » partout | **corrigé** : « coût inconnu » pour GPT-6.1 Sol, « gratuit » pour un modèle gratuit (sauf Big Pickle, N10) | `2026-11-20-085815/captures/092257-capture-fenetre.png` |
| **D13** attente comptée dans la durée | **corrigé** : « 08:36 · 7 min 53 s · 22 s à vous attendre · 10 fichiers +794 −0 » | `2026-11-20-082814/captures/083700-capture-fenetre.png` |
| **D14** durée de l'étape seulement | **non corrigé** (hors des lots) : « Réfléchit… 2 s », « Écrit… 1 s » en cours de tour | `2026-11-20-085815/captures/090714-capture-fenetre.png` |
| **D17** ordre des filles qui change | **non corrigé** : sous la mère, les travaux changent d'ordre à chaque activité | `092246` → `092424` (passage C) |
| **D20** « Puis nettoyer » sans état | **corrigé** : vraie case à cocher | `2026-11-20-085815/captures/091220-capture-fenetre.png` |
| **D21** « Merge branch 'main' into bobine/… » | **non corrigé** : `db4a5e1 Merge branch 'master' into bobine/20261120-0907-1382` sur master, et il fausse la relecture (N1) | `git log` |
| **D24** Mon activité | **non corrigé** : 1re étiquette de mois réduite à « . » ; le panneau garde la Session | `2026-11-20-085815/captures/092257-capture-fenetre.png` |
| **D25** fenêtre étroite | **en partie** : aucun débordement horizontal à 720 px ; « Code ⌘1 / Discussion ⌘2 » déborde toujours de la barre latérale | `2026-11-20-085815/captures/narrow-720-light.png`, `narrow-720-dark-groupe.png` |
| **D34** bilan collé sous des cartes arrivées après | **corrigé** : le bilan est le pied de la réponse ; les cartes de rôle s'empilent dessous | `2026-11-20-085815/captures/090358-capture-fenetre.png` |
| Carte de groupe (264) | **corrigé** : « 2 travaux proposés » (Refuser / Faire ici / Lancer, « Tout lancer ») → « 2 en cours » → « 2 ont répondu » « Recommandé » → fusion dans la carte « 2 travaux fusionnés dans master en < 1 s. Conversations archivées… » | `090702` → `090714` → `091220` → `091404` (passage C) |
| Repère en bas du fil (261) | **corrigé** : « ↑ Expert UX/UI a répondu · Voir », et « Voir » fait défiler jusqu'à la carte (flèche à revoir, N12) | `092416` → `092424` (passage C) |
| D7, D9, D15, D16, D18, D19, D22, D23, D26–D33, D37, D38, D40, D41 | non rejoués ou non vus dans ce parcours | — |

## Nouveaux constats — Bobine

Gravité : **G** gênant, **m** mineur, **i** idée. Aucun bloquant.

| N° | Grav. | Cat. | Constat | Reproduire | Capture | Hypothèse (code) |
|---|---|---|---|---|---|---|
| N1 | **G** | logique | **`@Code reviewer` « Relis ce qui a été fait » ne relit que le dernier commit.** Sur master propre après la fusion, la consigne dit « the last commit db4a5e1 … `git diff e5af1b1 db4a5e1` (against its first parent) ». db4a5e1 est le commit de fusion (D21) : le diff ne contient que le thème sombre. L'édition par double-clic et l'appli ne sont pas relues, et la carte affiche « Rien à signaler » sans dire ce qui a été relu. Relancé sur ces fichiers à la main, le relecteur trouve une perte de données réelle (`src/storage.ts:53-55`). C'est la dernière étape du parcours de Jérôme, et elle donne une fausse assurance. | Travaux fusionnés, puis `@Code reviewer` « Relis ce qui a été fait ». | `2026-11-20-085815/captures/091519-capture-fenetre.png` | `src/shared/review.ts:133-138` : portée `commit` = le dernier commit contre son 1er parent. Il faudrait plutôt relire depuis le début de la conversation, ou dire la portée dans la carte. |
| N2 | **G** | logique | Clic sur `src/storage.ts:53-55` : le panneau montre la remarque, mais le diff dit « src/storage.ts depuis e5af1b1 — Aucune modification » : les lignes visées ne s'affichent pas. Après le correctif (+22 −8), la vue reste « Aucune modification ». | Suite de N1, cliquer `fichier:ligne`. | `2026-11-20-085815/captures/091710-capture-fenetre.png`, `092019-capture-fenetre.png` | Même base que N1 ; la vue diff n'est pas rafraîchie. |
| N3 | **G** | logique | Quota d'un modèle gratuit épuisé : **erreur brute en anglais** (« Internal error: Free usage limit reached. Connect a provider or subscribe to OpenCode Go… or switch models. »), dans le fil et dans la carte d'un travail. Ni carte « Modèle refusé », ni « Choisir un autre modèle ». | Modèle gratuit d'OpenCode jusqu'à la limite (≈ 25 min ici). | `2026-11-20-082814/captures/085511-capture-fenetre.png`, `085629-capture-fenetre.png` | Le refus de modèle (fiche 259) ne reconnaît pas ce `-32603`. |
| N4 | **G** | visuel | Carte-réponse en cours : l'activité affiche **la commande entière**, avec des heredocs JS de 6 à 10 lignes (« A lancé node - <<'JS' function lum(hex){… »). La carte enfle et devient illisible. | Rôle qui lance des `node -e` longs (vu avec DeepSeek). | `2026-11-20-082814/captures/084036-capture-fenetre.png` | Libellé d'activité de la carte (`useWorkActivity` / `WorkCard`) sans coupe à la première ligne. |
| N5 | **G** (1×) | bug | Rôle choisi, texte tapé (focus vérifié), Entrée 0,3 s plus tard : **la saisie se vide et rien ne part**. Aucun échange dans agents.log, aucune bulle, aucun message. Le 2e essai, identique, part. Ce peut être mon outil (évènements DevTools), mais une perte silencieuse doit être écartée. | Dépôt sans commit et non propre, choisir un rôle, taper, Entrée aussitôt. | `2026-11-20-085815/captures/090251-capture-fenetre.png` | Envoi refusé ou en double pendant le calcul de la ligne de lancement, sans remettre le texte (la fiche 263 dit « un envoi refusé remet jeton et texte »). |
| N6 | m | logique | La réponse d'un rôle commence par **« Compte rendu »** (passage B), le mot que la fiche 266 retire. Il vient de la consigne de Bobine : `src/main/roles/builtin-fr.ts:12` (« Commence ta réponse finale par un court compte rendu… »). GPT-6.1 Sol écrit « Bilan — ». | `@Expert UX/UI` avec DeepSeek. | `2026-11-20-082814/captures/085234-capture-fenetre.png` | Reformuler la consigne. |
| N7 | m | visuel | Rôle choisi, rien tapé : l'aide « Écrivez votre demande après le rôle : c'est elle qui part. » est en **jaune**, la couleur d'alerte, avant la frappe (règle 6 de la fiche 260). | Choisir un rôle. | `2026-11-20-085815/captures/090228-capture-fenetre.png` | — |
| N8 | m | logique | Une suite à un travail part avec **le modèle du travail** (DeepSeek épuisé), même après un changement de modèle dans la conversation qui l'a lancé. La carte n'offre que « Relancer » : il faut ouvrir la conversation du travail pour changer de modèle. | Passage B, étape 4. | `2026-11-20-082814/captures/085629-capture-fenetre.png` | Cohérent avec D3, mais l'issue manque dans la carte. |
| N9 | m | visuel | « Relancer » une suite en erreur **repose la bulle** : deux bulles identiques dans la carte. | Suite en erreur → Relancer. | `2026-11-20-082814/captures/085735-capture-fenetre.png` | Bulle `followUp` posée à chaque envoi (263). |
| N10 | m | logique | Mon activité : la tuile « coût inconnu — **1 échange** sans coût communiqué », alors que le tableau compte 34 + 3 échanges en coût inconnu. Big Pickle, gratuit, est affiché « coût inconnu » (probablement OpenCode, qui n'envoie pas de coût nul pour lui). | Mon activité après le parcours. | `2026-11-20-085815/captures/092257-capture-fenetre.png` | Compteur de la tuile ; origine OpenCode pour Big Pickle. |
| N11 | m | visuel | La réponse du Code reviewer **répète son bilan** : résumé, « Rien à signaler. », puis le même texte (verdict de fin de tour). | `@Code reviewer`. | `2026-11-20-085815/captures/091519-capture-fenetre.png` | Résumé de `report_findings` + message final affichés tous les deux. |
| N12 | m | visuel | Repère « **↑** Expert UX/UI a répondu · Voir » alors que la carte est **plus bas** que la vue. | Remonter en haut du fil, un rôle répond. | `2026-11-20-085815/captures/092416-capture-fenetre.png` | Flèche fixe. |
| N13 | m | logique | Travail arrêté : la carte dit « Pas encore transmise à OpenCode — elle le sera avec votre prochain message » pour une réponse partielle. | `@Expert sécurité` → Arrêter. | `2026-11-20-085815/captures/092246-capture-fenetre.png` | — |
| N14 | m | logique | Après `/compact`, « Outils de Bobine » passe de ≈ 4,8k à ≈ 672, alors que les définitions d'outils ne rétrécissent pas avec un résumé. | `/compact`. | `2026-11-20-085815/captures/092104-capture-fenetre.png` | Estimation de la fiche 257. |
| N15 | m | visuel | La réponse hors tour qui suit le sous-agent est collée sous la première réponse, sans séparation (reste de D1). | Sous-agent `explore`. | `2026-11-20-085815/captures/092019-capture-fenetre.png` | — |
| N16 | m | logique | Dépôt sans commit : Modifications › Git dit « 13 fichiers +2 367 −0 · **depuis le dernier commit** ». | Dépôt neuf, onglet Git. | `2026-11-20-085815/captures/090606-capture-fenetre.png` | Texte unique pour les deux cas. |
| N17 | m | logique | Juste après « Modèle refusé », « Nouvelle conversation » repart sur le même modèle, pied « Prêt », sans rappel du refus. | Passage A. | `2026-11-20-082558/captures/082716-capture-fenetre.png` | — |
| N18 | m (1×) | manque | Après « Répondre à Expert UX/UI », le curseur était resté dans le terminal du panneau (passage B) ; au passage C, il va bien dans la saisie. | — | — | Focus volé par le terminal ouvert. |
| N19 | i | manque | Travaux finis mais non commités (consigne « ne committe pas » transmise par l'agent) : la fusion est grisée, avec une explication claire, et il faut ouvrir chaque travail pour committer. Un « Committer et fusionner » dans la carte éviterait deux allers-retours. | Passage C, étape 6. | `2026-11-20-085815/captures/091220-capture-fenetre.png` | — |
| N20 | i | visuel | Le panneau Navigateur s'ouvre vide au lancement et prend un tiers de la fenêtre (état retenu du profil copié ?). | Lancer sur ce profil. | `2026-11-20-082558/captures/082606-capture-fenetre.png` | À confirmer sur un profil neuf. |

Outil de test (pas l'app) : `pilote attendre` rend « calme » pendant qu'un travail tourne, alors
que sa carte bouge (minuteur, activité).

## Constats — OpenCode, le modèle ou l'environnement

| N° | Origine | Constat |
|---|---|---|
| O1 | OpenCode / compte | Au premier passage, `openai/gpt-6.1-sol` refusé (`-32000 Authentication required`). Jérôme s'est reconnecté dans le terminal du panneau à 08:55 ; le passage C a ensuite fonctionné. |
| O2 | OpenCode | Quota gratuit de DeepSeek V4.1 Flash Free épuisé en ≈ 25 min (« Free usage limit reached »). Big Pickle ne renvoie pas de coût (« coût inconnu »). |
| O3 | modèle (DeepSeek) | Lit le dossier voisin `../usecase-rc1` et en déduit le « spec », bascule en anglais, fait un audit de 15 min au lieu de proposer une direction, et lance `kill` et des serveurs en « lecture seule demandée » (ce n'est qu'une demande au modèle). |
| O4 | OpenCode | Committe sans qu'on le demande (passage B). Au passage C, la consigne « ne committe pas » est respectée, et l'agent la transmet aux travaux. |
| O5 | modèle (GPT-6.1 Sol) | Bonne tenue : décomposition, implémentation testée (15 → 34 tests), relecture des travaux avant de recommander la fusion, correctif de la remarque du relecteur. |

## Verdict

**Pas encore prêt pour une rc.2, mais il en manque peu.** La refonte tient sur le parcours réel de
Jérôme. Plus d'alerte avant la frappe, plus de commit vide. Une bulle, une carte, une réponse
lisible et transmise. La carte de groupe reste à sa place jusqu'à la fusion et au nettoyage.
« Travaille encore… » tient jusqu'à la vraie fin. La jauge est juste après `/compact`, les
réglages restent propres à chaque conversation, un travail arrêté s'affiche « arrêté », et le coût
est honnête. D1, D2, D3, D4, D12, D13, R1 à R5 sont corrigés.

Ce qui bloque la rc.2 : **la relecture (N1, N2)**. C'est la dernière étape du parcours, et elle dit
« Rien à signaler » après n'avoir relu que le dernier commit, ici un commit de fusion. Le même
relecteur, pointé à la main sur les bons fichiers, trouve une perte de données. Une fausse
assurance est pire qu'une absence de relecture. À corriger avant la rc.2, avec N3 (quota ou modèle
indisponible en erreur brute, même famille que D6) et N4 (activité illisible), qui sont simples.
N5 est à écarter par un essai ciblé. Les mineurs et les anciens restes (D17, D21, D24, D25, R7/D35)
peuvent suivre.

## Recette courte avant rc.2 (modèle gratuit) — 2026-11-20 après-midi

Testeur : Claude (Opus 5.5), par `pnpm pilote` et des évènements DevTools (clavier touche par
touche pour N5, vrais clics souris). Aucun fichier de code modifié, rien de commité dans le dépôt.
Captures relatives à `.pilote/sessions/`.

| | |
|---|---|
| Bobine | 1.0.0-rc.1 (développement), build de `main` **4288897** (fiche 267, 268, 269 fusionnées) ; `4acb623` arrivé pendant la recette ne touche que des essais |
| Profil | copie `~/Development/bobine-recette/profil-recette-rc2` (`--profil`, `--vrai-trousseau`) ; journal Détaillé |
| Projet | `~/Development/bobine-recette/recette-rc2`, dépôt git vide au départ |
| Agent, modèle | OpenCode 2.3.0, **opencode/big-pickle** pour tout le parcours. Premier essai avec openai/gpt-6.1-sol : refusé (`-32000 Authentication required`, passage arrêté, `2026-11-20-135546/`). DeepSeek V4.1 Flash Free : quota épuisé dès le premier message (sert à vérifier N3) |
| Session | `2026-11-20-135703/` : 18 min 41 s, 5 tours mesurés (médiane 44 s, max 2 min 22 s), 0 intervention |
| Historique git obtenu | `eea2975` appli (Big Pickle, 6 tests) → travaux `ede7e05`, `9706593` (compteur) et `8fe61b6` (effacer les cochés) → fusion par la carte de groupe, conflit résolu par le travail : **`abba884 Merge branch 'master' into bobine/…`**, premier parent = la branche du travail (le cas exact de N1) → `b288021` correctif demandé au relecteur |

### Points vérifiés

| Point | Résultat | Preuve |
|---|---|---|
| **N1** portée de `@Code reviewer` « Relis ce qui a été fait » | **OK** : « Relu : les 5 commits de cette conversation, 9 fichiers du premier commit à abba884 » ; consigne `git diff 4b825dc… abba884` (arbre vide, aucun commit d'avant la conversation) ; 6 remarques (3 moyennes, 3 basses) au lieu d'un « Rien à signaler » sur la seule fusion | `2026-11-20-135703/captures/140638-capture-fenetre.png` |
| **N2** clic sur `fichier:ligne` | **OK** : `src/shoppingList.ts:13-14` ouvre « version relue (du premier commit à abba884) », lignes 13–14 marquées d'une barre. Après le correctif : « Corrigé depuis la relecture : voici ce qui a été relu. Voir la version actuelle » | `140648-capture-fenetre.png`, `140901-capture-panneau.png` |
| « Demander à OpenCode de corriger » | **OK** : « Correction demandée · 14:06 », bulle « Corrige les remarques de Code reviewer. », prompt de 5,2 Ko à l'agent, commit `b288021` (3 fichiers +78 −21) | `140658-capture-fenetre.png` |
| **N4** activité d'un rôle | **OK** : une ligne par fait, coupée à ≈ 80 caractères avec « … » (« A lancé git diff 4b825dc… abba8844958eba494feae2940a9fa… »), commande entière en infobulle (`title` de la ligne) ; « Lance shell… » en cours | `140609-capture-fenetre.png` |
| **N5** rôle, frappe rapide, Entrée aussitôt (×3) | **OK 3/3** : `@Tech` / `@Code` / `@Sécu` + Entrée, puis texte tapé touche par touche (15, 5 et 0 ms entre touches), Entrée sans délai (1,1 s, 0,38 s, 0,13 s après la première lettre). Les trois bulles portent le texte entier, les trois travaux partent et répondent | `140927-`, `140931-`, `140935-capture-fenetre.png` |
| **N7** aide avant la frappe | **OK** : « Écrivez votre demande après le rôle : c'est elle qui part. » en `#9ea4b3` (= `--muted` ; `--warn` vaut `#e9b65c`) | `140456-capture-fenetre.png` |
| **N3** quota gratuit épuisé | **OK** : DeepSeek V4.1 Flash Free → `-32603 « Internal error: Free usage limit reached… »` (agents.log 13:14:56) → carte « Le modèle opencode/DeepSeek V4.1 Flash Free n'a pas répondu · Son quota gratuit est épuisé… », « Choisir un autre modèle ». Big Pickle choisi : le message refusé repart seul et reçoit sa réponse | `141500-capture-fenetre.png` |
| **268** nom d'un rôle fourni | **OK** : « Code reviewer » → « @code-reviewer est déjà pris par « Code reviewer » (fourni) : choisissez un autre identifiant. », bouton « Utiliser @code-reviewer-2 » (affiché au clic sur « Suivant », pas pendant la frappe) | `141128-` (avant) → `141136-capture-fenetre.png` |
| **268** deux rôles de même icône | **OK** : « Relecteur strict » et « Relecteur rapide », icône `scan-search` et couleur Bleu tous deux : deux fichiers (`relecteur-strict.md`, `relecteur-rapide.md`), deux lignes dans Réglages › Rôles, deux pastilles dans Équipe | `141221-capture-fenetre.png` |
| **269** avertissement | **OK** : « Votre connexion n'est pas privée », hôte et port, raison claire, « Revenir en lieu sûr » / « Avancé » ; empreinte SHA-256 affichée = celle d'`openssl x509 -fingerprint` (`B2:7E:FF:…:DC:FF`) | `141245-capture-fenetre.png`, `141322-capture-panneau.png` |
| **269** Continuer, « Non sécurisé » | **OK** : la page s'ouvre (cible DevTools « Serveur de recette ») ; puce rouge dans la barre d'adresse, réduite à l'icône dans ce panneau étroit, libellé entier en infobulle et `aria-label` | `141332-capture-panneau.png`, `141340-page-5443.png` |
| **269** révocation par la puce | **OK** : « Certificat accepté pour localhost:5443 · Ne plus accepter » → l'avertissement revient aussitôt | `141355-` → `141401-capture-panneau.png` |
| **269** l'agent ne peut pas accepter | **OK** : `browser_navigate` → erreur « …its TLS certificate was refused (net::ERR_CERT_AUTHORITY_INVALID)… » en 8 ms ; l'agent dit ne pas pouvoir contourner, ne tente rien d'autre | `141317-capture-fenetre.png` |
| Coût | **partiel** : jamais « ≈ 0,00 $US » (aucun « 0,00 » dans l'interface) ; Big Pickle « coût inconnu » sur les cartes et dans Mon activité (attendu, F6). Tuile « 33 échanges sans coût communiqué » = tableau 20 + 13 (**N10 OK**). DeepSeek « gratuit » **non vérifiable** : son quota était épuisé dès le premier message, aucun tour n'a abouti | `141414-capture-fenetre.png` |
| **D24** première étiquette de mois | **KO** : toujours « . » (le texte SVG « déc. » commence à x = 362 px, la zone est coupée vers 380 px) | `141437-note-fenetre.png` |

### Nouveaux constats — Bobine

Gravité : **G** gênant, **m** mineur, **i** idée. Aucun bloquant, aucun gênant.

| N° | Grav. | Constat | Reproduire | Capture |
|---|---|---|---|---|
| P1 | m | **D24 pas corrigé dans ce cas** : la carte « 12 derniers mois » de Mon activité affiche encore « . » comme première étiquette de mois. La fiche 267 le donne corrigé. | Mon activité, fenêtre de 1512 px avec le panneau Navigateur ouvert. | `141437-note-fenetre.png` |
| P2 | m | Après la fusion, puis après l'envoi `@Code reviewer …`, **le fil ne descend pas** : il reste 1 166 px au-dessus du bas, et la bulle et la carte du relecteur sont hors de la vue. Le repère du bas dit toujours « **↑** 2 travaux ont répondu · Voir » (affiché depuis 14:03), alors que tout est plus bas (N12 non traité, et le repère est périmé). | Fusion par la carte de groupe, puis `@rôle` + Entrée. | `140609-capture-fenetre.png` |
| P3 | m | Un Code reviewer qui répond sans rapport (« OK ») donne une carte **sans ligne « Relu : … »**. La 267 dit « toujours ». Ici, c'est ma consigne qui l'a provoqué, mais un modèle faible qui ne rend pas son rapport produit la même carte muette sur la portée. | `@Code reviewer` « réponds juste OK ». | `141058-capture-fenetre.png` |
| P4 | m | Identifiant de rôle déjà pris : l'erreur n'apparaît qu'au clic sur « Suivant », pas pendant la frappe. On peut remplir tout le formulaire avant de l'apprendre. | Réglages › Rôles › Nouveau rôle, nom « Code reviewer ». | `141128-` → `141136-capture-fenetre.png` |
| P5 | m | Premier tour : le pied de la réponse et l'en-tête disent « 5 fichiers +124 −6 », alors que le commit `eea2975` en a 9. Les fichiers créés par une commande de l'agent (squelette Vite) ne sont probablement pas comptés. Non creusé. | Créer un projet par commandes shell. | `135955-capture-fenetre.png` |
| P6 | i | Trois rôles de même icône et même couleur (Code reviewer, Relecteur strict, Relecteur rapide) donnent trois pastilles identiques dans Équipe : seule l'infobulle les distingue. | Suite de 268. | `141221-capture-fenetre.png` |
| — | rappel | Restes connus, hors des lots : N11 (le Code reviewer répète son résumé en fin de carte) ; le libellé « Continuer vers localhost » ne dit pas le port (le texte au-dessus le dit). | | `140638-`, `141322-` |

### Constats — OpenCode, le modèle ou l'environnement

| N° | Origine | Constat |
|---|---|---|
| Q1 | OpenCode / compte | openai/gpt-6.1-sol refusé (`-32000 Authentication required: provider authentication required`). Bobine affiche correctement la carte « Modèle refusé ». Recette jouée sur modèle gratuit. |
| Q2 | OpenCode | DeepSeek V4.1 Flash Free : quota gratuit déjà épuisé (depuis le matin). |
| Q3 | OpenCode | Big Pickle ne dit pas son coût (`0 USD`, comme un abonnement) : « coût inconnu », décision documentée (F6). |
| Q4 | modèle (Big Pickle) | Bonne tenue sur ce parcours court : appli et tests, deux travaux parallèles bien découpés, conflit de fusion résolu par le travail, remarques du relecteur pertinentes (validation des données de `localStorage`, échappement, exceptions de stockage) et corrigées. Une erreur : le relecteur annonce « 28 tests », alors que le projet en avait 10 (8 + 2 après fusion). Le modèle commite avec `git -c user.name="Bobine" -c user.email=bobine@example.com` (dépôt sans identité) : choix du modèle. La reconnaissance des commits de la conversation (N1) a tenu malgré tout. |

### Verdict

**Publier la rc.2 : oui.** Les deux points qui bloquaient hier sont corrigés sur le parcours réel :
- **N1** : la relecture dit exactement ce qu'elle a relu, les 5 commits de la conversation, même avec un commit de fusion `Merge branch 'master' into bobine/…` en tête de `master`. Elle trouve de vraies remarques, là où elle disait hier « Rien à signaler ».
- **N2** : le clic sur `fichier:ligne` ouvre le diff relu, ligne marquée, et le dit après le correctif.

« Faire corriger » envoie bien la correction. N3, N4, N5 (3 sur 3, frappe touche par touche), N7 et N10 tiennent. 268 refuse le nom d'un rôle fourni avec une suggestion, et garde deux rôles de même icône. 269 fait le parcours complet : avertissement, Avancé, Continuer, puce, révocation. L'agent n'a aucun moyen d'accepter le certificat.

Ce qui reste est mineur et peut suivre la rc.2 :
- D24 encore visible (P1) ;
- le fil qui ne descend pas, et le repère périmé (P2, N12) ;
- une carte de relecture sans portée quand le rôle ne rend pas de rapport (P3).

**Réserve :** le parcours a été joué avec Big Pickle, pas avec GPT-6.1 Sol (compte non connecté), et DeepSeek « gratuit » n'a pas pu être vérifié. Les deux tiennent à OpenCode et au compte, pas à Bobine. Un tour court avec GPT-6.1 Sol, une fois Jérôme reconnecté, confirmerait N1 sur son modèle habituel. Ce n'est pas une condition de publication.
