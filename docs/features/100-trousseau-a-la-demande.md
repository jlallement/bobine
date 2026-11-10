# 100 — Le trousseau seulement quand il sert

- **Statut** : fait
- **Dépend de** : 022 (clés d'API, Réglages › Agents et dossiers)
- **Agents** : les deux. Les clés d'API concernent le profil qui en a, mais la règle est générale.

## Pourquoi

À chaque lancement, Bobine demande le mot de passe du trousseau macOS, même quand aucune clé d'API
n'est enregistrée. C'est le deuxième irritant du bilan « 8 h par jour » du 2026-10-21.

La cause est connue : au démarrage, l'état des réglages calcule `canStoreKeys`
(`src/main/conversations/manager.ts`, `settings.canStoreKeys()`). Ce calcul appelle
`safeStorage.isEncryptionAvailable()` (`src/main/index.ts`), qui ouvre le trousseau. L'app installée
est signée ad hoc : macOS ne retient pas « Toujours autoriser » d'une version à l'autre, et redemande.

Sans certificat Apple Developer (décision de l'utilisateur : pas pour l'instant), on ne peut pas
supprimer la demande quand une clé existe. On peut ne plus la faire quand aucune clé ne sert.

## Critères d'acceptation

- [x] **Sans clé d'API enregistrée**, aucun accès au trousseau au démarrage, ni pendant une
      conversation : `safeStorage` n'est appelé à aucun moment.
- [x] **Avec une clé enregistrée**, le trousseau n'est ouvert que lorsqu'il faut la lire, au
      lancement de l'agent qui s'en sert, et une seule fois par lancement de l'app.
- [x] **Saisir une clé** (Réglages › Agents et dossiers › Clés d'API, « Définir ») vérifie à ce
      moment-là que le chiffrement est disponible. S'il ne l'est pas, le message d'aujourd'hui
      s'affiche.
- [x] La liste des clés (« IBM Bob · Aucune », « Définir ») s'affiche sans ouvrir le trousseau : on
      sait qu'une clé existe sans la déchiffrer.
- [x] Testé : unités (aucun appel à `safeStorage` au démarrage sans clé, un seul avec clé), e2e
      `settings` ou `keys` inchangés et verts (trousseau factice).
- [x] La fiche dit ce qui reste sans certificat : avec une clé enregistrée, macOS redemande après
      chaque nouvelle version de l'app.

## Plan

Relevé dans le code (2026-10-21) : deux chemins ouvrent le trousseau sans qu'aucune clé serve.
1. `settingsView()` remplit `canStoreKeys` (`safeStorage.isEncryptionAvailable()`) : au démarrage,
   à chaque ouverture des Réglages.
2. `ApiKeyStore.info()` déchiffre chaque clé enregistrée pour savoir si elle est illisible : la
   simple liste des clés ouvre le trousseau (seulement quand une clé existe).

Forme retenue, la plus simple : le trousseau n'est touché que par ce qui en a vraiment besoin.

- `ApiKeyStore` (`agent-config/api-keys.ts`) :
  - `canStore()` disparaît ; `available()` n'est appelé que par `set()`, au moment d'enregistrer.
  - `info()` ne déchiffre plus. « Illisible » vient d'un échec de déchiffrement constaté pendant ce
    lancement de l'app (`credentials()`), retenu en mémoire ; avant tout essai, une clé présente
    dans le fichier est « Enregistrée ».
  - `credentials()` déchiffre à la demande, une fois par clé et par lancement : la valeur en clair
    reste en mémoire du main process (elle part de toute façon dans l'environnement de l'agent, et
    Chromium garde la clé de chiffrement du trousseau en mémoire après le premier accès). `set()`
    garde la valeur saisie, `remove()` l'oublie.
- `SettingsStore.canStoreKeys()` et `AgentSettingsView.canStoreKeys` disparaissent (et la ligne de
  `settingsView()`).
- Renderer (`AgentsSettings.tsx`) : « Définir » / « Remplacer » toujours actif. La vérification se
  fait à l'enregistrement : c'est là que la clé est chiffrée, donc là que macOS demande le trousseau ;
  s'il est indisponible, le message d'aujourd'hui (`apiKeys.noKeychain`, « Le trousseau macOS n'est
  pas disponible : la clé ne peut pas être enregistrée. ») s'affiche sous la ligne, comme dans
  « Connexion requise ». L'info-bulle `settings.apiKeys.keychainUnavailable` n'a plus d'usage :
  retirée de `fr.json` et `en.json`.
- `index.ts` : le `Cipher` branché sur `safeStorage` ne change pas (rien n'est appelé à sa
  construction), seul le commentaire dit quand il sert.
- Tests : `api-keys.test.ts` (chiffrement compteur : `has`/`info` n'y touchent jamais, un seul
  déchiffrement pour plusieurs lancements, `available()` seulement à la saisie), `manager.test.ts`
  (sans clé : vue des réglages et lancement d'un agent sans aucun appel ; avec clé : vue sans appel,
  un déchiffrement au lancement, aucun de plus au redémarrage), `settings-store.test.ts`,
  `SettingsDialog.test.tsx`. e2e `auth` (clé enregistrée, illisible, ressaisie) et `settings`.

## Ce qui reste sans certificat Apple Developer

- **Avec une clé enregistrée**, macOS redemande le mot de passe du trousseau après chaque nouvelle
  version de l'app : la signature ad hoc change à chaque build, et « Toujours autoriser » ne vaut
  que pour la signature qui l'a reçu. Une seule demande par lancement de l'app, au premier
  lancement d'un agent qui lit la clé.
- Ce lancement peut venir de l'app elle-même : la lecture du quota de Bob (fiche 091) lance Bob
  environ 3 s après le démarrage. Si Bob est installé et qu'une clé de Bob est enregistrée, la
  demande arrive donc peu après le démarrage, même sans conversation Bob ouverte. C'est voulu (Bob
  a besoin de sa clé pour lire son quota) ; sans clé, rien.
