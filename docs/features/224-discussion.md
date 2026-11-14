# 224 — Espace Discussion : parler à l'agent et travailler sur des documents, à côté du code

- **Statut** : en cours — maquettes E1–E6 validées et relevés réels faits le 2026-11-14 ; cœur,
  interface, agent factice, essais et doc faits sur `feat/224-discussion` ; relecture du tech lead
  à faire (voir « Écarts »)
- **Dépend de** : 093 (démarrage : pas de conversation sans dossier), 203 et 214 (cartes
  d'autorisation lisibles), 223 (rôles : familles d'outils de Bobine choisies, surveillance du
  dossier), 024 et ADR-0024 (l'échange d'avant part en texte), 052 (aperçu en lecture seule),
  ADR-0018 (téléchargements : « Enregistrer sous… »), ADR-0031 (pages de l'app dans la zone
  principale)
- **Agents** : tous. Une discussion est une conversation ordinaire de l'agent, ouverte dans un
  dossier tenu par Bobine, avec moins d'outils et une autre interface : rien de propre à un agent
  (ADR-0011). Ce que l'agent sait faire d'un Word ou d'un Excel dépend de lui ; Bobine ne promet
  que ce qui est relevé (voir « Ce qui dépend de l'agent »).

## Pourquoi

L'utilisateur veut aussi se servir de Bobine **comme d'un chat**, et l'ouvrir à un **public moins
technique** qui travaille avec des documents : poser une question, faire rédiger un e-mail,
résumer un PDF, tirer un tableau d'un Excel, produire un Word. Aujourd'hui toute conversation exige
un dossier de projet (fiche 093), et tout l'écran parle de code (git, branche, worktree, diffs,
terminal).

Première version des maquettes (D1–D5, 2026-11-14) refusée : la discussion était glissée dans
l'espace Code (entrée du menu du dossier, section dans la même liste, bulles dans « Récents ») —
« trop mélangé ». Décision : **deux espaces séparés, Code et Discussion, sur le même moteur**.

## Ce que font Claude et ChatGPT, et ce qu'on en garde

Relevé de mémoire (mi-2026), à revérifier avant de citer ailleurs :

| | Claude (Chat) | ChatGPT | Bobine (proposé) |
|---|---|---|---|
| Espaces | onglets Chat / Cowork / Code | un seul (Projets à part) | sélecteur **Code \| Discussion** en tête de la barre latérale |
| Donner un fichier | trombone ou glisser ; carte dans le message | idem | idem : pièce jointe, carte dans le message, copie dans la discussion |
| Produire un fichier | code dans un bac à sable de la conversation (Word, Excel, PDF…) ; carte « Télécharger » ; Artifacts à droite | Python dans un bac à sable (`/mnt/data`) ; lien de téléchargement ; Canvas à droite | l'agent écrit dans le dossier de la discussion ; **carte de fichier dans le fil** (Ouvrir, Enregistrer sous…, Afficher dans le Finder) ; panneau **Documents** |
| Durée des fichiers | gardés avec la conversation | **expirent** (bac à sable vidé) | gardés avec la discussion, corbeille avec elle |
| Partage entre conversations | Projets | Projets | plus tard |

Différence de fond : chez eux le code tourne sur leurs serveurs ; chez Bobine, l'agent tourne sur
le Mac de l'utilisateur, avec ses outils et ses autorisations. Même moteur que l'espace Code (comme
Cowork reprend le moteur de Claude Code) : la différence est dans ce qu'on montre et ce qu'on
demande.

## Ce qui distingue les deux espaces

| | Code | Discussion |
|---|---|---|
| Dossier | choisi par l'utilisateur (son projet) | tenu par Bobine, jamais nommé : on voit des « documents » |
| À l'écran | git, branche, worktree, diffs, terminal, navigateur, simulateur, Équipe | messages, cartes de fichiers, panneau Documents (aperçu) |
| Agent | mode de travail, filles, rôles, outils de Bobine | outils de Bobine coupés ; pas de filles ni de rôles |
| Autorisations | cartes techniques | même mécanisme, dit en clair (« Créer « Synthèse.docx » dans les documents de cette discussion ? ») |
| Vocabulaire | projet, dossier, commit | discussion, document, enregistrer |
| Accueil | « Explique ce projet », « Trouve des bugs »… | « Résume un document », « Fais un tableau », « Rédige un e-mail », « Explique une notion » |

