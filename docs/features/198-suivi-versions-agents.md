# 198 — Suivi des versions des agents

- **Statut** : fait
- **Dépend de** : 187 (lot F, risque R4), 140 (versions vérifiées), 078 (sonde d'OpenCode), 048
  (sonde de Bob)
- **Agents** : les deux, et l'agent factice. Rien de propre à un agent dans le code : tout vient
  des champs `testedVersions` et `minVersion` du profil (ADR-0011).

## Pourquoi

Une nouvelle version de Bob ou d'OpenCode pouvait casser en silence : une version jamais essayée
n'était signalée que dans Réglages › Diagnostic, et aucune sonde ne tournait en CI (R4 de la fiche
187). L'utilisateur doit savoir, sans bruit, quand son agent sort de ce que Bobine a essayé, et
comprendre pourquoi un agent incompatible ne démarre pas.

## Critères d'acceptation

- [x] Version plus récente que toutes les `testedVersions` : avis gris dans la conversation, une
      fois par agent et par version **majeure.mineure** (2.3.0 → avis ; 2.3.1 ensuite, ou 2.2.6
      quand 2.2.5 est essayée → rien), avec un lien « Diagnostic ». Jamais bloquant.
- [x] Version plus ancienne que la plus ancienne essayée : avertissement orange, une fois par agent
      et par version, jamais bloquant.
- [x] Un avis vu ne revient ni dans une autre conversation, ni après un redémarrage (réglages,
      `versionNotices`).
- [x] Plancher bloquant (`minVersion`) seulement pour une incompatibilité documentée, avec sa
      raison : **aucun** pour Bob et OpenCode. En dessous : démarrage refusé, expliqué.
- [x] `protocolVersion` d'ACP rendue par l'agent différente de celle de l'app : démarrage refusé,
      expliqué dans le bon sens (agent trop récent → mettre Bobine à jour ; trop ancien → mettre
      l'agent à jour). Absente : tolérée.
- [x] `testedVersions` à jour : Bob 2.0.6, 2.0.9 (déjà là) ; OpenCode + 2.2.5.
- [x] Sonde OpenCode `--offline` en CI chaque semaine (Linux, sans secret, 10 min au plus).
- [x] Liste « à chaque nouvelle version de Bob » dans `docs/acp.md` (sonde, coûts, quota).
- [x] Testé : comparaison de versions (formats réels, préversions, sorties bizarres) ; scénarios
      de l'agent factice `version-plus-recente`, `version-plus-ancienne`, `version-trop-ancienne`,
      `protocole-incompatible` ; suite e2e `versions` (clair et sombre).

## Plan

1. `src/main/agent/agent-version.ts` : lecture tolérante (`v2.2.5`, `2.0.9\ncommit: …`, `1.19`,
   préversions, `+build`), ordre semver, verdict d'après le profil (`tested`, `untested`, `newer`,
   `older`, `below-floor`, `unknown`). Illisible, absente ou `0.0.0-…` (construction locale) :
   `unknown`, jamais d'avis ni de refus.
2. `src/main/agent/version-check.ts` : textes et clés des avis ; `refuseIncompatible` (hôte
   d'agent, juste après `initialize`, **avant** l'annonce) ; `announceVersion` (conversation).
3. Hôte d'agent : refus levé comme `AgentIncompatible`, sans la sortie d'erreur de l'agent.
   `host-options.ts` : avis calculé à l'annonce, montré au premier « prêt » qui suit (après le
   rejeu d'une réouverture), la clé retenue à ce moment (`SettingsStore.claimVersionNotice`). Le
   Diagnostic n'affiche aucun avis (il garde son avertissement) mais montre le refus.
4. Avis avec lien : champ `link: 'diagnostics'` des avis (`AgentEvent`, `TranscriptItem`), bouton
   « Diagnostic » qui ouvre la section par un évènement de fenêtre (`open-settings.ts`).
