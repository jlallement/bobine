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
