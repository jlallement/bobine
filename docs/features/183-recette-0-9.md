# 183 — Recette de la version 0.9

- **Statut** : fait
- **Dépend de** : 175, 176, 177, 178, 179, 180, 181 (nouveautés de la 0.9), 174 (recette de la 0.8)
- **Agents** : les deux pour l'agent factice ; vrai agent **OpenCode seulement** (modèle
  `openai/gpt-6.1-sol`, abonnement de l'utilisateur, ≈ 15 tours au plus). IBM Bob n'est jamais
  lancé (bobcoins) : décision du tech lead à part.

## Pourquoi

Avant de publier la 0.9.0, une recette par un rôle « QA » distinct de ceux qui ont écrit les
fonctionnalités : trouver les défauts, pas les corriger. La version ne part que si la recette ne
laisse rien de bloquant. Base : `main` à `8d63d17` (verify et e2e complète verts selon le tech lead).

## Critères d'acceptation

- [x] Plan de test écrit ici avant d'être joué.
- [x] Chaque fonctionnalité de la 0.9 essayée dans l'app construite (chemin nominal, cas limites,
      erreurs), au clavier, clair et sombre, fr et en, fenêtre étroite et zoom 150 %.
- [x] Interactions entre les nouveautés essayées.
- [x] Vrai agent (OpenCode) : aparté, « Faire relire », autres dossiers, « Lancer maintenant », fille
      dans un worktree préparé.
- [x] Régression : verify, e2e complète fr et en, app packagée, sonde OpenCode hors ligne.
- [x] Montée depuis un profil 0.8.0 : rien de perdu, pas de plantage.
- [x] Rapport : chaque défaut avec gravité, fonctionnalité, étapes, attendu / obtenu, preuve,
      régression ou non ; ce qui est bon ; ce qui n'a pas pu être essayé.

## Plan de test

Preuves (captures, vidéos, extraits de journal) **hors du dépôt**, dans le dossier de notes
partagé des sessions : `side-session-notes/local_dc542b87-7cc9-475b-98d0-f24ecc36f3cc/qa-0-9/`.
Pilotage de l'app construite par le harnais e2e (`withApp` de `e2e/lib.mjs` : profil jetable,
protocole DevTools, agent factice, faux `gh`), scripts jetables dans le dossier de travail
temporaire de la session — rien d'ajouté au dépôt hormis cette fiche.

### 1. Exploratoire, agent factice, app construite

| Fonction | Nominal | Cas limites / erreurs |
|---|---|---|
| 175 Préparation | `.worktreeinclude` + `setup` autorisé, carte réussie, message retenu puis envoyé | pas de git ; `setup` en échec, qui ne finit pas (délai), énorme sortie ; `.worktreeinclude` avec lien symbolique et `..` ; « Continuer sans préparer » ; accord retiré dans Réglages ; `archive` |
| 176 PR et CI | carte PR avec faux `gh` : en cours, échec, réussi, fusionnée ; « Corriger » | sans `gh` ; `gh` non connecté ; `gh` en erreur ; pas de PR |
| 177 Faire relire | relecteur, remarques sur le diff, envoi à l'agent | gros diff ; rien à relire ; sans git ; relecteur muet ; relecteur qui écrit |
| 178 Tâches planifiées | créer, modifier, pause, lancer maintenant, supprimer | plafond atteint ; deux tâches à la même minute ; veille simulée (horloge) ; chevauchement ; dossier disparu ; validation du formulaire |
| 179 Autres dossiers | ajout, retrait, reçus par l'agent | ajouté, retiré, conversation rouverte (redémarrage de l'app) ; dossier supprimé du disque ; agent sans la capacité |
| 180 Aparté | `/btw`, ⇧⌘A, réponse, « Ajouter au fil », Échap | pendant une demande d'autorisation ; après la fermeture / suppression de la conversation ; changement de conversation ; demande d'écriture refusée |

Transversal : clavier seul (Tab, Entrée, Échap), clair et sombre, français et anglais, fenêtre
≤ 900 px, zoom 150 %.

### 2. Interactions

- Tâche planifiée « dans un nouveau worktree » d'un dépôt qui a une commande `setup`.
- Relecture d'une fille dont le worktree a été préparé.
- Aparté dans une fille.
- Carte PR et remarques de relecture ensemble dans l'onglet Modifications.
- Autres dossiers + conversation dans un worktree.

### 3. Vrai agent (OpenCode, `openai/gpt-6.1-sol`), ≈ 15 tours au plus

Aparté (répond, reste en lecture seule) ; « Faire relire » (appelle-t-il `report_findings` ? sinon
la carte de repli est-elle utile ?) ; autres dossiers annoncés et utilisables ; tâche planifiée
« Lancer maintenant ». Sessions OpenCode créées supprimées ensuite si l'app le permet.

### 4. Régression

`./scripts/verify` ; `pnpm build && pnpm e2e --if-needed` ; `pnpm e2e --lang en` (complète) ;
`pnpm package --dir` puis `pnpm e2e:packaged` ; `pnpm opencode-probe --offline`.

### 5. Montée de version

Profil créé avec la 0.8.0 (`git worktree add` au tag `v0.8.0`, construite) : conversations,
réglages, accords « toujours » ; puis le même profil ouvert par la 0.9.

## Rapport

Preuves : dossier `qa-0-9/` du dossier de notes partagé (chemin plus haut) — captures `qa-*.png`
(`-light` / `-dark`, `-900` fenêtre étroite, `-zoom150`), journaux (`verify.log`, `e2e-fr.log`,
`e2e-en.log`, `opencode-probe-offline.log`, `opencode-auth-extrait.log`), scripts jetables
(`scripts/`) pour rejouer chaque constat contre l'app construite (`node <script> light`).

### Défauts trouvés

| # | Gravité | Fonction | Constat | Régression |
|---|---|---|---|---|
| D1 | **bloquant** | 175 | La commande `archive` est autorisée sans jamais être montrée, puis lancée à la suppression | non (nouveau) |
| D2 | **majeur** | 175 | « Autoriser et lancer » lance la commande **relue** dans le fichier, pas celle affichée | non (nouveau) |
| D3 | **majeur** | 175 + 178 | Tâche planifiée « nouveau worktree » d'un dépôt à préparer : bloquée « En cours » pour toujours | non (nouveau) |
| D4 | **majeur** | 175 | Message envoyé pendant que la commande `setup` tourne : disparaît, rien ne le dit, rien ne l'annule (15 min au plus) | non (nouveau) |
| D5 | mineur | 180 | `/btw` dans une conversation neuve, sans message : l'aparté est payé mais aucune carte ne s'affiche | non (nouveau) |
| D6 | mineur | 175 | Fichier avec `archive` seul (sans `setup`) : aucun chemin d'accord, la commande ne tourne jamais | non (nouveau) |
| D7 | mineur | 176 (110) | `gh` non connecté gardé 5 min : après `gh auth login`, la carte n'apparaît qu'au bout de 5 min | préexistant (cache de la fiche 110), rendu visible par 176 |
| D8 | mineur | transversal | Zoom 150 % + panneau ouvert : la zone de saisie déborde, le bouton d'envoi sort du cadre | non : préexistant, identique en 0.8.0 |
| D9 | cosmétique | 176 | Fenêtre passée à ≤ 900 px puis élargie : l'onglet Modifications revient à la vue « Conversation » (choix « Git » perdu) | non établi |
| D10 | mineur | OpenCode | Connexion d'OpenCode expirée : erreur brute en anglais dans le fil, agent « Prêt », l'étape « opencode auth login » n'est pas proposée | non établi (probablement préexistant) |
| D11 | cosmétique | menu des modèles | Chercher `gpt-6.1-sol` (identifiant) ne trouve rien ; seul le libellé « GPT-6.1 Sol » correspond | probablement préexistant |
| D12 | mineur (essai) | 178, e2e | Suite `scheduled` rouge en `--lang en` (clair et sombre) : l'essai attend le format français `2,00 $` ; l'app affiche bien « Cap: $2.00 » | non (essai nouveau de la 0.9) |
| D13 | **majeur** | 179 (OpenCode) | Dossier ajouté transmis à OpenCode, mais l'agent ne le sait pas : « Quel est le chemin de l'autre dossier de travail ? » ; il le lit seulement si on lui donne le chemin | non (nouveau) |
| D14 | mineur | 179 | Dossier ajouté avant le premier message : la session rouverte laisse l'ancienne, vide, chez OpenCode ; supprimer la conversation ne la supprime pas | non (nouveau) |

