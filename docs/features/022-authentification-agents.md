# 022 — Authentification par agent : SSO, clé d'API ou les deux

- **Statut** : fait
- **Dépend de** : 011

## Pourquoi

Chaque agent a sa méthode : SSO (Bob), connexion locale (Codex, Claude Code, OpenCode), clé d'API
(`BOB_API_KEY`, `ANTHROPIC_API_KEY`…). ACP ne prévoit pas de méthode « clé » : le profil doit déclarer
les clés qu'il accepte.

## Critères d'acceptation

- [x] Le profil déclare ses variables de clé (Bob : `BOB_API_KEY`, l'ancien `BOBSHELL_API_KEY`
      retiré au lancement) ; le panneau « Connexion requise » propose SSO **ou** clé d'API.
- [x] Réglages → Agents : clé d'API par agent (définie / fournie par l'environnement / absente),
      définir, remplacer, supprimer.
- [x] Clés chiffrées (`safeStorage`, trousseau macOS), jamais renvoyées au renderer, injectées au
      lancement de l'agent ; l'agent est relancé quand la clé est saisie depuis le panneau.
- [x] Méthodes de connexion qui se font dans un terminal (OpenCode : `opencode-login`, dont
      `authenticate` ne fait rien) : la commande du profil (`opencode auth login`) est lancée dans le
      terminal de l'app, puis « Réessayer » relance l'agent.
- [x] Licence IBM manquante (`-32600` « license agreement is required ») : panneau dédié, avec
      `bob --show-license` dans le terminal de l'app ; jamais acceptée à la place de l'utilisateur.
- [x] Testé : agent factice ; e2e (trousseau simulé, jamais le vrai) ; Bob réel avec une clé factice
      (la vraie clé est saisie par l'utilisateur).

## Notes

- Claude Code n'est plus une cible (2026-10-11) : la case « Claude Code réel » est abandonnée.
- Claude Code (adaptateur 0.89.1) n'annonce **aucune** méthode de connexion si le client n'a pas
  `auth.terminal` ; sans connexion en ligne de commande (`claude auth login`), tout message échoue en
  `-32000` « Authentication required ». La connexion de l'app Claude Desktop n'est pas partagée.
- Voir la carte de session proposée le 2026-10-11 et `docs/acp.md` (Bob : clé API).

## Plan

Relevé dans Bob 2.0.6 (2026-10-13) : une seule méthode ACP (`sso`), pas de `terminal`, pas de
`logout`. La clé se génère depuis le compte Bob et se lit dans `BOB_API_KEY` (ou `BOBSHELL_API_KEY`,
erreur si les deux diffèrent). Avec une clé, plus d'étape SSO. Une clé « générale » exige un
identifiant d'équipe (`--team-id`), que `bob acp` n'accepte pas : il faut une clé personnelle
(sinon « Team user not found », affiché tel quel). OpenCode 1.19 : `opencode-login` sans `type`
(même avec `auth.terminal`), `authenticate` répond `{}` sans rien faire. La capacité `auth.terminal`
n'est donc pas annoncée (aucune cible ne s'en sert).

- `AgentProfile` : `apiKeys` (`env`, libellé, `aliases` retirés au lancement, aide),
  `terminalSteps` (commandes proposées dans le terminal : connexion, licence), `license` (motif du
  refus de licence + étape « lire la licence »).
- `src/main/agent-config/api-keys.ts` — `ApiKeyStore` : fichier `api-keys.json` (0600) dans les
  données de l'app, valeurs chiffrées par un `Cipher` (`safeStorage` ; faux chiffrement dans les
  tests). `credentials(profile)` → variables à poser et à retirer.
- `AgentHost` : option `credentials()` lue à chaque lancement ; `restart()` ; blocage `license` ;
  `auth` enrichi (`apiKey`, méthodes « terminal ») ; « Réessayer » relance l'agent pour `auth` et
  `license`.
- Manager / IPC : `agent:useApiKey(id, env, value)` (enregistre + relance), `agent:runStep(id, step)`
  (commande du profil dans un onglet du terminal de l'app), `settings:setApiKey` /
  `settings:removeApiKey` ; la vue des réglages ne donne que « définie / environnement / absente ».
- Renderer : `BlockerPanel` (clé d'API, étapes terminal, licence) ; Réglages → Agents, « Connexion ».
- Agent factice : `requireAuth` levé par `MOCK_AGENT_API_KEY` ; scénario `bob-licence-requise`
  (levé par un fichier `.mock-agent-license` dans le dossier) ; étapes terminal factices.
- e2e : `--use-mock-keychain` pour toutes les suites (jamais le trousseau de l'utilisateur).

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-13 — **Implémenté.** Relevés réels (gratuits, sans message envoyé) : Bob 2.0.6 n'a que
  `sso`, ni `terminal` ni `logout` ; OpenCode 1.19 annonce `opencode-login` sans `type`, même avec
  `auth.terminal`, et son `authenticate` répond `{}` sans rien faire. L'utilisateur génère sa clé
  depuis son compte Bob.
  - `ApiKeyStore` (`api-keys.json` en 0600 dans les données de l'app, valeurs chiffrées par
    `safeStorage`) ; `credentials()` posée à chaque lancement (`withEnvChanges`), alias retirés.
  - Profils : `apiKeys` (Bob : `BOB_API_KEY`, alias `BOBSHELL_API_KEY`), `terminalSteps` (Bob :
    `bob --show-license` ; OpenCode : `opencode auth login`), `license` (motif du message).
  - `AgentHost` : blocage `license` ; `auth` avec `apiKey` et méthodes « terminal » (`step`, jamais
    passées à `authenticate`) ; « Réessayer » relance l'agent pour `auth` et `license`.
  - IPC `agent:useApiKey` (enregistre puis relance), `agent:runStep` (le renderer désigne une étape,
    jamais une commande ; lancée dans un onglet du terminal de l'app, panneau ouvert),
    `settings:setApiKey` / `settings:removeApiKey`. Le journal IPC n'enregistre jamais les arguments.
  - UI : « Connexion requise » propose SSO **ou** « Utiliser une clé d'API » (champ masqué) ;
    panneau « Licence à accepter » ; Réglages → Agents → « Clés d'API » (Enregistrée / Fournie par
    l'environnement / Aucune ; Définir, Remplacer, Supprimer).
  - Agent factice : `MOCK_AGENT_API_KEY`, scénarios `bob-licence-requise` et `connexion-terminal`.
  - Tests : `api-keys.test.ts` (chiffré sur disque, 0600, jamais de valeur dans `info`, alias,
    clé illisible ignorée), `agent-host.test.ts` (clé → plus de connexion, alias retiré, connexion
    en terminal, licence). e2e `auth` avec `--use-mock-keychain` (ajouté à toutes les suites : aucune
    entrée créée dans le trousseau de l'utilisateur, vérifié).
  - **Bob réel** (clé factice, 0 bobcoin) : `session/new` ouvert sans SSO, la clé n'étant vérifiée
    qu'au premier message (une clé fausse donne donc une erreur à l'envoi, affichée avec son
    détail) ; `BOB_API_KEY` et `BOBSHELL_API_KEY` différents → Bob refuse de démarrer, d'où le
    retrait de l'alias. La vraie clé reste à saisir par l'utilisateur.
  - Écart : capacité `auth.terminal` non annoncée (aucune cible ne s'en sert) ; dans la vue côte à
    côte, l'étape se lance dans le terminal de cette conversation sans ouvrir le panneau.
