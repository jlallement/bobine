# 276 — Seconde chasse rc.4 : ce qui change à l'écran

- **Statut** : fait (à relire ; e2e complètes à passer sur GitHub)
- **Dépend de** : 275 (agent injoignable), 194 (bandeau de silence), 104 (réseau d'entreprise),
  092 (repli de la barre de saisie), 178 (tâches planifiées), 207 (onglet Session), 224 (espace
  Discussion), 034 (terminal)
- **Agents** : les deux — rien de propre à un agent : les réglages réseau changés se mesurent sur
  l'environnement de l'agent lancé (comme la piste du proxy, fiche 275), le reste est de
  l'interface

## Pourquoi

Seconde chasse du 2026-11-23 avant la 1.0.0-rc.4 (profil temporaire, agent factice). Sept points
changent l'affichage ; maquettes `docs/maquettes/rc4-chasse2.html` (captures « avant » dans
`docs/maquettes/rc4-chasse2/`), **variantes recommandées validées par l'utilisateur le
2026-11-23**, avec une décision en plus : après « Relancer l'agent » pendant une réponse, le
dernier message est **remis dans la saisie, sans être envoyé**.

- **T4** : après « Réglages réseau » et la saisie d'un proxy, le bandeau de l'agent en cours dit
  encore « renseignez-le dans Réglages » ; rien ne dit qu'il faut relancer l'agent.
- **T5** : bandeau de silence haut de huit lignes (trois boutons à droite écrasent le texte) ;
  adresse du proxy coupée en « http:// » / « •••@proxy… ».
- **T13** : « Écrit… · 5 min 05 » juste au-dessus de « L'agent n'a rien envoyé depuis 5 min ».
- **T10** : textes tronqués — en-tête d'une fille « Import … » et « depuis « Pr… » » à cause de
  la pastille du profil temporaire ; panneau Session « 2 fichiers non co… » ; saisie à 560 px,
  modèle « Fac… ».
- **T8** : clic droit sur une conversation de la barre latérale : un mot sélectionné et le menu
  natif « Copier », au lieu du menu ⋯.
