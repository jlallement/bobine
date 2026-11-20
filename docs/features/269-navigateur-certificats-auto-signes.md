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

ADR-0064 (proposé) : exception limitée à la session du panneau (gestionnaire `certificate-error`
qui ignore tout autre `webContents`) ; hôte + port + empreinte SHA-256 exacte ; adresses locales
ou privées seulement (revérifié par le main) ; avertissement dans l'interface de l'app, jamais
dans la page ; « Continuer » n'envoie que le jeton de l'avertissement ; pour la session par défaut,
« Se souvenir de ce certificat » le garde dans `approvals.json` ; les deux genres listés et
révocables dans Réglages › Confidentialité ; l'agent ne peut jamais accepter.

## Limites connues

- « Non sécurisé » suit le cadre principal : il s'allume pour un hôte et port qui ont une
  exception, même si le serveur présentait entre-temps un certificat reconnu (cas rare) ; une
  sous-ressource acceptée dans une page par ailleurs saine ne l'allume pas.
- Une sous-ressource sur un autre hôte ou port (ex. `wss://127.0.0.1:5173` du rechargement à chaud
  quand la page est sur `localhost:5173`) reste refusée : elle aurait besoin de sa propre exception,
  que rien ne propose (pas d'avertissement pour une sous-ressource). Ouvrir la page par la même
  adresse que celle du rechargement à chaud (réglage par défaut de Vite) évite le cas.
- Pas d'avertissement dans une popup de l'utilisateur : son certificat refusé y est refusé en
  silence (exceptions accordées respectées).
- Rien ne prouve dans le main qu'un humain a cliqué : un appel IPC vient du cadre principal d'une
  fenêtre de l'app (vérifié), donc de l'interface ; c'est le même niveau de garantie que le reste
  des accords de l'app.
- `IPv6` privées (`fc00::/7`, `fe80::/10`) non proposées : seule `::1` l'est.
- e2e : le certificat est fait par `openssl` (présent sur macOS ; à vérifier sur l'image Linux de
  `pnpm e2e:linux`, non essayée).

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