5. Agent factice : `announce` d'un scénario (version, protocole) ; profil factice : essayé 0.1.0,
   plancher 0.0.5 (fictif, pour l'essai du refus).
6. CI `.github/workflows/opencode-probe.yml` ; doc `docs/acp.md`, `docs/agents.md`.

Aucune nouvelle dépendance.

## Journal

### 2026-11-07

- **Maquette** (`nuit-0-11/agents/maquettes/f-avis-version.{html,png}`), décisions du tech lead et
  verdict de l'expert UX (`VERDICT-expert-ux.md`), appliqués :
  - F2 n'est **pas bloquant** (aucune casse documentée sous Bob 2.0.6 ni OpenCode 1.18) : une
    version plus ancienne que la plus ancienne essayée est un avertissement. Le plancher bloquant
    reste possible dans un profil, seulement avec une raison documentée ; vide pour Bob et OpenCode.
  - Un seul verbe, « essayé » ; F1 court, lien « Diagnostic » ; F1 par majeure.mineure.
  - F3 sans jargon, la raison technique en parenthèse, dans le bon sens.
  - Noms d'agents tirés du profil, aucun dans `fr.json` / `en.json`.
- **Écart à la maquette** : le texte de F1 est centré même sur deux lignes (classe
  `.notice-linked`, seulement les avis à lien) ; il tient sur une ligne fenêtre large, panneau fermé.
- **Conseil de mise à jour** (correction 4 de l'expert) : aucun profil ne déclare de commande de
  mise à jour (`installHint` dit comment installer, pas mettre à jour) ; l'avis s'arrête donc à
  « mettez {agent} à jour ». Pas de nouveau champ ajouté sans besoin.
- **Ordre** : le refus a lieu avant l'annonce de l'agent ; un agent refusé ne laisse ni avis ni
  annonce retenue (le Diagnostic montre alors l'échec expliqué).
- **Taille de `agent-host.ts`** (plafond de 1 050 lignes atteint) : `settleNotifications` est
  passée dans `process-utils.ts`, et l'avis est émis par `host-options.ts`.
- **Grille de conformité** : les personas prennent les vrais profils de Bob et d'OpenCode sur
  l'agent factice (0.1.0) ; leurs `testedVersions` / `minVersion` sont retirés, sinon chaque
  parcours commencerait par un avertissement.
- **e2e** : `withApp(…, { startError: true })` attend un agent en erreur au lieu de « prêt ».
- **CI** : OpenCode 2 n'est pas sur npm (`opencode-ai@latest` = 1.19.5) ; le workflow prend la
  release GitHub `vX.Y.Z` la plus haute (1.x et 2.x sont publiées en parallèle), binaire
  `opencode-linux-x64.tar.gz` vérifié par le `SHA256SUMS` de la même release (protège d'un
  téléchargement abîmé, pas d'une release compromise). Sélection du tag essayée en local
  (`v2.2.6`). **Jamais lancé sur GitHub** (rien n'est poussé) : premier passage à surveiller.
- **OpenCode 2.2.6** publiée le 2026-11-06 : **pas encore essayée**. Correctif de la 2.2 essayée :
  aucun avis dans la conversation ; le Diagnostic la dit non essayée. Le premier passage de la CI
  la sondera.
- **Essais réels** :
  - `pnpm opencode-probe --offline` (OpenCode 2.2.5, `HOME` jetable) : contrat vert, réponses
    identiques, 25 s.
  - Vrai OpenCode 2.2.5 dans l'app construite, `--profil-temporaire`, `HOME` et `XDG_*` jetables,
    `opencode/big-pickle`, un tour (« ok ») : version lue (« Prêt · 2.2.5 » dans Réglages ›
    Agents), **aucun avis** à tort.
  - Bob : `bob --version` → `2.0.9` (essayée) ; rien d'autre lancé, 0 bobcoin.

### 2026-11-07 — relecture indépendante (à corriger, rien de bloquant)

1. **Avis perdu à la réouverture** : l'avis était émis à l'annonce, avant `session/load`, dont le
   `reset` recommence le fil sans fil gardé ; la clé était pourtant retenue → avis perdu pour
   toujours. Désormais calculé à l'annonce, émis au premier statut « prêt » (après le rejeu), la
   clé retenue seulement à ce moment. Test : réouverture avec l'agent factice, `reset` avant l'avis.
2. **Version brute** : affichée, mise en clé et au journal telle que l'agent la donne (multiligne,
   5 Ko possibles). Désormais la version normalisée de `parseVersion` (`formatVersion`, 40
   caractères au plus) ; version de protocole nettoyée et bornée (20). Tests.
3. **Protocole** : comparaison à un ensemble (`SUPPORTED_PROTOCOLS = [1]`), plus l'égalité avec
   `PROTOCOL_VERSION` du SDK (piège le jour où il proposera 2). Tests avec `[1, 2]`.
4. **CI** : téléchargement sorti dans `scripts/ci/fetch-opencode.sh`, chaque échec dit par
   `::error::` (aucun tag, release sans l'archive ou sans `SHA256SUMS`, ligne absente, format
   `*nom` accepté, somme différente, membre `opencode` ou `./opencode`). Essayé en local : `v2.2.6`
   téléchargée et vérifiée ; `process-daemon-v0.5.0` et un tag inexistant échouent avec leur
   message. **Toujours jamais lancé sur GitHub** : premier passage à surveiller.
5. **CSS** : `text-align: center` limité aux avis à lien (`.notice-linked`), le reste du composant
   `.notice` intact (lot C).

Tests ajoutés aussi : `versionNotices` mal formé ignoré sans planter ; `protocolVersion` absente →
démarrage accepté (scénario `protocole-absent` de l'agent factice).
