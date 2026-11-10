# ADR-0011 — Fonctions propres à un agent : déclarées, visibles, documentées

- **Statut** : accepté
- **Date** : 2026-10-14

## Contexte

L'ADR-0002 met toutes les différences entre agents dans leur profil, et `AGENTS.md` interdit tout
code propre à un agent dans l'interface. Mais Bob et OpenCode n'offrent pas les mêmes choses. Bob
seul a une limite de coût par tâche, des coûts de sous-agents dans sa base locale, et l'échange de
tâches avec Bob IDE. OpenCode seul envoie son coût par ACP et sait dupliquer une session. Refuser
toute fonction propre à un agent priverait Bob, la cible, de ce qui le distingue. Les accepter sans
règle rendrait l'app opaque : on ne saurait plus ce qui marche avec quel agent, ni pourquoi.
L'utilisateur accepte des fonctions propres à un agent, « à condition de faire le choix en
connaissance et bien visible dans les paramètres, la doc ».

## Décision

Le générique d'abord : ce que permet le protocole ACP marche pour tous les agents, sans cas
particulier. Une fonction propre à un agent n'est acceptée qu'à quatre conditions :

1. Elle est **déclarée dans le profil de l'agent** (`main/agent/profiles.ts`), côté main process.
   Jamais de « si c'est Bob » dans l'interface.
2. Elle est **visible dans l'app** : la fiche « Ce que Bob Desktop sait faire avec cet agent »
   (Réglages › Agents et dossiers, fiche 054) la liste sous « Propre à <agent> ». Cette liste est
   tirée du profil : elle ne peut pas oublier une fonction déclarée.
3. Elle figure dans la **matrice de `docs/agents.md`**, sous son repère. Un test vérifie que chaque
   repère déclaré par un profil y apparaît.
4. Sa **fiche de fonctionnalité** dit « Agents : les deux | Bob | OpenCode », et pourquoi.

## Alternatives écartées

- **Rien de propre à un agent** : Bob, la cible, perdrait ce qui le distingue (coûts en bobcoins,
  limite de coût), et il faudrait attendre que tout passe par ACP.
- **Des cas particuliers au fil de l'eau, documentés seulement dans les fiches** : c'est la dérive
  que la règle veut éviter. Le choix ne se voit ni dans l'app, ni dans un endroit unique de la doc.
- **Un mécanisme de greffons par agent** : trop lourd pour deux agents.

## Conséquences

- Chaque nouvelle fonction propre à un agent coûte un peu plus : une entrée dans le profil, une
  ligne dans la matrice, une mention dans la fiche. C'est voulu.
- Les réglages propres à un agent (compaction, fichiers MCP, connexion, licence, confiance du
  dossier) sont listés de la même façon, même s'ils ne sont pas des fonctions nouvelles : on voit
  tout ce que l'app sait de particulier sur l'agent.
- Une fonction propre à un agent qui passe dans ACP redevient générique. On la retire alors du
  profil et de la matrice.
