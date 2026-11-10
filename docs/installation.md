# Installer Bobine

Depuis l'app installable (le plus simple : `.dmg`, voir « L'app installable ») ou depuis les
sources, y compris derrière un proxy et sans droits administrateur.

**Prérequis de l'app installable** : un Mac Apple Silicon et macOS 13 Ventura ou plus récent
(plancher d'Electron 45 ; Bobine ne déclare pas d'autre minimum, et n'est essayée que sur des
macOS récents), et au moins un agent (`bob` ou `opencode` dans le `PATH`). Node et pnpm ne servent
que pour les sources.

**Quelque chose ne marche pas ?** Réglages › Diagnostic (aussi Aide › Diagnostic…) vérifie tout
d'un coup : agents trouvés et leur version, session d'essai dans le dossier courant (dossier
approuvé, connexion, licence), serveurs MCP, Xcode, simulateurs et AXe, SDK Android. Chaque
problème vient avec sa marche à suivre ; « Copier le rapport » donne le tout en texte. Rien n'est
envoyé à un modèle (0 bobcoin).

## Récupérer le dépôt

Avec `git clone` de préférence : `git pull` suffit ensuite pour se mettre à jour. Une archive zip
téléchargée par un navigateur marche aussi (voir « Sans réseau vers GitHub » plus bas) : macOS la
met en quarantaine, mais l'app ne reporte plus cet attribut sur AXe ni sur Electron.

Derrière un proxy :

```bash
git config --global http.proxy http://<proxy>:<port>
```

## Dépendances (`pnpm install`)

**Electron se télécharge au premier `pnpm dev`** (ou `pnpm preview`, `pnpm package`), pas
pendant `pnpm install` : depuis la version 44.7.2, le paquet `electron` n'a plus de script
d'installation. Son binaire vient des « releases » GitHub. Derrière un proxy, au choix :

```bash
# Passer par le proxy
ELECTRON_GET_USE_PROXY=1 GLOBAL_AGENT_HTTPS_PROXY=http://<proxy>:<port> pnpm dev
# Ou un miroir, s'il en existe un
ELECTRON_MIRROR=https://<miroir>/electron/ pnpm dev
```

**Sans accès à GitHub** : le téléchargement échoue, et `pnpm dev` donne le nom exact de l'archive
à récupérer. Voir « Sans réseau vers GitHub » : `pnpm electron-local <archive>`.

**AXe (simulateur iOS).** `pnpm dev` et `pnpm preview` l'extraient de l'archive versionnée dans le
dépôt, sans réseau. `fetch-axe` vérifie son empreinte SHA-256 et sa signature, et recopie
l'archive sans son attribut de quarantaine avant de l'extraire : un dépôt récupéré en zip par un
navigateur ne bloque plus AXe. Un AXe qui marche déjà ailleurs sert aussi : dans le `PATH`, ou
`BOBINE_AXE=/chemin/vers/axe pnpm dev`. Réglages › Diagnostic dit lequel l'app utilise.

## Sans réseau vers GitHub (zip des sources)

**Ce qui se passe normalement.** Le paquet npm `electron` ne contient pas l'application Electron.
Au premier `pnpm dev` (ou `pnpm preview`, `pnpm package`), `scripts/check-electron` lance
`node_modules/electron/install.js`, qui télécharge `electron-v<version>-darwin-arm64.zip` depuis
GitHub, le décompresse dans `node_modules/electron/dist/` (`Electron.app` et un fichier
`version`), puis écrit `node_modules/electron/path.txt`, qui indique l'exécutable
(`Electron.app/Contents/MacOS/Electron`). `pnpm dev` lit ce fichier pour lancer Electron. Si
GitHub est bloqué, rien de tout cela n'a lieu. (Avant Electron 44.7.2, ce téléchargement se
faisait pendant `pnpm install`, par un script d'installation.)

**Ce qu'il faut faire.** Inutile de recréer `dist/` ou `path.txt` à la main :

