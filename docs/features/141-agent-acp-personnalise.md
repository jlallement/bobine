# 141 — Agent ACP personnalisé

- **Statut** : fait (essai à la vraie souris à la fin des vagues)
- **Dépend de** : 054 (ce que l'app sait faire avec un agent), 136 (Réglages › Agents et page d'un
  agent), 139 (grille de conformité, défaut 3), 140 (indépendance aux agents, cahier des charges),
  108 (continuer avec un autre agent, ADR-0024), 022 (clés d'API dans le trousseau)
- **Agents** : tout agent ACP déclaré par l'utilisateur. Rien ne change pour Bob ni pour OpenCode,
  sauf la reprise d'une session perdue (même règle pour tous, ADR-0030).
- **Feuille de route** : vague 5 de `docs/feuille-de-route-2026-10-23.md` (§ 0), lot 141.

## Pourquoi

Bobine ne pilote que les agents dont le profil est écrit dans le code. Jérôme veut pouvoir brancher
n'importe quel agent ACP (un agent maison, un nouvel outil) en déclarant sa commande, ses arguments
et ses variables d'environnement, sans toucher au code : c'est la meilleure assurance contre la
dépendance à Bob et à OpenCode. Le même profil sert de persona « ACP minimal » dans la grille de la
139, pour que l'app soit testée contre ce qu'un tel agent donne vraiment.

Aujourd'hui, un agent qui ne sait ni `session/load` ni `session/resume` passe en lecture seule après
une panne ou un redémarrage (défaut 3 de la 139) : pour un agent déclaré minimal, chaque redémarrage
de l'app figerait toutes ses conversations. Il faut le traiter en même temps.

## Critères d'acceptation

- [x] Réglages › Agents : « Ajouter un agent ACP… » ouvre un formulaire (nom, commande avec ses
      arguments, variables d'environnement, variable de la clé d'API, commande de compaction). Après
      « Ajouter », l'agent est dans la liste, dans le menu des agents du compositeur, et sa page
      s'ouvre.
- [x] Sa page dit qu'il est déclaré dans Bobine, avec « Modifier » et « Supprimer » ; « Propre à
      <agent> » est vide tant qu'on ne déclare ni clé ni commande de compaction. Un agent déclaré
      dont la commande est introuvable reste dans la liste (pour le corriger), marqué introuvable.
- [x] Le profil est bâti côté main à partir du réglage (`customAgents` de `settings.json`) : champs
      de données seulement, jamais de format ni de source. Identifiant `custom-…` : jamais `mock*`,
      jamais celui d'un profil existant, stable quand on renomme.
- [x] Clé d'API : la valeur ne va jamais dans `settings.json` ; elle se saisit sur la page de l'agent
      (rangée « Connexion » existante, chiffrée par le trousseau) et part dans la variable déclarée.
- [x] Supprimer un agent déclaré : ses conversations restent consultables en lecture seule
      (« agent retiré », comportement existant).
- [x] Défaut 3 de la 139 : un agent sans `loadSession` ni `session/resume` rouvre une **session
      neuve dans la même conversation** après une panne ou un redémarrage ; un repère « Nouvelle
      session » est posé dans le fil, et l'échange d'avant part en texte avec le prochain message
      (ADR-0030). Même chose quand un agent qui sait reprendre a perdu sa session.
- [x] Grille de la 139 : la persona « ACP minimal » passe par le vrai profil personnalisé ; ses cases
      « panne » et « reprise » attendent une conversation qui continue, avec l'échange reçu.
- [x] Aucun code propre à un agent dans l'UI ; textes en i18n (fr, en) ; ESLint inchangé.
- [x] Testé : unitaires (réglage, profil, ligne de commande, reprise), grille, agent factice ; e2e
      nouvelle suite `custom-agent` (déclarer, converser, redémarrer, modifier, supprimer) en clair
      et en sombre, captures regardées.
- [x] `docs/agents.md` (matrice, « Brancher un autre agent ACP »), `docs/architecture.md`,
      `docs/acp.md` (compatibilité, reprise), index, CHANGELOG fr/en.

## Défaut 3 : rouvrir un agent qui ne sait pas reprendre (choix structurant)

**Aujourd'hui.** À la réouverture d'une conversation (redémarrage de l'app, « Relancer » après une
panne), l'hôte demande `session/load`, sinon `session/resume`. Un agent qui n'annonce ni l'un ni
l'autre est abandonné : la conversation passe en lecture seule (« Continuer dans une nouvelle
conversation », fiche 015). Quand l'agent sait reprendre mais a perdu la session (plantage avant
qu'il ne l'enregistre), « Relancer » ouvre une session neuve **sans rien lui dire** de l'échange
d'avant (`recoverLostSession`) : il répond comme à un inconnu.

