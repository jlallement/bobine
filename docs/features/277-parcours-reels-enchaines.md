# 276 — Parcours réels enchaînés (essais de bout en bout « journées types »)

- **Statut** : en cours — parcours écrits ; défauts trouvés notés ci-dessous, à corriger ailleurs
- **Dépend de** : 115 (lanceur e2e), 002 (agent factice), 206 (pilote : même esprit, en automatique)
- **Agents** : les deux — essais contre l'agent factice seul, rien de propre à un agent

## Pourquoi

Nos quelque 120 suites e2e essaient surtout une fonction à la fois, souvent dans une app neuve.
Une conversation restaurée depuis la corbeille était inutilisable depuis au moins la rc.3 sans
qu'aucun essai ne le voie : le défaut ne se montre qu'après un enchaînement (des filles, une
suppression, une restauration, puis un message). Les défauts d'interaction se cachent là où l'état
s'accumule : plusieurs conversations, un agent qui tourne depuis longtemps, des réglages changés
en cours de route, un redémarrage de l'app.

## Critères d'acceptation

- [x] Cinq à six « journées types », une suite `parcours-*` chacune, de 7 à 13 étapes dans **une
  même instance** de l'app ; au moins une (en fait quatre) avec un redémarrage au milieu.
- [x] Contre l'agent factice seulement, jamais un vrai modèle ; aucun nouveau scénario n'a été
  nécessaire (ceux de `docs/mock-agent.md` suffisent).
- [x] Chaque étape vérifie un état visible par l'utilisateur, **puis** (outil commun
  `e2e/parcours.mjs`) : aucune ligne d'erreur au journal du main (`ERROR`, `WARN  IPC …`,
  exception ou promesse non gérée, `Error occurred in handler`), aucune exception, promesse
  rejetée ni `console.error` dans la page, et la cohérence de l'affichage (ligne active de la
  barre latérale = conversation affichée par le main, titre = ligne, point d'état = statut).
- [x] Attentes sur des états réels (`waitFor`), jamais de délai au hasard.
- [ ] Clair et sombre : passés en local (2026-11-23) sauf les deux défauts ci-dessous ; `--lang en` pas
  encore joué (e2e locales arrêtées, à jouer par `e2e.yml`).
- [x] Moins de 3 min par suite et par thème (durées au journal).
- [x] Un défaut de l'app trouvé : l'étape reste telle qu'elle doit être (rouge), le défaut est
  noté ici, rien n'est contourné.

## Les parcours

Chaque étape finit par la ligne « journal propre, affichage cohérent ».

### `parcours-matinee` — matinée de dev (13 étapes, un redémarrage)

Dépôt git jetable (`BOBINE_WORKSPACE`). 1. première demande, la conversation dans la barre
latérale ; 2. autorisation « une fois » ; 3. refus ; 4. « Toujours autoriser » puis plus de
question ; 5. vraies modifications (`modifications`), Modifications : README.md et src/app.js, diff
lu ; 6. « Faire relire… » : le Code reviewer répond dans la conversation ; 7. vue Git,
« Committer » avec le message rédigé par l'agent, commit fait, rien dans le fil ; 8. tour long
(`attend-stop`), nouvelle conversation qui répond pendant ce temps (indicateur de la première dans
la barre latérale) ; 9. retour, suite écrite pendant le tour (file) ; 10. Stop, la file attend,
« Envoyer maintenant » ; 11. modèle et mode changés, appliqués (`echo`) ; 12. ⌘Q ;
13. relance : la conversation affichée en quittant est rouverte, son fil (relecture comprise),
son modèle et son mode, l'agent relancé répond ; 14. l'autre conversation intacte répond.

### `parcours-deleguer` — déléguer (9 étapes, un redémarrage)

1. demande, puis trois travaux (`fusion-trois`), « Tout lancer », tous répondent ; 2. ouvrir un
travail depuis sa ligne, lui répondre, revenir par le lien de la mère ; 3. l'utilisateur committe
dans les worktrees (un README modifié des deux côtés : conflit à venir) ; 4. « Fusionner les 3 dans
main » : le conflit est résolu par le travail (`conflits`), main propre ; 5. supprimer un travail ;
6. supprimer la mère (et ses travaux, choix par défaut) ; 7. Réglages › Données › Corbeille :
restaurer la mère ; 8. la rouvrir et continuer à converser ; 9. ⌘Q ; 10. relance : la mère
restaurée garde son fil et répond.

### `parcours-reglages` — réglages en cours de route (10 étapes)

1. deux conversations, l'une au travail ; 2. changer de langue pendant le tour, et revenir
(interface traduite, le tour continue) ; 3. Stop, l'autre conversation a gardé son fil ;
4. thème sombre, puis système ; 5. proxy injoignable : le bandeau « n'arrive pas à joindre son
modèle » cite le proxy ; 6. proxy retiré : l'agent revient (`reseau-revenu-2-3`) ; 7. agent par
défaut changé (« Agent factice B ») : la nouvelle conversation le prend, les autres gardent le
leur ; 8. mémoire retenue, reçue par la conversation suivante (autre agent) ; 9. Réglages ›
Mémoire : voir, modifier, oublier ; 10. `@ux-ui-expert` : la carte du rôle répond.

### `parcours-outils` — outils de l'app (7 étapes)

