# 189 — GitLab auto-hébergé : ouvrir une MR

- **Statut** : fait
- **Dépend de** : 096, 123 (« Ouvrir une PR », cycle du worktree), 176 (suivi de la PR et de la CI)
- **Agents** : les deux. C'est le dépôt qui compte, pas l'agent.

## Pourquoi

Le code de l'utilisateur vit souvent sur un **GitLab auto-hébergé**
(remarque du 2026-11-06). Or Bobine ne connaît que GitHub : « Ouvrir une PR » et le suivi de la
fiche 176 appellent `gh` en dur, dans `main/changes/worktree-cycle.ts` et
`main/changes/pr-watch.ts`. Sur un dépôt GitLab, rien de tout ça ne marche, et rien ne le dit
clairement. Pour une V1 qu'on peut distribuer en entreprise, GitLab doit être traité comme
GitHub.

## Décidé avec l'utilisateur (2026-11-06)

- Première étape : **ouvrir une MR** depuis Bobine sur un dépôt GitLab, avec le même parcours que
  « Ouvrir une PR ». Ce parcours comprend :
  - pousser la branche ;
  - le titre et la description ;
  - le lien vers la MR ;
  - « Pousser vers la MR » une fois qu'elle existe.
- Suivi du pipeline, correction par l'agent et fusion automatique : pas demandés pour l'instant.
  L'architecture doit les permettre ensuite sans réécriture.
- **Pas une interface git complète** (consigne de l'utilisateur : « un raccourci ok mais pas une
  usine à gaz ») :
  - un bouton à la place de « Ouvrir une PR » et un lien vers la MR, rien de plus ;
  - pas de liste des MR, pas de navigateur de branches, pas de relecture de MR dans Bobine ;
  - le reste se fait dans GitLab.
- Essais réels contre un **GitLab CE jetable dans Docker** sur le Mac, avec un runner local :
  rien ne part à l'extérieur, et l'instance du travail n'est jamais touchée. Les essais
  automatiques restent sur des réponses enregistrées.

## Critères d'acceptation

- [x] Un **adaptateur de forge** côté main, choisi d'après l'URL du remote et l'outil connecté à
      cet hôte :
  - GitHub (`gh`) passe derrière cet adaptateur sans changement de comportement ;
  - GitLab (`glab`) s'y ajoute.

  Le renderer ne connaît que des mots génériques. Le libellé (« PR » ou « MR ») vient de
  l'adaptateur et passe par des clés de traduction.
- [x] Hôte GitLab **quelconque**, pas seulement gitlab.com :
  - remote SSH avec port, HTTPS avec sous-chemin ;
  - `glab auth status --hostname <hôte>` ;
  - certificat d'entreprise : message clair si `glab` le refuse.
- [x] « Ouvrir une MR » : branche poussée, MR créée vers la branche de base, lien affiché ; une
      MR déjà ouverte est retrouvée.
- [x] Cas d'erreur, chacun avec un message qui dit quoi faire, sans erreur brute :
  - `glab` absent ;
  - non connecté à cet hôte ;
  - hôte injoignable (VPN coupé) ;
  - pas les droits de pousser ;
  - branche protégée.
- [x] Dépôt dont la forge est inconnue (Gitea, Bitbucket…) : le bouton ne s'affiche pas, et
      l'onglet dit pourquoi.
- [x] Essais :
  - réponses enregistrées de `glab` (comme `fixtures/gh/`) pour chaque cas ;
  - suite e2e avec un faux `glab` ;
  - essai manuel contre le GitLab CE de Docker, noté au journal.
- [x] Maquette validée (par l'expert UX de la nuit, à la place de l'utilisateur) avant tout changement visible (bouton, carte,
      messages).

## Questions ouvertes

- Faut-il une décision d'architecture (ADR) pour l'adaptateur de forge ? Oui, probablement :
  c'est une couche nouvelle entre le cycle du worktree et les outils `gh` et `glab`.
- `glab` ou l'API REST de GitLab directement ? `glab` reprend la connexion de l'utilisateur
  (jeton, SSO, certificats), comme `gh` pour GitHub. C'est le choix le plus cohérent avec la
  fiche 176.
- Ce qui manque à GitLab dans le suivi actuel :
  - pipeline et jobs ;
  - discussions ;
  - approbations ;
  - « Merge when pipeline succeeds ».

  À chiffrer pour une fiche suivante.
- Version minimale de GitLab et de `glab` à prendre en charge.

## Plan

Décision : [ADR-0041](../adr/0041-adaptateur-de-forge.md).

