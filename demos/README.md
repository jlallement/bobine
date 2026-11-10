# Démonstrations de Bobine

Des prompts prêts à copier pour montrer ce que Bobine sait faire quand l'agent pilote ses outils :
navigateur intégré, planches contact, images annotées, sous-agents, terminal partagé, simulateur
iOS, émulateur Android. Ils s'appuient sur un petit projet fourni, **La Bobinette** : un café, son
site, les calculs de son panier et une petite app « Pastilles » pour iPhone et Android. Le projet
contient quelques défauts volontaires, que l'agent trouve, corrige et vérifie sous vos yeux.

## Préparer (une fois)

1. Copier le projet dans un dossier à part (dépôt git neuf, pour l'onglet Modifications, les
   worktrees et pour tout remettre à zéro) :

   ```bash
   demos/preparer
   ```

   Il crée `~/bobine-demo` (ou le dossier donné en argument). **Relancer le script remet le projet
   à zéro** : les changements de l'agent sont perdus. Il refuse de toucher un dossier qu'il n'a pas
   créé lui-même.

2. Dans Bobine, ouvrir une conversation dans ce dossier. Avec Bob, la première fois : carte
   « Dossier non approuvé » → « Faire confiance à ce dossier ».
3. Selon les démos :
   - **site et tests** : Python 3 (celui de macOS suffit) ;
   - **iOS** : Xcode et un simulateur (essayé avec l'iPhone Air, iOS 26) ;
   - **Android** : Android Studio et un émulateur avec de la place libre. Si l'installation de l'app
     échoue avec « not enough space », l'émulateur est plein : Android Studio › Device Manager ›
     ⋮ › Wipe Data (efface les données de l'émulateur) ;
   - **capture d'écran du Mac** : Réglages Système › Confidentialité et sécurité › Enregistrement
     de l'écran : cocher Bobine, puis relancer Bobine.

## Les démos

Une conversation par démo : le contexte reste court, le coût aussi. Les coûts sont ceux de Bob,
mesurés lors du passage du 19 octobre 2026 quand la démo y figurait (=), estimés sinon (≈).

| Fichier | Ce que ça montre | Coût Bob |
|---|---|---|
| [01-premiers-pas](prompts/01-premiers-pas.md) | Diagramme Mermaid, modification puis Annuler, questions à choix, liste de tâches épinglée | 0,05 à 0,35 |
| [02-navigateur](prompts/02-navigateur.md) | L'agent teste le site comme un client : clics, formulaire, console, réseau, téléphone, mode sombre | ≈ 0,2 à 0,5 |
| [03-planche-contact](prompts/03-planche-contact.md) | Ce qui se passe pendant un geste, en une image : animation, message trop bref, défilement | = 0,34 |
| [04-annotation](prompts/04-annotation.md) | Vous entourez, fléchez, écrivez sur une capture (page, iPhone, Mac) ; l'agent comprend et corrige | = 0,04 à ≈ 0,4 |
| [05-sous-agents](prompts/05-sous-agents.md) | Audit en parallèle, correction en équipe, relecture | = 0,09 à ≈ 0,8 |
| [06-terminal](prompts/06-terminal.md) | Tests lancés dans le terminal partagé, serveur et ses journaux, `@terminal` | = 0,12 à ≈ 0,4 |
| [07-ios](prompts/07-ios.md) | Compiler, lancer, toucher, filmer l'app iPhone ; Réglages ; le site dans Safari | = 0,29 à ≈ 0,6 |
| [08-android](prompts/08-android.md) | La même chose sur Android, plus `logcat` et Chrome | = 0,16 à ≈ 0,6 |
| [09-grand-tour](prompts/09-grand-tour.md) | Les démos « waouh » : trois écrans, deux plateformes, la totale | ≈ 0,6 à 2 |
| [10-gestes](prompts/10-gestes.md) | Ce qui se montre à la main : fenêtre rapide, mode plan, worktrees, file de messages… | — |

## Conseils

- Les prompts nomment souvent l'outil de Bobine à utiliser (`browser_filmstrip`, `ios_build`…) :
  l'agent le trouve souvent seul, mais le nommer rend la démo plus sûre.
- Gardez le panneau latéral ouvert : l'agent y ouvre le navigateur, le simulateur, l'émulateur et
  le terminal, et vous pouvez y cliquer vous-même pendant qu'il travaille.
- Avec Bob, chaque mise à jour de la liste de tâches et chaque sous-agent demandent votre accord ;
  les outils de Bobine (navigateur, simulateurs…) ne demandent rien. Avec OpenCode : pas de liste
  de tâches, aucune demande d'autorisation, et le travail des sous-agents se voit en direct sous
  leur carte.
- Pour remettre un fichier en état sans tout recommencer : onglet Modifications › Annuler.

## Les défauts cachés (pour vous, pas pour l'agent)

L'agent ne voit que la copie (`~/bobine-demo`), pas ce fichier.

| Où | Défaut | Démo qui le montre |
|---|---|---|
| `site/boutique.html` | Le total oublie la dernière ligne du panier | 2.1, 4.3 |
| `site/boutique.html` | « Ajouté au panier » ne reste que 150 ms | 3.2 |
| `site/boutique.html` | « Commander » : erreur 501 du serveur, rien à l'écran, erreur dans la console | 2.2 |
| `site/boutique.html` | Les produits débordent sur un téléphone (largeur fixe) | 2.4, 7.4, 8.4, 9.1 |
| `site/inscription.html` | L'adresse e-mail refuse les points et les majuscules | 2.3 |
| `site/inscription.html` | Libellés presque invisibles en mode sombre | 2.4 |
| `calculs/panier.py` | Pas de remise à 20 € pile (`>` au lieu de `>=`) : deux tests échouent | 6.1, 5.2 |
| `apps/ios/`, `apps/android/` | Le compteur ne suit pas quand on ajoute une pastille | 7.1, 8.1, 9.2 |
| `apps/ios/`, `apps/android/` | « Mélanger » : texte blanc sur jaune, presque illisible | 4.4, 7.2 |
