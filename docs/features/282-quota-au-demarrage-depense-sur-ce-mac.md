# 282 — Quota de Bob dès le lancement ; « Dépense sur ce Mac » expliquée (D3 de la recette 1.0)

- **Statut** : fait
- **Dépend de** : 091 (quota de Bob, ADR-0017), 205 et 242 (quota lu quand l'agent est prêt,
  ADR-0054), 144 et 147 (Mon activité, « {agent} sur ce Mac »), 246 et 254 (message de commit
  rédigé, coût des sessions à part)
- **Agents** : les deux pour le mécanisme (point d'extension générique `quotaSource`, `costSource`) ;
  seul Bob lit un quota et une dépense locale aujourd'hui
- **Trouvé par** : recette Bob 1.0 du 2026-11-24 (D3,
  [rapport](../recettes/2026-11-24-recette-bob-1-0.md)) et remarque de l'utilisateur (« quand Bob
  démarre, on n'a pas directement le quota des Bobcoins restants en bas à gauche »)

## Pourquoi

1. **D3** : Mon activité affiche 2,1363 Bobcoins (journal de Bobine, rédaction du message de commit
   comprise) et, plus bas, « IBM Bob sur ce Mac › Aujourd'hui » 2,1149 (base de Bob). L'écart,
   0,0214, est le coût de la rédaction.
2. **Quota** : au démarrage de Bob, rien sous son nom en bas à gauche ; le quota n'arrive qu'après.

## Causes (lues dans le code, confrontées au journal réel et à la sonde)

1. **D3** — confirmée par le code. La rédaction du message de commit tourne dans une session
   jetable que Bobine supprime chez Bob (`session/delete`, `commit-draft.ts`) ; Bob efface alors sa
   ligne `tasks`, donc son coût. Bobine lit ce coût **avant** la suppression et l'écrit dans son
   journal (`stopReason: aside`, fiche 254) : Mon activité le compte. « Dépense sur ce Mac » est lue
   dans la seule base de Bob (`readBobSpend`) : la ligne a disparu. Même chose pour les apartés
   (`aside.ts`), l'essai de l'accueil et une conversation supprimée avec sa session chez Bob.
   Cette ligne n'a d'ailleurs jamais visé le même total : elle compte aussi `bob` en terminal, et une
   tâche utilisée dans la période en entier (son aide le dit déjà).
2. **Quota** — le quota **est déjà demandé dès que l'agent est prêt** (`quotaOnReady`, fiche 205 :
   le `status: ready` de la session ouverte), pas après le premier tour. Mais Bob ne le donne pas
   par ACP : il faut lancer `bob chat`, taper `/status` et relire l'écran, ce qui prend 4 à 5 s
   (4,3 s à 7,3 s dans `~/Library/Logs/Bobine/main.log`, **18,5 s** le 2026-11-16), après le
   démarrage de `bob acp` et l'ouverture de la session. Rien ne s'affichait entre-temps, et le
   quota lu n'était gardé qu'en mémoire : chaque lancement repartait de rien. Si l'utilisateur
   envoie son premier message tout de suite, le quota arrive donc pendant ou après le premier
   tour.
   - **Pas de voie plus rapide sans frais** : `pnpm bob-probe` du 2026-11-24 (Bob 2.1.0, 0 bobcoin)
     — `initialize` n'annonce ni budget ni consommation (aucun `_meta`) ; `docs/acp.md` « Budget du
     compte » : rien par ACP, rien dans `bob.db`. Lire plus tôt (avant que Bob soit prêt) lancerait
     `bob chat` pour un Bob peut-être pas connecté, ce qu'ADR-0054 écarte.
   - Deux cas où il n'apparaît pas du tout, inchangés : profil jetable dont Bob voit le vrai `~/.bob`
     (`pnpm pilote`, `--profil-temporaire` : jamais lu, ADR-0054 — c'est le cas de la recette 1.0) ;
     lecture en échec (au-delà de 20 s, par exemple), relancée au plus tôt 15 min plus tard, quand
     l'agent se montre prêt de nouveau (fin d'un tour).

## Décision