**Proposition.** Une seule règle : quand une conversation continue dans une session neuve du
**même** agent (il ne sait pas reprendre, ou il a perdu la session), c'est une bascule vers
lui-même. La conversation garde son fil (ADR-0021) ; un repère « Nouvelle session » est posé dans
le fil ; l'échange d'avant part en texte avec le prochain message de l'utilisateur, exactement comme
après « Continuer avec un autre agent » (fiche 108, ADR-0024) : même calcul d'après le fil, même
borne de 60 000 caractères, même remise à zéro de la consommation, même réconciliation du rejeu.

**Options.**

| Option | Pour | Contre |
|---|---|---|
| A. Garder la lecture seule (aujourd'hui) | Rien à faire ; l'utilisateur sait que l'agent a tout oublié | Un agent déclaré minimal est inutilisable d'un lancement à l'autre ; « Continuer dans une nouvelle conversation » disperse le travail sur deux lignes |
| B. Session neuve, échange en texte au prochain message, repère dans le fil (**recommandé**) | Même mécanisme que la bascule d'agent, déjà éprouvé et testé ; rien n'est retenu à part (le fil suffit) ; aucun tour payé pour rien ; marche pour tout agent ACP | L'agent ne retrouve qu'un résumé des outils (titre, statut, fichiers), pas leurs résultats : il relit les fichiers s'il en a besoin |
| C. Session neuve et envoi immédiat de l'échange (un tour « voici le contexte ») | L'agent est « au courant » avant la question | Coûte un tour (des bobcoins chez Bob) sans rien demander, au simple affichage d'une conversation ; déjà écarté par l'ADR-0024 |
| D. Session neuve sans contexte (ce que fait `recoverLostSession`) | Le plus simple | L'agent a tout oublié sans que l'utilisateur le sache : réponses hors sujet |

**Recommandation : B**, décidée dans l'[ADR-0030](../adr/0030-session-neuve-du-meme-agent.md). Le repère
est posé à l'ouverture de la session neuve (l'utilisateur voit tout de suite pourquoi) ; s'il est
déjà le dernier repère et qu'aucun message ne le suit (deux redémarrages sans écrire), il n'est pas
répété.

## Interface : où déclarer l'agent (décision UX)

Maquette sur l'app buildée : `e2e/maquettes/screens-agent-acp.mjs` (écrans `agent-acp-1-liste`,
`agent-acp-2-formulaire`, `agent-acp-3-erreur`, `agent-acp-4-page`, `node e2e/maquettes/run.mjs
light agent-acp`), captures regardées en clair et en sombre.

- **Dans la liste de Réglages › Agents, une dernière ligne « Ajouter un agent ACP… »** (icône +,
  même hauteur et même carte que les agents) : c'est là qu'on cherche un agent, et c'est le geste de
  Claude Desktop pour ajouter un connecteur. Pas de bouton dans l'en-tête (rien d'autre n'y est),
  pas d'onglet à part (un agent déclaré est un agent comme les autres, avec la même page).
- **Le formulaire est une page**, au même niveau que la page d'un agent (fil d'Ariane « ‹ Agents »),
  pas une fenêtre par-dessus les réglages : on peut avoir à copier un chemin ou une variable
  ailleurs, et la page d'agent a déjà ce modèle de navigation.
- **Un seul champ « Commande »** avec ses arguments, comme on la taperait dans un terminal
  (guillemets pour un chemin à espaces) : c'est la forme sous laquelle la documentation d'un agent
  la donne (`npx @acme/agent --acp`). Enregistrée en commande + arguments (le profil), montrée
  pareille partout (`displayedCommand`).
- **Variables d'environnement** : une zone de texte, une ligne `NOM=valeur` par variable (format
  d'un fichier `.env`, qu'on peut coller), police à chasse fixe. L'aide dit de ne pas y mettre de
  secret.
