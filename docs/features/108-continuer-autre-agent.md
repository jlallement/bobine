# 108 — Continuer une conversation avec l'autre agent

- **Statut** : fait
- **Dépend de** : 023 (contexte caché d'une branche), 090 (puce du modèle), 103 (fil de Bobine,
  ADR-0021), 104 (fournisseurs d'OpenCode)
- **Agents** : les deux, générique — la bascule ne passe que par ACP (`session/new`, puis le
  premier `session/prompt` avec l'échange en texte). Rien de propre à un agent : ni `_meta`, ni
  option, ni drapeau imposé ; le modèle se choisit par le réglage ACP de catégorie `model` quand
  l'agent en expose un (OpenCode), sinon pas de choix (Bob). ADR-0024.

## Pourquoi

Une conversation commencée avec Bob coûte des bobcoins à chaque tour ; une partie du travail
(relire, reformuler, petites corrections) peut se faire avec OpenCode et un modèle interne, à zéro
bobcoin. L'inverse aussi : finir avec Bob ce qu'un modèle interne n'arrive pas à faire. Aujourd'hui,
choisir un autre agent dans une conversation commencée ouvre une conversation **vide** : il faut
tout réexpliquer. On veut basculer en un geste, sans perdre le fil, et savoir exactement où partent
les messages.

## Décisions (UX et structure)

1. **Même conversation, nouvelle session** (ADR-0024). Le fil reste tel quel (il fait foi,
   ADR-0021), un avis « Suite avec OpenCode · Qwen3 32B » le coupe, l'agent de la conversation
   change, une nouvelle session ACP s'ouvre. Pas de conversation fille ni de branche : une fille
   tourne dans un autre worktree (ADR-0019) et une branche duplique le fil ; l'une et l'autre
   dispersent un même travail en deux lignes de la liste. L'ancienne session reste chez l'ancien
   agent (on peut toujours la reprendre de là-bas) ; Bobine ne la supprime pas.
2. **Le contexte part avec le prochain message de l'utilisateur**, pas tout de suite : basculer ne
   coûte rien et rien ne part avant qu'il écrive. Le fil d'avant la bascule est rendu en texte
   (messages, outils résumés avec les fichiers touchés, pièces jointes nommées, questions et
   résumés de compaction), borné à 60 000 caractères, le même rendu que le contexte d'une branche
   (fiche 023). Il est calculé à l'envoi d'après le fil (« dernière bascule sans message de
   l'utilisateur après elle ») : rien à retenir, un redémarrage entre la bascule et le message ne
   perd rien.
3. **Où** : dans le menu de l'agent de la barre de saisie, là où l'on voit le nom de l'agent et où
   l'on essaierait d'abord. Sur une conversation commencée, le menu a deux sections : « Continuer
   avec » (les autres agents installés, et leurs modèles mis en avant) et « Nouvelle conversation
   avec » (le comportement d'avant, inchangé). Sur une conversation vide, rien ne change : il n'y a
   rien à transmettre. Pas de deuxième entrée dans le menu de la conversation : un seul endroit.
4. **Modèles mis en avant** : pour chaque autre agent, les derniers modèles utilisés avec lui
   (retenus par l'app, trois au plus) puis les modèles des fournisseurs déclarés dans les réglages
   (fiche 104 : les modèles internes que l'utilisateur a choisis d'ajouter, ses vrais favoris), quatre
   lignes au plus ; puis « <agent> — autre modèle… » (« <agent>… » s'il n'y a rien à mettre en
   avant), qui ouvre la même confirmation avec la liste
   complète des modèles vus lors de sa dernière session. **Pas d'étoile de favori** : un concept de
   plus à entretenir pour deux ou trois modèles réellement utilisés, que les récents et les
   fournisseurs déclarés couvrent déjà. À rouvrir si la bêta le demande.
5. **Destination affichée avant de confirmer**, dans un dialogue : « Vos messages partiront à
   **OpenCode** — modèle **Qwen3 32B**, fournisseur **LLMaaS** (`https://…/v1`) ». La destination
   vient, dans l'ordre : du fournisseur déclaré dans le fichier de l'agent (nom et adresse, fiche
   104) ; sinon du préfixe du modèle (« fournisseur « openai », configuré dans OpenCode ») ; sinon de
   ce que le profil dit de l'agent (Bob : « le service en ligne d'IBM Bob, facturé en bobcoins » ;
   agent factice : « cet ordinateur ») ; sinon « le modèle par défaut de <agent> ». Le dialogue dit
   aussi ce qui part (« l'échange jusqu'ici, N messages, en texte avec votre prochain message ; les
   résultats complets des outils ne sont pas transmis ») et ce qui s'arrête (« IBM Bob ne reçoit plus
   rien de cette conversation »).
6. **Consommation** remise à zéro à la bascule (contexte et coût sont ceux d'une session) ; le coût
   déjà dépensé chez Bob reste dans son quota.

## Critères d'acceptation

- [x] Sur une conversation commencée, au repos, le menu de l'agent propose « Continuer avec » : les
      autres agents installés, leurs modèles récents et ceux de leurs fournisseurs déclarés (quatre
      au plus), « autre modèle… » ; puis « Nouvelle conversation avec » comme avant. Sur une
      conversation vide, le menu est inchangé.
- [x] Choisir une ligne ouvre une confirmation : modèle modifiable (liste des modèles connus de
      l'agent), destination des données (agent, modèle, fournisseur et adresse), ce qui part, ce qui
      s'arrête ; « Continuer avec <agent> » ou « Annuler ».
- [x] Après confirmation : même conversation, avis « Suite avec <agent> · <modèle> » dans le fil,
      nouvelle session chez l'agent choisi, modèle choisi appliqué ; l'ancien fil reste affiché.
- [x] Le premier message après la bascule part avec l'échange précédent en texte (une seule fois) ;
      l'interface ne montre que le message. Fonctionne après un redémarrage entre bascule et message.
- [x] Rouverte (veille, redémarrage), la conversation rouvre la session du nouvel agent ; la
      réconciliation du rejeu (ADR-0021) ne compte que les messages d'après la dernière bascule.
- [x] Les derniers modèles utilisés et la liste des modèles vus sont retenus par agent.
- [x] Testé contre l'agent factice : deux agents factices (`BOBINE_MOCK_PEER=1`), modèles d'un
      fournisseur déclaré (`MOCK_MODELS=…`), scénario `contexte-recu` qui décrit le contexte caché
      reçu ; unitaires (rendu du contexte, réconciliation, gestionnaire, cibles) ; e2e `handover`
      (clair, sombre, `--lang en`).

## Plan

Pas de nouvelle dépendance.

1. `src/shared/branch.ts` : rendu de l'échange en texte sorti en `conversationText` (partagé avec la
   branche) ; `inheritedTranscript` ne garde pas une bascule en dernier élément (le contexte de la
   branche le remplace).
2. `src/shared/handover.ts` (nouveau) : types de la vue (`HandoverTarget`, `HandoverModel`,
   `DataDestination`), `handoverContext(items)` (l'échange d'avant la dernière bascule si aucun
   message ne la suit), `sinceLastHandover(items)`, `handoverCount`, mise en avant des modèles
   (`featuredModels`), destination d'un modèle (`destinationOf`).
3. `src/shared/transcript.ts` : élément et évènement `handover` (`from`, `to`, `model`), consommation
   remise à zéro. `src/shared/replay-tail.ts` : ne compte que ce qui suit la dernière bascule.
   `src/shared/export.ts` : la bascule dans l'export.
4. `src/main/settings.ts`, `settings-store.ts` : `modelsSeen` (réglage `model` d'un agent : id,
   options) et `recentModels` (trois par agent), tenus par `noteModels` à chaque instantané (écrits
   seulement s'ils changent).
5. `src/main/conversations/manager.ts` : `switchAgent(id, profileId, event)` (agent arrêté, profil
   changé, session oubliée, avis posé, nouvel agent démarré) ; `noteModels` sur les instantanés ;
   contexte de la bascule joint par `extraContext`. Lignes libérées ailleurs dans le fichier
   (plafond 1050).
6. `src/main/conversations/handover.ts` (nouveau) : `handoverTargets` (agents installés autres que
   celui de la conversation, modèles récents, des fournisseurs, vus ; destinations), `continueWith`
   (vérifie, bascule, attend l'agent, applique le modèle par le réglage de catégorie `model`),
   canaux `conversation:handoverTargets` et `conversation:continueWith`.
7. `src/main/agent/profiles.ts` : `destination` (texte) pour Bob et l'agent factice ; second agent
   factice `mock-peer` (« Agent factice B ») avec `BOBINE_MOCK_PEER=1`, fournisseurs lus comme
   OpenCode.
8. IPC : `src/shared/ipc.ts`, `src/main/ipc.ts`, `src/preload/api.ts`.
9. Renderer : `AgentMenu` (sections), `HandoverDialog` (destination, modèle avec la liste de la
   fiche 092), avis dans le fil, textes `fr.json` / `en.json`.
10. Agent factice : `MOCK_MODELS=<valeur=nom,…>` ajoute des modèles ; scénario `contexte-recu`.
11. Essais : unitaires, e2e `handover` ; docs (`acp.md`, `agents.md`, `mock-agent.md`,
    `architecture.md`), ADR-0024, changelogs.

## Journal

- 2026-10-21 — Fiche créée (feuille de route de l'audit du 2026-10-21, section 9, point 3).
  Décisions ci-dessus prises en UX senior ; même conversation recommandée par la session
  coordinatrice, retenue.
- 2026-10-21 — Fait, comme prévu, avec ces écarts :
  - **Ce que voit l'utilisateur** : dans une conversation commencée, le menu de l'agent montre
    « Continuer avec » (ex. « OpenCode · Qwen3 32B — LLMaaS », « OpenCode — autre modèle… »,
    « IBM Bob… »), puis « Nouvelle conversation avec ». La confirmation donne le modèle (liste
    modifiable, « Modèle par défaut de … » en tête), l'encadré « Vos messages partiront à » (agent,
    modèle, fournisseur, adresse — ou « Service : le service en ligne d'IBM Bob, facturé en
    bobcoins »), ce qui part (« L'échange jusqu'ici (N messages) partira en texte avec votre prochain
    message, pas avant… ») et ce qui s'arrête. Dans le fil : un trait « Suite avec OpenCode · Qwen3
    32B », « Avant : IBM Bob… ».
  - **Comment** : `ConversationManager.switchAgent` (refus pendant une réponse) ;
    `conversations/handover.ts` (cibles, destinations, `continueWith` : bascule, puis modèle réglé
    par `setControl` une fois l'agent prêt, avis s'il ne le propose pas) ; `shared/handover.ts`
    (contexte déduit du fil, joint par `extraContext`) ; `agent/models-seen.ts` et
    `SettingsStore.noteModels` (réglage `models` de `settings.json` : liste vue et trois derniers
    modèles, écrits seulement s'ils changent, sans prévenir les abonnés).
  - **Écarts** : le gestionnaire dépassait son plafond (1059 / 1050) : les options de l'hôte
    d'agent sont sorties dans `conversations/host-options.ts` (découpage déjà listé par l'audit).
    `AgentMenu` sort de `common/Menus.tsx` vers `composer/AgentMenu.tsx` (il n'est utilisé que là).
    Mise en avant et destination (`targetModels`, `destinationOf`) vivent côté main
    (`conversations/handover.ts`, ils lisent les fournisseurs) et non dans `shared/handover.ts`.
    `shortModelName` / `modelProvider` passent dans `shared/models.ts` (main et interface). Le nom
    du modèle de l'avis vient de la liste montrée dans le menu (vu chez l'agent, sinon celui du
    fournisseur déclaré). L'agent factice gagne `--nom` (sinon les deux agents factices
    s'annonçaient pareil et la puce restait sur « Agent factice »). Le texte sous le trait du fil dit
    « transmis avec le premier message » (il reste juste après l'envoi).
  - **Essais** : unitaires (`shared/handover.test.ts`, `replay-tail.test.ts`,
    `agent/models-seen.test.ts`, `conversations/handover.test.ts` : bascule réelle entre deux agents
    factices — modèle réglé, contexte reçu une fois, refus pendant une réponse, conversation vide) ;
    e2e `pnpm e2e handover` (clair, sombre, `--lang en`), captures `h1` à `h4` regardées ; `base`,
    `branch`, `composer` repassées. `./scripts/verify` vert.
  - **Essai réel OpenCode 2.0.32** (gestionnaire seul, modèle gratuit `opencode/big-pickle`) :
    conversation commencée avec l'agent factice (« Je m'appelle Léa et mon projet s'appelle
    Tournesol. »), bascule vers OpenCode, puis « Quel est mon prénom et le nom de mon projet ? » →
    « Votre prénom est Léa et votre projet s'appelle Tournesol. » ; modèle réglé.
  - **Non vérifié** : **Bob réel** (bascule vers Bob et depuis Bob : coûte des bobcoins, laissé à
    l'utilisateur) ; un vrai fournisseur interne (LLMaaS) derrière le proxy ; la suite e2e complète
    (`pnpm e2e`, à lancer avant le push du lot).
  - **Reste** : étoile de favori non faite (décision 4) ; « Supprimer aussi chez l'agent » ne
    supprime pas les sessions des agents d'avant (ADR-0024).

- 2026-10-26 — Livraison du lot familles (fiche 151) : ouverture du menu au clavier dans l’essai
  e2e, puis choix souris, pour éviter que le relâchement CDP du clic d’ouverture sélectionne une
  destination arrivée sous le pointeur. Mêmes contrôles de destination, confirmation, fil, titre
  et contexte transmis une fois ; aucun changement du menu du produit.