1. ⌃` : terminal à côté, commande à la main ; 2. l'agent lance sa commande dans le terminal
(montrée, « Lancer ») et lit la sortie ; 3. navigateur intégré : page annotée, remarque envoyée
avec sa capture ; 4. autre conversation, retour : terminal et navigateur suivent la conversation ;
5. fenêtre rapide : nouvelle conversation dans la fenêtre principale ; 6. recherche dans
l'historique (contenu), ouverture du résultat ; 7. export Markdown de toute la journée.

### `parcours-longue` — longue session (8 étapes, un redémarrage)

1. 36 échanges (réponses Markdown, tableaux, code coloré, plan mêlés) ; 2. sommaire complet,
retour au 3ᵉ message ; 3. envoyer depuis le haut du fil : retour en bas ; 4. fenêtre étroite
(640 px) puis large (1600 px) : rien ne déborde ; 5. panneau ouvert puis refermé ; 6. autre
conversation et retour au long fil ; 7. ⌘Q ; 8. relance : le long fil, en bas, qui continue.

### `parcours-pannes` — pannes (9 étapes, un redémarrage)

1. deux conversations ; 2. l'agent de l'une plante en plein tour (`plantage`) : un avis ;
3. l'autre n'en sait rien et répond ; 4. écrire à la plantée relance son agent ; 5. agent
silencieux (`silence-annulable`, silence à 1,5 s) arrêté ; 6. erreur de tour (`erreur`), puis la
suite ; 7. quitter pendant un tour ; 8. relance : la conversation qui travaillait est rouverte et
reprend ; 9. l'autre a gardé ses avis et répond.

## Défauts trouvés

Les étapes restent rouges tant que le défaut est là ; rien n'est contourné.

1. **Erreurs IPC après la suppression d'une mère** (gênant ; `parcours-deleguer`, étape 6, clair
   et sombre, à chaque fois). Reproduction : une mère avec trois travaux fusionnés, un travail
   supprimé, puis la mère supprimée (et ses travaux, choix par défaut) alors qu'elle est affichée.
   Attendu : rien au journal. Obtenu : `WARN  IPC children:mergePlan : Error: Conversation
   inconnue : <id de la mère>` (deux fois) et `WARN  IPC conversation:appTools : … Conversation
   inconnue`, avec `Error occurred in handler for …`. Le renderer interroge encore la conversation
   supprimée. Déjà en cours de correction : branche `fix/chasse2-correctifs` (« erreurs IPC après
   suppression ») — les canaux `children:mergePlan` et `conversation:appTools` sont à vérifier
   dans ce correctif (celui de `filles` ne regardait que `git:status` et `commands:project`).
2. **Conversation restaurée depuis la corbeille inutilisable** (bloquant ; `parcours-deleguer`,
   étape 8). Reproduction : la mère supprimée (étape 6), Réglages › Données › Corbeille ›
   Restaurer, la rouvrir dans la barre latérale. Attendu : son fil, son agent prêt, un message
   reçoit une réponse. Obtenu : l'agent reste « Arrêté » (point d'état jamais `ready`, 15 s),
   impossible de converser. Déjà en cours de correction : branche `fix/restauration`. Les étapes
   suivantes de la journée (⌘Q, relance, la mère restaurée répond) ne sont donc pas encore jouées.

Observation (pas un défaut d'essai, à juger) : un proxy saisi dans Réglages ne vaut qu'au
« prochain lancement d'un agent » (c'est dit) ; dans une conversation déjà ouverte, le bandeau
« n'arrive pas à joindre son modèle » conseille alors de « renseigner le proxy »… qui vient de
l'être. Le parcours vérifie donc le proxy dans une nouvelle conversation.

## Plan

- `e2e/parcours.mjs` : `day(nom)` (étapes, journal, cohérence), dépôt jetable, aides de barre
  latérale, ⌘Q par le main.
- `e2e/suites/parcours-{matinee,deleguer,reglages,outils,longue,pannes}.mjs`, entrées du
  catalogue (`e2e/catalog.mjs`) avec leurs sources (dossiers entiers : ces parcours touchent
  presque toute l'app).
- Aucune dépendance, aucun nouveau scénario d'agent factice.

## Journal

- 2026-11-23 : outil commun et six parcours écrits. Écarts au plan : les trois premières séries
  ont corrigé des défauts d'essai (Modifications comptent aussi le config.json autorisé plus tôt ;
  le relecteur de l'agent factice prenait le `/scenario` de la première demande citée dans sa
  consigne : premières demandes sans `/scenario` ; la relecture crée une conversation fille dans
  la barre latérale ; proxy pris au lancement suivant d'un agent ; l'onglet Terminal n'est monté
  que s'il est affiché ; étape ⌘Q : la page n'est plus là, seul le journal du main est relu).
  Avertissement « ResizeObserver loop » de Chromium ignoré (pas un défaut de l'app).
- Dernière série locale (clair et sombre, `--jobs 3`, 3 min en tout) : matinée 45 s, déléguer
  36–38 s (rouge, défauts 1 et 2), réglages 38 s, outils 40 s, longue 58 s, pannes 49–50 s, par
  thème. `--lang en` non joué : e2e locales arrêtées à la demande, `e2e.yml` les jouera.