- **Clé d'API** : seulement le **nom** de la variable (facultatif). La valeur se saisit ensuite sur
  la page de l'agent, dans la rangée « Connexion » qui existe déjà (trousseau). Ainsi aucun secret
  n'est écrit en clair dans `settings.json`, sans demander à l'utilisateur de choisir.
- **Commande de compaction** : facultative, sous la clé, avec l'aide « seulement si l'agent ne
  l'annonce pas ». Les autres champs de données du cahier des charges ne sont pas proposés :
  `installHint` (l'utilisateur a lui-même écrit la commande ; l'app dit « commande introuvable »),
  `testedVersions` (aucune sonde pour un agent inconnu), `defaultControls` (les identifiants des
  réglages ne sont connus qu'après `initialize`, et l'app retient déjà le dernier choix par agent).
- **Validation en direct, sous le champ** (nom vide, commande vide, ligne de variable mal formée) ;
  « Ajouter » reste grisé tant qu'il y a une erreur. Pas de vérification de l'exécutable au moment
  de la saisie : la page de l'agent dit ensuite s'il est introuvable, comme pour Bob et OpenCode.
- **Page de l'agent déclaré** : la page habituelle (en-tête, connexion, ce qu'il annonce, propre à).
  « Modifier… » se met dans l'en-tête, à côté de « Relancer » : la commande y est déjà écrite, on ne
  la répète pas dans une carte de plus (une information à un seul endroit). En bas, une carte
  « Déclaré dans Bobine » porte une seule ligne « Supprimer cet agent » (bouton neutre, confirmation
  rouge dans la ligne, comme ailleurs dans les réglages ; un bouton rouge plein, essayé dans la
  maquette, criait plus fort que tout le reste de la page). Les changements valent au prochain
  démarrage de l'agent (« Relancer » est à côté).
- Agent déclaré introuvable : dans la liste avec un point rouge et « Commande introuvable » ; sa page
  s'ouvre quand même (en-tête et « Modifier… »), pour qu'on puisse le corriger.
- Pas de double indentation ; aucun texte en dur ; rien ne dépend de l'agent.

## Plan

Aucune dépendance nouvelle.

