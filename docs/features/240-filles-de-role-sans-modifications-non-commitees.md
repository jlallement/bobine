# 240 — Filles de rôle : le travail non commité de la mère n'est pas dans leur worktree

- **Statut** : à faire
- **Dépend de** : 223 (rôles), 110 (cycle des worktrees), 097 (conversations filles)
- **Agents** : les deux (comportement de Bobine, indépendant de l'agent)
- **Trouvé par** : recette « POC complet » du 2026-11-17, étape 3
  ([rapport](../recettes/2026-11-17-poc-complet-opencode.md), défaut D1)

## Pourquoi

Le geste naturel « @Expert UX/UI @Architecte back-end donnez votre avis sur le plan et sur
`maquettes/b.html` » échoue sans que l'utilisateur comprenne pourquoi. Un rôle qui n'est pas en
lecture seule part dans un worktree créé **depuis le dernier commit** ; le travail en cours de la
mère (ici 17 fichiers non commités, dont la maquette) n'y est pas. Les deux filles ont rendu un
compte rendu vide (« seul `README.md:1-3` est présent, et `maquettes/b.html` est introuvable »).
Bobine le sait (avis « 17 modifications non commitées du dossier d'origine ne sont pas ici. »
en tête du fil de la fille, fiche 110), mais ne le dit **ni avant l'envoi** (la ligne « Partira à
2 rôles, une conversation fille chacun, en parallèle » ne prévient de rien) **ni dans la mère**,
où l'utilisateur lit les comptes rendus.

Gravité : **sérieux** (l'étape ne se finit qu'avec une intervention qu'un utilisateur ordinaire
ne trouverait pas : répondre dans chaque fille avec le chemin du dossier d'origine). Vu 2 fois sur
2 (les deux filles du même envoi).

## Ce qui a été observé (2026-11-17, Bobine 1.0.0-beta.7, OpenCode 2.3.0, openai/gpt-6-luna)

- Dossier `taches` : un commit initial (`README.md`), 17 fichiers non commités écrits par la mère.
- `main.log` :

  ```text
  2026-11-17T20:00:51.593Z INFO  Agent lancé (opencode, 42c012da) : opencode acp dans ~/…/taches/.worktrees/20261117-2100-d022 (pid 35016)
  2026-11-17T20:00:51.710Z INFO  Agent lancé (opencode, f6294b77) : opencode acp dans ~/…/taches/.worktrees/20261117-2100-38f3 (pid 35037)
  ```

- `agents.log` (extrait) :

  ```text
  2026-11-17T20:00:51.798Z [42c012da · opencode] → session/new #1 1 serveur(s) MCP (314 o)
  2026-11-17T20:00:52.286Z [42c012da · opencode] → session/prompt #3 s …S6AA4rvz, 2 bloc(s) text (2.9 Ko)
  2026-11-17T20:00:55.616Z [42c012da · opencode] ← tool_call …b04095bc « glob » search pending entrée
  ```

- Compte rendu de la fille Expert UX/UI : « j'ai vérifié le contenu du répertoire, sans rien
  modifier. Je n'y trouve ni le plan ni `maquettes/b.html` ; il ne contient que `README.md:1-3`. »
- Fil de la fille : « Parti de main · 9970242 · « chore: initial commit » · 17 modifications non
  commitées du dossier d'origine ne sont pas ici. »
- Captures : `docs/recettes/2026-11-17-poc-complet-opencode/3-defaut-fille-sans-modifications.jpg`,
  `3-defaut-comptes-rendus-vides.jpg`.

Le plan, lui, n'était que dans le fil de la mère : la fille ne le reçoit pas non plus (sa consigne
se limite au message tapé et à la consigne du rôle).

## Critères d'acceptation

- [ ] Avant l'envoi à un ou plusieurs rôles qui partiront en worktree, si le dossier a des
      modifications non commitées, la ligne « Partira à… » le dit et propose une issue (committer
      d'abord, mettre de côté, partir dans le dossier en lecture seule, ou envoyer quand même).
- [ ] Le compte rendu d'une fille partie sans ces modifications le rappelle dans la mère.
- [ ] Décision tracée (ADR si besoin) sur le choix par défaut d'un **avis** : worktree depuis le
      commit, ou dossier de la mère en lecture seule (comme les rôles en lecture seule).
- [ ] Essai e2e contre l'agent factice : dépôt avec un fichier non commité, envoi `@rôle`,
      l'avertissement est visible avant l'envoi et dans la mère.

## Rejouer

**Agent factice : oui.** Le défaut est dans Bobine (création du worktree, textes de la saisie et
de la mère), pas dans l'agent : un dépôt git temporaire avec un commit et un fichier modifié, un
rôle sans lecture seule, un envoi `@rôle` ; le scénario factice n'a qu'à répondre (par exemple
`echo`). La trace réelle ci-dessus sert de référence.

## Journal

- 2026-11-17 — Ouverte par la recette « POC complet » (fiche 238), étape 3.
