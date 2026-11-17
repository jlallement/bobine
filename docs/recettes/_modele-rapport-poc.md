# Rapport de recette « POC complet » — Bobine <version> + <agent> (<modèle principal>) — AAAA-MM-JJ

<!--
Modèle du rapport de chaque passage du scénario « POC complet » (scenario-poc-complet.md).
Copier ce fichier en `AAAA-MM-JJ-poc-complet-<agent>.md`, remplir toutes les cases, ne supprimer
aucune ligne : une case sans objet porte « non applicable » ou « non jouée (raison) ». La grille
reste la même d'un passage à l'autre pour pouvoir comparer deux versions.
Pas de donnée personnelle : chemins avec `~`, pas de nom d'utilisateur, de compte, de clé.
-->

Scénario : [scenario-poc-complet.md](scenario-poc-complet.md). Joué par : <pilote (Claude, modèle)
| humain>. Fiche du passage : <lien, s'il y en a une>.

## En bref

- **Résultat** : <N> étapes sur 9 réussies, <N> avec réserve, <N> en échec, <N> non jouées.
- **Interventions** : <N> (liste au § Interventions).
- **Défauts** : <N> bloquants, <N> sérieux, <N> gênants, <N> cosmétiques. Les trois plus graves :
  1. …
- **Consommation** : agent <jetons> / plafond <jetons> (coût affiché <montant et unité> ; 0 $
  avec l'abonnement ChatGPT) ; pilote <jetons> / plafond <jetons>. Plafond atteint : <non | oui, à
  l'étape N>. Limite d'usage de l'abonnement atteinte : <non | oui, à l'étape N, message exact>.
- **Durée** : <h min> de jeu (de <heure> à <heure>).
- **Journaux** : <N> `ERROR`, <N> `WARN` sur tout le passage.
- **Mémoire maximale** : Bobine <Mo>, agents <Mo> (à l'étape <N>).
- **Comparé au passage précédent** (<lien>) : <ce qui va mieux, ce qui va moins bien, en trois
  lignes>.

## Paramètres et environnement

| | |
|---|---|
| Bobine | <version>, DMG de la Release <lien>, installé dans `/Applications` |
| Profil | dossier jetable `<PASSAGE>/profil`, journal Détaillé |
| Agent | <OpenCode | IBM Bob> <version> |
| Modèle principal | <identifiant> |
| Modèle de remplacement (4.2) | <identifiant | non applicable> |
| Modèle des filles « autre modèle » | <identifiant | non applicable> |
| Accès au modèle | <abonnement ChatGPT dans OpenCode | clé d'API | bobcoins> |
| Plafond de l'agent | <jetons, ou montant et unité> ; plafond par conversation <montant | désactivé> |
| Plafond du pilote | <jetons> |
| Mac | <macOS>, <puce>, <mémoire> |
| Xcode, simulateur | <version>, <appareil et iOS> |
| Node.js, git | <versions> |
| Pilote | `pnpm pilote` au tag <tag> ; computer use <oui | non> |

## Grille par étape

Résultat : ✓ réussi, ~ avec réserve, ✗ échec, NA non applicable, NJ non jouée (raison en note).

| Étape | Résultat | Début–fin | Durée | Interventions | Blocages | `ERROR` / `WARN` | Mémoire Bobine / agents (Mo) | Jetons agent | Coût agent | Jetons pilote | Captures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. Cadrage | | | | | | | | | | | |
| 2. Maquettes | | | | | | | | | | | |
| 3. Experts | | | | | | | | | | | |
| 4. Construction | | | | | | | | | | | |
| 5. Web | | | | | | | | | | | |
| 6. iOS | | | | | | | | | | | |
| 7. Relecture et git | | | | | | | | | | | |
| 8. Accrocs volontaires | | | | | | | | | | | |
| 9. Clôture | | | | | | | | | | | |
| **Total** | | | | | | | | | | | |

## Grille par outil

Le même ordre que le § 4 du scénario.

| Outil | Étape | Résultat | Note (une ligne) |
|---|---|---|---|
| Mode Plan, plan annoté, question à choix | 1, 2 | | |
| Panneau Tâches, liste épinglée | 1 | | |
| Onglet Session | 1, 4.2 | | |
| Mémoire commune | 1, 7 | | |
| Aperçu HTML dans le navigateur intégré | 2 | | |
| Rôles, section Équipe, `@rôle`, création d'un rôle | 3, 6, 7 | | |
| Conversations filles, `/split`, Tâches proposées, Sous-tâches, vue Filles, fusion | 3, 4.1, 5 | | |
| Modèle d'une fille, changement de modèle | 4.1, 4.2 | | |
| Cartes d'autorisation | 4.3, 5, 6 | | |
| Panneau terminal, `@terminal` | 4.3, 7 | | |
| Commandes « / » de Bobine et du projet | 4.4 | | |
| File d'attente | 4.5 | | |
| Serveur de dev, navigateur intégré | 5 | | |
| Annoter la page | 5 | | |
| Simulateur iOS, joindre l'écran, annoter l'image | 6 | | |
| Modifications, remarques sur le diff | 7 | | |
| Faire relire | 7 | | |
| Vue Git, Committer, branches des filles | 7 | | |
| Arrêter | 8.1 | | |
| Quitter en plein tour, reprise | 8.2 | | |
| Fenêtre rapide | 8.3 | | |
| Pièces jointes, texte collé | 8.4 | | |
| Export Markdown / JSON | 8.5 | | |
| Consommation, plafond | toutes | | |
| Journal Détaillé | toutes | | |

## Relevés propres à chaque étape

### 1. Cadrage

- Versions du plan : …
- Souvenir retenu (texte exact, portée) : …
- Onglet Tâches : présent | absent (attendu avec OpenCode) …
- Captures : …

### 2. Maquettes

- Trois maquettes ouvertes dans le navigateur intégré : …
- Question à choix posée : oui | non (réponse en texte) …

### 3. Experts

- Filles des rôles : heures de début, durée, coût de chacune : …
- Lecture seule respectée : …
- Rôle « Expert SwiftUI » créé : …

### 4. Construction

- Filles : chantier, modèle demandé, modèle constaté (onglet Session), branche, durée, coût : …
- Changement de modèle de la mère : coût avant / après, modèle constaté : …
- Cartes d'autorisation : nombre, réponse au premier clic oui | non : …
- Commandes essayées et résultat : …
- File d'attente : messages partis ensemble oui | non : …

### 5. Web

- Remarques annotées : nombre, éléments visés reconnus par l'agent : …
- Allers-retours avant une correction juste : …

### 6. iOS

- Compilations avant le premier succès, durée de la première : …
- Flux du simulateur : …
- Image annotée reçue et comprise : …

### 7. Relecture et git

- Remarques : `@Code reviewer` <N>, « Faire relire » <N> (gravités) : …
- Message de commit proposé (suit le souvenir ?) : …
- `git log --oneline --graph` :

  ```text
  …
  ```

### 8. Accrocs volontaires

- Arrêt : délai entre le clic et l'arrêt effectif : …
- ⌘Q en plein tour : dialogue, processus restants, fil après relance, reprise : …
- Fenêtre rapide : …
- Pièce jointe et texte collé : …
- Exports (taille, lisibilité) : …

### 9. Clôture

- App produite vérifiée à la main (tests de l'API, page, app iOS) : …
- Résumé du pilote (`journal --resume`) : …

## Défauts

Un défaut par ligne, après reproduction (ou « vu une fois »). « Côté » : Bobine, ou agent (le
modèle s'est trompé ; seule la façon dont Bobine le montre peut être un défaut de Bobine).

| N° | Gravité | Étape | Côté | Ce qui se passe | Reproduction | Journal / capture | Fiche |
|---|---|---|---|---|---|---|---|
| D1 | bloquant · sérieux · gênant · cosmétique | | | | | | <NNN, avec l'essai qui le rejoue : agent factice ou trace réelle> |

## Interventions

| Heure | Étape | Ce que le testeur a fait | Pourquoi | Un humain l'aurait-il trouvé ? |
|---|---|---|---|---|
| | | | | |

## Erreurs du journal

Lignes `ERROR` et `WARN` de `main.log` et `agents.log`, groupées par étape, chemins remplacés par
`~`.

```text
…
```

## État laissé

Bobine quittée ; profil <supprimé | gardé jusqu'au …> ; projet <supprimé | gardé> ; `~/.bob`
<restauré | non concerné> ; simulateur <état>.
