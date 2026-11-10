# 210 — Modèle refusé faute de connexion, et « Réessayer » qui ouvrait une branche

- **Statut** : fait
- **Dépend de** : 023 (modifier / réessayer un message), 090 et 092 (choix du modèle), 206 (pilote), recette 0.9 D10 (connexion expirée au tour)
- **Agents** : les deux (rien de propre à un agent : réglage de catégorie `model` des options ACP, refus `authAtTurn` du profil ; en pratique OpenCode, seul agent à proposer des modèles)

## Pourquoi

Session longue du pilote (fiche 206) avec OpenCode 2.2.5 : le modèle choisi (`openai/gpt-5.2`)
appartenait à un fournisseur dont la connexion n'était pas valable. OpenCode refuse alors le
message par `-32000` « Authentication required: provider authentication required » ; Bobine
montrait « Connexion expirée » sans dire quel modèle, ni qu'un autre modèle (gratuit) aurait
marché. Pire, deux « Réessayer » étaient à l'écran : celui de la carte (renvoi en place) et
l'icône sous le message (branche, fiche 023). Le pilote a pris l'icône : une seconde
conversation « … · branche », avec le même modèle, refusée de la même façon.

Diagnostic complet : `diag-models.md` (session de la fiche 206), résumé ci-dessus.

## Maquette validée (2026-11-09)

- Carte d'un refus au tour quand la conversation a un modèle : titre « Le modèle {modèle} n'a pas
  répondu », texte « L'agent n'est pas connecté au fournisseur de ce modèle. », boutons
  [Choisir un autre modèle] (le sélecteur de modèle existant ; le choix renvoie le message refusé,
  une fois) et [Se connecter] (l'action de connexion existante). Sans modèle connu : la carte
  « Connexion expirée » d'avant.
- Sélecteur de modèle : un modèle refusé faute de connexion pour ce profil d'agent est grisé avec la
  marque « connexion à faire » (toujours choisissable).
- L'icône « Réessayer » sous le message est masquée tant que la carte d'un tour refusé est là ; son
  nom accessible devient « Réessayer dans une nouvelle branche ».

## Critères d'acceptation

- [x] Refus au tour avec un modèle connu : la carte nomme le modèle, propose « Choisir un autre
      modèle » (s'il y en a un autre) et « Se connecter » ; sans réglage de modèle (Bob) : carte
      d'avant, inchangée.
- [x] Choisir un autre modèle depuis la carte change le modèle de la session et renvoie le message
      refusé une fois, dans la même conversation et la même session, sans relancer l'agent ; refusé
      de nouveau : la carte revient, avec le nouveau modèle.
- [x] Mémoire `(profil, modèle)` côté main, en mémoire seulement : marquée au refus, effacée par un
      tour réussi avec ce modèle ou une reconnexion (« Réessayer » de la carte, `authenticate`) ;
      jamais de sonde, pas de filtre, l'identifiant du modèle n'est jamais découpé.
- [x] Sélecteur : modèle marqué grisé, « connexion à faire », toujours choisissable.
- [x] Icône `message-retry` masquée en « action requise » sur un refus au tour, présente à « prêt » ;
      nom accessible distinct de « Réessayer » de la carte.
- [x] Pilote : `clickLabel` échoue clairement sur un libellé ambigu, en listant les éléments trouvés.
- [x] Testé contre l'agent factice (scénarios `connexion-expiree-modele`,
      `connexion-expiree-modele-aucun`), unitaires et e2e `connexion-expiree` (clair et sombre).

## Plan

Main (`src/main/agent/`) :
- `turn-auth.ts` : `turnAuthBlocker` reçoit les réglages de la session et ajoute `model` (option
  choisie du réglage de catégorie `model`) ; `TurnAuth.resendNow` (renvoi immédiat, `resent` tenu
  pour `toolsRan`) ; `TurnAuth.retriesWithModel` (le réglage changé est-il celui du modèle d'une
  carte de tour ?).
- `refused-models.ts` (nouveau) : `RefusedModels`, ensemble `(profil, modèle)` en mémoire ;
  `markRefused` pose `authRequired` sur les options du réglage de modèle de l'instantané.
- `agent-host.ts` : `setControl` accepté en « action requise » pour le modèle d'une carte de tour,
  suivi du renvoi (`resendBlocked`, le chemin du renvoi après reconnexion, même session) ; marque
  au refus, effacement au tour réussi (`noteAnswered`) et à la reconnexion.
- `settings-store.ts` porte l'instance (une par app, rien d'écrit) ; `host-options.ts` la lie au
  profil.
- Pas de nouveau canal IPC : `agent:setControl` existant (le gestionnaire mémorise déjà le choix
  pour le profil).

