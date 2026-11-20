# 269 — Navigateur intégré : certificats auto-signés des serveurs de développement

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 007, 072, 114, 249 ; ADR-0064
- **Agents** : les deux (rien de propre à un agent : le navigateur intégré est de l'app)

## Pourquoi

Un testeur ne peut pas afficher dans le panneau Navigateur son serveur de développement HTTPS au
certificat auto-signé (Vite `@vitejs/plugin-basic-ssl` ou `server.https`, Webpack
`devServer.https` / `server: 'https'`). Chrome et Edge proposent « Continuer quand même » ; Bobine
n'offre rien, et il n'est pas administrateur du Mac (pas de certificat dans le trousseau).

## Reproduction (2026-11-20)

Build de développement, `pnpm pilote lancer` (profil temporaire, agent factice), projet Vite
`basic-ssl` lancé dans le dossier temporaire de la session (`vite` 8.3.8, plugin 2.3.0,
`https://localhost:5199`). Adresse tapée dans le panneau Navigateur :

- le panneau reste vide, une ligne rouge sous la barre :
  `ERR_CERT_AUTHORITY_INVALID (-202) loading 'https://localhost:5199/'` ;
- côté Electron (essai à part, même serveur) : `app.on('certificate-error')` émis avec
  `net::ERR_CERT_AUTHORITY_INVALID`, `isMainFrame: true`, certificat `CN=example.org` (celui de
  `basic-ssl`), `fingerprint` `sha256/pLYPz5…` ; puis `loadURL` rejette. Le `wss://` du
  rechargement à chaud émet le même évènement (`isMainFrame: false`).

## Cause

Personne n'écoute `certificate-error` : Electron refuse en silence, `loadURL` rejette, et le
panneau n'a pas de page d'erreur, seulement le message brut. Il n'existe aucun moyen, sûr ou non,
de continuer.

## Critères d'acceptation

- [x] Certificat refusé dans le panneau : avertissement dans l'interface (hôte, raison, empreinte
  SHA-256), « Retour », et « Continuer vers <hôte> (non sécurisé) » derrière « Avancé ».
- [x] « Continuer » seulement pour une adresse locale ou privée ; ailleurs, l'avertissement le dit.
- [x] Exception par hôte, port et empreinte exacte ; certificat changé : l'avertissement revient.
- [x] Pour la session par défaut ; « Se souvenir de ce certificat » le garde ; révocable dans
  Réglages › Confidentialité (la page retombe sur l'avertissement).
- [x] « Non sécurisé » dans la barre d'adresse sous une exception.
- [x] L'agent n'accepte jamais : ses outils échouent avec un message clair ; aucun outil, aucune
  page ne peut accorder.
- [x] Rien ne change pour les fenêtres de l'app, le main, les agents, les mises à jour.
- [x] Essais : unitaires (décision, provenance, agent) ; e2e `certificats` avec un serveur HTTPS
  auto-signé lancé par l'essai.

## Plan

Décisions : ADR-0064.

1. `src/main/browser/certificate-exceptions.ts` (sans Electron) : site d'une URL (`https`/`wss`,
   port par défaut 443), hôtes locaux ou privés, empreinte depuis le PEM, raison lisible, décision
   (accepter seulement hôte + port + empreinte connus), note pour l'agent.
2. `src/main/approvals.ts` : `certificates` (session en mémoire, retenus dans `approvals.json`),
   vue pour les Réglages, oubli, écouteur d'oubli.
3. `browser-manager.ts` (+ `certificate-errors.ts` pour tenir le plafond) : gestionnaire
   `certificate-error` limité aux pages du panneau ; problème noté sur l'onglet (jeton aléatoire),
   vue masquée, état `certificate` et `insecure` ; `allowCertificate(conversation, jeton, retenir)`,
   `leaveCertificate`, révocation (connexions fermées, onglets rechargés).
4. IPC `browser:allowCertificate`, `browser:leaveCertificate`, `settings:forgetCertificate` ;
   preload ; lecture seule (fiche 196).
5. Outils de l'agent : `certificateProblem` du pilote ; `browser_navigate` et outils de la page
   échouent sous un avertissement. `CdpTab` refuse toute commande `Security.*`.
6. Interface : `CertificateWarning.tsx` dans `BrowserTab`, puce « Non sécurisé », groupe
   « Certificats acceptés » de `RememberedApprovals` ; i18n fr et en ; styles.
7. Essais : unitaires ; e2e `certificats` (avertissement, Avancé, Continuer, indicateur,
   certificat changé, agent refusé, révocation) avec captures `269-*` clair et sombre.
8. Docs : architecture, CHANGELOG fr et en, guide si le navigateur y est décrit.

Pas de nouvelle dépendance (empreinte par `node:crypto`).

## Décisions

ADR-0064 (proposé, renuméroté : 0063 pris par la fiche 268). En bref :
- exception limitée aux **onglets** du panneau (gestionnaire `certificate-error` qui ignore tout
  autre `webContents`) ; **popups : aucune exception**, un message clair à la place de la page ;
- clé : hôte + port + empreinte SHA-256 exacte + **code d'erreur** ; seules
  `AUTHORITY_INVALID`, `COMMON_NAME_INVALID`, `DATE_INVALID` permettent de continuer ;
- adresses locales ou privées seulement ; un nom en `.test` ou `.local` n'est accepté que si
  **toutes** les adresses que le résolveur de la session donne sont locales ou privées
  (« Vérification de l'adresse… », revérifié au moment d'accorder) ;
