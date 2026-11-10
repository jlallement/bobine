# 5 — Sous-agents

L'agent confie une partie du travail à des sous-agents. Chacun a sa carte dans le fil, avec sa
durée et, chez Bob, son coût en direct. Chez OpenCode, son travail (outils, réponse) se range en
direct sous sa carte. Avec Bob, chaque sous-agent demande votre accord avant de partir.

## 5.1 Audit en parallèle

```text
Lance trois sous-agents en même temps, un par page du site : site/boutique.html, site/inscription.html et site/anime.html. Chacun lit sa page et y cherche les bugs et les problèmes d'accessibilité, sans rien modifier. Quand ils ont fini, fais-moi une synthèse en tableau : page, problème, gravité, piste de correction.
```

**À regarder** : trois cartes « Sous-agent », leur durée et leur coût ; la synthèse en tableau.
Selon l'agent, les sous-agents tournent en même temps ou l'un après l'autre.

## 5.2 Corriger en équipe

```text
Fais d'abord une liste de tâches. Confie à un sous-agent la correction de calculs/panier.py (les tests : python3 -m unittest discover -s calculs -v) et à un autre la correction du total du panier dans site/boutique.html. Quand ils ont fini, relance toi-même les tests dans le terminal de Bobine et vérifie le panier dans le navigateur avec une capture.
```

**À regarder** : la liste épinglée, les deux cartes de sous-agents, puis la vérification par
l'agent principal (terminal, navigateur).

## 5.3 Une relecture par un sous-agent

À lancer à la fin d'une conversation où l'agent a modifié des fichiers (par exemple après 2.1 ou
5.2).

```text
Demande à un sous-agent de relire toutes les modifications faites dans cette conversation, comme un relecteur exigeant. Applique ce qui est justifié et dis-moi ce que tu as écarté, et pourquoi.
```
