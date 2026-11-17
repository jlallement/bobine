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
  lancée sur un profil jetable (voir « Points à trancher »).
- **Agent** : OpenCode, fournisseur OpenAI connecté par l'utilisateur lui-même avant le passage.
- **Modèle principal** : le palier « mini » d'OpenAI proposé ce jour-là (force comparable à un
  Qwen 27B) ; **modèle de remplacement** et **modèle des filles « autre modèle »** : à choisir le
  jour même et à écrire dans le rapport.
- **Budget** : plafond de l'agent (dollars, ou jetons si OpenCode passe par un abonnement) et
  plafond des jetons du pilote, fixés avant de commencer ; arrêt net si l'un est atteint.

## Critères d'acceptation

- [ ] Paramètres fixés et écrits en tête du rapport avant le début (modèles exacts, plafonds).
- [ ] Prérequis vérifiés : DMG publié installé, Xcode et simulateur, fournisseur connecté par
      l'utilisateur, profil jetable, journal en Détaillé, plafond par conversation réglé.
- [ ] Les 9 étapes du scénario jouées dans l'ordre, ou arrêtées net au plafond (et dit).
- [ ] Rapport `docs/recettes/AAAA-MM-JJ-poc-complet-opencode.md` rempli d'après
      [`_modele-rapport-poc.md`](../recettes/_modele-rapport-poc.md), sans donnée personnelle.
- [ ] Chaque défaut sérieux ou bloquant a sa fiche, avec un essai qui le rejoue (agent factice si
      possible, sinon trace réelle).
- [ ] État laissé propre : Bobine quittée, aucun processus d'agent restant, profil et projet
      supprimés après le rapport, rien touché dans `~/.ssh`, le trousseau, `gh` ou `glab`.

## Plan

1. Fixer les paramètres avec l'utilisateur (modèles, plafonds, points à trancher ci-dessous).
2. Préparer : DMG, profil, projet de départ, réglages (§ 1 du scénario).
3. Jouer les étapes 1 à 9 avec le pilote ; journal du pilote dans le dossier du passage.
4. Rédiger le rapport, ouvrir les fiches des défauts sérieux et bloquants.
5. Mettre à jour cette fiche (statut, journal, écarts au scénario) et, si le scénario s'est révélé
   flou ou faux, le corriger pour le passage suivant.

## Points à trancher avant le passage

- **Profil** : le profil temporaire (`--profil-temporaire`) est effacé à la fermeture, ce qui
  empêche l'étape 8.2 (quitter puis relancer). Le scénario utilise un dossier de profil jetable
  (`--user-data-dir`, `pnpm pilote lancer --profil`) : même isolement, mais il survit à la
  relance. Conséquence : le journal est dans `<profil>/logs/`, pas dans `~/Library/Logs/Bobine/`.
- **Gravités du pilote** : `pnpm pilote note` connaît `bloquant`, `genant`, `mineur`, `idee`, pas
  « sérieux » ni « cosmétique ». Le scénario les fait passer par `genant` (préfixe `SÉRIEUX :`) et
  `mineur` ; ajouter ces deux gravités au pilote serait plus propre (petite fiche à part).
- **Budget avec un abonnement** : si OpenCode passe par un abonnement ChatGPT, le coût affiché est
  0 $ ; le plafond se compte alors en jetons de l'agent.
- **Projet Xcode** : l'agent doit écrire lui-même un projet Xcode SwiftUI sans l'interface de
  Xcode. Le laisser faire (c'est un vrai usage), ou installer XcodeGen avant le passage ?
- **Modèles** : identifiants exacts du modèle de remplacement et du modèle des filles.

## Journal

- 2026-11-17 — Scénario, modèle de rapport et fiche écrits (documentation seulement). Noms des
  outils, panneaux, réglages et commandes vérifiés dans le guide, les fiches et les textes de
  l'interface. Écarts relevés en l'écrivant : pas de mode « Annoter » sur le simulateur iOS (on
  joint l'écran puis on annote l'image jointe, fiche 067) ; pas d'onglet Tâches avec OpenCode
  (attendu) ; pas de choix du modèle avec IBM Bob ; pas de fonction « maquettes » (fichiers HTML
  montrés par l'aperçu, fiche 064) ; journal dans le profil quand le profil est isolé.
