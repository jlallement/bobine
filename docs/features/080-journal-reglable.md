# 080 — Journal réglable, assez fourni pour déboguer sans sonde

- **Statut** : fait
- **Dépend de** : 041 (journal, stabilisation), 061 (diagnostic)
- **Agents** : générique — ce que l'app échange avec n'importe quel agent ; aucun réglage propre à
  un agent.

## Pourquoi

Quand quelque chose cloche avec un vrai agent, le journal ne dit presque rien, et il a fallu
écrire des sondes à côté de l'app (essais du 17 octobre) :

- OpenCode 1.19 bloqué sur « Réfléchit… » : rien dans `main.log` ; il a fallu une trace ACP brute
  pour voir qu'il n'envoyait plus rien, et son propre journal pour trouver l'erreur ;
- outils de l'app appelés par `execute` (OpenCode 2) : il a fallu un faux serveur MCP et une trace
  horodatée pour voir que l'appel MCP arrive avant le code ;
- titres d'outils de Bob (fiche 071), sous-agents (fiche 078) : mêmes relevés à la main.

L'utilisateur veut un niveau de journal **réglable dans l'app packagée**, assez fourni pour
déboguer sans ajouter de sonde ni refaire le paquet.

## Aujourd'hui

`main/log.ts` : trois niveaux (`info`, `warn`, `error`), `main.log` dans `~/Library/Logs/Bobine/`,
1 Mo puis `main.old.log`. 34 lignes d'écriture dans tout le main (démarrage, erreurs, historique,
MCP des réglages). Rien sur : les messages ACP (requêtes, réponses, mises à jour), les appels des
outils de l'app (MCP), le lancement et l'arrêt des agents (commande, durée, code de sortie), leur
sortie d'erreur (gardée seulement en mémoire, la fin, pour l'avis de panne), les temps (tour,
outil, silence de l'agent).

## Choix tranchés

Tranchés par l'utilisateur le 2026-10-19 : les quatre recommandations (mises en premier).

1. **Où régler le niveau**
   - **Réglages › Diagnostic, effet immédiat** (recommandé), plus `BOBINE_LOG` pour les essais et
     le développement ;
   - seulement une variable d'environnement (lancer l'app depuis un terminal) ;
   - une case dans le menu Aide.
2. **Combien de niveaux**
   - **Trois** (recommandé) : *Normal* (comme aujourd'hui, un peu plus de faits : agent lancé,
     arrêté, tour fini et sa durée) ; *Détaillé* (chaque message ACP et appel MCP : type,
     identifiants, outil, durée, taille) ; *Trace* (en plus, le contenu des messages, tronqué) ;
   - deux : normal et tout.
