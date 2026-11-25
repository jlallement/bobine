# 259 — Modèle indisponible au tour, et petits correctifs de l'exploration OpenCode

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 210 (carte « Modèle refusé »), 242 (aucun agent lancé sans être choisi), 158
  (commande `bobine <dossier>`), 188 (accueil), 061 (diagnostic), 041 (erreurs de l'interface)
- **Agents** : les deux pour les règles de Bobine ; la reconnaissance du refus de modèle est
  déclarée dans le profil (OpenCode 2.3.0 seul l'envoie aujourd'hui, ADR-0011) et l'agent factice
  la rejoue
- **Trouvé par** : exploration « développeur pressé » du 2026-11-19
  ([rapport](../recettes/2026-11-19-exploration-opencode-sol.md), constats D6, D29, D30, D36, D37)

## Pourquoi

Cinq écarts relevés avec OpenCode 2.3.0 et un profil temporaire :

- **D6** (reproduit 2×) : après la connexion au fournisseur puis « Réessayer », OpenCode refuse le
  message par `-32603` « Internal error: Model unavailable: openai/gpt-6.2-sol ». Bobine montre
  l'erreur brute en rouge, sans la carte « Modèle refusé » (fiche 210) ni le choix d'un autre
  modèle ; l'avis jaune « … n'est pas connecté à son fournisseur » reste, alors qu'on vient de se
  connecter.
- **D29** : Réglages › Diagnostic dit « OpenCode ne sait pas supprimer une session » (faux : OpenCode
  2.3 le sait) et, en pied de page, « sa session d'essai est supprimée ensuite » : contradiction.
- **D30** : l'accueil, étape Dossier, dit « … avec votre accord » ; faux pour un agent qui écrit
  sans demander (profil `writesWithoutAsking`).
- **D36** : premier lancement sur un profil temporaire, IBM Bob est lancé (`bob acp`) avant tout
  choix, puis arrêté quand on choisit OpenCode ; la barre latérale dit « IBM Bob · Prêt ».
- **D37** : `main.log` note en ERROR « ResizeObserver loop completed with undelivered
  notifications » au redimensionnement : bruit bénin qui masquerait de vraies erreurs.

## Trace réelle (`explo-sol-traces/agents.log` et `bobine.log`)

```text
19:12:28.920Z [96a5bee1 · opencode] ← erreur #3 session/prompt -32000 « Authentication required: provider authentication required »
19:13:17.062Z [96a5bee1 · opencode] → initialize #0                       (« Réessayer » après opencode auth login)
19:13:17.535Z [96a5bee1 · opencode] → session/prompt #2 s …geVZPiMc, 2 bloc(s) text
19:13:17.558Z [96a5bee1 · opencode] ← erreur #2 session/prompt -32603 « Internal error: Model unavailable: openai/gpt-6.2-sol » en 23 ms (175 o)
19:14:25.787Z [96a5bee1 · opencode] ← erreur #3 session/prompt -32603 « Internal error: Model unavailable: openai/gpt-6.2-sol »
19:14:38.244Z [96a5bee1 · opencode] → session/set_config_option #4 model=openai/gpt-6.1-sol   (puis le tour répond)
```

```text
19:10:25.510Z INFO  Démarrage de Bobine 1.0.0-rc.1 (Electron 45.4.1), journal normal
19:10:25.940Z INFO  Agent lancé (bob, f971c1d4) : bob acp dans …/bobine-recette/explo-sol (pid 51192)
19:10:32.700Z INFO  Agent lancé (opencode, 96a5bee1) : opencode acp dans …/explo-sol (pid 51344)
19:10:32.733Z INFO  Agent arrêté (bob, f971c1d4) : SIGTERM après 6.8 s
19:11:15.819Z INFO  Agent lancé (bob) : bob acp …          (Réglages › Diagnostic, profil jetable)
19:11:15.828Z INFO  Agent lancé (opencode) : opencode acp … arrêté après 189 ms, sans session
19:36:34.619Z ERROR Interface (error) : ResizeObserver loop completed with undelivered notifications.
```

## Causes (lues dans le code)

- **D6** : `turnAuthBlocker` ne reconnaît que les refus de connexion déclarés par le profil
  (`authAtTurn`) ; le `-32603` « Model unavailable » n'en est pas un, il part donc en erreur de tour
  ordinaire (`turn-error`, rouge). L'avis jaune du refus précédent est un avis du fil comme un
  autre : rien ne le retire quand le tour suivant donne une autre réponse.
- **D29** : le pilote lance un profil temporaire, donc jetable (fiche 242) : le diagnostic
  n'ouvre aucune session d'office (`newSession: 'never'`) et rend `session: 'skipped'`. Le texte de
  ce cas (`diagnostics.agent.sessionSkipped`) a été écrit pour l'autre raison de ne pas ouvrir de
  session (agent qui ne sait pas la supprimer) : il prête à OpenCode une incapacité qu'il n'a pas.
  Le pied de page affirme une suppression qui n'a lieu que chez un agent qui sait supprimer.
- **D30** : texte figé dans `onboarding.folder.subtitle`, sans regarder le profil choisi.
- **D36** : `pnpm pilote lancer --dossier …` passe aussi le dossier en argument (`-- <dossier>`,
  comme `bobine <dossier>`, fiche 158). Au démarrage, `attachLaunch` ouvre aussitôt une
  conversation dans ce dossier (`conversations.create({ workspace })`), avec l'agent par défaut
  (Bob, premier de la liste), qui démarre, alors que l'accueil est affiché et qu'aucun agent n'est
  choisi. Hors pilote, le même chemin existe : `bobine <dossier>` (ou `open -a Bobine --args …`)
  sur un profil neuf ou réinitialisé. La fiche 242 ne couvrait que la conversation de l'accueil
  elle-même (pas de dossier imposé).
- **D37** : `reportGlobalErrors` remonte tout évènement `error` de la fenêtre, et
  `app:reportError` l'écrit en ERROR. Chromium émet ce message (sans objet `Error`) quand un
  `ResizeObserver` n'a pas pu livrer toutes ses notifications dans la même image : bénin, connu
  des navigateurs.

## Critères d'acceptation

- [x] Refus `-32603` « Model unavailable: <modèle> » au tour, `<modèle>` étant exactement le modèle
  de la session : carte « Modèle refusé » (même carte que la fiche 210 : le modèle nommé, « Choisir
  un autre modèle », « Se connecter »), avec le texte « l'agent dit que ce modèle n'est pas
  disponible » ; statut « action requise », pas d'erreur rouge. Choisir un autre modèle renvoie le
  message une fois, dans la même session.
- [x] Faux positifs écartés : autre code, autre texte, autre modèle que celui de la session, ou
  session sans réglage de modèle → erreur de tour ordinaire, comme avant. Profil sans la règle :
  jamais de carte.
- [x] L'avis jaune d'un refus au tour est retiré dès que le tour suivant répond autrement (tour
  fini, autre erreur) et remplacé par l'avis d'un nouveau refus.
- [x] Diagnostic : la raison d'une session pas essayée vient du cas réel — profil jetable, ou agent
  qui n'annonce pas `session/delete` (capacité lue à `initialize`) ; le pied de page ne promet
  plus de suppression à tort.
- [x] Accueil, étape Dossier : le texte dépend de `writesWithoutAsking` du profil choisi, sans nom
  d'agent dans l'interface.
- [x] Accueil dû : une demande `bobine <dossier>` (argument du lancement ou seconde instance)
  attend la fin de l'accueil ; aucun agent n'est lancé avant le choix. Accueil fini ou passé : la
  conversation s'ouvre dans ce dossier, avec l'agent choisi.
- [x] « ResizeObserver loop … » de la fenêtre : journal en debug, pas en ERROR ; toute autre
  erreur reste en ERROR (correspondance exacte du message, source `error`, sans pile).
- [x] Testé contre l'agent factice : scénarios `modele-indisponible` et
  `modele-indisponible-apres-connexion` (l'erreur exacte de la trace).

## Plan

Main :
1. `opencode-contract.ts` : `MODEL_UNAVAILABLE_MESSAGE` (`/\bModel unavailable: (\S+)$/`, avec
   l'identifiant entier en groupe 1). `profiles.ts` : champ générique `modelRefusedAtTurn` (code et
   motif ensemble, comme `authAtTurn.otherCodes`) ; OpenCode et l'agent factice le déclarent.
2. `turn-auth.ts` : `turnAuthBlocker` reconnaît ce refus seulement si le code, le motif et le
   modèle (identifiant entier, égal à celui de la session) correspondent ; la carte est la carte
   de tour de la fiche 210 (méthodes de connexion du profil), marquée `model.unavailable`. Avis
   `agentHost.modelUnavailable`. Le modèle n'est pas marqué « connexion à faire » dans le sélecteur
   (ce n'est pas une connexion).
3. `agent-host.ts` (`turnFailed`, quelques lignes) : avis marqué `refusal`, pas de marque
   « connexion à faire » pour un modèle indisponible.
4. Diagnostic : `AgentCheck.skipped` (`disposable` | `no-delete`) posé par `checkAgent` d'après le
   profil jetable et `sessionSupport.delete` ; deux textes ; pied de page corrigé.
5. D36 : `Onboarding.whenClosed(run)` (tout de suite si l'accueil n'est pas dû, sinon à `finish`) ;
   `index.ts` branche `attachLaunch` derrière.
6. D37 : `app-ipc.ts`, `uiErrorLevel(report)` : debug pour les deux messages connus de
   `ResizeObserver` (source `error`, sans pile), ERROR sinon.

Partagé :
- `AgentBlocker.auth.model.unavailable?`, avis `refusal?` (évènement et élément du fil) ;
  `transcript.ts` / `transcript-notice.ts` : un avis `refusal` est retiré par le suivant, par
  `turn-end` et par `turn-error`.

Renderer :
- `BlockerPanel.tsx` : sous-titre du modèle indisponible ; « Réessayer » comme pour la carte
  modèle.
- `Onboarding.tsx` : sous-titre de l'étape Dossier selon `writesWithoutAsking`.

Agent factice : scénarios `modele-indisponible` et `modele-indisponible-apres-connexion`
(`docs/mock-agent.md`).

Docs : `docs/acp.md` (ligne OpenCode « Connexion expirée » / modèle indisponible),
`docs/agents.md` si la matrice change, CHANGELOG fr et en, index des fiches.

Aucune nouvelle dépendance. Pas d'ADR : on applique les règles des fiches 210 et 242.

## Journal

- 2026-11-19 : traces relues, causes établies dans le code, plan écrit.
- 2026-11-19 : fait. Écarts au plan et détails :
  - D6 : le motif est lu sur le message brut de l'erreur (sans le détail de `data` qu'ajoute
    `errorMessage`) : la réponse réelle faisait 175 o, plus que le seul message ; si OpenCode y
    joint un détail, la reconnaissance tient (essai « un détail joint dans `data` »). Le contenu
    exact de `data` n'est pas connu (le journal ne garde que le message).
  - D6 : un agent qui n'annonce aucun moyen de connexion a quand même la carte (méthodes vides) ;
    sans autre modèle ni connexion, « Réessayer » y est tout de suite, jamais une carte sans issue.
  - D6 : le modèle indisponible n'est pas marqué « connexion à faire » dans le sélecteur ; il y reste
    choisissable, sans marque (pas de nouvelle marque « indisponible » : hors du constat).
  - Avis de refus : retiré par `turn-end`, `turn-error` ou un nouveau refus, dans le réducteur du
    fil (partagé main / renderer) ; marque `refusal` gardée dans le fil enregistré.
  - D29 : la raison vient de `sessionSupport.delete` (capacité annoncée à `initialize`) : session
    pas ouverte alors que l'agent sait la supprimer = profil jetable. Pied de page récrit, vrai
    dans les deux cas.
  - D36 : la demande `bobine <dossier>` n'est pas perdue : elle part à la fin (ou au saut) de
    l'accueil, avec l'agent choisi ; une seconde instance pendant l'accueil attend de même.
  - D37 : seulement les deux formes exactes du message, source `error`, sans pile ; tout le reste
    en ERROR (essai).
  - Catalogue de l'agent factice : `modele-indisponible` refuse le message par construction, il
    est essayé par l'hôte d'agent (`turn-model-unavailable.test.ts`), pas par le catalogue.
  - Tests : `turn-model-unavailable.test.ts` (nouveau : reconnaissance, faux positifs, hôte contre
    l'agent factice dont le parcours D6), `transcript-notice.test.ts` (nouveau), `BlockerPanel`,
    `Onboarding` (D30), `onboarding.test.ts` (D36 avec `LaunchController`), `diagnostics` et
    `manager` (D29), `ipc.test.ts` (D37) ; deux assertions existantes complétées de `refusal`.
  - E2e non lancées (consigne) : à lancer `connexion-expiree`, `onboarding`, `diagnostic`, `command` (`bobine <dossier>`),
    clair et sombre, captures de la carte et de l'étape Dossier à regarder.


## Journal — 2026-11-25 : modèle affiché et modèle utilisé divergents (1.2.0-beta.1, E1, non corrigé)

- Relevé en usage réel (évaluation « bricole », 18:17) : conversation sur OpenCode, puce et panneau
  Session sur GPT-6.1 Sol, mais le message renvoyé échoue « Internal error: Model unavailable:
  openai/gpt-5.6 », précédé de l'avis « Réglage « effort » non appliqué (default) : Réglage inconnu :
  effort ». Journal de l'app (niveau normal, sans `agents.log`) : refus du premier message
  (17:15:39Z, carte), relance de l'agent par `restartWith` (« Réessayer », 17:16:11Z), session rouverte
  (même identifiant), réglages de la conversation `{model: gpt-6.1-sol, effort: default, mode: build}`
  réappliqués, `effort` absent des options annoncées (refus côté app), renvoi refusé en 25 ms. Le refus
  nomme un autre modèle que celui de la puce : erreur brute, pas la carte « Modèle refusé ».
- Sonde ACP directe (OpenCode 2.3.0, abonnement ChatGPT, dossier temporaire vide, 2 messages refusés,
  2 messages courts réussis), journal hors dépôt :
  - `openai/gpt-5.6` n'est plus au catalogue (`-32602` « model not found ») : la séquence exacte ne
    peut plus être rejouée. `openai/gpt-5.5` (proposé, refusé par ce compte) en tient lieu : refus
    `-32603` « Internal error: The 'gpt-5.5' model is not supported when using Codex with a ChatGPT
    account. » (`errorName: provider.invalid-request`), autre texte que « Model unavailable ».
  - Réglage du modèle (`session/set_config_option`) : réponse en 3 à 7 ms portant déjà la nouvelle
    valeur, aucun `config_option_update` ensuite (5 s guettées).
  - Processus relancé, `session/load` : rend le dernier modèle **choisi** dans la session (6.1 Sol si
    réglé avant l'arrêt, même sans message ensuite ; sinon le modèle refusé). `effort` toujours annoncé.
  - Modèle réappliqué puis message envoyé aussitôt : parti et répondu (deux essais). **Divergence non
    reproduite.**
- Non corrigé (consigne : pas de correction sur une supposition). Pistes, à trancher : attendre que la
  session annonce le modèle demandé avant un renvoi ; carte « Modèle refusé » quand le refus nomme un
  autre modèle que celui de la puce. Hypothèse restante non vérifiable : modèle de la session sorti du
  catalogue entre-temps (gpt-5.6 après la connexion à ChatGPT), qu'aucune sonde ne peut plus choisir.
