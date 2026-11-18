# ADR-0056 — Message de commit rédigé par l'agent, dans une session jetable

- **Statut** : proposé
- **Date** : 2026-11-18
- **Fiche** : 246 (recette POC du 2026-11-17, D3)

## Contexte

Depuis la fiche 110, le message proposé par « Committer » (vue Git d'un worktree ou d'une
conversation ordinaire, carte « Fusion refusée », avertissement avant une fille) est **calculé
par Bobine**, sans appel à l'agent : `proposeCommitMessage(titre, fichiers)`, un type deviné et le
titre de la conversation en sujet. La recette du 2026-11-17 l'a pris en défaut deux fois sur deux
(D3) : « feat: nous allons construire un petit gestionnaire de tâches en… » — en français parce que
le titre l'est, coupé, et **sourd au souvenir** « Conventional Commits in English » que
l'utilisateur avait pourtant retenu dans la mémoire commune (ADR-0040). Une règle locale ne peut
pas lire une mémoire en langue naturelle ni comprendre un diff.

Décision de l'utilisateur (2026-11-18) : **le message proposé est rédigé par l'agent**, qui suit la
mémoire du projet. Contraintes : générique (Bob et OpenCode, ADR-0011), rien de non documenté sur
Bob (`docs/acp.md`, « Compatibilité Bob »), le fil de la conversation et le contexte de l'agent
restent intacts, seul le main parle ACP, ce qui va à l'agent est en anglais (ADR-0014).

## Décision

