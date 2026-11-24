# Inventaire e2e — groupe C

Étape 1 de la remise à l'endroit de la pyramide des tests (environ 30 e2e de parcours, le détail
en tests de composant Vitest + Testing Library). **Inventaire seulement : aucun test n'est
supprimé ni modifié.** Établi le 2026-11-24 par lecture des suites (rien n'a été lancé) ; chaque
test cité dans « Déjà couvert ? » a été retrouvé par recherche dans `src/**/*.test.*` et
`e2e/suites/parcours-*.mjs` ; les fichiers marqués « à créer » n'existent pas encore.

Classes : `parcours` (reste e2e), `composant`, `unitaire-main`, `capture` (capture nocturne),
`doublon` (déjà vérifié ailleurs). « Couvert » compte aussi les couvertures partielles
(« partiel : … » dans le tableau).

**Remplaçants du panneau (2026-11-24)** : 10 lignes passées à « oui » (`session` 3, 4, 13, 31, `onglets-etroits` 2, 6–10). Les chiffres du résumé restent ceux de l'inventaire.

## Résumé chiffré

- **41 suites**, **656 vérifications** (chaque `check` ; une `check` dans une boucle compte une fois).
- Par classe : **parcours 124** (19 %) · **composant 257** (39 %) · **unitaire-main 71** (11 %) ·
  **capture 61** (9 %) · **doublon 143** (22 %).
- **Déjà couvertes ailleurs (en tout ou en partie) : 522 / 656** ; 134 sans aucun test équivalent.
- Verdicts : **10 suites supprimables entièrement** (sous condition, voir chaque verdict),
  **28 à réduire** (garder quelques vérifications, souvent à déplacer dans une journée type),
  **3 à garder** (`pannes-visibles` allégée, `parcours-longue`, `parcours-pannes`).

**Supprimables** (après ajout des tests ou étapes indiqués dans leur verdict) : `filles-non-commite`,
`reprise`, `command-output`, `libelles`, `long-thread`, `activity`, `pinned-plan`, `relecture`,
`tables`, `touches`.

**À garder** : `pannes-visibles` (9 vérifs sur processus réels : SIGKILL, kill -9, orphelins),
`parcours-longue`, `parcours-pannes`.

| Suite | Vérifs | parcours | composant | unit.-main | capture | doublon | couvert | Verdict |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `filles` | 51 | 5 | 13 | 1 | 0 | 32 | 48 | à réduire |
| `filles-non-commite` | 15 | 1 | 0 | 0 | 0 | 14 | 15 | supprimable |
| `handover` | 8 | 1 | 4 | 1 | 0 | 2 | 7 | à réduire |
| `inbox` | 25 | 2 | 2 | 0 | 5 | 16 | 21 | à réduire |
| `roles-export` | 17 | 2 | 2 | 0 | 1 | 12 | 15 | à réduire |
| `roles-travail` | 37 | 3 | 24 | 0 | 7 | 3 | 33 | à réduire |
| `session` | 31 | 3 | 24 | 2 | 1 | 1 | 30 | à réduire |
| `connexion-expiree` | 22 | 2 | 13 | 5 | 0 | 2 | 22 | à réduire |
| `pannes-visibles` | 24 | 9 | 12 | 1 | 0 | 2 | 22 | garder |
| `reprise` | 4 | 0 | 1 | 0 | 0 | 3 | 4 | supprimable |
| `failures` | 11 | 1 | 0 | 6 | 0 | 4 | 11 | à réduire |
| `autorisation-commande` | 48 | 2 | 31 | 5 | 10 | 0 | 37 | à réduire |
| `browser` | 48 | 21 | 5 | 18 | 2 | 2 | 37 | à réduire |
| `annotate` | 7 | 4 | 2 | 0 | 1 | 0 | 4 | à réduire |
| `command-output` | 5 | 1 | 2 | 0 | 2 | 0 | 3 | supprimable |
| `commit-choisi` | 8 | 1 | 6 | 1 | 0 | 0 | 8 | à réduire |
| `branch` | 12 | 3 | 5 | 3 | 0 | 1 | 8 | à réduire |
| `perf` | 25 | 15 | 3 | 0 | 0 | 7 | 15 | à réduire |
| `usage-board` | 29 | 2 | 5 | 2 | 5 | 15 | 23 | à réduire |
| `quota` | 13 | 4 | 1 | 2 | 0 | 6 | 11 | à réduire |
| `versions` | 10 | 3 | 3 | 0 | 0 | 4 | 10 | à réduire |
| `debordements` | 11 | 0 | 0 | 0 | 6 | 5 | 5 | à réduire |
| `onglets-etroits` | 10 | 2 | 6 | 0 | 2 | 0 | 3 | à réduire |
| `polices` | 7 | 2 | 3 | 0 | 0 | 2 | 5 | à réduire |
| `libelles` | 4 | 0 | 2 | 0 | 0 | 2 | 3 | supprimable |
| `long-thread` | 4 | 0 | 1 | 0 | 0 | 3 | 4 | supprimable |
| `activity` | 14 | 0 | 12 | 0 | 1 | 1 | 12 | supprimable |
| `attachments` | 17 | 2 | 13 | 1 | 0 | 1 | 14 | à réduire |
| `discussion` | 16 | 3 | 11 | 2 | 0 | 0 | 15 | à réduire |
| `fun` | 10 | 1 | 5 | 2 | 0 | 2 | 7 | à réduire |
| `mentions` | 6 | 1 | 2 | 3 | 0 | 0 | 5 | à réduire |
| `notifications` | 15 | 3 | 0 | 12 | 0 | 0 | 13 | à réduire |
| `parcours-longue` | 10 | 9 | 1 | 0 | 0 | 0 | 4 | garder |
| `parcours-pannes` | 9 | 9 | 0 | 0 | 0 | 0 | 1 | garder |
| `pinned-plan` | 9 | 0 | 6 | 0 | 3 | 0 | 6 | supprimable |
| `presentation` | 13 | 2 | 6 | 1 | 4 | 0 | 9 | à réduire |
| `questions` | 15 | 2 | 12 | 0 | 0 | 1 | 13 | à réduire |
| `relecture` | 10 | 0 | 8 | 1 | 1 | 0 | 9 | supprimable |
| `sommaire` | 8 | 3 | 4 | 0 | 1 | 0 | 3 | à réduire |
| `tables` | 10 | 0 | 1 | 0 | 9 | 0 | 5 | supprimable |
| `touches` | 8 | 0 | 6 | 2 | 0 | 0 | 6 | supprimable |
| **Total** | **656** | **124** | **257** | **71** | **61** | **143** | **522** | 10 / 28 / 3 |

## Risques repérés (synthèse ; le détail est en fin de chaque lot)

Ce qu'un test de composant (jsdom, `window.api` simulé) ne verrait pas :

1. **Chaînes à travers l'IPC** : chaque morceau est testé seul, l'enchaînement renderer → preload →
   main → agent seulement en e2e (choix de lancement d'une fille, `@rôle` en premier message,
   fichiers cochés d'un commit, contexte repris d'une branche, sortie de commande ACP → terminal).
   C'est le type de défaut de la fiche 277 : à reporter en étapes de journées types avant de supprimer.
2. **Erreurs IPC perdues** : le renderer qui interroge une conversation supprimée (`Conversation
   inconnue`, défaut n° 1 de la fiche 277) ne se voit qu'au journal du main en e2e.
3. **Mise en page réelle** : jsdom ne charge pas `styles.css` et ne calcule ni largeur ni position
   (débordements, grille de la barre latérale, onglets étroits, cartes « fichier » serrées, pastille
   « lecture seule », repli « Lire la suite », ancrage du défilement, bouton sous le pointeur,
   `elementFromPoint` des ✕ d'onglet). Les passer en « capture » ne protège que si les captures
   nocturnes sont **comparées automatiquement** ou si les sondes de mesure (`MEASURE`, `rowState`,
   `layout`) restent et échouent : sinon ces régressions ne seront plus vues du tout.
4. **Sécurité** : fin de commande atteignable et molette contenue dans la carte d'autorisation
   (vraie mise en page) ; garde de navigation du navigateur intégré (SEC-1) ; secret du proxy
   absent de **toute** la page (contrôle global, pas par composant) — à garder en e2e.
5. **Natif / Chromium** : WebContentsView masquée sous les Réglages, popups et `confirm()`, CDP
   réel des outils de débogage, canvas de l'annotation, presse-papiers système, glisser-déposer
   (`webUtils.getPathForFile`), vrai Dock et bannières, menu natif mis à jour par le renderer,
   polices livrées par le protocole de l'app (CSP, empaquetage), polices du système.
6. **Processus et redémarrages** : SIGKILL, orphelins, pty réel (commande vue « en cours »,
   connexion dans le terminal), quota tué à la sortie, persistance après relance (consignes de
   filles, `versionNotices`), vrai serveur MCP lancé une seule fois par « Mesurer », `ask_user`
   par le MCP de l'app.
7. **Budgets de performance** (`perf`) : seule une vraie fenêtre mesure tâches longues, nœuds et
   blocages de la boucle d'évènements.
8. **Trous de couverture à combler avant toute suppression** (aucun test aujourd'hui) :
   `system-notifier.ts` ; composants `ChildDialog` (agent/modèle par défaut), `title-origin`,
   `AgentMenu`, `HandoverDialog`, `PlanApproval`, `DocumentCards`, `DocumentsPanel`,
   `ContinueInProjectDialog`, `Welcome`, `BranchDialog`, `ToolCall` ; réglages « propositions de
   filles » et plafond ; menu « + » du panneau et compteur d'onglet ; infobulle du bouton
   d'autorisation ; dossiers récents de `DataSettings` ; lien `usage-open-board` ;
   `--code-ligatures` (`appearance.ts`) ; statut « n'a pas pu démarrer » de la saisie.
9. **Sommaire** : `parcours-longue` (36 échanges) ne déclenche sans doute pas le regroupement du
   sommaire ; l'agrandir ou garder `sommaire.mjs` réduite.

---

## Lot 1

Suites : `filles.mjs`, `filles-non-commite.mjs`, `handover.mjs`, `inbox.mjs`, `roles-export.mjs`.
Chemins de tests abrégés : `C/` = `src/renderer/src/components/`, `M/` = `src/main/`, `S/` = `src/shared/`, `R/` = `src/renderer/src/`.

### `filles.mjs` — conversations filles : lancées à la main (carte, vue Filles, suppression de la mère), lancées par l'agent (propositions, réveil, plafond, messages, consignes, redémarrage), proposées sans consigne (réglage, contexte de session, `/split`).

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Modifications sans fille : pas de vue « Filles » | bouton de vue absent sans fille | doublon | — | `C/panel/ChildrenView.test.tsx` › « sans fille : ni bouton ni vue » |
| 2 | Fenêtre : agent et modèle de la mère par défaut | `ChildDialog` préremplit agent/modèle de la mère | composant | `C/sidebar/ChildDialog.test.tsx` (existant, cas à ajouter) | non |
| 3 | La fille est sous sa mère, la mère reste affichée | rangement sous la mère, pas de changement de conversation | doublon | `parcours-deleguer`, étape 1 | `parcours-deleguer.mjs` › « trois travaux finis, chacun dans son worktree ; la mère reste affichée » ; `C/sidebar/Sidebar.test.tsx` › « nouvelle fille : visible dès la liste reçue, même sous le pointeur (diagnostic 149) » |
| 4 | Carte seule : branche, fichiers, réponse, en attente ; rien de séparé | contenu de la carte d'une fille sans rôle (fiche 264) | composant | `C/thread/WorkGroup.test.tsx` (existant) | partiel : `C/thread/WorkGroup.test.tsx` › « sans rôle : son titre, « un autre <agent> », sa fusion dans la carte » ; `C/thread/WorkCard.test.tsx` › « rôle qui écrit : branche, fichiers, non commité laissé, « Voir les modifications » » |
| 5 | Coût de la fille au pied de sa réponse (« ≈ ») | pied de carte avec coût estimé | composant | `C/thread/WorkCard.test.tsx` (existant) | partiel : `C/thread/WorkCard.test.tsx` › « a répondu : la réponse entière, repliée, « Lire la suite » ; pied « heure · durée · gratuit » » |
| 6 | Liste : fille finie, lue chez sa mère affichée, état et infobulle | état `done`, non-lu levé, origine en infobulle | doublon | — | `C/sidebar/Sidebar.test.tsx` › « à droite : roue, coche verte d’une fille finie (le mot pour les lecteurs), sinon le jour » ; `M/notifications/attention.test.ts` › « mère affichée quand le compte rendu y arrive : la fille n’a plus rien à lire » |
| 7 | La fille travaille dans son worktree (dépôt propre) | worktree git réel, dossier de la mère intact | doublon | `parcours-deleguer`, étape 1 | `M/conversations/children.test.ts` › « lancée depuis la mère : worktree, consigne, compte rendu, nouvelles transmises une fois » |
| 8 | Deux lancements, deux cartes ; la deuxième attend l'accord | carte en état `waiting` | composant | `C/thread/WorkCard.test.tsx` (existant) | partiel : `C/thread/WorkCard.test.tsx` › « fiche 267 : un travail qui attend autre chose (une autorisation) garde « Attend votre réponse » » |
| 9 | Vue « Filles » : filles directes, ordre des cartes, branche | contenu et ordre de `ChildrenView` | doublon | — | `C/panel/ChildrenView.test.tsx` › « filles directes seulement, dans l’ordre des lancements » et « une ligne par fille : branche, compte rendu, recommandation, actions » |
| 10 | Vue « Filles » : « Faire relire » ouvre la relecture sur sa branche | action de ligne → dialogue du Code reviewer, portée branche | composant | `C/panel/ChildrenView.test.tsx` (existant, cas à ajouter) | partiel : `C/panel/ChildrenView.test.tsx` › « une ligne par fille : branche, compte rendu, recommandation, actions » |
| 11 | Le compte rendu part avec le prochain message | `<child_conversations>` joint, `work-relay` passé à `sent` | doublon | — | `M/conversations/children.test.ts` › « lancée depuis la mère : worktree, consigne, compte rendu, nouvelles transmises une fois » ; `C/thread/WorkCard.test.tsx` › « transmise : action principale retirée, réponse discrète ; pas « transmise » si le tour a échoué » |
| 12 | … et une seule fois | pas de répétition ni de réveil | doublon | — | `M/conversations/children-wake.test.ts` › « un message de la mère emporte les comptes rendus : pas de réveil pour eux » |
| 13 | « Ouvrir » affiche la fille | navigation carte → fille | doublon | `parcours-deleguer`, étape 2 | `parcours-deleguer.mjs` › « le travail répond dans sa conversation, le lien vers la mère est là » |
| 14 | Fille : « ↳ depuis « mère » » en en-tête, départ en tête du fil | en-tête d'origine + `worktree-origin` premier | composant | `C/thread/ConversationTitle.test.tsx` (à créer) | partiel : `C/thread/WorktreeStart.test.tsx` › « branche et commit en code, date, sujet, modifications non commitées, « Vue Git » » |
| 15 | « ↳ depuis » ramène à la mère | lien d'origine navigue | doublon | `parcours-deleguer`, étape 2 | `parcours-deleguer.mjs` étape « ouvrir un travail, lui répondre, revenir à la mère » |
| 16 | Dossiers : deux filles sous leur mère, dossier du dépôt | regroupement par projet, pas par worktree | doublon | — | `C/sidebar/Sidebar.test.tsx` › « deux filles en worktree sous leur mère, dans son dossier ; pas de compteur » ; `C/sidebar/history-order.test.ts` › « par projet, pas par dossier de worktree ; une fille dans le dossier de sa mère » |
| 17 | Suppression : 3 filles nommées, case cochée, celle au travail signalée | `DeleteDialog` famille + fille occupée « s'arrêtera » | composant | `C/sidebar/DeleteDialog.test.tsx` (existant) | partiel : `C/sidebar/DeleteDialog.test.tsx` › « nomme la descendance sous ses mères, case cochée : la famille part avec la mère » |
| 18 | Case décochée : la fille au travail le reste | libellé `childBusy` | doublon | — | `C/sidebar/DeleteDialog.test.tsx` › « case décochée : les filles restent, la note le dit » |
| 19 | Mère supprimée : aucune lecture d'une conversation supprimée (journal) | le renderer n'interroge plus le main pour un id disparu (tous canaux IPC) | parcours | garder ici ou `parcours-deleguer` étape 6 (variante case décochée) | partiel : `parcours-deleguer.mjs` étape « supprimer la mère (et ses travaux) » (journal propre, case cochée) |
| 20 | Mère supprimée (décochée) : filles en conversations ordinaires | détachement des filles | doublon | — | `M/conversations/children.test.ts` › « mère archivée ou supprimée : la fille devient une conversation ordinaire » |
| 21 | `start_child` : carte « 1 travail proposé », appel caché | carte de groupe à la place de l'outil | doublon | — | `C/thread/ChildProposals.test.tsx` › « une ligne par proposition, le compte, la consigne dépliable » ; `C/thread/WorkGroup.test.tsx` › « lancement refusé (appel caché derrière la carte) : « pas lancé », la raison en infobulle » |
| 22 | Ligne : consigne dépliable, agent et modèle de la mère | options de la proposition | doublon | — | `C/thread/ChildProposals.test.tsx` › « agent et modèle proposés par la mère, présélectionnés, et sa raison (fiche 160) » |
| 23 | Deuxième `start_child` : même carte, deux lignes, la première lancée sur place | proposition ajoutée à la carte existante | composant | `C/thread/WorkGroup.test.tsx` (existant) | partiel : `C/thread/WorkGroup.test.tsx` › « « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé » |
| 24 | Travail fini, réponse remise plus tard : « a répondu », compté, infobulle | état `pending` affiché | doublon | — | `C/thread/WorkGroup.test.tsx` › « réponse remise à la fin de celle de l’agent : « a répondu », compté même avec une proposition » |
| 25 | Lignes lancées : plus de bouton, « 2 travaux » | titre de carte après lancement | doublon | — | `C/thread/WorkGroup.test.tsx` › « « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé » |
| 26 | Au-delà de la limite d'agents vivants, aucune fille arrêtée | éviction épargne les filles (fiche 043) | doublon | — | `M/conversations/children.test.ts` › « éviction (fiche 043) : une fille qui démarre ou travaille n’est jamais arrêtée pour faire de la place » |
| 27 | Deux filles lancées par l'agent, sous la mère, sur leurs lignes | filles créées par `start_child` | doublon | — | `M/conversations/children.test.ts` › « `filles` : deux accords, deux filles, un seul réveil avec les comptes rendus » |
| 28 | Réveil groupé : une fois, deux comptes rendus | un seul `wake-message` | doublon | — | `M/conversations/children.test.ts` › « réveil groupé : une fois, avec les comptes rendus des filles lancées par l’agent » ; `M/conversations/children-wake.test.ts` › « une seule fois, quand toutes les filles attendues ont fini et la mère est au repos » |
| 29 | « Faire ici » : consigne rendue à l'agent, pas de fille | issue `here` | doublon | — | `M/conversations/children.test.ts` › « « Faire ici » (fiche 112) : la consigne revient à l’agent, aucune fille » |
| 30 | `start_child` refusé : résultat clair, pas de fille | issue `refuse` | doublon | — | `M/conversations/children.test.ts` › « `filles-refus` : refus clair, aucune fille » |
| 31 | Rafale : pointeur en place avant les propositions suivantes | précondition de mise en page réelle | parcours | garder ici | partiel : `R/useThreadScroll.test.ts` › « sans envoi, une carte qui arrive sous un pointeur immobile retient le fil (fiche 124) » |
| 32 | Rafale : ajoutées dessous, « Lancer » immobile sous le pointeur | pas de saut de mise en page sous la souris (pixels, `elementFromPoint`) | parcours | garder ici | partiel : `C/thread/ChildProposals.test.tsx` › « arrivée pendant le tour : sous les lignes affichées, la ligne dépliée ne bouge pas (fiche 124) » |
| 33 | Pointeur sorti de la carte : le fil reprend le bas | défilement réel rattrape le bas | parcours | garder ici (avec 31-32) | partiel : `R/useThreadScroll.test.ts` › « pointeur sur une carte qui le demande : le fil ne suit plus, puis rattrape le bas (fiche 124) » |
| 34 | Rafale refusée : le tour finit, pas de fille | trois refus enchaînés finissent le tour | unitaire-main | `M/conversations/children.test.ts` (scénario `filles-rafale` à ajouter) | non |
| 35 | Au-delà du plafond : erreur qui cite le réglage | plafond `maxChildren` | doublon | — | `M/conversations/children.test.ts` › « `filles-plafond` : au-delà du plafond, une erreur qui cite le réglage » |
| 36 | « Lancer en parallèle… » grisé au plafond, infobulle | menu désactivé + raison | composant | `C/sidebar/Sidebar.test.tsx` (existant, infobulle à ajouter) | partiel : `C/sidebar/Sidebar.test.tsx` › « « Lancer en parallèle… » : désactivé au plafond des filles en cours (ADR-0020) » |
| 37 | `message_child` : en file de la fille, « De la conversation mère » | provenance dans la file | doublon | — | `C/composer/QueuedMessages.test.tsx` › « message d’une autre conversation : sa provenance devant le texte (fiche 097) » ; `M/conversations/children.test.ts` › « messages : file d’attente de la conversation visée, avec leur provenance » |
| 38 | La fille reçoit le message en sachant d'où il vient | contexte de provenance à l'agent | doublon | — | `M/conversations/children.test.ts` › « `fille-message` : de la mère à la fille, puis de la fille à la mère » |
| 39 | `message_parent` : dans la mère, « De la conversation fille » | provenance affichée chez la mère | doublon | — | `C/thread/Transcript.test.tsx` › « étape 2 : lancée par l’agent, compte rendu qui attend son réveil, provenance des messages » |
| 40 | Consigne initiale repliée par défaut | `work-brief` fermé | composant | `C/thread/WorkGroup.test.tsx` (existant) | partiel : `C/thread/WorkGroup.test.tsx` › « une ligne se déplie sur la carte-réponse du travail : réponse entière, transmission, Ouvrir » |
| 41 | Consigne initiale complète, identique au lancement | texte entier | doublon | — | `C/thread/WorkGroup.test.tsx` › « une ligne se déplie sur la carte-réponse du travail : réponse entière, transmission, Ouvrir » |
| 42 | Consigne `message_child` repliée par défaut (×2 : avant / après redémarrage) | `work-note` fermé | composant | `C/thread/WorkGroup.test.tsx` (existant) | partiel : `C/thread/WorkGroup.test.tsx` › « message de l’agent au travail : dans sa carte ; recommandation : la pastille seule » |
| 43 | Consigne rattachée à la bonne fille (×2) | note sur la bonne ligne | composant | `C/thread/WorkGroup.test.tsx` (existant) | partiel : même test « message de l’agent au travail : dans sa carte… » |
| 44 | Texte de `message_child` sans troncature (×2, dont après redémarrage) | persistance du fil + rendu entier | parcours | garder la variante après redémarrage (ou `parcours-deleguer` étape 10) | partiel : `C/thread/WorkGroup.test.tsx` › « message de l’agent au travail : dans sa carte ; recommandation : la pastille seule » |
| 45 | Recherche des réglages : « Proposer des conversations filles », « Quand ça s'y prête » par défaut | réglage trouvable, valeur par défaut | composant | `C/settings/ConversationSettings.test.tsx` (à créer) | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/SettingsPages.test.tsx` › « « Proposer des travaux » (ex-« conversations filles ») se trouve ; « Quand ça s’y prête » par défaut » — avant : non |
| 46 | « Jamais » : pas de carte, l'agent fait lui-même | réglage coupe le contexte | doublon | — | `M/conversations/children.test.ts` › « `chantiers` (fiche 118) : « Jamais » : il fait le travail lui-même ; `/split` : il propose » |
| 47 | « Quand ça s'y prête » : carte « Tâches proposées » sans consigne | contexte de session → propositions | doublon | — | `M/conversations/children.test.ts` › « contexte de session (fiche 118) : la mère le reçoit une fois, pas sa fille ; `chantiers` propose alors des filles » |
| 48 | L'agent a proposé grâce au contexte de session | contexte effectivement reçu | doublon | — | même test (fiche 118, contexte de session) |
| 49 | Le contexte de session ne part qu'une fois | une fois par session | doublon | — | même test (fiche 118, contexte de session) |
| 50 | `/split` : le message tapé part, sans la commande | commande retirée du message | doublon | — | `R/app-commands.test.ts` › « /split envoie le message avec la demande de découpage ; seul, il explique (fiche 118) » ; `M/agent/message-queue.test.ts` › « /split (fiche 118) : la demande reste attachée au message, tapé avec la commande » |
| 51 | `/split` : carte sur demande même réglé « Jamais » | demande explicite prime | doublon | — | `M/conversations/children.test.ts` › « `chantiers` (fiche 118) : « Jamais » : il fait le travail lui-même ; `/split` : il propose » |

**Verdict** : à réduire (garder 5 vérifs : 19, 31-33, 44) — l'essentiel est déjà en tests main (`children*.test.ts`, agent factice + git réel) et composants ; garder la suppression de la mère affichée (journal IPC), la rafale sous le pointeur (mise en page réelle) et la consigne après redémarrage. Les cas composant non couverts (2, 14, 45) sont à créer avant suppression.
<!-- stats suite=filles total=51 parcours=5 composant=13 unitaire-main=1 capture=0 doublon=32 couvert=48 verdict=reduire -->

### `filles-non-commite.mjs` — filles et travail non commité de la mère : rôle cité (ligne orange, voir, partir sans, juste un avis), tâches proposées (committer d'abord, `.env` décoché), dépôt sans commit.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Rôle : une ligne orange sous la saisie, aucun encadré | `LaunchLine` en `warn`, compte 1 | doublon | — | `C/roles/RoleComposerUncommitted.test.tsx` › « rôle qui écrit, dossier modifié : ni encadré ni bouton, la ligne en orange ; Entrée envoie » |
| 2 | « Changer… › Voir la modification » liste le fichier | liste des fichiers non commités | doublon | — | `C/roles/RoleComposerUncommitted.test.tsx` › « « Voir les N modifications » : la liste sous la ligne, les autres comptées » |
| 3 | Entrée : la fille ne voit pas le non commité | choix affiché → worktree depuis HEAD, de bout en bout (renderer → IPC → main → git → agent) | parcours | `parcours-deleguer`, étape à ajouter (dossier modifié, Entrée) | partiel : `M/conversations/children-uncommitted.test.ts` › « « Partir sans elles » : la fille part du commit sans le fichier, la mère le rappelle » |
| 4 | Partie sans elles : rappel sur sa carte-réponse | `work-left-behind` | doublon | — | `C/thread/ChildReportLeftBehind.test.tsx` › « la ligne dit le commit de départ et ce qui manquait » |
| 5 | Avis : la ligne dit « dans ce dossier » | libellé `sameFolder` après « Juste un avis » | doublon | — | `C/roles/RoleComposerUncommitted.test.tsx` › « « Juste un avis » : appliqué tout de suite, la ligne le dit, Entrée l’envoie ainsi » |
| 6 | Avis en lecture seule : les deux filles voient le plan | lecture seule dans le dossier de la mère | doublon | — | `M/conversations/children-uncommitted.test.ts` › « avis en lecture seule : dans le dossier de la mère, sans worktree, il voit le non commité » |
| 7 | Tâches proposées : ligne discrète, « Lancer » n'attend pas | carte : partir sans elles par défaut | doublon | — | `C/thread/ChildProposals.test.tsx` › « une ligne discrète pour la carte, sans encadré ; « Lancer » part sans elles, dit » |
| 8 | Committer d'abord : liste complète (`.env` compris), tout coché | `CommitChooser` | doublon | — | `C/panel/CommitChooser.test.tsx` › « la liste complète, toutes cochées ; longue, elle défile et se déplie » |
| 9 | `.env` décoché : hors du message, « partira sans lui » | brouillon refait, ligne `launchLine.left` | doublon | — | `C/panel/CommitChooser.test.tsx` › « un fichier décoché ne part pas, et le message ne le cite pas » ; `C/panel/CommitDraft.test.tsx` › « cases changées après la réponse : le message retouché reste, « Rédiger à nouveau » le remplace » |
| 10 | Commit : `plan.md` seul, `.env` reste non suivi | commit git réel des cochés | doublon | — | `M/conversations/children-uncommitted.test.ts` › « fiche 244 : commit des cochés seulement ; la fille part sans le .env décoché, rappelé » |
| 11 | Commit puis Lancer : la fille voit `plan.md`, sans `.env` (rappelé) | fille partie du nouveau commit | doublon | — | même test (fiche 244) ; `C/thread/ChildProposals.test.tsx` › « fiche 244 : un fichier décoché ne part pas ; « Lancer » part sans lui » |
| 12 | Dépôt sans commit : le rôle travaillera dans ce dossier, rien à choisir | ligne `noCommit.role`, pas de « Changer… » | doublon | — | `C/roles/RoleComposerUncommitted.test.tsx` › « dépôt sans commit : dans ce dossier, sans « Changer… » ni « () » ; l’envoi part » |
| 13 | Dépôt sans commit : la fille voit le plan, ni worktree ni commit | jamais de commit vide | doublon | — | `M/conversations/children-uncommitted.test.ts` › « rôle qui écrit, sans choix : il part dans le dossier, sans worktree ni commit » |
| 14 | Tâches proposées, sans commit : « dans ce dossier » | ligne `noCommit.work` sur la carte | doublon | — | `C/thread/ChildProposals.test.tsx` › « dépôt sans commit : dans ce dossier, ni worktree ni choix ; « Lancer » part sans rien » |
| 15 | Proposition lancée : dans le dossier, toujours aucun commit | `start_child` sans commit vide | doublon | — | `M/conversations/children-uncommitted.test.ts` › « fille sans rôle (« Lancer en parallèle… », `start_child`) : dans le dossier aussi » ; `M/mcp/children-tools.test.ts` › « fiche 262 : dépôt sans commit, la fille écrit dans le dossier ; jamais de commit vide » |

**Verdict** : supprimable entièrement — à condition de reporter la vérif 3 (un envoi `@rôle` sur dossier modifié, la fille ne voit pas le fichier) comme une étape de `parcours-deleguer`. Tout le reste est vérifié à l'identique par `children-uncommitted.test.ts` (git réel + agent factice) et par les tests de composant.
<!-- stats suite=filles-non-commite total=15 parcours=1 composant=0 unitaire-main=0 capture=0 doublon=14 couvert=15 verdict=supprimable -->

### `handover.mjs` — « Continuer avec » un autre agent : menu, confirmation, bascule dans la même conversation, contexte transmis une fois, titre gardé.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Menu : l'autre agent avec le modèle du fournisseur déclaré, puis « autre modèle… » | `AgentMenu` propose les destinations | composant | `C/composer/AgentMenu.test.tsx` (à créer) | partiel : `M/conversations/handover.test.ts` › « modèles : récents, puis fournisseurs déclarés (4 au plus), puis les autres vus » |
| 2 | Destination : agent, modèle, fournisseur, adresse | `HandoverDialog` affiche où partent les messages | composant | `C/composer/HandoverDialog.test.tsx` (à créer) | partiel : `M/conversations/handover.test.ts` › « fournisseur déclaré, sinon préfixe, sinon ce que dit le profil, sinon rien » |
| 3 | Ce qui part (2 messages) et ce qui s'arrête | compte et nom de l'agent d'avant | composant | `C/composer/HandoverDialog.test.tsx` (à créer) | partiel : `S/handover.test.ts` › « messages comptés et nom affiché » |
| 4 | Même conversation : trait « Suite avec », nouvel agent, son modèle, fil gardé | bascule réelle de processus d'agent, de bout en bout | parcours | garder (ou `parcours-reglages`, étape 7 « agent par défaut changé ») | partiel : `M/conversations/handover.test.ts` › « même conversation, nouvelle session, modèle réglé, contexte joint une seule fois » |
| 5 | Premier message : échange précédent reçu en contexte, avec l'agent d'avant | contexte joint par le main | doublon | — | `M/conversations/handover.test.ts` › « même conversation, nouvelle session, modèle réglé, contexte joint une seule fois » ; `S/handover.test.ts` › « contexte joint au prochain message, dit comme une session d’avant » |
| 6 | Titre gardé malgré celui du nouvel agent | titre de l'app non écrasé (fiche 125) | unitaire-main | `M/conversations/handover.test.ts` (cas à ajouter) | partiel : `M/conversations/manager.test.ts` › « titre de l’agent sans ce que l’app joint ; branche : le titre de l’app reste (fiche 125) » |
| 7 | Message suivant : plus de contexte | contexte une seule fois | doublon | — | `M/conversations/handover.test.ts` › « même conversation, nouvelle session, modèle réglé, contexte joint une seule fois » |
| 8 | Conversation vide : pas de « Continuer avec » | menu de choix d'agent seul | composant | `C/composer/AgentMenu.test.tsx` (à créer) | non |

**Verdict** : à réduire (garder 2 vérifs : 4, 5) — la bascule réelle entre deux agents factices reste un parcours ; elle peut devenir une étape de `parcours-reglages`. Le menu et le dialogue n'ont aucun test de composant : à créer avant suppression.
<!-- stats suite=handover total=8 parcours=1 composant=4 unitaire-main=1 capture=0 doublon=2 couvert=7 verdict=reduire -->

### `inbox.mjs` — attention sur place : autorisation, question, filles non lues, compteur du Dock, bannière groupée, lecture, titres bruts façon Bob, grille de la barre latérale.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Autorisation et question : deux lignes signalées à leur place | non-lu sur place, pas de section | doublon | — | `C/sidebar/Sidebar.test.tsx` › « questions, autorisations, erreurs et réponses restent à leur place ; détails dans l’infobulle » |
| 2 | Quatre conversations signalées, filles sous leur mère | chaîne réelle : filles finies fenêtre en arrière-plan (main) → non-lus dans le renderer | parcours | garder (ou `parcours-deleguer`, étape 1 fenêtre sans focus) | partiel : `C/sidebar/Sidebar.test.tsx` › « une nouvelle fille révèle son dossier et reste sous sa mère quand elle attend » |
| 3 | Raisons accessibles : outil, question, comptes rendus, mère en infobulle | `aria-label` des états | doublon | — | `M/notifications/attention.test.ts` › « ce qu’attend chaque conversation : raison, détail, depuis quand (fiche 119) » ; `S/inbox.test.ts` › « une fille : son compte rendu (sa mère est dans l’infobulle, fiche 125) » |
| 4 | Aucune section « À traiter » ni seconde ligne | plus d'`inbox` ni `inbox-line` | doublon | — | `C/sidebar/Sidebar.test.tsx` › « plus de colonne d’icône vide : seule une fille sous sa mère en a une, avec son lien » |
| 5 | Icônes de demande / non-lu ; titres non lus en gras | `data-reason`/`data-state` + graisse 600 | composant | `C/sidebar/Sidebar.test.tsx` (existant) ; la graisse en capture | partiel : `C/sidebar/Sidebar.test.tsx` › « questions, autorisations, erreurs et réponses restent à leur place ; détails dans l’infobulle » |
| 6 | Couleurs communes demandes / réponses non lues | couleur calculée des icônes | capture | capture nocturne `inbox-1-etats-sur-place` | non |
| 7 | Les deux filles non lues gardent leur lien sous la mère | `nested` conservé | doublon | — | `C/sidebar/Sidebar.test.tsx` › « plus de colonne d’icône vide : seule une fille sous sa mère en a une, avec son lien » |
| 8 | Grille : titres et en-têtes sur une même verticale (×2 : avant / après traitement) | alignement pixel (`getClientRects`) | capture | capture nocturne `inbox-1` / `inbox-3` | non |
| 9 | Grille : filles 30 px plus loin, chacune son lien (×2) | retrait pixel + lien | capture | capture nocturne ; comptage des liens en composant | partiel : `C/sidebar/Sidebar.test.tsx` › « lien des filles : la première part sous la mère, la dernière s’arrête au coude » |
| 10 | Grille : marge droite commune (temps, états, ⌘K, filtre) (×2) | alignement pixel à droite | capture | capture nocturne | non |
| 11 | Grille : en-têtes de section 11 px, 600, capitales (×2) | style calculé des en-têtes | capture | capture nocturne | non |
| 12 | Une conversation qui attend n'apparaît qu'une fois | pas de doublon de ligne | doublon | — | `C/sidebar/Sidebar.test.tsx` › « questions, autorisations, erreurs et réponses restent à leur place ; détails dans l’infobulle » |
| 13 | Compteur du Dock : 4, posé par le main | vrai `app.dock.setBadge` depuis l'état du renderer/main | parcours | garder ici (ou `parcours-matinee`, étape 8) | partiel : `M/notifications/dock-badge.test.ts` › « le nombre « À traiter », posé seulement quand il change, effacé à zéro » |
| 14 | Bannière groupée unique pour les deux filles | regroupement des notifications | doublon | — | `M/notifications/grouping.test.ts` › « trois filles qui finissent ensemble : une bannière, un seul son ou rebond » ; `M/notifications/attention.test.ts` › « bannières groupées : trois fins rapprochées, une bannière, un seul rebond (fiche 119) » |
| 15 | Réglage « Compteur sur l'icône du Dock » trouvé, activé par défaut | réglage + recherche | doublon | — | `C/settings/NotificationsSettings.test.tsx` › « proposé là où la plateforme l’a, réglage et recherche » |
| 16 | Réglage coupé : plus de compteur | effacement à la coupure | doublon | — | `M/notifications/dock-badge.test.ts` › « réglage coupé : effacé, et rien tant qu’il l’est » |
| 17 | Réglage rétabli : le compteur revient | reposé au retour | doublon | — | `M/notifications/dock-badge.test.ts` › « le nombre « À traiter », posé seulement quand il change, effacé à zéro » |
| 18 | Sans compteur (Linux/Windows) : ni réglage ni résultat | réglage absent hors plateforme | doublon | — | `C/settings/NotificationsSettings.test.tsx` › « ailleurs, ni réglage ni résultat de recherche » |
| 19 | Autorisation donnée : ligne conservée, compteur à 3 | ligne traitée garde sa place | doublon | — | `S/inbox.test.ts` › « mêmes lignes, même ordre ; une ligne traitée reste, une nouvelle attend sa place » |
| 20 | Fille ouverte : lue ; l'autre reste à lire | lecture par ouverture | doublon | — | `M/notifications/attention.test.ts` › « vue en revenant dans la fenêtre : la pastille et les notifications disparaissent » |
| 21 | Mère ouverte : le compte rendu de la fille dans son fil est lu | fiche 258, D35 | doublon | — | `M/notifications/attention.test.ts` › « mère ouverte plus tard : tous les comptes rendus de son fil sont lus, pas les autres » |
| 22 | Tout traité : compteur effacé, conversations et filles conservées | retour à zéro | doublon | — | `M/notifications/dock-badge.test.ts` › « le nombre « À traiter », posé seulement quand il change, effacé à zéro » ; `S/inbox.test.ts` › « mêmes lignes, même ordre ; une ligne traitée reste, une nouvelle attend sa place » |
| 23 | Titre de l'agent avec le contexte de session : coupé au contexte | titre de l'utilisateur gardé (fiche 125) | doublon | — | `M/conversations/manager.test.ts` › « titre de l’agent sans ce que l’app joint ; branche : le titre de l’app reste (fiche 125) » |
| 24 | Titres bruts n° 1-3 : même libellé en infobulle et sur la carte (×3) | libellés lisibles, chemins relatifs | doublon | — | `M/notifications/attention.test.ts` › « titres bruts de l’agent : libellé lisible, chemins relatifs (fiche 125) » ; `S/tool-label.test.ts` › « commande : le « cd » vers le dossier de la conversation disparaît, ses chemins sont relatifs » et « liste de tâches (`rawInput.todos`) : ce que fait l’outil et combien, la liste en détail » |
| 25 | Plus aucun chemin absolu du dossier dans la page | aucun chemin absolu rendu | composant | `C/thread/ToolCall.session.test.tsx` (existant) | partiel : `S/tool-label.test.ts` › « titre sans libellé : les chemins du dossier deviennent relatifs » |

**Verdict** : à réduire (garder 2 vérifs : 2, 13) — le non-lu de bout en bout (fenêtre sans focus) et le vrai compteur du Dock ; la grille (8-11) et les couleurs (6) passent en capture nocturne ; le reste est déjà vérifié par `attention.test.ts`, `dock-badge.test.ts`, `grouping.test.ts`, `inbox.test.ts` et `Sidebar.test.tsx`.
<!-- stats suite=inbox total=25 parcours=2 composant=2 unitaire-main=0 capture=5 doublon=16 couvert=21 verdict=reduire -->

### `roles-export.mjs` — « Installer dans Bob / OpenCode » un rôle : feuille, installation dans les vrais fichiers, conflit, mise à jour, lancer dans le mode, retrait, modifié à la main, nom long, installation sans rôle.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Rôle jamais installé : aucune ligne d'état | `role-export-rows` absent | composant | `C/roles/RoleExport.test.tsx` (existant, cas à ajouter) | **oui, remplaçant créé** (2026-11-24) : `R/components/roles/RoleExport.test.tsx` › « rôle jamais installé : aucune ligne d’état, le bouton seul » — avant : non |
| 2 | Feuille Bob : portée par défaut, chemins, lecture seule | aperçu de la feuille | doublon | — | `C/roles/RoleExport.test.tsx` › « feuille : portée du rôle, texte exact sur demande, installe avec « lancer dans ce mode » » ; `M/roles/export/service.test.ts` › « aperçu : chemins, portée du rôle par défaut, texte exact » |
| 3 | « Voir ce qui sera écrit » : bloc YAML exact | texte exact | doublon | — | `C/roles/RoleExport.test.tsx` › « feuille : portée du rôle, texte exact sur demande, installe avec « lancer dans ce mode » » ; `M/roles/export/adapters.test.ts` › « crée le fichier : lecture seule = lire et outils MCP, consigne et lecture seule écrites » |
| 4 | Installé : mode ajouté à `~/.bob/settings/custom_modes.yaml`, reste et commentaires gardés | chaîne complète page → IPC → main → vrai fichier | parcours | garder (ou `parcours-reglages`, étape 10 rôle) | `M/roles/export/service.test.ts` › « garde les autres modes et les commentaires du fichier, copie avant d’écrire » |
| 5 | Conflit : mode du projet que Bobine n'a pas écrit, fichier inchangé, dit | refus sans écriture | doublon | — | `M/roles/export/service.test.ts` › « conflit : un mode du même nom que Bobine n’a pas écrit n’est jamais touché » ; `C/roles/RoleExport.test.tsx` › « conflit : la page dit que rien n’a été changé » |
| 6 | Rôle réenregistré : le refus d'avant n'est plus montré | erreur effacée | doublon | — | `C/roles/RoleExport.test.tsx` › « conflit : la page dit que rien n’a été changé » |
| 7 | Rôle changé : « Mettre à jour » réécrit le mode, « à jour » | `roleChanged` → `upToDate` | doublon | — | `M/roles/export/service.test.ts` › « installe, dit « à jour », puis « le rôle a changé » et met à jour » ; `C/roles/RoleExport.test.tsx` › « rôle changé : « Mettre à jour » ; modifié à la main : retirer seulement après confirmation » |
| 8 | Lancer dans ce mode : la fille du rôle travaille dans le mode installé | mode ACP posé sur la session d'un vrai agent factice | parcours | garder ici | partiel : `M/roles/roles-children.test.ts` › « mode natif présent : la fille y est mise, consigne du rôle quand même ; rien de retenu pour le profil » ; `M/roles/launch.test.ts` › « sans `mode` dans le rôle : le mode installé est posé, lecture seule tenue par l’agent » |
| 9 | Retirer : seul le mode de Bobine part, fichier d'origine rendu | retrait propre | doublon | — | `M/roles/export/adapters.test.ts` › « remplace notre seul mode, puis le retire en rendant le fichier d’origine » |
| 10 | Feuille OpenCode : un fichier par agent, lecture seule par permissions | format `opencode-agents` | doublon | — | `M/roles/export/adapters.test.ts` › « chemins : XDG_CONFIG_HOME suivi, projet sous .opencode/agents » et « écrit un agent principal ; lecture seule par permissions, outils MCP laissés » |
| 11 | Installé pour le projet : `.opencode/agents/security-expert.md` | fichier écrit | doublon | — | `M/roles/export/service.test.ts` › « écrit le fichier de l’agent ; un fichier qui n’est pas à Bobine n’est pas touché » |
| 12 | Modifié à la main : rien retiré sans confirmation | `handEdited` + confirmation | doublon | — | `M/roles/export/service.test.ts` › « modifié à la main : dit, rien sans confirmation ; remplacé ou retiré si confirmé » ; `C/roles/RoleExport.test.tsx` › « rôle changé : « Mettre à jour » ; modifié à la main : retirer seulement après confirmation » |
| 13 | Retiré après confirmation : fichier supprimé | suppression du fichier | doublon | — | `M/roles/export/service.test.ts` › « retirer supprime le fichier, après une copie » |
| 14 | En-tête : nom long lisible, sous-titre sur une ligne, chemin en infobulle | `nowrap`, `title`, largeur ≥ 200 px | capture | capture nocturne `rx8-entete-nom-long` (l'infobulle `title` en composant) | non |
| 15 | Renommé alors qu'installé : dit à l'enregistrement | message `role-edit-saved` avec l'ancien identifiant | composant | `C/roles/RolesSettings.test.tsx` (existant, cas à ajouter) | **oui, remplaçant créé** (2026-11-24) : `R/components/roles/RolesSettings.test.tsx` › « renommé alors qu’il est installé dans un agent : dit à l’enregistrement, avec l’ancien identifiant » — avant : partiel : `C/roles/RolesSettings.test.tsx` › « modifier un rôle personnel : renommé avec `previousName`, la page suit » |
| 16 | « Installations sans rôle » : l'installation du rôle renommé reste visible | orphelins listés | doublon | — | `C/roles/RoleExport.test.tsx` › « liste les installations d’un rôle renommé ou supprimé, et les retire » ; `M/roles/export/service.test.ts` › « restent visibles et se retirent ; projet : seulement dans son dossier » |
| 17 | Installation sans rôle retirée : fichier supprimé | retrait d'un orphelin | doublon | — | `M/roles/export/service.test.ts` › « restent visibles et se retirent ; projet : seulement dans son dossier » |

**Verdict** : à réduire (garder 2 vérifs : 4, 8) — une installation de bout en bout dans un vrai fichier et « lancer dans ce mode » contre l'agent factice ; tout le reste est dans `service.test.ts`, `adapters.test.ts` et `RoleExport.test.tsx`. Les deux parcours peuvent devenir une étape de `parcours-reglages`.
<!-- stats suite=roles-export total=17 parcours=2 composant=2 unitaire-main=0 capture=1 doublon=12 couvert=15 verdict=reduire -->

#### Risques repérés (lot 1)

- **Journal IPC après suppression** (filles 19) : seul l'e2e voit le renderer interroger une conversation que le main n'a plus (`Conversation inconnue` sur `git:status`, `children:mergePlan`, `conversation:appTools`…). Un test de composant simule `window.api` et ne voit pas ces appels perdus. Défaut ouvert dans la fiche 277 (n° 1). À garder, variante « case décochée » comprise.
- **Mise en page sous le pointeur** (filles 31-33) : `useThreadScroll.test.ts` et `ChildProposals.test.tsx` testent la logique, mais pas les pixels. Que « Lancer » reste sous la souris pendant une rafale (`elementFromPoint`) dépend de la vraie mise en page Chromium, qui avait déjà donné des échecs intermittents (fiches 143, 148, 181).
- **Grille de la barre latérale** (inbox 8-11) : jsdom ne calcule ni retraits, ni marges droites, ni styles venus du CSS. Sans capture nocturne comparée, une régression d'alignement ne serait plus vue du tout.
- **Vrai Dock et vraies bannières** (inbox 13-14) : les tests main remplacent `app.dock` et `Notification`. Seul l'e2e vérifie que l'état du renderer (non-lus) remonte jusqu'au vrai compteur. La fenêtre en arrière-plan reste simulée (`isFocused` remplacé) même en e2e.
- **Bascule d'agent réelle** (handover 4) : deux processus d'agent factice, arrêt de l'un et lancement de l'autre dans la même conversation, puce de modèle mise à jour. `handover.test.ts` le fait côté main, mais pas le câblage du dialogue vers l'IPC ni l'affichage qui suit. `AgentMenu` et `HandoverDialog` n'ont aucun test de composant.
- **Choix de lancement de bout en bout** (filles-non-commite 3) : `launch-choice.test.ts` garantit que la requête porte le choix affiché, et `children-uncommitted.test.ts` ce que fait le main. Rien hors e2e ne relie les deux (preload, canal IPC, dossier de la mère lu avant l'armement de « Lancer »).
- **Persistance après redémarrage** (filles 44) : la consigne `message_child` repliée et entière après relance de l'app n'est vérifiée qu'ici.
- **Mode ACP réellement posé** (roles-export 8) : seul l'e2e fait relire le fichier de modes par l'agent factice (`MOCK_AGENT_ROLE_EXPORT`), puis poser le mode sur la session de la fille.
- **Plateformes** : la branche `FEATURES.dockBadge` (inbox 15-18) ne joue qu'une moitié par machine. Les tests de composant couvrent les deux, mais l'e2e Linux est la seule preuve de l'absence réelle du réglage.
- **Écarts de couverture à combler avant toute suppression** : `ChildDialog` (agent et modèle par défaut), en-tête « ↳ depuis » (`title-origin` : aucun test), réglage « Proposer des conversations filles » et réglage du plafond (aucun test renderer), `AgentMenu` et `HandoverDialog`, scénario `filles-rafale` côté main, `RoleExport` « jamais installé », message de renommage d'un rôle installé.

---

## Lot 2

Abréviations des chemins : `thread/` = `src/renderer/src/components/thread/`, `panel/` = `src/renderer/src/components/panel/`, `sidebar/` = `src/renderer/src/components/sidebar/`, `composer/` = `src/renderer/src/components/composer/`.

### `autorisation-commande.mjs` — carte « Autoriser cette commande ? » : commande entière et exacte, fin atteignable, dossier, cartes fichier, cartes à risque, fenêtre normale puis 900 px

`askAndCheck` est joué 5 fois (commande-bob, commande-courte, commande-tres-longue, puis bob et très longue à 900 px panneau ouvert) ; `fileCards` 2 fois (normale, puis `-900`).

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | `<scénario>` : commande entière, brute (×5, par scénario/largeur) | ce qu'on voit est la commande complète (M1) | composant | `thread/CommandBlock.test.tsx` (existant) | `thread/CommandBlock.test.tsx` › « comme Bob : la commande, dans le titre seulement, entière et brute dans la carte » ; › « rawInput : la commande entière (pas le résumé d'une ligne), brute, dossier hors du dossier » |
| 2 | aucun bouton de la carte n'a pris le focus (×5) | pas d'acceptation par Entrée involontaire | composant | `thread/CommandBlock.test.tsx` (à ajouter) | non |
| 3 | pas de défilement horizontal, carte dans le fil (×5) | la commande se replie, la carte tient à 900 px | capture | capture nocturne (normale + 900 px) | non |
| 4 | la carte annonce les N lignes à faire défiler (×≈4, quand ça défile) | l'utilisateur sait qu'il reste à lire | composant | `thread/CommandBlock.test.tsx` (à ajouter, si le seuil est en lignes) | non |
| 5 | la fin de la commande est à l'écran avant d'accepter (×5) | fin atteignable dans la carte ET dans le fil (vraie mise en page, sécurité M1) | parcours | garder ici (version réduite) | non |
| 6 | la molette au bout du bloc ne fait pas défiler le fil (×≈4) | `overscroll-behavior: contain` réel dans Chromium | parcours | garder ici (version réduite) | non |
| 7 | dossier hors de celui de la conversation signalé (×4) | alerte « hors du dossier » | composant | `thread/CommandBlock.test.tsx` | `thread/CommandBlock.test.tsx` › « rawInput : la commande entière (pas le résumé d'une ligne), brute, dossier hors du dossier » |
| 8 | après : commande entière en infobulle de la ligne | ligne repliée garde le texte complet | composant | `thread/CommandBlock.test.tsx` | partiel : `thread/CommandBlock.test.tsx` › « infobulle plafonnée à 4 Ko, avec de quoi tout lire » |
| 9 | après : dépliée, la commande puis la sortie | ordre commande → sortie | composant | `thread/CommandBlock.test.tsx` | `thread/CommandBlock.test.tsx` › « après la décision : la ligne se déplie sur la commande, puis la sortie » |
| 10 | commande piégée : \r, RLO, zéro-largeur, cadratin visibles, signalés | rien d'invisible dans ce qui sera lancé | composant | `thread/CommandBlock.test.tsx` | `thread/CommandBlock.test.tsx` › « caractères invisibles : rendus visibles, signalés, « Copier » garde le brut » |
| 11 | piégée : titre « npm test » annoncé montré à part | titre trompeur de l'agent distingué | composant | idem | `thread/CommandBlock.test.tsx` › « titre qui annonce une autre commande : montré au-dessus de la commande lancée » |
| 12 | texte ordinaire (insécable, emoji, NFD) : aucune alerte | pas de faux positif | composant | idem | `thread/CommandBlock.test.tsx` › « espace insécable dans un message entre guillemets : discrète, sans l'alerte » ; › « nom de fichier tapé sur macOS (NFD) : rien de signalé » |
| 13 | tableau d'arguments cité, aucun opérateur | argv rendu en citation POSIX | composant | idem | `thread/CommandBlock.test.tsx` › « tableau d'arguments : cité, aucun opérateur marqué » |
| 14 | dossier de la conversation : « Dans X », infobulle, pas répété | dossier dit une seule fois | composant | `thread/AuthorizationCard.test.tsx` | `thread/AuthorizationCard.test.tsx` › « dossier de la conversation : « Dans projet », chemin entier en infobulle et lu » |
| 15 | « Copier » en haut à droite de la barre (px) | position du bouton | capture | capture nocturne | partiel : `thread/AuthorizationCard.test.tsx` › « « Copier » après le dossier et ses mentions, dans la barre » |
| 16 | commande OpenCode entière, inchangée | rawInput OpenCode montré tel quel | composant | `thread/CommandBlock.test.tsx` | `thread/CommandBlock.test.tsx` › « rawInput : la commande entière (pas le résumé d'une ligne), brute, dossier hors du dossier » |
| 17 | OpenCode workdir relatif : « Dans X/docs », pas répété | correctif recette 2.2.5 | composant | `thread/AuthorizationCard.test.tsx` | `thread/AuthorizationCard.test.tsx` › « OpenCode, `workdir` relatif confirmé par l'emplacement : « Dans projet/docs », une fois » |
| 18 | idem après décision, dépliée | même rendu après | composant | idem | `thread/AuthorizationCard.test.tsx` › « OpenCode, `workdir` relatif, après la décision, dépliée : toujours une fois » |
| 19 | workdir « ../.. » : alerte, chemin entier, emplacement gardé | sortie du dossier non masquée | composant | idem | `thread/AuthorizationCard.test.tsx` › « `workdir` relatif qui sort (`../..`) : alerte, chemin entier, emplacement gardé » |
| 20 | mention passée à la ligne sans « · » en début de ligne | séparateur visuel selon le repli | capture | capture nocturne | non |
| 21 | sous-dossier absolu : « Dans X/src/renderer » | chemin raccourci relatif | composant | idem | `thread/AuthorizationCard.test.tsx` › « sous-dossier : « Dans projet/src/renderer » ; emplacement égal (barre finale) masqué » |
| 22 | hors du dossier : chemin entier, jamais coupé | pas d'ellipse sur un chemin extérieur | composant | idem (non coupé : classe CSS) | `thread/AuthorizationCard.test.tsx` › « hors du dossier : chemin entier, jamais raccourci, invisible rendu visible, alerte » |
| 23 | hors du dossier : « · » entre mentions, jamais en début de ligne | idem #20 | capture | capture nocturne | non |
| 24 | hors du dossier : deux alertes, cadratin visible | double alerte | composant | idem | `thread/AuthorizationCard.test.tsx` › « hors du dossier : chemin entier, jamais raccourci, invisible rendu visible, alerte » |
| 25 | hors du dossier : « Copier » reste sur la première ligne | position | capture | capture nocturne | partiel : `thread/AuthorizationCard.test.tsx` › « « Copier » après le dossier et ses mentions, dans la barre » |
| 26 | hors du dossier : commande entière exacte | `visibleText` appliqué | composant | `src/shared/command-view.test.ts` | `src/shared/command-view.test.ts` › « caractères invisibles et trompeurs rendus visibles, le reste intact » |
| 27 | création : libellé, icône « fichier + », question (×2) | création dite comme telle | composant | `thread/AuthorizationCard.test.tsx` | `thread/AuthorizationCard.test.tsx` › « création dans le dossier : « Création de notes.md », question, icône, nom seul » |
| 28 | création : nom seul, infobulle, badge « nouveau fichier » (×2) | en-tête du diff | composant | idem | idem |
| 29 | sous-dossier : dossier grisé, nom entier, compteurs visibles (×2) | nom jamais coupé | composant | idem | partiel : `thread/AuthorizationCard.test.tsx` › « sous-dossier : dossier grisé à part (coupé par le début), nom entier » |
| 30 | hors du dossier : « ~ », nom entier, compteurs, infobulle (×2) | chemin extérieur lisible | composant | idem | `thread/AuthorizationCard.test.tsx` › « hors du dossier : avec `~`, chemin entier en infobulle » |
| 31 | carte serrée (900) : début du chemin coupé | ellipse réelle | capture | capture 900 px | non |
| 32 | ligne d'outil nom long : nom entier, dossier coupé d'abord (×2, normale/serrée) | ordre de rétrécissement réel (ResizeObserver) | capture | capture nocturne | partiel : `thread/AuthorizationCard.test.tsx` › « nom très long : la ligne d'outil garde le nom entier, extension comprise, dossier à part » |
| 33 | nom tient seul : dossier effacé, pas de « / » seul | algorithme sur largeurs mesurées | composant | `thread/ToolCall*.test.tsx` (largeurs simulées, à créer) | partiel : `src/shared/tool-label.test.ts` › « ligne d'outil : nom entier (extension comprise), dossier à part, le texte autour (correctif 203) » |
| 34 | Modifications : dossier coupé avant le nom, chevrons entiers (×2) | lignes du panneau | capture | capture nocturne | non |
| 35 | Modifications : « configuration-par-defaut.ts » entier | idem | capture | capture nocturne | non |
| 36 | nom plus large que la carte : coupé à la fin, badge et compteurs visibles (×2) | débordement réel | capture | capture nocturne | non |
| 37 | Bob, fichier neuf (oldText "") : Création, badge | disque regardé à la proposition | unitaire-main | `src/main/agent/new-files.test.ts` | `src/main/agent/trace-replay.test.ts` › « Bob 2.0.9, fichier neuf (oldText "", absent quand il est proposé) : une création » |
| 38 | Bob, neuf, écrit depuis : toujours « Création » | décision gardée après écriture | unitaire-main | idem | `src/main/agent/new-files.test.ts` › « absent quand il est proposé : création, à la demande comme à la fin, regardé une fois » |
| 39 | Bob, fichier vide existant : Modification, pas de badge | même forme, autre sens | unitaire-main | idem | `src/main/agent/new-files.test.ts` › « fichier vide existant : oldText "" gardé (modification) » ; `src/main/agent/trace-replay.test.ts` › « Bob 2.0.9, même forme sur un fichier vide existant : une modification » |
| 40 | Bob, vide existant, après : Modification | idem après | unitaire-main | idem | partiel : `src/main/agent/new-files.test.ts` › « fichier vide existant : oldText "" gardé (modification) » |
| 41 | écriture hors du dossier : bandeau | risque calculé et montré | composant | `thread/AuthorizationCard.test.tsx` | `thread/AuthorizationCard.test.tsx` › « écriture hors du dossier : bandeau lu avant les boutons, pas de « Toujours », pas de note » |
| 42 | carte à risque : pas de « Toujours », pas de note | option retirée | composant | idem | idem |
| 43 | la commande reste montrée au-dessus du bandeau | ordre | composant | idem | partiel : idem |
| 44 | sudo : une ligne par chemin, raison la plus précise | lignes du bandeau | composant | idem + `src/main/agent/permission-risk.test.ts` | `thread/AuthorizationCard.test.tsx` › « sudo et dossier système : une ligne chacun » |
| 45 | sudo : pas de « Toujours autoriser » | idem | composant | `thread/PermissionCardExtras.test.tsx` | `thread/PermissionCardExtras.test.tsx` › « carte à risque : pas de « Toujours », une ligne dit pourquoi » |
| 46 | lecture hors du dossier : pas de bandeau, « Toujours » offert | lecture jamais signalée | composant | `thread/AuthorizationCard.test.tsx` | `src/main/agent/permission-risk.test.ts` › « un outil d'un autre genre (lecture, recherche) : jamais signalé » ; `thread/AuthorizationCard.test.tsx` › « carte ordinaire (commande) : « Toujours » offert, la note dit que l'agent décide » |
| 47 | lecture : note « c'est l'agent qui décide » | note sous les boutons | composant | idem | `thread/AuthorizationCard.test.tsx` › « carte ordinaire (commande) : « Toujours » offert, la note dit que l'agent décide » |
| 48 | modification hors du dossier (outil edit, Bob) : bandeau, pas de Toujours | risque d'une écriture de fichier | unitaire-main | `src/main/agent/permission-risk.test.ts` | `src/main/agent/permission-risk.test.ts` › « Bob 2.0.9 : rawInput.path et diff absolus, une seule mention par chemin » |

**Verdict** : à réduire (garder 2 vérifs : #5 fin de commande atteignable et #6 molette contenue, sur commande-tres-longue en fenêtre normale et à 900 px) — tout le reste est déjà en composant/unitaire ou relève d'une capture nocturne (cartes serrées, positions de « Copier », « · »).
<!-- stats suite=autorisation-commande total=48 parcours=2 composant=31 unitaire-main=5 capture=10 doublon=0 couvert=37 verdict=reduire -->

### `browser.mjs` — navigateur intégré piloté par l'agent : outils, débogage, planche contact, popups, accord par site, téléchargements, boîtes de page, vue native, branche

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | l'agent a saisi, cliqué, lu le résultat dans la vraie page | chaîne MCP → WebContentsView → page réelle | parcours | `parcours-outils`, étape 3 (ajouter un tour « Teste la page ») ou garder ici | partiel : `parcours-outils` › étape « le navigateur intégré : annoter la page et l'envoyer » |
| 2 | outils du navigateur sans demande d'autorisation (≥ 8 cartes) | outils de l'app autorisés d'office | unitaire-main | `src/main/browser/browser-tools.test.ts` | `src/main/browser/browser-tools.test.ts` › « tous autorisés d'office et rattachés à l'onglet « Navigateur » » ; › « page locale : ouverte sans rien demander » |
| 3 | page jointe au message (image nommée d'après la page) | capture réelle de la vue native vers la saisie | parcours | garder ici | non |
| 4 | lecture par l'arbre d'accessibilité de Chromium | vrai CDP `Accessibility` | parcours | garder ici | partiel : `src/main/browser/ax-tree.test.ts` › « interactif : contrôles seulement, états utiles, conteneurs génériques effacés » |
| 5 | onglet « Navigateur » ouvert seul, sur la page de l'agent | panneau suit l'agent | doublon | `parcours-outils`, étape 3 | `parcours-outils` › étape « le navigateur intégré : annoter la page et l'envoyer » (attente `browser-address` + `viewShown`) |
| 6 | capture de l'agent affichée dans sa carte | image réelle rendue | parcours | garder ici | partiel : `src/main/browser/browser-tools.test.ts` › « capture : texte avec le repère des coordonnées, puis l'image » |
| 7 | adresse saisie : page ouverte, « Précédent » actif | navigation utilisateur réelle | parcours | garder ici | non |
| 8 | « Précédent » revient à la page de l'agent | historique de la vue native | parcours | garder ici | non |
| 9 | console : erreur de la page lue | outil console | unitaire-main | `src/main/browser/browser-tools.test.ts` | `src/main/browser/browser-tools.test.ts` › « console : erreurs seulement, motif, vidage » |
| 10 | réseau : 500 et corps de la réponse | outil réseau | unitaire-main | idem | `src/main/browser/browser-tools.test.ts` › « réseau : liste filtrée, échecs signalés, corps d'une réponse » |
| 11 | JavaScript évalué dans la page | outil eval | unitaire-main | idem | `src/main/browser/browser-tools.test.ts` › « JavaScript de débogage : résultat en JSON » |
| 12 | émulation mobile + mode sombre | outil d'émulation | unitaire-main | idem | `src/main/browser/browser-tools.test.ts` › « taille d'écran et thème : préréglages, tailles libres, retour au panneau » |
| 13 | nouvel onglet : bandeau d'onglets (2) | rendu des puces d'onglets | composant | `panel/BrowserTab.test.tsx` (à créer) | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « un seul onglet : pas de bandeau ; deux : deux puces, choisir et fermer passent au main » ; `browser-tools.test.ts` › « onglets : nouvel onglet vers un site extérieur soumis à l’accord, choisir, fermer » |
| 14 | onglet fermé : retour au précédent | gestion des onglets | unitaire-main | idem | `src/main/browser/browser-manager.test.ts` › « l’onglet actif fermé : le suivant prend sa place, le dernier rend la main au précédent » ; › « un autre onglet fermé : l’actif ne change pas ; inconnu : refusé » |
| 15 | planche contact : carré filmé, ≥ 3 images différentes | film réel d'une animation Chromium | parcours | garder ici | partiel : `src/main/browser/browser-tools.test.ts` › « fait les actions pendant le film, rend une planche et ses moments » |
| 16 | planche affichée dans la carte de l'outil | image de l'outil rendue | composant | `thread/ToolCall*.test.tsx` (à ajouter) | `src/renderer/src/components/thread/ToolCall.images.test.tsx` › « l’image de la planche est sous la carte, sans rien déplier, agrandissable » (la taille réelle de l’image filmée reste vue par #15) |
| 17 | planche reçue : le fil reste en bas, pas de « Aller en bas » | suivi du défilement malgré l'ancrage Chromium au chargement d'image | parcours | garder ici (ou `parcours-longue`) | non |
| 18 | carte « execute » : libellés des outils à la suite | appels par code (OpenCode 2) | unitaire-main | `src/main/agent/app-tools-bridge.test.ts` | `src/main/agent/app-tools-bridge.test.ts` › « comme OpenCode 2 : carte « execute » dont le code cite les outils, libellés et images rattachés » |
| 19 | carte « execute » : capture et planche dessous | images rattachées | unitaire-main | idem | idem |
| 20 | « execute » dont un outil a échoué : « échec » | issue en échec | unitaire-main | `src/main/agent/agent-host.test.ts` | `src/main/agent/agent-host.test.ts` › « OpenCode 2 : `execute` dont un appel est en erreur → carte en échec, en direct et au rejeu (fiche 122) » |
| 21 | popup par action de l'agent : bloquée, l'agent prié de demander | message à l'agent | unitaire-main | `src/main/browser/browser-tools.test.ts` | `src/main/browser/browser-tools.test.ts` › « popup bloquée pendant une action de l'agent : il est prié de demander à l'utilisateur (fiche 072) » |
| 22 | aucune fenêtre ouverte par l'action de l'agent | pas de vraie BrowserWindow | parcours | garder ici | partiel : idem |
| 23 | popup par clic de l'utilisateur : vraie fenêtre, `opener` | fenêtre native liée (OAuth) | parcours | garder ici | non |
| 24 | `location = …` vers un site non accordé : arrêté, agent prévenu | garde de navigation réelle (SEC-1) | parcours | garder ici | partiel : `src/main/browser/navigation-guard.test.ts` › « action de l'agent : site non accordé arrêté et noté, site accordé laissé » ; `src/main/browser/browser-tools.test.ts` › « navigation arrêtée pendant l'action : l'agent est prévenu » |
| 25 | la page n'est jamais allée sur le site non accordé (après 2 s) | aucune requête partie | parcours | garder ici | partiel : `src/main/browser/navigation-guard.test.ts` › « délai après l'action : encore attribué à l'agent » |
| 26 | navigation hors action de l'agent : la page part | l'utilisateur navigue librement | unitaire-main | `src/main/browser/navigation-guard.test.ts` | `src/main/browser/navigation-guard.test.ts` › « hors d'une action de l'agent : l'utilisateur navigue librement » |
| 27 | page sur site non accordé : carte d'accord avant lecture | chaîne outil → question renderer | parcours | garder ici | partiel : `src/main/browser/browser-tools.test.ts` › « chaque outil qui lit la page ou y agit passe par l'accord » |
| 28 | carte « Site web » : rien de choisi, « Envoyer » inactif | pas de réponse vide | composant | `thread/QuestionCard.test.tsx` | `thread/QuestionCard.test.tsx` › « carte « Site web » (fiche 254, D2) : rien ne paraît choisi, « Envoyer » inactif, aucune réponse vide » |
| 29 | refusé : l'agent n'a rien lu | refus respecté | unitaire-main | `src/main/browser/browser-tools.test.ts` | `src/main/browser/browser-tools.test.ts` › « site non accordé, refus : rien n'est lu ni fait, l'outil échoue » |
| 30 | autorisé : lit, sans redemander | accord retenu | unitaire-main | idem | `src/main/browser/browser-tools.test.ts` › « accordé une fois : l'outil s'exécute, sans redemander ensuite » |
| 31 | « Enregistrer sous » : Téléchargements, dit l'agent et la conversation | texte de la fenêtre native | unitaire-main | `src/main/browser/downloads.test.ts` (ajouter le message) | `src/main/browser/browser-manager.test.ts` › « lancé par l’agent : dans Téléchargements, la fenêtre dit l’agent et sa conversation » ; › « lancé par l’agent sans titre connu : « lancé par l’agent » ; par la page : le site seul » ; `browser-tools.test.ts` › « téléchargement lancé par l’agent : la décision revient à l’utilisateur, puis son choix (fiche 094) » |
| 32 | fenêtre ouverte : fichier en attente dans le dossier de l'app | rien à l'endroit choisi avant le choix | unitaire-main | `src/main/browser/downloads.test.ts` | `src/main/browser/downloads.test.ts` › « rien hors du dossier d'attente avant le choix ; déplacé là où l'utilisateur l'a choisi » |
| 33 | l'agent apprend que l'utilisateur décide, puis où | messages à l'agent | unitaire-main | `src/main/browser/browser-tools.test.ts` | `src/main/browser/browser-tools.test.ts` › « téléchargement lancé par l'agent : la décision revient à l'utilisateur, puis son choix (fiche 094) » |
| 34 | fichier enregistré, contenu du blob déjà révoqué | vrai téléchargement Chromium | parcours | garder ici | partiel : `src/main/browser/downloads.test.ts` › « rien hors du dossier d'attente avant le choix ; déplacé là où l'utilisateur l'a choisi » |
| 35 | dossier d'attente vidé | nettoyage | unitaire-main | `src/main/browser/downloads.test.ts` | idem |
| 36 | bandeau de téléchargement lisible (≥ 6em, rien ne dépasse) | mise en page réelle | capture | capture nocturne | non |
| 37 | « Afficher dans le Finder » montre le fichier | bouton → `shell.showItemInFolder` | composant | `panel/BrowserTab.test.tsx` (à créer, api simulée) | `src/renderer/src/components/panel/BrowserTab.test.tsx` › « « Afficher dans le Finder » montre le fichier enregistré ; l’autre conversation ne compte pas » ; › « échec : dit, sans « Afficher dans le Finder » » |
| 38 | « Annuler » : rien enregistré, pas de bandeau, l'agent le sait | annulation propre | unitaire-main | `src/main/browser/downloads.test.ts` | `src/main/browser/downloads.test.ts` › « « Annuler » : le téléchargement est arrêté, rien ne reste » |
| 39 | fenêtre laissée ouverte : l'agent n'attend pas, la conversation attend (point) | état « attend » jusqu'à la barre latérale | parcours | garder ici | partiel : `sidebar/Sidebar.test.tsx` › « questions, autorisations, erreurs et réponses restent à leur place ; détails dans l'infobulle » |
| 40 | « Exporter » cliqué par l'utilisateur : même fenêtre, sans mention de l'agent | attribution clic natif vs agent | parcours | garder ici | non |
| 41 | panneau le plus étroit : bandeau lisible | mise en page réelle | capture | capture nocturne | non |
| 42 | boîte `confirm()` : l'outil revient, le suivant aussi ; la conversation attend | page bloquée ne bloque pas l'agent | parcours | garder ici | partiel : `src/main/browser/page-dialogs.test.ts` › « une commande en attente rend la main dès qu'une boîte s'ouvre » |
| 43 | réponse de l'utilisateur arrive à l'agent ; n'attend plus | vraie boîte native → agent | parcours | garder ici | partiel : `src/main/browser/page-dialogs.test.ts` › « textes pour l'agent : la boîte ouverte, puis la réponse de l'utilisateur » |
| 44 | Réglages ouverts : page native masquée puis réaffichée | WebContentsView sous les fenêtres de l'app | parcours | garder ici | non |
| 45 | menu « + » : page native masquée puis réaffichée | idem sous un menu | parcours | garder ici | non |
| 46 | agrandi : la page native suit le panneau | bornes de la vue native | doublon | `browser-view.mjs` | partiel : e2e `browser-view.mjs` (la page suit le panneau, fiche 129) |
| 47 | agrandi : « Page jointe au message » dans l'en-tête, clic revient | indicateur quand la saisie est cachée | composant | `panel/SidePanel*.test.tsx` (à ajouter) | `src/renderer/src/components/panel/SidePanelAttached.test.tsx` › « « Page jointe au message » dans l’en-tête ; un clic revient à la conversation ; puis s’efface » |
| 48 | branche : le navigateur reprend la page de l'originale | état du navigateur copié à la branche | parcours | garder ici (ou `unitaire-main` dans `src/main/conversations/branching.test.ts`) | non |

**Verdict** : à réduire (garder ~21 vérifs : #1, 3, 4, 6–8, 15, 17, 22–25, 27, 34, 39, 40, 42–45, 48) — tout ce qui touche la vraie vue native, la garde de navigation, les fenêtres et téléchargements réels reste ; les outils de débogage, execute, refus/accord et attente sont déjà en unitaire.
<!-- stats suite=browser total=48 parcours=21 composant=5 unitaire-main=18 capture=2 doublon=2 couvert=37 verdict=reduire -->

### `annotate.mjs` — annoter une image jointe (rectangle, flèche, texte), Échap, Appliquer, et dans la fenêtre rapide

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Échap : image inchangée | fermer sans appliquer ne touche rien | composant | `composer/ImageAnnotator.test.tsx` (à créer) | `src/renderer/src/components/composer/ImageAnnotator.test.tsx` › « Échap : fermée sans rien appliquer, l’image reste celle d’origine » |
| 2 | fenêtre d'annotation non déplaçable (`-webkit-app-region: no-drag`) | macOS ne prend pas les clics sur la barre du haut | parcours | garder ici (styles.css non chargé en jsdom) | non |
| 3 | rectangle, flèche, texte dessinés (« Annuler le dernier » actif) | les gestes créent des formes | composant | `composer/ImageAnnotator.test.tsx` (canvas simulé) | `src/renderer/src/components/composer/ImageAnnotator.test.tsx` › « rectangle, flèche et texte dessinés ; « Annuler le dernier » et « Appliquer » s’activent » (contexte 2D simulé) ; `annotation.test.ts` › « dessine chaque forme en coordonnées de l'image » |
| 4 | texte long : revient à la ligne dans l'image (mesures) | la saisie ne sort pas du canevas | capture | capture nocturne | partiel : `src/renderer/src/annotation.test.ts` › « texte : retour à la ligne entre les mots, au milieu d'un mot trop long (fiche 094) » |
| 5 | appliquée : image annotée à la place, mêmes dimensions | vrai canvas Chromium → pièce jointe | parcours | `parcours-outils` (étape à ajouter : capture annotée) ou garder ici | partiel : `src/renderer/src/annotation.test.ts` › « un texte long est dessiné sur plusieurs lignes, dans l'image » |
| 6 | fenêtre rapide : agrandie pour annoter, image annotée | redimensionnement de la BrowserWindow | parcours | garder ici | non |
| 7 | fenêtre rapide : revenue à sa taille | idem au retour | parcours | garder ici | non |

**Verdict** : à réduire (garder 4 vérifs : #2, #5, #6, #7) — Échap et les gestes passent en test de composant, le texte long en capture.
**Défaut relevé (2026-11-24, ni e2e ni test)** : Échap dans la saisie d’un texte ferme toute l’annotation au lieu d’abandonner ce texte seul — Radix écoute Échap en capture sur le document, avant le `stopPropagation` de la saisie (`ImageAnnotator.tsx`). Un test de composant le montre (rouge) ; à corriger dans l’app avant de l’ajouter.
<!-- stats suite=annotate total=7 parcours=4 composant=2 unitaire-main=0 capture=1 doublon=0 couvert=4 verdict=reduire -->

### `command-output.mjs` — sortie d'une commande de l'agent (extension terminal ACP) : morceaux, couleurs ANSI, code de sortie, palette

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | sortie reçue en morceaux, couleurs ANSI rendues | patchs de sortie ACP assemblés jusqu'au fil | parcours | `parcours-outils`, étape 2 (ajouter un tour `/scenario commande`) | partiel : `src/shared/terminal-output.test.ts` › « applyTerminalPatch : ajout, remplacement, fin, troncature » ; › « parseAnsi : couleurs, gras, réinitialisation ; autres séquences retirées » |
| 2 | code de sortie affiché | ligne « code 0 » | composant | `thread/TerminalView.test.tsx` (à créer) | non |
| 3 | fond et vert ANSI de la palette | variables CSS appliquées au terminal | capture | capture nocturne | partiel : `src/shared/themes.test.ts` › « variables CSS : noms en kebab, coloration et ANSI » |
| 4 | variante de palette : ses propres couleurs | idem en variante | capture | capture nocturne | partiel : idem |
| 5 | commande en échec : code 2 signalé (`failed`) | statut et classe d'échec | composant | `thread/TerminalView.test.tsx` (à créer) | non |

**Verdict** : supprimable entièrement — à condition d'ajouter un tour `/scenario commande` à `parcours-outils` et de créer `TerminalView.test.tsx` ; les couleurs vont en capture.
<!-- stats suite=command-output total=5 parcours=1 composant=2 unitaire-main=0 capture=2 doublon=0 couvert=3 verdict=supprimable -->

### `commit-choisi.mjs` — « Committer d'abord » avec fichiers à cocher sur la carte « Fusion refusée » (40 fichiers dont un `.env`), dépôt git réel

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | liste complète, 40 cases cochées, cadre défilant, pas de résumé | tous les fichiers montrés et cochés | composant | `panel/CommitChooser.test.tsx` | `panel/CommitChooser.test.tsx` › « la liste complète, toutes cochées ; longue, elle défile et se déplie » |
| 2 | « secret ? » sur le .env seulement, coché quand même | repérage des secrets | composant | idem | `panel/CommitChooser.test.tsx` › « « secret ? » : .env*, *.pem, *.key, id_rsa*, *.p12, pas les autres » |
| 3 | tout décoché : bouton désactivé, raison écrite | rien ne part sans fichier | composant | idem | `panel/CommitChooser.test.tsx` › « tout décoché : bouton désactivé, la raison est écrite ; la case de tête recoche tout » |
| 4 | cases changées après la rédaction : dit, pas de relance | coût de la rédaction maîtrisé | composant | `panel/CommitDraft.test.tsx` | `panel/CommitDraft.test.tsx` › « cases changées après la réponse : le message retouché reste, « Rédiger à nouveau » le remplace » |
| 5 | .env décoché : hors du message, « reste non commité… », case de tête intermédiaire | le secret décoché n'est pas cité | composant | `panel/CommitBars.test.tsx` | `panel/CommitBars.test.tsx` › « fiche 244 : liste complète à cocher ; le .env décoché ne part pas, il est mis de côté » (+ `src/main/conversations/commit-draft.test.ts` › « réponse normale : message de l'agent, fichiers cochés, notes, secret retenu, lignes masquées ; agent arrêté, session supprimée ») |
| 6 | (waitFor) note « Fusionné… modification mise de côté revenue » | issue dite après la fusion | composant | idem | `panel/CommitBars.test.tsx` › « fiche 244 : liste complète à cocher ; le .env décoché ne part pas, il est mis de côté » |
| 7 | le .env n'est pas parti : non suivi, intact, hors historique, stash vide | chaîne renderer → IPC → git réel de bout en bout | parcours | `parcours-deleguer`, étape 4 (fusion, avec un `.env` non commité) ou garder ici | `src/main/changes/worktree-cycle.test.ts` › « fiche 244 : « Committer d'abord » des cochés ; le .env décoché ne part pas, et revient après la fusion » |
| 8 | les 39 cochés commités, puis la fusion a suivi | commit des cochés + fusion | unitaire-main | `src/main/changes/worktree-cycle.test.ts` | idem |

**Verdict** : à réduire (garder 1 vérif : #7, idéalement déplacée dans l'étape de fusion de `parcours-deleguer`) — tout le reste est déjà couvert en composant et en unitaire sur vrai git.
<!-- stats suite=commit-choisi total=8 parcours=1 composant=6 unitaire-main=1 capture=0 doublon=0 couvert=8 verdict=reduire -->

### `branch.mjs` — modifier un message et repartir de là (branche, fichiers remis, original intact, « Réessayer », branches à plat)

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | l'agent a modifié le README | mise en place (vraies modifications) | doublon | `parcours-matinee`, étape 5 | `parcours-matinee` › étape « vraies modifications, vues dans Modifications » |
| 2 | « Modifier » : le texte du message devient modifiable sur place | édition en place | composant | `thread/Transcript.test.tsx` (à ajouter) | non |
| 3 | fichiers modifiés depuis proposés à la remise en état (case cochée) | dialogue de branche | composant | `src/renderer/src/components/dialogs/BranchDialog.test.tsx` (à créer) | partiel : `src/main/conversations/branching.test.ts` › « aperçu : fichiers à remettre et commandes lancées depuis le message » ; `src/renderer/src/components/dialogs/AppDialogs.test.tsx` › « branche confirmée : le message repart avec les fichiers restaurés » |
| 4 | fichiers remis dans leur état d'alors (README restauré, créé supprimé) | restauration disque | unitaire-main | `src/main/conversations/branching.test.ts` | `src/main/conversations/branching.test.ts` › « branche préparée : fil repris et marqué, pièces jointes, contexte, titre ; fichiers remis » |
| 5 | branche : échange repris puis le nouveau message | fil de la branche | unitaire-main | idem | `src/main/conversations/branching.test.ts` › « branche préparée : fil repris et marqué, pièces jointes, contexte, titre ; fichiers remis » ; `src/shared/branch.test.ts` › « échange repris : ce qui précède, numérotation continue » |
| 6 | l'agent a reçu l'échange repris en contexte | contexte réellement envoyé par ACP | parcours | `parcours-matinee` (étape à ajouter : repartir d'un message) ou garder ici | partiel : `src/shared/branch.test.ts` › « contexte : messages et outils résumés, consignes, bornes de taille » |
| 7 | historique : icône de fork, titre complet en infobulle | repère de branche | composant | `sidebar/Sidebar.test.tsx` | `sidebar/Sidebar.test.tsx` › « branche et original distinguables : repère visible, titre complet en infobulle (fiche 125) » |
| 8 | en-tête : « ↳ branche de « … » » | origine dans le titre | composant | `sidebar/ConversationTitle.test.tsx` (à créer) | non |
| 9 | titre de session de l'agent (contexte) ni dans la liste, ni le titre, ni la carte | titre de l'app gardé | unitaire-main | `src/main/conversations/` (test du titrage, à ajouter) | non |
| 10 | « Voir l'original » : conversation d'origine intacte | original non touché, bascule réelle | parcours | même étape que #6 | non |
| 11 | « Réessayer » : nouvelle branche, même message rejoué, pas de dialogue | rejeu par l'agent, disque réécrit | parcours | même étape que #6 | partiel : `thread/Transcript.test.tsx` › « prêt : l'icône sous le dernier message, nommée « Réessayer dans une nouvelle branche » » |
| 12 | liste : branches à plat, repère, titres au même bord | pas d'imbrication ni de décalage | composant | `sidebar/Sidebar.test.tsx` (classes `nested`/`row-slot` ; bord exact en capture) | partiel : `sidebar/Sidebar.test.tsx` › « plus de colonne d'icône vide : seule une fille sous sa mère en a une, avec son lien » |

**Verdict** : à réduire (garder 3 vérifs : #6, #10, #11, regroupées en une étape « repartir d'un message » de `parcours-matinee`) — le reste en composant ou unitaire.
<!-- stats suite=branch total=12 parcours=3 composant=5 unitaire-main=3 capture=0 doublon=1 couvert=8 verdict=reduire -->

#### Totaux (lot 2)

128 vérifications : parcours 32, composant 51, unitaire-main 27, capture 15, doublon 3 ; 93 avec un test cité (complet ou partiel).

#### Risques repérés (lot 2)

- Autorisation de commande (M1, sécurité) : « fin de la commande atteignable » et « molette contenue » dépendent de la vraie mise en page et du défilement de Chromium (fil, carte, 900 px panneau ouvert). jsdom ne les voit pas : à garder en e2e, pas seulement en capture.
- Le focus d'un bouton de carte (#2 d'autorisation-commande) dépend aussi du focus global de l'app (focus-keeper, saisie) : un test de composant isolé peut passer alors que l'app vole le focus.
- Navigateur : la garde de navigation (SEC-1), l'attribution « agent / utilisateur » (délai de 1,5 s, `sendInputEvent`), les popups avec `opener`, les blobs révoqués et les boîtes `confirm()` natives ne vivent que dans Electron/Chromium. Les tests unitaires simulent le CDP et les webContents.
- Navigateur : masquer la WebContentsView sous les Réglages ou le menu « + » est une propriété native (la page passe au-dessus du DOM). Aucun test de composant ne peut l'attraper.
- Outils de débogage (console, réseau, eval, émulation) : couverts en unitaire contre un CDP simulé. Un changement de contrat CDP d'Electron passerait inaperçu sans au moins un tour réel (garder un `/scenario debogage-web` quelque part ?).
- Annotation : canvas absent en jsdom (`toDataURL`, `naturalWidth`), `-webkit-app-region` venu de styles.css non chargé, redimensionnement de la fenêtre rapide : rien de tout ça n'est vérifiable en composant.
- Sortie de commande : la chaîne patchs ACP → main → renderer (`terminalPatchOf` / `applyTerminalPatch`) n'est testée que par morceaux. Si la suite part, il faut un tour `/scenario commande` dans un parcours.
- Commit choisi et branche : vrai git et vrai disque à travers l'IPC (fichiers cochés transmis, stash, restauration). Les tests main utilisent du vrai git, mais le câblage renderer → preload → main n'est vu qu'en e2e.
- Branche : le contexte repris doit vraiment arriver à l'agent par ACP (#6), et le titre de session de l'agent doit être ignoré (#9). Les deux reposent sur le comportement de l'agent factice (`MOCK_AGENT_TITLES=prompt`).
- Cartes « fichier » serrées (dossier coupé d'abord, nom entier) : l'algorithme lit des largeurs mesurées (ResizeObserver). Un test de composant ne vérifiera que la logique sur des largeurs simulées : la capture reste nécessaire.

---

## Lot 3

Suites : `roles-travail`, `session`, `connexion-expiree`, `pannes-visibles`, `reprise`, `failures`.
Chemins de tests relatifs à `src/` sauf mention ; journées types dans `e2e/suites/`.

### `roles-travail.mjs` — `@rôle` dans la saisie (menu, jeton, ligne « Sera confié à… »), cartes-réponses (en cours, a répondu, transmise, Répondre, arrêtée, en erreur), en-tête d'une fille, propositions de l'agent, lecture seule demandée ou garantie.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | conversation neuve : historique vide (L134) | précondition : la conversation neuve n'est pas encore dans l'historique | composant | `main/conversations/manager.test.ts` (existant) | `main/conversations/manager.test.ts` › « au lancement : une conversation vide active, hors historique » |
| 2 | premier message `@rôle` : parti, saisie vidée, une bulle, une carte de groupe à 2 lignes (L143) | un `@rôle` comme tout premier message part (brouillon → historique → deux filles lancées par le main), rien n'est refusé | parcours | garder ici (ou étape de `parcours-reglages`, qui fait déjà un `@ux-ui-expert` mais pas en premier message) | partiel : `main/roles/roles-children.test.ts` › « `@rôle` en premier message d'une conversation neuve : elle entre dans l'historique, la fille s'y rattache » ; `renderer/src/components/roles/RoleComposer.test.tsx` › « conversation encore vide : rien ne retient le premier `@rôle` (elle entre dans l'historique) » |
| 3 | historique titré d'après la demande, deux filles dessous (waitFor L149-155) | la mère entre dans la barre latérale avec le bon titre et ses deux filles rattachées (`data-mother`) | parcours | garder ici, fusionné avec le n° 2 | partiel : `main/roles/invoke.test.ts` › « plusieurs rôles : chaque travail titré d'après son rôle ; un seul : titre de la demande (fiche 272) » |
| 4 | menu @ : cinq rôles, puis « Tous les rôles » (L176) | menu borné à 5 rôles, avec l'entrée « Tous les rôles » | composant | `RoleComposer.test.tsx` (existant) | `renderer/src/components/roles/RoleComposer.test.tsx` › « cinq rôles, « Tous les rôles (7) », puis les fichiers ; marque d'un rôle du projet » |
| 5 | menu @ : section « Rôles », marque du rôle du projet (L179) | titre de section, marque d'un rôle venu du projet | composant | `RoleComposer.test.tsx` (existant, ajouter le titre de section) | partiel : même test que n° 4 (marque oui, titre de section non) |
| 6 | filtre « secu » : `security-expert` en tête (waitFor L192) | filtre sans accents, le nom avant la description | composant | `RoleComposer.test.tsx` (existant) | `renderer/src/components/roles/RoleComposer.test.tsx` › « filtre : nom d'abord, puis la description ; accents ignorés » |
| 7 | Échap referme le menu, le texte reste ; on rouvre (waitFor L196-198) | Échap ne perd pas la saisie | composant | `RoleComposer.test.tsx` (existant) | `renderer/src/components/roles/RoleComposer.test.tsx` › « flèches puis Entrée : le rôle surligné ; Échap referme le menu » |
| 8 | Entrée : jeton, `@requête` sort du texte (L201) | le choix devient un jeton, la requête sort du texte | composant | `RoleComposer.test.tsx` (existant) | `renderer/src/components/roles/RoleComposer.test.tsx` › « Entrée choisit le rôle : un jeton, `@requête` sort du texte ; « Sera confié à… » » |
| 9 | ligne « Sera confié à… » : lecture seule, dans ce dossier (L207) | la destination dit la lecture seule et « dans ce dossier » | composant | `RoleComposer.test.tsx` (à compléter : textes exacts) | partiel : même test que n° 8 ; `renderer/src/components/thread/ChildProposals.test.tsx` › « une ligne d'un rôle en lecture seule n'attend pas : elle travaille dans ce dossier » |
| 10 | rôle sans demande : l'aide en gris (couleur calculée = `--muted`) (L230) | l'aide n'a pas la couleur d'alerte (N7) | doublon | `RoleComposer.test.tsx` (vérifie la classe) | `renderer/src/components/roles/RoleComposer.test.tsx` › « rien à demander après le rôle : bouton désactivé et dit pourquoi, Entrée n'envoie rien » |
| 11 | retour arrière en tête de la saisie : le jeton part d'un coup (waitFor L237) | retrait du jeton au clavier | composant | `RoleComposer.test.tsx` (existant) | `renderer/src/components/roles/RoleComposer.test.tsx` › « retour arrière en tête de la saisie : le dernier jeton part d'un coup » |
| 12 | envoi : la saisie se vide, rien à la mère (L251) | un jeton envoie à la fille, pas à la conversation | composant | `RoleComposer.test.tsx` (existant) | `renderer/src/components/roles/RoleComposer.test.tsx` › « un jeton : une fille, le texte sans rien d'autre ; rien à la conversation » |
| 13 | une bulle avec la puce du rôle et une carte-réponse, rien d'autre (L254) | ni lancement, ni « Sous-tâches », ni compte rendu séparés | doublon | `WorkCard.test.tsx` + étape de `parcours-reglages` | `renderer/src/components/thread/WorkCard.test.tsx` › « en cours : la bulle et sa carte dans un même groupe ; « Travaille… », puis les faits au passé » ; `parcours-reglages` › étape « confier une question à un rôle (@ux-ui-expert) » |
| 14 | deux rôles : la ligne résume (« 2 ») (L268) | la ligne « Sera confié à… » résume plusieurs rôles | composant | `RoleComposer.test.tsx` (à compléter) | partiel : `renderer/src/components/roles/RoleComposer.test.tsx` › « deux `@rôle` tapés en entier : deux filles, en parallèle, même texte » (pas le texte de la ligne) |
| 15 | deux rôles : deux filles au travail, anneau sur l'avatar (L288) | deux tours de filles tenus en parallèle par de vrais agents ; leur état « en cours » | doublon | `parcours-deleguer` étape 1 (trois travaux lancés ensemble) ; rendu dans `WorkGroup.test.tsx` | partiel : `parcours-deleguer` › étape 1 (« Tout lancer », tous répondent) ; `renderer/src/components/thread/WorkGroup.test.tsx` › « « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé » |
| 16 | capture prise pendant le travail (verrou tenu) (L291) | la capture montre bien l'état « en cours » | capture | capture nocturne | non |
| 17 | deux rôles : une bulle à deux puces, une carte de groupe, une ligne par rôle dans l'ordre (L300) | regroupement et ordre | composant | `WorkCard.test.tsx` (existant) | `renderer/src/components/thread/WorkCard.test.tsx` › « plusieurs rôles : une bulle, deux puces, puis une carte de groupe sans « proposés » (fiche 264) » |
| 18 | pas de carte « Sous-tâches » pour les travaux d'une bulle (L309) | pas de carte en double | composant | `WorkCard.test.tsx` (existant) | `renderer/src/components/thread/WorkCard.test.tsx` › « un travail lancé par l'agent garde « Sous-tâches » et son compte rendu, sans ceux des bulles » |
| 19 | en-tête de la fille : son rôle, lecture seule garantie (L319) | badge du rôle, niveau `enforced` | composant | `RoleWork.test.tsx` (existant, ajouter `enforced`) | partiel : `renderer/src/components/roles/RoleWork.test.tsx` › « en-tête de la fille : son rôle et sa lecture seule » (cas « demandée ») |
| 20 | en-tête étroit + pastille temporaire : titre ≥ 90 px, rien ne déborde (L341) | mise en page de l'en-tête à 1 280 px | capture | capture nocturne | partiel : `renderer/src/components/roles/RoleWork.test.tsx` › « entière tant qu'elle tient ; réduite au-delà ; rendue entière avec une marge » |
| 21 | en-tête étroit, profil temporaire : pastille entière (L365) | pastille jamais coupée | capture | capture nocturne | partiel : même test que n° 20 |
| 22 | 800 px : pastille entière, titre ≥ 90 px, rien ne déborde (L372) | mise en page à la largeur minimale | capture | capture nocturne | non |
| 23 | 800 px, mur de 260 px : pastille réduite à son icône, entière (L388) | la réduction mesurée par le navigateur se déclenche | capture | capture nocturne (logique de seuil : `RoleWork.test.tsx`) | partiel : `renderer/src/components/roles/RoleWork.test.tsx` › « réduite : l'icône seule, le texte pour le lecteur d'écran et en infobulle » |
| 24 | proposition : lecture seule garantie, mode, rôle du projet qui remplace le fourni (L402) | carte de proposition figée et complète | composant | `RoleWork.test.tsx` (existant) | `renderer/src/components/roles/RoleWork.test.tsx` › « badge, mode, lecture seule garantie, agent ; rôle du projet qui en remplace un autre » |
| 25 | proposition lancée : sa ligne dans sa carte de groupe, ni lancement ni « Sous-tâches » (L417) | travail lancé par l'agent rangé dans la carte des propositions | composant | `WorkGroup.test.tsx` (existant) | `renderer/src/components/thread/WorkGroup.test.tsx` › « « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé » |
| 26 | en cours : bulle, carte juste dessous, temps `m:ss`, Arrêter, Ouvrir (L466) | carte « en cours » complète | composant | `WorkCard.test.tsx` (existant) | `renderer/src/components/thread/WorkCard.test.tsx` › « en cours : la bulle et sa carte dans un même groupe ; « Travaille… », puis les faits au passé » ; `WorkCard.test.tsx` › « minutes et secondes, puis heures » |
| 27 | capture prise pendant le travail (L476) | la capture montre l'état « en cours » | capture | capture nocturne | non |
| 28 | a répondu : Markdown entier, replié, pas transmis ; Appliquer, Répondre (L497) | état « a répondu » (le repli mesuré `clientHeight < scrollHeight` n'existe pas en jsdom) | composant | `WorkCard.test.tsx` (existant) | `renderer/src/components/thread/WorkCard.test.tsx` › « a répondu : la réponse entière, repliée, « Lire la suite » ; pied « heure · durée · gratuit » » |
| 29 | 900 px : rien ne déborde de la carte (L516) | retrait réduit en fenêtre étroite | capture | capture nocturne | non |
| 30 | « Lire la suite » déplie, « Replier » referme (L521) | bascule du repli | composant | `WorkCard.test.tsx` (existant) | `renderer/src/components/thread/WorkCard.test.tsx` › « a répondu : la réponse entière, repliée, « Lire la suite » ; pied « heure · durée · gratuit » » |
| 31 | transmise : le message préparé sous la carte, l'action principale disparue (L545) | « Appliquer » envoie un message lisible à la mère, puis l'état « transmise » | composant | `WorkCard.test.tsx` (existant) | `renderer/src/components/thread/WorkCard.test.tsx` › « « Appliquer » : message lisible (rôle, titre), le travail visé à part ; un clic à la fois » ; `WorkCard.test.tsx` › « transmise : action principale retirée, réponse discrète ; pas « transmise » si le tour a échoué » |
| 32 | Répondre : jeton `data-reply` (waitFor L556-558), la suite et sa réponse dans la même carte, aucun nouveau travail (L565) | la suite part à la session de la même fille (main) et revient dans la même carte | parcours | garder ici | partiel : `renderer/src/components/roles/RoleComposer.test.tsx` › « jeton marqué, ligne « Répondra à … dans le même travail », Entrée part au travail visé » ; `renderer/src/components/thread/WorkCard.test.tsx` › « « Répondre » : la puce et le rôle du travail vont à la saisie ; une seule carte » |
| 33 | arrêté : ce travail seulement, « Relancer » proposé (L591) | Arrêter vise un travail, pas les autres | composant | `WorkCard.test.tsx` (existant) | `renderer/src/components/thread/WorkCard.test.tsx` › « arrêté : état clair, « Relancer » renvoie la même demande, un clic à la fois » ; `renderer/src/components/roles/RoleWork.test.tsx` › « rôle arrêté par ■ : « arrêté », jamais « a répondu » (fiche 258, D4) » |
| 34 | en erreur : l'erreur dite dans la carte, « Relancer » (L606) | erreur du tour de la fille affichée | composant | `WorkCard.test.tsx` (existant) | `renderer/src/components/thread/WorkCard.test.tsx` › « en erreur : l'erreur dite, « Relancer » ; un échec de l'envoi est dit » |
| 35 | agent qui écrit sans demander : « lecture seule demandée » avant l'envoi (L623) | niveau honnête dès la saisie | composant | `RoleComposer.test.tsx` (existant) | `renderer/src/components/roles/RoleComposer.test.tsx` › « agent qui écrit sans demander : « lecture seule demandée » » |
| 36 | proposition : lecture seule seulement demandée (L640) | niveau `requested` sur la carte | composant | `RoleWork.test.tsx` (existant) | `renderer/src/components/roles/RoleWork.test.tsx` › « agent qui écrit sans demander : lecture seule seulement demandée, sans nom d'agent » |
| 37 | en-tête de la fille : lecture seule seulement demandée (L657) | niveau `requested` dans l'en-tête | composant | `RoleWork.test.tsx` (existant) | `renderer/src/components/roles/RoleWork.test.tsx` › « en-tête de la fille : son rôle et sa lecture seule » |

**Verdict** : à réduire (garder 3 vérifs : n° 2-3 `@rôle` en tout premier message, n° 32 « Répondre » dans la même carte) : presque tout le reste est déjà en test de composant. Les contrôles de mise en page de l'en-tête et de la carte (n° 20-23, 29) passent en capture nocturne. Les vérifs gardées peuvent devenir une étape de `parcours-reglages`.
<!-- stats suite=roles-travail total=37 parcours=3 composant=24 unitaire-main=0 capture=7 doublon=3 couvert=33 verdict=reduire -->

### `session.mjs` — onglet « Session » du panneau : ouverture automatique, environnement, contexte (avec et sans total), mesure des MCP, modifications, ce qui tourne et son arrêt, compaction, fenêtre étroite.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | conversation vide : panneau fermé (L116) | pas d'ouverture automatique sans message | composant | `usePanel.test.ts` (existant) | `renderer/src/usePanel.test.ts` › « à l'ouverture d'une conversation non vide, s'il reste 500 px ; pas en fenêtre étroite » |
| 2 | premier message : le panneau s'ouvre de lui-même sur « Session », premier onglet (L120) | ouverture automatique, « Session » en tête | composant | `usePanel.test.ts` + `panel-tabs.test.ts` (existants) | `renderer/src/usePanel.test.ts` › « à l'ouverture d'une conversation non vide, s'il reste 500 px ; pas en fenêtre étroite » ; `renderer/src/panel-tabs.test.ts` › « « Session » (fiche 166) : toujours en tête, hors ordre d'arrivée ; fermé, dans « + » » |
| 3 | environnement : agent, modèle, mode, dossier et branche (L130) | les cinq lignes, branche git lue | composant | `SessionTab.test.tsx` (à compléter : agent, puces, branche) | oui : `src/renderer/src/components/panel/SessionTab.test.tsx › onglet « Session » rendu entier (fiches 166, 176) › environnement : agent, modèle, mode, dossier et branche` |
| 4 | la puce du modèle ouvre le menu des modèles (waitFor L139, check L140) | puce de l'environnement branchée sur le même menu | composant | `SessionTab.test.tsx` (à créer : clic sur la puce) | oui : même test que #3 (clic sur la puce : le menu des modèles s’ouvre) |
| 5 | environnement : cinq icônes de 16 px au même x, lignes de 32 px (L171) | alignement en colonne | capture | capture nocturne | non |
| 6 | contexte : barre, %, lignes Messages…Libre dans l'ordre (L184) | répartition complète avec total de l'agent, Mémoire comprise | composant | `SessionTab.test.tsx` (existant) | `renderer/src/components/panel/SessionTab.test.tsx` › « avec le total de l'agent : barre, pourcentage, Agent et Libre » |
| 7 | estimations précédées de « ≈ », « Libre » sans (L192) | estimation et valeur exacte distinguées | composant | `SessionTab.test.tsx` (existant) | `renderer/src/components/panel/SessionTab.test.tsx` › « total de l'agent : pas d'explication d'estimation, « Libre » exact » |
| 8 | lignes occupées = total annoncé, toutes = taille (L208) | cohérence arithmétique de la répartition | unitaire-main | `shared/context-breakdown.test.ts` (existant) | `shared/context-breakdown.test.ts` › « avec un total : la somme des lignes vaut la taille, « Agent » est le reste » |
| 9 | autres MCP : « Mesurer », aucun serveur lancé à l'ouverture (L216) | l'onglet ne lance jamais de serveur MCP de lui-même | composant | `SessionTab.test.tsx` (existant) | `renderer/src/components/panel/SessionTab.test.tsx` › « l'affichage ne lance aucune sonde ; « measure » teste les serveurs activés » |
| 10 | « Mesurer » lance le serveur une fois, la valeur s'affiche (L227) | vrai serveur MCP de la config de l'agent lancé une fois par le main, jetons relus | parcours | garder ici (ou étape de `parcours-outils`) | partiel : `main/agent-config/mcp-probe.test.ts` › « commande locale : serveur, outils sur deux pages, prompts ; répond à ses requêtes » ; `renderer/src/components/panel/SessionTab.test.tsx` › « autres MCP jamais mesurés : « Mesurer », qui lance la mesure sur demande » |
| 11 | aucun coût dans l'onglet (L232) | le coût n'apparaît jamais ici | composant | `SessionTab.test.tsx` (existant) | `renderer/src/components/panel/SessionTab.test.tsx` › « avec le total de l'agent : barre, pourcentage, Agent et Libre » (`not.toMatch(/\$\|USD/)`) |
| 12 | modifications : conversation « Aucune », dossier « 1 fichier non commité +3 −1 » (L241) | deux lignes, chiffres lus du dépôt | composant | `SessionChanges.test.tsx` (existant) | `renderer/src/components/panel/SessionChanges.test.tsx` › « conversation neuve dans un dossier au fichier non commité : « Aucune » / « 1 fichier non commité » » |
| 13 | la ligne ouvre l'onglet Modifications (L252) | navigation vers Modifications | composant | `SessionChanges.test.tsx` (existant) | oui : `src/renderer/src/components/panel/SessionChanges.test.tsx › onglet « Session » : Modifications (fiche 207) › conversation neuve dans un dossier au fichier non commité : « Aucune » / « 1 fichier non commité »` (clic → `onOpenGit`) ; `src/renderer/src/components/panel/SessionTab.test.tsx › onglet « Session » rendu entier (fiches 166, 176) › environnement : agent, modèle, mode, dossier et branche` (branche → `onOpenGit`) |
| 14 | terminal à l'invite : rien en cours (L263) | un shell inactif n'est pas « en cours » | composant | `session-running.test.ts` (existant) | `renderer/src/session-running.test.ts` › « terminal : seulement pendant qu'une commande tourne, sous son nom, depuis son début » |
| 15 | `sleep 30` : en cours sous le nom de la commande (waitFor L273, check L274) | la commande du vrai pty est vue par le main et remontée | parcours | garder ici, ou étape de `parcours-outils` (terminal) | partiel : `renderer/src/session-running.test.ts` › « terminal : seulement pendant qu'une commande tourne, sous son nom, depuis son début » |
| 16 | sous-agent en arrière-plan : en cours, sans Arrêter (L285) | ACP n'a pas d'arrêt pour un sous-agent | composant | `session-running.test.ts` (existant) | `renderer/src/session-running.test.ts` › « sous-agents en arrière-plan : ni arrêt (ACP n'en a pas), ni ceux de premier plan » |
| 17 | serveur de dev : en cours (L298) | le serveur lancé par l'agent apparaît | composant | `session-running.test.ts` (existant) | `renderer/src/session-running.test.ts` › « serveur arrêté : terminé ; arrêtable tant qu'il tourne » |
| 18 | en cours : terminal, sous-agent, serveur, fille, chacun avec sa durée (L317) | les quatre sortes listées ensemble | composant | `SessionTab.test.tsx` (existant) | `renderer/src/components/panel/SessionTab.test.tsx` › « durée, Arrêter quand Bobine sait, rien pour un sous-agent ; terminées repliées » |
| 19 | Arrêter coupe la commande du terminal (onglet gardé), le serveur, le tour de la fille (×3, L332-341) | vrais processus arrêtés depuis l'onglet | parcours | garder ici | partiel : `main/terminal/terminal-manager.test.ts` › « « Arrêter » : Ctrl+C, puis SIGTERM si la même commande tourne encore ; rien à l'invite » |
| 20 | Terminées : 3 (une commande du terminal n'y va pas) (L349) | comptage des terminées | composant | `session-running.test.ts` (existant) | partiel : `renderer/src/components/panel/SessionTab.test.tsx` › « durée, Arrêter quand Bobine sait, rien pour un sous-agent ; terminées repliées » |
| 21 | dépliées : les trois terminées ; plus rien en cours (L357) | bascule « Terminées » | composant | `SessionTab.test.tsx` (existant) | `renderer/src/components/panel/SessionTab.test.tsx` › « durée, Arrêter quand Bobine sait, rien pour un sous-agent ; terminées repliées » |
| 22 | après /compact, Messages baisse (L370) | la compaction remet le compte à zéro | unitaire-main | `shared/context-breakdown.test.ts` (existant) | `shared/context-breakdown.test.ts` › « compaction terminée : seuls les éléments depuis la dernière comptent » |
| 23 | autre conversation : le panneau s'ouvre de nouveau (L382) | la fermeture reste propre à une conversation | composant | `usePanel.test.ts` (existant) | `renderer/src/usePanel.test.ts` › « fermé par l'utilisateur : ne se rouvre plus de lui-même pour cette conversation » |
| 24 | retour là où il a été fermé : il reste fermé (L392) | le choix de l'utilisateur est retenu par conversation | composant | `usePanel.test.ts` (existant) | `renderer/src/usePanel.test.ts` › « fermé par l'utilisateur : ne se rouvre plus de lui-même pour cette conversation » |
| 25 | fenêtre étroite : pas d'ouverture d'office (L403) | 500 px gardés à la conversation | composant | `usePanel.test.ts` + `panel-tabs.test.ts` (existants) | `renderer/src/panel-tabs.test.ts` › « ouverture d'office (fiche 166) : panneau fermé, pas refusé, et 500 px pour la conversation » |
| 26 | sans total : « ≈ N utilisés », pas de % (L425) | agent sans `usage_update` (Bob) | composant | `SessionTab.test.tsx` (existant) | `renderer/src/components/panel/SessionTab.test.tsx` › « sans total (Bob) : « ≈ N utilisés », ni barre, ni Agent, ni Libre ; l'agent est nommé » |
| 27 | sans total : seulement le détail connu, ni Agent ni Libre, explication (L431) | idem, lignes et explication | composant | `SessionTab.test.tsx` (existant) | `renderer/src/components/panel/SessionTab.test.tsx` › « sans total (Bob) : « ≈ N utilisés », ni barre, ni Agent, ni Libre ; l'agent est nommé » |
| 28 | conversation neuve : « Aucune » / « 1 fichier non commité » (L482) | idem n° 12, autre dépôt | doublon | `SessionChanges.test.tsx` (existant, même libellé) | `renderer/src/components/panel/SessionChanges.test.tsx` › « conversation neuve dans un dossier au fichier non commité : « Aucune » / « 1 fichier non commité » » |
| 29 | après travail : conversation « 2 fichiers +6 −1 », dossier « 3 non commités » (L498) | les deux lignes suivent le travail réel de l'agent | composant | `SessionChanges.test.tsx` (existant) | `renderer/src/components/panel/SessionChanges.test.tsx` › « après travail : ce que la conversation a modifié, qui ouvre la vue Conversation » |
| 30 | « Conversation » ouvre Modifications › Conversation (waitFor L508, check L511) | navigation vers la bonne vue | composant | `SessionChanges.test.tsx` (existant) | `renderer/src/components/panel/SessionChanges.test.tsx` › « après travail : ce que la conversation a modifié, qui ouvre la vue Conversation » |
| 31 | « Dossier » ouvre Modifications › Git (waitFor L515, check L516) | navigation vers la vue Git | composant | `SessionChanges.test.tsx` (à compléter) | oui : `src/renderer/src/components/panel/SessionChanges.test.tsx › onglet « Session » : Modifications (fiche 207) › conversation neuve dans un dossier au fichier non commité : « Aucune » / « 1 fichier non commité »` (« Dossier » → `onOpenGit` ; la vue Git ouverte : `usePanel.test.ts`) |

**Verdict** : à réduire (garder 3 vérifs : n° 10 « Mesurer » lance le vrai serveur MCP, n° 15 commande du pty vue « en cours », n° 19 Arrêter coupe de vrais processus) : tout le reste est déjà en test de composant ou de logique partagée. Les trois vérifs gardées peuvent devenir une étape de `parcours-outils`. Le second lancement (sans total) et `changesRows` sont entièrement supprimables.
<!-- stats suite=session total=31 parcours=3 composant=24 unitaire-main=2 capture=1 doublon=1 couvert=30 verdict=reduire -->

### `connexion-expiree.mjs` — refus `authRequired` en pleine conversation (carte, statut, connexion dans le terminal, Réessayer), refus après un outil, refus `-32603` de Bob reconnecté par SSO, modèle d'un fournisseur non connecté.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | carte « Connexion expirée », pas d'avis en double, pas l'erreur brute (L46) | refus traduit en carte, avis du fil masqué pendant que la carte est là | composant | `shared/transcript-notice.test.ts` + `main/agent/turn-auth.test.ts` (existants) | `shared/transcript-notice.test.ts` › « pas d'avis en double tant que la carte est à l'écran » ; `main/agent/turn-auth.test.ts` › « message refusé : carte, pas l'erreur brute ; « Réessayer » le renvoie une fois » |
| 2 | statut « Connexion expirée », invite de la saisie (L52) | statut et placeholder dédiés | composant | `turn-auth-text.test.ts` (existant) | `renderer/src/turn-auth-text.test.ts` › « sans modèle (Bob) : « Connexion expirée », comme avant » |
| 3 | carte : la commande du profil, pas de clé d'API (L58) | rien de supposé sur l'agent | composant | `BlockerPanel.test.tsx` (existant) | `renderer/src/components/composer/BlockerPanel.test.tsx` › « commande déclarée par le profil : affichée telle quelle, sans rien supposer de l'agent » ; `main/agent/turn-auth.test.ts` › « clé d'API : seulement si le profil la dit utile, ou si c'est le seul moyen » |
| 4 | un seul bouton principal : se connecter (L64) | hiérarchie des boutons | composant | `BlockerPanel.test.tsx` (existant) | `renderer/src/components/composer/BlockerPanel.test.tsx` › « un seul bouton principal : la connexion, puis « Réessayer » une fois l'étape lancée » |
| 5 | sous la carte : pas d'icône « Réessayer » en branche (L68) | pas de seconde voie concurrente | composant | `Transcript.test.tsx` (existant) | `renderer/src/components/thread/Transcript.test.tsx` › « message refusé, carte en attente : pas d'icône (la carte le renvoie en place) » |
| 6 | commande lancée dans le terminal (waitFor L79), puis « Réessayer » devient principal (L83) | l'étape du profil tourne vraiment dans le pty du panneau, la carte le voit | parcours | garder ici (ou étape de `parcours-pannes`) | partiel : `renderer/src/components/composer/BlockerPanel.test.tsx` › « connexion lancée dans le terminal : « Réessayer » apparaît et devient le principal » |
| 7 | Réessayer : message renvoyé une fois, l'agent répond, redevient prêt (L91) | renvoi de bout en bout (renderer → main → ACP → fil) | parcours | garder ici | `main/agent/turn-auth.test.ts` › « message refusé : carte, pas l'erreur brute ; « Réessayer » le renvoie une fois » |
| 8 | Réessayer : toujours une seule conversation, pas de branche (L96) | le renvoi ne crée ni conversation ni branche | unitaire-main | `main/conversations/turn-auth-manager.test.ts` (existant) | partiel : `main/conversations/turn-auth-manager.test.ts` › « SSO, puis un message écrit pendant le renvoi : un seul agent, renvoi puis le nouveau message » |
| 9 | prêt : l'icône revient, nommée « Réessayer dans une nouvelle branche » (L100) | libellé de l'icône une fois prêt | doublon | `Transcript.test.tsx` (existant) | `renderer/src/components/thread/Transcript.test.tsx` › « prêt : l'icône sous le dernier message, nommée « Réessayer dans une nouvelle branche » » |
| 10 | outils déjà lancés : « Réessayer » demande confirmation, seul principal (L125) | pas de double exécution sans le dire | composant | `BlockerPanel.test.tsx` (existant) | `renderer/src/components/composer/BlockerPanel.test.tsx` › « outils déjà lancés : la carte le dit, et « Réessayer » demande confirmation » |
| 11 | confirmé : renvoyé une fois (L137) | renvoi unique après confirmation | unitaire-main | `main/agent/turn-auth.test.ts` (existant) | `main/agent/turn-auth.test.ts` › « refus après un outil : `toolsRan`, gardé si le renvoi est refusé de nouveau » |
| 12 | Bob : carte, pas d'avis en double, pas l'erreur brute (L158) | refus `-32603` de Bob 2.0.9 reconnu par la règle du profil | unitaire-main | `main/agent/turn-auth.test.ts` (existant) | `main/agent/turn-auth.test.ts` › « refus de Bob 2.0.9 (`-32603`, fiche 200) : carte, clé d'API, SSO puis renvoi » ; `turn-auth.test.ts` › « la trace enregistrée est bien celle du mock (`connexion-expiree-bob`) » |
| 13 | Bob : statut « Connexion expirée », SSO proposée (L164) | statut et bouton SSO | composant | `BlockerPanel.test.tsx` (existant) | `renderer/src/components/composer/BlockerPanel.test.tsx` › « connexion expirée refaite par SSO : la même question, un seul « Réessayer » » |
| 14 | Bob : reconnecté par SSO, renvoyé une fois, l'agent répond (L175) | `authenticate` puis renvoi dans la même session | unitaire-main | `main/agent/turn-auth.test.ts` (existant) | `main/agent/turn-auth.test.ts` › « connexion par SSO (`authenticate`) : même session, le message renvoyé » |
| 15 | modèle refusé : la carte nomme le modèle (L196) | titre et sous-titre propres au modèle | composant | `BlockerPanel.test.tsx` (existant) | `renderer/src/components/composer/BlockerPanel.test.tsx` › « la carte nomme le modèle : « Choisir un autre modèle » (principal) et « Se connecter » » |
| 16 | deux actions : « Choisir un autre modèle » (principal) et « Se connecter » (L202) | hiérarchie des boutons | doublon | `BlockerPanel.test.tsx` (existant, même cas) | `renderer/src/components/composer/BlockerPanel.test.tsx` › « la carte nomme le modèle : « Choisir un autre modèle » (principal) et « Se connecter » » |
| 17 | fil : pas d'avis en double tant que la carte nomme le modèle (L208) | masquage de l'avis | composant | `shared/transcript-notice.test.ts` (existant) | `shared/transcript-notice.test.ts` › « pas d'avis en double tant que la carte est à l'écran » |
| 18 | sous la carte : pas d'icône « Réessayer », une seule conversation (L217) | pas de voie concurrente | composant | `Transcript.test.tsx` (existant) | `renderer/src/components/thread/Transcript.test.tsx` › « message refusé, carte en attente : pas d'icône (la carte le renvoie en place) » |
| 19 | statut « Modèle refusé », invite « Choisissez un autre modèle… » (L221) | statut et placeholder du modèle refusé | composant | `turn-auth-text.test.ts` (existant) | `renderer/src/turn-auth-text.test.ts` › « modèle nommé : « Modèle refusé », et une invite qui propose un autre modèle » |
| 20 | sélecteur : modèle refusé marqué « connexion à faire », l'autre non (L232) | marque dans le menu de la carte | composant | `BlockerPanel.test.tsx` (existant) | `renderer/src/components/composer/BlockerPanel.test.tsx` › « le sélecteur s'ouvre ; un autre modèle choisi est rendu, le modèle refusé marqué » |
| 21 | autre modèle : renvoyé une fois, même conversation, l'agent répond (L246) | changement de modèle puis renvoi | unitaire-main | `main/agent/turn-auth-model.test.ts` (existant) | `main/agent/turn-auth-model.test.ts` › « carte avec le modèle ; un autre modèle choisi renvoie le message une fois, même session » ; `main/conversations/turn-auth-manager.test.ts` › « autre modèle choisi sur la carte (fiche 210) : même conversation, message renvoyé une fois, modèle refusé marqué » |
| 22 | le modèle refusé reste marqué dans le sélecteur de la saisie (waitFor L256, check L259) | la marque (main) survit à la carte et atteint la puce de la saisie | composant | `ModelChip.test.tsx` (à compléter : marque) | partiel : `main/agent/turn-auth-model.test.ts` › « aucun modèle ne répond : la carte revient avec le nouveau modèle, les deux marqués » |

**Verdict** : à réduire (garder 2 vérifs : n° 6 connexion dans le vrai terminal, n° 7 « Réessayer » de bout en bout) : chaque règle (carte, statut, avis masqué, Bob, modèle refusé) a déjà son test de composant ou du main. Les deux vérifs gardées peuvent devenir une étape de `parcours-pannes`. Les trois autres lancements de l'app (outil, Bob, modèle) sont supprimables.
<!-- stats suite=connexion-expiree total=22 parcours=2 composant=13 unitaire-main=5 capture=0 doublon=2 couvert=22 verdict=reduire -->

### `pannes-visibles.mjs` — agent qui ne joint pas son modèle (proxy, relance), agent silencieux, agent tenace qui ignore Stop et SIGTERM, processus restants (kill -9, arrière-plan, quitter), plantage de Bobine (rapport, orphelins), élément du fil illisible, erreur interne du main.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | agent qui réessaie : bandeau en statut, piste Wi-Fi / VPN, ni indicateur ni bandeau de silence (L36) | reprises lues par le profil → bandeau d'agent injoignable seul | composant | `AgentUnreachableBanner.test.tsx` (existant ; ajouter « pas d'indicateur ni de silence » côté fil) | partiel : `renderer/src/components/thread/AgentUnreachableBanner.test.tsx` › « sans proxy : piste Wi-Fi, VPN ; sans message : rien de replié ; Arrêter et Réglages » ; `main/agent/agent-host-silence.test.ts` › « reprises de l'agent : état générique tout de suite, effacé à l'arrêt du tour » |
| 2 | « Réglages réseau » : Réglages › Agents, « Avancé » déplié, focus sur le proxy (waitFor L46, check L50) | le bouton mène au bon champ | composant | `SettingsDialog.test.tsx` (à créer : ouverture ciblée sur le proxy) | **oui, remplaçant créé** (2026-11-24) : `R/components/settings/NetworkSettings.test.tsx` › « « Réglages réseau » d’un bandeau : Agents demandé, « Avancé » déplié, focus sur le proxy » — avant : non |
| 3 | proxy changé : « relancez-le pour les appliquer », « Relancer l'agent » (L68) | réglages réseau plus récents que l'agent → bandeau périmé | composant | `AgentUnreachableBanner.test.tsx` (existant) | `renderer/src/components/thread/AgentUnreachableBanner.test.tsx` › « réglages réseau changés (fiche 276) : piste et bouton de relance ; sans `onRestart`, comme avant » |
| 4 | « Relancer l'agent » : agent relancé, message remis dans la saisie, rien d'envoyé (L81) | relance réelle de l'agent sans renvoi | parcours | garder ici, ou étape de `parcours-reglages` (proxy) | partiel : `renderer/src/components/thread/TurnFooter.test.tsx` › « réglages réseau changés : « Relancer l'agent » relance, et le message revient dans la saisie » |
| 5 | agent silencieux : bandeau « n'a rien envoyé depuis… », en statut, sans prendre le focus (L99) | bandeau neutre, accessible | composant | `SilenceBanner.test.tsx` (existant) | `renderer/src/components/thread/SilenceBanner.test.tsx` › « dit depuis combien de minutes, en statut (jamais une alerte), et suit l'heure » |
| 6 | silence : « Réponse en cours » sans verbe ; boutons sous le texte et alignés (L109) | indicateur cohérent avec le bandeau (l'alignement relève de la capture) | composant | `TurnFooter.test.tsx` (existant) ; alignement en capture | partiel : `renderer/src/components/thread/TurnFooter.test.tsx` › « silence : l'indicateur dit « Réponse en cours », sans verbe » |
| 7 | « Attendre » masque le bandeau (waitFor L118, check L119) | masquage jusqu'au prochain silence | composant | `SilenceBanner.test.tsx` (existant) | `renderer/src/components/thread/SilenceBanner.test.tsx` › « « Arrêter » arrête la réponse ; « Attendre » masque jusqu'au prochain silence » |
| 8 | agent figé qui ignore Stop **et SIGTERM** : arrêté, un seul avis clair (L126) | vrai SIGKILL après le délai, un seul avis | parcours | garder ici | partiel : `main/agent/agent-host.test.ts` › « agent figé qui ignore Stop : processus arrêté après le délai de grâce » ; `main/process-group.test.ts` › « groupe qui ignore SIGTERM : SIGKILL au bout de l'attente, avant la sortie du main » |
| 9 | silence avec un proxy : cité masqué, jamais en clair dans la page (L139) | identifiants du proxy jamais affichés | composant | `SilenceBanner.test.tsx` + `agent-host-silence.test.ts` (existants) | `renderer/src/components/thread/SilenceBanner.test.tsx` › « proxy défini (fiche 275) : cité masqué, « Réglages réseau » ; sans proxy, rien de plus » ; `main/agent/agent-host-silence.test.ts` › « silence avec un proxy : bandeau et proxy de l'agent, identifiants masqués » |
| 10 | adresse du proxy insécable, parenthèses comprises, en infobulle (L147) | adresse d'une seule pièce (le compte de lignes `getClientRects` relève de la capture) | composant | `SilenceBanner.test.tsx` + `network-hint.test.tsx` (existants) | `renderer/src/components/thread/SilenceBanner.test.tsx` › « l'adresse du proxy d'une seule pièce avec ses parenthèses, entière en infobulle (fiche 276) » |
| 11 | modèle injoignable avec un proxy : cité masqué (L159) | idem pour le bandeau d'agent injoignable | composant | `AgentUnreachableBanner.test.tsx` (existant) | `renderer/src/components/thread/AgentUnreachableBanner.test.tsx` › « tentative et décompte, piste du proxy, message de l'agent replié et tel quel » ; `main/agent/opencode-retry.test.ts` › « identifiants d'un proxy cités dans le message : masqués » |
| 12 | agent tué par kill -9 : sa commande (`sleep 31.7`) ne survit pas (L178) | le groupe de processus est arrêté avec l'agent | parcours | garder ici | partiel : `main/process-group.test.ts` › « SIGKILL au groupe même si le chef est sorti entre-temps (ses descendants restent) » |
| 13 | commande en arrière-plan : elle continue après le tour (L188) | Bobine ne tue pas une commande légitime en fin de tour | parcours | garder ici | partiel : `main/process-registry.test.ts` › « descendants encore vivants à la sortie du chef : revu après le délai, gardé s'ils survivent » |
| 14 | …et ne survit pas à la fermeture de Bobine (L203) | même groupe que l'agent, arrêté en quittant | parcours | garder ici | partiel : `main/quit-guard.test.ts` › « un groupe vit encore : attente, puis on redemande de quitter, une seule fois » |
| 15 | quitter en plein tour : aucun processus restant (L207) | aucun processus du profil ne survit (agent tenace compris) | parcours | garder ici | partiel : `main/process-group.test.ts` › « groupe qui ignore SIGTERM : SIGKILL au bout de l'attente, avant la sortie du main » |
| 16 | après kill -9 de Bobine : l'agent vit encore (orphelin) (L233) | précondition réelle des n° 18-20 | parcours | garder ici | non |
| 17 | fil préparé : un message illisible (L240) | préparation de l'essai (pas un contrat), part avec le n° 21 | composant | `SafeBoundary.test.tsx` (existant) | `renderer/src/components/common/SafeBoundary.test.tsx` › « élément du fil : seul lui est remplacé, nommé selon ce qu'il est, détail replié » |
| 18 | lancement après kill -9 : avis du plantage, rien d'envoyé (L248) | marque de plantage restée → avis au lancement | composant | `AppAlertsBar.test.tsx` + `crash-marker.test.ts` (existants) | `renderer/src/components/common/AppAlertsBar.test.tsx` › « plantage précédent : rien n'a été envoyé, « Afficher le rapport », ✕ » ; `main/crash-marker.test.ts` › « marque restée (kill -9) : rapport avec la fin du journal et les minidumps, rien d'autre » |
| 19 | rapport local rangé dans le profil (`crash-reports/…/rapport.txt`) (L255) | rapport écrit sur disque | unitaire-main | `main/crash-marker.test.ts` (existant) | `main/crash-marker.test.ts` › « marque restée (kill -9) : rapport avec la fin du journal et les minidumps, rien d'autre » |
| 20 | orphelins du lancement tué arrêtés au lancement suivant (L262) | le registre est relu et appliqué au démarrage réel | parcours | garder ici | partiel : `main/process-registry.test.ts` › « un agent factice et son descendant, laissés par un main coupé, sont arrêtés » (pas l'appel au démarrage de l'app) |
| 21 | message illisible : « Ce message ne peut pas être affiché », le reste du fil est là (L271) | un élément abîmé n'emporte pas la fenêtre | composant | `SafeBoundary.test.tsx` (existant) | `renderer/src/components/common/SafeBoundary.test.tsx` › « élément du fil : seul lui est remplacé, nommé selon ce qu'il est, détail replié » |
| 22 | erreur interne : un seul avis, son compte suit (waitFor L289, check L292) | regroupement des erreurs du main | doublon | `main/app-alerts.test.ts` + `AppAlertsBar.test.tsx` (existants) | `main/app-alerts.test.ts` › « erreur interne : un seul avis par lancement, les suivantes augmentent son compte » ; `renderer/src/components/common/AppAlertsBar.test.tsx` › « problème interne : le compte suit, détail replié, « Afficher le journal » » |
| 23 | fermé par ✕ : ne revient pas avant le prochain lancement (L299) | avis fermé pour de bon | doublon | `main/app-alerts.test.ts` (existant, même libellé) | `main/app-alerts.test.ts` › « fermé par ✕ : ne revient pas avant le prochain lancement » |
| 24 | en quittant : aucun processus restant (L313) | aucune fuite après le lancement de reprise | parcours | garder ici | partiel : `main/quit-guard.test.ts` › « rien à attendre : l'app sort tout de suite » |

**Verdict** : à garder, allégée (garder les 9 vérifs `parcours` : n° 4, 8, 12-16, 20, 24) : c'est la seule suite qui compte les vrais processus (`ps`) après SIGKILL, kill -9 et la fermeture, ce qu'aucun test sans fenêtre ne voit. Les bandeaux (silence, injoignable, proxy masqué), l'élément illisible et les avis d'erreur interne passent en tests de composant, déjà presque tous écrits.
<!-- stats suite=pannes-visibles total=24 parcours=9 composant=12 unitaire-main=1 capture=0 doublon=2 couvert=22 verdict=garder -->

### `reprise.mjs` — ⌘Q pendant qu'un agent répond, « Quitter » à la question, puis à la relance la conversation qui travaillait est rouverte et reprend.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | quitter en plein tour : « Un agent travaille encore » → Quitter (L56) | la question de l'app, au bon titre, puis l'app se ferme | doublon | `parcours-pannes` étape « quitter pendant un tour » (y ajouter le contrôle du titre) + `main/quit-guard.test.ts` | `main/quit-guard.test.ts` › « un agent travaille : question ; « Annuler » garde l'app, « Quitter » redemande de quitter » ; `parcours-pannes` › étape « quitter pendant un tour » (titre non vérifié) |
| 2 | relance : la conversation qui travaillait est affichée, pas une nouvelle (L71) | conversation rouverte au lancement | doublon | `parcours-pannes` étape « relancer : la conversation qui travaillait est rouverte » | `parcours-pannes` › étape « relancer : la conversation qui travaillait est rouverte » ; `main/conversations/manager.test.ts` › « quitter en plein tour : la conversation qui travaillait est rouverte » |
| 3 | relance : saisie vide, le message envoyé avant de quitter n'y revient pas (L81) | le brouillon vidé est écrit tout de suite | composant | `renderer/src/drafts.test.ts` (existant) ; un contrôle dans `parcours-pannes` étape 7 au besoin | `renderer/src/drafts.test.ts` › « message envoyé puis app quittée aussitôt : le brouillon ne revient pas (fiche 243) » |
| 4 | relance : la conversation reprend dans le même fil (L89) | l'agent relancé répond dans le même fil | doublon | `parcours-pannes` étape 7 | `parcours-pannes` › étape « relancer : la conversation qui travaillait est rouverte » (« relance : la conversation interrompue reprend ») |

**Verdict** : supprimable entièrement : `parcours-pannes` fait déjà le même enchaînement (quitter en plein tour, relancer, reprendre). Pour ne rien perdre, ajouter à `parcours-pannes` le contrôle du titre de la question (`quit.title_one`) et celui de la saisie vide à la relance.
<!-- stats suite=reprise total=4 parcours=0 composant=1 unitaire-main=0 capture=0 doublon=3 couvert=4 verdict=supprimable -->

### `failures.mjs` — agent qui plante en plein tour puis relancé, agent figé qui ignore Stop, menu « Afficher le journal », `main.log`, index d'historique abîmé au démarrage.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | plantage en plein tour : l'outil en cours marqué interrompu (L19) | pas d'outil « en cours » fantôme | unitaire-main | `main/agent/agent-host.test.ts` (existant) | `main/agent/agent-host.test.ts` › « plantage en plein tour : outil interrompu, un seul avis avec la fin de stderr » |
| 2 | un seul avis, code de sortie et fin de stderr (L27) | avis de panne lisible | doublon | `parcours-pannes` étape 2 + `agent-host.test.ts` | `parcours-pannes` › étape « l'agent de l'une plante en plein tour » ; `main/agent/agent-host.test.ts` › « plantage en plein tour : outil interrompu, un seul avis avec la fin de stderr » |
| 3 | « Relancer » : le fil est gardé, avis compris (L34) | le bouton garde le fil | unitaire-main | `main/conversations/manager.test.ts` (existant) ; bouton : `NoticeRestart.test.tsx` | `main/conversations/manager.test.ts` › « « Relancer » après un plantage (fiche 041) : fil gardé, la conversation continue » |
| 4 | la conversation continue et l'agent répond (L40) | reprise après plantage | doublon | `parcours-pannes` étape 4 | `parcours-pannes` › étape « écrire à la conversation plantée relance son agent » |
| 5 | agent figé qui ignore Stop : arrêté au bout du délai, message clair (L52) | délai de grâce, avis « ne répond plus » | doublon | `pannes-visibles` n° 8 (plus strict : ignore aussi SIGTERM) + `agent-host.test.ts` | `main/agent/agent-host.test.ts` › « agent figé qui ignore Stop : processus arrêté après le délai de grâce » ; `pannes-visibles` (L126) |
| 6 | agent arrêté : écrire un message le relance, puis le message part (L59) | envoi à un agent arrêté | doublon | `parcours-pannes` étape 4 + `manager.test.ts` | `main/conversations/manager.test.ts` › « message envoyé à un agent arrêté (fiche 041) : relancé d'abord, puis le message part » ; `parcours-pannes` › étape « écrire à la conversation plantée relance son agent » |
| 7 | menu Aide → « Afficher le journal » (L66) | entrée de menu `show-log` présente | unitaire-main | `main/menu.test.ts` (existant) | `main/menu.test.ts` › « menus, rôles, identifiants et raccourcis du Mac, à l'identique » |
| 8 | journal : arrêts de l'agent écrits dans `main.log` (L83) | traçabilité des arrêts | unitaire-main | `main/agent/agent-process.test.ts` (existant) | `main/agent/agent-process.test.ts` › « journal Détaillé : échanges et sortie d'erreur dans agents.log, clés masquées ; lancement et arrêt dans main.log » |
| 9 | historique abîmé : l'app démarre et prévient (waitFor L94, check L97) | démarrage réel sur un index tronqué, avis affiché | parcours | étape d'une journée type (`parcours-pannes`, après la relance) ou garder ici | partiel : `main/conversations/manager.test.ts` › « index abîmé (fiche 041) : historique repris de la copie, mis de côté (avis : fiche 196) » ; `main/profile-integrity.test.ts` › « chaque cas a sa gravité, sans chemin dans le texte ; fermés un par un » |
| 10 | la conversation est reprise de la dernière bonne copie (L98) | reprise sur la copie | unitaire-main | `main/conversations/store.test.ts` (existant) | `main/conversations/store.test.ts` › « index illisible : mis de côté, reprise sur la dernière bonne copie (fiche 041) » |
| 11 | le fichier abîmé est mis de côté, pas écrasé (L106) | rien n'est perdu | unitaire-main | `main/conversations/store.test.ts` (existant) | `main/conversations/store.test.ts` › « index illisible : mis de côté, reprise sur la dernière bonne copie (fiche 041) » |

**Verdict** : à réduire (garder 1 vérif : n° 9, démarrage réel sur un historique abîmé, à déplacer en étape de `parcours-pannes`) : le plantage et la relance sont déjà dans `parcours-pannes`, l'agent figé dans `pannes-visibles`, le reste dans les tests du main. Une fois le n° 9 déplacé, la suite est supprimable.
<!-- stats suite=failures total=11 parcours=1 composant=0 unitaire-main=6 capture=0 doublon=4 couvert=11 verdict=reduire -->

#### Risques repérés (lot 3)

- **Processus réels** (`pannes-visibles`) : SIGKILL d'un agent tenace, groupe de processus d'une commande en arrière-plan, orphelins après kill -9 de Bobine, aucun reste en quittant. Les tests du main simulent `ps` et `kill` (sauf `process-registry.test.ts` › « un agent factice et son descendant… ») ; seul l'e2e prouve que le **démarrage** de l'app appelle la relecture du registre et que rien ne survit vraiment.
- **pty réel** : « connexion dans le terminal » (`connexion-expiree`, la commande du profil y tourne vraiment) et `sleep 30` vu « en cours » puis arrêté (`session`). La détection d'une commande au premier plan dépend du shell réel, pas de `session-running.ts`.
- **Mise en page mesurée** : la réduction de la pastille « lecture seule » se déclenche sur une mesure du navigateur (ResizeObserver / largeurs réelles) ; jsdom ne verra jamais une pastille coupée ni un titre écrasé. Ces cas doivent aller en capture nocturne, pas disparaître.
- **Repli « Lire la suite »** : le repli réel (`clientHeight < scrollHeight`) n'existe pas en jsdom ; un test de composant ne voit que `data-folded`.
- **Couleur calculée de l'aide (N7)** : le test de composant vérifie la classe, pas que `--muted` est bien appliqué dans les deux thèmes (à surveiller en capture claire/sombre).
- **Chaîne d'état à travers l'IPC** : `@rôle` en tout premier message (brouillon → historique → filles rattachées), « Répondre » routé vers la même session de fille, marque d'un modèle refusé remontée du main jusqu'à la puce de la saisie. Chaque morceau est testé isolément, l'enchaînement seulement en e2e (c'est le défaut type de la fiche 277).
- **Vrai serveur MCP** : « Mesurer » lance la vraie commande de `~/.bob/settings/mcp.json` une seule fois ; la garantie « jamais lancé à l'ouverture » se lit sur un vrai fichier de lancements, pas sur un mock d'IPC.
- **Fermeture de l'app** (`reprise`, `parcours-pannes`) : la question de quitter est simulée (`dialog.showMessageBox` remplacé) ; si `reprise` disparaît, le titre exact de la question n'est plus vu en e2e, sauf ajout dans `parcours-pannes`.
- **Secret du proxy** : `pannes-visibles` vérifie que `s3cr3t` n'apparaît **nulle part** dans la page (`document.body.innerText`) ; les tests de composant ne regardent que leur propre composant. Un autre endroit de l'interface qui afficherait le proxy en clair ne serait vu que par l'e2e : garder ce contrôle global dans une journée type.

---

## Lot 4

Abréviations des chemins : `C/` = `src/renderer/src/components/`, `R/` = `src/renderer/src/`.

### `perf.mjs` — budgets de fluidité : gros diff, sortie de 40 000 lignes, fil de 5 000 éléments ouvert par la fin, recherche et sommaire sur des lignes masquées, streaming au bout du long fil.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | gros diff N : ouverture < 1500 ms (×2 : 5 000, 20 000 lignes) | un diff replié n'est pas calculé à l'ouverture (temps réel mesuré) | parcours | garder ici (mesure, suite `alone`) | non |
| 2 | gros diff N : dépliage sans tâche > 2000 ms (×2) | calcul du diff borné, pas de gel au dépliage | parcours | garder ici | non |
| 3 | diff simplifié : 200 retirées, 200 ajoutées, la note | plafond par bloc et note « simplifié » | doublon | `C/thread/DiffView.test.tsx` (existant) | `C/thread/DiffView.test.tsx` › « diff simplifié : 200 lignes retirées, 200 ajoutées, la note, les nombres localisés » |
| 4 | diff : « Afficher tout » sans arrêt > 1000 ms | rendu par paquets, la boucle d'évènements ne gèle pas | parcours | garder ici | partiel : `C/thread/DiffView.test.tsx` › « paquets de 2 000 lignes, un par image, « Affichage… » entre-temps » |
| 5 | sortie longue : ouverte en bas, sur la dernière ligne | sortie plafonnée montre sa fin, défilée en bas | composant | `C/thread/CappedText.test.tsx` (contenu) ; la position de défilement n'est pas vérifiable en jsdom | partiel : `C/thread/CappedText.test.tsx` › « longue : les 500 dernières lignes, le nombre masqué localisé, « Afficher tout » » |
| 6 | sortie : 40 000 lignes affichées sans arrêt > 1000 ms | « Afficher tout » complet et par paquets | parcours | garder ici | partiel : `C/thread/CappedText.test.tsx` › « « Afficher tout » montre la sortie entière, lignes longues comme courtes » |
| 7 | sortie plafonnée : la première ligne est masquée | plafond de la sortie | doublon | `C/thread/CappedText.test.tsx` | `C/thread/CappedText.test.tsx` › « longue : les 500 dernières lignes, le nombre masqué localisé, « Afficher tout » » |
| 8 | recherche : le mot du début masqué est trouvé (1 / 1) | la recherche dans le fil voit le texte masqué d'une sortie | composant | `C/thread/CappedText.test.tsx` + `R/useThreadFind.test.tsx` | partiel : `C/thread/CappedText.test.tsx` › « recherche ouverte : le début masqué qui contient ce qu'on cherche est montré, par paquets » |
| 9 | sortie bornée : la ligne trouvée est à l'écran | résultat courant amené dans la zone visible du cadre défilant et du fil (getBoundingClientRect, CSS highlights) | parcours | garder ici | non |
| 10 | recherche : une ligne masquée du diff est trouvée | la recherche voit les lignes masquées d'un diff | doublon | `C/thread/DiffView.test.tsx` | `C/thread/DiffView.test.tsx` › « recherche ouverte : les lignes masquées trouvées sont montrées, par paquets » |
| 11 | diff : la ligne masquée trouvée est à l'écran | défilement du cadre du diff vers le résultat | parcours | garder ici | non |
| 12 | diff : premier résultat à l'écran (1 / 11) | idem, recherche à 11 résultats | parcours | garder ici | non |
| 13 | diff : ↓ amène le suivant à l'écran (2 / 11) | navigation suivant + défilement imbriqué | parcours | garder ici | non |
| 14 | diff : ↑ du premier au dernier à l'écran (11 / 11) | bouclage + défilement imbriqué | parcours | garder ici | non |
| 15 | long fil : ouverture < 1500 ms | ouverture d'un fil de 5 000 éléments rapide | parcours | garder ici | non |
| 16 | long fil : aucune tâche > 1000 ms, < 50 000 nœuds | seule la fin est rendue, pas de gel | parcours | garder ici (le nombre de nœuds est aussi un fait de `useEntryWindow`) | partiel : `C/thread/useEntryWindow.test.ts` › « fil vide, puis arrivée du fil : ouvert par la fin » |
| 17 | ouvert par la fin : n messages rendus sur 1250 | fenêtre de rendu partielle à l'ouverture | doublon | `C/thread/useEntryWindow.test.ts` | `C/thread/useEntryWindow.test.ts` › « fil vide, puis arrivée du fil : ouvert par la fin » |
| 18 | messages précédents rendus au-dessus, ce qu'on lit reste en place (±1 px) | ancrage du défilement quand des pages s'ajoutent au-dessus | parcours | garder ici | non |
| 19 | tout en haut : la page ajoutée ne déplace pas ce qu'on lit | compensation manuelle à scrollTop 0 (Chromium n'ancre pas) | parcours | garder ici | non |
| 20 | remonté jusqu'au début : tout le fil rendu | la fenêtre s'étend jusqu'au premier élément en remontant | composant | `C/thread/useEntryWindow.test.ts` (à compléter : extension page par page jusqu'au début) | partiel : `C/thread/useEntryWindow.test.ts` › « court : tout rendu ; le fil qui grandit garde le même début » |
| 21 | rouvert : de nouveau par la fin | réouverture repart de la fin | doublon | `C/thread/useEntryWindow.test.ts` | `C/thread/useEntryWindow.test.ts` › « conversation suivante (fil remonté) : de nouveau par la fin » |
| 22 | sommaire : premier message rendu et amené à l'écran < 5000 ms | clic du sommaire sur un message non rendu : rendu + défilement, sans mise en page forcée par ligne | parcours | garder ici | partiel : `C/thread/useEntryWindow.test.ts` › « élément à montrer dans un groupe d'outils, identifiants non contigus » |
| 23 | « Aller en bas » : en bas du fil | bouton de retour en bas | doublon | `R/useThreadScroll.test.ts` | `R/useThreadScroll.test.ts` › « « Aller en bas » : défilement doux, et le suivi reprend » |
| 24 | recherche dans le fil : tout le fil rendu, premier message trouvé | recherche ouverte → tout le fil rendu | doublon | `C/thread/useEntryWindow.test.ts` | `C/thread/useEntryWindow.test.ts` › « recherche ouverte : tout le fil » |
| 25 | streaming : aucune tâche > 400 ms | streaming d'un bloc de code au bout d'un long fil sans re-rendu du fil | parcours | garder ici | partiel : `C/thread/Transcript.test.tsx` › « un morceau de réponse ne refait pas le rendu des outils déjà affichés » |

**Verdict** : à réduire (garder 15 vérifs : budgets 1, 2, 4, 6, 15, 16, 22, 25 et visibilité/ancrage 9, 11-14, 18, 19) — c'est une suite de mesure à part (`alone`) ; les contrats de contenu (plafonds, fenêtre de rendu, recherche) sont déjà dans DiffView/CappedText/useEntryWindow.
<!-- stats suite=perf total=25 parcours=15 composant=3 unitaire-main=0 capture=0 doublon=7 couvert=15 verdict=reduire -->

### `usage-board.mjs` — « Mon activité » : page ouverte depuis la puce, chiffres, grille, périodes, agent, exports CSV, largeurs, menu ⇧⌘U, remise à zéro et collecte qui continue.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | barre latérale : loupe dans l'en-tête, « Mon activité » sous « Nouvelle conversation » | placement des entrées du haut | doublon | `C/sidebar/Sidebar.test.tsx` | `C/sidebar/Sidebar.test.tsx` › « « Rechercher » en icône dans l'en-tête, à gauche du bouton qui masque la barre » et « « Mon activité » sous « Nouvelle conversation », ⇧⌘U, en surbrillance quand ouverte » |
| 2 | libellés du haut de la barre alignés (left px) | alignement pixel des deux libellés | capture | capture nocturne | non |
| 3 | la loupe ouvre la recherche | clic → recherche | doublon | `C/sidebar/Sidebar.test.tsx` | `C/sidebar/Sidebar.test.tsx` › « « Rechercher » en icône dans l'en-tête, à gauche du bouton qui masque la barre » |
| 4 | « Toute mon activité… » : page, titre, ligne en surbrillance, sans saisie | lien du détail de la puce → page à la place du fil | composant | `C/composer/UsageMeter.test.tsx` (à compléter : `usage-open-board`) + test de `R/useActivityPage.ts` (à créer) | partiel : `C/sidebar/Sidebar.test.tsx` › « « Mon activité » sous « Nouvelle conversation », ⇧⌘U, en surbrillance quand ouverte » |
| 5 | semaine : 2 échanges dans 1 conversation | deux tours réels de l'agent → journal → stats IPC → page | parcours | étape d'une journée type (`parcours-reglages`, ouvrir Mon activité après des échanges) | partiel : `src/main/usage/journal.test.ts` › « scénario demo, « Factice rapide » puis « Factice précis » : deux lignes, deux modèles » |
| 6 | coût dans son unité (≈ 0,025 $), jetons communiqués | coût estimé « ≈ », jetons connus | composant | `C/activity/ActivityPage.test.tsx` | partiel : `C/activity/ActivityPage.test.tsx` › « quatre chiffres clés, et l'écart à la semaine d'avant à date égale, en texte discret » |
| 7 | graphique de la semaine : 7 jours, agent en `--chart-1` | barres par jour, couleur par emplacement | doublon | `C/activity/ActivityPage.test.tsx`, `R/usage-board.test.ts` | `C/activity/ActivityPage.test.tsx` › « graphique : une colonne par jour, segments empilés, légende, infobulle au survol » ; `R/usage-board.test.ts` › « couleurs par emplacement fixe, « Autres » à part » |
| 8 | semaine en cours : « période suivante » grisée | borne de navigation | doublon | `C/activity/ActivityPage.test.tsx` | `C/activity/ActivityPage.test.tsx` › « filtres : semaine en cours (suivante grisée), précédente, mois, agent » |
| 9 | grille : 2 échanges sur 12 mois, aujourd'hui cerclé, niveau 4 | grille d'activité | doublon | idem | `C/activity/ActivityPage.test.tsx` › « grille : niveaux, aujourd'hui cerclé, jours hors période pâlis, infobulle, clic sur un jour » |
| 10 | infobulle d'un jour : échanges et partage par agent | infobulle de la grille | doublon | idem | `C/activity/ActivityPage.test.tsx` › « grille : niveaux, aujourd'hui cerclé, jours hors période pâlis, infobulle, clic sur un jour » |
| 11 | mesures « Temps » puis « Jetons » : pas de note avec un seul agent ; ordre des chiffres | couverture des mesures, ordre des KPI | composant | `C/activity/ActivityPage.test.tsx` (à compléter : un seul agent → pas de note, ordre) | partiel : `C/activity/ActivityPage.test.tsx` › « mesures comparables et partielles (fiche 147) : temps empilé, note de couverture » |
| 12 | mois : N jours, 2 échanges | portée mois | doublon | idem + `R/usage-board.test.ts` | `C/activity/ActivityPage.test.tsx` › « filtres : semaine en cours (suivante grisée), précédente, mois, agent » ; `R/usage-board.test.ts` › « seaux du graphique : heures, jours de la semaine ou du mois, mois » |
| 13 | année : douze mois, aucun écart | portée année sans comparaison | doublon | idem | `C/activity/ActivityPage.test.tsx` › « un jour se compare à la moyenne de son jour de la semaine ; l'année, à rien » |
| 14 | semaine précédente : 0 échange, « suivante » active, grille pâlie | navigation arrière | doublon | idem | `C/activity/ActivityPage.test.tsx` › « filtres : semaine en cours (suivante grisée), précédente, mois, agent » |
| 15 | un jour : barres par heure, aucun segment actif, jour cerclé | clic sur un jour de la grille | doublon | idem | `C/activity/ActivityPage.test.tsx` › « grille : niveaux, aujourd'hui cerclé, jours hors période pâlis, infobulle, clic sur un jour » |
| 16 | la croix revient à la semaine | fermeture du jour choisi | doublon | idem | `C/activity/ActivityPage.test.tsx` › « grille : niveaux, aujourd'hui cerclé, jours hors période pâlis, infobulle, clic sur un jour » |
| 17 | filtre d'agent : tous, puis l'agent factice | filtre agent | doublon | idem | `C/activity/ActivityPage.test.tsx` › « filtres : semaine en cours (suivante grisée), précédente, mois, agent » |
| 18 | export par tour : en-tête et 2 lignes | CSV par tour écrit au chemin « Enregistrer sous » | unitaire-main | `src/main/usage/csv.test.ts`, `src/main/usage/usage-ipc.test.ts` | `src/main/usage/csv.test.ts` › « une ligne par tour : guillemets doublés, formules désarmées, valeurs absentes vides » ; `src/main/usage/usage-ipc.test.ts` › « export : « Enregistrer sous », écrit au chemin choisi ; annulé, rien d'écrit » |
| 19 | export par jour : les 7 jours, 2 aujourd'hui | CSV par jour, jours vides compris | unitaire-main | `src/main/usage/csv.test.ts` | `src/main/usage/csv.test.ts` › « une ligne par jour, jours vides compris, une colonne par unité jamais additionnées » |
| 20 | export de tout l'historique : 2 lignes | portée « all » | doublon | `C/activity/ActivityPage.test.tsx` | `C/activity/ActivityPage.test.tsx` › « export : par tour ou par jour pour la période, ou tout l'historique » |
| 21 | 1180 px : filtres sur une ligne, 4 chiffres, rien ne déborde | mise en page large | capture | capture nocturne | non |
| 22 | 800 px, barre ouverte : 2 lignes de filtres, 2 colonnes, grille calée à droite | mise en page étroite, défilement interne de la grille | capture | capture nocturne | non |
| 23 | 800 px, panneau ouvert : rien ne déborde | pas de défilement horizontal | capture | capture nocturne | non |
| 24 | 800 px, barre fermée : rien ne déborde | idem | capture | capture nocturne | non |
| 25 | clic sur la conversation : la page se referme, le fil revient | navigation page → conversation | composant | test de `R/useActivityPage.ts` (à créer) | non |
| 26 | Fenêtre › Mon activité (⇧⌘U) rouvre la page | entrée de menu → commande → page | composant | `src/main/menu.test.ts` + `R/useMenuCommands.test.ts` (à compléter : `activity`) | partiel : `src/main/menu.test.ts` › « Fenêtre › Mon activité, ⇧⌘U (fiche 144) » |
| 27 | remise à zéro depuis Réglages › Données : la page se relit, état vide | remise à zéro → évènement → état vide | doublon | `C/settings/UsageReset.test.tsx`, `C/activity/ActivityPage.test.tsx` | `C/settings/UsageReset.test.tsx` › « confirmation dans l'app ; « Garder » n'efface rien ; confirmé, le journal est vidé » ; `C/activity/ActivityPage.test.tsx` › « journal changé (un tour, une remise à zéro) : la page et la grille se relisent » et « journal vide : un état vide qui propose de commencer, ni grille ni chiffres (fiche 185) » |
| 28 | après la remise à zéro, l'échange suivant est compté | la collecte continue après reset, la page se relit seule | parcours | même étape de journée type que #5 | partiel : `src/main/usage/journal.test.ts` › « remise à zéro (fiche 137) : un coût annoncé après coup ne recrée pas la ligne effacée » |
| 29 | un clic sur une conversation du tableau l'ouvre | tableau conversations → ouverture | doublon | `C/activity/ActivityPage.test.tsx` | `C/activity/ActivityPage.test.tsx` › « tableaux : par modèle (non communiqué), par projet, conversations (un clic l'ouvre) » |

**Verdict** : à réduire (garder 2 vérifs : 5 et 28, idéalement dans une journée type, + les 5 largeurs en capture nocturne) — la logique de la page est déjà testée en composant ; manquent seulement le lien de la puce, la fermeture de la page et la commande de menu côté renderer.
<!-- stats suite=usage-board total=29 parcours=2 composant=5 unitaire-main=2 capture=5 doublon=15 couvert=23 verdict=reduire -->

### `quota.mjs` — quota de l'agent lu par un faux `/status` quand l'agent est prêt, affiché et relu ; jamais lu pour un agent non utilisé ; lecture tuée quand l'app quitte.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | quota lu, agent prêt : part sous le nom de l'agent | chaîne réelle : agent prêt → faux `bob chat` en pty → main → renderer | parcours | garder ici (ou étape `parcours-reglages`) | partiel : `C/sidebar/AgentQuotaStatus.test.tsx` › « état, part consommée et barre orange au-delà de 80 % ; détail au clic » ; `src/main/agent/quota.test.ts` › « lit le quota dans un dossier réservé, supprime les sessions laissées, prévient » |
| 2 | au-delà de 80 % : barre orange | seuil d'alerte | doublon | `C/sidebar/AgentQuotaStatus.test.tsx` | `C/sidebar/AgentQuotaStatus.test.tsx` › « état, part consommée et barre orange au-delà de 80 % ; détail au clic » |
| 3 | détail : « 812,5 / 1 000 Bobcoins » | format du détail, unité capitalisée | doublon | idem | `C/sidebar/AgentQuotaStatus.test.tsx` › « état, part consommée et barre orange au-delà de 80 % ; détail au clic » |
| 4 | détail : reste « 187,5 Bobcoins » | reste calculé | doublon | idem | `C/sidebar/AgentQuotaStatus.test.tsx` › « état, part consommée et barre orange au-delà de 80 % ; détail au clic » |
| 5 | « Actualiser » relit le quota | « Lecture… » puis retour | doublon | idem | `C/sidebar/AgentQuotaStatus.test.tsx` › « « Actualiser » relit le quota, « Lecture… » en attendant » |
| 6 | aucune session vide laissée chez l'agent | sessions créées par la lecture supprimées | doublon | `src/main/agent/quota.test.ts` | `src/main/agent/quota.test.ts` › « lit le quota dans un dossier réservé, supprime les sessions laissées, prévient » |
| 7 | conversation sans dossier : aucun agent lancé | pas de démarrage d'agent sans dossier | unitaire-main | `src/main/conversations/manager.test.ts` (à compléter) | non |
| 8 | agent pas utilisé : aucune lecture du quota | rien d'office au lancement | doublon | `src/main/agent/quota-setup.test.ts` | `src/main/agent/quota-setup.test.ts` › « agent installé mais pas utilisé : son quota n'est pas lu au lancement » |
| 9 | rien écrit dans le dossier de lecture du quota | pas d'effet de bord sur le disque | unitaire-main | `src/main/agent/quota.test.ts` | partiel : `src/main/agent/quota.test.ts` › « rien n'est lu tant qu'aucun agent ne s'est montré prêt ni qu'on ne l'a demandé » |
| 10 | pas de quota affiché (pas de %) | statut sans quota | composant | `C/sidebar/AgentQuotaStatus.test.tsx` (à compléter : quota absent) | non |
| 11 | lecture du quota en cours (faux `bob chat` lent) | précondition : un vrai processus fils tourne | parcours | garder ici | non |
| 12 | quitter pendant la lecture : `bob chat` fermé avec l'app | aucun processus orphelin après la sortie réelle de l'app | parcours | garder ici | partiel : `src/main/agent/quota.test.ts` › « lecture en cours : `bob chat` fermé tout de suite, rien écrit ni lancé après » |
| 13 | rien d'écrit dans les données après la sortie | le fils tué n'écrit pas sa session après coup | parcours | garder ici | partiel : `src/main/agent/quota.test.ts` › « l'adaptateur rend sa lecture après l'arrêt : ni suppression de sessions ni quota » |

**Verdict** : à réduire (garder 4 vérifs : 1, 11, 12, 13) — l'affichage et la logique de lecture sont testés ; restent la chaîne pty réelle et le processus orphelin à la sortie.
<!-- stats suite=quota total=13 parcours=4 composant=1 unitaire-main=2 capture=0 doublon=6 couvert=11 verdict=reduire -->

### `versions.mjs` — avis de version de l'agent (plus récente une seule fois, même après redémarrage ; plus ancienne ; refus sous le plancher ou protocole incompatible).

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | version plus récente : avis gris, une fois | avis info unique | doublon | `src/main/agent/version-check.test.ts` | `src/main/agent/version-check.test.ts` › « version plus récente : avis une seule fois, l'agent répond » |
| 2 | lien « Diagnostic » à la suite de l'avis | lien dans l'avis info | doublon | `C/thread/Transcript.test.tsx` | `C/thread/Transcript.test.tsx` › « « Diagnostic » à la suite du texte ouvre la section des Réglages » |
| 3 | le lien ouvre Réglages › Diagnostic | navigation vers la section | composant | `C/thread/Transcript.test.tsx` (callback) + `R/open-settings.ts` | partiel : `C/thread/Transcript.test.tsx` › « « Diagnostic » à la suite du texte ouvre la section des Réglages » |
| 4 | autre conversation : pas d'avis à nouveau | clé d'avis retenue par profil | doublon | `src/main/agent/version-check.test.ts` | `src/main/agent/version-check.test.ts` › « version plus récente : avis une seule fois, l'agent répond » |
| 5 | après un redémarrage : pas d'avis à nouveau | clé persistée dans `settings.json` et relue | parcours | garder ici (redémarrage réel) | partiel : `src/main/settings.test.ts` › « versionNotices mal formé : ignoré sans planter, le reste relu » |
| 6 | conversation rouverte : l'avis vu reste dans son fil, une fois | avis enregistré dans l'historique, pas rajouté au rejeu | parcours | garder ici | partiel : `src/main/agent/version-check.test.ts` › « réouverture sans fil gardé : l'avis survit au rejeu de session/load » |
| 7 | conversation rouverte, nouveau message : pas d'avis à nouveau | idem au tour suivant | parcours | garder ici | partiel : idem |
| 8 | version plus ancienne : avertissement, l'agent répond | avertissement non bloquant | doublon | `src/main/agent/version-check.test.ts` | `src/main/agent/version-check.test.ts` › « version plus ancienne : avertissement, jamais bloquant » |
| 9 | sous le plancher : refusé, expliqué, un seul avis, « Relancer » sous la saisie | refus + état d'erreur du composer | composant | `src/main/agent/version-check.test.ts` (refus) + test du statut du composer (à créer, `composer.failedToStart`) | partiel : `src/main/agent/version-check.test.ts` › « sous le plancher : démarrage refusé, expliqué, sans sortie d'erreur » |
| 10 | protocole incompatible : idem | refus protocole + état du composer | composant | idem | partiel : `src/main/agent/version-check.test.ts` › « protocole incompatible : démarrage refusé, expliqué » |

**Verdict** : à réduire (garder 3 vérifs : 5, 6, 7) — seuls la persistance à travers un vrai redémarrage et le fil rouvert justifient l'app ; le reste est déjà dans `version-check.test.ts`.
<!-- stats suite=versions total=10 parcours=3 composant=3 unitaire-main=0 capture=0 doublon=4 couvert=10 verdict=reduire -->

### `debordements.mjs` — le fil plein de contenus trop larges ne défile jamais de côté (1440 px, conversation étroite, panneau forcé) ; le panneau cède sa largeur et revient.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | carte de sous-agent dans le fil | le scénario a bien produit la carte | doublon | `C/thread/SubagentsCard.test.tsx` | `C/thread/SubagentsCard.test.tsx` › « un sous-agent seul a la même carte ; un texte ou un outil sépare deux cartes » |
| 2 | 1440 px : panneau ouvert d'office sur « Session » | ouverture d'office | doublon | `R/panel-tabs.test.ts`, `R/usePanel.test.ts` | `R/panel-tabs.test.ts` › « ouverture d'office (fiche 166) : panneau fermé, pas refusé, et 500 px pour la conversation » ; `R/usePanel.test.ts` › « à l'ouverture d'une conversation non vide, s'il reste 500 px ; pas en fenêtre étroite » |
| 3 | 1100 px : le panneau cède, conversation ≥ 500 px | règle de largeur | doublon | `R/panel-tabs.test.ts` | `R/panel-tabs.test.ts` › « le panneau cède jusqu'à 280 px pour garder 500 px à la conversation » |
| 4 | 720 px : panneau replié, conversation ≥ 500 px | repli en fenêtre étroite | doublon | `R/usePanel.test.ts`, `R/panel-tabs.test.ts` | `R/usePanel.test.ts` › « replié à 760 px : fermé dans l'état et dans le stockage ; rouvert seul à 1280 px » ; `R/panel-tabs.test.ts` › « sans place même à 280 px, il ne tient plus » |
| 5 | 720 px : sélecteur Code / Discussion sans débordement | boutons du sélecteur dans leur boîte | capture | capture nocturne | non |
| 6 | fenêtre élargie : le panneau revient sur « Session » | retour automatique | doublon | `R/usePanel.test.ts` | `R/usePanel.test.ts` › « replié à 760 px : fermé dans l'état et dans le stockage ; rouvert seul à 1280 px » |
| 7 | le fil ne défile pas de côté, aucun élément ne dépasse (×2 : 1440 px, étroite) | aucun contenu (mot long, chemin, lien, mermaid, tableau, diff, terminal, sous-agent) ne sort de la colonne | capture | capture nocturne **avec la sonde `MEASURE`** (mesure de mise en page, impossible en jsdom) | non |
| 8 | ni la fenêtre ni ses cadres ne défilent de côté (×2) | ancêtres sans scrollWidth > clientWidth | capture | idem | non |
| 9 | les blocs larges défilent dans leur cadre, ≥ 3 cadres (×2) | code/diff/tableau en overflow-x auto | capture | idem | non |
| 10 | le fil ne se laisse pas décaler de côté, scrollLeft 0 (×2) | `.scroll` ne défile pas horizontalement même forcé | capture | idem | non |
| 11 | panneau ouvert à la main, conversation écrasée : rien ne dépasse | cas extrême | capture | idem | non |

**Verdict** : à réduire (garder 6 vérifs : 5, 7-11, sous forme de mesure dans une capture nocturne qui échoue sur dépassement) — les règles de largeur du panneau sont déjà en unitaire ; la détection des débordements exige un vrai moteur de mise en page.
<!-- stats suite=debordements total=11 parcours=0 composant=0 unitaire-main=0 capture=6 doublon=5 couvert=5 verdict=reduire -->

### `onglets-etroits.mjs` — panneau à 280 px avec tous les outils, en français puis en anglais : rien de coupé, clics sur les onglets et le menu « + » sans fermeture accidentelle, puce de l'agent en icône.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Modifications actif : aucun onglet ni bouton coupé, aucun nom tronqué, ✕ entier (×2 langues) | rangée d'onglets tient à 280 px | capture | capture nocturne avec mesure (fr et en) | non |
| 2 | « 12 » affiché sur l'onglet Modifications (×2) | compteur visible sur l'onglet | composant | `C/panel/SidePanelTabs.test.tsx` (à compléter) | oui : `src/renderer/src/components/panel/SidePanel.test.tsx › en-tête du panneau (fiches 082, 185, 226) › onglets nommés dans l’ordre donné, avec leur compte (« 3/3 », « 12 »)` |
| 3 | clic sur l'icône d'un inactif l'ouvre, aucun onglet fermé (×onglets ×2) | le ✕ invisible ne prend pas le clic (hit-test réel) | parcours | garder ici | partiel : `C/panel/SidePanelTabs.test.tsx` › « souris : clic aussitôt après l'activation : ferme ; second clic d'un double clic : non » |
| 4 | après chaque activation : rien de coupé, ✕ entier (×onglets ×2) | idem #1 pour chaque actif | capture | capture nocturne | non |
| 5 | clic au bord droit puis second clic : ✕ jamais sous le pointeur, rien fermé (×2) | double clic au bord ne ferme pas | parcours | garder ici (elementFromPoint) | partiel : `C/panel/tab-close-guard.test.ts` › « second clic d'un double clic : ne ferme jamais ; clic simple ou clavier : ferme » |
| 6 | ✕ d'une ligne rangée dans « + » ferme l'onglet sans l'ouvrir (×2) | fermeture depuis le menu | composant | `C/panel/SidePanelTabs.test.tsx` (à compléter : menu « + ») | oui : `src/renderer/src/components/panel/PanelMoreMenu.test.tsx › menu « + » : onglets rangés (fiche 185) › ✕ d’une ligne : ferme l’onglet sans l’ouvrir, le menu reste ouvert` |
| 7 | appui sur ✕ glissé ailleurs : rien ne se ferme, menu reste ouvert (×2) | clic annulé par glisser | composant | idem (pointerdown/pointerup sur cibles différentes) | oui : `src/renderer/src/components/panel/PanelMoreMenu.test.tsx › menu « + » : onglets rangés (fiche 185) › appui sur ✕ glissé hors de la ligne : rien ne se ferme, le menu reste ouvert` |
| 8 | ↩ sur la ligne l'ouvre, rien n'est fermé (×2) | clavier dans le menu, l'appui précédent oublié | composant | idem | oui : `src/renderer/src/components/panel/PanelMoreMenu.test.tsx › menu « + » : onglets rangés (fiche 185) › ↩ sur la ligne l’ouvre, même après un appui sur son ✕ : rien n’est fermé` |
| 9 | ⌫ sur une ligne rangée ferme l'onglet, focus reste dans le menu (×2) | fermeture clavier, focus géré | composant | idem | oui : `src/renderer/src/components/panel/PanelMoreMenu.test.tsx › menu « + » : onglets rangés (fiche 185) › ⌫ sur une ligne rangée ferme l’onglet ; le focus passe à la ligne suivante` |
| 10 | puce de l'agent en icône, nom gardé pour les lecteurs (×2) | repli de la barre au plus étroit | composant | `C/composer/useBarFold.test.ts` + `useBarFold.dom.test.tsx` (à compléter : nom accessible) | oui : `src/renderer/src/components/composer/AgentMenu.test.tsx › puce de l’agent (fiche 185, D26) › nom gardé dans la puce et dans son infobulle ; l’icône est décorative` + `useBarFold.test.ts` (passage en icône) ; le rendu à 280 px : capture |

**Verdict** : à réduire (garder 2 vérifs : 3 et 5, hit-test réel ; 1 et 4 en capture nocturne fr/en) — le menu « + » (6-9) et le compteur n'ont aucun test de composant aujourd'hui : à créer avant de retirer.
<!-- stats suite=onglets-etroits total=10 parcours=2 composant=6 unitaire-main=0 capture=2 doublon=0 couvert=3 verdict=reduire -->

### `polices.mjs` — Inter et JetBrains Mono livrées et chargées depuis l'app ; ligatures du code coupées par défaut, activées par Réglages › Apparence ; Aurore nuit gardée.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | interface en Inter, chargée depuis l'app | la police livrée est servie et chargée (`document.fonts` status loaded) | parcours | garder ici (protocole de l'app, Chromium réel) | non |
| 2 | code en JetBrains Mono, chargée depuis l'app | idem pour la police du code | parcours | garder ici | non |
| 3 | ligatures du code coupées par défaut (bloc, en ligne, prose) | `--code-ligatures: none` appliqué au code, prose sans ligatures | composant | `R/appearance.test.ts` (à compléter : `--code-ligatures`) ; application CSS en capture | **oui, remplaçant créé** (2026-11-24) : `R/appearance.test.ts` › « ligatures du code : coupées par défaut, activées sur demande » — reste hors Vitest : application CSS au code : capture — avant : partiel : `src/shared/preferences.test.ts` › « ligatures du code (fiche 145) : non par défaut, oui ou non repris tel quel » |
| 4 | interrupteur des ligatures coupé par défaut | état initial du réglage | doublon | `C/settings/SettingsDialog.test.tsx` | `C/settings/SettingsDialog.test.tsx` › « ligatures du code (fiche 145) : coupées par défaut, un interrupteur les active » |
| 5 | police du code : JetBrains Mono, puis celle du système | ordre des options | doublon | idem | `C/settings/SettingsDialog.test.tsx` › « polices livrées (fiche 145, D9) : Inter et JetBrains Mono par défaut, celles du système au choix » |
| 6 | ligatures activées, texte inchangé | préférence → style calculé `normal` | composant | `R/appearance.test.ts` (à compléter) | **oui, remplaçant créé** (2026-11-24) : `R/appearance.test.ts` › « ligatures du code : coupées par défaut, activées sur demande » — reste hors Vitest : style calculé : capture — avant : partiel : `C/settings/SettingsDialog.test.tsx` › « ligatures du code (fiche 145) : coupées par défaut, un interrupteur les active » |
| 7 | Aurore nuit gardée après le réglage des ligatures (sombre) | un réglage n'écrase pas la palette | composant | `C/settings/SettingsDialog.test.tsx` / `R/appearance.test.ts` | **oui, remplaçant créé** (2026-11-24) : `R/appearance.test.ts` › « Aurore nuit gardée après le réglage des ligatures (sombre) » — avant : partiel : `C/settings/SettingsDialog.test.tsx` › « huit thèmes, six accents : chaque choix part dans les préférences ; Aurore « Nouveau » » |

**Verdict** : à réduire (garder 2 vérifs : 1 et 2, chargement réel des polices ; les captures p1-p6 en nocturne) — le reste se teste sur `appearance.ts` et SettingsDialog.
<!-- stats suite=polices total=7 parcours=2 composant=3 unitaire-main=0 capture=0 doublon=2 couvert=5 verdict=reduire -->

### `libelles.mjs` — libellés de la 0.11 : nom du profil plutôt que celui annoncé, options d'autorisation traduites, dossiers récents coupés au milieu.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | un seul nom : barre latérale et puce disent le profil, pas « Factice annoncé » | le nom annoncé par l'agent n'apparaît pas | doublon | `src/main/agent/agent-host.test.ts` | `src/main/agent/agent-host.test.ts` › « un seul nom : celui du profil, pas le titre annoncé (recette 0.11, C4) » |
| 2 | options d'autorisation traduites (Autoriser une fois / Refuser) | libellé d'après le genre ACP | doublon | `src/shared/permissions.test.ts` | `src/shared/permissions.test.ts` › « genre ACP connu et unique : le libellé de l'app » |
| 3 | nom donné par l'agent en infobulle (« Allow once ») | `title` du bouton = nom brut | composant | `C/thread/AuthorizationCard.test.tsx` (à compléter) | non |
| 4 | dossier récent : nom entier, début coupé, chemin en infobulle, ordre des 3 | coupe au milieu, nom jamais tronqué | composant | test de `DataSettings` (à créer) pour nom/infobulle/ordre ; la coupe réelle (scrollWidth) en capture | partiel : `src/shared/presentation.test.ts` › « le nom du dossier à part, le reste avant, le dossier personnel en ~ » |

**Verdict** : supprimable entièrement — après ajout de 2 tests de composant (infobulle du bouton d'autorisation, liste des dossiers récents) ; la coupe visuelle va dans une capture.
<!-- stats suite=libelles total=4 parcours=0 composant=2 unitaire-main=0 capture=0 doublon=2 couvert=3 verdict=supprimable -->

### `long-thread.mjs` — fil de 300 appels d'outils puis streaming : regroupement, cartes lisibles, coût du streaming (journalisé seulement).

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | tâches longues observables | précondition d'environnement (aucune assertion de budget derrière : les coûts sont seulement imprimés) | doublon | `e2e/suites/perf.mjs` (budgets réels) | partiel : `e2e/suites/perf.mjs` › « streaming : aucune tâche > 400 ms » |
| 2 | fil de ≥ 300 appels d'outils | le fil rend tous les outils | composant | `C/thread/Transcript.test.tsx` | partiel : `C/thread/Transcript.test.tsx` › « outils consécutifs regroupés, libellés lisibles, dernière capture visible » |
| 3 | outils consécutifs regroupés (30 groupes), résumé par genre | regroupement et résumé localisé | doublon | `C/thread/Transcript.test.tsx`, `src/shared/tool-groups.test.ts` | `C/thread/Transcript.test.tsx` › « outils consécutifs regroupés, libellés lisibles, dernière capture visible » ; `src/shared/tool-groups.test.ts` › « résumé par genre d'outil et par panneau de l'app ; état du groupe » |
| 4 | cartes lisibles : chemins relatifs, infobulle | libellé « ce que l'outil a fait et sur quoi », chemin relatif | doublon | `C/thread/Transcript.test.tsx` | `C/thread/Transcript.test.tsx` › « outil de l'agent : ce qu'il a fait et sur quoi, chemin relatif au dossier (fiche 107) » |

**Verdict** : supprimable entièrement — tout est en composant, et la partie « performance » n'asserte rien (mesures imprimées) ; `perf.mjs` porte déjà des budgets de streaming.
<!-- stats suite=long-thread total=4 parcours=0 composant=1 unitaire-main=0 capture=0 doublon=3 couvert=4 verdict=supprimable -->

#### Risques repérés (lot 4)

- Budgets de temps (perf) : seule une vraie fenêtre Chromium mesure tâches longues, nœuds et arrêts de la boucle d'évènements ; jsdom ne verrait ni un retour au calcul non borné ni une mise en page forcée par ligne (17 s figées, fiche 193).
- Ancrage du défilement quand des pages s'ajoutent au-dessus du fil (perf 18-19) et visibilité du résultat de recherche dans des cadres défilants imbriqués (perf 9, 11-14) : dépendent de getBoundingClientRect, scrollTop et CSS Highlights, absents de jsdom.
- « Sortie ouverte en bas » (perf 5) : le contenu se teste, la position de défilement non.
- Débordements horizontaux (debordements, usage-board 21-24, onglets 1/4, libelles 4 coupe) : jsdom ne charge pas `styles.css` ni ne calcule de largeur ; une capture nocturne ne détecte rien seule, il faut garder les sondes de mesure (`MEASURE`, `rowState`, `layout`) et les faire échouer.
- Hit-test des onglets (onglets 3, 5) : un ✕ invisible qui prend le clic n'est visible qu'avec un vrai clic aux coordonnées ; fireEvent viserait directement l'élément choisi.
- Polices livrées (polices 1-2) : le chargement par le protocole de l'app et la CSP ne se testent pas en composant ; une régression d'empaquetage passerait inaperçue.
- Quota (quota 11-13) : processus fils réel tué à la sortie de l'app et absence d'écriture après coup ; les tests unitaires simulent le pty.
- Versions (versions 5-7) : persistance `versionNotices` à travers un vrai redémarrage et rejeu de l'historique enregistré.
- Mon activité (usage-board 5, 28) : chaîne réelle tour d'agent → journal SQLite → IPC → page, et relecture automatique après la remise à zéro.
- Trous de couverture à combler avant toute suppression : menu « + » du panneau (fermer, glisser, ↩, ⌫) et compteur d'onglet, infobulle du bouton d'autorisation, liste des dossiers récents de DataSettings, lien `usage-open-board`, fermeture de la page Mon activité, `--code-ligatures` dans `appearance.ts`, statut « n'a pas pu démarrer » du composer.

---

## Lot 5

Chemins de test relatifs à la racine du dépôt. « couvert » = un test existant cité (« partiel » compté).

### `activity.mjs` — libellés lisibles d'un outil annoncé sans cible (« Prépare… »), interrompu, sortie JSON, indicateur durée/étape.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | patch sans cible : « Prépare une modification… » | jamais le titre brut `patch` sur la carte | composant | `src/renderer/src/components/thread/ToolCall.test.tsx` (à créer) | `src/shared/tool-label.test.ts` › « outil annoncé sans rien d'autre : le libellé de son genre, le titre brut en infobulle (fiche 128) » |
| 2 | titre brut en infobulle | `tool-label.title === 'patch'` | composant | idem | idem (tool-label.test) |
| 3 | indicateur dit pareil, jamais « patch » | WorkingIndicator reprend le libellé de la carte | composant | `WorkingIndicator.test.tsx` (existant) | `src/shared/activity.test.ts` › « un patch annoncé sans cible n'est jamais « patch » » ; `WorkingIndicator.test.tsx` › « fiche 267 (D14) : la durée du tour, l'étape en cours en plus petit » |
| 4 | « patch » absent de tout le fil | aucun autre composant n'affiche le titre brut | composant | `Transcript.test.tsx` (existant, à compléter) | partiel : activity.test (même test que 3) |
| 5 | durée du tour en infobulle | `.working-time[title]` « Tour commencé… » | composant | `WorkingIndicator.test.tsx` | `WorkingIndicator.test.tsx` › « fiche 267 (D14) : la durée du tour, l'étape en cours en plus petit » |
| 6 | aucun chronomètre par carte | pas de `.working-time` dans `[data-testid=tool]` | composant | `Transcript.test.tsx` (à compléter) | non |
| 7 | cible arrivée : « Modification de notes.md » | libellé recalculé à l'arrivée des `locations` | composant | `ToolCall.test.tsx` (à créer) | `src/shared/tool-label.test.ts` › « lecture, modification, suppression, déplacement : d'après le premier emplacement » |
| 8 | le patch se termine | statut `completed` reçu par ACP et affiché | doublon | journées types (tout outil fini) | partiel : `parcours-matinee` étape « autoriser une modification une fois » |
| 9 | interrompu sans cible : « Modification · interrompu » | nom du genre + état annulé | composant | `ToolCall.test.tsx` | `src/shared/tool-label.test.ts` › « sans cible, interrompu ou en échec : le nom du genre, la carte dit l'état (C6) » |
| 10 | shell sans commande : « Prépare une commande… » | genre `execute` sans cible | composant | `ToolCall.test.tsx` | `src/shared/tool-label.test.ts` › « « Prépare… » seulement sans cible, sans autorisation en attente, tant qu'il est annoncé » |
| 11 | commande arrivée, la carte la montre | titre = texte de la commande | composant | `ToolCall.test.tsx` | `src/shared/tool-label.test.ts` › « commande : son texte en code ; le titre en détail s'il en diffère ; sans commande, rien » |
| 12 | sortie JSON indentée, vrais retours à la ligne | rendu `tool-json` | composant | `ToolCall.test.tsx` (rendu `tool-json`) | partiel : `src/shared/json-output.test.ts` › « indente un objet JSON, avec de vrais retours à la ligne dans les chaînes » |
| 13 | durée du tour puis étape en plus petit | texte « N s » + « étape … » ; police plus petite | composant | `WorkingIndicator.test.tsx` (texte) ; taille de police → capture | partiel : `WorkingIndicator.test.tsx` › « fiche 267 (D14)… » (texte seulement) |
| 14 | à 720 px, indicateur sur une ligne (≤ 40 px) | pas de retour à la ligne en fenêtre étroite | capture | capture nocturne `267-indicateur-720` | non |

**Verdict** : supprimable entièrement — tout est de la logique de libellé déjà testée en unitaire ; il manque un `ToolCall.test.tsx` (rendu carte + `tool-json`) et la capture 720 px en nocturne.
<!-- stats suite=activity total=14 parcours=0 composant=12 unitaire-main=0 capture=1 doublon=1 couvert=12 verdict=supprimable -->

### `attachments.mjs` — image collée, mention @fichier, glisser-déposer, fichier exclu, long texte collé.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | image collée : vignette dans la saisie | collage d'un `File` image → puce avec `<img>` | composant | `Composer.test.tsx` (existant) | partiel : `Composer.test.tsx` › « image déposée avec un chemin : vérifiée aussi, jointe par son chemin si on confirme » |
| 2 | @app : le fichier du dossier est proposé | recherche dans le dossier via IPC | composant | `useMentions.test.ts` + `src/main/workspace-files.test.ts` | partiel : `useMentions.test.ts` › « au curseur : mentions de contexte, puis fichiers cherchés après un court délai » ; `workspace-files.test.ts` › « rankPath : nom, segment ou mot qui commence… » |
| 3 | menu « @ » entier dans la fenêtre (accueil) | placement sous la saisie centrée | composant | `menu-placement.test.ts` (existant) | `menu-placement.test.ts` › « opens below on the welcome screen when there is more room under the composer » |
| 4 | Entrée : chemin inséré + fichier joint | remplacement `@app` → `@src/app.ts ` et puce | composant | `Composer.test.tsx` (à compléter) | partiel : `src/shared/attachments.test.ts` › « mention @ : détectée avant le curseur, puis remplacée par le chemin » |
| 5 | l'agent reçoit l'image et le contenu du fichier | renderer → main → blocs ACP (image + ressource) | parcours | garder 1 envoi joint en e2e (ex. `parcours-outils`, nouvelle étape) | partiel : `src/main/agent/prompt-content.test.ts` › « texte d'abord, image collée, fichier texte embarqué » |
| 6 | pièces jointes dans le message, saisie vidée | `msg-attachments` rendu, zone vidée après envoi | composant | `Transcript.test.tsx` / `Composer.test.tsx` | non |
| 7 | fichier glissé sur le fil : indication sur toute la conversation | `drop-overlay` au survol d'un glisser | composant | `DropOverlay.test.tsx` / `useFileDrop.test.ts` (à créer) | non |
| 8 | déposé au milieu du fil : joint, indication retirée | vrai dépôt natif, chemin via `webUtils.getPathForFile` | parcours | garder ici (ou étape d'une journée) | non |
| 9 | déposé sur la saisie : toujours joint | même chemin que 8 | doublon | supprimer | partiel : `Composer.test.tsx` › « image déposée avec un chemin… » |
| 10 | fichier exclu : confirmation, pas encore joint | `.bobignore` cité, puce non ajoutée | composant | `Composer.test.tsx` | `Composer.test.tsx` › « fichier exclu par l'agent : confirmation avant de le joindre » |
| 11 | « Ne pas joindre » : rien de joint | | composant | idem | idem |
| 12 | « Joindre quand même » : joint | | composant | idem | idem |
| 13 | texte long collé : puce « Texte collé (45 lignes) » | saisie inchangée | composant | `Composer.test.tsx` | `Composer.test.tsx` › « long texte collé : une puce, qui part en pièce jointe ; un texte court reste dans la saisie » |
| 14 | texte court laissé à la saisie | pas de puce, collage non empêché | composant | idem | idem |
| 15 | l'agent reçoit le texte collé en bloc annoncé | bloc « Texte collé (N lignes) » | unitaire-main | `prompt-content.test.ts` | `src/main/agent/prompt-content.test.ts` › « bloc de texte à part, annoncé, même sans embeddedContext ; montré dans le fil » |
| 16 | fil : puce du texte collé dans le message | rendu de la vue `text` | composant | `ThreadExtras.test.tsx` / `Transcript.test.tsx` | partiel : `ThreadExtras.test.tsx` › « message fait seulement d'un texte collé (fiche 155) : il se copie aussi » |
| 17 | « Remettre dans la saisie » | texte revient, puce part | composant | `Composer.test.tsx` | `Composer.test.tsx` › « aperçu du texte collé, puis remis dans la saisie » |

**Verdict** : à réduire (garder 2 vérifs : #8 dépôt natif d'un vrai fichier, #5 pièce jointe reçue par l'agent) — idéalement fusionnées en une étape de journée type ; le reste est dans `Composer.test.tsx`.
<!-- stats suite=attachments total=17 parcours=2 composant=13 unitaire-main=1 capture=0 doublon=1 couvert=14 verdict=reduire -->

### `discussion.mjs` — espace Discussion : sélecteur, accueil, document déposé, écriture accordée/refusée, panneaux, lien physique, « Continuer dans un projet ».

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | lancement : espace Code sélectionné | `space-code[aria-selected=true]` | composant | `SpaceSwitcher.test.tsx` (à créer) | partiel : `Sidebar.test.tsx` › « espace Discussion (fiche 224) : seulement les discussions, ni Équipe ni tâches planifiées » |
| 2 | accueil discussion : ni dossier, ni branche, ni Équipe ; « Nouvelle discussion » | | composant | `Sidebar.test.tsx` + `Welcome.test.tsx` (à créer) | partiel : `Sidebar.test.tsx` › même test |
| 3 | document déposé copié, original intact | `documents.add` copie | unitaire-main | `discussion-space.test.ts` | `src/main/conversations/discussion-space.test.ts` › « documents : fichiers visibles du premier niveau ; copies numérotées, originaux intacts » |
| 4 | écriture accordée dans les documents, refusée ailleurs, chacune dite | permission ACP décidée par le main + avis dans le fil | parcours | garder ici (une étape) | `src/main/conversations/manager-discussion.test.ts` › « agent factice `discussion-document` : écriture accordée dans les documents, refusée hors du dossier » |
| 5 | carte du document créé | `document-card` « Synthèse.md » | composant | `DocumentCards.test.tsx` (à créer) | partiel : `src/main/documents/ipc.test.ts` › « à la fin d'un tour, les documents créés ou modifiés sont posés dans le fil » |
| 6 | rien écrit hors du dossier | `jamais.md` absent | unitaire-main | `manager-discussion.test.ts` | `manager-discussion.test.ts` › « agent factice `discussion-document`… » |
| 7 | panneau « Documents » : 2 documents, aperçu du plus récent | | composant | `DocumentsPanel.test.tsx` (à créer) | partiel : `documents/ipc.test.ts` › « aperçu : texte, image, texte d'un document Word, sinon rien » |
| 8 | onglet Session : « Cette discussion », sans identifiant | | composant | `SessionTab.test.tsx` | `SessionTab.test.tsx` › « « Documents : Cette discussion », jamais l'identifiant ni le chemin ; s'affiche dans le Finder » |
| 9 | onglet Modifications : ni vue Git ni « dernier commit » | | composant | `ChangesTab.test.tsx` | `ChangesTab.test.tsx` › « ses documents, jamais l'état git ni « depuis le dernier commit » » |
| 10 | fil : jamais l'identifiant du dossier | outils disent « Documents » | composant | `tool-label.test.ts` | `src/shared/tool-label.test.ts` › « discussion (fiche 224) : le dossier se dit « Documents », en libellé comme en infobulle » |
| 11 | autorisation en clair, commande repliée sous « Détails techniques » | `permission-details` fermé | composant | `AuthorizationCard.test.tsx` (à compléter) | non |
| 12 | commande : dossier « Documents », jamais l'identifiant | | composant | `AuthorizationCard.test.tsx` | partiel : tool-label.test (même test que 10) |
| 13 | fichier à plusieurs noms : carte avec la raison | vrai lien physique → risque `sharedFile` | parcours | garder ici | partiel : `manager-discussion.test.ts` › « agent factice `discussion-lien-physique` : un fichier à plusieurs noms n'est pas accordé d'office (fiche 230) » |
| 14 | refusé : fichier extérieur intact | clic Refuser → rien écrit | parcours | garder ici (avec 13) | partiel : manager-discussion.test (même test que 13) |
| 15 | « Continuer dans un projet » : documents copiés par défaut | case cochée | composant | `ContinueInProjectDialog.test.tsx` (à créer) | partiel : `documents/ipc.test.ts` › « continuer dans un projet : documents copiés dans `documents/` si demandé » |
| 16 | espace Code : les discussions n'y sont pas | filtre par espace | composant | `Sidebar.test.tsx` | partiel : `Sidebar.test.tsx` › « espace Discussion (fiche 224)… » |

**Verdict** : à réduire (garder 3 vérifs : #4, #13, #14 — tour réel avec permissions décidées par le main et vrai lien physique) ; le reste en composants (3 fichiers à créer : DocumentCards, DocumentsPanel, ContinueInProjectDialog).
<!-- stats suite=discussion total=16 parcours=3 composant=11 unitaire-main=2 capture=0 doublon=0 couvert=15 verdict=reduire -->

### `fun.mjs` — options d'ambiance : prénom, thèmes Aurore/Nuit noire, police du code, suggestions, sommaire, bobcoins, budget dépassé.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | plus de compteur de bobcoins dans la barre latérale | `.bob-spend` absent | composant | `Sidebar.test.tsx` | non |
| 2 | thème Aurore / Nuit noire : `--bg` attendu | choix du thème → palette appliquée | composant | `SettingsDialog.test.tsx` + `themes.test.ts` | **oui, remplaçant créé** (2026-11-24) : `R/appearance.test.ts` › « Nuit noire en sombre : `data-palette` posé ; l’accent retiré « Comme le Mac » devient l’orange » ; `R/appearance.test.ts` › « Aurore en clair, Fjord en clair : la palette suit le thème du mode affiché » — reste hors Vitest : couleur réelle : capture — avant : partiel : `src/shared/themes.test.ts` › « palette affichée et fond des fenêtres au lancement » |
| 3 | police du code : Menlo / DejaVu Sans Mono | polices installées lues par le main (AppKit / fontconfig) | parcours | déplacer dans `polices.mjs` | partiel : `src/renderer/src/appearance.test.ts` › « polices du système proposées en plus : sans serif et chasse fixe » |
| 4 | accueil : salutation selon l'heure, avec le prénom | | composant | `Welcome.test.tsx` (à créer) | non |
| 5 | suggestion : texte dans la saisie, rien envoyé | | composant | `Welcome.test.tsx` (à créer) | non |
| 6 | sommaire : un trait par message | | doublon | `sommaire.mjs` / outline-layout | `outline-layout.test.ts` › « peu de messages : un trait chacun, écart habituel » |
| 7 | sommaire : clic → message affiché, trait courant | | doublon | `parcours-longue` étape « le sommaire, et retour à un ancien message » | `parcours-longue.mjs` › « le troisième message est à l'écran, le fil n'est plus en bas » |
| 8 | bobcoins : coût de la conversation | détail de la consommation | composant | `UsageMeter.test.tsx` | `UsageMeter.test.tsx` › « agent qui ne donne que son coût (comme Bob) : la puce montre le coût, lignes sans jetons » |
| 9 | Bobcoins aujourd'hui / 7 jours / mois dans « Mon activité » | base de Bob lue par le main | unitaire-main | `bob-costs.test.ts` + `ActivityPage.test.tsx` | `src/main/agent/bob-costs.test.ts` › « tâches utilisées aujourd'hui, sur sept jours, ce mois-ci ; lignes douteuses ignorées » ; `ActivityPage.test.tsx` › « IBM Bob sur ce Mac : quota du mois et dépense, venus des canaux génériques » |
| 10 | budget dépassé : titre et description de Bob | pas « Internal error » | unitaire-main | `process-utils.test.ts` | `src/main/agent/process-utils.test.ts` › « erreur de budget de Bob : titre et description au lieu de « Internal error » » |

**Verdict** : à réduire (garder 1 vérif : #3, à déplacer dans `polices.mjs`) — suite fourre-tout ; créer `Welcome.test.tsx`, le reste est déjà couvert ou doublon.
<!-- stats suite=fun total=10 parcours=1 composant=5 unitaire-main=2 capture=0 doublon=2 couvert=7 verdict=reduire -->

### `mentions.mjs` — mentions `@git-changes` et `@terminal` jointes au message, fichier exclu sauté.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | menu « @ » : fichier exclu (.bobignore) non proposé | | unitaire-main | `workspace-files.test.ts` | `src/main/workspace-files.test.ts` › « un fichier exclu n'est pas proposé, la limite compte les autres » |
| 2 | @git-changes et @terminal en pièces jointes | menu de contexte → puces | composant | `useMentions.test.ts` / `Composer.test.tsx` | partiel : `useMentions.test.ts` › « au curseur : mentions de contexte, puis fichiers cherchés après un court délai » ; `context-mentions.test.ts` › « proposées selon ce qui est tapé après @ » |
| 3 | à l'envoi : état et diff git joints | | unitaire-main | `git-context.test.ts` + `prompt-content.test.ts` | `src/main/changes/git-context.test.ts` › « état et diff depuis le dernier commit, fichiers non suivis listés » ; `prompt-content.test.ts` › « @git-changes, @terminal (fiche 057) : contenu lu à l'envoi, joint en texte » |
| 4 | @git-changes : fichier exclu sauté, et dit | | unitaire-main | `git-context.test.ts` | `git-context.test.ts` › « saute les fichiers exclus, dans l'état et le diff, et le dit » |
| 5 | à l'envoi : dernières lignes du terminal jointes | sortie d'un vrai pty | parcours | `parcours-outils` étape « une conversation, puis le terminal à côté » (ajouter @terminal) | partiel : `src/main/terminal/terminal-context.test.ts` › « dernières lignes de l'onglet le plus récent, sans les icônes du thème de l'invite » |
| 6 | fil : pièces jointes montrées | `msg-attachments .attachment` | composant | `Transcript.test.tsx` | non |

**Verdict** : à réduire (garder 1 vérif : #5, à faire passer dans `parcours-outils`) — puis suite supprimable.
<!-- stats suite=mentions total=6 parcours=1 composant=2 unitaire-main=3 capture=0 doublon=0 couvert=5 verdict=reduire -->

### `notifications.mjs` — notifications, son, rebond et badge du Dock, clic sur la notification, cloche coupée, refus de macOS.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | fenêtre sans focus : notification pour une autorisation | vraie `Notification` Electron construite (titre « agent · … ») | parcours | garder ici | partiel : `src/main/notifications/attention.test.ts` › « une demande reste en attente tant qu'elle n'est pas traitée, même vue » |
| 2 | un son (Glass) pour la demande | | unitaire-main | `attention.test.ts` | `attention.test.ts` › « un son pour une action attendue, fenêtre sans focus ; pas pour une réponse finie » |
| 3 | Dock rebondit (`critical`) | | unitaire-main | `attention.test.ts` | `attention.test.ts` › « un agent attend : un rebond `critical`, quelle que soit la demande » |
| 4 | badge du Dock : 1 | | unitaire-main | `dock-badge.test.ts` | `src/main/notifications/dock-badge.test.ts` › « le nombre « À traiter », posé seulement quand il change, effacé à zéro » |
| 5 | retour dans la fenêtre : le rebond s'arrête | | unitaire-main | `attention.test.ts` | `attention.test.ts` › « le retour dans la fenêtre arrête le rebond ; la demande suivante rebondit de nouveau » |
| 6 | fin de réponse : notification avec sa conclusion sans Markdown | | unitaire-main | `attention.test.ts` | `attention.test.ts` › « fin de tour hors de la fenêtre : notification avec la fin de la réponse, pastille » ; « retire le Markdown visible et garde la fin d'une longue réponse » |
| 7 | fin de réponse : pas de son | | unitaire-main | `attention.test.ts` | `attention.test.ts` › « un son pour une action attendue… » |
| 8 | fin de réponse : un rebond `informational` | | unitaire-main | `attention.test.ts` | `attention.test.ts` › « réponse finie : un rebond `informational` ; erreur aussi (mêmes moments qu'une notification) » |
| 9 | réponse non lue : badge toujours à 1 | | unitaire-main | `attention.test.ts` / `dock-badge.test.ts` | partiel : `attention.test.ts` › « fin de tour hors de la fenêtre… » |
| 10 | clic sur la notification : sa conversation s'affiche | événement `click` du main → IPC → renderer change de conversation | parcours | garder ici | non |
| 11 | conversation vue : pastille et badge effacés | | unitaire-main | `attention.test.ts` | `attention.test.ts` › « vue en revenant dans la fenêtre : la pastille et les notifications disparaissent » |
| 12 | coupées : ni notification ni badge, l'icône reste | | unitaire-main | `attention.test.ts` + `dock-badge.test.ts` | `attention.test.ts` › « réglage coupé : pas de notification, les pastilles restent » ; `dock-badge.test.ts` › « réglage coupé : effacé, et rien tant qu'il l'est » |
| 13 | coupées : pas de rebond | | unitaire-main | `attention.test.ts` | `attention.test.ts` › « la cloche et le réglage coupent le rebond ; le son, lui, reste » |
| 14 | refus de macOS : cloche en alerte, explication, lien | événement `failed` → état « bloqué » → cloche du renderer | parcours | garder ici (+ test de `system-notifier.ts` à créer) | non |
| 15 | refus de macOS : le Dock rebondit quand même | | unitaire-main | `dock-bounce.test.ts` (à compléter) | partiel : `src/main/notifications/dock-bounce.test.ts` › « un `critical` remplace un `informational` qui rebondit encore, jamais l'inverse » |

**Verdict** : à réduire (garder 3 vérifs : #1, #10, #14 — câblage réel Notification ↔ main ↔ renderer) ; toute la logique son/rebond/badge est déjà en unitaire-main.
<!-- stats suite=notifications total=15 parcours=3 composant=0 unitaire-main=12 capture=0 doublon=0 couvert=13 verdict=reduire -->

### `parcours-longue.mjs` — journée type : 36 échanges riches, sommaire, envoi depuis le haut, redimensionnement, panneau, autre conversation, relance.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | 36 messages, le fil suit le dernier | défilement réel sur un long fil | parcours | garder ici | partiel : `useThreadScroll.test.ts` › « le fil s'ouvre en bas, sans flèche ; le fil et son contenu sont observés » |
| 2 | le sommaire a tous les messages | compte des `outline-item` | composant | `ConversationOutline.test.tsx` (à créer) — détail qui peut descendre | partiel : `outline-layout.test.ts` › « beaucoup : un trait pour plusieurs messages, tous couverts une fois, dans la hauteur » |
| 3 | clic sommaire : 3ᵉ message à l'écran, plus en bas | survol réel + défilement | parcours | garder ici | non |
| 4 | envoi depuis le haut : retour en bas, réponse visible | | parcours | garder ici | `useThreadScroll.test.ts` › « message envoyé fil remonté : retour en bas tout de suite, la bulle et la réponse suivies (D26) » |
| 5 | étroite puis large : rien ne déborde, saisie et dernier message visibles | mise en page réelle | parcours | garder ici | non |
| 6 | panneau ouvert puis fermé : dernier message gardé | | parcours | garder ici | non |
| 7 | autre conversation puis retour : dernier message à l'écran | | parcours | garder ici | partiel : `useThreadScroll.test.ts` › « autre conversation : elle s'ouvre en bas, même si on avait remonté » |
| 8 | app quittée | `check(true)` d'étape | parcours | garder ici | non |
| 9 | relance : tous les messages, le dernier à l'écran | redémarrage, fil rechargé | parcours | garder ici | non |
| 10 | relance : le long fil continue | | parcours | garder ici | non |

**Verdict** : à garder — c'est une journée type ; seul #2 (compte du sommaire) peut descendre en composant, et elle peut absorber les vérifs de trait courant de `sommaire.mjs`.
<!-- stats suite=parcours-longue total=10 parcours=9 composant=1 unitaire-main=0 capture=0 doublon=0 couvert=4 verdict=garder -->

### `parcours-pannes.mjs` — journée type : plantage d'un agent, isolement, relance, silence, erreur de tour, quitter pendant un tour, relance de l'app.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | deux conversations | mise en place | parcours | garder ici | non |
| 2 | un avis de panne, avec le code de sortie | vrai processus qui sort (code 3) | parcours | garder ici (texte de l'avis : composant possible) | non |
| 3 | l'autre conversation : aucun avis, elle répond | isolement entre processus d'agent | parcours | garder ici | non |
| 4 | écrire relance l'agent planté, le fil est gardé | relance de processus | parcours | garder ici | non |
| 5 | bandeau de silence, « Arrêter », puis la suite | minuterie réelle + annulation ACP | parcours | garder ici | partiel : `SilenceBanner.test.tsx` › « « Arrêter » arrête la réponse ; « Attendre » masque jusqu'au prochain silence » |
| 6 | erreur de tour dite, la conversation continue | | parcours | garder ici | non |
| 7 | quitté pendant le tour | `check(true)` d'étape | parcours | garder ici | non |
| 8 | relance : la conversation interrompue reprend | redémarrage | parcours | garder ici | non |
| 9 | l'autre a gardé ses pannes et répond | persistance du fil | parcours | garder ici | non |

**Verdict** : à garder — tout est course entre processus et redémarrage ; aucune vérif de détail ne mérite de descendre (le libellé de l'avis #2 pourrait seulement être doublé par un test de composant).
<!-- stats suite=parcours-pannes total=9 parcours=9 composant=0 unitaire-main=0 capture=0 doublon=0 couvert=1 verdict=garder -->

### `pinned-plan.mjs` — liste de tâches épinglée au-dessus de la saisie pendant le tour, repliée, à côté, retirée à la fin.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | épinglée juste au-dessus de la saisie (8 px) | position réelle dans `.thread-dock` | capture | capture nocturne `100-taches-epinglees` | non |
| 2 | en-tête « Liste des tâches 1 / 3 » | | composant | `PinnedPlan.test.tsx` | `PinnedPlan.test.tsx` › « dépliée : titre, progression, tâche en cours marquée et qui tourne » |
| 3 | tâche en cours marquée, son cercle tourne | | composant | idem | idem |
| 4 | tâches faites grisées, pas barrées | `text-decoration: none` (CSS) | capture | capture nocturne | non |
| 5 | pendant le tour : ni carte « Plan » ni compteur | | composant | `PinnedPlan.test.tsx` + `Transcript.test.tsx` | partiel : `PinnedPlan.test.tsx` › « masquée pendant le tour, montrée sinon » |
| 6 | fil remonté : liste en place, flèche « Aller en bas » au-dessus | pas de recouvrement | capture | capture nocturne | non |
| 7 | repliée d'un clic : une ligne, tâche, « 1 / 3 » | | composant | `PinnedPlan.test.tsx` | `PinnedPlan.test.tsx` › « repliée d'un clic sur une ligne, et retenue » |
| 8 | à côté : liste épinglée, pas de carte « Plan » | BesidePane passe le plan épinglé | composant | `BesidePane.test.tsx` (à créer) | partiel : `useBeside.test.ts` › « ouverte : chargée à part, affichée avec son fil » |
| 9 | fin du tour : liste retirée, carte « Plan » et compteur « 3 / 3 » | | composant | `PinnedPlan.test.tsx` + `Transcript.test.tsx` | partiel : `PinnedPlan.test.tsx` › « épinglé tant que l'agent travaille, et s'il y a des tâches » |

**Verdict** : supprimable entièrement — logique déjà dans `PinnedPlan.test.tsx`, les positions passent en captures nocturnes.
<!-- stats suite=pinned-plan total=9 parcours=0 composant=6 unitaire-main=0 capture=3 doublon=0 couvert=6 verdict=supprimable -->

### `presentation.mjs` — densité compacte (jetons) et mode présentation (Réglages, menu Affichage, pastille, coûts masqués).

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | densité normale : 18 px entre messages | `row-gap` calculé | capture | capture nocturne | partiel : `src/shared/themes.test.ts` › « variables CSS : --density-* en kebab, les mêmes pour les deux densités » |
| 2 | compacte : jeton `--density-thread-gap` = 10px | choix appliqué à la racine | composant | `SettingsDialog.test.tsx` + `themes.test.ts` | `themes.test.ts` › « la densité compacte resserre chaque espace, sans jamais en agrandir un » |
| 3 | compacte : 10 px entre messages | CSS consomme le jeton | capture | capture nocturne | partiel : themes.test (même test que 2) |
| 4 | compacte : lignes de la barre latérale à 4 px | | capture | capture nocturne | non |
| 5 | barre latérale : retrait à gauche inchangé | | capture | capture nocturne | non |
| 6 | pastille absente au lancement | | composant | `PresentationPill.test.tsx` (à créer) | partiel : `src/main/presentation.test.ts` › « inactif au lancement, prévient seulement quand l'état change » |
| 7 | menu Affichage : « Mode présentation » décoché | | unitaire-main | `menu.test.ts` | `src/main/menu.test.ts` › « Affichage › Mode présentation : case cochée selon l'état (fiche 159) » |
| 8 | texte du fil agrandi de 3 px | `--conv-size` | composant | `presentation.test.ts` renderer (à créer) | non |
| 9 | menu coché, synchronisé avec les Réglages | renderer → main → menu natif | parcours | garder ici | partiel : `menu.test.ts` › « Affichage › Mode présentation… » |
| 10 | pastille de rappel affichée | | composant | `PresentationPill.test.tsx` (à créer) | non |
| 11 | quota et montants masqués | | composant | `UsageMeter.test.tsx` / `AgentQuotaStatus.test.tsx` (à compléter) | partiel : `TurnSummary.test.tsx` › « mode présentation : pas de montant » |
| 12 | détail de la consommation : aucun coût | | composant | `UsageMeter.test.tsx` (à compléter) | partiel : `src/shared/usage.test.ts` › « sans coût nulle part : rien ; mode présentation : aucun montant » |
| 13 | pastille : quitte le mode, texte et menu rétablis | aller-retour avec le menu natif | parcours | garder ici (avec 9) | partiel : `src/shared/preferences.test.ts` › « le mode présentation n'est pas une préférence : jamais repris d'un fichier » |

**Verdict** : à réduire (garder 2 vérifs : #9 et #13, synchro avec le menu natif du main) — densité en captures, le reste en composants.
<!-- stats suite=presentation total=13 parcours=2 composant=6 unitaire-main=1 capture=4 doublon=0 couvert=9 verdict=reduire -->

### `questions.mjs` — questions à choix, OpenCode 2, plan à valider, question obligatoire, `ask_user` par le serveur MCP de l'app.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Maj+Tab : mode suivant | | composant | `Composer.test.tsx` | `Composer.test.tsx` › « mode Plan (fiche 098) : zone teintée, invite et ligne de rappel, Maj+Tab vers le mode suivant » |
| 2 | la carte de questions remplace l'appel d'outil | pas de carte `AskUserQuestion` | composant | `Transcript.test.tsx` (à compléter) | non |
| 3 | options numérotées avec description | 2 `choice` | composant | `QuestionCard.test.tsx` | `QuestionCard.test.tsx` › « choix unique : un clic répond et envoie ; la carte a le focus clavier » |
| 4 | touche 2 : option choisie, question suivante | | composant | idem | `QuestionCard.test.tsx` › « clavier : le chiffre de l'option choisit, ↓ puis Entrée aussi » ; « plusieurs questions : onglets, passage à la suivante, envoi groupé » |
| 5 | réponses envoyées (unique, multiple, « Autre ») | contenu de la réponse | composant | `questions.test.ts` | `src/shared/questions.test.ts` › « answerContent : choix, cases cochées, texte libre ; rien pour une question passée » |
| 6 | résumé « question → réponse » dans le fil | | composant | `ElicitationCard.test.tsx` | `ElicitationCard.test.tsx` › « après la réponse : résumé dans le fil » |
| 7 | OpenCode 2 : outil question en questionnaire | | composant | `questions.test.ts` | `questions.test.ts` › « forme d'OpenCode 2.0.31 (outil question) : q0 et q0_custom (fiche 078) » |
| 8 | plan affiché en clair avant validation | `plan-doc` | composant | `PlanApproval.test.tsx` (à créer) | non |
| 9 | touche 3 : « No, keep planning » transmis | | composant | `PlanApproval.test.tsx` (à créer) | partiel : `src/mock-agent/mock-agent.test.ts` › « plan-a-valider : « continuer à planifier » ne change pas de mode » |
| 10 | plan approuvé → mode Code | | composant | `PlanApproval.test.tsx` (à créer) | partiel : `mock-agent.test.ts` › « plan-a-valider : plan approuvé → mode code » |
| 11 | question obligatoire : « Envoyer » attend | | composant | `QuestionCard.test.tsx` | `QuestionCard.test.tsx` › « question obligatoire sans réponse : « Envoyer » reste inactif » ; `questions.test.ts` › « question obligatoire au format générique : `required`, « Autre » en `<clé>_custom` » |
| 12 | plan (`rawInput.plan`) affiché | | composant | `PlanApproval.test.tsx` (à créer) | partiel : `src/shared/transcript.test.ts` › « plan à valider porté par rawInput.plan (cas réel Codex) ; réponse au formulaire conservée » |
| 13 | plan approuvé | même contrôle que 10 | doublon | supprimer | `mock-agent.test.ts` › « plan-a-valider : plan approuvé → mode code » |
| 14 | ask_user (MCP) : carte de questions, sans autorisation | agent → serveur MCP du main → carte | parcours | garder ici (ou `parcours-outils`) | partiel : `src/shared/ask-user.test.ts` › « schéma : reconnu comme questionnaire (carte de la fiche 016) » |
| 15 | ask_user : la réponse revient comme résultat d'outil | aller-retour MCP | parcours | garder ici | partiel : `ask-user.test.ts` › « résultat renvoyé à l'agent » |

**Verdict** : à réduire (garder 2 vérifs : #14, #15, aller-retour `ask_user` par le serveur MCP) ; créer `PlanApproval.test.tsx`, aucun test de composant pour la carte de plan aujourd'hui.
<!-- stats suite=questions total=15 parcours=2 composant=12 unitaire-main=0 capture=0 doublon=1 couvert=13 verdict=reduire -->

### `relecture.mjs` — « Faire relire… » : dialogue, carte du Code reviewer, remarques, diff, « corriger », conversation du relecteur.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Modifications d'un dossier git : « Faire relire… » | bouton présent, nom accessible | composant | `ChangesTab.test.tsx` (à compléter) | partiel : `parcours-matinee` étape « faire relire par le Code reviewer » |
| 2 | dialogue : Code reviewer, non commité, autre modèle, coût | | composant | `ReviewDialog.test.tsx` | `ReviewDialog.test.tsx` › « un autre modèle proposé d'office, dit ; il part avec la relecture » |
| 3 | en cours : bulle « @Code reviewer Relis … », carte dessous, Arrêter | | composant | `WorkReview.test.tsx` | `WorkReview.test.tsx` › « en cours : la bulle « @Code reviewer Relis … » et sa carte, sans remarque encore » |
| 4 | remarques, avis, « corriger », « Voir sur le diff », « Répondre » | | composant | `WorkReview.test.tsx` | `WorkReview.test.tsx` › « remarques visibles, rangées par gravité ; avis d'ensemble ; réponse repliée » ; « « Répondre à Code reviewer » et « Ouvrir sa conversation » » |
| 5 | dossier relu intact | relecteur en lecture seule | unitaire-main | `children-review.test.ts` | partiel : `src/main/conversations/children-review.test.ts` › « un relecteur qui écrit dans le dossier est signalé ; un relecteur muet aussi » |
| 6 | clic `fichier:ligne` : vue Git, remarque sous sa ligne, gravité | | composant | `WorkReview.test.tsx` + `ChangesTab.test.tsx` | `WorkReview.test.tsx` › « un clic sur `fichier:ligne` et « Voir sur le diff » ouvrent la vue Git de la conversation relue » ; `ChangesTab.test.tsx` › « remarques de diff : celles qui relisent cette conversation, pas un travail relu dans son fil » |
| 7 | la ligne mise en avant, à l'écran | | composant | `ChangesTab.test.tsx` | `ChangesTab.test.tsx` › « sa ligne, si le diff la contient : amenée à l'écran et mise en avant ; sinon le fichier ouvert » |
| 8 | remarques du diff dans la largeur visible | pas de débordement horizontal | capture | capture nocturne `177-4-remarque-sur-le-diff` | non |
| 9 | corriger : message nommant le relecteur ; transmise | | composant | `WorkReview.test.tsx` | `WorkReview.test.tsx` › « « Demander à OpenCode de corriger » : message qui nomme le relecteur, sa réponse visée à part » ; « transmise : plus de « corriger » ; « Voir sur le diff » reste » |
| 10 | relecteur : la demande, consigne repliée | | composant | `RoleWork.test.tsx` | `RoleWork.test.tsx` › « premier message : la demande seule, la consigne du rôle repliée sous « Consigne du rôle » » |

**Verdict** : supprimable entièrement — le lancement de bout en bout est déjà dans `parcours-matinee` ; y ajouter au besoin le clic `fichier:ligne` sur le vrai diff (#6) ; #8 en capture.
<!-- stats suite=relecture total=10 parcours=0 composant=8 unitaire-main=1 capture=1 doublon=0 couvert=9 verdict=supprimable -->

### `sommaire.mjs` — sommaire de 80 messages : hauteur bornée, regroupement des traits, trait courant qui suit le défilement.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | colonne de traits dans sa hauteur max | 30 % du fil, 240 px au plus | composant | `outline-layout.test.ts` | `outline-layout.test.ts` › « hauteur maximale : 30 % du fil, 240 px au plus » |
| 2 | 80 messages, 20 à 79 traits | regroupement | composant | idem | `outline-layout.test.ts` › « beaucoup : un trait pour plusieurs messages, tous couverts une fois, dans la hauteur » |
| 3 | la liste au survol garde les 80 messages | | composant | `ConversationOutline.test.tsx` (à créer) | non |
| 4 | en bas : le dernier trait est le courant | dépend de la position réelle de défilement | parcours | `parcours-longue` étape « le sommaire, et retour à un ancien message » | non |
| 5 | en haut : le premier trait est le courant | | parcours | idem | non |
| 6 | au 41ᵉ message : le trait courant le couvre | | parcours | idem | non |
| 7 | la liste s'ouvre sur le message lu | élément courant visible dans la liste | capture | capture nocturne `173-sommaire-liste` | non |
| 8 | fenêtre basse : la colonne raccourcit | | composant | `outline-layout.test.ts` | partiel : `outline-layout.test.ts` › « hauteur maximale : 30 % du fil, 240 px au plus » |

**Verdict** : à réduire (garder 3 vérifs : #4–#6, trait courant qui suit le vrai défilement) — à fusionner dans `parcours-longue` (qui n'a que 36 messages : il faudrait assez de messages pour regrouper les traits).
<!-- stats suite=sommaire total=8 parcours=3 composant=4 unitaire-main=0 capture=1 doublon=0 couvert=3 verdict=reduire -->

### `tables.mjs` — rendu Markdown : tableaux, mise en forme riche, blocs de code colorés par la palette.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | alignements Markdown respectés, gauche par défaut | `text-align` des `th` (attribut/style en ligne) | composant | `Markdown.test.tsx` (à compléter) | partiel : `Markdown.test.tsx` › « tableaux dans un cadre qui défile, blocs de code avec un bouton « Copier » » |
| 2 | pas de grille : lignes horizontales seules | bordures CSS | capture | capture nocturne `h0-tableaux` | non |
| 3 | tableau large : reste dans le fil, défile | largeur réelle | capture | capture nocturne | partiel : `Markdown.test.tsx` (même test que 1, cadre présent) |
| 4 | police du fil : celle de l'app | | capture | capture nocturne `h1-mise-en-forme` | non |
| 5 | titres proportionnés au texte | | capture | idem | non |
| 6 | trait « --- » fin | | capture | idem | non |
| 7 | citation : filet à gauche | | capture | idem | non |
| 8 | cases à cocher sans puce en plus | | capture | idem | partiel : `Markdown.test.tsx` › « GFM : listes de tâches et texte barré » |
| 9 | blocs de code : fond et coloration de la palette | | capture | capture nocturne `h2-code` | partiel : `src/shared/themes.test.ts` › « variables CSS : noms en kebab, coloration et ANSI » |
| 10 | blocs de code dans l'autre variante : ses couleurs | | capture | capture nocturne `h2-code-<variante>` | partiel : themes.test (même test que 9) |

**Verdict** : supprimable entièrement — que du rendu visuel (captures nocturnes) et un alignement vérifiable en composant.
<!-- stats suite=tables total=10 parcours=0 composant=1 unitaire-main=0 capture=9 doublon=0 couvert=5 verdict=supprimable -->

### `touches.mjs` — petites touches : copier, heure, accent, largeur du fil, mode de nouvelle conversation, archiver, confirmation avant de quitter.

| # | Vérification (libellé court) | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | copier un bloc de code : le presse-papiers | texte du bloc copié | composant | `CopyButton.test.tsx` (à créer) / `Markdown.test.tsx` | partiel : `Markdown.test.tsx` › « tableaux dans un cadre qui défile, blocs de code avec un bouton « Copier » » |
| 2 | copier la réponse : le Markdown complet | source Markdown, pas le texte rendu | composant | `TurnFooter.test.tsx` / `CopyButton.test.tsx` | partiel : `ThreadExtras.test.tsx` › « durée du tour sous sa dernière réponse, copie du message envoyé » |
| 3 | heure du message et de la réponse | `.msg-time` au format HH:MM | composant | `Transcript.test.tsx` (à compléter) | non |
| 4 | couleur d'accent bleu appliquée | | composant | `SettingsDialog.test.tsx` + `themes.test.ts` | `SettingsDialog.test.tsx` › « huit thèmes, six accents : chaque choix part dans les préférences ; Aurore « Nouveau » » ; `themes.test.ts` › « les accents sont ceux des préférences » |
| 5 | largeur du fil : large (960px) | `--column-width` | composant | `appearance.test.ts` (à compléter) | non |
| 6 | nouvelle conversation : démarre en mode Plan | réglage → mode imposé à la session | unitaire-main | `manager.test.ts` | `src/main/conversations/manager.test.ts` › « réglages d'une nouvelle conversation : agent, dossier et mode imposés » |
| 7 | archivée : hors « Récents », dans « Archivées », repliée, sans compteur | | composant | `Sidebar.test.tsx` | `Sidebar.test.tsx` › « dans l'ordre : Épinglées, Récents, Archivées (repliée) ; vides absentes » |
| 8 | quitter pendant une réponse : confirmation, « Annuler » garde l'app | | unitaire-main | `quit-guard.test.ts` | `src/main/quit-guard.test.ts` › « un agent travaille : question ; « Annuler » garde l'app, « Quitter » redemande de quitter » |

**Verdict** : supprimable entièrement — le chemin « Quitter » réel est déjà dans `reprise.mjs` et les journées types ; le reste en composants (créer `CopyButton.test.tsx`).
<!-- stats suite=touches total=8 parcours=0 composant=6 unitaire-main=2 capture=0 doublon=0 couvert=6 verdict=supprimable -->

#### Risques repérés (lot 5)

- **Presse-papiers réel** (`touches` #1–2) : un test de composant simule `navigator.clipboard` ; il ne verrait pas une écriture refusée par Electron ou un texte différent dans le presse-papiers du système. `aide.mjs` et `finitions.mjs` touchent aussi au bouton de copie : garder au moins une copie relue par le main dans une journée type.
- **Glisser-déposer natif** (`attachments` #8) : le chemin vient de `webUtils.getPathForFile` (preload) ; jsdom ne donne pas de chemin. Une régression du preload ou du `sandbox` casserait le dépôt sans qu'aucun test de composant ne le voie.
- **Câblage des notifications** (`notifications` #1, #10, #14) : `attention.ts` est bien couvert, mais `system-notifier.ts` (construction de `Notification`, `click`, `failed`) n'a aucun test. Garder ces trois vérifs ou ajouter un test unitaire de `system-notifier.ts` avec Electron simulé.
- **Menu natif ↔ renderer** (`presentation` #9, #13) : `menu.test.ts` vérifie le gabarit, pas la mise à jour du menu quand le renderer change l'état.
- **Serveur MCP de l'app** (`questions` #14–15) : `ask_user` parcourt agent → MCP du main → carte → réponse → résultat d'outil ; seul un e2e le voit en entier.
- **Vrai FS dans l'espace Discussion** (`discussion` #4, #13, #14) : lien physique, refus d'écriture et copie sont testés côté main, mais pas l'ensemble décision du main → carte → clic → fichier intact.
- **Mise en page** (`pinned-plan` #1/#6, `sommaire` #4–7, `relecture` #8, `activity` #14, `presentation` densité, `tables`) : jsdom ne calcule ni positions ni styles des feuilles. Si les captures nocturnes ne sont pas comparées automatiquement, ces régressions (liste qui recouvre la flèche, remarque qui déborde du diff, trait courant faux) ne seront plus vues.
- **Trait courant du sommaire** : `outline-layout.test.ts` couvre le regroupement, pas le choix du trait courant d'après le défilement réel ; `parcours-longue` (36 messages) ne déclenche sans doute pas le regroupement. Il faut l'agrandir ou garder `sommaire.mjs` réduite.
- **Polices du système** (`fun` #3) : la liste vient d'AppKit (macOS) ou de fontconfig (Linux) ; aucun test unitaire ne lit les vraies polices. À déplacer dans `polices.mjs`, pas à supprimer.
- **Libellés d'outil pendant la diffusion** (`activity`) : les tests unitaires partent d'items figés ; l'enchaînement réel `pending` → `in_progress` (locations qui arrivent plus tard) n'est vu qu'en e2e. Risque faible, puisque `tool-label` est pur.

---


---

## Remplaçants des Réglages (2026-11-24)

Les lignes du périmètre Réglages disent maintenant « **oui, remplaçant créé** » avec le test exact
(`R/` = `src/renderer/src/`, `M/` = `src/main/`). Récapitulatif (fichiers créés, ce qui reste e2e,
ce qui est hors périmètre) : fin de `inventaire-e2e-A.md`, section « Remplaçants des Réglages ».