Partagé : `AgentBlocker.auth.model?`, `SessionControl.options[].authRequired?`.

Renderer :
- `BlockerPanel.tsx` : variante « modèle » de la carte de tour, bouton « Choisir un autre modèle »
  qui ouvre la liste du sélecteur (`ModelMenu.tsx`, `ModelPickButton`).
- `ModelMenu.tsx` : marque « connexion à faire » ; `Composer.tsx` passe le réglage et `onSetControl`.
- `Transcript.tsx` / `App.tsx` : `messageActions.refused` masque l'icône ; libellé
  `transcript.retryBranch`. La vue côte à côte n'a pas d'actions de message : rien à masquer.

Agent factice : étape `when-model`, scénarios `connexion-expiree-modele` et
`connexion-expiree-modele-aucun` ; `MOCK_AGENT_OPTIONS=none` (`--sans-options`) pour les essais de
la carte sans modèle.

Pilote : `scripts/pilote/actions.mjs` `clickLabel` refuse l'ambiguïté.

Docs : `docs/acp.md`, `docs/mock-agent.md`, `CHANGELOG.md`, `CHANGELOG.en.md`.

Aucune nouvelle dépendance.

## Journal

- 2026-11-09 : fiche ouverte, plan écrit.
- 2026-11-09 : fait. Écarts au plan et détails :
  - Pas de nouveau canal IPC : « Choisir un autre modèle » passe par `agent:setControl`, que l'hôte
    accepte en « action requise » pour le seul réglage de modèle d'une carte de tour ; le
    gestionnaire mémorise le choix pour le profil, comme tout réglage.
  - Le renvoi ne relance pas l'agent (la session est vivante) : `TurnAuth.take` puis le renvoi
    existant `resendBlocked`, au lieu de `take/expect` + redémarrage (qui ne sert qu'après une
    connexion dans le terminal, l'agent relisant ses identifiants au démarrage).
  - Carte « modèle » : « Réessayer » n'apparaît qu'une fois la connexion lancée (ou si des outils
    avaient déjà tourné), pour coller à la maquette (deux boutons).
  - L'agent factice ayant un réglage de modèle, les essais de la carte d'avant tournent avec
    `MOCK_AGENT_OPTIONS=none` (`--sans-options`, comme Bob). L'essai du premier lancement
    (`agent-readiness.ts`) n'a pas de réglages de session : il garde la carte « Connexion expirée ».
  - Vue côte à côte : pas d'actions de message, rien à masquer.
  - Pilote : `clickLabel` refuse aussi plusieurs correspondances partielles sans correspondance
    exacte ; un cliquable dans un autre ne compte qu'une fois.
  - Reste : une marque posée dans une conversation n'apparaît dans une autre du même profil qu'à
    son prochain instantané.
  - Tests : `turn-auth-model.test.ts`, `refused-models.test.ts`, `turn-auth-manager.test.ts`
    (gestionnaire : une conversation, pas de branche), `BlockerPanel.test.tsx`,
    `Transcript.test.tsx`, `scripts/pilote/pilote.test.mjs` ; e2e `connexion-expiree` étendu
    (captures `expiree-5-modele`, `expiree-6-choix-modele`, `expiree-7-modele-marque`).
  - `./scripts/verify` vert ; `pnpm build && pnpm e2e --changed` : 188 tâches, toutes vertes sauf
    `quick light` (2 vérifications de capture d'écran : `screencapture` « could not create image
    from rect », environnement ; `quick dark` vert, aucun fichier de la capture touché).
- 2026-11-09 : relecture du tech lead, quatre corrections :
  - Outils déjà lancés pour le message refusé : choisir un autre modèle demande la même
    confirmation que « Réessayer » (« … les relancer ? », Annuler / Relancer) avant le renvoi
    (`ChooseModel`, `BlockerPanel.tsx`). Comme pour « Réessayer », la confirmation est dans
    l'interface.
  - Course dans `AgentHost.setControl` : après l'appel du réglage, le renvoi n'a lieu que si l'agent,
    la carte (le même objet) et le statut n'ont pas bougé ; le message n'est pris qu'ensuite. Essai :
    « Réessayer » pendant un réglage lent, le message part une fois (l'ancien code le perdait :
    essai rouge contre lui).
  - Statut de la liste « Modèle refusé » et invite « Choisissez un autre modèle ou connectez-vous »
    quand la carte nomme un modèle (`turn-auth-text.ts`, testé ; vérifié dans l'e2e).
  - `pnpm e2e connexion-expiree --lang en` vert, capture `en-expiree-5-modele` regardée.
  - `quick light` : vert sur une copie de `main` (archive, construite à part) et vert deux fois de
    suite sur cette branche ; l'échec précédent était passager (capture d'écran de macOS).
