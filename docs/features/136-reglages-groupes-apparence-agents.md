# 136 — Réglages en trois groupes, page Apparence, pages d'agent

- **Statut** : fait (reste l'essai à la vraie souris, par la session de coordination)
- **Dépend de** : 027 (réglages), 051 (recherche dans les réglages), 054 (capacités des agents), 070
  (police des réponses), 104 (fournisseurs, réseau), 133 (corrections, journal), 134 (jetons de
  thème)
- **Agents** : les deux. Rien ne dépend de l'agent : les pages d'agent sont tirées du profil
  (clés d'API, fournisseurs, `specificItems`), ADR-0011.
- **Reprend** : lots 143 (« Réglages en trois groupes et section Apparence ») et 144 (« Pages
  d'agent ») de l'étude du 23 octobre (`docs/feuille-de-route-2026-10-23.md`, itération 5).

## Pourquoi

Les réglages ont grandi par ajouts : « Agents et dossiers » empile onze sections (quatre écrans),
« Général » aligne treize réglages sans titre, « Terminal » n'en a que deux, l'apparence est
répartie entre trois onglets et le navigateur entre deux. Sépia et Nuit noire excluent « Système »,
la police du code se choisit dans une liste figée de quatre noms et celle du terminal se tape à la
main. On range tout en trois groupes, avec un gabarit commun (titres, cartes), une page Apparence
complète et une page par agent.

## Maquettes validées

Planche « Maquettes de Bobine » (maquette privée, non publiée), section
« Réglages » : `reglages-1-notifications`, `reglages-2-apparence`, `reglages-3-agents`,
`reglages-4-agent-opencode`, validées par Jérôme le 23/10 (« ok, j'aime bien » ; « on a quand même
le choix de la police ? » ; « non » à la fusion des polices du code et du terminal). L'onglet
« Consommation » de la planche est la fiche 137 : ici, 12 onglets.

## Critères d'acceptation

- [x] Colonne de gauche : trois groupes séparés par un espace, sans titre — Général, Apparence,
      Notifications, Raccourcis clavier / Conversations, Agents, Serveurs MCP, Commandes /
      Confidentialité, Données, Diagnostic, Nouveautés.
- [x] Identifiants : `general`, `appearance`, `notifications`, `shortcuts`, `conversation`,
      `agents`, `mcp`, `commands`, `privacy`, `data`, `diagnostics`, `about` (« Nouveautés ») ;
      `terminal` retiré ; liens directs et `data-testid` à jour.
- [x] Gabarit : titre de section (`h3` 12,5 px atténué) puis carte arrondie aux lignes séparées
      par des filets ; un réglage dépendant est en retrait de 16 px sous son parent (seul retrait) ;
      aperçus en tête de carte ; « Avancé » replié en bas de page.
- [x] Chaque réglage existant est à sa nouvelle place (tableau ci-dessous).
- [x] Apparence : aperçu (réponse, code, terminal) qui suit les réglages ; Mode (Système, Clair,
      Sombre), Thème clair (Clair, Sépia), Thème sombre (Sombre, Nuit noire) ; accent parmi six
      teintes (orange, bleu, violet, rose, vert, graphite) ou « Comme le Mac » (teinte la plus proche
      de l'accent de macOS, suivie à chaque changement) ; police, taille des réponses, largeur du
      fil ; police et taille du code, police et taille du terminal, séparées.
- [x] Polices : lues une fois par le main (JXA, `NSFontManager`), mises en cache, canal IPC
      `app:fonts` (émetteur vérifié) ; liste vide hors macOS ou en cas d'échec.
- [x] Toute nouvelle teinte est dans `shared/themes.ts` ; le test de contrastes reste vert.
- [x] Préférences : clés existantes gardées ; `theme` devient le mode et deux clés s'ajoutent
      (`lightTheme`, `darkTheme`) ; l'ancien `sepia` / `black` est repris (test) ; anciens
      identifiants de police du code repris en noms de police (test).
- [x] Agents : une ligne par agent installé (avatar, nom, état, version, information courte) qui
      mène à sa page ; note « Non installés » avec un lien vers le Diagnostic ; réseau d'entreprise
      dans « Avancé », avec un résumé quand il est fermé.
- [x] Page d'agent, « ‹ Agents » pour revenir : en-tête (avatar, nom, état, version, commande,
      « Relancer » quand la conversation active l'utilise), Connexion (ses clés d'API), Fournisseurs
      de modèles si le profil en déclare, « Ce qu'il annonce », « Propre à X ». Aucun code propre à un
      agent dans l'interface.
- [x] Serveurs MCP : l'onglet « Bobine » devient « Outils de Bobine » ; les chemins des fichiers d'un
      agent passent dans une note repliée.
- [x] Recherche : chaque réglage retrouvé et amené à l'écran, même dans « Avancé » ou dans une page
      d'agent ; « Propre à X » et « Clé … X » ouvrent la bonne page ; le test « rien d'affiché ne manque
      à l'index » couvre toutes les sections et les pages d'agent.
- [x] Aides : une phrase de 90 caractères au plus, sans variable d'environnement ; un lien plutôt
      qu'un renvoi « (Réglages › X) ».
- [x] Plafonds ESLint respectés sans exception nouvelle.
- [x] e2e touchées (clair, sombre ; `settings` en anglais) vertes, captures regardées et comparées
      aux maquettes.
- [x] ESSAI (fait à la fin des vagues) : voir « À vérifier à la souris ».

## Avant → après

| Réglage | Avant | Après |
|---|---|---|
| Votre prénom | Général | Général › Vous |
| Langue | Général | Général › Vous |
| Thème (5 choix) | Général | Apparence › Interface : Mode, Thème clair, Thème sombre |
| Couleur d'accent (4 teintes) | Général | Apparence › Interface (6 teintes + « Comme le Mac ») |
| Empêcher la mise en veille | Général | Général › Mac |
| Fenêtre rapide | Général | Général › Mac |
| Garder les cookies du navigateur | Général | Confidentialité › Navigateur intégré |
| Données du navigateur (Effacer) | Général | Confidentialité › Navigateur intégré |
| Notifications (+ note « bloquées ») | Général | Notifications (bandeau en tête, carte « Quand un agent a fini ou attend ») |
| Rebond du Dock, Compteur du Dock | Général | Notifications, en retrait sous « Notifications » |
| Son quand un agent attend | Général | Notifications › Son |
| Sauvegarde de l'historique | Général | Données |
| Police des réponses (Sans serif / Serif) | Conversation | Apparence › Fil (liste : Système, Serif, polices installées) |
| Police du code (5 noms) | Conversation | Apparence › Code et terminal (polices à chasse fixe installées) |
| — | — | Apparence › Taille du code (nouveau) |
| Largeur du fil | Conversation | Apparence › Fil |
| Taille du texte (réponses) | Conversation | Apparence › Fil « Taille des réponses » |
| Aperçu des réponses | Conversation | Apparence, en tête (réponse, code, terminal) |
| Conversations gardées actives | Conversation | Conversations › Avancé |
| Conversations filles en cours | Conversation | Conversations › Sous-tâches |
| Proposer des conversations filles | Conversation | Conversations › Sous-tâches |
| Police du terminal (saisie libre) | Terminal | Apparence › Code et terminal (liste) |
| Taille du terminal | Terminal | Apparence › Code et terminal |
| Nouvelle conversation (agent, dossier, mode) | Agents et dossiers | Conversations › Nouvelle conversation |
| Liste des agents (dépliable) | Agents et dossiers | Agents (une ligne, page par agent) |
| Non installés | Agents et dossiers | Agents (note, lien « Voir le Diagnostic ») |
| Clés d'API (toutes) | Agents et dossiers | Page de l'agent › Connexion |
| Fournisseurs de modèles | Agents et dossiers | Page de l'agent › Fournisseurs de modèles |
| Ce qu'il annonce, Propre à X | Agents et dossiers (dépliés) | Page de l'agent |
| Réseau d'entreprise (proxy, sans proxy, certificats) | Agents et dossiers | Agents › Avancé |
| Outils, sites, commandes toujours autorisés | Agents et dossiers | Confidentialité › Autorisé sans demander (commandes par dossier) |
| Dossiers récents | Agents et dossiers | Données |
| Worktrees orphelins | Agents et dossiers | Données |
| Serveurs MCP, onglet « Bobine » | Serveurs MCP | Serveurs MCP, onglet « Outils de Bobine » |
| Commandes | Commandes | Commandes |
| Raccourcis clavier | Raccourcis clavier | Raccourcis clavier |
| Diagnostic (journal en tête) | Diagnostic | Diagnostic (inchangé) |
| À propos (phrase + nouveautés) | À propos | Nouveautés (en-tête de Bobine, puis une ligne par version ; voir le journal du 24/10) |

## Plan

**Préférences et thème (shared, main)**
- `shared/preferences.ts` : `ThemePreference` = `system | light | dark` (le mode) ;
  `lightTheme: 'light' | 'sepia'`, `darkTheme: 'dark' | 'black'` ; reprise de `sepia` / `black` dans
  `parsePreferences` ; `AccentColor` à six teintes (`orange`, `blue`, `violet`, `pink`, `green`,
  `graphite`) et `accent` peut valoir `system` ; `conversationFont` : `sans`, `serif` ou un nom de
  police ; `codeFont` : `system` ou un nom de police (anciens identifiants repris) ; `codeFontSize`
  (nouveau) ; noms de police vérifiés (pas de guillemet, point-virgule, accolade…).
- `shared/themes.ts` : teintes `pink` et `graphite` dans les quatre palettes ; `paletteOf` et
  `windowBackground` lisent le thème clair et le thème sombre ; `nearestAccent(hex)` (accent du Mac).
  `scripts/themes-css.mts` : Sépia sous `prefers-color-scheme: light` et `[data-light-theme]`, Nuit
  noire sous `dark` et `[data-dark-theme]` (« Système » garde le thème choisi pour chaque mode).
- `main/fonts.ts` (nouveau) : polices installées et à chasse fixe par `osascript -l JavaScript`
  (`NSFontManager`, `isFixedPitch`), une fois, en cache ; vide hors macOS ou en échec. Canal
  `app:fonts` dans `app-ipc.ts`.
- `main/index.ts` : accent du Mac (`systemPreferences.getAccentColor`, `accent-color-changed`) →
  `AgentSettingsView.systemAccent` ; `renderer-windows.ts` : fond des fenêtres selon les deux thèmes.
- `ProfileSummary` : `command` (affichée) et `providers` (le profil en déclare), tirés du profil.

**Renderer**
- `appearance.ts` : `data-light-theme`, `data-dark-theme`, accent résolu, polices (`--conv-font`,
  `--font-code`, `--code-size`, échappées) ; `theme.ts` suit ces attributs.
- `settings-search.ts` : 12 sections en trois groupes (`SETTINGS_GROUPS`), `INDEX` refait, entrées
  d'agent (`agentEntries`) avec `page` (Connexion, chaque clé, Fournisseurs, Ce qu'il annonce,
  Propre à X et ses éléments).
- `settings/rows.tsx` : `SettingsCard`, `SettingsTitle`, `Row` avec `sub` (retrait), `Advanced`.
- Pages : `GeneralSettings`, `AppearanceSettings` (+ `AppearancePreview`, `FontSelect`, `useFonts`),
  `NotificationsSettings`, `ConversationSettings` (nouvelle conversation incluse), `AgentsSettings`
  (liste), `AgentPage`, `ApiKeys`, `PrivacySettings`, `DataSettings` ; `TerminalSettings` retiré ;
  `AboutSettings` réduit ; `NetworkSettings` dans « Avancé » avec résumé ; `McpSettings` (onglet,
  note repliée) ; `SettingsDialog` (groupes, page d'agent, « ‹ Agents », révélation dans une page).
- `styles.css` : cartes, titres, retrait, « Avancé », liste des agents, en-tête d'agent, aperçu,
  vignettes de thème ; `--code-size` pour les blocs, diffs et sorties.
- i18n : clés `settings.*` en français et en anglais, mots-clés de recherche.

**Tests** : `preferences.test.ts` (migration du thème et des polices), `themes.test.ts`
(contrastes des six teintes, `nearestAccent`, fond des fenêtres), `fonts.test.ts`, `app-ipc`
(`app:fonts`), `settings-search.test.ts`, `SettingsDialog.test.tsx` (index de toutes les sections et
des pages d'agent, page d'agent, recherche qui ouvre une page et déplie « Avancé »).

**e2e** : `settings`, `diagnostic`, `notifications`, `about`, `providers`, `permissions`, `mcp`,
`user-commands`, `terminal`, `fun`, `language`, `filles`, `inbox`, `startup`, plus celles qui citent
les anciens onglets (`touches`, `auth`, `worktree-cycle`).

Pas de nouvelle dépendance.

## Écarts aux maquettes

- **Ligne d'un agent** : état, version, puis la destination déclarée par le profil (« le service en
  ligne d'IBM Bob, facturé en bobcoins ») au lieu de « connecté par SSO » ou « 3 fournisseurs » ; le
  quota de bobcoins n'est pas repris à droite (il reste dans la barre de la conversation : une info
  à un seul endroit).
- **Fournisseurs de modèles** sur la page d'agent : la section de la fiche 104 telle quelle (liste en
  carte, mais le fichier, l'aide et « Ajouter un fournisseur » restent hors carte), pas les lignes
  « testé / non testé » à chevron de la maquette.
- **Police du terminal** : le premier choix est « Automatique » (une Nerd Font installée, sinon SF
  Mono), pas « SF Mono (système) » : on garde le comportement de la fiche 027 pour les invites à
  icônes. Une aide le dit.
- **Liste des polices** : une liste native (`<select>`, polices installées dans un groupe), pas le
  menu dessiné de la maquette où chaque nom est écrit dans sa police.
- **« Relancer »** n'apparaît que sur la page de l'agent de la conversation active (il relance
  celle-ci) ; sur les autres pages, rien à relancer.
- **Confidentialité, Données** (non maquettées) : même gabarit ; outils, sites et commandes dans une
  seule liste à groupes (« Commandes · dossier »).

## À vérifier à la souris

- Colonne de gauche : les trois groupes et leurs espaces, l'onglet actif, ⌘, qui ouvre sur Général.
- Apparence : chaque clic change l'aperçu tout de suite ; Mode Système puis bascule de macOS en
  sombre et en clair (Réglages Système) : le thème choisi pour chaque mode suit, sans éclair ;
  vignettes au clavier (Tab, Espace).
- Accent « Comme le Mac » : changer l'accent dans Réglages Système › Apparence (bleu, violet, rose,
  rouge, graphite) : Bobine suit sans relancer.
- Listes de polices : toutes les polices du Mac (une police fraîchement installée apparaît au
  lancement suivant) ; une police à chasse fixe pour le code, une autre pour le terminal, chacune
  appliquée (bloc de code, diff, sortie de commande ; onglet Terminal ouvert).
- Notifications : le bandeau quand macOS bloque (app non signée), son bouton qui ouvre les réglages
  du Mac ; rebond et compteur grisés quand les notifications sont coupées.
- Agents : clic sur une ligne, « ‹ Agents », Échap ; « Relancer » sur la page de l'agent de la
  conversation active ; une clé d'API saisie (trousseau) ; « Avancé » qui se déplie et son résumé.
- Recherche : « proxy » (déplie « Avancé »), « propre à », « clé » (ouvre la page de l'agent),
  « conversations gardées actives ».
- Fenêtre redimensionnée petite : en-tête fixe, cartes sans débordement, aides sur une ligne quand
  la place le permet.

## Journal

- 2026-10-24 : fiche créée, plan écrit.
- 2026-10-24 : fait. Douze onglets en trois groupes (`SETTINGS_GROUPS`), gabarit commun
  (`SettingsTitle`, `SettingsCard`, `Row sub`, `Advanced`), un composant par onglet
  (`SettingsBody.tsx`), page Apparence (`AppearanceSettings.tsx`, `AppearanceParts.tsx`), pages
  d'agent (`AgentPage.tsx`, `ApiKeys.tsx`), Confidentialité et Données (`PrivacySettings.tsx`,
  `DataSettings.tsx`), `TerminalSettings.tsx` retiré. Préférences : `theme` = mode, `lightTheme`,
  `darkTheme`, `codeFontSize` ; reprise de `sepia` / `black` et des anciens identifiants de police
  (`preferences.test.ts`). Jetons : teintes rose et graphite dans les quatre palettes (contrastes
  verts), `nearestAccent`, CSS de Sépia et Nuit noire conditionné au mode. Main : `fonts.ts`
  (`app:fonts`), `system-accent.ts`, fond des fenêtres selon le thème du mode. `ProfileSummary`
  gagne `command` et `providers`. Le Diagnostic ouvre la page de l'agent concerné.
  Écarts au plan : l'interrupteur des notifications prend le `data-testid`
  `settings-notifications-enabled` (l'onglet a pris `settings-notifications`) ; la table des
  raccourcis passe aussi en carte ; la suite `mcp` réduit la hauteur des réglages pour vérifier
  l'en-tête fixe (le formulaire tient désormais sans défiler). Pas de nouvelle dépendance.
  e2e (clair et sombre) : settings, diagnostic, notifications, about, providers, permissions, mcp,
  user-commands, terminal, fun, language, filles, inbox, startup, touches, auth, worktree-cycle,
  export, et settings en anglais. Captures regardées et comparées aux maquettes (écarts ci-dessus).
  `filles` a échoué une fois sur la passe en parallèle (« propositions en rafale », délai sous
  charge, fiche 112, sans lien avec les réglages) et passe rejouée seule, en clair et en sombre.
- 2026-10-24 — **Essai à la souris (fin des vagues), retouche demandée par Jérôme** : les trois
  lignes « Mode », « Thème clair », « Thème sombre » ne se comprenaient pas (deux lignes sans effet
  selon le mode). Remplacées par une seule ligne « Thème » de cinq vignettes : Système (moitié
  Clair, moitié Sombre ; suit le Mac en Clair et Sombre), Clair, Sépia, Sombre, Nuit noire
  (`THEME_CHOICES`, `themeChoiceOf`, `themeChoicePreferences`). Abandonné : Système avec Sépia ou
  Nuit noire. Le format enregistré ne change pas (`theme`, `lightTheme`, `darkTheme`). Accent
  « Comme le Mac » retiré sur sa demande, et tout ce qui le servait (`system-accent.ts`,
  `nearestAccent`, `AgentSettingsView.systemAccent`) ; un `accent: "system"` enregistré revient à
  l'orange. Maquette regardée avant de coder (`maq-apparence-theme`). Essais : unitaires, e2e
  `settings` et `fun` en clair et en sombre.
- 2026-10-24 — **Essai à la souris, Nouveautés** : la page n'était plus que le journal des versions
  déplié (plus de 500 lignes), sans l'identité de l'app. Rétablis : en-tête dans une carte (icône,
  nom, version, une phrase ; Electron et le système restent dans Diagnostic), puis une carte avec
  une ligne par version (`<details>`, date atténuée, chevron), la plus récente ouverte
  (`changelogVersions` dans `AboutSettings.tsx`). Maquette regardée avant de coder
  (`maq-nouveautes`). Essais : unitaires (versions, une seule ouverte, anglais), e2e `settings` et
  `about` en clair et en sombre.
