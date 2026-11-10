# Bobine — audit de maturité (21 octobre 2026)

Regard croisé : UX/UI senior, et développeur qui vit dans les agents de code au quotidien.
Méthode : lecture de la doc (architecture, 20 ADR, 102 fiches, changelog, recettes réelles), du
code (74 000 lignes TypeScript), des 150 captures e2e clair et sombre, `./scripts/verify` relancé
(vert : 1 186 tests), état du dépôt GitHub, et comparaison avec Bob IDE, l'interface terminal
d'OpenCode et les clients d'agents d'octobre 2026.

**Le cadre du jugement** (précisé par Jérôme) : Bobine existe pour piloter Bob par ACP, et a été
étendue à OpenCode parce que des modèles internes en LLMaaS (Qwen, Mistral…) permettent
de ne pas brûler de bobcoins. Elle ne cherche pas à remplacer les applications de Claude ou de
ChatGPT. Elle comble le vide entre Bob IDE / Bob Shell d'un côté et OpenCode en ligne de commande
de l'autre, avec un outillage intégré. C'est là-dessus qu'elle est jugée.

Seuls les points qui méritent un investissement sont listés. Les broutilles (une infobulle qui
avale un clic, un chronomètre faux une fois sur six) sont déjà dans vos recettes.

---

## 1. Le verdict en trois phrases

**Bobine est une bêta solide, pas une alpha, et elle comble déjà le vide visé.** En dix jours et
267 commits, elle donne à Bob et à OpenCode un outillage que ni Bob IDE ni l'interface terminal
d'OpenCode n'ont : navigateur, simulateur iOS et émulateur Android pilotés par l'agent, plan
annoté, remarques sur le diff, conversations filles, branche de conversation, et une
transparence sur les coûts et sur ce que l'agent reçoit qu'on ne voit nulle part ailleurs.

**Oui, elle mérite d'être publique**, comme client de bureau ouvert pour Bob et OpenCode. Son
public est réel mais étroit (utilisateurs de Bob, équipes avec des modèles internes) : il faut
viser des dizaines d'utilisateurs exigeants, pas des milliers, et préparer le dépôt pour eux :
licence, README en anglais, CI, signature.

**Le prochain investissement n'est pas une fonctionnalité de plus, c'est le scénario qui
justifie OpenCode** : brancher un modèle interne sans éditer un JSON à la main, basculer une
conversation de Bob vers le modèle interne (et retour) sans perdre le fil, et voir ce que ça
coûte. Aujourd'hui, les trois manquent.

---

## 2. Où en est Bobine

### Chiffres bruts

| Mesure | Valeur |
|---|---|
| Âge | 10 jours (11 → 21 octobre 2026), 267 commits |
| Code | 74 000 lignes TS (main 38 k, renderer 23 k, shared 12 k, 485 fichiers) |
| Tests | 1 186 tests unitaires et composants (186 fichiers), 49 suites e2e, `verify` vert en 43 s |
| Doc | 102 fiches, 20 ADR, changelog FR + EN, matrice des agents, 2 recettes réelles |
| Interface | 1 710 textes traduits FR + EN, 4 thèmes (clair, sombre, sépia, nuit noire) |
| Agents | Bob 2.0.6 (cible), OpenCode 2.0.3x (modèles internes ou gratuits), factice |
| Distribution | `.dmg` arm64 signé ad hoc, construction sur place documentée, dépôt **privé**, pas de licence |

### Lecture

**Niveau de maturité : bêta (0.3), prête pour des utilisateurs avertis.**

Au niveau d'un produit fini :
- la robustesse du cœur (fiche 041 : agent qui meurt, qui ne répond plus, disque plein,
  historique abîmé ; écritures atomiques ; journal avec rotation) ;
