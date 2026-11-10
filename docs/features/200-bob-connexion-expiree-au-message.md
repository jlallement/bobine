# 200 — Bob : connexion expirée au message reconnue

- **Statut** : fait
- **Dépend de** : 022 (connexion), 048 (sonde de Bob), 139 (traces, grille), 188 (premier lancement), recette 0.9 D10 (connexion expirée au tour)
- **Agents** : Bob (son refus a un code et un message à lui, déclarés dans son profil, ADR-0011) ; rien ne change pour OpenCode ni pour un agent déclaré

## Pourquoi

Signalé sur la 0.11.0 avec un vrai Bob 2.0.9 connecté par SSO (sans `BOB_API_KEY`) : essai du
premier lancement à 15 h 17 (« prêt »), puis premier message de la conversation à 16 h 37 → le fil
ne montre qu'une erreur rouge « Erreur : Request Failed — Invalid or expired API key. ». Ni carte
« Connexion expirée », ni moyen de se reconnecter : l'utilisateur ne sait pas quoi faire.

Cause : la carte au tour (D10) n'est montrée que pour un `authRequired` (`-32000`) dont le message
porte l'indice du profil. Le profil Bob supposait « Authentication required » (« hypothèse à
vérifier », vu seulement à `session/new`). Le vrai Bob répond **autrement** : `-32603` « Internal
error », cause dans `data.details`.

## Contrat relevé (Bob 2.0.9, 7 novembre 2026)

- Sonde `pnpm bob-probe`, nouveau sondage « refus au tour : clé refusée (licence acceptée sur ce
  Mac) » : HOME jetable, clé factice, seule la mention `licenseConsent` reprise des réglages réels
  de Bob (l'acceptation déjà donnée par l'utilisateur ; sans elle, sondage sauté). `session/new`
  s'ouvre ; `session/prompt` → `{"code":-32603,"message":"Internal error","data":{"details":"ApiKeyError: {\"id\":\"harness\",\"title\":\"Request Failed\",\"description\":\"Invalid or expired API key.\"}"}}`,
  identique au message suivant. Aucun appel au modèle n'aboutit (401) : 0 bobcoin. Trace :
  `src/main/agent/__traces__/bob-2.0.9/refus-au-tour-cle-refusee-licence-acceptee-sur-ce-mac.ndjson`.
- Même réponse pour le SSO expiré : dans Bob, tout 401 de sa passerelle devient cette erreur
  (`handleHttpError`). Journal de Bob du 07/11 (session de l'utilisateur) : « Token refresh failed
  … Refresh token expired or invalid », puis « Logged out » — c'est bien la connexion SSO.
- Une fois Bob déconnecté : `session/new` (vrai `~/.bob`, dossier jetable, aucun message) →
  `-32000` « Authentication required » ; c'est aussi ce que rencontre la réouverture de la session
  — déjà la carte de session. `authenticate` `sso` devrait lancer la connexion dans le navigateur
  (non déclenché, non vérifié).

## Critères d'acceptation

- [x] Le refus exact de Bob au message donne la carte « Connexion expirée » (méthode SSO, clé
      d'API), pas l'erreur brute ; reconnecté, le message est renvoyé une fois dans la même session.
- [x] Un autre `-32603` (panne, « Authentication required » relayé d'un serveur MCP) ou ce message
      sous un autre code reste une erreur de tour ordinaire ; rien ne change chez OpenCode.
- [x] L'essai du premier lancement reconnaît ce refus (carte au tour).
- [x] Testé contre l'agent factice (scénarios `connexion-expiree-bob`, `connexion-expiree-bob-tour`),
      grille de conformité (parcours « connexion expirée au message », les trois personas), e2e
      `connexion-expiree`.
- [ ] Essai réel de la reconnexion SSO depuis la carte (à faire par l'utilisateur : la sonde ne
      lance jamais le navigateur).

## Plan

- `bob-contract.ts` : `INTERNAL_ERROR` (`-32603`) et `EXPIRED_LOGIN_MESSAGE` (« invalid or expired
  api key »).
- `profiles.ts` : `authAtTurn.otherCodes` (générique : code **et** motif ensemble) ; profil Bob :
  `-32603` + ce motif, `authRequired` + « Authentication required » gardé, `apiKey: true` ; agent
  factice : même `otherCodes` (clé d'API toujours pas proposée au tour, comme OpenCode).
- `turn-auth.ts` : `turnAuthBlocker(error, blockerOf, profile)` ; un autre code déclaré est lu
  comme un `authRequired` (mêmes méthodes, même clé). Appelants : `agent-host.ts`,
  `onboarding/agent-readiness.ts`.
- Agent factice : étape `login-required` avec `error`, `BOB_EXPIRED_LOGIN`, scénarios, option
  `--sso` (méthode SSO annoncée quel que soit le scénario de départ, persona « Façon Bob »).
- Sonde : sondage « refus au tour », `data` relevé, vérification de contrat (« ? » si sauté).
- Aucune nouvelle dépendance, aucun texte d'interface nouveau (carte, avis et statut existants).

## Journal

- 2026-11-07 — Contrat relevé (ci-dessus), trace enregistrée (`--traces`, gardées : refus au tour
  et `session/new` sans connexion), attentes de la sonde mises à jour (`--accept`). Cause
  confirmée et corrigée : ce n'était pas seulement le motif, le **code** n'était pas `-32000`
  (`session-blocker` n'est pas touché : à l'ouverture, seul `authRequired` reste une connexion).
- Clé d'API proposée au tour pour Bob : Bob prend `BOB_API_KEY` avant le SSO, et son message
  (« Invalid or expired API key ») vise aussi une clé refusée ; sans elle, un utilisateur à clé
  révoquée n'aurait que le SSO, qui ne servirait à rien tant que la clé est posée.
- Écart : le scénario lancé (`connexion-expiree-bob`) a une `session` et ne se choisit pas par
  `/scenario` ; `connexion-expiree-bob-tour` (mêmes étapes) sert à la grille, avec `--sso`.
- La carte dit « Connexion expirée » aussi pour une clé refusée : texte inchangé (pas de nouvelle
  maquette), le message de Bob ne distingue pas les deux cas.
- Reste : essai réel de la reconnexion SSO par l'utilisateur.
