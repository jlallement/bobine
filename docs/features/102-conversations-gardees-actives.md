# 102 — Combien de conversations restent actives : un réglage

- **Statut** : fait
- **Dépend de** : 043 (agents vivants, éviction), 097 (conversations filles protégées de
  l'éviction)
- **Agents** : les deux.

## Pourquoi

L'app garde au plus 4 agents vivants (`maxLive`, `src/main/conversations/manager.ts`). Au-delà, la
conversation inactive la plus ancienne voit son agent arrêté. Rouverte, elle est rechargée par
l'agent (`session/load`) et perd ce que Bobine avait ajouté à son fil : cartes, comptes rendus de
filles, certains libellés. Avec beaucoup de conversations ouvertes dans la journée, ça arrive
souvent : c'est le quatrième irritant du bilan « 8 h par jour » du 2026-10-21.

Le vrai remède (Bobine garde elle-même ce qu'elle ajoute au fil) viendra plus tard, avec un ADR.
En attendant, on laisse l'utilisateur garder plus de conversations actives, au prix de la mémoire.

## Choix d'interface

Tranchés par la session principale :

- Réglages › Conversation : « Conversations gardées actives ». C'est un pas à pas, comme le plafond
  des conversations filles, de 2 à 12.
- Sous le libellé, une phrase qui donne le prix : « Au-delà, les plus anciennes sont mises en
  veille et rechargées quand vous y revenez. Chaque conversation active garde son agent en mémoire
  (environ N Mo). »
- **Valeur par défaut** : 6, d'après la mesure (plus bas). Phrase : « … (environ 300 Mo). »

## Critères d'acceptation

- [x] **Mesure faite et notée dans la fiche** : mémoire d'un agent vivant (RSS du processus, Bob et
      OpenCode), au repos et après quelques tours. La valeur par défaut est choisie et justifiée.
- [x] Le réglage existe (Réglages › Conversation), de 2 à 12. Il s'applique tout de suite : en
      baissant, les agents en trop sont mis en veille, sans toucher aux conversations protégées
      (affichée, occupée, mère qui attend ses filles, fille en cours).
- [x] `BOBINE_MAX_LIVE` reste prioritaire, pour les essais.
- [x] La phrase du réglage donne l'ordre de grandeur mesuré.
- [x] Testé : unités de l'éviction avec le réglage (baisse, hausse, protégées), e2e `settings`
      (pas à pas), en clair, en sombre et en anglais.

## Mesure (2026-10-21)

À la main, hors des tests automatisés (script jetable : `initialize`, `session/new`, relevés à 1 s
d'écart, puis `ps` et `footprint` sur le processus de l'agent et ses descendants). Mac M4 Pro,
24 Go. Deux chiffres : le **RSS** (pages résidentes, partagées comprises : il compte deux fois le
binaire d'OpenCode, chargé par ses deux processus) et l'**empreinte** (`phys_footprint`, ce que
le Moniteur d'activité appelle « Mémoire »), plus juste pour la pression sur la mémoire.

| Agent | Moment | RSS | Empreinte |
|---|---|---|---|
| Bob 2.0.6 (`bob acp`, un processus Node) | lancé, avant `initialize` | 297-299 Mo | 268-269 Mo |
| Bob 2.0.6 | au repos après `session/new` (deux essais) | 307-327 Mo | 274-296 Mo |
| OpenCode 2.0.32 (`opencode acp`, deux processus) | lancé, avant `initialize` | 297 Mo | 164 Mo |
| OpenCode 2.0.32 | au repos après `session/new` | 604 Mo | 306 Mo |
| OpenCode 2.0.32 | après 1, 2, 3, 4 tours (`opencode/big-pickle`, 11 à 23 outils de lecture) | 634, 466, 351, 465 Mo | 265, 312, 320, 314 Mo |

- **Bob** : au repos seulement, sans aucun prompt (0 bobcoin) ; sa vraie connexion, un dossier
  déjà approuvé (`~/bob-essai`), session supprimée ensuite (`session/delete`).
- **OpenCode** : bac à sable de `pnpm opencode-probe` (`HOME` et `XDG_*` jetables), un dépôt git
  avec les modules de `src/shared` ; tours de lecture (lister, lire, chercher, proposer un test),
  permissions refusées. Le RSS oscille (ramasse-miettes de Bun), l'empreinte reste vers 300 Mo.
- **Ordre de grandeur retenu** : **environ 300 Mo par conversation active**, pour les deux agents.
  Ce qu'un vrai projet ajoute n'est pas compté : serveurs MCP de l'utilisateur, serveurs de
  langage d'OpenCode, longues conversations. Le coût dans Bobine elle-même (un `AgentHost`, le fil
  déjà gardé de toute façon) est négligeable à côté.

**Valeur par défaut : 6.** Aujourd'hui 4 agents, environ 1,2 Go ; 6 en coûtent environ 1,8 Go,
8 environ 2,4 Go. 6 laisse deux conversations de plus vivre leur journée sans rechargement, pour
environ 600 Mo, ce qui reste raisonnable sur un Mac de 8 Go. 8 en mangerait le tiers à lui seul, sans
compter que la limite est souple : les conversations protégées (affichée, occupée, mère qui attend,
filles en cours, jusqu'à 5 par mère) s'ajoutent quand elles débordent. Qui a 16 Go ou plus et
garde beaucoup de conversations ouvertes monte le réglage à 8 ou au-delà : la phrase sous le
libellé lui donne le prix.

## Plan

- **Module `src/main/conversations/live-agents.ts`** (nouveau, sorti de `manager.ts`, au bord de
  son plafond ESLint) :
  - `imposedLiveLimit(env)` : `BOBINE_MAX_LIVE` lu une fois (entier positif), sinon rien ;
  - `agentsToStop(live, max, kept)` : les agents à mettre en veille pour revenir à `max`, les moins
    récemment utilisés d'abord, jamais un agent gardé (limite souple, comme avant) ;
  - `releaseAgent(conversation)` : session fermée puis processus arrêté, commun à l'archivage et à
    la mise en veille (le même code était écrit deux fois).
- **`manager.ts`** : plafond = option `maxLive` (imposée, prioritaire) sinon le réglage `maxLive`.
  `evict()` passe par `agentsToStop` ; le gestionnaire suit déjà `settings.onChange` : quand le
  plafond baisse, `evict()` tout de suite, puis la liste est réémise (statut « arrêtée »). En
  hausse, rien à faire : les conversations en veille se rouvrent quand on y revient.
- **`index.ts`** : `maxLive: imposedLiveLimit(process.env)` (une ligne au lieu de trois).
- **Préférence** : `maxLive` dans `shared/preferences.ts` (6 par défaut, `MAX_LIVE_LIMITS` 2-12,
  validée), `settings.ts`, `settings-store.ts` (`preferences()`), entrées groupées après
  `maxChildren`.
- **Interface** : Réglages › Conversation, « Conversations gardées actives » avec un pas à pas
  (`settings-max-live`), avant celui des filles ; phrase du prix sous le libellé ; entrée de la
  recherche des réglages (mots-clés : mémoire, agents vivants…, pas « veille », qui doit mener au
  seul « Empêcher la mise en veille ») ; i18n fr/en, glossaire de `docs/traduction.md`.
- **Tests** : `live-agents.test.ts` (choix, `BOBINE_MAX_LIVE`) ; `manager.test.ts` (baisse,
  hausse, protégées, plafond imposé prioritaire) ; `preferences` (validation) ; e2e `settings`
  (pas à pas, valeur gardée), en clair, en sombre et en anglais ; `filles` relancée
  (`BOBINE_MAX_LIVE=2`).
- **Docs** : `architecture.md`, `docs/README.md` (`BOBINE_MAX_LIVE`), fiche.

## Journal

- 2026-10-21 — Fiche créée (lot A des irritants). Rien n'est codé.
- 2026-10-21 — Mesure faite (plus haut) : environ 300 Mo par agent vivant, Bob comme OpenCode ;
  valeur par défaut 6. Bob mesuré au repos seulement, sans prompt (0 bobcoin).
- 2026-10-21 — Codé, selon le plan :
  - `conversations/live-agents.ts` (nouveau) : `agentsToStop` (choix des agents à mettre en
    veille, gardés exclus, limite souple), `releaseAgent` (arrêt commun à l'archivage et à la
    mise en veille), `imposedLiveLimit` (`BOBINE_MAX_LIVE`, entier positif). `manager.ts` passe
    de 1042 à 1039 lignes comptées (plafond 1050), `index.ts` de 843 à 842 (plafond 850).
  - `manager.ts` : plafond = option `maxLive` (imposée) sinon le réglage ; le gestionnaire suit
    `settings.onChange` et, quand le plafond baisse, met en veille aussitôt et réémet la liste.
    Gardées comme avant : affichée, ouverte à côté, occupée, agent qui démarre, `keepLive`
    (fille en cours, mère qui attend ses filles, message de l'app pas encore parti).
  - Préférence `maxLive` (2 à 12, 6), Réglages › Conversation (pas à pas `settings-max-live`,
    avant celui des filles), recherche des réglages, i18n fr/en, glossaire.
  - **Écart au plan** : aucun dans le code. Rien ne change côté ACP (l'arrêt et la réouverture
    sont ceux de la fiche 043), rien à confronter de plus à « Compatibilité Bob ».
- 2026-10-21 — Testé :
  - unités : `live-agents.test.ts` (choix, gardés, limite souple, `BOBINE_MAX_LIVE`, arrêt),
    `manager.test.ts` (baisse : mise en veille aussitôt et liste réémise ; hausse : rien ne
    s'arrête ni ne redémarre ; affichée, à côté, occupée et `keepLive` épargnées ; plafond imposé
    prioritaire), `preferences.test.ts` (2 à 12, 6). Les tests du gestionnaire échouent bien sans
    l'abonnement au réglage, ou avec le réglage prioritaire sur `BOBINE_MAX_LIVE`.
  - `./scripts/verify` vert (1170 tests).
  - e2e `settings` (pas à pas de 6 à 2, « moins » grisé à 2 ; avec trois agents vivants, baissé à
    2, la plus ancienne au repos passe en veille ; valeur enregistrée) et `filles`
    (`BOBINE_MAX_LIVE=2`), en clair, en sombre et en anglais. Captures `83-conversation`
    regardées : la ligne tient sans défilement, sous l'aperçu et avant les filles.
  - Pas fait ici : la suite e2e complète (avant le push, par la session qui fusionne) et un essai
    à la vraie souris.
- **Ligne de CHANGELOG proposée** (à intégrer à la fusion) :
  - fr (« Prochaine version ») : « Réglages › Conversation : choisissez combien de conversations
    restent actives (6 par défaut, de 2 à 12). Au-delà, les plus anciennes sont mises en veille et
    rechargées quand vous y revenez ; chacune garde son agent en mémoire, environ 300 Mo. »
  - en (« Next version ») : “Settings › Conversation: choose how many conversations stay active
    (6 by default, from 2 to 12). Beyond that, the oldest ones are put to sleep and reloaded when
    you go back to them; each one keeps its agent in memory, about 300 MB.”