- le durcissement Electron complet (`contextIsolation`, sandbox, fuses, IPC validé, serveur MCP
  sur 127.0.0.1 avec jeton par session, clés d'API dans le trousseau à la demande) ;
- l'agent factice à scénarios, qui rend tout testable sans modèle ni bobcoin, et les sondes
  (`bob-probe`, `opencode-probe`) qui disent ce qui change à chaque mise à jour d'un agent ;
- **l'installation en entreprise** : proxy, sans accès à GitHub, sans droits administrateur,
  construction depuis les sources sans réseau, installation pour soi seul. C'est précisément le
  terrain de Bob, et c'est traité à fond (fiches 058, 065, 073) ;
- la discipline des fonctions propres à un agent (ADR-0011) : déclarées dans le profil, visibles
  dans Réglages › Agents, dans la matrice, dans la fiche.

Ce qui trahit l'âge du produit :
- **une seule personne l'a utilisé** ; la recette libre du 20 octobre trouve 7 défauts, une
  dizaine de soucis d'interface et 7 manques en 30 minutes ;
- des suites e2e qui échouent encore par intermittence (captures `echec-*` du 21 octobre à 12 h 37 :
  délais dépassés, `Cannot read properties of undefined`) ;
- la sortie de l'agent n'est pas bouclée : on relit le diff, on l'annote, puis on va au terminal
  pour committer (fiche 037 retirée par la fiche 049) ;
- trois fichiers au-dessus de 1 000 lignes (`manager.ts`, `agent-host.ts`, `index.ts`) et sept
  exceptions ESLint « à découper si on y retouche » ;
- deux adaptateurs Bob reposent sur des internes non documentés : la base `bob.db` pour les coûts,
  et `bob chat` + `/status` relu dans un pseudo-terminal pour le quota. C'est sondé et ça tombe
  proprement en cas de surprise, mais c'est ce qui cassera à la prochaine version de Bob.

---

## 3. Bobine face à Bob IDE et à OpenCode en terminal

Le vide que Bobine veut combler, et où elle en est.

| Ce qu'on attend | Bob IDE | OpenCode (terminal) | Bobine |
|---|---|---|---|
| Conversation riche (streaming, images, diffs, autorisations, questions) | ✓ | partiel | ✓ |
| Fichiers et éditeur | ✓ | ✗ | ✗ (aperçu `.md` seulement) |
| Git : commit, PR | ✓ | ✗ | ✗ (branche affichée, diff relu, puis terminal) |
| Navigateur piloté par l'agent, console, réseau | ✗ | ✗ | ✓ |
| Simulateur iOS, émulateur Android pilotés | ✗ | ✗ | ✓ |
| Terminal partagé avec l'agent | ✓ | ✗ | ✓ |
| Plan annoté, versions, exécution | partiel | ✗ | ✓ |
| Remarques sur le diff envoyées à l'agent | ✗ | ✗ | ✓ |
| Conversations parallèles en worktrees, conversations filles | ✗ | ✗ | ✓ |
| Modifier un message et repartir, fichiers remis en état | ✗ | ✗ | ✓ |
| Quota et coût en bobcoins | ✓ | — | ✓ (quota, coût par conversation et sous-agent) |
| Coût des modèles internes (OpenCode) | — | ✓ | ✓ (par ACP) |
| **Configurer un fournisseur de modèles interne** | — | fichier JSON à la main | **fichier JSON à la main** |
| **Passer une conversation de Bob au modèle interne** | — | — | **non : nouvelle conversation, fil perdu** |
| Échange de tâches avec Bob IDE (`_bob/task/export` / `import`) | ✓ | — | non |
| Serveurs MCP des agents, règles, skills | ✓ | fichiers | ✓ depuis les réglages, avec « Tester » |
| Diagnostic de l'installation | ✗ | ✗ | ✓ |

Lecture : sur l'outillage intégré, Bobine est déjà **devant** Bob IDE sur tout ce qui concerne
l'agent au travail (voir, tester, relire, paralléliser) et **derrière** sur ce qui entoure le code
(fichiers, git). Sur le scénario OpenCode, elle n'apporte encore rien de plus que le terminal pour
brancher un modèle interne, et elle ne rend pas la bascule Bob ↔ interne plus facile qu'un
« nouvelle conversation ». Les deux lignes en gras sont le vrai chantier.

---

## 4. Ce qui est remarquable (à garder, à mettre en avant)

1. **Les panneaux pilotés par l'agent.** Navigateur avec console et réseau, simulateur iOS dans
   son châssis avec gestes à la souris, émulateur Android, planche contact d'un geste, capture
   annotée renvoyée à l'agent. Bob IDE n'a rien de tel. C'est la première image du README.
2. **Le mode Plan annoté** (remarque sur un passage, version 2, « voir ce qui a changé »,
   « exécuter le plan »). La recette le dit : « le meilleur moment de l'essai ».
3. **Les remarques sur le diff envoyées à l'agent** : le geste de relecture de GitHub, avant le
   commit.
4. **Les conversations filles** lancées par l'agent, avec accord, plafond, réveil groupé.
5. **Modifier un message et repartir de là, fichiers remis en état.**
6. **La transparence** : l'onglet « Bobine » des outils (57 outils par famille, quand ils sont
   proposés, quand ils demandent l'accord), « Ce que l'app sait faire avec cet agent », le quota
   de bobcoins sous le nom de l'agent, le Diagnostic qui explique chaque problème avec sa marche
   à suivre. C'est de l'UX de confiance, exactement ce qu'il faut pour un outil qu'on confie à
   d'autres utilisateurs.
7. **L'interface.** Lisible, calme, cohérente en clair et en sombre, soignée dans le détail
   (barre de saisie qui se replie étape par étape, pastilles d'état, raccourcis affichés).

---

## 5. Rendre public : oui, pour qui et à quelles conditions

### 5.1 Pour qui

Le public de Bobine, c'est : les utilisateurs de Bob qui veulent autre chose que Bob IDE ou Bob
Shell, et ceux qui ont des modèles internes derrière OpenCode. Ce sont souvent des développeurs
sur un Mac géré, derrière un proxy et sans droits administrateur. Bobine est déjà taillée pour
eux. Attendre des dizaines d'utilisateurs exigeants, pas des milliers : c'est le bon ordre de
grandeur pour un client de bureau ouvert autour d'un agent propriétaire.


### 5.2 Le minimum avant de rendre le dépôt public (une semaine)

| Manque | Pourquoi ça bloque | Ce que je ferais |
|---|---|---|
| **Pas de LICENSE** | Sans licence, personne ne peut légalement l'utiliser ni contribuer | MIT ou Apache-2.0 (Apache si vous voulez la clause brevets) ; vérifier AXe, idb et les polices |
| **README de 6 lignes, en français** | Les utilisateurs de Bob sont partout dans le monde ; le README est la page d'accueil | README anglais : une phrase, un GIF de 20 s (l'agent qui teste l'app dans le simulateur), Bob et OpenCode, l'installation en 3 commandes, « ce que Bobine n'est pas » ; le français dans `docs/` |
| **Signature ad hoc** | Sur un Mac géré, un `.dmg` non notarisé est souvent bloqué par Gatekeeper ou par le MDM | Developer ID + notarisation (99 $/an, le workflow est prêt) ; à défaut, documenter la construction sur place comme voie officielle en entreprise (c'est déjà écrit) |
| **Pas de mise à jour automatique** | Un outil qui bouge tous les jours sans auto-update, c'est des utilisateurs à jamais sur la 0.3.0 | `electron-updater` sur les releases GitHub ; dépend de la signature |
| **`verify` ne tourne qu'au tag** | Une PR extérieure ne sera jamais vérifiée | Workflow `ci.yml` : lint + typecheck + tests unitaires sur `ubuntu-latest` à chaque PR ; e2e sur macOS au tag et une fois par semaine |
| **Rien pour contribuer ni signaler** | Pas de `CONTRIBUTING.md`, pas de gabarit d'issue, 122 documents en français | `CONTRIBUTING.md` en anglais qui renvoie à `AGENTS.md` ; gabarit d'issue « Bug » qui demande le rapport de Réglages › Diagnostic ; bouton « Signaler un problème » dans Diagnostic qui ouvre l'issue préremplie |

### 5.3 Le laisser s'user avant de l'annoncer

Dépôt public en bêta d'abord, annonce ensuite : trois ou quatre premiers utilisateurs (Bob et
OpenCode) pendant deux semaines, leurs issues, puis une annonce plus large. Le
produit est trop bon pour que sa première impression soit un `Cannot read properties of undefined`.

---

## 6. Les investissements qui comptent

Par ordre de valeur pour le scénario visé : Bob au quotidien, modèle interne quand les bobcoins
comptent.

### 6.1 Fournisseurs de modèles OpenCode depuis l'app

Aujourd'hui, brancher Qwen ou Mistral en LLMaaS, c'est écrire à la main dans
`~/.config/opencode/opencode.json` un bloc `provider` (point d'accès compatible OpenAI, clé,
liste des modèles) et `enabled_providers`. Bobine lit déjà ce fichier pour les serveurs MCP et
les règles (`jsonc-parser`) et sait ranger une clé dans le trousseau : il manque l'écran.

Réglages › Agents › OpenCode › « Fournisseurs de modèles » : nom, adresse, clé (chiffrée, posée
dans l'environnement au lancement comme `BOB_API_KEY`), modèles proposés, « Tester » (un appel
`/models` sans jeton de modèle), et la case « Seulement ces fournisseurs ». Propre à OpenCode,
donc déclaré dans le profil et dans la matrice (ADR-0011). C'est l'investissement qui fait
d'OpenCode un vrai choix pour tout utilisateur, et pas un réglage de spécialiste.

### 6.2 Continuer une conversation avec l'autre agent

Le geste central du scénario « au lieu de cramer des bobcoins, on bascule » n'existe pas : on
ouvre une nouvelle conversation OpenCode et on réexplique. Or la fiche 023 a déjà tout le
mécanisme : une branche est une nouvelle session qui reçoit l'échange repris en contexte, avec
les fichiers remis en état.

« Continuer avec OpenCode… » (et « Continuer avec Bob… ») dans le menu de la conversation et
dans `BranchDialog` : même contexte, autre agent, la conversation fille apparaît sous l'originale
avec l'agent indiqué. Le modèle interne reprend un fil commencé avec Bob, ou Bob reprend quand le
modèle interne cale. Rien de propre à un agent : une session ACP ordinaire.

### 6.3 Le coût lisible, et comparé

Le quota de bobcoins, le coût par conversation et par sous-agent existent. Ce qui manque pour
décider quand basculer :
- dans la liste des conversations, le coût de chacune (bobcoins, ou jetons pour un modèle
  interne) ;
- le poids des outils de l'app dans le contexte : jusqu'à 57 outils (28 dans une conversation
  type), soit 8 à 15 000 jetons avant la première ligne, facturés à chaque tour en bobcoins.
  L'afficher dans « bobine · intégré », et laisser désactiver une famille par conversation (le
  simulateur iOS pour un projet web) depuis les cartes de l'onglet « Bobine ».

### 6.4 Échange de tâches avec Bob IDE

Bob expose `_bob/task/export` et `_bob/task/import` (extensions non documentées, relevées dans
`docs/acp.md`). C'est le pont manquant avec Bob IDE : « Ouvrir dans Bob IDE » depuis une
conversation, « Importer une tâche de Bob IDE » dans « Reprendre une session… ». À sonder d'abord
(`bob-probe`, 0 bobcoin), à n'implémenter que si le format est stable. Propre à Bob, déclaré dans
le profil.

### 6.5 Boucler la sortie : commit, PR, fusion du worktree

Bobine a la meilleure relecture de diff du lot et aucune porte de sortie. Dans l'onglet
Modifications : « Committer » avec un message proposé par l'agent (un prompt de l'app), « Pousser »,
« Ouvrir une PR » (`gh` ou l'équivalent interne, corps proposé). Pour une conversation en worktree :
« Fusionner dans `main` et supprimer le worktree », avec l'état (à jour, en conflit) sous la zone
de saisie. Pas de suivi de CI. Fiche 037 contient déjà la moitié de la réflexion.

### 6.6 Une surface de lecture du code

Un onglet « Fichiers » dans le panneau latéral (arbre, visionneuse en lecture seule avec
coloration, recherche, clic sur un chemin du fil qui l'ouvre là). Pas d'édition : un ADR pour
fermer le débat « et si on faisait un IDE ». C'est ce qui rend Bob IDE encore nécessaire à côté.

### 6.7 Finir ce qui est à moitié, avant d'ajouter

- **stabilité des e2e** : un échec intermittent par jour rend la suite complète inutile comme
  garde-fou avant push ; investir dans l'attente déterministe (`settleNotifications`, décision
  « plus tard » de la fiche 043) ;
- **le rejeu après relance** qui diffère du direct (recette du 20 octobre, défaut 4 : diffs
  incomplets, cartes qui changent de nom) ;
- **`manager.ts` et `agent-host.ts`** : chaque fiche les fait grossir ; la fiche 089 a posé la
  règle, il reste à l'appliquer au cœur ;
- **les adaptateurs Bob hors protocole** (`bob.db`, `/status`) : garder `bob-probe` dans la CI
  hebdomadaire sur macOS, avec Bob installé si c'est possible, pour les voir casser avant les
  utilisateurs.

### 6.8 Petits pas qui comptent pour de nouveaux utilisateurs

- Premier lancement sans OpenCode : proposer de l'installer (Homebrew ou npm) dans le terminal de
  l'app, puis « Relire le PATH ». Bob est là, OpenCode souvent pas.
- La liste des conversations comme boîte de réception : tri « ce qui m'attend d'abord », compteur
  sur l'icône du Dock. Les pastilles existent ; c'est l'ordre qui manque.
- Éditer `AGENTS.md` et `.bob/rules` depuis « Règles actives » (elles sont listées et
  prévisualisées).
- Un profil « Agent personnalisé » (commande, arguments, variables) dans Réglages › Agents : utile
  le jour où un autre agent ACP arrive, sans rouvrir le code. Optionnel.

---

## 7. Ce que je ne ferais pas

- **Rouvrir Claude Code et Codex.** Décision claire, cohérente avec l'usage ; les ADR tiennent.
- **Windows et Linux** maintenant. La moitié de la valeur (simulateur, émulateur, capture d'écran,
  trousseau) est propre au Mac. Dire « macOS Apple Silicon » clairement et avancer.
- **Le pilotage du Mac** (fiche 038). Immense surface, peu d'usages quotidiens, risques
  disproportionnés pour un projet solo.
- **Un éditeur de code.** Une visionneuse, pas plus.
- **De la télémétrie.** Le bouton « Signaler un problème » avec le rapport de diagnostic suffit,
  et c'est un argument en entreprise.
- **Traduire les fiches et les ADR.** Mémoire de travail en français, ça marche. Seules les pages
  d'entrée (README, installation, contribution) doivent exister en anglais.

---

## 8. Feuille de route proposée

| Palier | Contenu | Résultat |
|---|---|---|
| **A — Publiable** (1 semaine) | LICENSE, README anglais avec GIF, CI sur PR, CONTRIBUTING + gabarit d'issue, « Signaler un problème » | Dépôt public, bêta avec quelques utilisateurs, pas d'annonce |
| **B — Le scénario Bob ↔ modèle interne** (2 semaines) | Fournisseurs OpenCode depuis l'app, « Continuer avec l'autre agent », coût dans la liste et poids des outils, sonde de `_bob/task/export` | 0.4.0 : la raison d'être d'OpenCode dans Bobine devient évidente |
| **C — Installable et quotidien** (3 à 4 semaines) | Developer ID + notarisation, `electron-updater`, commit / PR / fusion du worktree, onglet Fichiers, e2e déterministes, rejeu fidèle, découpage du cœur | 0.5.0 : l'app qu'on garde ouverte toute la journée à côté de Bob IDE, ou à sa place |

---

## 9. Top 10 consolidé (après confrontation avec l'avis de ChatGPT, 21 octobre)

Deux avis indépendants convergent sur sept chantiers (liste à neuf après retrait d'un point non technique). ChatGPT a vu juste sur le fil perdu au
rechargement (fiche 102 : « rouverte, elle est rechargée par l'agent et perd ce que Bobine avait
ajouté ») et sur les certificats d'entreprise ; il sous-estime ce qui existe déjà (recettes
réelles, outils visibles) et ignore le coût des outils et la stabilité des e2e.

| # | Chantier | Résultat attendu |
|---|---|---|
| 1 | **Bobine garde son propre fil** (ADR) : le rejeu de l'agent ne remplace plus ce qu'elle a ajouté ; mise en veille, reprise et redémarrage rendent le même fil qu'en direct. Le mécanisme `keepTranscript` de « Relancer » existe déjà | Plus aucune carte, compte rendu de fille ni diff qui disparaît ; les 6 conversations actives de la fiche 102 deviennent sûres |
| 2 | **Fournisseurs OpenCode depuis Réglages**, proxy et certificats d'entreprise compris (`NODE_EXTRA_CA_CERTS` pour OpenCode), « Tester », erreurs expliquées | Un utilisateur branche Qwen ou Mistral sans ouvrir un JSON |
| 3 | **Continuer avec l'autre agent** (branche vers Bob ou OpenCode, contexte transmis), favoris et derniers modèles, destination des données affichée (« vos messages partent à … ») | Bascule bobcoins ↔ interne en un geste, sans ambiguïté sur ce qui part où |
| 4 | **Palier publiable** : LICENSE, scan des secrets dans l'historique git (gitleaks), README anglais illustré, limites connues, SECURITY.md, CONTRIBUTING, CI sur PR, « Signaler un problème » | Dépôt public en bêta |
| 5 | **E2e déterministes** et rejeu fidèle (défaut 4 de la recette) | La suite complète redevient un garde-fou crédible avant push et sur PR |
| 6 | **Signature Developer ID, notarisation, mise à jour automatique** | Installation normale sur un Mac géré, personne ne reste sur la 0.3.0 |
| 7 | **Coût visible et pilotable** : coût par conversation dans la liste, poids des outils de l'app dans le contexte, familles désactivables | On sait ce qu'un tour coûte avant de cliquer |
| 8 | **Cycle complet des worktrees et sortie git** : départ explicite du dernier commit, avertissement sur les modifications locales non incluses, commit avec message proposé, PR, fusion assistée, nettoyage | Le travail de l'agent revient dans `main` sans terminal |
| 9 | **Bêta avec 5 à 10 utilisateurs autonomes**, puis supervision (ce qui attend, ce qui a changé, « tour terminé » ≠ « résultat validé ») décidée d'après leurs blocages | La suite de la feuille de route vient de l'usage, pas d'une liste |

Sous la ligne : onglet Fichiers, sonde de `_bob/task/export`, installation d'OpenCode au premier
lancement, découpage de `manager.ts` et `agent-host.ts`.

## Sources externes consultées

- [Agent Client Protocol (ACP) Explained: ACP vs MCP, Editor Support, Setup](https://www.morphllm.com/agent-client-protocol)
- [Agent Client Protocol: Claude Code in Any Editor (2026)](https://www.danilchenko.dev/posts/agent-client-protocol/)
- [Codex CLI in Zed 1.0: Parallel Agents, ACP Integration](https://codex.danielvaughan.com/2026/05/05/codex-cli-in-zed-parallel-agents-acp-integration-ide-workflows/)
- [ACP Agents — OpenHands Docs](https://docs.openhands.dev/openhands/usage/agent-canvas/acp-agents)
- [The Best Tools to Run Multiple Coding Agents in 2026 (AgentsRoom, vendeur d'un outil concurrent)](https://agentsroom.dev/blog/best-multi-agent-coding-tools)
- [The best AI agent orchestration tools for coding in 2026 (Crystl)](https://crystl.dev/blog/best-ai-agent-orchestration-tools/)
