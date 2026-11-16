# 232 — OpenCode 2.3.0 : sous-agents toujours en arrière-plan

- **Statut** : en cours — app, agent factice, e2e et docs faits ; **référence de la sonde pas encore refaite** (quota gratuit de Zen épuisé), rien de poussé ni fusionné
- **Dépend de** : 078 (OpenCode 2), 122 (sous-agent en arrière-plan), 127 (D25), 139 (traces),
  140 (marque générique), 198 (sonde hebdomadaire)
- **Agents** : OpenCode pour le relevé et le profil (`testedVersions`) ; les corrections de l'app
  sont génériques (fil, suivi des sous-agents, hôte d'agent), sans rien de propre à OpenCode hors
  de `opencode-contract.ts` et `opencode-subagents.ts` (commentaires seulement) — ADR-0011.

## Pourquoi

OpenCode 2.3.0 est installé, et Bobine le disait « version non testée » (`testedVersions` du profil
s'arrêtait à 2.2.5). La sonde complète du tech lead (16/11) n'a trouvé qu'un vrai écart : le
sous-agent (`childKinds`, `resultTag`). Les notes de version disent pourquoi : **les sous-agents
tournent toujours en arrière-plan**, rendent leur session tout de suite et font leur rapport au
parent quand ils deviennent inactifs ; plusieurs peuvent tourner en même temps.

## Contrat réel relevé (2026-11-16)

`opencode acp` 2.3.0, modèle gratuit `opencode/big-pickle`, `HOME` et `XDG_*` jetables (comme la
sonde), capacités client de Bobine. Captures brutes horodatées (un sous-agent, deux en parallèle,
puis `session/load` dans un autre processus), et traces nettoyées de la sonde
(`src/main/agent/__traces__/opencode-2.3.0/sous-agent*.ndjson`, `sous-agents-en-parallele.ndjson`).

| Moment | Observé |
|---|---|
| Lancement | `tool_call` « subagent » `pending {}` → `in_progress` avec `rawInput: { agent, description, prompt }` → **aussitôt** `completed`, `rawOutput.metadata: { sessionID, status: "running", truncated: false }`, texte « The subagent is working in the background (sessionID: ses_…). You will receive a <subagent> message when it goes idle, and again after each later round of work. DO NOT sleep, poll… » |
| Pendant le tour du parent | travail du sous-agent relayé dans le flux du parent, `_meta["opencode/child-session"] = { id, parentID, depth, title = description }`, outils `ses_…:<id>` |
| Fin du tour du parent | `end_turn`, `usage_update` ; **plus rien du sous-agent** ensuite (un sous-agent encore au travail : sa lecture et sa réponse n'arrivent jamais en direct) |
| Rapport | sous-agent fini pendant le tour : le parent continue dans ce tour. Fini après : **le parent répond de lui-même, hors de tout `session/prompt`** (≈ 10 s après la fin du tour) : deux `agent_message_chunk`, sans `usage_update`, sans fin de tour |
| Rechargement (`session/load`, autre processus) | parent : consigne, carte `completed` + `running` (jamais mise à jour), réponses en messages séparés (réflexions vides entre elles) ; **le message `<subagent>` reçu par le parent n'est pas rejoué**. Sous-agent : « You are a subagent spawned by another session.\n<consigne> », ses outils, sa réponse |
| Deux en parallèle | deux cartes, deux sessions ; chaque `sessionID` nommé par son outil **avant** le premier travail relayé ; titres de session = descriptions ; rapports dans le tour ou après, selon le moment |

Non observé (rien n'en est supposé) : le rapport « still running » d'un sous-agent inactif dont le
propre travail d'arrière-plan continue ; un deuxième rapport du même sous-agent (« again after each
later round of work »).

## Ce que faisait Bobine avant (captures « avant », agent factice qui rejoue ce relevé)

La détection d'arrière-plan de la fiche 122 (`metadata.status: "running"`) tenait déjà : cartes
« en cours » après le tour, puis finies avec leur réponse. Trois défauts :

1. **Travail faux sous la carte** : seul ce qui était relayé pendant le tour y était ; la lecture
   commencée restait « en cours » pour toujours, même sous une carte finie, et « Voir son travail »
   n'était pas proposé (il y avait déjà un travail).
2. **Réponse collée** : la réponse hors tour du parent se collait au message précédent
   (« …dès que j'ai leurs rapports.Les deux mots de code : … »), alors qu'au rechargement OpenCode
   la rejoue en message à part.
3. **Fin en retard** : la carte finissait à la relecture suivante de la session (2, 3, 5, 8, 13,
   20, puis 30 s) — jusqu'à 30 s après que le parent avait déjà donné la réponse.

## Critères d'acceptation

- [x] Contrat réel rejoué (sonde complète) et capturé (premier retour, rapport différé, deux en
      parallèle, rechargement)
- [x] Carte « en cours » tant que le rapport n'est pas arrivé, puis réponse et travail **complet**
- [x] « Voir son travail » juste avec deux sous-agents en parallèle (chacun le sien)
- [x] Réponse hors tour du parent : un message à part, aussi après redémarrage
- [x] Comportement 2.2.5 / 2.0.32 inchangé (scénarios et e2e existants verts)
- [x] Agent factice : `sous-agent-arriere-plan-2-3`, `sous-agents-arriere-plan-2-3`, étape
      `after-turn`
- [x] Point « création » tranché (voir Journal)
- [ ] Référence de la sonde refaite sur 2.3.0 (`--traces --accept`) : **pas faite**, quota gratuit
      épuisé ; à relancer seule
- [x] `2.3.0` dans `testedVersions`, `docs/agents.md` et section OpenCode de `docs/acp.md`

## Plan

1. Captures réelles (script jetable hors dépôt) + sonde `--traces`.
2. Agent factice : étape `after-turn` (étapes jouées hors tour, enregistrées pour `session/load`),
   scénarios 2.3.0 (`scenarios-opencode-2-3.mts`).
3. e2e `subagents` : bloc 2.3.0 (deux en parallèle, travail de chacun, fin, réponse à part,
   redémarrage) joué **avant** le correctif pour les captures « avant ».
4. Correctifs génériques :
   - `transcript.ts` : une réponse datée par sa fin de tour (`at`) est close ; un morceau suivant
     commence un autre message ;
   - `subagent-tracker.ts` : à la fin d'un sous-agent en arrière-plan, son travail relu part avec
     elle (`emit(…, work)`) ; `nudge()` avance la prochaine relecture au premier délai ;
   - `agent-host.ts` : un `agent_message_chunk`, `agent_thought_chunk` ou `tool_call` reçu hors
     tour (ni tour en cours, ni rejeu) appelle `nudge()` ;
   - `transcript.ts` / `subagent.ts` : `subagent-run.work` remplace `work` sous la carte, outils et
     messages seulement, numérotés à la suite du fil (`renumberedWork`) ;
   - `turn-duration.ts`, `TurnSummary.tsx` : le tour finit avec sa réponse datée, pas avec une
     réponse hors tour sans heure qui la suit (sinon le bilan « Terminé » disparaissait).
5. Sonde : rapport attendu jusqu'à 2 min après le tour, sondage « sous-agents en parallèle »,
   contrôles de contrat (suivi jusqu'à la fin ; sessions nommées avant le travail), appel
   d'écriture choisi par `kind: edit` ; `--traces --accept`.
6. Docs, changelog, profil.

Aucune nouvelle dépendance. Pas d'ADR : la décision de suivre un sous-agent par sa session
(fiche 122) est inchangée ; la fiche ne fait que la compléter.

## Journal

### 2026-11-16

- **Relevé** : voir « Contrat réel relevé ». La sonde complète (avant changement) : contrat vert,
  écarts `sous-agent.childKinds` (`["agent_message_chunk","tool_call","tool_call_update"]` →
  `["tool_call"]`) et `resultTag` (`"subagent"` → `null`), 88 « nouveau ». `childKinds` dépend du
  moment où le tour finit (le travail n'est relayé que pendant le tour) : remplacé par
  `childRelayed` et `childAfterTurn` (faux en 2.3.0 : rien après le tour).
- **Point « création » tranché** : ce n'est **pas** un changement d'OpenCode. Dans les traces
  2.3.0, le modèle fait d'abord un `read` de chaque fichier (même `nouveau.txt`, qui n'existe pas :
  `failed`), puis `write`, `edit`, `write`, toujours `kind: edit` comme en 2.2.5 (traces 2.2.5 :
  `write edit write`, sans `read`). La sonde prenait le **premier** appel qui touche le chemin, donc
  ce `read` (« Read file notes.md… »). Corrigé : elle prend l'appel `kind: edit` qui touche le
  chemin (à défaut, comme avant). Relancée : `kind: "edit"`, « Created file successfully »,
  « Wrote file successfully », « Edited notes.md (1 replacement) », diff et `metadata.files`
  pour `edit`.
- **Avant / après** (e2e `subagents`, clair et sombre) : avant le correctif, les trois contrôles
  2.3.0 sont rouges (travail incomplet, réponse collée, redémarrage) ; captures dans
  `side-session-notes/…/232-opencode-2-3/avant/`. Après : voir ci-dessous.
- **Sonde « sous-agents en parallèle »** : un premier passage a dit `routed: false` parce que le
  contrôle exigeait titre de session = description ; ce n'est pas ce dont l'app dépend (elle range
  par la session nommée par l'outil, le titre n'est qu'un secours). Contrôle aligné sur le contrat
  de l'app : session de la carte nommée avant le travail relayé, identifiants préfixés.
- **Bilan « Terminé » perdu** (vu sur la capture « après ») : une fois la réponse hors tour à part,
  elle devenait « la dernière réponse du tour », sans heure : plus de durée, plus de bilan.
  Corrigé à la cause dans `turnDurations` (une réponse sans heure ne remplace pas la réponse datée
  du tour) et `lastTurnFacts` (réponse qui a une durée) ; contrôle e2e ajouté.
- **Faits d'une course** : en 2.3.0, que le travail d'un sous-agent soit relayé dépend du moment où
  le tour du parent finit (un passage : rien de relayé, le tour avait fini en 3,4 s). Les formes
  de ce travail (`childMarker`, `childToolIdsPrefixed`, `childTitleIsDescription`, `routed`) valent
  `null` quand rien n'a été relayé ; le contrôle est alors « ? à relancer » et non ✗ ; et elles ne
  sont jamais comparées aux attentes (`TIMING_DEPENDENT`, `comparable`, `opencode-probe.ts`).
- **Incident de sonde** : un lancement que je croyais raté (`&` détaché) a tourné en même temps
  qu'un second : sorties mêlées, traces écrasées, et quota gratuit de Zen épuisé (« Free usage
  limit reached ») pour les derniers sondages. Attentes et traces de ces passages jetées
  (`git checkout`, dossier supprimé) ; quota revenu, la sonde a été relancée seule.

### 2026-11-16 (soir) — questions interactives (outil `question`)

Demandé par Jérôme. Sonde élargie (`probeQuestions` : choix, texte libre, plusieurs questions et
choix multiple, refus, annulation, question d'un sous-agent ; la réponse est construite par
`answerContent`, comme dans l'app ; contrôles de contrat ajoutés). **Pas encore tournée avec un
modèle** : quota gratuit épuisé, et le passage du tech lead avec `openai/gpt-6.1-sol` n'avait pas
de connexion dans le profil jetable (« model not found »).

**Essai réel de bout en bout** dans Bobine (`pnpm pilote`, profil temporaire, OpenCode 2.3.0,
`openai/gpt-6.1-sol` du compte de l'utilisateur, journal ACP Trace ; captures claires et sombres
dans `side-session-notes/…/232-opencode-2-3/questions/`, avec le journal) :

| Forme | Observé (ACP) | Dans Bobine |
|---|---|---|
| (a) choix unique | `q0` `oneOf`, `q0_custom` ; réponse `{ q0: "Rust" }` ; `completed`, `metadata.answers` | carte, un clic envoie ; « → Rust » dans le fil ; « Tu préfères Rust. » ✓ |
| (b) texte libre | réponse `{ q0_custom: "Zig, pour sa simplicité" }` | champ « Autre… » ; « Tu préfères Zig, pour sa simplicité. » ✓ |
| (c) deux questions, choix multiple | un seul appel, `multiple: true` pour la seconde ; réponse `{ q0: "Go", q1: ["Vim","Emacs"] }` | questions pas à pas (« Suivant »), cases multiples ; réponse utilisée ✓ |
| (d) refus (« Passer ») | `decline` → `failed` « The user dismissed this question », tour **`cancelled`** | « → Passé », « Réponse interrompue. » ; rien en attente ; le message suivant passe ✓ |
| (d') Stop pendant la question | `session/cancel` + `cancel`, `$/cancel_request`, `failed`, `cancelled` | « → Annulé », rien en attente ✓ |
| (e) sous-agent en arrière-plan | pas d'outil `question` pour lui (il le dit) ; il appelle `ask_user` de Bobine par `execute`, **après** la fin du tour du parent ; réponse rendue au sous-agent, rapport, réponse du parent hors tour | carte de question ouverte après le tour, dans la bonne conversation (serveur MCP de la conversation) ; « → vert » ; carte « Sous-agent · 1 fini » ; réponse hors tour à part, « Terminé » gardé ✓ |

Aucun défaut de Bobine trouvé sur ces formes. Agent factice : `questions-opencode-2-3`,
`question-ecartee-opencode-2-3` (nouvelle étape `stop-cancelled`), `sous-agent-question-2-3`
(étape `ask-user` `silent` : appel MCP direct, sans carte ni autorisation relayées) ; tests :
`questions-opencode-2-3.test.ts` (formes renvoyées exactement comme relevées),
`agent-host-opencode-2-3.test.ts` (refus → `cancelled`, puis la suite ; question d'un sous-agent
après le tour, répondue et rapportée).

**Sous-agents en arrière-plan, essai réel** (même jour, `openai/gpt-6.1-sol`, captures `7-*` et
journal `agents-2026-11-16-sous-agents.log`) : deux sous-agents `explore` en parallèle, tour du
parent fini en 10 s ; les deux lignes « en cours » après le tour, puis « 2 finis » avec leur
réponse ; « Terminé en 10 s » gardé. **Défaut observé** : le parent a répondu **deux fois** hors
tour (un rapport après l'autre : « Premier mot reçu ; j'attends le rapport du second sous-agent. »,
puis la liste des deux mots de code), et les deux réponses sont **collées** en un message, ce qui
casse aussi le Markdown (« sous-agent.- `secret.txt` »). Rien dans ACP ne les sépare : entre elles,
ni `usage_update`, ni fin de tour, ni réflexion ; seulement une pause.

**Correctif des réponses collées** (même soir) : un vrai signal existe, pas besoin d'un délai.
OpenCode 2.3.0 met `messageId` (ACP) sur **chaque** morceau : un identifiant par message
(`msg_…`), y compris ses réponses hors tour, et `msg_…:reasoning:0` pour la réflexion (relevé dans
les captures brutes `un`, `un-reprise`, `deux-reprise` ; 2.2.5 aussi, traces `__traces__/opencode-
2.2.5`). Le champ est stable dans le schéma ACP, SDK 2.4 (`main`) comme 2.7 (`claude/deps-lot-2`) :
« a change in `messageId` indicates a new message has started ». Rien d'autre ne sépare les deux
réponses (ni `_meta`, ni `user_message_chunk`, ni outil, ni `usage_update`). Correctif générique
(`reply-boundary.ts`) : un morceau dont le `messageId` diffère de celui du message en cours en
commence un autre, pendant un tour comme hors tour ; sans `messageId` (Bob 2.0.9 n'en envoie pas,
traces), rien ne change, et une pause ne coupe jamais un message. Agent factice :
`sous-agents-deux-rapports-2-3` (deux réponses hors tour enchaînées, `messageId` différents) ;
tests qui échouent sans le correctif (`subagent-background.test.ts`,
`agent-host-opencode-2-3.test.ts`) ; la sonde vérifie que chaque morceau a son `messageId`.

## Reste à faire

- **Questions** : faire tourner `pnpm opencode-probe --only question` (modèle gratuit quand le quota
  revient, ou `gpt-6.1-sol` avec une connexion posée dans le profil jetable par le tech lead).
  Schéma exact du choix multiple : tronqué au journal Trace (`items.anyOf` supposé d'après le
  standard ACP, reconnu par Bobine pendant l'essai ; `q1_custom` non vu). Réponse d'un sous-agent
  donnée après 45 s : `ask_user` rend « not answered yet » et Bobine envoie la réponse **au
  parent** en message (fiche 028) — non essayé avec un sous-agent. Proposition à maquetter, non
  faite : après « Passer », dire « OpenCode s'est arrêté après la question passée » plutôt que
  « Réponse interrompue ».

- **Sonde complète sur 2.3.0, seule, puis `--traces --accept`** quand le quota gratuit de Zen
  revient (« Free usage limit reached » depuis 21 h 30 le 2026-11-16). Ce qui est déjà vérifié sur
  2.3.0 : un passage complet propre **avant** les changements (contrat vert, 25 points), puis, sur
  le code final, `--only sous-agent`, `--only création`, `--only "en parallèle"` (contrôles
  verts, rapport hors tour vu, création en `kind: edit`). Ensuite : mettre à jour
  `opencode-probe.test.ts` (version enregistrée `2.0.32` → `2.3.0`) et la ligne 2.3.0 du suivi
  dans `docs/acp.md`, régénérer les instantanés de `trace-replay.test.ts` et les relire.

- Prise en charge de plusieurs versions à la fois :
  [ADR-0053](../adr/0053-plusieurs-versions-des-agents.md), **accepté** le 2026-11-16. Sa mise en
  œuvre fera l'objet d'une fiche à part : fenêtre de versions dans `testedVersions` (dernière
  mineure et les deux précédentes), références de la sonde et traces par mineure, veille
  hebdomadaire en CI des versions publiées (npm `@ibm/bob`, releases d'`anomalyco/opencode`). En
  attendant, `--accept` remplace toujours la référence unique (la 2.0.32 serait perdue au passage
  complet sur la 2.3.0).

- Mettre à jour progressivement « son travail » pendant qu'un sous-agent tourne après le tour
  (aujourd'hui : le direct s'arrête avec le tour, le travail complet arrive à sa fin). Remplacer
  le direct par une relecture pendant le tour mélangerait deux numérotations d'outils
  (`ses_…:<id>` en direct, `<id>` relu) : à concevoir à part.
- Réponse hors tour : ni heure (pas de fin de tour), ni coût (OpenCode n'envoie pas de
  `usage_update`). Deux réponses hors tour de suite : séparées par `messageId` (voir Journal) ;
  pour un agent sans `messageId`, elles resteraient un seul message.
- Rapport « still running » (2.3.0) et rapports répétés d'un même sous-agent : non observés, rien
  n'en est lu.
- Hors périmètre, fiches à part : l'extension `_session/steering` (réorienter un tour en cours,
  annoncée dans `_meta.steering.supported`), `Exit code: N`, mTLS des fournisseurs
  (`settings.tls`).
