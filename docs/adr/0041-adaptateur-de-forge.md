# ADR-0041 — Un adaptateur de forge entre le cycle du worktree et `gh` / `glab`

- **Statut** : proposé
- **Date** : 2026-11-07

## Contexte

« Ouvrir une PR » (fiches 110, 123) et le suivi de la PR et de la CI (fiche 176) appellent `gh`
en dur. Le code d'une partie des utilisateurs vit sur un **GitLab auto-hébergé** (fiche 189) :
rien n'y marche, et rien ne le dit. La fiche 189 demande d'ouvrir une MR avec le même parcours
(branche poussée, MR vers la base, lien, MR existante retrouvée, « Pousser vers la MR »), sans
interface git complète, et sans changer le comportement sur GitHub. Le suivi du pipeline, la
correction par l'agent et la fusion d'office viendront plus tard : il faut une place pour eux.

## Décision

Une couche **forge** dans le main (`src/main/changes/forge*.ts`), entre le cycle du worktree et
les outils en ligne de commande de chaque forge :

1. **Choix de la forge d'après le dépôt distant**, pas d'après l'agent ni un réglage
   (`forge-resolver.ts`). L'URL de `git remote get-url <remote>` donne l'hôte : SSH `scp` ou
   `ssh://` avec port, HTTPS avec port et sous-chemin, IPv6 ; un transport `ext::`, un hôte qui
   ressemble à une option (`-oProxyCommand=…`) ou un nom invalide ne sont pas des hôtes.
   - **GitHub par défaut, exactement comme avant** (`gh auth status` sans `--hostname`) : tout
     ce que `glab` ne revendique pas — github.com, `ssh.github.com`, alias SSH, GitHub
     Enterprise, dépôt local, hôte inconnu.
   - **GitLab seulement sur preuve** : `gitlab.com`, `altssh.gitlab.com`, ou un hôte déclaré dans
     la configuration de `glab` (`config.yml` là où `glab` le lit — sur macOS
     `~/Library/Application Support/glab-cli` —, lue sur le disque : rien n'est lancé ni
     envoyé ; son `ssh_host` compte ; le nom écrit dans le remote, puis celui d'un alias SSH). Un nom qui contient « gitlab » sans `glab` installé : GitLab, pour
     dire d'installer `glab`. Une sortie inattendue de `glab` : forge inconnue, jamais « non
     connecté ».
   - **Aucune sonde d'un hôte inconnu** : l'URL du dépôt distant peut avoir été écrite par un
     agent. Sur « Actualiser » seulement, un hôte que ni `glab` ni `gh` ne déclarent (leurs
     fichiers, `GH_HOST`) est dit **forge inconnue** : pas de bouton, la raison dite.
   - Les alias SSH (`git@github.com-work:…`) sont résolus par `ssh -G -- <alias>` (configuration
     SSH lue, aucune connexion), avec un environnement **sans les variables de jeton**
     (`GITLAB_TOKEN`, `GH_TOKEN`, `GH_ENTERPRISE_TOKEN`…).
   - Une vérification par outil et par hôte à la fois (promesse partagée), gardée 5 min si elle
     est bonne ou si l'hôte ne répond pas, 15 s sinon ; `info()` n'attend la forge que 250 ms,
     puis la vue git garde le dernier état connu (« vérification en cours » au premier
     chargement seulement) et l'évènement `worktree:forge` dit de relire.
   - `glab mr` reçoit `-R https://<hôte>/<projet>` du dépôt distant de la base (fork compris) et
     tourne hors du dépôt : dedans, `glab` refuse un remote SSH dont l'hôte n'est pas celui du web
     (relevé contre un GitLab réel).
2. **Un adaptateur par forge** (`forge-github.ts`, `forge-gitlab.ts`) : l'outil (`gh`, `glab`),
   l'état de sa connexion à cet hôte (gardé 5 min s'il est bon, 15 s sinon, comme la fiche 176),
   la création de la demande de fusion et la demande déjà ouverte de la branche, le nom de la
   demande pour l'interface (`pr`, `mr`) et ses **capacités** (`tracks` : suivi des contrôles et
   fusion). Les arguments sont toujours un tableau passé à `execFile`, jamais une ligne de shell ;
   le journal ne garde que l'hôte, jamais l'URL complète du dépôt distant ni un jeton (les
   identifiants d'une URL et les jetons connus sont masqués).
3. **Le renderer ne connaît que des mots génériques** : la vue du worktree porte `noun: 'mr'`
   (absent : `pr`) et la raison d'un refus (`no-tool`, `not-logged`, `unknown-forge`, … avec
   l'hôte ; `no-gh` reste celle de GitHub) ; les libellés sont des clés de traduction avec un contexte (`open` / `open_mr`).
4. **Le suivi reste une capacité** : le `PrWatcher` de la fiche 176 est l'implémentation GitHub
   (`gh pr view`, règles, journaux, `gh pr merge --match-head-commit`, inchangés) et n'est
   branché que si l'adaptateur a `tracks`. Pour GitLab, la vue du worktree dit seulement si une
   MR est ouverte (pour « Pousser vers la MR »). Un suivi GitLab (pipeline, discussions,
   approbations, fusion quand le pipeline réussit) sera un second suivi qui rend le même
   `PrTrack`, sans toucher au renderer ni au cycle.

## Alternatives écartées

- **API REST de GitLab directement** — il faudrait gérer jetons, SSO, certificats et proxy de
  l'entreprise ; `glab` reprend la connexion de l'utilisateur, comme `gh` pour GitHub (fiche 176).
- **Forge choisie dans les réglages** — un utilisateur a des dépôts sur plusieurs forges ; l'URL
  du dépôt distant le dit déjà, sans rien demander.
- **Réécrire tout de suite le suivi de la fiche 176 derrière une interface commune** — aucune
  seconde implémentation à valider, beaucoup de code déplacé sans gain ; la frontière est posée
  (`tracks`), le déplacement se fera avec le suivi GitLab.
- **Libellé « PR » / « MR » calculé dans le renderer d'après l'hôte** — contraire à la règle des
  profils (aucune connaissance d'un fournisseur dans l'UI) ; le main dit le mot.

## Conséquences

- Sur GitHub, rien ne change : mêmes commandes `gh` (`gh auth status` sans `--hostname`, comme
  avant, y compris pour GitHub Enterprise et les alias SSH), mêmes garanties
  (`--match-head-commit`, `--force-with-lease`), mêmes essais unitaires sans changement d'attente.
  Seule exception, voulue par le verdict UX : un dépôt sans dépôt distant n'a plus de bouton.
- Une forge inconnue (Gitea, Bitbucket…) n'a pas de bouton ; l'ajouter, c'est un adaptateur de
  plus, sans toucher au renderer.
- Un hôte GitLab au nom neutre (`git.entreprise.fr`) n'est reconnu que s'il est déclaré à `glab`
  (`glab auth login --hostname`) ; avant, il reste à GitHub, et « Actualiser » le dit inconnu avec
  la commande à lancer.
- À surveiller : les messages d'erreur de `glab` et de GitLab, lus par des motifs (non connecté,
  hôte injoignable, certificat, droits, branche protégée) ; les sorties enregistrées
  (`fixtures/glab/`) servent de référence, à relever à chaque montée de `glab`.