1. **Une session ACP courte et jetable, dans le même dossier**, comme l'aparté (fiche 180) : un
   `AgentHost` à part (son propre processus), même profil, même modèle et mêmes clés que la
   conversation, `session/new` dans le dossier où se fait le commit (le worktree, ou le dossier
   principal pour « Committer d'abord »), **un seul** `session/prompt`, puis la session est
   supprimée (`session/delete` si l'agent l'annonce, sinon `session/close`, sinon retenue pour ne
   pas reparaître dans « Reprendre une session… ») et le processus arrêté. Lecture seule : mode
   plan si le profil en a un (`initialModeMeta`), toute demande d'autorisation refusée, toute
   élicitation déclinée, ni outils de l'app ni outils « toujours autorisés ». Rien n'arrive dans le
   fil ; le coût de la session est ajouté à celui de la conversation (comme `aside-cost`).
   Seules des méthodes ACP que Bob annonce et que l'app emploie déjà sont utilisées.
2. **Ce que l'agent reçoit** (un seul message texte, en anglais, construit par le main) :
   - la consigne : répondre par le message seul, sans préambule ni bloc de code, sans outil ;
     « si les notes ne disent pas autrement : Conventional Commits, en anglais » ;
   - la **mémoire** : souvenirs approuvés de « Vous » et du projet (`MemoryService.memoriesFor`,
     texte entier), bornés à 4 000 caractères, présentés comme des notes de l'utilisateur ; rien si
     la mémoire est désactivée ;
   - le **titre** de la conversation et son **premier message** (600 caractères au plus) : l'intention ;
   - les **fichiers cochés** (chemin, état) — seulement eux ;
   - leur **diff** (`git diff HEAD -- <cochés>` ; contenu d'un fichier non suivi lu par le main),
     borné à **4 000 caractères par fichier et 24 000 en tout** ; au-delà, le fichier est cité avec
     son compte de lignes `+N −M` et « diff omitted » ; un fichier binaire : « binary » ;
   - **sans secret** : un fichier marqué « secret ? » (`looksSecret`, fiche 244 : `.env*`, `*.pem`,
     `*.key`, `id_rsa*`, `*.p12`) n'envoie que son chemin et son état (« content withheld ») ; dans
     les autres, toute ligne que la détection de secrets du journal reconnaît (`findSecret`,
     `secret-scan.ts`) est remplacée par `[redacted]`.
3. **Ce qu'on garde de la réponse** : le texte des `agent_message_chunk`, sans les blocs de code qui
   l'entourent, sans espaces de tête et de fin. Repli (point 5) si la réponse est vide, dépasse
   5 000 caractères, ou si le tour finit autrement que `end_turn` (`refusal`, `max_tokens`,
   `cancelled`, erreur). Rien d'autre n'est réécrit : un mot n'est jamais coupé, le sujet n'est
   jamais raccourci (l'utilisateur relit et retouche).
4. **Indépendant de l'état de la conversation** : la session jetable a son propre processus, donc
   un agent **occupé** dans la conversation ne bloque rien (pas de file, pas d'attente). Une
   rédaction par conversation à la fois : une nouvelle demande annule la précédente.
   **Délai maximal : 45 s** de bout en bout (lancement compris), puis repli. L'agent **ne peut pas
   démarrer** (profil absent, commande introuvable, connexion expirée, licence ou confiance à
   accorder chez Bob — tout ce qui met l'hôte en `needs-action` ou en erreur) : repli tout de
   suite, avec la raison. Jamais de carte de connexion ni de licence ouverte par une rédaction :
   cela reste au fil de la conversation.
5. **Repli** : message en anglais au format Conventional Commits, **déduit des fichiers seuls**
   (le titre, souvent en français, n'y entre plus) : type `docs` ou `test` si tous les fichiers le
   sont, sinon `chore` (Bobine ne connaît pas l'intention) ; sujet `filesSubject` (« update
   index.html, app.js and style.css », « add 3 files in server/routes », « update 4 files »), qui
   change de forme au lieu de couper ; corps : la liste des fichiers. Une ligne dit pourquoi
   (« OpenCode n'a pas répondu en 45 s », « IBM Bob demande une connexion », « Rédaction
   arrêtée »), avec « Réessayer ».
6. **À l'écran** (commun à `CommitForm`, donc aux quatre endroits) : à l'ouverture du formulaire,
   « Rédaction par <agent>… N s » avec « Arrêter » (pas « Annuler », déjà pris par le bouton qui
   ferme le formulaire) ; le champ attend, grisé, « Committer » est désactivé. Réponse reçue : le
   message dans le champ, **modifiable**, et une ligne « Rédigé par <agent> en 4 s, d'après 4
   fichiers et la mémoire du projet » avec « Rédiger à nouveau ». « Arrêter » pendant la
   rédaction : l'agent est arrêté, le repli prend la place (« Rédaction arrêtée »), modifiable.
   Cases changées après la réponse : « Les fichiers cochés ont changé » + « Rédiger à nouveau »
   (pas de relance automatique : chaque rédaction coûte). Message retouché par l'utilisateur :
   plus jamais remplacé sans un clic.
7. **Réglage** : Réglages › Général › « Message de commit rédigé par l'agent » (activé par
   défaut). Désactivé : le repli tout de suite, sans ligne d'explication, aucun agent lancé.

## Alternatives écartées

- **Tour caché dans la conversation** (un `session/prompt` dans la session de la conversation,
  masqué dans le fil). L'agent connaît le travail, mais : il **pollue le contexte** de l'agent (le
  message et la réponse restent dans son historique, ressortent à la compaction et au
  `session/load`, qui rejoue les `user_message_chunk` : on ne peut pas le cacher au rejeu) ; il
  **porte tout le contexte** de la conversation, des dizaines de milliers de jetons (chez Bob,
  « Continue » après une relance a coûté +0,59 bobcoin, recette du 2026-10-23, contre ≈ 0,02 à
  0,035 pour une session neuve) ; il est
  **impossible quand l'agent est occupé** (le cas de « Committer d'abord » pendant que des filles
  travaillent), et il compterait dans la limite d'étapes de Bob, comptée sur la session (fiche 209).
- **Outil MCP de l'app** (`propose_commit_message` que l'agent appellerait) — il faut quand même un
  message pour que l'agent l'appelle, donc un tour dans la conversation : mêmes défauts. Variante
  **MCP sampling** (`sampling/createMessage` : le serveur MCP de Bobine demande au client MCP,
  l'agent, de faire parler son modèle) : rien ne dit que Bob ou OpenCode l'annoncent, et ce serait
  le modèle sans la mémoire ni le dossier ; non documenté chez Bob, donc écarté. Pourra servir si un
  agent annonce la capacité `sampling` (nouvel ADR).
- **`session/fork`** de la session de la conversation (l'agent garderait le contexte sans le
  polluer) — instable dans ACP, et Bob ne l'annonce pas (`sessionCapabilities` : `list`, `resume`,
  `close`, `delete`). À reprendre le jour où les deux l'annoncent : le prompt serait le même.
- **Session jetable gardée ouverte** d'un commit à l'autre (gagner le lancement) — un processus de
  plus qui vit sans travail, et une session qui accumule les diffs précédents (coût croissant).
  Le lancement mesuré d'OpenCode est de 0,4 s.
- **Améliorer la règle locale** (traduire, lire la mémoire par mots-clés) — ne lit ni l'intention
  ni le diff ; c'est ce que l'utilisateur a écarté.
- **Envoyer tout le diff** — sans borne, un fichier généré ou un export de 200 Mo partirait chez
  le modèle ; la borne garde le coût sous ≈ 13 000 jetons.

## Conséquences

- **Coût par commit** (relevé et estimation, détail dans la fiche 246) : OpenCode 2.3.0, modèle
  gratuit `opencode/big-pickle`, petit diff : **3,6 à 4,4 s** de bout en bout (lancement 0,2 s,
  `session/new` 0,25 s), **≈ 5 700 jetons** (dont ≈ 4 000 de consigne propre à OpenCode), **0 $** ;
  avec le diff au maximum, ≈ 13 000 jetons. Bob (non mesuré ici, Bob n'est pas disponible en
  développement) : un échange court coûte ≈ 0,02 bobcoin (≈ 10 000 jetons de contexte, relevé) ;
  estimation **0,02 à 0,035 bobcoin** par commit selon le diff, à vérifier en recette.
- Un second processus d'agent vit quelques secondes par commit (comme l'aparté). Chez Bob, la
  session apparaît puis disparaît de son historique (`session/delete`, annoncé).
- Le message dépend du modèle : il peut ne pas suivre la mémoire, ou ajouter une phrase
  d'introduction. Il reste proposé, jamais committé sans clic, et modifiable.
- Le diff borné et sans secret part chez le fournisseur du modèle de l'agent — comme tout ce que
  l'agent lit déjà dans ce dossier. Un fichier « secret ? » ne part pas.
- L'agent factice gagne des scénarios (réponse normale, lente au-delà du délai, refus ou erreur)
  et la fonction se teste sans vrai modèle.
- `proposeCommitMessage(titre, fichiers)` disparaît au profit du repli `fallbackCommitMessage
  (fichiers)` ; `commitSubject` (coupe du titre) ne sert plus au commit (il reste pour la PR si
  besoin).
