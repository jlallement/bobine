# ADR-0077 — Connexion OAuth d'un serveur MCP distant : faite par l'agent, Bobine ouvre la page

- **Statut** : proposé (Jérôme ne l'a pas encore validé)
- **Date** : 2026-11-27
- **Fiches** : [293](../features/293-figma-en-un-clic.md), [025](../features/025-serveurs-mcp.md),
  [060](../features/060-mcp-tester.md)

## Contexte

Le serveur MCP distant de Figma (`https://mcp.figma.com/mcp`) exige une connexion OAuth (401 sans
jeton, relevé). Figma n'accepte que les applications de sa liste publique : OpenCode y est, IBM Bob
et Bobine n'y sont pas. Dans un terminal, il faut aujourd'hui trois commandes, un navigateur qui ne
s'ouvre pas tout seul hors terminal et une attente sans retour. OpenCode 2.3.0 sait faire la
connexion (`opencode mcp auth <nom>`, `--standalone`), garde le jeton, écrit l'adresse de la page
de connexion dans sa sortie et dit l'état par `opencode auth list --format json` (relevés R4, R5,
R6 de la fiche 293).

## Décision

1. **La connexion est faite par l'agent.** Bobine lance la commande que le profil de l'agent
   déclare (`mcpOAuth`, ADR-0015), dans le dossier et l'environnement de lancement de l'agent,
   `--standalone` toujours ; elle lit l'adresse de la page de connexion dans la sortie.
2. **Bobine n'ouvre la page qu'après vérification** : ASCII imprimable, longueur bornée,
   `new URL` réussi, `https:`, hôte et chemin **exactement** ceux du préréglage (Figma :
   `www.figma.com`, `/oauth/mcp`), écrits tels quels (ni encodage, ni `..`), sans identifiants ni
   port autre que celui par défaut ; ni `request` ni `request_uri` ni `;` ; un `redirect_uri`
   unique, sous ce nom exact, exigé si le préréglage le dit (Figma : oui), pointant vers cette
   machine (`http`, hôte écrit `127.0.0.1` ou `localhost`, port en chiffres, ni `\` ni `@`). Jamais une adresse lue après
   la fin du processus ni une dernière ligne sans retour à la ligne. Sinon rien n'est ouvert et la
   tentative est arrêtée. Ouverture par `shell.openExternal`, depuis le main seulement.
3. **Le jeton reste chez l'agent.** Bobine ne lit jamais sa base, ne lance jamais d'export, ne
   garde ni ne journalise l'adresse complète (`state`, `code_challenge`, `client_id`) : seul l'hôte
   sort du moteur (journal, IPC, messages) ; aucune ligne de sortie de la commande n'est
   journalisée, seulement ce qui a été reconnu.
4. **La fin se juge à la sortie et à l'état relu chez l'agent**, jamais au code de sortie
   (l'expiration rend 0). Une seule connexion à la fois dans l'app ; chaque opération porte un
   numéro et une fin périmée n'émet rien ; « Annuler », le délai et la fermeture de l'app arrêtent
   l'arbre de processus (`killTree`).
5. **Préréglages en données** (`shared/mcp-presets.ts`) : adresse du serveur, hôte et chemin
   attendus de la page. Aucun `if figma` dans le code ; le moteur (`agent-config/mcp-oauth.ts`) ne connaît ni
   l'agent ni le serveur.

## Alternatives écartées

- **Bobine cliente OAuth** (inscription DCR, PKCE, jeton gardé par Bobine) : refusée par Figma, qui
  n'accepte que les applications de sa liste ; emprunter le nom d'une application listée serait une
  usurpation, interdite. Et Bobine garderait un jeton qu'elle ne doit pas voir.
- **Terminal seul** (copier `opencode mcp auth figma`) : c'est le parcours qui fait abandonner
  (accroc 1 de la fiche). Gardé seulement en repli (« Dans un terminal »).
- **Hôte de la page déduit des métadonnées OAuth du serveur** (RFC 9728 puis RFC 8414), pour tout
  serveur distant : faisable, mais la vérification d'hôte est la seule défense contre une adresse
  inattendue ; la généraliser demande un second serveur relevé en réel. Fiche suivante.

## Conséquences

- Un agent sans la capacité (IBM Bob, agents déclarés par l'utilisateur) ne propose rien et ne lance
  rien ; rien n'est supposé de ce que Bob saurait faire.
- La sortie de l'agent devient un contrat : relevée en octets (fixtures), rejouée par les essais ;
  une fin non reconnue donne une erreur générique, jamais un état deviné. Le refus sur la page
  (R2), l'état expiré dans `auth list` (R1) et les autres versions (R8) restent à relever.
- Chaque nouveau préréglage déclare son hôte de page ; un serveur quelconque ne peut pas être
  connecté par ce chemin tant que la fiche des métadonnées n'existe pas.
- **Essais de bout en bout (lot 2)** : une fausse commande remplace celle de l'agent, imposée par
  `BOBINE_FAKE_MCP_AUTH` (script Node lancé par l'exécutable de l'app, `ELECTRON_RUN_AS_NODE=1` ;
  vide : agent absent) et `BOBINE_FAKE_MCP_AUTH_MS` (délai raccourci). Surface nouvelle, **gardée** :
  sans effet dans l'app installée (`app.isPackaged`, `mcp-oauth-forced.ts`, essai unitaire), au
  contraire de `BOBINE_GH`. La page est notée par `BOBINE_OPEN_LOG` au lieu d'être ouverte.
