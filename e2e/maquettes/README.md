# Maquettes sur l'app buildée

Outil de travail, hors build et hors CI : il produit les captures de la planche
« Maquettes de Bobine » (privée), relue et validée
par Jérôme le 23 octobre 2026. Ce qu'elle décide est consigné dans
[`docs/feuille-de-route-2026-10-23.md`](../../docs/feuille-de-route-2026-10-23.md) (§ 0, journal
de la relecture).

## Principe

On lance l'app buildée avec l'agent factice (comme les essais e2e, `../lib.mjs`), puis chaque écran
remplace des morceaux du DOM par du HTML écrit avec les vraies classes de l'app et ses jetons de
couleur. Aucun code produit n'est touché : on voit la cible dans la vraie fenêtre, en clair et en
sombre, avec les vrais composants autour.

| Fichier | Rôle |
|---|---|
| `run.mjs` | Lance l'app, injecte les styles, joue chaque écran et prend la capture |
| `screens.mjs` | La liste des écrans (`SCREENS`) : ce que chacun remplace |
| `screens-annoter.mjs` | Annoter une page vivante (fiche 146), planche « Annoter une page vivante » |
| `parts.mjs` | Morceaux communs : barre latérale cible, messages du fil, faux site « Carnet de lecture » |
| `styles.mjs` | Seulement ce qui n'existe pas encore dans l'app, sur ses jetons |
| `icons.mjs` | Icônes Lucide de l'app, en SVG brut |
| `spool.svg` | La bobine de l'indicateur d'activité |
| `planche.html` | La page publiée (elle attend les images dans `img/`) |

## Lancer

```bash
pnpm build && node e2e/maquettes/run.mjs
```

Les captures arrivent dans `e2e/captures/maq-<écran>-<light|dark>.png`. Un thème et des débuts
d'identifiant limitent la série :

```bash
node e2e/maquettes/run.mjs light barre navigateur
```

La fenêtre fait 1 440 × 900. Les écrans marqués `tall` passent à 1 440 × 1 240.