- **T12** : « Nouvelle tâche » (Tâches planifiées) ne propose pas le dossier du projet courant.
- **T14** : terminal intégré, texte collé au bord gauche ; espace Discussion, panneau
  Modifications « Aucune modification depuis le dernier commit » (git hors d'un projet).

## Critères d'acceptation

- [x] T4 : réglages réseau des agents (proxy, sans-proxy, certificats) différents de ceux de
      l'agent lancé → les bandeaux « injoignable » et de silence le disent, « Relancer l'agent »
      (bouton principal) remplace « Réglages réseau » ; un clic relance l'agent et remet le
      message du tour dans la saisie, sans l'envoyer. Enregistrer les réglages redit le bandeau
      affiché, sans attendre.
- [x] T5 : boutons sous le texte, alignés sur lui ; adresse du proxy d'une seule pièce avec ses
      parenthèses, « … » si besoin, entière en infobulle.
- [x] T13 : pendant le silence, l'indicateur dit « Réponse en cours » et la durée du tour, bobine
      immobile ; le verbe revient quand l'agent reparle.
- [x] T10 : la pastille du profil temporaire cède avant le titre (fiole seule dans un en-tête
      étroit, texte en infobulle et pour les lecteurs d'écran) ; Session › Modifications passe à
      la ligne au lieu de couper ; saisie à 560 px : voir le journal.
- [x] T8 : clic droit sur une ligne = le menu ⋯ (mêmes éléments, même ordre), au pointeur ; pas de
      sélection de texte dans les lignes.
- [x] T12 : nouvelle tâche : dossier de la conversation ouverte (racine du dépôt d'un worktree)
      prérempli, sinon le plus récent ; « Changer… » : dossiers récents puis « Autre dossier… ».
- [x] T14 : terminal mesuré dans l'app avant de corriger ; Discussion : une seule vue,
      « L'agent n'a encore modifié aucun document de cette discussion. »
- [x] Testé : unitaires (logique) ; e2e ciblées clair/sombre et `--lang en` (suite complète : GitHub, `e2e.yml`).

## Plan

- Main : `agentNetwork` / `sameNetwork` / `NetworkSource` (`agent-config/network-env.ts`) ;
  `TurnQuiet.launch` (réseau au lancement, réseau d'un lancement maintenant) → `networkStale` dans
  l'instantané (`shared/agent.ts`), seulement avec un bandeau ; `AgentHost.networkNow` (option,
  `SettingsStore.networkEnv` et `onChange`) ; `setNetwork` prévient les abonnés des réglages.
- Renderer : `SilenceBanner`, `AgentUnreachableBanner`, `TurnFooter` (relance, `lastUserText`,
  `ComposerInbox.prefill`), `WorkingIndicator` (`silent`), `network-hint.tsx`,
  `silence-banner.css` ; `HistoryItem` (clic droit) ; `TaskForm` / `FolderChooser` /
  `task-folder.ts` ; `ChangesTab` (`discussion`) ; `TemporaryProfileChip`, `SessionChanges`.
- Textes fr/en (glossaire : « relancer (l'agent) » → « restart » ; « documents » dans une
  discussion). Aucune dépendance nouvelle.

## Journal

- 2026-11-23 : maquettes (`docs/maquettes/rc4-chasse2.html`), validées le jour même.
- 2026-11-23 : implémenté (variantes recommandées). Écarts et constats :
  - **T4** : au lieu d'un appel du main vers chaque hôte (le gestionnaire des conversations et
    l'hôte d'agent sont à leur plafond de lignes), `TurnQuiet` écoute les réglages (`onChange`)
    **seulement pendant qu'un bandeau est affiché**, et le redit quand ils changent ; `setNetwork`
    prévient désormais les abonnés des réglages (avant : enregistré sans prévenir). Le message
    remis dans la saisie est le texte du dernier message de l'utilisateur (ni réveil d'une fille,
    ni compaction) ; ses pièces jointes ne sont pas remises.
  - **T10, saisie** : nouveau niveau de repli 4 (`OPTIONS_FOLD`) : les réglages de la session
    deviennent un sous-menu « Réglages de la session » du menu 📎 (libellé existant, pas
    « Options de l'agent… » de la maquette), avant que le modèle ne soit coupé ; deux lignes passe
    au niveau 5. Le bouton reste dans la page, caché par le CSS, pour que la mesure du repli le
    voie. Mesuré à 560 px (barre latérale ouverte, barre de 270 px) : « Factice r… » (108 px) au
    lieu de « Fac… » ; **pas en entier** comme le promettait la maquette (il manque ≈ 12 px).
  - **T10, en-tête** : `.main-header` devient un conteneur (`container: main-header`) ; pastille
    en fiole seule sous 760 px, et `flex-shrink` qui la fait céder avant le titre au-dessus.
    `TitleOrigin` (« depuis… » d'une fille ou d'une branche) sort d'`App.tsx` (plafond de lignes).
  - **T10, Session** : « Une ligne, coupée au besoin » (fiche 272) remplacé par le passage à la
    ligne, totaux insécables à la suite.
  - **T14, terminal** : mesuré dans l'app (`.terminal-host` 10 px à gauche, `.terminal-instance`
    au même endroit). Vraie cause : xterm.js donne la classe `terminal` à son élément, qui prenait
    le style `.terminal` de la sortie des commandes du fil (fiche 018 : bordure, rayon 12 px, sans
    marge intérieure) : un cadre arrondi dessiné autour du texte, collé à lui. Règle limitée à
    `.terminal:not(.xterm)`, et marge du terminal à 12 px de côté, 8 px en haut et en bas.
  - **T14, Discussion** : l'état git n'est plus lu dans une discussion ; une seule vue
    (Conversation), texte vide propre aux documents.
  - **Essais** : unitaires (réseau changé depuis le lancement, abonnement tenu seulement pendant un
    bandeau, `setNetwork` qui prévient ; `lastUserText` et message remis sans envoi ; adresse
    insécable ; dossier prérempli ; clic droit = menu ⋯ ; vue Discussion ; repli des réglages
    avant le modèle). E2e en local, sous verrou, avant la fusion de `main` : `composer
    fresh-start scheduled panel session terminal changes history discussion pannes-visibles
    historique-saisie`, clair et sombre, fr (vert après correction de la comparaison du texte
    avec élision « d’Agent factice ») et `--lang en` (vert). Vérifications ajoutées : relance et
    message remis (`pannes-visibles`), « Réponse en cours » et boutons sous le texte, adresse
    d'une seule pièce ; clic droit au pointeur sans sélection (`history`) ; dossier prérempli
    (`scheduled`) ; ni vue Git ni « dernier commit » en Discussion (`discussion`) ; marge du
    terminal (`terminal`) ; fiole seule dans un en-tête étroit (`fresh-start`) ; réglages sous 📎
    à 640 px (`composer`, niveaux 4 et 5). Après fusion de `main` : `./scripts/verify` vert ; la
    suite complète (`--changed` touche toutes les suites : `styles.css`) passe sur GitHub.
  - Captures après (e2e locales) : `scratchpad/apres-chasse2/`.

- 2026-11-23 : régressions vues sur GitHub (run 45245467579, `rc4/candidat`), corrigées sur
  `fix/regressions-rc4` :
  - **composer (Linux)** : régression de l'app. Le niveau 4 faisait de 📎 un menu même sans
    capture d'écran, contre le contrat de la fiche 145 (sans capture, 📎 reste « Joindre des
    fichiers… »). Désormais les réglages de la session ne passent sous 📎 qu'avec la capture ;
    sans elle, ils gardent leur bouton (`data-no-capture` sur la barre). `AttachButton.test.tsx`
    rouge avant, vert après. Essai : réglages sous 📎 vérifiés seulement avec la capture.
  - **roles-travail** : pas une régression de l'app. L'essai créait une fausse pastille « Profil
    temporaire » pour manquer de place, en comptant qu'elle ne se raccourcit pas ; elle cède
    désormais d'abord (T10, validé), donc le badge du rôle n'avait plus à se réduire. Le badge
    se réduit toujours quand la place manque une fois la pastille réduite à sa fiole (mesure du
    débordement inchangée). L'essai manque de place avec un élément de 260 px qui ne cède pas.
  - **auth (macOS)** : lié à T14. La marge de 12 px à droite ôtait une colonne au terminal ; la
    commande attendue passait à la ligne au milieu (« touch .mock-agent » / « -logged-in »,
    endroit qui dépend du nom de la machine dans l'invite). Marge droite revenue à 4 px (largeur
    du texte comme avant), et l'essai lit les lignes bout à bout.
  - **browser-view (macOS, clair)** : indépendant (rien de touché à la vue du navigateur, sombre
    vert) ; instable : molette envoyée à la page native, `scrollY` resté à 0 (même famille que le
    défilement doux noté dans l'essai).