1. **Adaptateur de forge** (`src/main/changes/forge.ts`) : hôte d'une URL de dépôt distant (SSH
   `scp` et `ssh://` avec port, HTTPS avec port et sous-chemin, dépôt local), forge connue par le
   nom (`github.com`, `gitlab.com`), erreurs rangées par motifs (non connecté, injoignable,
   certificat, droits, branche protégée), masquage des identifiants et jetons.
   `forge-github.ts` reprend **à l'identique** les commandes `gh` d'« Ouvrir une PR » ;
   `forge-gitlab.ts` : `glab auth status --hostname`, `glab mr create` (arguments `--opt=valeur`,
   description par l'entrée standard), `glab mr list --source-branch --output json`.
2. **Cycle du worktree** (`worktree-cycle.ts`) : la forge est choisie d'après
   `git remote get-url` ; hôte quelconque demandé à `glab` puis à `gh` (`--hostname`), sinon
   deviné par le nom, sinon forge inconnue. État de chaque outil gardé par hôte (5 min / 15 s,
   comme 0.9.1 D7). Sans dépôt distant, ou dépôt distant local : GitHub, comme avant. Le suivi de
   la fiche 176 (`PrWatcher`) n'est branché que pour une forge qui a `tracks` (GitHub) ; pour
   GitLab, la vue dit si la MR de la branche est ouverte (relue au plus une fois par minute, et
   sur « Actualiser »), pour « Pousser vers la MR ».
3. **Vue partagée** (`shared/worktree-cycle.ts`) : `pr.noun: 'mr'`, `pr.host`, `pr.open`,
   raisons `no-tool`, `unknown-forge`, `unreachable`, `certificate` ; `prBlockerKey`.
4. **Renderer** (`WorktreeBar.tsx`) : seuls les libellés changent, par le contexte i18next
   (`open` / `open_mr`…) ; les messages passent par la bulle du bouton (raison d'attente) et la
   ligne d'erreur existantes. `BOBINE_GLAB` (essais) comme `BOBINE_GH`.
5. **Essais** : sorties réelles de `glab` (`fixtures/glab/`) dans `forge.test.ts` ; parcours avec
   un vrai git et un `glab` simulé dans `worktree-cycle-forge.test.ts` (refus du serveur joués par
   un hook `pre-receive`) ; suite e2e `gitlab` avec un faux `glab` (`e2e/fake-glab.mjs`) ; les
   essais GitHub existants (unitaires, `pr-ci`, `pr-ci-sans-ci`, `git`) inchangés.
6. **Essai réel** : GitLab CE dans Docker (local), puis non-régression GitHub sur
   `jlallement/bobine-qa-0-9`.

Dépendance : aucune nouvelle dans le projet. `glab` est un outil de l'utilisateur, détecté dans le
PATH comme `gh` (installé ici par `brew install glab` pour l'essai réel).

## Journal

- 2026-11-06 — Fiche ouverte après la remarque de l'utilisateur sur le GitLab auto-hébergé.
  Constat : `gh` est appelé en dur, et aucune mention de GitLab n'existe dans le code.
- 2026-11-07 — ADR-0041 (adaptateur de forge) et plan. Fait :
  - `forge.ts`, `forge-github.ts`, `forge-gitlab.ts` ; `WorktreeCycle` choisit la forge d'après
    `git remote get-url` et garde l'état de chaque outil par hôte. GitHub : mêmes commandes,
    mêmes garanties (`--match-head-commit`, `--force-with-lease` du suivi et du nettoyage, non
    touchés) ; les essais GitHub existants passent **sans changement d'attente** (unitaires de
    `worktree-cycle`, `pr-watch`, `pr-tracking-real` ; e2e `pr-ci`, `pr-ci-sans-ci`, `git`).
  - GitLab : `glab auth status --hostname`, `glab mr create` (`--opt=valeur`, description par
    l'entrée standard, `--yes`), `glab mr list --source-branch --output json` pour la MR
    existante et « Pousser vers la MR » (relue au plus une fois par minute et sur « Actualiser »).
    `glab` arrêté par son délai = hôte injoignable.
  - Messages (fr/en) : `glab` absent, non connecté (commande `glab auth login --hostname` dite),
    jeton révoqué, hôte injoignable, certificat refusé, pas les droits, branche protégée, forge
    inconnue ; erreur inconnue : la ligne utile de `glab`, sans cadre ni fichier de reprise.
    Jamais de jeton au journal (identifiants d'URL et jetons `glpat-`/`ghp_`… masqués).
  - Essais : `fixtures/glab/` (16 sorties réelles), `forge.test.ts`, `worktree-cycle-forge.test.ts`
    (vrai git, refus du serveur par hook `pre-receive`), suite e2e `gitlab` (faux `glab`, clair et
    sombre). `glab` 1.128.0 installé par `brew install glab` (outil de l'utilisateur, pas une
    dépendance du projet).
- 2026-11-07 — **Essai réel GitLab** : GitLab CE (`gitlab/gitlab-ce:latest`) dans Docker, ports
  sur `127.0.0.1` seulement, utilisateurs `qa-dev` (Owner de `qa-dev/demo`) et `qa-guest`
  (Reporter) et jetons créés dans le conteneur ; `GLAB_CONFIG_DIR` de test. Bobine
  (`--profil-temporaire`, agent factice, vrai `glab`, vrai git) :
  - « Ouvrir une MR » → MR !6 créée vers `main` (vérifiée par l'API), lien affiché ;
  - commit fait dans un terminal, « Actualiser », « Pousser vers la MR » → la MR porte le nouveau
    commit (API), « Une MR existait déjà » ;
  - branche `bobine/*` protégée → « La branche est protégée sur localhost:8929… » ;
  - conteneur en pause → bouton grisé « localhost:8929 ne répond pas… » (premier essai : message
    « non connecté » parce que `glab` était coupé par le délai ; corrigé, délai = injoignable) ;
  - `agents.log` relu : aucun jeton.
  - Relevés à la main en plus (fixtures) : non connecté, jeton révoqué (401), refus de poussée 403
    d'un Reporter, identifiants faux, certificat auto-signé (`openssl s_server`), hôte arrêté.
  - Nettoyage : `glab auth logout` (le jeton de test avait été rangé dans le trousseau par
    `glab auth login` ; vérifié absent ensuite), conteneur arrêté et supprimé. Pour le relancer :
    `docker run -d --name bobine-gitlab-189 --hostname localhost -p 127.0.0.1:8929:8929 -p 127.0.0.1:2224:22 --shm-size 256m -e GITLAB_OMNIBUS_CONFIG="external_url 'http://localhost:8929'; gitlab_rails['gitlab_shell_ssh_port']=2224; prometheus_monitoring['enable']=false; puma['worker_processes']=0; sidekiq['concurrency']=5; gitlab_rails['usage_ping_enabled']=false" gitlab/gitlab-ce:latest`
    (≈ 3 min avant de répondre ; jeton : `gitlab-rails runner` dans le conteneur).
- 2026-11-07 — **Non-régression GitHub réelle** sur `jlallement/bobine-qa-0-9` : Bobine, vrai
  `gh`, « Ouvrir une PR » (libellés inchangés) → PR #12, carte de suivi affichée ; PR fermée et
  sa branche supprimée ensuite (`gh pr close --delete-branch`).

- 2026-11-07 — **Verdict de l'expert UX** (règle de la nuit : validation par l'expert ;
  `nuit-0-11/gitlab/VERDICT-expert-ux.md`) : validé sous réserve, corrections faites :
  1. **Une seule issue** sous les boutons : erreur et note ne font plus qu'un état
     (`panel/worktree-outcome.ts`), remplacé par chaque action, effacé par « Actualiser »
     (compteur passé par `ChangesTab`) et rangé avec la clé du worktree et de l'état de sa forge
     (jamais l'issue d'un autre dépôt ou d'un autre hôte). Essai unitaire de l'état, et e2e
     `gitlab` : « jamais deux issues » à chaque étape, aucune après le passage à une forge inconnue.
  2. **Lien court** : « MR ouverte : demo/app!1 », « Une MR existe déjà : … » ; GitHub
     `owner/repo#12` (`requestRef`) ; adresse complète en bulle, lien en couleur d'accent.
  3. **Forge inconnue** : pas de bouton ; ligne grise sans icône, deux lignes au plus, commande en
     code, seulement quand la branche a des commits à proposer.
  4. **Pas de dépôt distant** : ni bouton ni ligne (`noRemote` dans la vue, à part de `pr` pour
     garder l'ordre des raisons de GitHub). **Écart assumé** : l'e2e `worktree-cycle` attendait
     « Ouvrir une PR » grisé avec une raison sur un dépôt sans dépôt distant ; son attente est
     changée (seule attente GitHub modifiée, à la demande du verdict).
  5. **Bouton grisé visible** : style désactivé de la barre (`.worktree-actions .btn:disabled`),
     `aria-disabled`, raison dans la ligne grise (plus de bulle).
  - Suggestion prise : « branche protégée » dit quoi faire (« bobine/… n'a pas pu être poussée :
    cette branche est protégée sur … Demandez l'accès, ou changez les règles de protection, puis
    réessayez. »).

- 2026-11-07 — **Relecture du tech lead** (à corriger avant fusion), corrections faites :
  1. *Régression GitHub* (alias `git@github.com-work:`, `ssh://git@ssh.github.com:443`) : GitHub
     redevient la forge par défaut, exactement comme avant (`gh auth status` sans `--hostname`) ;
     GitLab seulement sur preuve (`gitlab.com`, `altssh.gitlab.com`, hôte déclaré dans la
     configuration de `glab`, lue sur le disque). Alias SSH résolus par `ssh -G`.
  2. *Sécurité* : aucune commande lancée vers un hôte inconnu tiré du remote (configurations lues
     sur le disque seulement, classement « forge inconnue » sur « Actualiser ») ; `ssh -G` sans
     les variables de jeton ; plus de `glab auth status` sur un hôte non déclaré (qui classait
     aussi un GHE en GitLab avec `GITLAB_TOKEN`).
  3. Sortie inattendue de `glab` : forge inconnue, jamais « non connecté ».
  4. `glab mr create` / `mr list` avec `-R https://<hôte>/<projet>` du dépôt distant de la base
     (fork), lancés **hors du dépôt** : l'essai réel a montré que dans le dépôt, `glab` refuse un
     remote SSH dont l'hôte (`localhost`) n'est pas celui du web (`localhost:8929`), même avec
     `-R`.
  5. Une vérification partagée par outil et par hôte ; « injoignable » gardé 5 min ; `info()`
     n'attend la forge que 250 ms (« vérification en cours », puis `worktree:forge`).
  6. `runCommand` rend `timedOut` (processus tué au délai) ; plus de délai deviné à la montre.
  7. `Permission denied (publickey)` : message sur la clé SSH (`ssh -T git@hôte`).
  8. Issue unique : liée au worktree où l'action est partie (réponse tardive ignorée ailleurs) ;
     « Actualiser » pendant la création d'une MR ne perd pas le lien ; une erreur de commit ou de
     fusion reste quand la forge change d'état ; « aucun commit » de nouveau en bulle du bouton
     grisé.
  - Trouvé en route : le lien court était rendu **hors** du `<a>` (la balise `<link>` de la
    traduction est un élément HTML vide pour le lecteur de `Trans`) ; renommée `<anchor>`.
  - Essais : `forge.test.ts` (transports, options déguisées, IPv6, `redact`, environnement sans
    jetons, configurations de `glab` et `gh`, `-R`, faux `glab` qui dort tué → `timedOut`),
    `worktree-cycle-forge.test.ts` (github.com SSH et HTTPS avec `glab` installé : `glab` jamais
    lancé, `gh` sans `--hostname`, `ghFor` = `gh` ; `ssh.github.com:443`, alias, GHE ; hôte
    inconnu jamais sondé ; fork → `-R` ; deux `info()` → une sonde ; hôte qui ne répond pas →
    `info()` non bloqué ; `ssh -G` sans jetons), `WorktreeBarOutcome.test.tsx` (réponse tardive
    après changement de worktree, « Actualiser » pendant la création, erreur de commit gardée,
    lien court). e2e `gitlab` : `glab` déclare l'hôte par un `GLAB_CONFIG_DIR` de test.
  - **Rejeu réel GitLab** (GitLab CE relancé dans Docker, utilisateur, jeton et clé SSH de test,
    configuration `glab` en clair dans un dossier de test, rien dans le trousseau) avec un remote
    **SSH avec port** (`ssh://git@localhost:2224/qa-dev/demo.git`, hôte `localhost` → `glab`
    `localhost:8929`) : MR !2 vers `main` (API), lien `qa-dev/demo!2`, une seule issue,
    « Actualiser » l'efface, « Pousser vers la MR » (la MR porte le commit, API), conteneur en
    pause → « vérification » puis « ne répond pas » ; `agents.log` sans jeton.
  - **Rejeu réel GitHub** (`jlallement/bobine-qa-0-9`, HTTPS) : PR #13, carte de suivi ; fermée,
    branche supprimée. Alias SSH réel non rejoué : aucune clé SSH GitHub sur cette machine (essais
    unitaires seulement). Effet de bord corrigé : un `ssh -T git@github.com` d'essai avait ajouté
    github.com à `~/.ssh/known_hosts`, retiré par `ssh-keygen -R`, qui a écrit `~/.ssh/known_hosts.old` en écrasant un éventuel fichier
    du même nom (signalé à l'utilisateur, pas « réparé »). Règle depuis : aucun fichier personnel
    touché hors du dépôt et du profil temporaire (`~/.ssh`, trousseau, configurations réelles de
    `gh` et `glab`) ; essais SSH avec `-o UserKnownHostsFile=<dossier de test>` et configurations
    isolées (`GLAB_CONFIG_DIR`, `GH_CONFIG_DIR`). Le jeton rangé dans le trousseau par le premier
    `glab auth login` de la nuit avait été retiré par `glab auth logout`.

- 2026-11-07 — **Seconde relecture du tech lead**, corrections faites :
  1. Alias SSH déclaré tel quel à `glab` (`Host gitlab.corp` → `HostName 10.1.2.3`) : le nom écrit
     dans le remote est confronté à la configuration de `glab`, puis le nom résolu.
  2. **Emplacement réel de la configuration de `glab` sur macOS** : `~/Library/Application
     Support/glab-cli/config.yml` (et non `~/.config/glab-cli`, lu jusqu'ici : la détection
     GitLab était morte hors des essais). Relevé avec `glab config path` et un vrai
     `glab auth login --insecure-storage` contre le GitLab Docker, sous un `HOME` temporaire,
     sans toucher au profil ni au trousseau. Ordre de `glab` : `GLAB_CONFIG_DIR`,
     `~/.config/glab-cli` s'il existe, `XDG_CONFIG_HOME/glab-cli`, dossier du système. Fixture
     `config-macos-after-login.yml` (jeton masqué). `gh` : `~/.config/gh/hosts.yml`, vérifié pareil.
  3. Re-vérification lente (`gh auth status` au-delà de 250 ms) : le dernier état connu du
     worktree reste (bouton, MR ouverte) ; « vérification en cours » seulement au premier
     chargement. « Vérification en cours » n'efface plus une issue de la forge.
  4. GitHub Enterprise connu de `gh` seulement par son environnement (`GH_ENTERPRISE_TOKEN`,
     `GITHUB_ENTERPRISE_TOKEN`, `GH_HOST`) : reste GitHub après « Actualiser », sans sonde.
  5. GitLab sous un sous-chemin : avec `subfolder` déclaré à `glab`, le `-R` tiré du remote est bon
     (`glab` enlève lui-même le sous-chemin, relevé sans serveur par l'adresse de son erreur) ;
     sans, `glab` reçoit un 404 : raison « déclarez le sous-chemin » (`glab config set subfolder`).
     Pas d'instance réelle sous sous-chemin essayée.
  6. `info()` : une seule lecture du dépôt distant par relève.
  - Essais : `forge.test.ts` (ordre des emplacements, `config.yml` réel), `worktree-cycle-forge.test.ts`
    (alias déclaré, GHE par environnement, `gh` lent → dernier état, MR gardée pendant une
    vérification lente, 404, une lecture du remote), `worktree-outcome.test.ts`.
  - **Rejeu réel** (GitLab Docker relancé, configuration `glab` seulement dans
    `<HOME de test>/Library/Application Support`, Bobine lancée avec ce `HOME`) : « Ouvrir une
    MR » détecté, MR !2 vers `main`, lien `qa-dev/demo!2`, « Pousser vers la MR » (la MR porte
    le commit, API ; GitLab met quelques secondes à le prendre), conteneur en pause : l'état
    connu reste jusqu'à l'abandon de `glab` (20 s), puis « ne répond pas » ; journal sans jeton.
    Aucun fichier du vrai profil touché ; trousseau vérifié sans entrée `localhost`.

- 2026-11-07 — **Troisième passe du tech lead** : l'état gardé pendant une vérification lente est
  aussi lié à la branche (pas la MR d'une ancienne branche après `git checkout -b`) ; « Actualiser »
  l'oublie (« vérification » plutôt qu'un ancien refus). Essai : branche changée pendant une
  vérification lente. verify vert, e2e `gitlab` et `worktree-cycle` verts.

## Écarts au plan et limites

- **Maquette** validée par l'expert UX de la nuit (pas par l'utilisateur, règle du 2026-11-07),
  sous réserve de corrections faites (journal).
- **Hôte SSH distinct** : reconnu par le `ssh_host` de la configuration de `glab`, ou par le nom
  sans port (`localhost` → `localhost:8929`, essayé en réel) ; un alias SSH par `ssh -G`.
- **Sous-chemin** (`https://hôte/gitlab/groupe/projet.git`) : l'hôte est bien lu, `glab` doit avoir
  `subfolder` dans sa configuration ; non essayé en réel.
- Versions : essayé avec `glab` 1.128.0 et GitLab CE de novembre 2026 ; pas de minimum vérifié.
- Le suivi du pipeline, les discussions, les approbations et la fusion automatique restent à
  chiffrer (fiche suivante) : la place est prête (`tracks`, ADR-0041).
