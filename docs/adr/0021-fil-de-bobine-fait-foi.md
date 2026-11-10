# ADR-0021 — Le fil enregistré par Bobine fait foi ; le rejeu de l'agent ne sert qu'à compléter

- **Statut** : accepté
- **Date** : 2026-10-21
- **Précise** : ADR-0002 (ACP seul), la fiche 041 (« Relancer » garde le fil) et la fiche 102 (mise
  en veille)

## Contexte

Bobine enrichit le fil d'une conversation avec ce que l'agent ne connaît pas : cartes des outils de
l'app et leurs libellés, comptes rendus de conversations filles, remarques, avis (« Réponse
interrompue », agent arrêté), consommation. Ce fil est déjà écrit sur le disque
(`conversations/<id>.json`, fiche 041). Pourtant, à la réouverture d'une conversation (mise en
veille de la fiche 102, redémarrage de l'app), le gestionnaire demandait `session/load` à l'agent et
reconstruisait le fil à partir de son rejeu : tout ce que l'app avait ajouté disparaissait, et les
diffs d'OpenCode devaient être retrouvés par un adaptateur (fiche 096). Le chemin inverse existait
déjà pour « Relancer » après une panne (`keepTranscript`). Il fallait trancher.

## Décision

**Le fil enregistré par Bobine fait foi pour l'affichage ; l'agent fait foi pour son contexte.**

- Une conversation dont le fil contient quelque chose est toujours rouverte avec ce fil. Si l'agent
  sait rejouer (`session/load`), il rejoue quand même : son rejeu, sans appel au modèle, est tenu
  à part et comparé au fil ; seuls les tours que le fil n'a pas (session continuée ailleurs :
  `bob chat`, Bob IDE, `opencode`) sont ajoutés à la fin, avec un avis. Sinon `session/resume`.
- Le rejeu ne reconstruit un fil que s'il n'y en a pas : session reprise d'ailleurs (fiche 055),
  fichier de fil illisible (mis de côté, fiche 041).
- La comparaison compte les messages de l'utilisateur : tout ce qui suit, dans le rejeu, le dernier
  message utilisateur connu du fil est ajouté (`shared/replay-tail.ts`). Le rejeu est tenu pour
  fini après 300 ms sans mise à jour (rejeu tardif de Bob 2.0.6 compris), ou au message suivant.
- Le fichier du fil porte un numéro de version (`version: 1`) ; un fil sans version est lu tel quel.

## Alternatives écartées

- **Reconstruire depuis le rejeu et y regreffer ce que l'app avait ajouté** — il faudrait apparier
  chaque carte à un appel d'outil du rejeu, dont les identifiants et les titres changent d'un agent
  à l'autre (OpenCode renomme ses cartes au rejeu). Fragile, et propre à chaque agent.
- **`session/resume` seulement quand le fil est gardé** (ce que faisait « Relancer ») — plus
  rapide, mais aveugle : une session continuée ailleurs n'est jamais rattrapée. Le rejeu est gratuit
  (aucun appel au modèle) ; on le garde pour la réconciliation.
- **Rapprocher le rejeu du fil message par message** (texte, outils) — les textes diffèrent au rejeu
  (Bob rejoue après sa réponse, OpenCode sans certains diffs) ; compter les messages de
  l'utilisateur, qui ne changent jamais, suffit et reste générique.
- **Une base de données** — rien à gagner : le fil est un fichier JSON par conversation, écrit de
  façon atomique, lu à la demande ; le problème était une politique, pas un format.

## Conséquences

- La mise en veille (fiche 102) devient sans perte ; le réglage « Conversations gardées actives »
  n'est plus qu'une question de mémoire.
- L'adaptateur des diffs au rejeu (fiche 096) ne sert plus qu'aux conversations sans fil.
- Un agent qui sait reprendre mais pas rejouer (`resume` seul) n'est pas réconcilié : on le dit
  dans la matrice des capacités, rien n'est inventé.
- Si un rejeu diverge du fil avant le dernier message utilisateur connu (historique réécrit chez
  l'agent), le fil de l'app l'emporte, sans avis : à surveiller avec les sondes si un agent se met
  à le faire.
- Toute évolution du format du fil passe par le numéro de version.
