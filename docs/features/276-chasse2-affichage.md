# 276 — Seconde chasse rc.4 : ce qui change à l'écran

- **Statut** : en cours
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
- [ ] T14 : terminal mesuré dans l'app avant de corriger ; Discussion : une seule vue,
      « L'agent n'a encore modifié aucun document de cette discussion. »
- [ ] Testé : unitaires (logique) ; e2e touchées clair/sombre, et `--lang en`.

## Plan

- Main : `agentNetwork` / `sameNetwork` (`agent-config/network-env.ts`) ; `TurnQuiet.network`
  (réseau au lancement, réseau d'un lancement maintenant) → `networkStale` dans l'instantané
  (`shared/agent.ts`), seulement avec un bandeau ; `AgentHost.networkNow` (option, depuis
  `SettingsStore.networkEnv`) ; `networkController(…, changed)` → `ConversationManager.networkChanged`.
- Renderer : `SilenceBanner`, `AgentUnreachableBanner`, `TurnFooter` (relance, `lastUserText`,
  `ComposerInbox.prefill`), `WorkingIndicator` (`silent`), `network-hint.tsx`,
  `silence-banner.css` ; `HistoryItem` (clic droit) ; `TaskForm` / `FolderChooser` /
  `task-folder.ts` ; `ChangesTab` (`discussion`) ; `TemporaryProfileChip`, `SessionChanges`.
- Textes fr/en (glossaire : « relancer (l'agent) » → « restart » ; « documents » dans une
  discussion). Aucune dépendance nouvelle.

## Journal

- 2026-11-23 : maquettes (`docs/maquettes/rc4-chasse2.html`), validées le jour même.