#### D1 — `archive` autorisée sans être montrée (bloquant, sécurité)

- **Étapes** : dépôt avec `.bobine/worktree.json` = `{"setup": "echo SHOWN > shown.txt", "archive":
  "touch <marqueur>"}` ; nouvelle conversation dans un worktree ; la carte « Préparation » montre
  seulement `echo SHOWN > shown.txt` ; « Autoriser et lancer » ; un message ; supprimer la
  conversation avec « Supprimer aussi le worktree ».
- **Attendu** : la carte montre aussi la commande `archive` avant l'accord (c'est elle qui tourne à
  la suppression), ou l'accord ne couvre que ce qui a été montré.
- **Obtenu** : l'empreinte d'accord couvre `setup` **et** `archive` (`configSignature`) ; la carte
  n'affiche que `setup` ; le marqueur est créé à la suppression. Réglages › Confidentialité montre
  les deux commandes, mais après coup. C'est exactement le cas que l'ADR-0037 veut empêcher (dépôt
  cloné malveillant : `setup` anodin, `archive` dangereux).
- **Preuves** : `qa-175-1-a-autoriser-light.png` (carte sans `archive`), `qa-175-2-suppression-light.png` ;
  sortie du script `qa-175.mjs` : « 2 archive marker exists: true ».

#### D2 — Accord donné à une commande non vue (majeur, sécurité)

- **Étapes** : carte « à autoriser » montrant `echo SHOWN > shown.txt` ; modifier
  `.bobine/worktree.json` du dossier d'origine en `echo SWAPPED > swapped.txt` (un agent qui
  travaille dans le dossier d'origine peut le faire) ; cliquer « Autoriser et lancer ».
- **Attendu** : la commande montrée tourne, ou l'app redemande l'accord si le fichier a changé.
- **Obtenu** : `approve()` relit le fichier et lance `swapped` (et retient l'accord pour cette
  nouvelle empreinte) ; la carte affiche la nouvelle commande après coup.
- **Preuves** : `qa-175-1-a-autoriser-light.png` puis `qa-175-1-apres-accord-light.png` ; sortie :
  `{"shown":false,"swapped":true}`.

#### D3 — Tâche planifiée bloquée par une préparation à autoriser (majeur)

- **Étapes** : tâche « toutes les heures », « Nouveau worktree », dossier = dépôt avec une commande
  `setup` pas encore autorisée ; échéance atteinte.
- **Attendu** : l'exécution part (sans la préparation, comme une fille lancée par un agent) ou
  l'utilisateur est prévenu qu'elle attend son accord.
- **Obtenu** : le premier message est retenu (« Votre message attend »), l'exécution reste « En
  cours » sans fin ; « Lancer maintenant » est désactivé et chaque échéance suivante sera
  « sautée » ; la ligne de la barre latérale n'a ni pastille ni état d'attente, aucune
  notification.
- **Preuves** : `qa-178-2-worktree-prepare-attend-light.png`, `qa-178-1-page-light.png` ;
  `scheduled-tasks.json` : `outcome: "running"` sans fin.

#### D4 — Message invisible pendant la commande `setup` (majeur)

- **Étapes** : commande autorisée `echo debut; sleep 8; echo fin` ; pendant « En cours… », écrire
  un message et Entrée.
- **Attendu** : comme pendant l'attente d'accord, la carte dit « Votre message attend… », et on
  peut arrêter la commande ou continuer sans elle.
- **Obtenu** : la saisie se vide, rien dans le fil ni sur la carte pendant toute la commande (le
  message part à la fin, 8 s ici, jusqu'à 15 min au pire) ; aucun bouton sur la carte ; Échap sans
  effet. L'utilisateur croit son message perdu et le retape.
- **Preuves** : `qa-175-5-message-pendant-preparation-light.png`, `qa-175-5-commande-sans-fin-light.png`.

#### D5 — `/btw` avant le premier message (mineur)

- **Étapes** : app neuve, conversation vide, `/btw Question avant tout message`, Entrée.
- **Attendu** : la carte « Aparté » avec la réponse (ou un refus clair).
- **Obtenu** : saisie vidée, aucune carte pendant 6 s et plus ; le coût de l'aparté (0,0125 $US,
  agent factice) apparaît pourtant dans la zone de saisie : question payée, réponse perdue.
- **Preuves** : `qa-180-4-conversation-vide-light.png` ; script `qa-180b.mjs`.

#### D6 à D12 (mineurs, cosmétiques)

