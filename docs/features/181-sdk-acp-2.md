# 181 — Montée du SDK ACP 2 (réversible)

- **Statut** : fait
- **Dépend de** : 143 (essai du SDK 2.0, retiré), 124 (pause du fil sous le pointeur), 169 (lot C)
- **Agents** : les deux — le SDK est le client ACP générique ; rien de propre à un agent

## Pourquoi

Bobine est sur `@agentclientprotocol/sdk` 1.9.0 (schéma 1.26) ; la 2.4.0 est publiée
(2026-11-02, schéma 1.29). Sans cette montée, les nouveautés instables du schéma (`session/set_title`,
`auth/status`…) sont hors de portée. La fiche 143 l'avait essayée puis retirée : l'entrée par défaut
du SDK 2 ne connaît que le protocole stable, et la suite e2e `filles` échouait sous charge.
L'utilisateur veut une montée **facile à défaire** si elle ne marche plus avec Bob ou OpenCode.

## Critères d'acceptation

- [x] La suite e2e `filles` est stable sur le SDK 1.9.0, sous charge, avant toute montée (commit à
      part, chiffres dans le Journal).
- [x] Un seul module importe le SDK (`src/shared/acp-sdk.mts`) ; une règle ESLint refuse tout autre
      import de `@agentclientprotocol/sdk` (commit à part, encore sur 1.9.0).
- [x] La montée tient dans un commit qui ne touche que `package.json`, `pnpm-lock.yaml` et ce module
      (plus ce que l'API change, s'il le faut, dit ici).
- [x] Procédure de retour arrière écrite ici et **jouée** (revert, `pnpm install`, `./scripts/verify`).
- [x] Sur 2.4.0 : `./scripts/verify`, `pnpm opencode-probe --offline` identique à la référence,
      suite e2e complète, `pnpm bob-probe` (0 bobcoin) ; `docs/acp.md` à jour.
- [x] ADR « SDK derrière un seul module ».

## Plan

1. **`filles` sur 1.9.0** : reproduire sous charge (`pnpm e2e filles subagents inbox --jobs 3`),
   trouver qui lève la pause sous le pointeur (fiche 124), corriger la cause.
2. **Module unique** : `src/shared/acp-sdk.mts` (`export * from '@agentclientprotocol/sdk'`), dans
   `shared` parce que le renderer en lit des types et que l'agent factice et les sondes (lancés par
   Node, sans bundler) en importent aussi ; en `.mts` pour que Node le charge comme module ES sans
   avertissement. Tous les imports réécrits ; règle `no-restricted-imports` (et, dans le renderer,
   import de types seulement).
3. **Montée** : `^2.4.0`, le module passe à `@agentclientprotocol/sdk/unstable`.
4. **Validation** : verify, sondes, e2e complète, `docs/acp.md`.
5. Nouveautés instables : listées en suite, pas faites (sauf triviales).

## Revenir au SDK 1.9 (retour arrière)

Si une version de Bob ou d'OpenCode ne marche plus avec le SDK 2 (sonde en rouge, échanges ACP
refusés à la validation, champ qui disparaît du fil), la montée se défait en un commit :

```bash
git log --oneline --grep "bump @agentclientprotocol/sdk to 2.4.0"   # retrouver le commit
git revert <commit>      # package.json, pnpm-lock.yaml et src/shared/acp-sdk.mts reviennent
pnpm install             # remet le SDK 1.9.0 dans node_modules
./scripts/verify
pnpm build && pnpm e2e --changed
```

Rien d'autre à toucher : tout le code importe le SDK par `src/shared/acp-sdk.mts` (ADR-0038), qui
revient à l'entrée par défaut (`@agentclientprotocol/sdk`, qui en 1.x contient déjà l'instable).
Si du code écrit **après** la montée se sert d'une nouveauté du SDK 2 (méthode ou type absents de
1.9), `verify` le dit (typecheck) : le retirer, ou le garder derrière le module.

