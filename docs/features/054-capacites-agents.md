# 054 — Ce que Bob Desktop sait faire avec chaque agent

- **Statut** : fait
- **Dépend de** : 022, 025, 039
- **Agents** : les deux (fondation des fonctions propres à un agent, ADR-0011)

## Pourquoi

Bob et OpenCode n'offrent pas les mêmes choses, et l'app a déjà des réglages propres à chacun :
compaction, fichiers MCP, connexion, licence, coût en bobcoins. Rien ne le montre aujourd'hui.
L'utilisateur veut que chaque choix propre à un agent soit fait en connaissance de cause, et bien
visible dans les réglages et la doc. C'est la fondation des fonctions propres à un agent à venir :
coût des sous-agents (fiche 053), limite de coût de Bob…

## Critères d'acceptation

- [x] Réglages › Agents et dossiers : chaque agent de la liste se déplie sur « Ce que Bob Desktop
      sait faire avec <agent> », en deux parties :
  - « Annoncé par l'agent » : sa version, et ce qu'il annonce au démarrage et que l'app utilise
    (reprise d'une conversation, suppression chez l'agent, images, fichiers joints, outils de
    l'app), oui ou non, avec ce que ça change ;
  - « Propre à <agent> » : ce que son profil sait de lui (coût en bobcoins, compaction, fichiers
    MCP, connexion, licence, confiance du dossier).
- [x] L'annonce du dernier démarrage est retenue d'un lancement de l'app à l'autre ; un agent jamais
      démarré le dit.
- [x] La partie « Propre à… » est tirée du profil : elle ne peut pas oublier un réglage déclaré.
- [x] `docs/agents.md` : matrice Bob / OpenCode, règle de l'ADR-0011. Un test vérifie que chaque
      repère « propre à » de Bob et d'OpenCode y figure.
- [x] `AGENTS.md` pointe vers la règle ; le modèle de fiche a un champ « Agents ».
- [x] La recherche des réglages trouve les capacités (« version », « capacités »…).
- [x] Testé contre l'agent factice (unitaire, réglages en jsdom, e2e avec captures clair/sombre).

## Plan

1. `shared/agent.ts` : `CapabilityItem`, `AgentCapabilitiesView` ; `ProfileSummary.capabilities`.
2. `main/agent/capabilities.ts` (nouveau) : `AgentAnnouncement` (annonce retenue), lecture de
   `initialize`, `describeCapabilities(profile, announcement)` qui construit les deux listes.
3. `agent-host.ts` : option `onAnnounced` appelée après `initialize`.
4. `settings.ts` : `agentsSeen` (annonce par profil), lue avec vérification.
5. `manager.ts` : retient l'annonce (enregistrée seulement si elle change), la passe à la vue des
   réglages ; `summarizeProfiles` y ajoute les capacités.
6. `SettingsDialog.tsx` + `styles.css` : lignes d'agent dépliables ; `settings-search.ts`.
7. Doc : `docs/agents.md` (nouveau), `AGENTS.md`, `_modele.md`, `architecture.md`, index.
8. Tests : `capabilities.test.ts` (dont le test de la matrice), réglages, `SettingsDialog.test`,
   e2e `settings`.

Pas de nouvelle dépendance.

## Journal

- 2026-10-14 — Fiche créée, après l'analyse Bob / OpenCode (ce qui est commun, propre à l'un ou à
  l'autre) ; règle validée par l'utilisateur (ADR-0011). Faite avant la 053, qui en est le premier
  usage.
- 2026-10-14 — Fait. `capabilities.ts` (+ tests, dont celui de la matrice), annonce retenue dans
  `settings.json` (`agentsSeen`, réécrite seulement si elle change), lignes dépliables dans
  Réglages › Agents, recherche « version », « capacités ». Annonces relevées à `initialize`, sans
  appel au modèle : Bob 2.0.6 (`HOME` jetable) et OpenCode 1.19.0, reportées dans `docs/agents.md`.
  e2e `settings` : fiche dépliée de l'agent factice, captures `84-agents` et `84-agents-propre`
  (clair / sombre).