- **D6** : joué (`qa-175c.mjs`) : `{"archive": "touch <marqueur>"}` seul, worktree, message,
  suppression avec le worktree : aucune carte, marqueur absent. Cause lue dans `worktree-setup.ts`
  (`prepare` sort sans état « à autoriser » quand il n'y a pas de `setup`).
- **D7** : `gh` simulé non connecté, puis connecté : 20 s et réouverture du panneau sans carte ;
  `ghStatus` garde aussi le résultat négatif 5 min. Preuve : `qa-176-1-gh-non-connecte-light.png`.
- **D8** : `qa-176-2-pr-beaucoup-de-controles-zoom150-dark.png` (zoom simulé par `zoom: 1.5` sur
  la racine, fenêtre 1 280 px) : sélecteur d'agent et bouton d'envoi hors de la zone de saisie. Même mesure en 0.8.0 (bouton à
  698–746 px pour une zone qui finit à 674 px) : `qa-zoom-08-dark.png`, `qa-zoom-09-dark.png`.
- **D9** : `qa-176-2-pr-beaucoup-de-controles-900-dark.png` puis `-zoom150-dark.png`.
- **D10** : `qa-oc-auth-expiree-light.png` ; voir « Vrai agent ».
- **D11** : menu des modèles d'OpenCode, recherche `gpt-6.1-sol` : liste vide.
- **D12** : `e2e/suites/scheduled.mjs`, vérification « plafond affiché dans la devise connue » :
  `/2,00\s?\$/` en dur au lieu de `L()` / du format de la langue (règle d'AGENTS.md). Texte de
  l'app en anglais : « Cap: $2.00 » (`en-echec-scheduled-01-…-light.txt`). Seul rouge de la suite
  anglaise.

### Rejeu après corrections (`main` à `8b4ec04`, fusionné dans la branche)

Mêmes scripts qu'au premier passage, contre l'app reconstruite (agent factice), plus deux tours de
vrai OpenCode (`openai/gpt-6.1-sol`) pour D13 et D14. Preuves : `qa-0-9/rejeu/`.

| # | Statut | Constat au rejeu |
|---|---|---|
| D1 | **corrigé** | La carte montre les deux commandes (« À la création », « À la suppression ») et dit que l'accord couvre les deux ; `archive` ne tourne à la suppression qu'après cet accord (`rejeu-d2-…`) |
| D2 | **corrigé** | Fichier changé entre l'affichage et le clic : rien n'est lancé, la carte montre la nouvelle commande et redemande l'accord (« Le fichier .bobine/worktree.json a changé depuis l'affichage : rien n'a été lancé ») ; lancée seulement au second accord (`rejeu-d2-fichier-change`) |
| D3 | **corrigé** | Exécution planifiée dans un nouveau worktree à préparer : partie sans la commande, « Terminée », historique « préparation non autorisée », carte du fil « Non lancée — Exécution planifiée : cette commande n'est pas autorisée pour ce dépôt » ; « Lancer maintenant » de nouveau possible (`qa-178-2-worktree-prepare-attend`) |
| D4 | **corrigé** | Pendant la commande : « Votre message attend la fin de la préparation », boutons « Arrêter » et « Continuer sans attendre » ; « Arrêter » : carte « Arrêtée », message envoyé avec la ligne de contexte (`rejeu-d4-*`) |
| D5 | **corrigé** | `/btw` dans une conversation vide : carte « prête » avec la réponse au bout de 0,5 s |
| D6 | **corrigé** | `archive` seule : carte « À la suppression » avec « Autoriser » / « Ne pas autoriser » ; autorisée, elle tourne à la suppression du worktree (`rejeu-d6-*`) |
| D12 | **corrigé** | voir « Régression du rejeu » |
| D13 | **corrigé** (vrai OpenCode) | Dossier ajouté avant le premier message, question sans chemin : « ARTICHAUT » ; dossier retiré, un autre ajouté : « BANANE ». La ligne de contexte n'apparaît pas dans les messages affichés (`rejeu-d13-1`, `rejeu-d13-2`) |
| D14 | **corrigé** (vrai OpenCode) | Même conversation (dossier ajouté avant le premier message, puis retiré et un autre ajouté) supprimée avec « Supprimer aussi la session… » : **aucune** session laissée chez OpenCode (7 avant, 7 après) |
| D7 à D11 | non corrigés | Mineurs et cosmétiques, reportés à la version suivante (décision du tech lead) |

**Régression du rejeu** (`8b4ec04`) : `./scripts/verify` vert ; `pnpm build && pnpm e2e
--if-needed` (français, suite complète) **156 / 157** en 9 min 39 s, seul rouge `filles` clair
(« compte rendu… », « coût de la fille… »), **vert relancé seul** (`pnpm e2e filles --jobs 1`, clair
et sombre) : le défaut intermittent connu de cette suite sous charge, pas un défaut des
corrections ; `pnpm e2e --lang en scheduled` vert, clair et sombre (D12). Vrai OpenCode : 2 tours
de plus (11 en tout pour la recette).

### Verdict

**La 0.9.0 peut partir.** Tout ce qui était bloquant ou majeur (D1 à D4, D13) est corrigé et
vérifié dans l'app construite, ainsi que D5, D6, D12 et D14 ; la suite complète est verte aux
défauts intermittents connus près (`filles`, vert relancé seul). Restent ouverts pour la version
suivante, sans rien de bloquant : D7 (cache de `gh auth status`), D8 (zone de saisie à 150 %,
déjà en 0.8), D9 (vue Git perdue après une fenêtre étroite), D10 (connexion d'OpenCode expirée :
erreur brute, pas d'étape de connexion), D11 (recherche d'un modèle par identifiant). Non fait :
le suivi de PR contre le vrai GitHub (dépôt `jlallement/bobine-qa-0-9` prêt, essai par l'app
refusé par les permissions de cette session) — le suivi reste vérifié par le faux `gh` seulement.
Quatre sessions OpenCode de la recette restent chez l'utilisateur (liste plus bas).

### Suivi de PR et de CI contre le vrai GitHub (fiche 176, 0.9.0, `main` à `e96769f`)

Dépôt privé de l'utilisateur `jlallement/bobine-qa-0-9`, workflow `CI` (job `test` : 20 s, échoue
si un fichier `FAIL` est là). App construite pilotée par le harnais e2e, agent factice, vrai `gh`
(`BOBINE_GH=/opt/homebrew/bin/gh`), clone local ; commits faits « comme l'agent » par git dans le
worktree (identité par variables d'environnement, `jlallement@users.noreply.github.com`).
Preuves : `qa-0-9/github/` (captures `gh-*.png`, journaux `gh-real-run1…5.log`, `gh-merge.log`,
scripts `gh-real.mjs`, `gh-merge.mjs`).

**Bon** :

- « Ouvrir une PR » par l'app : PR créée en ~8 s (titre de la conversation), carte « Pull request ».
- Contrôles réels : nom « CI / test » et lien vers le job (`…/actions/runs/<run>/job/<job>`),
  identiques à `gh pr checks` ; « 1 réussi », « Fusionnable ».
- Onglet Session : section « Pull request », « #1 · 1 réussi » (`gh-5-onglet-session`).
- Commentaire (`gh pr comment`) et relecture « comment » (`gh pr review --comment`) écrits sur
  GitHub par le compte de l'utilisateur : « 2 commentaires » ~26 s après, sans « Actualiser »
  (`gh-6-commentaires`).
- Commit `FAIL` poussé : carte « 1 en échec », lien du job ; « Corriger les contrôles en échec » :
  message anglais avec le lien du job, l'extrait du vrai journal (lignes `FAIL qa…`, `Error: …`,
  `##[error]Process completed with exit code 1.`) et la consigne de corriger, committer et pousser
  (`gh-7-ci-en-echec`, `gh-8-corriger`). Correction poussée : de nouveau « 1 réussi ».
- Conflit avec la base (commit sur `main` qui change la même ligne du README) : « En conflit avec la
  base » ~90 s après (le temps que GitHub calcule) ; « Fusionner quand tout est vert » coché pendant
  le conflit : rien ne part, PR toujours ouverte (`gh-10-conflit`).
- « Fusionner quand tout est vert (commit de fusion) » coché dès l'ouverture : pas de fusion tant
  qu'aucun contrôle n'est signalé ; fusion 2 s après le vert, « PR fusionnée par l'app (commit de
  fusion) : tout était vert. », état « Fusionnée » ; GitHub : `MERGED`, commit de fusion `090ecce`
  (`gh-13-fusion-cochee`, `gh-11-fusionnee`).
- « Nettoyer » : demande de confirmation, conversation archivée, worktree et branche locale
  supprimés (`gh-12-nettoyer`).

**Défauts** :

| # | Gravité | Fonction | Constat | Régression |
|---|---|---|---|---|
| D15 | **majeur** | 176 (110) | Commit fait hors du bouton « Committer » (agent, terminal) : la barre du worktree reste figée (« 1 commit sur la branche » quand il y en a 2) et « Pousser vers la PR » n'apparaît pas, ni après « Actualiser », ni après un tour de l'agent ; il faut quitter la conversation et y revenir | « Pousser vers la PR » est nouveau (176) ; barre figée probablement préexistante (110) |
| D16 | mineur | 176 | Juste après « Ouvrir une PR » : « Aucun contrôle de CI » pendant ~60 s, puis directement « 1 réussi » ; l'état « en cours » n'est jamais montré pour un job court (4 essais sur 4) | non (nouveau) |
| D17 | cosmétique | 176 | Après la correction, CI de nouveau verte : la carte garde « Contrôle en échec envoyé à l'agent. » | non (nouveau) |
| D18 | cosmétique | 176 | L'extrait de journal envoyé à l'agent garde les séquences de couleur du terminal (`ESC[36;1m…ESC[0m`) | non (nouveau) |
| D19 | mineur (à décider) | 176 (110) | « Nettoyer » après une PR fusionnée supprime la branche locale mais pas la branche distante sur GitHub (dépôt sans « supprimer la branche à la fusion ») | non établi |
| D20 | **majeur** | 176 | « Fusionner quand tout est vert » coché mais rien ne part : la carte ne dit jamais pourquoi (aucun contrôle signalé, conflit) ; sur un dépôt sans CI, ou si GitHub n'attache pas les contrôles, la case attend sans fin en silence | non (nouveau) |