Communs : Réglages, agent et modèle, « Mon activité » (la consommation compte les deux espaces).
Propres à Code : Tâches planifiées, Équipe. Le seul pont : **« Continuer dans un projet… »**.

## Décisions (validées avec les maquettes E1–E6, 2026-11-14)

1. **Dossier de travail par discussion** : `<données>/discussions/<id>/`, créé au premier message
   ou au premier document déposé. Ce que l'utilisateur glisse y est **copié** (l'original n'est
   jamais touché) ; ce que l'agent produit y reste. Gardé aussi longtemps que la discussion, mis à
   la corbeille avec elle (30 jours, comme une conversation). Jamais dans les dossiers récents ;
   pas de git, de worktree, de règles du projet, de mémoire commune, de serveurs MCP « projet » ni
   de serveurs de dev. **Relevé** (Bob 2.1.0, 2026-11-14) : un dossier neuf jamais décidé s'ouvre
   sans demande de confiance ; Bob y crée `.bob/plugins/` (les fichiers cachés ne sont pas montrés
   comme documents).
2. **Mode** : le mode de travail habituel de l'agent (l'agent doit pouvoir écrire un document) ;
   pas le mode `ask` de Bob (lecture seule, première version abandonnée). L'utilisateur garde la
   puce de mode s'il veut changer, repliée dans les réglages de session.
3. **Écritures bornées aux documents** : une demande d'écriture (`edit`, `delete`, `move`) dont
   les emplacements sortent du dossier de la discussion est **refusée d'office** et dite ; dedans,
   elle est accordée d'office (dit dans le fil, une ligne). Emplacements : ceux de la demande,
   sinon ceux de l'appel d'outil déjà reçu (Bob envoie parfois une demande sans `locations`) ;
   aucun emplacement connu : la demande reste posée à l'utilisateur. Un agent qui écrit sans demander
   (`writesWithoutAsking`, OpenCode) : surveillance du dossier par liste de fichiers ; ce qui
   change **hors** du dossier, Bobine ne peut ni l'empêcher ni le voir — c'est dit dans Réglages ›
   Agents, pas promis.
4. **Commandes** : toujours demandées à l'utilisateur, jamais « toujours autorisées » d'office.
   Une carte de commande dans une discussion dit **ce que la commande fait** en une phrase (titre
   annoncé par l'agent, fiche 203) avant le détail technique, replié.
5. **Outils** : familles d'outils de Bobine vides (`roleToolModules`, fiche 223) : ni navigateur,
   ni terminal, ni simulateur, ni filles, ni mémoire. Les serveurs MCP personnels de l'agent
   restent les siens (fiche 025).
6. **Interface** :
   - Sélecteur **Code | Discussion** en tête de la barre latérale, ⌘1 / ⌘2, dernier espace
     retenu. L'espace Code est **inchangé**.
   - Espace Discussion : « Nouvelle discussion », Épinglées, Récentes, recherche limitée aux
     discussions ; ni Équipe, ni dossiers, ni puce de dossier ou de branche sous la saisie.
   - Documents : glisser sur la fenêtre ou trombone ; carte dans le message ; carte de fichier
     dans le fil pour chaque document créé ou modifié par l'agent ; panneau **Documents** à droite
     (liste, aperçu en lecture seule, Ouvrir avec l'app par défaut, Enregistrer sous…, Afficher
     dans le Finder).
   - « Continuer dans un projet… » (menu du titre) : choisir un dossier ouvre une conversation
     **dans l'espace Code**, avec la discussion passée en texte avant le premier message (comme
     ADR-0024) ; les documents peuvent être copiés dans le projet (case cochée). La discussion
     reste telle quelle.