Pas de nouvelle dépendance (montée d'une dépendance existante). Le SDK 2 déclare
`@modelcontextprotocol/server` en dépendance pair **optionnelle** (MCP par ACP, non utilisé).

## Journal

- 2026-11-06 — Fiche ouverte (branche `claude/181-sdk-acp-2-f01c6a`), tout fait le même jour.
  - **Suite `filles` sous charge** (« propositions en rafale », fiche 124), machine partagée avec
    quatre autres sessions qui jouaient leurs e2e (charge moyenne 6 à 50) :

    | SDK | Commande | Passages | `filles` vertes |
    |---|---|---|---|
    | 1.9.0 | `pnpm e2e filles subagents inbox --jobs 3` | 3 | 6 / 6 (clair et sombre) |
    | 2.4.0 | `pnpm e2e filles subagents inbox --jobs 3` | 3 | 6 / 6 |
    | 2.4.0 | `pnpm e2e filles subagents inbox base mermaid --jobs 5` | 2 | 4 / 4 |
    | 2.4.0 | `pnpm e2e filles` (après la trace ci-dessous) | 1 | 2 / 2 |

    L'échec de la fiche 143 (SDK **2.0.0**, 2 fois sur 3) **ne se reproduit plus**, ni sur 1.9.0 ni
    sur 2.4.0 : sa cause n'a donc pas pu être établie, et rien n'a été « corrigé » à l'aveugle.
    Lecture du code : la pause est prise au clic sur le titre (pointeur déjà sur la carte), et
    « Lancer » est sur la même ligne que ce titre, au-dessus du texte déplié ; un `pointerover` sur
    la zone de saisie suppose que la zone de saisie soit passée sous le pointeur (fil raccourci par
    le bas) ou un survol envoyé ailleurs. Écart probable avec la 2.0.0 : l'ordre ou le rythme de
    livraison des notifications et des requêtes (le SDK 2.0 validait tout par l'entrée stable, qui
    retirait aussi `usage` en fin de tour). Ce qui est fait (commit à part, avant tout le reste) :
    l'étape enregistre chaque `pointerover` (élément, position, haut de la zone de saisie, heure)
    et l'écrit dans le message d'échec, pour qu'un prochain échec dise sa cause.
  - **Module unique** (commit à part, encore sur 1.9.0) : 64 fichiers réécrits vers
    `src/shared/acp-sdk.mts` (main, shared, renderer en types, agent factice, sondes, tests) ;
    règle ESLint `ACP_SDK` vérifiée sur trois cas (import direct dans le main, `…/unstable` dans
    l'agent factice, import de valeur dans le renderer : refusés ; `import type` dans le renderer :
    permis). Placé dans `shared` et non `src/main/acp/` comme suggéré : voir ADR-0038.
  - **Montée 2.4.0** : aucun changement d'API (l'app utilisait déjà `client()` / `agent()`) ; le
    commit ne touche que `package.json`, `pnpm-lock.yaml`, `src/shared/acp-sdk.mts`. Dépendance
    pair **optionnelle** `@modelcontextprotocol/server` non installée (MCP par ACP non utilisé).
  - **Retour arrière joué** : sur la branche complète (fiche 179 en cours comprise), `git revert`
    du commit de montée, `pnpm install` → SDK 1.9.0 dans `node_modules`, module revenu à l'entrée
    par défaut ; `./scripts/verify` : lint et typecheck verts, 2 368 essais sur 2 369 verts. Le
    seul rouge, `manager.test.ts › recherche sans charger les fils` (« boucle d'évènements libre »,
    écart maximal 110 ms pour 100), est un essai de minutage, rouge aussi seul sous la charge de
    ce moment-là (charge moyenne ≈ 50) ; il ne touche pas au SDK. Puis le revert retiré, `pnpm
    install` → 2.4.0 de nouveau. Deux défauts de la fiche 179 alors en cours, trouvés par ce
    passage, corrigés avant de reprendre.
  - **Validation sur 2.4.0** : `./scripts/verify` vert ; `pnpm opencode-probe --offline`
    (OpenCode 2.2.5, sans modèle) : contrat 11/11, réponses **identiques** à la référence ;
    `pnpm bob-probe` (Bob 2.0.9, 0 bobcoin : clé factice, licence refusée, `HOME` jetable) :
    contrat 10/10, réponses **identiques** ; suite e2e complète (`pnpm build && pnpm e2e --if-needed`,
    branche finale avec la fiche 179) : **147 / 147** en 9 min 20 s ; `dossiers --lang en` vert.
  - **Sonde OpenCode avec modèle** (relecture, `openai/gpt-6.1-sol`, OpenCode 2.2.5, abonnement
    de l'utilisateur) : sur le SDK **1.9.0** (base, `docs/acp.md`) puis sur cette branche en
    **2.4.0**, résultats **identiques** : contrat de l'app 21/21, mêmes trois écarts dus au modèle
    face à la référence `big-pickle` (`edit` → `patch`, option `effort`, diff du fichier créé).
  - **Fusion de `main`** (aparté, fiche 180) : conflits « garder les deux » (CHANGELOG, index,
    scénarios factices) ; les fichiers de la fiche 180 n'importaient pas le SDK. `ipc.ts` passait
    à 805 lignes (plafond 800) : canaux des autres dossiers sortis dans
    `conversations/additional-directories-ipc.ts`. `verify` vert (2 390 essais). Suite e2e
    complète (149) : 146 vertes du premier coup, 3 rouges en sombre seulement sous charge (≈ 20,
    dont un délai DevTools de 60 s) — `filles-tech-lead`, `links`, `dossiers` — vertes en clair
    et sombre au second passage, puis encore en sombre.
  - **Nouveautés du SDK 2 / schéma 1.27–1.29 non faites** (toutes instables, ni Bob 2.0.9 ni
    OpenCode 2.2.5 ne les annoncent), à reprendre chacune dans sa fiche, génériques sur capacité :
    `session/set_title` (+ `sessionCapabilities.title` : renommer dans l'app renommerait chez
    l'agent), `auth/status` et `auth/status_update` (état de connexion avant le premier message :
    le plus utile si Bob l'adopte), `session/archive` / `unarchive`, `session/status`, prompt
    système fourni par le client, dossier de travail des sous-agents, `providers/*`, MCP par ACP
    (`@modelcontextprotocol/server`), arrêt d'attente d'une requête annulée (SDK 2.4).
