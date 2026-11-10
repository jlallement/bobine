# 9 — Le grand tour

Des démos plus longues, qui enchaînent plusieurs outils. Compter plusieurs minutes et, avec Bob,
de 0,6 à 2 bobcoins.

## 9.1 Trois écrans

**Montre** : la même page sur le Mac, l'iPhone et Android, comparée par l'agent.

```text
Lance le site avec preview_start. Ouvre la boutique à trois endroits : dans le navigateur de Bobine au format téléphone (browser_resize, 375 px), dans Safari sur le simulateur iOS (http://localhost:8765/boutique.html) et dans Chrome sur l'émulateur Android (http://10.0.2.2:8765/boutique.html). Prends une capture de chacun et compare-les dans un tableau : ce qui est pareil, ce qui diffère, ce qui ne va pas.
```

## 9.2 Même app, deux plateformes

**Montre** : une correction faite en Swift et en Java, compilée et prouvée sur les deux.

```text
Les apps « Pastilles » iOS et Android ont le même défaut : le compteur ne suit pas quand on ajoute une pastille. Corrige-le dans les deux, compile les deux (ios_build, android_build), lance-les, touche « Ajouter » une fois sur chacune et montre-moi les deux planches contact (ios_filmstrip, android_filmstrip).
```

## 9.3 La totale

**Montre** : liste de tâches, sous-agents, corrections, vérifications dans le terminal et le
navigateur, planche contact, format téléphone, mode sombre et diagramme, dans un seul tour.

```text
Je veux que la boutique soit prête à ouvrir. Fais d'abord une liste de tâches. Lance trois sous-agents en même temps pour auditer site/boutique.html, site/inscription.html et calculs/, sans rien modifier, puis corrige toi-même ce qu'ils ont trouvé. Vérifie chaque correction : les tests de calculs dans le terminal de Bobine ; la boutique dans le navigateur (panier, message « Ajouté au panier » filmé avec browser_filmstrip, bouton « Commander ») ; puis le format téléphone et le mode sombre. Termine par un tableau avant / après et un diagramme Mermaid du parcours d'achat.
```

**À regarder** : la liste épinglée qui avance, les cartes de sous-agents avec leur coût, l'onglet
Modifications qui se remplit, les captures et la planche sous les cartes. Pour recommencer :
`demos/preparer`.