1. Récupérer l'archive d'Electron par un autre moyen (navigateur, disque partagé). Il faut
   exactement la version du projet : `pnpm dev` donne son nom et son adresse,
   `https://github.com/electron/electron/releases/download/v<version>/electron-v<version>-darwin-arm64.zip`.
2. Installer les dépendances :

   ```bash
   pnpm install
   ```

3. Installer cet Electron (remplace aussi ce qui aurait été fait à la main) :

   ```bash
   pnpm electron-local ~/Downloads/electron-v45.0.0-darwin-arm64.zip
   ```

   Ou, avec seulement l'app déjà décompressée : `pnpm electron-local ~/Downloads/Electron.app`.
4. Lancer l'app (`pnpm dev`), ou la construire pour `~/Applications` (`pnpm package --dir`, voir
   « Construire l'app sur place »).

**Ce que fait `electron-local`.** Il vérifie la version, et l'empreinte SHA-256 de l'archive
(celles publiées par Electron, livrées dans son paquet npm : c'est bien l'archive officielle). Il
la décompresse sans l'attribut de quarantaine (aucun `xattr` à lancer, même sans droits
administrateur), puis écrit `dist/` et `path.txt` comme le script d'Electron. Une mauvaise version
ou une empreinte inconnue est refusée, avec la raison. Un `Electron.app` déjà décompressé n'est
vérifié que par sa version : préférer l'archive.

**À refaire** seulement si `node_modules` est supprimé, ou si une mise à jour du projet change la
version d'Electron : `pnpm dev` le dit alors, avec l'archive à récupérer.

## Sans droits administrateur

- L'app dans `~/Applications` plutôt que dans `/Applications` : ouverte depuis le `.dmg`, elle
  propose de s'y installer elle-même (voir plus bas).
- Bob, OpenCode, Node et pnpm installés dans le dossier personnel : l'app relit le `PATH` du shell
  de connexion, et Réglages › Diagnostic › « Relire le PATH » après une installation.
- L'app ne propose que les agents installés ; les réglages disent lesquels manquent.

## Bob

L'app lance `bob acp` elle-même : rien à lancer à la main. Au premier lancement, elle propose le
premier agent installé (Bob, sinon OpenCode) et demande d'abord le dossier du projet : aucun agent
ne démarre avant ce choix (« Choisir un dossier… », fiche 093). Puis, dans l'ordre où Bob les
demande :

1. **Dossier non approuvé** : « Faire confiance à ce dossier » (retenu par Bob).
2. **Connexion requise** : « Log in with SSO » (le navigateur s'ouvre), ou une clé d'API Bob.
3. **Licence** : à lire dans le terminal de l'app, puis à accepter une fois dans un terminal
   (`bob --accept-license`) ; l'app ne l'accepte jamais à votre place.

Réglages › Diagnostic dit d'un coup où en est Bob dans le dossier courant (Bob s'arrête au premier
refus : dans un dossier non approuvé, la connexion et la licence se vérifient ensuite).
Si un de ces panneaux ne vient pas : le journal (Aide › Afficher le journal) et
`pnpm bob-probe` (0 bobcoin) disent si la version de Bob installée répond comme l'app l'attend.

## OpenCode : choisir les fournisseurs de modèles

Dans `~/.config/opencode/opencode.json` :

```json
{ "enabled_providers": ["<identifiant-du-fournisseur>"] }
```

Seuls ces fournisseurs sont chargés, dans l'app comme dans `opencode`. Sans ce réglage, tous les
fournisseurs connus sont proposés, modèles gratuits compris.

## Construire l'app sur place

Quand le `.dmg` ne se télécharge pas, l'app se construit depuis les sources, sans réseau (Electron
repris de `node_modules`, AXe de l'archive du dépôt) :

```bash
pnpm package --dir
```

Résultat : `dist/mac-arm64/Bobine.app`, à copier dans `~/Applications`. Construite sur la
machine, elle n'est pas en quarantaine ; signée ad hoc, elle se lance sur ce Mac.

Sur un Mac Intel, le dossier est `dist/mac` ; sur Apple Silicon, `dist/mac-arm64`.
L’architecture suit l’Electron installé localement.