## Ce qui dépend de l'agent (relevé le 2026-11-14, `docs/acp.md`)

- **Bob 2.1.0** lit et écrit les fichiers Office **lui-même** (compétence « office-insights »,
  lectures `read`, retouches `edit` du `.docx`), sans commande ; il demande une autorisation par
  retouche — d'où l'accord d'office dans les documents (décision 3). 0,77 bobcoin pour le relevé.
- **OpenCode 2.2.5** (modèle gratuit) : pas d'outil Office ; commandes Python faites **sans rien
  demander**, extraction du `.xlsx` dans le dossier temporaire du système (hors de la
  discussion), `.docx` fabriqué à la main. La limite aux documents n'y est que demandée : dit dans
  Réglages › Agents (repère `writes-without-asking`, déjà déclaré) et une fois dans le fil.
- Version texte jointe aux documents déposés (`textutil`) : inutile pour Bob, reportée.

## Critères d'acceptation

- [x] Sélecteur Code | Discussion ; l'espace Code ne change que par le sélecteur en tête de la
      barre latérale (les captures e2e des autres suites le montrent).
- [x] Une discussion se démarre sans dossier, reçoit des messages et des documents ; aucun
      dossier n'entre dans les récents (`manager-discussion.test.ts`).
- [x] Un document déposé (panneau, glisser) ou joint à un message est copié dans la discussion ;
      l'original n'est pas modifié (`documents/ipc.test.ts`, e2e).
- [x] Un document créé ou modifié par l'agent a sa carte dans le fil (Ouvrir, Enregistrer une
      copie…, Afficher dans le Finder) et sa ligne dans le panneau « Documents ».
- [x] Écriture demandée hors des documents : refusée et dite ; dedans : accordée et dite ; sans
      emplacement connu : posée (`permission-answers.test.ts`, scénario `discussion-document`).
- [x] Aucun outil MCP de Bobine n'est proposé à l'agent ; pas de filles ni de rôles (`toolModules`
      vide, menu sans « Lancer en parallèle… », `@rôle` coupé).
- [x] Suppression d'une discussion : ses documents restent tant qu'elle est dans la corbeille (la
      restauration les retrouve) et partent avec son effacement.
- [x] « Continuer dans un projet… » ouvre une conversation dans l'espace Code, discussion passée
      en texte (bascule), documents copiés dans `documents/` si demandé.
- [ ] Reprise après redémarrage : `space` relu de l'index (`withSpace`) ; pas d'essai de bout en
      bout du redémarrage.
- [x] Testé contre l'agent factice : scénarios `discussion-document` et `discussion-commande` ;
      e2e `discussion` en clair et sombre (vert le 2026-11-14, captures `discussion-1` à `-5`
      regardées) ; textes en `fr.json` et `en.json`. **À faire avant fusion** : `App.tsx`,
      `Sidebar.tsx`, `Composer.tsx`, `shared/agent.ts` et `shared/ipc.ts` sont des sources
      communes à toutes les suites — la suite complète doit tourner (non lancée ici, consigne du
      tech lead).
- [x] Bob réel et OpenCode : approbation du dossier, lecture et production d'un Word et d'un
      Excel relevées dans `docs/acp.md` (2026-11-14).

## Plan

Maquettes validées ; le code commence par les relevés (étape 1). Plus de trois fichiers : plan présenté avant de
coder. Aucune nouvelle dépendance prévue.

1. **Relevés** (Bob au travail, OpenCode modèle gratuit) : approbation de
   `<données>/discussions/<id>`, lecture et production `.docx` / `.xlsx`, titres des commandes.
   Traces rejouées par l'agent factice (contrat réel avant le code).