- **D3 : expliquer, ne pas additionner.** « Dépense sur ce Mac » reste ce que dit la base de Bob ;
  son aide ajoute que les sessions que Bobine a supprimées chez Bob (message de commit rédigé,
  apartés, conversations supprimées avec leur session) n'y sont plus, et que Mon activité les
  compte. Ajouter à la ligne les coûts lus avant suppression demanderait un registre de plus
  (sessions supprimées, coût, date) et mêlerait deux sources dans une ligne dont l'intérêt est
  justement d'être celle de Bob ; l'écart ne serait de toute façon pas nul (terminal, tâches comptées
  en entier).
- **Quota : montrer le dernier relevé dès le lancement.** Le dernier quota lu de chaque agent est
  gardé dans `userData/agent-quotas.json` et affiché dès le lancement suivant, s'il a été lu dans le
  mois en cours (le budget de Bob est mensuel) et que l'agent est là ; le détail dit « lu le
  23 novembre à 09:30 » quand ce n'est pas du jour. Il ne remplace jamais la lecture du lancement :
  elle part toujours quand l'agent est prêt, et son résultat remplace le relevé gardé. Rien de plus
  n'est lancé chez l'agent, rien n'est lu en profil jetable (dossier de données neuf, et
  `isAvailable` faux), rien n'est écrit en profil en lecture seule (fiche 196).

## Critères d'acceptation

- [x] Aide de « Dépense sur ce Mac » (et « sur cet ordinateur ») qui explique l'écart, en français
      et en anglais.
- [x] Dernier quota lu montré dès le lancement, au nom et dans l'unité du profil ; relevé d'un mois
      précédent, d'un agent absent ou sans quota, ou douteux : écarté.
- [x] La lecture de ce lancement part quand même à l'agent prêt, et une seule fois.
- [x] Date de lecture dite quand elle n'est pas du jour.
- [x] Testé contre l'agent factice (scénario : `MOCK_AGENT_QUOTA=1`, relance avec
      `MOCK_QUOTA_SLOW_MS=8000 MOCK_QUOTA_USED=900`, suite e2e `quota`).

## Plan

- `src/main/agent/quota.ts` : `QuotaMemory`, `quotaMemoryFile` (écriture atomique, lecture seule
  respectée), `rememberedQuotas` (filtre) ; `QuotaReader` charge le relevé gardé, ne compte comme
  « déjà lu » que la lecture de ce lancement (`readNow`), enregistre après chaque lecture réussie.
- `quota-setup.ts`, `index.ts` : `memoryFile` sous `userData`, `readOnly` du profil.
- `AgentQuotaStatus.tsx` : « lu le {date} à {heure} » (`quota.sourceEarlier`).
- `fr.json`, `en.json` : `quota.sourceEarlier`, aides `usage.board.account.spendHint` (et la
  variante « cet ordinateur »), description du quota dans Réglages › Agents (« lus au démarrage »
  n'était plus vrai depuis la fiche 242).
- Essais : `quota.test.ts`, `AgentQuotaStatus.test.tsx`, suite e2e `quota` (relance du même
  profil).
- Docs : `docs/acp.md` (« Consommation », « Budget du compte »), `docs/agents.md`,
  `docs/mock-agent.md`. Aucune dépendance nouvelle.

## Reste à confirmer avec le vrai Bob

- **Quota** (0 bobcoin, aucun tour) : relancer Bobine (pas en profil jetable) avec une conversation
  Bob ; le quota de la fois d'avant doit être sous « IBM Bob » dès l'ouverture de la fenêtre, puis
  `main.log` doit montrer « Quota de IBM Bob : agent prêt… » et « Quota de IBM Bob : x / y
  bobcoins (n ms) » quelques secondes après « Agent lancé (bob, …) ». Une ligne « Quota de IBM Bob
  non lu » dirait que la lecture échoue (délai de 20 s dépassé, par exemple) : c'est elle qui
  ferait attendre 15 min, et il faudrait alors la trace (`n ms`, raison).
- **D3** : rien de payant à refaire ; la cause est la suppression documentée (`session/delete`
  efface la tâche, `docs/acp.md`).

## Journal

- 2026-11-24 : causes établies (code, `main.log` réel, `pnpm bob-probe` sur Bob 2.1.0 :
  contrat 12/12, réponses identiques à la référence). D3 : aide de la ligne. Quota : dernier relevé
  gardé et montré au lancement. Écart au plan initial de la demande (« faire lire le quota dès que
  l'agent est prêt ») : c'était déjà le cas ; le gain sans frais est d'afficher le relevé précédent
  pendant la lecture. Pas d'e2e en local (consigne) : la suite `quota` tourne sur GitHub.
