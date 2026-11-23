# 275 — Agent qui ne joint pas son modèle (proxy injoignable, réseau coupé)

- **Statut** : en cours (correctif main fait ; textes nouveaux en attente de la maquette)
- **Dépend de** : 194 (bandeau de silence), 142 (bandeau de reprise réseau), 104 (réseau
  d'entreprise)
- **Agents** : les deux pour le correctif (le silence se mesure sur ce que l'agent envoie, rien de
  propre à un agent) ; la proposition A lirait un format propre à OpenCode, déclaré dans son profil
  (ADR-0011)

## Pourquoi

Recette du 2026-11-23 : Réglages › Agents › Avancé › Proxy = `http://proxy.exem21ple.test:3128`
(hôte inexistant), OpenCode lancé, un message envoyé → le tour reste sur « Réfléchit… » 6 min 43 s
**sans aucun signe** : ni bandeau de silence, ni ligne « n'a rien envoyé » au journal. L'utilisateur
n'a aucune piste ; proxy vidé et agent relancé, le même message répond en 14 s.

## Relevé réel (OpenCode 2.3.0, 2026-11-23)

`opencode acp` dans un `HOME` et des `XDG_*` jetables, `opencode/big-pickle`,
`HTTPS_PROXY=HTTP_PROXY=http://proxy.exem21ple.test:3128`, `NO_PROXY=localhost,127.0.0.1` ; même
script sans proxy : réponse en 2,5 s.

- `initialize`, `session/new`, `set_config_option` répondent normalement (rien ne passe par le
  réseau).
- `session/prompt` : **ni erreur, ni contenu**. OpenCode réessaie sans fin et ne le dit que par des
  `session_info_update` : `_meta["opencode/retry"]` à `null`, puis
  `{ attempt, nextRetryAt, error: { type: "provider.transport", message: "Can't reach opencode.ai.
  Check the network connection. (getaddrinfo ENOTFOUND proxy.exem21ple.test)" } }`.
- Rythme : tentatives 2 à 9 à 1, 3, 7, 14, 31, 57, 87, 117 s (attente doublée, plafonnée à 30 s),
  sans fin observée en 7 min ; `session/cancel` arrête le tour.

## Cause

Le garde-fou de silence (fiche 194) comptait **tout octet reçu** comme une activité
(`agent-process.ts`, `onActivity` à chaque morceau de la sortie de l'agent). Les états de reprise
d'OpenCode, au plus toutes les 30 s, le remettaient à zéro bien avant 5 min : ni bandeau, ni ligne
au journal (premier avertissement à 1 min de silence).

## Critères d'acceptation

- [x] Une mise à jour d'état seule (`session_info_update`, `usage_update`,
      `available_commands_update`, `current_mode_update`, `config_option_update`) n'interrompt
      plus le silence ; texte, réflexion, outil, plan, demandes et réponses, si. Générique.
- [x] Le silence se compte au plus tôt depuis le début du tour (un agent resté prêt longtemps
      n'affiche pas le bandeau au premier contrôle).
- [x] Journal : « n'a rien envoyé depuis … (mises à jour d'état seules, la dernière il y a …) ».
- [x] Agent factice : `reseau-injoignable-2-3` (états de reprise d'OpenCode sans fin, jamais de
      contenu) ; unitaires (`agent-progress`, `silence-watch`, `agent-host-silence`), e2e
      `pannes-visibles` (bandeau, puis « Arrêter »).
- [ ] Textes : piste réseau / proxy (maquette `docs/maquettes/proxy-silence.html`, à valider).

## Plan

1. Fait, main seul, sans texte nouveau : `agent-progress.ts` (lignes reçues, mises à jour d'état
   seules reconnues sans analyse JSON), `AgentActivity` dans `silence-watch.ts` (dernière ligne,
   dernière avancée), plancher au début du tour ; scénario d'agent factice, essais.
2. Après validation de la maquette : proposition A (adaptateur du profil d'OpenCode pour
   `_meta["opencode/retry"]` → état générique « l'agent réessaie », bandeau de la famille de la
   fiche 142, `specificItems`, `docs/agents.md`) et/ou B (piste proxy dans le bandeau de silence
   quand un proxy est défini) ; clés i18n fr/en.

## Journal

- 2026-11-23 : relevé réel d'OpenCode 2.3.0 derrière un proxy injoignable (ci-dessus) ; correctif
  du critère de silence, scénario `reseau-injoignable-2-3`, essais ; maquette des textes.
  `./scripts/verify` vert ; `pnpm e2e pannes-visibles` vert (clair et sombre). Suite complète non
  lancée (fichier partagé par toutes les suites : `agent-process.ts`) : à faire avant fusion.