1. **Réglage et profil** (main, `shared`)
   - `src/shared/custom-agents.ts` : type `CustomAgent` (`id`, `label`, `command`, `args`, `env`,
     `apiKeyEnv?`, `compactCommand?`), `parseCustomAgents`, `customAgentProblems` (erreurs par
     champ, partagées par le formulaire et le main), `splitCommandLine` / `joinCommandLine`,
     `parseEnvLines` / `formatEnvLines`, `newCustomAgentId` (`custom-<nom>`, suffixe si pris).
   - `src/main/agent/custom-profiles.ts` : `customProfile(agent)` (données seulement ; clé d'API
     comme `apiKeys`), `applyCustomProfiles(list, agents)` (remplace les profils déclarés dans la
     liste partagée de l'app, après les vrais agents, avant les agents factices).
   - `settings.ts` (`customAgents`), `settings-store.ts` (`saveCustomAgent`, `removeCustomAgent`, la
     liste des profils tenue à jour), `ProfileSummary.custom` (la déclaration, pour la modifier),
     IPC `settings:saveCustomAgent` / `settings:removeCustomAgent` (`shared/ipc.ts`, preload,
     `main/ipc.ts`).
2. **Défaut 3** (ADR-0030)
   - `Handover.reason?: 'no-resume' | 'session-lost'` : bascule vers le même agent.
   - `agent-host.ts` : sans `load` ni `resume`, `session/new` puis repère ; `recoverLostSession`
     pose le même repère (sorti dans un module si le plafond l'exige).
   - `shared/handover.ts` : texte joint adapté (« an earlier session of yours… »),
     `APP_CONTEXT_OPENINGS.renewal` ; réducteur : pas de second repère s'il est déjà le dernier et
     sans message après.
   - Renderer : `HandoverDivider` dit « Nouvelle session avec <agent> » et pourquoi.
   - Grille : persona minimale sur `customProfile` ; cases « panne » et « reprise » attendent la
     suite de la conversation et l'échange reçu (`contexte-recu`).
3. **Interface** (après la maquette)
   - `AgentsSettings.tsx` : agents déclarés toujours listés (introuvables compris), ligne « Ajouter
     un agent ACP… ».
   - `CustomAgentForm.tsx` (nouveau) : formulaire d'ajout et de modification.
   - `AgentPage.tsx` : carte « Déclaré dans Bobine » ; page ouverte aussi pour un agent déclaré
     introuvable ; `SettingsDialog.tsx` / `SettingsBody.tsx` : navigation (liste, page, formulaire).
   - i18n fr/en (glossaire de `docs/traduction.md`), styles.
4. **Essais** : unitaires (`custom-agents.test.ts`, `custom-profiles.test.ts`, `settings-store`,
   `agent-host` pour la reprise, `transcript` pour le repère), grille, e2e `custom-agent`.
5. **Docs** : `docs/agents.md`, `docs/architecture.md`, `docs/acp.md`, `docs/mock-agent.md` si
   besoin, ADR-0030, index, CHANGELOG fr/en.

Plafonds : `agent-host.ts` 1020/1050, `manager.ts` 1047/1050, `index.ts` 848/850 — rien n'est
ajouté à `manager.ts` ni à `index.ts` (la liste des profils est tenue à jour par le magasin des
réglages, qui la reçoit déjà).

## À vérifier à la vraie souris (fin des vagues)

Rien n'a été essayé à la vraie souris (reporté à la fin des vagues). À faire, en clair et en sombre :

1. Réglages › Agents : survol et clic de « Ajouter un agent ACP… » (icône + alignée sur les
   avatars, couleur d'accent) ; clavier : Tab jusqu'à la ligne, Entrée l'ouvre.
2. Formulaire : focus d'entrée sur « Nom » ; taper une commande avec un chemin entre guillemets ;
   coller un bloc `.env` dans les variables ; une ligne mal formée : erreur rouge au moment de
   quitter le champ, bordure rouge, « Ajouter » grisé ; Échap (referme-t-il les réglages ou rien ?
   attendu : comme ailleurs, il ferme les réglages) ; « ‹ Agents » revient à la liste sans rien
   enregistrer.
3. Ajouter un vrai agent ACP installé (par exemple `opencode acp` déclaré à la main, ou un agent
   maison) : sa page s'ouvre, « Ce qu'il annonce » se remplit après une première conversation, il
   est dans le menu des agents du compositeur, il répond.
4. Clé d'API : déclarer une variable, « Définir » sur sa page (trousseau de macOS : une demande au
   plus), vérifier que l'agent la reçoit ; changer la variable dans « Modifier… » : l'ancienne clé
   disparaît.
5. Commande introuvable : point rouge et « Commande introuvable » dans la liste et l'en-tête ;
   « Modifier… » corrige ; la liste repasse au vert sans redémarrer.
6. Redémarrer l'app avec une conversation d'un agent qui ne sait pas reprendre : repère « Nouvelle
   session avec … » (icône, texte, retour à la ligne à largeur étroite), puis le message suivant
   part avec l'échange d'avant (journal Détaillé : bloc `<earlier_conversation>`).
7. « Supprimer cet agent » : confirmation rouge dans la ligne, « Garder » a le focus, Échap la
   referme ; après suppression, retour à la liste ; au lancement suivant, ses conversations sont en
   lecture seule.
8. Recherche des réglages : « acp », « ajouter agent » mènent à la ligne et la font ressortir.

## Journal

- **2026-10-24** — Fiche, plan, analyse du défaut 3.
- **2026-10-24** — Maquette sur l'app buildée (`e2e/maquettes/screens-agent-acp.mjs`, quatre écrans
  en clair et en sombre, regardés). Changé après l'avoir vue : bouton « Supprimer… » neutre au lieu
  de rouge plein, carte titrée « Déclaré dans Bobine ».
- **2026-10-24** — Fait, sur `claude/fiche-141-acp-personnalise-0156ec` :
  - **Réglage et profil** : `shared/custom-agents.ts` (déclaration, formulaire, `draftProblems`,
    `splitCommandLine` / `joinCommandLine`, `parseEnvLines`, `newCustomAgentId`,
    `parseCustomAgents`), `main/agent/custom-profiles.ts` (`customProfile`, `applyCustomProfiles`),
    `settings.ts` (`customAgents`), `SettingsStore.saveCustomAgent` / `removeCustomAgent` (liste des
    profils tenue à jour, clé d'API oubliée quand l'agent part ou que sa variable change),
    `ProfileSummary.custom`, canaux `settings:saveCustomAgent` / `settings:removeCustomAgent`.
  - **Défaut 3** (ADR-0030) : `Handover.reason` ; `AgentHost` ouvre une session neuve au lieu de
    la lecture seule et pose le repère (`renewed`) ; `recoverLostSession` aussi (l'avis
    `sessionLost` disparaît, l'erreur va au journal) ; texte joint propre
    (`APP_CONTEXT_OPENINGS.renewal`) ; repère non répété (`shared/session-renewal.ts`, sorti de
    `transcript.ts` qui était à son plafond) ; branche et export le disent ; `HandoverDivider`
    (icône ↻, titre et raison) ; « Reprendre une conversation de l'historique » non annoncé dit
    désormais « session neuve qui reçoit l'échange d'avant » au lieu de « lecture seule ».
  - **Grille** : persona « ACP minimal » déclarée dans `settings.json` (`declared`), profil bâti par
    l'app ; le dernier agent choisi (`profileId`) remplace « la persona d'abord » ; cases « panne »
    et « reprise » : session neuve, un seul repère, `contexte-recu` reçoit l'échange.
  - **Interface** : ligne « Ajouter un agent ACP… » (`AgentsSettings`), agents déclarés listés même
    introuvables (`listedAgent`, `AgentStatus`), `CustomAgentForm.tsx` (page, erreurs sous le champ
    une fois quitté, refus du main affiché), « Modifier… » et carte « Déclaré dans Bobine »
    (`AgentPage`), navigation liste / page / formulaire (`SettingsDialog`, `SettingsBody`), entrée de
    la recherche, `custom-agent.css`, i18n fr / en.
  - **Essais** : `custom-agents.test.ts`, `custom-profiles.test.ts`, `settings-store.test.ts`,
    `settings.test.ts`, `agent-host.test.ts` (sans historique, session perdue), `manager.test.ts`
    (deux redémarrages, un repère, échange reçu), `handover.test.ts`, `SettingsDialog.test.tsx`
    (ajout, refus, modifier, supprimer) ; e2e `custom-agent` (nouvelle suite).
- **Vérifié** : `./scripts/verify` vert (272 fichiers, 1 989 tests ; grille de conformité 44 cases
  vertes, dont « panne » et « reprise » d'ACP minimal par le vrai profil personnalisé) ;
  `pnpm build && pnpm e2e --changed` : **toute la suite** (fichiers globaux touchés : `transcript.ts`,
  `agent-host.ts`, i18n…), 124 tâches en clair et en sombre, vertes en 6 min 35 s ; après la
  correction de l'espacement de la liste, `custom-agent`, `settings`, `providers`, `touches`,
  `auth` rejouées, vertes. Captures regardées : `ca1` à `ca6` (liste, erreur, formulaire, page,
  « Nouvelle session avec Agent maison », suppression), `84-agents`, `84-agent-page`.
  Défaut vu sur les captures et corrigé : espace doublé avant la destination dans la liste des
  agents (« Prêt  · le service… »). Texte faux vu sur la page : « Les anciennes conversations
  s'ouvrent en lecture seule » pour un agent sans reprise, corrigé.
- **Écarts au plan** :
  - Champs proposés : nom, commande, variables, variable de la clé d'API, compaction. Pas
    `installHint`, `testedVersions` ni `defaultControls` (raisons dans « Interface »).
  - Clé d'API : déclarée par le **nom** de la variable (`apiKeys` du profil), valeur au trousseau
    par la rangée existante — ajout au cahier des charges de la 140, pour qu'aucun secret ne soit
    écrit en clair dans `settings.json`.
  - La session perdue d'un agent qui sait reprendre suit la même règle (prévu dans la fiche, mais
    c'est un changement visible pour Bob et OpenCode : le repère remplace l'avis).
  - Un agent supprimé dont la conversation est ouverte garde son agent lancé jusqu'à son arrêt ; la
    lecture seule vient au démarrage suivant (comportement existant des agents retirés). Son détail
    nomme l'agent par son identifiant (`custom-…`), le nom n'étant pas gardé dans la conversation :
    à améliorer si Jérôme le juge utile.
  - `verify` : une fois sur deux passages, une erreur de démontage de vitest
    (`EnvironmentTeardownError … onUserConsoleLog`) attribuée à `conversations/handover.test.ts`,
    tous les tests verts ; pas reproduite seule (trois passages) ni au passage suivant. Même genre que
    l'échec isolé noté par la 139.
