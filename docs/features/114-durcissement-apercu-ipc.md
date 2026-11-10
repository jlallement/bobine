# 114 — Durcissement de l'aperçu HTML et de l'IPC

- **Statut** : fait
- **Dépend de** : 001, 064
- **Agents** : les deux (rien de propre à un agent : serveur d'aperçu et frontière IPC de l'app)

## Pourquoi

Un audit de sécurité en lecture seule (2026-10-21) a relevé trois défauts dans les protections
propres à Bobine, tous corrigeables sans rien changer à l'écran :

1. **Lien symbolique vers un fichier caché.** Le serveur d'aperçu (fiche 064) refuse les segments
   commençant par un point, puis vérifie seulement que le chemin réel reste dans le dossier servi.
   Un lien `config.txt → .env` à l'intérieur du dossier passe les deux contrôles : la promesse
   « jamais de fichier caché » n'est pas tenue. Cas réaliste : un dépôt cloné qui contient ce lien
   (git conserve les liens symboliques), dont l'utilisateur prévisualise une page.
2. **Une seule origine pour tous les dossiers prévisualisés.** Même port, même jeton, dossiers
   distingués par un identifiant dans le chemin. Pour le navigateur, l'origine (`127.0.0.1:port`)
   est la même : le JavaScript d'une page prévisualisée connaît le jeton (il est dans sa propre
   adresse) et peut lire les fichiers de tout autre dossier déjà servi dans la session de l'app.
   Un jeton par dossier ne suffirait pas : l'isolation du navigateur repose sur l'origine, pas sur
   le chemin.
3. **Émetteur des appels IPC non vérifié.** `registerIpcHandlers` ignore l'évènement Electron,
   donc l'identité de la fenêtre qui appelle. Les fenêtres sont déjà bien cloisonnées (preload
   dans le cadre principal seulement, navigation et popups bloqués, panneau navigateur sans
   preload) : c'est une défense en profondeur, recommandée par la liste de sécurité d'Electron
   (« Validate the sender of all IPC messages »), pas une faille exploitable connue.

Le reste de l'audit (pouvoirs de l'agent sur la machine, portée de « Toujours dans ce projet »,
historique et journaux en clair) n'est pas de la sécurité à coder dans Bobine : les autorisations
de l'agent relèvent de sa configuration (`docs/agents.md`, décision du 2026-10-16 dans
`docs/acp.md`), les deux autres points sont des limites assumées, communes aux outils du genre.

## Critères d'acceptation

- [x] Aperçu HTML : un lien symbolique, dans le dossier servi, vers un fichier ou un dossier caché
      du même dossier (`config.txt → .env`, `pub → .git`) est refusé (404) ; un lien vers un
      fichier ordinaire du dossier reste servi.
- [x] Aperçu HTML : chaque dossier prévisualisé a son propre serveur (port et jeton distincts) ;
      depuis une page d'un dossier, une requête vers un fichier d'un autre dossier prévisualisé
      est refusée (origine différente, jeton inconnu). Les fichiers voisins, modules et `fetch()`
      du même dossier marchent comme avant ; « Recharger » montre toujours la dernière version.
- [x] Tous les serveurs d'aperçu sont arrêtés quand l'app quitte.
- [x] IPC : un appel dont l'émetteur n'est pas le cadre principal d'une fenêtre de l'app
      (principale ou rapide) est refusé avec une erreur et une ligne dans le journal ; les deux
      fenêtres de l'app gardent toutes leurs capacités.
- [x] Rien ne change à l'écran : la suite e2e `links` (page qui charge sa feuille de style et un
      `fetch()` de données) passe telle quelle, captures regardées.
- [x] Testé : unitaire (`html-preview.test.ts` : lien vers fichier caché, lien vers dossier caché,
      deux dossiers → deux ports, jeton d'un dossier refusé sur l'autre, `stop()` ferme tout ;
      `ipc.test.ts` : émetteur accepté, émetteur refusé) ; e2e avec l'agent factice (scénario
      `lien-html`, suite `links`).

## Plan