Pour obtenir aussi un DMG à distribuer :

```bash
pnpm package
```

Le DMG est créé avec les outils inclus dans macOS (`ditto`, `hdiutil`, et `codesign` si signé),
sans téléchargement de l’auxiliaire dmg-builder. Il contient l’app et un lien Applications,
dans une fenêtre simple. Les dépendances npm et Electron doivent déjà être installés ; la
signature Developer ID et la notarisation, si configurées, restent appliquées (fiche 153).

## L'app installable (`.dmg`)

Construite par GitHub à chaque version (fiche 059) : page « Releases » du dépôt, ou

```bash
gh release download <version> -p '*.dmg'   # ex. v1.0.0-beta.1
```

Le `.dmg` contient Bobine et le lien Applications. Deux façons d’installer restent possibles
(fiche 073 ; fenêtre simplifiée à partir de la fiche 153, après la version 0.6.0) :

- **Glisser Bobine sur le dossier Applications** : pour tous les utilisateurs du Mac. Sans droits
  d'administrateur, le Finder demande le mot de passe d'un administrateur.
- **Double-cliquer sur Bobine** dans la fenêtre du `.dmg` : elle s'ouvre et propose de s'installer
  elle-même, au choix :
  - *pour tous les utilisateurs de ce Mac* (`/Applications`), si on peut y écrire ; sinon le choix
    est grisé, avec la marche à suivre ;
  - *pour moi seulement* (`~/Applications`), sans droits d'administrateur.

  Le choix coché d'office est l'endroit où Bobine est déjà installée, sinon `/Applications` s'il
  est possible. « Installer » la copie là, sans l'attribut de quarantaine, la relance depuis sa
  nouvelle place et éjecte le `.dmg` ; une version déjà installée au même endroit va à la
  corbeille. « Plus tard » : la question revient au prochain lancement hors d'Applications ;
  « Ne plus proposer » est retenu.

