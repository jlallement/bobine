# 254 — rc : corrections de la recette Bob courte (D1 à D3, gitleaks)

- **Statut** : en cours
- **Dépend de** : 157 (coût hors protocole), 180 (aparté), 246 (message de commit rédigé, ADR-0056),
  249 (accord par site), 130 (journal de consommation), 016 (questions à choix)
- **Agents** : les deux — D1 touche surtout Bob (coût hors protocole, `costSource` du profil),
  mais le correctif est générique (toute source de coût du profil, et le coût par ACP) ; D2 et D3
  ne dépendent d'aucun agent.

## Pourquoi

La recette Bob courte avant la rc
([2026-11-19-recette-bob-rc1.md](../recettes/2026-11-19-recette-bob-rc1.md)) a trouvé deux
défauts gênants et deux cosmétiques. Une dépense en Bobcoins (la rédaction du message de commit)
échappe au compte et au plafond (D1) ; la carte « Site web » laisse envoyer une réponse vide qui
vaut refus, avec une option qui paraît choisie (D2) ; des interrupteurs des Réglages n'ont pas de
nom accessible (D3). En plus, le job « gitleaks (historique) » de la CI est rouge sur `main`.

## Critères d'acceptation

- [ ] gitleaks (même commande que `ci.yml`, tout l'historique) : aucune fuite ; faux secrets des
      lots rc marqués en ligne et leur empreinte historique dans `.gitleaksignore`.
- [ ] D1 : le coût de la session jetable de rédaction est lu **avant** sa suppression, même écrit
      par l'agent après sa réponse (attente du changement, bornée), puis ajouté à la conversation
      (total, plafond) et au journal de consommation (« Mon activité »). Même chose pour un agent
      qui donne son coût par ACP.
- [ ] D2 : aucune option d'une carte de questions ne paraît choisie sans l'être ; « Envoyer » reste
      inactif tant que rien n'est choisi (aucune réponse vide envoyée), pour toutes les cartes du
      composant (site web, commande, `ask_user`, questions de l'agent).
- [ ] D3 : chaque interrupteur des Réglages a un nom accessible.
- [ ] D4 : cause probable écrite ici (pas de correctif avant la rc).
- [ ] Testé contre l'agent factice (`--cout-bob --bob-db`), un test rouge sans correctif par point ;
      e2e `browser` (et suites touchées) vertes, captures regardées.

## Plan

0. **gitleaks** : `// gitleaks:allow — fake value for tests` en fin des deux lignes trouvées
   (`src/main/log.test.ts:93`, `src/main/secret-scan.test.ts:51`) et leurs empreintes
   `4b91b86…:<fichier>:generic-api-key:<ligne>` dans `.gitleaksignore` ; `gitleaks git` sur tout
   l'historique et `gitleaks dir` sur l'arbre.
1. **D1** — `src/main/conversations/commit-draft.ts` : les évènements de coût (`usage-report`,
   `usage_update`) arrivés après la fin de la rédaction sont encore lus ; à la fermeture, attente
   du coût (fin d'attente dès qu'un coût arrive après la fin du tour, borne fixe sinon), puis
   `aside-cost` posé, **puis** la session supprimée. `src/main/usage/journal.ts` : `aside-cost`
   écrit une ligne du journal (conversation, agent, dossier), comme un tour. Tests :
   `commit-draft.test.ts` (agent factice `--cout-bob --bob-db`, coût écrit 300 ms après la
   réponse ; agent factice qui donne son coût par ACP), `journal.test.ts`.
2. **D2** — `QuestionCard.tsx` : aucune ligne en surbrillance avant un geste (↑/↓, survol) ;
   « Envoyer » inactif et envoi refusé (clavier compris) tant qu'aucune question n'a de réponse.
   Tests de composant ; e2e `browser` : la carte « Site web » sans choix ni « Envoyer » actif ;
   e2e `questions` si touchée.
3. **D3** — `aria-label` (clé du libellé de la ligne, fr et en) sur les interrupteurs sans nom :
   Conversations (plafond), Général (veille, message de commit, astuces), Apparence (ligatures,
   présentation), Notifications (3), Confidentialité (cookies), Mémoire, Données (agents neufs).
   Test : chaque case à cocher de chaque section des Réglages a un nom accessible.
4. Fiche, index, CHANGELOG fr/en, `./scripts/verify`, e2e des suites touchées.

## Journal

- 2026-11-19 : fiche ouverte, plan écrit.