- Seul un certificat Developer ID (signature stable d'une version à l'autre) supprimerait la
  demande récurrente.

## Journal

- 2026-10-21 — Fiche créée (lot A des irritants). Rien n'est codé.
- 2026-10-21 — **Implémenté** (branche `claude/fiche-100-trousseau-f045d7`).
  - Deux chemins ouvraient le trousseau sans qu'une clé serve : `canStoreKeys` dans la vue des
    réglages (au démarrage et à chaque ouverture des Réglages), et `ApiKeyStore.info()` qui
    déchiffrait chaque clé enregistrée pour savoir si elle était illisible (la liste des clés seule
    ouvrait donc le trousseau dès qu'une clé existait).
  - `ApiKeyStore` : `canStore()` retiré ; `available()` appelé seulement par `set()` ;
    `credentials()` déchiffre à la demande et garde la valeur en mémoire pour le reste du lancement
    (un échec aussi, sans réessayer : pas de demande répétée) ; `info()` ne déchiffre plus,
    « Illisible » est connu après le premier lancement de l'agent qui lit la clé.
  - `SettingsStore.canStoreKeys()` et `AgentSettingsView.canStoreKeys` retirés ; « Définir » /
    « Remplacer » toujours actif, le trousseau vérifié à l'enregistrement (message
    `apiKeys.noKeychain` sous la ligne s'il est indisponible). Clé
    `settings.apiKeys.keychainUnavailable` retirée (fr, en).
  - Arbitrage sécurité / usage : la valeur déchiffrée reste en mémoire du main process jusqu'à la
    fermeture de l'app. Gain pour l'usage : une seule demande par lancement, garantie par l'app et
    pas seulement par le cache de Chromium. Coût en sécurité : quasi nul, car Chromium garde déjà en
    mémoire la clé de chiffrement du trousseau après le premier accès (elle ouvre toutes les
    valeurs), et la clé part de toute façon dans l'environnement de l'agent. Verdict : fait.
  - Vérifié en passant : rien d'autre n'ouvre le trousseau. Le chiffrement des cookies par
    Chromium (fuse `enableCookieEncryption`) n'est pas activé dans `electron-builder.yml`.
  - Tests : `api-keys.test.ts` (aucun appel sans clé ; `available()` + `encrypt()` à la saisie ;
    liste sans appel ; un seul déchiffrement pour trois lancements ; trousseau indisponible : le
    message d'aujourd'hui, rien d'enregistré ; clé illisible connue après la première lecture,
    déchiffrée une fois), `manager.test.ts` (sans clé : vue des réglages, lancement, message,
    relance de l'agent, aucun appel ; avec clé : vue sans appel, un déchiffrement au lancement,
    rien de plus à la relance), `SettingsDialog.test.tsx` (« Définir » actif, erreur du trousseau
    affichée à l'enregistrement). `./scripts/verify` vert.
  - e2e `auth` et `settings` verts, clair et sombre (trousseau factice) ; `settings --lang en`
    vert. Captures regardées : liste des clés inchangée (`f1-reglages-cles`), clé illisible dite
    après le lancement de l'agent (`f1b-cle-illisible`). `auth --lang en` non lancé : la suite
    compare encore des textes en dur (« Définir », « Enregistrée »…), déjà le cas avant cette fiche ;
    aucun texte visible n'a changé (seule l'info-bulle du trousseau indisponible est retirée).
  - Écart au plan : aucun. La vérification se fait à l'enregistrement plutôt qu'au clic sur
    « Définir » : c'est là que la clé est chiffrée, donc là que macOS demande le trousseau ; un
    « Définir » suivi d'« Annuler » ne déclenche aucune demande.
  - Reste à faire par la session qui fusionne : essai réel de l'app installée (sans clé : aucune
    demande au lancement ; avec une clé : une demande au premier agent qui la lit).
  - CHANGELOG proposé (à intégrer à la fusion) :
    - fr : « Sans clé d'API enregistrée, Bobine ne demande plus le mot de passe du trousseau macOS
      au lancement. Avec une clé, il n'est demandé qu'au démarrage de l'agent qui s'en sert, une
      fois par lancement. »
    - en : "Without a saved API key, Bobine no longer asks for your macOS Keychain password at
      launch. With a key, it's only asked for when the agent that uses it starts, once per launch."
- 2026-10-21 — **Essai réel** (session principale, app packagée de l'assemblage du lot A, vrai
  trousseau, dossier de données neuf, environnement du Finder, quota de Bob compris). Aucune boîte
  du trousseau (processus `SecurityAgent`) en 20 s de démarrage, ni en ouvrant Réglages › Agents et
  dossiers (« IBM Bob · Aucune », « Définir » actif). Témoin : la 0.2.0 packagée, lancée de la même
  façon, ouvre la boîte dès le démarrage et reste bloquée dessus. Non essayé : avec une clé
  enregistrée (il faudrait répondre à la boîte avec le mot de passe de l'utilisateur).