- **D15** — Étapes : PR ouverte par l'app ; dans le worktree, `git commit` d'un nouveau fichier ;
  onglet Modifications, vue Git ; attendre 40 s ; « Actualiser » ; envoyer un message à l'agent.
  Attendu : « 2 commits sur la branche » et « Pousser vers la PR ». Obtenu : barre inchangée, pas
  de bouton (3 essais) ; nouvelle conversation puis retour : barre à jour, bouton présent.
  Preuves : `gh-sans-bouton-pousser-FAIL-light.png`, `gh-real-run3.log` à `run5.log`. Gêne la
  boucle « Corriger → pousser » quand l'agent committe sans pousser.
- **D16** — `gh-real-run*.log` : `7s … "Aucun contrôle de CI"`, `69s … "1 réussi"` ; le job dure
  25 s. Après la création, la relève s'espace (rien ne change) alors que GitHub n'a pas encore
  inscrit les contrôles. Attendu : relève rapprochée tant que la PR est neuve, ou un libellé
  « contrôles pas encore signalés ».
- **D17** — `gh-real-run5.log` (401 s) : `"event":"Contrôle en échec envoyé à l’agent."` avec
  `"summary":"passed"`.
- **D18** — `gh-real-run5.log`, « fix message » ; `stripAnsi` existe déjà (`shared/worktree-setup.ts`).
- **D19** — `gh api repos/jlallement/bobine-qa-0-9/branches` après « Nettoyer » : la branche
  `bobine/20261106-1816-a60e` y est encore.
- **Chronologie de la PR #6** (`gh-merge.log`, relevé de la carte toutes les 2 s, chaque
  changement noté) : 11 s PR ouverte ; 13 s case « Fusionner quand tout est vert (commit de
  fusion) » cochée, carte « Aucun contrôle de CI », « 0 commentaire » ; **rien ne change de 13 s à
  73 s** ; 73 s « 1 réussi », « Fusionnable » ; 75 s « PR fusionnée par l'app (commit de fusion) :
  tout était vert. » ; 77 s « Fusionnée » ; GitHub : `MERGED` à 17:17:35Z. Le job a duré 25 s :
  GitHub avait donc le contrôle bien avant 73 s ; la carte ne le voit qu'à la relève suivante,
  ~60 s après l'ouverture (cadence espacée quand « rien ne change », D16). D'où l'absence de l'état
  « en cours ». La fusion attend bien le vert : jamais de fusion sur « aucun contrôle »
  (`readyToMerge` exige `passed`, lu par le tech lead, confirmé ici).
- **D20** — Étapes : (a) PR #6, case cochée à 13 s : 60 s de « Aucun contrôle de CI » sans un mot
  sur l'attente (`gh-13-fusion-cochee-light.png`) ; (b) PR #5 en conflit, case cochée : la PR
  reste ouverte (`gh pr view` : `OPEN`), la carte montre « En conflit avec la base » mais rien
  ne relie la case au conflit, et garde l'ancienne note « Contrôle en échec envoyé à l'agent. »
  (`gh-real-run5.log`, 495 s et 504 s ; `gh-10-conflit-light.png`). Attendu : sous la case, la
  raison de l'attente (« en attente des contrôles », « conflit à résoudre », « relecture
  demandée »…), et un mot quand aucun contrôle n'arrive (dépôt sans CI : la case n'aboutira
  jamais). Le cas « dépôt sans CI » n'a pas été joué (le dépôt de test a une CI) : déduit de
  `readyToMerge` et du cas (a).

