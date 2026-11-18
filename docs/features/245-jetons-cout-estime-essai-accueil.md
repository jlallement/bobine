# 245 — Données de consommation justes : jetons traités, coût estimé, modèle de l'essai

- **Statut** : fait — maquettes validées (2026-11-18, par délégation de l'utilisateur au tech lead) ; non poussé, en attente de relecture
- **Dépend de** : 019 (consommation), 109 (coût par échange), 126 (`/cost`), 130 (journal de
  consommation, Mon activité), 157 (plafond), 188 (accueil du premier lancement)
- **Agents** : les deux (comportement de Bobine sur des données ACP génériques : `usage` du tour,
  `usage_update`, réglage de catégorie `model` ; aucun code propre à un agent, ADR-0011)
- **Trouvé par** : recette « POC complet » du 2026-11-17
  ([rapport](../recettes/2026-11-17-poc-complet-opencode.md), défauts D6, D8, D13, D16)

## Pourquoi

Quatre défauts de la recette sur les chiffres que Bobine montre. Deux sont sérieux pour la
confiance : le même libellé « Jetons traités » donne 4 051 903 dans `/cost` et 635,2k dans Mon
activité ; un coût en dollars s'affiche alors que l'utilisateur paie un abonnement. Un troisième
(D16) fait croire que l'essai de l'accueil a parlé à un autre modèle que celui de la conversation.
Le quatrième (D13) n'est **pas** un défaut (voir plus bas).

Sources : profil de la recette (`~/Development/bobine-recette/poc-1.0.0-beta.7-opencode/profil` :
`logs/agents.log`, `logs/main.log`, `usage.sqlite`, fil `conversations/f7836b04-….json`), lus sans
secret. Le journal n'est passé en **Détaillé** qu'à 19:52:08Z : l'essai de l'accueil (19:49–19:51)
n'a laissé que ses lignes `main.log` et sa ligne de `usage.sqlite`.

## D6 — « Jetons traités » ne compte pas la même chose partout

### Trace réelle

- `/cost` à 20:17Z (`4-context-cost.jpg`) : « Jetons traités : 4 051 903 sur 17 échanges
  (216 288 en entrée, 26 082 en sortie) ».
- Mon activité, fin de passage (`9-defaut-mon-activite-jetons.jpg`) : « Jetons traités 635,2k —
  entrée 580,8k · sortie 54,4k », pour **tout** le passage (17 780 172 dans `usage.sqlite`).
- `usage.sqlite`, 17 tours de la mère jusqu'à 20:17:38Z : entrée 216 288, sortie 26 082, lus en
  cache 3 801 728, réflexion 7 805, `total_tokens` 4 051 903 — soit exactement
  entrée + sortie + cache + réflexion.
- Forme réelle d'OpenCode 2.3.0 (réponse à `session/prompt`, trace
  `__traces__/opencode-2.3.0/reponse-simple.ndjson`) :
  `"usage":{"inputTokens":3646,"outputTokens":3,"totalTokens":5441,"cachedReadTokens":1792}` —
  `inputTokens` **n'inclut pas** le cache lu ; `totalTokens` l'ajoute (et la réflexion,
  `thoughtTokens`, quand il y en a : tour de 19:54:43Z, 28 149 + 6 906 + 96 384 + 447 = 131 886).

### Cause dans le code

Deux définitions pour un même libellé :

- **`totalTokens` de l'agent** : `/cost` (`costLines`, `src/shared/app-commands.ts`, clé
  `usage.summary.tokens`), détail de la consommation du compositeur (`UsageMeter.tsx` : « Jetons
  traités (n échanges) », « Dernier échange », et la puce quand ni contexte ni coût ne sont
  connus), moyenne par échange (`turnAverages`, `src/shared/usage.ts`), coût d'une fille en jetons
  (`Subtasks.tsx`, `usage.total` du résumé).
- **entrée + sortie** : Mon activité (`tokensOf` de `src/main/usage/stats.ts` → KPI, graphique
  « Jetons », tableaux).

Avec OpenCode le cache lu pèse 95 % du total (17,1 M sur 17,8 M) : l'écart est énorme.