2. **Cœur (main)** :
   - `src/shared/` : `ConversationRecord.space: 'code' | 'discussion'` (absent = code, lu tel quel
     à la relecture de l'index) ; résumé, IPC `documents:*` (liste, ajouter, ouvrir, enregistrer
     sous, afficher).
   - `src/main/conversations/` : dossier de la discussion (création, corbeille et restauration
     avec la conversation), exclu des récents ; `readFolder` / `workspaceOf` rendent « rien » pour
     git, règles, mémoire, MCP projet, serveurs de dev.
   - Hôte : familles d'outils vides ; réponses d'office aux autorisations d'écriture selon les
     emplacements (dedans / dehors), sur le modèle de `AgentHostOptions.readOnly` (fiche 223) ;
     surveillance du dossier par liste de fichiers ; documents créés ou modifiés repérés à la fin
     du tour pour les cartes.
   - Continuer dans un projet : nouvelle conversation de l'espace Code + élément de passage en
     texte (ADR-0024, sans changer d'agent), copie facultative des documents.
3. **Agent factice** : scénarios `discussion-document`, `discussion-hors-dossier` ;
   `docs/mock-agent.md`.
4. **Interface** (après validation des maquettes) : sélecteur et espace retenu, barre latérale de
   l'espace Discussion, accueil et suggestions, cartes de documents (message et fil), panneau
   Documents, cartes d'autorisation en clair, « Continuer dans un projet… », raccourcis ⌘1 / ⌘2 ;
   i18n fr / en (glossaire : « discussion » / « chat », « documents » / « documents »).
5. **Essais et doc** : unitaires (gestionnaire, hôte, index), e2e `discussion` ; `docs/architecture.md`,
   guide, changelogs. ADR : « L'espace Discussion : même moteur, dossier tenu par Bobine, autre
   interface » (précise ADR-0011 et la fiche 093).

## Fait (2026-11-14), fichiers

- **Main** : `conversations/discussion-space.ts` (dossier, documents, plan de dossier, brouillon,
  fil continué), `conversations/conversation.ts` (type sorti de `manager.ts`, plafond de taille),
  `manager.ts` (`create` selon l'espace, `continueInProject`, `openNew`, `activate`,
  `replaceActive`), `helpers.ts` (`deleteAtAgent`, `subagentWorkOf` sortis du gestionnaire),
  `host-options.ts` (outils vides, `writeArea`), `trash.ts` (effacement du dossier),
  `agent/permission-answers.ts` (`writeArea`, `notify`, `hostRules`), `agent/tool-call-memory.ts`
  et `profile-updates.ts` (emplacements repris du `tool_call`), `documents/ipc.ts`, `ipc.ts`,
  `read-only-guard.ts`.
- **Partagé** : `agent.ts` (`ConversationSpace`, évènement `documents`), `transcript.ts` (élément
  `documents`), `handover.ts` (raison `discussion`), `documents.ts`, `documents-ipc.ts`,
  `panel.ts` (onglet `documents`), `shortcuts.ts` (⌘1 / ⌘2), locales fr / en.
- **Renderer** : `useSpace.ts`, `components/discussion/` (`SpaceSwitcher`, `DocumentCards`,
  `DocumentsPanel`, `ContinueInProjectDialog`), `discussion.css`, barre latérale, accueil, saisie,
  panneau, menu de la conversation, carte d'autorisation (`PermissionQuestion`, `PlainCommand`).
- **Agent factice** : `scenarios-discussion.mts` ; **e2e** : `e2e/suites/discussion.mjs`.
- **Doc** : ADR-0048, `docs/acp.md` (relevés), `docs/architecture.md`, `docs/mock-agent.md`,
  `docs/traduction.md`, guide des raccourcis, changelogs.

## Écarts au plan et aux maquettes

- **Aperçu** : texte brut pour un `.docx` / `.rtf` (macOS `textutil -convert txt`), pas la page
  mise en forme de la maquette E5 — l'afficher en HTML demandait un nettoyeur (`dompurify` n'est
  pas une dépendance directe) ; pas d'aperçu d'un `.xlsx` (E3 : « Ouvrir » à la place). Aucune
  dépendance ajoutée.
