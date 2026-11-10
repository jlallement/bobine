# 064 — Aperçu des pages HTML

- **Statut** : fait
- **Dépend de** : 007, 052
- **Agents** : les deux (lien de fichier et navigateur intégré, génériques)

## Pourquoi

Quand l'agent crée une page (`rapport.html`, une maquette, un mini-site), un clic sur son lien
l'ouvre aujourd'hui dans Safari : on quitte l'app, et la page n'est pas à côté de la conversation.
Comme les « artifacts » de Claude, elle doit s'afficher dans le navigateur intégré, à côté du fil,
où l'agent peut aussi la regarder.

## Critères d'acceptation

- [x] Un lien vers un `.html` / `.htm` du dossier de la conversation s'ouvre dans un nouvel onglet
      du navigateur intégré, panneau ouvert ; ⌥-clic : montré dans le Finder, comme avant.
- [x] La page marche comme servie par un petit serveur de développement : ses feuilles de style,
      scripts (modules compris), images et `fetch()` de fichiers voisins se chargent ; « Recharger »
      montre la dernière version (rien en cache).
- [x] Sécurité : serveur local seulement (`127.0.0.1`, port libre), chemin à jeton secret, en-tête
      `Host` vérifié (rattachement DNS refusé) ; seuls les fichiers du dossier de la page (et en
      dessous) sont servis, ni fichiers ni dossiers cachés (`.env`, `.git`…), ni liste de
      dossier ; lecture seule (`GET` / `HEAD`). Le navigateur intégré reste limité à `http(s)`.
      Durci par la fiche 114 : un serveur (origine) par dossier prévisualisé, lien symbolique vers
      un fichier caché refusé.
- [x] Fichier HTML hors du dossier de la conversation : montré dans le Finder (règle de la
      fiche 052).
- [x] Testé : unitaire (serveur : fichier, type, sous-dossier, index, fichier caché, hors du
      dossier, jeton, `Host`, méthode ; décision du lien) ; e2e avec l'agent factice (lien vers une
      page qui charge sa feuille de style et un `fetch()` de données), captures clair / sombre.

## Plan

1. `shared/file-links.ts` : `isHtmlPath`, issue `{ kind: 'browser'; path; url }`.
2. `main/files/html-preview.ts` : `HtmlPreviewServer` (démarré à la première page, arrêté en
   quittant) : `urlFor(dossier, fichier)`, requêtes vérifiées (jeton, `Host`, méthode, chemin
   réel dans le dossier, pas de segment caché), types MIME, `Cache-Control: no-store`.
3. `main/files/file-links.ts` : `.html` du dossier → adresse de l'aperçu (option injectée ;
   sans elle, comme avant : app par défaut).
4. `BrowserManager.openTab` (nouvel onglet, sinon l'onglet actif s'il y en a déjà trop) ;
   IPC `files:openLink` : ouvre la page dans le navigateur de la conversation.
5. Renderer : issue `browser` → panneau, onglet « Navigateur ».
6. Agent factice : scénario `lien-html` ; e2e `links` complétée.

Pas de nouvelle dépendance (`node:http`).

Écarté : ouvrir le fichier en `file://`. Il faudrait ouvrir le navigateur intégré à `file:`, et
Chromium y bloque `fetch()` et les modules JavaScript, courants dans une page générée.

## Journal

- 2026-10-15 — Fait selon le plan.
  - `main/files/html-preview.ts` : `HtmlPreviewServer` (`node:http`, `127.0.0.1`, port libre,
    jeton aléatoire de 24 caractères, `Host` exact, `GET`/`HEAD`, segment caché ou `/` encodé
    refusé, chemin réel dans le dossier de la page, `index.html` d'un dossier, types MIME,
    `no-store`, `nosniff`, `no-referrer`) ; un identifiant court par dossier de page. Démarré à la
    première page, arrêté en quittant.
  - `openFileLink` : `.html` / `.htm` du dossier → `{ kind: 'browser', url }` quand l'aperçu est
    fourni ; `files:openLink` ouvre l'adresse dans un nouvel onglet du navigateur de la conversation
    (`BrowserManager.openTab` ; l'onglet actif s'il y en a déjà dix) ; le renderer ouvre le panneau
    sur « Navigateur ». Le navigateur intégré reste limité à `http(s)`.
  - **Choix** : la page ne voit que son dossier et en dessous (pas tout le dossier de la
    conversation) ; elle peut y lire les fichiers non cachés, comme avec un serveur de
    développement. Une page qui irait chercher `../` ne le peut pas : à ouvrir par « Lancer
    l'app » (fiche 030) si besoin.
  - Tests : unitaires (serveur : page, CSS, JSON, index d'un sous-dossier, nom avec espace ;
    refus : `.env`, `.git/`, `..` encodé, lien symbolique vers dehors, mauvais jeton, autre `Host`,
    `POST` ; décision du lien avec et sans aperçu) ; e2e `links` (scénario `lien-html` : page avec
    feuille de style, module, `fetch()` de données, `.env` refusé en 404, lu dans l'onglet ; rien
    ouvert ailleurs). La capture de l'interface ne montre pas la page (vue native par-dessus) :
    contenu vérifié dans l'onglet.
  - **Essai réel** (OpenCode, 0 bobcoin) : lien `rapport/index.html` donné par l'agent, page
    ouverte dans le navigateur intégré, style, module et `fetch()` des résultats chargés (« 4
    suites, 57 tests »), photo de l'onglet regardée.
