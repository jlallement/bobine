# 011 — Spécificités Bob : SSO, confiance du dossier, élicitation

- **Statut** : fait
- **Dépend de** : 003, 004, 006

## Pourquoi

D'après sa documentation, Bob bloquerait aujourd'hui dans l'app à trois endroits (voir « Compatibilité
Bob » dans `docs/acp.md`) : sans `BOBSHELL_API_KEY` il attend que **l'éditeur lance le SSO** ; il refuse
d'ouvrir une session dans un **dossier non approuvé** ; ses outils MCP peuvent demander des informations
par **formulaire** (élicitation). L'app doit gérer ces trois cas proprement, sans rien supposer de non
documenté.

## Critères d'acceptation

**Authentification**
- [x] Les méthodes d'authentification de l'agent (`authMethods` de `initialize`, type « agent ») sont
      conservées ; si `session/new` répond `auth_required`, l'app affiche un écran « Connexion requise »
      avec un bouton par méthode.
- [x] Le clic appelle `authenticate`, puis réessaie la session ; l'attente (navigateur SSO) peut être
      longue et reste annulable (changer d'agent / relancer). Échec → message, nouvel essai possible.
- [x] Sans méthode proposée, `auth_required` reste une erreur explicite.

**Confiance du dossier**
- [x] Un refus de session reconnu comme « dossier non approuvé » affiche un écran dédié qui explique la
      démarche documentée par Bob : lancer `bob` une fois dans le dossier, puis **Réessayer**.
- [x] Bouton « Ouvrir un terminal dans ce dossier » (Terminal.app).
- [x] Bouton « Faire confiance pour cette session » qui relance l'agent avec son flag de confiance
      (`--trust` pour Bob), avec un avertissement ; **jamais par défaut**, jamais mémorisé.
- [x] Reconnaissance prudente (le message exact de Bob n'est pas documenté) : `data.reason` connu ou
      message mentionnant « trust » ; sinon, erreur générique avec le message de l'agent.

**Élicitation**
- [x] L'app annonce la capacité `elicitation` (form + url) à l'`initialize`.
- [x] Mode formulaire : formulaire dans le fil généré depuis le schéma (texte, email, URL, date, nombre,
      entier, booléen, liste de choix, choix multiple), champs requis, boutons Envoyer / Refuser.
- [x] Le main **valide** la réponse contre le schéma (types, requis, choix proposés, bornes) avant de
      l'envoyer à l'agent.
- [x] Mode URL : affichage du domaine, ouverture dans le navigateur système (https uniquement) sur accord.
- [x] Stop / arrêt / sortie de l'agent → élicitation en attente répondue `cancel`.

**Tests**
- [x] Agent factice : scénarios `bob-auth-requise`, `bob-workspace-non-approuve` (+ approbation simulée
      par un fichier marqueur, + `--trust`), `bob-elicitation` (formulaire riche) et élicitation URL.
- [x] Matrice « Compatibilité Bob » mise à jour.

## Plan

**Partagé** :
- `agent.ts` — statut `needs-action` + `blocker` dans le snapshot (`auth` avec méthodes, ou `trust`) ;
  événements `elicitation-request` / `elicitation-resolved`.
- `elicitation.ts` — validation pure d'un contenu contre un `ElicitationSchema` (utilisée par le main
  pour faire autorité, et par l'UI pour activer « Envoyer »).
- `transcript.ts` — élément `elicitation` (en attente / envoyé / refusé / annulé).

**Main** :
- `AgentHost` — garde la connexion ouverte quand la session est bloquée ; `authenticate(methodId)`,
  `retrySession()`, `trustForSession()` ; élicitations en attente comme les permissions.
- `profiles.ts` — `trustFlag` (`--trust` pour Bob, et l'agent factice).
- IPC : `agent:authenticate`, `agent:retrySession`, `agent:trustForSession`, `agent:respondElicitation`,
  `workspace:openTerminal`.

**Agent factice** : `--trust` ; approbation simulée par un fichier `.mock-agent-trusted` dans le dossier ;
scénario `bob-elicitation` étendu (tous types de champs) ; scénario `elicitation-url`.

**Renderer** : `BlockerPanel` (connexion / confiance) à la place du fil vide ; `ElicitationForm` dans le fil.

## Journal

- 2026-10-11 — Fiche créée.
- 2026-10-11 — Fait : types partagés (statut `needs-action`, `blocker`, événements d'élicitation),
  élément `elicitation` du fil, validation des formulaires (`src/shared/elicitation.ts`, tous types ACP).
  **Mise en pause** à la demande de l'utilisateur pour la refonte visuelle (fiche 014) : les écrans de
  cette fiche seront construits directement dans le nouveau style. Reste : `AgentHost`, agent factice,
  IPC, UI.
- 2026-10-11 — Reprise et terminée, avec les données réelles de Bob 2.0.6 (installé entre-temps).
  - `AgentHost` : un refus « connexion requise » (`-32000`, avec méthodes annoncées) ou « dossier non
    approuvé » (reconnu au message, Bob n'envoie pas de `data`) laisse l'agent vivant en `needs-action` ;
    `authenticate` (sans délai : navigateur), `retrySession`, `trustForSession` (`trustFlag` du profil,
    jamais par défaut ni mémorisé). Capacité `elicitation` (form + url) annoncée ; formulaires validés
    côté main ; liens https uniquement, ouverts dans le navigateur système ; Stop / arrêt → `cancel`.
  - Agent factice : ordre réel (dossier puis connexion), `--trust`, fichier `.mock-agent-trusted`,
    scénarios `bob-premiere-connexion` et `elicitation-url`, formulaire riche (liste, entier, e-mail,
    choix multiple, booléen).
  - UI : panneaux « Dossier non approuvé » et « Connexion requise » à la place de la saisie ; formulaire
    généré depuis le schéma, erreurs par champ (effacées à la correction) ; page web avec domaine affiché.
  - 145 tests ; `pnpm e2e` : nouveau parcours « premier lancement de Bob » en clair et sombre.
  - **Essai réel avec Bob 2.0.6** (dossier jetable, sans connexion) : panneau « Dossier non approuvé »
    avec le message exact de Bob → « Faire confiance pour cette session » → panneau « Connexion requise »
    avec le bouton « Log in with SSO » de Bob. Le clic (SSO IBM) est laissé à l'utilisateur.
  - Ajout hors fiche : verrou d'instance unique (deux instances écriraient le même historique).
- 2026-10-11 — **Défaut signalé par l'utilisateur** : le panneau « Connexion requise » remplaçait toute
  la zone de saisie, menus compris ; impossible de changer d'agent, et « Nouvelle conversation »
  rouvrait le même agent. Le panneau s'affiche désormais **au-dessus** de la zone de saisie, qui garde
  les choix d'agent et de dossier. Vérifié dans `pnpm e2e` (parcours Bob simulé).
- 2026-10-11 — **Essais avec le vrai Bob** (compte de l'utilisateur, connexion SSO réelle réussie).
  - `--trust` est **mémorisé** par Bob (`~/.bob/trustedFolders.json`), contrairement à ce que l'app
    affichait : bouton renommé « Faire confiance à ce dossier », infobulle « Bob s'en souviendra »
    (profil `trustRemembered`). Trois dossiers temporaires ajoutés par mes essais ont été retirés de la
    liste de Bob (copie de sauvegarde conservée).
  - Bob n'utilise pas l'élicitation dans nos essais (questions en texte).