3. **Contenu des messages au niveau le plus fin** (ce que vous écrivez, ce que l'agent répond, le
   contenu des fichiers lus)
   - **Extraits tronqués** (environ 500 caractères par message) et secrets masqués (clés d'API,
     jetons, en-têtes d'autorisation) (recommandé) ;
   - complet ;
   - jamais de contenu, seulement les métadonnées.
4. **Durée du niveau le plus fin** (verbeux, et il contient des extraits de vos conversations)
   - **Revient à Normal au prochain lancement** (recommandé) ;
   - reste jusqu'à ce qu'on le change ;
   - revient à Normal au bout d'une heure.

Défauts proposés, sans question : fichier à part pour le détail (`agents.log`, 10 Mo puis
`agents.old.log`), pour ne pas noyer `main.log` ; morceaux de texte en flux (`agent_message_chunk`)
regroupés par message (un nombre et une taille, pas une ligne par morceau) ; chaque ligne porte la
conversation et l'agent ; sortie d'erreur des agents écrite au fil de l'eau ; « l'agent n'a rien
envoyé depuis N s » noté pendant un tour ; Réglages › Diagnostic montre le niveau, la taille des
journaux et « Afficher le journal ».

## Critères d'acceptation

- [x] Réglages › Diagnostic › « Journal » : Normal, Détaillé, Trace ; effet immédiat, sans
      relancer. Trace revient à Normal au prochain lancement (l'app le dit) ; Détaillé reste.
      `BOBINE_LOG` (`normal`, `detailed`, `trace`) impose un niveau.
- [x] **Normal** (`main.log`, comme aujourd'hui) : en plus, chaque agent lancé (commande,
      dossier), arrêté (code, durée), chaque tour fini (durée, raison), et « l'agent n'a rien
      envoyé depuis 1 min » pendant un tour.
- [x] **Détaillé** (`agents.log`) : chaque message ACP dans les deux sens (méthode ou type de mise
      à jour, identifiants, outil, statut, taille, temps de réponse), chaque appel des outils de
      l'app (outil, durée, résultat : textes, images, erreur), la sortie d'erreur des agents ligne
      à ligne. Les morceaux de texte en flux sont regroupés par message. Chaque ligne nomme la
      conversation et l'agent.
- [x] **Trace** : en plus, le contenu des messages et des appels, tronqué (environ 500
      caractères), secrets masqués (clés d'API, jetons, en-têtes d'autorisation, jeton du serveur
      d'outils de l'app).
- [x] `agents.log` : 10 Mo puis `agents.old.log` ; `main.log` inchangé (1 Mo). Le journal ne fait
      jamais tomber l'app (disque plein, sortie fermée).
- [x] Réglages › Diagnostic montre aussi la taille des journaux et « Afficher le journal ».
- [x] Testé : unitaires (niveaux, masquage, troncature, regroupement des morceaux, rotation) ;
      e2e `diagnostic` (niveau changé à chaud, lignes ACP et MCP dans `agents.log` avec l'agent
      factice, rien de plus au niveau Normal) ; essai réel avec Bob ou OpenCode en Détaillé.

## Plan

1. **Journal** (`main/log.ts`) : niveau courant (`normal`, `detailed`, `trace`), second fichier
   `agents.log` (même règles de rotation, 10 Mo), `agentLog` (une ligne : conversation, agent,
   sens, quoi). `main/log-redact.ts` : masquage des secrets et troncature, pur.
2. **ACP** (`main/agent/agent-host.ts`, flux `ndJsonStream`) : chaque ligne JSON-RPC lue et écrite
   passe par un relevé (`main/agent/acp-log.ts`, pur : résumé d'un message, regroupement des
   morceaux de texte, temps de réponse par identifiant). Lancement, arrêt, sortie d'erreur, durée
   des tours, silence de l'agent pendant un tour.
3. **Outils de l'app** (`main/mcp/tool-server.ts`) : chaque `tools/call` (outil, durée, résultat).
4. **Réglage** : préférence `logLevel` (`normal` ou `detailed` ; Trace n'est jamais enregistré),
   IPC pour le niveau et la taille des journaux, Réglages › Diagnostic, recherche des réglages,
   textes `fr.json` et `en.json`.
5. **Essais** : unitaires, e2e `diagnostic` (`--lang en` aussi), essai réel.
6. **Clore** : `docs/architecture.md`, AGENTS.md (où trouver le journal et comment le régler),
   fiche, index, `CHANGELOG.md` et `CHANGELOG.en.md`.

Aucune nouvelle dépendance.

## Journal

- 2026-10-19 — Fiche créée à la demande de l'utilisateur, après les sondes écrites à la main pour
  OpenCode (fiches 078, 079). Choix 1 à 4 soumis avant de coder.
- 2026-10-19 — L'utilisateur retient les quatre recommandations : Réglages › Diagnostic (et
  `BOBINE_LOG`), trois niveaux, extraits tronqués et secrets masqués, Trace jusqu'au prochain
  lancement. Critères et plan écrits.
- 2026-10-19 — **Fait.**
  - **Journal** (`main/log.ts`) : un écrivain de fichier commun (rotation, jamais d'exception),
    `main.log` (1 Mo) et `agents.log` (10 Mo, rien au niveau Normal), niveau courant
    (`setVerbosity`, `logs()`), `agentLog.line` avec la conversation et l'agent.
    `main/log-redact.ts` : extraits de 500 caractères, masquage des clés données aux agents, des
    formes connues (`sk-…`, `Bearer …`, champs `apiKey`, `token`, `password`…) et du jeton du
    serveur d'outils de l'app.
  - **ACP** (`agent/acp-log.ts`, branché sur les flux de l'agent par deux `TransformStream`) :
    requêtes et réponses avec leur temps, mises à jour résumées (outil, statut, contenu, entrée,
    `_meta`), morceaux de texte regroupés par message, erreurs JSON-RPC ; en Trace, l'entrée,
    la sortie et le texte des outils, les paramètres des requêtes. Rien n'est analysé au niveau
    Normal.
  - **main.log** : agent lancé (commande, dossier, pid), arrêté (code, durée), tour fini (raison,
    durée), « l'agent n'a rien envoyé depuis 1 min » pendant un tour (puis toutes les 5 min), sauf
    quand une autorisation ou une question attend l'utilisateur ; niveau du journal au démarrage
    et à chaque changement.
  - **Outils de l'app** (`mcp/tool-server.ts`) : `tools/list`, chaque appel (outil, durée, textes,
    images, erreur ; arguments et texte en Trace), outil inconnu.
  - **Réglage** : préférence `logLevel` (Normal ou Détaillé), Trace pour la session seulement ;
    `BOBINE_LOG` impose le niveau (réglage grisé) ; lu avant toute fenêtre
    (`peekPreferences`). Bloc « Journal » en tête de Réglages › Diagnostic : niveau, ce qu'il
    écrit, `main.log` et `agents.log` avec leur taille (ouverts dans Console).
  - **Écart** : Trace revient au niveau enregistré (Normal ou Détaillé) au lancement suivant,
    pas forcément à Normal.
  - **Essais** : unitaires (niveaux et fichiers, masquage, relevé ACP, appels MCP, agent factice
    de bout en bout, préférences) ; e2e `diagnostic` (Normal par défaut, Détaillé à chaud avec
    échanges et outils sans contenu, Trace avec extraits, non enregistré, relance, `BOBINE_LOG`),
    en clair et en sombre, en français et en anglais ; essai réel avec OpenCode 2.0.32 en Trace :
    le journal montre seul ce qui avait demandé des sondes (code d'`execute`, appel MCP arrivé
    avant la mise à jour qui le cite, temps de chaque étape).
  - La partie d'avant de la suite `diagnostic` comparait des textes français en dur : passée par
    `L()` et `Lpart()`, elle passe aussi en anglais.
