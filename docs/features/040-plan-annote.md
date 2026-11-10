# 040 — Plan annoté, comme Claude Desktop

- **Statut** : fait
- **Dépend de** : 013, 016

## Pourquoi

En mode plan, l'agent propose un plan avant de toucher au code. Comme dans Claude Desktop,
l'utilisateur veut le lire dans le fil (pas dans le panneau de droite), l'annoter passage par
passage, renvoyer ses remarques pour obtenir une version mise à jour, voir ce qui a changé, puis le
faire exécuter.

## Critères d'acceptation

- [x] En mode plan, le plan s'affiche comme un document dans le fil (détection par le mode actif,
      pas par le texte) : fichier Markdown écrit (Bob) ou réponse (OpenCode). Le plan arrivé par une
      autorisation `switch_mode` (Claude Code, Codex) garde sa carte de la fiche 016.
- [x] Sélectionner un passage → ajouter une remarque ; passages surlignés, remarques modifiables et
      supprimables.
- [x] « Envoyer mes remarques » : un message qui cite chaque passage avec sa remarque et demande le
      plan mis à jour en entier, sans quitter le mode plan.
- [x] Versions successives du plan, « Voir ce qui a changé » (diff entre deux versions).
- [x] « Exécuter le plan » : retour au mode d'exécution de l'agent, puis demande d'exécution.
- [x] Générique : rien de propre à Bob dans l'UI ; formes réelles de Bob et OpenCode relevées,
      OpenCode réel dans l'app.

## Ce que font les agents (essais réels du 2026-10-12)

Même demande aux deux, en mode plan, puis des remarques sur deux passages (script de sondage par
l'app) :

- **Bob 2.0.6** (0,34 bobcoin) : utilise sa compétence `create-plan`, lit le projet, puis **écrit le
  plan dans un fichier** à la racine (`goodbye-plan.md`), en demandant l'autorisation d'écrire même
  en mode plan. Sa réponse n'en donne qu'un résumé et ses questions. Aux remarques : relit le
  fichier, le **réécrit en entier** (nouvelle autorisation), et met aussi le plan complet dans sa
  réponse ; finit par « passe en mode Agent pour l'implémentation ». Reste en mode `plan`, ne touche
  à aucun autre fichier.
- **OpenCode 1.18** (gratuit) : plan en Markdown **dans la réponse** ; lit des fichiers et lance des
  commandes de lecture ; pose sa question par l'outil `ask_user` de l'app. Aux remarques : renvoie
  le plan **en entier**, sans outil, reste en mode `plan`, ne modifie rien.

## Plan

- **Mode de chaque message** : l'hôte ajoute le mode actif (`{ id, name }` du contrôle de
  catégorie `mode`) à l'évènement `user-message` ; le fil le garde sur le message. Un tour est « en
  mode plan » si ce mode s'appelle plan (`plan` pour Bob, OpenCode, Claude Code).
- **Plan d'un tour** (`shared/plan-doc.ts`, pur) : le dernier fichier `.md` écrit avec succès pendant
  le tour (contenu complet du diff) — c'est le cas de Bob ; sinon la réponse de l'agent (OpenCode).
  Versions successives : même fichier (ou réponses successives) dans la conversation ; diff entre
  deux versions avec `computeDiff`.
- **Carte de plan** dans le fil (`PlanDocument`), à la fin du tour : titre, fichier, version, plan en
  Markdown ; pour un plan dans la réponse, la carte remplace l'affichage du message. Sur la dernière
  version : sélection d'un passage → « Commenter » → remarque ; passages surlignés (CSS Custom
  Highlight API) ; liste des remarques, modifiables / supprimables, gardées en mémoire par
  conversation ; « Envoyer mes remarques » ; « Exécuter le plan » ; « Voir ce qui a changé ».
- **Remarques** (`planFeedback`) : un message ordinaire qui cite chaque passage avec sa remarque et
  demande le plan mis à jour en entier, en restant en mode plan (et dans le même fichier s'il y en
  a un).
- **Exécuter** : retour au mode d'exécution (celui d'avant le mode plan, sinon le premier qui n'est
  ni plan ni « ask »), puis « Exécute le plan (fichier) ».
- Agent factice : modes `code` / `plan` existants ; étape de branchement selon le message reçu
  (`when-prompt`) et scénario `plan-fichier` qui imite Bob (fichier écrit, puis réécrit aux
  remarques).
- Rien d'automatique côté autorisations : l'écriture du fichier de plan reste soumise à l'accord de
  l'utilisateur (« Toujours autoriser » s'il le souhaite).

## Journal

- 2026-10-12 — Fiche créée à la demande de l'utilisateur. Ce qui est connu (fiche 016) : Bob 2.0.6
  rend son plan en texte, terminé par « Valides-tu ce plan ? », sans autorisation `switch_mode` ;
  OpenCode a un mode `plan` sans validation.
- 2026-10-12 — Fait comme prévu. Mode actif sur chaque message (`user-message.mode`),
  `shared/plan-doc.ts` (plans par tour, versions, remarques, mode d'exécution — testé),
  `PlanDocument` (Markdown, sélection → « Commenter », surlignage par la CSS Custom Highlight API,
  remarques gardées par conversation et version, diff entre versions), intégré au fil
  (`Transcript`, `planActions`). Agent factice : étape `when-prompt`, scénario `plan-fichier`
  (imite Bob). Suite e2e `planSuite` : plan v1 dans `plan.md`, passage commenté et surligné,
  remarques envoyées, version 2 et son diff, exécution (retour au mode `code`).
- Essai réel dans l'app avec **OpenCode** : carte « Plan proposé » tirée de sa réponse, comme
  prévu. **Bob** : formes relevées par le sondage (fichier `.md` écrit avec succès, contenu complet,
  mode `plan`, puis `agent` pour exécuter) ; le parcours complet dans l'app avec Bob reste à faire
  par l'utilisateur (≈ 0,35 bobcoin par aller-retour).
- Correction après les captures : titres du plan (`#`) trop grands dans la carte.
- Limites : les remarques en cours sont gardées en mémoire (perdues au redémarrage — **levé par la
  fiche 043** : stockage local du renderer, par conversation et version) ; un passage
  répété dans le plan est surligné à chaque occurrence ; Bob demande l'autorisation d'écrire son
  fichier de plan à chaque version (« Toujours autoriser » l'évite) ; dans la vue côte à côte, le
  plan de la conversation d'à côté est en lecture seule.
- 2026-10-23 — Écart (fiche 124, défaut D10) : les boutons de la barre du plan sont ancrés à
  droite (l'espaceur n'avait pas de règle) ; ils ne glissent plus quand le texte d'aide change.