- **Cartes de documents** : nom et extension, pas « créé par … · 24 Ko » (Bobine ne sait pas qui a
  écrit un fichier) ; la liste du panneau donne taille et date.
- **« Enregistrer une copie… »** : dossier choisi dans le dialogue des dossiers (pas un dialogue
  d'enregistrement) ; un nom pris reçoit un numéro.
- **Recherche** (⌘K) : non limitée aux discussions.
- **Dit une fois dans le fil pour un agent qui écrit sans demander** : pas fait ; le repère
  `writes-without-asking` de Réglages › Agents reste la seule mention (relevé : OpenCode écrit
  hors du dossier, dans le dossier temporaire du système).
- **Mode** : la puce de mode est retirée de la barre d'une discussion ; le mode reste dans les
  réglages de la session.
- **Dossier d'une discussion** créé avec son brouillon (l'agent y démarre), retiré s'il est resté
  vide quand on la quitte.

## Relecture du tech lead (2026-11-14) : sûreté de l'espace

- **Écritures** (`agent/write-area.ts`) : cibles = emplacements (repris du `tool_call` au besoin)
  ∪ chemins des diffs. Une cible dehors (chemin, ou lien symbolique sur le chemin — chemin réel de
  l'ancêtre existant le plus profond) : refusé. Accordé une fois seulement si chaque cible est un
  document du premier niveau, visible, pas un lien. Posé à l'utilisateur : chemin relatif ou `~`,
  aucune cible, emplacements et diffs en désaccord, fichier caché ou sous-dossier (`.bob/`,
  `.opencode/`), déplacement.
- **Dossiers** : une branche a son propre dossier, documents copiés ; l'effacement garde un
  dossier qu'une autre conversation (index ou corbeille) désigne. Brouillon quitté sans document :
  son dossier part même avec `.bob/` ; au lancement, les dossiers que plus rien ne connaît
  partent s'ils n'ont aucun document (sinon gardés, et dit au journal). Dossier disparu : recréé
  avant le démarrage de l'agent. Sauvegarde et restauration emportent `discussions/` (sans lien
  symbolique ; l'état gardé avant une restauration en est débarrassé).
- **Documents** : jamais un lien symbolique (liste, aperçu, ouverture, copie) ; « Ouvrir » limité
  aux documents et images (`canOpenDocument`) ; copie ailleurs sans écraser (`COPYFILE_EXCL`) ;
  dépôt par copie cachée puis renommage ; pièce jointe disparue non envoyée, et dite ; « Continuer
  dans un projet » crée la conversation avant de copier ; `needs-action` ne finit pas un tour.
- **Agent qui écrit sans demander** : consigne de session `<bobine_discussion>` (rester dans les
  documents, ne rien installer), avis « seulement demandée » une fois dans le fil, ligne sur
  l'accueil — d'après `writesWithoutAsking` du profil.
- **Notés** : M1 — **fait le 2026-11-15** : l'aperçu lit en `O_NOFOLLOW` ; `textutil` lit le
  même descripteur (ouvert en `O_NOFOLLOW | O_NONBLOCK`, fichier ordinaire vérifié par `fstat`,
  passé en `/dev/fd/3`) : plus de course entre le contrôle de `documentPath` et la lecture.
  `textutil` reconnaît le format au contenu (un RTF nommé `.doc` reste lu ; `-format` forcé
  échouerait, et avec un code de sortie 0 — relevé du 2026-11-15). M5 — un brouillon de l'espace
  Code est encore créé à chaque lancement, même quand l'espace retenu est Discussion (`useSpace`
  bascule ensuite) : **laissé tel quel (2026-11-15)**. L'espace retenu vit dans le `localStorage`
  du renderer, et le main crée et démarre le brouillon (`startActive`) avant que la fenêtre ne
  charge. L'éviter demande de déplacer l'espace retenu dans les réglages du main (nouvelle
  préférence, écrite à chaque changement d'espace) et de choisir au lancement la discussion la plus
  récente au lieu d'un brouillon : un changement du chemin de démarrage (accueil, avis du
  lancement, prise en main), pas une correction bornée. Sans effet sur les dossiers ; l'agent du
  brouillon Code est relâché comme tout brouillon quitté.