Signée ad hoc seulement (ADR-0008) : macOS ne connaît pas son auteur. La signature Developer ID et
la notarisation d'Apple sont prêtes, mais attendent un compte développeur Apple (fiche 111). La
**première ouverture est donc bloquée** (« Apple n'a pas pu vérifier… »). La marche à suivre
d'Apple ([support.apple.com/fr-fr/102445](https://support.apple.com/fr-fr/102445)) :

1. Essayer d'ouvrir l'app une fois, puis cliquer sur « Terminé » (pas « Placer dans la corbeille »).
2. Réglages Système › Confidentialité et sécurité, descendre jusqu'à la section Sécurité, et
   cliquer sur « Ouvrir quand même » à côté du message sur Bobine.
3. Confirmer avec « Ouvrir » (mot de passe ou Touch ID demandé).

Ensuite, l'app s'ouvre normalement. Depuis macOS 15, le clic droit › Ouvrir (ou Ctrl-clic) ne
contourne plus la vérification. Sur un Mac d'entreprise, la politique du parc (MDM) peut
désactiver « Ouvrir quand même ».

**En ligne de commande** (si vous faites confiance au téléchargement) : retirer la quarantaine que
macOS met sur un fichier téléchargé par un navigateur.

```bash
# Sur l'app déjà installée
xattr -dr com.apple.quarantine /Applications/Bobine.app    # ou ~/Applications/Bobine.app
# Ou sur le .dmg, avant de l'ouvrir
xattr -d com.apple.quarantine ~/Downloads/Bobine-*.dmg
# Ou télécharger avec curl : pas de quarantaine
curl -fL -o ~/Downloads/Bobine.dmg <adresse du .dmg>
```

Si la gestion du parc refuse encore l'app, la construire sur place (plus haut) : elle n'est jamais
en quarantaine.

Autre effet de la signature ad hoc : pour macOS, chaque nouvelle version est une autre app. Il peut
redemander l'autorisation « Enregistrement de l'écran » et l'accès à l'entrée « Bobine Safe
Storage » du trousseau (les clés d'API) : « Toujours autoriser ».

**Pas de mise à jour automatique** (ADR-0023) : l'app ne regarde pas s'il existe une version plus
récente. Sur GitHub, « Watch › Custom › Releases » prévient de chaque version ; elle s'installe
comme la première (double-clic dans le `.dmg` : l'ancienne, au même endroit, va à la corbeille). Les nouveautés de chaque
version sont dans Réglages › Nouveautés (`CHANGELOG.md`), la version installée en tête.

**Signer et notariser** (mainteneurs) : `pnpm package --dry-run` dit comment l'app serait signée
avec les variables présentes, sans rien construire. Variables et secrets GitHub : fiche 111 et
commentaire de `.github/workflows/release.yml`.

## La commande `bobine` du terminal

Comme `code .` : `bobine <dossier> ["premier message"]` ouvre une nouvelle conversation dans ce
dossier (le même parcours que « Choisir un dossier », donc la confiance du dossier pour Bob). Le
message est posé dans la zone de saisie, jamais envoyé tout seul.

```bash
bobine .
bobine ~/Dev/projet "lis le README et propose un plan"
```

Réglages › Général › « Commande bobine » installe un petit script `sh` dans `/usr/local/bin` si
vous pouvez y écrire, sinon dans `~/.local/bin` (à mettre dans le `PATH` : l'app le dit). Il appelle
`open -n -a Bobine --args …` (le binaire, sous Linux) ; si Bobine est déjà ouverte, la conversation
s'ouvre dans sa fenêtre. Déplacée, l'app propose « Réinstaller » ; « Désinstaller » retire le
script, et seulement le sien. Pas de commande dans l'app lancée depuis les sources (`pnpm dev`).
Les options de l'app (`--profil-temporaire`, `--reinitialiser`…) ne sont jamais prises pour un dossier.

## Venir de « Bob Desktop »

L'app s'appelait Bob Desktop jusqu'à la version 0.1.1 (fiche 069, ADR-0013). Au premier
lancement, Bobine reprend l'historique et les réglages : le dossier
`~/Library/Application Support/bob-desktop` devient `…/bobine` (un lien reste à l'ancienne place).
Si `…/bobine` contient déjà des conversations (Bobine lancée avant la fiche 071), celles de
l'ancien dossier y sont copiées une fois, sans rien écraser ; l'ancien dossier reste en place.
**Quitter Bob Desktop avant** : tant qu'il est ouvert, Bobine le signale et s'arrête. Ensuite :

- supprimer l'ancienne `Bob Desktop.app` ;
- **ressaisir les clés d'API** (Réglages › Agents : « Illisible, à saisir de nouveau ») : elles
  sont chiffrées par une entrée du trousseau qui porte le nom de l'app. L'ancienne entrée,
  « Bob Desktop Safe Storage », peut être supprimée dans Trousseau d'accès ;
- redonner à Bobine les autorisations de macOS (notifications, « Enregistrement de l'écran ») :
  l'identifiant de l'app a changé ;
- dépôt : `jlallement/bobine` (l'ancienne adresse redirige) ;
  `git remote set-url origin https://github.com/jlallement/bobine.git` dans un clone existant ;
- variables d'environnement de l'app : `BOBINE_*` au lieu de `BOB_*` (`BOBINE_WORKSPACE`,
  `BOBINE_AGENT_PROFILE`…) ; celles d'IBM Bob (`BOB_API_KEY`) ne changent pas ;
- commandes de projet : `.bobine/commands/` ; l'ancien `.bob-desktop/commands/` reste lu.

## Captures d'écran

La capture (fenêtre rapide ⌥⌘B, ou l'appareil photo de la zone de saisie) passe par l'outil de
macOS. À la première capture, macOS demande l'autorisation « Enregistrement de l'écran » pour
Bobine (en développement : « Electron ») ; sans elle, l'image ne montre que le fond d'écran.
L'app n'étant signée qu'ad hoc, macOS peut la redemander après une nouvelle version.
Réglages › Diagnostic dit où elle en est.