- avertissement dans l'interface de l'app, jamais dans la page ; « Continuer » n'envoie que le
  jeton de l'avertissement ; site public : refus dit d'emblée, « Ouvrir dans le navigateur » ;
- pour la session par défaut, « Se souvenir » le garde dans `approvals.json` (désactivé et
  expliqué en profil en lecture seule) ; Réglages : « toujours » / « jusqu'à la fermeture »,
  « (ancien) » ; révocable partout, même en lecture seule ;
- révocation : connexions fermées, cache de l'origine effacé, onglets qui l'ont utilisée
  rechargés (leurs WebSocket se ferment) ;
- « Non sécurisé » seulement pour une exception **vraiment utilisée** dans le document (évènement
  accepté, ou réponse `insecure` dont l'empreinte relue par le CDP est celle d'une exception),
  sous-ressources comprises ; la puce ouvre « Ne plus accepter » ;
- l'agent ne peut jamais accepter ; message sans invitation à insister, adresse tronquée ;
  `CdpTab` refuse `Security.*`, `Target.attachToTarget`, `Target.sendMessageToTarget`.

## Limites connues

- `approvals.json` n'est pas signé : qui peut écrire dans le profil peut y ajouter une exception
  (adresse locale ou privée et erreur permise seulement, vérifiées à la relecture). Accepté par la
  revue sécurité : ce même accès permet déjà d'autoriser sites et commandes.
- Une sous-ressource sur un autre hôte ou port (ex. `wss://127.0.0.1:5173` quand la page est sur
  `localhost:5173`) reste refusée : elle aurait besoin de sa propre exception, que rien ne propose
  (pas d'avertissement pour une sous-ressource).
- Popups : une sous-ressource d'un site sous exception chargée dans une popup (et non sa page
  principale) passerait par une connexion déjà acceptée ; seule la page principale est bloquée.
- Rien ne prouve dans le main qu'un humain a cliqué : un appel IPC vient du cadre principal d'une
  fenêtre de l'app (vérifié), donc de l'interface.
- La vérification d'adresse d'un `.test`/`.local` se fait par le résolveur de la session au moment
  de l'avertissement et de l'accord ; un changement DNS ensuite n'ouvre rien de plus (l'empreinte
  reste exigée).
- `clearData({ origins, dataTypes: ['cache'] })` n'est pas vérifié par un essai (seuls la
  fermeture des WebSocket et le rechargement le sont).
- e2e : certificats faits par `openssl` (macOS ; image Linux de `pnpm e2e:linux` non essayée).

## Journal

- 2026-11-20 : reproduction (pilote, Vite `basic-ssl`), cause, ADR-0064 (proposé), plan.
- 2026-11-20 : essai Electron 45 : `certificate-error` donne l'URL avec le port, le PEM ; aucune
  décision retenue par Electron (revient après `closeAllConnections`), d'où la fermeture des
  connexions à la révocation.
- 2026-11-20 : fait. `certificate-exceptions.ts` (décision, hôtes privés, empreinte, note pour
  l'agent, `Security.*` refusé à `CdpTab`), `ApprovalStore.certificates`, `BrowserManager`
  (gestionnaire, `allowCertificate`, `leaveCertificate`, `certificateRevoked`), canaux « invoke »
  du navigateur sortis dans `shared/browser-ipc.ts` (plafond de `ipc.ts`), `CertificateWarning`,
  puce « Non sécurisé », groupe « Certificats acceptés » des Réglages (empreinte courte en côté :
  deux certificats du même hôte se distinguent), scénario factice `certificat`, suite e2e
  `certificats` (rouge sur `main` avant le correctif : 2 échecs, l'agent lisait la page d'erreur
  vide ; verte après). Écart au plan : « Retour » revient à la dernière page d'un autre hôte et
  port (revenir sur le même ramènerait l'avertissement).
- 2026-11-20 : ADR renuméroté 0064, rebase sur `main` (index et CHANGELOG : les deux côtés).
- 2026-11-20 : revue sécurité appliquée (chaque point a son essai, qui échouait avant) : indicateur
  sur toute ressource utilisée (`usedCertificates`, réponses `insecure` + `Network.getCertificate`),
  popups sans exception (message), révocation complète (cache, onglets ayant utilisé l'exception,
  WebSocket fermées : e2e), lecture seule (`canRemember`, `settings:forgetCertificate` permis),
  adresse réelle des `.test`/`.local` (`session.resolveHost`), code d'erreur dans la clé et liste
  fermée d'erreurs, CDP `Target.*` refusé, message à l'agent. Logique Electron sortie dans
  `certificate-guard.ts` (plafond de `browser-manager.ts`).
- 2026-11-20 : revue UX appliquée : site public (refus dans le corps, « Détails », « Ouvrir dans le
  navigateur », raison courte), puce réduite à l'icône sous 420 px de champ et adresse sans
  `https://` sous exception (hôte et port visibles), « Continuer » en lien discret, empreinte et
  code coupés aux bons endroits, `dl` sur une colonne sous 480 px, Réglages (« toujours » /
  « jusqu'à la fermeture », empreinte en infobulle, tri, « (ancien) »), `allowedHint`, textes
  (« recognized », `reason.name`, `rememberHint`, `lead` avec le port, une seule bascule
  « Avancé » avec chevron et `aria-expanded`), ordre de la partie avancée, puce cliquable (« Ne
  plus accepter »), « Revenir en lieu sûr » (page vide sans page précédente). `rememberHint` :
  les « textes proposés » ne m'étaient pas parvenus, texte écrit par moi, à valider.