## Plus tard (hors périmètre)

- Documents et instructions partagés entre discussions (les « Projets » de Claude et ChatGPT).
- Version texte jointe aux documents déposés (`textutil`).
- Recherche web : seulement si l'agent l'a lui-même.

## Journal

- **2026-11-14** : fiche ouverte (utiliser Bobine comme un chat). Maquettes D1–D5 (discussion dans
  l'espace Code, dossier vide en lecture seule, mode `ask`) refusées : trop mélangé avec le code.
  Cadre revu avec l'utilisateur : deux espaces séparés sur le même moteur, public moins technique,
  documents déposés et produits gardés avec la discussion (comparaison Claude / ChatGPT).
  Maquettes E1–E6 (`e2e/maquettes/screens-discussion.mjs`) validées par l'utilisateur le même jour.
- **2026-11-14** (suite, sur `feat/224-discussion`, à la demande du tech lead) : relevés réels
  (Bob 2.1.0 : 0,77 bobcoin, réglages de Bob identiques avant / après ; OpenCode 2.2.5 gratuit),
  puis cœur, documents, interface, agent factice, essais, ADR-0048. `./scripts/verify` vert à
  chaque incrément. Voir « Écarts ».
- **2026-11-14** (suite) : `main` fusionné (phase 4 de la fiche 223, puis 1.0.0-beta.3), ADR
  renuméroté **0048** ; `@rôle` refusé aussi par le main dans une discussion. Relecture du tech
  lead traitée (B1, B2, I1–I6, M1–M6, voir la section dédiée), avec ses tests.
- **2026-11-14** (suite) : régression trouvée par la suite complète du tech lead (`inbox`,
  `notifications`, clair et sombre) — recopier les emplacements du `tool_call` dans la demande
  d'autorisation changeait son libellé partout (« Modification de /projet/config.json » au lieu de
  « … config.json »), espace Code compris. La demande reste désormais celle de l'agent ; les
  emplacements connus (`ProfileUpdates.knownLocations`) ne servent qu'à la décision d'écriture
  d'une discussion. Test de non-régression dans `tool-call-memory.test.ts`.
- **2026-11-15** (`fix/nuit-produit`) : le dossier d'une discussion n'est plus montré sous son
  identifiant. Onglet Session : ligne « Documents : Cette discussion » (infobulle « Afficher dans
  le Finder — Documents de la discussion », même action qu'avant) ; libellés d'outils, infobulles,
  « en cours » et groupe d'outils (`toolLabel(…, rootName)`), dossier d'une commande et ses
  pastilles (`withRootLabel`), menu `@` (« Documents ») ; recherche (⌘K) et corbeille :
  « Discussion » ; infobulle de la barre latérale et export Markdown : sans le chemin ; Mon
  activité › Par projet : une ligne « Discussions » (`discussionsRoot`) ; Rôles du projet : pas de
  « projet » pour une discussion (`projectName`). Bug trouvé en passant : la fenêtre rapide,
  ouverte depuis une discussion, visait son dossier (`newConversationTarget` passe maintenant par
  `inheritedFolder`, comme `create`). Restent nommés : le chemin d'une écriture refusée **hors** du
  dossier (c'est le but), et le dossier dans le Finder. M1 fait, M5 laissé (voir « Notés »). Tests :
  `SessionTab`, `CommandBlock`, `Sidebar`, `AppDialogs`, `ProfileData`, `ActivityPage`,
  `useSpace`, `tool-label`, `command-view`, `export`, `trash`, `stats`, `manager-discussion`,
  `documents/ipc` (textutil réel sur macOS : lien et tube refusés) ; e2e `discussion` (onglet
  Session, fil et commande sans l'identifiant ; capture `discussion-3b-session`).