**Ce qui existe sur GitHub** (laissé en place) : dépôt privé `jlallement/bobine-qa-0-9` ; `main` :
commit initial (README, `ci.yml`), « Change README on main (conflict test) », fusion de la PR #6 ;
PR **#1 à #5 ouvertes** (essais interrompus par mes scripts ; #5 en conflit avec `main`), PR **#6
fusionnée** ; 6 branches `bobine/…` distantes ; un commentaire et une relecture « comment » sur chacune
des PR #1 à #5 ; 11 exécutions des Actions. Les arrêts des passages 1 à 4 et la fin du 5ᵉ
viennent de mes scripts (chemin du worktree, résolution du conflit gênée par une modification de
l'agent factice), pas de l'app.

### Rejeu de la 0.9.1 (`main` à `cd12c91`, fusionné dans la branche)

Après la suite e2e complète verte du tech lead (161/161 sur `cd12c91`). App construite
(`pnpm build`), puis app packagée (`pnpm package --dir`). Preuves : `qa-0-9/rejeu-091/` (journaux
`gh-091-A.log`, `gh-091-B1.log`, `gh-091-B.log`, `oc-091-1.log`, `oc-091.log`, `r2-091.log`,
`packaged-091.log`, captures `g91-*`, `oc91-*`, scripts) et `qa-0-9/r2-091/` (captures R2).

#### Suivi de PR contre le vrai GitHub (D15 à D20)

Même dépôt `jlallement/bobine-qa-0-9`, même déroulé (script `gh-091.mjs`). Partie A, PR #7 avec CI :
ouverture, commentaire, commit `FAIL`, « Corriger », conflit, résolution, fusion d'office,
« Nettoyer ». Partie B, PR #8 sans CI : workflow retiré dans la branche, « Fusionner maintenant »,
« Nettoyer » ; la CI est remise sur `main` ensuite (`1c08618`).

| # | Rejeu | Relevé |
|---|---|---|
| D15 | ✅ corrigé | Commit fait dans le worktree hors de l'app : 10 s sans rien faire, barre inchangée (attendu : relue à la fin d'un tour ou au retour de la fenêtre) ; « Actualiser » de l'onglet : « 2 commits sur la branche » et « Pousser vers la PR » (65 s → 69 s). Idem après la résolution du conflit (« 5 commits »). Plus besoin de quitter la conversation |
| D16 | ✅ corrigé | Après « Ouvrir une PR » : « Contrôles en attente » à 1 s, « 1 en cours » à 13 s, « 1 réussi » à 33 s. Après chaque push : « Contrôles en attente », puis « 1 en cours » ~12 s après |
| D17 | ✅ corrigé | « Contrôle en échec envoyé à l'agent. » dès « Corriger » ; effacée au push suivant (149 s : `event: null`) |
| D18 | ❌ **pas corrigé** | L'extrait envoyé par « Corriger » contient encore `^[[36;1msleep 20^[[0m`. `gh run view --log-failed` écrit les couleurs en notation « caret » (les deux caractères `^` et `[`, pas l'octet ESC) : `od -c` le montre ; `stripAnsi` n'enlève que l'ESC réel. Ma description de la 0.9 (« `ESC[36;1m` ») était fausse sur les octets (capture `g91-A5-attente-conflit`) |
| D19 | ✅ corrigé | Question : « … supprimer le worktree et la branche …, ici et sur GitHub (la PR est fusionnée) ? » ; après : « Worktree nettoyé ; branche … supprimée aussi sur GitHub. » ; `gh api …/branches` : la branche n'y est plus (PR #7 et #8) |
| D20 | ✅ corrigé | Case cochée, chaque raison vue sur la carte réelle : « des contrôles sont en échec » ; puis « conflit avec main à résoudre (« Fusionner dans main », puis pousser) » (le conflit passe devant l'échec) ; « GitHub n'a pas encore signalé les contrôles » ; « Fusion dès que les contrôles seront verts » ; fusion 2 s après le vert (`1ce77fa`, `MERGED`). Sans CI : « Aucune CI détectée » dès l'ouverture ; case cochée : « rien ne sera fusionné d'office. Fusionnez quand vous voulez. » ; « Fusionner maintenant » désactivé tant que GitHub calcule (raison en infobulle), actif 20 s après, fusion 6 s après le clic (`6365f1c`) |

D7 n'a pas été rejoué à la main (`gh` déconnecté) : couvert par les essais de la fiche 176.

#### Nouveaux défauts

| # | Gravité | Fonction | Constat | Régression |
|---|---|---|---|---|
| D21 | **majeur** | 110 / 176 | Après « Nettoyer » (PR fusionnée), la **nouvelle conversation** s'ouvre dans le dossier du worktree supprimé : « Le dossier n'est pas un dépôt git », agent « Arrêté » ; le menu du dossier ne propose que ce dossier disparu (et « Choisir un dossier… ») ; « Nouvelle conversation dans un worktree » ne part pas (délai dépassé) | préexistant probable (la fiche 176 l'avait vu pour la conversation archivée) ; plus visible depuis que « Nettoyer » est le geste attendu après la fusion |
| D22 | **majeur** | 110 | « Committer » échoue quand un fichier a été supprimé par `git rm` (suppression déjà indexée) : « fatal: pathspec '…/ci.yml' did not match any files ». L'app lance `git add -A -- <chemins>` (`worktree-cycle.ts:288`) ; git refuse un chemin absent du disque et de l'index (reproduit à la main : code 128). Un `rm` simple passe | préexistant (fiche 110, `c742296`) |
| D23 | cosmétique | 176 | Après « Fusionner maintenant » sur une PR sans CI : « PR fusionnée par l'app (commit de fusion) : tout était vert. » — rien n'était vert et c'est l'utilisateur qui a fusionné | non (nouveau, 0.9.1) |
| D24 | mineur | 148 / 187 | Réinitialiser une Bobine **installée** lancée avec `--user-data-dir` : la relance (`open -n <app>`) ne reprend pas l'option et rouvre le vrai profil. Déduit du code (`fresh-start-app.ts`, `relaunch`), non joué : l'essai aurait ouvert le vrai profil | non établi |
| D25 | cosmétique | 185 (F1) | Fenêtre de 900 px, panneau ouvert : l'onglet actif perd son ✕ (« Modifications 2 », « Tâches » coupés au bord), et en anglais l'onglet « Session » inactif est réduit à un bout d'icône (« ) ») | F1 en partie seulement |
| D26 | cosmétique | 185 | Même largeur : dans la saisie, le choix de l'agent se réduit à un chevron seul (« Factice rapide ⌄ ⌄ ») en français, « Moc… » en anglais | non établi |

- **D21** — `gh-091-A.log` (fin) et `gh-091-B.log` (« B after cleanup, new conversation »,
  « B workspace menu ») ; captures `g91-A-nettoyee`, `g91-B-nouvelle-apres-nettoyage`,
  `g91-B-menu-dossier-apres-nettoyage`. Attendu : la conversation suivante repart dans le dossier
  principal du dépôt.
- **D22** — `gh-091-B1.log`, capture `g91-B-D22-committer-git-rm`. Contourné pour le rejeu en
  supprimant le fichier par `rm`. Un agent qui supprime par `git rm` bloque « Committer » (message
  brut de git, chemin complet).
- **D25, D26** — passe visuelle ci-dessous (`ui91-05…08`, `en-ui91-06-vue-git`).

#### Vrai agent (OpenCode, `openai/gpt-6.1-sol`) : 5 tours

Régression de l'hôte d'agent (D10) : rien de cassé.
- Recherche « 6.1-sol » dans le menu des modèles : `gpt-6.1-sol` et `gpt-6.1-sol-fast` trouvés
  par l'identifiant (D11 bon contre le vrai agent).
- Deux tours ordinaires (T1 : rôle de `calc.js` ; T2 : « La ligne 3 est fausse… ») : réponses
  justes, agent « Prêt », ni erreur ni carte de connexion.
- Aparté `/btw` : carte « Hors du fil · OpenCode, session à part », réponse `git log -1`.
- Tâche planifiée, « Lancer maintenant » : « Terminée », réponse « planifié OK. » sur GPT-6.1 Sol.
- Fille dans un worktree préparé (accord donné) : préparation « done », « CLE_QA=valeur-de-test ;
  préparé par setup ».
- Les trois conversations supprimées avec « supprimer aussi chez l'agent » ; `opencode session
  list` dans le projet d'essai : vide.
- Le script s'est arrêté une fois sur le formulaire des tâches planifiées : le bouton du dossier
  a changé avec la fiche 185 (mon sélecteur, pas l'app). Reprise au même endroit, sans rejouer
  les tours déjà faits.
- **D10 pas rejoué en vrai** : expirer la connexion d'OpenCode demande de toucher ses
  identifiants réels ; couvert par l'agent factice (scénarios `connexion-expiree*`).

#### R2 dans l'app packagée

- `pnpm e2e:packaged` : tout vert, dont le profil temporaire (dossier supprimé à la fermeture,
  aucune autre Bobine lancée) et la réinitialisation (corbeille d'essai, puis corbeille
  impossible à écrire).
- À la main, par le bouton (Réglages › Données › « Réinitialiser… » › « Tout effacer et fermer »),
  sur un profil jetable (`--user-data-dir` dans le scratchpad, donc ni trousseau ni préférences ;
  vrai profil et Bobine de `/Applications` jamais lancés). Avec `--profil-temporaire`, la
  réinitialisation est refusée par conception (« Un profil temporaire ne se réinitialise pas… »).
  - Bobine quitte 0,3 s après le clic ; aucune autre Bobine lancée.
  - Dossier de données parti ; dans la **vraie corbeille** : « Bobine — données du 2026-11-06
    20.42 » avec le dossier et `LISEZ-MOI.txt` (« qa-r2-data-…  <-  <chemin d'origine> »). Lu par
    le Finder : le shell n'a pas le droit de lire `~/.Trash`.
  - Relancée à la main sur le même dossier : propre (aucune conversation, marqueur parti).
  - Relance automatique non jouée : elle n'a lieu que pour une app installée (voir D24).
- Captures : `qa-0-9/r2-091/` (`r2-0-avant`, `r2-1-reglages-donnees`, `r2-2-confirmation`,
  `r2-3-relancee`).

#### Passe visuelle (900 px, clair et sombre, français et anglais)

Agent factice, 14 écrans par passage (56 captures `ui91-*`, `en-ui91-*`) : accueil, Mon activité
vide, Tâches planifiées vides, conversation après un tour, panneau Modifications (vue Git),
Session, Tâches, Réglages (Général, Apparence, Agents, Données, À propos), recherche sans
résultat. Aucun débordement mesuré (aucun bouton au-delà du bord). Bons : la ligne de bilan
« Terminé · 2 fichiers +6 −2 · ≈ 0,0125 $US », l'état vide des tâches planifiées, les thèmes
d'Apparence sur deux rangées. Défauts : D25, D26.

#### Verdict 0.9.1

**La 0.9.1 peut partir.** D15, D16, D17, D19, D20 sont corrigés contre le vrai GitHub, R2 dans
l'app packagée, D10/D11 sans régression avec le vrai OpenCode. Rien de nouveau n'est bloquant.
Restent :
- D18 (cosmétique) : pas corrigé ; une ligne (`^[` en plus de l'ESC dans `stripAnsi`).
- D22 (majeur, préexistant depuis 110) : petit et sans risque ; à prendre avant le tag si on
  rouvre un lot, sinon en 0.9.2.
- D21 (majeur, préexistant probable) : à corriger vite, mais pas une régression de la 0.9.1.
- D23 à D26 (mineurs ou cosmétiques) : version suivante.

GitHub après le rejeu : PR #7 et #8 fusionnées, leurs branches supprimées ; `main` a reçu
« Reset README to Version 1 » (deux fois), les deux fusions et « Restore CI after the no-CI
test (0.9.1) ». Les PR #1 à #5 et leurs branches restent (essais de la 0.9.0).

### Rejeu final 0.9.1 (`main` à `6c306ce`, fusionné dans la branche)

Seulement ce qui a changé depuis le rejeu précédent. Journaux, scripts et captures (`gf-*`,
`uf-*`, `en-uf-*`) : `qa-0-9/rejeu-final-091/` des notes partagées.

| Défaut | Comment | Résultat |
|---|---|---|
| D18 | Vrai GitHub, PR #10 : journal en échec avec couleurs (`^[[36;1m` en notation `^` dans `gh run view --log-failed`) et la ligne `motif grep [[:space:]]+ et a[1].txt intacts` | **Corrigé.** Message « Corriger » sans ESC, sans `^[`, sans `[36;1m` ; `[[:space:]]+` et `a[1].txt` intacts. |
| D21 | Après « Nettoyer » (PR #10 avec CI, puis PR #11 sans CI) : « Nouvelle conversation », un message | **Corrigé.** La conversation s'ouvre dans `gh-repo` (dossier principal), l'agent répond (« Prêt »), aucun dossier supprimé réutilisé. Pas rejoué : « Nouvelle conversation dans un worktree » juste après « Nettoyer » dans la même app (la partie B a été relancée seule, voir écarts). |
| D22 | `git rm src/app.js` + fichier neuf, puis `git mv docs/notes.txt docs/notes-renommees.txt`, « Committer » dans l'app | **Corrigé.** Commit 1 : `M README.md`, `A docs/notes.txt`, `D src/app.js` ; commit 2 : `R100` ; arbre propre après chacun. |
| Pathspec | `a[1].txt` coché, `a1.txt` décoché, « Committer » | **Corrigé.** Le commit ne contient que `a[1].txt` ; `a1.txt` reste non suivi. |
| D23 | PR #11 sans CI, « Fusionner maintenant » | **Corrigé.** « PR fusionnée (commit de fusion), sans CI détectée. » (PR avec CI, case de fusion d'office : « … : tout était vert. », juste.) |
| D24 | App packagée (`pnpm package --dir`), profil jetable `--user-data-dir` **relatif**, corbeille et relance remplacées par `BOBINE_TRASH_DIR` et un enregistreur `BOBINE_RESET_RELAUNCH` ; `pnpm e2e:packaged` | **Corrigé.** Relance enregistrée : `-n …/Bobine.app --args --user-data-dir=<chemin absolu du dossier jetable>` ; aucune autre Bobine ; relancée sur ce dossier, propre. `e2e:packaged` vert. Le vrai `open` d'une app installée n'est pas exercé (app non installée). |
| D25 | 900 px, panneau par défaut (déjà 280 px à cette largeur) et tiré à 280 px ; tous les outils ouverts ; fr/en × clair/sombre | **Corrigé.** L'onglet actif est entier avec son ✕ dans les 4 passages et pour chaque onglet rendu actif ; les autres vont dans « + » avec le compte (« + 4 »). Souris : le ✕ d'une ligne ferme l'onglet, le menu reste ouvert ; clic sur une ligne : onglet actif, menu fermé. Clavier : ↩ ouvre le menu, focus sur la première ligne, Suppr ferme l'onglet et le focus passe à la suivante, ↩ l'ouvre, Échap ferme. |
| D26 | Même passe | **Corrigé.** La puce de l'agent montre l'icône du robot et le chevron (nom dans l'infobulle), jamais un chevron seul ni un bout de nom. |

Écarts : la vue Git ne voit un `git mv` fait hors de l'app qu'après « Actualiser » (comportement
voulu, D15). Trois essais de script ratés avant le bon (sélecteur, `\n` dans une expression,
« Fusionner maintenant » attendu sur une PR avec CI) : la PR #9 est restée ouverte (branche
`bobine/20261106-2237-a79c`). La partie B a été relancée seule après un `pull` refusé par mon
script (le « Bonjour » de la vérification D21 avait modifié le README du dossier principal).

GitHub après le rejeu : PR #10 et #11 fusionnées, leurs branches supprimées par « Nettoyer » ;
`main` a reçu deux « Reset README », les deux fusions et « Restore CI after the final no-CI test
(0.9.1) » (`a9423d6`). Ouvertes : #1 à #5 (0.9.0) et #9.

**Verdict : la 0.9.1 peut partir.** Tous les défauts rejoués sont corrigés ; rien de nouveau.

### Régression (sur `8d63d17`)

| Contrôle | Résultat |
|---|---|
| `./scripts/verify` | vert : lint, types, 2 506 essais |
| `pnpm build && pnpm e2e --if-needed` (français, suite complète) | **157 / 157** en 9 min 50 s |
| `pnpm e2e --lang en` (suite complète) | **155 / 157** : `scheduled` clair et sombre rouges (D12, l'essai, pas l'app) |
| `pnpm package --dir` puis `pnpm e2e:packaged` | vert (fenêtre, renderer isolé, pas d'agent factice, Bob et OpenCode trouvés par le PATH du shell, terminal, AXe embarqué) |
| `pnpm opencode-probe --offline` (OpenCode 2.2.5) | vert, réponses identiques à la référence |

### Essayé et bon

- **175** : `.worktreeinclude` avec `../…`, `/../up.txt`, lien symbolique vers un fichier et vers un
  dossier hors du dépôt : rien copié hors du dépôt, `.env` ignoré copié, « 1 ignoré » dit ;
  commande en échec (code 3) : carte « Échec (code 3) », sortie d'erreur, message retenu envoyé
  ensuite avec la ligne de contexte ; sortie énorme (400 000 lignes, séquences ANSI) : finie en
  0,1 s, interface fluide, carte bornée à ~4 000 signes, ANSI retirées ; commande sans fin :
  processus arrêtés en quittant la conversation brouillon (worktree supprimé) et à la sortie de
  l'app ; accord retenu par dépôt, redemandé quand la commande change.
- **176** : faux `gh` : PR ouverte à la main repérée, 24 contrôles, titre de 200 signes, conflit,
  changements demandés : carte lisible, contrôles en échec d'abord, noms coupés proprement, fenêtre
  900 px et zoom 150 % sans débordement ; « Corriger les contrôles en échec » : consigne anglaise,
  un extrait par contrôle en échec (4 journaux lus) ; HTTP 502, réponse non JSON, `gh` qui ne
  répond pas : erreur sur la carte, rien de cassé, « Actualiser » désactivé pendant l'appel.
- **177** : diff de 403 fichiers (dont un de 200 000 lignes) : onglet prêt en 0,1 s, consigne bornée
  (« … and N more »), carte « rien à signaler » ; dialogue au clavier (Tab reste dans le
  dialogue) ; pas de « Faire relire » sans git ni dans un relecteur.
- **178** : rattrapage d'une tâche horaire après 4 échéances manquées : une seule exécution,
  « rattrapage · 4 échéances manquées » ; deux tâches à la même minute : les deux partent, deux
  conversations marquées ; dossier disparu : « Lancement impossible » ; page lisible à 900 px et
  150 %.
- **179** : même dossier ajouté deux fois et dossier de travail ajouté comme « autre » : ignorés ;
  ajout et retrait désactivés pendant une réponse ; liste gardée après redémarrage ; worktree : la conversation du worktree ne
  reprend pas la liste (conforme à la fiche), ajout possible et reçu par l'agent.
- **180** : Échap dans l'aparté le ferme sans toucher au tour principal (sa permission attend
  toujours) ; une seconde Échap dans la saisie arrête le tour (comportement habituel) ; réponse
  reçue en changeant de conversation, retrouvée au retour ; conversation supprimée pendant
  l'aparté : carte fermée, processus de l'aparté arrêté ; un processus d'agent de plus pendant
  l'aparté, rendu à la fermeture.
- **Interactions** : worktree préparé + PR + relecture : la relectrice relit toute la branche,
  2 remarques sur le diff à côté de la carte PR (`qa-inter-pr-et-relecture-light.png`) ;
  « Corriger les contrôles » puis « Envoyer à l'agent » : deux messages, dans l'ordre ; aparté
  dans la relectrice (fille) : réponse, lecture seule ; dossiers en plus dans un worktree : reçus.
- **181** : `pnpm opencode-probe --offline` : contrat vert, réponses identiques à la référence.
- **Montée 0.8.0 → 0.9** : profil créé par la 0.8.0 construite au tag (3 conversations dont une
  épinglée et une dans un worktree, `approvals.json` avec un site et une commande « toujours ») puis
  ouvert par la 0.9 : les trois conversations, leurs fils, l'épingle et le worktree sont là,
  `approvals.json` inchangé, `settings.json` gagne seulement `additionalDirectories: false` dans
  les capacités vues ; aucune erreur.

### Vrai agent (OpenCode 2.2.5, `openai/gpt-6.1-sol`)

Premier passage bloqué par la connexion OpenAI d'OpenCode expirée (`Integration.Authorization:
Request failed: 400`, aucun tour abouti, D10). Connexion renouvelée par l'utilisateur, puis
**9 tours** en tout (essai d'un tour, T1, deux questions d'aparté, dossier ×2, relecture, tâche
planifiée, fille), coût affiché 0,00 $US (abonnement). Captures `qa-oc2-*.png`, scripts
`qa-oc2.mjs` et `qa-oc3.mjs`.

| Essai | Résultat |
|---|---|
| Essai d'un tour | « OK » : connexion bonne |
| **« Faire relire »** (diff non commité de `calc.js` : indice décalé ligne 3, `max` à 0 ligne 8) | **OpenCode appelle `report_findings`** : carte « Relecture par OpenCode : 2 remarques, 1 haute », verdict du relecteur sur la carte ; remarques **sur les bonnes lignes** (« Fix the average loop bounds », ligne 3, haute ; « Do not initialize the maximum to zero », ligne 8, moyenne), posées sur le diff sous `for (let i = 1; i <= t.length; …)` et `let m = 0` ; dossier intact (`M calc.js` seulement) ; agent et modèle de l'auteur suggérés dans le dialogue. Remarques en anglais (consigne en anglais, ADR-0014). Carte de repli non vue (pas nécessaire). `qa-oc2-3-relecture`, `-4-remarque-sur-le-diff`, `-5-relecteur` |
| **Aparté** | répond (« git log -1 ») ; demande d'écrire `aside.txt` : « Je suis en lecture seule… », aucun fichier créé, aucune demande d'autorisation (mode plan) ; fil principal intact ; session d'aparté supprimée chez OpenCode à la fermeture. Coût de l'aparté non affiché (OpenCode ne donne pas de coût avec cet abonnement). `qa-oc2-1-aparte` |
| **Autre dossier** | ligne « Autres dossiers » présente (capacité annoncée) ; le dossier est bien transmis (session OpenCode : `opencode.acp.additionalDirectories` = le dossier) ; **mais l'agent ne le connaît pas** (D13) ; chemin donné : il lit `secret.txt` sans demander d'autorisation et répond « ARTICHAUT ». `qa-oc2-6-autre-dossier`, `-6b-…-chemin-donne` |
| **Tâche planifiée « Lancer maintenant »** | exécution « Terminée », « à la main », 0,00 $US ; conversation marquée, réponse « planifié OK. », modèle GPT-6.1 Sol gardé. `qa-oc2-7-planifiee` |
| **Fille dans un worktree préparé** | « Lancer en parallèle… » : carte « Préparation » à autoriser dans la fille (lancée par l'utilisateur), accord, `setup` réussie ; la fille lit `.env` (copié par `.worktreeinclude`, OpenCode demande l'accord pour lire un `.env` : règle d'OpenCode) et `prepared.txt` : « CLE_QA=valeur-de-test ; préparé par setup ». `qa-oc2-8-dialogue-fille`, `-9-fille-preparee` |

**Sessions OpenCode** : 3 avant la recette ; **7 aujourd'hui**, donc **4 laissées** par la
recette. Les 4 conversations du dernier passage (auteur, relectrice, fille, tâche planifiée) ont
été supprimées par l'app avec « Supprimer aussi la session dans l'historique d'OpenCode », et leurs
sessions ont disparu. Restent : 3 sessions de profils jetables effacés (premier essai de connexion,
`qa-oca-…` ; essai d'un tour, « Réponse OK » ; passage interrompu, « Fonction de calc.js ») et la
session vide de D14. Les adopter par « Reprendre une session… » pour les supprimer a été refusé
par les permissions de cette session : à supprimer par l'utilisateur s'il le souhaite
(`ses_e4eea5e12ffepwImwPddrnjQg1`, `ses_e4ed9bbaeffelpUlqan4ac9GwW`,
`ses_e4ed866e9ffew2XT51TnlUEgRb`, `ses_e4ed68ac0ffet1X2vbcr48E9T8`).

### Pas essayé

- IBM Bob (exclu : bobcoins).
- Vrai GitHub (176) : fait ensuite, voir « Suivi de PR et de CI contre le vrai GitHub ».
- Veille réelle du Mac : simulée par des échéances passées dans `scheduled-tasks.json` (app fermée
  ou Mac en veille reviennent au même pour le planificateur) ; pas de `powerMonitor` `resume` réel.
- Plafond de coût d'une tâche : couvert par la suite e2e `scheduled` (verte), pas rejoué à la main.
- Délai de 15 min de la commande `setup` (seulement l'absence de moyen de l'arrêter, D4).
- ⇧⌘A par le vrai clavier (les raccourcis du menu ne passent pas par le protocole DevTools) : la
  commande du menu est envoyée comme le fait la suite `aparte`.
- Zoom 150 % réel d'Electron : simulé par un zoom CSS de la racine (même mise en page, à confirmer
  à la main pour D8).
- Autre dossier supprimé du disque puis conversation rouverte : le script a rouvert la mauvaise
  conversation, non conclu.
- Anglais : seulement par la suite e2e complète en anglais, pas d'exploratoire en anglais.

## Journal

- 2026-11-06 — Fiche ouverte, plan de test écrit.
- 2026-11-06 — Recette jouée (exploratoire, interactions, montée, régression) ; vrai agent bloqué
  par la connexion d'OpenCode. Rapport ci-dessus. Puis dépôt GitHub de test : workflow poussé, essai de
  l'app arrêté par les permissions (voir « Pas essayé »). Statut « en cours » : la décision de publier
  revient au tech lead, et le vrai agent reste à rejouer.
- 2026-11-06 — Vrai agent joué après le renouvellement de la connexion (9 tours) : relecture,
  aparté, tâche planifiée, fille préparée bons ; D13 et D14 trouvés. Reste : rejouer D1 à D6
  et D12 après les corrections.
- 2026-11-06 — Rejeu sur `8b4ec04` (fusionné) : D1 à D6, D12, D13, D14 corrigés ; verdict : la
  0.9.0 peut partir ; D7 à D11 reportés.
- 2026-11-06 — Suivi de PR et de CI contre le vrai GitHub (0.9.0) : nominal bon (PR, contrôles,
  commentaires, échec, « Corriger », conflit, fusion d'office, « Nettoyer ») ; D15 à D20 trouvés.
- 2026-11-06 — D10 et D11 corrigés (branche `claude/183-auth-modeles`, pour la 0.9.1).
  - **D11** : la recherche du menu des modèles porte aussi sur l'identifiant (`value`).
  - **D10** : OpenCode 2.2.5 refuse le message avec le code ACP standard `authRequired` (-32000),
    le même qu'à l'ouverture de session : détection par le code seul, rien de propre à OpenCode
    (ADR-0011). Le refus d'un tour lève la carte de connexion existante, marquée `atTurn`
    (`turn-auth.ts`), avec les étapes du profil ; la clé d'API n'y est pas proposée (celle que le
    profil connaît ne renouvelle pas la connexion d'un fournisseur). Statut « Connexion expirée »
    (`needs-action`), avis court et traduit dans le fil, invite « Reconnectez-vous pour continuer ».
    « Réessayer » relance l'agent, rouvre la même session et renvoie le message refusé une seule
    fois ; si le tour avait lancé des outils (`toolsRan`), la carte le dit. Un seul bouton
    principal : « Se connecter dans le terminal », puis « Réessayer » une fois l'étape lancée.
    Maquette validée par l'utilisateur avec les remarques du tech lead.
  - **Agent factice** : étape `login-required`, scénarios `connexion-expiree` et
    `connexion-expiree-outil`. Bob : rien de supposé, scénarios seulement.
  - **Écarts** : `agent-host.ts` au plafond : ce qu'il lit d'`initialize` sorti dans
    `announced.ts` ; le nombre d'outils du tour tenu par `AppToolsBridge`. Après une connexion
    par `authenticate` (SSO), le message refusé n'est pas renvoyé de lui-même (à renvoyer à la
    main) : seul le chemin « terminal » d'OpenCode a été vu.
  - **Essais** : unitaires (hôte contre l'agent factice : carte, avis, pas d'erreur brute, même
    session, pas de doublon, second « Réessayer » sans effet, refus après un outil ; carte ;
    menu des modèles) ; suite e2e `connexion-expiree` en clair et sombre. Captures avant / après :
    `expiree-0-avant`, `expiree-1-carte`, `expiree-2-reconnecte` (`-light`, `-dark`).
- 2026-11-06 — D10, relecture du tech lead (dix points), corrigée :
  - **Renvoi sûr** : la session est rouverte pour ce renvoi seulement (`TurnAuth.reopen`, plus
    d'`options.reopen` modifié) ; l'agent reste « démarrage » jusqu'au départ du message
    (`resendBlocked`, chemin propre, pas celui de la fiche 142) : un message écrit entre-temps
    attend ou est refusé, jamais deux `session/prompt` à la fois, jamais de message perdu.
  - **Connexion par SSO** (`authenticate`) après un refus au tour : même session rouverte, message
    renvoyé par le même chemin.
  - **Message refusé oublié** à l'arrêt, au message suivant, et quand une session s'ouvre sans
    renvoi ; seule une carte `atTurn` le reprend.
  - **`toolsRan` gardé** d'un renvoi refusé au suivant ; « Réessayer » demande alors confirmation
    (« Des outils ont déjà tourné… ; les relancer ? », seul bouton principal).
  - **Profil** (`authAtTurn`) : indice de connexion (`pattern`, sinon message brut sur la carte) et
    clé d'API utile ou non (gardée si c'est le seul moyen de se connecter) ; la remarque sur la clé
    Zen est dans le profil d'OpenCode, plus dans `turn-auth.ts`.
  - **« Réessayer »** désactivé pendant l'appel (la promesse remonte du renderer).
  - **Session neuve** (agent sans reprise, ADR-0030) : l'échange d'avant et le contexte de session
    suivent le renvoi, une fois (`sessionContextDue` remis à faux).
  - **Rejeu** : un message renvoyé compte deux fois face au rejeu de l'agent (évènement `resent`,
    `replayTail`), sinon une réouverture ajoutait un faux « tour venu d'ailleurs ».
  - **Plafond** : `agent-host.ts` reste à 1 050 lignes (paramètres d'`initialize` et traduction des
    formulaires sortis dans `announced.ts`).
  - **Essais** : unitaires (envoi pendant la réouverture, SSO, `toolsRan` gardé, arrêt sans renvoi,
    session neuve, message brut, clé d'API, `TurnAuth`, `replayTail`, carte : confirmation et
    bouton désactivé) ; scénarios `connexion-expiree-sso`, `-echo`, `-autre` ; suite e2e
    `connexion-expiree` avec le cas des outils (`expiree-3-outils`).
- 2026-11-06 — D10, deuxième relecture (refusée sur N1), corrigée :
  - **N1** : la réouverture après une connexion par SSO est suivie comme un démarrage
    (`this.starting`, avant d'annoncer « démarrage ») : un message écrit pendant le renvoi attend,
    puis part après lui ; plus de second agent, plus de renvoi perdu. Essai par le gestionnaire
    (`manager.prompt`), qui compte les démarrages d'agent.
  - **Indice obligatoire** : un `-32000` sans l'indice du profil reste une erreur de tour
    ordinaire (plus de carte avec le message brut). Bob : son message documenté à l'ouverture de
    session (« Authentication required ») comme indice, rien de plus.
  - **N2** : réouverture refusée elle aussi (carte de session) : le message en attente reste, et
    part une fois la connexion refaite (scénario `connexion-expiree-rouverture`).
  - **N3** : la réouverture ne suppose plus que l'agent garde le message refusé : ses répétitions
    immédiates d'un message marqué `resent` ne comptent pas (gardé une ou deux fois, même
    résultat). Session neuve : le message renvoyé est recopié après la bascule, rejoué une seule
    fois.
  - **Reste (hors D10)** : `start()` annonce « démarrage » avant de se suivre lui-même (déjà là
    avant) ; le différer d'une micro-tâche casse l'essai « arrêté pendant la lecture des clés ».
- 2026-11-06 — D10, troisième relecture (approuvée), deux derniers points :
  - **Renvoi dans une session neuve** : plus de copie visible du message ; le renvoi est compté sur
    le repère de la bascule (`handover.resent`), que la réconciliation du rejeu lit. Le message
    n'apparaît qu'une fois (essai : messages de l'utilisateur comptés).
  - **Fuite de processus (déjà là avant)** : `start()` pendant une carte d'action (`needs-action`)
    ne lance plus un second agent : l'agent est là et attend ; un message envoyé alors est refusé
    (« agent non prêt »). Essai par le gestionnaire : un seul démarrage d'agent.
  - **Essais en plus** : l'agent factice note chaque `session/prompt` reçu
    (`--journal-messages`) : un seul renvoi dans l'essai N1 ; refus sans indice : ni avis
    « connexion expirée », ni agent relancé.
  - **Bob** : `authAtTurn` reste une hypothèse à vérifier sur un vrai Bob (`docs/acp.md`, profil).
  - Le point « reste » de la relecture précédente (`start()` qui annonce « démarrage » avant de se
    suivre) ne touche plus que le premier démarrage, sans agent en cours : pas de fuite.
- 2026-11-06 — Rejeu de la 0.9.1 (`cd12c91`) : D15, D16, D17, D19, D20 corrigés contre le vrai
  GitHub, D18 non ; R2 bon dans l'app packagée ; vrai OpenCode sans régression (5 tours) ; passe
  visuelle à 900 px. D21 à D26 trouvés. Verdict : la 0.9.1 peut partir.
- 2026-11-06 — Rejeu final de la 0.9.1 (`6c306ce`) : D18, D21, D22 (`git rm`, `git mv`), D23,
  pathspec littéral contre le vrai GitHub ; D24 dans l'app packagée ; D25, D26 à 900 px et
  panneau à 280 px (fr/en, clair/sombre, souris et clavier). Tout corrigé. Verdict : la 0.9.1
  peut partir.
