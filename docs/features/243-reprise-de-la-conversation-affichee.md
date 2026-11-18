# 243 — À la relance, rouvrir la conversation affichée

- **Statut** : en cours (relecture : e2e à rejouer)
- **Dépend de** : 093 (démarrage), 158 (`bobine <dossier>`), 062 (fenêtre rapide), 148 (profil
  temporaire), 194 (quitter en plein tour)
- **Agents** : les deux (choix de la conversation affichée par Bobine, indépendant de l'agent)
- **Trouvé par** : recette « POC complet » du 2026-11-17, étape 8.2
  ([rapport](../recettes/2026-11-17-poc-complet-opencode.md), défaut D10)

## Pourquoi

On quitte Bobine (⌘Q) pendant qu'un agent travaille : le dialogue « Un agent travaille encore »
→ Quitter. À la relance, Bobine s'ouvre sur une **nouvelle conversation** vide, et non sur celle qui
travaillait : il faut la retrouver dans la barre latérale pour voir où l'agent s'est arrêté et lui
dire de continuer. Ce qui est vrai après un tour interrompu l'est aussi après une fermeture
ordinaire : la conversation qu'on avait sous les yeux n'est jamais celle qu'on retrouve.

Gravité : **gênant** (rien n'est perdu, le fil est intact, mais la reprise demande de chercher).

## Ce qui a été observé (2026-11-17, Bobine 1.0.0-beta.7, OpenCode 2.3.0)

- ⌘Q pendant un tour de la mère → dialogue → Quitter ; aucun processus restant (`main.log`).
- Relance : nouvelle conversation affichée. Fil de la mère retrouvé par la barre latérale,
  identique, dernier outil « Modification — interrompu », filles présentes ; « Continue là où tu en
  étais » a repris le travail. Capture `docs/recettes/2026-11-17-poc-complet-opencode/8-fil-apres-relance.jpg`.

## Cause

`ConversationManager` (`src/main/conversations/manager.ts`, constructeur) crée **toujours** un
brouillon au lancement et le rend actif (« Au lancement, comme Claude Desktop : une nouvelle
conversation, l'historique à côté »). La conversation affichée (`activeId`) n'est gardée qu'en
mémoire : rien ne l'écrit sur le disque, ni en cours de route, ni en quittant. Quitter en plein tour
n'y change rien : le défaut est le même après une fermeture ordinaire. Aucune fiche ni ADR ne
décidait ce comportement (seul ce commentaire du code).

## Changement de comportement assumé (écart à la fiche 093)

Jusqu'ici, **chaque lancement** ouvrait une nouvelle conversation vide, l'historique à côté
(« comme Claude Desktop », fiche 093, seulement dans un commentaire du code). Désormais, **chaque
lancement** rouvre la dernière conversation affichée — pas seulement après ⌘Q en plein tour.
Pourquoi : la conversation qu'on regardait en quittant est presque toujours celle qu'on veut
retrouver (travail en cours, réponse à lire, agent à relancer) ; en commencer une autre coûte un
clic (« Nouvelle conversation », ⌘N), retrouver la sienne demande de la chercher dans la barre
latérale. Le défaut D10 n'en est que le cas le plus gênant. Ce qui ne change pas : le choix de
l'agent et du dossier d'une nouvelle conversation (fiche 093), qui ne sert plus au lancement que
lorsque rien n'est rouvert.

## Comportement retenu

Au lancement, Bobine affiche la **dernière conversation affichée** à la fermeture précédente (celle
qui travaillait, dans le cas de D10, puisque c'est elle qu'on regardait), son agent démarré comme
quand on la choisit dans la barre latérale (reprise de session). Sinon, comme avant, une nouvelle
conversation :

- la dernière affichée était une conversation vide (brouillon, jamais enregistré) ;
- elle n'existe plus (supprimée, à la corbeille, index abîmé) ou elle est archivée ;
- profil neuf ou temporaire (`--profil-temporaire`, Recommencer à neuf) : aucune conversation ;
- un agent ou un dossier est imposé au lancement (`BOBINE_AGENT_PROFILE`, `BOBINE_WORKSPACE` :
  essais, pilote) : la valeur imposée gagne, une nouvelle conversation s'ouvre avec (une valeur
  vide n'impose rien).

Cas prévus ailleurs, inchangés :

- `bobine <dossier> ["message"]` (fiche 158) : la conversation demandée s'ouvre après le démarrage
  (`LaunchController` → `create({ workspace })`), par-dessus la conversation rouverte, qui reste
  dans l'historique.
- Fenêtre rapide (fiche 062) : crée sa propre conversation, à la demande, sans regarder le lancement.
- Agent retiré (profil plus proposé) : la conversation rouverte s'affiche en lecture seule, sans
  agent, comme quand on la choisit.
- Dossier de la conversation rouverte disparu : elle s'affiche, avec l'avis « Dossier de travail
  introuvable : … » dans le fil, comme quand on la choisit ; pas de plantage.
- Connexion perdue (clé illisible, Bob déconnecté) : Bob refuse aussi la réouverture
  (`session/load` → `-32000`, `docs/acp.md`, fiche 200) ; la carte « Connexion requise » s'affiche
  dans la conversation rouverte **dès le lancement**, sans attendre de message ; la clé ressaisie,
  la même conversation continue. Une clé refusée seulement au message (`-32603`) donne la carte
  « Connexion expirée » de la fiche 200, comme avant.
- Avis de version déjà vu (fiche 198) : il est dans le fil enregistré de la conversation où il a
  été montré ; rouverte, elle le montre une fois, comme avant de quitter, et il n'est pas rajouté.
- Avis du lancement (serveur des outils arrêté, réinitialisation échouée) : montrés dans la
  conversation affichée, donc dans la conversation rouverte.

La conversation affichée quand on a quitté est celle de la fenêtre principale ; une conversation
ouverte à côté (vue côte à côte, fiche 036) n'est pas rouverte.

## Critères d'acceptation

- [x] Relance après avoir affiché une conversation enregistrée : elle est affichée, son fil chargé,
      son agent repris (session/load).
- [x] Relance après avoir quitté en plein tour (dialogue → Quitter) : la conversation qui
      travaillait est affichée.
- [x] Relance après avoir affiché une nouvelle conversation vide : nouvelle conversation, comme
      avant ; idem si la dernière affichée a été supprimée ou archivée.
- [x] `bobine <dossier>`, fenêtre rapide, profil temporaire : inchangés ; agent ou dossier imposé :
      nouvelle conversation avec.
- [x] Dossier de la rouverte disparu : avis, pas de plantage. Connexion perdue : carte de connexion
      dans la rouverte dès le lancement.
- [x] Test unitaire qui échoue sans le correctif ; e2e contre l'agent factice (quitter en plein
      tour, relancer).

## Plan

1. `src/main/settings.ts` : champ `shownConversation` (identifiant), lu et écrit comme les autres.
2. `src/main/settings-store.ts` : `shownConversation()`, `rememberShown(id)` (écrit sans prévenir les
   abonnés, comme la position de la fenêtre).
3. `src/main/conversations/shown-at-launch.ts` : règle pure — quelle conversation rouvrir parmi
   les enregistrements lus, ce qui est retenu (rien pour un brouillon), et l'agent et le dossier du
   brouillon du lancement (sortis de `manager.ts`, qui dépassait son plafond de taille).
4. `manager.ts` : au constructeur, la conversation rouverte devient active, sinon brouillon comme
   avant ; à chaque liste émise, la conversation affichée est retenue (rien si inchangée ; effacée
   si c'est un brouillon). `startActive` démarre son agent, inchangé.
5. Tests : unitaires (règle, gestionnaire relancé), e2e `restart` (quitter en plein tour par le
   dialogue, relance, la conversation qui travaillait est affichée).
6. CHANGELOG fr/en, index des fiches.

## Journal

- 2026-11-18 — Fiche ouverte, cause trouvée dans le code (voir « Cause »).
- 2026-11-18 — Fait comme prévu. Réglage `shownConversation` (`settings.ts`, `settings-store.ts`),
  écrit par `ConversationManager.emitList` quand il change (écriture synchrone, déjà en place à
  ⌘Q) ; au constructeur, `conversationToReopen` ou le brouillon du lancement (`launchDraftTarget`).
  Les avis du lancement vont dans la conversation affichée, donc la rouverte.
  - Preuves : `manager.test.ts` « relance : la conversation affichée est rouverte » (3 essais :
    rouverte et reprise, quittée en plein tour, brouillon / archivée → nouvelle) et
    `shown-at-launch.test.ts` ; e2e `reprise` (clair, sombre) : ⌘Q pendant `attend-stop`, dialogue
    « Un agent travaille encore » → Quitter (simulé), relance sur cette conversation, qui reprend.
    Sans le correctif (`manager.ts` de `main`) : les 3 essais du gestionnaire et `reprise` échouent.
  - Essais adaptés, intention gardée : `auth` (clé illisible) et `versions` (pas d'avis après
    redémarrage) supposaient une nouvelle conversation à la relance ; ils en ouvrent une
    (« Nouvelle conversation »). L'agent factice, comme Bob, ne demande la connexion qu'à
    `session/new` (`session/load` seulement avec `reopenNeedsLogin`).
  - `./scripts/verify` vert ; `pnpm e2e --changed` (toutes les suites : fichiers globaux) : 207/210,
    les 3 échecs étaient `auth` ×2 et `versions` dark, corrigés puis rejoués verts avec `reprise` et
    `restart`.
  - Hors périmètre, constaté : la conversation rouverte montre la réponse partielle sans mention
    « interrompue » à la fin du message (comportement du rejeu, inchangé).
- 2026-11-18 — Relecture du tech lead, trois points :
  1. Valeur imposée ignorée : `BOBINE_AGENT_PROFILE` / `BOBINE_WORKSPACE` (non vides) gagnent
     désormais sur la conversation retenue (`imposed`, `shown-at-launch.ts`). Essais : « agent ou
     dossier imposé » (échoue sans le correctif) et « `bobine <dossier>` au lancement » (le dossier
     demandé gagne : `create({ workspace })` après le lancement, la rouverte reste dans
     l'historique).
  2. `auth` et `versions` remis comme avant (l'agent imposé par les essais ouvre de nouveau une
     nouvelle conversation à la relance) ; ajouté dans chacune une relance sans rien d'imposé, sur
     la conversation rouverte : `auth` — clé illisible, carte de connexion dès la réouverture, clé
     ressaisie, la conversation continue ; `versions` — l'avis vu une fois dans le fil rouvert, pas
     rajouté après un message. Pour `auth`, l'agent factice ne refusait que `session/new` : nouveau
     scénario `bob-auth-requise-rouverture` (`reopenNeedsAuth`), qui refuse aussi `session/load`
     comme Bob déconnecté (relevé, `docs/acp.md`) ; essai unitaire « rouverte sans connexion »
     (échoue avec l'ancien scénario : aucune carte). Avec l'ancien scénario, un message dans la
     rouverte reçoit sa réponse : l'agent factice n'y demande rien, ce n'est pas un échec muet.
  3. Changement assumé, écrit ci-dessus, dans la fiche 093 et le CHANGELOG ; essais du dossier
     disparu (avis « Dossier de travail introuvable », pas de plantage) et du profil neuf (rien de
     retenu).
