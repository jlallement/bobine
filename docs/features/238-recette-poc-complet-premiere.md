# 238 — Recette « POC complet » : première exécution (OpenCode, modèles OpenAI « mini »)

- **Statut** : à faire
- **Dépend de** : 206 (session longue, pilote de Bobine), 148 (profil isolé), 080 (journal
  réglable), 223 (rôles), 182 (mémoire commune)
- **Agents** : OpenCode pour cette première exécution ; le scénario est le même pour IBM Bob
  (passage suivant).

## Pourquoi

Les essais e2e jouent chaque outil seul, contre l'agent factice. Personne ne vérifie qu'un
utilisateur peut, d'un bout à l'autre, **faire construire une vraie petite application** avec
Bobine en se servant de tous ses outils, sans blocage, avec un vrai agent et un modèle de gamme
intermédiaire. Le scénario [`docs/recettes/scenario-poc-complet.md`](../recettes/scenario-poc-complet.md)
le décrit une fois pour toutes ; cette fiche suit sa première exécution.

## Paramètres de ce passage

- **Bobine** : la version du dernier DMG publié au jour du passage, installée dans `/Applications`,
  lancée sur un profil jetable (voir « Décisions »).
- **Agent** : OpenCode, OpenAI par **abonnement ChatGPT** connecté par l'utilisateur lui-même
  avant le passage (pas de clé d'API).
- **Modèle principal** : le palier « mini » d'OpenAI proposé ce jour-là (force comparable à un
  Qwen 27B) ; **modèle de remplacement** et **modèle des filles « autre modèle »** : à choisir le
  jour même et à écrire dans le rapport.
- **Budget** : en jetons (coût affiché 0 $) : par défaut 20 millions de jetons de l'agent et
  2 millions de jetons du pilote, modifiables par l'utilisateur avant de commencer ; arrêt net si
  l'un est atteint, ou si la limite d'usage de l'abonnement l'est.

## Critères d'acceptation

- [ ] Paramètres fixés et écrits en tête du rapport avant le début (modèles exacts, plafonds).
- [ ] Prérequis vérifiés : DMG publié installé, Xcode et simulateur, fournisseur connecté par
      l'utilisateur, profil jetable, journal en Détaillé, plafonds en jetons fixés.
- [ ] Les 9 étapes du scénario jouées dans l'ordre, ou arrêtées net au plafond (et dit).
- [ ] Rapport `docs/recettes/AAAA-MM-JJ-poc-complet-opencode.md` rempli d'après
      [`_modele-rapport-poc.md`](../recettes/_modele-rapport-poc.md), sans donnée personnelle.
- [ ] Chaque défaut sérieux ou bloquant a sa fiche, avec un essai qui le rejoue (agent factice si
      possible, sinon trace réelle).
- [ ] État laissé propre : Bobine quittée, aucun processus d'agent restant, profil et projet
      supprimés après le rapport, rien touché dans `~/.ssh`, le trousseau, `gh` ou `glab`.

## Plan

1. Fixer les modèles exacts le jour du passage (plafonds et décisions : ci-dessous).
2. Préparer : DMG, profil, projet de départ, réglages (§ 1 du scénario).
3. Jouer les étapes 1 à 9 avec le pilote ; journal du pilote dans le dossier du passage.
4. Rédiger le rapport, ouvrir les fiches des défauts sérieux et bloquants.
5. Mettre à jour cette fiche (statut, journal, écarts au scénario) et, si le scénario s'est révélé
   flou ou faux, le corriger pour le passage suivant.

## Décisions (2026-11-17, utilisateur)

- **Budget** : OpenAI passe par un abonnement ChatGPT connecté dans OpenCode ; le coût affiché
  sera 0 $. Le plafond se compte en **jetons de l'agent** (par défaut 20 millions, total affiché par
  Toute mon activité / Réglages › Consommation, cache compris) **plus les jetons du pilote** (par
  défaut 2 millions), modifiables. Le plafond par conversation de Bobine, qui compte un coût, reste
  désactivé. Si la **limite d'usage de l'abonnement** est atteinte, on s'arrête et on la note comme
  résultat, pas comme défaut de Bobine.
- **Projet Xcode** : l'agent écrit lui-même le projet SwiftUI, sans XcodeGen. S'il bloque, c'est
  un résultat à noter (étape 6).
- **Profil** : dossier de profil jetable (`pnpm pilote lancer --profil …`) à la place de
  `--profil-temporaire`, effacé à la fermeture, qui empêcherait l'étape 8.2. Conséquence : le
  journal est dans `<profil>/logs/`, pas dans `~/Library/Logs/Bobine/`.
- **Gravités** : « sérieux » et « cosmétique » passent pour l'instant par `genant` (préfixe
  `SÉRIEUX :`) et `mineur` du pilote ; pas de changement du pilote.

## Reste à choisir le jour du passage

- Identifiants exacts du modèle principal, du modèle de remplacement et du modèle des filles.

## Journal

- 2026-11-17 — Scénario, modèle de rapport et fiche écrits (documentation seulement). Noms des
  outils, panneaux, réglages et commandes vérifiés dans le guide, les fiches et les textes de
  l'interface. Écarts relevés en l'écrivant : pas de mode « Annoter » sur le simulateur iOS (on
  joint l'écran puis on annote l'image jointe, fiche 067) ; pas d'onglet Tâches avec OpenCode
  (attendu) ; pas de choix du modèle avec IBM Bob ; pas de fonction « maquettes » (fichiers HTML
  montrés par l'aperçu, fiche 064) ; journal dans le profil quand le profil est isolé.
- 2026-11-17 — Décisions de l'utilisateur reportées ici et dans le scénario : budget en jetons
  (abonnement ChatGPT, plafonds par défaut, limite d'usage notée comme résultat), projet Xcode
  écrit par l'agent, profil jetable validé, gravités par préfixe gardées.