L'onglet Session du panneau ne montre pas de jetons traités (seulement le contexte) : rien à y
changer.

### Correction (décision du tech lead, 2026-11-18)

- **Partout, « Jetons traités » = entrée + sortie** : une seule fonction partagée
  (`processedTokens`, `src/shared/usage.ts`) utilisée par `/cost`, le détail de la consommation
  (total, dernier échange, puce, moyenne), la carte des filles et Mon activité (qui la reprend au
  lieu de son `tokensOf` local).
- **Le cache s'affiche à part**, jamais additionné : « En plus : 3 801 728 relus en cache, 7 805 de
  réflexion. » dans `/cost`, « et 17,1M relus en cache » dans Mon activité, une section « Hors
  total » dans le détail de la consommation. La réflexion aussi (Q1, Q2).
- **Le plafond en jetons garde `totalTokens`** (Q3) : un plafond déjà réglé ne change pas de sens.
  Son libellé et son aide le disent : « jetons, cache compris » (carte du plafond, saisie, Réglages,
  tâches planifiées).
- Le journal (`usage.sqlite`) et l'export CSV gardent toutes les colonnes brutes, `total_tokens`
  compris : rien ne change dans les données enregistrées.

### Critères

- [x] `/cost` sur un tour réel de la mère (19:54:43Z) : « Jetons traités : 35 055 sur 1 échange
      (28 149 en entrée, 6 906 en sortie) », puis « En plus : 96 384 relus en cache, 447 de
      réflexion. » (`jetons-traites.test.ts`). Sur les 17 tours de 20:17Z, la même règle donne
      242 370 (maquette).
- [x] Détail de la consommation : même total (242,4k), le cache et la réflexion sur des lignes à
      part, hors du total ; « Dernier échange » et « Moyenne par échange » en entrée + sortie.
- [x] Mon activité et `/cost` donnent le même nombre pour une même conversation (test unitaire
      sur les mêmes tours).
- [x] Scénario d'agent factice `jetons-opencode` : `usage` du tour à la forme réelle d'OpenCode
      (entrée hors cache, `cachedReadTokens`, `thoughtTokens`, `totalTokens` = la somme).
- [x] Test unitaire qui échoue sans le correctif (`/cost` et `UsageMeter` sur ces tours).

## D8 — Un coût en dollars alors que l'agent passe par un abonnement

### Trace réelle

- Accès au modèle : abonnement ChatGPT dans OpenCode, rien de facturé à l'usage.
- OpenCode annonce lui-même un coût à chaque tour, dans `usage_update` (forme réelle,
  `reponse-simple.ndjson`) : `{"sessionUpdate":"usage_update","used":5441,"size":200000,"cost":{"amount":0,"currency":"USD"}}`.
  Pendant la recette, ce montant a monté pour la mère jusqu'à 20:32Z (0,0010 à 0,0885 $ par tour,
  `usage.sqlite`), est resté à 0 pour les filles, et à 0 pour tout le monde après le redémarrage
  de l'agent de 20:34Z. Comportement d'OpenCode, observé, non expliqué (tarif d'un modèle selon
  la session ?) : Bobine ne fait que l'afficher.
- Affichages : « ≈ 0,0075 $US » au pied du tour (`1-onglet-session.jpg`), « Coût : 0,1556 $US »
  dans `/cost`, « Coût 0,2403 $US » dans Mon activité, « 0,00 $US » sur les cartes des filles et
  de la relecture (`8-arret.jpg`).

### Cause dans le code

Bobine affiche le coût annoncé par l'agent (`usage_update.cost`, ou la source du profil pour Bob)
comme un montant sûr : `formatCost` (`src/shared/usage.ts`) n'a pas de marque d'estimation, et
seul le pied du tour (`turnSummary.cost` = « ≈ {{cost}} ») en met une. ACP ne dit pas si le
montant est facturé ; Bobine ne peut pas le savoir.

### Correction (décision du tech lead, 2026-11-18)

**Aucun réglage.** Chaque coût affiché porte « ≈ » (une fonction `formatEstimate` à côté de
`formatCost`), et les endroits où on lit un total disent « estimation » :

