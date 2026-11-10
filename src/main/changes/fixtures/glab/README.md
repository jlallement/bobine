# Sorties réelles de `glab` et de `git push` vers GitLab (fiche 189)

Relevées le 2026-11-07 avec `glab` 1.128.0 et git (macOS, messages de git en français) contre un
**GitLab CE jetable** dans Docker (`gitlab/gitlab-ce:latest`, `http://localhost:8929`, rien vers
l'extérieur), avec un utilisateur et des jetons de test créés dans ce conteneur puis supprimés.
`GLAB_CONFIG_DIR` pointait vers un dossier de test : la configuration `glab` de l'utilisateur n'a
pas été touchée (le jeton de test, rangé par `glab auth login` dans le trousseau du Mac, en a été
retiré à la fin par `glab auth logout`). Chemins anonymisés ; aucun jeton (`glab` les masque, `glpat-***` sinon).
`forge.test.ts` les lit tels quels ; `worktree-cycle-forge.test.ts` rejoue le parcours avec un vrai git.

| Fichier | Commande | Cas |
|---|---|---|
| `auth-status-ok.txt` | `glab auth status --hostname localhost:8929` (sortie d'erreur, code 0) | connecté |
| `auth-status-not-logged.txt` | idem, hôte inconnu de `glab` (code 1) | jamais connecté à cet hôte |
| `auth-status-revoked.txt` | idem, jeton révoqué dans GitLab (code 1, 401 `invalid_token`) | connexion à refaire |
| `auth-status-timeout.txt` | idem, conteneur en pause (code 1, `context deadline exceeded`) | hôte injoignable (VPN coupé) |
| `auth-status-refused.txt` | idem, conteneur arrêté (code 1, `connection refused`) | hôte injoignable |
| `auth-status-certificate.txt` | idem, HTTPS au certificat auto-signé (`openssl s_server`, code 1, `x509`) | certificat d'entreprise refusé |
| `mr-create-ok.stdout.txt` | `glab mr create --source-branch=… --target-branch=main --title=… --description-file - --yes` (sortie, code 0) | MR créée : son lien |
| `mr-create-exists.stderr.txt` | idem, une MR ouverte existe déjà (code 1, 409) | MR existante |
| `mr-create-refused.stderr.txt` | idem, conteneur arrêté (code 1) | hôte injoignable |
| `mr-list-open.json` | `glab mr list --source-branch=feat-2 --output json` | MR ouverte retrouvée |
| `mr-list-empty.json` | idem, aucune MR | pas de MR |
| `push-denied.stderr.txt` | `git push` d'un membre Reporter (code 128, 403) | pas les droits |
| `push-protected.stderr.txt` | `git push` vers une branche protégée (code 1, `pre-receive hook declined`) | branche protégée |
| `push-access-denied.stderr.txt` | `git push` avec un jeton faux (code 128) | identifiants refusés |
| `push-refused.stderr.txt` | `git push`, conteneur arrêté (code 128) | hôte injoignable |
| `push-certificate.stderr.txt` | `git ls-remote` vers le HTTPS auto-signé (code 128) | certificat refusé |

À relever de nouveau à chaque montée de `glab` (ses messages sont lus par des motifs,
`forgeFailure` dans `forge.ts`).

**Emplacement de la configuration** (seconde relecture, 2026-11-07), relevé avec `glab config path`
et un vrai `glab auth login --hostname localhost:8929 --insecure-storage` sous un `HOME`
temporaire, sans `GLAB_CONFIG_DIR` ni `XDG_CONFIG_HOME` (rien dans le vrai profil ni dans le
trousseau) : sur macOS, `glab` 1.128 écrit `~/Library/Application Support/glab-cli/config.yml`
(mode 600). Ordre de lecture : `GLAB_CONFIG_DIR`, puis `~/.config/glab-cli` s'il existe, puis
`XDG_CONFIG_HOME/glab-cli`, puis le dossier du système. `config-macos-after-login.yml` : le
fichier écrit par ce `glab auth login`, jeton masqué. `gh` 2.103 écrit bien `~/.config/gh/hosts.yml`
sur macOS (`gh config set -h`, même méthode).

Sous-chemin (`subfolder`) : avec `subfolder: gitlab` déclaré, `glab mr list --repo=https://hôte/gitlab/g/p`
et `--repo=https://hôte/g/p` appellent tous deux `https://hôte/gitlab/api/v4/projects/g%2Fp/…`
(relevé par l'adresse de l'erreur de connexion, sans serveur) : le `-R` tiré du remote est bon dès
que `glab` connaît le sous-chemin. Sans, `glab` reçoit un 404 : message « déclarez le sous-chemin ».
