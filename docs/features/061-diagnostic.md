# 061 — Diagnostic dans l'app

- **Statut** : fait
- **Dépend de** : 004, 022, 054, 058, 060
- **Agents** : les deux (l'essai passe par le lanceur des conversations ; ce qui diffère vient du
  profil et de ce que l'agent annonce)

## Pourquoi

Ce dont l'app dépend ne se voit qu'au moment où ça coince : la version d'un agent une fois qu'il
l'a annoncée, les blocages de Bob (dossier non approuvé, connexion, licence) en ouvrant une
conversation, un seul à la fois, l'état d'AXe dans l'onglet du simulateur. À l'installation, on
cherche longtemps ce qui manque. Une page doit tout vérifier d'un coup, dire ce qui va et, sinon,
quoi faire, sans rien demander à un modèle (0 bobcoin).

## Critères d'acceptation

- [x] Réglages › Diagnostic (aussi Aide › Diagnostic…) : vérifications lancées à l'ouverture,
      relancées par un bouton ; les lignes se remplissent au fil des résultats.
- [x] Chaque ligne : pastille (bon, à regarder, en erreur, facultatif), ce qui a été trouvé, et la
      marche à suivre quand ça ne va pas.
- [x] **Bob Desktop** : version, Electron, macOS, dossier de travail.
- [x] **Environnement** : PATH du shell de connexion lu (sinon le problème, et « Relire le PATH »).
- [x] **Chaque agent** : commande trouvée (chemin) ou comment l'installer ; démarrage et version
      annoncée ; session d'essai dans le dossier courant : prête (modèles proposés), ou le blocage
      (dossier non approuvé, connexion, licence) avec sa marche à suivre. La session d'essai est
      supprimée chez l'agent ; un agent qui ne sait pas supprimer une session (OpenCode) n'en
      ouvre pas sans qu'on le demande (« Essayer une session », qui dit qu'elle restera dans son
      historique).
      L'app n'approuve jamais un dossier ni n'accepte une licence à la place de l'utilisateur.
- [x] **Serveurs MCP** : état de chaque serveur activé (test de la fiche 060, résultats partagés).
- [x] **Simulateur iOS** (facultatif) : Xcode (complet, pas seulement les outils en ligne de
      commande), simulateurs, AXe (version, quarantaine, et la commande qui la retire).