- détail de la consommation : « Coût de la conversation (estimation) ≈ 0,1556 $US », et une ligne
  d'explication « Montant annoncé par OpenCode d'après ses tarifs : ce qui est facturé peut
  différer (abonnement, remises). » ;
- `/cost` : « Coût : ≈ 0,1556 $US (estimation annoncée par OpenCode) » ;
- Mon activité : tuile « Coût estimé », « ≈ 0,2403 $US » ; colonnes « Coût » des tableaux et
  graphique « Coût » en « ≈ » ;
- cartes des filles, des sous-agents, de la relecture, de l'aparté, tâches planifiées, essai de
  l'accueil, dépense du plafond : « ≈ » devant le montant.

Les **plafonds** (montants choisis par l'utilisateur) ne prennent pas de « ≈ » : ce ne sont pas des
coûts. **Les bobcoins de Bob non plus** (Q5) : c'est son propre décompte, pas une estimation de
prix ; « ≈ » ne va que sur un coût en monnaie (code ISO) annoncé par l'agent. Le pied du tour,
qui mettait « ≈ » sur tout coût, bobcoins compris, suit la même règle.

### Critères

- [x] Aucun montant de coût affiché sans sa marque : les composants passent par `formatEstimate`,
      jamais `formatCost` nu, réservé aux plafonds (test qui lit les composants,
      `jetons-traites.test.ts`).
- [x] « estimation » dans le détail de la consommation, `/cost` et Mon activité.
- [x] Scénario d'agent factice : coût annoncé par `usage_update` à la forme réelle d'OpenCode
      (`cost.amount`, `USD`), y compris `0` (fille) ; test unitaire qui échoue sans le correctif.

## D13 — « ✕ 1 échec » après Arrêter : pas un défaut

### Trace réelle

Tour de la mère commencé à 21:05:47Z, arrêté à 21:06:24.949Z (`agents.log`) :

```
21:05:54.734Z ← tool_call …6cd5faab « shell » execute pending
21:05:56.071Z ← tool_call_update …6cd5faab « shell » execute failed contenu 1 text
21:06:00.756Z … 4 × « read », completed
21:06:20.399Z ← tool_call …b0c9630f « patch » edit pending
21:06:24.949Z → session/cancel
21:06:24.961Z ← tool_call_update …b0c9630f « patch » edit failed contenu 1 text
21:06:24.979Z ← réponse #5 session/prompt cancelled en 37.5 s
```

Dans le fil enregistré : la commande `shell` est `failed`, avec « Invalid arguments for tool
"shell": command: Missing key — Arguments provided: {} » (l'agent a appelé l'outil sans commande) ;
le `patch` est enregistré `cancelled` (« Tool execution interrupted »).

### Conclusion

**Ce n'est pas un défaut.** L'échec compté est la commande `shell` qui a **vraiment** échoué
28 s avant l'arrêt (appel d'outil invalide d'OpenCode, côté agent). Le `patch` en cours au moment
de l'arrêt, que l'agent signale `failed`, est bien compté comme **interrompu** par Bobine (statut
`cancelled` dans le fil, « Modification — interrompu » après la relance, recette § 8). Rien à
corriger.

Seule remarque : l'en-tête du groupe ne montre que l'état le plus grave (`GroupState`,
`ToolGroup.tsx` : échec, sinon refusé, sinon interrompu), donc « ✕ 1 échec » cache
« 1 interrompu ». Une maquette propose de montrer les deux (« ✕ 1 échec · ⊘ 1 interrompu ») :
**option**, retenue par le tech lead (Q4) : l'en-tête montre chacun des états, séparés d'un point.
Défaut purement côté Bobine (affichage) : pas de scénario d'agent factice, un test du fil sur la
forme du tour réel (`Transcript.test.tsx`).

## D16 — L'essai de l'accueil n'utilise pas le modèle de la conversation

### Trace réelle

- `usage.sqlite`, tours d'essai rattachés à la conversation de l'accueil `f7836b04` :
  19:49:18Z `openai/gpt-6.2-astra`, `error` (connexion expirée, `main.log` : « essai reply de
  opencode → auth ») ; 19:51:37Z `opencode/hy4-flash-free`, `end_turn`, 5 759 jetons (« → ready »).
- La conversation `f7836b04` (agent lancé à 19:49:11Z dans `taches`) montrait GPT-6.2 Astra sur sa
  puce de modèle ; l'essai répondu affichait « Modèle : opencode/Hy4 flash Free ».
- Entre les deux essais, l'utilisateur s'est reconnecté (`opencode auth login` dans le terminal de
  Bobine). Pourquoi la session neuve d'OpenCode a annoncé un autre modèle courant la seconde fois
  n'est pas établi (journal Normal à ce moment) ; on ne suppose rien de plus.
- Effet de bord : `settings.json` garde `opencode/hy4-flash-free` dans les modèles récents, et Mon
  activité « Par modèle » compte ce tour sous Hy4.

### Cause dans le code

L'essai (`sendTrial`, `src/main/onboarding/agent-readiness.ts`) ouvre **sa propre session** chez un
agent lancé pour l'occasion (`session/new` dans un dossier jetable) et envoie le message **avec le
modèle courant que l'agent annonce pour cette session** (`currentModel(buildControls(…))`), sans
jamais appliquer celui de la conversation. Le modèle affiché avant l'envoi vient d'une autre
session encore (celle de l'étape Connexion). Rien ne garantit donc que les trois coïncident.

### Correction

**L'essai utilise le modèle affiché** : l'accueil passe à l'essai le modèle courant de sa
conversation (celui de la puce, même identifiant de réglage de catégorie `model`), et l'essai
l'applique par `session/set_config_option` (le même chemin que `AgentHost.applyControl`) avant le
message, s'il figure dans les choix annoncés par la session d'essai. L'étape Essai montre ce
modèle avant l'envoi et après la réponse.

Si l'agent refuse ce modèle, ou ne le propose pas dans cette session : le message part avec le
modèle de la session, et le résultat le dit franchement : « Répondu avec opencode/Hy4 flash Free,
pas GPT-6.2 Astra (celui de la conversation) ». Rien n'est imposé au profil (Bob n'expose pas de
réglage de catégorie `model` : rien ne change pour lui).

### Critères

- [x] Scénario d'agent factice `essai-autre-modele` : `session/new` annonce un modèle courant
      différent de celui de la conversation (forme réelle des `configOptions` d'OpenCode 2.3.0, copiée
      d'une trace), le message d'essai part après `session/set_config_option` avec le modèle de la
      conversation ; variante où le modèle n'est pas proposé.
- [x] Test unitaire qui échoue sans le correctif (`checkAgent` niveau `reply` avec un modèle demandé).
- [x] Ligne du journal de consommation de l'essai au bon modèle.

## Maquettes

Dossier `e2e/maquettes`, sur la vraie fenêtre (app buildée, agent factice), en clair et en sombre :
`node e2e/maquettes/run-245.mjs [light|dark] [f245-…]`. Captures dans `e2e/captures/maq-f245-*`.

1. `f245-1-cost` — `/cost` : jetons traités en entrée + sortie, cache et réflexion à part, coût
   estimé.
2. `f245-2-detail` — détail de la consommation (puce du compositeur).
3. `f245-3-activite` — Mon activité : tuiles « Jetons traités » et « Coût estimé ».
4. `f245-4-fil` — fil : filles et relecture « ≈ 0,00 $US ».
5. `f245-5-essai` et `f245-6-essai-repondu` — essai de l'accueil avec le modèle de la conversation ;
   `f245-7-essai-autre-modele` — cas où l'agent refuse le modèle.
6. `f245-8-groupe` — option D13 : « ✕ 1 échec · ⊘ 1 interrompu ».

## Réponses du tech lead (2026-11-18)

- **Q1** : « En plus : X relus en cache… » dans `/cost`, « et X relus en cache » ailleurs.
- **Q2** : la réflexion reste à part, comme le cache ; le chiffre principal compte strictement
  l'entrée et la sortie annoncées par l'agent.
- **Q3** : ne pas changer le sens des plafonds en silence ; garder `totalTokens`, et l'écrire dans
  leur libellé et leur aide (« jetons, cache compris »).
- **Q4** : oui, « ✕ 1 échec · ⊘ 1 interrompu ».
- **Q5** : pas de « ≈ » sur les bobcoins.
- Maquettes : corriger le bouton « Toute mon activité… » (style perdu) et la table « Par modèle ».

## Plan (temps 2, suivi)

1. `src/shared/usage.ts` : `processedTokens`, `formatEstimate` ; D6 dans `app-commands.ts`,
   `UsageMeter.tsx`, `Subtasks.tsx`, `stats.ts` ; D8 dans les appelants de `formatCost` (liste
   ci-dessus).
2. `src/main/onboarding/agent-readiness.ts` + `onboarding.ts` : modèle demandé, appliqué, résultat
   `modelRequested` ; `Onboarding.tsx` : affichage.
3. Agent factice : scénarios `jetons-opencode`, `essai-autre-modele` (formes copiées
   d'`agents.log` et des traces 2.3.0).
4. Tests unitaires (échouent sans le correctif), i18n fr/en, CHANGELOG fr/en, `verify`, e2e
   `--changed`.

## Journal

- 2026-11-18 — Enquête sur les traces de la recette ; D13 classé « pas un défaut » ; maquettes
  (temps 1). Rien de codé.
- 2026-11-18 — Temps 2.
  - D6 : `processedTokens` (`src/shared/usage.ts`) partout (`/cost`, `UsageMeter` : total, dernier
    échange, puce, moyenne ; carte des filles ; `stats.ts` de Mon activité) ; cache et réflexion à
    part (`ApartRows`, « En plus : … », tuile « et … relus en cache » avec `totals.cachedRead`).
    Plafond : `formatCap` dit « jetons, cache compris » ; sens inchangé.
  - D8 : `formatEstimate` / `isEstimate` (`src/shared/usage.ts`) : « ≈ » sur tout coût en monnaie
    (code ISO), jamais sur les bobcoins ; « Coût de la conversation (estimation) » et son
    explication, « Coût : ≈ … (estimation annoncée par {agent}) », « Coût estimé » (tuile, colonne).
    La clé `turnSummary.cost` (« ≈ {{cost}} » sur tout coût) a disparu au profit de
    `usage.estimate`.
  - D13 (option retenue) : `GroupState` (`ToolGroup.tsx`) montre échec, refusé et interrompu ensemble.
  - D16 : `requestedModel` et `useModel` (`agent-readiness.ts`) ; `OnboardingDeps.modelOf`, câblé dans
    `index.ts` sur la puce de la conversation de l'accueil (même agent seulement) ; résultat
    `modelRequested` quand le modèle n'a pas été pris, dit dans l'essai (`onboarding-model-missed`).
    Appliqué aussi au niveau « connecté ? » (sans message au modèle).
  - Agent factice : `scenarios-consommation.mts` (`jetons-opencode`, `jetons-opencode-fille`,
    `essai-autre-modele`, `essai-modele-absent`) ; `Scenario.turnUsage` et `session.models`.
  - **Écart** : le journal Détaillé de la recette (`agents.log`) ne garde des messages que leur
    résumé (`usage_update 19711/1050000`, taille en octets), pas leur contenu. Les valeurs des
    scénarios viennent donc de ces résumés et de `usage.sqlite` (jetons et coût de chaque tour) ;
    la forme des messages (noms des champs, liste plate des modèles) vient des traces réelles
    `__traces__/opencode-2.3.0/` (`reponse-simple.ndjson`). Le payload exact de l'essai de 19:51Z
    n'existe pas (journal encore Normal).
  - Maquettes : les deux défauts relevés corrigés. La table « Par modèle » était un défaut de la
    maquette seule (`run-245.mjs`). Le bouton « Toute mon activité… », lui, n'avait **aucun style
    dans l'app** depuis la 1.0.0-beta.1 (`.usage-all` défini nulle part) : stylé dans `styles.css`
    (lien d'action sous un filet), vu dans la maquette refaite et la capture `14-consommation`.
  - Plafond : « cache compris » dit une seule fois, sur la limite (`formatCap(…, short)` pour la
    dépense et le pas de relève) ; la première version le répétait trois fois sur la carte.