Trois fichiers de code, leurs tests, une ligne de changelog. Pas de nouvelle dépendance, pas d'ADR
(rien de structurant : les décisions de la fiche 064 restent, on les applique mieux).

1. **`main/files/html-preview.ts` — fichiers cachés derrière un lien.** Après `realpath`, découper
   `relative(root, real)` en segments et refuser si l'un commence par un point. Garder le contrôle
   existant sur le chemin demandé (il évite un `stat` inutile). Test : `config.txt → .env` et
   `pub → .git` dans le dossier d'essai ; `lien.txt` (vers un fichier ordinaire) reste servi.

2. **`main/files/html-preview.ts` — une origine par dossier.** Remplacer le serveur unique et la
   table `id → dossier` par une table `dossier réel → { serveur, port, jeton }`. `urlFor` démarre
   le serveur du dossier à la première page, l'adresse devient
   `http://127.0.0.1:<port du dossier>/<jeton du dossier>/<chemin>` (plus d'identifiant). Chaque
   serveur vérifie `Host` avec son propre port. Les serveurs vivent jusqu'à `stop()` (appelé en
   quittant, `main/index.ts`) : une socket locale par dossier prévisualisé ne coûte rien, pas de
   logique de fermeture à l'oubli. Tests : deux dossiers → deux ports et deux jetons ; le jeton de
   l'un sur le port de l'autre → 404 ; `stop()` ferme les deux. Les tests existants s'adaptent
   (l'adresse n'a plus d'identifiant).

3. **`main/ipc.ts` + `main/index.ts` — émetteur vérifié.** `registerIpcHandlers` reçoit une
   option `trusted(event)` ; un appel non digne de confiance est journalisé (`log.warn`) et rejeté
   avec une erreur, sans appeler le handler. Dans `index.ts`, le prédicat vérifie que
   `event.sender` est le `webContents` d'une fenêtre de l'ensemble `appWindows` (qui existe déjà
   pour les évènements envoyés aux fenêtres) et que `event.senderFrame` est son cadre principal.
   `IpcMainLike` type l'évènement a minima (`sender`, `senderFrame`). Tests : handler appelé
   quand `trusted` répond vrai, erreur et pas d'appel quand il répond faux ; les tests existants
   passent un prédicat toujours vrai.

4. **Clore** : `CHANGELOG.md` / `CHANGELOG.en.md` (« l'aperçu HTML cloisonne chaque dossier et ne
   suit plus un lien vers un fichier caché »), `docs/architecture.md` (ligne de la fiche 064 :
   un serveur par dossier ; ligne de la fiche 001 : émetteur IPC vérifié), fiche 064 : critère
   « Sécurité » complété d'un renvoi ici.

Écarté :
- Un jeton distinct par dossier sur le même port : même origine, n'isole rien.
- Fermer un serveur dès que ses pages sont fermées : il faudrait suivre les onglets du navigateur
  par dossier ; une socket locale inutilisée ne coûte rien.
- Interdire tous les liens symboliques dans l'aperçu : ceux vers des fichiers ordinaires du
  dossier sont utiles (`node_modules` liés, ressources partagées).
- Vérifier l'adresse (`senderFrame.url`) plutôt que la fenêtre : la fenêtre est la frontière que
  l'app connaît ; l'adresse change entre dev (`http://localhost`) et app packagée (`file://`).

## Journal

- 2026-10-21 — Fiche rédigée d'après l'audit de sécurité ; plan à valider avant de coder.
- 2026-10-21 — Fait, en trois commits suivant le plan. Écarts : `appWindows`, `broadcast` et le
  prédicat `trustedSender` sortent d'`index.ts` dans `main/app-windows.ts` (le fichier dépassait
  sa limite de 850 lignes, qu'on ne remonte pas) ; la suite e2e `links` est adaptée à la nouvelle
  forme d'adresse (plus d'identifiant de dossier), rien d'autre ne change à l'écran. Le prédicat
  n'a pas de test unitaire (il lit `BrowserWindow`) : couvert par les e2e, qui passent par l'IPC
  depuis les deux fenêtres.