- [x] **Émulateur Android** (facultatif) : SDK trouvé.
- [x] « Copier le rapport » : le tout en texte, dossier personnel abrégé en `~`, sans aucun secret.
- [x] Testé : unitaire (vérifications, rapport, session d'essai supprimée ou non ouverte), e2e
      avec l'agent factice (PATH sans vrais agents) et captures clair / sombre ; essai réel avec
      Bob et OpenCode (bobcoins relevés).

## Plan

1. `shared/diagnostics.ts` : `DiagnosticCheck` (`level` : `ok`, `warning`, `error`, `optional`),
   `DiagnosticGroup`, `diagnosticReport()` (texte du rapport).
2. `AgentHost` : option `newSession: 'if-deletable'` — après `initialize`, pas de session si
   l'agent n'annonce pas `session/delete` (statut prêt, sans session).
3. `ConversationManager.checkAgent(profileId, { trySession })` : hôte temporaire (sans outils de
   l'app, sans conversation), démarré, lu, session supprimée (sinon fermée), arrêté.
4. `main/diagnostics.ts` : groupes « Bob Desktop », « Environnement », « Simulateur iOS »,
   « Émulateur Android » (commandes injectées, testables) ; groupe d'un agent à partir du résultat
   de `checkAgent`.
5. IPC `diagnostics:system`, `diagnostics:agent` ; preload ; problème du shell retenu par
   `index.ts`.
6. Renderer : `DiagnosticsSettings.tsx` (groupes, pastilles, « Relancer », « Copier le rapport »,
   « Essayer une session »), section `diagnostics` (index de recherche, icône), commande de menu
   `diagnostics` (Aide › Diagnostic…).
7. e2e `diagnostic` : PATH réduit (shell factice), agent factice prêt puis connexion requise.

Pas de nouvelle dépendance.

## Journal

- 2026-10-14 — Fait selon le plan.
  - `AgentHost` : option `newSession: 'if-deletable'` (après `initialize`, prêt sans session si
    l'agent n'annonce pas `session/delete`). `ConversationManager.checkAgent` : hôte temporaire,
    sans outils de l'app ni conversation, annonce retenue comme au démarrage d'une conversation ;
    session supprimée (sinon fermée, ou gardée) ; agent toujours arrêté.
  - `main/diagnostics.ts` : groupes « Bob Desktop » (version, dossier, journal), « Environnement »
    (PATH du shell, problème retenu par `index.ts`), « Simulateur iOS » (`xcode-select -p`,
    `xcodebuild -version`, `simctl list devices`, AXe et `xattr` de quarantaine, commande avec
    `$HOME`), « Émulateur Android » ; groupe d'un agent (commande, démarrage, session ou blocage,
    modèles). Chemins affichés avec `~`.
  - Renderer : `DiagnosticsSettings.tsx` (résumé, « Relancer », « Copier le rapport », actions :
    relire le PATH, essayer une session, aller aux réglages des agents ou des serveurs MCP) ;
    `diagnostics-view.ts` (groupe MCP à partir des tests de la fiche 060) ; essais en cours
    partagés (double effet du mode strict en développement). Aide › Diagnostic…, section dans la
    recherche des réglages.
  - **Écart** : « les trois blocages en une fois » n'est pas possible. Bob vérifie le dossier,
    puis la connexion, puis la licence, et s'arrête au premier refus ; rien d'officiel ne dit où
    en est la connexion sans session. Dans un dossier non approuvé, la ligne le dit (« le reste se
    vérifie une fois le dossier approuvé »). L'app n'approuve rien d'elle-même.
  - Tests : unitaires (vérifications avec commandes simulées, groupe d'un agent pour chaque
    blocage, rapport, groupe MCP, `if-deletable`, `checkAgent` avec l'agent factice) ; e2e
    `diagnostic` (PATH réduit et shell de connexion factice : aucun vrai agent ; agent factice
    prêt, session d'essai absente de « Reprendre une session… », rapport copié, Aide ›
    Diagnostic…, « Relancer », puis « connexion requise » et son action), clair et sombre.
    Captures regardées : `k0` (clair), `k1` (clair, sombre).
  - **Essai réel**, 0 bobcoin (coût total de `bob.db` inchangé) : dans `~/bob-essai/mcp-060`,
    tout vert en 4 s (Bob 2.0.6 prêt, OpenCode 1.19.0 sans session d'essai, 4 serveurs MCP
    joignables, Xcode 26.6, AXe 1.8.0, SDK Android) ; dans un dossier jetable, « dossier non
    approuvé » pour Bob, `trustedFolders.json` inchangé. La session d'essai ne laisse rien chez
    Bob : un lancement de l'app avec ou sans diagnostic ajoute la même tâche, celle de la
    conversation vide ouverte au démarrage.
  - Reste : cette tâche vide laissée chez Bob à chaque lancement (conversation vide jamais
    écrite, dont la session n'est pas supprimée en quittant) — antérieur à cette fiche.
- 2026-10-15 — Tâche vide chez Bob corrigée. Deux causes : en quittant l'app, et en quittant une
  conversation vide (autre conversation, changement d'agent ou de dossier avant le premier
  message), l'agent était arrêté sans supprimer sa session. `ConversationManager` : la session
  d'une conversation vide abandonnée est supprimée chez l'agent s'il le permet (`session/delete` ;
  pas OpenCode), un démarrage en cours attendu, au mieux et dans un temps borné, puis l'agent est
  arrêté ; un refus est écrit dans le journal. En quittant (`before-quit`, signaux compris) :
  `dropDraftSessions` (3 s au plus), qui attend aussi les suppressions déjà lancées — un premier
  essai réel quittait l'app pendant l'une d'elles. Tests unitaires (conversation vide quittée puis
  départ aussitôt, agent sans `session/delete`, agent bloqué au démarrage : départ borné).
  **Essai réel** (Bob 2.0.6, 0 bobcoin) : lancement, changement de dossier, départ (SIGTERM) :
  autant de tâches chez Bob avant et après, trois fois sur trois ; lancement puis départ : idem,
  deux fois ; départ en 0,2 à 2,2 s. Les 40 tâches vides laissées avant restent chez Bob (ses
  données : l'app n'y touche pas).
